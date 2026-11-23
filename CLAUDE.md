# CLAUDE.md — India OTT Market Dashboard

Instructions for Claude Code working in this repository. Read this file fully before starting any task.

## Project in one line
A data analytics portfolio project that analyses India's OTT streaming market: **why subscriber numbers disagree**, **what OTT really costs in ₹**, and **which plan combination is best for a family**.

Owner: Sangita Zare (GitHub: SangitaZare) — aspiring Data Analyst, full-stack background (C# / ASP.NET Core / Angular).
Full plan: see `PROJECT_PLAN.md`.

---

## 1. Professional Git workflow (mandatory)

Work the way a professional team does. **Never commit directly to `main`.**

### For every feature / milestone
1. Make sure `main` is up to date:
   ```bash
   git checkout main && git pull origin main
   ```
2. Create a branch with the correct prefix:
   | Prefix | Use for |
   |---|---|
   | `feature/` | new functionality (e.g. `feature/price-data`) |
   | `fix/` | bug fixes |
   | `data/` | data collection or data corrections only |
   | `docs/` | README, docs, comments |
   | `chore/` | setup, configs, dependencies |
   | `ci/` | GitHub Actions / automation |
   ```bash
   git checkout -b feature/<short-kebab-name>
   ```
3. Work in **small, focused commits** using Conventional Commits:
   ```
   feat: add rupee-per-screen calculation
   data: add Netflix and JioHotstar plan prices (checked 2026-11-23)
   fix: correct annual savings rounding
   docs: add data dictionary for subscribers.csv
   test: add validation tests for prices.csv
   chore: add requirements.txt
   ```
4. Before opening a PR, run the full check:
   ```bash
   python -m pytest -q          # all tests must pass
   python scripts/validate_data.py   # data validation must pass
   ```
5. Push and open a Pull Request with the GitHub CLI:
   ```bash
   git push -u origin feature/<name>
   gh pr create --base main --title "<type>: <summary>" --body-file .github/pr_body.md
   ```
   PR description must include: **What changed**, **Why**, **How tested**, **Screenshots** (for UI), **Data sources added** (for data changes), and a checklist.
6. **Self-review the PR diff** (`gh pr diff`) before merging. Fix anything wrong in a new commit on the same branch.
7. Merge with squash, then delete the branch locally and remotely:
   ```bash
   gh pr merge --squash --delete-branch
   git checkout main && git pull origin main
   git branch -d feature/<name> 2>/dev/null || true
   ```
8. Tick the milestone in `PROJECT_PLAN.md` (in the next branch, or a small `docs/` branch).

### Rules
- One milestone = one branch = one PR. Don't mix unrelated changes.
- Never force-push to `main`. Never rewrite published history.
- If a branch gets large, split it.
- Ask Sangita before: deleting files she wrote, changing the tech stack, publishing/deploying, or anything that costs money.
- Never commit secrets (`.env`, API keys, tokens). Keep `.env` in `.gitignore`.

---

## 2. Data integrity rules (the most important part of this project)

This project's value is **trustworthy data**. Breaking these rules ruins the project.

1. **Never invent a number.** Every value must come from a real, cited source.
2. Every row in every dataset must have: `source_name`, `source_url`, `as_of_date` (date the figure refers to) and `accessed_date` (date you checked it).
3. **Prices come only from official platform plan pages** (netflix.com, primevideo.com, jiohotstar.com, sonyliv.com, zee5.com, aha.video, hoichoi.tv, etc.). Blog or reseller price lists may only be used as a hint, never as the source.
4. If you cannot verify a value, **do not guess**. Leave it empty, add the row to `data/TODO_verify.md`, and tell Sangita.
5. Always record **what a number measures** (`metric_type`). These are different things and must never be mixed or compared as if equal:
   - `paying_subscribers`
   - `subscriptions` (one household can hold several)
   - `subscribing_households`
   - `active_paid_subscriptions` (e.g. Ormax: used at least once in last month)
   - `viewers` / `audience` (includes shared accounts, free users)
   - `engagement_share_pct` (e.g. JustWatch — NOT subscribers)
6. Rate each source's credibility in `source_type`: `company_official`, `industry_report`, `broker_note`, `news_report`, `stats_website`, `blog`.
7. Prices change. Every price must show the date it was checked, on the dashboard too.
8. If the web cannot be reached from your environment, stop and tell Sangita which pages she needs to open or download — do not fill gaps from memory.

---

## 3. Tech stack

| Layer | Tool |
|---|---|
| Data collection & cleaning | Python 3.11+, pandas |
| Storage & analysis | CSV files in `data/` + SQLite (`build/ott.db`) built by script; SQL queries in `sql/` |
| Analysis notebook | Jupyter (`notebooks/`) |
| Dashboard (v1) | Static web dashboard: HTML + vanilla JS + a charting library (Chart.js or ECharts), reads JSON exported from the data. Deployable free on **GitHub Pages**. |
| Family plan picker (v2) | Angular front end + ASP.NET Core minimal API (`app/`) — Sangita's own stack |
| Tests | pytest (data validation + calculation tests) |
| CI | GitHub Actions: run tests + data validation on every PR |

Do not add heavy frameworks or paid services without asking.

---

## 4. Repository structure

```
india-ott-dashboard/
├── CLAUDE.md
├── PROJECT_PLAN.md
├── README.md
├── data/
│   ├── raw/                  # untouched source snapshots / notes
│   ├── platforms.csv
│   ├── prices.csv
│   ├── subscribers.csv
│   ├── bundles.csv
│   ├── DATA_DICTIONARY.md
│   └── TODO_verify.md
├── scripts/
│   ├── build_db.py           # CSV -> SQLite
│   ├── validate_data.py      # schema + rule checks
│   └── export_json.py        # data -> dashboard/data/*.json
├── sql/
│   └── analysis.sql
├── notebooks/
│   └── analysis.ipynb
├── dashboard/                # static site for GitHub Pages
│   ├── index.html
│   ├── css/
│   ├── js/
│   └── data/
├── app/                      # v2: Angular + .NET picker
├── tests/
└── .github/
    ├── workflows/ci.yml
    └── pr_body.md
```

---

## 5. Code quality
- Clear names, small functions, comments only where the "why" isn't obvious.
- Python: follow PEP 8; type hints on functions.
- Every calculation (₹ per screen, annual savings, picker logic) has a unit test.
- Dashboard: accessible (labels, contrast), works on mobile, every chart shows its source and date.

## 6. Communication
- At the start of each milestone, state the branch name and what you'll do.
- At the end, report: PR link, what was merged, tests result, anything left in `TODO_verify.md`.
- Explain decisions in simple language — Sangita is learning data analysis and will need to explain this project in interviews.
