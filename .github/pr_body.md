## What changed
<!-- Short list of the changes in this PR -->

## Why
<!-- The problem this solves or the milestone it completes -->

## How tested
<!-- Commands run and their results, e.g. `python -m pytest -q` -->

## Screenshots
<!-- For dashboard/UI changes only; otherwise write "N/A" -->

## Data sources added
<!-- For data changes: source name, URL, as_of_date, accessed_date. Otherwise "N/A" -->

## Checklist
- [ ] `python -m pytest -q` passes
- [ ] `python scripts/validate_data.py` passes (once it exists)
- [ ] Every new number has a source URL, `as_of_date` and `accessed_date`
- [ ] Prices come only from official platform pages
- [ ] Unverified values are listed in `data/TODO_verify.md`
- [ ] No secrets committed
- [ ] Self-reviewed the diff (`gh pr diff`)
