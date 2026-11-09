// Vercel serverless function: /api/news
// Reads the publishers' public RSS feeds on the server and returns ONLY headline + link + source + time.
// Nothing is copied beyond the headline; every item links back to the original publisher.
const FEEDS = [
  ["CoinDesk", "https://www.coindesk.com/arc/outboundfeeds/rss/"],
  ["Cointelegraph", "https://cointelegraph.com/rss"],
  ["Bitcoin Magazine", "https://bitcoinmagazine.com/.rss/full/"],
  ["Decrypt", "https://decrypt.co/feed"],
];
const BTC = /bitcoin|btc\b|satoshi|halving|saylor|spot etf|lightning network|mining/i;

async function get(url, ms = 6000) {
  const c = new AbortController(), t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, { signal: c.signal, headers: { "user-agent": "BlockwiseNewsReader/1.0 (+https://blockwise.cc.cd)", accept: "application/rss+xml, application/xml, text/xml" } });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return await r.text();
  } finally { clearTimeout(t); }
}
const dec = s => s.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/<[^>]+>/g, "")
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
  .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/\s+/g, " ").trim();
const pick = (x, tag) => { const m = x.match(new RegExp("<" + tag + "[^>]*>([\\s\\S]*?)</" + tag + ">", "i")); return m ? dec(m[1]) : ""; };

function parse(xml, source) {
  return [...xml.matchAll(/<item[\s>][\s\S]*?<\/item>/gi)].slice(0, 15).map(m => {
    const x = m[0], title = pick(x, "title").slice(0, 200), link = pick(x, "link"), ts = Date.parse(pick(x, "pubDate")) || 0;
    return { title, link, source, ts, btc: BTC.test(title) };
  }).filter(i => i.title && /^https:\/\//.test(i.link));
}

module.exports = async (req, res) => {
  const results = await Promise.all(FEEDS.map(([n, u]) => get(u).then(x => parse(x, n)).catch(() => [])));
  const seen = new Set(), items = results.flat().filter(i => !seen.has(i.link) && seen.add(i.link)).sort((a, b) => b.ts - a.ts).slice(0, 40);
  if (!items.length) { res.setHeader("Cache-Control", "no-store"); return res.status(502).json({ error: "Headlines unavailable" }); }
  res.setHeader("Cache-Control", "public, s-maxage=600, stale-while-revalidate=1800");
  res.status(200).json({ items, sources: FEEDS.map(f => f[0]), updated: Date.now() });
};
