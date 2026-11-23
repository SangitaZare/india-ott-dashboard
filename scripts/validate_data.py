"""Validate every CSV in data/ against the schemas and the data-integrity rules in CLAUDE.md.

Usage:
    python scripts/validate_data.py                 # validates ./data
    python scripts/validate_data.py --data-dir PATH

Exit code 0 = valid (warnings allowed), 1 = at least one error.
Errors break a rule and must be fixed. Warnings flag things a human should look at,
such as a value left empty because it could not be verified yet.
"""
from __future__ import annotations

import argparse
import csv
import math
import sys
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from urllib.parse import urlparse

from schemas import (
    ALL_DATASETS,
    BOOLEANS,
    BUNDLES,
    MARKET_TOTAL_ID,
    PLATFORMS,
    PRICES,
    SUBSCRIBERS,
    Column,
    Dataset,
)

LIST_SEPARATOR = ";"
DEFAULT_DATA_DIR = Path(__file__).resolve().parent.parent / "data"

# Second-level domains where the registrable domain has three labels (e.g. example.co.in).
_MULTI_PART_SUFFIXES = {"co.in", "net.in", "org.in", "co.uk"}

Row = dict[str, str]


@dataclass
class Report:
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    def error(self, where: str, message: str) -> None:
        self.errors.append(f"{where}: {message}")

    def warn(self, where: str, message: str) -> None:
        self.warnings.append(f"{where}: {message}")

    @property
    def ok(self) -> bool:
        return not self.errors


# --- Loading -----------------------------------------------------------------------


def load_csv(path: Path) -> tuple[list[str], list[Row]]:
    """Read a CSV as text. Every cell stays a string so nothing is silently converted."""
    with path.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        header = [name.strip() for name in (reader.fieldnames or [])]
        rows = [
            {key.strip(): (value or "").strip() for key, value in raw.items() if key is not None}
            for raw in reader
        ]
    return header, rows


def location(dataset: Dataset, row_index: int) -> str:
    """Spreadsheet-style line number: line 1 is the header, so data row 0 is line 2."""
    return f"{dataset.filename} line {row_index + 2}"


# --- Single-cell checks ------------------------------------------------------------


def parse_date(value: str) -> date | None:
    try:
        return date.fromisoformat(value) if len(value) == 10 else None
    except ValueError:
        return None


def parse_number(value: str) -> float | None:
    """Plain numbers only: '1099' or '1099.5'. Rejects '1,099', 'nan' and 'inf'."""
    try:
        number = float(value)
    except ValueError:
        return None
    return number if math.isfinite(number) else None


def is_valid_url(value: str) -> bool:
    parsed = urlparse(value)
    return parsed.scheme in {"http", "https"} and "." in parsed.netloc


def check_cell(column: Column, value: str) -> str | None:
    """Return an error message if the value breaks the column's rules, else None."""
    if value == "":
        return f"'{column.name}' is required" if column.required else None

    if column.kind == "int":
        if not value.isdigit():
            return f"'{column.name}' must be a whole number, got '{value}'"
    elif column.kind == "number":
        number = parse_number(value)
        if number is None:
            return f"'{column.name}' must be a number, got '{value}'"
        if number < 0:
            return f"'{column.name}' cannot be negative, got '{value}'"
    elif column.kind == "date":
        if parse_date(value) is None:
            return f"'{column.name}' must be a date in YYYY-MM-DD format, got '{value}'"
    elif column.kind == "url":
        if not is_valid_url(value):
            return f"'{column.name}' must be a full http(s) URL, got '{value}'"
    elif column.kind == "bool":
        if value not in BOOLEANS:
            return f"'{column.name}' must be 'true' or 'false', got '{value}'"
    elif column.kind == "enum":
        if value not in column.choices:
            allowed = ", ".join(sorted(column.choices))
            return f"'{column.name}' must be one of [{allowed}], got '{value}'"
    elif column.kind == "list":
        if any(item.strip() == "" for item in value.split(LIST_SEPARATOR)):
            return f"'{column.name}' has an empty item; separate items with '{LIST_SEPARATOR}'"
    return None


# --- Whole-dataset checks ----------------------------------------------------------


def check_header(dataset: Dataset, header: list[str], report: Report) -> bool:
    expected = dataset.column_names
    missing = [name for name in expected if name not in header]
    unknown = [name for name in header if name not in expected]
    if missing:
        report.error(dataset.filename, f"missing columns: {', '.join(missing)}")
    if unknown:
        report.error(dataset.filename, f"unknown columns: {', '.join(unknown)}")
    return not missing


def check_rows(dataset: Dataset, rows: list[Row], report: Report, today: date) -> None:
    seen_keys: dict[tuple[str, ...], int] = {}
    for index, row in enumerate(rows):
        where = location(dataset, index)

        for column in dataset.columns:
            value = row.get(column.name, "")
            message = check_cell(column, value)
            if message:
                report.error(where, message)
            elif value == "" and column.warn_if_empty:
                report.warn(where, f"'{column.name}' is empty - list it in data/TODO_verify.md")

        check_dates(row, where, report, today)

        key = tuple(row.get(name, "") for name in dataset.unique_key)
        if key in seen_keys:
            first_line = seen_keys[key] + 2
            report.error(where, f"duplicate of line {first_line} (same {', '.join(dataset.unique_key)})")
        else:
            seen_keys[key] = index


def check_dates(row: Row, where: str, report: Report, today: date) -> None:
    """A figure must refer to a date before we checked it, and we can't check in the future."""
    as_of = parse_date(row.get("as_of_date", ""))
    accessed = parse_date(row.get("accessed_date", ""))
    if accessed and accessed > today:
        report.error(where, f"accessed_date {accessed} is in the future")
    if as_of and accessed and as_of > accessed:
        report.error(where, f"as_of_date {as_of} is after accessed_date {accessed}")


def registrable_domain(url: str) -> str:
    """'https://www.help.netflix.com/in' -> 'netflix.com'; 'https://x.co.in' -> 'x.co.in'."""
    host = (urlparse(url).hostname or "").lower()
    labels = host.split(".")
    keep = 3 if ".".join(labels[-2:]) in _MULTI_PART_SUFFIXES else 2
    return ".".join(labels[-keep:])


def check_platform_refs(
    dataset: Dataset, rows: list[Row], platform_ids: set[str], report: Report, allow_market_total: bool
) -> None:
    valid = platform_ids | ({MARKET_TOTAL_ID} if allow_market_total else set())
    for index, row in enumerate(rows):
        platform_id = row.get("platform_id", "")
        if platform_id and platform_id not in valid:
            report.error(location(dataset, index), f"platform_id '{platform_id}' is not in platforms.csv")


def check_prices_are_official(prices: list[Row], platforms: list[Row], report: Report) -> None:
    """CLAUDE.md rule 3: a price's source must be on the platform's own website."""
    official = {p["platform_id"]: registrable_domain(p["official_plans_url"]) for p in platforms}
    for index, row in enumerate(prices):
        expected = official.get(row.get("platform_id", ""))
        actual = registrable_domain(row.get("source_url", ""))
        if expected and actual and actual != expected:
            report.error(
                location(PRICES, index),
                f"price source '{actual}' is not the official site '{expected}' - prices must come from official plan pages",
            )


def check_subscriber_values(rows: list[Row], report: Report) -> None:
    for index, row in enumerate(rows):
        where = location(SUBSCRIBERS, index)
        metric, unit = row.get("metric_type", ""), row.get("unit", "")

        # Engagement share is a percentage of viewing, never a count of people.
        if metric == "engagement_share_pct" and unit != "percent":
            report.error(where, "metric_type 'engagement_share_pct' must use unit 'percent'")
        if metric and metric != "engagement_share_pct" and unit == "percent":
            report.error(where, f"metric_type '{metric}' is a count and must use unit 'millions'")

        value, low, high = (parse_number(row.get(n, "")) for n in ("value", "value_low", "value_high"))
        if value is None and low is None and high is None:
            report.error(where, "at least one of value, value_low, value_high is needed")
        if low is not None and high is not None and low > high:
            report.error(where, f"value_low {low:g} is greater than value_high {high:g}")
        if value is not None and low is not None and value < low:
            report.error(where, f"value {value:g} is below value_low {low:g}")
        if value is not None and high is not None and value > high:
            report.error(where, f"value {value:g} is above value_high {high:g}")
        if unit == "percent" and any(v is not None and v > 100 for v in (value, low, high)):
            report.error(where, "a percentage cannot be above 100")


def check_bundle_platforms(rows: list[Row], platform_ids: set[str], report: Report) -> None:
    for index, row in enumerate(rows):
        for item in row.get("included_platforms", "").split(LIST_SEPARATOR):
            item = item.strip()
            if item and item not in platform_ids:
                report.error(location(BUNDLES, index), f"included platform '{item}' is not in platforms.csv")


# --- Entry points ------------------------------------------------------------------


def validate(data_dir: Path, today: date | None = None) -> Report:
    today = today or date.today()
    report = Report()
    loaded: dict[str, list[Row]] = {}

    for dataset in ALL_DATASETS:
        path = data_dir / dataset.filename
        if not path.is_file():
            report.error(dataset.filename, "file not found")
            continue
        header, rows = load_csv(path)
        if check_header(dataset, header, report):
            check_rows(dataset, rows, report, today)
            loaded[dataset.filename] = rows

    platforms = loaded.get(PLATFORMS.filename)
    if platforms is None:
        return report  # cross-file checks need a valid platforms.csv
    platform_ids = {row["platform_id"] for row in platforms if row["platform_id"]}

    if (prices := loaded.get(PRICES.filename)) is not None:
        check_platform_refs(PRICES, prices, platform_ids, report, allow_market_total=False)
        check_prices_are_official(prices, platforms, report)
    if (subscribers := loaded.get(SUBSCRIBERS.filename)) is not None:
        check_platform_refs(SUBSCRIBERS, subscribers, platform_ids, report, allow_market_total=True)
        check_subscriber_values(subscribers, report)
    if (bundles := loaded.get(BUNDLES.filename)) is not None:
        check_bundle_platforms(bundles, platform_ids, report)

    return report


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--data-dir", type=Path, default=DEFAULT_DATA_DIR)
    args = parser.parse_args(argv)

    report = validate(args.data_dir)
    for message in report.errors:
        print(f"ERROR   {message}")
    for message in report.warnings:
        print(f"WARNING {message}")
    status = "PASSED" if report.ok else "FAILED"
    print(f"\nData validation {status}: {len(report.errors)} error(s), {len(report.warnings)} warning(s)")
    return 0 if report.ok else 1


if __name__ == "__main__":
    sys.exit(main())
