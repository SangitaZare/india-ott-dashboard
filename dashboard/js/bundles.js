/* Telecom bundle summary - the "what we know" numbers on the cost page.
   Pure functions (no page code) so they can be unit tested in Node: tests/js/bundles.test.js. */
"use strict";

(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Bundles = factory();
})(typeof self !== "undefined" ? self : this, () => {
  const MOBILE_TIER = /^Mobile( Edition)?$/;   // tier names providers use for mobile-only versions
  const UNNAMED = "unstated";

  /** "jiohotstar=Mobile;netflix=Basic" -> [["jiohotstar", "Mobile"], ["netflix", "Basic"]] */
  const tiersOf = (bundle) => bundle.included_tiers.split(";").map((item) => item.split("=").map((s) => s.trim()));

  // bundles.csv notes start with "Data pack only" for data add-ons; everything else is a full prepaid plan.
  const isDataPack = (bundle) => bundle.notes.startsWith("Data pack only");

  /**
   * @param bundles       rows of bundles.json
   * @param comparisons   rows of analysis.bundle_vs_separate
   * @param names         {platform_id: display name}
   */
  function bundleSummary(bundles, comparisons, names = {}) {
    const key = (r) => `${r.provider}|${r.bundle_name}`;
    const comparable = new Map(comparisons.filter((r) => r.complete_comparison === 1).map((r) => [key(r), r]));
    const withMobile = bundles.filter((b) => tiersOf(b).some(([, tier]) => MOBILE_TIER.test(tier)));
    const withUnnamed = bundles.filter((b) => tiersOf(b).some(([, tier]) => tier === UNNAMED));
    const mobileExamples = [...new Set(bundles.flatMap((b) => tiersOf(b)
      .filter(([, tier]) => MOBILE_TIER.test(tier))
      .map(([platform, tier]) => `${names[platform] || platform} ${tier}`)))].sort();
    const dataPacks = bundles.filter(isDataPack);
    return {
      total: bundles.length,
      withMobileTier: withMobile.length,
      withUnnamedTier: withUnnamed.length,
      withCutDownOrUnnamed: bundles.filter((b) => withMobile.includes(b) || withUnnamed.includes(b)).length,
      mobileExamples,
      comparable: comparable.size,
      comparableCheaper: [...comparable.values()].filter((r) => r.monthly_savings > 0).length,
      dataPacks: dataPacks.length,
      dataPacksComparable: dataPacks.filter((b) => comparable.has(key(b))).length,
    };
  }

  return { bundleSummary, isDataPack, tiersOf };
});
