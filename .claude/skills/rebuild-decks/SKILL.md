---
name: rebuild-decks
description: จัดเด็คแนะนำใหม่จากการ์ดที่ผู้ใช้มี (data/collection.json) ของ Digimon Alysion — ใช้เมื่อผู้ใช้พิมพ์ /rebuild-decks หรือบอกว่า "จัดเด็คใหม่", "ได้การ์ดใหม่แล้ว", "อัปเดตเด็คแนะนำ". รับ argument เป็นสีได้ เช่น "/rebuild-decks Purple" หรือ "ม่วง" เพื่อจัดเฉพาะสีนั้น
---

# จัดเด็คแนะนำใหม่จากการ์ดที่มี

ตอบผู้ใช้เป็นภาษาไทย. ทำงานในโฟลเดอร์โปรเจกต์ (รันคำสั่งทั้งหมดจาก root ของโปรเจกต์).
**ห้ามแก้/เขียนทับ `data/collection.json`** (ยกเว้นผู้ใช้ส่ง screenshot มาให้กรอกการ์ด — ทำผ่านกติกาใน CLAUDE.md).

## 0. ประเมินก่อนเริ่ม
- ถ้า context ใช้ไปเกิน ~35% และจะจัดหลายสี → แนะนำให้ผู้ใช้ `/compact` ก่อน (ตามกติกาใน CLAUDE.md)
- สีที่ต้องจัด: ตาม argument (แปลไทย→อังกฤษ: แดง Red, ฟ้า Blue, เหลือง Yellow, เขียว Green, ดำ Black, ม่วง Purple) ถ้าไม่ระบุ → เฉพาะสีที่มีการ์ดเปลี่ยน (ขั้น 1)

## 1. ดูว่าอะไรเปลี่ยน
- ถ้าโปรเจกต์เป็น git repo (ขึ้น GitHub Pages แล้ว): `git pull` ก่อน — collection.json ตัวจริงอยู่บน GitHub (ผู้ใช้แก้จากเว็บ)
- ดึงข้อมูลล่าสุดก่อน: `Invoke-RestMethod -Method Post http://localhost:3000/api/refresh` (ถ้า server ไม่รัน/รันบน Claude Code web: `node sync.mjs` — cards.json/decks.json ไม่ได้อยู่ใน repo)
- เทียบ `data/collection.json` กับ `collectionSnapshot` ใน `data/recommended.json`:
  ```
  node -e "const r=require('./data/recommended.json'),c=require('./data/collection.json').cards,C=require('./data/cards.json');for(const id of new Set([...Object.keys(c),...Object.keys(r.collectionSnapshot||{})])){const d=(c[id]||0)-((r.collectionSnapshot||{})[id]||0);if(d)console.log((d>0?'+':'')+d,id,C[id]?.name,C[id]?.color,C[id]?.type,'L'+C[id]?.level)}"
  ```
- นอกจาก diff ให้เช็กด้วยว่า **การ์ดที่มีของสีนั้นใบไหนที่ใช้บ่อยในเด็คชุมชน (≥30%) แต่ไม่ได้อยู่ในเด็ค** (`node tools/dump.js . <Color>` ดู %) — กันกรณี snapshot พลาด
  และถ้าผู้ใช้เอ่ยชื่อการ์ดใหม่ ให้ยืนยันว่าอยู่ในเด็คหรือมีเหตุผลที่ไม่ใส่
- เช็ก `data/restrictions.json` (การจำกัดตาม**เกม** ไม่ใช่ตามเว็บ) — ถ้าผู้ใช้บอกว่าเกมเปลี่ยนกติกา ให้แก้ไฟล์นี้ก่อนแล้ว sync ใหม่

## 2. วิเคราะห์ (เฉพาะสีที่ต้องจัด)
- `node tools/build.js .` → สร้าง `tools/analysis.json` + สรุป archetype ชุมชนของแต่ละสีและ % ที่ผู้ใช้มีครบ
- `node tools/dump.js . <Color>` → ตารางการ์ดที่มีของสีนั้นพร้อม effect (`E:`) / inherited (`|I:`) / % ใช้ในเด็คชุมชน (`*` = Staple)
  — อ่านเฉพาะการ์ดใหม่ + การ์ดในสายวิวัฒน์ที่เกี่ยวข้อง ไม่ต้องอ่านทุกสีใหม่
- การ์ดสี White / หลายสี (เช่น Omnimon, Millenniummon Lv.7) ไม่ออกใน dump ของสีหลัก — ดู field `evo` ว่าวิวัฒน์จากสีไหน
- `node tools/archlist.js . <Color> <Archetype>` → รายการเฉลี่ยของ archetype ชุมชนเทียบจำนวนที่มี (ใช้เมื่อได้การ์ดชุดใหญ่/Structure Deck)
- ถ้าการ์ดใหม่ทำให้เปลี่ยนแนวเด็คได้ (เช่นได้บอส/Tamer ของ archetype ที่นิยม) ให้พิจารณาเปลี่ยน archetype ได้

## 3. จัดเด็ค
แก้ `tools/decks.js` (object `DECKS`: `name`, `arch` = ชื่อ archetype ชุมชนที่ใช้เทียบ, `egg`, `main`).
หลักการ:
- main **50 ใบพอดี**, Digi-Egg ≤ 5 (สีเดียวกับ Lv.3 ที่ใช้), รหัสละ ≤ 4, ไม่เกินจำนวนที่มี, ตามการจำกัดใน `data/restrictions.json`
- สายวิวัฒน์ต่อกันจริง (ดู `evo` สี/เลเวล/ค่าวิวัฒน์) และ **curve ตามสัดส่วนที่ผู้ใช้กำหนด (Ranked launch meta)**:
  Lv3 12–14 · Lv4 10–12 · Lv5 8–9 · Lv6–7 6–8 · Tamer+Option 9–12 · Digi-Egg 4–5
  — `decks.js` เตือน `CURVE ...` ถ้าหลุดช่วง ต้องแก้ให้หายทุกสี (เด็คเราไม่สมบูรณ์เพราะการ์ดไม่ครบ จึงยิ่งต้องยึดสัดส่วนนี้)
  เวลาต้องเลือกว่าจะตัด/เติมใบไหนให้ได้สัดส่วน → ใช้ % ใส่ของเด็คชุมชน (`archlist.js`) เป็นตัวตัดสิน
- ให้น้ำหนักการ์ดที่เด็คชุมชนสีนั้นใช้บ่อย, Staple, และ synergy จาก effect (เช่น Tamer ให้ memory, inherited ที่เข้ากับบอส)
- ตรวจ: `node tools/decks.js .` ต้องขึ้น `OK` ทุกสี
- `node tools/sim.js . <Color>` ใช้เทียบความลื่นก่อน/หลังเท่านั้น — **ห้ามตัดการ์ดที่เด็คชุมชนใส่สูง (≥50%) เพราะผลจำลองอย่างเดียว**
  ต้องเช็ก `archlist.js` ก่อนเสมอ (เคยพลาด: ตัด Jack Raid เพราะ sim บอกใช้ได้ 3% แต่เด็คม่วงสาย trash ชุมชนใส่ 100% — sim ประเมิน trash ต่ำไป)

## 4. เขียนเหตุผล + คราฟเพิ่ม
- `node tools/upg.js .` → การ์ดที่ archetype ชุมชนใช้ ≥40% แต่ผู้ใช้ยังไม่มีพอ (พร้อมราคา)
- แก้ `NOTES[<Color>]` ใน `tools/report.js`: `plan` (แผนการเล่น), `weak` (จุดอ่อน), `ups` (เลือก 3–6 รายการที่คุ้มสุด `[id, จำนวน]`), `upsNote`
- ราคา: ใช้ `craftCost` ใน collection.json (C–SEC = CP, P = coin) — **อย่าเดาราคาเอง**; การ์ด ST/SD ยังไม่ยืนยันว่าคราฟได้
- สร้างผลลัพธ์: `node tools/report.js . "เด็คแนะนำ.md" --accept=<สีที่จัดใหม่ เช่น Purple หรือ Purple,Red | all>`
  → เขียน `เด็คแนะนำ.md` + `data/recommended.json`; `--accept` เลื่อน snapshot เฉพาะการ์ดของสีที่ตรวจแล้ว (ป้ายเตือนสีนั้นหาย)
  — **รันโดยไม่มี `--accept`** (เช่นแค่แก้ข้อความ/ทดสอบ) จะไม่แตะ snapshot เพื่อไม่ให้การ์ดใหม่ของสีอื่นหลุดจากการแจ้งเตือน
  (เคยพลาด: รัน report.js ระหว่างทดสอบแล้ว snapshot กลืน Death Claw ที่ผู้ใช้เพิ่งเพิ่ม → ไม่ถูกจัดเข้าเด็ค)

## 5. ตรวจและรายงาน
- เปิด http://localhost:3000 แท็บ **เด็คแนะนำ** ด้วย built-in browser: ทุกเด็คต้องขึ้น "มีครบทุกใบ ✓", ไม่มีกล่อง "คอลเลกชันเปลี่ยน", console ไม่มี error
- รายงานผู้ใช้ (ไทย): แต่ละสีที่จัดใหม่ — ใส่อะไรเข้า/เอาอะไรออก เพราะอะไร, แผน/จุดอ่อนที่เปลี่ยน, ค่าคราฟเพิ่ม (CP/coin) เทียบกับเดิม
  (ถ้า server ไม่รัน ให้รัน `node server.mjs` แบบ background แล้วปิดเมื่อเสร็จ)
- ถ้าเป็น git repo: commit `tools/decks.js tools/report.js data/recommended.json เด็คแนะนำ.md` แล้ว `git push` ไป `main`
  → GitHub Actions deploy เว็บใหม่เอง (~2 นาที) — **ห้าม commit `data/collection.json` ที่ไม่ได้ pull มาล่าสุด** (จะทับที่ผู้ใช้แก้บนเว็บ)
- ถ้ามีกติกาหรือข้อสังเกตใหม่ที่ควรจำ ให้อัปเดตหัวข้อ "เด็คแนะนำ" ใน CLAUDE.md
