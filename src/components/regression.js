// Shared regression math for the trend-line widgets.

export const FITS = {
  "Linear": {degree: 1, log: false},
  "Exponential (log-linear)": {degree: 1, log: true},
  "Log-quadratic (changing growth rate)": {degree: 2, log: true}
};

export const YEAR = 365.25 * 864e5;

// Least-squares polynomial fit of y (or ln y) against time. Time is centered and scaled so the normal equations stay well conditioned.
// points: [{date, close}], ordered by date. endDate: the date growth is measured to (the latest reading).
export function fit(points, {degree, log}, endDate) {
  const t0 = points[0].date;
  const ts = points.map((p) => (p.date - t0) / YEAR);
  const ys = points.map((p) => (log ? Math.log(p.close) : p.close));
  const mid = (ts[0] + ts[ts.length - 1]) / 2;
  const half = Math.max((ts[ts.length - 1] - ts[0]) / 2, 1e-9);
  const xs = ts.map((t) => (t - mid) / half);

  const n = degree + 1;
  const A = Array.from({length: n}, () => new Array(n + 1).fill(0));
  for (let i = 0; i < xs.length; i++) {
    const pow = Array.from({length: 2 * n - 1}, (_, k) => xs[i] ** k);
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) A[r][c] += pow[r + c];
      A[r][n] += ys[i] * pow[r];
    }
  }
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let k = c; k <= n; k++) A[r][k] -= f * A[c][k];
    }
  }
  const coef = A.map((row, k) => row[n] / row[k]);

  const at = (t) => coef.reduce((s, c, k) => s + c * ((t - mid) / half) ** k, 0);
  // d(at)/dt in units per year.
  const slopeAt = (t) => coef.reduce((s, c, k) => (k ? s + (k * c * ((t - mid) / half) ** (k - 1)) / half : s), 0);
  const predict = (date) => {
    const y = at((date - t0) / YEAR);
    return log ? Math.exp(y) : y;
  };

  const my = ys.reduce((s, y) => s + y, 0) / ys.length;
  let ssRes = 0, ssTot = 0, sqPct = 0;
  for (let i = 0; i < ts.length; i++) {
    const yhat = at(ts[i]);
    ssRes += (ys[i] - yhat) ** 2;
    ssTot += (ys[i] - my) ** 2;
    const price = points[i].close;
    sqPct += ((price - (log ? Math.exp(yhat) : yhat)) / price) ** 2;
  }
  const tEnd = (endDate - t0) / YEAR;
  // Annual % growth of the fitted line at a date. For linear fits this is slope / fitted level,
  // i.e. the % gain over the next year; undefined where the line is at or below zero.
  const growthAt = (date) => {
    const t = (date - t0) / YEAR;
    if (log) return Math.exp(slopeAt(t)) - 1;
    const level = at(t);
    return level > 0 ? slopeAt(t) / level : NaN;
  };
  // Average annual % growth (CAGR) of the fitted line from the start month to the latest reading.
  const years = tEnd - ts[0];
  const yStart = at(ts[0]), yEnd = at(tEnd);
  const avgGrowth =
    years <= 0 ? NaN
    : log ? Math.exp((yEnd - yStart) / years) - 1
    : yStart > 0 && yEnd > 0 ? (yEnd / yStart) ** (1 / years) - 1
    : NaN;
  return {
    predict,
    growthAt,
    avgGrowth,
    r2: ssTot === 0 ? 1 : 1 - ssRes / ssTot,
    // RMS of percentage residuals in price space: comparable across all fit types.
    rmsPct: Math.sqrt(sqPct / ts.length),
    growthNow: growthAt(endDate)
  };
}
