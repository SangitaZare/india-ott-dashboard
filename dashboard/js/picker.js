/* Family plan picker - the decision logic, with no DOM code so it can be unit tested in Node
   (tests/js/picker.test.js). picker-page.js wires it to the form.

   The idea:
   1. Each plan is checked against the per-plan needs (screens at once, no ads, watch on TV).
      Every check answers "yes", "no" or "unknown" - unknown is NOT treated as yes unless the user
      explicitly allows unverified facts, and then it is flagged on the result.
   2. For each platform, keep only its cheapest plan that passes (any more expensive passing plan
      can never be part of a cheaper answer).
   3. Try every combination of those platforms (at most 2^9 = 512) and keep the ones that cover
      the household-level needs (every chosen language, live cricket). Rank by fewest unverified
      facts, then cheapest.
*/
"use strict";

(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Picker = factory();
})(typeof self !== "undefined" ? self : this, () => {
  const YES = "yes";
  const NO = "no";
  const UNKNOWN = "unknown";

  const listOf = (value) => (value ? value.split(";").map((s) => s.trim()).filter(Boolean) : null);

  /** Per-plan checks. Returns {screens, ads, tv} each yes/no/unknown. */
  function checkPlan(plan, prefs) {
    const screens = prefs.screens <= 1 ? YES  // every plan streams on at least one screen
      : plan.max_screens == null ? UNKNOWN
        : plan.max_screens >= prefs.screens ? YES : NO;
    const ads = prefs.adsOk ? YES
      : plan.has_ads == null ? UNKNOWN
        : plan.has_ads ? NO : YES;
    const tv = !prefs.needsTv ? YES
      : plan.devices == null ? UNKNOWN
        : plan.devices === "all" ? YES : NO;
    return { screens, ads, tv };
  }

  /** Does this platform offer the language / live cricket? yes/no/unknown. */
  function platformOffers(platform, prefs) {
    const languages = listOf(platform.languages);
    const languageChecks = Object.fromEntries((prefs.languages || []).map((lang) => [
      lang, languages == null ? UNKNOWN : languages.includes(lang) ? YES : NO,
    ]));
    const cricket = platform.has_live_cricket == null ? UNKNOWN : platform.has_live_cricket ? YES : NO;
    return { languages: languageChecks, cricket };
  }

  const accepts = (answer, allowUnverified) => answer === YES || (allowUnverified && answer === UNKNOWN);

  /** Cheapest passing plan per platform, plus the reasons each platform was ruled out. */
  function eligiblePlans(plans, platformsById, prefs) {
    const best = {};
    const reasons = {};
    for (const plan of plans) {
      if (plan.price_per_month == null || !platformsById[plan.platform_id]) continue;
      const checks = checkPlan(plan, prefs);
      const failed = Object.entries(checks).filter(([, answer]) => !accepts(answer, prefs.allowUnverified));
      if (failed.length) {
        (reasons[plan.platform_id] ||= new Set());
        for (const [need, answer] of failed) reasons[plan.platform_id].add(`${need}:${answer}`);
        continue;
      }
      const current = best[plan.platform_id];
      if (!current || plan.price_per_month < current.plan.price_per_month) best[plan.platform_id] = { plan, checks };
    }
    return { best, reasons };
  }

  /** What a combination covers, and which of its claims are unverified. */
  function coverage(entries, platformsById, prefs) {
    const unverified = [];
    for (const { plan, checks } of entries) {
      for (const [need, answer] of Object.entries(checks)) if (answer === UNKNOWN) unverified.push({ platform_id: plan.platform_id, need });
    }
    const missing = [];
    for (const lang of prefs.languages || []) {
      const answers = entries.map((e) => [e.plan.platform_id, platformOffers(platformsById[e.plan.platform_id], prefs).languages[lang]]);
      if (answers.some(([, a]) => a === YES)) continue;
      const maybe = answers.find(([, a]) => a === UNKNOWN);
      if (prefs.allowUnverified && maybe) unverified.push({ platform_id: maybe[0], need: `language:${lang}` });
      else missing.push(`language:${lang}`);
    }
    if (prefs.cricket) {
      const answers = entries.map((e) => [e.plan.platform_id, platformOffers(platformsById[e.plan.platform_id], prefs).cricket]);
      if (!answers.some(([, a]) => a === YES)) {
        const maybe = answers.find(([, a]) => a === UNKNOWN);
        if (prefs.allowUnverified && maybe) unverified.push({ platform_id: maybe[0], need: "cricket" });
        else missing.push("cricket");
      }
    }
    return { missing, unverified };
  }

  const round2 = (n) => Math.round(n * 100) / 100;

  /**
   * Find the cheapest combination of plans meeting the household's needs.
   * @param plans      rows like analysis.price_per_screen (price_per_month, max_screens, has_ads, devices, ...)
   * @param platforms  rows like platforms.json (platform_id, name, languages, has_live_cricket)
   * @param prefs      {screens, adsOk, needsTv, languages: [], cricket, budget, allowUnverified, people}
   * @returns {status: "ok"|"no_match"|"over_budget", best, alternatives, cheapestValid, excluded}
   */
  function pickPlans(plans, platforms, prefs) {
    const platformsById = Object.fromEntries(platforms.map((p) => [p.platform_id, p]));
    const { best, reasons } = eligiblePlans(plans, platformsById, prefs);
    const ids = Object.keys(best).sort();

    const combos = [];
    for (let mask = 1; mask < 1 << ids.length; mask++) {
      const entries = ids.filter((_, i) => mask & (1 << i)).map((id) => best[id]);
      const { missing, unverified } = coverage(entries, platformsById, prefs);
      if (missing.length) continue;
      const total = round2(entries.reduce((sum, e) => sum + e.plan.price_per_month, 0));
      combos.push({ plans: entries.map((e) => e.plan), total, unverified, size: entries.length });
    }
    // Drop combinations containing a platform that adds nothing: a smaller set inside it already works.
    const minimal = combos.filter((c) => !combos.some((o) => o.size < c.size
      && o.plans.every((p) => c.plans.includes(p)) && o.total <= c.total));
    // Fewest unverified facts first, then cheapest. In strict mode nothing is unverified, so this is
    // simply "cheapest". With unverified facts allowed, a verified option beats a cheaper guess.
    minimal.sort((a, b) => a.unverified.length - b.unverified.length || a.total - b.total || a.size - b.size);

    const excluded = platforms
      .filter((p) => !best[p.platform_id])
      .map((p) => ({
        platform_id: p.platform_id,
        reasons: reasons[p.platform_id] ? [...reasons[p.platform_id]].sort()
          : plans.some((pl) => pl.platform_id === p.platform_id && pl.price_per_month != null) ? [] : ["price:unknown"],
      }));
    // Platforms that pass the plan checks but can't supply a required language/cricket on their own are
    // reported too, so the page can explain why they never appear.
    for (const id of ids) {
      const offers = platformOffers(platformsById[id], prefs);
      const gaps = Object.entries(offers.languages).filter(([, a]) => a !== YES).map(([lang, a]) => `language:${lang}:${a}`);
      if (prefs.cricket && offers.cricket !== YES) gaps.push(`cricket:${offers.cricket}`);
      if (gaps.length && !minimal.some((c) => c.plans.some((p) => p.platform_id === id))) excluded.push({ platform_id: id, reasons: gaps });
    }

    const cheapestValid = minimal[0] || null;
    if (!cheapestValid) return { status: "no_match", best: null, alternatives: [], cheapestValid: null, excluded };
    const affordable = minimal.filter((c) => prefs.budget == null || c.total <= prefs.budget);
    if (!affordable.length) return { status: "over_budget", best: null, alternatives: [], cheapestValid, excluded };
    return { status: "ok", best: affordable[0], alternatives: affordable.slice(1, 3), cheapestValid, excluded };
  }

  /** Most visitors want Hindi, so it is ticked on first load when the data offers it.
   *  A ?lang= value in the address always wins - even an empty one (meaning "no language"). */
  const DEFAULT_LANGUAGE = "Hindi";

  function initialLanguages(available, langParam) {
    if (langParam != null) {
      const wanted = langParam.split(",").map((s) => s.trim()).filter(Boolean);
      return available.filter((lang) => wanted.includes(lang));
    }
    return available.includes(DEFAULT_LANGUAGE) ? [DEFAULT_LANGUAGE] : [];
  }

  return { pickPlans, checkPlan, platformOffers, initialLanguages, YES, NO, UNKNOWN };
});
