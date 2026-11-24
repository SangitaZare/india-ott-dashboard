# Data Dictionary

This project uses four CSV files in `data/` (the source data) plus derived data built from them
(database views, analysis queries, dashboard JSON - see [Derived data](#derived-data)). The machine-readable definitions are in
[`scripts/schemas.py`](../scripts/schemas.py), and [`scripts/validate_data.py`](../scripts/validate_data.py) checks every file against them.
Run `python scripts/validate_data.py` after any data change.

## Conventions (all files)

| Rule | Example |
|---|---|
| Dates are ISO `YYYY-MM-DD` | `2026-11-23` |
| Booleans are lower-case `true` / `false` | `true` |
| Numbers are plain, with no commas, currency signs or units | `1099`, not `₹1,099` |
| Lists are separated by `;` | `Hindi;English;Tamil` |
| An unverified value is **left empty**, never guessed, and added to [`TODO_verify.md`](TODO_verify.md) | `price_inr` = *(empty)* |
| Encoding is UTF-8 | |

### Provenance columns (in every file)

Every row records where its numbers came from (CLAUDE.md §2, rule 2).

| Column | Required | Meaning |
|---|---|---|
| `as_of_date` | yes | The date the figure **refers to**, e.g. the report's reference date or the day a price was live. For a figure covering a whole year, use the last day of that year and explain in `notes`. |
| `accessed_date` | yes | The date **we checked** the source. Must not be before `as_of_date` or in the future. |
| `source_name` | yes | Human-readable source, e.g. `Netflix India plans page`, `Ormax OTT Audience Report 2026`. |
| `source_url` | yes | Full `https://` link to the exact page or article. |
| `notes` | no | Caveats, definitions used by the source, or how a number was derived. |

---

## `platforms.csv` — one row per streaming platform

| Column | Type | Required | Meaning |
|---|---|---|---|
| `platform_id` | text | yes | Short unique key used by the other files, e.g. `netflix`, `jiohotstar`. Lower-case, no spaces. |
| `name` | text | yes | Display name. |
| `owner` | text | no* | Parent company. |
| `model` | `SVOD` / `AVOD` / `hybrid` | no* | SVOD = paid subscription only; AVOD = free with ads; hybrid = both. |
| `languages` | list | no* | Main content languages, `;`-separated. |
| `has_live_cricket` | bool | no* | Streams live cricket in India. |
| `has_free_tier` | bool | no* | Some content is watchable without paying. |
| `launch_year` | int | no | Year of India launch. |
| `official_plans_url` | URL | yes | The platform's own plans page. **Its domain decides which websites are accepted as price sources** (see `prices.csv`). |

\* Empty is allowed only while a value is unverified (the validator shows a warning).
If a row's facts come from several pages, `source_url` holds the main one and `notes` lists the others.

## `prices.csv` — one row per plan, per billing period, per date checked

| Column | Type | Required | Meaning |
|---|---|---|---|
| `platform_id` | text | yes | Must exist in `platforms.csv`. |
| `plan_name` | text | yes | Name exactly as shown on the plans page, e.g. `Premium`. |
| `price_inr` | number ≥ 0 | no* | Price in rupees for one billing period, including GST as displayed. |
| `billing_period` | `month` / `quarter` / `year` | yes | What `price_inr` pays for. |
| `max_screens` | int | no* | Number of devices that can stream **at the same time**. |
| `max_quality` | `SD` / `HD` / `FHD` / `4K` | no* | Best video quality. SD ≈ 480p, HD = 720p, FHD = 1080p, 4K = 2160p. |
| `has_ads` | bool | no* | The plan shows ads. Use `notes` for "limited ads" or "ads on live sport". |
| `devices` | `mobile_only` / `all` | no* | Whether the plan works on TVs and laptops or only on phones and tablets. |

\* Empty is allowed only while a value is unverified (the validator shows a warning).

**Rule:** `source_url` must be on the same website as the platform's `official_plans_url`
(e.g. `help.netflix.com` is accepted for Netflix, but a blog is not). The validator enforces this.

**Price history:** when a price changes, add a new row with a new `as_of_date`. Never overwrite the old row.

## `subscribers.csv` — one row per published figure

| Column | Type | Required | Meaning |
|---|---|---|---|
| `platform_id` | text | yes | A platform from `platforms.csv`, or `market_total` for figures covering all of India's OTT market. |
| `value` | number ≥ 0 | no | The headline figure. |
| `value_low` / `value_high` | number ≥ 0 | no | A range, when the source gives one (e.g. "~300M" might be recorded as a point value; "180M+" as `value_low` = 180). |
| `unit` | `millions` / `percent` | yes | `percent` is only for `engagement_share_pct`. |
| `metric_type` | see below | yes | **What the number actually counts.** |
| `scope` | `India` | yes | Geography. |
| `source_type` | see below | yes | How much to trust the source. |

At least one of `value`, `value_low`, `value_high` is needed, and `value_low ≤ value ≤ value_high`.

### `metric_type` — why numbers disagree

These measure **different things**. They must never be added together or compared as if equal.

| Value | Counts… | Typical source |
|---|---|---|
| `paying_subscribers` | People or accounts paying for a platform | Company statements, broker notes |
| `subscriptions` | Paid subscriptions. One household can hold several, so this is ≥ households | Industry reports (EY-FICCI) |
| `subscribing_households` | Homes with at least one paid subscription | Industry reports |
| `active_paid_subscriptions` | Paid subscriptions **actually used** recently (e.g. Ormax: watched at least once in the last month) | Ormax |
| `viewers` | People who watch a platform, including shared passwords and free users | Company or news reports |
| `audience` | Everyone who watches any OTT content, including free | Ormax |
| `engagement_share_pct` | Share of **viewing activity** (%), e.g. JustWatch. **Not a subscriber count.** | JustWatch |

### `source_type` — credibility (highest to lowest, roughly)

| Value | Meaning |
|---|---|
| `company_official` | The platform's own press release, annual report or investor call. Precise, but companies choose flattering metrics. |
| `industry_report` | Research firms with stated methods: Ormax, EY-FICCI, Media Partners Asia. |
| `broker_note` | Investment bank estimates (e.g. HSBC), usually seen second-hand through the press. |
| `news_report` | A journalist's figure without a clear original source. |
| `stats_website` | Aggregator sites (e.g. Demandsage). Low credibility. Often recycled or unsourced. |
| `blog` | Lowest credibility. Kept only to show how numbers spread. |

## `bundles.csv` — one row per telecom/DTH bundle, per date checked

| Column | Type | Required | Meaning |
|---|---|---|---|
| `provider` | text | yes | e.g. `Jio`, `Airtel`, `Tata Play Binge`. |
| `bundle_name` | text | yes | Name as shown by the provider. |
| `price_inr` | number ≥ 0 | no* | Price for one billing period. |
| `billing_period` | `month` / `quarter` / `year` | yes | What `price_inr` pays for. For day-based plans, pick the closest one (28 days → `month`, 84 days → `quarter`). |
| `validity_days` | int ≥ 1 | no | Validity in days as shown by the provider (e.g. `28`, `84`). Leave blank for true calendar periods. When filled, analysis converts the price to ₹/month with `price × 365 / 12 / validity_days`, because a 28-day plan is bought 13 times a year, not 12. |
| `included_platforms` | list | yes | `platform_id`s from `platforms.csv`, `;`-separated. Note in `notes` if the included tier is a cut-down version (e.g. mobile-only). |
| `included_tiers` | list | yes | The tier the bundle gives for **each** included platform: `platform_id=Tier;...`, e.g. `jiohotstar=Mobile;netflix=Basic`. The tier is the plan name the provider shows. Use `unstated` when the page names no tier (e.g. apps reached through JioTV or Airtel Xstream Play). Every platform in `included_platforms` needs exactly one tier. Analysis compares the bundle only with **that** plan bought separately. |

**`notes` convention for bundles:** every bundle's notes start with either `Data pack only` (a data add-on that needs
a base plan) or `Full prepaid plan` (includes calls and data, so its price is not for OTT alone). The cost page uses this
prefix to show only like-for-like comparisons by default; a test checks every bundle has one.

`included_platforms` lists only apps that are in `platforms.csv` **and named on the provider's page**. Other apps
(e.g. YouTube Premium, Lionsgate Play) are listed in `notes`.

---

## Supporting files in `data/`

| File | What |
|---|---|
| [`TODO_verify.md`](TODO_verify.md) | Every value left blank or taken from a second-hand source, grouped by file, with what is needed to fix it |
| [`raw/`](raw/) | Original readings before they were entered: plan-page notes, Claude-chat CSVs, subscriber source quotes. Never edited after saving. |

---

## Derived data

Nothing below is edited by hand. It is rebuilt from the CSVs, so a data change flows through everywhere.

### Database: `build/ott.db` (built by `scripts/build_db.py`, not committed)

The build validates the CSVs first and refuses invalid data. Types: numbers are `REAL`/`INTEGER`, booleans are `0`/`1`, and **empty cells are `NULL`** (unknown, never 0).

| Table / view | What |
|---|---|
| `platforms`, `prices`, `subscribers`, `bundles` | One table per CSV, same columns |
| `bundle_platforms` | One row per (bundle, included platform, `tier`), split from `bundles.included_tiers` so SQL can join on it |
| `current_prices` (view) | The newest row per plan + billing period (prices keep history) |
| `monthly_prices` (view) | `current_prices` with `months` (1 / 3 / 12) and `price_per_month` = `price_inr / months`. Plans with no price are excluded. |

### Analysis queries: [`sql/analysis.sql`](../sql/analysis.sql)

Each query starts with `-- name: <id>`. The notebook, the dashboard and the tests all run these, so every calculation exists once.
Run them with `python scripts/run_analysis.py [name ...]`.

| Query | Answers | Key output columns |
|---|---|---|
| `subscriber_estimate_spread` | How far apart are estimates of the **same** metric for a platform? | `min_estimate`, `max_estimate`, `spread`, `spread_pct` (= spread ÷ min). A range uses its low end for the min and its high end for the max. |
| `price_per_screen` | ₹ per screen per month for every current plan | `price_per_month`, `price_per_screen_per_month` (`NULL` when screens are unknown) |
| `cheapest_plan_per_platform` | Cheapest way into each platform | `price_per_month` (ties kept) |
| `annual_vs_monthly_savings` | Saving from paying yearly, for plans sold both ways | `twelve_months_cost`, `yearly_savings_inr`, `savings_pct` = (12 × monthly − yearly) ÷ (12 × monthly) |
| `cheapest_ad_free_4k` | Cheapest 4K plans with no ads | `price_per_month`. Plans with unknown ads or quality are excluded. |
| `ads_vs_ad_free` | Cost of removing ads, per platform | `cheapest_with_ads_per_month`, `cheapest_ad_free_per_month`, `ad_free_premium_per_month` (negative = ad-free is cheaper) |
| `bundle_vs_separate` | Is a telecom bundle cheaper than buying the **same tiers** separately? | `bundle_per_month` (uses `validity_days` when set: `price × 365 / 12 / days`), `separate_per_month` (each included app at the tier the bundle gives, cheapest billing period of that plan), `monthly_savings`, `complete_comparison` (1 only if every included tier has a price; otherwise separate and savings are `NULL`), `unmatched_tiers` (e.g. `jiohotstar Mobile; sonyliv unstated`) |

### Dashboard JSON: `dashboard/data/*.json` (built by `scripts/export_json.py`, committed)

| File | Contents |
|---|---|
| `platforms.json`, `prices.json`, `subscribers.json`, `bundles.json` | One object per CSV row. `null` = unknown; booleans are `true`/`false`. |
| `analysis.json` | `{query name: [rows]}` for every query above |
| `meta.json` | `prices_checked`, `subscribers_checked`, `bundles_checked`: the latest `accessed_date` per file; `prices_first_checked`: the earliest price check. Pages show the range (e.g. "checked 23–24 Nov 2026") on every chart |

The export is deterministic (sorted keys, no timestamps). A test fails if the committed JSON is out of date. Fix it with `python scripts/export_json.py`.
