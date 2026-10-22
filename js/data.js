/* Lord of Sword – Spieldaten & Balancing
 * Wird vom Spiel (Browser) und von tools/balance-sim.js (Node) gemeinsam genutzt.
 * Alle Stellschrauben für den Grind stehen in BAL. */
(function (root) {
  'use strict';

  const TILE = 48;
  // Isometrische Kamera: yaw = Drehung um die Hochachse, pitch = Neigung über dem Boden, view = sichtbare Höhe in Welteinheiten
  const CAM = { yaw: Math.PI / 4, pitch: 0.93, view: 450 };

  /* ------------------------------------------------------------ Balancing */
  const BAL = {
    maxLevel: 80,
    xpRate: 1,            // globaler XP-Faktor (kleiner = längerer Grind)
    xpBase: 10, xpPow: 1.45, xpExp: 1.03,
    softCap: 30, lateGrow: 1.09, // ab so vielen Punkten in einem Wert wächst er langsamer
    spellGrow: 1.2,
    magicUnlockLevel: 10, // vorher gibt es keine Zauber
    runeUnlockLevel: 15,
    runeSlotLevels: [15, 30, 45, 60, 75],
    // Spielerwerte

    dmgBase: 9.1, dmgGrow: 1.26,
    hpBase: 100, hpGrow: 1.24, hpLinear: 6,
    hpGainMul: 0.5,        // Faktor auf den Lebenszuwachs über die Basis (1. Punkt: +15 statt +30)
    attackInterval: 0.62,  // Sekunden zwischen zwei Hieben; sinkt langsam mit Angriffspunkten
    aspdPerPt: 0.006, aspdPtMax: 0.5, // +0,6 % Angriffstempo pro Angriffspunkt (max. +50 %)
    armorBase: 4, armorGrow: 1.22, armorK: 100, maxReduction: 0.8,
    moveSpeed: 185,        // Basis-Lauftempo; steigt langsam mit Lebenspunkten
    moveVitPerPt: 0.5, moveVitMax: 15,
    // Rückstoß beim Schwerthieb: startet klein und wächst langsam mit den Angriffspunkten (1 = ca. 1,2 Pixel)
    knockBase: 18, knockPerPt: 1.4, knockMax: 90,
    // Sprint (Shift): Teil des Angriffs-Werts. Am Anfang kurz und mit sehr langer Abklingzeit.
    sprintUnlockLevel: 10, sprintDur: 1.0, sprintDurPerPt: 0.035, sprintDurMax: 2.6,
    sprintCd: 26, sprintCdPerPt: 0.07, sprintCdMin: 5, sprintMul: 1.75, sprintMulPerPt: 0.01, sprintMulMax: 2.3,
    // Schild (Taste Q / K halten): Teil des Verteidigungs-Werts
    shieldUnlockLevel: 5, reflectPerPt: 0.03, reflectMax: 0.5, // Reflexion beim Blocken/Parieren: +3 % je Verteidigungspunkt (max. 50 %)
    blockBase: 0.5, blockMax: 0.9, blockHalf: 25, blockMove: 0.5, parryWindow: 0.18,
    // Blockwinkel (Block, Parade und Reflexion): 180° (Blickrichtung) ohne Verteidigungspunkte, +3° je Verteidigungspunkt, ab 60 Punkten Rundumblock (360°)
    blockArcStart: 180, blockArcPerPt: 3,
    // Optik: Kämpfer wird alle 10 Level aufgewertet; Schwert/Schild je nach Angriffs-/Verteidigungspunkten
    bodyTierEvery: 10,
    gearPts: [0, 5, 12, 22, 35, 52],
    // Drops
    orbChance: 0.045, orbHeal: 0.22, eliteOrbChance: 0.3, eliteOrbChance2: 0.18,
    manaOrbChance: 0.08,
    manaRegenMul: 0.2,   // Faktor auf die Mana-Regeneration pro Sekunde
    // Essenz (Mana-XP): Währung für Zauber-Verbesserungen. Wert je Kugel = (Zone + 1) × Schwierigkeitsfaktor
    essenceChance: 0.015, essenceEliteChance: 0.375, essenceBoss: 5, essenceBossTotal: 6.25,
    spellUpCostGrow: 1.7,
    runeChance: 0.002, runeChanceElite: 0.058,
    eliteChance: 0.07,
    roomsPerZone: 3,
    dungeonSeed: 20240611, // fester Wert = immer dasselbe Verlies mit denselben Gegnern; 0 = zufällig
  };

  /** Exponentielles Wachstum pro Punkt mit Softcap. */
  function grow(g, n) {
    const a = Math.min(n, BAL.softCap), b = Math.max(0, n - BAL.softCap);
    return Math.pow(g, a) * Math.pow(BAL.lateGrow, b);
  }

  /** XP, die nötig ist, um von `level` auf level+1 zu kommen (= 1 Statuspunkt). */
  function xpNeed(level) {
    return Math.round(BAL.xpBase * Math.pow(level, BAL.xpPow) * Math.pow(BAL.xpExp, level));
  }

  /* ------------------------------------------------------------ Schwierigkeit */
  const DIFFS = [
    { name: 'Normal',   hp: 1,    dmg: 1,   xp: 1,   rune: 0, ess: 1 },
    { name: 'Albtraum', hp: 3.6,  dmg: 2.3, xp: 3.4, rune: 1, ess: 2.5 },
    { name: 'Hölle',    hp: 13,   dmg: 5.5, xp: 12,  rune: 2, ess: 6 },
  ];

  /* ------------------------------------------------------------ Zonen & Gegner */
  // Archetypen (Werte für Zone 1, werden mit den Zonen-Multiplikatoren skaliert)
  const ARCH = {
    swarm:  { hp: 16, dmg: 3.5, cd: 1.0, spd: 125, xp: 1.5, r: 9,  ai: 'melee' },
    flyer:  { hp: 12, dmg: 3.5, cd: 0.8, spd: 150, xp: 1.5, r: 8, ai: 'flyer' },
    grunt:  { hp: 32, dmg: 7,  cd: 1.1, spd: 80,  xp: 3,   r: 13, ai: 'melee' },
    ranged: { hp: 24, dmg: 9,  cd: 1.9, spd: 70,  xp: 3.5, r: 12, ai: 'ranged', range: 300 },
    tank:   { hp: 85, dmg: 14, cd: 1.6, spd: 55,  xp: 7,   r: 18, ai: 'melee' },
    necro:  { hp: 40, dmg: 0,  cd: 6,   spd: 60,  xp: 9,   r: 12, ai: 'necro', range: 330 },
  };

  const ZONES = [
    { name: 'Verlassenes Verlies', short: 'Verlies',
      hpM: 2.0, dmgM: 1.9, xpM: 1.0,
      mobs: [['swarm', 'Ratte', 'rat', 4], ['grunt', 'Skelett', 'skeleton', 4], ['flyer', 'Fledermaus', 'bat', 2]],
      floor: ['#3b362f', '#342f29'], wall: ['#25222a', '#17151b'], accent: '#e08a3c', light: 'rgba(255,170,80,', fog: '#0a0807' },
    { name: 'Katakomben', short: 'Katakomben',
      hpM: 2.8, dmgM: 2.3, xpM: 4.0,
      mobs: [['swarm', 'Aasratte', 'rat', 2], ['grunt', 'Skelettkrieger', 'skeleton', 4], ['ranged', 'Skelettschütze', 'archer', 2.5], ['tank', 'Zombie', 'zombie', 2.5]],
      floor: ['#2f332f', '#292c29'], wall: ['#1d2420', '#101512'], accent: '#9ccf7a', light: 'rgba(170,230,140,', fog: '#060907' },
    { name: 'Pilzhöhlen', short: 'Pilzhöhlen',
      hpM: 5.0, dmgM: 3.4, xpM: 11.0,
      mobs: [['swarm', 'Giftspinne', 'spider', 4], ['grunt', 'Pilzkrieger', 'shroom', 3.5], ['ranged', 'Sporenspucker', 'spitter', 2.5], ['tank', 'Schleimbestie', 'slime', 3]],
      floor: ['#2d2a38', '#26232f'], wall: ['#1a1726', '#0f0d17'], accent: '#b072ff', light: 'rgba(190,130,255,', fog: '#07050c' },
    { name: 'Kristallgrotte', short: 'Kristallgrotte',
      hpM: 6.8, dmgM: 4.0, xpM: 24.0,
      mobs: [['flyer', 'Kristallfledermaus', 'cbat', 3], ['grunt', 'Steinwächter', 'guard', 3.5], ['ranged', 'Kristallmagier', 'mage', 3], ['tank', 'Golem', 'golem', 2.5]],
      floor: ['#243342', '#1f2c3a'], wall: ['#142030', '#0a121c'], accent: '#5ed0ff', light: 'rgba(110,210,255,', fog: '#04080d' },
    { name: 'Blutthron', short: 'Blutthron',
      hpM: 11.0, dmgM: 5.4, xpM: 55.0,
      mobs: [['flyer', 'Imp', 'imp', 3.5], ['grunt', 'Todesritter', 'dknight', 3.5], ['necro', 'Nekromant', 'necro', 1.6], ['tank', 'Dämon', 'demon', 2.5]],
      floor: ['#3a2427', '#321e21'], wall: ['#2a1115', '#16090b'], accent: '#ff4a3a', light: 'rgba(255,80,60,', fog: '#0c0405' },
  ];

  const BOSS = {
    name: 'Malgorath, der Knochenfürst', hp: 9000, dmg: 40, cd: 1.4, spd: 70, xp: 9000, r: 34,
  };

  const NUM_ROOMS = ZONES.length * BAL.roomsPerZone; // letzter Raum = Boss

  /** Anzahl Standardgegner in Raum i (0-basiert). */
  function roomEnemyCount(i) {
    const z = Math.floor(i / BAL.roomsPerZone), k = i % BAL.roomsPerZone;
    return 8 + 2 * z + k;
  }

  function pickMob(zone, rnd) {
    const z = ZONES[zone];
    let tot = 0;
    for (const m of z.mobs) tot += m[3];
    let r = rnd() * tot;
    for (const m of z.mobs) { r -= m[3]; if (r <= 0) return m; }
    return z.mobs[0];
  }

  /** Fertige Werte eines Gegners in Zone `zone`, Archetyp `arch`, Schwierigkeit `diff`. */
  function enemyStats(zone, arch, diff) {
    const a = ARCH[arch], z = ZONES[zone], d = DIFFS[diff || 0];
    return {
      hp: a.hp * z.hpM * d.hp,
      dmg: a.dmg * z.dmgM * d.dmg,
      cd: a.cd, spd: a.spd, r: a.r, ai: a.ai, range: a.range || 0,
      xp: a.xp * z.xpM * d.xp,
    };
  }

  /* ------------------------------------------------------------ Runen */
  const TIERS = [
    { name: 'Gewöhnlich', color: '#c9c3b6' },
    { name: 'Selten',     color: '#5fb0ff' },
    { name: 'Episch',     color: '#c27cff' },
    { name: 'Legendär',   color: '#ffa73a' },
  ];
  // key = Eintrag im Bonus-Objekt, vals = Wert je Stufe
  const RUNES = [
    { id: 'kraft',   name: 'Kraft',      glyph: 'ᚦ', key: 'dmg',    vals: [8, 15, 25, 40],     fmt: v => `+${v}% Schwertschaden` },
    { id: 'sturm',   name: 'Sturm',      glyph: 'ᛊ', key: 'aspd',   vals: [8, 14, 22, 35],     fmt: v => `+${v}% Angriffstempo` },
    { id: 'eile',    name: 'Eile',       glyph: 'ᚱ', key: 'move',   vals: [6, 10, 15, 22],     fmt: v => `+${v}% Lauftempo` },
    { id: 'stein',   name: 'Stein',      glyph: 'ᚨ', key: 'dr',     vals: [4, 8, 12, 18],      fmt: v => `-${v}% erlittener Schaden` },
    { id: 'leben',   name: 'Leben',      glyph: 'ᛟ', key: 'hp',     vals: [6, 12, 20, 32],     fmt: v => `+${v}% maximale Leben` },
    { id: 'blut',    name: 'Blut',       glyph: 'ᛒ', key: 'steal',  vals: [2, 4, 7, 11],       fmt: v => `${v}% Lebensraub` },
    { id: 'regen',   name: 'Erneuerung', glyph: 'ᛉ', key: 'regen',  vals: [0.3, 0.6, 1.0, 1.7], fmt: v => `${v}% Leben pro Sekunde` },
    { id: 'flamme',  name: 'Flamme',     glyph: 'ᚲ', key: 'burn',   vals: [25, 45, 75, 120],   fmt: v => `Treffer brennen: ${v}% Schaden über 3s` },
    { id: 'frost',   name: 'Frost',      glyph: 'ᛁ', key: 'slow',   vals: [15, 25, 35, 50],    fmt: v => `Treffer verlangsamen um ${v}%` },
    { id: 'dornen',  name: 'Dornen',     glyph: 'ᛈ', key: 'thorns', vals: [30, 60, 100, 170],  fmt: v => `${v}% des erlittenen Schadens zurück` },
    { id: 'wirbel',  name: 'Wirbel',     glyph: 'ᛞ', key: 'wide',   vals: [12, 22, 32, 48],    fmt: v => `+${v}% Reichweite & Schwungbreite` },
    { id: 'krit',    name: 'Schärfe',    glyph: 'ᛇ', key: 'crit',   vals: [4, 8, 13, 20],      fmt: v => `+${v}% kritische Treffer` },
    { id: 'weisheit',name: 'Weisheit',   glyph: 'ᚹ', key: 'xp',     vals: [6, 11, 18, 28],     fmt: v => `+${v}% Erfahrung` },
    { id: 'arkan',   name: 'Arkan',      glyph: 'ᛗ', key: 'arcane', vals: [10, 20, 35, 55],    fmt: v => `+${v}% Zauberschaden & Manaregeneration` },
    { id: 'glueck',  name: 'Glück',      glyph: 'ᚷ', key: 'find',   vals: [10, 20, 35, 60],    fmt: v => `+${v}% Fundchance (Runen & Kugeln)` },
  ];
  const RUNE_BY_ID = {};
  RUNES.forEach(r => (RUNE_BY_ID[r.id] = r));

  /** Rune = { id, tier } */
  function runeValue(rune) { return RUNE_BY_ID[rune.id].vals[rune.tier]; }
  function runeText(rune) { const d = RUNE_BY_ID[rune.id]; return d.fmt(d.vals[rune.tier]); }

  function runeSlots(level) {
    let n = 0;
    for (const l of BAL.runeSlotLevels) if (level >= l) n++;
    return n;
  }

  /** Tier-Wurf. zone 0..4, diff 0..2, quality: 0 normal, 1 elite, 2 boss */
  function rollRuneTier(zone, diff, quality, rnd) {
    const shift = zone * 0.12 + diff * 0.45 + quality * 0.5;
    const r = rnd() - shift * 0.12;
    const w = r * 1; // kleiner = besser
    if (w < 0.015) return 3;
    if (w < 0.10) return 2;
    if (w < 0.38) return 1;
    return 0;
  }

  /* ------------------------------------------------------------ Zauber */
  // unlock = nötige investierte Zauber-Punkte
  // up = Verbesserung mit Essenz: max Stufen, Grundkosten, fx(l) = Wirkung auf Stufe l, text(l) = Beschreibung
  const SPELLS = [
    { id: 'fire',   name: 'Feuerball',    key: '1', unlock: 1,  cost: 14, cd: 0.8, base: 22,  color: '#ff8a2a',
      desc: 'Ein zielsuchender Feuerball, der am Ziel explodiert.',
      up: { label: 'Mehr Feuerbälle', max: 6, cost: 15, fx: l => ({ count: 1 + l, cd: 3.2 + 1.8 * l }), text: l => `${1 + l} ${l ? 'Feuerbälle' : 'Feuerball'} pro Wurf, Abklingzeit ${(3.2 + 1.8 * l).toLocaleString('de-DE', { maximumFractionDigits: 2 })} s` } },
    { id: 'nova',   name: 'Frostnova',    key: '2', unlock: 6,  cost: 32, cd: 3.5, base: 34,  color: '#79d6ff',
      desc: 'Eisring um dich: verlangsamt alle Gegner in der Nähe stark, richtet aber keinen Schaden an.',
      up: { label: 'Längere Vereisung', max: 6, cost: 20, fx: l => ({ slowT: 3.5 + l }), text: l => `Verlangsamung ${(3.5 + l).toLocaleString('de-DE')} s` } },
    { id: 'chain',  name: 'Kettenblitz',  key: '3', unlock: 14, cost: 28, cd: 1.6, base: 46,  color: '#c9b8ff',
      desc: 'Springt von Gegner zu Gegner über.',
      up: { label: 'Mehr Sprünge', max: 6, cost: 25, fx: l => ({ jumps: 6 + 2 * l }), text: l => `Trifft bis zu ${6 + 2 * l} Gegner` } },
    { id: 'meteor', name: 'Meteorsturm',  key: '4', unlock: 26, cost: 60, cd: 9,   base: 100, color: '#ff5a1f',
      desc: 'Meteore schlagen rund um den Mauszeiger ein.',
      up: { label: 'Mehr Meteore', max: 6, cost: 40, fx: l => ({ count: 5 + l }), text: l => `${5 + l} Meteore` } },
    { id: 'wrath',  name: 'Götterzorn',   key: '5', unlock: 42, cost: 110, cd: 22, base: 260, color: '#ffe27a',
      desc: 'Vernichtende Lichtwellen reißen den ganzen Raum auseinander.',
      up: { label: 'Mehr Lichtwellen', max: 5, cost: 60, fx: l => ({ waves: 3 + l }), text: l => `${3 + l} Lichtwellen` } },
  ];
  /** Essenz-Kosten für die nächste Stufe (lvl = aktuelle Stufe) oder null bei Maximum */
  function spellUpCost(sp, lvl) { return lvl >= sp.up.max ? null : Math.round(sp.up.cost * Math.pow(BAL.spellUpCostGrow, lvl)); }
  function spellPower(base, mag, arcane) {
    return base * grow(BAL.spellGrow, mag) * (1 + (arcane || 0) / 100);
  }

  /* ------------------------------------------------------------ Spielerwerte */
  /** pts = {atk,def,vit,mag}; runes = Liste ausgerüsteter Runen */
  function runeBonus(runes) {
    const b = { dmg: 0, aspd: 0, move: 0, dr: 0, hp: 0, steal: 0, regen: 0, burn: 0, slow: 0,
      thorns: 0, wide: 0, crit: 0, xp: 0, arcane: 0, find: 0 };
    for (const r of runes || []) if (r) b[RUNE_BY_ID[r.id].key] += runeValue(r);
    return b;
  }

  /* ------------------------------------------------------------ Ausrüstung (nur aufrüstbar, nicht tauschbar) */
  const GEAR = {
    sword:  ['Rostiges Schwert', 'Eisenschwert', 'Stahlklinge', 'Silberklinge', 'Runenklinge', 'Himmelsklinge'],
    shield: ['Holzschild', 'Eisenschild', 'Stahlschild', 'Wappenschild', 'Runenschild', 'Drachenschild'],
    body:   ['Rekrut', 'Soldat', 'Veteran', 'Ritter', 'Hauptmann', 'Paladin', 'Champion', 'Lord', 'Held der Tiefe'],
  };
  /** Stufe (0..5) einer Ausrüstung anhand der investierten Punkte (Angriff -> Schwert, Verteidigung -> Schild) */
  function gearTier(points) {
    let t = 0;
    for (let i = 0; i < BAL.gearPts.length; i++) if (points >= BAL.gearPts[i]) t = i;
    return t;
  }
  /** Rüstungsstufe (0..8) des Kämpfers: alle 10 Level eine neue Optik */
  function bodyTier(level) { return Math.min(GEAR.body.length - 1, Math.floor(level / BAL.bodyTierEvery)); }
  /** Nächste Schwelle für die Ausrüstung oder null */
  function gearNext(points) { const t = gearTier(points); return t + 1 < BAL.gearPts.length ? BAL.gearPts[t + 1] : null; }

  function derive(level, pts, runes) {
    const rb = runeBonus(runes);
    const rawDmg = BAL.dmgBase * grow(BAL.dmgGrow, pts.atk);
    const dmg = rawDmg * (1 + rb.dmg / 100);
    const interval = BAL.attackInterval / (1 + rb.aspd / 100 + Math.min(BAL.aspdPtMax, BAL.aspdPerPt * pts.atk));
    const critCh = 0.05 + rb.crit / 100;
    const armor = BAL.armorBase * grow(BAL.armorGrow, pts.def);
    const red = Math.min(BAL.maxReduction, armor / (armor + BAL.armorK));
    const dr = Math.min(0.9, 1 - (1 - red) * (1 - rb.dr / 100));
    const hpRaw = BAL.hpBase * grow(BAL.hpGrow, pts.vit) + BAL.hpLinear * pts.vit;
    const hp = (BAL.hpBase + (hpRaw - BAL.hpBase) * BAL.hpGainMul) * (1 + rb.hp / 100);
    const mag = pts.mag;
    const sprint = level >= BAL.sprintUnlockLevel ? {
      dur: Math.min(BAL.sprintDurMax, BAL.sprintDur + BAL.sprintDurPerPt * pts.atk),
      cd: Math.max(BAL.sprintCdMin, BAL.sprintCd / (1 + BAL.sprintCdPerPt * pts.atk)),
      mul: Math.min(BAL.sprintMulMax, BAL.sprintMul + BAL.sprintMulPerPt * pts.atk),
    } : null;
    const block = level >= BAL.shieldUnlockLevel ? {
      red: Math.min(BAL.blockMax, BAL.blockBase + (BAL.blockMax - BAL.blockBase) * pts.def / (pts.def + BAL.blockHalf)),
      move: BAL.blockMove, parry: BAL.parryWindow, reflect: Math.min(BAL.reflectMax, BAL.reflectPerPt * pts.def),
      arc: Math.min(360, BAL.blockArcStart + BAL.blockArcPerPt * pts.def), // Grad
    } : null;
    const maxMana = mag > 0 ? 30 + 5 * mag : 0;
    const manaRegen = mag > 0 ? (2 + 0.35 * mag) * (1 + rb.arcane / 100) * BAL.manaRegenMul : 0;
    return {
      level, pts, rb, dmg, interval, critCh, critMul: 1.6, armor, red, dr, maxHp: hp, sprint, block,
      mag, maxMana, manaRegen,
      dps: dmg * (1 + critCh * 0.6) / interval,
      move: (BAL.moveSpeed + Math.min(BAL.moveVitMax, BAL.moveVitPerPt * pts.vit)) * (1 + rb.move / 100),
      reach: 62 * (1 + rb.wide / 100),
      arc: 1.9 * (1 + rb.wide / 150),
      xpMul: 1 + rb.xp / 100,
      knock: Math.min(BAL.knockMax, BAL.knockBase + BAL.knockPerPt * pts.atk),
    };
  }

  const api = {
    TILE, CAM, BAL, xpNeed, GEAR, gearTier, gearNext, bodyTier, DIFFS, ARCH, ZONES, BOSS, NUM_ROOMS, roomEnemyCount, pickMob, enemyStats,
    TIERS, RUNES, RUNE_BY_ID, runeValue, runeText, runeSlots, rollRuneTier,
    SPELLS, spellPower, spellUpCost, runeBonus, derive,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LOS = api;
})(typeof window !== 'undefined' ? window : globalThis);
