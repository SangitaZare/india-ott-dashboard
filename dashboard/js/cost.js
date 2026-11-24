/* Page 2 - "The real cost of OTT in India".
   Every number comes from the named queries in sql/analysis.sql (exported to data/analysis.json),
   so the page, the notebook and the tests all use the same calculation. */
"use strict";

(() => {
  const { loadJson, cssVar, el, formatDate, formatDateRange, formatNumber, formatRupees, chartTheme, wrapLabel, labelChars } = OTT;

  const PERIOD = { month: "monthly", quarter: "quarterly", year: "yearly" };
  const QUALITY = { SD: "SD (480p)", HD: "HD (720p)", FHD: "Full HD (1080p)", "4K": "4K" };
  const DEVICES = { all: "TV, laptop & mobile", mobile_only: "Mobile only" };
  // ZEE5's six regional-language plans share identical prices; show them as one row in charts.
  const REGIONAL = /^(Telugu|Kannada|Marathi|Bengali|Tamil|Malayalam) Movies, Series, TV Shows, Live TV$/;
  const SHORT_PLAN = {
    "Sports + International Content + KidZ + All Language Content": "top plan (sports + all languages)",
    "Movies, Series, Live TV + KidZ + International Content": "Movies, Series, Live TV + Intl",
    "All content in Hindi, Punjabi, Bhojpuri": "Hindi, Punjabi, Bhojpuri",
  };

  let names = {};
  const shortPlan = (plan) => (REGIONAL.test(plan) ? "regional-language plans (6)" : SHORT_PLAN[plan] ?? plan);
  const planLabel = (r) => `${names[r.platform_id]} ${shortPlan(r.plan_name)}`;
  const dedupe = (rows, key) => rows.filter((r, i) => rows.findIndex((o) => key(o) === key(r)) === i);
  // Wrapped labels on phones need taller rows.
  const rowHeight = (n, per = 34) => `${Math.max(n * per * (window.innerWidth < 600 ? 1.5 : 1) + 70, 160)}px`;

  function legend(id, items) {
    document.getElementById(id).replaceChildren(...items.map(([label, color]) =>
      el("li", {}, [el("span", { className: "swatch", style: { "--swatch": color }, attrs: { "aria-hidden": "true" } }), el("span", { text: label })])));
  }

  function rupeeAxis(theme, title) {
    return {
      beginAtZero: true,
      grid: { color: theme.grid },
      border: { display: false },
      ticks: { color: theme.text2, callback: (v) => formatRupees(v) },
      title: { display: true, text: title, color: theme.text2 },
    };
  }

  const categoryAxis = (theme) => ({ grid: { display: false }, border: { display: false }, ticks: { color: theme.text, font: { size: window.innerWidth < 600 ? 11 : 12 }, autoSkip: false } });  // every bar keeps its name

  function describe(canvas, text) {
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", text);
  }

  // --- Headline tiles -------------------------------------------------------------------

  function renderStats(a) {
    const cheapestIn = [...a.cheapest_plan_per_platform].sort((x, y) => x.price_per_month - y.price_per_month)[0];
    const bestSaving = [...a.annual_vs_monthly_savings].sort((x, y) => y.savings_pct - x.savings_pct)[0];
    const perScreen = a.price_per_screen.filter((r) => r.price_per_screen_per_month != null)
      .sort((x, y) => x.price_per_screen_per_month - y.price_per_screen_per_month)[0];
    const fourK = a.cheapest_ad_free_4k[0];
    const tiles = [
      [`${formatRupees(cheapestIn.price_per_month)}/mo`, "Cheapest way in", `${planLabel(cheapestIn)} · ${DEVICES[cheapestIn.devices] ?? "devices unknown"}`, "--series-1"],
      [`${formatNumber(bestSaving.savings_pct, 0)}%`, "Most saved by paying yearly", `${planLabel(bestSaving)}: ${formatRupees(bestSaving.yearly_savings_inr)} a year`, "--series-2"],
      [`${formatRupees(perScreen.price_per_screen_per_month)}`, "Cheapest per screen, per month", `${planLabel(perScreen)}, ${perScreen.max_screens} screens`, "--m-viewers"],
      [`${formatRupees(fourK.price_per_month)}/mo`, "Cheapest ad-free 4K", `${planLabel(fourK)} (${PERIOD[fourK.billing_period]})`, "--m-active_paid_subscriptions"],
    ];
    document.getElementById("cost-stats").replaceChildren(...tiles.map(([value, label, detail, swatch]) =>
      el("article", { className: "stat", style: { "--swatch": cssVar(swatch) } }, [
        el("div", { className: "stat-value", text: value }),
        el("p", { className: "stat-label", text: label }),
        el("p", { className: "stat-source", text: detail }),
      ])));
  }

  // --- Chart 1: rupees per screen --------------------------------------------------------

  function renderPerScreen(rows, theme) {
    const known = rows.filter((r) => r.price_per_screen_per_month != null)
      .sort((x, y) => x.price_per_screen_per_month - y.price_per_screen_per_month);
    const labels = known.map((r) => `${planLabel(r)} (${PERIOD[r.billing_period]})`);
    document.getElementById("screen-chart-box").style.height = rowHeight(known.length, 30);
    const canvas = document.getElementById("screen-chart");
    describe(canvas, `Rupees per screen per month: ${known.map((r, i) => `${labels[i]} ${formatRupees(r.price_per_screen_per_month)}`).join("; ")}`);
    new Chart(canvas, {
      type: "bar",
      data: { labels: labels.map((l) => wrapLabel(l, labelChars())), datasets: [{ data: known.map((r) => r.price_per_screen_per_month), backgroundColor: cssVar("--series-1"), borderRadius: 4, barPercentage: 0.7 }] },
      options: {
        indexAxis: "y", maintainAspectRatio: false, animation: false,
        scales: { x: rupeeAxis(theme, "₹ per screen per month"), y: categoryAxis(theme) },
        plugins: {
          legend: { display: false },
          tooltip: { ...theme.tooltip, callbacks: {
            label: (item) => {
              const r = known[item.dataIndex];
              return [`${formatRupees(r.price_per_screen_per_month)} per screen per month`,
                `${formatRupees(r.price_inr)} ${PERIOD[r.billing_period]} = ${formatRupees(r.price_per_month)}/month, ${r.max_screens} screen(s)`];
            },
          } },
        },
      },
    });
    const left = rows.length - known.length;
    document.getElementById("screen-note").textContent =
      `${left} of ${rows.length} plans are left out because their page doesn't say how many screens can stream at the same time.`;
  }

  // --- Chart 2: yearly vs monthly ----------------------------------------------------------

  function renderYearly(rows, theme) {
    const list = dedupe(rows, (r) => planLabel(r)).sort((x, y) => y.savings_pct - x.savings_pct);
    const labels = list.map((r) => `${planLabel(r)} · save ${formatNumber(r.savings_pct, 0)}%`);
    const monthlyColor = cssVar("--series-2");
    const yearlyColor = cssVar("--series-1");
    legend("yearly-legend", [["12 monthly payments", monthlyColor], ["One yearly payment", yearlyColor]]);
    document.getElementById("yearly-chart-box").style.height = rowHeight(list.length, 52);
    const canvas = document.getElementById("yearly-chart");
    describe(canvas, list.map((r) => `${planLabel(r)}: ${formatRupees(r.twelve_months_cost)} paid monthly vs ${formatRupees(r.yearly_price)} yearly, saving ${formatNumber(r.savings_pct, 0)}%`).join("; "));
    new Chart(canvas, {
      type: "bar",
      data: {
        labels: labels.map((l) => wrapLabel(l, labelChars())),
        datasets: [
          { label: "12 monthly payments", data: list.map((r) => r.twelve_months_cost), backgroundColor: monthlyColor, borderRadius: 4, barPercentage: 0.8, categoryPercentage: 0.7 },
          { label: "One yearly payment", data: list.map((r) => r.yearly_price), backgroundColor: yearlyColor, borderRadius: 4, barPercentage: 0.8, categoryPercentage: 0.7 },
        ],
      },
      options: {
        indexAxis: "y", maintainAspectRatio: false, animation: false,
        scales: { x: rupeeAxis(theme, "₹ per year"), y: categoryAxis(theme) },
        plugins: {
          legend: { display: false },
          tooltip: { ...theme.tooltip, callbacks: {
            label: (item) => `${item.dataset.label}: ${formatRupees(item.raw)}`,
            footer: (items) => `Saving ${formatRupees(list[items[0].dataIndex].yearly_savings_inr)} a year`,
          } },
        },
      },
    });
  }

  // --- Chart 3: ads vs ad-free --------------------------------------------------------------

  function renderAds(rows, theme) {
    const list = rows.filter((r) => r.cheapest_with_ads_per_month != null || r.cheapest_ad_free_per_month != null)
      .sort((x, y) => (x.cheapest_ad_free_per_month ?? x.cheapest_with_ads_per_month) - (y.cheapest_ad_free_per_month ?? y.cheapest_with_ads_per_month));
    const adsColor = cssVar("--series-2");
    const freeColor = cssVar("--series-1");
    legend("ads-legend", [["Cheapest plan with ads", adsColor], ["Cheapest ad-free plan", freeColor]]);
    document.getElementById("ads-chart-box").style.height = rowHeight(list.length, 48);
    const canvas = document.getElementById("ads-chart");
    describe(canvas, list.map((r) => `${names[r.platform_id]}: with ads ${formatRupees(r.cheapest_with_ads_per_month)}, ad-free ${formatRupees(r.cheapest_ad_free_per_month)} per month`).join("; "));
    new Chart(canvas, {
      type: "bar",
      data: {
        labels: list.map((r) => names[r.platform_id]),
        datasets: [
          { label: "With ads", data: list.map((r) => r.cheapest_with_ads_per_month), backgroundColor: adsColor, borderRadius: 4, barPercentage: 0.8, categoryPercentage: 0.7 },
          { label: "Ad-free", data: list.map((r) => r.cheapest_ad_free_per_month), backgroundColor: freeColor, borderRadius: 4, barPercentage: 0.8, categoryPercentage: 0.7 },
        ],
      },
      options: {
        indexAxis: "y", maintainAspectRatio: false, animation: false,
        scales: { x: rupeeAxis(theme, "₹ per month"), y: categoryAxis(theme) },
        plugins: {
          legend: { display: false },
          tooltip: { ...theme.tooltip, callbacks: {
            label: (item) => {
              const r = list[item.dataIndex];
              const plan = item.datasetIndex === 0 ? r.cheapest_with_ads_plan : r.cheapest_ad_free_plan;
              return `${item.dataset.label}: ${formatRupees(item.raw)}/month (${shortPlan(plan.replace(/ \((month|quarter|year)\)$/, ""))})`;
            },
          } },
        },
      },
    });

    const cheaperAdFree = list.filter((r) => r.ad_free_premium_per_month != null && r.ad_free_premium_per_month < 0);
    const adsOnly = list.filter((r) => r.cheapest_ad_free_per_month == null).map((r) => names[r.platform_id]);
    const adFreeOnly = list.filter((r) => r.cheapest_with_ads_per_month == null).map((r) => names[r.platform_id]);
    const unknown = rows.filter((r) => r.cheapest_with_ads_per_month == null && r.cheapest_ad_free_per_month == null).map((r) => names[r.platform_id]);
    const parts = [];
    for (const r of cheaperAdFree) parts.push(`On ${names[r.platform_id]}, going ad-free is ${formatRupees(-r.ad_free_premium_per_month)}/month cheaper, because the ad-free plan is billed yearly.`);
    const primeNote = list.some((r) => r.platform_id === "prime_video" && r.cheapest_ad_free_per_month == null)
      ? " (Prime Video sells ad-free as an add-on at a price its page doesn't state)" : "";
    if (adsOnly.length) parts.push(`No ad-free plan found: ${adsOnly.join(", ")}${primeNote}.`);
    if (adFreeOnly.length) parts.push(`Ad-free only: ${adFreeOnly.join(", ")}.`);
    if (unknown.length) parts.push(`Ads not stated on the plan page: ${unknown.join(", ")}.`);
    document.getElementById("ads-note").textContent = parts.join(" ");
  }

  // --- Chart 4: bundles ------------------------------------------------------------------------

  // bundles.csv notes start with "Data pack only" for data add-ons; everything else is a full prepaid plan.
  const bundleType = (b) => (b.notes.startsWith("Data pack only") ? "data" : "full");

  /** "jiohotstar Mobile" -> readable reason why that app can't be priced like-for-like. */
  function blockerText(code) {
    const [platform, ...rest] = code.split(" ");
    const tier = rest.join(" ");
    return tier === "unstated"
      ? [`${names[platform]} (tier not named)`, "the provider doesn't say which plan it gives (often the app comes through JioTV, Airtel Xstream Play or Vi Movies & TV)"]
      : [`${names[platform]} ${tier}`, `no price for this tier on ${names[platform]}'s official web plans page`];
  }

  function renderBundles(analysisRows, bundles, theme, checked) {
    const typeOf = Object.fromEntries(bundles.map((b) => [`${b.provider}|${b.bundle_name}`, bundleType(b)]));
    const rows = analysisRows.map((r) => ({ ...r, type: typeOf[`${r.provider}|${r.bundle_name}`] }));
    const complete = rows.filter((r) => r.complete_comparison === 1);

    document.getElementById("bundle-callout").replaceChildren(
      el("strong", { text: "Read this first. " }),
      el("span", { text: "Each bundle is compared with buying the same tier of each app separately - e.g. \"JioHotstar Mobile\" with JioHotstar's Mobile plan, never with a different plan. "
        + "Full prepaid plans also pay for calls and data you'd buy anyway. "
        + `Only ${complete.length} of ${rows.length} bundles can be compared like-for-like today; the list below the chart says why.` }),
    );

    // What blocks the rest: one line per missing tier, with how many bundles it blocks.
    const counts = new Map();
    for (const r of rows.filter((x) => x.complete_comparison !== 1)) {
      for (const code of (r.unmatched_tiers || "").split("; ").filter(Boolean)) counts.set(code, (counts.get(code) || 0) + 1);
    }
    document.getElementById("bundle-blockers").replaceChildren(...[...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([code, n]) => {
        const [title, why] = blockerText(code);
        return el("li", {}, [el("strong", { text: `${title}: ` }), el("span", { text: `${why}. Blocks ${n} bundle${n > 1 ? "s" : ""}.` })]);
      }));

    const bundleColor = cssVar("--series-1");
    const separateColor = cssVar("--series-2");
    legend("bundle-legend", [["Bundle price", bundleColor], ["Buying the same tiers separately", separateColor]]);
    const canvas = document.getElementById("bundle-chart");
    const box = document.getElementById("bundle-chart-box");
    const legendEl = document.getElementById("bundle-legend");
    let chart = null;

    function draw(type) {
      const list = complete.filter((r) => r.type === type).sort((x, y) => y.monthly_savings - x.monthly_savings);
      const total = rows.filter((r) => r.type === type).length;
      const kind = type === "data" ? "data-only packs" : "full prepaid plans";
      if (chart) { chart.destroy(); chart = null; }
      box.hidden = legendEl.hidden = list.length === 0;
      if (!list.length) {
        document.getElementById("bundle-note").textContent =
          `None of the ${total} ${kind} can be compared like-for-like yet: every one includes an app tier without an official price (see the list below).`;
        return;
      }
      const labels = list.map((r) => `${r.provider} ${r.bundle_name.replace(" (no name shown)", "")}`);
      box.style.height = rowHeight(list.length, 56);
      describe(canvas, list.map((r, i) => `${labels[i]}: bundle ${formatRupees(r.bundle_per_month)}/month vs ${formatRupees(r.separate_per_month)} for the same tiers separately`).join("; "));
      chart = new Chart(canvas, {
        data: {
          labels: labels.map((l) => wrapLabel(l, labelChars())),
          datasets: [
            { type: "bar", label: "Gap", data: list.map((r) => [Math.min(r.bundle_per_month, r.separate_per_month), Math.max(r.bundle_per_month, r.separate_per_month)]),
              backgroundColor: theme.grid, barPercentage: 0.12, categoryPercentage: 1, order: 2 },
            { type: "line", label: "Bundle price", data: list.map((r, i) => ({ x: r.bundle_per_month, y: i })), showLine: false,
              pointRadius: 7, pointHoverRadius: 9, pointHitRadius: 14, pointBackgroundColor: bundleColor, pointBorderColor: theme.surface, pointBorderWidth: 2, order: 1 },
            { type: "line", label: "Same tiers separately", data: list.map((r, i) => ({ x: r.separate_per_month, y: i })), showLine: false,
              pointRadius: 7, pointHoverRadius: 9, pointHitRadius: 14, pointBackgroundColor: separateColor, pointBorderColor: theme.surface, pointBorderWidth: 2, order: 1 },
          ],
        },
        options: {
          indexAxis: "y", maintainAspectRatio: false, animation: false,
          interaction: { mode: "nearest", intersect: true },
          scales: { x: rupeeAxis(theme, "₹ per month"), y: categoryAxis(theme) },
          plugins: {
            legend: { display: false },
            tooltip: { ...theme.tooltip, filter: (item) => item.dataset.type === "line", callbacks: {
              label: (item) => `${item.dataset.label}: ${formatRupees(item.raw.x)}/month`,
              footer: (items) => {
                const r = list[items[0].dataIndex];
                return r.monthly_savings >= 0 ? `Bundle saves ${formatRupees(r.monthly_savings)}/month` : `Bundle costs ${formatRupees(-r.monthly_savings)}/month more`;
              },
            } },
          },
        },
      });
      const saving = list.filter((r) => r.monthly_savings > 0).length;
      document.getElementById("bundle-note").textContent = type === "data"
        ? `${saving} of the ${list.length} comparable data-only packs cost less than buying the same tiers directly.`
        : `${saving} of the ${list.length} comparable full plans cost less than the same apps alone - but these prices also include unlimited calls and daily data, so this is not like-for-like.`;
    }

    for (const button of document.querySelectorAll(".toggle button")) {
      button.addEventListener("click", () => {
        for (const b of document.querySelectorAll(".toggle button")) b.setAttribute("aria-pressed", String(b === button));
        draw(button.dataset.type);
      });
    }
    document.getElementById("bundle-source").textContent =
      `Bundle prices from jio.com, airtel.in and myvi.in (Maharashtra & Goa circle), checked ${formatDate(checked)}. 28- and 84-day plans are converted at 365/12 days per month.`;
    // Open on data-only packs (the fair comparison) - unless none of them is comparable yet.
    const first = complete.some((r) => r.type === "data") || !complete.length ? "data" : "full";
    for (const b of document.querySelectorAll(".toggle button")) b.setAttribute("aria-pressed", String(b.dataset.type === first));
    draw(first);
  }

  // --- Plan table ---------------------------------------------------------------------------

  function renderTable(prices, perScreen) {
    const monthly = Object.fromEntries(perScreen.map((r) => [`${r.platform_id}|${r.plan_name}|${r.billing_period}`, r.price_per_month]));
    const order = [...new Set(prices.map((p) => p.platform_id))];
    const select = document.getElementById("filter-platform");
    for (const id of order) select.append(el("option", { text: names[id], attrs: { value: id } }));
    const body = document.getElementById("plans-body");
    const unknown = () => el("span", { className: "unknown", text: "unknown" });

    function draw() {
      const visible = prices.filter((p) => !select.value || p.platform_id === select.value);
      body.replaceChildren(...visible.map((p) => {
        const perMonth = monthly[`${p.platform_id}|${p.plan_name}|${p.billing_period}`];
        return el("tr", {}, [
          el("td", { text: names[p.platform_id] }),
          el("td", {}, [el("a", { text: p.plan_name, attrs: { href: p.source_url, target: "_blank", rel: "noopener noreferrer" } })]),
          el("td", { className: "num" }, [p.price_inr == null ? unknown() : document.createTextNode(formatRupees(p.price_inr))]),
          el("td", { text: PERIOD[p.billing_period] }),
          el("td", { className: "num" }, [perMonth == null ? unknown() : document.createTextNode(formatRupees(perMonth))]),
          el("td", { className: "num" }, [p.max_screens == null ? unknown() : document.createTextNode(String(p.max_screens))]),
          el("td", {}, [p.max_quality == null ? unknown() : document.createTextNode(QUALITY[p.max_quality])]),
          el("td", {}, [p.has_ads == null ? unknown() : document.createTextNode(p.has_ads ? "With ads" : "Ad-free")]),
          el("td", {}, [p.devices == null ? unknown() : document.createTextNode(DEVICES[p.devices])]),
          el("td", { text: formatDate(p.accessed_date) }),
        ]);
      }));
    }
    select.addEventListener("change", draw);
    draw();
  }

  // --- Start --------------------------------------------------------------------------------

  async function start() {
    const note = document.getElementById("data-note");
    try {
      const [analysis, prices, bundles, platforms, meta] = await Promise.all(
        ["analysis", "prices", "bundles", "platforms", "meta"].map(loadJson));
      names = Object.fromEntries(platforms.map((p) => [p.platform_id, p.name]));
      const theme = chartTheme();
      const checkedText = `Prices from official plan pages, checked ${formatDateRange(meta.prices_first_checked, meta.prices_checked)}.`;
      document.getElementById("checked-note").textContent = checkedText;
      for (const node of document.querySelectorAll("[data-checked]")) node.textContent = checkedText;

      renderStats(analysis);
      renderPerScreen(analysis.price_per_screen, theme);
      renderYearly(analysis.annual_vs_monthly_savings, theme);
      renderAds(analysis.ads_vs_ad_free, theme);
      renderBundles(analysis.bundle_vs_separate, bundles, theme, meta.bundles_checked);
      renderTable(prices, analysis.price_per_screen);
      const missing = platforms.filter((p) => !prices.some((r) => r.platform_id === p.platform_id)).map((p) => p.name);
      note.textContent = `${prices.length} plans from ${new Set(prices.map((p) => p.platform_id)).size} platforms and ${bundles.length} telecom bundles, checked ${formatDateRange(meta.prices_first_checked, meta.prices_checked)}.`
        + (missing.length ? ` No verified prices yet for ${missing.join(" and ")}.` : "");
    } catch (error) {
      note.textContent = `Could not load the data: ${error.message}. If you opened this file directly, serve the folder instead: python -m http.server -d dashboard`;
      note.className = "error";
      console.error(error);
    }
  }

  start();
})();
