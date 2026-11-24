# JioHotstar plans: raw reading, 2026-11-24

**Source:** https://www.hotstar.com/in/paywall (official JioHotstar plans page; opens without a login).

How the page was found and read:
- jiohotstar.com/subscribe redirects to hotstar.com/subscribe, which sends logged-out visitors to the home page. That's why earlier attempts failed.
- Sangita's Claude (in the claude.ai app browser) found the paywall address and read the plans.
- Claude Code then loaded the same page itself in headless Chrome and confirmed every value below.
- Screenshot: `hotstar_paywall_2026-11-24.png` (the yearly tiles are cut off at the right edge in the image; their text was read from the page).

Page text, in order:

```
Super | 2 devices | TV, Laptop & Mobile | With Ads | All Content Included | Full HD 1080p | Dolby Atmos |
1 MONTH ₹149 (₹149 per month) | 3 MONTHS ₹349 (₹116 per month) | 1 YEAR ₹1099 (₹92 per month)

Premium | ADS FREE | 4 devices | TV, Laptop & Mobile | No Ads (except live) | All Content Included |
4K 2160p + Dolby Vision | Dolby Atmos |
1 MONTH ₹299 (₹299 per month) | 3 MONTHS ₹699 (₹233 per month) | 1 YEAR ₹2199 (₹183 per month)
```

Decisions:
- **`max_screens` = 2 (Super) and 4 (Premium).** The plans page only says "2 devices" / "4 devices". JioStar's official press release says "at a time", which settles it:
  - Source: "JioHotstar Introduces Monthly Plans Across Tiers", 21 Jan 2026, https://cdn.jiostar.com/jiostar/wp-content/uploads/2026/01/JioHotstar-Introduces-Monthly-Plans.pdf
  - Its comparison table reads: "No. of devices | 1 mobile device at a time | Access up to 2 devices at a time | Access up to 4 devices at a time" (Mobile | Super | Premium)
  - Its prices are "79 149 499 | 149 349 1099 | 299 699 2199" (monthly, quarterly, annual per tier). The Super and Premium prices match the plans page exactly, so the release still describes the current plans.
- **Premium `has_ads` = false,** with "No Ads (except live)" recorded in `notes`. This follows the data dictionary rule for "ads on live sport".
- **`devices` = all** ("TV, Laptop & Mobile").
- **Not added:** the Mobile plan (₹79 / ₹149 / ₹499 in the press release) is not shown on the web plans page. Prices must come from a plan page, so it stays in `TODO_verify.md`.
