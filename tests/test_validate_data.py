"""Tests for scripts/validate_data.py.

Each test writes a tiny, fully valid dataset to a temporary folder, breaks exactly one
rule, and checks that the validator reports it. The sample rows below are FAKE test
fixtures (example.* style values) - they are never used as real data.
"""
from __future__ import annotations

import csv
from datetime import date
from pathlib import Path

import pytest

from schemas import ALL_DATASETS, BUNDLES, PLATFORMS, PRICES, SUBSCRIBERS
from validate_data import main, registrable_domain, validate

TODAY = date(2026, 11, 23)

PROVENANCE = {
    "as_of_date": "2026-11-01",
    "accessed_date": "2026-11-20",
    "source_name": "Test source",
    "notes": "",
}


def valid_rows() -> dict[str, list[dict[str, str]]]:
    return {
        PLATFORMS.filename: [
            {
                "platform_id": "streamx",
                "name": "StreamX",
                "owner": "Test Owner Ltd",
                "model": "SVOD",
                "languages": "Hindi;English",
                "has_live_cricket": "false",
                "has_free_tier": "true",
                "launch_year": "2020",
                "official_plans_url": "https://www.streamx.example.com/plans",
                "source_url": "https://www.streamx.example.com/about",
                **PROVENANCE,
            }
        ],
        PRICES.filename: [
            {
                "platform_id": "streamx",
                "plan_name": "Basic",
                "price_inr": "199",
                "billing_period": "month",
                "max_screens": "1",
                "max_quality": "HD",
                "has_ads": "false",
                "devices": "all",
                "source_url": "https://help.streamx.example.com/plans",
                **PROVENANCE,
            }
        ],
        SUBSCRIBERS.filename: [
            {
                "platform_id": "streamx",
                "value": "10",
                "value_low": "8",
                "value_high": "12",
                "unit": "millions",
                "metric_type": "paying_subscribers",
                "scope": "India",
                "source_type": "industry_report",
                "source_url": "https://report.example.org/2026",
                **PROVENANCE,
            }
        ],
        BUNDLES.filename: [
            {
                "provider": "TestTel",
                "bundle_name": "Combo",
                "price_inr": "299",
                "billing_period": "month",
                "included_platforms": "streamx",
                "source_url": "https://testtel.example.net/combo",
                **PROVENANCE,
            }
        ],
    }


def write_dataset(folder: Path, rows_by_file: dict[str, list[dict[str, str]]]) -> Path:
    for dataset in ALL_DATASETS:
        with (folder / dataset.filename).open("w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=dataset.column_names)
            writer.writeheader()
            writer.writerows(rows_by_file.get(dataset.filename, []))
    return folder


def run_with_change(tmp_path: Path, filename: str, **changes: str):
    rows = valid_rows()
    rows[filename][0].update(changes)
    return validate(write_dataset(tmp_path, rows), today=TODAY)


def assert_error(report, fragment: str) -> None:
    assert any(fragment in e for e in report.errors), f"expected '{fragment}' in {report.errors}"


# --- Happy paths --------------------------------------------------------------------


def test_valid_dataset_passes(tmp_path: Path) -> None:
    report = validate(write_dataset(tmp_path, valid_rows()), today=TODAY)
    assert report.errors == []


def test_header_only_files_pass(tmp_path: Path) -> None:
    report = validate(write_dataset(tmp_path, {}), today=TODAY)
    assert report.ok


def test_real_data_folder_passes() -> None:
    """The committed data/ folder must always be valid."""
    data_dir = Path(__file__).resolve().parent.parent / "data"
    report = validate(data_dir)
    assert report.errors == []


# --- Required provenance (CLAUDE.md rule 2) ----------------------------------------


@pytest.mark.parametrize("column", ["source_name", "source_url", "as_of_date", "accessed_date"])
@pytest.mark.parametrize("filename", [d.filename for d in ALL_DATASETS])
def test_provenance_columns_are_required(tmp_path: Path, filename: str, column: str) -> None:
    report = run_with_change(tmp_path, filename, **{column: ""})
    assert_error(report, f"'{column}' is required")


def test_missing_file_is_an_error(tmp_path: Path) -> None:
    write_dataset(tmp_path, valid_rows())
    (tmp_path / PRICES.filename).unlink()
    assert_error(validate(tmp_path, today=TODAY), "prices.csv: file not found")


def test_missing_column_is_an_error(tmp_path: Path) -> None:
    (tmp_path / PLATFORMS.filename).write_text("platform_id,name\nx,X\n", encoding="utf-8")
    for dataset in (PRICES, SUBSCRIBERS, BUNDLES):
        (tmp_path / dataset.filename).write_text(",".join(dataset.column_names) + "\n", encoding="utf-8")
    assert_error(validate(tmp_path, today=TODAY), "missing columns")


def test_unknown_column_is_an_error(tmp_path: Path) -> None:
    write_dataset(tmp_path, {})
    path = tmp_path / PRICES.filename
    path.write_text(path.read_text(encoding="utf-8").strip() + ",extra\n", encoding="utf-8")
    assert_error(validate(tmp_path, today=TODAY), "unknown columns: extra")


# --- Allowed values (CLAUDE.md rules 5 and 6) --------------------------------------


def test_invalid_metric_type(tmp_path: Path) -> None:
    assert_error(run_with_change(tmp_path, SUBSCRIBERS.filename, metric_type="users"), "'metric_type' must be one of")


def test_invalid_source_type(tmp_path: Path) -> None:
    assert_error(run_with_change(tmp_path, SUBSCRIBERS.filename, source_type="tweet"), "'source_type' must be one of")


def test_invalid_boolean(tmp_path: Path) -> None:
    assert_error(run_with_change(tmp_path, PRICES.filename, has_ads="yes"), "must be 'true' or 'false'")


def test_invalid_billing_period(tmp_path: Path) -> None:
    assert_error(run_with_change(tmp_path, PRICES.filename, billing_period="weekly"), "'billing_period' must be one of")


# --- Numbers -----------------------------------------------------------------------


def test_negative_price_is_an_error(tmp_path: Path) -> None:
    assert_error(run_with_change(tmp_path, PRICES.filename, price_inr="-1"), "cannot be negative")


@pytest.mark.parametrize("bad", ["1,099", "abc", "nan", "inf", "₹199"])
def test_non_plain_numbers_are_rejected(tmp_path: Path, bad: str) -> None:
    assert_error(run_with_change(tmp_path, PRICES.filename, price_inr=bad), "must be a number")


def test_empty_price_is_a_warning_not_an_error(tmp_path: Path) -> None:
    """CLAUDE.md rule 4: unverified values are left empty, not guessed."""
    report = run_with_change(tmp_path, PRICES.filename, price_inr="")
    assert report.ok
    assert any("'price_inr' is empty" in w for w in report.warnings)


def test_blank_validity_days_gives_no_warning(tmp_path: Path) -> None:
    """Most bundles are billed per calendar month, so a blank validity_days is complete data."""
    report = run_with_change(tmp_path, BUNDLES.filename, validity_days="")
    assert report.ok
    assert report.warnings == []


@pytest.mark.parametrize("bad, message", [("0", "at least 1"), ("00", "at least 1"), ("-28", "whole number"), ("28.5", "whole number")])
def test_invalid_validity_days(tmp_path: Path, bad: str, message: str) -> None:
    assert_error(run_with_change(tmp_path, BUNDLES.filename, validity_days=bad), message)


def test_single_figure_without_range_gives_no_warning(tmp_path: Path) -> None:
    """A source that gives just '16M' is complete data, not an unverified value."""
    report = run_with_change(tmp_path, SUBSCRIBERS.filename, value_low="", value_high="")
    assert report.ok
    assert report.warnings == []


def test_lower_bound_only_gives_no_warning(tmp_path: Path) -> None:
    """'180M+' is recorded as value_low only."""
    report = run_with_change(tmp_path, SUBSCRIBERS.filename, value="", value_low="180", value_high="")
    assert report.ok
    assert report.warnings == []


def test_empty_notes_gives_no_warning(tmp_path: Path) -> None:
    report = validate(write_dataset(tmp_path, valid_rows()), today=TODAY)
    assert report.warnings == []


def test_low_above_high(tmp_path: Path) -> None:
    report = run_with_change(tmp_path, SUBSCRIBERS.filename, value="", value_low="20", value_high="10")
    assert_error(report, "value_low 20 is greater than value_high 10")


def test_value_outside_range(tmp_path: Path) -> None:
    assert_error(run_with_change(tmp_path, SUBSCRIBERS.filename, value="15"), "above value_high")


def test_subscriber_row_needs_some_value(tmp_path: Path) -> None:
    report = run_with_change(tmp_path, SUBSCRIBERS.filename, value="", value_low="", value_high="")
    assert_error(report, "at least one of value")


def test_engagement_share_must_be_percent(tmp_path: Path) -> None:
    report = run_with_change(tmp_path, SUBSCRIBERS.filename, metric_type="engagement_share_pct")
    assert_error(report, "must use unit 'percent'")


def test_counts_cannot_be_percent(tmp_path: Path) -> None:
    report = run_with_change(tmp_path, SUBSCRIBERS.filename, unit="percent")
    assert_error(report, "is a count and must use unit 'millions'")


def test_percent_above_100(tmp_path: Path) -> None:
    report = run_with_change(
        tmp_path, SUBSCRIBERS.filename,
        metric_type="engagement_share_pct", unit="percent", value="120", value_low="", value_high="",
    )
    assert_error(report, "cannot be above 100")


# --- Dates and URLs ----------------------------------------------------------------


@pytest.mark.parametrize("bad", ["23/11/2026", "2026-13-01", "2026-11", "Nov 2026"])
def test_bad_date_format(tmp_path: Path, bad: str) -> None:
    assert_error(run_with_change(tmp_path, PRICES.filename, as_of_date=bad), "YYYY-MM-DD")


def test_accessed_date_in_future(tmp_path: Path) -> None:
    assert_error(run_with_change(tmp_path, PRICES.filename, accessed_date="2026-12-31"), "is in the future")


def test_as_of_after_accessed(tmp_path: Path) -> None:
    assert_error(run_with_change(tmp_path, PRICES.filename, as_of_date="2026-11-21"), "is after accessed_date")


@pytest.mark.parametrize("bad", ["netflix.com", "ftp://netflix.com", "see website", "https://localhost"])
def test_bad_url(tmp_path: Path, bad: str) -> None:
    assert_error(run_with_change(tmp_path, SUBSCRIBERS.filename, source_url=bad), "must be a full http(s) URL")


# --- Cross-file rules --------------------------------------------------------------


def test_price_from_unofficial_site_is_rejected(tmp_path: Path) -> None:
    """CLAUDE.md rule 3: prices only from the platform's own website."""
    report = run_with_change(tmp_path, PRICES.filename, source_url="https://some-blog.example.org/streamx-prices")
    assert_error(report, "not the official site")


def test_price_from_official_subdomain_is_accepted(tmp_path: Path) -> None:
    report = run_with_change(tmp_path, PRICES.filename, source_url="https://www.streamx.example.com/in/plans")
    assert report.ok


def test_unknown_platform_in_prices(tmp_path: Path) -> None:
    assert_error(run_with_change(tmp_path, PRICES.filename, platform_id="nope"), "not in platforms.csv")


def test_market_total_allowed_only_in_subscribers(tmp_path: Path) -> None:
    assert run_with_change(tmp_path, SUBSCRIBERS.filename, platform_id="market_total").ok
    assert_error(run_with_change(tmp_path, PRICES.filename, platform_id="market_total"), "not in platforms.csv")


def test_unknown_platform_in_bundle(tmp_path: Path) -> None:
    report = run_with_change(tmp_path, BUNDLES.filename, included_platforms="streamx;ghostflix")
    assert_error(report, "included platform 'ghostflix'")


def test_duplicate_rows(tmp_path: Path) -> None:
    rows = valid_rows()
    rows[PRICES.filename].append(dict(rows[PRICES.filename][0]))
    report = validate(write_dataset(tmp_path, rows), today=TODAY)
    assert_error(report, "duplicate of line 2")


def test_duplicate_platform_id(tmp_path: Path) -> None:
    rows = valid_rows()
    rows[PLATFORMS.filename].append(dict(rows[PLATFORMS.filename][0]))
    assert_error(validate(write_dataset(tmp_path, rows), today=TODAY), "platforms.csv line 3: duplicate")


# --- Helpers and command line ------------------------------------------------------


@pytest.mark.parametrize(
    ("url", "expected"),
    [
        ("https://www.netflix.com/in/", "netflix.com"),
        ("https://help.netflix.com/en/node/24926", "netflix.com"),
        ("https://www.primevideo.com/offers", "primevideo.com"),
        ("https://shop.example.co.in/x", "example.co.in"),
    ],
)
def test_registrable_domain(url: str, expected: str) -> None:
    assert registrable_domain(url) == expected


def test_cli_exit_codes(tmp_path: Path) -> None:
    good = write_dataset(tmp_path, valid_rows())
    assert main(["--data-dir", str(good)]) == 0
    (good / PRICES.filename).unlink()
    assert main(["--data-dir", str(good)]) == 1


@pytest.mark.parametrize(
    "filename, column",
    [
        (PLATFORMS.filename, "owner"),
        (PLATFORMS.filename, "model"),
        (PLATFORMS.filename, "languages"),
        (PLATFORMS.filename, "has_live_cricket"),
        (PLATFORMS.filename, "has_free_tier"),
        (PRICES.filename, "has_ads"),
        (PRICES.filename, "devices"),
    ],
)
def test_unverified_facts_are_a_warning_not_an_error(tmp_path: Path, filename: str, column: str) -> None:
    """A plan page that doesn't say whether there are ads is left blank, not guessed."""
    report = run_with_change(tmp_path, filename, **{column: ""})
    assert report.ok
    assert any(f"'{column}' is empty" in w for w in report.warnings)


@pytest.mark.parametrize(
    "filename, column",
    [
        (PLATFORMS.filename, "platform_id"),
        (PLATFORMS.filename, "name"),
        (PLATFORMS.filename, "official_plans_url"),
        (PRICES.filename, "plan_name"),
        (PRICES.filename, "billing_period"),
    ],
)
def test_identity_columns_stay_required(tmp_path: Path, filename: str, column: str) -> None:
    assert_error(run_with_change(tmp_path, filename, **{column: ""}), f"'{column}' is required")
