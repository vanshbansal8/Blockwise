// Vercel serverless function: /api/history -> { source, data: [[timestampMs, closeUsd], ...] } daily BTC closes
// Used by the "What if I had invested" calculator. Cached for 6 hours so it costs almost nothing.
async function j(url, ms = 9000) {
  const c = new AbortController(), t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, { signal: c.signal, headers: { accept: "application/json", "user-agent": "blockwise/1.0" } });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}
async function cryptocompare() {
  const d = await j("https://min-api.cryptocompare.com/data/v2/histoday?fsym=BTC&tsym=USD&allData=true");
  const rows = d.Data.Data.filter(x => x.close > 0).map(x => [x.time * 1000, x.close]);
  if (rows.length < 100) throw new Error("short");
  return { source: "CryptoCompare", data: rows };
}
async function gecko() {
  const d = await j("https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=365&interval=daily");
  return { source: "CoinGecko (last 12 months only)", data: d.prices.map(p => [p[0], p[1]]) };
}
module.exports = async (req, res) => {
  let out;
  try { out = await cryptocompare(); } catch (e) { try { out = await gecko(); } catch (e2) {
    res.setHeader("Cache-Control", "no-store"); return res.status(502).json({ error: "History unavailable" }); } }
  res.setHeader("Cache-Control", "public, s-maxage=21600, stale-while-revalidate=86400");
  res.status(200).json(out);
};
