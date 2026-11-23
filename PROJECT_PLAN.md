# PROJECT_PLAN.md — India OTT Market Dashboard

## Goal
Build a portfolio-grade analytics project answering three questions:

1. **Why do India OTT subscriber numbers disagree?** (headline page — rare, shows data-quality judgment)
2. **What does OTT really cost in ₹?** (per screen, monthly vs yearly, ads vs ad-free, telco bundles)
3. **Which plan combination is best for my family?** (interactive picker)

### Why this is distinctive (from the uniqueness research)
- Generic OTT / Netflix dashboards on Kaggle title catalogues are saturated — **do not use** `netflix_titles.csv` or the Hotstar catalogue as the backbone.
- No public dataset exists for India OTT subscribers by platform or current ₹ plan tiers across platforms → **we compile and publish the first one**.
- No portfolio project found that combines subscriber reconciliation + ₹ value model + family picker.

---

## Milestones (one branch + one PR each)

### M0 — `chore/project-setup`
- [x] Create repo structure from `CLAUDE.md` §4
- [x] `.gitignore` (Python, Node, .NET, `.env`, `build/`)
- [x] `requirements.txt` (pandas, pytest, jupyter)
- [x] `.github/pr_body.md` PR template
- [x] Minimal `README.md` (title, one-line description, "work in progress")
- **Done when:** repo runs `pytest` (0 tests OK) and structure matches.

### M1 — `feature/data-schema`
- [x] Define CSV schemas + `data/DATA_DICTIONARY.md`
- [x] `scripts/validate_data.py` enforcing CLAUDE.md §2 rules (required columns, valid `metric_type`, valid `source_type`, dates, URLs present, no negative prices)
- [x] Tests for the validator
- **Schemas** (final definitions: `scripts/schemas.py` + `data/DATA_DICTIONARY.md`). Every file also has the provenance columns `as_of_date, accessed_date, source_name, source_url, notes`:
  - `platforms.csv`: platform_id, name, owner, model (SVOD/AVOD/hybrid), languages, has_live_cricket, has_free_tier, launch_year, official_plans_url
  - `prices.csv`: platform_id, plan_name, price_inr, billing_period (month/quarter/year), max_screens, max_quality (SD/HD/FHD/4K), has_ads, devices (mobile_only/all)
  - `subscribers.csv`: platform_id (or `market_total`), value, value_low, value_high, unit (millions/percent), metric_type, scope (India), source_type
  - `bundles.csv`: provider (Jio/Airtel/Tata Play Binge/etc.), bundle_name, price_inr, billing_period, included_platforms

### M2 — `data/platforms-and-prices`
- [x] Collect current plans from **official plan pages only** for: Netflix, Amazon Prime Video, JioHotstar, SonyLIV, ZEE5, Aha, Hoichoi, Sun NXT, Planet Marathi (add others if easy) *(7 of 9 done; JioHotstar and Planet Marathi in TODO_verify)*
- [x] Record accessed date on every row; unverifiable rows → `TODO_verify.md`
- [x] Price anchors from research to **re-verify** (do not copy blindly): Netflix ₹149/199/499/649 per month; JioHotstar Mobile ₹79/mo or ₹499/yr, Super ₹149/mo or ₹1,099/yr, Premium ₹2,199/yr; Prime ₹299/mo or ₹1,499/yr; SonyLIV Premium ₹399/mo or ₹1,499/yr; ZEE5 All Access ₹1,499/yr; Aha ₹149 / ₹699; Hoichoi ₹149 / ₹899

### M3 — `data/subscribers`
Collect every figure with its exact metric type. Starting leads from research (find and cite the original article for each):
- [x] Ormax OTT Audience Report 2026 (Sept 2026): 664.9M OTT audience; 172.6M active paid subscriptions (up from 148.2M)
- [x] EY-FICCI M&E report (March 2026): 143M paying households, 216M video OTT subscriptions in 2025; 100M+ households via bundles
- [x] Media Partners Asia, Asia Video Content Dynamics 2026: JioHotstar 180M+ paying subscribers, 58% premium VOD viewing share
- [x] HSBC note (Jan 2026, via India Dispatch / BW Businessworld): JioHotstar ~300M, Prime Video ~65M, Netflix ~20M paying subscribers; only 24% of OTT users pay
- [x] JioStar announcement (June 2025): 300M subscribers
- [x] Business Standard (10 Jan 2026): Netflix "more than 16 million subscribers, about 50 million viewers"; ~6% of 272M OTT subscribers in 2025
- [x] JustWatch quarterly SVOD shares → `engagement_share_pct` only, never subscribers
- [ ] Stats websites (Demandsage etc.) → `stats_website`, low credibility *(skipped: not needed to show the disagreement)*

### M4 — `feature/database-and-sql`
- [x] `scripts/build_db.py`: CSVs → `build/ott.db`
- [x] `sql/analysis.sql` answering:
  1. Min / max / spread of each platform's subscriber estimates, grouped by metric_type
  2. Cheapest plan per platform; ₹ per screen per month
  3. Annual vs monthly savings per platform (%)
  4. Cheapest ad-free 4K option
  5. Bundle cost vs buying platforms separately
- [x] Tests for calculations

### M5 — `feature/analysis-notebook`
- [ ] `notebooks/analysis.ipynb`: clean, explore, charts, written insights
- [ ] Key insights section in plain business language (5 bullets max)

### M6 — `feature/dashboard-reconciliation`
- [ ] `scripts/export_json.py`
- [ ] Static dashboard shell (dark streaming-style theme, responsive)
- [ ] **Page 1 – "Why do the numbers disagree?"**: range bars per platform, coloured by metric_type; source table with date + credibility; plain-English explainer of each metric type

### M7 — `feature/dashboard-cost`
- [ ] **Page 2 – "The real cost of OTT in India"**: ₹ per screen, monthly vs yearly savings, ads vs ad-free, bundles vs separate; "prices checked on <date>" on every chart

### M8 — `feature/family-plan-picker`
- [ ] **Page 3 – "Best plan for your family"**: inputs → household size, simultaneous screens, languages, live cricket yes/no, ads OK yes/no, monthly budget → cheapest combination meeting all constraints, with a one-line reason
- [ ] Picker logic unit-tested (edge cases: no valid combo, budget too low)

### M9 — `ci/github-actions`
- [ ] `.github/workflows/ci.yml`: install deps, run `validate_data.py` + `pytest` on every PR
- [ ] Add CI badge to README

### M10 — `docs/readme-and-insights`
- [ ] README: headline insight with a number, screenshots, how it works, data sources, limitations, how to run
- [ ] `DATA_DICTIONARY.md` complete
- [ ] 3 resume bullets + a short LinkedIn post draft in `docs/`

### M11 — `chore/deploy-pages` *(ask Sangita first)*
- [ ] Deploy `dashboard/` to GitHub Pages; add live link to README

### M12 (v2, later) — `feature/angular-dotnet-picker`
- [ ] Rebuild the picker in `app/` as Angular + ASP.NET Core minimal API reading the same data
- [ ] Tests (xUnit + Angular unit tests)

---

## Definition of done (whole project)
- Every number on the dashboard has a source and date
- All tests + data validation pass in CI
- README explains the problem, insights and limitations in plain English
- Live dashboard link works
- Sangita can explain every page in 2 minutes
