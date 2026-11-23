"""Build the SQLite database build/ott.db from the CSV files in data/.

Usage:
    python scripts/build_db.py                       # data/ -> build/ott.db
    python scripts/build_db.py --data-dir PATH --db PATH

The data is validated first; the build stops if validation finds any error, so the
database can never contain data that breaks the CLAUDE.md rules.
Empty CSV cells become NULL ("unknown"), never 0 or "".
"""
from __future__ import annotations

import argparse
import sqlite3
import sys
from contextlib import closing
from datetime import date
from pathlib import Path

from schemas import ALL_DATASETS, BUNDLES, Column, Dataset
from validate_data import LIST_SEPARATOR, load_csv, validate

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DATA_DIR = REPO_ROOT / "data"
DEFAULT_DB = REPO_ROOT / "build" / "ott.db"
VIEWS_SQL = REPO_ROOT / "sql" / "views.sql"

# How each schema column kind is stored. Booleans become 0/1 so SQL can filter on them.
SQL_TYPES = {
    "int": "INTEGER",
    "number": "REAL",
    "bool": "INTEGER",
}


def table_name(dataset: Dataset) -> str:
    return dataset.filename.removesuffix(".csv")


def create_table_sql(dataset: Dataset) -> str:
    columns = [f"{c.name} {SQL_TYPES.get(c.kind, 'TEXT')}" for c in dataset.columns]
    return f"CREATE TABLE {table_name(dataset)} (\n  " + ",\n  ".join(columns) + "\n)"


def to_sql_value(column: Column, value: str) -> str | int | float | None:
    """Convert one validated CSV cell to the value stored in SQLite."""
    if value == "":
        return None
    if column.kind == "int":
        return int(value)
    if column.kind == "number":
        return float(value)
    if column.kind == "bool":
        return 1 if value == "true" else 0
    return value


def load_dataset(conn: sqlite3.Connection, dataset: Dataset, data_dir: Path) -> list[dict[str, str]]:
    _, rows = load_csv(data_dir / dataset.filename)
    names = dataset.column_names
    placeholders = ", ".join("?" for _ in names)
    conn.executemany(
        f"INSERT INTO {table_name(dataset)} ({', '.join(names)}) VALUES ({placeholders})",
        [tuple(to_sql_value(c, row.get(c.name, "")) for c in dataset.columns) for row in rows],
    )
    return rows


def load_bundle_platforms(conn: sqlite3.Connection, bundle_rows: list[dict[str, str]]) -> None:
    """Split the ';' list in bundles.included_platforms into one row per platform, so SQL can join on it."""
    conn.execute(
        "CREATE TABLE bundle_platforms (provider TEXT, bundle_name TEXT, billing_period TEXT,"
        " as_of_date TEXT, platform_id TEXT)"
    )
    links = [
        (row["provider"], row["bundle_name"], row["billing_period"], row["as_of_date"], item.strip())
        for row in bundle_rows
        for item in row["included_platforms"].split(LIST_SEPARATOR)
        if item.strip()
    ]
    conn.executemany("INSERT INTO bundle_platforms VALUES (?, ?, ?, ?, ?)", links)


def build(data_dir: Path, db_path: Path, today: date | None = None) -> Path:
    report = validate(data_dir, today=today)
    if not report.ok:
        raise ValueError("data validation failed:\n" + "\n".join(report.errors))

    db_path.parent.mkdir(parents=True, exist_ok=True)
    db_path.unlink(missing_ok=True)  # always rebuild from scratch: the CSVs are the source of truth
    # closing() matters on Windows: an unclosed connection keeps the .db file locked.
    with closing(sqlite3.connect(db_path)) as conn, conn:
        loaded = {}
        for dataset in ALL_DATASETS:
            conn.execute(create_table_sql(dataset))
            loaded[dataset.filename] = load_dataset(conn, dataset, data_dir)
        load_bundle_platforms(conn, loaded[BUNDLES.filename])
        conn.executescript(VIEWS_SQL.read_text(encoding="utf-8"))
    return db_path


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--data-dir", type=Path, default=DEFAULT_DATA_DIR)
    parser.add_argument("--db", type=Path, default=DEFAULT_DB)
    args = parser.parse_args(argv)
    try:
        path = build(args.data_dir, args.db)
    except ValueError as exc:
        print(f"Build stopped - {exc}", file=sys.stderr)
        return 1
    with closing(sqlite3.connect(path)) as conn:
        for dataset in ALL_DATASETS:
            count = conn.execute(f"SELECT COUNT(*) FROM {table_name(dataset)}").fetchone()[0]
            print(f"{table_name(dataset):12} {count:4} rows")
    print(f"Built {path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
