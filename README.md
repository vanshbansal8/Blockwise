# Blockwise

Free Bitcoin and crypto education site: guide, 12 courses, practice trading simulator, price alerts, headlines, "what if I had invested" calculator, shareable result cards and certificates. Plain HTML plus a few small serverless functions. No accounts and no tracking.

## Files (all at the top level of the repo, except `api/`)
- `index.html` : the whole app (fonts are embedded)
- `privacy.html`, `terms.html`, `cookies.html`, `legal.css` : legal pages
- `manifest.webmanifest`, `sw.js`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png` : install to home screen
- `vercel.json` : security headers (strict Content-Security-Policy)
- `OFL.txt` : font licence
- `COMPLIANCE.md` : audit notes and things to review
- `api/markets.js`, `api/chart.js` : prices, charts, block height, sentiment
- `api/history.js` : price history for the "what if" calculator
- `api/news.js` : headlines from public RSS feeds
- `api/leaderboard.js` : leaderboard (needs Upstash Redis connected in Vercel)

## Deploy
Push to GitHub, import in Vercel (framework: Other, no build command), connect Upstash Redis under Storage, redeploy.
