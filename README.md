# Darby's Widgets

Static site for [lee-river.com](https://lee-river.com), built with [Observable Framework](https://observablehq.com/framework/).

| Page | Path | Source |
|---|---|---|
| Homepage | `/` | `src/index.md` |
| S&P 500 Regression Trend Lines | `/sp500` | `src/sp500.md` |
| US Deficit Regression Trend Lines | `/deficits` | `src/deficits.md` |

Shared code lives in `src/components/`: `regression.js` holds the trend-line fits used by both pages, and `stats.js` holds the significance tests (Newey-West OLS, correlation p-values, Engle-Granger).

Data:
- `src/data/sp500_monthly.csv` holds month-end S&P 500 closes from 1928 to the present, newest first. Columns are `date,close` with no header row. The page charts data through `END_DATE` (Dec 31, 2025) in `src/sp500.md`; later rows are ignored.
- `src/data/us_budgets.csv` holds federal receipts, outlays, deficit and cumulative deficit by fiscal year, in $ millions. It's generated from OMB Historical Table 1.1 (`data-src/US_budgets.xlsx`). It also has `interest` ($ millions, FRED `FYOINT`, `data-src/FYOINT.csv`), `interest_pct_gdp` (FRED `FYOIGDA188S`, `data-src/FYOIGDA188S.xlsx`) and implied nominal `gdp` (interest ÷ share). These are blank before FY1940.

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

Replace `data-src/US_budgets.xlsx` with the latest OMB Table 1.1 download (and `FYOINT.csv` / `FYOIGDA188S.xlsx` with fresh FRED downloads), then run `python3 scripts/budgets_to_csv.py`. It uses the standard library only. Commit the regenerated CSV.
