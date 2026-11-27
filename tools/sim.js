// Goldfish simulator (no opponent) for recommended decks.
// Usage: node tools/sim.js . [Color] [--n=5000] [--deck=<json file with alt DECKS>]
// Measures: opening Lv3, turn reaching Lv5/Lv6, brick turns, and how often "conditional" cards are usable.
// Model (simplified, see README in output): going first, 3 memory budget per turn (+1 per memory Tamer
// in play / Hammer Spark / Jack Raid etc.), hatch egg on T1, digivolve = draw 1, one Lv3 play per turn when
// the board is empty, Tamers played when affordable. From T4 on, one of our Digimon stacks is assumed to be
// traded away every other turn (its cards go to trash) so trash-based cards can be evaluated.
const fs = require("fs"), path = require("path");
const P = process.argv[2] || ".";
const args = Object.fromEntries(process.argv.slice(3).filter(a => a.startsWith("--")).map(a => a.slice(2).split("=")));
const onlyCol = process.argv.slice(3).find(a => !a.startsWith("--"));
const N = +(args.n || 5000);
const C = JSON.parse(fs.readFileSync(path.join(P, "data/cards.json")));
process.argv[2] = P;
const DECKS = args.deck ? require(path.resolve(args.deck)) : require(path.join(path.resolve(P), "tools/decks.js"));

const T = c => (c.text && c.text.effect) || "";
const lvl = c => c.type === "Digimon" ? +c.level : 0;
const canEvo = (card, top) => (card.evo || []).find(e => +e.level === lvl(top) && (e.color === top.color || (top.id === "BT4-017" && e.color === "Yellow")));
const evoCost = (card, top) => { const e = canEvo(card, top); return e ? +e.cost : null; };

// Conditional ("niche") cards: returns true when usable in current state
const COND = {
  "BD3-010": s => s.trash.some(c => /Myotismon/.test(c.name)) && s.mem >= 8,            // Immortal Vampire
  "BT4-115": s => s.trash.length >= 10 || s.mem >= 13,                                 // Lucemon
  "BT4-111": s => s.trash.length >= 10,                                                 // Jack Raid
  "BT2-111": s => s.trash.length >= 10 && s.board.some(st => st.at(-1).name === "Impmon"), // Beelzemon shortcut
  "BT2-108": s => s.trash.some(c => c.color === "Purple" && lvl(c) === 3),             // Night Raid
  "BT4-011": s => s.tamers.some(t => t.color === "Red") || s.board.some(st => lvl(st.at(-1)) === 3 && st.at(-1).color === "Red"),
  "BT4-025": s => s.tamers.some(t => t.color === "Blue") || s.board.some(st => lvl(st.at(-1)) === 3 && st.at(-1).color === "Blue"),
};

function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; }
const expand = o => Object.entries(o).flatMap(([id, n]) => Array(n).fill(0).map(() => ({ ...C[id], id })));

function game(d, stats) {
  const deck = shuffle(expand(d.main)), eggs = shuffle(expand(d.egg));
  let hand = deck.splice(0, 5);
  if (!hand.some(c => lvl(c) === 3)) { deck.push(...hand); shuffle(deck); hand = deck.splice(0, 5); stats.mull++; } // 1 mulligan
  const sec = deck.splice(0, 5); // security
  const s = { trash: [], board: [], tamers: [], mem: 0, hand };
  if (hand.some(c => lvl(c) === 3)) stats.open3++;
  let breed = null, reach5 = 0, reach6 = 0;
  const draw = n => { for (let i = 0; i < n && deck.length; i++) s.hand.push(deck.shift()); };
  const search = (c) => {
    const e = T(c);
    let m = e.match(/Reveal the top (\d) cards/);
    if (!m) { const d2 = e.match(/＜Draw (\d)＞|<Draw (\d)>/); if (d2 && /On Play|When Digivolving/.test(e)) { draw(+(d2[1] || d2[2])); const t = e.match(/trash (\d) cards? (?:in|from) your hand/); if (t) discard(+t[1]); } return; }
    const top = deck.splice(0, +m[1]);
    const take = [];
    const tr = e.match(/\[([^\]]+)\] trait/);
    if (tr) { const i = top.findIndex(x => (x.trait || "").includes(tr[1])); if (i >= 0) take.push(...top.splice(i, 1)); }
    if (/Tamer card/.test(e)) { const i = top.findIndex(x => x.type === "Tamer"); if (i >= 0) take.push(...top.splice(i, 1)); }
    if (/level 5 and 1 level 6/.test(e)) for (const L of [5, 6]) { const i = top.findIndex(x => lvl(x) === L); if (i >= 0) take.push(...top.splice(i, 1)); }
    s.hand.push(...take);
    if (/Trash the remaining/.test(e)) s.trash.push(...top); else deck.push(...top);
  };
  const discard = n => { for (let i = 0; i < n && s.hand.length; i++) { // discard least useful: options with cost > mem, else last
      let k = s.hand.findIndex(c => c.type === "Option" && +c.playCost > 6); if (k < 0) k = s.hand.length - 1; s.trash.push(...s.hand.splice(k, 1)); } };
  const niche = Object.keys(COND).filter(id => d.main[id]);
  for (let turn = 1; turn <= 8; turn++) {
    if (turn > 1) draw(1);
    // memory budget
    let mem = 3 + s.tamers.filter(t => /gain 1 memory|set it to 3/.test(T(t))).length * (turn > 1 ? 1 : 0);
    s.mem = mem;
    // dead-card tracking (card in hand at start of turn, condition false)
    for (const id of niche) for (const c of s.hand.filter(c => c.id === id)) { stats.cond[id] = stats.cond[id] || { seen: 0, ok: 0 }; stats.cond[id].seen++; if (COND[id](s)) stats.cond[id].ok++; }
    let acted = false;
    // free memory options
    for (const id of ["ST2-13", "BT1-090", "BT4-111"]) { const i = s.hand.findIndex(c => c.id === id); if (i >= 0 && (id !== "BT4-111" || s.trash.length >= 10)) { const c = s.hand.splice(i, 1)[0]; mem += id === "BT4-111" ? Math.floor(s.trash.length / 10) : id === "BT1-090" ? 2 : 1; s.trash.push(c); } }
    if (turn === 1) { breed = [eggs.shift()]; acted = true; }
    // digivolve best stack repeatedly (breeding first, then board)
    let loop = true;
    while (loop) {
      loop = false;
      const stacks = [breed, ...s.board].filter(Boolean);
      let best = null;
      for (const st of stacks) for (const c of s.hand) { if (c.type !== "Digimon") continue; const cost = evoCost(c, st.at(-1)); if (cost != null && cost <= mem && (!best || lvl(c) > lvl(best.c) || (lvl(c) === lvl(best.c) && cost < best.cost))) best = { st, c, cost }; }
      // red/blue tamer-as-Lv3 (Agunimon / Lobomon)
      for (const c of s.hand) if (/onto one of your (red|blue) Tamers/.test(T(c)) && mem >= 2 && !best) { const col = T(c).match(/(red|blue) Tamers/)[1]; const ti = s.tamers.findIndex(t => t.color.toLowerCase() === col); if (ti >= 0) { const t = s.tamers.splice(ti, 1)[0]; const st = [t]; s.board.push(st); best = { st, c, cost: 2 }; } }
      if (best && (lvl(best.c) >= 4 || best.st === breed)) {
        s.hand.splice(s.hand.indexOf(best.c), 1); best.st.push(best.c); mem -= best.cost; draw(1); acted = true; loop = true;
        if (/When Digivolving/.test(T(best.c))) search(best.c);
        if (lvl(best.c) >= 5 && !reach5) reach5 = turn; if (lvl(best.c) >= 6 && !reach6) reach6 = turn;
      }
    }
    // move breeding stack out once Lv3+
    if (breed && lvl(breed.at(-1)) >= 3 && turn >= 2) { s.board.push(breed); breed = null; }
    // play tamer
    for (const c of [...s.hand]) if (c.type === "Tamer" && +c.playCost <= mem && s.tamers.length < 3) { s.hand.splice(s.hand.indexOf(c), 1); s.tamers.push(c); mem -= +c.playCost; acted = true; if (/On Play/.test(T(c))) search(c); }
    // play Lv3 if board thin
    if (s.board.length < 2) { const c = s.hand.find(c => lvl(c) === 3 && +c.playCost <= mem && !(c.id === "BT4-115" && s.trash.length < 10)); if (c) { s.hand.splice(s.hand.indexOf(c), 1); s.board.push([c]); mem -= +c.playCost; acted = true; if (/On Play/.test(T(c))) search(c); } }
    // use one affordable option (goes to trash)
    { const c = s.hand.find(c => c.type === "Option" && +c.playCost <= mem && (!COND[c.id] || COND[c.id](s))); if (c) { s.hand.splice(s.hand.indexOf(c), 1); s.trash.push(c); mem -= +c.playCost; acted = true; } }
    if (!acted && turn >= 2) stats.brick++;
    // trade: from T4 every other turn our oldest non-top stack dies
    if (turn >= 4 && turn % 2 === 0 && s.board.length) { const st = s.board.shift(); s.trash.push(...st); if (st.some(c => /On Deletion\] ＜Draw|Trash the top 3 cards of your deck/.test(T(c)))) { if (/Trash the top 3/.test(T(st[0]))) s.trash.push(...deck.splice(0, 3)); } }
    // opponent attacks: from T3 one of our security cards is checked each turn -> trash
    if (turn >= 3 && sec.length) s.trash.push(sec.shift());
    stats.trashT6 += turn === 6 ? s.trash.length : 0;
    stats.handT6 += turn === 6 ? s.hand.length : 0;
  }
  stats.r5 += reach5 || 9; stats.r6 += reach6 || 9;
  if (reach5 && reach5 <= 4) stats.r5by4++;
  if (reach6 && reach6 <= 6) stats.r6by6++;
}

const out = {};
for (const [col, d] of Object.entries(DECKS)) {
  if (onlyCol && col !== onlyCol) continue;
  const st = { open3: 0, mull: 0, r5: 0, r6: 0, r5by4: 0, r6by6: 0, brick: 0, trashT6: 0, handT6: 0, cond: {} };
  for (let i = 0; i < N; i++) game(d, st);
  const pct = x => Math.round(100 * x / N) + "%";
  out[col] = {
    "มือแรกมี Lv3": pct(st.open3), "ต้อง mulligan": pct(st.mull),
    "Lv5 เฉลี่ยเทิร์น": (st.r5 / N).toFixed(1), "Lv5 ภายใน T4": pct(st.r5by4),
    "Lv6 เฉลี่ยเทิร์น": (st.r6 / N).toFixed(1), "Lv6 ภายใน T6": pct(st.r6by6),
    "เทิร์นที่ทำอะไรไม่ได้/เกม": (st.brick / N).toFixed(2), "trash ตอน T6": (st.trashT6 / N).toFixed(1), "มือตอน T6": (st.handT6 / N).toFixed(1),
  };
  for (const [id, v] of Object.entries(st.cond)) out[col][`ใช้ได้เมื่ออยู่ในมือ: ${C[id].name}`] = Math.round(100 * v.ok / v.seen) + "%";
}
console.log(JSON.stringify(out, null, 1));
