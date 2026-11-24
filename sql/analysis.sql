-- Analysis queries for the India OTT dashboard (PROJECT_PLAN.md, M4).
-- Run them all with:  python scripts/run_analysis.py
--
-- Each query starts with a "-- name: <id>" line so scripts and tests can run it by name.
-- Unknown values are NULL and are never treated as 0: a plan with unknown screens gets a NULL
-- "price per screen", and a plan with unknown ads is left out of the ad-free question.


-- name: subscriber_estimate_spread
-- Q1. How far apart are the estimates for each platform, for each kind of number?
-- Grouped by metric_type because "paying subscribers" and "monthly users" must never be mixed.
-- A figure given as a range or "over X" uses its low end for the minimum and high end for the maximum.
SELECT
    platform_id,
    metric_type,
    unit,
    COUNT(*)                                                        AS estimates,
    MIN(COALESCE(value_low, value, value_high))                     AS min_estimate,
    MAX(COALESCE(value_high, value, value_low))                     AS max_estimate,
    ROUND(MAX(COALESCE(value_high, value, value_low))
          - MIN(COALESCE(value_low, value, value_high)), 1)         AS spread,
    ROUND(100.0 * (MAX(COALESCE(value_high, value, value_low))
                   - MIN(COALESCE(value_low, value, value_high)))
          / NULLIF(MIN(COALESCE(value_low, value, value_high)), 0), 1) AS spread_pct,
    GROUP_CONCAT(DISTINCT source_type)                              AS source_types
FROM subscribers
GROUP BY platform_id, metric_type, unit
ORDER BY platform_id, metric_type;


-- name: price_per_screen
-- Q2a. Rupees per screen per month for every current plan.
-- Per screen = monthly price / screens that can stream at the same time.
SELECT
    platform_id,
    plan_name,
    billing_period,
    price_inr,
    ROUND(price_per_month, 2)                                       AS price_per_month,
    max_screens,
    ROUND(price_per_month / max_screens, 2)                         AS price_per_screen_per_month,
    max_quality,
    has_ads,
    devices,
    as_of_date
FROM monthly_prices
ORDER BY price_per_screen_per_month IS NULL, price_per_screen_per_month, platform_id;


-- name: cheapest_plan_per_platform
-- Q2b. The cheapest way into each platform, measured as rupees per month.
-- RANK keeps ties (two plans with the same monthly cost both appear).
SELECT platform_id, plan_name, billing_period, price_inr, price_per_month, max_screens, has_ads, devices, as_of_date
FROM (
    SELECT
        mp.platform_id, mp.plan_name, mp.billing_period, mp.price_inr, mp.max_screens, mp.has_ads, mp.devices,
        mp.as_of_date,
        ROUND(mp.price_per_month, 2) AS price_per_month,
        RANK() OVER (PARTITION BY mp.platform_id ORDER BY ROUND(mp.price_per_month, 2)) AS price_rank
    FROM monthly_prices AS mp
)
WHERE price_rank = 1
ORDER BY price_per_month, platform_id, plan_name;


-- name: annual_vs_monthly_savings
-- Q3. For plans sold both monthly and yearly: how much does paying yearly save?
-- savings_pct = (12 x monthly price - yearly price) / (12 x monthly price)
SELECT
    m.platform_id,
    m.plan_name,
    m.price_inr                                                     AS monthly_price,
    y.price_inr                                                     AS yearly_price,
    12 * m.price_inr                                                AS twelve_months_cost,
    12 * m.price_inr - y.price_inr                                  AS yearly_savings_inr,
    ROUND(100.0 * (12 * m.price_inr - y.price_inr) / (12 * m.price_inr), 1) AS savings_pct
FROM current_prices AS m
JOIN current_prices AS y
  ON y.platform_id = m.platform_id
 AND y.plan_name = m.plan_name
 AND y.billing_period = 'year'
WHERE m.billing_period = 'month'
  AND m.price_inr IS NOT NULL
  AND y.price_inr IS NOT NULL
ORDER BY savings_pct DESC, m.platform_id, m.plan_name;


-- name: cheapest_ad_free_4k
-- Q4. Cheapest ways to watch in 4K with no ads, cheapest first.
-- Plans whose ads or quality are unknown (NULL) are excluded rather than assumed.
SELECT
    platform_id,
    plan_name,
    billing_period,
    price_inr,
    ROUND(price_per_month, 2)                                       AS price_per_month,
    max_screens,
    devices,
    as_of_date
FROM monthly_prices
WHERE has_ads = 0
  AND max_quality = '4K'
ORDER BY price_per_month, platform_id;


-- name: ads_vs_ad_free
-- Q4b. What does removing ads cost on each platform?
-- Cheapest plan WITH ads vs cheapest plan WITHOUT ads, per month. NULL = the platform has no such plan
-- (or its ads are unknown). A negative premium means the ad-free plan is actually cheaper per month,
-- usually because it is billed yearly.
WITH per_platform AS (
    SELECT
        platform_id,
        MIN(CASE WHEN has_ads = 1 THEN price_per_month END) AS with_ads,
        MIN(CASE WHEN has_ads = 0 THEN price_per_month END) AS ad_free,
        SUM(has_ads IS NULL)                                AS plans_with_unknown_ads
    FROM monthly_prices
    GROUP BY platform_id
)
SELECT
    pp.platform_id,
    (SELECT plan_name || ' (' || billing_period || ')' FROM monthly_prices m
      WHERE m.platform_id = pp.platform_id AND m.has_ads = 1
      ORDER BY m.price_per_month, m.plan_name LIMIT 1)          AS cheapest_with_ads_plan,
    ROUND(pp.with_ads, 2)                                       AS cheapest_with_ads_per_month,
    (SELECT plan_name || ' (' || billing_period || ')' FROM monthly_prices m
      WHERE m.platform_id = pp.platform_id AND m.has_ads = 0
      ORDER BY m.price_per_month, m.plan_name LIMIT 1)          AS cheapest_ad_free_plan,
    ROUND(pp.ad_free, 2)                                        AS cheapest_ad_free_per_month,
    ROUND(pp.ad_free - pp.with_ads, 2)                          AS ad_free_premium_per_month,
    pp.plans_with_unknown_ads
FROM per_platform AS pp
ORDER BY pp.platform_id;


-- name: bundle_vs_separate
-- Q5. Is a telecom/DTH bundle cheaper than buying the SAME thing separately?
-- Like-for-like: each included app is priced at the tier the bundle actually gives (bundles.included_tiers),
-- e.g. JioHotstar Mobile is compared with JioHotstar's Mobile plan, never with a different plan.
-- If that tier has no known price (or the provider names no tier: unstated), the bundle is not comparable
-- yet: complete_comparison = 0, separate and savings are NULL, and unmatched_tiers says which app is missing.
-- Day-based bundles (validity_days, e.g. 28) are converted with 365/12 = 30.42 days per month,
-- so a 449 rupee / 28-day plan costs 487.79 per month, not 449.
WITH bundle_monthly AS (
    SELECT
        b.provider,
        b.bundle_name,
        b.billing_period,
        b.as_of_date,
        CASE
            WHEN b.validity_days IS NOT NULL THEN b.price_inr * 365.0 / 12 / b.validity_days
            ELSE b.price_inr * 1.0
                 / CASE b.billing_period WHEN 'month' THEN 1 WHEN 'quarter' THEN 3 WHEN 'year' THEN 12 END
        END AS bundle_per_month
    FROM bundles AS b
    WHERE b.price_inr IS NOT NULL
),
tier_prices AS (
    SELECT
        bp.*,
        (SELECT MIN(mp.price_per_month) FROM monthly_prices AS mp
          WHERE mp.platform_id = bp.platform_id AND mp.plan_name = bp.tier) AS tier_per_month
    FROM bundle_platforms AS bp
),
per_bundle AS (
    SELECT
        bm.provider,
        bm.bundle_name,
        bm.bundle_per_month,
        COUNT(tp.platform_id)                                       AS platforms_included,
        COUNT(tp.tier_per_month)                                    AS platforms_priced,
        SUM(tp.tier_per_month)                                      AS matched_total,
        GROUP_CONCAT(CASE WHEN tp.tier_per_month IS NULL THEN tp.platform_id || ' ' || tp.tier END, '; ')
                                                                    AS unmatched_tiers
    FROM bundle_monthly AS bm
    JOIN tier_prices AS tp
      ON tp.provider = bm.provider
     AND tp.bundle_name = bm.bundle_name
     AND tp.billing_period = bm.billing_period
     AND tp.as_of_date = bm.as_of_date
    GROUP BY bm.provider, bm.bundle_name, bm.billing_period, bm.as_of_date
)
SELECT
    provider,
    bundle_name,
    ROUND(bundle_per_month, 2)                                      AS bundle_per_month,
    platforms_included,
    platforms_priced,
    CASE WHEN platforms_priced = platforms_included THEN 1 ELSE 0 END AS complete_comparison,
    CASE WHEN platforms_priced = platforms_included THEN ROUND(matched_total, 2) END AS separate_per_month,
    CASE WHEN platforms_priced = platforms_included THEN ROUND(matched_total - bundle_per_month, 2) END AS monthly_savings,
    unmatched_tiers
FROM per_bundle
ORDER BY complete_comparison DESC, monthly_savings DESC, provider, bundle_name;
