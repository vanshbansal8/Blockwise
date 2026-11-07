// Vercel serverless function: /api/markets
// Fetches live prices server-side (no CORS or browser rate-limit problems), tries CoinGecko first,
// falls back to CryptoCompare, and is cached at Vercel's edge for 60s so visitors never hit the APIs directly.
const SYM = { bitcoin: "BTC", ethereum: "ETH", tether: "USDT", binancecoin: "BNB", solana: "SOL", ripple: "XRP", "usd-coin": "USDC", cardano: "ADA", dogecoin: "DOGE", litecoin: "LTC" };
const NAME = { bitcoin: "Bitcoin", ethereum: "Ethereum", tether: "Tether", binancecoin: "BNB", solana: "Solana", ripple: "XRP", "usd-coin": "USD Coin", cardano: "Cardano", dogecoin: "Dogecoin", litecoin: "Litecoin" };

async function j(url, ms = 6000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, { signal: c.signal, headers: { accept: "application/json", "user-agent": "blockwise/1.0" } });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}

async function coingecko() {
  const ids = Object.keys(SYM).join(",");
  const d = await j(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&sparkline=true&price_change_percentage=24h,7d`);
  if (!Array.isArray(d) || !d.length) throw new Error("empty");
  return d.map(c => ({ id: c.id, name: c.name, symbol: c.symbol.toUpperCase(), price: c.current_price, change24h: c.price_change_percentage_24h, change7d: c.price_change_percentage_7d_in_currency, cap: c.market_cap, spark: (c.sparkline_in_7d && c.sparkline_in_7d.price) || [] }));
}

async function cryptocompare() {
  const d = await j(`https://min-api.cryptocompare.com/data/pricemultifull?fsyms=${Object.values(SYM).join(",")}&tsyms=USD`);
  return Object.entries(SYM).filter(([, s]) => d.RAW && d.RAW[s]).map(([id, s]) => {
    const x = d.RAW[s].USD;
    return { id, name: NAME[id], symbol: s, price: x.PRICE, change24h: x.CHANGEPCT24HOUR, change7d: null, cap: x.MKTCAP, spark: [] };
  });
}

async function height() {
  try { const r = await fetch("https://mempool.space/api/blocks/tip/height"); if (r.ok) return +(await r.text()); } catch (e) {}
  const r = await fetch("https://blockstream.info/api/blocks/tip/height");
  return +(await r.text());
}

async function fng() {
  const d = await j("https://api.alternative.me/fng/?limit=1");
  const x = d.data[0];
  return { value: +x.value, label: x.value_classification };
}

module.exports = async (req, res) => {
  const [coins, h, f] = await Promise.all([
    coingecko().catch(() => cryptocompare()).catch(() => null),
    height().catch(() => null),
    fng().catch(() => null),
  ]);
  if (!coins) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(502).json({ error: "Price sources unavailable" });
  }
  res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
  res.status(200).json({ coins, height: h, fng: f, updated: Date.now() });
};
