// Hand-built decks (owned cards only). Run: node decks.js <projectDir>
const fs = require("fs"), path = require("path");
const P = process.argv[2];
const C = JSON.parse(fs.readFileSync(path.join(P, "data/cards.json")));
const COLL = JSON.parse(fs.readFileSync(path.join(P, "data/collection.json")));
const own = COLL.cards;
const DECKS = {
  Red: { name: "Red Rubeusdramon (ALYSION)", arch: ["Rubeusdramon"], egg: { "SD1-01": 4, "BD1-001": 1 },
    main: { "SD1-02": 4, "BD1-002": 2, "BT1-010": 3, "BT3-007": 3,
      "SD1-03": 4, "BD1-003": 1, "BT1-019": 3, "BT1-015": 1, "BT4-011": 1,
      "SD1-04": 4, "BD1-005": 1, "BT2-016": 3, "BT4-017": 1,
      "SD1-05": 4, "BT1-025": 2, "BT1-084": 1,
      "SD1-06": 4,
      "BT2-091": 3, "BT1-090": 2, "SD1-07": 2, "BT4-100": 1 } },
  Blue: { name: "Blue Yukinamon (ALYSION ตัดใต้การ์ด)", arch: ["Yukinamon"], egg: { "SD2-01": 3, "BD2-001": 2 },
    main: { "SD2-02": 4, "BD2-002": 3, "BT1-029": 2, "ST2-03": 4,
      "SD2-03": 4, "BD2-003": 2, "BT4-025": 2, "BT2-025": 1,
      "SD2-04": 4, "BD2-004": 3, "ST2-08": 2,
      "SD2-05": 4, "BD2-007": 2, "BT1-084": 1,
      "SD2-06": 4, "BD2-008": 2, "BT2-085": 1,
      "ST2-13": 2, "SD2-07": 2, "BT1-099": 1 } },
  Yellow: { name: "Yellow Angel −DP Control", arch: ["Magnadramon", "Seraphimon", "WarGreymon"], egg: { "BT1-006": 4, "BT4-003": 1 },
    main: { "BT2-034": 2, "BT3-033": 1, "BT2-033": 2, "BT4-037": 2, "BT4-038": 2, "BT1-050": 1, "BT4-115": 1, "BT4-094": 1,
      "BT2-035": 4, "BT3-037": 3, "BT1-055": 1, "BT4-041": 1, "BT4-040": 1,
      "BD1-008": 3, "BT3-039": 2, "BT2-038": 2, "BT4-046": 1, "BT1-061": 1, "BT2-037": 1,
      "BT1-062": 2, "BT3-043": 2, "BT2-039": 1, "BT4-048": 1, "BT3-042": 1,
      "BT2-087": 2,
      "BT1-106": 1, "BT1-105": 3, "BT2-098": 2, "BT4-106": 2, "BT4-105": 1 } },
  Green: { name: "Green Suspend Lock (Puppetmon / HerculesKabuterimon)", arch: ["Puppetmon", "Rosemon"], egg: { "BT2-004": 2, "BD4-001": 2, "BT4-004": 1 },
    main: { "BT1-068": 2, "BT3-046": 1, "BT4-052": 4, "BT2-042": 2, "BT1-064": 2, "BT4-050": 1,
      "BT1-070": 3, "BT1-071": 3, "BT1-073": 1, "BT3-048": 2, "BT3-050": 1, "BT3-051": 2,
      "BD1-009": 2, "BT4-059": 2, "BT4-057": 3, "BT3-055": 1, "BT2-048": 1,
      "BT1-081": 3, "BT2-049": 2, "BT1-082": 1, "BT1-080": 1,
      "BT1-089": 1, "BT3-094": 1,
      "BT2-100": 3, "BT2-101": 2, "BT2-102": 2, "BT1-113": 1 } },
  Black: { name: "Black Blocker Wall (Zephagamon)", arch: ["Zephagamon", "Craniamon"], egg: { "BD3-001": 4, "BT2-005": 1 },
    main: { "BD3-003": 1, "BT2-054": 3, "BT2-055": 3, "BT3-060": 3, "BT2-052": 2,
      "BD3-004": 1, "BT4-067": 3, "BT2-058": 2, "BT2-057": 2, "BT3-067": 1, "BT4-068": 2,
      "BD3-005": 2, "BT2-063": 4, "BD2-005": 2, "BT2-061": 2,
      "BD3-007": 1, "BT2-065": 1, "BT4-073": 2, "BT3-072": 2, "BT3-073": 1,
      "BD3-008": 2, "BT2-089": 2,
      "BT2-106": 1, "BT3-106": 1, "BT3-107": 2, "BT4-096": 1, "BD3-009": 1 } },
  Purple: { name: "Purple Myotismon Recursion", arch: ["MaloMyotismon", "Plutomon", "Beelzemon"], egg: { "BT2-007": 3, "BT3-006": 1, "BT2-008": 1 },
    main: { "BT2-068": 3, "BT2-069": 3, "BT2-070": 1, "BT4-079": 2, "BT4-076": 2,
      "BT2-074": 2, "BT2-072": 2, "BT2-071": 2, "BT3-080": 1, "BT4-081": 1,
      "BT2-090": 2,
      "BD2-006": 4, "BT2-075": 2, "BT3-088": 1, "BT4-083": 3,
      "BT2-079": 2, "BT2-111": 1, "BT4-089": 1, "BT4-087": 1, "BT3-090": 1, "BT2-083": 1,
      "BT4-111": 3, "BT2-108": 3, "BD3-010": 2, "BT2-110": 2, "ST6-15": 2 } },
};
module.exports = DECKS;
if (require.main === module) {
  const bucket = (c) => c.type === "Digi-Egg" ? "Egg" : c.type === "Digimon" ? "L" + c.level : c.type;
  for (const [col, d] of Object.entries(DECKS)) {
    const err = [], sh = {};
    let m = 0, e = 0;
    for (const [part, list] of [["main", d.main], ["egg", d.egg]]) for (const [id, n] of Object.entries(list)) {
      const c = C[id];
      if (!c) { err.push("no card " + id); continue; }
      if ((own[id] || 0) < n) err.push(`${id} ${c.name} ใช้ ${n} มี ${own[id] || 0}`);
      const lim = c.restriction === "Banned" ? 0 : /1/.test(c.restriction || "") ? 1 : 4;
      if (n > lim) err.push(`${id} ${c.name} เกินลิมิต ${lim}`);
      if ((part === "egg") !== (c.type === "Digi-Egg")) err.push(`${id} ผิดส่วน`);
      sh[bucket(c)] = (sh[bucket(c)] || 0) + n;
      part === "main" ? (m += n) : (e += n);
    }
    console.log(`${col}: main ${m} egg ${e} ${JSON.stringify(sh)} ${err.length ? "ERR " + err.join("; ") : "OK"}`);
  }
}
