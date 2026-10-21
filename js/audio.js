/* Lord of Sword – komplett synthetische Musik und Soundeffekte (Web Audio, keine Samples).
 * Themes: camp (wehmütige Gitarre in a-Moll), dungeon (dunkle Drones, Glocken, Herzschlag,
 * Kampf-Intensität), boss (Kriegstrommeln, Blechstöße, Chor). */
const Sound = (function () {
  'use strict';
  let ctx = null, master, comp, musicBus, sfxBus, verb, verbIn, noiseBuf;
  const vol = { music: 0.6, sfx: 0.8, muted: false };
  let theme = null, themeName = 'none', timer = null, nextT = 0, stepN = 0;
  let zone = 0, intensity = 0, targetIntensity = 0;
  const lastSfx = {};

  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];

  /* ---------------------------------------------------------------- Setup */
  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 4; comp.attack.value = 0.01; comp.release.value = 0.25;
    comp.connect(master); master.connect(ctx.destination);
    musicBus = ctx.createGain(); sfxBus = ctx.createGain();
    musicBus.connect(comp); sfxBus.connect(comp);
    // Hall
    verb = ctx.createConvolver();
    verb.buffer = makeImpulse(3.4, 2.6);
    verbIn = ctx.createGain(); verbIn.gain.value = 1;
    const vOut = ctx.createGain(); vOut.gain.value = 0.9;
    verbIn.connect(verb); verb.connect(vOut); vOut.connect(musicBus);
    // Rauschpuffer
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    applyVolumes();
    timer = setInterval(tick, 70);
    document.addEventListener('visibilitychange', () => {
      if (!ctx) return;
      if (document.hidden) ctx.suspend(); else ctx.resume();
    });
  }

  function makeImpulse(sec, decay) {
    const len = Math.floor(ctx.sampleRate * sec);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const n = Math.random() * 2 - 1;
        lp += (n - lp) * (0.55 - 0.45 * (i / len)); // wird dunkler
        d[i] = lp * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  function applyVolumes() {
    if (!ctx) return;
    const m = vol.muted ? 0 : 1;
    musicBus.gain.setTargetAtTime(vol.music * 1.5 * m, ctx.currentTime, 0.05);
    sfxBus.gain.setTargetAtTime(vol.sfx * 1.05 * m, ctx.currentTime, 0.05);
  }

  /* ---------------------------------------------------------------- Bausteine */
  function makeBus() {
    const out = ctx.createGain(); out.gain.value = 0;     // Fade-Regler des ganzen Themas
    const dry = ctx.createGain(); dry.connect(out); out.connect(musicBus);
    const wet = ctx.createGain(); wet.connect(verbIn);       // Hall-Send (wird beim Ausblenden mit abgedreht)
    return { dry, wet, out };
  }
  function route(node, bus, wetAmt) {
    node.connect(bus.dry);
    if (wetAmt > 0) { const g = ctx.createGain(); g.gain.value = wetAmt; node.connect(g); g.connect(bus.wet); }
  }

  function envGain(t, a, peak, dur, end) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(end || 0.0001, t + dur);
    return g;
  }
  function osc(type, f, t, dur, detune) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (detune) o.detune.value = detune;
    o.start(t); o.stop(t + dur + 0.1);
    return o;
  }
  function noiseSrc(t, dur) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    s.start(t, Math.random()); s.stop(t + dur + 0.05);
    return s;
  }

  function pluck(t, f, dur, v, bus, wet = 0.35, bright = 5) {
    const g = envGain(t, 0.006, v, dur);
    const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.Q.value = 1.5;
    fl.frequency.setValueAtTime(Math.min(9000, f * bright), t);
    fl.frequency.exponentialRampToValueAtTime(f * 1.3, t + dur * 0.7);
    const a = osc('sawtooth', f, t, dur), b = osc('triangle', f * 2, t, dur, 4), c = osc('sine', f / 2, t, dur);
    const ga = ctx.createGain(); ga.gain.value = 0.5; const gb = ctx.createGain(); gb.gain.value = 0.35; const gc = ctx.createGain(); gc.gain.value = 0.3;
    a.connect(ga); b.connect(gb); c.connect(gc); ga.connect(fl); gb.connect(fl); gc.connect(fl);
    fl.connect(g); route(g, bus, wet);
  }

  function pad(t, f, dur, v, bus, wet = 0.6, cutoff = 700) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + dur * 0.4);
    g.gain.linearRampToValueAtTime(v * 0.7, t + dur * 0.75);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = cutoff; fl.Q.value = 0.6;
    for (const dt of [-9, 0, 8]) { const o = osc('sawtooth', f, t, dur, dt); const x = ctx.createGain(); x.gain.value = 0.33; o.connect(x); x.connect(fl); }
    fl.connect(g); route(g, bus, wet);
  }

  function choir(t, f, dur, v, bus, wet = 0.9, vowel = 0) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + dur * 0.45);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const forms = vowel ? [[460, 8], [900, 8], [2500, 6]] : [[700, 9], [1100, 9], [2600, 6]];
    const lfo = osc('sine', 5.2, t, dur); const lg = ctx.createGain(); lg.gain.value = 7; lfo.connect(lg);
    for (const dt of [-6, 6]) {
      const o = osc('sawtooth', f, t, dur, dt); lg.connect(o.detune);
      for (const [ff, q] of forms) {
        const b = ctx.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = ff; b.Q.value = q;
        const x = ctx.createGain(); x.gain.value = 0.45; o.connect(b); b.connect(x); x.connect(g);
      }
    }
    route(g, bus, wet);
  }

  function bell(t, f, v, bus, wet = 0.8, dur = 5) {
    const g = ctx.createGain(); g.gain.value = 1;
    for (const [mul, amp, d] of [[1, 1, dur], [2.76, 0.45, dur * 0.5], [5.4, 0.25, dur * 0.25], [8.9, 0.12, dur * 0.12]]) {
      const o = osc('sine', f * mul, t, d); const e = envGain(t, 0.004, v * amp, d);
      o.connect(e); e.connect(g);
    }
    route(g, bus, wet);
  }

  function tom(t, f0, f1, v, dec, bus, wet = 0.3) {
    const o = osc('sine', f0, t, dec); o.frequency.exponentialRampToValueAtTime(f1, t + dec * 0.7);
    const e = envGain(t, 0.003, v, dec);
    o.connect(e);
    const n = noiseSrc(t, 0.05); const nf = ctx.createBiquadFilter(); nf.type = 'lowpass'; nf.frequency.value = 500;
    const ne = envGain(t, 0.002, v * 0.5, 0.05); n.connect(nf); nf.connect(ne);
    const sum = ctx.createGain(); e.connect(sum); ne.connect(sum);
    route(sum, bus, wet);
  }

  function bassNote(t, f, dur, v, bus, wet = 0.15, cut = 400) {
    const g = envGain(t, 0.01, v, dur);
    const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.setValueAtTime(cut * 2.2, t); fl.frequency.exponentialRampToValueAtTime(cut, t + dur * 0.6); fl.Q.value = 2;
    const a = osc('sawtooth', f, t, dur), b = osc('sine', f, t, dur);
    const x = ctx.createGain(); x.gain.value = 0.55; a.connect(x); x.connect(fl); b.connect(fl);
    fl.connect(g); route(g, bus, wet);
  }

  function brass(t, notes, dur, v, bus, wet = 0.5) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + 0.06);
    g.gain.exponentialRampToValueAtTime(v * 0.4, t + dur * 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.Q.value = 1;
    fl.frequency.setValueAtTime(500, t); fl.frequency.exponentialRampToValueAtTime(2200, t + 0.12); fl.frequency.exponentialRampToValueAtTime(900, t + dur);
    for (const n of notes) for (const dt of [-5, 5]) { const o = osc('sawtooth', mtof(n), t, dur, dt); const x = ctx.createGain(); x.gain.value = 0.2; o.connect(x); x.connect(fl); }
    fl.connect(g); route(g, bus, wet);
  }

  function strings(t, f, dur, v, bus, wet = 0.5) { // Staccato-Streicher
    const g = envGain(t, 0.012, v, dur);
    const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 1300; fl.Q.value = 0.8;
    for (const dt of [-8, 8]) { const o = osc('sawtooth', f, t, dur, dt); const x = ctx.createGain(); x.gain.value = 0.4; o.connect(x); x.connect(fl); }
    fl.connect(g); route(g, bus, wet);
  }

  /* ---------------------------------------------------------------- Themen */
  const CAMP_CH = [
    { b: 45, t: [57, 60, 64] }, { b: 41, t: [53, 57, 60] }, { b: 48, t: [55, 60, 64] }, { b: 43, t: [55, 59, 62] },
    { b: 45, t: [57, 60, 64] }, { b: 41, t: [53, 57, 60] }, { b: 48, t: [55, 60, 64] }, { b: 40, t: [56, 59, 64] },
  ];
  const CAMP_MEL = [
    [0, 69, 3], [3, 72, 1], [4, 71, 2], [6, 69, 2],
    [8, 72, 3], [11, 69, 1], [12, 65, 4],
    [16, 67, 2], [18, 72, 2], [20, 71, 2], [22, 67, 2],
    [24, 74, 3], [27, 71, 1], [28, 67, 4],
    [32, 69, 2], [34, 76, 2], [36, 74, 2], [38, 72, 2],
    [40, 72, 3], [43, 69, 1], [44, 65, 2], [46, 69, 2],
    [48, 67, 2], [50, 64, 2], [52, 67, 2], [54, 72, 2],
    [56, 71, 3], [59, 68, 1], [60, 69, 4],
  ];
  const campTheme = {
    bpm: 66, sub: 2,
    play(step, t, bus) {
      const sd = 60 / this.bpm / this.sub;
      const bar = Math.floor(step / 8) % 8, s = step % 8, ph = step % 64;
      const ch = CAMP_CH[bar];
      if (s === 0) {
        pluck(t, mtof(ch.b), sd * 7, 0.38, bus, 0.25, 3);
        if (bar % 2 === 0) {
          for (const n of ch.t) pad(t, mtof(n - 12), sd * 15, 0.05, bus, 0.8, 600);
          choir(t, mtof(ch.t[1]), sd * 15, 0.035, bus, 1, bar % 4 === 0 ? 0 : 1);
          tom(t, 95, 48, 0.32, 0.9, bus, 0.5);
        }
      } else {
        const idx = [0, 0, 1, 2, 1, 2, 1, 0][s];
        pluck(t, mtof(ch.t[idx]), sd * 3.2, 0.2, bus, 0.35, 4);
      }
      for (const m of CAMP_MEL) if (m[0] === ph) pluck(t, mtof(m[1] + 12), sd * m[2] * 1.25, 0.2, bus, 0.55, 7);
      if (Math.random() < 0.05) { // Lagerfeuer knistert
        const n = noiseSrc(t, 0.05); const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2500;
        const e = envGain(t, 0.002, rnd(0.02, 0.06), 0.04); n.connect(f); f.connect(e); route(e, bus, 0.1);
      }
    },
  };

  const DUN_ROOTS = [38, 36, 40, 37, 35]; // D, C, E, C#, H
  const DUN_PROG = [[0, 'm'], [-4, 'm'], [-7, 'm'], [-5, 'M']];
  const PHRYG = [0, 1, 3, 5, 7, 8, 10, 12, 13, 15];
  const dungeonTheme = {
    bpm: 56, sub: 4,
    play(step, t, bus) {
      const sd = 60 / this.bpm / this.sub;
      const root = DUN_ROOTS[zone] || 38;
      const bar = Math.floor(step / 16), s = step % 16;
      const chordIdx = Math.floor(bar / 2) % 4;
      const [off, kind] = DUN_PROG[chordIdx];
      const croot = root + off;
      if (step % 32 === 0) {
        const ivs = kind === 'm' ? [0, 3, 7] : [0, 4, 7];
        for (const i of ivs) pad(t, mtof(croot + 12 + i), sd * 32, 0.05, bus, 0.8, 520);
        bassNote(t, mtof(croot - 12), sd * 32, 0.32, bus, 0.2, 140);
        choir(t, mtof(croot + 24 + (kind === 'm' ? 7 : 4)), sd * 32, 0.03, bus, 1, chordIdx % 2);
      }
      // Herzschlag
      if (s === 0) tom(t, 70, 38, 0.28 + intensity * 0.2, 0.55, bus, 0.35);
      if (s === 3) tom(t, 62, 36, 0.17 + intensity * 0.15, 0.45, bus, 0.35);
      // spärliche Melodie
      if (s % 8 === 0 && Math.random() < 0.38 - intensity * 0.15) {
        const n = root + 12 + pick(PHRYG);
        if (Math.random() < 0.55) bell(t + rnd(0, 0.3), mtof(n + 12), 0.05, bus, 0.9, 5);
        else pluck(t + rnd(0, 0.3), mtof(n), sd * 6, 0.12, bus, 0.8, 4);
      }
      // Kampf-Layer
      if (intensity > 0.2) {
        if (s % 4 === 0) tom(t, 85, 45, 0.45 * intensity, 0.4, bus, 0.25);
        if (s % 4 === 2 && intensity > 0.45) tom(t, 130, 70, 0.22 * intensity, 0.25, bus, 0.2);
        if (s % 2 === 0) bassNote(t, mtof(croot - 12 + ([0, 0, 0, 1][(s >> 1) % 4])), sd * 1.6, 0.26 * intensity, bus, 0.1, 300);
        if (s === 0 && intensity > 0.55) brass(t, [croot, croot + 7, croot + 12], sd * 6, 0.07 * intensity, bus, 0.6);
        if (s % 8 === 4 && intensity > 0.7) strings(t, mtof(croot + 24), sd * 2, 0.07, bus, 0.5);
      }
    },
  };

  const BOSS_OFFS = [0, 0, 1, 0, -2, 0, 3, 1];
  const bossTheme = {
    bpm: 100, sub: 4,
    play(step, t, bus) {
      const sd = 60 / this.bpm / this.sub;
      const bar = Math.floor(step / 16), s = step % 16;
      const root = 38 + BOSS_OFFS[bar % 8];
      if (s % 4 === 0) tom(t, 90, 42, s === 0 ? 0.9 : 0.6, 0.5, bus, 0.35);
      if ([6, 10, 14].includes(s)) tom(t, 120, 60, 0.4, 0.3, bus, 0.3);
      if (s === 7 || s === 15) tom(t, 160, 80, 0.25, 0.2, bus, 0.3);
      const pat = [1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0];
      if (pat[s]) strings(t, mtof(root - 12 + (s % 8 === 5 ? 1 : 0)), sd * 1.5, 0.12, bus, 0.3);
      if (s === 0) {
        brass(t, [root, root + 7, root + 12], sd * 6, 0.1, bus, 0.6);
        bassNote(t, mtof(root - 24), sd * 14, 0.4, bus, 0.2, 160);
      }
      if (s === 8) brass(t, [root + 1, root + 8, root + 13], sd * 4, 0.08, bus, 0.6);
      if (s === 0 && bar % 2 === 0) choir(t, mtof(root + 24 + pick([0, 1, 3])), sd * 30, 0.05, bus, 1, bar % 4 === 0 ? 0 : 1);
      if (s === 0 && bar % 4 === 2) bell(t, mtof(root + 36), 0.05, bus, 0.9, 5);
    },
  };

  const themes = { camp: campTheme, dungeon: dungeonTheme, boss: bossTheme };

  function tick() {
    if (!ctx || !theme) return;
    intensity += (targetIntensity - intensity) * 0.08;
    const sd = 60 / theme.def.bpm / theme.def.sub;
    if (nextT < ctx.currentTime - 0.5) nextT = ctx.currentTime + 0.05;
    while (nextT < ctx.currentTime + 0.4) {
      theme.def.play(stepN, nextT, theme.bus);
      nextT += sd; stepN++;
    }
  }

  function play(name) {
    if (!ctx || name === themeName) return;
    themeName = name;
    const now = ctx.currentTime;
    if (theme) {
      theme.bus.out.gain.cancelScheduledValues(now);
      theme.bus.out.gain.setTargetAtTime(0, now, 0.5);
      theme.bus.wet.gain.setTargetAtTime(0, now, 0.5);
      const old = theme; setTimeout(() => { try { old.bus.out.disconnect(); old.bus.wet.disconnect(); } catch (e) { /* weg damit */ } }, 5000);
    }
    theme = null;
    if (name === 'none' || !themes[name]) return;
    const bus = makeBus();
    bus.out.gain.setValueAtTime(0, now);
    bus.out.gain.setTargetAtTime(1, now + 0.2, 0.8);
    theme = { def: themes[name], bus };
    stepN = 0; nextT = now + 0.15;
  }

  /* ---------------------------------------------------------------- Effekte */
  function gate(name, gap) {
    if (!ctx) return false;
    const n = ctx.currentTime;
    if (lastSfx[name] && n - lastSfx[name] < (gap || 0.04)) return false;
    lastSfx[name] = n; return true;
  }
  function sfxOut(node, wet) {
    node.connect(sfxBus);
    if (wet) { const g = ctx.createGain(); g.gain.value = wet; node.connect(g); g.connect(verbIn); }
  }
  function nz(t, dur, type, f, q, v, attack = 0.003, wet = 0) {
    const n = noiseSrc(t, dur); const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q || 1;
    const e = envGain(t, attack, v, dur); n.connect(fl); fl.connect(e); sfxOut(e, wet); return fl;
  }
  function tone(t, type, f0, f1, dur, v, wet = 0, attack = 0.004) {
    const o = osc(type, f0, t, dur); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const e = envGain(t, attack, v, dur); o.connect(e); sfxOut(e, wet);
  }
  function sfxBell(t, f, v, dur) {
    const g = ctx.createGain();
    for (const [mul, amp, d] of [[1, 1, dur], [2.76, 0.4, dur * 0.5], [5.4, 0.2, dur * 0.25]]) {
      const o = osc('sine', f * mul, t, d); const e = envGain(t, 0.004, v * amp, d); o.connect(e); e.connect(g);
    }
    sfxOut(g, 0.4);
  }

  const SFX = {
    swing(t) { const f = nz(t, 0.14, 'bandpass', 1400, 1.2, 0.16, 0.02); f.frequency.exponentialRampToValueAtTime(380, t + 0.14); },
    hit(t) { nz(t, 0.07, 'lowpass', 1800, 0.8, 0.28); tone(t, 'sine', rnd(150, 190), 55, 0.12, 0.35); },
    crit(t) { nz(t, 0.1, 'highpass', 2500, 0.8, 0.22); tone(t, 'sine', 220, 60, 0.18, 0.45); tone(t, 'triangle', 900, 500, 0.12, 0.12); },
    hurt(t) { tone(t, 'sawtooth', 240, 80, 0.22, 0.22); nz(t, 0.1, 'lowpass', 700, 1, 0.2); },
    die(t) { nz(t, 0.28, 'lowpass', 900, 0.8, 0.25); tone(t, 'sine', rnd(200, 260), 45, 0.28, 0.3); },
    orb(t) { tone(t, 'sine', 520, 520, 0.08, 0.15, 0.2); tone(t + 0.07, 'sine', 780, 780, 0.12, 0.15, 0.3); },
    mana(t) { tone(t, 'sine', 700, 700, 0.08, 0.13, 0.3); tone(t + 0.07, 'sine', 1050, 1050, 0.14, 0.13, 0.4); },
    rune(t) { sfxBell(t, 880, 0.18, 1.8); sfxBell(t + 0.12, 1320, 0.12, 1.5); },
    levelup(t) { [72, 76, 79, 84, 88].forEach((n, i) => sfxBell(t + i * 0.1, mtof(n), 0.16, 2.6)); },
    fire(t) { const f = nz(t, 0.35, 'bandpass', 500, 0.9, 0.25, 0.03, 0.1); f.frequency.exponentialRampToValueAtTime(1600, t + 0.3); tone(t, 'sawtooth', 180, 70, 0.3, 0.12); },
    boom(t) { nz(t, 0.45, 'lowpass', 700, 0.7, 0.4, 0.004, 0.2); tone(t, 'sine', 90, 30, 0.5, 0.55); },
    nova(t) { tone(t, 'sine', 1800, 300, 0.6, 0.2, 0.5); nz(t, 0.5, 'highpass', 3000, 1, 0.14, 0.02, 0.3); [1500, 2100, 2800].forEach((f, i) => tone(t + i * 0.04, 'triangle', f, f * 0.8, 0.4, 0.07, 0.5)); },
    chain(t) { for (let i = 0; i < 9; i++) nz(t + i * 0.035, 0.05, 'highpass', 2000 + rnd(0, 3000), 1.5, 0.18); tone(t, 'square', 120, 60, 0.3, 0.08); },
    meteor(t) { tone(t, 'sine', 120, 28, 0.9, 0.5, 0.3); nz(t, 0.8, 'lowpass', 500, 0.8, 0.35, 0.02, 0.3); },
    wrath(t) { tone(t, 'sine', 55, 28, 2.2, 0.6, 0.4); nz(t, 1.6, 'bandpass', 600, 0.6, 0.3, 0.2, 0.6); [60, 64, 67, 72].forEach((n, i) => tone(t + i * 0.05, 'triangle', mtof(n), mtof(n), 1.8, 0.07, 0.8, 0.3)); },
    click(t) { tone(t, 'sine', 900, 600, 0.05, 0.12); },
    coin(t) { tone(t, 'triangle', 660, 660, 0.06, 0.14); tone(t + 0.05, 'triangle', 990, 990, 0.12, 0.14, 0.2); },
    shoot(t) { tone(t, 'triangle', 600, 250, 0.12, 0.09); },
    roar(t) { tone(t, 'sawtooth', 110, 45, 1.1, 0.3, 0.4, 0.1); tone(t, 'square', 95, 40, 1.1, 0.15, 0.4, 0.1); nz(t, 1.0, 'lowpass', 400, 1, 0.3, 0.1, 0.3); },
    slam(t) { tone(t, 'sine', 70, 25, 0.7, 0.7, 0.3); nz(t, 0.5, 'lowpass', 400, 1, 0.5, 0.004, 0.3); },
    stinger_death(t) {
      [57, 53, 48, 45].forEach((n, i) => { sfxBell(t + i * 0.45, mtof(n - 12), 0.22, 4); });
      tone(t, 'sine', 70, 28, 3, 0.5, 0.5, 0.05);
    },
    stinger_win(t) {
      [62, 66, 69, 74, 78, 81].forEach((n, i) => sfxBell(t + i * 0.14, mtof(n), 0.15, 3.6));
      [50, 57, 62].forEach(n => tone(t, 'triangle', mtof(n), mtof(n), 3.2, 0.08, 0.7, 0.3));
    },
    unlock(t) { [67, 72, 76, 79].forEach((n, i) => sfxBell(t + i * 0.08, mtof(n), 0.14, 2)); },
  };

  function sfx(name, gap) {
    if (!ctx || vol.muted || !SFX[name]) return;
    if (!gate(name, gap)) return;
    SFX[name](ctx.currentTime + 0.005);
  }

  let analyser = null, abuf = null;
  function level() { // RMS der Gesamtausgabe (Debug/Test)
    if (!ctx) return 0;
    if (!analyser) { analyser = ctx.createAnalyser(); analyser.fftSize = 2048; master.connect(analyser); abuf = new Float32Array(analyser.fftSize); }
    analyser.getFloatTimeDomainData(abuf);
    let sum = 0, peak = 0; for (const v of abuf) { sum += v * v; peak = Math.max(peak, Math.abs(v)); }
    return { rms: Math.sqrt(sum / abuf.length), peak };
  }

  return {
    init, play, sfx, level,
    setIntensity(v) { targetIntensity = Math.max(0, Math.min(1, v)); },
    setZone(z) { zone = z; },
    get theme() { return themeName; },
    setMusicVol(v) { vol.music = v; applyVolumes(); },
    setSfxVol(v) { vol.sfx = v; applyVolumes(); },
    toggleMute() { vol.muted = !vol.muted; applyVolumes(); return vol.muted; },
    get vol() { return vol; },
    get ready() { return !!ctx; },
  };
})();
