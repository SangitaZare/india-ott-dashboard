/* Page 1 - "Why do the numbers disagree?"
   Reads dashboard/data/*.json (made by scripts/export_json.py) and draws:
   market stat tiles, one range chart per platform, a glossary and a filterable source table. */
"use strict";

(() => {
  const { loadJson, cssVar, el, formatDate, formatMonth, formatNumber } = OTT;

  // Fixed order = fixed colour for each kind of number (see --m-* tokens in style.css).
  const METRICS = {
    paying_subscribers: {
      name: "Paying subscribers",
      text: "People or accounts paying for this platform. Companies, brokers and research firms all estimate it, often differently.",
    },
    subscriptions: {
      name: "Paid subscriptions",
      text: "Paid plans. One person or home can hold several, so this is bigger than the number of subscribers or households.",
    },
    viewers: {
      name: "Users / viewers",
      text: "Everyone who watches, including free users and people on a shared password. Usually the biggest number a company quotes.",
    },
    active_paid_subscriptions: {
      name: "Active paid subscriptions",
      text: "Paid subscriptions that were actually used in the last month (Ormax). Many bundled subscriptions are never opened.",
    },
    audience: {
      name: "Audience",
      text: "Anyone who watched any online video in the last month, free or paid. Describes the whole market, not paying customers.",
    },
    subscribing_households: {
      name: "Subscribing households",
      text: "Homes with at least one paid subscription. Smaller than subscriptions, because homes often pay for several apps.",
    },
    engagement_share_pct: {
      name: "Viewing / interest share (%)",
      text: "A platform's share of viewing time or user interest (Media Partners Asia, JustWatch). A percentage, not a count of people.",
    },
  };
  const METRIC_ORDER = Object.keys(METRICS);

  const CREDIBILITY = {
    company_official: ["Company statement", "cred-high"],
    industry_report: ["Industry research", "cred-high"],
    broker_note: ["Broker estimate", "cred-mid"],
    news_report: ["News report", "cred-mid"],
    stats_website: ["Stats website", "cred-low"],
    blog: ["Blog", "cred-low"],
  };

  const PLATFORM_ORDER = ["jiohotstar", "netflix", "prime_video", "market_total"];
  const color = (metric) => cssVar(`--m-${metric}`);

  /** The single number used to place a dot: the value, else the low end ("over X"), else the high end. */
  const figureOf = (row) => row.value ?? row.value_low ?? row.value_high;

  function figureLabel(row) {
    const unit = row.unit === "percent" ? "%" : "M";
    if (row.value != null) return `${formatNumber(row.value)}${unit}`;
    if (row.value_low != null && row.value_high != null) return `${formatNumber(row.value_low)}–${formatNumber(row.value_high)}${unit}`;
    if (row.value_low != null) return `${formatNumber(row.value_low)}${unit}+`;
    return `up to ${formatNumber(row.value_high)}${unit}`;
  }

  const shortSource = (row) => row.source_name.replace(/\s*\(via [^)]*\)/, "");
  const isSecondHand = (row) => /\(via /.test(row.source_name);

  // --- Market stat tiles ------------------------------------------------------------

  function renderMarketStats(rows) {
    const container = document.getElementById("market-stats");
    const latest = {};
    for (const row of rows.filter((r) => r.platform_id === "market_total" && r.unit === "millions")) {
      if (!latest[row.metric_type] || row.as_of_date > latest[row.metric_type].as_of_date) latest[row.metric_type] = row;
    }
    const tiles = Object.values(latest).sort((a, b) => figureOf(b) - figureOf(a));
    container.replaceChildren(...tiles.map((row) => el("article", { className: "stat", style: { "--swatch": color(row.metric_type) } }, [
      el("div", { className: "stat-value", text: figureLabel(row) }),
      el("p", { className: "stat-label", text: METRICS[row.metric_type].name }),
      el("p", { className: "stat-source", text: `${shortSource(row)} · ${formatMonth(row.as_of_date)}` }),
    ])));
  }

  // --- Range charts -------------------------------------------------------------------

  function renderLegend(metricsShown) {
    const legend = document.getElementById("metric-legend");
    legend.replaceChildren(...METRIC_ORDER.filter((m) => metricsShown.has(m)).map((m) =>
      el("li", {}, [el("span", { className: "swatch", style: { "--swatch": color(m) }, attrs: { "aria-hidden": "true" } }), el("span", { text: METRICS[m].name })])
    ));
  }

  function chartCaption(rows, checked) {
    const dates = rows.map((r) => r.as_of_date).sort();
    const span = dates[0] === dates.at(-1) ? formatMonth(dates[0]) : `${formatMonth(dates[0])} – ${formatMonth(dates.at(-1))}`;
    return `${rows.length} figure${rows.length === 1 ? "" : "s"} dated ${span}, from ${new Set(rows.map(shortSource)).size} source(s). Checked ${formatDate(checked)}.`;
  }

  function renderRangeChart(container, platformName, rows, percentRows, checked) {
    const metrics = METRIC_ORDER.filter((m) => rows.some((r) => r.metric_type === m));
    const labels = metrics.map((m) => METRICS[m].name);
    const ranges = metrics.map((m) => {
      const values = rows.filter((r) => r.metric_type === m).flatMap((r) => [r.value, r.value_low, r.value_high]).filter((v) => v != null);
      return [Math.min(...values), Math.max(...values)];
    });
    const points = rows.map((r) => ({ x: figureOf(r), y: METRICS[r.metric_type].name, row: r }));
    const maxValue = Math.max(...ranges.map((r) => r[1]));

    const spreadText = metrics.map((m, i) => {
      const n = rows.filter((r) => r.metric_type === m).length;
      return n > 1 ? `${METRICS[m].name}: ${formatNumber(ranges[i][0])}M to ${formatNumber(ranges[i][1])}M (${n} estimates)` : null;
    }).filter(Boolean);

    const canvas = el("canvas", { attrs: { role: "img", "aria-label": `${platformName}: ${rows.map((r) => `${METRICS[r.metric_type].name} ${figureLabel(r)} (${shortSource(r)})`).join("; ")}` } });
    const box = el("div", { className: "chart-box", style: { height: `${metrics.length * 58 + 64}px` } }, [canvas]);
    const card = el("article", { className: "chart-card" }, [
      el("h3", { text: platformName }),
      el("p", { className: "chart-sub", text: spreadText.length ? spreadText.join(" · ") : "One estimate per kind of number." }),
      box,
      ...percentRows.map((r) => el("p", { className: "chart-note", text: `Also: ${figureLabel(r)} ${METRICS[r.metric_type].name.toLowerCase().replace(" (%)", "")} (${shortSource(r)}, ${formatMonth(r.as_of_date)}). A share, not a count of people.` })),
      el("p", { className: "chart-source", text: chartCaption(rows.concat(percentRows), checked) }),
    ]);
    container.append(card);

    const text2 = cssVar("--text-secondary");
    const grid = cssVar("--border");
    const surface = cssVar("--surface-1");
    new Chart(canvas, {
      data: {
        labels,
        datasets: [
          {
            type: "bar",
            label: "Range",
            data: ranges,
            backgroundColor: metrics.map((m) => `${color(m)}55`),
            borderColor: metrics.map(color),
            borderWidth: 1,
            borderRadius: 4,
            borderSkipped: false,
            minBarLength: 6,
            barPercentage: 0.55,
            categoryPercentage: 1,
            order: 2,
          },
          {
            type: "line",
            label: "Estimates",
            data: points,
            showLine: false,
            pointRadius: 7,
            pointHoverRadius: 9,
            pointHitRadius: 14,
            pointBackgroundColor: points.map((p) => color(p.row.metric_type)),
            pointBorderColor: surface,
            pointBorderWidth: 2,
            order: 1,
          },
        ],
      },
      options: {
        indexAxis: "y",
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: "nearest", intersect: true },
        scales: {
          x: {
            beginAtZero: true,
            suggestedMax: maxValue * 1.1,
            grid: { color: grid },
            border: { display: false },
            ticks: { color: text2, callback: (v) => `${formatNumber(v, 0)}M` },
            title: { display: true, text: "Millions", color: text2 },
          },
          y: { grid: { display: false }, border: { display: false }, ticks: { color: cssVar("--text-primary"), font: { size: 12 } } },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: cssVar("--surface-2"),
            borderColor: grid,
            borderWidth: 1,
            titleColor: cssVar("--text-primary"),
            bodyColor: text2,
            padding: 10,
            callbacks: {
              title: (items) => {
                const item = items[0];
                if (item.dataset.type === "line") return `${figureLabel(item.raw.row)} · ${METRICS[item.raw.row.metric_type].name}`;
                const [lo, hi] = item.raw;
                return lo === hi ? `${formatNumber(lo)}M` : `Range ${formatNumber(lo)}M – ${formatNumber(hi)}M`;
              },
              label: (item) => {
                if (item.dataset.type !== "line") return `${METRICS[metrics[item.dataIndex]].name}: lowest to highest estimate`;
                const r = item.raw.row;
                return [`${shortSource(r)}${isSecondHand(r) ? " (second-hand)" : ""}`, `${CREDIBILITY[r.source_type][0]} · figure date ${formatMonth(r.as_of_date)}`];
              },
            },
          },
        },
      },
    });
  }

  function renderRangeCharts(rows, platforms, checked) {
    const container = document.getElementById("range-charts");
    container.replaceChildren();
    const shown = new Set();
    for (const id of PLATFORM_ORDER) {
      const counts = rows.filter((r) => r.platform_id === id && r.unit === "millions");
      if (!counts.length) continue;
      counts.forEach((r) => shown.add(r.metric_type));
      const percents = rows.filter((r) => r.platform_id === id && r.unit === "percent");
      renderRangeChart(container, platforms[id], counts, percents, checked);
    }
    renderLegend(shown);
  }

  // --- Glossary ------------------------------------------------------------------------

  function renderGlossary(rows) {
    const container = document.getElementById("glossary");
    container.replaceChildren(...METRIC_ORDER.map((m) => {
      const examples = rows.filter((r) => r.metric_type === m);
      const example = examples.sort((a, b) => figureOf(b) - figureOf(a))[0];
      return el("article", { className: "card" }, [
        el("h3", {}, [el("span", { className: "swatch", style: { "--swatch": color(m) }, attrs: { "aria-hidden": "true" } }), el("span", { text: METRICS[m].name })]),
        el("p", { text: METRICS[m].text }),
        example ? el("p", { className: "example", text: `e.g. ${figureLabel(example)} (${shortSource(example)}, ${formatMonth(example.as_of_date)})` }) : null,
      ]);
    }));
  }

  // --- Source table --------------------------------------------------------------------

  function renderTable(rows, platforms) {
    const body = document.getElementById("sources-body");
    const platformSelect = document.getElementById("filter-platform");
    const metricSelect = document.getElementById("filter-metric");
    const sorted = [...rows].sort((a, b) =>
      PLATFORM_ORDER.indexOf(a.platform_id) - PLATFORM_ORDER.indexOf(b.platform_id)
      || METRIC_ORDER.indexOf(a.metric_type) - METRIC_ORDER.indexOf(b.metric_type)
      || b.as_of_date.localeCompare(a.as_of_date));

    for (const id of PLATFORM_ORDER.filter((p) => rows.some((r) => r.platform_id === p))) platformSelect.append(el("option", { text: platforms[id], attrs: { value: id } }));
    for (const m of METRIC_ORDER.filter((m) => rows.some((r) => r.metric_type === m))) metricSelect.append(el("option", { text: METRICS[m].name, attrs: { value: m } }));

    function draw() {
      const visible = sorted.filter((r) => (!platformSelect.value || r.platform_id === platformSelect.value)
        && (!metricSelect.value || r.metric_type === metricSelect.value));
      if (!visible.length) {
        body.replaceChildren(el("tr", { className: "empty-row" }, [el("td", { text: "No figures match these filters.", attrs: { colspan: "7" } })]));
        return;
      }
      body.replaceChildren(...visible.map((r) => {
        const [credText, credClass] = CREDIBILITY[r.source_type];
        const link = el("a", { text: shortSource(r), attrs: { href: r.source_url, target: "_blank", rel: "noopener noreferrer" } });
        return el("tr", {}, [
          el("td", { text: platforms[r.platform_id] }),
          el("td", { className: "num", text: figureLabel(r) }),
          el("td", {}, [el("span", { className: "metric-tag" }, [el("span", { className: "swatch", style: { "--swatch": color(r.metric_type) }, attrs: { "aria-hidden": "true" } }), el("span", { text: METRICS[r.metric_type].name })])]),
          el("td", {}, [link, isSecondHand(r) ? el("div", { className: "chart-source", text: r.source_name.match(/\(via ([^)]*)\)/)[0] }) : null]),
          el("td", {}, [el("span", { className: `cred ${credClass}`, text: credText })]),
          el("td", { text: formatMonth(r.as_of_date) }),
          el("td", { text: formatDate(r.accessed_date) }),
        ]);
      }));
    }
    platformSelect.addEventListener("change", draw);
    metricSelect.addEventListener("change", draw);
    draw();
  }

  // --- Start ---------------------------------------------------------------------------

  async function start() {
    const note = document.getElementById("data-note");
    try {
      const [subscribers, platformRows, meta] = await Promise.all([loadJson("subscribers"), loadJson("platforms"), loadJson("meta")]);
      const platforms = Object.fromEntries(platformRows.map((p) => [p.platform_id, p.name]));
      platforms.market_total = "All of India";

      renderMarketStats(subscribers);
      renderRangeCharts(subscribers, platforms, meta.subscribers_checked);
      renderGlossary(subscribers);
      renderTable(subscribers, platforms);
      note.textContent = `${subscribers.length} subscriber figures from ${new Set(subscribers.map((r) => r.source_url)).size} sources, all checked ${formatDate(meta.subscribers_checked)}.`;
    } catch (error) {
      note.textContent = `Could not load the data: ${error.message}. If you opened this file directly, serve the folder instead: python -m http.server -d dashboard`;
      note.className = "error";
      console.error(error);
    }
  }

  start();
})();
