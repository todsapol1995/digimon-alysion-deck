// Usage: node build.js <projectDir>
const fs = require("fs"), path = require("path");
const P = process.argv[2];
const C = JSON.parse(fs.readFileSync(path.join(P, "data/cards.json")));
const D = JSON.parse(fs.readFileSync(path.join(P, "data/decks.json")));
const COLL = JSON.parse(fs.readFileSync(path.join(P, "data/collection.json")));
let ST = {}; try { ST = JSON.parse(fs.readFileSync(path.join(P, "data/staples.json"))); } catch {}
const stapleIds = new Set(JSON.stringify(ST).match(/[A-Z]{2}\d-\d{3}/g) || []);
const decks = (Array.isArray(D) ? D : D.decks);
const own = COLL.cards;
const colors = (c) => String(c?.color || "").split(/[\/,]/).map((s) => s.trim()).filter(Boolean);

// dedupe decks
const seen = new Map();
for (const d of decks) { const k = JSON.stringify(Object.entries(d.cards).sort()); if (!seen.has(k) || seen.get(k).publishedAt < d.publishedAt) seen.set(k, d); }
const U = [...seen.values()];
function mainColor(d) { const t = {}; for (const [id, n] of Object.entries(d.cards)) { const c = C[id]; if (!c || c.type === "Digi-Egg") continue; for (const col of colors(c)) t[col] = (t[col] || 0) + n; } return Object.entries(t).sort((a, b) => b[1] - a[1])[0]?.[0]; }
function arch(d) { let best = null, bs = -1; for (const min of [6, 5]) { for (const [id, n] of Object.entries(d.cards)) { const c = C[id]; if (c?.type !== "Digimon" || !(c.level >= min)) continue; const s = c.level + 1.5 * n; if (s > bs) { bs = s; best = c.name; } } if (best) break; } return best || "?"; }
for (const d of U) { d.mc = mainColor(d); d.arch = arch(d); }

const out = {};
for (const color of ["Red", "Blue", "Yellow", "Green", "Black", "Purple"]) {
  const cd = U.filter((d) => d.mc === color);
  const usage = {}; // id -> {incl, copies}
  for (const d of cd) for (const [id, n] of Object.entries(d.cards)) { const u = (usage[id] ||= { incl: 0, copies: 0 }); u.incl++; u.copies += n; }
  const archs = {};
  for (const d of cd) (archs[d.arch] ||= []).push(d);
  const archStats = Object.entries(archs).map(([a, ds]) => {
    const u = {}; for (const d of ds) for (const [id, n] of Object.entries(d.cards)) { const x = (u[id] ||= { incl: 0, copies: 0 }); x.incl++; x.copies += n; }
    // average list coverage: for each card weight pct*avgCopies; owned covered = min(own, avg)
    let need = 0, have = 0;
    for (const [id, x] of Object.entries(u)) { const pct = x.incl / ds.length; if (pct < 0.5) continue; const avg = Math.round(x.copies / x.incl); need += avg; have += Math.min(own[id] || 0, avg); }
    // best single deck coverage
    let bestDeck = null, bestCov = -1;
    for (const d of ds) { let h = 0, t = 0; for (const [id, n] of Object.entries(d.cards)) { t += n; h += Math.min(own[id] || 0, n); } if (h / t > bestCov) { bestCov = h / t; bestDeck = d; } }
    return { arch: a, n: ds.length, core: have / need, bestCov, bestDeck: bestDeck.name, bestId: bestDeck.id, u };
  }).sort((a, b) => b.n * b.core - a.n * a.core);
  out[color] = { decks: cd.length, archStats: archStats.map(({ u, ...r }) => r) };
  // owned cards of this color with usage
  out[color].owned = Object.entries(own).filter(([id]) => colors(C[id]).includes(color)).map(([id, n]) => {
    const c = C[id], u = usage[id] || { incl: 0, copies: 0 };
    return { id, name: c.name, t: c.type[0], lv: c.level, cost: c.playCost, dp: c.dp, r: c.rarity, own: n, pct: Math.round(100 * u.incl / Math.max(1, cd.length)), avg: u.incl ? +(u.copies / u.incl).toFixed(1) : 0, st: stapleIds.has(id) ? "*" : "", restr: c.restriction || "" };
  }).sort((a, b) => b.pct - a.pct);
}
fs.writeFileSync(path.join(__dirname, "analysis.json"), JSON.stringify(out, null, 1));
for (const [col, o] of Object.entries(out)) {
  console.log(`\n=== ${col} (${o.decks} decks) ===`);
  for (const a of o.archStats.slice(0, 6)) console.log(`  ${a.arch} n=${a.n} core=${(a.core * 100).toFixed(0)}% best=${(a.bestCov * 100).toFixed(0)}% "${a.bestDeck}"`);
}
