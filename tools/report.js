// Writes the deck report markdown. Usage: node report.js <projectDir> <outFile>
const fs = require("fs"), path = require("path");
const [P, OUT] = process.argv.slice(2);
const C = JSON.parse(fs.readFileSync(path.join(P, "data/cards.json")));
const COLL = JSON.parse(fs.readFileSync(path.join(P, "data/collection.json")));
const DECKS = require("./decks.js");
const price = COLL.craftCost;
const TH = { Red: "แดง", Blue: "ฟ้า", Yellow: "เหลือง", Green: "เขียว", Black: "ดำ", Purple: "ม่วง" };
const NOTES = {
  Red: {
    plan: "สาย ALYSION ที่นิยมสุดของสีแดง: Gemmon SD1-02 (ค้นการ์ด ALYSION จาก 5 ใบบน) → Liskmon → Reptilimon SD1-04 (ตีแล้วลบตัว ≤4000) → Rubeusdramon SD1-05 ×4 (Piercing + วิวัฒน์แล้วลบตัว ≤6000) ปิดด้วย Omnimon. หัวใจคือ Kanata Hondo ×4: ตั้ง memory เป็น 3 ทุกเทิร์น และเพิ่มเพดานการลบของตัว ALYSION +2000 (Reptilimon ลบได้ ≤6000, Rubeusdramon ≤8000; Tokomon/Gemmon BD1 ที่อยู่ใต้การ์ดเพิ่มอีก +1000). Agumon BT1-010 ค้น Kanata, Burning Drive ให้ตัว ALYSION ตีตัวที่ยังไม่นอนได้ → ไล่ลบบอร์ดทุกเทิร์น. WarGreymon ×2 เป็นบอสสำรอง, Volcanic Flare / Trident Revolver / Gravity Crush ช่วยคุมจังหวะ",
    weak: "Rubeusdramon BD1-006 (ตัวที่มี Security A. +1) ยังไม่มี — ใช้ SD1-05 อย่างเดียวจึงตีทีละ 1 ใบ (+Piercing); Kanata BD1-010 (memory +1 ตอนเริ่ม main) ยังไม่มี; ลบได้ไม่เกิน ~8000 DP — แพ้ตัวใหญ่ที่ DP สูงกว่า (ต้องพึ่ง Omnimon/Trident Revolver)",
    ups: [["BD1-010", 3], ["BD1-005", 3], ["BD1-001", 3], ["BD1-002", 2], ["BD1-006", 3]],
    upsNote: "ทุกใบเป็นซอง BD-01 และอยู่ใน 86–95% ของเด็ค Rubeusdramon ชุมชน — Kanata BD1-010 / Reptilimon / Tokomon ราคาใบละ 80 CP คุ้มที่สุด; Rubeusdramon BD1-006 ×3 (2,400 CP) คือส่วนที่แพงที่สุดในยอดนี้ ถ้ายังไม่คราฟจะเหลือ 1,120 CP",
  },
  Blue: {
    plan: "Yukinamon ตัวเต็มแบบเด็คชุมชน: ตัดการ์ดใต้ตัวคู่แข่งทุกจังหวะ — Renamon SD2-02 (ลงแล้วตัด 1 + inherit ตีแล้วตัด), Viximon SD2-01 (inherit ตีแล้วตัด), Sekkamon SD2-04 (วิวัฒน์แล้วตัด 2 + inherit ตีแล้ว unsuspend), Valner SD2-06 (ตั้ง memory 3 + พักตัวเพื่อตัด 1), Yukinamon BD2-007 (ตัด 3 + Blocker). จบด้วย Yukinamon SD2-05 ×4: ตีตัวที่ยังไม่นอนได้ และในการต่อสู้นับ 'จำนวนการ์ดใต้' แทน DP → ตัวคู่แข่งที่โดนตัดจนเหลือน้อยแพ้หมด. Renamon BD2-002 ค้นการ์ด ALYSION, Tenkomon SD2-03 จั่ว, Joe Kido ได้ memory ทุกครั้งที่ตัด, Pale Death เด้งตัว Lv.4 ลงมา, Hearts Attack ตัดการ์ดใต้ทั้งหมดของตัวเดียว. Gabumon ST2-03 ×4 (inherit: ตีแล้วตัดการ์ดใต้ตัว Lv.5 ลงมา) ทำให้ตัวบนทุกตัวตัดได้อีกจังหวะ, WereGarurumon ST2-08 ×1 (inherit: Security A. +1 เมื่อคู่แข่งมีตัวที่ไม่มีการ์ดใต้ — ซึ่งเด็คนี้สร้างให้เกิดเอง) ทำให้ Yukinamon ตี security ได้ 2 ใบ, Hammer Spark ×2 (+1 memory ฟรี) เร่งขึ้น Yukinamon เร็วขึ้น",
    weak: "Lv.4 10 ใบ (Lobomon 3 — วิวัฒน์บน Tamer สีฟ้าได้ด้วย); Hammer Spark มี 2 ใบ (เด็คชุมชนใส่ ~3); เจอเด็คที่ลงตัวไม่มีการ์ดใต้เยอะๆ (เช่น rookie rush) แผนตัดการ์ดใต้จะทำอะไรไม่ได้ ต้องพึ่ง Pale Death / Yukinamon ตีตรง",
    ups: [["BD2-003", 2], ["BD2-004", 1], ["BD2-002", 1], ["BD2-008", 1], ["BD2-001", 1], ["ST2-13", 1], ["BD2-007", 1]],
    upsNote: "เติมการ์ดซอง BD-02 ให้ครบ 4 (ใส่ 79–95% ของเด็ค Yukinamon ชุมชน) + Hammer Spark ใบที่ 3 — Yukinamon BD2-007 ใบที่ 3 คือส่วนที่แพงที่สุดในยอดนี้ (800 CP), ไม่เอาจะเหลือ 560 CP",
  },
  Yellow: {
    plan: "คอนโทรลลด DP: แทบทุกตัวมีเอฟเฟกต์ −DP ตอนลง/วิวัฒน์ (Angemon −3000, Meicoomon −4000, MagnaAngemon −3000, Mistymon 2×−3000, SlashAngemon −8000, WarGrowlmon Digi-Burst −4000) + option Blast Fire (ตั้ง DP = 3000) / Symphony No.1 (−7000) / Eden's Javelin. Kentaurosmon ลด Security Attack ของคู่แข่งได้ 5 ตัว และ Salamon/Magnadramon/Tactical Retreat ช่วยเติม security เมื่อโดนกดดัน. Kari Kamiya ให้ memory เมื่อ security เหลือ ≤3. ใหม่จาก BD-04: Purge Shine ×2 (คู่แข่งทั้งกระดาน −3000 — กวาด Lv.3/Lv.4), Tai Kamiya (+1000 DP ทุกตัวเมื่อ security ≤3 และได้ memory เมื่อลบด้วย DP 0). (Lucemon เอาออก — จำลองแล้ว trash เด็คนี้ถึง T6 มี ~8 ใบ ยังไม่ถึง 10 ที่ทำให้ลงถูก = ติดมือจนกลางเกม; ใส่กลับได้ถ้าอยากได้ตัวปลายเกม)",
    weak: "Tamer สีเหลืองมีแค่ Kari ×2 + Tai ×1 → RizeGreymon/ShineGreymon ใช้ความสามารถได้ไม่เต็ม (เลยใส่ ShineGreymon ไม่ได้); แรงบุกช้า ถ้าคู่แข่งบุกเร็วมาก security จะหมดก่อนตั้งตัว",
    ups: [["BT1-087", 4], ["BT2-039", 2], ["BT1-107", 3], ["BT3-003", 2]],
    upsNote: "T.K. Takaishi ใส่ 100% ในเด็คเหลืองชุมชน (memory + ค้น security), Magnadramon เพิ่มอีก 2 ให้ครบ 3, Holy Wave / Upamon ราคาถูก. ไม่แนะนำคราฟ Lucemon เพิ่ม — เด็คนี้ trash ช้ากว่าม่วง. จุดอ่อนจากการจำลอง: Lv3 ราคาลง 4–5 (Salamon/BushiAgumon) ทำให้เทิร์นแรกๆ ติดขัดบ่อยกว่าสีอื่น (~1.9 เทิร์น/เกม) — T.K. ช่วยเรื่อง memory ได้ตรงจุด",
  },
  Green: {
    plan: "ล็อกบอร์ดด้วยการ suspend: Kuwagamon / Puppet Pummel / Cherry Blast / Tentomon (inherit) ทำให้ตัวคู่แข่งนอนอยู่ → Lillymon / Puppetmon ห้าม unsuspend → Terrors Cluster ส่งตัวที่นอนอยู่ลงใต้เด็ค. ตัวบุก Kabuterimon / Gargomon ได้ +1000 DP ต่อตัวคู่แข่งที่นอนอยู่, HerculesKabuterimon ×3 มี Piercing + unsuspend ได้. Dokugumon ค้น Lv5+Lv6 ช่วยหาตัวจบ. ใหม่จาก BD-04: Lalamon ×4 (inherit ของสาย Rosemon) + Lilamon ×2 (Digi-Burst suspend / ตีแล้ว suspend เพิ่มเมื่อมี Tamer)",
    weak: "Tamer มี Mimi/Ken อย่างละใบ; Rosemon มี 1 ใบ; ไม่มีการลบตัวตรงๆ เลย (พึ่งการ suspend + ตีทะลุ) — แพ้ Blocker หนาๆ (สีดำ)",
    ups: [["BT1-089", 2], ["ST4-14", 3], ["ST4-15", 3], ["BT2-004", 1], ["BD1-009", 2]],
    upsNote: "Mimi Tachikawa ใส่ 89–100% (memory + ฟักไข่), Izzy ST4-14 ได้ memory ทุกครั้งที่คู่แข่ง suspend — เข้ากับแผนนี้มาก. อยากได้แรงขึ้น: Rosemon +2 (1,600 CP), Lilamon ใบที่ 3 (800 CP)",
  },
  Black: {
    plan: "กำแพง Blocker: ตัว Blocker เต็มทุกเลเวล (Pteromon, Gotsumon, Galemon, Sealsdramon 6000, Guardromon 7000, Andromon, BanchoGolemon, WarGreymon BT2-065, BryweLudramon inherit Blocker) + Shoto Kazama ได้ memory เมื่อมี Blocker, Atomic Ray ปลุก Blocker ให้กันซ้ำ. ฝั่งบุกใช้ MetalGreymon BT2-063 ×4 (Reboot, inherit Security A. +1) / GrandGalemon / Zephagamon และ Beast Cyclone เพิ่ม Security A. +1 ให้ทุก Blocker/Reboot. ลบตัวด้วย Andromon BD2-005, Baboongamon, Looking Back…, Infinity Cannon",
    weak: "Zephagamon มี 1 ใบ (เด็คชุมชนใส่ 3–4), Galemon/Pteromon อย่างละใบ → ใช้สาย ALYSION ได้ไม่เต็ม; Blocker หลายตัวโจมตีไม่ได้/เสีย memory ตอนตี → เกมยาว ปิดช้า",
    ups: [["BD3-004", 3], ["BD3-003", 3], ["BD3-005", 2], ["BD3-008", 1], ["BD3-007", 3]],
    upsNote: "การ์ดชุด BD-03 สาย Zephagamon ใส่ 76–94% ของเด็คดำชุมชน; ในยอดนี้รวม Zephagamon ×3 (2,400 CP) ซึ่งเป็นตัวที่เปลี่ยนเด็คนี้เป็นเด็ค meta ได้เลย — ถ้ายังไม่คราฟ Zephagamon จะเหลือ 960 CP",
  },
  Purple: {
    plan: "วนซากจาก trash: ตัว Lv3 ส่วนใหญ่มี On Deletion (จั่ว/ได้ memory/ทิ้งการ์ดลง trash) → Night Raid ×3 เรียก Lv3 กลับจาก trash ฟรี, Anubismon ×2 (Lv6 วิวัฒน์ถูกแค่ 3) ลง Lv3 จาก trash ฟรีตอนวิวัฒน์. Devimon BT4-081 ×2 (Digi-Burst ลบ Lv3) / Saberdramon ×2 เติม Lv.4 ให้ครบ 10. Myotismon BD2-006 ×4 ลบ Lv3 ตอนวิวัฒน์ + inherit Retaliation (ตายแล้วลากคู่ต่อสู้ไปด้วย), Devimon/Saberdramon ก็มี Retaliation. ตัวจบ VenomMyotismon / Beelzemon (Impmon วิวัฒน์ได้ถูกเมื่อ trash ≥10) / Plutomon / Millenniummon (ส่งตัวคู่แข่งลงใต้เด็ค, ตายแล้วเกิดใหม่). Matt Ishida ×2 ตั้ง memory เป็น 3 ทุกเทิร์น + ดึงการ์ดม่วง/Option กลับจาก trash, Jack Raid ×3 (ใช้ 0 memory) ได้ memory ตามจำนวน trash — ต้นเกมใช้ไม่ได้ แต่ราว T6 trash ถึง ~10 ใบ (การ์ดที่โดนตี security + ตัวที่ตาย) แล้วจะคุ้มมาก; เด็คม่วงสาย trash ชุมชนใส่ 3–4 ใบ, Gabumon BT2-069 ×3 (ตัวเริ่มที่ดีที่สุดของสี ตายแล้วจั่ว 2 ทิ้ง 1 = เติม trash ไปด้วย). Death Claw ×2 (1 memory) สละตัวเราเองเพื่อลบตัว Lv.4 ลงมาของคู่แข่ง — สละ Gabumon/Impmon/Tapirmon แล้วได้ On Deletion (จั่ว/ลง trash) เป็นของแถม และยังมี Security effect ลบตัว Lv.4 ลงมาด้วย",
    weak: "ตัวบอสส่วนใหญ่มีใบเดียว (VenomMyotismon 2) → ต้องพึ่งการวนจาก trash; Matt มี 2 ใบ (เด็คชุมชนใส่ 3–4); Digimon ส่วนใหญ่ DP ต่ำ ถ้าคู่แข่งไม่ยอมแลกตัว Retaliation จะไม่ได้ทำงาน",
    ups: [["BT3-006", 3], ["BT2-090", 1], ["BT3-092", 1]],
    upsNote: "DemiMeramon (ไข่ จั่วเมื่อตาย) ใส่ 76% ของเด็คม่วงทั้งหมด, Matt ใส่ 83% ของเด็คสายนี้ (Gabumon BT2-069 ×3 และ Death Claw ×2 มีครบแล้ว), MaloMyotismon เข้ากับ Arukenimon/Mummymon ที่คุณมีอยู่ — ถ้าได้ MaloMyotismon แล้วค่อยใส่ Immortal Vampire กลับ (ตอนนี้เอาออก: ใช้ 8 memory แต่ Myotismon ส่วนใหญ่ราคาลงแค่ 6–7 และไม่ได้ effect ตอนวิวัฒน์). งบเยอะ: Lilithmon ×3 (2,400 CP)",
  },
};
const kind = (c) => c.type === "Digi-Egg" ? "Digi-Egg" : c.type === "Digimon" ? "Lv." + c.level : c.type;
const order = (c) => c.type === "Digi-Egg" ? 0 : c.type === "Digimon" ? c.level : c.type === "Tamer" ? 8 : 9;
let md = `# เด็คแนะนำจากการ์ดที่มี (${COLL.updatedAt})\n\n`;
md += `ใช้เฉพาะการ์ดใน \`data/collection.json\` ทุกเด็คตรวจด้วยสคริปต์แล้ว: main 50 ใบพอดี, Digi-Egg ≤ 5, รหัสละ ≤ 4 ใบ, ไม่เกินจำนวนที่มี, เคารพการจำกัดการ์ดของเกม (\`data/restrictions.json\` — ตอนนี้จำกัด 1 ใบ: Argomon BT2-047, Hidden Potential Discovered!).\n`;
md += `อ้างอิงเด็คชุมชนจาก alysioncards.com (ตัดเด็คซ้ำแล้ว) + อ่าน effect ทุกใบ. การ์ดสี White มีแค่ 3 ใบ ทำเด็คเองไม่ได้ จึงเอา Omnimon ไปใส่เด็คแดง และ Millenniummon ไปใส่เด็คม่วง\n\n`;
md += `> หมายเหตุ: การ์ดรหัส ST/SD ในรายการ "คราฟเพิ่ม" มาจาก Starter/Structure Deck — ยังไม่รู้ว่าในเกมคราฟได้หรือไม่ (ราคาคิดตาม rarity)\n\n`;
for (const [col, d] of Object.entries(DECKS)) {
  const N = NOTES[col];
  md += `## ${TH[col]} — ${d.name}\n\n`;
  const rows = [...Object.entries(d.egg), ...Object.entries(d.main)].sort((a, b) => order(C[a[0]]) - order(C[b[0]]) || a[0].localeCompare(b[0]));
  md += `| ใบ | รหัส | ชื่อ | ประเภท | Rarity |\n|---|---|---|---|---|\n`;
  for (const [id, n] of rows) md += `| ${n} | ${id} | ${C[id].name} | ${kind(C[id])} | ${C[id].rarity} |\n`;
  const sh = {}; for (const [id, n] of rows) { const k = kind(C[id]); sh[k] = (sh[k] || 0) + n; }
  md += `\n**สัดส่วน:** ${Object.entries(sh).map(([k, v]) => `${k} ${v}`).join(" · ")}\n\n`;
  md += `**แผนการเล่น:** ${N.plan}\n\n**จุดอ่อน:** ${N.weak}\n\n`;
  let cp = 0, coin = 0;
  md += `**คราฟเพิ่ม (คุ้มสุด):**\n\n`;
  for (const [id, n] of N.ups) {
    const c = C[id], v = (price[c.rarity] || 0) * n, isCoin = c.rarity === "P";
    isCoin ? (coin += v) : (cp += v);
    md += `- ${n}× ${id} ${c.name} (${c.rarity}) — ${v.toLocaleString()} ${isCoin ? "coin" : "CP"}\n`;
  }
  md += `- **รวม ${cp.toLocaleString()} CP${coin ? ` · ${coin.toLocaleString()} coin` : ""}** — ${N.upsNote}\n\n`;
}
fs.writeFileSync(OUT, md);
// Same decks for the website's "เด็คแนะนำ" tab
// collectionSnapshot = owned cards the decks were last built from, so the page can show cards gained since.
// It only moves forward for colours passed with --accept=Purple,Red (or --accept=all) — i.e. colours you actually
// re-checked. Running without --accept keeps the old snapshot, so new cards stay flagged.
const acceptArg = (process.argv.find((a) => a.startsWith("--accept=")) || "").slice(9);
const accept = new Set(acceptArg.split(",").filter(Boolean));
const recFile = path.join(P, "data", "recommended.json");
let snapshot = {};
try { snapshot = JSON.parse(fs.readFileSync(recFile)).collectionSnapshot || {}; } catch {}
let builtAt = null;
try { builtAt = JSON.parse(fs.readFileSync(recFile)).builtAt; } catch {}
if (accept.size) {
  const cols = (id) => String(C[id]?.color || "").split("/");
  const ok = (id) => accept.has("all") || cols(id).some((c) => accept.has(c));
  const next = {};
  for (const id of new Set([...Object.keys(snapshot), ...Object.keys(COLL.cards)])) {
    const v = ok(id) ? COLL.cards[id] : snapshot[id];
    if (v) next[id] = v;
  }
  snapshot = next;
  builtAt = new Date().toISOString().slice(0, 10);
}
const json = { builtAt, collectionSnapshot: snapshot,
  decks: Object.entries(DECKS).map(([color, d]) => ({ color, name: d.name, arch: d.arch, egg: d.egg, main: d.main, ...NOTES[color] })) };
fs.writeFileSync(recFile, JSON.stringify(json, null, 1));
if (!accept.size) console.log("snapshot unchanged (pass --accept=<Color,...|all> after re-checking those colours)");
console.log("written", OUT, md.length);
