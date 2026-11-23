-- Shared building blocks for sql/analysis.sql. Created by scripts/build_db.py.

-- Latest checked price for each plan + billing period.
-- prices.csv keeps history (a new row when a price changes), so analysis must use only the newest row.
CREATE VIEW current_prices AS
SELECT p.*
FROM prices AS p
WHERE p.as_of_date = (
    SELECT MAX(p2.as_of_date)
    FROM prices AS p2
    WHERE p2.platform_id = p.platform_id
      AND p2.plan_name = p.plan_name
      AND p2.billing_period = p.billing_period
);

-- Every current price converted to "rupees per month", so plans billed monthly,
-- quarterly and yearly can be compared fairly. A yearly ₹1,499 plan = ₹124.92 per month.
CREATE VIEW monthly_prices AS
SELECT
    cp.*,
    CASE cp.billing_period WHEN 'month' THEN 1 WHEN 'quarter' THEN 3 WHEN 'year' THEN 12 END AS months,
    cp.price_inr * 1.0
        / CASE cp.billing_period WHEN 'month' THEN 1 WHEN 'quarter' THEN 3 WHEN 'year' THEN 12 END
        AS price_per_month
FROM current_prices AS cp
WHERE cp.price_inr IS NOT NULL;
