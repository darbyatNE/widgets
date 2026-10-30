# Darby's Widgets

Static site for [lee-river.com](https://lee-river.com), built with [Observable Framework](https://observablehq.com/framework/).

| Page | Path | Source |
|---|---|---|
| Homepage | `/` | `src/index.md` |
| S&P 500 Regression Trend Lines | `/sp500` | `src/sp500.md` |
| US Deficit Regression Trend Lines | `/deficits` | `src/deficits.md` |
| TapIt — Reaction Game | `/tapit` | `src/tapit.md` |

Shared code lives in `src/components/`: `regression.js` holds the trend-line fits used by both pages, and `stats.js` holds the significance tests (Newey-West OLS, correlation p-values, Engle-Granger).

TapIt is a five-round reaction game. Each 20-second round starts with a 3-second countdown; targets last 1,250 ms in round one, then compound shorter by 7% each round (about 935 ms in round five), while new targets continue to spawn every 100–1,000 ms. Four randomly selected shades show their signed value in a compact legend: light/deep green award +1/+2, light/deep olive subtract −1/−2. Expired targets are free; tapping an unlit square costs −1. The game tracks each round and the cumulative total, and offers generated Web Audio feedback with a sound toggle. Its timing and scoring engine is `src/components/tapit-engine.js`; deterministic tests run with `node --test tests/tapit-engine.test.js`.

The 4×10 square field fits the viewport without scrolling. Short landscape screens move controls and concise rules into side rails, hide ornamental notes, and use nearly the full height for targets. Ten square rows inherently limit touch-target size on short screens; a visible note recommends portrait for larger targets without blocking play or keyboard access. Hiding the page ends the current round as partial; completed rounds remain credited, but the partial round is not counted as complete.

### Chart page layout

Both chart pages are one-view-at-a-time workspaces: view tabs sit at the top right of the header and only the selected panel is shown (`#trend` by default, switchable by URL hash). `/sp500` has Trend lines and Growth rates; `/deficits` adds S&P comparison, Sustainability and Conclusions. The fit and start-range inputs live in a left rail shared by the trend and growth views. On desktop each view fits the browser window without page scrolling (checked at 1366×768 and 1920×1080); on narrow screens the page stacks and scrolls normally.

`src/components/workspace.js` builds the accessible tab list (arrow, Home and End keys; `data-goto="<id>"` buttons also switch views) and sizes each plot to the viewport. `workspace.css` holds the layout, and the site footer is hidden on these pages. To add a view, add a `<section class="view-panel" id="panel-<id>" hidden>` and an entry in the `viewTabs([...])` call. Plots are sized from the window, not the hidden panel, so they render at full width when first shown.

Data:
- `src/data/sp500_monthly.csv` holds month-end S&P 500 closes from 1928 to the present, newest first. Columns are `date,close` with no header row. The page charts data through `END_DATE` (Dec 31, 2025) in `src/sp500.md`; later rows are ignored.
- `src/data/us_budgets.csv` holds federal receipts, outlays, deficit and cumulative deficit by fiscal year, in $ millions. It's generated from OMB Historical Table 1.1 (`data-src/US_budgets.xlsx`). It also has `interest` ($ millions, FRED `FYOINT`, `data-src/FYOINT.csv`), `interest_pct_gdp` (FRED `FYOIGDA188S`, `data-src/FYOIGDA188S.xlsx`) and implied nominal `gdp` (interest ÷ share). These are blank before FY1940. `fed_rate` is the fiscal-year average Fed funds rate (FRED `FEDFUNDS`, `data-src/FEDFUNDS.csv`), or the 3-month T-bill rate (FRED `TB3MS`, `data-src/TB3MS.csv`) before FY1955, with `rate_source` naming which. `model_interest` = prior fiscal year-end `cum_deficit` × `fed_rate` ($ millions), and `model_interest_pct_gdp` is that as a % of GDP (FY1940+). The deficit page's *Interest measure* control switches between this modeled measure (default) and actual outlays.

## Local development

```bash
npm install
npm run dev      # live preview at http://127.0.0.1:3000
npm run build    # static output in dist/
```

## Adding a widget

1. Add `src/<name>.md`.
2. Add a card linking to `./<name>` in `src/index.md`.
3. Add the page to `pages` in `observablehq.config.js`.

## Deploying (Cloudflare Pages)

The `lee-river.com` DNS is already managed by Cloudflare.

1. In the Cloudflare dashboard, go to **Workers & Pages → Create → Pages → Connect to Git** and pick `darbyatNE/widgets`.
2. Use these build settings:
   - Framework preset: **None**
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Node version comes from `.nvmrc`. You can also set the environment variable `NODE_VERSION=22`.
3. Click **Save and Deploy**. The site appears at `https://<project>.pages.dev`.
4. In the Pages project, go to **Custom domains → Set up a custom domain** and add `lee-river.com`, then `www.lee-river.com`.
   - Cloudflare replaces the existing proxied `A`/`AAAA` records for the root and `www` with Pages records. Accept the change. Email is unaffected: the Zoho `MX` and `TXT` records are separate.

## Branches

- `main`: development. Pushes build a Cloudflare **preview** only (`https://main.widgets-4dn.pages.dev`).
- `production`: the published site. Cloudflare's production branch is set to `production` (Settings → Builds & deployments → Branch control).

To publish, merge `main` into `production`:

```bash
git checkout production && git merge --ff-only main && git push origin production && git checkout main
```

### Updating the S&P data

Add new month-end rows to the top of `src/data/sp500_monthly.csv`, then commit and push.

### Updating the budget data

Replace `data-src/US_budgets.xlsx` with the latest OMB Table 1.1 download (and `FYOINT.csv`, `FYOIGDA188S.xlsx`, `FEDFUNDS.csv` and `TB3MS.csv` with fresh FRED downloads), then run `python3 scripts/budgets_to_csv.py`. It uses the standard library only. Commit the regenerated CSV.
