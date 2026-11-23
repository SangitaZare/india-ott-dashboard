"""Run every named query in sql/analysis.sql against build/ott.db and print the results.

Usage:
    python scripts/build_db.py        # first, (re)build the database
    python scripts/run_analysis.py    # then run all queries
    python scripts/run_analysis.py cheapest_ad_free_4k   # or just one
"""
from __future__ import annotations

import argparse
import re
import sqlite3
import sys
from contextlib import closing
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
ANALYSIS_SQL = REPO_ROOT / "sql" / "analysis.sql"
DEFAULT_DB = REPO_ROOT / "build" / "ott.db"

_NAME_LINE = re.compile(r"^-- name:\s*(\w+)\s*$", re.MULTILINE)


def load_queries(path: Path = ANALYSIS_SQL) -> dict[str, str]:
    """Split analysis.sql into {query name: SQL} using its '-- name: x' markers."""
    text = path.read_text(encoding="utf-8")
    markers = list(_NAME_LINE.finditer(text))
    queries = {}
    for index, marker in enumerate(markers):
        end = markers[index + 1].start() if index + 1 < len(markers) else len(text)
        queries[marker.group(1)] = text[marker.end():end].strip()
    return queries


def run_query(conn: sqlite3.Connection, sql: str) -> tuple[list[str], list[tuple]]:
    cursor = conn.execute(sql)
    return [d[0] for d in cursor.description], cursor.fetchall()


def format_table(columns: list[str], rows: list[tuple]) -> str:
    cells = [[("" if v is None else str(v)) for v in row] for row in rows]
    widths = [max([len(c)] + [len(r[i]) for r in cells]) for i, c in enumerate(columns)]
    lines = ["  ".join(c.ljust(w) for c, w in zip(columns, widths))]
    lines.append("  ".join("-" * w for w in widths))
    lines += ["  ".join(v.ljust(w) for v, w in zip(r, widths)) for r in cells]
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("names", nargs="*", help="query names to run (default: all)")
    parser.add_argument("--db", type=Path, default=DEFAULT_DB)
    args = parser.parse_args(argv)

    if not args.db.is_file():
        print(f"{args.db} not found - run python scripts/build_db.py first", file=sys.stderr)
        return 1
    queries = load_queries()
    unknown = [n for n in args.names if n not in queries]
    if unknown:
        print(f"Unknown query: {', '.join(unknown)}. Available: {', '.join(queries)}", file=sys.stderr)
        return 1

    with closing(sqlite3.connect(args.db)) as conn:
        for name in args.names or queries:
            columns, rows = run_query(conn, queries[name])
            print(f"\n=== {name} ({len(rows)} rows) ===")
            print(format_table(columns, rows) if rows else "(no rows)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
