// /api/health : cheap status check for an uptime monitor. Makes no calls to price sources.
const kv = require("./_kv");
module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const out = { ok: true, database: kv.on() ? "configured" : "not configured" };
  if (kv.on()) {
    try {
      const [m, h, n] = await Promise.all([kv.getJSON("bw:last:markets"), kv.getJSON("bw:last:history"), kv.getJSON("bw:last:news")]);
      const age = t => (t ? Math.round((Date.now() - t) / 1000) : null);
      out.lastGoodSecondsAgo = { markets: age(m && m.t), news: age(n && n.t), history: h ? "saved" : null };
    } catch (e) { out.ok = false; out.database = "error"; }
  }
  res.status(out.ok ? 200 : 503).json(out);
};
