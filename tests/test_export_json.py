"""Tests for scripts/export_json.py and the static dashboard's wiring."""
from __future__ import annotations

import json
import re
from pathlib import Path

import pytest

from export_json import DEFAULT_OUT_DIR, export
from run_analysis import load_queries

REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = REPO_ROOT / "data"
DASHBOARD = REPO_ROOT / "dashboard"
EXPECTED_FILES = {"platforms", "prices", "subscribers", "bundles", "analysis", "meta"}


@pytest.fixture(scope="module")
def fresh(tmp_path_factory) -> Path:
    out = tmp_path_factory.mktemp("json")
    export(DATA_DIR, out)
    return out


def load(folder: Path, name: str):
    return json.loads((folder / f"{name}.json").read_text(encoding="utf-8"))


def test_export_writes_every_file(fresh: Path) -> None:
    assert {p.stem for p in fresh.glob("*.json")} == EXPECTED_FILES


@pytest.mark.parametrize("name", sorted(EXPECTED_FILES))
def test_committed_json_is_up_to_date(fresh: Path, name: str) -> None:
    """If this fails, run: python scripts/export_json.py"""
    committed = (DEFAULT_OUT_DIR / f"{name}.json").read_text(encoding="utf-8")
    assert committed == (fresh / f"{name}.json").read_text(encoding="utf-8")


def test_export_is_deterministic(fresh: Path, tmp_path: Path) -> None:
    export(DATA_DIR, tmp_path)
    for name in EXPECTED_FILES:
        assert (tmp_path / f"{name}.json").read_bytes() == (fresh / f"{name}.json").read_bytes()


def test_row_counts_match_csvs(fresh: Path) -> None:
    for name in ("platforms", "prices", "subscribers", "bundles"):
        csv_rows = (DATA_DIR / f"{name}.csv").read_text(encoding="utf-8").strip().count("\n")
        assert len(load(fresh, name)) == csv_rows, name


def test_unknown_values_are_null_not_zero(fresh: Path) -> None:
    prices = load(fresh, "prices")
    unknown_ads = [p for p in prices if p["platform_id"] == "hoichoi"]
    assert unknown_ads and all(p["has_ads"] is None for p in unknown_ads)


def test_booleans_are_true_false(fresh: Path) -> None:
    values = {p["has_ads"] for p in load(fresh, "prices")}
    assert values <= {True, False, None} and True in values and False in values


def test_every_analysis_query_is_exported(fresh: Path) -> None:
    assert set(load(fresh, "analysis")) == set(load_queries())


def test_meta_has_checked_dates(fresh: Path) -> None:
    meta = load(fresh, "meta")
    for key in ("prices_checked", "subscribers_checked", "bundles_checked"):
        assert re.fullmatch(r"\d{4}-\d{2}-\d{2}", meta[key]), key


# --- Dashboard wiring ---------------------------------------------------------------------


PAGES = sorted(DASHBOARD.glob("*.html"))


def test_dashboard_has_pages() -> None:
    assert {p.name for p in PAGES} >= {"index.html", "cost.html", "picker.html"}


@pytest.mark.parametrize("page", PAGES, ids=lambda p: p.name)
def test_page_local_files_exist(page: Path) -> None:
    html = page.read_text(encoding="utf-8")
    local = [ref for ref in re.findall(r'(?:src|href)="([^"]+)"', html) if not ref.startswith(("http", "#", "mailto:"))]
    assert local, "expected local css/js references"
    for ref in local:
        assert (DASHBOARD / ref).is_file(), ref


@pytest.mark.parametrize("page", PAGES, ids=lambda p: p.name)
def test_external_scripts_are_pinned_to_an_exact_version(page: Path) -> None:
    html = page.read_text(encoding="utf-8")
    for url in re.findall(r'<script[^>]+src="(https?://[^"]+)"', html):
        assert re.search(r"/\d+\.\d+\.\d+/", url), f"unpinned script: {url}"


@pytest.mark.parametrize("page", PAGES, ids=lambda p: p.name)
def test_every_page_links_to_every_finished_page(page: Path) -> None:
    html = page.read_text(encoding="utf-8")
    for other in PAGES:
        assert f'href="{other.name}"' in html, f"{page.name} has no tab for {other.name}"


def test_bundle_notes_say_whether_data_only_or_full_plan(fresh: Path) -> None:
    """cost.js classifies bundles by this notes prefix; every bundle must have one of the two."""
    for bundle in load(fresh, "bundles"):
        assert bundle["notes"].startswith(("Data pack only", "Full prepaid plan")), bundle["bundle_name"]


def test_page_only_loads_exported_json() -> None:
    names = set()
    for js in (DASHBOARD / "js").glob("*.js"):
        names |= set(re.findall(r'loadJson\("([a-z_]+)"\)', js.read_text(encoding="utf-8")))
    assert names and names <= EXPECTED_FILES
