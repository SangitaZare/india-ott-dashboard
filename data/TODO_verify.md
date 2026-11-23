# Values waiting for verification

Any value we could not confirm from an acceptable source goes here instead of being guessed
(CLAUDE.md §2, rule 4). In the CSV, the value is left empty until it is verified.
`python scripts/validate_data.py` shows one warning per empty cell; this file groups them.

## Missing platforms (no rows in prices.csv)

| Platform | What we tried (2026-11-23) | What's needed |
|---|---|---|
| JioHotstar | Claude in Chrome: jiohotstar.com/subscribe showed an error page or timed out. Claude chat: hotstar.com/in/subscribe redirected to home without login. | Open the plans page in a normal browser (log in if needed), record every plan × period. Also confirm the official domain: jiohotstar.com or hotstar.com, and update `official_plans_url`. |
| Planet Marathi | planetmarathi.com shows only a contact card. An undated offer page (about.planetmarathi.com/special-discount/) mentions ₹299 for the first year only - a promotion, not a price list. | Find a current official plans page (the app may be the only place). |

## platforms.csv

| Platform | Missing value | Why | What's needed |
|---|---|---|---|
| netflix | model, languages, has_live_cricket, has_free_tier, launch_year | 2016 release does not name India; other facts not found on official pages | Netflix India launch release; official page for languages / free content |
| prime_video | model, languages, has_live_cricket, has_free_tier | Only a 2016 "at launch" language list; cricket rights claim was unofficial | Current Prime Video India page for languages; official sports page |
| jiohotstar | model, languages, has_live_cricket | Language source gives "12+" not a list; cricket source was a press-release index, not a specific release | Specific JioStar release for cricket rights; current language list |
| sonyliv | owner, model, languages, has_free_tier, launch_year | Only unofficial sources (Culver Max Entertainment, 2013) | Sony Pictures Networks India / Culver Max official page |
| zee5 | languages, has_live_cricket | Only a 2018 language count | Current ZEE5 about page |
| aha | owner, has_live_cricket, launch_year | Owner source was a movie page; launch year only unofficial (March 2020) | Aha About / Terms page naming the company |
| hoichoi | model, has_live_cricket, has_free_tier | Not found | Hoichoi FAQ / about page |
| sunnxt | has_live_cricket | Not found | Sun NXT official sports page |
| planetmarathi | model, has_live_cricket, has_free_tier | Not found | Official about / FAQ page |

## prices.csv

| Platform / plans | Missing value | Why | What's needed |
|---|---|---|---|
| zee5 (all 27 rows) | max_screens, devices | Cards say "1 Device" - doesn't say "at the same time"; supported devices not stated | ZEE5 help page on simultaneous streams and devices |
| aha (all 5 plans) | max_screens | Page says "Devices: N" - not stated whether simultaneous | Aha FAQ on simultaneous streams |
| aha Annual Premium | devices | Not stated | Plan details |
| hoichoi Annual, Quarterly | max_quality, has_ads | Not stated on plans page | Hoichoi FAQ |
| sunnxt (all 3 plans) | devices | Not stated | Sun NXT FAQ |
| prime_video Prime (month, year), Prime Lite | max_screens | Page says "5 (including 2 TVs)" / "1" devices - not stated whether at the same time | Prime Video help page on simultaneous streams |
| prime_video Quarterly Prime (3 months) | max_screens, max_quality, has_ads, devices | Help page lists the price only | Same features as Prime? Confirm on amazon.in |

## subscribers.csv

These rows are entered but cite a second-hand or weak source. Replace each source when the original is found.

| Row | Issue | What's needed |
|---|---|---|
| HSBC: jiohotstar 300M+, prime_video 65M, netflix 20M | Relayed by an entertainment site (Ragalahari); HSBC report date unknown, so `as_of_date` = article date | Original HSBC note, or India Dispatch / BW Businessworld coverage with the report date |
| netflix 16M subscribers / 50M viewers | From a podcast transcript (The Core); Business Standard article (2026-01-10) paywalled | Business Standard article text, or a Netflix statement |
| jiohotstar 300M (Aug 2025), 451M MAU, 260M+ subscriptions | Company statements, read via news reports | Official RIL AGM press release / JioStar newsroom |
| jiohotstar MPA 180M+ / 58% | Reported by Advanced Television; period not stated (assumed 2025) | MPA press release with the reference period |
| netflix / prime_video JustWatch 22% | Reported by Inc42 | JustWatch's own Q2 2026 India report |

Not entered (see `data/raw/subscribers/collected_2026-11-23.md`): HSBC "24% of OTT users pay" (a share of users, not one of our metric types); EY "100M+ households via bundles" (a subset of the 143M total).

## bundles.csv

| Row | Issue | What's needed |
|---|---|---|
| Tata Play Binge (4 / 13 / 35 OTT apps, "starting from" ₹149 / ₹199 / ₹399) | Not entered: app names per tier and exact plans are behind an OTP login; prices are "starting from" | Log in (or use the app) and record each plan's price and app list |
| Airtel Xstream Play bundles (₹100, ₹200, ₹279, ₹449, ₹1199) | Page says "18+ OTTs such as …", so only the named apps are in `included_platforms` | Full Xstream Play Premium app list from airtel.in |
| Airtel ₹598 / ₹1729 "Xstream Play Premium" | Apps not named in that row | Same as above |
| All Airtel and Vi rows | Prices are for the Maharashtra & Goa circle | Check whether other circles differ |
| 18 of 21 bundles include JioHotstar | No JioHotstar prices yet, so `bundle_vs_separate` marks them incomplete | JioHotstar prices (see above) |

## Hand-check still to do

All rows marked "Read via Claude chat" in `notes` (Aha, Hoichoi, Sun NXT, Prime Video and the
platform facts) were collected by Claude chat browsing and have **not yet been checked by hand**
on the official page. Netflix, SonyLIV and ZEE5 prices were read directly in Chrome.
