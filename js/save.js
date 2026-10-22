/* Lord of Sword – Speicherstand (localStorage) */
const Save = (function () {
  'use strict';
  const KEY = 'lordofsword_save_v1';
  let data = null;

  function fresh() {
    return {
      v: 1, level: 1, xp: 0, unspent: 0,
      pts: { atk: 0, def: 0, vit: 0, mag: 0 },
      runes: [], equipped: [],
      essence: 0, spellUp: {},
      bestRoom: 0, fires: [], startRoom: 0, // fires = Räume mit entzündeter Feuerstelle (Startpunkte)
      difficulty: 0,
      stats: { runs: 0, kills: 0, deaths: 0, clears: 0, time: 0, xp: 0, bossKills: 0 },
      settings: { music: 0.6, sfx: 0.8 },
      created: Date.now(),
    };
  }

  function normalize(d) {
    const f = fresh();
    const o = Object.assign(f, d);
    o.pts = Object.assign(f.pts, d.pts || {});
    o.stats = Object.assign(f.stats, d.stats || {});
    o.settings = Object.assign(f.settings, d.settings || {});
    o.level = Math.max(1, Math.min(LOS.BAL.maxLevel, o.level | 0));
    // Invariante: investierte + freie Punkte = Level - 1
    const spent = o.pts.atk + o.pts.def + o.pts.vit + o.pts.mag;
    o.unspent = Math.max(0, o.level - 1 - spent);
    if (spent > o.level - 1) { o.pts = { atk: 0, def: 0, vit: 0, mag: 0 }; o.unspent = o.level - 1; }
    if (o.level < LOS.BAL.magicUnlockLevel && o.pts.mag > 0) { o.unspent += o.pts.mag; o.pts.mag = 0; }
    // Alte Spielstände: freigeschaltete Zonen werden zu entzündeten Feuerstellen am Zonenanfang
    if (!Array.isArray(d.fires)) {
      o.fires = [];
      for (let z = 1; z <= (d.zoneUnlock | 0); z++) o.fires.push(z * LOS.BAL.roomsPerZone);
      o.startRoom = Math.min(d.startZone | 0, d.zoneUnlock | 0) * LOS.BAL.roomsPerZone;
    }
    o.fires = [...new Set(o.fires.map(n => n | 0).filter(n => n >= 1 && n <= LOS.NUM_ROOMS - 2))].sort((a, b) => a - b);
    o.startRoom = o.fires.includes(o.startRoom | 0) ? o.startRoom | 0 : 0;
    o.difficulty = Math.max(0, Math.min(LOS.DIFFS.length - 1, o.difficulty | 0));
    delete o.zoneUnlock; delete o.startZone; delete o.diffUnlocked;
    if (!o.settings.keys || typeof o.settings.keys !== 'object') delete o.settings.keys;
    o.essence = Math.max(0, Math.floor(+o.essence || 0));
    const up = {};
    for (const s of LOS.SPELLS) up[s.id] = Math.max(0, Math.min(s.up.max, ((d.spellUp || {})[s.id]) | 0));
    o.spellUp = up;
    o.runes = (o.runes || []).filter(r => r && LOS.RUNE_BY_ID[r.id] && r.tier >= 0 && r.tier <= 3);
    o.equipped = (o.equipped || []).map(r => (r && LOS.RUNE_BY_ID[r.id] ? r : null));
    return o;
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      data = raw ? normalize(JSON.parse(raw)) : null;
    } catch (e) { data = null; }
    return data;
  }
  function write() {
    if (!data) return;
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* Speicher voll/gesperrt */ }
  }
  function create() { data = fresh(); write(); return data; }
  function wipe() { try { localStorage.removeItem(KEY); } catch (e) { /* egal */ } data = null; }
  function exportCode() { return btoa(unescape(encodeURIComponent(JSON.stringify(data)))); }
  function importCode(code) {
    const d = JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
    data = normalize(d); write(); return data;
  }

  /** Lesbarer JSON-Export (Datei-Download). */
  function exportJSON() {
    return JSON.stringify({ game: 'lordofsword', version: data.v, exported: new Date().toISOString(), data }, null, 2);
  }
  /** Nimmt JSON (Export-Datei oder rohe Spielstand-Daten) und – als Rückfall – den alten Base64-Code entgegen. */
  function importJSON(text) {
    text = String(text).trim();
    let obj;
    if (text[0] === '{') obj = JSON.parse(text);
    else return importCode(text);
    const d = obj && obj.game === 'lordofsword' ? obj.data : obj;
    if (!d || typeof d !== 'object' || typeof d.level !== 'number' || !d.pts) throw new Error('kein Spielstand');
    data = normalize(d); write(); return data;
  }
  function fileName() {
    const d = new Date(), p = n => String(n).padStart(2, '0');
    return `lordofsword-stufe${data.level}-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}.json`;
  }

  return {
    load, write, create, wipe, exportCode, importCode, exportJSON, importJSON, fileName,
    get data() { return data; },
    get exists() { try { return !!localStorage.getItem(KEY); } catch (e) { return false; } },
  };
})();
