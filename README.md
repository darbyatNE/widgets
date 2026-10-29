# Darby's Widgets

Static site for [lee-river.com](https://lee-river.com), built with [Observable Framework](https://observablehq.com/framework/).

| Page | Path | Source |
|---|---|---|
| Homepage | `/` | `src/index.md` |
| S&P 500 Regression Trend Lines | `/sp500` | `src/sp500.md` |

Data: `src/data/sp500_monthly.csv` holds month-end S&P 500 closes from 1928 to the present, newest first. Columns are `date,close` with no header row.

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

After that, every push to `main` redeploys automatically.

### Updating the S&P data

Add new month-end rows to the top of `src/data/sp500_monthly.csv`, then commit and push.
