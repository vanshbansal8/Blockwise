// Vercel serverless function: /api/chart?days=1|7|30|365  -> { prices: [[timestampMs, usd], ...] }
async function j(url, ms = 7000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, { signal: c.signal, headers: { accept: "application/json", "user-agent": "blockwise/1.0" } });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}

function thin(a, n = 240) {
  if (a.length <= n) return a;
  const step = a.length / n;
  return Array.from({ length: n }, (_, i) => a[Math.floor(i * step)]).concat([a[a.length - 1]]);
}

async function gecko(days) {
  const d = await j(`https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=${days}`);
  if (!d.prices || !d.prices.length) throw new Error("empty");
  return d.prices;
}

async function compare(days) {
  const hourly = days <= 30;
  const limit = days === 1 ? 24 : days === 7 ? 168 : days === 30 ? 720 : 365;
  const d = await j(`https://min-api.cryptocompare.com/data/v2/${hourly ? "histohour" : "histoday"}?fsym=BTC&tsym=USD&limit=${limit}`);
  return d.Data.Data.map(x => [x.time * 1000, x.close]);
}

module.exports = async (req, res) => {
  const days = [1, 7, 30, 365].includes(+req.query.days) ? +req.query.days : 7;
  let prices;
  try { prices = await gecko(days); } catch (e) {
    try { prices = await compare(days); } catch (e2) {
      res.setHeader("Cache-Control", "no-store");
      return res.status(502).json({ error: "Chart unavailable" });
    }
  }
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=900");
  res.status(200).json({ days, prices: thin(prices) });
};
