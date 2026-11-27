// Usage: node dump.js <projectDir> <color>  โ€” compact table of owned cards of a colour with effects
const fs = require("fs"), path = require("path");
const [P, color] = process.argv.slice(2);
const C = JSON.parse(fs.readFileSync(path.join(P, "data/cards.json")));
const own = JSON.parse(fs.readFileSync(path.join(P, "data/collection.json"))).cards;
const A = JSON.parse(fs.readFileSync(path.join(__dirname, "analysis.json")))[color];
const pct = Object.fromEntries(A.owned.map((o) => [o.id, o.pct + "%" + o.st]));
const t = (s, n) => String(s || "").replace(/\s+/g, " ").replace(/๏ผ|๏ผ/g, "").slice(0, n);
const rows = Object.keys(own).filter((id) => String(C[id]?.color).includes(color)).sort((a, b) => {
  const o = (c) => ({ "Digi-Egg": 0, Digimon: 1, Tamer: 2, Option: 3 }[c.type]);
  return o(C[a]) - o(C[b]) || (C[a].level || 0) - (C[b].level || 0) || a.localeCompare(b);
});
for (const id of rows) {
  const c = C[id], x = c.text || {};
  const evo = (c.evo || []).map((e) => `${e.color[0]}${e.level}:${e.cost}`).join(",");
  const e = `${t(x.effect, 170)}${x.digivolveEffect ? " |I: " + t(x.digivolveEffect, 90) : ""}`;
  console.log(`${own[id]}x ${id} ${c.name} ${c.type === "Digimon" ? "L" + c.level : c.type[0]} ${c.rarity} c${c.playCost || "-"} ${c.dp || ""}${evo ? " e" + evo : ""} ${pct[id] || ""}${c.restriction ? " RESTR" : ""}${e ? "\n  " + e : ""}`);
}

