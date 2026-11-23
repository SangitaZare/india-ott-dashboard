# India OTT Market Dashboard

An analysis of India's streaming (OTT) market: why subscriber numbers from different sources disagree, what streaming really costs in ₹, and which plan combination is best for a family.

> **Status: work in progress.** See [PROJECT_PLAN.md](PROJECT_PLAN.md) for the roadmap.

## Run the tests

```bash
python -m venv .venv
.venv\Scripts\activate          # Windows  (macOS/Linux: source .venv/bin/activate)
pip install -r requirements.txt
python -m pytest -q
```

## Run the analysis

```bash
python scripts/validate_data.py     # check every CSV against the data rules
python scripts/build_db.py          # data/*.csv -> build/ott.db (refuses invalid data)
python scripts/run_analysis.py      # print the answers to every question in sql/analysis.sql
```

The analysis notebook is [notebooks/analysis.ipynb](notebooks/analysis.ipynb). It is generated, so after a data change rebuild it with:

```bash
python scripts/make_notebook.py
jupyter nbconvert --to notebook --execute --inplace notebooks/analysis.ipynb
```
