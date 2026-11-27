// Upgrade suggestions per deck: cards common in the matching community archetype that the user lacks.
const fs = require("fs"), path = require("path");
const P = process.argv[2];
const C = JSON.parse(fs.readFileSync(path.join(P, "data/cards.json")));
const D = JSON.parse(fs.readFileSync(path.join(P, "data/decks.json")));
const COLL = JSON.parse(fs.readFileSync(path.join(P, "data/collection.json")));
const own = COLL.cards, price = COLL.craftCost;
const DECKS = require("./decks.js");
const colors = (c) => String(c?.color || "").split(/[\/,]/).map((s) => s.trim());
const seen = new Map();
for (const d of (Array.isArray(D) ? D : D.decks)) { const k = JSON.stringify(Object.entries(d.cards).sort()); if (!seen.has(k) || seen.get(k).publishedAt < d.publishedAt) seen.set(k, d); }
const U = [...seen.values()];
function mainColor(d) { const t = {}; for (const [id, n] of Object.entries(d.cards)) { const c = C[id]; if (!c || c.type === "Digi-Egg") continue; for (const col of colors(c)) t[col] = (t[col] || 0) + n; } return Object.entries(t).sort((a, b) => b[1] - a[1])[0]?.[0]; }
function arch(d) { let best = null, bs = -1; for (const min of [6, 5]) { for (const [id, n] of Object.entries(d.cards)) { const c = C[id]; if (c?.type !== "Digimon" || !(c.level >= min)) continue; const s = c.level + 1.5 * n; if (s > bs) { bs = s; best = c.name; } } if (best) break; } return best; }
for (const [col, dk] of Object.entries(DECKS)) {
  const ds = U.filter((d) => mainColor(d) === col && dk.arch.includes(arch(d)));
  const u = {}; for (const d of ds) for (const [id, n] of Object.entries(d.cards)) { const x = (u[id] ||= { i: 0, c: 0 }); x.i++; x.c += n; }
  const inDeck = { ...dk.main, ...dk.egg };
  const ups = Object.entries(u).map(([id, x]) => ({ id, pct: x.i / ds.length, avg: Math.round(x.c / x.i) }))
    .filter((x) => x.pct >= 0.4 && C[x.id]).map((x) => ({ ...x, need: Math.max(0, Math.min(C[x.id].restriction === "Banned" ? 0 : C[x.id].restriction ? 1 : 4, x.avg) - Math.min(own[x.id] || 0, 4)) }))
    .filter((x) => x.need > 0).sort((a, b) => b.pct - a.pct).slice(0, 10);
  let cp = 0, coin = 0;
  console.log(`\n## ${col} (${ds.length} community decks: ${dk.arch.join("/")})`);
  for (const x of ups) {
    const c = C[x.id], v = price[c.rarity] || 0, isCoin = c.rarity === "P";
    isCoin ? (coin += v * x.need) : (cp += v * x.need);
    console.log(`${x.need}x ${x.id} ${c.name} ${c.type === "Digimon" ? "L" + c.level : c.type} ${c.rarity} ${Math.round(x.pct * 100)}% have${own[x.id] || 0} ${v * x.need}${isCoin ? "coin" : "CP"} ${c.pack || ""} | ${String(c.text?.effect || "").replace(/\s+/g, " ").slice(0, 110)}`);
  }
  console.log(`TOTAL ${cp} CP ${coin} coin`);
}
