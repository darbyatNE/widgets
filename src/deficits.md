---
title: US Deficit Regression Trend Lines
toc: false
---

<a href="./">← Darby's Widgets</a>

<h1 class="title-row">US Deficit Regression Trend Lines
<details class="info"><summary title="About this chart" aria-label="About this chart">i</summary><div class="info-body">
<p>The same regression trend lines as the <a href="./sp500">S&amp;P 500 page</a>, applied to the federal budget from the overspending side. Data: OMB Historical Table 1.1, fiscal years 1901–2025, nominal dollars. Fiscal years ended June 30 through 1976 and September 30 since 1977.</p>
<ul>
<li><strong>Cumulative deficit (default):</strong> every deficit since 1789 added up, minus surpluses. It's a stock of borrowing that, like the index, compounds over time. It approximates debt held by the public ($27.5T at FY2025).</li>
<li><strong>Annual deficit:</strong> outlays minus receipts each year. It turns negative in surplus years, so only the Linear fit applies.</li>
<li><strong>Outlays / Receipts:</strong> total federal spending and revenue each year.</li>
<li><strong>Interest (% of GDP) / Interest payments:</strong> federal interest outlays from FRED (series FYOIGDA188S and FYOINT), FY1940–2025. These appear to be <em>gross</em> interest, including interest credited to federal trust funds, so they run higher than the <em>net</em> interest figure CBO usually quotes.</li>
</ul>
<p>Each line is a least-squares fit from its <strong>start year</strong> through FY2025. Fit types and growth math are identical to the S&amp;P page.</p>
</div></details>
</h1>

```js
import {FITS, fit as fitTo} from "./components/regression.js";
import {correlation, olsHAC, durbinWatson, engleGranger} from "./components/stats.js";

// Fiscal year-end date: June 30 through FY1976, September 30 from FY1977.
const fyEnd = (y) => (y <= 1976 ? new Date(y, 5, 30) : new Date(y, 8, 30));
const budget = (await FileAttachment("data/us_budgets.csv").csv({typed: true})).map((d) => ({...d, date: fyEnd(d.year)}));

const fmtB = (v) => (Math.abs(v) >= 1e6 ? d3.format("$,.2f")(v / 1e6) + "T" : d3.format("$,.1f")(v / 1e3) + "B");
const fmtPct = d3.format(".2%");
// get() returns the plotted value for a budget row, or null where the series has no data.
const SERIES = {
  "Cumulative deficit": {get: (d) => d.cum_deficit, positive: true, fmt: fmtB},
  "Annual deficit": {get: (d) => d.deficit, positive: false, fmt: fmtB},
  "Outlays (spending)": {get: (d) => d.outlays, positive: true, fmt: fmtB},
  "Receipts (revenue)": {get: (d) => d.receipts, positive: true, fmt: fmtB},
  "Interest (% of GDP)": {get: (d) => (d.interest_pct_gdp == null ? null : d.interest_pct_gdp / 100), positive: true, fmt: fmtPct, ratio: true},
  "Interest payments": {get: (d) => d.interest, positive: true, fmt: fmtB}
};
const seriesData = (name) =>
  budget
    .map((d) => ({year: d.year, date: d.date, close: SERIES[name].get(d)}))
    .filter((d) => d.close != null && isFinite(d.close));
const fmtG = (v) => (isFinite(v) ? d3.format(".1%")(v) : "n/a");
const fmtSlope = (v) => (isFinite(v) ? d3.format("+.2%")(v) + "/yr" : "n/a");
const MIN_POINTS = 3;
```

```js
const spec = SERIES[seriesName];
const data = seriesData(seriesName);
const endPoint = data[data.length - 1];
const model = FITS[fitType];
const fit = (points, m) => fitTo(points, m, endPoint.date);
const isCurvedRate = !(model.log && model.degree === 1);
const starts = data.map((d, i) => ({i, year: d.year, date: d.date})).filter((s) => data.length - s.i >= MIN_POINTS);
const regressions = starts.map(({i, year, date}) => {
  const pts = data.slice(i);
  const f = fit(pts, model);
  return {
    year,
    startDate: date,
    i,
    n: pts.length,
    slopePerYear: f.growthNow,
    avgGrowth: f.avgGrowth,
    r2: f.r2,
    rmsPct: f.rmsPct,
    fittedEnd: f.predict(endPoint.date),
    predict: f.predict,
    curve: pts.map((p) => ({date: p.date, value: f.predict(p.date)}))
  };
});
```

```js
const step = {"Every year": 1, "Every 5 years": 5, "Every 10 years": 10}[range.freq];
const shown = regressions.filter((r) => r.year >= range.from && r.year <= range.to && (r.year - range.from) % step === 0);
const useLogAxis = logScale && spec.positive;
const curveOf = (r) => (useLogAxis ? r.curve.filter((c) => c.value > 0) : r.curve);
const yVals = data.map((d) => d.close);

display(Plot.plot({
  width,
  height: 560,
  marginLeft: 70,
  y: {
    type: useLogAxis ? "log" : "linear",
    grid: true,
    label: seriesName,
    tickFormat: spec.fmt,
    ...(useLogAxis ? {domain: [d3.min(yVals) * 0.8, d3.max(yVals) * 1.2]} : {})
  },
  clip: true,
  x: {label: "Fiscal year"},
  color: {type: "linear", scheme: "turbo", domain: d3.extent(starts, (s) => s.year), legend: true, label: "Regression start year", tickFormat: "d"},
  marks: [
    spec.positive ? null : Plot.ruleY([0], {stroke: "#888"}),
    showActual ? Plot.lineY(data, {x: "date", y: "close", stroke: "#222", strokeWidth: 1.5}) : null,
    showActual ? Plot.dot(data, {x: "date", y: "close", fill: "#222", r: 1.5}) : null,
    ...shown.map((r) => Plot.line(curveOf(r), {x: "date", y: "value", stroke: () => r.year, strokeWidth: 1, strokeOpacity: 0.75})),
    Plot.tip(
      shown.flatMap((r) => curveOf(r).map((c) => ({...c, r}))),
      Plot.pointer({
        x: "date",
        y: "value",
        title: (d) =>
          `Start: FY${d.r.year}\nGrowth @ latest: ${fmtSlope(d.r.slopePerYear)}\nAvg growth: ${fmtSlope(d.r.avgGrowth)}\nRMS error: ${d3.format(".1%")(d.r.rmsPct)}\nFitted @ FY${endPoint.year}: ${spec.fmt(d.r.fittedEnd)}`
      })
    ),
    Plot.dot([endPoint], {x: "date", y: "close", fill: "red", r: 4, tip: true, title: (d) => `FY${d.year}: ${spec.fmt(d.close)}`})
  ]
}));
```

Latest: **FY${endPoint.year} ${seriesName.toLowerCase()} — ${spec.fmt(endPoint.close)}**

<div class="chart-controls">

```js
const seriesName = view(Inputs.radio(Object.keys(SERIES), {label: "Series", value: "Cumulative deficit"}));
```

```js
// Log fits need positive values, so the annual deficit (negative in surplus years) is linear only.
const fitType = view(Inputs.radio(
  SERIES[seriesName].positive ? Object.keys(FITS) : ["Linear"],
  {label: "Fit type", value: SERIES[seriesName].positive ? "Log-quadratic (changing growth rate)" : "Linear"}
));
const logScale = view(Inputs.toggle({label: "Log y-axis", value: true, disabled: !SERIES[seriesName].positive}));
const showActual = view(Inputs.toggle({label: "Show actual values", value: true}));
```

```js
const seriesRows = seriesData(seriesName);
const startYears = seriesRows.slice(0, seriesRows.length - MIN_POINTS + 1).map((d) => d.year);
const range = view(Inputs.form(
  {
    from: Inputs.select(startYears, {label: "First start", value: startYears[0], format: String}),
    to: Inputs.select(startYears, {label: "Last start", value: startYears[startYears.length - 1], format: String}),
    freq: Inputs.radio(["Every year", "Every 5 years", "Every 10 years"], {label: "Start", value: "Every year"})
  },
  {template: (f) => html`<div class="range-form">${f.from}${f.to}${f.freq}</div>`}
));
```

</div>

```js
display(html`<p class="range-note">${shown.length ? `${shown.length} regression line${shown.length === 1 ? "" : "s"} drawn.` : "No lines in this range. The first start must be on or before the last start."}</p>`);
```

<h2 class="title-row">Growth rates — ${seriesName}, ${fitType}
<details class="info"><summary title="About this chart" aria-label="About this chart">i</summary><div class="info-body">
<p>Annual growth rate (% per year) implied by each selected regression, plotted by its start year. Each start year has two values taken from the same trend line:</p>
<ul>
<li><strong style="color:#1f77b4">Blue: average over window.</strong> The trend line's compound annual growth rate (CAGR) from its start year to FY2025.</li>
<li><strong style="color:#d62728">Red: at latest.</strong> How steep the trend line is at FY2025, as % per year. This is the pace the trend was growing at in FY2025.</li>
</ul>
<p><strong>Red above blue</strong> means borrowing/spending growth has been speeding up. <strong>Red below blue</strong> means it has been slowing down.</p>
<p><em>Exponential</em> fits grow at a constant rate, so they show a single line. A <em>Linear</em> fit adds a fixed dollar amount per year, so its % rate falls as the level rises. Its average (CAGR) is shown only where the fitted line stays above zero.</p>
</div></details>
</h2>

```js
const gRows = shown.flatMap((r) =>
  isCurvedRate
    ? [
        {year: r.year, g: r.avgGrowth, series: "Average over window"},
        {year: r.year, g: r.slopePerYear, series: `At latest (FY${endPoint.year})`}
      ]
    : [{year: r.year, g: r.slopePerYear, series: "Constant rate"}]
).filter((d) => isFinite(d.g));
display(gRows.length ? Plot.plot({
  width,
  height: 380,
  marginLeft: 60,
  y: {grid: true, label: "Annual growth (%/yr)", tickFormat: (v) => d3.format(".0%")(v)},
  x: {label: "Regression start year", tickFormat: "d"},
  color: {legend: true, domain: [...new Set(gRows.map((d) => d.series))], range: ["#1f77b4", "#d62728"]},
  marks: [
    Plot.ruleY([0], {stroke: "#888"}),
    Plot.line(gRows, {x: "year", y: "g", stroke: "series", z: "series", strokeWidth: 1.5}),
    Plot.dot(gRows, {x: "year", y: "g", fill: "series", r: 1.5}),
    Plot.tip(gRows, Plot.pointer({x: "year", y: "g", title: (d) => `Start: FY${d.year}\n${d.series}: ${fmtG(d.g)}/yr`}))
  ]
}) : html`<p><em>No growth rates to show for this selection.</em></p>`);
```

```js
display(Inputs.table(
  shown.map((r) => ({
    "Start FY": String(r.year),
    "Years": r.n,
    "Growth @ latest": fmtSlope(r.slopePerYear),
    "Avg growth": fmtSlope(r.avgGrowth),
    "RMS error": d3.format(".1%")(r.rmsPct),
    "R²": +r.r2.toFixed(4),
    [`Fitted @ FY${endPoint.year}`]: spec.fmt(r.fittedEnd),
    "Actual vs fit": d3.format("+.1%")(endPoint.close / r.fittedEnd - 1)
  })),
  {rows: 15}
));
```

<h2 class="title-row">${cmpName} vs. S&amp;P 500 — is the relationship significant?
<details class="info"><summary title="About these tests" aria-label="About these tests">i</summary><div class="info-body">
<p>The S&amp;P 500 is sampled at each fiscal year-end (June 30 / Sept 30) and compared with the budget series chosen under <em>Compare S&amp;P 500 with</em>, over the years both exist (FY1940–FY2025 for interest, FY1928–FY2025 otherwise). Interest as a % of GDP is the default because it measures the burden of the debt relative to the economy that has to carry it.</p>
<ul>
<li><strong>Trend growth by start year:</strong> both series fit with the same model from each start year to FY2025. Matching curves mean the two trends compound at similar rates.</li>
<li><strong>Levels correlation:</strong> any two series that both grow over time correlate strongly. A Durbin-Watson statistic far below 2 means that correlation is likely spurious.</li>
<li><strong>Cointegration (Engle-Granger):</strong> tests whether the two levels share a stable long-run relationship. The statistic must be below about −3.37 for 5% significance (−3.07 for 10%).</li>
<li><strong>Annual growth correlation:</strong> compares year-over-year % changes, which removes the shared upward trend. Testing several lags makes a few p &lt; 0.05 likely by chance (a Bonferroni-adjusted cutoff is shown).</li>
<li><strong>Trend difference:</strong> regresses ln(budget) − ln(S&amp;P) on time with Newey-West standard errors, which allow for autocorrelated residuals. A slope near 0 means both grow at the same trend rate.</li>
<li><strong>Curvature:</strong> the t² coefficient of the log-quadratic fit. Significant means the trend growth rate itself has changed over time.</li>
<li><strong>Burden level → next 10-year S&amp;P return</strong> (ratio series only): does a high interest burden predict weaker stock returns over the following decade? Overlapping 10-year windows are handled with 10-lag Newey-West errors.</li>
</ul>
<p>Dollar series are nominal, so inflation is a shared driver of their long-run growth. Interest as a % of GDP is a ratio: it has no built-in upward trend, so its growth rate measures whether interest is outgrowing the economy.</p>
</div></details>
</h2>

```js
const spRaw = await FileAttachment("data/sp500_monthly.csv").text();
const spByMonth = new Map(
  d3.csvParseRows(spRaw)
    .filter((r) => r.length >= 2 && r[0])
    .map(([d, v]) => [d.slice(0, 7), +v.replace(/,/g, "")])
);
const spFY = budget
  .map((d) => ({year: d.year, date: d.date, close: spByMonth.get(d3.timeFormat("%Y-%m")(d.date))}))
  .filter((d) => isFinite(d.close));
```

```js
const cmpName = view(Inputs.select(
  Object.keys(SERIES).filter((k) => SERIES[k].positive),
  {label: "Compare S&P 500 with", value: "Interest (% of GDP)"}
));
const cmpMeasure = view(Inputs.radio(["Average over window", "At latest"], {label: "Growth measure", value: "Average over window"}));
```

```js
const overlapYears = new Set(spFY.map((d) => d.year));
const cmpSpec = SERIES[cmpName];
const bud = seriesData(cmpName).filter((d) => overlapYears.has(d.year));
const sp = spFY.filter((d) => bud.some((b) => b.year === d.year));
const canLog = cmpSpec.positive && bud.every((d) => d.close > 0);
const cmpModel = model.log ? model : FITS["Log-quadratic (changing growth rate)"];
const cmpEnd = bud[bud.length - 1].date;
// At least 10 years per fit: very short windows swing wildly and swamp the scale.
const MIN_CMP = 10;
const cmpRows = [];
for (let i = 0; i + MIN_CMP <= bud.length; i++) {
  if (!canLog) break;
  const fb = fitTo(bud.slice(i), cmpModel, cmpEnd), fs = fitTo(sp.slice(i), cmpModel, cmpEnd);
  const pick = (f) => (cmpMeasure === "At latest" ? f.growthNow : f.avgGrowth);
  cmpRows.push({year: bud[i].year, g: pick(fb), series: cmpName}, {year: sp[i].year, g: pick(fs), series: "S&P 500"});
}
display(canLog ? Plot.plot({
  width,
  height: 380,
  marginLeft: 60,
  y: {grid: true, label: `Trend growth, ${cmpMeasure.toLowerCase()} (%/yr)`, tickFormat: (v) => d3.format(".0%")(v)},
  x: {label: "Regression start year", tickFormat: "d"},
  color: {legend: true, domain: [cmpName, "S&P 500"], range: ["#e8590c", "#2b8a3e"]},
  marks: [
    Plot.ruleY([0], {stroke: "#888"}),
    Plot.line(cmpRows, {x: "year", y: "g", stroke: "series", z: "series", strokeWidth: 1.5}),
    Plot.tip(cmpRows, Plot.pointer({x: "year", y: "g", title: (d) => `Start: FY${d.year}\n${d.series}: ${fmtG(d.g)}/yr`}))
  ]
}) : html`<p><em>The comparison uses log growth, which needs positive values.</em></p>`);
display(canLog ? html`<p class="range-note">Both series use the ${cmpModel === model ? fitType : "Log-quadratic (changing growth rate)"} fit through FY${bud[bud.length - 1].year}. Start years run FY${bud[0].year}–FY${bud[bud.length - MIN_CMP].year}, so each line spans at least ${MIN_CMP} years.</p>` : "");
```

```js
const fmtP = (p) => (p < 0.001 ? "<0.001" : p.toFixed(3));
const verdict = (p, alpha = 0.05) => (p < alpha ? "Significant" : "Not significant");
let statRows = [];
if (canLog) {
  const lb = bud.map((d) => Math.log(d.close)), ls = sp.map((d) => Math.log(d.close));
  const gb = lb.slice(1).map((v, i) => v - lb[i]), gs = ls.slice(1).map((v, i) => v - ls[i]);
  const levels = olsHAC(lb.map((v) => [1, v]), ls);
  const lvlCorr = correlation(lb, ls);
  const eg = engleGranger(levels.res);
  const lagCorr = (lag) => (lag >= 0 ? correlation(gb.slice(0, gb.length - lag), gs.slice(lag)) : correlation(gb.slice(-lag), gs.slice(0, gs.length + lag)));
  const LAGS = [-2, -1, 0, 1, 2];
  const bonf = 0.05 / LAGS.length;
  const lagLabel = (l) => (l === 0 ? "same year" : l > 0 ? `${cmpName} leads S&P by ${l} yr` : `S&P leads ${cmpName} by ${-l} yr`);
  const trendDiff = (y0) => {
    const idx = bud.map((d, i) => i).filter((i) => bud[i].year >= y0);
    const r = olsHAC(idx.map((i) => [1, bud[i].year - y0]), idx.map((i) => lb[i] - ls[i]));
    return r;
  };
  const curv = (vals) => olsHAC(bud.map((d) => [1, (d.year - 1977) / 10, ((d.year - 1977) / 10) ** 2]), vals);
  const cb = curv(lb), cs = curv(ls);

  statRows = [
    {Test: `Levels correlation, ln(${cmpName}) vs ln(S&P)`, Result: `r = ${lvlCorr.r.toFixed(3)}, Durbin-Watson = ${durbinWatson(levels.res).toFixed(2)}`, "p-value": "—", Verdict: durbinWatson(levels.res) < 1 ? "Likely spurious (shared trend)" : "See cointegration"},
    {Test: "Cointegration (Engle-Granger ADF t)", Result: `t = ${eg.toFixed(2)} (5% crit ≈ −3.37, 10% ≈ −3.07)`, "p-value": eg < -3.37 ? "<0.05" : eg < -3.07 ? "0.05–0.10" : ">0.10", Verdict: eg < -3.37 ? "Significant" : eg < -3.07 ? "Weak (10% level only)" : "Not significant"},
    ...LAGS.map((l) => {
      const c = lagCorr(l);
      return {Test: `Annual growth correlation (${lagLabel(l)})`, Result: `r = ${c.r >= 0 ? "+" : ""}${c.r.toFixed(3)}, n = ${c.n}`, "p-value": fmtP(c.p), Verdict: c.p < bonf ? "Significant" : c.p < 0.05 ? `Not after Bonferroni (needs p < ${bonf})` : "Not significant"};
    }),
    ...[bud[0].year + 1, 1950, 1970, 1990, 2000].map((y0) => {
      const r = trendDiff(y0);
      return {Test: `Trend growth difference, FY${y0}–FY${bud[bud.length - 1].year}`, Result: `${cmpName} − S&P = ${d3.format("+.2f")(100 * r.beta[1])} pp/yr ± ${(196 * r.se[1]).toFixed(2)}`, "p-value": fmtP(r.p[1]), Verdict: verdict(r.p[1])};
    }),
    {Test: `Curvature (growth acceleration), ${cmpName}`, Result: `${d3.format("+.2f")(100 * 2 * cb.beta[2] / 10)} pp/yr per decade`, "p-value": fmtP(cb.p[2]), Verdict: verdict(cb.p[2])},
    {Test: "Curvature (growth acceleration), S&P 500", Result: `${d3.format("+.2f")(100 * 2 * cs.beta[2] / 10)} pp/yr per decade`, "p-value": fmtP(cs.p[2]), Verdict: verdict(cs.p[2])}
  ];
  if (cmpSpec.ratio) {
    const H = 10;
    const idx = d3.range(bud.length - H);
    const fwd = olsHAC(idx.map((i) => [1, bud[i].close * 100]), idx.map((i) => (ls[i + H] - ls[i]) / H), H);
    statRows.push({
      Test: `${cmpName} level → next ${H}-yr S&P return`,
      Result: `${d3.format("+.2f")(fwd.beta[1] * 100)} pp/yr of S&P return per 1 pp of GDP, n = ${idx.length}`,
      "p-value": fmtP(fwd.p[1]),
      Verdict: verdict(fwd.p[1])
    });
  }
}
display(canLog ? Inputs.table(statRows, {select: false, rows: statRows.length + 1, layout: "auto"}) : "");
```

<h2 class="title-row">Is the interest burden sustainable?
<details class="info"><summary title="About the projection" aria-label="About the projection">i</summary><div class="info-body">
<p>A standard debt-dynamics projection, starting from FY2025 actuals in this data set:</p>
<ul>
<li><strong>Debt</strong> (the cumulative deficit as a % of GDP) each year = last year's debt ÷ (1 + GDP growth) + interest + primary deficit.</li>
<li><strong>Interest</strong> = the effective interest rate × last year's debt ÷ (1 + GDP growth).</li>
<li><strong>Primary deficit</strong> is the deficit excluding interest. It's held at the chosen % of GDP, and receipts stay at their FY2025 share of GDP for the "% of revenue" columns.</li>
</ul>
<p>The key condition: if the interest rate <em>r</em> exceeds nominal GDP growth <em>g</em>, debt compounds faster than the economy even with a balanced primary budget. If <em>r</em> &lt; <em>g</em>, a modest primary deficit can be stable.</p>
<p>The dashed grey lines simply extend the exponential trend of interest % of GDP fitted from FY2000 and from FY2010. They are a mechanical extrapolation, not a forecast.</p>
<p>Caveats: the interest series appears to be gross interest (including trust-fund interest). The cumulative deficit understates actual debt (it excludes off-budget borrowing and trust-fund holdings), so the effective rate here is interest ÷ that proxy. Treat the crossing years as orders of magnitude, not dates.</p>
</div></details>
</h2>

```js
const last = budget[budget.length - 1], prev = budget[budget.length - 2];
const base = {
  year: last.year,
  debt: last.cum_deficit / last.gdp,
  interest: last.interest_pct_gdp / 100,
  r: last.interest / prev.cum_deficit,
  primary: (last.deficit - last.interest) / last.gdp,
  receipts: last.receipts / last.gdp
};
const HORIZON = 2075;
function project({r, g, primary}) {
  const rows = [];
  let d = base.debt;
  for (let y = base.year + 1; y <= HORIZON; y++) {
    const i = (r * d) / (1 + g);
    d = d / (1 + g) + i + primary;
    rows.push({year: y, interest: i, debt: d, share: i / base.receipts});
  }
  return rows;
}
const crossYear = (rows, key, level) => String(rows.find((x) => x[key] >= level)?.year ?? `after ${HORIZON}`);
```

<div class="chart-controls">

```js
const scenPct = view(Inputs.form(
  {
    r: Inputs.range([1, 8], {label: "Interest rate on debt (%)", step: 0.1, value: Math.round(base.r * 1000) / 10}),
    g: Inputs.range([1, 8], {label: "Nominal GDP growth (%)", step: 0.1, value: 4}),
    primary: Inputs.range([-3, 6], {label: "Primary deficit (% of GDP)", step: 0.1, value: Math.round(base.primary * 1000) / 10})
  },
  {template: (f) => html`<div class="range-form">${f.r}${f.g}${f.primary}</div>`}
));
```

</div>

```js
const SCENARIOS = [
  {name: "Your scenario", r: scenPct.r / 100, g: scenPct.g / 100, primary: scenPct.primary / 100},
  {name: `Status quo (r ${d3.format(".1%")(base.r)}, g 4%)`, r: base.r, g: 0.04, primary: base.primary},
  {name: "Rates ease (r 3.5%)", r: 0.035, g: 0.04, primary: base.primary},
  {name: "Rates rise (r 5.5%)", r: 0.055, g: 0.04, primary: base.primary},
  {name: "Primary balance (0% GDP)", r: base.r, g: 0.04, primary: 0},
  {name: "Faster growth (g 5%)", r: base.r, g: 0.05, primary: base.primary}
].map((s) => ({...s, rows: project(s)}));
const histI = seriesData("Interest (% of GDP)");
const trendRows = [2000, 2010].flatMap((y0) => {
  const f = fitTo(histI.filter((d) => d.year >= y0), FITS["Exponential (log-linear)"], histI[histI.length - 1].date);
  return d3.range(base.year, HORIZON + 1).map((y) => ({year: y, interest: f.predict(fyEnd(y)), series: `Trend since FY${y0} (${d3.format("+.1%")(f.growthNow)}/yr)`}));
});
const projRows = SCENARIOS.flatMap((s) => [{year: base.year, interest: base.interest, series: s.name}, ...s.rows.map((x) => ({...x, series: s.name}))]);
const yMax = Math.min(0.12, d3.max([...projRows, ...trendRows], (d) => d.interest) * 1.05);
const names = SCENARIOS.map((s) => s.name);
display(Plot.plot({
  width,
  height: 440,
  marginLeft: 60,
  y: {grid: true, label: "Interest (% of GDP)", domain: [0, yMax], tickFormat: (v) => d3.format(".0%")(v)},
  x: {label: "Fiscal year", tickFormat: "d"},
  color: {legend: true, domain: ["Actual", ...names], range: ["#222", "#d62728", "#e8590c", "#2b8a3e", "#7048e8", "#1971c2", "#0c8599"]},
  marks: [
    Plot.ruleY([0.05], {stroke: "#d62728", strokeDasharray: "2,3"}),
    Plot.text([{year: 1942, y: 0.05}], {x: "year", y: "y", text: () => `5% of GDP ≈ ${d3.format(".0%")(0.05 / base.receipts)} of revenue`, dy: -7, textAnchor: "start", fill: "#d62728"}),
    Plot.ruleX([base.year], {stroke: "#aaa"}),
    Plot.line(trendRows.filter((d) => d.interest <= yMax), {x: "year", y: "interest", z: "series", stroke: "#999", strokeDasharray: "5,4"}),
    Plot.text(trendRows.filter((d) => d.interest <= yMax && d.year === Math.min(HORIZON, d3.max(trendRows.filter((t) => t.series === d.series && t.interest <= yMax), (t) => t.year))), {x: "year", y: "interest", text: "series", textAnchor: "end", dy: -6, fill: "#777", fontSize: 10}),
    Plot.line(histI, {x: "year", y: "close", stroke: () => "Actual", strokeWidth: 2}),
    Plot.line(projRows.filter((d) => d.interest <= yMax), {x: "year", y: "interest", stroke: "series", z: "series", strokeWidth: (d) => (d.series === "Your scenario" ? 3 : 1.5), strokeDasharray: (d) => (d.series === "Your scenario" ? null : "6,3")}),
    Plot.tip([...histI.map((d) => ({year: d.year, interest: d.close, series: "Actual"})), ...projRows.filter((d) => d.interest <= yMax)], Plot.pointer({x: "year", y: "interest", title: (d) => `FY${d.year} — ${d.series}\nInterest: ${d3.format(".2%")(d.interest)} of GDP` + (d.debt ? `\nDebt: ${d3.format(".0%")(d.debt)} of GDP\nInterest/revenue: ${d3.format(".0%")(d.share)}` : "")}))
  ]
}));
const at = (rows, y, k) => d3.format(k === "debt" ? ".0%" : ".2%")(rows.find((x) => x.year === y)[k]);
display(Inputs.table(SCENARIOS.map((s) => ({
  Scenario: s.name,
  "r − g": d3.format("+.1f")(100 * (s.r - s.g)) + " pp",
  "Interest 2035": at(s.rows, 2035, "interest"),
  "Interest 2050": at(s.rows, 2050, "interest"),
  "Debt 2050": at(s.rows, 2050, "debt"),
  "Interest ≥ 5% GDP": crossYear(s.rows, "interest", 0.05),
  "≥ 6% GDP": crossYear(s.rows, "interest", 0.06),
  "≥ 30% of revenue": crossYear(s.rows, "share", 0.3),
  "≥ 40% of revenue": crossYear(s.rows, "share", 0.4)
})), {select: false, rows: SCENARIOS.length + 1, layout: "auto"}));
display(html`<p class="range-note">FY${base.year} starting point: interest ${d3.format(".2%")(base.interest)} of GDP (a record; the prior peak was 3.16% in FY1991), ${d3.format(".0%")(last.interest / last.receipts)} of revenue; debt proxy ${d3.format(".0%")(base.debt)} of GDP; effective rate ${d3.format(".2%")(base.r)}; primary deficit ${d3.format(".1%")(base.primary)} of GDP; receipts ${d3.format(".1%")(base.receipts)} of GDP.</p>`);
```

### Conclusions — interest burden vs. S&P 500 (FY1940–FY2025)

1. **No statistical link to stock returns.** Year-to-year changes in interest as a % of GDP are uncorrelated with S&P 500 returns at every lag from −2 to +2 years (r between 0.00 and +0.16, all p > 0.14). The burden level doesn't significantly predict the next 10 years of S&P returns either (p ≈ 0.2, with a slightly *positive* sign). Historically the market hasn't priced the interest burden in any detectable way.
2. **The trends diverge sharply.** Over the whole period, interest % of GDP grew about 1%/yr while the S&P compounded at about 7.5%/yr. Interest roughly tracked the economy until 2000 and actually fell from 1980 to 2000. Since FY2010, though, it has grown about **+7.7%/yr faster than GDP** (±2.3 pp), and since FY2000 about +3.4%/yr. That kind of acceleration can't continue indefinitely for a ratio to GDP.
3. **The burden is at a record.** FY2025 interest is 3.94% of GDP and about 23% of revenue, above the 1991 peak of 3.16%.
4. **Sustainability verdict: not sustainable on the current path.** With today's effective rate (~4.7%), nominal growth of ~4% and a primary deficit of ~1.8% of GDP, *r* > *g* and the debt ratio keeps rising (to ~155% of GDP by 2050). Interest crosses **5% of GDP around 2035** (≈ 30% of revenue) and **6% around 2043**. The recent trend lines point sooner (5% by about 2029–2032), while easing rates (3.5%) push the 5% mark out to the 2070s. Rising rates (5.5%) bring it to about 2028.
5. **What would stabilize it:** only *r* ≤ *g* plus a small primary deficit, or a primary *surplus* while *r* > *g*. Closing the primary deficit to zero slows the climb a lot (4.3% of GDP in 2035, 4.8% in 2050, debt about 106%), but 5% still arrives around 2057. Faster growth alone (5%) delays the 5% crossing to about 2041.

**Bottom line:** interest costs and stock prices have moved independently, so the S&P chart offers no early warning. The arithmetic of debt does: unless rates fall below growth or the primary deficit closes, interest becomes the dominant budget pressure within roughly **10–20 years** (mid-2030s to mid-2040s), with a realistic range of about 2028–2075 depending mainly on interest rates.

<details class="earlier"><summary>Earlier findings: cumulative deficit vs. S&amp;P 500 (FY1928–FY2025)</summary>


1. **Same long-run trend rate.** Fit from 1929, 1950, 1970 or 1990, the cumulative deficit and the S&P 500 both compound at roughly **7–8% a year**, and the gap is statistically indistinguishable from zero (p ≈ 0.4–0.97). Both are nominal-dollar series driven largely by nominal GDP growth (real growth plus inflation), so this is a shared driver, not evidence that one causes the other.
2. **Since 2000 they diverge.** From FY2000 the cumulative deficit's trend (~9.5%/yr) has outpaced the S&P's (~7.4%/yr) by about 2 pp a year. That difference is significant at the 5% level (p ≈ 0.03), though 26 years is a short sample for a volatile index.
3. **The high levels correlation (r ≈ 0.96) is mostly spurious.** The Durbin-Watson statistic (≈ 0.2) shows the residuals are highly persistent, the classic sign of two trending series that would correlate regardless of any link. Cointegration is borderline: significant only at the 10% level, so the evidence for a stable long-run relationship is weak.
4. **Year-to-year movements are essentially unrelated.** Same-year growth rates are uncorrelated (r ≈ +0.09, p ≈ 0.4). Small lead/lag correlations appear (deficit growth tends to follow weak markets and precede strong ones), with individual p ≈ 0.02–0.03, but none survive a correction for testing five lags.
5. **The shapes differ.** The S&P's log-quadratic curvature is significant (its trend growth rate has risen over the century), while the cumulative deficit's is not (steady compounding with wartime and crisis bursts).

**Bottom line:** the two charts look alike because both compound with the nominal economy, at nearly the same long-run rate. There's no statistically robust evidence that deficits and stock returns move together year to year. The one significant divergence is the post-2000 period, when borrowing has grown faster than the market. Choose another series above to rerun the tests live.

</details>

<style>
.title-row { display: flex; align-items: center; gap: .5rem; flex-wrap: wrap; position: relative; max-width: none; }
details.info { display: inline-block; font-size: 1rem; font-weight: normal; }
details.info > summary {
  list-style: none; cursor: pointer; display: inline-flex; align-items: center; justify-content: center;
  width: 1.4rem; height: 1.4rem; border-radius: 50%; border: 1.5px solid var(--theme-foreground-focus);
  color: var(--theme-foreground-focus); font: italic 600 .9rem/1 Georgia, serif; user-select: none;
}
details.info > summary::-webkit-details-marker { display: none; }
details.info[open] > summary { background: var(--theme-foreground-focus); color: var(--theme-background); }
details.info .info-body {
  position: absolute; z-index: 10; top: calc(100% + .4rem); left: 0; width: min(680px, 100%); box-sizing: border-box;
  padding: .25rem 1rem; background: var(--theme-background-alt); border: 1px solid var(--theme-foreground-faintest);
  border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,.18); line-height: 1.5;
}
details.info .info-body p, details.info .info-body ul { max-width: none; }
.chart-controls { margin-top: 1rem; }
.range-form { display: flex; flex-direction: column; gap: .25rem; }
.range-note { color: var(--theme-foreground-muted); margin: .25rem 0 0; }
details.earlier { margin-top: 1.5rem; }
details.earlier > summary { cursor: pointer; font-weight: 600; }
</style>
