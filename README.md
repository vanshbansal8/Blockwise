# Blockwise

Free Bitcoin and crypto education site with live prices. Plain HTML plus two small serverless functions. No database, no accounts, no build step.

## Structure
- `index.html` : the whole front end
- `api/markets.js` : live prices, block height, fear and greed (CoinGecko, falls back to CryptoCompare)
- `api/chart.js` : Bitcoin price chart (1D, 7D, 30D, 1Y)

## Deploy
1. Push this folder to a GitHub repo (keep `index.html` and `api/` at the repo root).
2. On Vercel: Add New > Project > import the repo > Deploy. Framework preset: Other. No build command.
3. Add your custom domain under Project > Settings > Domains.

The `/api` routes only run on Vercel (or `vercel dev` locally). Opening index.html straight from your computer will not load prices.
