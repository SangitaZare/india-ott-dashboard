"""Tests for scripts/build_db.py and the queries in sql/analysis.sql.

Each test builds a database from a tiny FAKE dataset (example.* values, never real data)
whose answers are easy to work out by hand, then checks every calculation.
"""
from __future__ import annotations

import csv
import sqlite3
from contextlib import closing
from datetime import date
from pathlib import Path

import pytest

from build_db import build
from run_analysis import load_queries, main as run_analysis_main, run_query
from schemas import ALL_DATASETS, BUNDLES, PLATFORMS, PRICES, SUBSCRIBERS

TODAY = date(2026, 11, 23)
PROV = {"as_of_date": "2026-11-01", "accessed_date": "2026-11-20", "source_name": "Test", "notes": ""}


def platform(pid: str) -> dict[str, str]:
    return {
        "platform_id": pid, "name": pid.upper(), "owner": "", "model": "", "languages": "",
        "has_live_cricket": "", "has_free_tier": "", "launch_year": "",
        "official_plans_url": f"https://{pid}.example.com/plans", "source_url": f"https://{pid}.example.com/about", **PROV,
    }


def price(pid: str, plan: str, inr: str, period: str, screens: str = "", quality: str = "",
          ads: str = "", as_of: str = "2026-11-01") -> dict[str, str]:
    return {
        "platform_id": pid, "plan_name": plan, "price_inr": inr, "billing_period": period,
        "max_screens": screens, "max_quality": quality, "has_ads": ads, "devices": "all",
        "source_url": f"https://{pid}.example.com/plans", **PROV, "as_of_date": as_of,
    }


def subscriber(pid: str, metric: str, value: str = "", low: str = "", high: str = "",
               source: str = "Test", stype: str = "industry_report") -> dict[str, str]:
    return {
        "platform_id": pid, "value": value, "value_low": low, "value_high": high, "unit": "millions",
        "metric_type": metric, "scope": "India", "source_type": stype,
        "source_url": "https://report.example.org/x", **PROV, "source_name": source,
    }


def bundle(name: str, inr: str, period: str, platforms: str) -> dict[str, str]:
    return {
        "provider": "TestTel", "bundle_name": name, "price_inr": inr, "billing_period": period,
        "included_platforms": platforms, "source_url": "https://testtel.example.net/b", **PROV,
    }


def fixture_rows() -> dict[str, list[dict[str, str]]]:
    return {
        PLATFORMS.filename: [platform("a"), platform("b"), platform("c")],
        PRICES.filename: [
            price("a", "Basic", "100", "month", screens="2", quality="HD", ads="true"),
            price("a", "Basic", "80", "month", screens="2", quality="HD", ads="true", as_of="2026-01-01"),  # old price
            price("a", "Basic", "960", "year", screens="2", quality="HD", ads="true"),
            price("a", "Ultra", "300", "month", screens="4", quality="4K", ads="false"),
            price("b", "Max", "1200", "year", screens="", quality="4K", ads="false"),  # screens unknown
            price("b", "Lite", "150", "quarter", screens="1", quality="4K", ads=""),  # ads unknown
            price("b", "Unpriced", "", "month"),  # price unknown
        ],
        SUBSCRIBERS.filename: [
            subscriber("a", "paying_subscribers", value="10", source="S1"),
            subscriber("a", "paying_subscribers", low="12", source="S2"),  # "over 12"
            subscriber("a", "paying_subscribers", low="8", high="15", source="S3"),  # "8-15"
            subscriber("a", "viewers", value="50", source="S1"),
        ],
        BUNDLES.filename: [
            bundle("Combo", "100", "month", "a;b"),
            bundle("Partial", "1200", "year", "a;c"),  # c has no prices
        ],
    }


def write_csvs(folder: Path, rows_by_file: dict[str, list[dict[str, str]]]) -> Path:
    folder.mkdir(parents=True, exist_ok=True)
    for dataset in ALL_DATASETS:
        with (folder / dataset.filename).open("w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=dataset.column_names)
            writer.writeheader()
            writer.writerows(rows_by_file.get(dataset.filename, []))
    return folder


@pytest.fixture
def conn(tmp_path: Path):
    db = build(write_csvs(tmp_path / "data", fixture_rows()), tmp_path / "ott.db", today=TODAY)
    connection = sqlite3.connect(db)
    connection.row_factory = sqlite3.Row
    yield connection
    connection.close()


def query(conn: sqlite3.Connection, name: str) -> list[sqlite3.Row]:
    return conn.execute(load_queries()[name]).fetchall()


def by_plan(rows: list[sqlite3.Row]) -> dict[tuple[str, str, str], sqlite3.Row]:
    return {(r["platform_id"], r["plan_name"], r["billing_period"]): r for r in rows}


# --- build_db ----------------------------------------------------------------------


def test_build_loads_every_row(conn) -> None:
    counts = {t: conn.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
              for t in ("platforms", "prices", "subscribers", "bundles", "bundle_platforms")}
    assert counts == {"platforms": 3, "prices": 7, "subscribers": 4, "bundles": 2, "bundle_platforms": 4}


def test_empty_cells_become_null_not_zero(conn) -> None:
    row = conn.execute("SELECT price_inr, max_screens, has_ads FROM prices WHERE plan_name = 'Unpriced'").fetchone()
    assert tuple(row) == (None, None, None)


def test_booleans_and_numbers_are_typed(conn) -> None:
    row = conn.execute("SELECT has_ads, price_inr, max_screens FROM prices WHERE plan_name = 'Ultra'").fetchone()
    assert (row["has_ads"], row["price_inr"], row["max_screens"]) == (0, 300.0, 4)


def test_build_refuses_invalid_data(tmp_path: Path) -> None:
    rows = fixture_rows()
    rows[PRICES.filename][0]["price_inr"] = "-5"
    with pytest.raises(ValueError, match="cannot be negative"):
        build(write_csvs(tmp_path / "data", rows), tmp_path / "ott.db", today=TODAY)
    assert not (tmp_path / "ott.db").exists()


def test_rebuild_replaces_old_database(tmp_path: Path) -> None:
    data = write_csvs(tmp_path / "data", fixture_rows())
    build(data, tmp_path / "ott.db", today=TODAY)
    build(data, tmp_path / "ott.db", today=TODAY)
    with closing(sqlite3.connect(tmp_path / "ott.db")) as c:
        assert c.execute("SELECT COUNT(*) FROM prices").fetchone()[0] == 7


# --- views ---------------------------------------------------------------------------


def test_current_prices_ignores_older_price_rows(conn) -> None:
    rows = conn.execute("SELECT price_inr FROM current_prices WHERE plan_name = 'Basic' AND billing_period = 'month'")
    assert [r[0] for r in rows] == [100.0]


@pytest.mark.parametrize(
    "plan, period, expected",
    [("Basic", "month", 100.0), ("Basic", "year", 80.0), ("Lite", "quarter", 50.0), ("Max", "year", 100.0)],
)
def test_monthly_price_conversion(conn, plan: str, period: str, expected: float) -> None:
    row = conn.execute(
        "SELECT price_per_month FROM monthly_prices WHERE plan_name = ? AND billing_period = ?", (plan, period)
    ).fetchone()
    assert row[0] == pytest.approx(expected)


def test_unpriced_plans_are_not_in_monthly_prices(conn) -> None:
    assert conn.execute("SELECT COUNT(*) FROM monthly_prices WHERE plan_name = 'Unpriced'").fetchone()[0] == 0


# --- Q1 subscriber spread --------------------------------------------------------------


def test_subscriber_spread_uses_range_ends(conn) -> None:
    rows = {(r["platform_id"], r["metric_type"]): r for r in query(conn, "subscriber_estimate_spread")}
    paying = rows[("a", "paying_subscribers")]
    # Estimates: 10, "over 12", "8-15" -> lowest low end 8, highest high end 15.
    assert (paying["estimates"], paying["min_estimate"], paying["max_estimate"]) == (3, 8.0, 15.0)
    assert paying["spread"] == 7.0
    assert paying["spread_pct"] == 87.5


def test_subscriber_spread_never_mixes_metric_types(conn) -> None:
    rows = {(r["platform_id"], r["metric_type"]): r for r in query(conn, "subscriber_estimate_spread")}
    viewers = rows[("a", "viewers")]
    assert (viewers["estimates"], viewers["min_estimate"], viewers["max_estimate"]) == (1, 50.0, 50.0)


# --- Q2 price per screen and cheapest plan ---------------------------------------------


def test_price_per_screen_per_month(conn) -> None:
    rows = by_plan(query(conn, "price_per_screen"))
    assert rows[("a", "Basic", "month")]["price_per_screen_per_month"] == 50.0  # 100 / 2
    assert rows[("a", "Basic", "year")]["price_per_screen_per_month"] == 40.0  # 960 / 12 / 2
    assert rows[("a", "Ultra", "month")]["price_per_screen_per_month"] == 75.0  # 300 / 4


def test_price_per_screen_is_null_when_screens_unknown(conn) -> None:
    rows = by_plan(query(conn, "price_per_screen"))
    assert rows[("b", "Max", "year")]["price_per_screen_per_month"] is None


def test_cheapest_plan_per_platform(conn) -> None:
    rows = {r["platform_id"]: r for r in query(conn, "cheapest_plan_per_platform")}
    assert (rows["a"]["plan_name"], rows["a"]["billing_period"], rows["a"]["price_per_month"]) == ("Basic", "year", 80.0)
    assert (rows["b"]["plan_name"], rows["b"]["price_per_month"]) == ("Lite", 50.0)
    assert "c" not in rows  # no prices at all


def test_cheapest_plan_keeps_ties(conn) -> None:
    conn.execute(
        "INSERT INTO prices (platform_id, plan_name, price_inr, billing_period, as_of_date) "
        "VALUES ('b', 'Lite Twin', 150, 'quarter', '2026-11-01')"
    )
    plans = sorted(r["plan_name"] for r in query(conn, "cheapest_plan_per_platform") if r["platform_id"] == "b")
    assert plans == ["Lite", "Lite Twin"]


# --- Q3 annual vs monthly ---------------------------------------------------------------


def test_annual_vs_monthly_savings(conn) -> None:
    rows = query(conn, "annual_vs_monthly_savings")
    assert len(rows) == 1  # only a/Basic is sold both monthly and yearly
    row = rows[0]
    # 12 x 100 = 1200 vs 960 per year -> saves 240, i.e. 20%. The old ₹80 monthly row is ignored.
    assert (row["twelve_months_cost"], row["yearly_savings_inr"], row["savings_pct"]) == (1200.0, 240.0, 20.0)


# --- Q4 cheapest ad-free 4K ---------------------------------------------------------------


def test_cheapest_ad_free_4k_order_and_exclusions(conn) -> None:
    rows = query(conn, "cheapest_ad_free_4k")
    assert [(r["platform_id"], r["plan_name"], r["price_per_month"]) for r in rows] == [
        ("b", "Max", 100.0),
        ("a", "Ultra", 300.0),
    ]  # b/Lite is 4K but its ads are unknown, so it is left out rather than assumed ad-free


# --- Q5 bundle vs separate -------------------------------------------------------------------


def test_bundle_vs_separate(conn) -> None:
    rows = {r["bundle_name"]: r for r in query(conn, "bundle_vs_separate")}
    combo = rows["Combo"]
    # Separately: cheapest a (80/month) + cheapest b (50/month) = 130 vs bundle 100.
    assert (combo["separate_per_month"], combo["monthly_savings"], combo["complete_comparison"]) == (130.0, 30.0, 1)


def test_bundle_with_unpriced_platform_is_flagged_incomplete(conn) -> None:
    partial = {r["bundle_name"]: r for r in query(conn, "bundle_vs_separate")}["Partial"]
    assert (partial["platforms_included"], partial["platforms_priced"], partial["complete_comparison"]) == (2, 1, 0)


# --- run_analysis -----------------------------------------------------------------------------


def test_analysis_file_has_every_planned_query() -> None:
    assert set(load_queries()) == {
        "subscriber_estimate_spread",
        "price_per_screen",
        "cheapest_plan_per_platform",
        "annual_vs_monthly_savings",
        "cheapest_ad_free_4k",
        "bundle_vs_separate",
    }


def test_real_data_builds_and_every_query_runs(tmp_path: Path) -> None:
    """The committed data/ folder must always build and answer every question."""
    data_dir = Path(__file__).resolve().parent.parent / "data"
    db = build(data_dir, tmp_path / "ott.db")
    with closing(sqlite3.connect(db)) as c:
        for name, sql in load_queries().items():
            columns, _ = run_query(c, sql)
            assert columns, name


def test_run_analysis_reports_missing_database(tmp_path: Path) -> None:
    assert run_analysis_main(["--db", str(tmp_path / "missing.db")]) == 1
