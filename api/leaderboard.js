// Vercel serverless function: /api/leaderboard
// GET  -> { configured, top: [{ name, ret }] }   (best return % per player, top 20)
// POST -> { name, value }  submits a portfolio value; only a player's BEST score is kept.
// Storage: Upstash Redis (add it from Vercel > Storage). Without it the site works and the leaderboard says "not switched on yet".
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOK = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const KEY = "bw:lb";

async function redis(cmds) {
  const r = await fetch(URL_ + "/pipeline", { method: "POST", headers: { Authorization: "Bearer " + TOK, "content-type": "application/json" }, body: JSON.stringify(cmds) });
  if (!r.ok) throw new Error("redis " + r.status);
  return (await r.json()).map(x => x.result);
}

module.exports = async (req, res) => {
  if (!URL_ || !TOK) {
    res.setHeader("Cache-Control", "no-store");
    if (req.method === "POST") return res.status(503).json({ configured: false, error: "Leaderboard is not set up yet" });
    return res.status(200).json({ configured: false, top: [] });
  }
  try {
    if (req.method === "POST") {
      const b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      const name = String(b.name || "").trim(), value = Number(b.value);
      if (!/^[A-Za-z0-9 _.-]{2,16}$/.test(name)) return res.status(400).json({ error: "Invalid nickname" });
      if (!isFinite(value) || value <= 0 || value > 1e6) return res.status(400).json({ error: "Invalid score" });
      const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
      const [n] = await redis([["INCR", "bw:rl:" + ip], ["EXPIRE", "bw:rl:" + ip, 60]]);
      if (n > 5) return res.status(429).json({ error: "Too many submissions. Try again in a minute." });
      const ret = Math.round((value - 10000) / 10000 * 10000) / 100;
      await redis([["ZADD", KEY, "GT", ret, name], ["ZREMRANGEBYRANK", KEY, 0, -501]]);
      return res.status(200).json({ ok: true });
    }
    const [raw] = await redis([["ZREVRANGE", KEY, 0, 19, "WITHSCORES"]]);
    const top = [];
    for (let i = 0; i < (raw || []).length; i += 2) top.push({ name: raw[i], ret: +raw[i + 1] });
    res.setHeader("Cache-Control", "public, s-maxage=10, stale-while-revalidate=30");
    res.status(200).json({ configured: true, top });
  } catch (e) {
    res.status(502).json({ error: "Leaderboard unavailable" });
  }
};
