---
title: Darby's Widgets
toc: false
---

<img class="page-bg" src="./img/widgets_bkg.jpg" alt="" aria-hidden="true">
<div class="page-bg-shade" aria-hidden="true"></div>

<div class="hero">
  <h1>Darby's Widgets</h1>
  <p>Small, interactive tools for exploring data.</p>
</div>

<div class="grid grid-cols-2">
  <a class="card widget" href="./sp500">
    <h2>S&amp;P 500 Regression Trend Lines</h2>
    <p>Monthly S&amp;P 500 closes from 1928 through December 2025, with linear, exponential, and log-quadratic trend lines fit from every start month. Compare fits and implied annual growth rates.</p>
  </a>
  <a class="card widget" href="./deficits">
    <h2>US Deficit Regression Trend Lines</h2>
    <p>Federal deficits, spending and revenue from 1901 to 2025, fit with the same trend-line math as the S&amp;P 500, plus statistical tests of whether borrowing and the market move together.</p>
  </a>
</div>

<style>
/* Homepage only: full-bleed photo background with a dark wash so text stays readable. */
html, body { background: #050b16; }
.page-bg, .page-bg-shade { position: fixed; inset: 0; width: 100%; height: 100%; z-index: -1; pointer-events: none; }
.page-bg { object-fit: cover; object-position: center; }
.page-bg-shade { background: linear-gradient(180deg, rgba(4, 10, 22, .55) 0%, rgba(4, 10, 22, .78) 60%, rgba(4, 10, 22, .9) 100%); }

body {
  --theme-foreground: #eef4ff;
  --theme-foreground-muted: #b8c7dd;
  --theme-foreground-focus: #5cc8ff;
  color: var(--theme-foreground);
}
#observablehq-footer, #observablehq-footer a { color: #9fb2cc; }

.hero { margin: 4rem 0 2.5rem; text-align: center; }
.hero h1 { font-size: 3.25rem; max-width: none; margin: 0; color: #fff; text-shadow: 0 2px 18px rgba(0, 0, 0, .7); }
.hero p { color: var(--theme-foreground-muted); font-size: 1.2rem; margin: .5rem auto 0; text-shadow: 0 1px 8px rgba(0, 0, 0, .7); }

a.widget {
  display: block;
  text-decoration: none;
  color: var(--theme-foreground);
  background: rgba(10, 22, 42, .62);
  border: 1px solid rgba(92, 200, 255, .35);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  box-shadow: 0 8px 28px rgba(0, 0, 0, .45);
  cursor: pointer;
  -webkit-tap-highlight-color: rgba(92, 200, 255, .15);
  touch-action: manipulation;
  transition: border-color .15s, transform .15s, box-shadow .15s;
}
/* Hover lift only on mouse devices so a phone tap navigates immediately. */
@media (hover: hover) {
  a.widget:hover { border-color: var(--theme-foreground-focus); transform: translateY(-2px); box-shadow: 0 10px 34px rgba(0, 0, 0, .55), 0 0 0 1px rgba(92, 200, 255, .35); }
}
a.widget:active { border-color: var(--theme-foreground-focus); transform: scale(.98); }
a.widget h2 { margin-top: 0; color: #fff; }
a.widget p { color: var(--theme-foreground-muted); margin-bottom: 0; }
</style>
