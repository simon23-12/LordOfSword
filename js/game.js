/* Lord of Sword – Spiellogik eines Dungeon-Runs (Kampf, Gegner, Zauber, Drops)
 * Koordinaten: x/y = Bodenebene (y zeigt "nach Süden"), z = Höhe über dem Boden. Die Darstellung (three.js) liegt in render.js. */
const Game = (function () {
  'use strict';
  const T = LOS.TILE, BAL = LOS.BAL, ZONES = LOS.ZONES;
  const CY = Math.cos(LOS.CAM.yaw), SY = Math.sin(LOS.CAM.yaw);
  let R = null;
  const G = { paused: false, onEnd: null };

  const rr = (a, b) => a + Math.random() * (b - a);
  const hyp = Math.hypot;
  const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
  const pick = a => a[Math.floor(Math.random() * a.length)];

  /** Führt fn mit festem Zufallsstrom aus (Math.random wird danach wiederhergestellt). */
  function withSeed(seed, fn) {
    if (!BAL.dungeonSeed) { fn(); return; }
    const orig = Math.random, rnd = Dungeon.mulberry(seed);
    Math.random = rnd;
    try { fn(); } finally { Math.random = orig; }
  }

  /* ============================================================ Run-Start */
  function startRun() {
    const sv = Save.data;
    const diff = sv.difficulty;
    const startZone = Math.min(sv.startZone, sv.zoneUnlock);
    const map = Dungeon.generate(BAL.dungeonSeed);
    const slots = LOS.runeSlots(sv.level);
    const runes = sv.equipped.slice(0, slots).filter(Boolean);
    const S = LOS.derive(sv.level, sv.pts, runes);
    const startRoom = startZone * BAL.roomsPerZone;
    const sr = map.rooms[startRoom];
    R = {
      map, flow: Dungeon.makeFlow(map), S, diff, startRoom, runes,
      p: { x: sr.cx * T + T / 2, y: sr.cy * T + T / 2, r: 10, hp: S.maxHp, mana: S.maxMana, face: 0, swingT: -1, swingDur: 0.26, swingDir: 0, swingSide: 1, hitDone: true,
        atkCd: 0, target: null, anim: 0, moving: false, hurtT: 0, castT: 0, lastHurt: -99, regenAcc: 0, dead: false,
        lunge: 0, sprintT: 0, sprintCd: 0, sprintUsed: 0, sprinting: false, blocking: false, blockT: 0, blockFlash: 0, parryFlash: 0, dust: 0 },
      enemies: [], eproj: [], pproj: [], fx: [], tele: [], timers: [], parts: [], texts: [], pickups: [],
      cam: { x: 0, y: 0, shake: 0 },
      time: 0, kills: 0, xpGained: 0, lvStart: sv.level, levelUps: 0, runesFound: [],
      room: startRoom, bestRoom: startRoom, bossActive: false, boss: null, bossDead: false,
      cd: [0, 0, 0, 0, 0], sel: 0, over: null, overT: 0, banner: null, nextEid: 1, packId: 1,
      flash: 0, lastTile: -1, kill: 0, hint: 0, orbsTaken: 0, hitstop: 0,
    };
    R.cam.x = R.p.x; R.cam.y = R.p.y;
    for (const room of map.rooms) {
      if (room.i < startRoom) { room.cleared = true; continue; }
      withSeed(BAL.dungeonSeed + room.i * 7919, () => spawnRoom(room)); // jeder Raum hat immer die gleichen Gegner
    }
    R.sel = Math.max(0, LOS.SPELLS.filter(s => sv.pts.mag >= s.unlock).length - 1);
    markExplored(true);
    enterRoom(startRoom);
    Sound.play('dungeon');
    sv.stats.runs++;
    Save.write();
    return R;
  }

  /* ============================================================ Gegner */
  function makeEnemy(zone, mob, x, y, pack, room, opts) {
    opts = opts || {};
    const st = LOS.enemyStats(zone, mob[0], R.diff);
    const look = mob[2];
    const e = {
      id: R.nextEid++, name: mob[1], look, arch: mob[0], ai: st.ai, zone,
      x, y, r: st.r, hp: st.hp, maxHp: st.hp, dmg: st.dmg, cd: st.cd, spd: st.spd, range: st.range, xp: st.xp,
      state: 'sleep', pack, room, atkT: rr(0.3, st.cd), wind: 0, windMax: 0.3, wprev: 0, strikeT: 0, deadT: 0, flash: 0, anim: rr(0, 10), slowT: 0, slowF: 0,
      burn: null, kx: 0, ky: 0, stun: 0, flowT: 0, wakeT: rr(0, 0.3), elite: false, minion: !!opts.minion, dead: false,
      special: look === 'slime' ? 'split' : look === 'golem' ? 'charge' : null, chargeT: rr(3, 6), dash: 0, dashX: 0, dashY: 0,
      summonT: rr(2, 5), moving: false, sepx: 0, sepy: 0, mini: !!opts.mini, armored: false, tint: null,
    };
    if (e.ai === 'necro') e.dmg = LOS.enemyStats(zone, 'grunt', R.diff).dmg * 0.8;
    if (opts.mini) { e.r *= 0.7; e.hp = e.maxHp = e.maxHp * 0.3; e.xp *= 0.25; e.dmg *= 0.6; }
    if (opts.minion) { e.hp = e.maxHp = e.maxHp * 0.45; e.xp *= 0.15; }
    if (opts.elite) makeElite(e);
    return e;
  }

  const AFFIXES = [
    { n: 'Wütender', c: '#ff5a3a', f: e => { e.dmg *= 1.3; e.spd *= 1.15; } },
    { n: 'Gepanzerter', c: '#9fb4c9', f: e => { e.armored = true; e.maxHp *= 1.3; e.hp = e.maxHp; } },
    { n: 'Flinker', c: '#ffe14a', f: e => { e.spd *= 1.4; e.cd *= 0.8; } },
    { n: 'Verfluchter', c: '#b36bff', f: e => { e.dmg *= 1.2; e.maxHp *= 1.15; e.hp = e.maxHp; } },
  ];
  function makeElite(e) {
    const a = pick(AFFIXES);
    e.elite = true; e.tint = a.c; e.name = a.n + ' ' + e.name;
    e.maxHp *= 3; e.hp = e.maxHp; e.dmg *= 1.5; e.xp *= 4; e.r *= 1.2;
    a.f(e);
  }

  function spawnRoom(room) {
    const map = R.map, S = R.S;
    const rnd = Math.random;
    const zone = room.zone;
    const avoid = (x, y) => hyp(x - R.p.x, y - R.p.y) < T * 5.5;
    if (room.boss) {
      const c = { x: room.cx * T + T / 2, y: (room.y + 4) * T + T / 2 };
      const B = LOS.BOSS, d = LOS.DIFFS[R.diff];
      const e = makeEnemy(4, ['grunt', B.name, 'boss'], c.x, c.y, R.packId, room.i);
      Object.assign(e, { ai: 'boss', hp: B.hp * d.hp, maxHp: B.hp * d.hp, dmg: B.dmg * d.dmg, cd: B.cd, spd: B.spd, xp: B.xp * d.xp, r: B.r, range: 0, boss: true, summoned: {}, bt: 2, dash: 0, rageSnd: false });
      R.enemies.push(e); R.boss = e; room.enemies++;
      const pk = R.packId++;
      e.pack = pk;
      for (let i = 0; i < 6; i++) {
        const mob = LOS.pickMob(4, rnd);
        const pos = map.randomFloorIn(room, 3, rnd);
        const a = makeEnemy(4, mob, pos.x, pos.y, pk, room.i);
        R.enemies.push(a); room.enemies++;
      }
      return;
    }
    const total = LOS.roomEnemyCount(room.i);
    let left = total;
    while (left > 0) {
      const size = Math.min(left, 2 + Math.floor(rnd() * 3));
      left -= size;
      let c, tries = 0;
      do { c = map.randomFloorIn(room, 2, rnd); tries++; } while (avoid(c.x, c.y) && tries < 15);
      const pk = R.packId++;
      const mob = LOS.pickMob(zone, rnd);
      const eliteIdx = rnd() < BAL.eliteChance * 3 ? 0 : -1;
      for (let k = 0; k < size; k++) {
        let x = c.x, y = c.y;
        for (let t = 0; t < 12; t++) {
          const a = rnd() * 6.28, d = rnd() * 60;
          const nx = c.x + Math.cos(a) * d, ny = c.y + Math.sin(a) * d;
          if (map.free(nx, ny, 14)) { x = nx; y = ny; break; }
        }
        const m = rnd() < 0.3 ? LOS.pickMob(zone, rnd) : mob;
        R.enemies.push(makeEnemy(zone, m, x, y, pk, room.i, { elite: k === eliteIdx }));
        room.enemies++;
      }
    }
  }

  function wakePack(pack) {
    for (const o of R.enemies) if (!o.dead && o.pack === pack && o.state === 'sleep') { o.state = 'awake'; o.atkT = rr(0.2, 0.8); if (o.boss) bossAwake(o); }
  }

  /* ============================================================ Hilfen */
  function tryMove(e, vx, vy, rad) {
    const map = R.map; let moved = 0;
    const nx = e.x + vx;
    if (map.free(nx, e.y, rad)) { e.x = nx; moved += Math.abs(vx); }
    const ny = e.y + vy;
    if (map.free(e.x, ny, rad)) { e.y = ny; moved += Math.abs(vy); }
    return moved;
  }
  function addText(x, y, z, text, color, size, life) {
    if (R.texts.length > 120) R.texts.shift();
    R.texts.push({ x: x + rr(-8, 8), y, z, text, color: color || '#fff', size: size || 16, t: 0, life: life || 0.9 });
  }
  /** Partikel-Schub. z = Starthöhe, add = additiv (leuchtend) statt normal gezeichnet. */
  function burst(x, y, color, n, speed, life, size, grav, z, add) {
    for (let i = 0; i < n; i++) {
      if (R.parts.length > 1600) R.parts.shift();
      const a = Math.random() * 6.28, s = speed * (0.3 + Math.random() * 0.7);
      R.parts.push({ x, y, z: z === undefined ? 14 : z, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: (grav ? speed * 0.5 : speed * 0.15) * (0.3 + Math.random()), life: life * (0.6 + Math.random() * 0.6), max: life, color, size: size * (0.6 + Math.random() * 0.8), grav: grav || 0, add: !!add });
    }
  }
  function shake(v) { R.cam.shake = Math.max(R.cam.shake, v); }
  function banner(title, sub, color) { R.banner = { title, sub: sub || '', color: color || '#e8c97a', t: 0, life: 3.2 }; }

  function markExplored(force) {
    const map = R.map, p = R.p;
    const tx = Math.floor(p.x / T), ty = Math.floor(p.y / T);
    const key = ty * map.w + tx;
    if (!force && key === R.lastTile) return;
    R.lastTile = key;
    for (let dy = -8; dy <= 8; dy++) for (let dx = -8; dx <= 8; dx++) {
      if (dx * dx + dy * dy > 70) continue;
      const x = tx + dx, y = ty + dy;
      if (x < 0 || y < 0 || x >= map.w || y >= map.h) continue;
      if (map.tiles[y * map.w + x]) map.explored[y * map.w + x] = 1;
    }
  }

  function enterRoom(i) {
    const room = R.map.rooms[i];
    R.room = i;
    if (i > R.bestRoom) R.bestRoom = i;
    Sound.setZone(room.zone);
    if (!room.entered) {
      room.entered = true;
      if (i === R.startRoom || i % BAL.roomsPerZone === 0) banner(ZONES[room.zone].name, `Raum ${i + 1} von ${LOS.NUM_ROOMS}`, ZONES[room.zone].accent);
    }
  }

  /* ============================================================ Spieler */
  function healPlayer(a, quiet) {
    const p = R.p; const before = p.hp;
    p.hp = Math.min(R.S.maxHp, p.hp + a);
    const got = p.hp - before;
    if (got >= 1 && !quiet) addText(p.x, p.y, 44, '+' + Math.round(got), '#6fe27a', 15);
  }

  /** Trifft ein Angriff aus Richtung (fx,fy) den Schild? (Frontbereich ±100°) */
  function blockedFrom(fx, fy) {
    const p = R.p;
    if (!p.blocking || !R.S.block) return false;
    return Math.abs(angDiff(Math.atan2(fy - p.y, fx - p.x), p.face)) < 1.75;
  }

  function hurtPlayer(raw, src, opts) {
    opts = opts || {};
    const p = R.p, S = R.S;
    if (p.dead || R.over) return;
    const from = opts.from || src;
    let mult = 1;
    if (from && blockedFrom(from.x, from.y)) {
      const sx = p.x + Math.cos(p.face) * 14, sy = p.y + Math.sin(p.face) * 14;
      if (p.blockT <= S.block.parry) { // perfekte Parade: kein Schaden, Angreifer taumelt
        p.parryFlash = 0.4;
        addText(p.x, p.y, 60, 'Parade!', '#ffe08a', 20, 1.0);
        R.fx.push({ k: 'ring', x: p.x, y: p.y, z: 22, r0: 12, r1: 130, t: 0, dur: 0.45, color: '#ffe9a8' });
        burst(sx, sy, '#fff2b8', 20, 280, 0.45, 2.6, 0.4, 24, true);
        Sound.sfx('crit', 0.1); shake(3); R.hitstop = Math.max(R.hitstop, 0.07);
        if (src && !src.dead && !src.boss && src.stun !== undefined) src.stun = Math.max(src.stun, 0.9);
        return;
      }
      mult = 1 - S.block.red;
      p.blockFlash = 0.25;
      addText(p.x, p.y, 56, 'Geblockt', '#bcd3ff', 15, 0.7);
      burst(sx, sy, '#cfe2ff', 9, 220, 0.3, 2.2, 0.4, 24, true);
      Sound.sfx('block', 0.06); shake(2);
    }
    const dmg = Math.max(1, raw * (1 - S.dr) * mult);
    p.hp -= dmg; p.hurtT = 0.25; p.lastHurt = R.time;
    shake(Math.min(10, 2 + dmg / S.maxHp * 30) * (mult < 1 ? 0.5 : 1));
    addText(p.x, p.y, 50, '-' + Math.round(dmg), '#ff5c5c', 17);
    burst(p.x, p.y, '#b3151b', 5, 140, 0.45, 3, 1, 20);
    if (mult === 1) { Sound.sfx('hurt', 0.12); R.flash = Math.min(0.5, R.flash + 0.25); }
    if (S.rb.thorns > 0 && src && !src.dead && !opts.noThorns) damageEnemy(src, dmg * S.rb.thorns / 100, { silent: false, color: '#c9a' });
    if (p.hp <= 0) { p.hp = 0; p.dead = true; finish('dead'); }
  }

  function endSprint() {
    const p = R.p, S = R.S;
    if (!p.sprinting) return;
    p.sprinting = false;
    p.sprintCd = S.sprint.cd * (0.35 + 0.65 * Math.min(1, p.sprintUsed / S.sprint.dur));
  }

  /** Schwungrichtung per Taste: zum Mauszeiger, rastet auf Gegner in Reichweite ein. */
  function aimDir() {
    const p = R.p, S = R.S;
    const a = Math.atan2(Input.wy - p.y, Input.wx - p.x);
    let best = null, bs = 1e9;
    for (const e of R.enemies) {
      if (e.dead) continue;
      const dx = e.x - p.x, dy = e.y - p.y, d = hyp(dx, dy);
      if (d - e.r > S.reach * 1.05) continue;
      const ea = Math.atan2(dy, dx), da = Math.abs(angDiff(ea, a));
      if (da > 0.9) continue;
      const sc = da * 120 + d * 0.4;
      if (sc < bs) { bs = sc; best = ea; }
    }
    return best === null ? a : best;
  }

  function startSwing(dir) {
    const p = R.p, S = R.S;
    p.swingT = 0; p.hitDone = false; p.swingDur = Math.max(0.2, Math.min(0.34, S.interval * 0.42));
    p.swingDir = dir; p.face = dir; p.atkCd = S.interval; p.swingSide = -p.swingSide; p.lunge = 0.09;
    Sound.sfx('swing', 0.08);
  }

  function updatePlayer(dt) {
    const p = R.p, S = R.S, map = R.map, K = Input.keys;
    p.anim += dt; p.hurtT = Math.max(0, p.hurtT - dt); p.castT = Math.max(0, p.castT - dt);
    p.blockFlash = Math.max(0, p.blockFlash - dt); p.parryFlash = Math.max(0, p.parryFlash - dt);
    if (p.dead) return;
    const wx = Input.wx, wy = Input.wy;
    const aimA = Math.atan2(wy - p.y, wx - p.x);
    const atkKey = !!(K['Space'] || K['KeyJ'] || Input.down); // Leertaste / J / linke Maustaste: Hieb Richtung Mauszeiger

    // --- Schild (Q / K halten)
    if (S.block && (K['KeyQ'] || K['KeyK']) && (p.blocking || p.swingT < 0)) {
      if (!p.blocking) { p.blocking = true; p.blockT = 0; p.target = null; if (p.sprinting) endSprint(); Sound.sfx('shield', 0.1); }
      p.blockT += dt;
    } else p.blocking = false;

    // --- Bewegung: WASD relativ zum Bildschirm (isometrisch), rechte Maustaste = hinlaufen (halten = weiterlaufen)
    const up = (K['KeyW'] || K['ArrowUp'] ? 1 : 0) - (K['KeyS'] || K['ArrowDown'] ? 1 : 0);
    const rt = (K['KeyD'] || K['ArrowRight'] ? 1 : 0) - (K['KeyA'] || K['ArrowLeft'] ? 1 : 0);
    let mx = -CY * up + SY * rt, my = -SY * up - CY * rt;
    const keyMove = !!(up || rt);
    if (keyMove || p.blocking) p.target = null;
    else if (Input.rdown) p.target = { x: wx, y: wy };
    if (!keyMove) {
      if (p.target) {
        const dx = p.target.x - p.x, dy = p.target.y - p.y, d = hyp(dx, dy);
        if (d < 8) p.target = null; else { mx = dx / d; my = dy / d; }
      } else { mx = 0; my = 0; }
    }
    p.moving = !!(mx || my);

    // --- Sprint (Shift, ab Stufe 10)
    if (S.sprint) {
      const shift = K['ShiftLeft'] || K['ShiftRight'];
      if (p.sprinting) {
        p.sprintT -= dt; p.sprintUsed += dt;
        if (p.sprintT <= 0 || !shift || p.blocking || !p.moving) endSprint();
      } else {
        p.sprintCd = Math.max(0, p.sprintCd - dt);
        if (shift && p.sprintCd <= 0 && p.moving && !p.blocking) {
          p.sprinting = true; p.sprintT = S.sprint.dur; p.sprintUsed = 0;
          Sound.sfx('whoosh', 0.2);
          burst(p.x, p.y, '#b8a888', 8, 110, 0.5, 4, 0.1, 2);
        }
      }
    } else p.sprinting = false;

    if (p.moving) {
      const l = hyp(mx, my); mx /= l; my /= l;
      let sp = S.move * (p.slowT > 0 ? 0.6 : 1);
      if (p.sprinting) sp *= S.sprint.mul;
      if (p.blocking) sp *= S.block.move;
      tryMove(p, mx * sp * dt, my * sp * dt, p.r);
      if (p.sprinting) {
        p.dust -= dt;
        if (p.dust <= 0) { p.dust = 0.045; burst(p.x - mx * 8, p.y - my * 8, '#a89878', 2, 55, 0.45, 3.5, 0.15, 2); }
      }
    }
    // Blickrichtung: Schwung > Schild/Angriff (Mauszeiger) > Laufrichtung
    if (p.swingT < 0 && p.castT <= 0) {
      if (p.blocking || atkKey) p.face = aimA;
      else if (p.moving) p.face = Math.atan2(my, mx);
    }

    // --- Regeneration, Mana
    if (S.rb.regen > 0) healPlayer(S.maxHp * S.rb.regen / 100 * dt, true);
    if (S.maxMana > 0) R.p.mana = Math.min(S.maxMana, R.p.mana + S.manaRegen * dt);

    // --- Schwertangriff: linke Maustaste / Leertaste / J (halten = weiter schlagen)
    p.atkCd -= dt;
    if (p.swingT >= 0) {
      p.swingT += dt;
      if (p.lunge > 0) {
        const l = Math.min(p.lunge, dt); p.lunge -= l;
        tryMove(p, Math.cos(p.swingDir) * l * 150, Math.sin(p.swingDir) * l * 150, p.r);
      }
      if (!p.hitDone && p.swingT >= p.swingDur * 0.42) { p.hitDone = true; swordHit(); }
      if (p.swingT >= p.swingDur) p.swingT = -1;
    }
    if (!p.blocking && p.swingT < 0 && p.atkCd <= 0) {
      if (atkKey) startSwing(aimDir());
    }

    // --- Eingaben für Zauber
    for (const k of Input.spellQueue) if (k >= 0) castSpell(k);
    Input.spellQueue.length = 0;
    for (let i = 0; i < 5; i++) R.cd[i] = Math.max(0, R.cd[i] - dt);
    if (p.slowT > 0) p.slowT -= dt;
    markExplored();
    const ri = map.roomAt[Math.floor(p.y / T) * map.w + Math.floor(p.x / T)];
    if (ri >= 0 && ri !== R.room) enterRoom(ri);
  }

  function swordHit() {
    const p = R.p, S = R.S;
    let hits = 0, crits = 0;
    for (const e of R.enemies) {
      if (e.dead) continue;
      const dx = e.x - p.x, dy = e.y - p.y, d = hyp(dx, dy);
      if (d > S.reach + e.r) continue;
      const tol = S.arc / 2 + Math.atan2(e.r, Math.max(d, 1));
      if (Math.abs(angDiff(Math.atan2(dy, dx), p.swingDir)) > tol) continue;
      const crit = Math.random() < S.critCh;
      let dmg = S.dmg * rr(0.9, 1.1) * (crit ? S.critMul : 1);
      const nx = dx / (d || 1), ny = dy / (d || 1);
      const dealt = damageEnemy(e, dmg, { crit, kb: { x: nx, y: ny, f: e.boss ? 0 : 90 } });
      hits++; if (crit) crits++;
      burst(e.x - nx * e.r, e.y - ny * e.r, crit ? '#ffe27a' : '#ffe9c4', crit ? 16 : 7, 250, 0.32, 2.2, 1, 24, true);
      if (S.rb.steal > 0) healPlayer(dealt * S.rb.steal / 100, true);
      if (S.rb.burn > 0) e.burn = { t: 3, dps: S.dmg * S.rb.burn / 100 / 3, acc: 0 };
      if (S.rb.slow > 0) { e.slowT = 1.8; e.slowF = Math.max(e.slowF, S.rb.slow / 100); }
    }
    for (const pr of R.map.props) {
      if (!pr.breakable || pr.broken) continue;
      const dx = pr.x - p.x, dy = pr.y - p.y, d = hyp(dx, dy);
      if (d > S.reach * 0.75) continue;
      if (Math.abs(angDiff(Math.atan2(dy, dx), p.swingDir)) > S.arc / 2 + 0.3) continue;
      breakProp(pr);
    }
    if (hits) {
      Sound.sfx(crits ? 'crit' : 'hit', 0.05);
      R.hitstop = Math.max(R.hitstop, crits ? 0.075 : 0.04);
      if (crits) shake(3);
    }
  }

  function breakProp(pr) {
    pr.broken = true;
    burst(pr.x, pr.y, '#8a5a2b', 14, 170, 0.7, 3.2, 1, 14);
    burst(pr.x, pr.y, '#c9a070', 6, 90, 0.5, 2, 0.6, 20);
    shake(1.5);
    Sound.sfx('hit', 0.05);
    const f = 1 + R.S.rb.find / 100;
    if (Math.random() < 0.28 * f) dropPickup('hp', pr.x, pr.y);
    else if (R.S.maxMana > 0 && Math.random() < 0.15 * f) dropPickup('mana', pr.x, pr.y);
  }

  /* ============================================================ Schaden / Tod */
  const BONE_LOOKS = ['skeleton', 'archer', 'boss'];
  function bloodColor(e) {
    if (e.look === 'slime' || e.look === 'spitter') return '#6fbf4a';
    if (BONE_LOOKS.includes(e.look)) return '#d8d2c0';
    if (e.look === 'golem' || e.look === 'guard') return '#9aa5b3';
    if (e.look === 'cbat') return '#58b9e8';
    return '#a8272c';
  }
  function damageEnemy(e, amount, o) {
    o = o || {};
    if (e.dead) return 0;
    if (e.armored) amount *= 0.7;
    e.hp -= amount; e.flash = 0.1;
    if (e.state === 'sleep') { e.state = 'awake'; wakePack(e.pack); }
    const big = amount >= e.maxHp * 0.25;
    if (!o.silent) addText(e.x, e.y, e.r * 3.4 + 12, String(Math.round(amount)), o.crit ? '#ffd23f' : (o.color || '#f4efe4'), o.crit ? 22 : big ? 19 : 15, o.crit ? 1.0 : 0.75);
    if (o.kb && e.state === 'awake') { e.kx += o.kb.x * o.kb.f * 3; e.ky += o.kb.y * o.kb.f * 3; }
    if (o.stun) e.stun = Math.max(e.stun, o.stun);
    burst(e.x, e.y, bloodColor(e), o.crit ? 7 : 4, 130, 0.45, 2.6, 1, e.r * 1.8);
    if (e.hp <= 0) killEnemy(e);
    return amount;
  }

  function killEnemy(e) {
    e.dead = true; e.deadT = 0;
    const S = R.S;
    burst(e.x, e.y, bloodColor(e), e.boss ? 60 : 14, e.boss ? 380 : 200, e.boss ? 1.4 : 0.8, e.boss ? 5 : 3, 1, e.r * 1.6);
    Sound.sfx('die', 0.05);
    if (!e.minion && !e.mini) { R.kills++; Save.data.stats.kills++; }
    gainXp(e.xp, e);
    const room = R.map.rooms[e.room];
    if (!e.minion && !e.mini) {
      room.enemies--;
      drops(e);
      if (room.enemies <= 0 && !room.cleared) roomCleared(room);
    }
    if (e.special === 'split' && !e.mini) {
      for (let k = 0; k < 2; k++) {
        const m = ZONES[e.zone].mobs.find(x => x[2] === 'slime');
        const s = makeEnemy(e.zone, m, e.x + rr(-14, 14), e.y + rr(-14, 14), e.pack, e.room, { mini: true });
        s.state = 'awake'; s.mini = true; R.enemies.push(s);
      }
    }
    if (e.boss) bossDied(e);
  }

  function roomCleared(room) {
    room.cleared = true;
    const p = R.p;
    if (room.i === R.room && !R.over) {
      addText(p.x, p.y, 70, 'Raum gesäubert', '#e8c97a', 20, 1.6);
      dropPickup('hp', room.cx * T + T / 2, room.cy * T + T / 2);
    }
    // Nächste Startzone freischalten, wenn eine Zone komplett gesäubert ist
    if ((room.i + 1) % BAL.roomsPerZone === 0 && room.zone < ZONES.length - 1) {
      const sv = Save.data;
      if (sv.zoneUnlock < room.zone + 1) {
        sv.zoneUnlock = room.zone + 1; Save.write();
        banner('Neuer Startpunkt', `${ZONES[room.zone + 1].name} ist jetzt im Lager anwählbar`, '#9bd77a');
        Sound.sfx('unlock');
      }
    }
  }

  function drops(e) {
    const S = R.S, sv = Save.data, f = 1 + S.rb.find / 100;
    const d = LOS.DIFFS[R.diff];
    if (e.elite) {
      if (Math.random() < BAL.eliteOrbChance) dropPickup('hp', e.x, e.y);
      if (Math.random() < BAL.eliteOrbChance2) dropPickup('hp', e.x, e.y);
      if (S.maxMana > 0) dropPickup('mana', e.x, e.y);
    } else {
      if (Math.random() < BAL.orbChance * f) dropPickup('hp', e.x, e.y);
      if (S.maxMana > 0 && Math.random() < BAL.manaOrbChance * f) dropPickup('mana', e.x, e.y);
    }
    if (sv.level >= BAL.runeUnlockLevel) {
      const ch = (e.elite ? BAL.runeChanceElite : BAL.runeChance) * f * (1 + d.rune * 0.6);
      if (Math.random() < ch) dropRune(e.zone, e.elite ? 1 : 0, e.x, e.y);
    }
  }

  function dropRune(zone, quality, x, y) {
    const tier = LOS.rollRuneTier(zone, R.diff, quality, Math.random);
    const def = pick(LOS.RUNES);
    dropPickup('rune', x, y, { id: def.id, tier });
  }

  function dropPickup(type, x, y, rune) {
    const a = Math.random() * 6.28, s = rr(40, 120);
    R.pickups.push({ type, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, z: 14, vz: rr(120, 220), t: 0, rune: rune || null, life: type === 'rune' ? 300 : 45 });
  }

  function gainXp(base, src) {
    const S = R.S, sv = Save.data;
    const amt = base * S.xpMul * BAL.xpRate;
    sv.xp += amt; sv.stats.xp += amt; R.xpGained += amt;
    if (src && (src.elite || src.boss || amt >= 20)) addText(src.x, src.y, src.r * 3.4 + 30, '+' + Math.round(amt) + ' XP', '#c9a8ff', src.boss ? 22 : 14, 1.2);
    while (sv.level < BAL.maxLevel && sv.xp >= LOS.xpNeed(sv.level)) {
      sv.xp -= LOS.xpNeed(sv.level);
      sv.level++; sv.unspent++; R.levelUps++;
      levelUpFx();
    }
    if (sv.level >= BAL.maxLevel) sv.xp = 0;
  }

  function levelUpFx() {
    const p = R.p, sv = Save.data;
    Sound.sfx('levelup', 0.3);
    burst(p.x, p.y, '#ffe08a', 46, 320, 1.2, 3.5, 0.3, 20, true);
    R.fx.push({ k: 'ring', x: p.x, y: p.y, z: 4, r0: 10, r1: 220, t: 0, dur: 0.9, color: '#ffe08a' });
    R.fx.push({ k: 'beam', x: p.x, y: p.y, t: 0, dur: 1.1, color: '#ffe08a', slim: true });
    R.S = LOS.derive(sv.level, sv.pts, R.runes); // schaltet Sprint (Stufe 10) und Schild (Stufe 12) sofort frei
    const bodyUp = sv.level % BAL.bodyTierEvery === 0;
    let sub = '+1 Statuspunkt – im Lager verteilen';
    if (sv.level === BAL.magicUnlockLevel) sub = 'Die Magie erwacht! Zauberpunkte sind nun im Lager verfügbar.';
    else if (sv.level === BAL.runeUnlockLevel) sub = 'Runen können nun gefunden und eingesetzt werden!';
    else if (BAL.runeSlotLevels.includes(sv.level)) sub = 'Ein neuer Runenplatz wurde freigeschaltet!';
    else if (sv.level === BAL.shieldUnlockLevel) sub = 'Schild freigeschaltet! Halte Q oder K zum Blocken.';
    if (sv.level === BAL.sprintUnlockLevel) sub = 'Sprint freigeschaltet! Halte Shift beim Laufen.';
    if (bodyUp) {
      sub += ` · Neue Rüstung: ${LOS.GEAR.body[LOS.bodyTier(sv.level)]}`;
      R.fx.push({ k: 'ring', x: p.x, y: p.y, z: 30, r0: 10, r1: 120, t: 0, dur: 1.1, color: '#fff2c0' });
      burst(p.x, p.y, '#fff2c0', 40, 220, 1.3, 3, -0.15, 30, true);
    }
    banner('Stufe ' + sv.level, sub, '#ffe08a');
  }

  /* ============================================================ Gegner-KI */
  function updateEnemies(dt) {
    const p = R.p;
    Dungeon.updateFlow(R.map, R.flow, p.x, p.y, 90);
    const act = [];
    for (const e of R.enemies) {
      if (e.dead) { e.deadT += dt; continue; }
      if (e.state === 'sleep') {
        e.wakeT -= dt;
        if (e.wakeT <= 0) {
          e.wakeT = 0.25;
          const d = hyp(e.x - p.x, e.y - p.y);
          const r = e.boss ? 520 : 330;
          if (d < r && (d < 150 || R.map.los(e.x, e.y, p.x, p.y)) && (!e.boss || R.map.roomAt[Math.floor(p.y / T) * R.map.w + Math.floor(p.x / T)] === e.room)) {
            wakePack(e.pack);
          }
        }
        continue;
      }
      act.push(e);
    }
    // Trennung
    for (let i = 0; i < act.length; i++) {
      const a = act[i]; a.sepx = 0; a.sepy = 0;
      for (let j = i + 1; j < act.length; j++) {
        const b = act[j];
        const dx = b.x - a.x; if (dx > 40 || dx < -40) continue;
        const dy = b.y - a.y; if (dy > 40 || dy < -40) continue;
        const d = hyp(dx, dy), m = (a.r + b.r) * 0.9;
        if (d < m && d > 0.01) {
          const push = (m - d) * 0.5, nx = dx / d, ny = dy / d;
          if (!a.boss) tryMove(a, -nx * push, -ny * push, a.r * 0.7);
          if (!b.boss) tryMove(b, nx * push, ny * push, b.r * 0.7);
        }
      }
    }
    for (const e of act) updateEnemy(e, dt);
    // Aufräumen (Tote bleiben kurz für die Sterbeanimation liegen)
    if (R.enemies.length > 0 && R.time % 1 < dt) R.enemies = R.enemies.filter(e => !e.dead || e.deadT < 1.2);
  }

  function chase(e, dt, speed, tx, ty) {
    let dx = tx - e.x, dy = ty - e.y; const d = hyp(dx, dy) || 1; dx /= d; dy /= d;
    const direct = e.flowT <= 0 && R.map.los(e.x, e.y, tx, ty);
    if (!direct) { const f = Dungeon.flowDir(R.map, R.flow, e.x, e.y); if (f) { dx = f.x; dy = f.y; } }
    const moved = tryMove(e, dx * speed * dt, dy * speed * dt, e.r * 0.75);
    if (direct && moved < speed * dt * 0.3) e.flowT = 0.8;
    e.moving = true;
  }

  function updateEnemy(e, dt) {
    const p = R.p, S = R.S;
    e.anim += dt; e.flash = Math.max(0, e.flash - dt); e.atkT -= dt; e.flowT -= dt; e.moving = false;
    // Ausholen/Zuschlagen für die Animation merken
    if (e.wind > e.wprev + 0.001) e.windMax = e.wind;
    if (e.wprev > 0 && e.wind <= 0) e.strikeT = 0.25;
    e.wprev = e.wind; e.strikeT = Math.max(0, e.strikeT - dt);
    if (e.slowT > 0) { e.slowT -= dt; if (e.slowT <= 0) e.slowF = 0; }
    if (e.burn) {
      e.burn.t -= dt; e.burn.acc += dt;
      damageEnemy(e, e.burn.dps * dt, { silent: true });
      if (Math.random() < dt * 14) burst(e.x, e.y, '#ff8a2a', 1, 40, 0.5, 2.6, -0.4, e.r * 2, true);
      if (e.burn.acc >= 1) { e.burn.acc = 0; addText(e.x, e.y, e.r * 3.4, String(Math.round(e.burn.dps)), '#ff9a3c', 13, 0.6); }
      if (e.burn.t <= 0) e.burn = null;
      if (e.dead) return;
    }
    // Rückstoß
    if (e.kx || e.ky) {
      tryMove(e, e.kx * dt * 4, e.ky * dt * 4, e.r * 0.7);
      e.kx *= Math.max(0, 1 - dt * 10); e.ky *= Math.max(0, 1 - dt * 10);
      if (Math.abs(e.kx) < 3) e.kx = 0; if (Math.abs(e.ky) < 3) e.ky = 0;
    }
    if (e.stun > 0) { e.stun -= dt; return; }
    const dx = p.x - e.x, dy = p.y - e.y, d = hyp(dx, dy);
    const spd = e.spd * (e.slowT > 0 ? 1 - e.slowF : 1);
    if (p.dead) return;

    switch (e.ai) {
      case 'melee': case 'flyer': {
        const reach = e.r + p.r + 14;
        if (e.special === 'charge') golemCharge(e, dt, d, spd);
        if (e.dash > 0) break;
        if (e.wind > 0) {
          e.wind -= dt;
          if (e.wind <= 0 && !p.dead && hyp(p.x - e.x, p.y - e.y) < reach + 16) { hurtPlayer(e.dmg, e); Sound.sfx('hit', 0.05); }
          break;
        }
        if (d > reach * 0.9) {
          let sp = spd;
          if (e.ai === 'flyer') {
            // schlängelnder Anflug
            const off = Math.sin(e.anim * 5 + e.id) * 0.7;
            const ang = Math.atan2(dy, dx) + off;
            tryMove(e, Math.cos(ang) * sp * dt, Math.sin(ang) * sp * dt, e.r * 0.7);
            e.moving = true;
            if (R.map.los(e.x, e.y, p.x, p.y) === false) chase(e, dt, sp, p.x, p.y);
          } else chase(e, dt, sp, p.x, p.y);
        } else if (e.atkT <= 0) { e.wind = e.ai === 'flyer' ? 0.2 : 0.32; e.atkT = e.cd; }
        break;
      }
      case 'ranged': case 'necro': {
        if (e.wind > 0) {
          e.wind -= dt;
          if (e.wind <= 0) enemyShoot(e);
          break;
        }
        const los = R.map.los(e.x, e.y, p.x, p.y);
        const want = e.range * 0.7;
        if (!los || d > e.range * 0.95) chase(e, dt, spd, p.x, p.y);
        else if (d < e.range * 0.4) { tryMove(e, -dx / d * spd * dt, -dy / d * spd * dt, e.r * 0.75); e.moving = true; }
        else { const sx = -dy / d, sy = dx / d, dir = Math.sin(e.id * 7.3) > 0 ? 1 : -1; tryMove(e, sx * dir * spd * 0.4 * dt, sy * dir * spd * 0.4 * dt, e.r * 0.75); e.moving = true; }
        if (los && d < e.range && e.atkT <= 0) { e.wind = 0.45; e.atkT = e.cd; }
        if (e.ai === 'necro') {
          e.summonT -= dt;
          if (e.summonT <= 0 && los && d < 520) {
            e.summonT = 7;
            const mine = R.enemies.filter(o => !o.dead && o.minion && o.owner === e).length;
            if (mine < 3) necroSummon(e);
          }
        }
        break;
      }
      case 'boss': updateBoss(e, dt, d); break;
    }
  }

  function golemCharge(e, dt, d, spd) {
    e.chargeT -= dt;
    if (e.dash > 0) {
      e.dash -= dt;
      const m = tryMove(e, e.dashX * 420 * dt, e.dashY * 420 * dt, e.r * 0.75);
      if (hyp(R.p.x - e.x, R.p.y - e.y) < e.r + R.p.r + 6 && !e.dashHit) { e.dashHit = true; hurtPlayer(e.dmg * 1.3, e); shake(6); }
      if (m < 1) e.dash = 0;
      return;
    }
    if (e.wind > 0 && e.windType === 'charge') {
      e.wind -= dt;
      if (e.wind <= 0) { e.dash = 0.55; e.dashHit = false; Sound.sfx('slam'); }
      return;
    }
    if (e.chargeT <= 0 && d > 140 && d < 460 && R.map.los(e.x, e.y, R.p.x, R.p.y)) {
      e.windType = 'charge'; e.wind = 0.7; e.chargeT = rr(5, 8);
      const l = d || 1; e.dashX = (R.p.x - e.x) / l; e.dashY = (R.p.y - e.y) / l;
      R.tele.push({ kind: 'line', x: e.x, y: e.y, x2: e.x + e.dashX * 230, y2: e.y + e.dashY * 230, w: e.r * 1.6, t: 0, dur: 0.7, dmg: 0 });
    }
  }

  function enemyShoot(e) {
    const p = R.p;
    if (e.ai === 'necro') { /* Dunkler Strahl */ }
    const a = Math.atan2(p.y - e.y, p.x - e.x);
    const colors = { archer: '#d8c8a0', spitter: '#7fe04a', mage: '#7fd8ff', necro: '#b36bff' };
    const sp = e.look === 'archer' ? 340 : 270;
    R.eproj.push({ x: e.x, y: e.y, z: e.r * 2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, dmg: e.dmg, r: 6, life: 2.2, color: colors[e.look] || '#fff', look: e.look, owner: e });
    Sound.sfx('shoot', 0.08);
  }

  function necroSummon(e) {
    const zone = e.zone;
    const grunt = ZONES[zone].mobs.find(m => m[0] === 'grunt');
    for (let k = 0; k < 2; k++) {
      const m = makeEnemy(zone, grunt, e.x + (k ? 26 : -26), e.y + 8, e.pack, e.room, { minion: true });
      m.state = 'awake'; m.owner = e; R.enemies.push(m);
    }
    burst(e.x, e.y, '#b36bff', 20, 160, 0.8, 3, -0.2, 10, true);
    R.fx.push({ k: 'ring', x: e.x, y: e.y, z: 3, r0: 10, r1: 70, t: 0, dur: 0.5, color: '#b36bff' });
  }

  /* ============================================================ Boss */
  function bossAwake(e) {
    if (R.bossActive) return;
    R.bossActive = true;
    banner(e.name, 'Besiege ihn, und Welt 1 liegt hinter dir!', '#ff6a4a');
    Sound.play('boss'); Sound.sfx('roar'); shake(8);
  }
  function bossSummon(e) {
    Sound.sfx('roar'); shake(7);
    const room = R.map.rooms[e.room];
    for (let k = 0; k < 4; k++) {
      const mob = LOS.pickMob(4, Math.random);
      const pos = R.map.randomFloorIn(room, 3, Math.random);
      const a = makeEnemy(4, mob, pos.x, pos.y, e.pack, e.room, { minion: true });
      a.hp = a.maxHp = a.maxHp / 0.45 * 0.8; a.state = 'awake'; R.enemies.push(a);
      burst(pos.x, pos.y, '#ff4a3a', 18, 180, 0.7, 3, -0.2, 10, true);
      R.fx.push({ k: 'ring', x: pos.x, y: pos.y, z: 3, r0: 8, r1: 60, t: 0, dur: 0.5, color: '#ff4a3a' });
    }
    banner('Malgorath ruft seine Diener!', '', '#ff6a4a');
  }
  function updateBoss(e, dt, d) {
    const p = R.p;
    const hpF = e.hp / e.maxHp;
    e.enrage = hpF < 0.25;
    for (const th of [0.75, 0.5, 0.25]) if (hpF < th && !e.summoned[th]) { e.summoned[th] = true; bossSummon(e); }
    const spdM = e.enrage ? 1.35 : 1;
    const spd = e.spd * spdM * (e.slowT > 0 ? 1 - e.slowF * 0.5 : 1);
    if (e.dash > 0) {
      e.dash -= dt;
      const m = tryMove(e, e.dashX * 560 * dt, e.dashY * 560 * dt, e.r * 0.7);
      if (!e.dashHit && hyp(p.x - e.x, p.y - e.y) < e.r + p.r + 6) { e.dashHit = true; hurtPlayer(e.dmg * 1.2, e); shake(9); }
      if (m < 1) e.dash = 0;
      return;
    }
    if (e.wind > 0) {
      e.wind -= dt;
      if (e.wind <= 0) {
        if (e.windType === 'spears') {
          const n = e.enrage ? 7 : 5, base = Math.atan2(p.y - e.y, p.x - e.x);
          for (let i = 0; i < n; i++) {
            const a = base + (i - (n - 1) / 2) * 0.2;
            R.eproj.push({ x: e.x, y: e.y, z: 40, vx: Math.cos(a) * 330, vy: Math.sin(a) * 330, dmg: e.dmg * 0.55, r: 8, life: 2.6, color: '#e8e2cf', look: 'spear', owner: e });
          }
          Sound.sfx('shoot');
        } else if (e.windType === 'charge') {
          e.dash = 0.6; e.dashHit = false; Sound.sfx('slam');
        }
      }
      return;
    }
    e.bt -= dt;
    if (d > 120) chase(e, dt, spd, p.x, p.y);
    if (e.bt <= 0 && !p.dead) {
      const cdm = e.enrage ? 0.65 : 1;
      const roll = Math.random();
      if (d < 170 && roll < 0.7) {
        e.windType = 'slam'; e.wind = 0.9; e.bt = 2.0 * cdm + 0.9;
        R.tele.push({ kind: 'circle', x: e.x, y: e.y, r: 150, t: 0, dur: 0.9, dmg: e.dmg * 1.5, boom: true });
      } else if (hpF < 0.75 && roll < 0.55 && d > 140) {
        e.windType = 'charge'; e.wind = 0.85; e.bt = 3.2 * cdm;
        const l = d || 1; e.dashX = (p.x - e.x) / l; e.dashY = (p.y - e.y) / l;
        R.tele.push({ kind: 'line', x: e.x, y: e.y, x2: e.x + e.dashX * 340, y2: e.y + e.dashY * 340, w: e.r * 1.7, t: 0, dur: 0.85, dmg: 0 });
      } else {
        e.windType = 'spears'; e.wind = 0.55; e.bt = 2.4 * cdm;
      }
    }
  }
  function bossDied(e) {
    R.bossDead = true;
    shake(14);
    Sound.sfx('boom'); Sound.sfx('wrath');
    R.fx.push({ k: 'ring', x: e.x, y: e.y, z: 4, r0: 20, r1: 520, t: 0, dur: 1.4, color: '#ffd9a0' });
    R.fx.push({ k: 'beam', x: e.x, y: e.y, t: 0, dur: 1.6, color: '#ffd9a0', slim: true });
    for (let k = 0; k < 3; k++) dropRune(4, 2, e.x + rr(-30, 30), e.y + rr(-20, 20));
    for (let k = 0; k < 3; k++) dropPickup('hp', e.x, e.y);
    // Diener sterben mit
    for (const o of R.enemies) if (!o.dead && o !== e && o.pack === e.pack && o.minion) { o.hp = 0; o.dead = true; o.deadT = 0; burst(o.x, o.y, '#d8d2c0', 10, 180, 0.7, 3, 1, 14); }
    const sv = Save.data;
    sv.stats.bossKills++;
    R.timers.push({ t: 2.6, fn: () => finish('win') });
  }

  /* ============================================================ Projektile, Telegraphen, Effekte */
  function updateProjectiles(dt) {
    const p = R.p, map = R.map;
    for (const b of R.eproj) {
      b.life -= dt;
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (map.solid(b.x, b.y)) b.life = 0;
      if (!p.dead && hyp(b.x - p.x, b.y - p.y) < b.r + 12) {
        hurtPlayer(b.dmg, b.owner, { noThorns: true, from: { x: b.x - b.vx * 0.05, y: b.y - b.vy * 0.05 } });
        b.life = 0; burst(b.x, b.y, b.color, 7, 110, 0.35, 2.5, 0, b.z, true);
      }
    }
    R.eproj = R.eproj.filter(b => b.life > 0);
    for (const b of R.pproj) {
      b.life -= dt;
      if (b.homing) steerHoming(b, dt);
      b.x += b.vx * dt; b.y += b.vy * dt;
      b.trail = (b.trail || 0) + dt;
      if (b.trail > 0.016) {
        b.trail = 0;
        burst(b.x, b.y, b.color, 1, 36, 0.5, 4.2, -0.12, b.z, true);
        burst(b.x, b.y, '#ffe6a0', 1, 22, 0.28, 2.2, 0, b.z, true);
      }
      let hit = map.solid(b.x, b.y) || b.life <= 0;
      if (!hit) for (const e of R.enemies) if (!e.dead && hyp(e.x - b.x, e.y - b.y) < e.r + b.r + 4) { hit = true; break; }
      if (hit) { b.life = 0; explode(b.x, b.y, 78, b.dmg, b.color, { burn: true }); }
    }
    R.pproj = R.pproj.filter(b => b.life > 0);
  }

  /** Zielsuchender Feuerball: sucht sich einen Gegner vor sich und biegt in dessen Richtung ab. */
  function findHomingTarget(b, maxD, maxAng) {
    let best = null, bs = 1e9;
    const ang = Math.atan2(b.vy, b.vx);
    for (const e of R.enemies) {
      if (e.dead) continue;
      const dx = e.x - b.x, dy = e.y - b.y, d = hyp(dx, dy);
      if (d > maxD) continue;
      const da = Math.abs(angDiff(Math.atan2(dy, dx), ang));
      if (da > maxAng) continue;
      const sc = d + da * 140;
      if (sc < bs && R.map.los(b.x, b.y, e.x, e.y)) { bs = sc; best = e; }
    }
    return best;
  }
  function steerHoming(b, dt) {
    b.age = (b.age || 0) + dt;
    if (!b.target || b.target.dead) b.target = findHomingTarget(b, 340, 1.4);
    if (!b.target || b.age < 0.08) return;
    const cur = Math.atan2(b.vy, b.vx), want = Math.atan2(b.target.y - b.y, b.target.x - b.x);
    const da = Math.max(-b.turn * dt, Math.min(b.turn * dt, angDiff(want, cur)));
    const sp = Math.min(b.maxSp, hyp(b.vx, b.vy) + 420 * dt);
    b.vx = Math.cos(cur + da) * sp; b.vy = Math.sin(cur + da) * sp;
  }

  function explode(x, y, rad, dmg, color, o) {
    o = o || {};
    R.fx.push({ k: 'boom', x, y, r: rad, t: 0, dur: 0.55, color });
    R.fx.push({ k: 'scorch', x, y, r: rad * 0.8, t: 0, dur: 3.5, color });
    burst(x, y, color, 26, 300, 0.7, 4, 0.5, 14, true);
    burst(x, y, '#fff0c0', 10, 200, 0.4, 3, 0.3, 14, true);
    burst(x, y, '#3a3230', 10, 90, 1.1, 7, -0.35, 12);
    Sound.sfx('boom', 0.06);
    shake(o.shake || 3);
    for (const e of R.enemies) {
      if (e.dead) continue;
      const d = hyp(e.x - x, e.y - y);
      if (d > rad + e.r) continue;
      const nx = (e.x - x) / (d || 1), ny = (e.y - y) / (d || 1);
      damageEnemy(e, dmg * rr(0.92, 1.08), { color, kb: { x: nx, y: ny, f: e.boss ? 0 : 70 } });
      if (o.burn && R.S.rb.arcane > 0) e.burn = { t: 3, dps: dmg * 0.1, acc: 0 };
    }
  }

  function updateTele(dt) {
    const p = R.p;
    for (const t of R.tele) {
      t.t += dt;
      if (t.t >= t.dur && !t.done) {
        t.done = true;
        if (t.kind === 'circle') {
          if (t.dmg && !p.dead && hyp(p.x - t.x, p.y - t.y) < t.r + p.r) hurtPlayer(t.dmg, null);
          if (t.boom) {
            shake(10); Sound.sfx('slam');
            burst(t.x, t.y, '#b89a6a', 30, 320, 0.8, 4.5, 0.6, 6);
            burst(t.x, t.y, '#6a5a48', 14, 120, 1.2, 9, -0.3, 8);
            R.fx.push({ k: 'ring', x: t.x, y: t.y, z: 3, r0: 20, r1: t.r * 1.15, t: 0, dur: 0.5, color: '#d9b87a' });
            R.fx.push({ k: 'scorch', x: t.x, y: t.y, r: t.r * 0.8, t: 0, dur: 3, color: '#6a4a2a' });
          }
        }
        if (t.fn) t.fn();
      }
    }
    R.tele = R.tele.filter(t => !t.done);
  }

  function updateFx(dt) {
    for (const f of R.fx) f.t += dt;
    R.fx = R.fx.filter(f => f.t < f.dur);
    for (const t of R.timers) t.t -= dt;
    const due = R.timers.filter(t => t.t <= 0);
    R.timers = R.timers.filter(t => t.t > 0);
    for (const t of due) t.fn();
    for (const q of R.parts) {
      q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
      if (q.grav) {
        q.vz -= 520 * dt * q.grav;
        if (q.z < 0) { q.z = 0; q.vz *= -0.35; q.vx *= 0.6; q.vy *= 0.6; if (Math.abs(q.vz) < 20) q.vz = 0; }
      }
      const k = 1 - dt * 2; q.vx *= k; q.vy *= k;
    }
    R.parts = R.parts.filter(q => q.life > 0);
    for (const t of R.texts) { t.t += dt; t.z += 30 * dt; }
    R.texts = R.texts.filter(t => t.t < t.life);
    if (R.banner) { R.banner.t += dt; if (R.banner.t > R.banner.life) R.banner = null; }
    R.flash = Math.max(0, R.flash - dt * 1.5);
  }

  function updatePickups(dt) {
    const p = R.p;
    for (const k of R.pickups) {
      k.t += dt; k.life -= dt;
      if (!isFinite(k.x + k.y)) { k.life = 0; continue; }
      if (k.z > 0 || k.vz > 0) {
        k.z += k.vz * dt; k.vz -= 700 * dt;
        k.x += k.vx * dt; k.y += k.vy * dt; k.vx *= 1 - dt * 3; k.vy *= 1 - dt * 3;
        if (R.map.solid(k.x, k.y)) { k.x -= k.vx * dt * 2; k.y -= k.vy * dt * 2; k.vx = k.vy = 0; }
        if (k.z <= 0) { k.z = 0; k.vz = 0; }
      }
      const d = hyp(p.x - k.x, p.y - k.y);
      if (d < 90 && d > 1 && !p.dead && k.t > 0.35) { // Magnet
        const s = 380 * dt; k.x += (p.x - k.x) / d * Math.min(s, d); k.y += (p.y - k.y) / d * Math.min(s, d);
      }
      if (d < 26 && k.t > 0.3 && !p.dead) {
        if (k.type === 'hp') { healPlayer(R.S.maxHp * BAL.orbHeal); Sound.sfx('orb', 0.1); k.life = 0; burst(k.x, k.y, '#ff5a5a', 12, 130, 0.5, 2.6, -0.1, 16, true); }
        else if (k.type === 'mana') { R.p.mana = Math.min(R.S.maxMana, R.p.mana + R.S.maxMana * 0.25); Sound.sfx('mana', 0.1); k.life = 0; burst(k.x, k.y, '#5aa8ff', 12, 130, 0.5, 2.6, -0.1, 16, true); }
        else if (k.type === 'rune') {
          if (Save.data.runes.length >= 60) { if (!k.warned) { k.warned = true; addText(p.x, p.y, 60, 'Runenbeutel voll!', '#ff8a6a', 16); } }
          else {
            Save.data.runes.push(k.rune); R.runesFound.push(k.rune); k.life = 0;
            Sound.sfx('rune');
            const def = LOS.RUNE_BY_ID[k.rune.id];
            addText(p.x, p.y, 66, `${def.glyph} Rune der ${def.name} (${LOS.TIERS[k.rune.tier].name})`, LOS.TIERS[k.rune.tier].color, 17, 2.4);
            burst(k.x, k.y, LOS.TIERS[k.rune.tier].color, 26, 190, 1.0, 3, -0.1, 18, true);
          }
        }
      }
    }
    R.pickups = R.pickups.filter(k => k.life > 0);
  }

  /* ============================================================ Zauber */
  function unlockedSpells() { return LOS.SPELLS.map(s => Save.data.pts.mag >= s.unlock); }

  function castSpell(i) {
    if (!R || R.over || R.p.dead || i < 0 || i > 4) return;
    const sp = LOS.SPELLS[i], p = R.p, S = R.S;
    if (S.mag < sp.unlock) { if (R.hint <= 0) { addText(p.x, p.y, 60, `${sp.name}: ${sp.unlock} Zauberpunkte nötig`, '#9aa', 14); R.hint = 1; } return; }
    if (R.cd[i] > 0) return;
    if (p.mana < sp.cost) { if (R.hint <= 0) { addText(p.x, p.y, 60, 'Zu wenig Mana', '#6aa8ff', 15); R.hint = 0.8; } return; }
    if (p.blocking) return;
    const wx = Input.wx, wy = Input.wy;
    const power = LOS.spellPower(sp.base, S.mag, S.rb.arcane);
    const dirA = Math.atan2(wy - p.y, wx - p.x);
    const hx = p.x + Math.cos(dirA) * 18, hy = p.y + Math.sin(dirA) * 18;
    let ok = true;
    switch (sp.id) {
      case 'fire': {
        // Erstes Ziel: Gegner nahe am Mauszeiger bzw. in Zielrichtung (mit Sichtlinie); unterwegs sucht der Ball weiter
        let tgt = null, bs = 1e9;
        for (const e of R.enemies) {
          if (e.dead) continue;
          const ea = Math.atan2(e.y - p.y, e.x - p.x), da = Math.abs(angDiff(ea, dirA));
          const dc = hyp(e.x - wx, e.y - wy);
          if (hyp(e.x - p.x, e.y - p.y) > 720 || (dc > 260 && da > 0.5)) continue;
          const sc = dc + da * 200;
          if (sc < bs && R.map.los(p.x, p.y, e.x, e.y)) { bs = sc; tgt = e; }
        }
        R.pproj.push({ x: hx, y: hy, z: 28, vx: Math.cos(dirA) * 520, vy: Math.sin(dirA) * 520, r: 10, life: 1.8, dmg: power, color: sp.color,
          spell: 'fire', homing: true, target: tgt, turn: 6.5, maxSp: 640 });
        burst(hx, hy, sp.color, 12, 160, 0.4, 3, 0, 28, true);
        Sound.sfx('fire'); break;
      }
      case 'nova': {
        R.fx.push({ k: 'ring', x: p.x, y: p.y, z: 3, r0: 10, r1: 220, t: 0, dur: 0.6, color: sp.color });
        R.fx.push({ k: 'frost', x: p.x, y: p.y, r: 220, t: 0, dur: 1.6, color: sp.color, seed: Math.random() * 100 });
        burst(p.x, p.y, sp.color, 40, 320, 0.9, 3, -0.1, 12, true);
        burst(p.x, p.y, '#ffffff', 22, 200, 1.1, 2.4, -0.15, 20, true);
        Sound.sfx('nova'); shake(3);
        for (const e of R.enemies) {
          if (e.dead || hyp(e.x - p.x, e.y - p.y) > 220 + e.r) continue;
          damageEnemy(e, power * rr(0.92, 1.08), { color: sp.color, stun: e.boss ? 0 : 0.5 });
          e.slowT = 3.5; e.slowF = Math.max(e.slowF, 0.6);
        }
        break;
      }
      case 'chain': {
        let first = null, bd = 1e9;
        for (const e of R.enemies) {
          if (e.dead) continue;
          const dp = hyp(e.x - p.x, e.y - p.y); if (dp > 600) continue;
          const dc = hyp(e.x - wx, e.y - wy);
          if (dc < bd && R.map.los(p.x, p.y, e.x, e.y)) { bd = dc; first = e; }
        }
        if (!first) { ok = false; if (R.hint <= 0) { addText(p.x, p.y, 60, 'Kein Ziel in Sicht', '#aab', 14); R.hint = 0.8; } break; }
        const hit = new Set(); let cur = first, from = { x: p.x, y: p.y, z: 34 }, dmg = power;
        for (let n = 0; n < 6 && cur; n++) {
          hit.add(cur);
          const to = { x: cur.x, y: cur.y, z: cur.r * 1.7 };
          R.fx.push({ k: 'bolt', a: from, b: to, t: 0, dur: 0.38, color: sp.color, seed: Math.random() * 100 });
          damageEnemy(cur, dmg * rr(0.92, 1.08), { color: sp.color, stun: 0.3 });
          burst(cur.x, cur.y, sp.color, 10, 190, 0.4, 2.6, 0.3, to.z, true);
          burst(cur.x, cur.y, '#ffffff', 4, 120, 0.25, 2, 0, to.z, true);
          from = to; dmg *= 0.88;
          let nxt = null, nd = 210;
          for (const e of R.enemies) { if (e.dead || hit.has(e)) continue; const dd = hyp(e.x - cur.x, e.y - cur.y); if (dd < nd) { nd = dd; nxt = e; } }
          cur = nxt;
        }
        Sound.sfx('chain'); shake(2);
        break;
      }
      case 'meteor': {
        Sound.sfx('meteor');
        for (let n = 0; n < 5; n++) {
          const a = Math.random() * 6.28, rad = n === 0 ? 0 : rr(40, 150);
          const tx = wx + Math.cos(a) * rad, ty = wy + Math.sin(a) * rad;
          const delay = 0.5 + n * 0.26;
          R.tele.push({ kind: 'circle', x: tx, y: ty, r: 92, t: 0, dur: delay, dmg: 0, friendly: true, fn: () => {
            explode(tx, ty, 92, power * rr(0.92, 1.08), sp.color, { shake: 6 });
            R.fx.push({ k: 'ring', x: tx, y: ty, z: 3, r0: 20, r1: 150, t: 0, dur: 0.5, color: '#ffb060' });
            Sound.sfx('boom', 0.02);
          } });
        }
        break;
      }
      case 'wrath': {
        Sound.sfx('wrath');
        shake(6);
        R.fx.push({ k: 'beam', x: p.x, y: p.y, t: 0, dur: 1.2, color: sp.color, slim: true });
        for (let n = 0; n < 3; n++) {
          R.timers.push({ t: 0.35 + n * 0.6, fn: () => {
            if (!R || R.over) return;
            shake(7);
            R.fx.push({ k: 'ring', x: p.x, y: p.y, z: 4, r0: 20, r1: 640, t: 0, dur: 0.7, color: sp.color });
            for (const e of R.enemies) {
              if (e.dead || hyp(e.x - p.x, e.y - p.y) > 650) continue;
              R.fx.push({ k: 'beam', x: e.x, y: e.y, t: 0, dur: 0.6, color: sp.color });
              damageEnemy(e, power * rr(0.92, 1.08), { color: sp.color, stun: e.boss ? 0 : 0.6 });
              burst(e.x, e.y, sp.color, 14, 220, 0.6, 3, 0.4, 14, true);
            }
          } });
        }
        break;
      }
    }
    if (!ok) return;
    p.mana -= sp.cost; R.cd[i] = sp.cd; R.sel = i; p.castT = 0.32; p.castColor = sp.color; p.castId = (p.castId || 0) + 1;
    p.face = dirA;
    burst(hx, hy, sp.color, 10, 120, 0.4, 2.6, 0, 30, true);
  }

  /* ============================================================ Ende */
  function finish(how) {
    if (R.over) return;
    const quit = how === 'quit';
    if (quit) how = 'dead';
    R.over = how; R.overT = 0;
    const sv = Save.data, p = R.p;
    sv.stats.time += R.time;
    if (quit) {
      Sound.play('none');
    } else if (how === 'dead') {
      sv.stats.deaths++;
      Sound.play('none'); Sound.sfx('stinger_death');
    } else {
      sv.stats.clears++;
      if (sv.diffUnlocked <= R.diff && R.diff < LOS.DIFFS.length - 1) sv.diffUnlocked = R.diff + 1;
      Sound.play('none'); Sound.sfx('stinger_win');
    }
    const newBest = R.bestRoom > sv.bestRoom;
    if (newBest) sv.bestRoom = R.bestRoom;
    R.summary = {
      won: how === 'win', room: R.bestRoom + 1, bestRoom: sv.bestRoom + 1, newBest,
      xp: R.xpGained, kills: R.kills, time: R.time, lvStart: R.lvStart, lvEnd: sv.level,
      runes: R.runesFound.slice(), diff: R.diff, quit,
      unlockedDiff: how === 'win' && sv.diffUnlocked > R.diff ? sv.diffUnlocked : 0,
    };
    Save.write();
    // Timer läuft in Spielzeit; beim Tod ist die Zeit verlangsamt (siehe update) -> 0.5 ≈ 1 s real
    R.timers.push({ t: how === 'win' ? 1.2 : 0.5, fn: () => { if (G.onEnd) G.onEnd(R.summary); } });
  }

  function abandon() {
    if (!R || R.over) return;
    R.p.dead = true; finish('quit');
    R.timers.length = 0; if (G.onEnd) G.onEnd(R.summary);
  }

  /* ============================================================ Hauptupdate */
  function update(dt) {
    if (!R) return;
    dt = Math.min(dt, 1 / 20);
    R.time += dt; R.hint -= dt;
    if (R.hitstop > 0) { R.hitstop -= dt; dt *= 0.08; }
    if (R.over) {
      R.overT += dt;
      dt *= R.over === 'dead' ? Math.max(0.15, 1 - R.overT) : 1;
    }
    if (!R.over || R.over === 'win') updatePlayer(dt);
    updateEnemies(dt);
    updateProjectiles(dt);
    updateTele(dt);
    updatePickups(dt);
    updateFx(dt);
    // Kamera
    const c = R.cam, p = R.p;
    c.x += (p.x - c.x) * Math.min(1, dt * 7); c.y += (p.y - c.y) * Math.min(1, dt * 7);
    c.shake = Math.max(0, c.shake - dt * 22);
    // Musik-Intensität
    let n = 0;
    for (const e of R.enemies) if (!e.dead && e.state === 'awake' && hyp(e.x - p.x, e.y - p.y) < 420) n += e.elite || e.boss ? 3 : 1;
    Sound.setIntensity(R.over ? 0 : Math.min(1, n / 7));
  }

  Object.assign(G, {
    startRun, update, castSpell, abandon, unlockedSpells,
    clear() { R = null; },
    // Debug
    _dbg: { killAll() { for (const e of R.enemies) if (!e.dead && !e.boss) damageEnemy(e, 1e12, { silent: true }); } },
  });
  Object.defineProperty(G, 'R', { get() { return R; } });
  return G;
})();
