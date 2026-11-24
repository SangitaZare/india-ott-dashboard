/* Page 3 - family plan picker. Reads the form, calls Picker.pickPlans (js/picker.js) and shows the answer.
   All decision logic lives in picker.js, which is unit tested; this file only handles the page. */
"use strict";

(() => {
  const { loadJson, el, formatDate, formatRupees } = OTT;

  const PERIOD = { month: "month", quarter: "3 months", year: "year" };
  const QUALITY = { SD: "SD", HD: "HD", FHD: "Full HD", "4K": "4K" };
  const NEED_TEXT = {
    screens: "screens at once",
    ads: "ad-free",
    tv: "works on TV",
    cricket: "live cricket",
  };

  let data = null;
  const $ = (id) => document.getElementById(id);

  function readPrefs() {
    const budget = $("budget").value === "" ? null : Number($("budget").value);
    return {
      people: Math.max(1, Number($("people").value) || 1),
      screens: Number($("screens").value),
      languages: [...document.querySelectorAll("#languages input:checked")].map((i) => i.value),
      cricket: $("cricket").checked,
      needsTv: $("needs-tv").checked,
      adsOk: $("ads-ok").checked,
      budget: budget != null && budget >= 0 ? budget : null,
      allowUnverified: $("allow-unverified").checked,
    };
  }

  /** "2 screens at once, Tamil + Telugu, live cricket, no ads, on a TV" */
  function needsSummary(p) {
    const parts = [`${p.screens} screen${p.screens > 1 ? "s" : ""} at once`];
    if (p.languages.length) parts.push(p.languages.join(" + "));
    if (p.cricket) parts.push("live cricket");
    if (!p.adsOk) parts.push("no ads");
    if (p.needsTv) parts.push("on a TV");
    return parts.join(", ");
  }

  function unverifiedText(u) {
    const name = data.names[u.platform_id];
    if (u.need.startsWith("language:")) return `${name}: ${u.need.split(":")[1]} content not verified`;
    if (u.need === "screens") return `${name}: number of screens at once not stated`;
    if (u.need === "ads") return `${name}: whether the plan has ads is not stated`;
    if (u.need === "tv") return `${name}: supported devices not stated`;
    if (u.need === "cricket") return `${name}: live cricket not verified`;
    return `${name}: ${u.need} not verified`;
  }

  function reasonText(code, prefs) {
    const [need, a, b] = code.split(":");
    if (need === "price") return "no verified price yet";
    if (need === "language") return b === "unknown" ? `${a} content not verified` : `no ${a} content`;
    if (need === "cricket") return a === "unknown" ? "live cricket not verified" : "no live cricket";
    if (need === "screens") return a === "unknown" ? `doesn't say if ${prefs.screens} screens can stream at once` : `some plans allow fewer than ${prefs.screens} screens at once`;
    if (need === "ads") return a === "unknown" ? "doesn't say whether plans have ads" : "some plans have ads";
    if (need === "tv") return a === "unknown" ? "doesn't say which devices are supported" : "some plans are mobile-only";
    return code;
  }

  function planCard(plan) {
    const detail = [
      plan.max_screens != null ? `${plan.max_screens} screen${plan.max_screens > 1 ? "s" : ""} at once` : "screens not stated",
      plan.max_quality ? QUALITY[plan.max_quality] : "quality not stated",
      plan.has_ads == null ? "ads not stated" : plan.has_ads ? "with ads" : "ad-free",
      plan.devices == null ? "devices not stated" : plan.devices === "all" ? "TV, laptop & mobile" : "mobile only",
    ].join(" · ");
    const source = data.sources[`${plan.platform_id}|${plan.plan_name}|${plan.billing_period}`];
    return el("li", { className: "plan-pick" }, [
      el("div", { className: "plan-pick-head" }, [
        el("strong", { text: `${data.names[plan.platform_id]} · ${plan.plan_name}` }),
        el("span", { className: "plan-pick-price", text: `${formatRupees(plan.price_per_month)}/mo` }),
      ]),
      el("p", { className: "chart-sub", text: `Pay ${formatRupees(plan.price_inr)} per ${PERIOD[plan.billing_period]}. ${detail}` }),
      source ? el("a", { text: "Official plan page", attrs: { href: source, target: "_blank", rel: "noopener noreferrer" } }) : null,
    ]);
  }

  function comboBlock(combo, prefs, heading) {
    const perPerson = combo.total / prefs.people;
    return el("article", { className: "result-card" }, [
      heading ? el("h3", { text: heading }) : null,
      el("div", { className: "stat-value", text: `${formatRupees(combo.total)}/month` }),
      el("p", { className: "stat-source", text: `${combo.plans.length} platform${combo.plans.length > 1 ? "s" : ""} · about ${formatRupees(perPerson)} per person` }),
      el("ul", { className: "plan-list" }, combo.plans.map(planCard)),
      combo.unverified.length ? el("div", { className: "callout warn" }, [
        el("strong", { text: "Not verified: " }),
        el("span", { text: combo.unverified.map(unverifiedText).join("; ") + ". Check the official page before paying." }),
      ]) : null,
    ]);
  }

  function render() {
    const prefs = readPrefs();
    if (prefs.screens > prefs.people) {
      $("screens").value = String(Math.min(4, prefs.people));
      prefs.screens = Number($("screens").value);
    }
    const result = Picker.pickPlans(data.plans, data.platforms, prefs);
    const out = $("result");
    const alt = $("alternatives");
    alt.replaceChildren();

    if (result.status === "ok") {
      const names = result.best.plans.map((p) => `${data.names[p.platform_id]} ${p.plan_name}`).join(" + ");
      out.replaceChildren(
        el("p", { className: "reason", text: result.best.unverified.length
          ? `Best match for ${needsSummary(prefs)} (fewest unverified facts, then cheapest): ${names}, for ${formatRupees(result.best.total)} a month.`
          : `Cheapest way to get ${needsSummary(prefs)}: ${names}, for ${formatRupees(result.best.total)} a month.` }),
        comboBlock(result.best, prefs),
      );
      if (result.alternatives.length) {
        alt.append(el("h3", { text: "Other options within budget" }), ...result.alternatives.map((c, i) => comboBlock(c, prefs, `Option ${i + 2}`)));
      }
    } else if (result.status === "over_budget") {
      const gap = result.cheapestValid.total - prefs.budget;
      out.replaceChildren(
        el("p", { className: "reason", text: `Nothing fits ${formatRupees(prefs.budget)} a month. The cheapest way to get ${needsSummary(prefs)} costs ${formatRupees(result.cheapestValid.total)}, which is ${formatRupees(gap)} more.` }),
        comboBlock(result.cheapestValid, prefs, "Cheapest option that meets your needs"),
      );
    } else {
      const tips = [];
      if (!prefs.allowUnverified) tips.push("turn on \"Also consider plans where a need isn't verified yet\"");
      if (prefs.languages.length) tips.push("untick a language");
      if (prefs.screens > 1) tips.push("reduce screens at once");
      if (!prefs.adsOk) tips.push("allow ads");
      out.replaceChildren(el("div", { className: "callout" }, [
        el("strong", { text: "No combination we can verify meets all of these needs. " }),
        el("span", { text: tips.length ? `Try to ${tips.join(", or ")}. The list below shows what rules each platform out.` : "The list below shows what rules each platform out." }),
      ]));
    }

    const excluded = $("excluded");
    excluded.replaceChildren(...result.excluded.map((e) => el("li", {}, [
      el("strong", { text: `${data.names[e.platform_id]}: ` }),
      el("span", { text: e.reasons.map((code) => reasonText(code, prefs)).join("; ") || "not needed for the cheapest options" }),
    ])));
    $("excluded-box").hidden = result.excluded.length === 0;
    $("excluded-box").open = result.status === "no_match";  // the message above points to this list
  }

  /** Pre-fill the form from the address, e.g. picker.html?lang=Tamil,Telugu&screens=2&cricket=1&ads=0&tv=1&budget=400&unverified=1 */
  function applyUrl(params) {
    if (params.has("people")) $("people").value = params.get("people");
    if (params.has("screens")) $("screens").value = params.get("screens");
    if (params.has("budget")) $("budget").value = params.get("budget");
    const flags = { cricket: "cricket", tv: "needs-tv", ads: "ads-ok", unverified: "allow-unverified" };
    for (const [key, id] of Object.entries(flags)) if (params.has(key)) $(id).checked = params.get(key) === "1";
    const wanted = new Set((params.get("lang") || "").split(",").filter(Boolean));
    for (const box of document.querySelectorAll("#languages input")) box.checked = wanted.has(box.value);
  }

  async function start() {
    const note = $("data-note");
    try {
      const [analysis, prices, platforms, meta] = await Promise.all(["analysis", "prices", "platforms", "meta"].map(loadJson));
      data = {
        plans: analysis.price_per_screen,
        platforms,
        names: Object.fromEntries(platforms.map((p) => [p.platform_id, p.name])),
        sources: Object.fromEntries(prices.map((p) => [`${p.platform_id}|${p.plan_name}|${p.billing_period}`, p.source_url])),
      };
      const languages = [...new Set(platforms.flatMap((p) => (p.languages ? p.languages.split(";") : [])))].sort();
      $("languages").replaceChildren(...languages.map((lang) =>
        el("label", { className: "check" }, [el("input", { attrs: { type: "checkbox", value: lang, name: "languages" } }), document.createTextNode(` ${lang}`)])));
      $("checked-note").textContent = `Prices from official plan pages, checked ${formatDate(meta.prices_checked)}.`;
      const unpriced = platforms.filter((p) => !analysis.price_per_screen.some((r) => r.platform_id === p.platform_id)).map((p) => p.name);
      note.textContent = `${analysis.price_per_screen.length} plans from ${platforms.length - unpriced.length} platforms.`
        + (unpriced.length ? ` Not included yet (no verified price): ${unpriced.join(", ")}.` : "")
        + " Language lists are only verified for some platforms.";
      applyUrl(new URLSearchParams(location.search));
      $("picker-form").addEventListener("input", render);
      $("picker-form").addEventListener("submit", (e) => e.preventDefault());
      render();
    } catch (error) {
      note.textContent = `Could not load the data: ${error.message}. If you opened this file directly, serve the folder instead: python -m http.server -d dashboard`;
      note.className = "error";
      console.error(error);
    }
  }

  start();
})();
