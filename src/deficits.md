---
title: US Deficit Regression Trend Lines
toc: false
---

<link rel="stylesheet" href="./components/table-dialog.css">
<link rel="stylesheet" href="./components/workspace.css">

<div class="workspace" data-view="trend">

<header class="ws-head">
<div class="ws-title">
<div class="ws-back"><a href="./">← Darby's Widgets</a></div>

<h1 class="title-row">US Deficit Regression Trend Lines
<details class="info"><summary title="About this chart" aria-label="About this chart">i</summary><div class="info-body">
<p>The same regression trend lines as the <a href="./sp500">S&amp;P 500 page</a>, applied to the federal budget from the overspending side. Data: OMB Historical Table 1.1, fiscal years 1901–2025, nominal dollars. Fiscal years ended June 30 through 1976 and September 30 since 1977.</p>
<ul>
<li><strong>Cumulative deficit (default):</strong> every deficit since 1789 added up, minus surpluses. It's a stock of borrowing that, like the index, compounds over time. It approximates debt held by the public ($27.5T at FY2025).</li>
<li><strong>Annual deficit:</strong> outlays minus receipts each year. It turns negative in surplus years, so only the Linear fit applies.</li>
<li><strong>Outlays / Receipts:</strong> total federal spending and revenue each year.</li>
<li><strong>Interest (% of GDP) / Interest payments:</strong> two measures, chosen with <em>Interest measure</em>:
<ul>
<li><strong>Total deficit × Fed rate (default):</strong> the prior fiscal year-end cumulative deficit times that fiscal year's average effective Fed funds rate (FRED FEDFUNDS; the 3-month T-bill rate, TB3MS, before FY1955). It prices the whole stock of borrowing at the policy rate, so it moves with the Fed. FY1935–2025 in dollars, FY1940–2025 as a % of GDP.</li>
<li><strong>Actual outlays (FRED):</strong> federal interest actually paid (FRED FYOINT and FYOIGDA188S), FY1940–2025. That reflects the rates locked in when each bond was issued, so it lags the Fed. It appears to be <em>gross</em> interest, including interest credited to federal trust funds.</li>
</ul></li>
</ul>
<p>Each line is a least-squares fit from its <strong>start year</strong> through FY2025. Fit types and growth math are identical to the S&amp;P page.</p>
</div></details>
</h1>
</div>
<div class="ws-nav">

```js
import {viewTabs, observeViewport, chartSize} from "./components/workspace.js";
const vp = Generators.observe(observeViewport);
display(viewTabs([
  {id: "trend", label: "Trend lines"},
  {id: "growth", label: "Growth rates"},
  {id: "compare", label: "S&P comparison"},
  {id: "sustain", label: "Sustainability"},
  {id: "conclusions", label: "Conclusions"}
], {label: "Budget views", invalidation}));
```

</div>
</header>

```js
import {FITS, fit as fitTo} from "./components/regression.js";
import {correlation, olsHAC, durbinWatson, engleGranger} from "./components/stats.js";

// Fiscal year-end date: June 30 through FY1976, September 30 from FY1977.
const fyEnd = (y) => (y <= 1976 ? new Date(y, 5, 30) : new Date(y, 8, 30));
const budget = (await FileAttachment("data/us_budgets.csv").csv({typed: true})).map((d) => ({...d, date: fyEnd(d.year)}));

const fmtB = (v) => (Math.abs(v) >= 1e6 ? d3.format("$,.2f")(v / 1e6) + "T" : d3.format("$,.1f")(v / 1e3) + "B");
const fmtPct = d3.format(".2%");
// Interest measures: "model" = prior cumulative deficit × Fed rate; "actual" = FRED interest outlays.
const MEASURES = {"Total deficit × Fed rate": "model", "Actual outlays (FRED)": "actual"};
const pct = (v) => (v == null ? null : v / 100);
// get(row, measure) returns the plotted value, or null where the series has no data.
const SERIES = {
  "Cumulative deficit": {get: (d) => d.cum_deficit, positive: true, fmt: fmtB},
  "Annual deficit": {get: (d) => d.deficit, positive: false, fmt: fmtB},
  "Outlays (spending)": {get: (d) => d.outlays, positive: true, fmt: fmtB},
  "Receipts (revenue)": {get: (d) => d.receipts, positive: true, fmt: fmtB},
  "Interest (% of GDP)": {get: (d, m) => pct(m === "actual" ? d.interest_pct_gdp : d.model_interest_pct_gdp), positive: true, fmt: fmtPct, ratio: true, interest: true},
  "Interest payments": {get: (d, m) => (m === "actual" ? d.interest : d.model_interest), positive: true, fmt: fmtB, interest: true}
};
const seriesData = (name, measure) =>
  budget
    .map((d) => ({year: d.year, date: d.date, close: SERIES[name].get(d, measure)}))
    .filter((d) => d.close != null && isFinite(d.close));
const fmtG = (v) => (isFinite(v) ? d3.format(".1%")(v) : "n/a");
const fmtSlope = (v) => (isFinite(v) ? d3.format("+.2%")(v) + "/yr" : "n/a");
const MIN_POINTS = 3;
```

```js
const spec = SERIES[seriesName];
const data = seriesData(seriesName, interestMeasure);
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
```

<div class="ws-body">

<aside class="ws-rail" aria-label="Trend line inputs">

```js
const seriesName = view(Inputs.radio(Object.keys(SERIES), {label: "Series", value: "Cumulative deficit"}));
```

```js
const interestInput = Inputs.select(Object.keys(MEASURES), {label: "Interest measure", value: "Total deficit × Fed rate"});
const interestMeasureLabel = view(interestInput);
```

```js
const interestMeasure = MEASURES[interestMeasureLabel];
const bindMeasure = () => Inputs.bind(Inputs.select(Object.keys(MEASURES), {label: "Interest measure"}), interestInput);
```

```js
// Log fits need positive values, so the annual deficit (negative in surplus years) is linear only.
const fitType = view(Inputs.radio(
  SERIES[seriesName].positive ? Object.keys(FITS) : ["Linear"],
  {label: "Fit type", value: SERIES[seriesName].positive ? "Exponential (log-linear)" : "Linear"}
));
```

```js
const seriesRows = seriesData(seriesName, interestMeasure);
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

```js
display(html`<p class="range-note">${shown.length ? `${shown.length} regression line${shown.length === 1 ? "" : "s"} drawn.` : "No lines in this range. The first start must be on or before the last start."}</p>`);
```

</aside>

<section class="view-panel" id="panel-trend" role="tabpanel" aria-labelledby="tab-trend">

<div class="ws-bar">

```js
const logScale = view(Inputs.toggle({label: "Log y-axis", value: true, disabled: !SERIES[seriesName].positive}));
const showActual = view(Inputs.toggle({label: "Show actual values", value: true}));
```

<span>Latest: **FY${endPoint.year} ${seriesName.toLowerCase()} — ${spec.fmt(endPoint.close)}**</span>

</div>

```js
const trendSize = chartSize(vp, width, {rail: true, reserve: 187, min: 260, mobile: 380});
display(Plot.plot({
  width: trendSize.width,
  height: trendSize.height,
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

</section>

<section class="view-panel" id="panel-growth" role="tabpanel" aria-labelledby="tab-growth" hidden>

<div class="ws-bar">

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
import {tableDialog} from "./components/table-dialog.js";
const returnDetails = tableDialog({id: "return-details", title: "Return details", label: "View return details"});
display(returnDetails.element);
invalidation.then(() => returnDetails.dialog.close());
```

</div>

```js
const growthSize = chartSize(vp, width, {rail: true, reserve: 177, min: 240, mobile: 340});
const gRows = shown.flatMap((r) =>
  isCurvedRate
    ? [
        {year: r.year, g: r.avgGrowth, series: "Average over window"},
        {year: r.year, g: r.slopePerYear, series: `At latest (FY${endPoint.year})`}
      ]
    : [{year: r.year, g: r.slopePerYear, series: "Constant rate"}]
).filter((d) => isFinite(d.g));
display(gRows.length ? Plot.plot({
  width: growthSize.width,
  height: growthSize.height,
  marginLeft: 60,
  y: {grid: true, label: "Annual growth (%/yr)", tickFormat: (v) => d3.format(".1%")(v)},
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

</section>

```js
returnDetails.content.replaceChildren(Inputs.table(
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
  {rows: 15, layout: "auto"}
));
```

<section class="view-panel" id="panel-compare" role="tabpanel" aria-labelledby="tab-compare" hidden>

<div class="ws-bar">

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
const cmpName = view(Inputs.select(
  Object.keys(SERIES).filter((k) => SERIES[k].positive),
  {label: "Compare S&P 500 with", value: "Interest (% of GDP)"}
));
const cmpMeasure = view(Inputs.radio(["Average over window", "At latest"], {label: "Growth measure", value: "Average over window"}));
display(bindMeasure());
```

```js
const statisticalTests = tableDialog({id: "statistical-tests", title: "Statistical tests", label: "View statistical tests"});
display(statisticalTests.element);
invalidation.then(() => statisticalTests.dialog.close());
```

<button type="button" data-goto="trend" title="The fit type is set in the Trend lines view">Fit: change in Trend lines</button>

</div>

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
const overlapYears = new Set(spFY.map((d) => d.year));
const cmpSpec = SERIES[cmpName];
const bud = seriesData(cmpName, interestMeasure).filter((d) => overlapYears.has(d.year));
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
const cmpSize = chartSize(vp, width, {reserve: 238, min: 240, mobile: 340});
display(canLog ? Plot.plot({
  width: cmpSize.width,
  height: cmpSize.height,
  marginLeft: 60,
  y: {grid: true, label: `Trend growth, ${cmpMeasure.toLowerCase()} (%/yr)`, tickFormat: (v) => d3.format(".1%")(v)},
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
statisticalTests.content.replaceChildren(canLog
  ? Inputs.table(statRows, {select: false, rows: statRows.length + 1, layout: "auto"})
  : html`<p>The statistical tests require positive values for log growth.</p>`);
```

</section>

<section class="view-panel" id="panel-sustain" role="tabpanel" aria-labelledby="tab-sustain" hidden>

<div class="ws-bar">

<h2 class="title-row">Is the interest burden sustainable?
<details class="info"><summary title="About the projection" aria-label="About the projection">i</summary><div class="info-body">
<p>A standard debt-dynamics projection, starting from FY2025 actuals in this data set:</p>
<ul>
<li><strong>Debt</strong> (the cumulative deficit as a % of GDP) each year = last year's debt ÷ (1 + GDP growth) + interest + primary deficit.</li>
<li><strong>Interest</strong> = the interest rate × last year's debt ÷ (1 + GDP growth). With <em>Total deficit × Fed rate</em> this is exactly how the historical line is built, and the starting rate is the FY2025 average Fed funds rate. With <em>Actual outlays</em>, the starting rate is FY2025 interest paid ÷ the FY2024 cumulative deficit.</li>
<li><strong>Primary deficit</strong> is the deficit excluding actual interest paid (the same under both measures). It's held at the chosen % of GDP, and receipts stay at their FY2025 share of GDP for the "% of revenue" columns.</li>
</ul>
<p>The key condition: if the interest rate <em>r</em> exceeds nominal GDP growth <em>g</em>, debt compounds faster than the economy even with a balanced primary budget. If <em>r</em> &lt; <em>g</em>, a modest primary deficit can be stable.</p>
<p>The chart shows only your scenario (the red line), set with the inputs on the left. The defaults are r 4.7%, g 3.5% and a primary deficit of 2.5% of GDP. The preset scenarios (status quo, rates ease/rise, primary balance, faster growth) are compared in <em>View scenario details</em>.</p>
<p>Caveats: actual outlays appear to be gross interest (including trust-fund interest). The Fed-rate measure assumes all debt reprices at the policy rate every year, while real debt reprices over several years. The cumulative deficit understates actual debt (it excludes off-budget borrowing and trust-fund holdings), so the effective rate here is interest ÷ that proxy. Treat the crossing years as orders of magnitude, not dates.</p>
</div></details>
</h2>

```js
const scenarioDetails = tableDialog({id: "scenario-details", title: "Scenario details", label: "View scenario details"});
display(scenarioDetails.element);
invalidation.then(() => scenarioDetails.dialog.close());
```

</div>

<div class="ws-split">

<aside class="ws-side" aria-label="Scenario inputs">

```js
display(bindMeasure());
```

```js
const last = budget[budget.length - 1], prev = budget[budget.length - 2];
const isModel = interestMeasure === "model";
const histI = seriesData("Interest (% of GDP)", interestMeasure);
const base = {
  year: last.year,
  debt: last.cum_deficit / last.gdp,
  interest: histI[histI.length - 1].close,
  r: isModel ? last.fed_rate / 100 : last.interest / prev.cum_deficit,
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

```js
const scenPct = view(Inputs.form(
  {
    r: Inputs.range([1, 8], {label: "Interest rate on debt (%)", step: 0.1, value: 4.7}),
    g: Inputs.range([1, 8], {label: "Nominal GDP growth (%)", step: 0.1, value: 3.5}),
    primary: Inputs.range([-3, 6], {label: "Primary deficit (% of GDP)", step: 0.1, value: 2.5})
  },
  {template: (f) => html`<div class="range-form">${f.r}${f.g}${f.primary}</div>`}
));
```

```js
const priorPeak = d3.greatest(histI.slice(0, -1), (d) => d.close);
const peakNote = base.interest > priorPeak.close
  ? `a record; the prior peak was ${d3.format(".2%")(priorPeak.close)} in FY${priorPeak.year}`
  : `the peak was ${d3.format(".2%")(priorPeak.close)} in FY${priorPeak.year}`;
display(html`<p class="range-note">FY${base.year} starting point (${isModel ? "total deficit × Fed rate" : "actual interest outlays"}): interest ${d3.format(".2%")(base.interest)} of GDP (${peakNote}), ${d3.format(".0%")(base.interest / base.receipts)} of revenue; debt proxy ${d3.format(".0%")(base.debt)} of GDP; ${isModel ? "Fed funds rate" : "effective rate"} ${d3.format(".2%")(base.r)}; primary deficit ${d3.format(".1%")(base.primary)} of GDP; receipts ${d3.format(".1%")(base.receipts)} of GDP.</p>`);
```

```js
const RATIO_BANDS = [
  {lo: 0, hi: 0.10, ratio: "Below 10%", status: "Comfort zone / low risk", context: html`Standard level during low-interest regimes. Minimal strain on the primary budget.`},
  {lo: 0.14, hi: 0.15, ratio: "14% – 15%", status: "Historical warning threshold", context: html`This was the peak reached in the <strong>early 1990s</strong> (specifically 1991), which prompted major bipartisan deficit-reduction efforts (e.g., Budget Enforcement Act).`},
  {lo: 0.15, hi: 0.20, ratio: "15% – 20%", status: `Severe "crowding out" zone`, context: html`<strong>Current position (~18.5%–19%).</strong> At this level, interest servicing becomes one of the largest single budget items, surpassing defense and discretionary programs.`},
  {lo: 0.20, hi: 0.25, ratio: "Above 20%", status: "Red flag / structural danger", context: html`Crossing 20% signals that 1 out of every 5 dollars collected in taxes pays for past debt rather than current public goods, raising severe fiscal sustainability questions.`},
  {lo: 0.25, hi: Infinity, ratio: "25%+", status: "Fiscal crisis risk / rating downgrade", context: html`Sovereign credit rating agencies view 25%+ as a trigger for systematic downgrades and potential debt-trap dynamics without severe fiscal adjustment.`}
];
const CRISIS = 0.25;
const nowShare = base.interest / base.receipts;
const nowBand = RATIO_BANDS.findLast((b) => nowShare >= b.lo);
const histShare = budget.filter((d) => d.receipts > 0).map((d) => ({year: d.year, share: (isModel ? d.model_interest : d.interest) / d.receipts})).filter((d) => d.share > 0);
const firstCrisis = histShare.find((d) => d.share >= CRISIS);
const crisisYear = (name) => crossYear(SCENARIOS.find((s) => s.name.startsWith(name)).rows, "share", CRISIS);
const thresholdDetails = tableDialog({id: "threshold-details", title: "Interest ÷ revenue thresholds", label: "Threshold details"});
thresholdDetails.content.replaceChildren(html`<table class="ratio-detail">
  <thead><tr><th>Ratio (Interest / Revenue)</th><th>Status / Meaning</th><th>Historical & Practical Context</th></tr></thead>
  <tbody>${RATIO_BANDS.map((b) => html`<tr class=${b === nowBand ? "now" : ""}><td><strong>${b.ratio}</strong></td><td><strong>${b.status}</strong></td><td>${b.context}</td></tr>`)}</tbody>
</table>
<p class="range-note">This page's FY${base.year} ratio is ${d3.format(".1%")(nowShare)} (${isModel ? "total deficit × Fed rate" : "actual interest outlays"} ÷ receipts). The ~18.5–19% "current position" refers to net interest, which excludes interest paid to federal trust funds; the actual-outlays series here is closer to gross interest, so it runs higher.</p>`);
invalidation.then(() => thresholdDetails.dialog.close());
display(html`<div class="ratio-guide">
  <h3>Interest ÷ revenue risk bands</h3>
  <table class="ratio-table"><tbody>${RATIO_BANDS.map((b) => html`<tr class=${b === nowBand ? "now" : ""}><td>${b.ratio}</td><td>${b.status}${b === nowBand ? html` <span class="here">◀ FY${base.year}: ${d3.format(".0%")(nowShare)}</span>` : ""}</td></tr>`)}</tbody></table>
  <p class="crisis-note"><strong>Entering 25% crisis mode:</strong> your scenario <strong>${crisisYear("Your scenario")}</strong>; status quo <strong>${crisisYear("Status quo")}</strong>; rates rise ${crisisYear("Rates rise")}; rates ease ${crisisYear("Rates ease")}.${firstCrisis ? html` History: first reached in FY${firstCrisis.year} (${d3.format(".1%")(firstCrisis.share)}).` : ""}</p>
  ${thresholdDetails.element}
</div>`);
```

</aside>

<div class="ws-main">

```js
const SCENARIOS = [
  {name: "Your scenario", r: scenPct.r / 100, g: scenPct.g / 100, primary: scenPct.primary / 100},
  {name: `Status quo (r ${d3.format(".1%")(base.r)}, g 4%)`, r: base.r, g: 0.04, primary: base.primary},
  {name: "Rates ease (r 3.5%)", r: 0.035, g: 0.04, primary: base.primary},
  {name: "Rates rise (r 5.5%)", r: 0.055, g: 0.04, primary: base.primary},
  {name: "Primary balance (0% GDP)", r: base.r, g: 0.04, primary: 0},
  {name: "Faster growth (g 5%)", r: base.r, g: 0.05, primary: base.primary}
].map((s) => ({...s, rows: project(s)}));
const projRows = SCENARIOS.filter((s) => s.name === "Your scenario").flatMap((s) => [{year: base.year, interest: base.interest, series: s.name}, ...s.rows.map((x) => ({...x, series: s.name}))]);
const yMax = Math.min(0.25, Math.max(d3.max(projRows, (d) => d.interest), d3.max(histI, (d) => d.close), 0.06) * 1.05);
const names = ["Your scenario"];
```

```js
const sustainSize = chartSize(vp, width, {rail: true, reserve: 150, min: 260, mobile: 400});
display(Plot.plot({
  width: sustainSize.width,
  height: sustainSize.height,
  marginLeft: 60,
  y: {grid: true, label: "Interest (% of GDP)", domain: [0, yMax], tickFormat: (v) => d3.format(".1%")(v)},
  x: {label: "Fiscal year", tickFormat: "d"},
  color: {legend: true, domain: ["History", ...names], range: ["#222", "#d62728"]},
  marks: [
    Plot.ruleY([0.05], {stroke: "#d62728", strokeDasharray: "2,3"}),
    Plot.text([{year: 1942, y: 0.05}], {x: "year", y: "y", text: () => `5% of GDP ≈ ${d3.format(".0%")(0.05 / base.receipts)} of revenue`, dy: -7, textAnchor: "start", fill: "#d62728"}),
    Plot.ruleY([0.25 * base.receipts], {stroke: "#9c36b5", strokeDasharray: "6,3"}),
    Plot.text([{year: 1942, y: 0.25 * base.receipts}], {x: "year", y: "y", text: () => `25% of revenue (crisis risk) ≈ ${d3.format(".2%")(0.25 * base.receipts)} of GDP`, dy: 9, textAnchor: "start", fill: "#9c36b5"}),
    Plot.ruleX([base.year], {stroke: "#aaa"}),
    Plot.line(histI, {x: "year", y: "close", stroke: () => "History", strokeWidth: 2}),
    Plot.line(projRows.filter((d) => d.interest <= yMax), {x: "year", y: "interest", stroke: "series", z: "series", strokeWidth: 3}),
    Plot.tip([...histI.map((d) => ({year: d.year, interest: d.close, series: "History"})), ...projRows.filter((d) => d.interest <= yMax)], Plot.pointer({x: "year", y: "interest", title: (d) => `FY${d.year} — ${d.series}\nInterest: ${d3.format(".2%")(d.interest)} of GDP` + (d.debt ? `\nDebt: ${d3.format(".0%")(d.debt)} of GDP\nInterest/revenue: ${d3.format(".0%")(d.share)}` : "")}))
  ]
}));
```

</div>

</div>

</section>

```js
const at = (rows, y, k) => d3.format(k === "debt" ? ".0%" : ".2%")(rows.find((x) => x.year === y)[k]);
scenarioDetails.content.replaceChildren(Inputs.table(SCENARIOS.map((s) => ({
  Scenario: s.name,
  "r − g": d3.format("+.1f")(100 * (s.r - s.g)) + " pp",
  "Interest 2035": at(s.rows, 2035, "interest"),
  "Interest 2050": at(s.rows, 2050, "interest"),
  "Debt 2050": at(s.rows, 2050, "debt"),
  "Interest ≥ 5% GDP": crossYear(s.rows, "interest", 0.05),
  "≥ 6% GDP": crossYear(s.rows, "interest", 0.06),
  "≥ 25% of revenue": crossYear(s.rows, "share", 0.25),
  "≥ 30% of revenue": crossYear(s.rows, "share", 0.3),
  "≥ 40% of revenue": crossYear(s.rows, "share", 0.4)
})), {select: false, rows: SCENARIOS.length + 1, layout: "auto"}));
```

<section class="view-panel" id="panel-conclusions" role="tabpanel" aria-labelledby="tab-conclusions" hidden>

<div class="conclusions" role="region" aria-label="Conclusions" tabindex="0">

### Conclusions — interest burden vs. S&P 500 (FY1940–FY2025)

Interest here is the default measure: **prior-year total (cumulative) deficit × the fiscal-year average Fed funds rate** (3-month T-bill before FY1955).

1. **No statistical link to stock returns.** Year-to-year changes in the interest burden are uncorrelated with S&P 500 returns at every lag from −2 to +2 years (r between −0.05 and +0.19, all p > 0.08). The burden level doesn't predict the next 10 years of S&P returns either (+0.13 pp/yr per 1 pp of GDP, p ≈ 0.9). The market hasn't priced the interest burden in any detectable way, under either measure.
2. **The burden follows the Fed.** Priced at the policy rate, interest was 3.85% of GDP in FY1981 (Fed funds ~17%), fell to almost nothing in FY2009–2021 (0.05% in FY2014, 0.06% in FY2021), then jumped to a **record 4.33% of GDP in FY2024** as rates reached 5.3% on a much larger debt. It eased to 3.68% in FY2025 as the Fed cut. Its long-run trend (+1.6%/yr since FY2000) is far below the S&P's, and the post-2010 trend (+33%/yr) is a rebound from near-zero rates, not a sustainable growth rate.
3. **Sustainability verdict: not sustainable.** The chart's default scenario assumes an average rate on the debt of **4.7%**, **3.5%** nominal GDP growth and a primary deficit of **2.5% of GDP**. *r* then exceeds *g* by 1.2 pp, and debt (the cumulative-deficit proxy, 89% of GDP in FY2025) passes **100% of GDP in 2029**, **191% by 2050** and about 327% by 2075. Interest reaches **25% of revenue (the "fiscal crisis risk" band) around 2028**, 5% of GDP around 2032 (≈ 30% of revenue around 2033), 6% around 2038, 40% of revenue around 2042 and half of all revenue around 2051. On the interest ÷ revenue scale, this measure already touched 25% in FY2024 (25.9%) before easing to about 22% in FY2025 as the Fed cut. Because the projection uses one fixed rate, the crossing years are the same under either interest measure.
4. **Sensitivity (changing one assumption at a time from the defaults):** a rate of 5.5% brings 25% of revenue to 2026 and 5% of GDP to 2028. A rate of 3.5% (equal to growth) delays them to about 2041 and 2050. Closing the primary deficit to zero still crosses 25% of revenue around 2030 because *r* > *g*, but it slows the climb (5% of GDP in 2045, debt about 119% in 2050). Faster growth (5%) makes *r* < *g* and delays 5% of GDP to about 2037. Even a smaller 1.8% primary deficit only moves 5% of GDP to 2034. Only *r* ≤ *g* together with a small primary deficit, or a primary *surplus*, keeps the ratio from compounding. The preset scenarios in *View scenario details* still use the FY2025 starting values (Fed rate 4.4%, g 4%, primary deficit 1.8%).

**Bottom line:** interest costs and stock prices have moved independently, so the S&P chart offers no early warning. On the default assumptions (4.7% rate, 3.5% growth, 2.5%-of-GDP primary deficit) the burden enters the **25%-of-revenue crisis band within about 3 years (≈ 2028)** and passes 5% of GDP within about 7 years (≈ 2032). The plausible range for the 25% mark is about 2026–2041, set mostly by the rate on the debt relative to growth.

<details class="earlier"><summary>Using actual interest outlays (FRED) instead</summary>

1. **No statistical link to stock returns.** Year-to-year changes in interest as a % of GDP are uncorrelated with S&P 500 returns at every lag from −2 to +2 years (r between 0.00 and +0.16, all p > 0.14). The burden level doesn't significantly predict the next 10 years of S&P returns either (p ≈ 0.2, with a slightly *positive* sign). Historically the market hasn't priced the interest burden in any detectable way.
2. **The trends diverge sharply.** Over the whole period, interest % of GDP grew about 1%/yr while the S&P compounded at about 7.5%/yr. Interest roughly tracked the economy until 2000 and actually fell from 1980 to 2000. Since FY2010, though, it has grown about **+7.7%/yr faster than GDP** (±2.3 pp), and since FY2000 about +3.4%/yr. That kind of acceleration can't continue indefinitely for a ratio to GDP.
3. **The burden is at a record.** FY2025 interest is 3.94% of GDP and about 23% of revenue, above the 1991 peak of 3.16%.
4. **Sustainability verdict: not sustainable on the current path.** The default projection (4.7% rate, which is close to the actual FY2025 effective rate of 4.72%; 3.5% growth; 2.5%-of-GDP primary deficit) is identical under this measure. Debt passes 100% of GDP in 2029 and 191% by 2050. Interest crosses **5% of GDP around 2032** (≈ 30% of revenue around 2033) and **6% around 2038**. Interest is already about 23% of revenue (the "red flag" band above 20%) and crosses the **25% "fiscal crisis risk" level around 2028**.
5. **What would stabilize it:** only *r* ≤ *g* plus a small primary deficit, or a primary *surplus* while *r* > *g*. Closing the primary deficit to zero still crosses 25% of revenue around 2030, but 5% of GDP slips to about 2045. Faster growth alone (5%) delays the 5% crossing to about 2037, and a 3.5% rate delays it to about 2050.

**Bottom line:** interest costs and stock prices have moved independently, so the S&P chart offers no early warning. The arithmetic of debt does: on the default assumptions, interest becomes the dominant budget pressure within roughly **3–7 years** (25% of revenue ≈ 2028, 5% of GDP ≈ 2032). The range runs from about 2026 to the 2040s, depending mainly on rates relative to growth.

</details>

<details class="earlier"><summary>Earlier findings: cumulative deficit vs. S&amp;P 500 (FY1928–FY2025)</summary>


1. **Same long-run trend rate.** Fit from 1929, 1950, 1970 or 1990, the cumulative deficit and the S&P 500 both compound at roughly **7–8% a year**, and the gap is statistically indistinguishable from zero (p ≈ 0.4–0.97). Both are nominal-dollar series driven largely by nominal GDP growth (real growth plus inflation), so this is a shared driver, not evidence that one causes the other.
2. **Since 2000 they diverge.** From FY2000 the cumulative deficit's trend (~9.5%/yr) has outpaced the S&P's (~7.4%/yr) by about 2 pp a year. That difference is significant at the 5% level (p ≈ 0.03), though 26 years is a short sample for a volatile index.
3. **The high levels correlation (r ≈ 0.96) is mostly spurious.** The Durbin-Watson statistic (≈ 0.2) shows the residuals are highly persistent, the classic sign of two trending series that would correlate regardless of any link. Cointegration is borderline: significant only at the 10% level, so the evidence for a stable long-run relationship is weak.
4. **Year-to-year movements are essentially unrelated.** Same-year growth rates are uncorrelated (r ≈ +0.09, p ≈ 0.4). Small lead/lag correlations appear (deficit growth tends to follow weak markets and precede strong ones), with individual p ≈ 0.02–0.03, but none survive a correction for testing five lags.
5. **The shapes differ.** The S&P's log-quadratic curvature is significant (its trend growth rate has risen over the century), while the cumulative deficit's is not (steady compounding with wartime and crisis bursts).

**Bottom line:** the two charts look alike because both compound with the nominal economy, at nearly the same long-run rate. There's no statistically robust evidence that deficits and stock returns move together year to year. The one significant divergence is the post-2000 period, when borrowing has grown faster than the market. Choose another series above to rerun the tests live.

</details>

</div>

</section>

</div>

</div>

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
.ratio-guide { margin-top: .6rem; font-size: .8rem; line-height: 1.35; }
.ratio-guide h3 { margin: 0 0 .25rem; font-size: .85rem; }
.ratio-table { width: 100%; border-collapse: collapse; }
.ratio-table td { padding: .12rem .3rem; border-bottom: 1px solid var(--theme-foreground-faintest); vertical-align: top; }
.ratio-table td:first-child { white-space: nowrap; font-weight: 600; }
.ratio-table tr.now td, .ratio-detail tr.now td { background: color-mix(in srgb, #d62728 12%, transparent); }
.ratio-table .here { color: #d62728; font-weight: 600; white-space: nowrap; }
.ratio-guide .crisis-note { margin: .35rem 0; max-width: none; }
.ratio-guide .table-dialog-control button { font-size: .8rem; }
.ratio-detail { border-collapse: collapse; font-size: .9rem; }
.table-dialog-content table.ratio-detail { width: 100%; }
.ratio-detail th, .ratio-detail td { padding: .35rem .5rem; border-bottom: 1px solid var(--theme-foreground-faintest); text-align: left; vertical-align: top; }
.ratio-detail td:nth-child(3) { min-width: 18rem; white-space: normal; }
</style>
