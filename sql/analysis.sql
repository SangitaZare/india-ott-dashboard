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


-- name: bundle_vs_separate
-- Q5. Is a telecom/DTH bundle cheaper than buying each included platform on its own?
-- "Separately" = the cheapest current plan of each platform, per month (from Q2b's logic).
-- Day-based bundles (validity_days, e.g. 28) are converted with 365/12 = 30.42 days per month,
-- so a ₹449 / 28-day plan costs ₹487.79 per month, not ₹449.
-- Caveat: a bundle often includes a cut-down tier (see bundles.notes), so this is a best case for buying separately.
WITH cheapest AS (
    SELECT platform_id, MIN(price_per_month) AS cheapest_per_month
    FROM monthly_prices
    GROUP BY platform_id
),
bundle_monthly AS (
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
)
SELECT
    bm.provider,
    bm.bundle_name,
    ROUND(bm.bundle_per_month, 2)                                   AS bundle_per_month,
    COUNT(bp.platform_id)                                           AS platforms_included,
    COUNT(c.platform_id)                                            AS platforms_priced,
    ROUND(SUM(c.cheapest_per_month), 2)                             AS separate_per_month,
    ROUND(SUM(c.cheapest_per_month) - bm.bundle_per_month, 2)       AS monthly_savings,
    -- Only a fair comparison when every included platform has a known price.
    CASE WHEN COUNT(c.platform_id) = COUNT(bp.platform_id) THEN 1 ELSE 0 END AS complete_comparison
FROM bundle_monthly AS bm
JOIN bundle_platforms AS bp
  ON bp.provider = bm.provider
 AND bp.bundle_name = bm.bundle_name
 AND bp.billing_period = bm.billing_period
 AND bp.as_of_date = bm.as_of_date
LEFT JOIN cheapest AS c ON c.platform_id = bp.platform_id
GROUP BY bm.provider, bm.bundle_name, bm.billing_period, bm.as_of_date
ORDER BY monthly_savings DESC;
