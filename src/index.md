---
title: Darby's Widgets
toc: false
---

<div class="hero">
  <h1>Darby's Widgets</h1>
  <p>Small, interactive tools for exploring data.</p>
</div>

<div class="grid grid-cols-2">
  <a class="card widget" href="./sp500">
    <h2>S&amp;P 500 Regression Trend Lines</h2>
    <p>Monthly S&amp;P 500 closes from 1928 to today, with linear, exponential, and log-quadratic trend lines fit from every start month. Compare fits and implied annual growth rates.</p>
    <span class="go">Open →</span>
  </a>
</div>

<style>
.hero { margin: 3rem 0 2rem; text-align: center; }
.hero h1 { font-size: 3rem; max-width: none; margin: 0; }
.hero p { color: var(--theme-foreground-muted); font-size: 1.15rem; margin: .5rem auto 0; }
a.widget { display: block; text-decoration: none; color: inherit; transition: border-color .15s, transform .15s; }
a.widget:hover { border-color: var(--theme-foreground-focus); transform: translateY(-2px); }
a.widget h2 { margin-top: 0; }
a.widget .go { color: var(--theme-foreground-focus); font-weight: 600; }
</style>
