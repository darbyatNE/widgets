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

const SERIES = {
  "Cumulative deficit": {field: "cum_deficit", positive: true},
  "Annual deficit": {field: "deficit", positive: false},
  "Outlays (spending)": {field: "outlays", positive: true},
  "Receipts (revenue)": {field: "receipts", positive: true}
};
const fmtB = (v) => (Math.abs(v) >= 1e6 ? d3.format("$,.2f")(v / 1e6) + "T" : d3.format("$,.1f")(v / 1e3) + "B");
const fmtG = (v) => (isFinite(v) ? d3.format(".1%")(v) : "n/a");
const fmtSlope = (v) => (isFinite(v) ? d3.format("+.2%")(v) + "/yr" : "n/a");
const MIN_POINTS = 3;
```

```js
const spec = SERIES[seriesName];
const data = budget.map((d) => ({year: d.year, date: d.date, close: d[spec.field]}));
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
    label: `${seriesName} ($)`,
    tickFormat: fmtB,
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
          `Start: FY${d.r.year}\nGrowth @ latest: ${fmtSlope(d.r.slopePerYear)}\nAvg growth: ${fmtSlope(d.r.avgGrowth)}\nRMS error: ${d3.format(".1%")(d.r.rmsPct)}\nFitted @ FY${endPoint.year}: ${fmtB(d.r.fittedEnd)}`
      })
    ),
    Plot.dot([endPoint], {x: "date", y: "close", fill: "red", r: 4, tip: true, title: (d) => `FY${d.year}: ${fmtB(d.close)}`})
  ]
}));
```

Latest: **FY${endPoint.year} ${seriesName.toLowerCase()} — ${fmtB(endPoint.close)}**

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
const startYears = budget.slice(0, budget.length - MIN_POINTS + 1).map((d) => d.year);
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
<li><strong style="color:#d62728">Red: at latest.</strong> How steep the trend line is at FY2025, as % per year. This is the pace the trend is growing at today.</li>
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

<h2 class="title-row">Deficit vs. S&amp;P 500 — is the relationship significant?
<details class="info"><summary title="About these tests" aria-label="About these tests">i</summary><div class="info-body">
<p>The S&amp;P 500 is sampled at each fiscal year-end (June 30 / Sept 30), FY1928–FY2025, and compared with the selected budget series.</p>
<ul>
<li><strong>Trend growth by start year:</strong> both series fit with the same model from each start year to FY2025. Matching curves mean the two trends compound at similar rates.</li>
<li><strong>Levels correlation:</strong> any two series that both grow over time correlate strongly. A Durbin-Watson statistic far below 2 means that correlation is likely spurious.</li>
<li><strong>Cointegration (Engle-Granger):</strong> tests whether the two levels share a stable long-run relationship. The statistic must be below about −3.37 for 5% significance (−3.07 for 10%).</li>
<li><strong>Annual growth correlation:</strong> compares year-over-year % changes, which removes the shared upward trend. Testing several lags makes a few p &lt; 0.05 likely by chance (a Bonferroni-adjusted cutoff is shown).</li>
<li><strong>Trend difference:</strong> regresses ln(budget) − ln(S&amp;P) on time with Newey-West standard errors, which allow for autocorrelated residuals. A slope near 0 means both grow at the same trend rate.</li>
<li><strong>Curvature:</strong> the t² coefficient of the log-quadratic fit. Significant means the trend growth rate itself has changed over time.</li>
</ul>
<p>Both series are in nominal dollars, so inflation is a shared driver of their long-run growth.</p>
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
const cmpMeasure = view(Inputs.radio(["Average over window", "At latest"], {label: "Compare", value: "Average over window"}));
```

```js
const overlapYears = new Set(spFY.map((d) => d.year));
const bud = data.filter((d) => overlapYears.has(d.year));
const sp = spFY.filter((d) => bud.some((b) => b.year === d.year));
const canLog = spec.positive && bud.every((d) => d.close > 0);
const cmpModel = model.log ? model : FITS["Log-quadratic (changing growth rate)"];
const cmpEnd = bud[bud.length - 1].date;
// At least 10 years per fit: very short windows swing wildly and swamp the scale.
const MIN_CMP = 10;
const cmpRows = [];
for (let i = 0; i + MIN_CMP <= bud.length; i++) {
  if (!canLog) break;
  const fb = fitTo(bud.slice(i), cmpModel, cmpEnd), fs = fitTo(sp.slice(i), cmpModel, cmpEnd);
  const pick = (f) => (cmpMeasure === "At latest" ? f.growthNow : f.avgGrowth);
  cmpRows.push({year: bud[i].year, g: pick(fb), series: seriesName}, {year: sp[i].year, g: pick(fs), series: "S&P 500"});
}
display(canLog ? Plot.plot({
  width,
  height: 380,
  marginLeft: 60,
  y: {grid: true, label: `Trend growth, ${cmpMeasure.toLowerCase()} (%/yr)`, tickFormat: (v) => d3.format(".0%")(v)},
  x: {label: "Regression start year", tickFormat: "d"},
  color: {legend: true, domain: [seriesName, "S&P 500"], range: ["#e8590c", "#2b8a3e"]},
  marks: [
    Plot.ruleY([0], {stroke: "#888"}),
    Plot.line(cmpRows, {x: "year", y: "g", stroke: "series", z: "series", strokeWidth: 1.5}),
    Plot.tip(cmpRows, Plot.pointer({x: "year", y: "g", title: (d) => `Start: FY${d.year}\n${d.series}: ${fmtG(d.g)}/yr`}))
  ]
}) : html`<p><em>The comparison uses log growth, which needs positive values. Choose Cumulative deficit, Outlays, or Receipts.</em></p>`);
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
  const lagLabel = (l) => (l === 0 ? "same year" : l > 0 ? `budget leads S&P by ${l} yr` : `S&P leads budget by ${-l} yr`);
  const trendDiff = (y0) => {
    const idx = bud.map((d, i) => i).filter((i) => bud[i].year >= y0);
    const r = olsHAC(idx.map((i) => [1, bud[i].year - y0]), idx.map((i) => lb[i] - ls[i]));
    return r;
  };
  const curv = (vals) => olsHAC(bud.map((d) => [1, (d.year - 1977) / 10, ((d.year - 1977) / 10) ** 2]), vals);
  const cb = curv(lb), cs = curv(ls);

  statRows = [
    {Test: "Levels correlation, ln(budget) vs ln(S&P)", Result: `r = ${lvlCorr.r.toFixed(3)}, Durbin-Watson = ${durbinWatson(levels.res).toFixed(2)}`, "p-value": "—", Verdict: durbinWatson(levels.res) < 1 ? "Likely spurious (shared trend)" : "See cointegration"},
    {Test: "Cointegration (Engle-Granger ADF t)", Result: `t = ${eg.toFixed(2)} (5% crit ≈ −3.37, 10% ≈ −3.07)`, "p-value": eg < -3.37 ? "<0.05" : eg < -3.07 ? "0.05–0.10" : ">0.10", Verdict: eg < -3.37 ? "Significant" : eg < -3.07 ? "Weak (10% level only)" : "Not significant"},
    ...LAGS.map((l) => {
      const c = lagCorr(l);
      return {Test: `Annual growth correlation (${lagLabel(l)})`, Result: `r = ${c.r >= 0 ? "+" : ""}${c.r.toFixed(3)}, n = ${c.n}`, "p-value": fmtP(c.p), Verdict: c.p < bonf ? "Significant" : c.p < 0.05 ? `Not after Bonferroni (needs p < ${bonf})` : "Not significant"};
    }),
    ...[bud[0].year + 1, 1950, 1970, 1990, 2000].map((y0) => {
      const r = trendDiff(y0);
      return {Test: `Trend growth difference, FY${y0}–FY${bud[bud.length - 1].year}`, Result: `budget − S&P = ${d3.format("+.2f")(100 * r.beta[1])} pp/yr ± ${(196 * r.se[1]).toFixed(2)}`, "p-value": fmtP(r.p[1]), Verdict: verdict(r.p[1])};
    }),
    {Test: `Curvature (growth acceleration), ${seriesName}`, Result: `${d3.format("+.2f")(100 * 2 * cb.beta[2] / 10)} pp/yr per decade`, "p-value": fmtP(cb.p[2]), Verdict: verdict(cb.p[2])},
    {Test: "Curvature (growth acceleration), S&P 500", Result: `${d3.format("+.2f")(100 * 2 * cs.beta[2] / 10)} pp/yr per decade`, "p-value": fmtP(cs.p[2]), Verdict: verdict(cs.p[2])}
  ];
}
display(canLog ? Inputs.table(statRows, {select: false, rows: statRows.length + 1, layout: "auto"}) : "");
```

### Conclusions (cumulative deficit vs. S&P 500, FY1928–FY2025)

1. **Same long-run trend rate.** Fit from 1929, 1950, 1970 or 1990, the cumulative deficit and the S&P 500 both compound at roughly **7–8% a year**, and the gap is statistically indistinguishable from zero (p ≈ 0.4–0.97). Both are nominal-dollar series driven largely by nominal GDP growth (real growth plus inflation), so this is a shared driver, not evidence that one causes the other.
2. **Since 2000 they diverge.** From FY2000 the cumulative deficit's trend (~9.5%/yr) has outpaced the S&P's (~7.4%/yr) by about 2 pp a year. That difference is significant at the 5% level (p ≈ 0.03), though 26 years is a short sample for a volatile index.
3. **The high levels correlation (r ≈ 0.96) is mostly spurious.** The Durbin-Watson statistic (≈ 0.2) shows the residuals are highly persistent, the classic sign of two trending series that would correlate regardless of any link. Cointegration is borderline: significant only at the 10% level, so the evidence for a stable long-run relationship is weak.
4. **Year-to-year movements are essentially unrelated.** Same-year growth rates are uncorrelated (r ≈ +0.09, p ≈ 0.4). Small lead/lag correlations appear (deficit growth tends to follow weak markets and precede strong ones), with individual p ≈ 0.02–0.03, but none survive a correction for testing five lags.
5. **The shapes differ.** The S&P's log-quadratic curvature is significant (its trend growth rate has risen over the century), while the cumulative deficit's is not (steady compounding with wartime and crisis bursts).

**Bottom line:** the two charts look alike because both compound with the nominal economy, at nearly the same long-run rate. There's no statistically robust evidence that deficits and stock returns move together year to year. The one significant divergence is the post-2000 period, when borrowing has grown faster than the market. Choose another series above to rerun the tests live.

```js
display(Inputs.table(
  shown.map((r) => ({
    "Start FY": String(r.year),
    "Years": r.n,
    "Growth @ latest": fmtSlope(r.slopePerYear),
    "Avg growth": fmtSlope(r.avgGrowth),
    "RMS error": d3.format(".1%")(r.rmsPct),
    "R²": +r.r2.toFixed(4),
    [`Fitted @ FY${endPoint.year}`]: fmtB(r.fittedEnd),
    "Actual vs fit": d3.format("+.1%")(endPoint.close / r.fittedEnd - 1)
  })),
  {rows: 15}
));
```

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
</style>
