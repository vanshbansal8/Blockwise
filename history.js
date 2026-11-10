// Vercel serverless function: /api/history -> { source, data: [[timestampMs, closeUsd], ...] } daily BTC closes
// Used by the "What if I had invested" calculator. Tries several free sources in turn and only accepts a result that is
// long (more than ~2.7 years) AND fresh (ends within the last 5 days), so a stale or short answer can never win.
const DAY = 86400;
async function j(url, ms = 9000, headers = {}) {
  const c = new AbortController(), t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, { signal: c.signal, headers: { accept: "application/json", "user-agent": "blockwise/1.0", ...headers } });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}
const tidy = rows => [...new Map(rows.filter(r => r[1] > 0 && isFinite(r[0])).map(r => [Math.floor(r[0] / (DAY * 1000)), r])).values()].sort((a, b) => a[0] - b[0]);

async function cryptocompare() {
  const key = process.env.CRYPTOCOMPARE_API_KEY;
  const d = await j("https://min-api.cryptocompare.com/data/v2/histoday?fsym=BTC&tsym=USD&allData=true", 12000, key ? { authorization: "Apikey " + key } : {});
  return { source: "CryptoCompare", data: tidy(d.Data.Data.map(x => [x.time * 1000, x.close])) };
}
async function bitstamp() {
  const t0 = 1313366400, now = Math.floor(Date.now() / 1000), starts = [];
  for (let s = t0; s < now; s += 1000 * DAY) starts.push(s);
  const parts = await Promise.all(starts.map(s => j(`https://www.bitstamp.net/api/v2/ohlc/btcusd/?step=${DAY}&limit=1000&start=${s}`)));
  const rows = parts.flatMap(p => ((p.data && p.data.ohlc) || []).map(c => [+c.timestamp * 1000, +c.close]));
  return { source: "Bitstamp", data: tidy(rows) };
}
async function blockchain() {
  const d = await j("https://api.blockchain.info/charts/market-price?timespan=all&format=json&cors=true", 12000);
  return { source: "Blockchain.com", data: tidy(d.values.map(v => [v.x * 1000, v.y])) };
}
async function gecko() {
  const d = await j("https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=365&interval=daily");
  return { source: "CoinGecko (last 12 months only)", data: tidy(d.prices.map(p => [p[0], p[1]])), short: true };
}
const good = o => o && o.data.length >= 1000 && Date.now() - o.data[o.data.length - 1][0] < 5 * DAY * 1000;

module.exports = async (req, res) => {
  let out = null;
  for (const fn of [cryptocompare, bitstamp, blockchain]) {
    try { const o = await fn(); if (good(o)) { out = o; break; } } catch (e) {}
  }
  if (!out) { try { out = await gecko(); } catch (e) {} }
  if (!out || !out.data.length) { res.setHeader("Cache-Control", "no-store"); return res.status(502).json({ error: "History unavailable" }); }
  // A short fallback is only cached briefly so the full history comes back as soon as a long source recovers.
  res.setHeader("Cache-Control", out.short ? "public, s-maxage=300" : "public, s-maxage=21600, stale-while-revalidate=86400");
  res.status(200).json({ source: out.source, data: out.data });
};
