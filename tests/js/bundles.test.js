// Unit tests for dashboard/js/bundles.js (run by tests/test_picker_js.py with the other JS tests).
// FAKE fixtures with hand-counted answers.
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { bundleSummary, isDataPack, tiersOf } = require("../../dashboard/js/bundles.js");

const bundle = (provider, bundle_name, tiers, notes) => ({ provider, bundle_name, included_tiers: tiers, notes });
const BUNDLES = [
  bundle("T", "MobilePack", "hot=Mobile", "Data pack only. x"),
  bundle("T", "Aggregator", "son=unstated;zee=unstated", "Data pack only. x"),
  bundle("T", "Both", "prime=Mobile Edition;son=unstated", "Full prepaid plan. x"),
  bundle("T", "FullTier", "net=Basic", "Full prepaid plan. x"),
  bundle("T", "Cheap", "net=Basic;hot=Super", "Data pack only. x"),
];
const COMPARISONS = [
  { provider: "T", bundle_name: "FullTier", complete_comparison: 1, monthly_savings: -50 },
  { provider: "T", bundle_name: "Cheap", complete_comparison: 1, monthly_savings: 20 },
  { provider: "T", bundle_name: "MobilePack", complete_comparison: 0, monthly_savings: null },
];
const NAMES = { hot: "HotTV", prime: "PrimeX", net: "NetX" };

test("tiersOf splits platform=tier pairs", () => {
  assert.deepEqual(tiersOf(BUNDLES[2]), [["prime", "Mobile Edition"], ["son", "unstated"]]);
});

test("isDataPack reads the notes prefix", () => {
  assert.deepEqual(BUNDLES.map(isDataPack), [true, true, false, false, true]);
});

test("counts bundles with mobile tiers, unnamed tiers and either", () => {
  const s = bundleSummary(BUNDLES, COMPARISONS, NAMES);
  assert.equal(s.total, 5);
  assert.equal(s.withMobileTier, 2);        // MobilePack, Both
  assert.equal(s.withUnnamedTier, 2);       // Aggregator, Both
  assert.equal(s.withCutDownOrUnnamed, 3);  // Both is counted once
});

test("'Super' or 'Basic' are not mobile tiers; 'Mobile' and 'Mobile Edition' are", () => {
  assert.deepEqual(bundleSummary(BUNDLES, COMPARISONS, NAMES).mobileExamples, ["HotTV Mobile", "PrimeX Mobile Edition"]);
});

test("counts comparable bundles and how many are cheaper", () => {
  const s = bundleSummary(BUNDLES, COMPARISONS, NAMES);
  assert.equal(s.comparable, 2);
  assert.equal(s.comparableCheaper, 1);
  assert.equal(s.dataPacks, 3);
  assert.equal(s.dataPacksComparable, 1);   // Cheap
});

test("no comparisons -> zeros, not a crash", () => {
  const s = bundleSummary([], [], {});
  assert.deepEqual([s.total, s.comparable, s.dataPacksComparable, s.mobileExamples.length], [0, 0, 0, 0]);
});
