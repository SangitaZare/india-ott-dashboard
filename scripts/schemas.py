"""Column definitions for every dataset in data/.

This is the single source of truth for the CSV layouts. The validator (validate_data.py)
and, later, build_db.py both read from here, so a column is only ever defined once.
Human-readable explanations live in data/DATA_DICTIONARY.md - keep the two in sync.
"""
from __future__ import annotations

from dataclasses import dataclass, field

# --- Allowed values (CLAUDE.md section 2) ---------------------------------------------

METRIC_TYPES = {
    "paying_subscribers",
    "subscriptions",
    "subscribing_households",
    "active_paid_subscriptions",
    "viewers",
    "audience",
    "engagement_share_pct",
}

SOURCE_TYPES = {
    "company_official",
    "industry_report",
    "broker_note",
    "news_report",
    "stats_website",
    "blog",
}

PLATFORM_MODELS = {"SVOD", "AVOD", "hybrid"}
BILLING_PERIODS = {"month", "quarter", "year"}
VIDEO_QUALITIES = {"SD", "HD", "FHD", "4K"}
DEVICE_SCOPES = {"mobile_only", "all"}
UNITS = {"millions", "percent"}
SCOPES = {"India"}
BOOLEANS = {"true", "false"}

# Figures that describe the whole Indian OTT market rather than one platform.
MARKET_TOTAL_ID = "market_total"


@dataclass(frozen=True)
class Column:
    name: str
    kind: str  # one of: text, int, number, date, url, bool, enum, list, platform_ref
    required: bool = True  # False = may be left empty (e.g. not yet verified)
    choices: frozenset[str] = field(default_factory=frozenset)
    # Empty optional cells normally mean "not verified yet" and produce a warning.
    # Set False where empty is a normal, complete answer (e.g. a source gave no range).
    blank_is_normal: bool = False

    @property
    def warn_if_empty(self) -> bool:
        return not self.required and not self.blank_is_normal


@dataclass(frozen=True)
class Dataset:
    filename: str
    columns: tuple[Column, ...]
    unique_key: tuple[str, ...]

    @property
    def column_names(self) -> list[str]:
        return [c.name for c in self.columns]


def _enum(name: str, choices: set[str], required: bool = True) -> Column:
    return Column(name, "enum", required, frozenset(choices))


# Every dataset ends with the same provenance columns (CLAUDE.md section 2, rule 2).
PROVENANCE = (
    Column("as_of_date", "date"),
    Column("accessed_date", "date"),
    Column("source_name", "text"),
    Column("source_url", "url"),
    Column("notes", "text", required=False, blank_is_normal=True),
)

PLATFORMS = Dataset(
    filename="platforms.csv",
    columns=(
        Column("platform_id", "text"),
        Column("name", "text"),
        # Facts below may be blank while unverified (CLAUDE.md rule 4) - blank gives a warning.
        Column("owner", "text", required=False),
        _enum("model", PLATFORM_MODELS, required=False),
        Column("languages", "list", required=False),
        Column("has_live_cricket", "bool", required=False),
        Column("has_free_tier", "bool", required=False),
        Column("launch_year", "int", required=False),
        Column("official_plans_url", "url"),
        *PROVENANCE,
    ),
    unique_key=("platform_id",),
)

PRICES = Dataset(
    filename="prices.csv",
    columns=(
        Column("platform_id", "platform_ref"),
        Column("plan_name", "text"),
        Column("price_inr", "number", required=False),
        _enum("billing_period", BILLING_PERIODS),
        Column("max_screens", "int", required=False),
        _enum("max_quality", VIDEO_QUALITIES, required=False),
        Column("has_ads", "bool", required=False),
        _enum("devices", DEVICE_SCOPES, required=False),
        *PROVENANCE,
    ),
    unique_key=("platform_id", "plan_name", "billing_period", "as_of_date"),
)

SUBSCRIBERS = Dataset(
    filename="subscribers.csv",
    columns=(
        Column("platform_id", "platform_ref"),
        # A source may give a single figure ("16M") or only a range ("180M+"), so any of
        # these may be blank. validate_data.py still errors if all three are blank.
        Column("value", "number", required=False, blank_is_normal=True),
        Column("value_low", "number", required=False, blank_is_normal=True),
        Column("value_high", "number", required=False, blank_is_normal=True),
        _enum("unit", UNITS),
        _enum("metric_type", METRIC_TYPES),
        _enum("scope", SCOPES),
        _enum("source_type", SOURCE_TYPES),
        *PROVENANCE,
    ),
    unique_key=("platform_id", "metric_type", "as_of_date", "source_name"),
)

BUNDLES = Dataset(
    filename="bundles.csv",
    columns=(
        Column("provider", "text"),
        Column("bundle_name", "text"),
        Column("price_inr", "number", required=False),
        _enum("billing_period", BILLING_PERIODS),
        # Telecom plans last e.g. 28 or 84 days, not calendar months. When the page states
        # a validity in days, record it here; analysis then uses it instead of billing_period.
        # Blank = the plan really is billed per calendar month/quarter/year.
        Column("validity_days", "int", required=False, blank_is_normal=True),
        Column("included_platforms", "list"),
        *PROVENANCE,
    ),
    unique_key=("provider", "bundle_name", "billing_period", "as_of_date"),
)

ALL_DATASETS = (PLATFORMS, PRICES, SUBSCRIBERS, BUNDLES)
