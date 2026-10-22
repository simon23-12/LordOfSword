/* Lord of Sword – Eingabe, Hauptschleife, Skalierung */
const Input = { keys: {}, mx: 640, my: 360, wx: 0, wy: 0, down: false, rdown: false, interact: false, hover: null, spellQueue: [] };

(function () {
  'use strict';
  const stage = document.getElementById('stage');
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  let quality = 0, glScale = 1, glApplied = 0, slow = 0, fpsAvg = 60, warm = 3;

  /* ---------------------------------------------------------- Skalierung (Auflösung folgt Fenstergröße und Pixeldichte) */
  function resize() {
    const s = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
    App.scale = s;
    stage.style.transform = `translate(${(window.innerWidth - 1280 * s) / 2}px, ${(window.innerHeight - 720 * s) / 2}px) scale(${s})`;
    const q = Math.max(1, Math.min(2, Math.round(s * (window.devicePixelRatio || 1) * 4) / 4));
    if (q !== quality) {
      quality = q;
      canvas.width = Math.round(1280 * q); canvas.height = Math.round(720 * q);
    }
    const gq = Math.round(Math.max(0.5, q * glScale) * 20) / 20;
    if (gq !== glApplied) { glApplied = gq; Render.setQuality(gq); }
  }
  /** Läuft das Spiel dauerhaft zu langsam, sinkt die 3D-Auflösung schrittweise (bis 50 %). */
  function watchPerformance(dt) {
    if (warm > 0) { warm -= dt; return; }
    fpsAvg += (1 / Math.max(dt, 0.001) - fpsAvg) * 0.05;
    if (fpsAvg < 38 && glScale > 0.5) { slow += dt; if (slow > 2.5) { slow = 0; glScale = Math.max(0.5, glScale * 0.8); fpsAvg = 60; warm = 1.5; resize(); } }
    else slow = 0;
  }
  window.addEventListener('resize', resize);

  /* ---------------------------------------------------------- Eingabe */
  function mousePos(e) {
    const r = canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) / App.scale, y = (e.clientY - r.top) / App.scale;
    if (isFinite(x) && isFinite(y)) { Input.mx = x; Input.my = y; }
  }
  canvas.addEventListener('mousedown', e => {
    Sound.init();
    mousePos(e);
    if (App.mode !== 'run' || App.paused) return;
    if (e.button === 0) Input.down = true;   // links: Schwerthieb Richtung Mauszeiger
    if (e.button === 2) Input.rdown = true;  // rechts: hinlaufen
    e.preventDefault();
  });
  window.addEventListener('mouseup', e => {
    if (e.button === 0) Input.down = false;
    if (e.button === 2) Input.rdown = false;
  });
  window.addEventListener('mousemove', e => { mousePos(e); });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  stage.addEventListener('pointerdown', () => {
    if (!Sound.ready) { Sound.init(); if (App.mode === 'title' || App.mode === 'camp') Sound.play('camp'); }
  });

  window.addEventListener('keydown', e => {
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName) && e.target.type !== 'range') return;
    Input.keys[e.code] = true;
    const acts = Keys.actionsFor(e.code);
    if (acts.length || ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (e.code === 'Escape') {
      if (App.keysOpen) App.closeKeys();
      else if (App.settingsOpen) App.closeSettings();
      else if (App.mode === 'run') App.setPause(!App.paused);
    }
    if (e.repeat) return;
    for (const a of acts) {
      if (a === 'fullscreen') Keys.toggleFullscreen();
      else if (a === 'mute') { Sound.init(); Sound.toggleMute(); }
      else if (App.mode === 'run' && !App.paused) {
        if (a === 'interact') Input.interact = true;
        else if (/^spell[1-5]$/.test(a)) Input.spellQueue.push(+a[5] - 1);
      }
    }
  });
  window.addEventListener('keyup', e => { Input.keys[e.code] = false; });
  window.addEventListener('blur', () => {
    Input.keys = {}; Input.down = false; Input.rdown = false;
    if (App.mode === 'run') App.setPause(true);
  });

  /* ---------------------------------------------------------- Start */
  Save.load();
  if (Save.data) { Sound.setMusicVol(Save.data.settings.music); Sound.setSfxVol(Save.data.settings.sfx); }
  else { Save.create(); Save.wipe(); } // Standardwerte bereithalten, aber noch nichts speichern
  Render.init();
  resize();
  App.init();
  App.toTitle();

  let last = performance.now();
  function frame(t) {
    const dt = Math.min(0.1, (t - last) / 1000); last = t;
    const now = t / 1000;
    if (!document.hidden && dt < 0.1) watchPerformance(dt);
    try {
      ctx.setTransform(quality, 0, 0, quality, 0, 0);
      if ((App.mode === 'run' || App.mode === 'end') && Game.R) {
        if (App.mode === 'run' && !App.paused) { Render.pointer(Game.R); Game.update(dt); }
        Render.drawRun(ctx, Game.R, now);
      } else {
        Render.drawCamp(ctx, now, dt, App.mode === 'camp');
      }
    } catch (err) {
      console.error(err);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  window.LOSDEBUG = { Game, Save, App, Sound, Render, Input, THREE };
})();
