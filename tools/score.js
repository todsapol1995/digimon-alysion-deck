// Card value table for one colour (for incomplete recommended decks).
// Usage: node tools/score.js . <Color> [--all]   (--all = also cards with 0% use)
// Columns: ours/own, colour% (deduped decks of that main colour), arch% (decks of the deck's `arch` list, combined),
// per-archetype %, typical copies (most common count among decks that run it), ★ staple note.
// score = colour% + arch% + 30 if staple — a starting point only; combos and the path to the complete
// archetype are judged by hand (see SKILL.md rebuild-decks).
const fs = require("fs"), path = require("path");
const P = process.argv[2] || ".", color = process.argv[3], ALL = process.argv.includes("--all");
const C = JSON.parse(fs.readFileSync(path.join(P, "data/cards.json")));
const D = JSON.parse(fs.readFileSync(path.join(P, "data/decks.json")));
const own = JSON.parse(fs.readFileSync(path.join(P, "data/collection.json"))).cards;
const ST = (() => { try { return JSON.parse(fs.readFileSync(path.join(P, "data/staples.json"))); } catch { return {}; } })();
const stap = ST.cards || ST;
process.argv[2] = P;
const DK = require(path.join(path.resolve(P), "tools/decks.js"))[color];
const colors = c => String(c?.color || "").split(/[\/,]/).map(s => s.trim());
const seen = new Map();
for (const d of (Array.isArray(D) ? D : D.decks)) { const k = JSON.stringify(Object.entries(d.cards).sort()); if (!seen.has(k) || seen.get(k).publishedAt < d.publishedAt) seen.set(k, d); }
const U = [...seen.values()];
function mainColor(d) { const t = {}; for (const [id, n] of Object.entries(d.cards)) { const c = C[id]; if (!c || c.type === "Digi-Egg") continue; for (const col of colors(c)) t[col] = (t[col] || 0) + n; } return Object.entries(t).sort((a, b) => b[1] - a[1])[0]?.[0]; }
function arch(d) { let best = null, bs = -1; for (const min of [6, 5]) { for (const [id, n] of Object.entries(d.cards)) { const c = C[id]; if (c?.type !== "Digimon" || !(c.level >= min)) continue; const s = c.level + 1.5 * n; if (s > bs) { bs = s; best = c.name; } } if (best) break; } return best; }
const col = U.filter(d => mainColor(d) === color);
const archs = DK?.arch || [];
const byArch = Object.fromEntries(archs.map(a => [a, col.filter(d => arch(d) === a)]));
const archAll = Object.values(byArch).flat();
const pct = (ds, id) => ds.length ? ds.filter(d => d.cards[id]).length / ds.length : 0;
const typ = (ds, id) => { const h = {}; for (const d of ds) if (d.cards[id]) h[d.cards[id]] = (h[d.cards[id]] || 0) + 1; const e = Object.entries(h).sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]; return e ? e[0] : "-"; };
const used = { ...(DK?.egg || {}), ...(DK?.main || {}) };
const ids = new Set([...Object.keys(own).filter(id => colors(C[id]).includes(color)), ...Object.keys(used)]);
const kind = c => c.type === "Digi-Egg" ? "Egg" : c.type === "Digimon" ? "L" + c.level : c.type;
const ord = c => c.type === "Digi-Egg" ? 0 : c.type === "Digimon" ? +c.level : c.type === "Tamer" ? 8 : 9;
const rows = [...ids].filter(id => C[id] && own[id]).map(id => {
  const s = stap[id], cp = pct(col, id), ap = pct(archAll, id);
  return { id, c: C[id], cp, ap, s, score: Math.round(100 * cp + 100 * ap + (s ? 30 : 0)) };
}).filter(r => ALL || r.score > 0 || used[r.id]).sort((a, b) => ord(a.c) - ord(b.c) || b.score - a.score);
console.log(`${color}: colour ${col.length} decks | arch ${archs.map(a => `${a} ${byArch[a].length}`).join(", ")}`);
console.log("kind   id       name                 ours/own col% arch% typ  score " + archs.map(a => a.slice(0, 8).padStart(8)).join(" ") + "  staple");
for (const r of rows) {
  const note = r.s ? "★ " + (Array.isArray(r.s) ? r.s.map(x => x.note).join("; ") : r.s.note || "") : "";
  console.log(`${kind(r.c).padEnd(6)} ${r.id.padEnd(8)} ${r.c.name.slice(0, 20).padEnd(20)} ${String(used[r.id] || 0).padStart(4)}/${own[r.id]}  ${String(Math.round(100 * r.cp)).padStart(3)}% ${String(Math.round(100 * r.ap)).padStart(4)}%  x${typ(col, r.id).padEnd(2)} ${String(r.score).padStart(4)}  ` +
    archs.map(a => (Math.round(100 * pct(byArch[a], r.id)) + "%").padStart(8)).join(" ") + "  " + note.slice(0, 60));
}
