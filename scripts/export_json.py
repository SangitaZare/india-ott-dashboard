"""Export the data and every analysis query to JSON for the static dashboard (dashboard/data/).

Usage:
    python scripts/export_json.py                  # data/ -> build/ott.db -> dashboard/data/*.json
    python scripts/export_json.py --out-dir PATH

The output is deterministic (no timestamps, sorted keys), so re-running it on unchanged
data produces identical files and a test can check the committed JSON is up to date.
Unknown values are exported as null - the dashboard must show them as "unknown", never 0.
"""
from __future__ import annotations

import argparse
import json
import sqlite3
import sys
import tempfile
from contextlib import closing
from pathlib import Path

from build_db import DEFAULT_DATA_DIR, build, table_name
from run_analysis import load_queries, run_query
from schemas import ALL_DATASETS, Dataset

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUT_DIR = REPO_ROOT / "dashboard" / "data"


def rows_as_dicts(columns: list[str], rows: list[tuple], dataset: Dataset | None = None) -> list[dict]:
    """Turn SQL rows into JSON-ready dicts; 0/1 booleans become false/true (NULL stays null)."""
    bool_columns = {c.name for c in dataset.columns if c.kind == "bool"} if dataset else set()
    out = []
    for row in rows:
        item = dict(zip(columns, row))
        for name in bool_columns:
            if item[name] is not None:
                item[name] = bool(item[name])
        out.append(item)
    return out


def export(data_dir: Path, out_dir: Path) -> list[Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    written = []
    with tempfile.TemporaryDirectory() as tmp:
        db = build(data_dir, Path(tmp) / "ott.db")
        with closing(sqlite3.connect(db)) as conn:
            payloads: dict[str, object] = {}
            for dataset in ALL_DATASETS:
                columns, rows = run_query(conn, f"SELECT * FROM {table_name(dataset)} ORDER BY rowid")
                payloads[table_name(dataset)] = rows_as_dicts(columns, rows, dataset)
            payloads["analysis"] = {
                name: rows_as_dicts(*run_query(conn, sql)) for name, sql in load_queries().items()
            }
            payloads["meta"] = {
                "prices_checked": conn.execute("SELECT MAX(accessed_date) FROM prices").fetchone()[0],
                "subscribers_checked": conn.execute("SELECT MAX(accessed_date) FROM subscribers").fetchone()[0],
                "bundles_checked": conn.execute("SELECT MAX(accessed_date) FROM bundles").fetchone()[0],
            }
    for name, payload in payloads.items():
        path = out_dir / f"{name}.json"
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=1, sort_keys=True) + "\n", encoding="utf-8")
        written.append(path)
    return written


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--data-dir", type=Path, default=DEFAULT_DATA_DIR)
    parser.add_argument("--out-dir", type=Path, default=DEFAULT_OUT_DIR)
    args = parser.parse_args(argv)
    try:
        paths = export(args.data_dir, args.out_dir)
    except ValueError as exc:
        print(f"Export stopped - {exc}", file=sys.stderr)
        return 1
    for path in paths:
        print(f"wrote {path.name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
