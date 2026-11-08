// Vercel serverless function: /api/leaderboard
// GET  -> { configured, top: [{ name, ret }] }   (best return % per player, top 20)
// POST -> { name, value }  submits a portfolio value; only a player's BEST score is kept.
// Storage: Upstash Redis (add it from Vercel > Storage). Without it the site works and the leaderboard says "not switched on yet".
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOK = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const KEY = "bw:lb";
const OWN = "bw:owners"; // nickname (lowercase) -> sha256(secret token) + "|" + display name
const crypto = require("crypto");

async function redis(cmds) {
  const r = await fetch(URL_ + "/pipeline", { method: "POST", headers: { Authorization: "Bearer " + TOK, "content-type": "application/json" }, body: JSON.stringify(cmds.map(c => c.map(String))) });
  const out = await r.json().catch(() => null);
  if (!r.ok) throw new Error("database " + r.status + (out && out.error ? ": " + out.error : ""));
  const bad = Array.isArray(out) && out.find(x => x && x.error);
  if (bad) throw new Error(bad.error);
  return out.map(x => x.result);
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
      const name = String(b.name || "").trim(), value = Number(b.value), token = String(b.token || "");
      if (!/^[A-Za-z0-9 _.-]{2,16}$/.test(name)) return res.status(400).json({ error: "Invalid nickname" });
      if (!/^[a-f0-9]{32,64}$/.test(token)) return res.status(400).json({ error: "Please refresh the page and try again." });
      if (!isFinite(value) || value <= 0 || value > 1e6) return res.status(400).json({ error: "Invalid score" });
      const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
      const [n] = await redis([["INCR", "bw:rl:" + ip], ["EXPIRE", "bw:rl:" + ip, 60]]);
      if (n > 5) return res.status(429).json({ error: "Too many submissions. Try again in a minute." });
      const ret = Math.round((value - 10000) / 10000 * 10000) / 100;
      // Nickname ownership: the first device to use a name claims it; only that device can update it.
      const hash = crypto.createHash("sha256").update(token).digest("hex");
      const [, owner] = await redis([["HSETNX", OWN, name.toLowerCase(), hash + "|" + name], ["HGET", OWN, name.toLowerCase()]]);
      if (!String(owner).startsWith(hash + "|")) return res.status(409).json({ error: "That nickname is already taken. Please choose another." });
      const display = String(owner).slice(65);
      await redis([["ZADD", KEY, "GT", ret, display], ["ZREMRANGEBYRANK", KEY, 0, -501]]);
      return res.status(200).json({ ok: true });
    }
    const [raw] = await redis([["ZREVRANGE", KEY, 0, 19, "WITHSCORES"]]);
    const top = [];
    for (let i = 0; i < (raw || []).length; i += 2) top.push({ name: raw[i], ret: +raw[i + 1] });
    res.setHeader("Cache-Control", "public, s-maxage=10, stale-while-revalidate=30");
    res.status(200).json({ configured: true, top });
  } catch (e) {
    res.status(502).json({ error: "Leaderboard error: " + String((e && e.message) || e).slice(0, 140) });
  }
};
