#!/usr/bin/env node
/* Lässt die echte Spiellogik (js/game.js) headless von einem einfachen Bot spielen.
 * Der Bot kämpft nur automatisch (kein Ausweichen), verteilt Punkte nach festem Schema und versucht es nach
 * jedem Tod erneut – ein grobes Maß dafür, wie lange der Grind dauert.
 *
 *   node tools/botsim.js levels            -> wie weit kommt ein Bot auf Stufe X?
 *   node tools/botsim.js grind [maxRuns]   -> komplette Progression von Stufe 1 bis zum ersten Boss-Sieg
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
global.LOS = require(path.join(root, 'js/data.js'));
global.Sound = { play() {}, sfx() {}, setIntensity() {}, setZone() {}, init() {} };
global.Input = { keys: {}, mx: 640, my: 360, wx: 0, wy: 0, interact: false, hover: null, spellQueue: [] };
global.Save = {
  data: null, write() {},
};
for (const f of ['keys.js', 'dungeon.js', 'game.js']) vm.runInThisContext(fs.readFileSync(path.join(root, 'js', f), 'utf8') + '\n;globalThis.' + (f === 'game.js' ? 'Game=Game' : f === 'keys.js' ? 'Keys=Keys' : 'Dungeon=Dungeon'), { filename: f });

const T = LOS.TILE, BAL = LOS.BAL;
let seed = 7;
const origRandom = Math.random;
Math.random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

function freshSave(level) {
  return { level, xp: 0, unspent: 0, pts: { atk: 0, def: 0, vit: 0, mag: 0 }, runes: [], equipped: [], bestRoom: 0, fires: [], startRoom: 0, difficulty: +(process.env.DIFF || 0),
    stats: { runs: 0, kills: 0, deaths: 0, clears: 0, time: 0, xp: 0, bossKills: 0 }, settings: {} };
}
function weights(level) { return level >= BAL.magicUnlockLevel ? { atk: .30, def: .20, vit: .30, mag: .20 } : { atk: .40, def: .20, vit: .40, mag: 0 }; }
function allocate(sv) {
  while (sv.unspent > 0) {
    const w = weights(sv.level), tot = sv.pts.atk + sv.pts.def + sv.pts.vit + sv.pts.mag + 1;
    let best = null, g = -9;
    for (const k in w) { if (!w[k]) continue; const gap = w[k] - sv.pts[k] / tot; if (gap > g) { g = gap; best = k; } }
    sv.pts[best]++; sv.unspent--;
  }
}

function bot(R) {
  const p = R.p;
  let tgt = null, bd = 1e9;
  for (const e of R.enemies) { if (e.dead || e.state !== 'awake') continue; const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < bd && R.map.los(p.x, p.y, e.x, e.y)) { bd = d; tgt = e; } }
  if (!tgt) for (const e of R.enemies) { if (e.dead || e.room !== R.room) continue; const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < bd && R.map.los(p.x, p.y, e.x, e.y)) { bd = d; tgt = e; } }
  if (tgt) { p.target = bd > 45 ? { x: tgt.x, y: tgt.y } : null; }
  else {
    const cur = R.room, a = R.map.rooms[cur], b = R.map.rooms[Math.min(R.map.rooms.length - 1, cur + 1)];
    R.botStage = R.botStage || {};
    const corner = { x: (b.cx + .5) * T, y: (a.cy + .5) * T };
    if (Math.hypot(p.x - corner.x, p.y - corner.y) < 30) R.botStage[cur] = 1;
    p.target = R.botStage[cur] ? { x: (b.cx + .5) * T, y: (b.cy + .5) * T } : corner;
  }
  Input.wx = tgt ? tgt.x : p.x; Input.wy = tgt ? tgt.y : p.y;
  // Schwertangriff ist jetzt manuell (Taste): der Bot schlägt zu, sobald ein Gegner in Reichweite ist
  Input.keys.Space = !!(tgt && bd - tgt.r < R.S.reach - 8);
  if (R.S.mag > 0 && tgt && Math.random() < 0.06) {
    const un = LOS.SPELLS.map((s, i) => R.S.mag >= s.unlock ? i : -1).filter(i => i >= 0);
    Input.spellQueue.push(un[Math.floor(Math.random() * un.length)]);
  }
  // Der Bot ruht sich aus, wenn er niedrig steht und nichts in der Nähe ist
}

function playRun(sv, opts) {
  opts = opts || {};
  Save.data = sv;
  Game.clear(); Game.startRun();
  const R = Game.R;
  let t = 0, lastRoomT = 0, lastRoom = R.room;
  while (!R.over && t < (opts.maxT || 900)) {
    bot(R); Game.update(1 / 30); t += 1 / 30;
    if (R.room !== lastRoom) { lastRoom = R.room; lastRoomT = t; }
    if (t - lastRoomT > 150) break; // Bot hängt fest
  }
  return { R, t, over: R.over, room: R.bestRoom + 1, xp: R.xpGained, kills: R.kills, won: R.over === 'win', stuck: !R.over };
}

const mode = process.argv[2] || 'levels';
if (mode === 'levels') {
  const N = +(process.argv[3] || 12);
  console.log('Stufe | Ø Raum | beste | Ø XP/Run | Ø Dauer | Siege');
  const LEVELS = process.env.LEVELS ? process.env.LEVELS.split(',').map(Number) : [1, 3, 6, 9, 12, 16, 20, 24, 28, 32, 36, 40, 45];
  for (const lv of LEVELS) {
    let rooms = 0, best = 0, xp = 0, time = 0, wins = 0;
    for (let k = 0; k < N; k++) {
      const sv = freshSave(lv); sv.unspent = lv - 1; allocate(sv);
      const r = playRun(sv);
      rooms += r.room; best = Math.max(best, r.room); xp += r.xp; time += r.t; wins += r.won ? 1 : 0;
    }
    console.log(`${String(lv).padStart(5)} | ${(rooms / N).toFixed(1).padStart(6)} | ${String(best).padStart(5)} | ${String(Math.round(xp / N)).padStart(8)} | ${String(Math.round(time / N)).padStart(6)}s | ${wins}/${N}`);
  }
} else if (mode === 'grind') {
  const maxRuns = +(process.argv[3] || 400);
  const sv = freshSave(1);
  let clock = 0; const marks = {};
  for (let run = 1; run <= maxRuns; run++) {
    allocate(sv);
    const lv0 = sv.level;
    const r = playRun(sv);
    clock += r.t / 60 + 0.4; // plus Wege/Lagerzeit
    for (const lv of [5, 10, 15, 20, 25, 30, 35, 40, 45, 50]) if (sv.level >= lv && !marks[lv]) marks[lv] = { run, min: clock };
    if (process.argv.includes('-v')) console.log(`Run ${run} Lv ${lv0}→${sv.level} Raum ${r.room} +${Math.round(r.xp)}xp ${Math.round(r.t)}s${r.stuck ? ' (hängt)' : ''}`);
    if (r.won) { marks.clear = { run, min: clock, level: sv.level }; break; }
  }
  console.log('\nMeilensteine (Run-Nr. / Spielminuten):');
  for (const [k, v] of Object.entries(marks)) console.log(`${String(k).padEnd(6)} Run ${String(v.run).padStart(3)}  ~${v.min.toFixed(0)} min` + (v.level ? `  (Stufe ${v.level})` : ''));
  console.log(`Ende: Stufe ${sv.level}, ${clock.toFixed(0)} min, Punkte`, sv.pts);
}
