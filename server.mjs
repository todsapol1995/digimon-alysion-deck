// Tiny local server: serves ./public and ./data, POST /api/refresh re-syncs from alysioncards.com
import http from "node:http";
import { readFile, writeFile, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { sync } from "./sync.mjs";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png" };
const HOUR = 60 * 60 * 1000;
let syncing = null;
let lastSync = 0;

// One sync at a time; maxAgeMs skips the sync if data is fresher than that
async function runSync(maxAgeMs = 0) {
  if (maxAgeMs && Date.now() - lastSync < maxAgeMs) return { skipped: true, syncedAt: lastSync };
  syncing ||= sync(() => {})
    .then((r) => { lastSync = Date.now(); console.log(`[${new Date().toLocaleString()}] synced ${r.decks} decks`); return { ...r, syncedAt: lastSync }; })
    .finally(() => (syncing = null));
  return syncing;
}

// --idle-exit=<minutes>: shut down after that long with no requests (used by the click-to-open launcher).
// An open tab re-syncs every 60 min, so 90 min keeps the server alive while the page is open.
const idleArg = process.argv.find((a) => a.startsWith("--idle-exit="));
const IDLE_MS = idleArg ? Number(idleArg.split("=")[1]) * 60 * 1000 : 0;
let lastRequest = Date.now();
if (IDLE_MS) setInterval(() => {
  if (Date.now() - lastRequest > IDLE_MS) { console.log(`[${new Date().toLocaleString()}] idle, shutting down`); process.exit(0); }
}, 60 * 1000);

const server = http.createServer(async (req, res) => {
  lastRequest = Date.now();
  const url = new URL(req.url, "http://localhost");
  try {
    if (url.pathname === "/api/refresh" && req.method === "POST") {
      const maxAge = Number(url.searchParams.get("maxAge")) || 0; // seconds
      const result = await runSync(maxAge * 1000);
      res.writeHead(200, { "Content-Type": TYPES[".json"] });
      return res.end(JSON.stringify(result));
    }
    // Save the user's card collection (edited with +/- on the "การ์ดของฉัน" tab)
    if (url.pathname === "/api/collection" && req.method === "PUT") {
      let raw = "";
      for await (const chunk of req) { raw += chunk; if (raw.length > 200_000) throw new Error("body too large"); }
      const body = JSON.parse(raw);
      const cards = {};
      for (const [id, n] of Object.entries(body.cards || {})) {
        if (/^[A-Za-z0-9-]{2,20}$/.test(id) && Number.isInteger(n) && n > 0 && n < 100) cards[id] = n;
      }
      const colorsEntered = (Array.isArray(body.colorsEntered) ? body.colorsEntered : []).filter((c) => /^[A-Za-z]{2,12}$/.test(c));
      const craftCost = {};
      for (const [r, v] of Object.entries(body.craftCost || {})) if (/^[A-Z]{1,4}$/.test(r) && Number.isInteger(v) && v > 0 && v < 1e7) craftCost[r] = v;
      const out = { updatedAt: new Date().toISOString().slice(0, 10), colorsEntered, craftCost, cards };
      await writeFile(path.join(ROOT, "data", "collection.json"), JSON.stringify(out, null, 1));
      res.writeHead(200, { "Content-Type": TYPES[".json"] });
      return res.end(JSON.stringify({ ok: true, cards: Object.keys(cards).length }));
    }
    let rel = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
    const base = rel.startsWith("/data/") ? ROOT : path.join(ROOT, "public");
    const file = path.normalize(path.join(base, rel));
    if (!file.startsWith(base)) throw Object.assign(new Error("bad path"), { code: "ENOENT" });
    const body = await readFile(file);
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(body);
  } catch (e) {
    res.writeHead(e.code === "ENOENT" ? 404 : 500, { "Content-Type": "text/plain" });
    res.end(e.code === "ENOENT" ? "Not found" : String(e.message || e));
  }
});

// On start: wait for a sync only if there is no data yet, otherwise sync in the background
let hasData = true;
try { await access(path.join(ROOT, "data", "decks.json")); } catch { hasData = false; }
if (hasData) runSync().catch((e) => console.error("sync failed:", e.message));
else await runSync();
// Then every hour
setInterval(() => runSync().catch((e) => console.error("sync failed:", e.message)), HOUR);

server.listen(PORT, () => console.log(`Deck analyzer running at http://localhost:${PORT}`));
