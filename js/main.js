/* Lord of Sword – Eingabe, Hauptschleife, Skalierung */
const Input = { keys: {}, mx: 640, my: 360, wx: 0, wy: 0, down: false, rclick: false, spellQueue: [] };

(function () {
  'use strict';
  const stage = document.getElementById('stage');
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  /* ---------------------------------------------------------- Skalierung */
  function resize() {
    const s = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
    App.scale = s;
    stage.style.transform = `translate(${(window.innerWidth - 1280 * s) / 2}px, ${(window.innerHeight - 720 * s) / 2}px) scale(${s})`;
  }
  window.addEventListener('resize', resize);
  resize();

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
    if (e.button === 0) Input.down = true;
    if (e.button === 2) Input.rclick = true;
    e.preventDefault();
  });
  window.addEventListener('mouseup', e => { if (e.button === 0) Input.down = false; });
  window.addEventListener('mousemove', e => { mousePos(e); });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  stage.addEventListener('pointerdown', () => {
    if (!Sound.ready) { Sound.init(); if (App.mode === 'title' || App.mode === 'camp') Sound.play('camp'); }
  });

  window.addEventListener('keydown', e => {
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName) && e.target.type !== 'range') return;
    Input.keys[e.code] = true;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (e.code === 'KeyM') { Sound.init(); Sound.toggleMute(); }
    if (e.code === 'Escape') {
      if (App.settingsOpen) App.closeSettings();
      else if (App.mode === 'run') App.setPause(!App.paused);
    }
    if (App.mode === 'run' && !App.paused && !e.repeat) {
      const m = /^(?:Digit|Numpad)([1-5])$/.exec(e.code);
      if (m) Input.spellQueue.push(+m[1] - 1);
    }
  });
  window.addEventListener('keyup', e => { Input.keys[e.code] = false; });
  window.addEventListener('blur', () => {
    Input.keys = {}; Input.down = false;
    if (App.mode === 'run') App.setPause(true);
  });

  /* ---------------------------------------------------------- Start */
  Save.load();
  if (Save.data) { Sound.setMusicVol(Save.data.settings.music); Sound.setSfxVol(Save.data.settings.sfx); }
  else { Save.create(); Save.wipe(); } // Standardwerte bereithalten, aber noch nichts speichern
  Render.init();
  App.init();
  App.toTitle();

  let last = performance.now();
  function frame(t) {
    const dt = Math.min(0.1, (t - last) / 1000); last = t;
    const now = t / 1000;
    try {
      if ((App.mode === 'run' || App.mode === 'end') && Game.R) {
        if (App.mode === 'run' && !App.paused) Game.update(dt);
        Render.drawRun(ctx, Game.R, now);
      } else {
        Render.drawCamp(ctx, now, dt, App.mode === 'camp');
      }
    } catch (err) {
      console.error(err);
      if (!window.__errShown) { window.__errShown = true; setTimeout(() => { window.__errShown = false; }, 3000); }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  window.LOSDEBUG = { Game, Save, App, Sound, Render };
})();
