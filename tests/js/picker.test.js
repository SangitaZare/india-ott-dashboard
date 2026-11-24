// Unit tests for dashboard/js/picker.js. Run with:  node --test tests/js/
// (tests/test_picker_js.py runs these as part of pytest.)
// All plans and platforms below are FAKE fixtures with hand-calculated answers.
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { pickPlans, checkPlan, platformOffers } = require("../../dashboard/js/picker.js");

const PLATFORMS = [
  { platform_id: "cric", name: "CricTV", languages: "Hindi;English", has_live_cricket: true },
  { platform_id: "south", name: "SouthFlix", languages: "Tamil;Telugu", has_live_cricket: false },
  { platform_id: "mystery", name: "Mystery", languages: null, has_live_cricket: null },
  { platform_id: "noprice", name: "NoPrice", languages: "Hindi", has_live_cricket: false },
];

const plan = (platform_id, plan_name, price_per_month, extra = {}) => ({
  platform_id, plan_name, price_per_month, billing_period: "month",
  max_screens: 2, has_ads: false, devices: "all", ...extra,
});

const PLANS = [
  plan("cric", "Mobile", 50, { max_screens: 1, has_ads: true, devices: "mobile_only" }),
  plan("cric", "Premium", 150, { max_screens: 4 }),
  plan("south", "Basic", 80, { max_screens: 1 }),
  plan("south", "Family", 120, { max_screens: 3 }),
  plan("mystery", "Only", 30, { max_screens: null, has_ads: null, devices: null }),
  plan("noprice", "Unpriced", null),
];

const prefs = (overrides = {}) => ({
  screens: 1, adsOk: true, needsTv: false, languages: [], cricket: false,
  budget: null, allowUnverified: false, people: 4, ...overrides,
});

const names = (combo) => combo.plans.map((p) => `${p.platform_id}/${p.plan_name}`).sort();

// --- checkPlan ---------------------------------------------------------------------------

test("one screen is always satisfied, even when the screen count is unknown", () => {
  assert.equal(checkPlan(PLANS[4], prefs({ screens: 1 })).screens, "yes");
});

test("unknown screens, ads and devices stay unknown", () => {
  const c = checkPlan(PLANS[4], prefs({ screens: 2, adsOk: false, needsTv: true }));
  assert.deepEqual(c, { screens: "unknown", ads: "unknown", tv: "unknown" });
});

test("known facts give yes or no", () => {
  const mobile = checkPlan(PLANS[0], prefs({ screens: 2, adsOk: false, needsTv: true }));
  assert.deepEqual(mobile, { screens: "no", ads: "no", tv: "no" });
  const premium = checkPlan(PLANS[1], prefs({ screens: 4, adsOk: false, needsTv: true }));
  assert.deepEqual(premium, { screens: "yes", ads: "yes", tv: "yes" });
});

test("platformOffers answers per language and for cricket", () => {
  const o = platformOffers(PLATFORMS[0], prefs({ languages: ["Hindi", "Tamil"] }));
  assert.deepEqual(o, { languages: { Hindi: "yes", Tamil: "no" }, cricket: "yes" });
  assert.equal(platformOffers(PLATFORMS[2], prefs({ languages: ["Hindi"] })).languages.Hindi, "unknown");
});

// --- pickPlans: happy paths ---------------------------------------------------------------------

test("no special needs -> the single cheapest verified plan", () => {
  const r = pickPlans(PLANS, PLATFORMS, prefs());
  assert.equal(r.status, "ok");
  // Mystery (30) qualifies: one screen is always fine and ads are OK, so nothing is unverified.
  assert.deepEqual(names(r.best), ["mystery/Only"]);
  assert.equal(r.best.total, 30);
  assert.deepEqual(r.best.unverified, []);
});

test("picks the cheapest plan per platform that meets the per-plan needs", () => {
  const r = pickPlans(PLANS, PLATFORMS, prefs({ screens: 2, cricket: true }));
  // CricTV Mobile has 1 screen, so CricTV Premium (150) is the only cricket option.
  assert.deepEqual(names(r.best), ["cric/Premium"]);
  assert.equal(r.best.total, 150);
});

test("combines platforms to cover several languages", () => {
  const r = pickPlans(PLANS, PLATFORMS, prefs({ languages: ["Hindi", "Tamil"] }));
  // Hindi from CricTV Mobile (50) + Tamil from SouthFlix Basic (80) = 130.
  assert.deepEqual(names(r.best), ["cric/Mobile", "south/Basic"]);
  assert.equal(r.best.total, 130);
});

test("never adds a platform that contributes nothing", () => {
  const r = pickPlans(PLANS, PLATFORMS, prefs({ languages: ["Tamil"] }));
  for (const combo of [r.best, ...r.alternatives]) {
    assert.ok(!(combo.plans.length > 1 && combo.plans.some((p) => p.platform_id === "south")),
      `superset returned: ${names(combo)}`);
  }
});

test("alternatives are the next cheapest valid combinations", () => {
  const r = pickPlans(PLANS, PLATFORMS, prefs({ languages: ["Hindi"] }));
  assert.deepEqual(names(r.best), ["cric/Mobile"]);
  // NoPrice also offers Hindi but has no price, so there is no alternative.
  assert.equal(r.alternatives.length, 0);
});

// --- Unknown facts --------------------------------------------------------------------------------

test("strict mode never counts an unknown fact as a yes", () => {
  const r = pickPlans(PLANS, PLATFORMS, prefs({ screens: 2, adsOk: false }));
  assert.ok(!names(r.best).includes("mystery/Only"));
  const mystery = r.excluded.find((e) => e.platform_id === "mystery");
  assert.deepEqual(mystery.reasons, ["ads:unknown", "screens:unknown"]);
});

test("allowing unverified facts includes them as flagged options", () => {
  const r = pickPlans(PLANS, PLATFORMS, prefs({ screens: 2, adsOk: false, allowUnverified: true }));
  // Fully verified SouthFlix Family (120) still ranks first; cheaper Mystery (30) is now an option, flagged.
  assert.deepEqual(names(r.best), ["south/Family"]);
  const mystery = r.alternatives.find((c) => names(c).includes("mystery/Only"));
  assert.ok(mystery, "unverified plan should be offered as an alternative");
  assert.deepEqual(mystery.unverified.map((u) => u.need).sort(), ["ads", "screens"]);
});

test("unverified language coverage is flagged, not claimed", () => {
  const strict = pickPlans(PLANS, PLATFORMS, prefs({ languages: ["Bengali"] }));
  assert.equal(strict.status, "no_match");
  const loose = pickPlans(PLANS, PLATFORMS, prefs({ languages: ["Bengali"], allowUnverified: true }));
  assert.deepEqual(names(loose.best), ["mystery/Only"]);
  assert.deepEqual(loose.best.unverified, [{ platform_id: "mystery", need: "language:Bengali" }]);
});

test("with unverified facts allowed, a verified option beats a cheaper unverified one", () => {
  // Mystery (30) might have Tamil (unknown); SouthFlix Basic (80) verifiably has Tamil.
  const r = pickPlans(PLANS, PLATFORMS, prefs({ languages: ["Tamil"], allowUnverified: true }));
  assert.deepEqual(names(r.best), ["south/Basic"]);
  assert.deepEqual(r.best.unverified, []);
  assert.deepEqual(r.alternatives.map(names), [["mystery/Only"]]);
});

test("platforms with no price are reported as excluded", () => {
  const r = pickPlans(PLANS, PLATFORMS, prefs());
  assert.deepEqual(r.excluded.find((e) => e.platform_id === "noprice").reasons, ["price:unknown"]);
});

// --- Edge cases from PROJECT_PLAN M8 -------------------------------------------------------------

test("no valid combination -> no_match", () => {
  // Nobody verifiably offers Kannada.
  const r = pickPlans(PLANS, PLATFORMS, prefs({ languages: ["Kannada"] }));
  assert.equal(r.status, "no_match");
  assert.equal(r.best, null);
  assert.equal(r.cheapestValid, null);
});

test("budget too low -> over_budget, with the cheapest valid option to show", () => {
  const r = pickPlans(PLANS, PLATFORMS, prefs({ languages: ["Hindi", "Tamil"], budget: 100 }));
  assert.equal(r.status, "over_budget");
  assert.equal(r.best, null);
  assert.equal(r.cheapestValid.total, 130);
});

test("budget exactly equal to the total is enough", () => {
  const r = pickPlans(PLANS, PLATFORMS, prefs({ languages: ["Hindi", "Tamil"], budget: 130 }));
  assert.equal(r.status, "ok");
  assert.equal(r.best.total, 130);
});

test("alternatives over the budget are left out", () => {
  // Valid single plans: Mystery 30, CricTV Mobile 50, SouthFlix Basic 80. Budget 60 drops SouthFlix.
  const r = pickPlans(PLANS, PLATFORMS, prefs({ budget: 60 }));
  assert.deepEqual(names(r.best), ["mystery/Only"]);
  assert.deepEqual(r.alternatives.map(names), [["cric/Mobile"]]);
});

test("empty input -> no_match, not a crash", () => {
  const r = pickPlans([], [], prefs());
  assert.equal(r.status, "no_match");
});

test("totals are rounded to paise", () => {
  const odd = [plan("cric", "Yearly", 1499 / 12)];
  const r = pickPlans(odd, PLATFORMS, prefs());
  assert.equal(r.best.total, 124.92);
});
