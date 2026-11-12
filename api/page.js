// Vercel serverless function: /api/page?slug=simulator  (reached through the /p/:slug rewrite in vercel.json)
// Gives every section of the app its own shareable link with its own title, description and preview card,
// then sends real visitors straight into the app. Link-preview robots read the tags; people get redirected.
const SITE = "https://blockwise.cc.cd";
const PAGES = {
  markets: ["Bitcoin and crypto markets", "Live Bitcoin and crypto prices, the next halving countdown and market mood.", ""],
  bitcoin: ["Bitcoin guide", "How Bitcoin works, who Satoshi is, how halving works and a history timeline, in plain English.", "bitcoin"],
  altcoins: ["Other coins explained", "What Ethereum, Solana, XRP, stablecoins and other major coins are for.", "altcoins"],
  learn: ["Crypto courses and quizzes", "12 free bite-sized courses with quizzes, plus a certificate when you finish them all.", "learn"],
  simulator: ["Paper trading simulator", "Practice trading with $10,000 of virtual money at live prices. No risk, no sign-up.", "simulator"],
  alerts: ["Crypto price alerts", "Set a target price and get alerted when a coin crosses it.", "alerts"],
  news: ["Bitcoin headlines", "The latest Bitcoin and crypto headlines, linked to the original publishers.", "news"],
  tools: ["Bitcoin tools and calculators", "Convert BTC, sats and USD, and see what a past Bitcoin investment would be worth today.", "tools"],
  safety: ["Crypto scam spotter", "Test yourself on real-world crypto scam messages and learn the warning signs.", "safety"],
  glossary: ["Crypto glossary", "Plain-English definitions of Bitcoin and crypto terms.", "glossary"],
};
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
module.exports = (req, res) => {
  const slug = String((req.query && req.query.slug) || "").toLowerCase(), p = PAGES[slug];
  if (!p) { res.statusCode = 302; res.setHeader("Location", "/"); return res.end(); }
  const [title, desc, route] = p, url = SITE + "/p/" + slug, dest = route ? "/#/" + route : "/", t = esc(title + " | Blockwise"), d = esc(desc);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  res.status(200).send(`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${t}</title><meta name="description" content="${d}"><link rel="canonical" href="${url}">
<meta property="og:type" content="website"><meta property="og:site_name" content="Blockwise"><meta property="og:title" content="${t}"><meta property="og:description" content="${d}"><meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}/og-image.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="Blockwise: learn Bitcoin and crypto, free">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${t}"><meta name="twitter:description" content="${d}"><meta name="twitter:image" content="${SITE}/og-image.png">
<meta http-equiv="refresh" content="0;url=${dest}"><script>location.replace(${JSON.stringify(dest)})</script></head>
<body><p><a href="${dest}">Open ${esc(title)} on Blockwise</a></p></body></html>`);
};
