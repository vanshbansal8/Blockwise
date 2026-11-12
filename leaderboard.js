// Vercel serverless function: /api/leaderboard
//   GET    ?period=week|month|all  -> { configured, period, label, top: [{ name, ret }] }
//   POST   { name, value, token, consent, wk, mk, wbase, mbase }  submit a score
//   POST   { action: "report", name, token }                       report a nickname
//   DELETE { name, token }                                         remove your own entry
// Boards: "week" and "month" rank each player's GAIN during that period (so newcomers can compete);
// "all" ranks total return since the $10,000 start. Only a player's best score per board is kept.
const kv = require("./_kv");
const crypto = require("crypto");
const KEY = "bw:lb", OWN = "bw:owners", HID = "bw:hidden";

function periods(now = new Date()) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const mon = new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 864e5);
  const w = mon.toISOString().slice(0, 10), m = d.toISOString().slice(0, 7);
  return { w, m, keys: { all: KEY, week: KEY + ":w:" + w, month: KEY + ":m:" + m } };
}

// ---- nickname moderation (simple filter + a report button as the second line of defence) ----
const BAD_SUB = ["fuck", "fck", "fvck", "fock", "shit", "bitch", "bastard", "cunt", "nigg", "fagg", "retard", "whore", "slut", "motherfuck", "asshole", "dickhead", "chutiya", "chutiye", "madarchod", "bhenchod", "behenchod", "bhosd"];
const BAD_WORD = ["nazi", "rape", "rapist", "dick", "cock", "porn", "sex", "anal", "pedo", "pedophile", "hitler", "kkk", "gandu", "harami", "gaand", "kutta", "kamina"];
const RESERVED = /\b(admin|administrator|moderator|official|support|staff)\b/i;
function blocked(name) {
  const l = name.toLowerCase().replace(/0/g, "o").replace(/1/g, "i").replace(/3/g, "e").replace(/4/g, "a").replace(/5/g, "s").replace(/7/g, "t").replace(/\$/g, "s");
  const compact = l.replace(/[^a-z]/g, ""), words = l.split(/[^a-z]+/).filter(Boolean);
  const col = x => x.replace(/(.)\1+/g, "$1"), cc = col(compact); // also catches stretched spellings like "fuuuck"
  return BAD_SUB.some(w => compact.includes(w) || cc.includes(col(w))) || words.some(w => BAD_WORD.includes(w)) || RESERVED.test(name) || /\d{7,}/.test(name) || /\.(com|in|cc|io|xyz|net|org|me)\b/i.test(name);
}

const NAME_RE = /^[A-Za-z0-9 _.-]{2,16}$/, TOKEN_RE = /^[a-f0-9]{32,64}$/;
const sha = t => crypto.createHash("sha256").update(t).digest("hex");
const parse = req => (typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {}));
const r2 = x => Math.round(x * 100) / 100;
async function limited(req, res, max, tag = "") {
  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
  const [n] = await kv.cmd([["INCR", "bw:rl:" + tag + ip], ["EXPIRE", "bw:rl:" + tag + ip, 60]]);
  if (n > max) { res.status(429).json({ error: "Too many requests. Try again in a minute." }); return true; }
  return false;
}

async function submit(b, req, res) {
  const name = String(b.name || "").trim(), value = Number(b.value), token = String(b.token || "");
  if (!NAME_RE.test(name)) return res.status(400).json({ error: "Invalid nickname" });
  if (blocked(name)) return res.status(400).json({ error: "That nickname isn't allowed. Please choose another." });
  if (b.consent !== true) return res.status(400).json({ error: "Please tick the consent box to publish your nickname and score." });
  if (!TOKEN_RE.test(token)) return res.status(400).json({ error: "Please refresh the page and try again." });
  if (!isFinite(value) || value <= 0 || value > 1e6) return res.status(400).json({ error: "Invalid score" });
  if (await limited(req, res, 5)) return;
  const hash = sha(token), lname = name.toLowerCase();
  const [, owner] = await kv.cmd([["HSETNX", OWN, lname, hash + "|" + name], ["HGET", OWN, lname]]);
  if (!String(owner).startsWith(hash + "|")) return res.status(409).json({ error: "That nickname is already taken. Please choose another." });
  const display = String(owner).slice(65), P = periods();
  const cmds = [["ZADD", P.keys.all, "GT", r2((value - 10000) / 100), display], ["ZREMRANGEBYRANK", P.keys.all, 0, -501]];
  const wb = Number(b.wbase), mb = Number(b.mbase);
  if (b.wk === P.w && wb > 0 && wb <= 1e6) cmds.push(["ZADD", P.keys.week, "GT", r2((value - wb) / wb * 100), display], ["EXPIRE", P.keys.week, 1209600]);
  if (b.mk === P.m && mb > 0 && mb <= 1e6) cmds.push(["ZADD", P.keys.month, "GT", r2((value - mb) / mb * 100), display], ["EXPIRE", P.keys.month, 5184000]);
  await kv.cmd(cmds);
  return res.status(200).json({ ok: true });
}

async function report(b, req, res) {
  const name = String(b.name || "").trim(), token = String(b.token || "");
  if (!NAME_RE.test(name) || !TOKEN_RE.test(token)) return res.status(400).json({ error: "Invalid request" });
  if (await limited(req, res, 10, "r:")) return;
  const hash = sha(token), lname = name.toLowerCase();
  const [owner] = await kv.cmd([["HGET", OWN, lname]]);
  if (!owner) return res.status(404).json({ error: "That player was not found." });
  if (String(owner).startsWith(hash + "|")) return res.status(400).json({ error: "You can't report your own nickname." });
  // One vote per device (stored as a one-way hash for 30 days). Three different devices hide the name until reviewed.
  const [, , count] = await kv.cmd([["SADD", "bw:rep:" + lname, hash], ["EXPIRE", "bw:rep:" + lname, 2592000], ["SCARD", "bw:rep:" + lname]]);
  if (+count >= 3) await kv.cmd([["SADD", HID, lname]]);
  return res.status(200).json({ ok: true });
}

async function remove(b, res) {
  const name = String(b.name || "").trim(), token = String(b.token || "");
  if (!NAME_RE.test(name) || !TOKEN_RE.test(token)) return res.status(400).json({ error: "Invalid request" });
  const hash = sha(token), lname = name.toLowerCase();
  const [owner] = await kv.cmd([["HGET", OWN, lname]]);
  if (!owner || !String(owner).startsWith(hash + "|")) return res.status(403).json({ error: "That entry does not belong to this device." });
  const P = periods(), display = String(owner).slice(65);
  await kv.cmd([["ZREM", P.keys.all, display], ["ZREM", P.keys.week, display], ["ZREM", P.keys.month, display], ["HDEL", OWN, lname]]);
  return res.status(200).json({ ok: true });
}

async function list(req, res) {
  const p = ["week", "month", "all"].includes(req.query && req.query.period) ? req.query.period : "week", P = periods();
  const [raw, hid] = await kv.cmd([["ZREVRANGE", P.keys[p], 0, 39, "WITHSCORES"], ["SMEMBERS", HID]]);
  const hidden = new Set((hid || []).map(x => String(x).toLowerCase())), top = [];
  for (let i = 0; i < (raw || []).length; i += 2) if (!hidden.has(String(raw[i]).toLowerCase())) top.push({ name: raw[i], ret: +raw[i + 1] });
  const label = p === "week" ? "Week of " + new Date(P.w + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
    : p === "month" ? new Date(P.m + "-01T00:00:00Z").toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }) : "All time";
  res.setHeader("Cache-Control", "public, s-maxage=10, stale-while-revalidate=30");
  return res.status(200).json({ configured: true, period: p, label, top: top.slice(0, 20) });
}

module.exports = async (req, res) => {
  if (!kv.on()) {
    res.setHeader("Cache-Control", "no-store");
    if (req.method === "POST" || req.method === "DELETE") return res.status(503).json({ configured: false, error: "Leaderboard is not set up yet" });
    return res.status(200).json({ configured: false, top: [] });
  }
  try {
    if (req.method === "POST") { const b = parse(req); return b.action === "report" ? await report(b, req, res) : await submit(b, req, res); }
    if (req.method === "DELETE") return await remove(parse(req), res);
    return await list(req, res);
  } catch (e) {
    return res.status(502).json({ error: "Leaderboard error: " + String((e && e.message) || e).slice(0, 140) });
  }
};
