// Tiny Upstash Redis helper shared by the API functions. Files starting with "_" are not exposed as routes.
// Used for the leaderboard and for keeping a "last good copy" of prices, history and headlines.
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOK = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const on = () => !!(URL_ && TOK);

async function cmd(cmds, ms = 5000) {
  if (!on()) throw new Error("database not configured");
  const c = new AbortController(), t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(URL_ + "/pipeline", { method: "POST", signal: c.signal, headers: { Authorization: "Bearer " + TOK, "content-type": "application/json" }, body: JSON.stringify(cmds.map(x => x.map(String))) });
    const out = await r.json().catch(() => null);
    if (!r.ok) throw new Error("database " + r.status + (out && out.error ? ": " + out.error : ""));
    const bad = Array.isArray(out) && out.find(x => x && x.error);
    if (bad) throw new Error(bad.error);
    return out.map(x => x.result);
  } finally { clearTimeout(t); }
}
async function getJSON(key) { if (!on()) return null; try { const [v] = await cmd([["GET", key]], 3000); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
async function setJSON(key, val, ttl) { if (!on()) return false; try { await cmd([["SET", key, JSON.stringify(val), "EX", ttl]], 4000); return true; } catch (e) { return false; } }
module.exports = { on, cmd, getJSON, setJSON };
