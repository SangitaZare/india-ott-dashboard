# Resume bullets: India OTT Market Dashboard

**Project line:** India OTT Market Dashboard | Python, SQL, pandas, Jupyter, JavaScript, Chart.js, GitHub Actions | github.com/SangitaZare/india-ott-dashboard

- **Compiled and published a fully sourced dataset of India's OTT market:** 48 streaming plans, 21 telecom bundles and 19 subscriber figures across 9 platforms. Every value is traced to an official page or report, with dates. Built a Python validator, enforced in CI, that rejects unsourced figures and non-official prices.
- **Explained why subscriber numbers disagree** by classifying 19 published figures into 7 measures (subscribers, subscriptions, households, active use, viewers, audience, viewing share). Showed that JioHotstar's "paying subscriber" estimates range from 180M to 300M (a 67% spread), and that India's 216M paid subscriptions sit in only 143M households.
- **Built a SQL cost model and a 3-page interactive dashboard.** It normalises monthly, quarterly, yearly and 28/84-day telecom prices to ₹ per month. Findings: paying yearly saves 58–69%, and yearly multi-screen plans cost 2–8× less per screen than Netflix. Includes a family plan picker that never treats unverified facts as true. 200+ automated tests cover every calculation.

## If an interviewer asks

- **"What was the hardest part?"** Data trust, not code. Many official pages don't state screens, devices or languages. I left those values blank, tracked them in a to-verify list, and designed the analysis and the picker to treat unknown as unknown, never as zero or yes.
- **"What would you do next?"** Verify JioHotstar's prices (it appears in 18 of 21 bundles, so most bundle comparisons are incomplete without it), re-check prices monthly to build a price history, and rebuild the picker in Angular + ASP.NET Core.
- **"Why SQL views instead of pandas everywhere?"** So every number is calculated once. The notebook, the dashboard and the tests all run the same named queries, which means they can't disagree.
