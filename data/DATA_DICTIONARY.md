# Data Dictionary

This project uses four CSV files in `data/`. The machine-readable definitions are in
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
