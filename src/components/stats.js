// Small statistics helpers (no dependencies) for comparing two annual series.

function betacf(a, b, x) {
  const tiny = 1e-30;
  let c = 1, d = 1 - ((a + b) * x) / (a + 1);
  d = 1 / (Math.abs(d) < tiny ? tiny : d);
  let h = d;
  for (let m = 1; m < 300; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((a - 1 + m2) * (a + m2));
    d = 1 + aa * d; d = 1 / (Math.abs(d) < tiny ? tiny : d);
    c = 1 + aa / c; c = Math.abs(c) < tiny ? tiny : c;
    h *= d * c;
    aa = (-(a + m) * (a + b + m) * x) / ((a + m2) * (a + 1 + m2));
    d = 1 + aa * d; d = 1 / (Math.abs(d) < tiny ? tiny : d);
    c = 1 + aa / c; c = Math.abs(c) < tiny ? tiny : c;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 3e-12) break;
  }
  return h;
}

function lgamma(z) {
  const g = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let x = z, y = z, tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (const c of g) ser += c / ++y;
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

function ibeta(a, b, x) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? (bt * betacf(a, b, x)) / a : 1 - (bt * betacf(b, a, 1 - x)) / b;
}

/** Two-sided p-value for a t statistic with df degrees of freedom. */
export function pFromT(t, df) {
  return ibeta(df / 2, 0.5, df / (df + t * t));
}

/** Pearson correlation with two-sided p-value. */
export function correlation(x, y) {
  const n = x.length;
  const mx = x.reduce((s, v) => s + v, 0) / n, my = y.reduce((s, v) => s + v, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (x[i] - mx) * (y[i] - my);
    sxx += (x[i] - mx) ** 2;
    syy += (y[i] - my) ** 2;
  }
  const r = sxy / Math.sqrt(sxx * syy);
  const t = r * Math.sqrt((n - 2) / (1 - r * r));
  return {r, p: pFromT(Math.abs(t), n - 2), n};
}

function invert(A) {
  const n = A.length;
  const M = A.map((row, i) => [...row, ...Array.from({length: n}, (_, j) => (i === j ? 1 : 0))]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    const pv = M[c][c];
    for (let k = 0; k < 2 * n; k++) M[c][k] /= pv;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c];
      for (let k = 0; k < 2 * n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row) => row.slice(n));
}

/**
 * OLS of y on the columns of X, with Newey-West (HAC) standard errors so that
 * autocorrelated residuals in trending annual data don't overstate significance.
 */
export function olsHAC(X, y, lags = Math.floor(4 * (X.length / 100) ** (2 / 9))) {
  const n = X.length, k = X[0].length;
  const XtX = Array.from({length: k}, (_, i) => Array.from({length: k}, (_, j) => X.reduce((s, r) => s + r[i] * r[j], 0)));
  const inv = invert(XtX);
  const Xty = Array.from({length: k}, (_, i) => X.reduce((s, r, t) => s + r[i] * y[t], 0));
  const beta = inv.map((row) => row.reduce((s, v, j) => s + v * Xty[j], 0));
  const res = X.map((r, t) => y[t] - r.reduce((s, v, j) => s + v * beta[j], 0));
  const S = Array.from({length: k}, () => new Array(k).fill(0));
  for (let t = 0; t < n; t++) for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) S[i][j] += res[t] ** 2 * X[t][i] * X[t][j];
  for (let l = 1; l <= lags; l++) {
    const w = 1 - l / (lags + 1);
    for (let t = l; t < n; t++)
      for (let i = 0; i < k; i++)
        for (let j = 0; j < k; j++) S[i][j] += w * res[t] * res[t - l] * (X[t][i] * X[t - l][j] + X[t - l][i] * X[t][j]);
  }
  const se = Array.from({length: k}, (_, i) => {
    let v = 0;
    for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) v += inv[i][a] * S[a][b] * inv[b][i];
    return Math.sqrt(v);
  });
  const t = beta.map((b, i) => b / se[i]);
  return {beta, se, t, p: t.map((v) => pFromT(Math.abs(v), n - k)), res, n};
}

/** Durbin-Watson statistic: ~2 means no autocorrelation, near 0 signals a spurious levels regression. */
export function durbinWatson(res) {
  let num = 0, den = res[0] ** 2;
  for (let i = 1; i < res.length; i++) {
    num += (res[i] - res[i - 1]) ** 2;
    den += res[i] ** 2;
  }
  return num / den;
}

/** Engle-Granger cointegration: ADF t statistic (one lag) on residuals of the levels regression. */
export function engleGranger(res) {
  const de = res.slice(1).map((v, i) => v - res[i]);
  const X = [], y = [];
  for (let i = 2; i < res.length; i++) {
    X.push([res[i - 1], de[i - 2]]);
    y.push(de[i - 1]);
  }
  const XtX = [0, 1].map((i) => [0, 1].map((j) => X.reduce((s, r) => s + r[i] * r[j], 0)));
  const inv = invert(XtX);
  const Xty = [0, 1].map((i) => X.reduce((s, r, t) => s + r[i] * y[t], 0));
  const b = inv.map((row) => row[0] * Xty[0] + row[1] * Xty[1]);
  const rss = X.reduce((s, r, t) => s + (y[t] - r[0] * b[0] - r[1] * b[1]) ** 2, 0);
  const s2 = rss / (y.length - 2);
  return b[0] / Math.sqrt(s2 * inv[0][0]);
}
