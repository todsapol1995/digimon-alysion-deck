# Alysion Deck Analyzer (local)

เว็บ local สำหรับวิเคราะห์เด็คการ์ดเกม **Digimon Alysion** โดยดึงข้อมูลจาก https://alysioncards.com
ผู้ใช้คุยภาษาไทย → ตอบเป็นภาษาไทย

## Working preferences (ผู้ใช้ขอไว้)
- **Auto-compact ที่ 50% ของ context** (เปลี่ยนจาก 40% เมื่อ 2026-11-27) — ตั้งไว้ใน `.claude/settings.local.json`
  (`env.CLAUDE_AUTOCOMPACT_PCT_OVERRIDE = "50"`) ถ้าไฟล์หายให้ตั้งใหม่ (มีผลกับ session ใหม่)
  - ผู้ใช้อยากให้ compact **หลังทำงานเสร็จ ไม่ใช่กลางงาน** — ตั้งค่าแบบ "รอให้งานจบ" ไม่ได้ (auto-compact ตัดตาม % เท่านั้น)
    ทางแก้ที่ตกลงไว้: **ก่อนเริ่มงานทุกครั้งให้ประเมินคร่าวๆ** ว่า context ใช้ไปเท่าไหร่ + งานจะกินเพิ่มแค่ไหน
    (อ่านไฟล์ใหญ่ เช่น app.js, หลายไฟล์, ทดสอบเบราว์เซอร์หลายรอบ, งานหลายขั้น)
    — **ถ้าอยู่ราว 35–40% แล้ว และงานนั้นมีโอกาสดันไปถึง 50% ในรอบเดียว → หยุดก่อนลงมือ**
    แล้วแนะนำให้ผู้ใช้พิมพ์ `/compact` (Claude สั่ง compact เองไม่ได้) จากนั้นค่อยเริ่มงาน; งานเล็กทำต่อได้เลย
    ถ้าโดน compact กลางงาน ให้ทำงานต่อจากสรุปจนจบ แล้วตรวจผลซ้ำ (เช่นเปิดหน้าเว็บเช็ก) ก่อนรายงาน
- ถ้าไม่เข้าใจสิ่งที่ผู้ใช้ขอ (เช่นภาพที่วงไว้) ให้ถามก่อนทำ
- ผู้ใช้ไม่อยากให้มีโปรแกรมรันค้างตอนไม่ได้ใช้ → **ห้ามตั้ง autostart ตอนเปิดเครื่อง** (เคยทำแล้วถูกขอให้เอาออก)

## Data source (public API, no login)
- `GET https://alysioncards.com/api/community/decks?page=N&limit=50` — limit สูงสุด 50, ดู `hasNext`
  - deck: `{ id, name, cards: { "<cardId>": copies }, publishedAt, updatedAt }`
- `GET https://alysioncards.com/api/cards` — การ์ดทั้งหมด (~630 ใบ)
- รูปการ์ด: `https://images.alysioncards.com/<cardImage>` เช่น `.../assets/images/cards/BT3-031.webp`
- ลิงก์เด็คต้นฉบับ: `https://alysioncards.com/decks?deck=<id>` (ไม่ใช่ `/decks/<id>` → 404)
- ไกด์ Staple: `https://alysioncards.com/guides/staple-cards-at-launch` (Next.js SSR — markdown อยู่ใน `self.__next_f.push` payload, ลิงก์การ์ดรูปแบบ `[Name](card:ID) note` ใต้หัวข้อ `## <Color>`)
- ซองในเกม (field `acquisition_info` ของ /api/cards): BD-01 New Evolution, BD-02 Ultimate Power, BD-03 Union Impact, BD-04 Great Legend, ST-1..ST-6 (มาจาก Starter Deck), SHOP, SD-1/2 — วิธีได้ ST/SHOP ในแอปยังไม่มีแหล่งยืนยัน (ณ 2026-11-27 เกมยังไม่เปิด)
- ไอคอนแอป: จาก App Store listing ของ DIGIMON ALYSION (iTunes Search API) เก็บที่ `assets/`

## Files
| File | หน้าที่ |
|---|---|
| `sync.mjs` | ดึงการ์ด + เด็คทั้งหมด → `data/cards.json`, `data/decks.json` (การ์ดเก็บ effect text, evo, DP, `pack` ฯลฯ ด้วย) + ไกด์ staple → `data/staples.json` (ถ้าดึงไกด์ไม่ได้จะเก็บไฟล์เดิมไว้ ไม่ทำให้ sync ล้ม) |
| `server.mjs` | Node http server (ไม่มี dependency) port 3000, serve `public/` + `/data/`, `POST /api/refresh?maxAge=<sec>` สั่ง sync, `PUT /api/collection` บันทึกการ์ดที่มี |
| `data/collection.json` | การ์ดที่ผู้ใช้มี (กรอกเอง/แก้ในแท็บ การ์ดของฉัน) — **อย่าลบ/เขียนทับ** |
| `public/index.html`, `app.js`, `style.css` | หน้าเว็บทั้งหมด (vanilla JS, คำนวณสถิติฝั่ง client) |
| `Open Deck Analyzer.vbs` | ตัวเปิดแบบกดเอง: ถ้า server ไม่รันจะเปิดแบบซ่อน (`--idle-exit=90`) แล้วเปิดเบราว์เซอร์ |
| `start-hidden.vbs`, `install-autostart.ps1` | ของเก่าสำหรับ autostart — **ตอนนี้ไม่ได้ติดตั้ง** (ผู้ใช้ไม่ต้องการ) |
| `assets/app-icon.ico/.png` | ไอคอน shortcut + favicon (`public/favicon.png`) |

Shortcut บน Desktop: `Deck Analyzer.lnk` → `wscript "Open Deck Analyzer.vbs"`, ไอคอน `assets/app-icon.ico`

## Running
- เปิด: ดับเบิลคลิก Deck Analyzer บน Desktop หรือ `node server.mjs` → http://localhost:3000
- Sync อัตโนมัติ: ตอน server start, ทุก 1 ชม., ทุกครั้งที่เปิด/รีเฟรชหน้า (throttle 60 วิ), ปุ่ม ↻ (บังคับ)
- `--idle-exit=<min>`: server ปิดตัวเองเมื่อไม่มี request (แท็บที่เปิดค้างจะ refresh ทุกชม. ทำให้ยังอยู่)
- **ถ้าแก้ `server.mjs` หรือ `sync.mjs` ต้อง restart server** (เคยเจอบั๊ก: server เก่าใช้ sync เก่าแล้วเขียนทับ cards.json จน effect หาย)
  - หยุด: `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | ? CommandLine -like '*server.mjs*' | % { Stop-Process -Id $_.ProcessId }`
- แก้แค่ `public/*` → รีเฟรชหน้าเว็บพอ (server ส่ง `Cache-Control: no-store`)

## Features (สถานะ ณ 2026-11-27)
- **Archetype detection**: `สีหลัก + Digimon Lv.6+ ตัวหลัก` (score = level + 1.5×copies; ถ้าเด็คไม่มี Lv.6+ เลย fallback เป็น Lv.5+; เดิมใช้ Lv.5+ เปลี่ยนตามที่ผู้ใช้ขอ 2026-11-27); สีหลัก = สีที่มีการ์ดมากสุด (ไม่นับ Digi-Egg)
  - รวมกลุ่มเล็ก (<3 เด็ค) เข้ากลุ่มใหญ่ถ้า Jaccard กับ core set ≥ 0.45 (toggle ได้)
  - เปลี่ยนชื่อ/รวมกลุ่มด้วย ✎ → เก็บใน localStorage `alysion.archAlias`
- **ตัดเด็คซ้ำ** (checkbox "นับเด็คที่ซ้ำกันทุกใบเป็น 1 เด็ค", ค่าเริ่มต้นเปิด, `alysion.dedupe`): เด็คที่การ์ด+จำนวนใบตรงกันทุกใบ → เก็บอันที่เผยแพร่ล่าสุด, ตาราง Decks แสดง `+N ซ้ำ`, summary แสดงจำนวนที่ตัดออก (ณ 2026-11-27: 206 → 164 เด็ค, 42 ซ้ำใน 28 กลุ่ม ส่วนใหญ่ชื่อเดียวกัน = อัปซ้ำ)
- **Core / Flex / Tech**: Core ≥ 80%, Flex ≥ 30% (ปรับ slider ได้) คิดเป็น % ของเด็คใน archetype
- แท็บ **Archetypes**: กดเปิดกลุ่ม → grid ภาพการ์ด 8 ใบ/แถว (4 ใบตอนจอแคบ, อ้างอิงหน้าเด็คเว็บหลัก) + สถิติใต้ภาพ; สลับเป็นรายการได้ (`alysion.archLayout`)
- แท็บ **สถิติตามสี**: สัดส่วนสี, archetype ในแต่ละสี %, การ์ดยอดนิยมของสี
- แท็บ **★ Staple**: การ์ดในไกด์ staple แยกตามซอง (BD-01..04, ST-1..6, SHOP) — แถบสัดส่วนซอง + ลิงก์กระโดดไปแต่ละซอง, แต่ละใบแสดง % เด็คชุมชนที่ใส่, ×ใบเฉลี่ย, เหตุผลจากไกด์ตามสี; filter สีกรองตามสีที่ไกด์จัดไว้, filter ประเภท/Level ใช้ได้
- แท็บ **Decks**: ตารางเด็ค กดดูรูปการ์ด + ลิงก์ต้นฉบับ
- แท็บ **การ์ดของฉัน** (เพิ่ม 2026-11-27): ข้อมูลจาก `data/collection.json` `{updatedAt, colorsEntered, cards:{id:copies}}`
  — sync ไม่แตะไฟล์นี้; หน้าเว็บบันทึกผ่าน `PUT /api/collection` (server validate แล้วเขียนไฟล์)
  - กรอกแล้ว **ครบทุกสี** (2026-11-27): Purple 92, Red 104, Blue 128, Yellow 91, Green 98, Black 118, White/หลายสี 3
    — รวม 333 แบบ 634 ใบ (ช่องในเกมที่นับได้ 374 ช่อง vs เกมบอก Collection Progress 373 — ต่าง 1 ช่อง ยังไม่รู้ว่าใบไหน)
    ถอดจาก screenshot หน้า Collection ในเกม; ใบรูปซ้ำ/alt art ต่าง rarity รวมเป็นรหัสเดียว;
    ชื่อซ้ำหลายรหัสแยกด้วย DP/cost/effect + **ลำดับในเกมเรียงตามซอง (BT4→BT3→BT2→BT1→BD/SD, egg ก่อน, option ท้ายซอง)** ช่วยระบุรหัส;
    screenshot ที่ส่งมามักซ้อนแถวกัน (scroll ทับ) ต้องตัดแถวซ้ำ; ตรวจยอดรวมใบกับ screenshot ทุกครั้ง
  - ราคาที่ผู้ใช้กรอก (จากในเกม): C 40, U 80, R 200, SR 800, SEC 2400 (**CP** = สกุลคราฟ) · P = **coin** (คราฟไม่ได้ ต้องแลกร้านค้า)
    ตอนนี้ P ใช้ราคาเดียวทุกใบ (`COIN_RARITIES` ใน app.js) — ผู้ใช้บอกว่าถ้าอนาคตการ์ด P ราคาต่างกันจะมาบอกให้ปรับเป็นราคาต่อใบ
  - แถบ summary ด้านบน: ทุก chip ตัวกรอง (การ์ด/archetype/สี/ค้นหา/วัน/Staple/แสดงการ์ด) มี ✕ กดลบได้
  - สีที่ดู = สีที่เลือกใน filter ถ้าไม่เลือก = `colorsEntered`; กด + การ์ดสีใหม่ → สีนั้นถูกเพิ่มใน colorsEntered อัตโนมัติ
  - 3 มุมมอง (`alysion.collMode`): **เด็คที่ใกล้ต่อได้** (archetype: % ของ Core ครบตามจำนวนใบเฉลี่ย + เด็คดีสุด;
    **กดแถว archetype = กางในที่** (Core ที่ยังขาด + ทุกเด็คในกลุ่ม กดดูใบที่ขาดได้, จำแถวที่เปิดไว้ใน `collArchOpen`),
    ลิงก์เล็ก "Archetypes ↗" ในแถวเท่านั้นที่พาไปแท็บ Archetypes; เด็ค top 40 กดดูใบที่ขาด (`nearDeckRow`),
    บอกจำนวนใบที่เป็นสีที่ยังไม่กรอก) · **คอลเลกชัน / แก้จำนวน** (ทุกการ์ดของสีนั้น แยกซอง, ใบที่ไม่มีเป็นสีเทา, ปุ่ม +/−) ·
    **การ์ดที่ควรหาเพิ่ม** (ใส่ ≥Flex% หรือ ★ Staple แต่มี < จำนวนใบเฉลี่ยที่ใส่, สรุปว่าขาดกี่ใบต่อซอง)
  - **ราคา (CP + coin)**: ผู้ใช้กรอกราคาต่อ rarity (C/U/R/SR/SEC = CP, P = coin) เองในหน้าเว็บ — แสดงแยก "X CP · Y coin" → `collection.json` `craftCost`
    (อย่าเดาค่าใส่ให้) แสดงในตาราง archetype (คราฟ Core / เด็คถูกสุด), แต่ละเด็ค, ใต้การ์ดที่ขาด,
    หน้าควรหาเพิ่ม (รวม + ต่อซอง); เรียง "ค่าคราฟน้อยสุด" ได้ (`alysion.nearSort`); การ์ดสีที่ยังไม่กรอกไม่นับค่าคราฟ
- **Filter**: ชื่อเด็ค, การ์ด (หลายใบ, AND/OR, chip + Enter), สีหลัก, archetype, วันที่เผยแพร่, ประเภทการ์ด, Level
  - ประเภท/Level ซ่อนการ์ดที่แสดงเท่านั้น ไม่เปลี่ยน % และไม่กรองเด็ค
- **กล่องผลค้นหาการ์ด**: combo summary, แต่ละการ์ด → archetype ไหนใส่กี่ % (คิดจากเด็คทั้ง archetype), ปุ่ม ✕ ลบทีละใบ
- **Staple tags (★ สีทอง)**: การ์ดที่อยู่ในไกด์ staple (111 ใบ) มี ★ บนรูป/ชื่อ (hover = เหตุผลจากไกด์), popup มีกล่อง Staple + บรรทัด Pack, checkbox "เฉพาะการ์ด Staple" ในหมวดแสดงเฉพาะการ์ด (ซ่อนการ์ดอื่น ไม่เปลี่ยน %)
- **Hover** รูปการ์ด = ภาพขยาย, **คลิก** = popup ความสามารถ (effect/inherited/security…, keyword highlight) + ปุ่มเพิ่มในตัวกรอง
  - รูปที่มี `data-card` จะได้ behavior นี้อัตโนมัติ (event delegation ใน app.js)

## เด็คแนะนำจากการ์ดที่มี (ทำแล้ว 2026-11-27) → `เด็คแนะนำ.md`
- เด็คละสี 6 สี (White มี 3 ใบ: Omnimon ใส่เด็คแดง, Millenniummon ใส่เด็คม่วง) + แผนเล่น/จุดอ่อน/คราฟเพิ่ม (CP)
- กฎที่ยืนยันแล้ว: main 50 ใบพอดี, Digi-Egg ≤5, รหัสละ ≤4 (เด็คชุมชน 261 เด็คตรงตามนี้ทั้งหมด)
- **การจำกัดการ์ด = ตามเกม ไม่ใช่ตามเว็บ** (ผู้ใช้แจ้ง 2026-11-27): ตอนนี้จำกัด 1 ใบแค่ Argomon BT2-047 + Hidden Potential Discovered! BT3-103
  → เก็บใน `data/restrictions.json` (แก้มือ, sync ไม่เขียนทับ); `sync.mjs` ใช้ไฟล์นี้ตั้ง `restriction` ใน cards.json
  และเก็บค่าจากเว็บ (TCG กระดาษ เช่น Matt Ishida Banned) ไว้ที่ `restrictionTcg` เพื่ออ้างอิงเท่านั้น — ถ้าเกมเปลี่ยน แก้ไฟล์นี้แล้วกด ↻
- text การ์ด: `effect`, `digivolveEffect` (= inherited), `securityEffect`; มี Digimon Lv.7 (Omnimon, Millenniummon — สี White)
- แท็บ **เด็คแนะนำ** ในเว็บ (`renderRecommended` ใน app.js) อ่าน `data/recommended.json` — แสดงรูปการ์ด ×จำนวน, แผน/จุดอ่อน,
  การ์ดคราฟเพิ่ม + ราคา (ใช้ craftCost ปัจจุบัน), เตือนสีแดงถ้าแก้คอลเลกชันจนมีไม่พอ, ปุ่มคัดลอกรายการ, filter สีใช้ได้
- เครื่องมือใน `tools/` (รันจากโฟลเดอร์โปรเจกต์): `decks.js` = รายการเด็คที่จัดมือ (`node tools/decks.js .` ตรวจกฎ/จำนวน),
  `report.js` = เขียน `เด็คแนะนำ.md` + `data/recommended.json` (ข้อความแผน/จุดอ่อน/คราฟอยู่ใน NOTES), `upg.js` = หาการ์ดที่ขาดเทียบ archetype ชุมชน,
  `dump.js <สี>` = ตารางการ์ดที่มีพร้อม effect (ต้องรัน `build.js .` ก่อนเพื่อสร้าง analysis.json),
  `archlist.js . <Color> <Archetype> [minPct]` = รายการเฉลี่ยของ archetype ชุมชน (% ใส่, ×ใบ) เทียบจำนวนที่มี — ใช้ตอนได้การ์ดชุดใหญ่
- เด็คแต่ละสีแยกกัน ใช้การ์ดใบเดียวกันซ้ำข้ามเด็คได้ (เช่น Omnimon 1 ใบอยู่ทั้งเด็คแดงและฟ้า)
- 2026-11-27: ผู้ใช้ได้ SD-1 (Rubeusdramon) + SD-2 (Yukinamon) ครบชุด ×4 → แดงเปลี่ยนเป็น Rubeusdramon, ฟ้าเป็น Yukinamon เต็ม
- ถ้าผู้ใช้อัปเดตการ์ดแล้วอยากได้เด็คใหม่ → ใช้ skill **`/rebuild-decks [สี]`** (`.claude/skills/rebuild-decks/SKILL.md` มีขั้นตอนครบ)
  - `recommended.json` เก็บ `builtAt` + `collectionSnapshot` (คอลเลกชันตอนจัด) → แท็บเด็คแนะนำแสดงกล่องสีส้ม
    "คอลเลกชันเปลี่ยนตั้งแต่จัดเด็คครั้งล่าสุด" พร้อมการ์ดที่ได้เพิ่ม/ลดลง; รัน report.js ใหม่แล้วกล่องจะหาย

## ออนไลน์ (GitHub Pages) — เตรียมไว้ 2026-11-27 → คู่มือ `ขึ้นเว็บออนไลน์.md`
- `.github/workflows/deploy.yml`: ทุกชม. + ทุก push main + กดเอง → `node sync.mjs` แล้ว deploy `public/` + `data/*.json` ขึ้น Pages
  (cards.json/decks.json **ไม่ commit** — อยู่ใน .gitignore, สร้างใหม่ทุกรอบ)
- `app.js`: `ONLINE` = hostname ไม่ใช่ localhost (ทดสอบบนเครื่องด้วย `?static=1`); path ทั้งหมดเป็น relative (ใช้ใต้ `/<repo>/` ได้)
  - ไม่มี token → `body.readonly` ซ่อน +/− และช่องราคา; ปุ่ม 🔒 โหมดแก้ไข → ผู้ใช้วาง fine-grained token เอง (localStorage `alysion.ghToken`)
  - มี token → โหลด/บันทึก collection.json ผ่าน GitHub Contents API (commit ลง main → deploy ใหม่), ↻ = workflow_dispatch
  - Claude ห้ามเห็น/จัดการ token ของผู้ใช้
- ตัวจริงของ collection.json = บน GitHub เมื่อขึ้นออนไลน์แล้ว → `git pull` ก่อนแก้ในเครื่อง

## Notes
- การ์ดชื่อซ้ำหลายรหัส (เช่น Gabumon 5 แบบ) — ค้นด้วยชื่อ = นับทุกรหัส, ค้นด้วยรหัส = ใบเดียว
- ทดสอบหน้าเว็บด้วย built-in browser ที่ http://localhost:3000 (เดิมมี `.claude/launch.json` ชื่อ `deck-analyzer` แต่ไม่ถูกคัดลอกมาตอนย้ายโฟลเดอร์)
