// Average list of a community archetype vs. what you own.
// Usage: node tools/archlist.js . <Color> <ArchetypeName> [minPct=15]
const fs = require("fs"), path = require("path");
const [P, color, archName, minArg] = process.argv.slice(2);
const minPct = Number(minArg || 15) / 100;
const C = JSON.parse(fs.readFileSync(path.join(P, "data/cards.json")));
const D = JSON.parse(fs.readFileSync(path.join(P, "data/decks.json")));
const COLL = JSON.parse(fs.readFileSync(path.join(P, "data/collection.json")));
const own = COLL.cards;
const colors = (c) => String(c?.color || "").split(/[\/,]/).map((s) => s.trim());
const seen = new Map();
for (const d of (Array.isArray(D) ? D : D.decks)) { const k = JSON.stringify(Object.entries(d.cards).sort()); if (!seen.has(k) || seen.get(k).publishedAt < d.publishedAt) seen.set(k, d); }
const U = [...seen.values()];
function mainColor(d) { const t = {}; for (const [id, n] of Object.entries(d.cards)) { const c = C[id]; if (!c || c.type === "Digi-Egg") continue; for (const col of colors(c)) t[col] = (t[col] || 0) + n; } return Object.entries(t).sort((a, b) => b[1] - a[1])[0]?.[0]; }
function arch(d) { let best = null, bs = -1; for (const min of [6, 5]) { for (const [id, n] of Object.entries(d.cards)) { const c = C[id]; if (c?.type !== "Digimon" || !(c.level >= min)) continue; const s = c.level + 1.5 * n; if (s > bs) { bs = s; best = c.name; } } if (best) break; } return best; }
const ds = U.filter((d) => mainColor(d) === color && arch(d) === archName);
const u = {};
for (const d of ds) for (const [id, n] of Object.entries(d.cards)) { const x = (u[id] ||= { i: 0, c: 0 }); x.i++; x.c += n; }
const kind = (c) => c.type === "Digi-Egg" ? "Egg" : c.type === "Digimon" ? "L" + c.level : c.type;
const ord = (c) => c.type === "Digi-Egg" ? 0 : c.type === "Digimon" ? c.level : c.type === "Tamer" ? 8 : 9;
console.log(`${color} ${archName}: ${ds.length} decks`);
const rows = Object.entries(u).map(([id, x]) => ({ id, c: C[id], pct: x.i / ds.length, avg: x.c / x.i })).filter((r) => r.c && r.pct >= minPct)
  .sort((a, b) => ord(a.c) - ord(b.c) || b.pct - a.pct);
for (const r of rows) {
  const t = String(r.c.text?.effect || "").replace(/\s+/g, " ").slice(0, 110);
  const inh = r.c.text?.digivolveEffect ? " |I: " + String(r.c.text.digivolveEffect).replace(/\s+/g, " ").slice(0, 70) : "";
  console.log(`${kind(r.c).padEnd(6)} ${r.id.padEnd(8)} ${r.c.name.slice(0, 22).padEnd(22)} ${(Math.round(r.pct * 100) + "%").padStart(4)} x${r.avg.toFixed(1)} own${own[r.id] || 0} ${r.c.rarity}${r.c.restriction ? " RESTR" : ""} | ${t}${inh}`);
}
