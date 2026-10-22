/* Lord of Sword – HUD (2D-Overlay über der 3D-Szene): Orbs, Leisten, Minikarte, Zahlen, Banner */
const Hud = (function () {
  'use strict';
  const T = LOS.TILE, W = 1280, H = 720, ZONES = LOS.ZONES, TAU = Math.PI * 2;
  const FONT = '"Cinzel", "Palatino Linotype", Georgia, serif';
  let mini, miniX, miniT = 0;

  function init() { mini = document.createElement('canvas'); miniX = mini.getContext('2d'); }

  function text(c, s, x, y, size, col, align, weight, stroke) {
    c.font = `${weight || 'bold'} ${size}px ${FONT}`; c.textAlign = align || 'center'; c.textBaseline = 'middle';
    if (stroke !== false) { c.lineWidth = Math.max(2, size / 6); c.strokeStyle = 'rgba(0,0,0,0.85)'; c.lineJoin = 'round'; c.strokeText(s, x, y); }
    c.fillStyle = col; c.fillText(s, x, y);
  }
  /** Text in Zeilen bis maxW umbrechen */
  function wrap(c, s, size, maxW, weight) {
    c.font = `${weight || 'bold'} ${size}px ${FONT}`;
    const lines = []; let cur = '';
    for (const w of String(s).split(' ')) {
      const t = cur ? cur + ' ' + w : w;
      if (cur && c.measureText(t).width > maxW) { lines.push(cur); cur = w; } else cur = t;
    }
    if (cur) lines.push(cur);
    return lines;
  }
  function circ(c, x, y, r, col) { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
  function rrect(c, x, y, w, h, r, col) { c.fillStyle = col; c.beginPath(); c.roundRect(x, y, w, h, r); c.fill(); }

  function orb(c, x, y, r, frac, cols, now, label, locked) {
    c.save();
    c.beginPath(); c.arc(x, y, r, 0, TAU); c.clip();
    c.fillStyle = '#0b090c'; c.fillRect(x - r, y - r, r * 2, r * 2);
    if (!locked && frac > 0) {
      const top = y + r - frac * r * 2;
      const g = c.createLinearGradient(0, top, 0, y + r); g.addColorStop(0, cols[0]); g.addColorStop(0.5, cols[1]); g.addColorStop(1, cols[2]);
      c.fillStyle = g; c.beginPath(); c.moveTo(x - r, y + r);
      for (let i = 0; i <= 24; i++) { const px = x - r + (i / 24) * r * 2; c.lineTo(px, top + Math.sin(now * 3 + i * 0.5) * 2.2); }
      c.lineTo(x + r, y + r); c.fill();
    }
    const hg = c.createRadialGradient(x - r * 0.35, y - r * 0.45, 2, x - r * 0.35, y - r * 0.45, r * 0.8); hg.addColorStop(0, 'rgba(255,255,255,0.28)'); hg.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = hg; c.fillRect(x - r, y - r, r * 2, r * 2);
    c.restore();
    c.lineWidth = 6; c.strokeStyle = '#3a2d1a'; c.beginPath(); c.arc(x, y, r + 1, 0, TAU); c.stroke();
    c.lineWidth = 2; c.strokeStyle = '#c9a24a'; c.beginPath(); c.arc(x, y, r + 3.5, 0, TAU); c.stroke();
    c.strokeStyle = '#6a5224'; c.beginPath(); c.arc(x, y, r - 1.5, 0, TAU); c.stroke();
    if (label) text(c, label, x, y + 2, 15, '#f4efe4', 'center', 'bold');
  }

  const ICON = {
    fire(c, x, y, col) { c.fillStyle = col; c.beginPath(); c.moveTo(x, y - 17); c.quadraticCurveTo(x + 14, y - 2, x + 8, y + 10); c.quadraticCurveTo(x, y + 16, x - 8, y + 10); c.quadraticCurveTo(x - 14, y - 2, x, y - 17); c.fill(); c.fillStyle = '#fff2b0'; c.beginPath(); c.ellipse(x, y + 6, 4, 7, 0, 0, TAU); c.fill(); },
    nova(c, x, y, col) { c.strokeStyle = col; c.lineWidth = 2.5; c.lineCap = 'round'; for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3; c.beginPath(); c.moveTo(x + Math.cos(a) * 16, y + Math.sin(a) * 16); c.lineTo(x - Math.cos(a) * 16, y - Math.sin(a) * 16); c.stroke(); } c.beginPath(); c.arc(x, y, 8, 0, TAU); c.stroke(); },
    chain(c, x, y, col) { c.strokeStyle = col; c.lineWidth = 3.5; c.lineJoin = 'round'; c.beginPath(); c.moveTo(x + 4, y - 17); c.lineTo(x - 7, y + 1); c.lineTo(x + 2, y + 1); c.lineTo(x - 5, y + 17); c.lineTo(x + 9, y - 4); c.lineTo(x, y - 4); c.closePath(); c.fillStyle = col; c.fill(); },
    meteor(c, x, y, col) { c.strokeStyle = col; c.lineWidth = 6; c.lineCap = 'round'; c.beginPath(); c.moveTo(x - 14, y - 14); c.lineTo(x - 2, y - 2); c.stroke(); circ(c, x + 4, y + 4, 10, '#6b3b22'); circ(c, x + 4, y + 4, 6, col); },
    wrath(c, x, y, col) { c.fillStyle = col; c.beginPath(); for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8 - Math.PI / 2, rad = i % 2 ? 6 : 17; c.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); } c.closePath(); c.fill(); },
    sword(c, x, y, col) { c.save(); c.translate(x, y); c.rotate(-0.78); c.fillStyle = col; c.beginPath(); c.moveTo(0, -18); c.lineTo(4, -4); c.lineTo(4, 8); c.lineTo(-4, 8); c.lineTo(-4, -4); c.closePath(); c.fill(); c.fillStyle = '#d9b94a'; c.fillRect(-9, 8, 18, 4); c.fillStyle = '#7a1218'; c.fillRect(-2.5, 12, 5, 8); c.restore(); },
    shield(c, x, y, col) { c.fillStyle = col; c.beginPath(); c.moveTo(x - 14, y - 15); c.lineTo(x + 14, y - 15); c.lineTo(x + 14, y); c.quadraticCurveTo(x + 12, y + 12, x, y + 19); c.quadraticCurveTo(x - 12, y + 12, x - 14, y); c.closePath(); c.fill(); c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 2; c.beginPath(); c.moveTo(x, y - 15); c.lineTo(x, y + 19); c.moveTo(x - 14, y - 3); c.lineTo(x + 14, y - 3); c.stroke(); },
    sprint(c, x, y, col) { c.strokeStyle = col; c.lineWidth = 3.4; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); c.moveTo(x - 6, y - 14); c.lineTo(x + 8, y - 4); c.lineTo(x - 2, y + 2); c.lineTo(x + 10, y + 14); c.stroke(); c.lineWidth = 2; for (const [a, b, l] of [[-16, -4, 9], [-18, 3, 12], [-14, 10, 8]]) { c.beginPath(); c.moveTo(x + a, y + b); c.lineTo(x + a + l, y + b); c.stroke(); } },
  };

  function slot(c, x, y, icon, col, label, opts) {
    const un = opts.unlocked, sz = 62;
    rrect(c, x, y, sz, sz, 8, 'rgba(14,11,10,0.9)');
    c.strokeStyle = opts.active ? '#ffe08a' : '#6a5224'; c.lineWidth = opts.active ? 3 : 2; c.beginPath(); c.roundRect(x, y, sz, sz, 8); c.stroke();
    if (un) {
      ICON[icon](c, x + 31, y + 31, col);
      if (opts.cdf > 0) { c.save(); c.beginPath(); c.roundRect(x + 1, y + 1, sz - 2, sz - 2, 7); c.clip(); c.fillStyle = 'rgba(0,0,0,0.65)'; c.beginPath(); c.moveTo(x + 31, y + 31); c.arc(x + 31, y + 31, 46, -Math.PI / 2, -Math.PI / 2 + TAU * opts.cdf); c.closePath(); c.fill(); c.restore(); }
      if (opts.cdText) text(c, opts.cdText, x + 31, y + 31, 17, '#fff', 'center', 'bold');
    } else {
      ICON[icon](c, x + 31, y + 31, '#3b3733');
      c.fillStyle = 'rgba(8,7,8,0.55)'; c.beginPath(); c.roundRect(x + 1, y + 1, sz - 2, sz - 2, 7); c.fill();
      text(c, 'Level', x + 31, y + 25, 11, '#a99f8a', 'center', 'bold'); text(c, String(opts.lockLevel), x + 31, y + 41, 17, '#c9bd9c', 'center', 'bold');
    }
    text(c, label, x + 31, y + 9, 11, '#d9cba0', 'center', 'bold');
  }

  /** Kurzer Tastenname einer Aktion für die Leiste */
  function kl(id) {
    const code = Keys.slots(id).find(Boolean);
    return !code ? '–' : code === 'Space' ? 'Space' : /^Shift/.test(code) ? 'Shift' : /^Mouse/.test(code) ? ['Maus L', 'Maus M', 'Maus R'][+code[5]] || 'Maus' : Keys.label(code);
  }

  function drawBars(c, R, now) {
    const S = R.S, p = R.p, sv = Save.data;
    // Orbs
    orb(c, 104, 618, 70, p.hp / S.maxHp, ['#ff7a7a', '#d61f2a', '#5a0a10'], now, `${Math.ceil(p.hp)} / ${Math.round(S.maxHp)}`);
    // Mana-Kugel erst, wenn die Magie freigeschaltet ist
    if (sv.level >= LOS.BAL.magicUnlockLevel) {
      const hasMana = S.maxMana > 0;
      orb(c, W - 104, 618, 70, hasMana ? p.mana / S.maxMana : 0, ['#9fd0ff', '#2f7fe8', '#0f2f6a'], now, hasMana ? `${Math.floor(p.mana)} / ${Math.round(S.maxMana)}` : '', !hasMana);
      if (!hasMana) {
        c.fillStyle = 'rgba(10,8,12,0.55)'; c.beginPath(); c.arc(W - 104, 618, 69, 0, TAU); c.fill();
        text(c, 'Keine', W - 104, 604, 14, '#8d96ad', 'center', 'bold'); text(c, 'Zauberpunkte', W - 104, 624, 14, '#8d96ad', 'center', 'bold');
      }
    }
    // Kampf-Leiste: Hieb, dazu Schild und Sprint, sobald freigeschaltet
    const ax = 204, ay = 640;
    const swingCd = Math.max(0, p.atkCd) / S.interval;
    let ix = ax;
    slot(c, ix, ay, 'sword', '#e8ecf4', kl('attack'), { unlocked: true, cdf: swingCd, active: p.swingT >= 0 });
    if (S.block) { ix += 68; slot(c, ix, ay, 'shield', '#aab4c8', kl('block'), { unlocked: true, active: p.blocking }); }
    const spr = S.sprint;
    if (spr) {
      ix += 68;
      slot(c, ix, ay, 'sprint', '#9fe0ff', kl('sprint'), { unlocked: true, active: p.sprinting,
        cdf: p.sprinting ? 0 : Math.min(1, p.sprintCd / spr.cd), cdText: !p.sprinting && p.sprintCd > 0 ? String(Math.ceil(p.sprintCd)) : '' });
      if (p.sprinting) rrect(c, ix + 2, ay + 52, 58 * Math.max(0, p.sprintT / spr.dur), 5, 2, '#9fe0ff');
    }
    // Zauberleiste: nur freigeschaltete Zauber, mittig
    const open = [];
    for (let i = 0; i < 5; i++) if (S.mag >= LOS.SPELLS[i].unlock) open.push(i);
    const by = 640, bx = W / 2 - (open.length * 68 - 6) / 2;
    open.forEach((i, n) => {
      const sp = LOS.SPELLS[i], x = bx + n * 68;
      slot(c, x, by, sp.id, sp.color, kl('spell' + (i + 1)), { unlocked: true, active: R.sel === i, cdf: R.cd[i] > 0 ? R.cd[i] / sp.cd : 0 });
      if (p.mana < sp.cost) { c.fillStyle = 'rgba(20,40,90,0.55)'; c.beginPath(); c.roundRect(x + 1, by + 1, 60, 60, 7); c.fill(); }
      text(c, String(sp.cost), x + 51, by + 52, 12, '#9fd0ff', 'center', 'bold');
    });
    // XP-Leiste
    const need = sv.level >= LOS.BAL.maxLevel ? 1 : LOS.xpNeed(sv.level), frac = sv.level >= LOS.BAL.maxLevel ? 1 : sv.xp / need;
    const xw = 520, xx = W / 2 - xw / 2, xy = 710;
    c.fillStyle = 'rgba(0,0,0,0.75)'; c.fillRect(xx - 2, xy - 2, xw + 4, 10);
    const xg = c.createLinearGradient(xx, 0, xx + xw, 0); xg.addColorStop(0, '#6a3ab8'); xg.addColorStop(1, '#b07aff');
    c.fillStyle = xg; c.fillRect(xx, xy, xw * frac, 6);
    c.strokeStyle = '#6a5224'; c.lineWidth = 1; c.strokeRect(xx - 2.5, xy - 2.5, xw + 5, 11);
    text(c, `Level ${sv.level}  ·  ${Math.floor(sv.xp)} / ${need} XP`, W / 2, xy - 12, 12, '#d9c8ff', 'center', 'bold');
  }

  function drawInfo(c, R, now) {
    const sv = Save.data;
    const room = R.map.rooms[R.room], z = ZONES[room.zone];
    text(c, z.name, 24, 28, 20, z.accent, 'left', 'bold');
    text(c, `Raum ${R.room + 1} / ${LOS.NUM_ROOMS}  ·  ${LOS.DIFFS[R.diff].name}`, 24, 52, 14, '#cbbf9c', 'left', 'normal');
    text(c, `Besiegt ${R.kills}   ·   +${Math.floor(R.xpGained)} XP` + (R.essGained ? `   ·   +${R.essGained} Essenz` : ''), 24, 72, 14, '#cbbf9c', 'left', 'normal');
    if (R.prompt) text(c, R.prompt, W / 2, 590, 20, '#ffe08a', 'center', 'bold');
    if (sv.unspent > 0) text(c, `${sv.unspent} Statuspunkt${sv.unspent > 1 ? 'e' : ''} verfügbar`, 24, 94, 14, '#ffe08a', 'left', 'bold');
    if (R.boss && R.bossActive && !R.boss.dead) {
      const b = R.boss, bw = 640, bxx = W / 2 - bw / 2, byy = 36;
      text(c, b.name, W / 2, byy - 14, 20, '#ff8a6a', 'center', 'bold');
      c.fillStyle = 'rgba(0,0,0,0.8)'; c.fillRect(bxx - 3, byy - 3, bw + 6, 20);
      const bg = c.createLinearGradient(0, byy, 0, byy + 14); bg.addColorStop(0, '#d62a2a'); bg.addColorStop(1, '#6a0f12');
      c.fillStyle = bg; c.fillRect(bxx, byy, bw * Math.max(0, b.hp / b.maxHp), 14);
      c.strokeStyle = '#c9a24a'; c.lineWidth = 2; c.strokeRect(bxx - 3, byy - 3, bw + 6, 20);
    }
    drawMinimap(c, R, now);
    if (R.banner) {
      const b = R.banner, k = b.t / b.life, a = k < 0.12 ? k / 0.12 : k > 0.8 ? (1 - k) / 0.2 : 1;
      c.globalAlpha = Math.max(0, a);
      const yb = 168, maxW = 1000;
      // Titel passt sich der Breite an, der Untertitel wird umgebrochen (nie breiter als der Bildschirm)
      c.font = `bold 38px ${FONT}`;
      const tsize = Math.min(38, Math.floor(38 * maxW / Math.max(1, c.measureText(b.title).width)));
      const lines = b.sub ? wrap(c, b.sub, 17, maxW, 'normal') : [];
      const hh = 90 + Math.max(0, lines.length - 1) * 22;
      const g = c.createLinearGradient(W / 2 - 520, 0, W / 2 + 520, 0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, 'rgba(0,0,0,0.6)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.fillRect(W / 2 - 520, yb - 38, 1040, hh);
      text(c, b.title, W / 2, yb, tsize, b.color, 'center', 'bold');
      lines.forEach((ln, i) => text(c, ln, W / 2, yb + 36 + i * 22, 17, '#e6dcc0', 'center', 'normal'));
      c.globalAlpha = 1;
    }
    if (R.over === 'dead') {
      const k = Math.min(1, R.overT / 0.7);
      c.fillStyle = `rgba(30,0,0,${0.55 * k})`; c.fillRect(0, 0, W, H);
      c.globalAlpha = k; text(c, 'Du bist gefallen', W / 2, H / 2 - 20, 60, '#b3151b', 'center', 'bold'); c.globalAlpha = 1;
    }
    if (R.over === 'win') { const k = Math.min(1, R.overT / 1.0); c.fillStyle = `rgba(255,240,200,${0.18 * k})`; c.fillRect(0, 0, W, H); c.globalAlpha = k; text(c, 'Sieg!', W / 2, H / 2 - 20, 70, '#ffe08a', 'center', 'bold'); c.globalAlpha = 1; }
  }

  function drawMinimap(c, R, now) {
    const map = R.map;
    if (mini.width !== map.w) { mini.width = map.w; mini.height = map.h; miniT = 0; }
    if (now - miniT > 0.3) {
      miniT = now;
      const img = miniX.createImageData(map.w, map.h), d = img.data;
      for (let i = 0; i < map.explored.length; i++) if (map.explored[i]) {
        const rm = map.roomAt[i]; const col = rm >= 0 ? (map.rooms[rm].boss ? [150, 60, 50] : [112, 104, 86]) : [86, 80, 66];
        d[i * 4] = col[0]; d[i * 4 + 1] = col[1]; d[i * 4 + 2] = col[2]; d[i * 4 + 3] = 235;
      }
      miniX.putImageData(img, 0, 0);
    }
    const s = 1.7, mw = map.w * s, mh = map.h * s, mx = W - mw - 14, my = 14;
    c.fillStyle = 'rgba(8,6,6,0.55)'; c.fillRect(mx - 3, my - 3, mw + 6, mh + 6);
    c.strokeStyle = '#6a5224'; c.lineWidth = 1.5; c.strokeRect(mx - 3, my - 3, mw + 6, mh + 6);
    c.imageSmoothingEnabled = false; c.drawImage(mini, mx, my, mw, mh); c.imageSmoothingEnabled = true;
    const px = mx + R.p.x / T * s, py = my + R.p.y / T * s;
    c.fillStyle = `rgba(255,${200 + 55 * Math.sin(now * 6) | 0},80,1)`; c.beginPath(); c.arc(px, py, 3, 0, TAU); c.fill();
    if (R.boss && !R.boss.dead && map.rooms[map.rooms.length - 1].entered) { c.fillStyle = '#ff4a3a'; c.beginPath(); c.arc(mx + R.boss.x / T * s, my + R.boss.y / T * s, 3, 0, TAU); c.fill(); }
  }

  /** Lebensbalken, Namen und schwebende Zahlen (proj: Weltpunkt -> Bildschirm) */
  function drawWorldOverlay(c, R, now, proj, hover) {
    const p = R.p;
    for (const e of R.enemies) {
      if (e.dead || e.boss) continue;
      const show = e.state === 'awake' && (e.hp < e.maxHp || e.elite) || e === hover;
      if (!show) continue;
      const s = proj(e.x, e.r * 3.7 + 8, e.y);
      if (s.x < -60 || s.x > W + 60 || s.y < -40 || s.y > H + 40) continue;
      const w = Math.max(34, e.r * 2.8), yy = s.y;
      c.fillStyle = 'rgba(0,0,0,0.75)'; c.fillRect(s.x - w / 2 - 1, yy - 1, w + 2, 7);
      c.fillStyle = e.elite ? e.tint : '#b3262c'; c.fillRect(s.x - w / 2, yy, w * Math.max(0, e.hp / e.maxHp), 5);
      if ((e.elite || e === hover) && Math.hypot(e.x - p.x, e.y - p.y) < 520) text(c, e.name, s.x, yy - 10, 12, e.elite ? e.tint : '#f0d8d0', 'center', 'bold');
    }
    for (const t of R.texts) {
      const s = proj(t.x, t.z, t.y), k = t.t / t.life;
      c.globalAlpha = Math.min(1, (1 - k) * 2);
      text(c, t.text, s.x, s.y, t.size * (k < 0.12 ? 1 + (0.12 - k) * 4 : 1), t.color, 'center', 'bold');
    }
    c.globalAlpha = 1;
  }

  function drawScreenFx(c, R) {
    if (R.flash > 0) { c.fillStyle = `rgba(160,0,0,${R.flash * 0.45})`; c.fillRect(0, 0, W, H); }
    const vg = c.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 0.98); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.5)');
    c.fillStyle = vg; c.fillRect(0, 0, W, H);
  }

  return { init, text, drawBars, drawInfo, drawWorldOverlay, drawScreenFx };
})();
