#!/usr/bin/env node
/* Grobes Balancing-Modell: simuliert einen "vernünftigen" Spieler, der nach jedem Tod
 * seine Punkte verteilt und es erneut versucht. Kein Ersatz fürs Spielen, aber gut genug,
 * um die XP-Kurve und die Gegnerstärken so einzustellen, dass der Grind sich richtig anfühlt.
 *
 *   node tools/balance-sim.js            -> Kurzübersicht
 *   node tools/balance-sim.js -v         -> jeder einzelne Run
 *   node tools/balance-sim.js skill=0.8  -> Spieler weicht 20% besser aus (default 1.0)
 */
const L = require('../js/data.js');
const { BAL, ZONES, SPELLS } = L;

const args = Object.fromEntries(process.argv.slice(2).map(a => a.includes('=') ? a.split('=') : [a, true]));
const VERBOSE = !!args['-v'];
const SKILL = parseFloat(args.skill || 1);   // <1: Spieler nimmt weniger Schaden als das Modell vorhersagt
const DIFF = parseInt(args.diff || 0, 10);
const MAX_RUNS = parseInt(args.runs || 600, 10);

let seed = 12345;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

const ELITE = BAL.eliteChance;
const E_HP = 1 + ELITE * 2, E_DMG = 1 + ELITE * 0.5, E_XP = 1 + ELITE * 3;

function weights(level) {
  return level >= BAL.magicUnlockLevel ? { atk: .30, def: .20, vit: .30, mag: .20 } : { atk: .40, def: .20, vit: .40, mag: 0 };
}
function allocate(state) {
  while (state.unspent > 0) {
    const w = weights(state.level);
    const tot = state.pts.atk + state.pts.def + state.pts.vit + state.pts.mag + 1;
    let best = null, bestGap = -1e9;
    for (const k of Object.keys(w)) {
      if (!w[k]) continue;
      const gap = w[k] - state.pts[k] / tot;
      if (gap > bestGap) { bestGap = gap; best = k; }
    }
    state.pts[best]++; state.unspent--;
  }
}

function spellDps(s) {
  if (s.mag <= 0) return 0;
  const unlocked = SPELLS.filter(x => s.pts.mag >= x.unlock);
  if (!unlocked.length) return 0;
  // Mana-limitiert: bester verfügbarer Zauber, gewichtet nach Flächenwirkung
  const aoe = { fire: 1.4, nova: 2.5, chain: 3.5, meteor: 4.5, wrath: 7 };
  let best = 0;
  for (const sp of unlocked) {
    const per = L.spellPower(sp.base, s.pts.mag, 0) * aoe[sp.id] * 0.75;
    const rate = Math.min(s.manaRegen / sp.cost, 1 / sp.cd);
    best = Math.max(best, per * rate);
  }
  return best;
}

function fightRoom(st, room, hp, S) {
  // room = { n, zone, boss }
  const enemies = [];
  if (room.boss) {
    enemies.push({ hp: L.BOSS.hp * L.DIFFS[DIFF].hp, dmg: L.BOSS.dmg * L.DIFFS[DIFF].dmg, cd: L.BOSS.cd, xp: L.BOSS.xp * L.DIFFS[DIFF].xp, boss: true });
    for (let i = 0; i < 10; i++) {
      const m = L.pickMob(4, rnd); const e = L.enemyStats(4, m[0], DIFF);
      enemies.push({ hp: e.hp * E_HP, dmg: e.dmg * E_DMG, cd: e.cd, xp: e.xp * E_XP, ranged: e.ai === 'ranged' });
    }
  } else {
    for (let i = 0; i < room.n; i++) {
      const m = L.pickMob(room.zone, rnd); const e = L.enemyStats(room.zone, m[0], DIFF);
      enemies.push({ hp: e.hp * E_HP, dmg: e.dmg * E_DMG, cd: e.cd, xp: e.xp * E_XP, ranged: e.ai === 'ranged' || e.ai === 'necro' });
    }
  }
  const pdps = S.dps + spellDps(S);
  let xp = 0, time = 0, killed = 0;
  for (let k = 0; k < enemies.length; k++) {
    const e = enemies[k];
    const t = e.hp / pdps + 0.45;
    const alive = enemies.length - k;
    const engaged = Math.min(alive, e.boss ? 1.2 : 2.2) * 0.8;
    const per = e.dmg * (1 - S.dr) / e.cd * (e.ranged ? 0.55 : 1) * SKILL;
    // Mehrere Gegner gleichzeitig: nimm den Durchschnitt der verbliebenen
    const avgPer = enemies.slice(k, k + 3).reduce((a, x) => a + x.dmg * (1 - S.dr) / x.cd * (x.ranged ? .55 : 1), 0) / Math.min(3, alive) * SKILL;
    const dmgTaken = engaged * (e.boss ? per : avgPer) * t;
    hp -= dmgTaken;
    time += t;
    if (hp <= 0) return { dead: true, hp: 0, xp, time, killed };
    // Heilkugeln
    hp = Math.min(S.maxHp, hp + BAL.orbChance * BAL.orbHeal * S.maxHp * 0.8);
    xp += e.xp; killed++;
  }
  return { dead: false, hp, xp, time, killed };
}

function simulate() {
  const st = { level: 1, xp: 0, pts: { atk: 0, def: 0, vit: 0, mag: 0 }, unspent: 0, best: 0 };
  let clock = 0; // Minuten
  const log = [];
  const marks = {};
  let clears = 0;
  for (let run = 1; run <= MAX_RUNS; run++) {
    allocate(st);
    const S = L.derive(st.level, st.pts, []);
    let hp = S.maxHp, gainedXp = 0, runTime = 0, reached = 0, cleared = false;
    for (let i = 0; i < L.NUM_ROOMS; i++) {
      const room = { zone: Math.floor(i / BAL.roomsPerZone), n: L.roomEnemyCount(i), boss: i === L.NUM_ROOMS - 1 };
      const r = fightRoom(st, room, hp, S);
      gainedXp += r.xp * S.xpMul * BAL.xpRate; runTime += r.time + 7; reached = i;
      if (r.dead) break;
      hp = Math.min(S.maxHp, r.hp + 0.2 * S.maxHp); // Ausruhen auf dem Weg zum nächsten Raum
      if (room.boss) cleared = true;
    }
    st.xp += gainedXp;
    const lvStart = st.level;
    while (st.level < BAL.maxLevel && st.xp >= L.xpNeed(st.level)) {
      st.xp -= L.xpNeed(st.level); st.level++; st.unspent++;
    }
    clock += runTime / 60;
    st.best = Math.max(st.best, reached);
    for (const lv of [5, 10, 15, 20, 25, 30, 40, 50, 60]) if (st.level >= lv && !(lv in marks)) marks[lv] = { run, min: clock };
    if (VERBOSE) console.log(`Run ${String(run).padStart(3)}  Lv ${String(lvStart).padStart(2)}→${String(st.level).padStart(2)}  Raum ${String(reached + 1).padStart(2)}/${L.NUM_ROOMS}  +${Math.round(gainedXp)} XP  ${(runTime / 60).toFixed(1)} min  HP ${Math.round(S.maxHp)} DPS ${S.dps.toFixed(0)} Red ${(S.dr * 100).toFixed(0)}%`);
    if (cleared) { clears++; marks.firstClear = marks.firstClear || { run, min: clock, level: lvStart }; if (clears >= 3) break; }
  }
  return { st, clock, marks };
}

if (require.main !== module) { module.exports = { fightRoom, allocate, spellDps, rnd, setDiff(d){ /* noop */ } }; return; }
const res = simulate();
console.log('\n== Meilensteine (Run-Nr. / Spielminuten) ==');
for (const [k, v] of Object.entries(res.marks)) {
  console.log(`${String(k).padEnd(11)} Run ${String(v.run).padStart(3)}   ~${v.min.toFixed(0)} min` + (v.level ? `   (Level beim Clear: ${v.level})` : ''));
}
console.log(`Ende: Level ${res.st.level}, ${res.clock.toFixed(0)} min gesamt, Punkte`, res.st.pts);
