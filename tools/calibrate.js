#!/usr/bin/env node
/* Passt die Zonen-Multiplikatoren (hpM/dmgM/xpM) an die gewünschte Spielerkurve an.
 * Ausgabe kann in js/data.js (ZONES) übernommen werden.
 *   REC  = Level, auf dem eine Zone "gerade so" machbar ist
 *   RUNS = Anzahl Runs, die man ungefähr in dieser Levelspanne verbringen soll */
const L = require('../js/data.js');
const sim = require('./balance-sim.js');
const { BAL, ZONES } = L;

const REC = [1, 7, 14, 21, 28];       // Level-Empfehlung je Zone, Boss ~ 31
const BOSS_LEVEL = 31;
const RUNS = [9, 15, 20, 24, 28];      // Runs pro Levelspanne
const TARGET_HP_LEFT = 0.22;           // Rest-HP-Anteil am Zonenende bei Empfehlungslevel

function stateAt(level) {
  const st = { level, pts: { atk: 0, def: 0, vit: 0, mag: 0 }, unspent: level - 1 };
  sim.allocate(st);
  return L.derive(level, st.pts, []);
}

function clearUpTo(level, lastRoom) {
  const S = stateAt(level);
  let hp = S.maxHp, minFrac = 1, xp = 0;
  for (let i = 0; i <= lastRoom; i++) {
    const boss = i === L.NUM_ROOMS - 1;
    const r = sim.fightRoom({}, { zone: Math.floor(i / BAL.roomsPerZone), n: L.roomEnemyCount(i), boss }, hp, S);
    if (r.dead) return { ok: false, frac: 0 };
    hp = Math.min(S.maxHp, r.hp + 0.2 * S.maxHp); minFrac = Math.min(minFrac, hp / S.maxHp); xp += r.xp;
  }
  return { ok: true, frac: hp / S.maxHp };
}

// Mehrfach mitteln wegen Zufall in der Gegnerwahl
function avgFrac(level, lastRoom, n = 12) {
  let t = 0;
  for (let i = 0; i < n; i++) t += clearUpTo(level, lastRoom).frac;
  return t / n;
}

for (let z = 1; z < ZONES.length; z++) {
  let lo = 0.15, hi = 400;
  const last = (z + 1) * BAL.roomsPerZone - 1;
  for (let it = 0; it < 40; it++) {
    const mid = Math.sqrt(lo * hi);
    ZONES[z].hpM = mid;
    ZONES[z].dmgM = Math.pow(mid, 0.62);
    const f = avgFrac(REC[z] + 1, last);
    if (f > TARGET_HP_LEFT) lo = mid; else hi = mid;
  }
  ZONES[z].hpM = +lo.toFixed(2);
  ZONES[z].dmgM = +Math.pow(lo, 0.62).toFixed(2);
}

// XP je Zone: In der Span [REC[z], REC[z+1]) soll man RUNS[z] Runs brauchen.
function baseZoneXp(z) {
  let t = 0;
  for (let k = 0; k < BAL.roomsPerZone; k++) {
    const room = z * BAL.roomsPerZone + k;
    const n = L.roomEnemyCount(room);
    const mobs = ZONES[z].mobs, tot = mobs.reduce((a, m) => a + m[3], 0);
    let avg = 0; for (const m of mobs) avg += L.ARCH[m[0]].xp * m[3] / tot;
    t += n * avg * (1 + BAL.eliteChance * 3);
  }
  return t;
}
const spanNeed = z => {
  const end = z + 1 < REC.length ? REC[z + 1] : BOSS_LEVEL;
  let t = 0; for (let l = REC[z]; l < end; l++) t += L.xpNeed(l);
  return t;
};
const xpM = [];
let prevClear = 0;
for (let z = 0; z < ZONES.length; z++) {
  // pro Run: alle früheren Zonen voll + ~65% der aktuellen Zone
  const perRun = spanNeed(z) / RUNS[z];
  const need = Math.max(0, perRun - prevClear) / (0.65 * baseZoneXp(z));
  xpM.push(need);
  prevClear += baseZoneXp(z) * need;
}
xpM[0] = 1;

// Boss
let lo = 200, hi = 400000;
for (let it = 0; it < 40; it++) {
  const mid = Math.sqrt(lo * hi);
  L.BOSS.hp = mid; L.BOSS.dmg = 45 * Math.pow(ZONES[4].dmgM / 6.5, 0.9);
  const f = avgFrac(BOSS_LEVEL, L.NUM_ROOMS - 1);
  if (f > 0.15) lo = mid; else hi = mid;
}
L.BOSS.hp = Math.round(lo / 100) * 100;
console.log('ZONES:');
ZONES.forEach((z, i) => console.log(`  ${z.short.padEnd(14)} hpM ${String(z.hpM).padEnd(7)} dmgM ${String(z.dmgM).padEnd(6)} xpM ${xpM[i].toFixed(2)}`));
console.log(`BOSS hp ${L.BOSS.hp} dmg ${Math.round(L.BOSS.dmg)}  xp(suggest) ${Math.round(spanNeed(4) / 4)}`);
