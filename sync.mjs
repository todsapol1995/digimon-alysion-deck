// Pulls community decks + card database from alysioncards.com into ./data
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const BASE = "https://alysioncards.com";
const IMG = "https://images.alysioncards.com";
const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "data");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url) {
  const res = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 (local deck analyzer)" } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

// Card text shown in the detail popup; "-" means empty on the source site
const TEXT_FIELDS = ["effect", "digivolveEffect", "securityEffect", "aceEffect", "optionCardEffect", "dualEffect", "linkRequirement", "linkEffect", "linkDP",
  "specialDigivolve", "dnaDigivolve", "burstDigivolve", "digiXros", "assembly", "rule"];
const has = (v) => v != null && String(v).trim() !== "" && String(v).trim() !== "-";
function cardDetails(c) {
  const text = {};
  for (const f of TEXT_FIELDS) if (has(c[f])) text[f] = String(c[f]).trim();
  const evo = (Array.isArray(c.digivolveCondition) ? c.digivolveCondition : []).map((d) => ({ color: d.color, level: d.level, cost: d.cost }));
  const pick = (v) => (has(v) ? String(v).trim() : null);
  return {
    playCost: pick(c.playCost), dp: pick(c.dp), form: pick(c.form), attribute: pick(c.attribute), trait: pick(c.type),
    evo, text, restriction: pick(c.restrictions?.english) !== "Unrestricted" ? pick(c.restrictions?.english) : null,
    pack: pick(c.acquisition_info), // Alysion pack code: BD-01..BD-04, ST-1..ST-6, SHOP, SD-1/2
  };
}

// Staple list from the site's "Staple Cards at Launch" guide (server-rendered Next.js page; the guide
// markdown is inside the self.__next_f.push(...) payload). Returns { cardId: [{ color, note }] }.
const STAPLES_URL = `${BASE}/guides/staple-cards-at-launch`;
async function fetchStaples() {
  const res = await fetch(STAPLES_URL, { headers: { "User-Agent": "Mozilla/5.0 (local deck analyzer)" } });
  if (!res.ok) throw new Error(`${res.status} ${STAPLES_URL}`);
  const html = await res.text();
  const payload = [...html.matchAll(/self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g)]
    .map((m) => JSON.parse(`"${m[1]}"`)).join("");
  const start = payload.indexOf("## Red");
  if (start < 0) throw new Error("staple guide format changed");
  const staples = {};
  let color = null;
  for (const line of payload.slice(start).split("\n")) {
    const h = line.match(/^##\s+(\w+)/);
    if (h) { color = h[1]; continue; }
    const m = line.match(/^\[([^\]]+)\]\(card:([A-Za-z0-9-]+)\)\s*(.*)$/);
    if (m && color) (staples[m[2]] ||= []).push({ color, note: m[3].trim() });
    else if (color && /^\w+:\[/.test(line)) break; // end of guide markdown
  }
  return { source: STAPLES_URL, fetchedAt: Date.now(), cards: staples };
}

export async function sync(log = console.log) {
  await mkdir(DATA_DIR, { recursive: true });

  log("Fetching card database…");
  const rawCards = await getJson(`${BASE}/api/cards`);
  const cards = {};
  for (const c of rawCards) {
    const id = c.id || c.cardNumber;
    if (!id || cards[id]) continue;
    const lv = parseInt(String(c.cardLv || "").replace(/\D/g, ""), 10);
    cards[id] = {
      id,
      name: c.name,
      type: c.cardType,
      color: c.color,
      level: Number.isNaN(lv) ? null : lv,
      rarity: c.rarity,
      img: c.cardImage ? `${IMG}/${c.cardImage.replace(/^\/+/, "")}` : null,
      ...cardDetails(c),
    };
  }
  // The site's restriction list follows the paper TCG; the app has its own (data/restrictions.json, edited by hand).
  // restriction = in-game rule, restrictionTcg = what the site says (for reference only).
  let inGame = null;
  try { inGame = JSON.parse(await readFile(path.join(DATA_DIR, "restrictions.json"), "utf8")).cards || {}; } catch {}
  if (inGame) for (const c of Object.values(cards)) { c.restrictionTcg = c.restriction; c.restriction = inGame[c.id] || null; }
  log(`  ${Object.keys(cards).length} cards`);

  log("Fetching community decks…");
  const decks = [];
  for (let page = 1; page < 500; page++) {
    const r = await getJson(`${BASE}/api/community/decks?page=${page}&limit=50`);
    decks.push(...(r.decks || []));
    log(`  page ${page}: ${r.decks?.length || 0}`);
    if (!r.hasNext) break;
    await sleep(300);
  }
  log(`  ${decks.length} decks`);

  const out = { syncedAt: Date.now(), decks: decks.map(({ id, name, cards, publishedAt, updatedAt }) => ({ id, name, cards, publishedAt, updatedAt })) };
  await writeFile(path.join(DATA_DIR, "cards.json"), JSON.stringify(cards));
  await writeFile(path.join(DATA_DIR, "decks.json"), JSON.stringify(out));

  // Staples are optional: if the guide can't be read, keep the previous staples.json
  let staples = null;
  try {
    log("Fetching staple guide…");
    const s = await fetchStaples();
    staples = Object.keys(s.cards).length;
    if (staples) await writeFile(path.join(DATA_DIR, "staples.json"), JSON.stringify(s));
    log(`  ${staples} staple cards`);
  } catch (e) { log(`  staple guide skipped: ${e.message}`); }
  return { cards: Object.keys(cards).length, decks: decks.length, staples };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  sync().catch((e) => { console.error(e); process.exit(1); });
}
