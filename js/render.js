/* Lord of Sword – Rendering: Dungeon, Sprites, Licht, HUD, Lager-Hintergrund (alles per Canvas-Code) */
const Render = (function () {
  'use strict';
  const T = LOS.TILE, W = 1280, H = 720, WALL_H = 22, Z = LOS.ZOOM;
  const ZONES = LOS.ZONES;
  const TAU = Math.PI * 2;
  let light, lightX, mini, miniX, miniT = 0;
  const FONT = '"Cinzel", "Palatino Linotype", Georgia, serif';

  function init() {
    light = document.createElement('canvas'); light.width = W; light.height = H; lightX = light.getContext('2d');
    mini = document.createElement('canvas'); miniX = mini.getContext('2d');
  }

  /* ------------------------------------------------------------ kleine Helfer */
  const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.max(0, Math.min(255, ((n >> 16) & 255) * f)), g = Math.max(0, Math.min(255, ((n >> 8) & 255) * f)), b = Math.max(0, Math.min(255, (n & 255) * f));
    return `rgb(${r | 0},${g | 0},${b | 0})`;
  }
  function limb(c, x1, y1, x2, y2, w, col) { c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); }
  function circ(c, x, y, r, col) { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
  function ell(c, x, y, rx, ry, col) { c.fillStyle = col; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fill(); }
  function rrect(c, x, y, w, h, r, col) { c.fillStyle = col; c.beginPath(); c.roundRect(x, y, w, h, r); c.fill(); }
  function shadow(c, rx, ry) { ell(c, 0, 0, rx, ry, 'rgba(0,0,0,0.42)'); }
  function text(c, s, x, y, size, col, align, weight, stroke) {
    c.font = `${weight || 'bold'} ${size}px ${FONT}`; c.textAlign = align || 'center'; c.textBaseline = 'middle';
    if (stroke !== false) { c.lineWidth = Math.max(2, size / 6); c.strokeStyle = 'rgba(0,0,0,0.85)'; c.lineJoin = 'round'; c.strokeText(s, x, y); }
    c.fillStyle = col; c.fillText(s, x, y);
  }

  /* ------------------------------------------------------------ Gegner-Sprites */
  function humanoid(c, e, o) {
    const r = e.r, t = e.anim, mv = e.moving ? 1 : 0;
    const sw = Math.sin(t * 10) * mv * r * 0.5, bob = Math.sin(t * (mv ? 10 : 2.4)) * (mv ? 1.6 : 1);
    const bulk = o.bulk || 1, hunch = o.hunch || 0;
    limb(c, -r * 0.32 * bulk, -r * 1.0, -r * 0.32 * bulk + sw, -1, r * 0.4 * bulk, o.legs || o.cloth);
    limb(c, r * 0.32 * bulk, -r * 1.0, r * 0.32 * bulk - sw, -1, r * 0.4 * bulk, o.legs || o.cloth);
    // Torso
    const ty = -r * 2.25 + bob;
    c.save(); c.translate(hunch * r * 0.3, 0);
    rrect(c, -r * 0.7 * bulk, ty, r * 1.4 * bulk, r * 1.35, r * 0.35, o.cloth);
    if (o.ribs) { c.strokeStyle = 'rgba(40,36,28,0.6)'; c.lineWidth = 1.5; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(-r * 0.45, ty + r * (0.3 + i * 0.28)); c.lineTo(r * 0.45, ty + r * (0.3 + i * 0.28)); c.stroke(); } }
    if (o.trim) { c.fillStyle = o.trim; c.fillRect(-r * 0.7 * bulk, ty + r * 0.95, r * 1.4 * bulk, r * 0.18); }
    if (o.pauld) { circ(c, -r * 0.75 * bulk, ty + r * 0.2, r * 0.38, o.pauld); circ(c, r * 0.75 * bulk, ty + r * 0.2, r * 0.38, o.pauld); }
    // Arme
    const raise = e.wind > 0 ? -1.3 : Math.sin(t * 3) * 0.08;
    const ax = r * 0.75 * bulk, ay = ty + r * 0.35;
    limb(c, -ax, ay, -ax - r * 0.25, ay + r * 0.85, r * 0.3, o.skin);
    c.save(); c.translate(ax, ay); c.rotate(raise + (o.armFwd ? -0.9 : 0.25));
    limb(c, 0, 0, 0, r * 0.95, r * 0.3, o.skin);
    if (o.weapon === 'sword') { limb(c, 0, r * 0.9, 0, r * 2.2, r * 0.18, o.wcol || '#b9b9c2'); limb(c, -r * 0.3, r * 1.0, r * 0.3, r * 1.0, r * 0.12, '#6b5b3a'); }
    else if (o.weapon === 'great') { limb(c, 0, r * 0.9, 0, r * 2.9, r * 0.3, o.wcol || '#9aa0aa'); limb(c, -r * 0.45, r * 1.0, r * 0.45, r * 1.0, r * 0.16, '#55504a'); }
    else if (o.weapon === 'club') { limb(c, 0, r * 0.7, 0, r * 1.9, r * 0.35, '#6a4a2a'); circ(c, 0, r * 2.0, r * 0.45, '#5a3f24'); }
    else if (o.weapon === 'staff') { limb(c, 0, -r * 0.6, 0, r * 2.2, r * 0.14, '#5a4630'); circ(c, 0, -r * 0.75, r * 0.34, o.gem || '#7fd8ff'); }
    c.restore();
    c.restore();
    // Kopf
    const hy = -r * 2.85 + bob, hx = hunch * r * 0.5;
    if (o.head === 'skull') {
      circ(c, hx, hy, r * 0.62, o.headCol || o.skin); rrect(c, hx - r * 0.35, hy + r * 0.35, r * 0.7, r * 0.3, 2, o.headCol || o.skin);
      circ(c, hx - r * 0.22, hy - r * 0.05, r * 0.16, '#16100d'); circ(c, hx + r * 0.22, hy - r * 0.05, r * 0.16, '#16100d');
      circ(c, hx - r * 0.22, hy - r * 0.05, r * 0.07, o.eye || '#ff5a33'); circ(c, hx + r * 0.22, hy - r * 0.05, r * 0.07, o.eye || '#ff5a33');
    } else if (o.head === 'hood') {
      circ(c, hx, hy, r * 0.72, o.cloth); circ(c, hx + 1, hy + r * 0.05, r * 0.42, '#0a0810');
      circ(c, hx - r * 0.15, hy + r * 0.02, r * 0.07, o.eye || '#7fd8ff'); circ(c, hx + r * 0.2, hy + r * 0.02, r * 0.07, o.eye || '#7fd8ff');
    } else if (o.head === 'helm') {
      circ(c, hx, hy, r * 0.68, o.headCol || '#6b6f78'); c.fillStyle = '#0b0a0c'; c.fillRect(hx - r * 0.45, hy - r * 0.08, r * 0.9, r * 0.2);
      circ(c, hx + r * 0.2, hy + r * 0.02, r * 0.07, o.eye || '#ff3b2a');
      if (o.plume) { limb(c, hx, hy - r * 0.6, hx - r * 0.6, hy - r * 1.0 + Math.sin(t * 4) * 2, r * 0.3, o.plume); }
    } else if (o.head === 'cap') { // Pilzhut
      circ(c, hx, hy + r * 0.2, r * 0.5, o.skin); ell(c, hx, hy - r * 0.2, r * 1.15, r * 0.75, o.headCol);
      circ(c, hx - r * 0.5, hy - r * 0.3, r * 0.17, '#f1ead8'); circ(c, hx + r * 0.3, hy - r * 0.55, r * 0.2, '#f1ead8'); circ(c, hx + r * 0.55, hy - r * 0.15, r * 0.13, '#f1ead8');
    } else if (o.head === 'horned') {
      circ(c, hx, hy, r * 0.66, o.headCol || o.skin);
      limb(c, hx - r * 0.45, hy - r * 0.4, hx - r * 0.85, hy - r * 1.1, r * 0.2, '#e8dcc0'); limb(c, hx + r * 0.45, hy - r * 0.4, hx + r * 0.85, hy - r * 1.1, r * 0.2, '#e8dcc0');
      circ(c, hx - r * 0.2, hy, r * 0.09, '#ffe14a'); circ(c, hx + r * 0.25, hy, r * 0.09, '#ffe14a');
    } else {
      circ(c, hx, hy, r * 0.62, o.headCol || o.skin);
      circ(c, hx - r * 0.2, hy - r * 0.05, r * 0.09, o.eye || '#222'); circ(c, hx + r * 0.25, hy - r * 0.05, r * 0.09, o.eye || '#222');
    }
  }

  function bat(c, e, col, col2) {
    const r = e.r, f = Math.sin(e.anim * 22), y = -r * 2.4 + Math.sin(e.anim * 4) * 3;
    c.fillStyle = col2 || col;
    for (const s of [-1, 1]) {
      c.beginPath(); c.moveTo(0, y); c.quadraticCurveTo(s * r * 1.6, y - r * (0.9 + f * 0.9), s * r * 2.4, y + r * 0.2 + f * r * 0.4); c.quadraticCurveTo(s * r * 1.4, y + r * 0.3, 0, y + r * 0.6); c.fill();
    }
    ell(c, 0, y + r * 0.2, r * 0.7, r * 0.85, col);
    circ(c, -r * 0.25, y, r * 0.12, '#ff3a3a'); circ(c, r * 0.25, y, r * 0.12, '#ff3a3a');
    c.fillStyle = col; c.beginPath(); c.moveTo(-r * 0.5, y - r * 0.5); c.lineTo(-r * 0.3, y - r * 1.0); c.lineTo(-r * 0.05, y - r * 0.55); c.fill();
    c.beginPath(); c.moveTo(r * 0.5, y - r * 0.5); c.lineTo(r * 0.3, y - r * 1.0); c.lineTo(r * 0.05, y - r * 0.55); c.fill();
  }

  function beast(c, e, col, o) {
    o = o || {};
    const r = e.r, t = e.anim, mv = e.moving ? 1 : 0, sw = Math.sin(t * 16) * mv * r * 0.4;
    const y = -r * 0.9;
    // Schwanz
    c.strokeStyle = o.tail || '#c28f8f'; c.lineWidth = r * 0.22; c.lineCap = 'round'; c.beginPath(); c.moveTo(-r * 1.3, y); c.quadraticCurveTo(-r * 2.2, y - r * 0.4 + Math.sin(t * 6) * r * 0.5, -r * 2.6, y + r * 0.1); c.stroke();
    if (o.legs) { for (let i = 0; i < o.legs; i++) { const s = i % 2 ? 1 : -1, ox = -r * 0.7 + i * r * 0.4; limb(c, ox, y, ox + s * r * 0.9 + sw * s, y + r * 0.9, r * 0.14, col); limb(c, ox, y, ox - s * r * 0.9 - sw * s, y + r * 0.9, r * 0.14, col); } }
    else { limb(c, -r * 0.6, y + r * 0.2, -r * 0.6 + sw, 0, r * 0.3, col); limb(c, r * 0.6, y + r * 0.2, r * 0.6 - sw, 0, r * 0.3, col); }
    ell(c, 0, y, r * 1.35, r * (o.fat || 0.85), col);
    ell(c, r * 1.2, y - r * 0.15, r * 0.7, r * 0.55, col);                      // Kopf
    circ(c, r * 1.35, y - r * 0.3, r * 0.12, o.eye || '#ffdd44');
    circ(c, r * 1.0, y - r * 0.75, r * 0.28, col); circ(c, r * 1.0, y - r * 0.75, r * 0.14, '#d9a0a0'); // Ohr
  }

  function drawEnemy(c, e, now) {
    const r = e.r;
    shadow(c, r * 1.1, r * 0.42);
    if (e.wind > 0 && e.ai !== 'boss') { c.strokeStyle = `rgba(255,70,50,${0.5 + 0.4 * Math.sin(now * 30)})`; c.lineWidth = 2; c.beginPath(); c.ellipse(0, 0, r * 1.5, r * 0.6, 0, 0, TAU); c.stroke(); }
    if (e.elite) {
      const g = c.createRadialGradient(0, 0, 4, 0, 0, r * 2.4); g.addColorStop(0, e.tint + 'aa'); g.addColorStop(1, e.tint + '00');
      c.fillStyle = g; c.beginPath(); c.ellipse(0, 0, r * 2.4, r * 1.0, 0, 0, TAU); c.fill();
    }
    c.scale(e.fx, 1);
    const L = e.look;
    switch (L) {
      case 'rat': beast(c, e, '#6e5f58'); break;
      case 'spider': beast(c, e, '#2b2236', { legs: 4, eye: '#ff3a8a', tail: '#2b2236', fat: 1 }); break;
      case 'bat': bat(c, e, '#3c3140', '#2a2030'); break;
      case 'cbat': bat(c, e, '#58b9e8', '#2f7fb0'); break;
      case 'imp': bat(c, e, '#c93a2a', '#7a1a14'); break;
      case 'skeleton': humanoid(c, e, { skin: '#e8e2cd', cloth: '#d3cdb7', legs: '#cfc9b2', head: 'skull', ribs: true, weapon: 'sword', wcol: '#8c8b86' }); break;
      case 'archer': humanoid(c, e, { skin: '#e8e2cd', cloth: '#9c8a64', legs: '#cfc9b2', head: 'skull', eye: '#ffc233', weapon: 'staff', gem: '#8a6a3a' }); bowDraw(c, e); break;
      case 'zombie': humanoid(c, e, { skin: '#7d9a62', cloth: '#4e463a', legs: '#3a3a32', head: 'face', headCol: '#86a468', eye: '#d9e07a', weapon: 'club', hunch: 1, bulk: 1.15, armFwd: true }); break;
      case 'shroom': humanoid(c, e, { skin: '#c9a678', cloth: '#7a5a3a', head: 'cap', headCol: '#b3402e', weapon: 'club', bulk: 0.95 }); break;
      case 'spitter': humanoid(c, e, { skin: '#7a9a3a', cloth: '#3f5a22', head: 'cap', headCol: '#7bd44a', weapon: null, bulk: 0.9 }); break;
      case 'slime': blob(c, e, '#58b53c', '#8ee060'); break;
      case 'guard': humanoid(c, e, { skin: '#8a95a3', cloth: '#6f7a88', legs: '#59626e', head: 'helm', headCol: '#8a95a3', eye: '#6fd8ff', pauld: '#9aa5b3', weapon: 'great', wcol: '#a3b0c0', bulk: 1.2 }); break;
      case 'mage': humanoid(c, e, { skin: '#d9c3a0', cloth: '#2b3f86', legs: '#1f2e66', head: 'hood', eye: '#7fe8ff', weapon: 'staff', gem: '#6fe0ff', trim: '#8ec6ff' }); break;
      case 'golem': golem(c, e); break;
      case 'dknight': humanoid(c, e, { skin: '#2a2a33', cloth: '#262630', legs: '#1d1d26', head: 'helm', headCol: '#33333f', eye: '#ff3b2a', plume: '#a3121c', pauld: '#3b3b48', weapon: 'great', wcol: '#8d93a0', bulk: 1.2, trim: '#a3121c' }); break;
      case 'necro': humanoid(c, e, { skin: '#cbb7a0', cloth: '#3a2150', legs: '#2a1740', head: 'hood', eye: '#9dff6a', weapon: 'staff', gem: '#9dff6a', trim: '#7a3fa8' }); break;
      case 'demon': humanoid(c, e, { skin: '#a3262a', cloth: '#8a1c20', legs: '#6e1519', head: 'horned', headCol: '#b32b2f', weapon: 'club', bulk: 1.3 }); break;
      case 'boss': bossDraw(c, e, now); break;
      default: humanoid(c, e, { skin: '#aaa', cloth: '#888', head: 'face' });
    }
  }
  function bowDraw(c, e) {
    const r = e.r; c.strokeStyle = '#6a4a2a'; c.lineWidth = 2.5; c.beginPath(); c.arc(r * 1.1, -r * 1.7, r * 1.1, -1.2, 1.2); c.stroke();
    c.strokeStyle = 'rgba(230,230,200,0.6)'; c.lineWidth = 1; c.beginPath(); c.moveTo(r * 1.1 + Math.cos(-1.2) * r * 1.1, -r * 1.7 + Math.sin(-1.2) * r * 1.1); c.lineTo(r * 1.1 + Math.cos(1.2) * r * 1.1, -r * 1.7 + Math.sin(1.2) * r * 1.1); c.stroke();
  }
  function blob(c, e, col, hi) {
    const r = e.r, sq = Math.sin(e.anim * 5) * 0.12;
    c.fillStyle = col; c.beginPath(); c.ellipse(0, -r * 0.95, r * (1.25 + sq), r * (1.0 - sq), 0, 0, TAU); c.fill();
    c.fillStyle = hi; c.globalAlpha = 0.5; c.beginPath(); c.ellipse(-r * 0.3, -r * 1.4, r * 0.45, r * 0.25, -0.4, 0, TAU); c.fill(); c.globalAlpha = 1;
    circ(c, -r * 0.35, -r * 1.0, r * 0.2, '#fff'); circ(c, r * 0.4, -r * 1.0, r * 0.2, '#fff'); circ(c, -r * 0.3, -r * 1.0, r * 0.1, '#111'); circ(c, r * 0.45, -r * 1.0, r * 0.1, '#111');
  }
  function golem(c, e) {
    const r = e.r, t = e.anim, sw = Math.sin(t * 6) * (e.moving ? r * 0.25 : 0);
    rrect(c, -r * 0.95 + sw * 0.3, -r * 0.9, r * 0.8, r * 0.9, 4, '#545d6b'); rrect(c, r * 0.15 - sw * 0.3, -r * 0.9, r * 0.8, r * 0.9, 4, '#545d6b');
    rrect(c, -r * 1.2, -r * 2.5, r * 2.4, r * 1.8, r * 0.4, '#6c7686');
    c.fillStyle = '#7bd0ff'; for (const [x, y, s] of [[-0.6, -2.2, 0.35], [0.4, -1.9, 0.45], [0.7, -2.4, 0.25]]) { c.beginPath(); c.moveTo(r * x, r * y); c.lineTo(r * (x + s), r * (y + s * 1.6)); c.lineTo(r * (x - s), r * (y + s * 1.6)); c.fill(); }
    rrect(c, -r * 0.55, -r * 3.2, r * 1.1, r * 0.85, r * 0.25, '#7d8798'); circ(c, -r * 0.2, -r * 2.8, r * 0.12, '#7bd0ff'); circ(c, r * 0.25, -r * 2.8, r * 0.12, '#7bd0ff');
    rrect(c, -r * 1.65, -r * 2.3, r * 0.55, r * 1.7, r * 0.2, '#6c7686'); rrect(c, r * 1.1, -r * 2.3, r * 0.55, r * 1.7, r * 0.2, '#6c7686');
    if (e.wind > 0) { c.fillStyle = 'rgba(255,60,40,0.35)'; c.fillRect(-r * 1.2, -r * 2.5, r * 2.4, r * 1.8); }
  }
  function bossDraw(c, e, now) {
    const r = e.r, t = e.anim, mv = e.moving ? 1 : 0, sw = Math.sin(t * 6) * mv * r * 0.3, bob = Math.sin(t * 2) * 2;
    // Umhang
    c.fillStyle = e.enrage ? '#8a1410' : '#5a1218'; c.beginPath(); c.moveTo(-r * 1.2, -r * 2.8); c.lineTo(r * 1.2, -r * 2.8); c.lineTo(r * 1.7 + Math.sin(t * 3) * 4, 0); c.lineTo(-r * 1.7 + Math.sin(t * 3 + 1) * 4, 0); c.fill();
    limb(c, -r * 0.4, -r * 1.2, -r * 0.4 + sw, 0, r * 0.45, '#cfc7ad'); limb(c, r * 0.4, -r * 1.2, r * 0.4 - sw, 0, r * 0.45, '#cfc7ad');
    rrect(c, -r * 0.95, -r * 2.9 + bob, r * 1.9, r * 1.8, r * 0.4, '#d8d0b6');
    c.strokeStyle = 'rgba(60,50,40,0.6)'; c.lineWidth = 3; for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(-r * 0.7, -r * (2.5 - i * 0.38) + bob); c.lineTo(r * 0.7, -r * (2.5 - i * 0.38) + bob); c.stroke(); }
    rrect(c, -r * 1.35, -r * 3.0 + bob, r * 0.8, r * 0.55, r * 0.25, '#b9b19a'); rrect(c, r * 0.55, -r * 3.0 + bob, r * 0.8, r * 0.55, r * 0.25, '#b9b19a');
    // Kopf + Krone
    circ(c, 0, -r * 3.55 + bob, r * 0.75, '#e8e2cd'); rrect(c, -r * 0.4, -r * 3.0 + bob, r * 0.8, r * 0.3, 3, '#e8e2cd');
    circ(c, -r * 0.27, -r * 3.6 + bob, r * 0.2, '#14090a'); circ(c, r * 0.27, -r * 3.6 + bob, r * 0.2, '#14090a');
    const eyeC = e.enrage ? '#ff2a1a' : '#ff9a3a';
    circ(c, -r * 0.27, -r * 3.6 + bob, r * 0.1, eyeC); circ(c, r * 0.27, -r * 3.6 + bob, r * 0.1, eyeC);
    c.fillStyle = '#e0b236'; c.beginPath(); c.moveTo(-r * 0.7, -r * 4.05 + bob); for (let i = 0; i < 5; i++) { c.lineTo(-r * 0.7 + i * r * 0.35 + r * 0.17, -r * 4.7 + bob); c.lineTo(-r * 0.7 + (i + 1) * r * 0.35, -r * 4.05 + bob); } c.fill();
    // Waffe
    c.save(); c.translate(r * 1.4, -r * 2.2 + bob); c.rotate(e.wind > 0 ? -1.5 + (e.windType === 'slam' ? 0 : 0.3) : 0.15 + Math.sin(t * 2) * 0.05);
    limb(c, 0, 0, 0, r * 1.2, r * 0.3, '#d8d0b6'); limb(c, 0, r * 1.0, 0, r * 3.6, r * 0.42, '#8a8f99'); limb(c, -r * 0.6, r * 1.1, r * 0.6, r * 1.1, r * 0.22, '#55504a');
    c.restore();
    if (e.wind > 0) { c.fillStyle = `rgba(255,60,40,${0.15 + 0.15 * Math.sin(now * 30)})`; c.beginPath(); c.arc(0, -r * 2, r * 2.2, 0, TAU); c.fill(); }
  }

  /* ------------------------------------------------------------ Spieler */
  function drawPlayer(c, R, now) {
    const p = R.p, S = R.S, r = 14;
    const mv = p.moving ? 1 : 0, t = p.anim, sw = Math.sin(t * 12) * mv * 5, bob = Math.sin(t * (mv ? 12 : 2.2)) * (mv ? 1.5 : 1);
    c.save(); c.translate(p.x, p.y);
    shadow(c, 16, 6);
    if (p.hurtT > 0) c.globalAlpha = 0.75 + 0.25 * Math.sin(now * 60);
    c.save(); c.scale(p.dirX, 1);
    // Beine
    limb(c, -4, -12, -4 + sw, -1, 7, '#4b4f5a'); limb(c, 4, -12, 4 - sw, -1, 7, '#4b4f5a');
    rrect(c, -7 + sw * 0.3, -5, 8, 5, 2, '#2f2a28'); rrect(c, 0 - sw * 0.3, -5, 8, 5, 2, '#2f2a28');
    // Umhang
    c.fillStyle = '#7a1218'; c.beginPath(); c.moveTo(-9, -32 + bob); c.lineTo(-2, -32 + bob); c.lineTo(-6 - mv * 4 + Math.sin(t * 5), -6); c.lineTo(-15 - mv * 3, -8); c.fill();
    // Torso
    rrect(c, -9, -33 + bob, 18, 22, 6, '#9aa1ad');
    rrect(c, -9, -24 + bob, 18, 6, 2, '#6a1016');
    rrect(c, -5, -31 + bob, 10, 5, 2, '#b4bbc7');
    circ(c, -10, -31 + bob, 6, '#b4bbc7'); circ(c, 10, -31 + bob, 6, '#b4bbc7');
    // Schild (Gegenseite)
    circ(c, -11, -20 + bob, 8, '#6a1016'); circ(c, -11, -20 + bob, 6, '#8d939f'); circ(c, -11, -20 + bob, 2.5, '#d9b94a');
    // Kopf mit Helm
    circ(c, 1, -41 + bob, 8, '#aeb5c1'); c.fillStyle = '#0d0c10'; c.fillRect(-2, -42 + bob, 11, 3);
    limb(c, 0, -48 + bob, -9, -47 + bob + Math.sin(t * 4) * 1.5, 4, '#b3151b');
    c.restore();
    c.globalAlpha = 1;
    // Schwert
    const arm = { x: p.x + p.dirX * 9, y: p.y - 24 + bob };
    let ang, len;
    if (p.swingT >= 0) {
      const k = Math.min(1, p.swingT / p.swingDur), e = 1 - Math.pow(1 - k, 2);
      ang = p.swingDir - S.arc / 2 + S.arc * e; len = S.reach * 0.88;
      // Schlagspur
      c.save(); c.translate(-p.x, -p.y); // zurück ins Weltsystem
      c.restore();
    } else { ang = p.dirX > 0 ? -0.9 : Math.PI + 0.9; len = 34; }
    c.restore();
    c.save();
    if (p.swingT >= 0) {
      const k = Math.min(1, p.swingT / p.swingDur), e = 1 - Math.pow(1 - k, 2), a1 = p.swingDir - S.arc / 2 + S.arc * e;
      const g = c.createRadialGradient(p.x, p.y - 16, S.reach * 0.3, p.x, p.y - 16, S.reach);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, `rgba(255,248,225,${0.55 * (1 - k * 0.6)})`);
      c.fillStyle = g; c.beginPath(); c.moveTo(p.x, p.y - 16); c.arc(p.x, p.y - 16, S.reach * 0.95, Math.max(p.swingDir - S.arc / 2, a1 - 1.2), a1); c.closePath(); c.fill();
    }
    const hx = arm.x, hy = arm.y;
    const tx = hx + Math.cos(ang) * len, ty = hy + Math.sin(ang) * len * 0.8;
    limb(c, hx, hy, tx, ty, 5, '#e8ecf4'); limb(c, hx, hy, tx, ty, 2, '#ffffff');
    limb(c, hx - Math.sin(ang) * 6, hy + Math.cos(ang) * 5, hx + Math.sin(ang) * 6, hy - Math.cos(ang) * 5, 3, '#d9b94a');
    circ(c, hx, hy, 3.5, '#8d939f');
    c.restore();
  }

  /* ------------------------------------------------------------ Dungeon */
  function drawTileFloor(c, map, x, y, zone) {
    const z = ZONES[zone];
    const h = hash(x, y);
    const base = z.floor[(x + y) & 1];
    c.fillStyle = h < 0.2 ? shade(base, 0.9) : h > 0.85 ? shade(base, 1.12) : base;
    c.fillRect(x * T, y * T, T, T);
    c.strokeStyle = 'rgba(0,0,0,0.28)'; c.lineWidth = 1;
    c.strokeRect(x * T + 0.5, y * T + 0.5, T - 1, T - 1);
    if (h > 0.55 && h < 0.62) { c.strokeStyle = 'rgba(0,0,0,0.22)'; c.beginPath(); c.moveTo(x * T + 8, y * T + 12); c.lineTo(x * T + 22, y * T + 26); c.lineTo(x * T + 30, y * T + 24); c.stroke(); }
  }

  function zoneAt(map, x, y) {
    if (!map.zoneMap) map.zoneMap = new Int8Array(map.w * map.h).fill(-1);
    const k = y * map.w + x;
    if (map.zoneMap[k] >= 0) return map.zoneMap[k];
    let z = 0;
    const i = map.roomAt[k];
    if (i >= 0) z = map.rooms[i].zone;
    else {
      outer: for (let r = 1; r < 16; r++) for (const [dx, dy] of [[r, 0], [-r, 0], [0, r], [0, -r]]) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < map.w && ny < map.h) { const q = map.roomAt[ny * map.w + nx]; if (q >= 0) { z = map.rooms[q].zone; break outer; } }
      }
    }
    map.zoneMap[k] = z;
    return z;
  }

  function drawWall(c, map, x, y, zone) {
    const z = ZONES[zone], px = x * T, py = y * T - WALL_H;
    const below = map.tiles[(y + 1) * map.w + x] === 1;
    const h = hash(x, y);
    c.fillStyle = h < 0.3 ? shade(z.wall[0], 1.15) : z.wall[0];
    c.fillRect(px, py, T, T);
    c.fillStyle = 'rgba(255,255,255,0.05)'; c.fillRect(px, py, T, 3);
    if (below) {
      const fy = py + T;
      const g = c.createLinearGradient(0, fy, 0, fy + WALL_H);
      g.addColorStop(0, shade(z.wall[1], 1.5)); g.addColorStop(1, shade(z.wall[1], 0.7));
      c.fillStyle = g; c.fillRect(px, fy, T, WALL_H);
      c.strokeStyle = 'rgba(0,0,0,0.4)'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(px, fy + 7.5); c.lineTo(px + T, fy + 7.5); c.moveTo(px, fy + 15.5); c.lineTo(px + T, fy + 15.5);
      const off = (y & 1) * 12; for (const row of [0, 1, 2]) { const bx = px + ((off + row * 17) % 24) + 6; c.moveTo(bx, fy + row * 7.5); c.lineTo(bx, fy + row * 7.5 + 7.5); c.moveTo(bx + 24, fy + row * 7.5); c.lineTo(bx + 24, fy + row * 7.5 + 7.5); }
      c.stroke();
    } else {
      c.strokeStyle = 'rgba(0,0,0,0.25)'; c.strokeRect(px + 0.5, py + 0.5, T - 1, T - 1);
    }
  }

  function wallVisible(map, x, y) {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < map.w && ny < map.h && map.tiles[ny * map.w + nx]) return true;
    }
    return false;
  }

  function flatProp(c, p, zone, now) {
    c.save(); c.translate(p.x, p.y); c.rotate(p.a || 0); c.scale(p.s, p.s);
    switch (p.type) {
      case 'bones': c.strokeStyle = 'rgba(225,218,196,0.85)'; c.lineWidth = 3; c.lineCap = 'round'; c.beginPath(); c.moveTo(-10, -2); c.lineTo(9, 3); c.moveTo(-6, 7); c.lineTo(8, -6); c.stroke(); circ(c, -10, -2, 2.5, '#e6dfc8'); circ(c, 9, 3, 2.5, '#e6dfc8'); break;
      case 'skull': circ(c, 0, 0, 6, '#dcd5bd'); circ(c, -2.2, -1, 1.6, '#201a14'); circ(c, 2.2, -1, 1.6, '#201a14'); c.fillStyle = '#201a14'; c.fillRect(-1.5, 2, 3, 2); break;
      case 'crack': c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-14, 0); c.lineTo(-4, 4); c.lineTo(3, -3); c.lineTo(14, 2); c.stroke(); break;
      case 'web': c.strokeStyle = 'rgba(220,220,220,0.25)'; c.lineWidth = 1; for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(i * 1.05) * 14, Math.sin(i * 1.05) * 14); c.stroke(); } c.beginPath(); c.arc(0, 0, 7, 0, TAU); c.stroke(); break;
      case 'goo': ell(c, 0, 0, 14, 8, 'rgba(110,200,70,0.35)'); ell(c, 3, 1, 6, 3, 'rgba(180,255,120,0.3)'); break;
      case 'blood': ell(c, 0, 0, 16, 9, 'rgba(110,10,14,0.55)'); ell(c, -4, 2, 6, 3, 'rgba(160,20,24,0.4)'); break;
      case 'shard': c.fillStyle = 'rgba(110,200,255,0.55)'; c.beginPath(); c.moveTo(0, -6); c.lineTo(4, 5); c.lineTo(-4, 5); c.fill(); break;
      case 'mushroom': c.rotate(-(p.a || 0)); limb(c, 0, 0, 0, -6, 3, '#c9b48a'); ell(c, 0, -7, 7, 4.5, '#b072ff'); circ(c, -2, -8, 1.3, '#f1e6ff'); circ(c, 3, -7, 1.2, '#f1e6ff'); break;
    }
    c.restore();
  }

  function tallProp(c, p, now) {
    c.save(); c.translate(p.x, p.y);
    const fl = 0.8 + 0.2 * Math.sin(now * 11 + (p.x + p.y));
    switch (p.type) {
      case 'torch': {
        rrect(c, -2.5, -26, 5, 18, 2, '#4a3524'); rrect(c, -5, -28, 10, 5, 2, '#2c2a2e');
        const g = c.createRadialGradient(0, -34, 1, 0, -34, 16); g.addColorStop(0, 'rgba(255,230,150,0.95)'); g.addColorStop(0.5, `rgba(255,140,40,${0.7 * fl})`); g.addColorStop(1, 'rgba(255,80,0,0)');
        c.fillStyle = g; c.beginPath(); c.ellipse(0, -34, 9, 16 * fl, 0, 0, TAU); c.fill(); break;
      }
      case 'brazier': {
        shadow(c, 16, 6); rrect(c, -3, -20, 6, 20, 2, '#3a3436'); rrect(c, -14, -28, 28, 10, 4, '#2c282a');
        const g = c.createRadialGradient(0, -38, 2, 0, -38, 24); g.addColorStop(0, 'rgba(255,240,170,0.95)'); g.addColorStop(0.45, `rgba(255,120,30,${0.8 * fl})`); g.addColorStop(1, 'rgba(255,60,0,0)');
        c.fillStyle = g; c.beginPath(); c.ellipse(0, -38, 14, 24 * fl, 0, 0, TAU); c.fill(); break;
      }
      case 'barrel': {
        if (p.broken) break;
        shadow(c, 14, 5); rrect(c, -11, -26, 22, 26, 5, '#7a5230'); c.fillStyle = '#4a3320'; c.fillRect(-11, -20, 22, 3); c.fillRect(-11, -8, 22, 3);
        ell(c, 0, -26, 11, 4, '#8f6339'); break;
      }
      case 'coffin': shadow(c, 18, 7); c.fillStyle = '#4b3a2a'; c.beginPath(); c.moveTo(-9, -22); c.lineTo(9, -22); c.lineTo(13, 0); c.lineTo(-13, 0); c.fill(); c.strokeStyle = '#2a2018'; c.lineWidth = 2; c.stroke(); c.fillStyle = '#d9b94a'; c.fillRect(-2, -17, 4, 9); c.fillRect(-5, -14, 10, 3); break;
      case 'crystal': {
        c.fillStyle = 'rgba(110,210,255,0.85)'; c.beginPath(); c.moveTo(0, -34); c.lineTo(7, -6); c.lineTo(0, 0); c.lineTo(-7, -6); c.fill();
        c.fillStyle = 'rgba(190,240,255,0.7)'; c.beginPath(); c.moveTo(0, -34); c.lineTo(7, -6); c.lineTo(0, -8); c.fill();
        c.fillStyle = 'rgba(80,170,230,0.9)'; c.beginPath(); c.moveTo(-9, -16); c.lineTo(-3, -4); c.lineTo(-13, -2); c.fill(); break;
      }
      case 'spike': shadow(c, 8, 3); c.fillStyle = '#3a2024'; c.beginPath(); c.moveTo(0, -30); c.lineTo(6, 0); c.lineTo(-6, 0); c.fill(); c.fillStyle = '#6a2a30'; c.beginPath(); c.moveTo(0, -30); c.lineTo(6, 0); c.lineTo(1, 0); c.fill(); break;
      case 'candle': rrect(c, -3, -12, 6, 12, 1, '#e9e1c8'); c.fillStyle = `rgba(255,190,80,${fl})`; c.beginPath(); c.ellipse(0, -16, 3, 5 * fl, 0, 0, TAU); c.fill(); break;
    }
    c.restore();
  }

  function drawPickup(c, k, now) {
    const bob = k.z > 0 ? 0 : Math.sin(now * 3 + k.x) * 2;
    c.save(); c.translate(k.x, k.y);
    ell(c, 0, 0, 7, 3, 'rgba(0,0,0,0.4)');
    const y = -8 - k.z - bob;
    if (k.type === 'hp' || k.type === 'mana') {
      const col = k.type === 'hp' ? ['#ff9a9a', '#e0202a', '#6a0a10'] : ['#b3d8ff', '#2f7fe8', '#0f2f6a'];
      const g = c.createRadialGradient(-2, y - 3, 1, 0, y, 8); g.addColorStop(0, col[0]); g.addColorStop(0.5, col[1]); g.addColorStop(1, col[2]);
      c.fillStyle = g; c.beginPath(); c.arc(0, y, 7.5, 0, TAU); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.7)'; c.beginPath(); c.ellipse(-2.5, y - 3, 2, 1.2, -0.5, 0, TAU); c.fill();
    } else {
      const tier = LOS.TIERS[k.rune.tier], def = LOS.RUNE_BY_ID[k.rune.id];
      const g = c.createLinearGradient(0, y - 90, 0, y); g.addColorStop(0, tier.color + '00'); g.addColorStop(1, tier.color + '88');
      c.fillStyle = g; c.fillRect(-5, y - 90, 10, 90);
      const gg = c.createRadialGradient(0, y, 2, 0, y, 24); gg.addColorStop(0, tier.color + 'bb'); gg.addColorStop(1, tier.color + '00'); c.fillStyle = gg; c.beginPath(); c.arc(0, y, 24, 0, TAU); c.fill();
      rrect(c, -10, y - 10, 20, 20, 4, '#1b1713'); c.strokeStyle = tier.color; c.lineWidth = 2; c.beginPath(); c.roundRect(-10, y - 10, 20, 20, 4); c.stroke();
      text(c, def.glyph, 0, y + 1, 16, tier.color, 'center', 'bold', false);
    }
    c.restore();
  }

  /* ------------------------------------------------------------ Effekte */
  function drawFxBelow(c, R, now) {
    for (const t of R.tele) {
      const k = Math.min(1, t.t / t.dur);
      const friendly = t.friendly;
      const col = friendly ? '255,120,30' : '255,50,40';
      if (t.kind === 'circle') {
        c.fillStyle = `rgba(${col},${0.08 + 0.1 * k})`; c.beginPath(); c.ellipse(t.x, t.y, t.r, t.r * 0.75, 0, 0, TAU); c.fill();
        c.fillStyle = `rgba(${col},${0.12 + 0.2 * k})`; c.beginPath(); c.ellipse(t.x, t.y, t.r * k, t.r * 0.75 * k, 0, 0, TAU); c.fill();
        c.strokeStyle = `rgba(${col},0.8)`; c.lineWidth = 2; c.beginPath(); c.ellipse(t.x, t.y, t.r, t.r * 0.75, 0, 0, TAU); c.stroke();
      } else {
        const dx = t.x2 - t.x, dy = t.y2 - t.y, l = Math.hypot(dx, dy) || 1, nx = -dy / l * t.w / 2, ny = dx / l * t.w / 2;
        c.fillStyle = `rgba(${col},${0.12 + 0.25 * k})`; c.beginPath(); c.moveTo(t.x + nx, t.y + ny); c.lineTo(t.x2 + nx, t.y2 + ny); c.lineTo(t.x2 - nx, t.y2 - ny); c.lineTo(t.x - nx, t.y - ny); c.fill();
      }
    }
    for (const f of R.fx) {
      const k = f.t / f.dur;
      if (f.k === 'ring') {
        const r = f.r0 + (f.r1 - f.r0) * (1 - Math.pow(1 - k, 2));
        c.strokeStyle = f.color; c.globalAlpha = (1 - k) * 0.9; c.lineWidth = 8 * (1 - k) + 2;
        c.beginPath(); c.ellipse(f.x, f.y, r, r * 0.72, 0, 0, TAU); c.stroke();
        c.fillStyle = f.color; c.globalAlpha = (1 - k) * 0.12; c.fill(); c.globalAlpha = 1;
      }
    }
  }

  function drawFxAbove(c, R, now) {
    // Meteoriten im Anflug
    for (const t of R.tele) if (t.friendly) {
      const rem = t.dur - t.t;
      if (rem < 0.32) { const k = 1 - rem / 0.32, ox = 160 * (1 - k), oy = -620 * (1 - k); c.save(); c.translate(t.x + ox, t.y + oy);
        const g = c.createRadialGradient(0, 0, 2, 0, 0, 40); g.addColorStop(0, '#fff3c0'); g.addColorStop(0.4, '#ff8a2a'); g.addColorStop(1, 'rgba(255,60,0,0)'); c.fillStyle = g; c.beginPath(); c.arc(0, 0, 40, 0, TAU); c.fill();
        c.strokeStyle = 'rgba(255,150,50,0.6)'; c.lineWidth = 16; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, 0); c.lineTo(ox * 0.6, oy * 0.6); c.stroke(); circ(c, 0, 0, 15, '#6b3b22'); c.restore(); }
    }
    for (const f of R.fx) {
      const k = f.t / f.dur;
      if (f.k === 'boom' || f.k === 'meteor') {
        const r = (f.r || 80) * (0.5 + 0.6 * k);
        const g = c.createRadialGradient(f.x, f.y - 10, 2, f.x, f.y - 10, r); g.addColorStop(0, `rgba(255,250,220,${0.9 * (1 - k)})`); g.addColorStop(0.4, (f.color || '#ff8a2a') + Math.round(150 * (1 - k)).toString(16).padStart(2, '0')); g.addColorStop(1, 'rgba(255,100,0,0)');
        c.fillStyle = g; c.beginPath(); c.arc(f.x, f.y - 10, r, 0, TAU); c.fill();
      } else if (f.k === 'bolt') {
        c.strokeStyle = f.color; c.globalAlpha = 1 - k; c.lineWidth = 3; c.lineJoin = 'round'; c.shadowColor = f.color; c.shadowBlur = 14;
        c.beginPath(); c.moveTo(f.a.x, f.a.y);
        const n = 8, dx = f.b.x - f.a.x, dy = f.b.y - f.a.y, l = Math.hypot(dx, dy) || 1;
        for (let i = 1; i < n; i++) { const o = (hash(i, (f.seed * 100 + Math.floor(now * 40)) | 0) - 0.5) * 26; c.lineTo(f.a.x + dx * i / n - dy / l * o, f.a.y + dy * i / n + dx / l * o); }
        c.lineTo(f.b.x, f.b.y); c.stroke(); c.lineWidth = 1; c.strokeStyle = '#fff'; c.stroke(); c.shadowBlur = 0; c.globalAlpha = 1;
      } else if (f.k === 'beam') {
        const w = 26 * (1 - k * 0.6);
        const g = c.createLinearGradient(f.x - w, 0, f.x + w, 0); g.addColorStop(0, 'rgba(255,230,120,0)'); g.addColorStop(0.5, `rgba(255,250,210,${0.95 * (1 - k)})`); g.addColorStop(1, 'rgba(255,230,120,0)');
        c.fillStyle = g; c.fillRect(f.x - w, f.y - 700, w * 2, 700);
        const gg = c.createRadialGradient(f.x, f.y, 1, f.x, f.y, 50); gg.addColorStop(0, `rgba(255,240,160,${1 - k})`); gg.addColorStop(1, 'rgba(255,200,60,0)'); c.fillStyle = gg; c.beginPath(); c.arc(f.x, f.y, 50, 0, TAU); c.fill();
      }
    }
    for (const b of R.eproj) {
      if (b.look === 'spear') { const a = Math.atan2(b.vy, b.vx); c.save(); c.translate(b.x, b.y); c.rotate(a); limb(c, -14, 0, 8, 0, 4, '#e8e2cf'); c.fillStyle = '#fff'; c.beginPath(); c.moveTo(14, 0); c.lineTo(6, -4); c.lineTo(6, 4); c.fill(); c.restore(); }
      else { const g = c.createRadialGradient(b.x, b.y, 1, b.x, b.y, 14); g.addColorStop(0, '#fff'); g.addColorStop(0.35, b.color); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.beginPath(); c.arc(b.x, b.y, 14, 0, TAU); c.fill(); }
    }
    for (const b of R.pproj) {
      const g = c.createRadialGradient(b.x, b.y, 1, b.x, b.y, 24); g.addColorStop(0, '#fff6d0'); g.addColorStop(0.3, b.color); g.addColorStop(1, 'rgba(255,60,0,0)');
      c.fillStyle = g; c.beginPath(); c.arc(b.x, b.y, 24, 0, TAU); c.fill();
    }
    for (const q of R.parts) {
      const a = Math.max(0, q.life / q.max);
      c.globalAlpha = a; c.fillStyle = q.color; c.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
    }
    c.globalAlpha = 1;
  }

  /* ------------------------------------------------------------ Licht */
  function lightHole(x, y, r, a) {
    if (!(isFinite(x) && isFinite(y) && isFinite(r) && r > 0) || !(a > 0)) return;
    const g = lightX.createRadialGradient(x, y, r * 0.1, x, y, r);
    g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(0.55, `rgba(0,0,0,${a * 0.55})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    lightX.fillStyle = g; lightX.beginPath(); lightX.arc(x, y, r, 0, TAU); lightX.fill();
  }

  function drawLighting(c, R, now, cx, cy) {
    const zone = ZONES[R.map.rooms[R.room] ? R.map.rooms[R.room].zone : 0];
    lightX.globalCompositeOperation = 'source-over';
    lightX.clearRect(0, 0, W, H);
    lightX.fillStyle = zone.fog; lightX.globalAlpha = 0.87; lightX.fillRect(0, 0, W, H); lightX.globalAlpha = 1;
    lightX.globalCompositeOperation = 'destination-out';
    const X = x => (x - cx) * Z + W / 2, Y = y => (y - cy) * Z + H / 2;
    const hole = (x, y, r, a) => lightHole(X(x), Y(y), r * Z, a);
    const p = R.p;
    hole(p.x, p.y - 20, 370, 1);
    const glows = [];
    for (const l of R.map.lights) {
      const sx = X(l.x), sy = Y(l.y);
      if (sx < -l.r * Z || sx > W + l.r * Z || sy < -l.r * Z || sy > H + l.r * Z) continue;
      const fl = 1 + 0.05 * Math.sin(now * 9 + l.flick) + 0.04 * Math.sin(now * 23 + l.flick * 2);
      lightHole(sx, sy, l.r * fl * Z, 0.95 * (l.strength || 1));
      glows.push([sx, sy, l.r * fl * Z, l]);
    }
    for (const b of R.pproj) hole(b.x, b.y, 190, 1);
    for (const b of R.eproj) hole(b.x, b.y, 80, 0.7);
    for (const f of R.fx) {
      const k = f.t / f.dur;
      if (f.k === 'boom' || f.k === 'meteor') hole(f.x, f.y, (f.r || 90) * 2.2, 1 - k);
      else if (f.k === 'ring') hole(f.x, f.y, f.r1 * 1.3, 0.8 * (1 - k));
      else if (f.k === 'beam') hole(f.x, f.y, 150, 1 - k);
      else if (f.k === 'bolt') hole(f.b.x, f.b.y, 120, 1 - k);
    }
    for (const k of R.pickups) if (k.type === 'rune') hole(k.x, k.y, 90, 0.8);
    for (const e of R.enemies) if (!e.dead && e.elite) hole(e.x, e.y, 90, 0.6);
    lightX.globalCompositeOperation = 'source-over';
    c.drawImage(light, 0, 0);
    // farbiges Glimmern
    c.globalCompositeOperation = 'lighter';
    for (const [sx, sy, r, l] of glows) {
      const col = l.color ? ['110,210,255', '0.10'] : [zone.light.slice(5, -1), '0.13'];
      const g = c.createRadialGradient(sx, sy, 2, sx, sy, r * 0.8); g.addColorStop(0, `rgba(${col[0]},${col[1]})`); g.addColorStop(1, `rgba(${col[0]},0)`);
      c.fillStyle = g; c.beginPath(); c.arc(sx, sy, r * 0.8, 0, TAU); c.fill();
    }
    c.globalCompositeOperation = 'source-over';
  }

  /* ------------------------------------------------------------ Hauptzeichnen */
  function drawRun(c, R, now) {
    const map = R.map, p = R.p;
    const sh = R.cam.shake;
    const cx = R.cam.x + (sh ? (Math.random() - 0.5) * sh : 0), cy = R.cam.y + (sh ? (Math.random() - 0.5) * sh : 0);
    c.fillStyle = '#050405'; c.fillRect(0, 0, W, H);
    c.save();
    c.translate(W / 2, H / 2); c.scale(Z, Z); c.translate(-Math.round(cx), -Math.round(cy));
    const hw = W / 2 / Z, hh = H / 2 / Z;
    const x0 = Math.max(0, Math.floor((cx - hw) / T) - 1), x1 = Math.min(map.w - 1, Math.ceil((cx + hw) / T) + 1);
    const y0 = Math.max(0, Math.floor((cy - hh) / T) - 1), y1 = Math.min(map.h - 1, Math.ceil((cy + hh) / T) + 3);
    // Boden
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (map.tiles[y * map.w + x]) drawTileFloor(c, map, x, y, zoneAt(map, x, y));
    // flache Deko
    const vx0 = cx - hw - 60, vx1 = cx + hw + 60, vy0 = cy - hh - 60, vy1 = cy + hh + 100;
    for (const pr of map.props) if (!pr.tall && pr.x > vx0 && pr.x < vx1 && pr.y > vy0 && pr.y < vy1) flatProp(c, pr, 0, now);
    drawFxBelow(c, R, now);
    // y-sortierte Objekte
    const list = [];
    for (const pr of map.props) if (pr.tall && !pr.broken && pr.x > vx0 && pr.x < vx1 && pr.y > vy0 && pr.y < vy1 + 60) list.push({ y: pr.y, f: () => tallProp(c, pr, now) });
    for (const k of R.pickups) if (k.x > vx0 && k.x < vx1 && k.y > vy0 && k.y < vy1) list.push({ y: k.y, f: () => drawPickup(c, k, now) });
    for (const e of R.enemies) {
      if (e.dead || e.x < vx0 || e.x > vx1 || e.y < vy0 || e.y > vy1) continue;
      list.push({ y: e.y, f: () => {
        c.save(); c.translate(e.x, e.y);
        if (e.flash > 0) c.filter = 'brightness(2.4)';
        drawEnemy(c, e, now);
        c.restore(); c.filter = 'none';
        // Lebensbalken
        if (e.state === 'awake' && (e.hp < e.maxHp || e.elite) && !e.boss) {
          const w = Math.max(30, e.r * 2.6), yy = e.y - e.r * 3.4 - 8;
          c.fillStyle = 'rgba(0,0,0,0.7)'; c.fillRect(e.x - w / 2 - 1, yy - 1, w + 2, 6);
          c.fillStyle = e.elite ? e.tint : '#b3262c'; c.fillRect(e.x - w / 2, yy, w * Math.max(0, e.hp / e.maxHp), 4);
          if (e.elite && Math.hypot(e.x - p.x, e.y - p.y) < 420) text(c, e.name, e.x, yy - 9, 12, e.tint, 'center', 'bold');
        }
      } });
    }
    list.push({ y: p.y, f: () => drawPlayer(c, R, now) });
    list.sort((a, b) => a.y - b.y);
    let li = 0;
    while (li < list.length && list[li].y < y0 * T) list[li++].f();
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) if (!map.tiles[y * map.w + x] && wallVisible(map, x, y)) drawWall(c, map, x, y, zoneAt(map, x, y));
      while (li < list.length && list[li].y < (y + 1) * T) list[li++].f();
    }
    while (li < list.length) list[li++].f();
    drawFxAbove(c, R, now);
    // schwebende Zahlen
    for (const t of R.texts) {
      const k = t.t / t.life; c.globalAlpha = Math.min(1, (1 - k) * 2);
      text(c, t.text, t.x, t.y, t.size * (k < 0.12 ? 1 + (0.12 - k) * 4 : 1), t.color, 'center', 'bold');
    }
    c.globalAlpha = 1;
    c.restore();
    drawLighting(c, R, now, cx, cy);
    if (R.flash > 0) { c.fillStyle = `rgba(160,0,0,${R.flash * 0.45})`; c.fillRect(0, 0, W, H); }
    // Vignette
    const vg = c.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 0.95); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    c.fillStyle = vg; c.fillRect(0, 0, W, H);
    drawHud(c, R, now);
  }

  /* ------------------------------------------------------------ HUD */
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

  const SPELL_ICON = {
    fire(c, x, y, col) { c.fillStyle = col; c.beginPath(); c.moveTo(x, y - 17); c.quadraticCurveTo(x + 14, y - 2, x + 8, y + 10); c.quadraticCurveTo(x, y + 16, x - 8, y + 10); c.quadraticCurveTo(x - 14, y - 2, x, y - 17); c.fill(); c.fillStyle = '#fff2b0'; c.beginPath(); c.ellipse(x, y + 6, 4, 7, 0, 0, TAU); c.fill(); },
    nova(c, x, y, col) { c.strokeStyle = col; c.lineWidth = 2.5; c.lineCap = 'round'; for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3; c.beginPath(); c.moveTo(x + Math.cos(a) * 16, y + Math.sin(a) * 16); c.lineTo(x - Math.cos(a) * 16, y - Math.sin(a) * 16); c.stroke(); } c.beginPath(); c.arc(x, y, 8, 0, TAU); c.stroke(); },
    chain(c, x, y, col) { c.strokeStyle = col; c.lineWidth = 3.5; c.lineJoin = 'round'; c.beginPath(); c.moveTo(x + 4, y - 17); c.lineTo(x - 7, y + 1); c.lineTo(x + 2, y + 1); c.lineTo(x - 5, y + 17); c.lineTo(x + 9, y - 4); c.lineTo(x, y - 4); c.closePath(); c.fillStyle = col; c.fill(); },
    meteor(c, x, y, col) { c.strokeStyle = col; c.lineWidth = 6; c.lineCap = 'round'; c.beginPath(); c.moveTo(x - 14, y - 14); c.lineTo(x - 2, y - 2); c.stroke(); circ(c, x + 4, y + 4, 10, '#6b3b22'); circ(c, x + 4, y + 4, 6, col); },
    wrath(c, x, y, col) { c.fillStyle = col; c.beginPath(); for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8 - Math.PI / 2, rad = i % 2 ? 6 : 17; c.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); } c.closePath(); c.fill(); },
  };

  function drawHud(c, R, now) {
    const S = R.S, p = R.p, sv = Save.data;
    // Orbs
    orb(c, 104, 618, 70, p.hp / S.maxHp, ['#ff7a7a', '#d61f2a', '#5a0a10'], now, `${Math.ceil(p.hp)} / ${Math.round(S.maxHp)}`);
    const hasMana = S.maxMana > 0;
    orb(c, W - 104, 618, 70, hasMana ? p.mana / S.maxMana : 0, ['#9fd0ff', '#2f7fe8', '#0f2f6a'], now, hasMana ? `${Math.floor(p.mana)} / ${Math.round(S.maxMana)}` : '', !hasMana);
    if (!hasMana) {
      c.fillStyle = 'rgba(10,8,12,0.55)'; c.beginPath(); c.arc(W - 104, 618, 69, 0, TAU); c.fill();
      if (sv.level < LOS.BAL.magicUnlockLevel) { text(c, 'Magie', W - 104, 604, 15, '#8d96ad', 'center', 'bold'); text(c, `ab Stufe ${LOS.BAL.magicUnlockLevel}`, W - 104, 626, 14, '#8d96ad', 'center', 'bold'); }
      else { text(c, 'Keine', W - 104, 604, 14, '#8d96ad', 'center', 'bold'); text(c, 'Zauberpunkte', W - 104, 624, 14, '#8d96ad', 'center', 'bold'); }
    }
    // Zauberleiste
    const bx = W / 2 - 5 * 33 - 1, by = 640;
    for (let i = 0; i < 5; i++) {
      const sp = LOS.SPELLS[i], x = bx + i * 68, un = S.mag >= sp.unlock;
      rrect(c, x, by, 62, 62, 8, 'rgba(14,11,10,0.9)');
      c.strokeStyle = R.sel === i && un ? '#ffe08a' : '#6a5224'; c.lineWidth = R.sel === i && un ? 3 : 2; c.beginPath(); c.roundRect(x, by, 62, 62, 8); c.stroke();
      if (un) {
        SPELL_ICON[sp.id](c, x + 31, by + 31, sp.color);
        const cdf = R.cd[i] > 0 ? R.cd[i] / sp.cd : 0;
        if (cdf > 0) { c.fillStyle = 'rgba(0,0,0,0.65)'; c.beginPath(); c.moveTo(x + 31, by + 31); c.arc(x + 31, by + 31, 46, -Math.PI / 2, -Math.PI / 2 + TAU * cdf); c.closePath(); c.save(); c.beginPath(); c.roundRect(x + 1, by + 1, 60, 60, 7); c.clip(); c.beginPath(); c.moveTo(x + 31, by + 31); c.arc(x + 31, by + 31, 46, -Math.PI / 2, -Math.PI / 2 + TAU * cdf); c.closePath(); c.fill(); c.restore(); }
        if (p.mana < sp.cost) { c.fillStyle = 'rgba(20,40,90,0.55)'; c.beginPath(); c.roundRect(x + 1, by + 1, 60, 60, 7); c.fill(); }
        text(c, String(sp.cost), x + 51, by + 52, 12, '#9fd0ff', 'center', 'bold');
      } else {
        SPELL_ICON[sp.id](c, x + 31, by + 31, '#3b3733');
        text(c, String(sp.unlock), x + 31, by + 31, 17, '#8d8678', 'center', 'bold');
        c.fillStyle = 'rgba(8,7,8,0.5)'; c.beginPath(); c.roundRect(x + 1, by + 1, 60, 60, 7); c.fill();
        text(c, String(sp.unlock), x + 31, by + 31, 17, '#a99f8a', 'center', 'bold');
      }
      text(c, sp.key, x + 9, by + 9, 12, '#d9cba0', 'center', 'bold');
    }
    // XP-Leiste
    const need = sv.level >= LOS.BAL.maxLevel ? 1 : LOS.xpNeed(sv.level), frac = sv.level >= LOS.BAL.maxLevel ? 1 : sv.xp / need;
    const xw = 520, xx = W / 2 - xw / 2, xy = 710;
    c.fillStyle = 'rgba(0,0,0,0.75)'; c.fillRect(xx - 2, xy - 2, xw + 4, 10);
    const xg = c.createLinearGradient(xx, 0, xx + xw, 0); xg.addColorStop(0, '#6a3ab8'); xg.addColorStop(1, '#b07aff');
    c.fillStyle = xg; c.fillRect(xx, xy, xw * frac, 6);
    c.strokeStyle = '#6a5224'; c.lineWidth = 1; c.strokeRect(xx - 2.5, xy - 2.5, xw + 5, 11);
    text(c, `Stufe ${sv.level}  ·  ${Math.floor(sv.xp)} / ${need} XP`, W / 2, xy - 12, 12, '#d9c8ff', 'center', 'bold');
    // oben links
    const room = R.map.rooms[R.room], z = ZONES[room.zone];
    text(c, z.name, 24, 28, 20, z.accent, 'left', 'bold');
    text(c, `Raum ${R.room + 1} / ${LOS.NUM_ROOMS}  ·  ${LOS.DIFFS[R.diff].name}`, 24, 52, 14, '#cbbf9c', 'left', 'normal');
    text(c, `Besiegt ${R.kills}   ·   +${Math.floor(R.xpGained)} XP`, 24, 72, 14, '#cbbf9c', 'left', 'normal');
    if (sv.unspent > 0) text(c, `${sv.unspent} Statuspunkt${sv.unspent > 1 ? 'e' : ''} verfügbar`, 24, 94, 14, '#ffe08a', 'left', 'bold');
    // Boss
    if (R.boss && R.bossActive && !R.boss.dead) {
      const b = R.boss, bw = 640, bxx = W / 2 - bw / 2, byy = 36;
      text(c, b.name, W / 2, byy - 14, 20, '#ff8a6a', 'center', 'bold');
      c.fillStyle = 'rgba(0,0,0,0.8)'; c.fillRect(bxx - 3, byy - 3, bw + 6, 20);
      const bg = c.createLinearGradient(0, byy, 0, byy + 14); bg.addColorStop(0, '#d62a2a'); bg.addColorStop(1, '#6a0f12');
      c.fillStyle = bg; c.fillRect(bxx, byy, bw * Math.max(0, b.hp / b.maxHp), 14);
      c.strokeStyle = '#c9a24a'; c.lineWidth = 2; c.strokeRect(bxx - 3, byy - 3, bw + 6, 20);
    }
    drawMinimap(c, R, now);
    // Banner
    if (R.banner) {
      const b = R.banner, k = b.t / b.life, a = k < 0.12 ? k / 0.12 : k > 0.8 ? (1 - k) / 0.2 : 1;
      c.globalAlpha = Math.max(0, a);
      const yb = 168;
      const g = c.createLinearGradient(W / 2 - 360, 0, W / 2 + 360, 0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, 'rgba(0,0,0,0.6)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.fillRect(W / 2 - 360, yb - 38, 720, 90);
      text(c, b.title, W / 2, yb, 38, b.color, 'center', 'bold');
      if (b.sub) text(c, b.sub, W / 2, yb + 36, 17, '#e6dcc0', 'center', 'normal');
      c.globalAlpha = 1;
    }
    if (R.over === 'dead') {
      const k = Math.min(1, R.overT / 1.2);
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

  /* ------------------------------------------------------------ Lager-Hintergrund */
  const stars = Array.from({ length: 140 }, (_, i) => ({ x: hash(i, 1) * W, y: hash(i, 2) * 420, r: 0.4 + hash(i, 3) * 1.4, s: hash(i, 4) * 6 }));
  const sparks = [];
  function drawCamp(c, now, dt, inCamp) {
    const ys = inCamp ? -170 : 30;
    c.save(); c.translate(0, ys);
    const sky = c.createLinearGradient(0, -200, 0, H + 200); sky.addColorStop(0, '#05060f'); sky.addColorStop(0.5, '#121226'); sky.addColorStop(1, '#1b1420');
    c.fillStyle = sky; c.fillRect(0, -300, W, H + 600);
    for (const s of stars) { c.globalAlpha = 0.5 + 0.5 * Math.sin(now * 1.5 + s.s); c.fillStyle = '#e8ecff'; c.fillRect(s.x, s.y - 100, s.r, s.r); }
    c.globalAlpha = 1;
    // Mond
    const mg = c.createRadialGradient(1010, 120, 10, 1010, 120, 120); mg.addColorStop(0, 'rgba(230,235,255,0.35)'); mg.addColorStop(1, 'rgba(230,235,255,0)');
    c.fillStyle = mg; c.beginPath(); c.arc(1010, 120, 120, 0, TAU); c.fill(); circ(c, 1010, 120, 34, '#e4e8f6'); circ(c, 1000, 112, 6, '#c4c9de'); circ(c, 1022, 130, 4, '#c4c9de');
    // Berge
    c.fillStyle = '#0a0a14'; c.beginPath(); c.moveTo(0, 470); for (let x = 0; x <= W; x += 40) c.lineTo(x, 400 - Math.sin(x * 0.011) * 60 - Math.sin(x * 0.031) * 24); c.lineTo(W, 520); c.lineTo(0, 520); c.fill();
    c.fillStyle = '#0d0d18'; c.beginPath(); c.moveTo(0, 520); for (let x = 0; x <= W; x += 40) c.lineTo(x, 470 - Math.sin(x * 0.017 + 2) * 40); c.lineTo(W, 560); c.lineTo(0, 560); c.fill();
    // Boden
    const gr = c.createLinearGradient(0, 520, 0, H + 200); gr.addColorStop(0, '#1e1a1a'); gr.addColorStop(1, '#0c0909'); c.fillStyle = gr; c.fillRect(0, 520, W, H + 300);
    // Dungeon-Eingang (Mitte)
    c.fillStyle = '#1b1a20'; c.beginPath(); c.moveTo(500, 540); c.lineTo(500, 420); c.quadraticCurveTo(640, 290, 780, 420); c.lineTo(780, 540); c.fill();
    c.fillStyle = '#050304'; c.beginPath(); c.moveTo(540, 540); c.lineTo(540, 440); c.quadraticCurveTo(640, 355, 740, 440); c.lineTo(740, 540); c.fill();
    const eg = c.createRadialGradient(640, 520, 5, 640, 520, 170); eg.addColorStop(0, `rgba(255,70,30,${0.38 + 0.1 * Math.sin(now * 3)})`); eg.addColorStop(1, 'rgba(255,70,30,0)'); c.fillStyle = eg; c.fillRect(440, 340, 400, 260);
    c.strokeStyle = '#2e2c36'; c.lineWidth = 7; c.beginPath(); c.moveTo(500, 540); c.lineTo(500, 420); c.quadraticCurveTo(640, 290, 780, 420); c.lineTo(780, 540); c.stroke();
    c.fillStyle = '#2a2830'; for (const x of [500, 780]) c.fillRect(x - 12, 520, 24, 26);
    // Zelt (nur Titel)
    if (!inCamp) { c.fillStyle = '#2a2230'; c.beginPath(); c.moveTo(130, 560); c.lineTo(250, 430); c.lineTo(370, 560); c.fill(); c.fillStyle = '#120d16'; c.beginPath(); c.moveTo(210, 560); c.lineTo(250, 480); c.lineTo(290, 560); c.fill(); }
    // Lagerfeuer
    const fx = 640, fy = 600;
    const fg = c.createRadialGradient(fx, fy - 20, 10, fx, fy - 20, 360); fg.addColorStop(0, `rgba(255,150,60,${0.5 + 0.08 * Math.sin(now * 9)})`); fg.addColorStop(1, 'rgba(255,100,30,0)');
    c.fillStyle = fg; c.fillRect(fx - 360, fy - 380, 720, 740);
    ell(c, fx, fy + 6, 52, 14, 'rgba(0,0,0,0.5)');
    limb(c, fx - 34, fy + 4, fx + 30, fy - 8, 11, '#3a2616'); limb(c, fx + 34, fy + 4, fx - 28, fy - 8, 11, '#2f1f12');
    for (let i = 0; i < 3; i++) {
      const o = [-14, 0, 14][i], hgt = [46, 70, 40][i] + Math.sin(now * (9 + i * 3)) * 9;
      const g = c.createLinearGradient(0, fy - hgt, 0, fy); g.addColorStop(0, 'rgba(255,230,120,0)'); g.addColorStop(0.35, i === 1 ? '#ffb347' : '#ff8a2a'); g.addColorStop(1, '#d6381c');
      c.fillStyle = g; c.beginPath(); c.moveTo(fx + o - 15, fy - 4); c.quadraticCurveTo(fx + o - 6 + Math.sin(now * 7 + i) * 4, fy - hgt * 0.6, fx + o + Math.sin(now * 5 + i) * 5, fy - hgt); c.quadraticCurveTo(fx + o + 8, fy - hgt * 0.5, fx + o + 15, fy - 4); c.fill();
    }
    if (Math.random() < 0.5) sparks.push({ x: fx + (Math.random() - 0.5) * 30, y: fy - 30, vx: (Math.random() - 0.5) * 30, vy: -40 - Math.random() * 70, l: 1 + Math.random() });
    for (const s of sparks) { s.l -= dt; s.x += s.vx * dt + Math.sin(now * 3 + s.y) * 0.3; s.y += s.vy * dt; c.fillStyle = `rgba(255,${160 + s.l * 40 | 0},60,${Math.max(0, s.l)})`; c.fillRect(s.x, s.y, 2, 2); }
    for (let i = sparks.length - 1; i >= 0; i--) if (sparks[i].l <= 0) sparks.splice(i, 1);
    // Krieger am Feuer
    const fake = { anim: now, moving: false, dirX: 1, hurtT: 0, swingT: -1, x: 560, y: fy + 18, face: 0, swingDur: 0.3, swingDir: 0 };
    const S = LOS.derive(1, { atk: 0, def: 0, vit: 0, mag: 0 }, []);
    drawPlayer(c, { p: fake, S }, now);
    c.restore();
  }

  return { init, drawRun, drawCamp, text };
})();
