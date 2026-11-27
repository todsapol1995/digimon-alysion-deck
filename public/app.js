const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const COLORS = ["Red", "Blue", "Yellow", "Green", "Black", "Purple", "White"];
const TYPE_ORDER = { "Digi-Egg": 0, Digimon: 1, Tamer: 2, Option: 3 };
const DECK_URL = (id) => `https://alysioncards.com/decks?deck=${encodeURIComponent(id)}`;
const ALIAS_KEY = "alysion.archAlias";

let CARDS = {};
let DECKS = [];     // decks in use (deduplicated when state.dedupe is on)
let ALL_DECKS = []; // every published deck
let syncedAt = 0;
const expanded = new Set();
const aliases = JSON.parse(localStorage.getItem(ALIAS_KEY) || "{}");
const state = { view: "arch", search: "", card: "", colors: new Set(), arch: "", days: 0, core: 80, flex: 30, min: 2, merge: true, types: new Set(), levels: new Set(), cards: [], cardMode: "and", staplesOnly: false,
  archLayout: localStorage.getItem("alysion.archLayout") || "grid",
  dedupe: localStorage.getItem("alysion.dedupe") !== "0" };

// Exact duplicates = identical card list AND identical copy counts. Keep the newest upload of each list
// and remember how many uploads it stands for (d.dupes). Most duplicates are the same deck re-uploaded.
const listKey = (d) => Object.entries(d.cards).sort(([a], [b]) => a.localeCompare(b)).map(([id, n]) => `${id}x${n}`).join("|");
function dedupeDecks(all) {
  const groups = groupBy(all, listKey);
  return [...groups.values()].map((ds) => {
    const keep = ds.reduce((a, b) => ((b.publishedAt || 0) > (a.publishedAt || 0) ? b : a));
    keep.dupes = ds.length - 1;
    return keep;
  });
}
function applyDedupe() {
  DECKS = state.dedupe ? dedupeDecks(ALL_DECKS) : ALL_DECKS;
  assignArchetypes();
  fillArchSelect();
}
const CARD_TYPES = ["Digi-Egg", "Digimon", "Tamer", "Option"];
const PACK_NAMES = { "BD-01": "New Evolution", "BD-02": "Ultimate Power", "BD-03": "Union Impact", "BD-04": "Great Legend",
  "ST-1": "Starter Gaia Red", "ST-2": "Starter Cocytus Blue", "ST-3": "Starter Heaven's Yellow", "ST-4": "Starter Giga Green",
  "ST-5": "Starter Machine Black", "ST-6": "Starter Venomous Violet", SHOP: "Shop" };
const packLabel = (p) => (p ? `${p}${PACK_NAMES[p] ? " " + PACK_NAMES[p] : ""}` : null);
let STAPLES = {}; // cardId -> [{ color, note }] from the site's "Staple Cards at Launch" guide
const stapleTitle = (id) => (STAPLES[id] || []).map((s) => `★ Staple ${s.color}: ${s.note}`).join("\n");
const stapleBadge = (id, cls = "staple") => (STAPLES[id] ? `<span class="${cls}" title="${esc(stapleTitle(id))}">★</span>` : "");

// Card type / level / staple filter: narrows which cards are listed (percentages still count every deck)
const cardVisible = (c) =>
  (!state.types.size || state.types.has(c.type)) &&
  (!state.levels.size || state.levels.has(c.level)) &&
  (!state.staplesOnly || !!STAPLES[c.id]);

// ---------- data prep ----------
function prepDeck(d) {
  const items = Object.entries(d.cards).map(([id, n]) => ({ id, n, c: CARDS[id] || { id, name: id, type: "?", color: "?", level: null } }));
  const colCount = {};
  for (const i of items) if (i.c.type !== "Digi-Egg") for (const col of String(i.c.color).split("/")) colCount[col] = (colCount[col] || 0) + i.n;
  const colors = Object.entries(colCount).sort((a, b) => b[1] - a[1]);
  const mainColor = colors[0]?.[0] || "?";
  const total = items.reduce((s, i) => s + i.n, 0);
  // boss = Lv6+ Digimon name with best (level + 1.5*copies) score; fall back to Lv5 if the deck has no Lv6+
  const pickBoss = (minLv) => {
    const byName = {};
    for (const i of items) if (i.c.type === "Digimon" && i.c.level >= minLv) {
      const b = (byName[i.c.name] ||= { n: 0, lv: 0 });
      b.n += i.n; b.lv = Math.max(b.lv, i.c.level);
    }
    return Object.entries(byName).sort((a, b) => b[1].lv + b[1].n * 1.5 - (a[1].lv + a[1].n * 1.5))[0]?.[0];
  };
  const boss = pickBoss(6) || pickBoss(5) || "Unknown";
  return { ...d, items, ids: new Set(items.map((i) => i.id)), mainColor, colors: colors.filter(([, n]) => n >= 4).map(([c]) => c), total, baseArch: `${mainColor} ${boss}` };
}

const jaccard = (a, b) => { let x = 0; for (const v of a) if (b.has(v)) x++; return x / (a.size + b.size - x || 1); };

function assignArchetypes() {
  for (const d of DECKS) d.arch = aliases[d.baseArch] || d.baseArch;
  if (!state.merge) return;
  const groups = groupBy(DECKS, (d) => d.arch);
  const big = [...groups].filter(([, ds]) => ds.length >= 3).map(([name, ds]) => {
    const cnt = {};
    for (const d of ds) for (const id of d.ids) cnt[id] = (cnt[id] || 0) + 1;
    return { name, core: new Set(Object.keys(cnt).filter((id) => cnt[id] / ds.length >= 0.5)) };
  });
  for (const [, ds] of groups) {
    if (ds.length >= 3) continue;
    for (const d of ds) {
      let best = null, score = 0;
      for (const g of big) { const s = jaccard(d.ids, g.core); if (s > score) { score = s; best = g; } }
      if (best && score >= 0.45) { d.arch = best.name; d.mergedFrom = d.baseArch; }
    }
  }
}

function groupBy(arr, fn) { const m = new Map(); for (const x of arr) { const k = fn(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); } return m; }

function matchCardIds(query) {
  const cq = query.trim().toLowerCase();
  if (!cq) return null;
  const exact = Object.values(CARDS).filter((c) => c.id.toLowerCase() === cq);
  return new Set((exact.length ? exact : Object.values(CARDS).filter((c) => c.name.toLowerCase().includes(cq))).map((c) => c.id));
}

// Selected cards = committed chips (state.cards) + whatever is still typed in the box (live)
function cardTokens() {
  const typed = state.card.trim();
  const all = [...state.cards, ...(typed ? [typed] : [])];
  return [...new Map(all.map((t) => [t.toLowerCase(), t])).values()];
}
const tokenLabel = (t) => (CARDS[t] ? `${CARDS[t].name} (${t})` : t);
const deckHasToken = (d, ids) => [...ids].some((id) => d.ids.has(id));
function deckMatchesCards(d, tokenIds) {
  if (!tokenIds.length) return true;
  return state.cardMode === "or" ? tokenIds.some((ids) => deckHasToken(d, ids)) : tokenIds.every((ids) => deckHasToken(d, ids));
}
function addCard(id) {
  if (!state.cards.some((t) => t.toLowerCase() === id.toLowerCase())) state.cards.push(id);
  state.card = "";
  syncInputs(); render();
}
function removeCard(t) { state.cards = state.cards.filter((x) => x !== t); syncInputs(); render(); }
// also handles the not-yet-added text still typed in the box
function removeToken(t) {
  if (state.card.trim().toLowerCase() === t.toLowerCase()) state.card = "";
  removeCard(t);
}

// ignoreCard: apply every filter except the card one (used for "% of each archetype that runs this card")
function filteredDecks(ignoreCard = false) {
  const q = state.search.trim().toLowerCase();
  const tokenIds = ignoreCard ? [] : cardTokens().map(matchCardIds);
  const since = state.days ? Date.now() - state.days * 864e5 : 0;
  return DECKS.filter((d) =>
    (!q || d.name?.toLowerCase().includes(q) || d.arch.toLowerCase().includes(q)) &&
    deckMatchesCards(d, tokenIds) &&
    (!state.colors.size || state.colors.has(d.mainColor)) &&
    (!state.arch || d.arch === state.arch) &&
    (d.publishedAt || 0) >= since);
}

function analyze(decks) {
  const n = decks.length;
  const stat = {};
  for (const d of decks) for (const i of d.items) {
    const s = (stat[i.id] ||= { c: i.c, incl: 0, copies: 0, dist: [0, 0, 0, 0] });
    s.incl++; s.copies += i.n; s.dist[Math.min(i.n, 4) - 1]++;
  }
  const rows = Object.values(stat).map((s) => ({ ...s, pct: (s.incl / n) * 100, avg: s.copies / s.incl }));
  rows.sort((a, b) => b.pct - a.pct || b.avg - a.avg || (TYPE_ORDER[a.c.type] ?? 9) - (TYPE_ORDER[b.c.type] ?? 9));
  const tier = (r) => (r.pct >= state.core ? "core" : r.pct >= state.flex ? "flex" : "tech");
  const colors = {};
  for (const d of decks) colors[d.mainColor] = (colors[d.mainColor] || 0) + 1;
  return { n, rows, tier, colors };
}

// ---------- rendering ----------
const colorDot = (c) => `<span class="dot c-${esc(c)}" title="${esc(c)}"></span>`;
const fmtDate = (t) => (t ? new Date(t).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" }) : "-");

function cardRow(r) {
  const el = $("#tplCardRow").content.firstElementChild.cloneNode(true);
  const img = el.querySelector("img");
  if (r.c.img) { img.src = r.c.img; img.dataset.card = r.c.id; } else img.remove();
  el.querySelector(".cname").innerHTML = `${esc(r.c.name)} <span class="badge t-${esc(r.c.type)}">${esc(r.c.type === "Digimon" && r.c.level ? "Lv." + r.c.level : r.c.type)}</span>${stapleBadge(r.c.id)}`;
  el.querySelector(".cid").innerHTML = `${colorDot(r.c.color)} ${esc(r.c.id)}`;
  el.querySelector(".fill").style.width = r.pct.toFixed(1) + "%";
  el.querySelector(".pct").textContent = `${r.pct.toFixed(0)}% (${r.incl})`;
  el.querySelector(".ccopies").innerHTML = `<b>${r.avg.toFixed(1)}</b><span class="muted">ใบ/เด็ค</span>`;
  el.querySelector(".cdist").innerHTML = r.dist.map((v, i) => `<span title="${i + 1}${i === 3 ? "+" : ""} ใบ: ${v} เด็ค" style="opacity:${v ? 0.35 + 0.65 * (v / r.incl) : 0.15}">${i + 1}×${v ? Math.round((v / r.incl) * 100) + "%" : "–"}</span>`).join("");
  el.title = `${r.c.name} — ใส่ใน ${r.incl} เด็ค`;
  el.addEventListener("click", () => addCard(r.c.id));
  return el;
}

// Grid tile: card image (copies badge) with play-rate stats underneath
function cardTile(r) {
  const el = document.createElement("div");
  el.className = "tile";
  el.title = `${r.c.name} (${r.c.id}) — คลิกข้อความเพื่อเพิ่มการ์ดนี้ในตัวกรอง`;
  const dist = r.dist.map((v, i) => (v ? `${i + 1}×${Math.round((v / r.incl) * 100)}%` : "")).filter(Boolean).join(" ");
  el.innerHTML = `
    <div class="timg">${r.c.img ? `<img loading="lazy" src="${esc(r.c.img)}" data-card="${esc(r.c.id)}" alt="${esc(r.c.name)}">` : `<div class="noimg">${esc(r.c.name)}</div>`}
      <span class="tcopies">×${r.avg.toFixed(1)}</span>${stapleBadge(r.c.id, "tstaple")}</div>
    <div class="tbar"><div class="fill" style="width:${r.pct.toFixed(1)}%"></div></div>
    <div class="tstat"><b>${r.pct.toFixed(0)}%</b> <span class="muted">(${r.incl})</span></div>
    <div class="tdist muted">${dist}</div>`;
  el.addEventListener("click", () => addCard(r.c.id));
  return el;
}

function renderArch(decks) {
  const root = $("#archView");
  root.innerHTML = "";
  const groups = [...groupBy(decks, (d) => d.arch)].filter(([, ds]) => ds.length >= state.min || state.arch).sort((a, b) => b[1].length - a[1].length);
  if (!groups.length) { root.innerHTML = `<p class="empty">ไม่พบ archetype ที่ตรงกับ filter</p>`; return; }
  for (const [name, ds] of groups) {
    const a = analyze(ds);
    const open = expanded.has(name) || groups.length === 1;
    const core = a.rows.filter((r) => a.tier(r) === "core" && cardVisible(r.c));
    const sec = document.createElement("article");
    sec.className = "arch" + (open ? " open" : "");
    sec.innerHTML = `
      <div class="ahead">
        <div class="atitle">${Object.keys(a.colors).map(colorDot).join("")} <span class="aname">${esc(name)}</span>
          <button class="icon rename" title="เปลี่ยนชื่อ / รวมกลุ่ม">✎</button></div>
        <div class="ameta"><b>${a.n}</b> เด็ค · ${((a.n / decks.length) * 100).toFixed(1)}% ของที่กรอง · core ${core.length} ใบ</div>
        <div class="apreview">${core.slice(0, 8).map((r) => r.c.img ? `<img loading="lazy" src="${esc(r.c.img)}" data-card="${esc(r.c.id)}">` : "").join("")}</div>
        <span class="chev">${open ? "▾" : "▸"}</span>
      </div>`;
    sec.querySelector(".ahead").addEventListener("click", (e) => {
      if (e.target.closest(".rename")) return;
      open ? expanded.delete(name) : expanded.add(name); render();
    });
    sec.querySelector(".rename").addEventListener("click", () => renameArch(name, ds));
    if (open) {
      const body = document.createElement("div");
      body.className = "abody";
      body.innerHTML = `<div class="layoutsw">
        <button data-l="grid" class="${state.archLayout === "grid" ? "on" : ""}">▦ ภาพการ์ด</button>
        <button data-l="list" class="${state.archLayout === "list" ? "on" : ""}">☰ รายการ</button>
        <span class="muted">ตัวเลข ×N บนการ์ด = จำนวนใบเฉลี่ยในเด็คที่ใส่ · แถบ = % ของเด็คในกลุ่มที่ใส่</span></div>`;
      body.querySelectorAll(".layoutsw button").forEach((b) => b.addEventListener("click", () => {
        state.archLayout = b.dataset.l; localStorage.setItem("alysion.archLayout", state.archLayout); render();
      }));
      for (const [t, label, desc] of [["core", "Core", `ใส่ ≥ ${state.core}%`], ["flex", "Flex", `${state.flex}–${state.core}%`], ["tech", "Tech / Spice", `< ${state.flex}%`]]) {
        const rows = a.rows.filter((r) => a.tier(r) === t && cardVisible(r.c));
        if (!rows.length) continue;
        const copies = rows.reduce((s, r) => s + r.copies, 0) / a.n;
        const box = document.createElement("div");
        box.className = `tier tier-${t}`;
        box.innerHTML = `<h4>${label} <span class="muted">${desc} · ${rows.length} การ์ด · เฉลี่ย ${copies.toFixed(1)} ใบ/เด็ค</span></h4>`;
        if (state.archLayout === "grid") {
          const grid = document.createElement("div");
          grid.className = "tgrid";
          rows.forEach((r) => grid.appendChild(cardTile(r)));
          box.appendChild(grid);
        } else {
          box.insertAdjacentHTML("beforeend", `<div class="chead muted"><span></span><span>การ์ด</span><span>% เด็คที่ใส่</span><span>เฉลี่ย</span><span>จำนวนที่ใส่ (1× 2× 3× 4×)</span></div>`);
          rows.forEach((r) => box.appendChild(cardRow(r)));
        }
        body.appendChild(box);
      }
      const list = document.createElement("details");
      list.className = "dlist";
      list.innerHTML = `<summary>รายชื่อเด็คในกลุ่มนี้ (${ds.length})</summary>` + ds.sort((x, y) => (y.publishedAt || 0) - (x.publishedAt || 0)).map((d) =>
        `<a href="${DECK_URL(d.id)}" target="_blank" rel="noopener">${esc(d.name || "(ไม่มีชื่อ)")}</a> <span class="muted">${fmtDate(d.publishedAt)}${d.mergedFrom ? ` · รวมมาจาก ${esc(d.mergedFrom)}` : ""}</span>`).join("<br>");
      body.appendChild(list);
      sec.appendChild(body);
    }
    root.appendChild(sec);
  }
}

function renderDecks(decks) {
  const root = $("#deckView");
  const sorted = [...decks].sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0));
  root.innerHTML = `<table class="dtable"><thead><tr><th>ชื่อเด็ค</th><th>Archetype</th><th>สี</th><th>ใบ</th><th>เผยแพร่</th><th></th></tr></thead><tbody></tbody></table>`;
  const tb = root.querySelector("tbody");
  for (const d of sorted) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${esc(d.name || "(ไม่มีชื่อ)")}${state.dedupe && d.dupes ? ` <span class="badge" title="มีเด็คที่การ์ดตรงกันทุกใบอีก ${d.dupes} เด็ค (นับรวมเป็นเด็คนี้)">+${d.dupes} ซ้ำ</span>` : ""}</td><td><a href="#" class="archlink">${esc(d.arch)}</a></td><td>${d.colors.map(colorDot).join("")}</td><td>${d.total}</td><td>${fmtDate(d.publishedAt)}</td><td><a href="${DECK_URL(d.id)}" target="_blank" rel="noopener">เปิด ↗</a></td>`;
    tr.querySelector(".archlink").addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); state.arch = d.arch; state.view = "arch"; expanded.add(d.arch); syncInputs(); render(); });
    const detail = document.createElement("tr");
    detail.className = "ddetail"; detail.hidden = true;
    tr.addEventListener("click", (e) => {
      if (e.target.closest("a")) return;
      if (!detail.innerHTML) {
        const items = d.items.filter((i) => cardVisible(i.c)).sort((a, b) => (TYPE_ORDER[a.c.type] ?? 9) - (TYPE_ORDER[b.c.type] ?? 9) || (a.c.level || 0) - (b.c.level || 0));
        detail.innerHTML = `<td colspan="6"><div class="dgrid">${items.map((i) => `<div class="dcard">${stapleBadge(i.id, "tstaple")}${i.c.img ? `<img loading="lazy" src="${esc(i.c.img)}" data-card="${esc(i.id)}">` : `<div class="noimg">${esc(i.c.name)}</div>`}<span>×${i.n}</span></div>`).join("")}</div></td>`;
      }
      detail.hidden = !detail.hidden;
    });
    tb.append(tr, detail);
  }
  if (!sorted.length) root.innerHTML = `<p class="empty">ไม่พบเด็คที่ตรงกับ filter</p>`;
}

// Card search panel: for each matching card, which archetypes run it, in what % of that archetype's decks, how many copies
function renderCardInsight() {
  const root = $("#cardInsight");
  const tokens = cardTokens();
  if (!tokens.length) { root.hidden = true; root.innerHTML = ""; return; }
  root.hidden = false;
  const pool = filteredDecks(true);
  const archTotals = new Map([...groupBy(pool, (d) => d.arch)].map(([k, v]) => [k, v.length]));
  const pctBar = (pct, label) => `<div class="cbar"><div class="fill" style="width:${pct.toFixed(1)}%"></div><span class="pct">${label}</span></div>`;

  // Combo summary (2+ cards): decks matching all (or any) of them, per archetype
  let combo = "";
  if (tokens.length > 1) {
    const tokenIds = tokens.map(matchCardIds);
    const hit = pool.filter((d) => deckMatchesCards(d, tokenIds));
    const rows = [...groupBy(hit, (d) => d.arch)].map(([arch, ds]) => ({ arch, n: ds.length, total: archTotals.get(arch), color: ds[0].mainColor }))
      .sort((a, b) => b.n - a.n);
    combo = `<div class="combo">
      <div class="cistat">เด็คที่ใส่${state.cardMode === "or" ? "อย่างน้อย 1 ใบจาก" : "ครบทุกใบ"}: ${tokens.map((t) => `<b>${esc(tokenLabel(t))}</b>`).join(state.cardMode === "or" ? " หรือ " : " + ")}
        → <b>${hit.length}</b> / ${pool.length} เด็ค (${pool.length ? ((hit.length / pool.length) * 100).toFixed(1) : 0}%)</div>
      ${rows.length ? `<table class="citable"><thead><tr><th>Archetype</th><th>% ของเด็คใน archetype ที่เข้าเงื่อนไข</th><th>สัดส่วน</th></tr></thead><tbody>
        ${rows.map((r) => `<tr data-arch="${esc(r.arch)}"><td>${colorDot(r.color)} ${esc(r.arch)}</td>
          <td>${pctBar((r.n / r.total) * 100, `${((r.n / r.total) * 100).toFixed(0)}% (${r.n}/${r.total})`)}</td>
          <td class="muted">${((r.n / hit.length) * 100).toFixed(0)}%</td></tr>`).join("")}</tbody></table>` : `<p class="muted">ไม่มีเด็คที่เข้าเงื่อนไข</p>`}
    </div>`;
  }

  // Per-card blocks: up to 6 cards in total across the selected tokens
  const used = [];
  for (const t of tokens) {
    const found = [...matchCardIds(t)].map((id) => ({ c: CARDS[id], decks: pool.filter((d) => d.ids.has(id)) }))
      .filter((x) => x.decks.length).sort((a, b) => b.decks.length - a.decks.length);
    used.push(...found.slice(0, tokens.length > 1 ? 2 : 6).map((x) => ({ ...x, token: t })));
  }
  const shown = used.slice(0, 6);
  root.innerHTML = `<div class="cihead"><b>ผลค้นหาการ์ด</b>
    ${tokens.map((t) => `<span class="chip on cardchip" data-t="${esc(t)}">${esc(tokenLabel(t))} <b class="x" title="เอาการ์ดนี้ออกจากตัวกรอง">✕</b></span>`).join("")}
    <button class="ghost clear">✕ ล้างการ์ดที่เลือกทั้งหมด</button></div>` + combo +
    (shown.length ? "" : `<div class="ci"><p class="muted">ไม่มีเด็คไหนใส่การ์ดที่ค้นหา (ภายใต้ filter อื่นที่เลือกอยู่)</p></div>`) +
    shown.map(({ c, decks, token }) => {
      const copies = decks.map((d) => d.cards[c.id]);
      const avg = copies.reduce((s, n) => s + n, 0) / copies.length;
      const dist = [1, 2, 3, 4].map((k) => copies.filter((n) => Math.min(n, 4) === k).length);
      const rows = [...groupBy(decks, (d) => d.arch)].map(([arch, ds]) => {
        const total = archTotals.get(arch);
        const cs = ds.map((d) => d.cards[c.id]);
        return { arch, n: ds.length, total, pct: (ds.length / total) * 100, avg: cs.reduce((s, n) => s + n, 0) / cs.length, color: ds[0].mainColor };
      }).sort((a, b) => b.n - a.n || b.pct - a.pct);
      return `<div class="ci">
        <button class="ciremove" data-t="${esc(token)}" title="เอา “${esc(tokenLabel(token))}” ออกจากตัวกรอง">✕ เอาออก</button>
        <div class="cicard">
          ${c.img ? `<img src="${esc(c.img)}" alt="" data-card="${esc(c.id)}">` : ""}
          <div>
            <div class="cname">${esc(c.name)} <span class="badge t-${esc(c.type)}">${esc(c.type === "Digimon" && c.level ? "Lv." + c.level : c.type)}</span>${stapleBadge(c.id)}</div>
            <div class="cid muted">${colorDot(c.color)} ${esc(c.id)}</div>
            <div class="cistat"><b>${decks.length}</b> / ${pool.length} เด็ค (${((decks.length / pool.length) * 100).toFixed(1)}%) · เฉลี่ย <b>${avg.toFixed(1)}</b> ใบ</div>
            <div class="cdist">${dist.map((v, i) => `<span>${i + 1}×${v ? Math.round((v / decks.length) * 100) + "%" : "–"}</span>`).join("")}</div>
          </div>
        </div>
        <table class="citable"><thead><tr><th>Archetype ที่ใส่การ์ดนี้</th><th>% ของเด็คใน archetype</th><th>เฉลี่ย</th><th>สัดส่วนผู้ใช้การ์ดนี้</th></tr></thead><tbody>
          ${rows.map((r) => `<tr data-arch="${esc(r.arch)}">
            <td>${colorDot(r.color)} ${esc(r.arch)}</td>
            <td><div class="cbar"><div class="fill" style="width:${r.pct.toFixed(1)}%"></div><span class="pct">${r.pct.toFixed(0)}% (${r.n}/${r.total})</span></div></td>
            <td>${r.avg.toFixed(1)} ใบ</td>
            <td class="muted">${((r.n / decks.length) * 100).toFixed(0)}%</td></tr>`).join("")}
        </tbody></table>
      </div>`;
    }).join("");
  root.querySelector(".clear").addEventListener("click", () => { state.card = ""; state.cards = []; syncInputs(); render(); });
  // remove one card: chip ✕ in the header or the button on its block
  root.querySelectorAll(".cihead .cardchip .x, .ciremove").forEach((b) => b.addEventListener("click", (e) => {
    e.stopPropagation();
    removeToken((b.closest("[data-t]")).dataset.t);
  }));
  root.querySelectorAll("tr[data-arch]").forEach((tr) => tr.addEventListener("click", () => {
    state.arch = tr.dataset.arch; state.view = "arch"; expanded.add(state.arch); syncInputs(); render();
  }));
}

// ---------- card hover preview + detail popup ----------
const TEXT_LABELS = {
  effect: "Effect", digivolveEffect: "Inherited Effect", securityEffect: "Security Effect", aceEffect: "Ace Effect",
  optionCardEffect: "Option Effect", dualEffect: "Dual Effect", linkRequirement: "Link Requirement", linkEffect: "Link Effect", linkDP: "Link DP",
  specialDigivolve: "Special Digivolve", dnaDigivolve: "DNA Digivolve", burstDigivolve: "Burst Digivolve", digiXros: "DigiXros", assembly: "Assembly", rule: "Rule",
};
// highlight [Timing] and ＜Keyword＞ tokens
const fmtEffect = (t) => esc(t)
  .replace(/\[([^\]]+)\]/g, '<span class="kw-t">[$1]</span>')
  .replace(/(＜|&lt;)([^＞&]+)(＞|&gt;)/g, '<span class="kw-k">＜$2＞</span>')
  .replace(/\n/g, "<br>");

const preview = $("#hoverPreview");
const previewImg = preview.querySelector("img");
function placePreview(e) {
  const w = 280, h = 392, pad = 16;
  let x = e.clientX + pad, y = e.clientY - h / 2;
  if (x + w > innerWidth) x = e.clientX - w - pad;
  y = Math.max(8, Math.min(y, innerHeight - h - 8));
  preview.style.transform = `translate(${x}px, ${y}px)`;
}
document.addEventListener("mouseover", (e) => {
  const img = e.target.closest("img[data-card]");
  if (!img || !$("#cardModal").hidden) return;
  previewImg.src = img.src; preview.hidden = false; placePreview(e);
});
document.addEventListener("mousemove", (e) => { if (!preview.hidden) placePreview(e); });
document.addEventListener("mouseout", (e) => { if (e.target.closest("img[data-card]")) preview.hidden = true; });

// capture phase so the click doesn't also toggle a group / filter a row
document.addEventListener("click", (e) => {
  const img = e.target.closest("img[data-card]");
  if (!img) return;
  e.stopPropagation(); e.preventDefault();
  openCard(img.dataset.card);
}, true);

function openCard(id) {
  const c = CARDS[id];
  if (!c) return;
  preview.hidden = true;
  const m = $("#cardModal");
  m.querySelector(".mimg img").src = c.img || "";
  const n = DECKS.filter((d) => d.ids.has(id)).length;
  const facts = [
    ["Type", c.type], ["Color", c.color], ["Level", c.level ? "Lv." + c.level : null], ["Rarity", c.rarity],
    [c.type === "Option" || c.type === "Tamer" ? "Use/Play Cost" : "Play Cost", c.playCost], ["DP", c.dp],
    ["Form", c.form], ["Attribute", c.attribute], ["Trait", c.trait], ["Pack", packLabel(c.pack)],
  ].filter(([, v]) => v);
  const staple = STAPLES[id]
    ? `<div class="msec mstaple"><h4>★ Staple card (ไกด์ Staple Cards at Launch)</h4>${STAPLES[id].map((s) => `<div>${colorDot(s.color)} <b>${esc(s.color)}</b> — ${esc(s.note)}</div>`).join("")}</div>`
    : "";
  const evo = (c.evo || []).map((d) => `${colorDot(d.color)} ${esc(d.color)} Lv.${esc(d.level)} → cost ${esc(d.cost)}`).join("<br>");
  m.querySelector(".minfo").innerHTML = `
    <h2>${esc(c.name)}</h2>
    <div class="muted">${colorDot(c.color)} ${esc(c.id)}${c.restriction ? ` · <span class="restr">${esc(c.restriction)}</span>` : ""}</div>
    <dl class="facts">${facts.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("")}</dl>
    ${staple}
    ${evo ? `<div class="msec"><h4>Digivolve</h4><div>${evo}</div></div>` : ""}
    ${Object.entries(c.text || {}).map(([k, v]) => `<div class="msec"><h4>${TEXT_LABELS[k] || k}</h4><div>${fmtEffect(v)}</div></div>`).join("") || `<p class="muted">ไม่มีข้อความความสามารถ</p>`}
    <div class="mfoot">ใส่ใน <b>${n}</b> / ${DECKS.length} เด็ค (${((n / DECKS.length) * 100).toFixed(1)}%)
      <button class="mfind">+ เพิ่มการ์ดนี้ในตัวกรอง</button></div>`;
  m.querySelector(".mfind").onclick = () => { closeCard(); addCard(id); window.scrollTo(0, 0); };
  m.hidden = false;
}
function closeCard() { $("#cardModal").hidden = true; }
$("#cardModal").addEventListener("click", (e) => { if (e.target.id === "cardModal" || e.target.closest(".mclose")) closeCard(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeCard(); });

// ---------- Staple page: guide cards grouped by pack ----------
const PACK_ORDER = ["BD-01", "BD-02", "BD-03", "BD-04", "ST-1", "ST-2", "ST-3", "ST-4", "ST-5", "ST-6", "SHOP"];
const COLOR_ORDER = ["Red", "Blue", "Yellow", "Green", "Purple", "Black", "White"];
function renderStaples() {
  const root = $("#staplesView");
  root.innerHTML = "";
  const ids = Object.keys(STAPLES);
  if (!ids.length) { root.innerHTML = `<p class="empty">ยังไม่มีข้อมูล Staple — กด ↻ ดึงข้อมูลใหม่</p>`; return; }
  // Usage % uses every filter except the card search, so it stays comparable across cards
  const pool = filteredDecks(true);
  const use = (id) => { const ds = pool.filter((d) => d.ids.has(id)); return { n: ds.length, pct: pool.length ? (ds.length / pool.length) * 100 : 0,
    avg: ds.length ? ds.reduce((s, d) => s + d.cards[id], 0) / ds.length : 0 }; };
  // Sidebar colour chips filter by the colour the guide lists the card under
  const rows = ids.map((id) => ({ c: CARDS[id] || { id, name: id, type: "?" }, guide: STAPLES[id], ...use(id) }))
    .filter((r) => cardVisible(r.c) && (!state.colors.size || r.guide.some((g) => state.colors.has(g.color))));
  const byPack = groupBy(rows, (r) => r.c.pack || "?");
  const packs = [...byPack.keys()].sort((a, b) => (PACK_ORDER.indexOf(a) + 1 || 99) - (PACK_ORDER.indexOf(b) + 1 || 99));
  const colorRank = (r) => Math.min(...r.guide.map((g) => COLOR_ORDER.indexOf(g.color)));

  const head = document.createElement("div");
  head.className = "share";
  head.innerHTML = `<h3>★ Staple Cards at Launch — แยกตามซอง <span class="muted">(${rows.length} การ์ด${rows.length !== ids.length ? ` จาก ${ids.length}` : ""})</span></h3>
    <div class="sharebar">${packs.map((p, i) => `<div class="pk${i % 6}" style="flex:${byPack.get(p).length}" title="${esc(packLabel(p))}: ${byPack.get(p).length}"></div>`).join("")}</div>
    <div class="sharelegend">${packs.map((p, i) => `<a href="#pack-${esc(p)}" class="pklink"><span class="dot pk${i % 6}"></span> ${esc(packLabel(p))} <b>${byPack.get(p).length}</b></a>`).join("")}</div>
    <p class="muted small">ที่มา: <a href="https://alysioncards.com/guides/staple-cards-at-launch" target="_blank" rel="noopener">alysioncards.com/guides/staple-cards-at-launch</a> ·
      % = สัดส่วนเด็คในชุมชน (ตาม filter) ที่ใส่การ์ดนั้น · ×N = จำนวนใบเฉลี่ยในเด็คที่ใส่</p>`;
  root.appendChild(head);
  if (!rows.length) { root.insertAdjacentHTML("beforeend", `<p class="empty">ไม่มีการ์ด Staple ที่ตรงกับ filter</p>`); return; }

  for (const p of packs) {
    const list = byPack.get(p).sort((a, b) => colorRank(a) - colorRank(b) || b.pct - a.pct);
    const sec = document.createElement("article");
    sec.className = "cpanel";
    sec.id = `pack-${p}`;
    const colors = COLOR_ORDER.map((c) => [c, list.filter((r) => r.guide.some((g) => g.color === c)).length]).filter(([, n]) => n);
    sec.innerHTML = `<div class="chead2"><b>${esc(packLabel(p))}</b> <span class="muted">${list.length} การ์ด ·
      ${colors.map(([c, n]) => `${colorDot(c)} ${n}`).join(" ")}</span></div><div class="tgrid"></div>`;
    const grid = sec.querySelector(".tgrid");
    for (const r of list) {
      const el = document.createElement("div");
      el.className = "tile stile";
      el.title = `${r.c.name} (${r.c.id}) — คลิกข้อความเพื่อเพิ่มการ์ดนี้ในตัวกรอง`;
      el.innerHTML = `
        <div class="timg">${r.c.img ? `<img loading="lazy" src="${esc(r.c.img)}" data-card="${esc(r.c.id)}" alt="${esc(r.c.name)}">` : `<div class="noimg">${esc(r.c.name)}</div>`}
          ${r.n ? `<span class="tcopies">×${r.avg.toFixed(1)}</span>` : ""}</div>
        <div class="sname">${esc(r.c.name)} <span class="muted">${esc(r.c.id)}</span></div>
        <div class="tbar"><div class="fill" style="width:${r.pct.toFixed(1)}%"></div></div>
        <div class="tstat"><b>${r.pct.toFixed(0)}%</b> <span class="muted">(${r.n} เด็ค)</span></div>
        ${r.guide.map((g) => `<div class="snote">${colorDot(g.color)} ${esc(g.note)}</div>`).join("")}`;
      el.addEventListener("click", () => addCard(r.c.id));
      grid.appendChild(el);
    }
    root.appendChild(sec);
  }
}

// ---------- my collection (data/collection.json: { cards: {id: copies}, colorsEntered: [...] }) ----------
let COLL = { cards: {}, colorsEntered: [] };
const owned = (id) => COLL.cards[id] || 0;
const cardColors = (c) => String(c?.color || "").split("/").filter(Boolean);
const colorEntered = (c) => cardColors(c).some((x) => COLL.colorsEntered.includes(x));
const collColors = () => (state.colors.size ? [...state.colors] : COLL.colorsEntered);
let collMode = localStorage.getItem("alysion.collMode") || "near";
let collOnlyOwned = localStorage.getItem("alysion.collOnlyOwned") === "1";
let collSaveTimer = null;
const collMsg = (t) => { const el = $("#collSaved"); if (el) el.textContent = t; };
function saveColl() {
  if (ONLINE && !ghToken()) { collMsg("โหมดอ่านอย่างเดียว — ไม่ได้บันทึก"); return; }
  collMsg("กำลังบันทึก…");
  clearTimeout(collSaveTimer);
  collSaveTimer = setTimeout(async () => {
    try {
      if (ONLINE) { await ghSaveCollection(); collMsg("บันทึกแล้ว ✓ (เว็บจะอัปเดตใน ~1–2 นาที)"); return; }
      const r = await fetch("/api/collection", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(COLL) });
      if (!r.ok) throw new Error(await r.text());
      collMsg("บันทึกแล้ว ✓");
    } catch (e) { collMsg(`บันทึกไม่สำเร็จ: ${e.message}`); }
  }, ONLINE ? 1500 : 500);
}
function setOwned(id, n) {
  n = Math.max(0, Math.min(99, n));
  if (n) COLL.cards[id] = n; else delete COLL.cards[id];
  for (const col of cardColors(CARDS[id])) if (!COLL.colorsEntered.includes(col)) COLL.colorsEntered.push(col);
  COLL.updatedAt = new Date().toISOString().slice(0, 10);
  saveColl();
}
// Price per card by rarity (set by the user on the page, saved in collection.json as craftCost).
// C..SEC are crafted with CP; P (promo) can't be crafted — it is bought in the shop with coin.
const RARITIES = ["C", "U", "R", "SR", "SEC", "P"];
const COIN_RARITIES = new Set(["P"]);
const currencyOf = (c) => (COIN_RARITIES.has(c?.rarity) ? "coin" : "cp");
const craftOf = (c) => { const v = COLL.craftCost?.[c?.rarity]; return Number.isFinite(v) && v > 0 ? v : null; };
const hasCraft = () => RARITIES.some((r) => COLL.craftCost?.[r] > 0);
const fmtPrice = (c, n = 1) => (craftOf(c) ? `${(craftOf(c) * n).toLocaleString()} ${currencyOf(c) === "coin" ? "coin" : "CP"}` : "");
// Total price of [{c, n}] — cards of colours not entered yet are skipped (you may already own them)
function craftTotal(list) {
  let cost = 0, coin = 0, unpriced = 0;
  for (const m of list) {
    if (!colorEntered(m.c)) continue;
    const v = craftOf(m.c);
    if (!v) unpriced += m.n; else if (currencyOf(m.c) === "coin") coin += v * m.n; else cost += v * m.n;
  }
  return { cost, coin, unpriced };
}
const byCraft = (a, b) => a.cost - b.cost || a.coin - b.coin;
const fmtCraft = (t) => (hasCraft()
  ? `<span class="price"><b>${t.cost.toLocaleString()}</b> CP${t.coin ? ` · <b class="coin">${t.coin.toLocaleString()}</b> coin` : ""}</span>${t.unpriced ? ` <span class="muted" title="rarity ที่ยังไม่ได้ใส่ราคา">(+${t.unpriced} ใบไม่มีราคา)</span>` : ""}`
  : "");
// How much of a deck's list you own (each card capped at the copies the deck runs)
function deckCompletion(d) {
  let need = 0, have = 0, unknown = 0;
  const missing = [];
  for (const i of d.items) {
    need += i.n;
    const h = Math.min(owned(i.id), i.n);
    have += h;
    if (h < i.n) { missing.push({ c: i.c, n: i.n - h }); if (!colorEntered(i.c)) unknown += i.n - h; }
  }
  return { need, have, pct: need ? (have / need) * 100 : 0, missing, unknown, craft: craftTotal(missing) };
}
let nearSort = localStorage.getItem("alysion.nearSort") || "pct";
function craftSettings() {
  const el = document.createElement("details");
  el.className = "craftset";
  el.open = !hasCraft();
  const unit = (r) => (COIN_RARITIES.has(r) ? "coin" : "CP");
  el.innerHTML = `<summary>ราคาการ์ดต่อใบ (ตาม rarity) ${hasCraft() ? `<span class="muted">${RARITIES.filter((r) => COLL.craftCost?.[r]).map((r) => `${r} ${COLL.craftCost[r]} ${unit(r)}`).join(" · ")}</span>` : `<span class="muted">— ยังไม่ได้ตั้ง ใส่ตัวเลขจากในเกมเพื่อคำนวณ</span>`}</summary>
    <div class="craftinputs">${RARITIES.map((r) => `<label title="${COIN_RARITIES.has(r) ? "คราฟไม่ได้ — แลกในร้านค้าด้วย coin" : "คราฟด้วย CP"}">${r}<input type="number" min="0" step="1" data-r="${r}" value="${COLL.craftCost?.[r] ?? ""}" placeholder="-"><span class="muted">${unit(r)}</span></label>`).join("")}</div>
    <p class="muted small">C–SEC คราฟด้วย CP · P คราฟไม่ได้ ต้องแลกร้านค้าด้วย coin (ตอนนี้ใช้ราคาเดียวกันทุกใบ)</p>`;
  el.querySelector(".craftinputs").addEventListener("change", (e) => {
    const r = e.target.dataset.r; if (!r) return;
    const v = Math.round(Number(e.target.value));
    COLL.craftCost = { ...(COLL.craftCost || {}) };
    if (v > 0) COLL.craftCost[r] = v; else delete COLL.craftCost[r];
    saveColl(); renderCollection();
  });
  return el;
}
const imgTag = (c) => (c.img ? `<img loading="lazy" src="${esc(c.img)}" data-card="${esc(c.id)}" alt="${esc(c.name)}">` : `<div class="noimg">${esc(c.name)}</div>`);
const pctBar = (p) => `<div class="tbar"><div class="fill" style="width:${p.toFixed(1)}%"></div></div>`;

function renderCollection() {
  const root = $("#collView");
  const colors = collColors();
  const copies = Object.values(COLL.cards).reduce((a, b) => a + b, 0);
  root.innerHTML = `<div class="share">
    <h3>การ์ดของฉัน <span class="muted">(${Object.keys(COLL.cards).length} แบบ · ${copies} ใบ)</span> <span id="collSaved" class="muted small"></span></h3>
    <p class="muted small">สีที่กรอกแล้ว: ${COLL.colorsEntered.map((c) => `${colorDot(c)} ${esc(c)}`).join(" ") || "ยังไม่มี"} · กำลังดู: ${colors.map(colorDot).join(" ") || "-"}
      ${state.colors.size ? "(ตามสีที่เลือกใน filter)" : "(เลือกสีใน filter ด้านซ้ายเพื่อดู/กรอกสีอื่น)"}</p>
    <div class="modesw subnav">${[["near", "เด็คที่ใกล้ต่อได้"], ["have", "คอลเลกชัน / แก้จำนวน"], ["need", "การ์ดที่ควรหาเพิ่ม"]]
      .map(([m, l]) => `<button data-m="${m}" class="${collMode === m ? "on" : ""}">${l}</button>`).join("")}</div></div>`;
  root.querySelector(".subnav").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    collMode = b.dataset.m; localStorage.setItem("alysion.collMode", collMode); renderCollection();
  });
  root.querySelector(".share").appendChild(craftSettings());
  if (!colors.length) { root.insertAdjacentHTML("beforeend", `<p class="empty">ยังไม่ได้กรอกการ์ด — เลือกสีใน filter แล้วไปที่ "คอลเลกชัน / แก้จำนวน"</p>`); return; }
  ({ near: collNear, have: collHave, need: collNeed })[collMode](root, colors);
}

// 1) Decks / archetypes you are closest to building
function collNear(root, colors) {
  const pool = filteredDecks(true).filter((d) => colors.includes(d.mainColor));
  if (!pool.length) { root.insertAdjacentHTML("beforeend", `<p class="empty">ไม่มีเด็คสี ${esc(colors.join(", "))} ที่ตรงกับ filter</p>`); return; }
  const comp = new Map(pool.map((d) => [d, deckCompletion(d)]));

  // Archetype view: core cards at their usual copy count
  const archs = [...groupBy(pool, (d) => d.arch)].filter(([, ds]) => ds.length >= state.min).map(([name, ds]) => {
    const core = analyze(ds).rows.filter((r) => r.pct >= state.core);
    let need = 0, have = 0;
    const miss = [];
    for (const r of core) { const t = Math.max(1, Math.round(r.avg)); need += t; const h = Math.min(owned(r.c.id), t); have += h; if (h < t) miss.push({ c: r.c, n: t - h }); }
    const best = ds.map((d) => comp.get(d)).sort((a, b) => b.pct - a.pct)[0];
    const cheapest = ds.map((d) => comp.get(d).craft).sort(byCraft)[0];
    return { name, ds, miss, n: ds.length, core: core.length, pct: need ? (have / need) * 100 : 0, best: best.pct, craft: craftTotal(miss), cheapest };
  }).sort(nearSort === "craft" && hasCraft() ? (a, b) => byCraft(a.craft, b.craft) || b.pct - a.pct : (a, b) => b.pct - a.pct || b.best - a.best);

  const sortSw = document.createElement("div");
  sortSw.className = "modesw sortsw";
  sortSw.innerHTML = `<span class="muted small">เรียงตาม:</span>${[["pct", "% การ์ดครบ"], ["craft", "ใช้ CP น้อยสุด"]]
    .map(([m, l]) => `<button data-s="${m}" class="${nearSort === m ? "on" : ""}" ${m === "craft" && !hasCraft() ? "disabled title=\"ตั้งค่าคราฟด้านบนก่อน\"" : ""}>${l}</button>`).join("")}`;
  sortSw.addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b || b.disabled) return; nearSort = b.dataset.s; localStorage.setItem("alysion.nearSort", nearSort); renderCollection(); });
  root.appendChild(sortSw);

  const sec = document.createElement("article");
  sec.className = "cpanel";
  const cols = hasCraft() ? 6 : 4;
  sec.innerHTML = `<div class="chead2"><b>Archetype</b> <span class="muted">กดแถวเพื่อดูเด็คในกลุ่ม · % = มีการ์ด Core (≥${state.core}%) ครบตามจำนวนใบที่นิยมใส่ · เด็คดีสุด = เด็คในกลุ่มที่มีการ์ดครบมากสุด</span></div>
    <table class="dtable ctable"><thead><tr><th>Archetype</th><th>เด็ค</th><th>Core ครบ</th>${hasCraft() ? `<th title="CP / coin ที่ต้องใช้เพื่อให้มีการ์ด Core ครบ">ทำ Core ครบ</th><th title="CP / coin ของเด็คที่ถูกสุดในกลุ่มให้ครบทั้งเด็ค">เด็คถูกสุด</th>` : ""}<th>เด็คดีสุด</th></tr></thead><tbody>
    ${archs.map((a, i) => `<tr data-arch="${esc(a.name)}" data-i="${i}" class="archrow${collArchOpen.has(a.name) ? " open" : ""}"><td><span class="caret">▸</span> <b>${esc(a.name)}</b>
        <a href="#" class="archjump muted small" title="เปิดกลุ่มนี้ในแท็บ Archetypes">Archetypes ↗</a></td><td>${a.n}</td>
      <td class="pcell">${pctBar(a.pct)}<b>${a.pct.toFixed(0)}%</b> <span class="muted">(${a.core} ใบ)</span></td>
      ${hasCraft() ? `<td>${fmtCraft(a.craft)}</td><td>${fmtCraft(a.cheapest)}</td>` : ""}<td>${a.best.toFixed(0)}%</td></tr>
      <tr class="archexp" hidden><td colspan="${cols}"></td></tr>`).join("")}</tbody></table>`;
  // Expanded row: Core cards still missing + every deck of the archetype (each opens to its missing cards)
  const fillExp = (tr) => {
    const a = archs[tr.dataset.i], cell = tr.nextElementSibling.firstElementChild;
    if (cell.childElementCount) return;
    const ds = a.ds.map((d) => [d, comp.get(d)]).sort(nearSort === "craft" && hasCraft()
      ? (x, y) => byCraft(x[1].craft, y[1].craft) || y[1].pct - x[1].pct
      : (x, y) => y[1].pct - x[1].pct || x[1].missing.length - y[1].missing.length);
    cell.innerHTML = `<div class="archexpbox">
      <div class="glabel">Core ที่ยังขาด ${a.miss.length ? `(${a.miss.reduce((s, m) => s + m.n, 0)} ใบ${hasCraft() ? ` · ${fmtCraft(a.craft)}` : ""})` : ""}</div>
      ${a.miss.length ? `<div class="tgrid">${a.miss.map(missTile).join("")}</div>` : `<p class="muted">มีการ์ด Core ครบแล้ว 🎉</p>`}
      <div class="glabel">เด็คในกลุ่มนี้ (${ds.length}) — กดเพื่อดูใบที่ขาด</div></div>`;
    for (const [d, c] of ds) cell.firstElementChild.appendChild(nearDeckRow(d, c, false));
  };
  sec.querySelectorAll("tr.archrow").forEach((tr) => {
    if (tr.classList.contains("open")) { fillExp(tr); tr.nextElementSibling.hidden = false; }
    tr.addEventListener("click", (e) => {
      if (e.target.closest(".archjump")) { e.preventDefault(); state.arch = tr.dataset.arch; state.view = "arch"; expanded.add(state.arch); syncInputs(); render(); return; }
      const open = !tr.classList.contains("open");
      tr.classList.toggle("open", open);
      open ? collArchOpen.add(tr.dataset.arch) : collArchOpen.delete(tr.dataset.arch);
      if (open) fillExp(tr);
      tr.nextElementSibling.hidden = !open;
    });
  });
  root.appendChild(sec);

  // Deck view: top decks by completion, expandable list of missing cards
  const top = [...comp].sort(nearSort === "craft" && hasCraft()
    ? (a, b) => byCraft(a[1].craft, b[1].craft) || b[1].pct - a[1].pct
    : (a, b) => b[1].pct - a[1].pct || a[1].missing.length - b[1].missing.length).slice(0, 40);
  const list = document.createElement("article");
  list.className = "cpanel";
  list.innerHTML = `<div class="chead2"><b>เด็คที่ใกล้ต่อได้</b> <span class="muted">${top.length} จาก ${pool.length} เด็ค · กดเพื่อดูใบที่ขาด</span></div>`;
  for (const [d, c] of top) list.appendChild(nearDeckRow(d, c, true));
  root.appendChild(list);
}
// Archetypes opened on the "เด็คที่ใกล้ต่อได้" table (kept while re-rendering)
const collArchOpen = new Set();
const missTile = (m) => `<div class="tile"><div class="timg">${imgTag(m.c)}<span class="tcopies miss">ขาด ×${m.n}</span>${stapleBadge(m.c.id, "tstaple")}</div>
  <div class="sname">${esc(m.c.name)} <span class="muted">${esc(m.c.rarity || "")} · ${esc(m.c.pack || "")}${craftOf(m.c) && colorEntered(m.c) ? ` · ${fmtPrice(m.c, m.n)}` : ""}</span></div></div>`;
// One deck as an expandable row showing the cards you're missing
function nearDeckRow(d, c, showArch) {
  const det = document.createElement("details");
  det.className = "nearrow";
  det.innerHTML = `<summary><span class="nname">${esc(d.name || "(ไม่มีชื่อ)")}${showArch ? ` <span class="muted">· ${esc(d.arch)}</span>` : ""}</span>
    <span class="pcell">${pctBar(c.pct)}<b>${c.pct.toFixed(0)}%</b></span>
    <span class="craftcell">${fmtCraft(c.craft)}</span>
    <span class="muted">ขาด ${c.need - c.have} ใบ${c.unknown ? ` <span title="การ์ดสีที่ยังไม่ได้กรอก อาจมีอยู่แล้ว">(${c.unknown} ใบเป็นสีที่ยังไม่กรอก)</span>` : ""}</span>
    <a href="${esc(DECK_URL(d.id))}" target="_blank" rel="noopener" class="muted small">ต้นฉบับ ↗</a></summary>
    <div class="tgrid">${c.missing.map(missTile).join("") || `<p class="muted">ครบทุกใบแล้ว 🎉</p>`}</div>`;
  return det;
}

// ---------- recommended decks (data/recommended.json, built by tools/report.js from owned cards) ----------
let REC = [], REC_META = {};
// Cards gained / lost since the decks were built (compares with the snapshot saved in recommended.json)
function recChanges() {
  const snap = REC_META.snapshot;
  if (!snap) return null;
  const added = [], removed = [];
  for (const id of new Set([...Object.keys(snap), ...Object.keys(COLL.cards)])) {
    const d = owned(id) - (snap[id] || 0);
    if (d > 0 && CARDS[id]) added.push({ c: CARDS[id], n: d });
    if (d < 0 && CARDS[id]) removed.push({ c: CARDS[id], n: -d });
  }
  return { added, removed };
}
const recKind = (c) => (c.type === "Digi-Egg" ? "Digi-Egg" : c.type === "Digimon" ? `Lv.${c.level}` : c.type);
const recOrder = (c) => (c.type === "Digi-Egg" ? 0 : c.type === "Digimon" ? c.level : c.type === "Tamer" ? 8 : 9);
function renderRecommended() {
  const root = $("#recView");
  const list = REC.filter((d) => !state.colors.size || state.colors.has(d.color));
  root.innerHTML = `<div class="share"><h3>เด็คแนะนำจากการ์ดที่มี <span class="muted">(${list.length} เด็ค)</span></h3>
    <p class="muted small">จัดจากการ์ดใน "การ์ดของฉัน" เท่านั้น — main 50 ใบ, Digi-Egg ≤ 5, รหัสละ ≤ 4, เคารพการ์ดที่ถูกจำกัด/แบน ·
      ถ้าแก้จำนวนการ์ดแล้วมีไม่พอ ใบนั้นจะขึ้นสีแดง · เลือกสีใน filter เพื่อดูเฉพาะสีนั้น · การ์ด ST/SD ในรายการคราฟยังไม่ยืนยันว่าคราฟได้</p>
    <div class="sharelegend">${list.map((d) => `<a href="#rec-${esc(d.color)}" class="pklink">${colorDot(d.color)} ${esc(d.color)}</a>`).join("")}</div></div>`;
  const ch = recChanges();
  if (ch && (ch.added.length || ch.removed.length)) {
    const sum = (a) => a.reduce((s, x) => s + x.n, 0);
    const byColor = {};
    for (const a of ch.added) for (const col of cardColors(a.c)) byColor[col] = (byColor[col] || 0) + a.n;
    const box = document.createElement("details");
    box.className = "recchange";
    box.innerHTML = `<summary><b>คอลเลกชันเปลี่ยนตั้งแต่จัดเด็คครั้งล่าสุด</b> (${esc(REC_META.builtAt || "?")}):
        ${ch.added.length ? `ได้เพิ่ม <b>+${sum(ch.added)}</b> ใบ ${Object.entries(byColor).map(([c, n]) => `${colorDot(c)}${n}`).join(" ")}` : ""}
        ${ch.removed.length ? ` · ลดลง <b>−${sum(ch.removed)}</b> ใบ` : ""}
        <span class="muted">— ถ้าอยากได้เด็คใหม่ พิมพ์ <code>/rebuild-decks</code> ใน Claude Code (กดเพื่อดูรายการ)</span></summary>
      ${ch.added.length ? `<div class="tgrid">${ch.added.map((a) => `<div class="tile"><div class="timg">${imgTag(a.c)}<span class="tcopies">+${a.n}</span></div>
        <div class="sname">${esc(a.c.name)} <span class="muted">${esc(a.c.id)} · ${esc(recKind(a.c))}</span></div></div>`).join("")}</div>` : ""}
      ${ch.removed.length ? `<p class="muted small">ลดลง: ${ch.removed.map((r) => `${esc(r.c.name)} ${esc(r.c.id)} −${r.n}`).join(", ")}</p>` : ""}`;
    root.appendChild(box);
  }
  if (!list.length) { root.insertAdjacentHTML("beforeend", `<p class="empty">ไม่มีเด็คแนะนำสำหรับสีที่เลือก</p>`); return; }
  for (const d of list) {
    const rows = [...Object.entries(d.egg), ...Object.entries(d.main)].map(([id, n]) => ({ c: CARDS[id], n })).filter((r) => r.c)
      .sort((a, b) => recOrder(a.c) - recOrder(b.c) || a.c.id.localeCompare(b.c.id));
    const short = rows.filter((r) => owned(r.c.id) < r.n);
    const shape = {}; for (const r of rows) shape[recKind(r.c)] = (shape[recKind(r.c)] || 0) + r.n;
    const ups = (d.ups || []).map(([id, n]) => ({ c: CARDS[id], n })).filter((u) => u.c);
    const sec = document.createElement("article");
    sec.className = "cpanel recdeck";
    sec.id = `rec-${d.color}`;
    sec.innerHTML = `<div class="chead2">${colorDot(d.color)} <b>${esc(d.name)}</b>
        <span class="muted">${Object.entries(shape).map(([k, v]) => `${esc(k)} ${v}`).join(" · ")}</span>
        ${short.length ? `<span class="recwarn">ตอนนี้มีไม่พอ ${short.length} แบบ</span>` : `<span class="recok">มีครบทุกใบ ✓</span>`}
        <button class="ghost small copybtn">คัดลอกรายการ</button></div>
      <div class="tgrid">${rows.map((r) => `<div class="tile"><div class="timg">${imgTag(r.c)}<span class="tcopies${owned(r.c.id) < r.n ? " miss" : ""}">×${r.n}</span>${stapleBadge(r.c.id, "tstaple")}</div>
        <div class="sname">${esc(r.c.name)} <span class="muted">${esc(r.c.id)} · ${esc(recKind(r.c))}${owned(r.c.id) < r.n ? ` · <b class="miss">มี ${owned(r.c.id)}</b>` : ""}</span></div></div>`).join("")}</div>
      <div class="recnotes">
        <p><b>แผนการเล่น:</b> ${esc(d.plan)}</p>
        <p><b>จุดอ่อน:</b> ${esc(d.weak)}</p>
        ${ups.length ? `<p><b>คราฟเพิ่ม (คุ้มสุด):</b> ${fmtCraft(craftTotal(ups))}</p>
        <div class="tgrid">${ups.map((u) => `<div class="tile"><div class="timg">${imgTag(u.c)}<span class="tcopies miss">+${u.n}</span></div>
          <div class="sname">${esc(u.c.name)} <span class="muted">${esc(u.c.rarity || "")} · ${esc(u.c.pack || "")}${craftOf(u.c) ? ` · ${fmtPrice(u.c, u.n)}` : ""}</span></div></div>`).join("")}</div>
        <p class="muted small">${esc(d.upsNote || "")}</p>` : ""}
      </div>`;
    sec.querySelector(".copybtn").addEventListener("click", async (e) => {
      const text = `${d.name}\n` + rows.map((r) => `${r.n} ${r.c.name} ${r.c.id}`).join("\n");
      try { await navigator.clipboard.writeText(text); e.target.textContent = "คัดลอกแล้ว ✓"; } catch { e.target.textContent = "คัดลอกไม่ได้"; }
    });
    root.appendChild(sec);
  }
}

// 2) Collection grid with +/- editing, grouped by pack
function collHave(root, colors) {
  const all = Object.values(CARDS).filter((c) => cardColors(c).some((x) => colors.includes(x)) && cardVisible(c));
  const bar = document.createElement("div");
  bar.className = "collbar";
  const stat = colors.map((col) => {
    const cs = Object.values(CARDS).filter((c) => cardColors(c).includes(col));
    const have = cs.filter((c) => owned(c.id)).length;
    return `${colorDot(col)} ${esc(col)} <b>${have}</b>/${cs.length} แบบ (${cs.length ? Math.round((have / cs.length) * 100) : 0}%)${COLL.colorsEntered.includes(col) ? "" : ` <span class="muted">· ยังไม่ได้กรอก</span>`}`;
  });
  bar.innerHTML = `<span>${stat.join(" &nbsp; ")}</span>
    <label class="check"><input type="checkbox" id="collOnly" ${collOnlyOwned ? "checked" : ""}> แสดงเฉพาะใบที่มี</label>
    <span class="muted small">กด + / − เพื่อแก้จำนวน (บันทึกลง data/collection.json อัตโนมัติ)</span>`;
  bar.querySelector("#collOnly").addEventListener("change", (e) => { collOnlyOwned = e.target.checked; localStorage.setItem("alysion.collOnlyOwned", collOnlyOwned ? "1" : "0"); renderCollection(); });
  root.appendChild(bar);

  const shown = all.filter((c) => !collOnlyOwned || owned(c.id));
  const byPack = groupBy(shown, (c) => c.pack || "?");
  const packs = [...byPack.keys()].sort((a, b) => (PACK_ORDER.indexOf(a) + 1 || 99) - (PACK_ORDER.indexOf(b) + 1 || 99));
  for (const p of packs) {
    const cs = byPack.get(p).sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
    const sec = document.createElement("article");
    sec.className = "cpanel";
    const have = cs.filter((c) => owned(c.id)).length;
    sec.innerHTML = `<div class="chead2"><b>${esc(packLabel(p) || p)}</b> <span class="muted">มี ${have}/${cs.length} แบบ</span></div><div class="tgrid"></div>`;
    const grid = sec.querySelector(".tgrid");
    for (const c of cs) {
      const el = document.createElement("div");
      el.className = "tile ctile" + (owned(c.id) ? "" : " own0");
      el.innerHTML = `<div class="timg">${imgTag(c)}${stapleBadge(c.id, "tstaple")}</div>
        <div class="sname">${esc(c.name)} <span class="muted">${esc(c.id)}</span></div>
        <div class="qty"><button data-d="-1" title="ลด">−</button><b>${owned(c.id)}</b><button data-d="1" title="เพิ่ม">+</button></div>`;
      el.querySelector(".qty").addEventListener("click", (e) => {
        const b = e.target.closest("button"); if (!b) return;
        setOwned(c.id, owned(c.id) + Number(b.dataset.d));
        el.querySelector(".qty b").textContent = owned(c.id);
        el.classList.toggle("own0", !owned(c.id));
      });
      grid.appendChild(el);
    }
    root.appendChild(sec);
  }
  if (!shown.length) root.insertAdjacentHTML("beforeend", `<p class="empty">ไม่มีการ์ดที่ตรงกับ filter</p>`);
}

// 3) Cards worth getting: popular in decks of these colours (or staples) that you own fewer of than decks usually run
function collNeed(root, colors) {
  const pool = filteredDecks(true).filter((d) => colors.includes(d.mainColor));
  const { rows, tier } = analyze(pool);
  const want = new Map();
  for (const r of rows) {
    const target = Math.max(1, Math.round(r.avg));
    if (owned(r.c.id) < target && cardVisible(r.c)) want.set(r.c.id, { c: r.c, pct: r.pct, n: r.incl, target, tier: tier(r) });
  }
  for (const [id, g] of Object.entries(STAPLES)) {
    if (want.has(id) || owned(id) || !g.some((x) => colors.includes(x.color)) || !CARDS[id] || !cardVisible(CARDS[id])) continue;
    if (!rows.some((r) => r.c.id === id)) want.set(id, { c: CARDS[id], pct: 0, n: 0, target: 1, tier: "tech" });
  }
  const list = [...want.values()].filter((w) => w.pct >= state.flex || STAPLES[w.c.id])
    .sort((a, b) => b.pct - a.pct || !!STAPLES[b.c.id] - !!STAPLES[a.c.id]);
  // Which pack holds most of the missing copies (weighted by how often decks use the card)
  const byPack = {};
  for (const w of list) {
    const p = w.c.pack || "?"; const s = (byPack[p] ||= { copies: 0, cards: 0, list: [] });
    const short = w.target - owned(w.c.id);
    s.copies += short; s.cards++; s.list.push({ c: w.c, n: short });
  }
  const packs = Object.entries(byPack).sort((a, b) => b[1].copies - a[1].copies);
  const allCraft = craftTotal(list.map((w) => ({ c: w.c, n: w.target - owned(w.c.id) })));
  const head = document.createElement("article");
  head.className = "cpanel";
  head.innerHTML = `<div class="chead2"><b>การ์ดที่ควรหาเพิ่ม</b> <span class="muted">${list.length} การ์ด · จากเด็คสี ${esc(colors.join(", "))} ${pool.length} เด็ค ·
      แสดงการ์ดที่ใส่ ≥${state.flex}% (Flex ขึ้นไป) หรือเป็น ★ Staple แต่มีไม่ถึงจำนวนใบที่นิยมใส่</span>${hasCraft() ? ` <span>· ใช้ทั้งหมด ${fmtCraft(allCraft)}</span>` : ""}</div>
    <div class="sharelegend">${packs.map(([p, s]) => `<span class="pklink">${esc(packLabel(p) || p)} <b>${s.copies}</b> ใบ <span class="muted">(${s.cards} แบบ)</span>${hasCraft() ? ` ${fmtCraft(craftTotal(s.list))}` : ""}</span>`).join("")}</div>
    <div class="tgrid"></div>`;
  const grid = head.querySelector(".tgrid");
  for (const w of list) {
    const el = document.createElement("div");
    el.className = "tile";
    el.innerHTML = `<div class="timg">${imgTag(w.c)}<span class="tcopies miss">มี ${owned(w.c.id)}/${w.target}</span>${stapleBadge(w.c.id, "tstaple")}</div>
      <div class="sname">${esc(w.c.name)} <span class="badge tier-${w.tier}">${w.tier}</span></div>
      ${pctBar(w.pct)}<div class="tstat"><b>${w.pct.toFixed(0)}%</b> <span class="muted">(${w.n} เด็ค) · ${esc(w.c.rarity || "")} · ${esc(w.c.pack || "?")}</span>
      ${craftOf(w.c) ? ` · ${fmtPrice(w.c, w.target - owned(w.c.id))}` : ""}</div>`;
    grid.appendChild(el);
  }
  if (!list.length) grid.outerHTML = `<p class="empty">มีครบแล้ว หรือไม่มีการ์ดที่ตรงกับ filter</p>`;
  root.appendChild(head);
}

const statsShowAll = new Set();
function renderStats(decks) {
  const root = $("#statsView");
  root.innerHTML = "";
  if (!decks.length) { root.innerHTML = `<p class="empty">ไม่พบเด็คที่ตรงกับ filter</p>`; return; }
  const byColor = [...groupBy(decks, (d) => d.mainColor)].sort((a, b) => b[1].length - a[1].length);
  const pctOf = (n, total) => ((n / total) * 100).toFixed(1);

  // Overall color share bar
  const share = document.createElement("div");
  share.className = "share";
  share.innerHTML = `<h3>สัดส่วนเด็คตามสีหลัก <span class="muted">(${decks.length} เด็ค)</span></h3>
    <div class="sharebar">${byColor.map(([c, ds]) => `<div class="c-${esc(c)}" style="flex:${ds.length}" title="${esc(c)} ${pctOf(ds.length, decks.length)}%"></div>`).join("")}</div>
    <div class="sharelegend">${byColor.map(([c, ds]) => `<span>${colorDot(c)} ${esc(c)} <b>${pctOf(ds.length, decks.length)}%</b> <span class="muted">(${ds.length})</span></span>`).join("")}</div>`;
  root.appendChild(share);

  for (const [color, ds] of byColor) {
    const panel = document.createElement("article");
    panel.className = "cpanel";
    const archs = [...groupBy(ds, (d) => d.arch)].sort((a, b) => b[1].length - a[1].length);
    const a = analyze(ds);
    a.rows = a.rows.filter((r) => cardVisible(r.c));
    const showAll = statsShowAll.has(color);
    const cardRows = showAll ? a.rows : a.rows.slice(0, 15);
    panel.innerHTML = `
      <div class="chead2">${colorDot(color)} <b>${esc(color)}</b> <span class="muted">${ds.length} เด็ค · ${pctOf(ds.length, decks.length)}% ของทั้งหมด</span></div>
      <div class="cgrid">
        <div class="carchs">
          <h4>เด็คในสีนี้</h4>
          ${archs.map(([name, list]) => `<div class="arow" data-arch="${esc(name)}" title="ดูรายละเอียด archetype นี้">
              <span class="an">${esc(name)}</span>
              <div class="cbar"><div class="fill" style="width:${pctOf(list.length, ds.length)}%"></div><span class="pct">${pctOf(list.length, ds.length)}% (${list.length})</span></div>
            </div>`).join("")}
        </div>
        <div class="ccards">
          <h4>การ์ดที่ใส่บ่อยในสีนี้ <span class="muted">% ของเด็คสี${esc(color)}ที่ใส่</span></h4>
          <div class="crows"></div>
          ${a.rows.length > 15 ? `<button class="ghost more">${showAll ? "แสดงแค่ 15 อันดับแรก" : `แสดงทั้งหมด (${a.rows.length} การ์ด)`}</button>` : ""}
        </div>
      </div>`;
    const box = panel.querySelector(".crows");
    cardRows.forEach((r) => box.appendChild(cardRow(r)));
    panel.querySelectorAll(".arow").forEach((el) => el.addEventListener("click", () => {
      state.arch = el.dataset.arch; state.view = "arch"; expanded.add(state.arch); syncInputs(); render();
    }));
    panel.querySelector(".more")?.addEventListener("click", () => { showAll ? statsShowAll.delete(color) : statsShowAll.add(color); render(); });
    root.appendChild(panel);
  }
}

function renameArch(name, ds) {
  const next = prompt(`ตั้งชื่อใหม่ให้ "${name}"\n(ตั้งให้ซ้ำกับกลุ่มอื่นเพื่อรวมกลุ่ม, เว้นว่างเพื่อคืนค่าเดิม)`, name);
  if (next === null) return;
  for (const d of ds) { if (next.trim()) aliases[d.baseArch] = next.trim(); else delete aliases[d.baseArch]; }
  localStorage.setItem(ALIAS_KEY, JSON.stringify(aliases));
  assignArchetypes(); fillArchSelect(); render();
}

function fillArchSelect() {
  const sel = $("#fArch");
  const counts = [...groupBy(DECKS, (d) => d.arch)].sort((a, b) => b[1].length - a[1].length);
  sel.innerHTML = `<option value="">ทั้งหมด (${counts.length})</option>` + counts.map(([n, ds]) => `<option value="${esc(n)}">${esc(n)} (${ds.length})</option>`).join("");
  sel.value = state.arch;
}

function render() {
  const decks = filteredDecks();
  $("#coreVal").textContent = state.core; $("#flexVal").textContent = state.flex; $("#minVal").textContent = state.min;
  const archs = new Set(decks.map((d) => d.arch)).size;
  const chips = [];
  const toks = cardTokens();
  // [label, what the ✕ clears]
  if (toks.length) chips.push([`การ์ด: ${toks.map((t) => esc(tokenLabel(t))).join(state.cardMode === "or" ? " หรือ " : " + ")}`, "cards"]);
  if (state.arch) chips.push([`archetype: ${esc(state.arch)}`, "arch"]);
  if (state.colors.size) chips.push([`สี: ${[...state.colors].map(colorDot).join("")}`, "colors"]);
  if (state.search) chips.push([`ค้นหา: ${esc(state.search)}`, "search"]);
  if (state.days) chips.push([`ภายใน ${state.days} วัน`, "days"]);
  if (state.staplesOnly) chips.push(["แสดงเฉพาะ ★ Staple", "staples"]);
  if (state.types.size || state.levels.size) chips.push([`แสดงการ์ด: ${esc([...state.types, ...[...state.levels].sort().map((l) => "Lv." + l)].join(", "))}`, "show"]);
  const removed = ALL_DECKS.length - DECKS.length;
  $("#summary").innerHTML = `<b>${decks.length}</b> / ${DECKS.length} เด็ค${removed ? ` <span class="muted" title="เด็คที่การ์ดตรงกันทุกใบถูกนับเป็นเด็คเดียว">(ตัดเด็คซ้ำออก ${removed})</span>` : ""} · <b>${archs}</b> archetype ${chips.map(([c, k]) => `<span class="chip on fchip">${c} <b class="x" data-clear="${k}" title="เอาตัวกรองนี้ออก">✕</b></span>`).join(" ")}`;
  $("#archView").hidden = state.view !== "arch";
  $("#statsView").hidden = state.view !== "stats";
  $("#staplesView").hidden = state.view !== "staples";
  $("#deckView").hidden = state.view !== "decks";
  $("#collView").hidden = state.view !== "coll";
  $("#recView").hidden = state.view !== "rec";
  document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b.dataset.view === state.view));
  renderCardInsight();
  ({ arch: renderArch, stats: renderStats, staples: renderStaples, decks: renderDecks, coll: renderCollection, rec: renderRecommended })[state.view](decks);
}

function syncInputs() {
  $("#fSearch").value = state.search; $("#fCard").value = state.card; $("#fArch").value = state.arch; $("#fDate").value = state.days;
  $("#fStaple").checked = state.staplesOnly;
  $("#fDedupe").checked = state.dedupe;
  $("#fCore").value = state.core; $("#fFlex").value = state.flex; $("#fMin").value = state.min; $("#fMerge").checked = state.merge;
  document.querySelectorAll("#fColors .chip").forEach((c) => c.classList.toggle("on", state.colors.has(c.dataset.c)));
  $("#cardChips").innerHTML = state.cards.map((t) => `<span class="chip on cardchip" data-t="${esc(t)}">${esc(tokenLabel(t))} <b class="x" title="เอาออก">✕</b></span>`).join("");
  $("#cardMode").hidden = cardTokens().length < 2;
  document.querySelectorAll("#cardMode button").forEach((b) => b.classList.toggle("on", b.dataset.m === state.cardMode));
  document.querySelectorAll("#fTypes .chip").forEach((c) => c.classList.toggle("on", state.types.has(c.dataset.t)));
  document.querySelectorAll("#fLevels .chip").forEach((c) => c.classList.toggle("on", state.levels.has(Number(c.dataset.l))));
}

// ---------- online mode (GitHub Pages) ----------
// On localhost the Node server handles sync + saving. Anywhere else (GitHub Pages) the page is static:
// data is rebuilt hourly by GitHub Actions; editing the collection needs the owner's GitHub token,
// kept only in this browser's localStorage and sent only to api.github.com.
const ONLINE = !["localhost", "127.0.0.1"].includes(location.hostname) || new URLSearchParams(location.search).has("static");
const GH = (() => {
  const owner = location.hostname.endsWith(".github.io") ? location.hostname.split(".")[0] : "";
  const repo = location.pathname.split("/").filter(Boolean)[0] || location.hostname;
  return { owner, repo, branch: "main", workflow: "deploy.yml" };
})();
const TOKEN_KEY = "alysion.ghToken";
const ghToken = () => localStorage.getItem(TOKEN_KEY) || "";
let collSha = null;
async function gh(pathname, opts = {}) {
  const r = await fetch(`https://api.github.com/repos/${GH.owner}/${GH.repo}${pathname}`, {
    ...opts, headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${ghToken()}`, ...(opts.body ? { "Content-Type": "application/json" } : {}) },
  });
  if (!r.ok) throw new Error(`GitHub ${r.status}: ${(await r.json().catch(() => ({}))).message || r.statusText}`);
  return r.status === 204 ? null : r.json();
}
const b64ToText = (b) => new TextDecoder().decode(Uint8Array.from(atob(b.replace(/\s/g, "")), (ch) => ch.charCodeAt(0)));
const textToB64 = (t) => { let s = ""; for (const x of new TextEncoder().encode(t)) s += String.fromCharCode(x); return btoa(s); };
async function ghLoadCollection() {
  const f = await gh(`/contents/data/collection.json?ref=${GH.branch}&t=${Date.now()}`);
  collSha = f.sha;
  return JSON.parse(b64ToText(f.content));
}
async function ghSaveCollection(retry = true) {
  const out = { updatedAt: new Date().toISOString().slice(0, 10), colorsEntered: COLL.colorsEntered, craftCost: COLL.craftCost || {}, cards: COLL.cards };
  if (!collSha) await ghLoadCollection();
  try {
    const r = await gh("/contents/data/collection.json", { method: "PUT", body: JSON.stringify({
      message: "Update collection (from website)", branch: GH.branch, sha: collSha, content: textToB64(JSON.stringify(out, null, 1)) }) });
    collSha = r.content.sha;
  } catch (e) {
    if (retry && /\b(409|422)\b/.test(e.message)) { collSha = null; return ghSaveCollection(false); } // file changed elsewhere: take the new sha, keep our edits
    throw e;
  }
}
function setEditUi() {
  const canEdit = !ONLINE || !!ghToken();
  document.body.classList.toggle("readonly", !canEdit);
  $("#modeTag").textContent = ONLINE ? (canEdit ? "· online (โหมดแก้ไข)" : "· online") : "· local";
  const b = $("#editBtn");
  b.hidden = !ONLINE;
  b.textContent = ghToken() ? "🔓 ออกจากโหมดแก้ไข" : "🔒 โหมดแก้ไข";
  b.title = ghToken() ? "ลบ token ออกจากเบราว์เซอร์นี้" : "ใส่ GitHub token (เฉพาะเจ้าของ) เพื่อแก้จำนวนการ์ด/ราคา";
}
$("#editBtn").addEventListener("click", async () => {
  if (ghToken()) { if (confirm("ออกจากโหมดแก้ไข และลบ token ออกจากเบราว์เซอร์นี้?")) { localStorage.removeItem(TOKEN_KEY); collSha = null; setEditUi(); render(); } return; }
  const t = (prompt("วาง GitHub token (fine-grained, สิทธิ์ Contents + Actions: Read and write เฉพาะ repo นี้)\ntoken จะเก็บไว้ในเบราว์เซอร์นี้เท่านั้น") || "").trim();
  if (!t) return;
  localStorage.setItem(TOKEN_KEY, t);
  try {
    const info = await gh("");
    if (!info.permissions?.push) throw new Error("token นี้ไม่มีสิทธิ์เขียน repo");
    await load();
  } catch (e) { localStorage.removeItem(TOKEN_KEY); alert("ใช้ token ไม่ได้: " + e.message); }
  setEditUi(); render();
});

// ---------- boot ----------
async function load() {
  const bust = ONLINE ? `?t=${Date.now()}` : ""; // GitHub Pages caches files ~10 min
  const optional = (url) => fetch(url + bust).then((r) => (r.ok ? r.json() : { cards: {} })).catch(() => ({ cards: {} }));
  const collP = ONLINE && ghToken() ? ghLoadCollection().catch(() => optional("data/collection.json")) : optional("data/collection.json");
  const [cards, decks, staples, coll, rec] = await Promise.all([
    fetch("data/cards.json" + bust).then((r) => r.json()),
    fetch("data/decks.json" + bust).then((r) => r.json()),
    optional("data/staples.json"),
    collP,
    optional("data/recommended.json"),
  ]);
  CARDS = cards; syncedAt = decks.syncedAt; STAPLES = staples.cards || {};
  REC = rec.decks || []; REC_META = { builtAt: rec.builtAt, snapshot: rec.collectionSnapshot || null };
  COLL = { colorsEntered: [], ...coll, cards: coll.cards || {} };
  ALL_DECKS = decks.decks.map(prepDeck);
  DECKS = state.dedupe ? dedupeDecks(ALL_DECKS) : ALL_DECKS;
  assignArchetypes();
  const used = new Set(DECKS.flatMap((d) => [...d.ids]));
  $("#cardList").innerHTML = [...used].map((id) => CARDS[id]).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name)).map((c) => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join("");
  const levels = [...new Set([...used].map((id) => CARDS[id]?.level).filter((l) => l != null))].sort((a, b) => a - b);
  $("#fLevels").innerHTML = levels.map((l) => `<button class="chip" data-l="${l}">Lv.${l}</button>`).join("");
  syncInputs();
  $("#syncInfo").textContent = `ข้อมูล ณ ${new Date(syncedAt).toLocaleString("th-TH")}`;
  fillArchSelect(); render();
}

$("#fColors").innerHTML = COLORS.map((c) => `<button class="chip" data-c="${c}">${colorDot(c)}${c}</button>`).join("");
$("#fColors").addEventListener("click", (e) => { const b = e.target.closest(".chip"); if (!b) return; state.colors.has(b.dataset.c) ? state.colors.delete(b.dataset.c) : state.colors.add(b.dataset.c); syncInputs(); render(); });
// Multi-card selection
const commitTyped = () => { const t = $("#fCard").value.trim(); if (t) addCard(CARDS[t.toUpperCase()] ? t.toUpperCase() : t); };
$("#fCard").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); commitTyped(); } });
$("#fCard").addEventListener("input", (e) => { if (e.inputType === "insertReplacementText" || (!e.inputType && CARDS[e.target.value])) commitTyped(); }); // picked from suggestions
$("#addCardBtn").addEventListener("click", (e) => { e.preventDefault(); commitTyped(); });
$("#cardChips").addEventListener("click", (e) => { const c = e.target.closest(".cardchip"); if (c && e.target.closest(".x")) removeCard(c.dataset.t); });
$("#cardMode").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; state.cardMode = b.dataset.m; syncInputs(); render(); });

$("#fTypes").innerHTML =CARD_TYPES.map((t) => `<button class="chip" data-t="${t}">${t}</button>`).join("");
const toggleIn = (set, v) => (set.has(v) ? set.delete(v) : set.add(v));
$("#fTypes").addEventListener("click", (e) => { const b = e.target.closest(".chip"); if (!b) return; toggleIn(state.types, b.dataset.t); syncInputs(); render(); });
$("#fLevels").addEventListener("click", (e) => { const b = e.target.closest(".chip"); if (!b) return; toggleIn(state.levels, Number(b.dataset.l)); syncInputs(); render(); });
const bind = (id, key, parse = (v) => v, ev = "input") => $(id).addEventListener(ev, (e) => { state[key] = parse(e.target.type === "checkbox" ? e.target.checked : e.target.value); if (key === "merge") { assignArchetypes(); fillArchSelect(); } render(); });
bind("#fSearch", "search"); bind("#fCard", "card"); bind("#fArch", "arch", String, "change"); bind("#fDate", "days", Number, "change");
bind("#fStaple", "staplesOnly", Boolean, "change");
$("#fDedupe").addEventListener("change", (e) => {
  state.dedupe = e.target.checked; localStorage.setItem("alysion.dedupe", state.dedupe ? "1" : "0");
  applyDedupe(); render();
});
bind("#fCore", "core", Number); bind("#fFlex", "flex", Number); bind("#fMin", "min", Number); bind("#fMerge", "merge", Boolean, "change");
document.querySelectorAll(".tab").forEach((b) => b.addEventListener("click", () => { state.view = b.dataset.view; render(); }));
// ✕ on the filter chips in the summary line
$("#summary").addEventListener("click", (e) => {
  const k = e.target.closest("[data-clear]")?.dataset.clear; if (!k) return;
  ({ cards: () => { state.cards = []; state.card = ""; }, arch: () => (state.arch = ""), colors: () => state.colors.clear(), search: () => (state.search = ""),
    days: () => (state.days = 0), staples: () => (state.staplesOnly = false), show: () => { state.types.clear(); state.levels.clear(); } })[k]();
  syncInputs(); render();
});
$("#resetBtn").addEventListener("click", () => { Object.assign(state, { search: "", card: "", colors: new Set(), arch: "", days: 0, core: 80, flex: 30, min: 2, types: new Set(), levels: new Set(), cards: [], cardMode: "and", staplesOnly: false }); syncInputs(); render(); });
$("#refreshBtn").addEventListener("click", async () => {
  const b = $("#refreshBtn"); b.disabled = true; b.textContent = "กำลังดึง…";
  try {
    if (ONLINE) {
      // Static site: with the owner's token, ask GitHub Actions to sync + redeploy now; otherwise just reload what is published.
      if (ghToken()) { await gh(`/actions/workflows/${GH.workflow}/dispatches`, { method: "POST", body: JSON.stringify({ ref: GH.branch }) }); alert("สั่งดึงข้อมูลใหม่แล้ว — รอ ~2–3 นาทีแล้วกดอีกครั้ง/รีเฟรชหน้า"); }
      await load();
    } else { const r = await fetch("/api/refresh", { method: "POST" }); if (!r.ok) throw new Error(await r.text()); await load(); }
  }
  catch (e) { alert("ดึงข้อมูลไม่สำเร็จ: " + e.message); }
  finally { b.disabled = false; b.textContent = "↻ ดึงข้อมูลใหม่"; }
});
// On every page open/refresh: ask the server to re-sync (skipped if synced < 60s ago), then load.
// While the tab stays open: reload data every hour.
async function refreshAndLoad() {
  $("#syncInfo").textContent = "กำลังอัปเดตข้อมูล…";
  if (!ONLINE) try { await fetch("/api/refresh?maxAge=60", { method: "POST" }); } catch {}
  await load();
}
// Phones: the filter panel is folded; tapping its "Filter" heading opens/closes it
$("#filters > h3").addEventListener("click", () => $("#filters").classList.toggle("open"));
setEditUi();
refreshAndLoad();
setInterval(refreshAndLoad, 60 * 60 * 1000);
