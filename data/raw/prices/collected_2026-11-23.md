# Raw price notes — read from official pages via Claude in Chrome on 2026-11-23

Transcribed directly from the live official pages (accessed_date = as_of_date = 2026-11-23).
Not yet entered into `data/prices.csv`. Quotes are the page text as shown.

## Netflix — DONE
URL: https://help.netflix.com/en/node/24926 ("Plans and Pricing | Netflix Help Center")
Page says: billed monthly only — "We do not offer annual, multi-month, or lifetime membership plans."
Page says: "Depending on where you live, you may be charged taxes in addition to your membership price."

| Plan | Price | Screens ("Watch on … at a time") | Quality | Ads | Devices |
|---|---|---|---|---|---|
| Mobile | ₹149 INR/month | 1 phone or tablet | 480p (SD) | "ad-free" | mobile only (no casting) |
| Basic | ₹199 INR/month | 1 supported device | 720p (HD) | "ad-free" | all |
| Standard | ₹499 INR/month | 2 | 1080p (Full HD) | "ad-free" | all |
| Premium | ₹649 INR/month | 4 | 4K (Ultra HD) + HDR | "ad-free" | all |

## SonyLIV — DONE
URL: https://www.sonyliv.com/subscription

| Plan | Price | Screens | Quality | Ads | Devices |
|---|---|---|---|---|---|
| LIV Premium | ₹399 Monthly / ₹1499 Yearly | "Watch on 2 Devices" (login on 5) | "Up to 4K (UHD)" | "With Ads" | all |
| Mobile Only | ₹699 Yearly | "Watch on 1 Device" (login on 1) | 720p | "With Ads" | mobile only |

## ZEE5 — DONE
URL: https://www.zee5.com/myaccount/subscription (reached via homepage "Subscribe"; required picking a content language first)
Plans have descriptive names, not short names. Every expanded card showed: "Live TV", "1 Device", "Best (4k)", "Best (Dolby Atmos)".
Footer: "Live TV streaming will include ads. 4K plan is supported on 4K TVs and Connected devices only. Sports content is not available in 4k quality."
→ has_ads: page does not say on-demand content is ad-free; only that Live TV has ads. Record has_ads=true + note.

| Plan (as shown) | 1 month | 3 months | 12 months |
|---|---|---|---|
| Sports + International Content + KidZ + All Language Content | ₹399 | ₹799 | ₹1699 |
| All content in Hindi, Punjabi, Bhojpuri | ₹199 | ₹399 | ₹999 |
| Movies, Series, Live TV + KidZ + International Content | ₹299 | ₹599 | ₹1499 |
| Telugu Movies, Series, TV Shows, Live TV | ₹129 | ₹259 | ₹599 |
| Kannada Movies, Series, TV Shows, Live TV | ₹129 | ₹199 | ₹599 |
| Marathi Movies, Series, TV Shows, Live TV | ₹129 | ₹259 | ₹599 |
| Bengali Movies, Series, TV Shows, Live TV | ₹129 | ₹199 | ₹599 |
| Tamil Movies, Series, TV Shows, Live TV | ₹129 | ₹259 | ₹599 |
| Malayalam Movies, Series, TV Shows, Live TV | ₹129 | ₹259 | ₹599 |

Not expanded (skipped, not core): "Premium kids' content" ₹1 / 3 months (looks promotional); "All Live TV Channels" ₹499 / 12 months.

## Still to do
- **JioHotstar** — https://www.jiohotstar.com/subscribe : Chrome extension said "Permission denied … on this domain" even after Sangita clicked Allow. Needs the site allowed in the Claude extension's site settings, then retry.
- **Aha** — /subscribe is a 404. Homepage https://www.aha.video/ has "Subscribe Now" and "View Plans" links — follow those.
- **Hoichoi** — https://www.hoichoi.tv/ (find plans link)
- **Sun NXT** — https://www.sunnxt.com/ (find plans link)
- **Planet Marathi** — https://www.planetmarathi.com/ (find plans link)
- **Prime Video** — https://www.amazon.in/amazonprime (Prime Video is part of Amazon Prime in India). Note: validator derives the allowed price domain from `official_plans_url`, so set Prime's official_plans_url to the amazon.in page if that's where prices are.
