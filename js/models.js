/* Lord of Sword – 3D-Modelle: Gegner, Kämpfer, Requisiten (Low-Poly aus Grundkörpern, three.js)
 * Konvention: Modelle blicken nach +x, "oben" ist +y, die rechte Seite ist +z.
 * Gegner sind in Einheiten von e.r gebaut (r = 1), der Kämpfer in Welteinheiten. */
const Models = (function () {
  'use strict';
  const PI = Math.PI, TAU = PI * 2;
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp01 = x => Math.max(0, Math.min(1, x));
  const smooth = x => { x = clamp01(x); return x * x * (3 - 2 * x); };
  const outQ = x => { x = clamp01(x); return 1 - (1 - x) * (1 - x); };

  const GEO = {
    box: new THREE.BoxGeometry(1, 1, 1),
    sph: new THREE.SphereGeometry(1, 14, 10),
    cyl: new THREE.CylinderGeometry(1, 1, 1, 12, 1),
    cone: new THREE.ConeGeometry(1, 1, 10, 1),
    oct: new THREE.OctahedronGeometry(1, 0),
    ico: new THREE.IcosahedronGeometry(1, 0),
    plane: new THREE.PlaneGeometry(1, 1),
    torus: new THREE.TorusGeometry(1, 0.1, 6, 24),
    vcyl: new THREE.CylinderGeometry(1, 0.72, 1, 16, 1),   // oben breit, unten schmal (Brust, Oberarm)
    tcyl: new THREE.CylinderGeometry(0.78, 1, 1, 16, 1),   // oben schmal, unten breit
    hemi: new THREE.SphereGeometry(1, 16, 8, 0, TAU, 0, PI / 2), // Halbkugel (Helm, Schulterplatte)
    bow: new THREE.TorusGeometry(1, 0.07, 5, 14, PI),
  };

  /* ------------------------------------------------------------ Material-Cache */
  const cache = new Map();
  /** o: t = 'l' Lambert (Standard) | 'p' Phong (glänzend) | 'b' Basic (unbeleuchtet), em = Leuchtfarbe, ei = Leuchtstärke,
   *     op = Deckkraft, sm = glatt schattiert, ds = beidseitig, add = additiv, glow = Helligkeitsfaktor (Basic) */
  function M(color, o) {
    o = o || {};
    const key = [color, o.t, o.em, o.ei, o.op, o.sm, o.sh, o.ds, o.add, o.glow, o.sp].join('|');
    let m = cache.get(key);
    if (m) return m;
    const c = new THREE.Color(color);
    const common = { transparent: (o.op !== undefined && o.op < 1) || !!o.add, opacity: o.op === undefined ? 1 : o.op, side: o.ds ? THREE.DoubleSide : THREE.FrontSide };
    if (o.t === 'b') {
      if (o.glow) c.multiplyScalar(o.glow);
      m = new THREE.MeshBasicMaterial(Object.assign(common, { color: c, blending: o.add ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: !o.add }));
    } else if (o.t === 'p') {
      m = new THREE.MeshPhongMaterial(Object.assign(common, { color: c, flatShading: !o.sm, shininess: o.sh || 60, specular: new THREE.Color(o.sp || '#555') }));
    } else {
      m = new THREE.MeshLambertMaterial(Object.assign(common, { color: c, flatShading: !o.sm }));
    }
    if (o.em && o.t !== 'b') { m.emissive = new THREE.Color(o.em); m.emissiveIntensity = o.ei === undefined ? 1 : o.ei; }
    cache.set(key, m);
    return m;
  }
  const glowM = (color, k, add) => M(color, { t: 'b', glow: k || 1.8, add: add !== false, op: add === false ? 1 : 0.9 });

  /* ------------------------------------------------------------ Baukasten */
  /** Mesh aus Grundkörper: size = [sx,sy,sz] (cyl/cone: [rx, Höhe, rz], sph: Radien), pos, rot */
  function P(parent, geo, mat, size, pos, rot) {
    const m = new THREE.Mesh(GEO[geo], mat);
    m.scale.set(size[0], size[1], size[2]);
    if (pos) m.position.set(pos[0], pos[1], pos[2]);
    if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
    m.castShadow = true;
    if (parent) parent.add(m);
    return m;
  }
  function G(parent, x, y, z) {
    const g = new THREE.Group(); g.position.set(x || 0, y || 0, z || 0);
    if (parent) parent.add(g);
    return g;
  }
  /** hängendes Glied (Zylinder) unter dem Gelenk */
  function L(parent, len, thick, mat, x, y, z) {
    return P(parent, 'cyl', mat, [thick / 2, len, thick / 2], [x || 0, (y || 0) - len / 2, z || 0]);
  }
  const eye = (c, k) => M(c, { t: 'b', glow: k || 2 });

  /* ============================================================ GEGNER */
  function humanoid(o) {
    const g = new THREE.Group(), b = o.bulk || 1;
    const skin = M(o.skin), cloth = M(o.cloth), legM = M(o.legs || o.cloth), boot = M(o.boots || '#2b2522');
    const rig = { g, h: 3.7 * (o.scale || 1), kind: 'hum', o, mv: 0 };
    rig.legL = G(g, 0, 1.15, -0.36 * b); rig.legR = G(g, 0, 1.15, 0.36 * b);
    for (const lg of [rig.legL, rig.legR]) { L(lg, 1.1, 0.5 * b, legM); P(lg, 'box', boot, [0.95, 0.3, 0.56 * b], [0.15, -1.08, 0]); }
    rig.torso = G(g, 0, 1.15, 0);
    P(rig.torso, 'box', cloth, [0.85, 1.25, 1.3 * b], [0, 0.65, 0]);
    if (o.ribs) for (let i = 0; i < 3; i++) P(rig.torso, 'box', M('#2e2a22'), [0.06, 0.1, 1.0], [0.44, 0.35 + i * 0.28, 0]);
    if (o.trim) P(rig.torso, 'box', M(o.trim), [0.9, 0.2, 1.36 * b], [0, 0.2, 0]);
    if (o.belly) P(rig.torso, 'sph', cloth, [0.75, 0.7, 0.9], [0.15, 0.4, 0]);
    if (o.pauld) for (const s of [-1, 1]) P(rig.torso, 'sph', M(o.pauld, { t: 'p' }), [0.5, 0.4, 0.5], [0, 1.15, s * 0.82 * b]);
    if (o.cape) { const cp = G(rig.torso, -0.45, 1.2, 0); rig.cape = cp; P(cp, 'box', M(o.cape, { ds: true }), [0.06, 1.7, 1.25], [0, -0.85, 0]); }
    // Arme
    const arm = (s) => {
      const sh = G(rig.torso, 0, 1.12, s * 0.88 * b);
      L(sh, 1.1, 0.36, skin); P(sh, 'sph', skin, [0.2, 0.2, 0.2], [0, -1.1, 0]);
      const hand = G(sh, 0, -1.1, 0); sh.userData.hand = hand;
      return sh;
    };
    rig.armR = arm(1); rig.armL = arm(-1);
    const hand = rig.armR.userData.hand; rig.hand = hand;
    const w = o.weapon;
    rig.wr = 1.3;
    if (w === 'sword') { const col = M(o.wcol || '#b9b9c2', { t: 'p', sh: 80 }); P(hand, 'box', col, [0.07, 1.7, 0.2], [0, -1.15, 0]); P(hand, 'box', M('#6b5b3a'), [0.14, 0.12, 0.7], [0, -0.3, 0]); P(hand, 'cyl', M('#4a3a28'), [0.08, 0.5, 0.08], [0, -0.05, 0]); }
    else if (w === 'great') { const col = M(o.wcol || '#9aa0aa', { t: 'p', sh: 80 }); P(hand, 'box', col, [0.1, 2.4, 0.36], [0, -1.6, 0]); P(hand, 'cone', col, [0.2, 0.4, 0.2], [0, -3.0, 0], [PI, 0, 0]); P(hand, 'box', M('#55504a'), [0.16, 0.16, 0.95], [0, -0.4, 0]); rig.wr = 1.1; }
    else if (w === 'club') { P(hand, 'cyl', M('#6a4a2a'), [0.17, 1.5, 0.17], [0, -0.7, 0]); P(hand, 'sph', M('#5a3f24'), [0.45, 0.55, 0.45], [0, -1.55, 0]); rig.wr = 1.0; }
    else if (w === 'staff') { P(hand, 'cyl', M('#5a4630'), [0.07, 3.0, 0.07], [0, 0, 0]); rig.gem = P(hand, 'sph', glowM(o.gem || '#7fd8ff', 2), [0.26, 0.26, 0.26], [0, 1.55, 0]); rig.wr = 'up'; }
    else if (w === 'bow') {
      const bowG = G(rig.armL.userData.hand, 0, 0, 0); bowG.rotation.z = 0.2;
      P(bowG, 'bow', M('#6a4a2a'), [1.15, 1.15, 1.15], [0, 0, 0], [0, 0, -PI / 2]).scale.set(1.2, 1.2, 1.2);
      P(bowG, 'box', M('#e6e6c8'), [0.02, 2.3, 0.02], [0.0, 0, 0]);
      rig.bow = true;
    }
    // Kopf
    const hx = (o.hunch || 0) * 0.3, hy = 1.25 + 0.55;
    const head = G(rig.torso, hx, hy, 0); rig.head = head;
    const hc = M(o.headCol || o.skin, { sm: true });
    const ey = eye(o.eye || '#ff5a33');
    switch (o.head) {
      case 'skull':
        P(head, 'sph', hc, [0.6, 0.6, 0.56], [0, 0.1, 0]); P(head, 'box', hc, [0.45, 0.28, 0.6], [0.2, -0.38, 0]);
        for (const s of [-1, 1]) { P(head, 'sph', M('#120d0a'), [0.17, 0.2, 0.17], [0.45, 0.12, s * 0.22]); P(head, 'sph', ey, [0.08, 0.08, 0.08], [0.55, 0.12, s * 0.22]); }
        break;
      case 'hood':
        P(head, 'sph', cloth, [0.74, 0.76, 0.7], [0, 0.1, 0]); P(head, 'cone', cloth, [0.62, 0.8, 0.62], [-0.15, 0.6, 0], [0, 0, 0.3]);
        P(head, 'sph', M('#07060a'), [0.4, 0.45, 0.42], [0.3, 0.05, 0]);
        for (const s of [-1, 1]) P(head, 'sph', ey, [0.08, 0.08, 0.08], [0.62, 0.1, s * 0.16]);
        break;
      case 'helm':
        P(head, 'sph', M(o.headCol || '#6b6f78', { t: 'p' }), [0.7, 0.72, 0.68], [0, 0.1, 0]); P(head, 'box', M('#0b0a0c'), [0.1, 0.16, 0.8], [0.62, 0.1, 0]);
        for (const s of [-1, 1]) P(head, 'box', ey, [0.06, 0.1, 0.18], [0.67, 0.1, s * 0.22]);
        if (o.plume) P(head, 'cone', M(o.plume), [0.25, 1.0, 0.25], [-0.5, 0.75, 0], [0, 0, 1.2]);
        break;
      case 'cap':
        P(head, 'sph', skin, [0.48, 0.5, 0.48], [0.05, -0.05, 0]);
        P(head, 'sph', M(o.headCol), [1.2, 0.62, 1.2], [0, 0.45, 0]);
        for (const [x, y, z, s] of [[0.5, 0.78, 0.3, 0.17], [0.1, 0.9, -0.5, 0.2], [-0.4, 0.82, 0.55, 0.13], [0.7, 0.55, -0.4, 0.14]]) P(head, 'sph', M('#f1ead8'), [s, s, s], [x, y, z]);
        for (const s of [-1, 1]) P(head, 'sph', M('#111'), [0.07, 0.07, 0.07], [0.45, 0, s * 0.18]);
        break;
      case 'horned':
        P(head, 'sph', hc, [0.66, 0.66, 0.64], [0, 0.1, 0]);
        for (const s of [-1, 1]) { P(head, 'cone', M('#e8dcc0'), [0.16, 1.0, 0.16], [-0.1, 0.8, s * 0.55], [s * 0.5, 0, 0.35]); P(head, 'sph', eye('#ffe14a', 2), [0.09, 0.09, 0.09], [0.6, 0.15, s * 0.25]); }
        P(head, 'box', M('#2a0a0a'), [0.3, 0.12, 0.5], [0.55, -0.25, 0]);
        break;
      default:
        P(head, 'sph', hc, [0.62, 0.62, 0.58], [0, 0.1, 0]);
        for (const s of [-1, 1]) P(head, 'sph', eye(o.eye || '#d9e07a', 1.6), [0.09, 0.09, 0.09], [0.55, 0.15, s * 0.2]);
        P(head, 'box', M('#2a2018'), [0.1, 0.1, 0.4], [0.58, -0.2, 0]);
    }
    rig.anim = animHumanoid;
    return rig;
  }

  function animHumanoid(rig, e, now) {
    const o = rig.o, t = e.anim, asleep = e.state === 'sleep';
    const target = e.moving ? 1 : 0;
    rig.mv += (target - rig.mv) * 0.25;
    const mv = rig.mv, sw = Math.sin(t * 9) * mv * 0.75;
    rig.legL.rotation.z = sw; rig.legR.rotation.z = -sw;
    rig.torso.position.y = 1.15 + Math.abs(Math.sin(t * 9)) * 0.09 * mv + Math.sin(t * 2.2) * 0.02;
    let rzR = 0.25 - sw * 0.6, rzL = 0.25 + sw * 0.6, lean = (o.hunch ? -0.28 : 0) - mv * 0.06, yaw = 0;
    if (asleep) { lean = -0.18; rzR = rzL = 0.1; }
    if (e.wind > 0) {
      const k = smooth(1 - e.wind / Math.max(0.05, e.windMax)), ranged = o.weapon === 'staff' || o.weapon === 'bow' || !o.weapon;
      if (ranged) { rzR = lerp(rzR, 1.5, k); rzL = lerp(rzL, o.weapon === 'bow' ? 1.5 : 0.8, k); lean += 0.08 * k; }
      else { rzR = lerp(rzR, 2.8, k); rzL = lerp(rzL, 1.2, k); lean += 0.3 * k; yaw = 0.35 * k; }
    } else if (e.strikeT > 0 && !(o.weapon === 'staff' || o.weapon === 'bow' || !o.weapon)) {
      const s = 1 - e.strikeT / 0.25;
      rzR = lerp(2.8, -0.1, outQ(s)); lean -= 0.45 * (1 - s); yaw = -0.35 * (1 - s) * 0.5;
    }
    rig.armR.rotation.z = rzR; rig.armL.rotation.z = rzL;
    rig.torso.rotation.z = lean; rig.torso.rotation.y = yaw;
    rig.hand.rotation.z = rig.wr === 'up' ? PI - rzR : rig.wr - (e.wind > 0 ? 0.6 : 0);
    if (rig.head) rig.head.rotation.z = -lean * 0.5 + (asleep ? -0.3 : 0);
    if (rig.cape) rig.cape.rotation.z = -0.1 - mv * 0.4 + Math.sin(t * 3) * 0.05;
    if (rig.gem) rig.gem.scale.setScalar(0.26 * (1 + 0.15 * Math.sin(t * 6) + (e.wind > 0 ? 0.8 : 0)));
  }

  function beast(o) {
    const g = new THREE.Group(), col = M(o.col), dark = M(o.dark || o.col);
    const rig = { g, h: o.h || 1.7, kind: 'beast', o, mv: 0, legs: [] };
    const y = o.legs ? 1.0 : 0.8;
    rig.body = G(g, 0, y, 0);
    if (o.legs) { // Spinne
      P(rig.body, 'sph', col, [0.85, 0.7, 0.85], [0.3, 0.1, 0]);
      P(rig.body, 'sph', dark, [1.15, 0.95, 1.05], [-0.95, 0.2, 0]);
      P(rig.body, 'sph', M('#c03a7a', { em: '#c03a7a', ei: 0.6 }), [0.3, 0.2, 0.3], [-1.2, 0.8, 0]);
      for (const s of [-1, 1]) for (let i = 0; i < 3; i++) P(rig.body, 'sph', eye(o.eye, 2), [0.08, 0.08, 0.08], [0.95, 0.25 + i * 0.03, s * (0.15 + i * 0.1)]);
      for (let i = 0; i < 8; i++) {
        const s = i < 4 ? -1 : 1, k = i % 4;
        const lg = G(rig.body, 0.5 - k * 0.38, 0, 0); lg.rotation.y = (s * (0.5 + k * 0.45)) * (k < 2 ? 1 : 1) + (s > 0 ? 0 : 0);
        lg.rotation.y = s * (0.3 + k * 0.5) * -1 + (s < 0 ? PI : 0) * 0;
        const up = G(lg, 0, 0, 0); up.rotation.x = s * 0.2;
        const seg = P(up, 'cyl', dark, [0.1, 1.2, 0.1], [0, 0, s * 0.62], [s * 1.15, 0, 0]);
        const low = P(up, 'cyl', dark, [0.08, 1.2, 0.08], [0, -0.55, s * 1.25], [s * 0.2, 0, 0]);
        rig.legs.push({ g: lg, k, s });
      }
    } else { // Ratte
      P(rig.body, 'sph', col, [1.35, 0.72, 0.8], [0, 0, 0]);
      const head = G(rig.body, 1.2, 0.1, 0); rig.head = head;
      P(head, 'sph', col, [0.62, 0.5, 0.5], [0, 0, 0]);
      P(head, 'cone', col, [0.3, 0.75, 0.3], [0.6, -0.05, 0], [0, 0, -PI / 2]);
      P(head, 'sph', M('#e8a6a6'), [0.12, 0.12, 0.12], [1.0, -0.05, 0]);
      for (const s of [-1, 1]) { P(head, 'sph', M('#c98f8f', { ds: true }), [0.28, 0.32, 0.1], [-0.15, 0.55, s * 0.35]); P(head, 'sph', eye(o.eye || '#ff4a3a', 2), [0.1, 0.1, 0.1], [0.38, 0.15, s * 0.24]); P(head, 'box', M('#f1ead8'), [0.05, 0.16, 0.05], [0.8, -0.28, s * 0.1]); }
      rig.tail = []; let par = G(rig.body, -1.25, 0, 0);
      for (let i = 0; i < 4; i++) { const seg = G(par, 0, 0, 0); P(seg, 'cyl', M('#c28f8f'), [0.09 - i * 0.012, 0.65, 0.09 - i * 0.012], [-0.32, 0, 0], [0, 0, PI / 2]); const nx = G(seg, -0.65, 0, 0); rig.tail.push(seg); par = nx; }
      for (let i = 0; i < 4; i++) {
        const fx = i < 2 ? 0.7 : -0.7, s = i % 2 ? 1 : -1;
        const lg = G(rig.body, fx, -0.1, s * 0.5); L(lg, 0.8, 0.26, dark); P(lg, 'box', dark, [0.4, 0.12, 0.2], [0.1, -0.8, 0]); rig.legs.push({ g: lg, k: i, s });
      }
    }
    rig.anim = animBeast;
    return rig;
  }
  function animBeast(rig, e, now) {
    const o = rig.o, t = e.anim;
    rig.mv += ((e.moving ? 1 : 0) - rig.mv) * 0.3;
    const mv = rig.mv, f = o.legs ? 18 : 15;
    if (o.legs) {
      for (const l of rig.legs) { l.g.rotation.z = Math.sin(t * f + l.k * 1.6 + (l.s > 0 ? PI : 0)) * 0.3 * mv; }
      rig.body.position.y = 1.0 + Math.sin(t * 4) * 0.04 * (1 - mv);
    } else {
      for (const l of rig.legs) l.g.rotation.z = Math.sin(t * f + (l.k % 3) * 2.1 + (l.s > 0 ? PI : 0)) * 0.7 * mv;
      rig.body.position.y = 0.8 + Math.abs(Math.sin(t * f)) * 0.14 * mv;
      rig.tail.forEach((s, i) => { s.rotation.y = Math.sin(t * 6 - i * 0.8) * 0.4; });
    }
    let lunge = 0;
    if (e.wind > 0) lunge = -0.5 * smooth(1 - e.wind / Math.max(0.05, e.windMax));
    else if (e.strikeT > 0) lunge = 1.1 * (e.strikeT / 0.25);
    rig.body.position.x = lunge * 0.9;
    rig.body.rotation.z = lunge * 0.3 * -1;
  }

  function bat(o) {
    const g = new THREE.Group(), col = M(o.col), dark = M(o.dark || o.col, { ds: true });
    const rig = { g, h: 2.9, kind: 'bat', o, hover: 2.0 };
    rig.body = G(g, 0, 0, 0);
    P(rig.body, 'sph', col, [0.7, 0.85, 0.65], [0, 0, 0]);
    P(rig.body, 'sph', col, [0.5, 0.5, 0.5], [0.55, 0.3, 0]);
    for (const s of [-1, 1]) {
      P(rig.body, 'cone', col, [0.16, 0.45, 0.14], [0.45, 0.8, s * 0.28]);
      P(rig.body, 'sph', eye('#ff3a3a', 2), [0.1, 0.1, 0.1], [0.95, 0.38, s * 0.22]);
      if (o.horns) P(rig.body, 'cone', M('#e8dcc0'), [0.1, 0.5, 0.1], [0.5, 0.9, s * 0.38], [s * 0.4, 0, -0.2]);
    }
    if (o.crystals) for (let i = 0; i < 3; i++) P(rig.body, 'oct', M('#9fe8ff', { em: '#58b9e8', ei: 1.2 }), [0.14, 0.4, 0.14], [-0.25 - i * 0.12, 0.7 - i * 0.1, (i - 1) * 0.3], [0, 0, 0.4]);
    if (o.tail) { P(rig.body, 'cyl', dark, [0.06, 1.3, 0.06], [-0.9, -0.2, 0], [0, 0, PI / 2 + 0.4]); P(rig.body, 'cone', col, [0.2, 0.4, 0.14], [-1.6, -0.45, 0], [0, 0, PI / 2 + 0.4 - PI]); }
    rig.wings = [];
    for (const s of [-1, 1]) {
      const w = G(rig.body, 0, 0.3, s * 0.4); const w2 = G(w, 0, 0, s * 1.4);
      P(w, 'box', dark, [0.9, 0.05, 1.5], [-0.15, 0, s * 0.7]);
      P(w2, 'box', dark, [0.8, 0.05, 1.3], [-0.2, 0, s * 0.6], [0, s * 0.25, 0]);
      P(w, 'cyl', col, [0.06, 2.6, 0.06], [0.25, 0, s * 1.3], [s * PI / 2, 0, 0]);
      rig.wings.push({ w, w2, s });
    }
    rig.anim = animBat;
    return rig;
  }
  function animBat(rig, e, now) {
    const t = e.anim, f = Math.sin(t * 22 + e.id), dive = e.wind > 0 ? smooth(1 - e.wind / Math.max(0.05, e.windMax)) : 0;
    for (const w of rig.wings) { w.w.rotation.x = w.s * (f * 0.85 - 0.1); w.w2.rotation.x = w.s * f * 0.5; }
    rig.g.userData.hoverY = 2.0 + Math.sin(t * 4 + e.id) * 0.25 - dive * 0.9;
    rig.body.rotation.z = -dive * 0.6 - (e.moving ? 0.25 : 0);
    rig.body.position.x = dive * 0.6;
  }

  function blob(o) {
    const g = new THREE.Group(), rig = { g, h: 2.0, kind: 'blob', o };
    rig.body = G(g, 0, 0, 0);
    P(rig.body, 'sph', M(o.col, { op: 0.82, sm: true, em: o.col, ei: 0.25 }), [1.3, 1.05, 1.3], [0, 1.0, 0]).castShadow = false;
    P(rig.body, 'sph', M(o.core, { op: 0.9, sm: true }), [0.5, 0.5, 0.5], [0.1, 0.8, 0]);
    P(rig.body, 'sph', M('#fff', { op: 0.35, sm: true }), [0.4, 0.2, 0.3], [-0.3, 1.8, 0.2]);
    for (const s of [-1, 1]) { P(rig.body, 'sph', M('#fff'), [0.2, 0.22, 0.2], [1.0, 1.15, s * 0.4]); P(rig.body, 'sph', M('#111'), [0.1, 0.1, 0.1], [1.17, 1.15, s * 0.4]); }
    rig.anim = (r, e) => {
      const q = Math.sin(e.anim * 5) * 0.12 + (e.moving ? Math.sin(e.anim * 10) * 0.08 : 0), wnd = e.wind > 0 ? 0.25 * smooth(1 - e.wind / Math.max(0.05, e.windMax)) : 0;
      r.body.scale.set(1 + q + wnd, 1 - q - wnd * 1.2, 1 + q + wnd);
    };
    return rig;
  }

  function golem() {
    const g = new THREE.Group(), rock = M('#6c7686', { t: 'p', sh: 20 }), dark = M('#545d6b'), cry = M('#7bd0ff', { em: '#4fb8ff', ei: 1.4 });
    const rig = { g, h: 4.0, kind: 'golem', mv: 0 };
    rig.legL = G(g, 0, 1.3, -0.55); rig.legR = G(g, 0, 1.3, 0.55);
    for (const lg of [rig.legL, rig.legR]) { L(lg, 1.3, 0.95, dark); P(lg, 'box', rock, [1.2, 0.4, 0.9], [0.1, -1.3, 0]); }
    rig.torso = G(g, 0, 1.3, 0);
    P(rig.torso, 'box', rock, [1.3, 1.8, 2.4], [0, 1.0, 0]);
    P(rig.torso, 'box', dark, [1.4, 0.5, 2.0], [0, 0.35, 0]);
    for (const [x, y, z, s] of [[0.5, 1.6, -0.6, 0.35], [0.7, 1.2, 0.5, 0.45], [-0.2, 2.0, 0.7, 0.3], [-0.7, 1.7, -0.5, 0.4]]) P(rig.torso, 'oct', cry, [s * 0.5, s * 1.4, s * 0.5], [x, y, z], [0.3, 0, 0.4]);
    rig.head = G(rig.torso, 0.25, 2.25, 0);
    P(rig.head, 'box', rock, [0.9, 0.85, 1.1], [0, 0.25, 0]);
    for (const s of [-1, 1]) P(rig.head, 'box', eye('#7bd0ff', 2.4), [0.08, 0.14, 0.24], [0.46, 0.3, s * 0.28]);
    const arm = s => { const a = G(rig.torso, 0, 1.9, s * 1.55); L(a, 1.9, 0.7, rock); P(a, 'box', dark, [0.9, 0.9, 0.9], [0.1, -2.0, 0]); return a; };
    rig.armL = arm(-1); rig.armR = arm(1);
    rig.anim = (r, e) => {
      r.mv += ((e.moving ? 1 : 0) - r.mv) * 0.2;
      const sw = Math.sin(e.anim * 6) * r.mv * 0.5;
      r.legL.rotation.z = sw; r.legR.rotation.z = -sw;
      let az = -sw * 0.5, lean = -r.mv * 0.05;
      if (e.wind > 0) { const k = smooth(1 - e.wind / Math.max(0.05, e.windMax)); az = lerp(0.1, 2.9, k); lean = 0.2 * k; }
      else if (e.strikeT > 0 || e.dash > 0) { az = e.dash > 0 ? 1.4 : lerp(-0.2, 2.9, e.strikeT / 0.25); lean = -0.3; }
      r.armL.rotation.z = az; r.armR.rotation.z = e.wind > 0 || e.strikeT > 0 || e.dash > 0 ? az : sw * 0.5;
      r.torso.rotation.z = lean;
      r.torso.position.y = 1.3 + Math.abs(Math.sin(e.anim * 6)) * 0.1 * r.mv;
    };
    return rig;
  }

  function boss() {
    const g = new THREE.Group(), bone = M('#d8d0b6', { t: 'p', sh: 30 }), dark = M('#2a2420'), gold = M('#e0b236', { t: 'p', sh: 90, sp: '#ffe9a0' });
    const rig = { g, h: 5.4, kind: 'boss', mv: 0, eyes: [], scale: 0.8 };
    rig.legL = G(g, 0, 1.5, -0.6); rig.legR = G(g, 0, 1.5, 0.6);
    for (const lg of [rig.legL, rig.legR]) { L(lg, 1.5, 0.6, bone); P(lg, 'box', dark, [1.1, 0.4, 0.8], [0.2, -1.5, 0]); }
    rig.torso = G(g, 0, 1.5, 0);
    P(rig.torso, 'box', bone, [1.1, 1.8, 1.9], [0, 1.0, 0]);
    for (let i = 0; i < 4; i++) P(rig.torso, 'box', dark, [0.1, 0.12, 1.5], [0.56, 0.45 + i * 0.38, 0]);
    P(rig.torso, 'box', M('#ff6a2a', { em: '#ff6a2a', ei: 1.2 }), [0.3, 0.9, 0.6], [0.2, 1.1, 0]);
    for (const s of [-1, 1]) { P(rig.torso, 'sph', M('#9a9484', { t: 'p' }), [0.65, 0.5, 0.65], [0, 1.95, s * 1.25]); for (let i = 0; i < 3; i++) P(rig.torso, 'cone', M('#c9c2ac'), [0.14, 0.7, 0.14], [0, 2.4, s * (0.95 + i * 0.28)], [s * 0.2 * (i - 1) * 0, 0, 0]); }
    rig.cape = G(rig.torso, -0.6, 2.0, 0); P(rig.cape, 'box', M('#5a1218', { ds: true }), [0.08, 3.2, 2.6], [0, -1.6, 0]);
    rig.head = G(rig.torso, 0.1, 2.4, 0);
    P(rig.head, 'sph', bone, [0.8, 0.82, 0.76], [0, 0.4, 0]); P(rig.head, 'box', bone, [0.55, 0.35, 0.7], [0.3, -0.1, 0]);
    for (const s of [-1, 1]) { P(rig.head, 'sph', M('#14090a'), [0.22, 0.26, 0.2], [0.65, 0.5, s * 0.3]); const ee = P(rig.head, 'sph', eye('#ff9a3a', 2.6), [0.11, 0.11, 0.11], [0.78, 0.5, s * 0.3]); rig.eyes.push(ee); }
    const crown = G(rig.head, 0, 1.05, 0);
    P(crown, 'cyl', gold, [0.82, 0.3, 0.8], [0, 0, 0]);
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; P(crown, 'cone', gold, [0.15, 0.6, 0.15], [Math.cos(a) * 0.75, 0.4, Math.sin(a) * 0.75]); }
    P(crown, 'sph', eye('#ff3a3a', 2.4), [0.12, 0.12, 0.12], [0.8, 0.05, 0]);
    const arm = s => { const a = G(rig.torso, 0, 1.9, s * 1.35); L(a, 1.5, 0.55, bone); P(a, 'sph', bone, [0.3, 0.3, 0.3], [0, -1.5, 0]); return a; };
    rig.armL = arm(-1); rig.armR = arm(1);
    rig.hand = G(rig.armR, 0, -1.5, 0); rig.hand.rotation.z = 1.2;
    const sword = M('#a3a8b5', { t: 'p', sh: 100, sp: '#aaa' });
    P(rig.hand, 'box', sword, [0.14, 3.0, 0.55], [0, -1.8, 0]); P(rig.hand, 'cone', sword, [0.27, 0.6, 0.07], [0, -3.6, 0], [PI, 0, 0]);
    P(rig.hand, 'box', M('#55504a'), [0.22, 0.22, 1.4], [0, -0.35, 0]); P(rig.hand, 'box', eye('#ff6a2a', 1.8), [0.16, 2.2, 0.08], [0, -1.8, 0]);
    rig.anim = (r, e, now) => {
      r.mv += ((e.moving ? 1 : 0) - r.mv) * 0.2;
      const sw = Math.sin(e.anim * 6) * r.mv * 0.55;
      r.legL.rotation.z = sw; r.legR.rotation.z = -sw;
      let rz = 0.2 + Math.sin(e.anim * 2) * 0.05, lz = 0.2 + sw * 0.4, lean = -r.mv * 0.05, yaw = 0, hz = 1.2;
      if (e.wind > 0) {
        const k = smooth(1 - e.wind / Math.max(0.05, e.windMax));
        if (e.windType === 'spears') { rz = lerp(rz, 1.7, k); lz = lerp(lz, 1.4, k); }
        else { rz = lerp(rz, 3.0, k); lz = lerp(lz, 2.4, k); lean = 0.35 * k; hz = lerp(1.2, 0.2, k); }
      } else if (e.strikeT > 0) { const s = 1 - e.strikeT / 0.25; rz = lerp(3.0, 0.0, outQ(s)); lean = -0.5 * (1 - s); }
      r.armR.rotation.z = rz; r.armL.rotation.z = lz; r.hand.rotation.z = hz; r.torso.rotation.z = lean; r.torso.rotation.y = yaw;
      r.torso.position.y = 1.5 + Math.sin(e.anim * 2) * 0.04;
      r.cape.rotation.z = -0.08 - r.mv * 0.35 + Math.sin(e.anim * 3) * 0.05;
      const ec = e.enrage ? '#ff2a1a' : '#ff9a3a';
      for (const ee of r.eyes) ee.material = eye(ec, 2.8);
    };
    return rig;
  }

  const LOOKS = {
    rat: () => beast({ col: '#6e5f58', dark: '#5a4c46', h: 1.7 }),
    spider: () => beast({ col: '#2b2236', dark: '#241c2e', legs: true, eye: '#ff3a8a', h: 1.7 }),
    bat: () => bat({ col: '#3c3140', dark: '#2a2030' }),
    cbat: () => bat({ col: '#58b9e8', dark: '#2f7fb0', crystals: true }),
    imp: () => bat({ col: '#c93a2a', dark: '#7a1a14', horns: true, tail: true }),
    skeleton: () => humanoid({ skin: '#e8e2cd', cloth: '#d3cdb7', legs: '#cfc9b2', head: 'skull', ribs: true, weapon: 'sword', wcol: '#8c8b86' }),
    archer: () => humanoid({ skin: '#e8e2cd', cloth: '#9c8a64', legs: '#cfc9b2', head: 'skull', eye: '#ffc233', weapon: 'bow' }),
    zombie: () => humanoid({ skin: '#7d9a62', cloth: '#4e463a', legs: '#3a3a32', head: 'face', headCol: '#86a468', eye: '#d9e07a', weapon: 'club', hunch: 1, bulk: 1.15 }),
    shroom: () => humanoid({ skin: '#c9a678', cloth: '#7a5a3a', head: 'cap', headCol: '#b3402e', weapon: 'club', bulk: 0.95 }),
    spitter: () => humanoid({ skin: '#7a9a3a', cloth: '#3f5a22', head: 'cap', headCol: '#7bd44a', bulk: 0.9 }),
    slime: () => blob({ col: '#58b53c', core: '#2f7a22' }),
    guard: () => humanoid({ skin: '#8a95a3', cloth: '#6f7a88', legs: '#59626e', head: 'helm', headCol: '#8a95a3', eye: '#6fd8ff', pauld: '#9aa5b3', weapon: 'great', wcol: '#a3b0c0', bulk: 1.2 }),
    mage: () => humanoid({ skin: '#d9c3a0', cloth: '#2b3f86', legs: '#1f2e66', head: 'hood', eye: '#7fe8ff', weapon: 'staff', gem: '#6fe0ff', trim: '#8ec6ff' }),
    golem: () => golem(),
    dknight: () => humanoid({ skin: '#2a2a33', cloth: '#262630', legs: '#1d1d26', head: 'helm', headCol: '#33333f', eye: '#ff3b2a', plume: '#a3121c', pauld: '#3b3b48', weapon: 'great', wcol: '#8d93a0', bulk: 1.2, trim: '#a3121c', cape: '#4a0c12' }),
    necro: () => humanoid({ skin: '#cbb7a0', cloth: '#3a2150', legs: '#2a1740', head: 'hood', eye: '#9dff6a', weapon: 'staff', gem: '#9dff6a', trim: '#7a3fa8' }),
    demon: () => humanoid({ skin: '#a3262a', cloth: '#8a1c20', legs: '#6e1519', head: 'horned', headCol: '#b32b2f', weapon: 'club', bulk: 1.3, belly: true }),
    boss: () => boss(),
  };
  function enemy(look) { return (LOOKS[look] || LOOKS.skeleton)(); }

  /* ============================================================ KÄMPFER */
  // Eine neue Optik alle 10 Stufen (Index = Stufe / 10)
  const BODY = [
    { armor: '#6b5440', cloth: '#8c7656', trim: null, cape: null, helm: 'cap', pauld: 0, boots: '#3a2c20' },
    { armor: '#8a8f98', cloth: '#4a4038', trim: '#7a1218', cape: '#7a1218', capeLen: 20, helm: 'open', pauld: 1 },
    { armor: '#aab2bf', cloth: '#3d4a66', trim: '#a02028', cape: '#7a1218', capeLen: 24, helm: 'full', pauld: 2, greaves: true },
    { armor: '#c4ccd8', cloth: '#2a2a38', trim: '#d9b94a', cape: '#9a1620', capeLen: 28, helm: 'full', plume: '#b3151b', pauld: 2, greaves: true, emblem: true },
    { armor: '#cfd6e2', cloth: '#26264a', trim: '#e0b836', cape: '#a31824', capeLen: 31, helm: 'full', horns: true, plume: '#e0b836', pauld: 3, greaves: true, emblem: true },
    { armor: '#e8edf5', cloth: '#1c3f8f', trim: '#ffd24a', cape: '#1c3f8f', capeLen: 34, helm: 'full', wings: true, pauld: 3, greaves: true, emblem: true, glowEyes: '#9fd8ff' },
    { armor: '#3a4256', cloth: '#14182a', trim: '#7fd8ff', cape: '#141c3a', capeLen: 36, helm: 'full', horns: true, wings: true, pauld: 3, greaves: true, emblem: true, glowEyes: '#7fd8ff', glowTrim: true, aura: '#7fd8ff' },
    { armor: '#7a1020', cloth: '#2a0a10', trim: '#ffcf4a', cape: '#5a0a14', capeLen: 38, helm: 'full', crown: true, pauld: 3, greaves: true, emblem: true, glowEyes: '#ffcf4a', aura: '#ff6a3a', ring: '#ffcf4a' },
    { armor: '#f2d46a', cloth: '#fff4d0', trim: '#fff8e0', cape: '#ffb84a', capeLen: 40, helm: 'full', crown: true, wings: true, pauld: 3, greaves: true, emblem: true, glowEyes: '#fff6c0', glowTrim: true, aura: '#ffe08a', ring: '#fff2b0', halo: true, flameCape: true },
  ];
  const SWORD = [
    { blade: '#9a8a78', len: 24, w: 5.2, guard: '#5a4630', slash: '#e8e2d0' },
    { blade: '#aeb3bb', len: 29, w: 5.4, guard: '#6b5a3a', slash: '#eef0f6' },
    { blade: '#d2d9e4', len: 32, w: 5.8, guard: '#d9b94a', fuller: true, slash: '#e4f0ff' },
    { blade: '#f0f4ff', len: 34, w: 6.2, guard: '#d9b94a', fuller: true, gem: '#3a7bff', wing: true, slash: '#cfe0ff' },
    { blade: '#9fd8ff', len: 36, w: 6.6, guard: '#e0b836', fuller: true, gem: '#7fe8ff', wing: true, rune: '#7fe8ff', glow: '#4fb8ff', slash: '#8fe4ff' },
    { blade: '#fff4c8', len: 40, w: 7.2, guard: '#ffd24a', fuller: true, gem: '#ff9a3a', wing: true, rune: '#ffb84a', glow: '#ffcf4a', flame: true, slash: '#ffd88a' },
  ];
  const SHIELD = [
    { shape: 'round', col: '#7a5230', rim: null, boss: '#6a6e76', r: 8.5 },
    { shape: 'round', col: '#6a4a2c', rim: '#9aa0aa', boss: '#b8bec8', r: 9 },
    { shape: 'heater', col: '#a9b0bc', rim: '#d0d6e0', emblem: '#a02028', s: 1.0 },
    { shape: 'heater', col: '#8a1620', rim: '#e0b836', emblem: '#e0b836', s: 1.08, lion: true },
    { shape: 'heater', col: '#243a78', rim: '#e0b836', emblem: '#7fe8ff', s: 1.15, rune: '#7fe8ff' },
    { shape: 'heater', col: '#7a1010', rim: '#ffd24a', emblem: '#ffb84a', s: 1.22, spikes: true, rune: '#ff9a3a' },
  ];

  const heaterShape = (() => {
    const s = new THREE.Shape();
    s.moveTo(-1, 1); s.lineTo(1, 1); s.lineTo(1, 0.1); s.quadraticCurveTo(0.9, -0.8, 0, -1.35); s.quadraticCurveTo(-0.9, -0.8, -1, 0.1); s.lineTo(-1, 1);
    return s;
  })();
  const heaterGeo = new THREE.ExtrudeGeometry(heaterShape, { depth: 0.25, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 1 });
  heaterGeo.translate(0, 0, -0.125);
  heaterGeo.rotateY(-PI / 2); // Schildfläche zeigt nach +x
  const heaterRimGeo = new THREE.ExtrudeGeometry(heaterShape, { depth: 0.2, bevelEnabled: true, bevelSize: 0.1, bevelThickness: 0.05, bevelSegments: 1 });
  heaterRimGeo.translate(0, 0, -0.1); heaterRimGeo.rotateY(-PI / 2);

  /** Klinge als abgeschrägtes Blatt mit Spitze (Länge entlang -y, Breite entlang z, Dicke entlang x) */
  const bladeGeos = {};
  function bladeGeo(len, w) {
    const key = len + '|' + w;
    if (bladeGeos[key]) return bladeGeos[key];
    const h = w / 2, sh = len - Math.max(7, w * 1.5), shape = new THREE.Shape();
    shape.moveTo(-h, 0); shape.lineTo(-h, -sh); shape.lineTo(0, -len); shape.lineTo(h, -sh); shape.lineTo(h, 0); shape.lineTo(-h, 0);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.8, bevelEnabled: true, bevelSize: 0.4, bevelThickness: 0.6, bevelSegments: 1 });
    geo.translate(0, 0, -0.4); geo.rotateY(PI / 2);
    return (bladeGeos[key] = geo);
  }
  function buildSword(parent, tier) {
    const S = SWORD[tier], g = G(parent, 0, 0, 0);
    const blade = M(S.blade, { t: 'p', sh: 120, sp: '#fff', em: S.glow, ei: S.glow ? 0.55 : 1 });
    const gm = M(S.guard, { t: 'p', sh: 80, sm: true });
    P(g, 'cyl', M('#3a2a1c', { sm: true }), [1.1, 5, 1.1], [0, 0, 0]);                       // Griff
    for (const y of [-1.3, 0.1, 1.5]) P(g, 'cyl', M('#1c1410'), [1.25, 0.45, 1.25], [0, y, 0]); // Wicklung
    P(g, 'sph', gm, [1.8, 1.8, 1.8], [0, 3.3, 0]);                                             // Knauf
    P(g, 'box', gm, [1.5, 1.4, 10.5], [0, -3.1, 0]);                                           // Parierstange
    for (const s of [-1, 1]) P(g, 'sph', gm, [1.0, 1.0, 1.0], [0, -3.1, s * 5.4]);
    if (S.wing) for (const s of [-1, 1]) P(g, 'cone', gm, [1.0, 4, 1.0], [0, -4.4, s * 5.6]);
    if (S.gem) P(g, 'sph', eye(S.gem, 2), [1.3, 1.3, 1.3], [1.0, -3.1, 0]);
    const bl = S.len;
    const bm = new THREE.Mesh(bladeGeo(bl, S.w * 0.8), blade); bm.position.set(0, -3.8, 0); bm.castShadow = true; g.add(bm);
    if (S.fuller) P(g, 'box', M('#5d6470', { t: 'p', sh: 40 }), [2.15, bl * 0.72, 0.7], [0, -3.8 - bl * 0.42, 0]);
    if (S.rune) for (let i = 0; i < 5; i++) P(g, 'box', eye(S.rune, 2.2), [2.3, 2.2, 0.5], [0, -9 - i * (bl - 10) / 5, 0]);
    g.userData.tip = -3.8 - bl;
    return g;
  }

  function buildShield(parent, tier) {
    const S = SHIELD[tier], g = G(parent, 0, 0, 0);
    if (S.shape === 'round') {
      P(g, 'cyl', M(S.col), [S.r, 1.8, S.r], [0, 0, 0], [0, 0, PI / 2]);
      for (let i = 0; i < 3; i++) P(g, 'box', M('#4a3220'), [0.3, S.r * 1.8, 0.7], [1.0, 0, (i - 1) * 2.8]);
      if (S.rim) { const r = P(g, 'torus', M(S.rim, { t: 'p', sh: 80 }), [S.r, S.r, S.r * 0.5], [0, 0, 0], [0, PI / 2, 0]); r.scale.set(S.r, S.r, S.r * 1.0); }
      P(g, 'sph', M(S.boss, { t: 'p', sh: 90 }), [2.6, 2.6, 2.6], [1.1, 0, 0]);
      return g;
    }
    const sc = 7.4 * S.s;
    const rim = new THREE.Mesh(heaterRimGeo, M(S.rim, { t: 'p', sh: 100, sp: '#ffe' })); rim.scale.set(sc * 1.1, sc * 1.1, sc * 1.1); rim.position.set(-0.4, 0, 0); rim.castShadow = true; g.add(rim);
    const body = new THREE.Mesh(heaterGeo, M(S.col, { t: 'p', sh: 70, em: S.rune ? S.col : undefined, ei: 0.2 })); body.scale.set(sc, sc, sc); body.position.set(0.2, 0, 0); body.castShadow = true; g.add(body);
    if (S.lion) { P(g, 'oct', M(S.emblem, { t: 'p', sh: 90 }), [0.8, 3.4, 2.2], [1.1, 0.8 * sc / 7.4, 0]); }
    else P(g, 'box', M(S.emblem, S.rune ? { t: 'b', glow: 1.8 } : { t: 'p' }), [0.5, sc * 1.1, sc * 0.22], [0.9, 0.2, 0]), P(g, 'box', M(S.emblem, S.rune ? { t: 'b', glow: 1.8 } : { t: 'p' }), [0.5, sc * 0.22, sc * 0.9], [0.9, 0.9, 0]);
    if (S.spikes) for (let i = 0; i < 5; i++) { const a = (i - 2) * 0.55; P(g, 'cone', M('#ffd24a', { t: 'p' }), [0.9, 3.6, 0.9], [0.8, 8.4 + Math.cos(a) * 0.6 - 1.5, Math.sin(a) * 8.2], [-Math.sin(a) * 0.9, 0, 0]); }
    return g;
  }

  const FLASH_DEF = {};
  /** Kämpfer: schlanke Silhouette mit verjüngten Gliedern, gewölbten Platten und Details (Gürtel, Tassetten, Kniebuckel, Handschuhe) */
  function player(tb, ts, tsh, shieldOn) {
    const B = BODY[tb], g = new THREE.Group();
    const rig = { g, tb, ts, tsh, shieldOn, mv: 0, faceCur: 0, hurtMats: null };
    const armor = M(B.armor, { t: 'p', sh: 70, sp: '#6a6a72', sm: true }), cloth = M(B.cloth, { sm: true }), skin = M('#d8b08c', { sm: true });
    const trim = B.trim ? M(B.trim, B.glowTrim ? { t: 'p', sh: 90, em: B.trim, ei: 0.9 } : { t: 'p', sh: 100, sp: '#ddc', sm: true }) : armor;
    const leather = M(tb === 0 ? '#6a4a30' : '#3a2a20', { sm: true });
    const gold = M('#d9b94a', { t: 'p', sh: 100, sp: '#fff3b0', sm: true });
    const boot = M(B.boots || '#2c2724', { sm: true });
    const legM = tb === 0 ? M('#5e5042', { sm: true }) : M('#33384a', { sm: true });
    const plated = B.pauld > 0;
    // Beine: Oberschenkel, Knie, Schienbein, Stiefel
    rig.legL = G(g, 0, 19, -4.0); rig.legR = G(g, 0, 19, 4.0);
    for (const lg of [rig.legL, rig.legR]) {
      P(lg, 'vcyl', legM, [3.5, 10, 3.5], [0, -5, 0]);
      P(lg, 'sph', B.greaves ? armor : legM, [3.0, 3.0, 3.1], [0.5, -9.8, 0]);
      if (B.greaves) { P(lg, 'sph', trim, [1.9, 2.2, 2.4], [2.4, -9.8, 0]); P(lg, 'vcyl', armor, [2.9, 8.2, 2.9], [0.2, -13.6, 0]); P(lg, 'box', trim, [0.5, 6.5, 0.9], [2.9, -13.6, 0]); }
      else P(lg, 'vcyl', legM, [2.8, 8, 2.8], [0, -13.6, 0]);
      P(lg, 'cyl', tb === 0 ? boot : trim, [3.2, 2.4, 3.2], [0, -16.0, 0]);
      P(lg, 'sph', boot, [4.6, 2.5, 3.4], [1.7, -17.6, 0]);
      P(lg, 'box', boot, [3.6, 1.0, 3.6], [-0.9, -18.5, 0]);
    }
    // Rumpf: Taille, Gürtel, verjüngter Brustpanzer, Kragen
    const torso = rig.torso = G(g, 0, 19, 0);
    P(torso, 'tcyl', cloth, [4.6, 5.6, 6.4], [0, 2.4, 0]);
    P(torso, 'cyl', leather, [4.9, 1.5, 6.8], [0, 4.7, 0]);
    P(torso, 'box', gold, [0.9, 2.2, 2.7], [4.8, 4.7, 0]);
    if (plated) {
      P(torso, 'vcyl', armor, [5.2, 11.8, 7.9], [0, 11.4, 0]);
      P(torso, 'tcyl', armor, [5.0, 1.6, 6.9], [0, 6.3, 0]);
      P(torso, 'tcyl', trim, [5.1, 0.7, 7.0], [0, 7.4, 0]);
      for (const s of [-1, 1]) P(torso, 'sph', armor, [2.9, 3.8, 3.9], [3.0, 12.6, s * 3.1]); // gewölbte Brustplatten
      P(torso, 'box', trim, [0.7, 9.4, 0.9], [5.1, 11.0, 0]);
      P(torso, 'cyl', trim, [3.7, 1.6, 5.2], [0, 17.2, 0]);
    } else { // Rekrut: Lederwams mit Riemen
      P(torso, 'vcyl', cloth, [5.0, 11.6, 7.5], [0, 11.3, 0]);
      for (const s of [-1, 1]) P(torso, 'box', leather, [0.5, 14, 1.2], [5.0, 11.4, s * 2.2], [0, 0, s * 0.42]);
      P(torso, 'cyl', leather, [3.6, 1.4, 5.0], [0, 17.0, 0]);
    }
    if (B.emblem) P(torso, 'oct', B.glowTrim ? eye(B.trim, 1.8) : trim, [0.9, 3.0, 2.6], [5.3, 11.6, 0]);
    if (tb >= 1) { // Tassetten und Waffenrock
      for (const s of [-1, 1]) {
        P(torso, 'box', armor, [1.0, 6.2, 3.5], [3.5, -1.6, s * 3.7], [0, 0, 0.1]);
        P(torso, 'box', armor, [3.2, 5.2, 0.9], [0.3, -1.2, s * 6.5]);
      }
      P(torso, 'box', cloth, [0.6, 8.4, 4.6], [4.7, -1.4, 0]);
      P(torso, 'box', trim, [0.7, 0.7, 4.8], [4.8, -5.4, 0]);
    }
    // Arme: Schulter, Oberarm, Ellbogen, Unterarm, Handschuh
    const mkArm = (s) => {
      const sh = G(torso, 0, 16, s * 8.7);
      P(sh, 'vcyl', cloth, [3.0, 7.6, 3.0], [0, -3.7, 0]);
      P(sh, 'sph', plated ? armor : cloth, [2.5, 2.5, 2.5], [0, -7.6, 0]);
      P(sh, 'vcyl', plated ? armor : cloth, [2.5, 6.8, 2.5], [0, -10.9, 0]);
      if (plated) P(sh, 'cyl', trim, [2.7, 0.9, 2.7], [0, -13.4, 0]);
      P(sh, 'sph', plated ? armor : skin, [2.3, 2.6, 2.3], [0, -14.6, 0]);
      if (B.pauld >= 1) {
        const pa = 0.35 * B.pauld;
        P(sh, 'hemi', armor, [3.9 + pa, 2.9 + pa * 0.8, 4.3 + pa], [0, -0.3, 0]);
        P(sh, 'tcyl', armor, [4.0 + pa, 1.3, 4.4 + pa], [0, -1.3, 0]);
        P(sh, 'tcyl', trim, [3.6 + pa, 0.8, 4.0 + pa], [0, -2.2, 0]);
      }
      if (B.pauld >= 2) P(sh, 'torus', trim, [4.1 + 0.35 * B.pauld, 4.1 + 0.35 * B.pauld, 6], [0, -0.35, 0], [PI / 2, 0, 0]);
      if (B.pauld >= 3) for (let i = 0; i < 3; i++) P(sh, 'cone', trim, [0.8, 4.0, 0.8], [-0.9 + i * 1.2, 3.9, s * (i - 1) * 1.1], [s * (i - 1) * 0.3, 0, (i - 1) * -0.3]);
      return { sh, hand: G(sh, 0, -14, 0) };
    };
    const R_ = mkArm(1), L_ = mkArm(-1);
    rig.shR = R_.sh; rig.handR = R_.hand; rig.shL = L_.sh; rig.handL = L_.hand;
    // Kopf: Hals, Gesicht, Helm
    const head = rig.head = G(torso, 0, 17.2, 0);
    P(head, 'cyl', skin, [1.9, 2.6, 1.9], [0, 0.6, 0]);
    P(head, 'sph', skin, [3.9, 4.4, 3.7], [0, 4.6, 0]);
    const closed = B.helm === 'full';
    if (!closed) {
      const hair = M(tb === 0 ? '#3a2616' : '#2a1a10', { sm: true });
      P(head, 'box', M('#b88a68', { sm: true }), [0.9, 1.2, 0.9], [3.9, 4.0, 0]);                    // Nase
      P(head, 'box', hair, [0.8, 0.5, 3.8], [3.5, 5.9, 0]);                                         // Brauen
      for (const s of [-1, 1]) P(head, 'sph', M('#15100e'), [0.6, 0.7, 0.6], [3.5, 5.0, s * 1.5]); // Augen
      P(head, 'box', M('#a8765a', { sm: true }), [0.5, 0.35, 1.6], [3.6, 2.6, 0]);                  // Mund
      P(head, 'sph', hair, [3.5, 3.0, 3.8], [-0.9, 6.4, 0]);                                        // Haar
      P(head, 'sph', hair, [2.2, 3.4, 2.0], [-3.4, 3.6, 0]);                                        // Zopf
    }
    if (B.helm === 'cap') {
      P(head, 'hemi', M('#7a5530', { sm: true }), [4.3, 3.2, 4.2], [0, 6.0, 0]);
      P(head, 'cyl', M('#4a2e1a', { sm: true }), [4.5, 0.7, 4.4], [0, 6.0, 0]);
    } else if (B.helm === 'open') {
      P(head, 'hemi', armor, [4.6, 4.0, 4.5], [0, 5.7, 0]);
      P(head, 'cyl', trim, [4.7, 0.9, 4.6], [0, 5.7, 0]);
      P(head, 'box', armor, [0.7, 4.2, 1.0], [4.3, 3.9, 0]);
      for (const s of [-1, 1]) P(head, 'box', armor, [1.4, 3.4, 0.8], [2.2, 3.7, s * 3.7]);
    } else {
      P(head, 'sph', armor, [4.8, 5.1, 4.6], [0, 4.9, 0]);
      P(head, 'tcyl', armor, [4.1, 3.2, 4.0], [0.3, 1.9, 0]);
      P(head, 'box', M('#0b0a0e'), [0.9, 1.3, 5.8], [4.6, 5.0, 0]);
      P(head, 'box', B.glowEyes ? eye(B.glowEyes, 2.4) : M('#0b0a0e'), [0.8, 0.6, 5.4], [4.85, 5.0, 0]);
      for (const s of [-1, 1]) for (let i = 0; i < 2; i++) P(head, 'box', M('#0b0a0e'), [0.6, 0.5, 0.5], [4.3, 2.6 - i * 1.0, s * 1.4]);
      P(head, 'box', trim, [0.7, 6.0, 1.1], [4.8, 4.9, 0]);
      P(head, 'cyl', trim, [4.7, 0.8, 4.5], [0, 3.0, 0]);
      P(head, 'box', trim, [8.4, 1.1, 0.9], [0, 9.9, 0]);
      if (B.plume) {
        const pl = G(head, -1, 9.6, 0); rig.plume = pl; const pm = M(B.plume, { sm: true, ds: true });
        P(pl, 'cone', pm, [1.2, 5, 2.6], [-1.2, 1.0, 0], [0, 0, 1.0]); P(pl, 'cone', pm, [1.1, 5.5, 2.3], [-4.2, -0.4, 0], [0, 0, 1.45]); P(pl, 'cone', pm, [0.9, 4.5, 1.9], [-7.2, -2.4, 0], [0, 0, 1.85]);
      }
    }
    const horn = M('#e8dcc0', { t: 'p', sm: true });
    if (B.horns) for (const s of [-1, 1]) { P(head, 'cone', horn, [1.6, 8.5, 1.6], [0, 8.2, s * 5.4], [s * 0.7, 0, 0.0]); P(head, 'cone', horn, [1.0, 4.5, 1.0], [0.5, 12.2, s * 8.6], [s * 0.2, 0, 0]); }
    if (B.wings) for (const s of [-1, 1]) for (let i = 0; i < 3; i++) P(head, 'box', M(tb >= 8 ? '#fff4c8' : '#e8edf5', { t: 'p', sh: 80, em: tb >= 8 ? '#ffd24a' : undefined, ei: 0.5 }), [0.8, 1.2, 6 - i * 1.3], [-1 - i * 1.6, 6.4 + i * 1.1, s * (5.4 + i * 1.8)], [s * 0.3, 0, 0.5 - i * 0.1]);
    if (B.crown) {
      const cr = G(head, 0, 10, 0); const cg = M('#ffd24a', { t: 'p', sh: 100, em: '#ffb020', ei: 0.4 });
      P(cr, 'cyl', cg, [4.4, 1.4, 4.4], [0, 0, 0]);
      for (let i = 0; i < 7; i++) { const a = i / 7 * TAU; P(cr, 'cone', cg, [0.9, 3.8, 0.9], [Math.cos(a) * 4.1, 2.3, Math.sin(a) * 4.1]); }
      P(cr, 'sph', eye('#ff4a3a', 2), [1.1, 1.1, 1.1], [4.5, 0.4, 0]);
    }
    if (B.halo) { const h = P(head, 'torus', glowM('#fff2b0', 2.2), [6.5, 6.5, 6.5], [0, 16.5, 0], [PI / 2 + 0.25, 0, 0]); rig.halo = h; h.castShadow = false; h.scale.set(6.5, 6.5, 6.5); }
    // Umhang mit Kragen
    if (B.cape) {
      const cp = rig.cape = G(torso, -5.2, 15.8, 0);
      const cm = B.flameCape ? M(B.cape, { ds: true, em: '#ff9a2a', ei: 0.8 }) : M(B.cape, { ds: true });
      P(cp, 'box', cm, [0.9, B.capeLen, 13 + tb * 0.6], [0, -B.capeLen / 2, 0]);
      const cp2 = rig.cape2 = G(cp, 0, -B.capeLen, 0);
      P(cp2, 'box', cm, [0.9, B.capeLen * 0.35, 11.5 + tb * 0.6], [0, -B.capeLen * 0.175, 0]);
      if (B.emblem) P(cp, 'box', M(B.trim, { t: 'p' }), [0.5, 5, 4], [-0.6, -B.capeLen * 0.4, 0]);
      P(torso, 'tcyl', cm, [3.6, 2.4, 6.8], [-1.2, 17.0, 0]);
    }
    // Ring um die Hüfte (Lord/Held)
    if (B.ring) { const rg = rig.ring = P(torso, 'torus', glowM(B.ring, 1.8), [12, 12, 12], [0, 5, 0], [PI / 2, 0, 0]); rg.castShadow = false; }
    // Schwert
    const swordG = rig.sword = G(rig.handR, 0, 0, 0);
    rig.swordMesh = buildSword(swordG, ts);
    rig.swordTipY = rig.swordMesh.userData.tip;
    // Schild
    if (shieldOn) {
      const sg = rig.shield = G(torso, 0, 8.5, -11);
      rig.shieldMesh = buildShield(sg, tsh);
      rig.shieldFlash = P(sg, 'sph', M('#ffffff', { t: 'b', add: true, op: 0.0, glow: 2 }), [10, 12, 10], [3, 0, 0]);
      rig.shieldFlash.castShadow = false;
    }
    // Magie-Glühen an der Hand
    rig.castGlow = P(rig.handR, 'sph', M('#ffffff', { t: 'b', add: true, glow: 2 }), [1, 1, 1], [0, -2, 0]); rig.castGlow.visible = false; rig.castGlow.castShadow = false;
    rig.glowMat = rig.castGlow.material;
    return rig;
  }

  const stanceK = (k, a, b) => clamp01((k - a) / (b - a));

  /** Pose pro Frame. st = { p (Spielerzustand), S (Werte), t (Zeit), dead, overT } */
  function animPlayer(rig, p, S, now) {
    const t = p.anim, moving = p.moving ? 1 : 0, sprint = p.sprinting ? 1 : 0;
    rig.mv += (moving - rig.mv) * 0.3;
    const mv = rig.mv, f = sprint ? 17 : 11;
    const sw = Math.sin(t * f) * mv * (sprint ? 0.95 : 0.7);
    rig.legL.rotation.z = sw; rig.legR.rotation.z = -sw;
    let bob = Math.abs(Math.sin(t * f)) * 1.3 * mv + Math.sin(t * 2.2) * 0.35 * (1 - mv);
    let lean = -mv * 0.05 - sprint * 0.38, yaw = 0, shY = 0;
    let rArm = 0.45 - sw * 0.5, lArm = 0.3 + sw * 0.5, hz = 1.5, rLift = 0;
    let shieldK = 0;

    if (p.swingT >= 0) {
      const k = Math.min(1, p.swingT / p.swingDur), s = p.swingSide || 1, arc = S ? S.arc : 1.9;
      const th0 = -s * (arc * 0.5 + 0.55), th1 = s * (arc * 0.5 + 0.35);
      let th, az, hh;
      if (k < 0.28) { const u = outQ(k / 0.28); th = lerp(0, th0, u); az = lerp(0.45, 1.85, u); hh = lerp(1.5, 0.25, u); }
      else if (k < 0.56) { const v = smooth((k - 0.28) / 0.28); th = lerp(th0, th1, v); az = 1.6 + (1 - v) * 0.2; hh = 0.2; }
      else { const u = outQ((k - 0.56) / 0.44); th = lerp(th1, 0, u); az = lerp(1.57, 0.45, u); hh = lerp(0.2, 1.5, u); }
      shY = -th; rArm = az; hz = hh;
      const body = Math.sin(clamp01(k) * PI);
      yaw = -th * 0.42; lean = -0.32 * Math.sin(stanceK(k, 0.2, 0.7) * PI) + 0.1 * (k < 0.28 ? k / 0.28 : 0);
      rig.legR.rotation.z = 0.5 * body; rig.legL.rotation.z = -0.4 * body;
      bob -= 1.6 * body;
      lArm = lerp(lArm, -0.3, body);
    }
    if (p.castT > 0) {
      const k = clamp01(p.castT / 0.32);
      rArm = lerp(rArm, 1.95, outQ(1 - k * 0.6)); hz = lerp(hz, 0.15, 0.9); lean = -0.12; shY = 0;
      rig.castGlow.visible = true; rig.castGlow.scale.setScalar(2 + 5 * (1 - k)); rig.glowMat.color.set(p.castColor || '#ff8a2a').multiplyScalar(2);
    } else rig.castGlow.visible = false;

    if (rig.shield) {
      if (p.blocking) { shieldK = smooth(p.blockT / 0.12); lArm = lerp(lArm, 1.2, shieldK); rArm = lerp(rArm, 0.15, shieldK); lean += 0.12 * shieldK; hz = lerp(hz, 2.3, shieldK); }
      const flash = Math.max(p.blockFlash, p.parryFlash);
      rig.shieldFlash.material.opacity = flash > 0 ? Math.min(0.85, flash * 3.5) : 0;
      rig.shieldFlash.visible = flash > 0;
      rig.shield.position.set(lerp(1.2, 11.5, shieldK), lerp(8.5, 10.5, shieldK), lerp(-11.5, -4.2, shieldK));
      rig.shield.rotation.set(0, lerp(-0.55, 0.0, shieldK), lerp(0.1, 0, shieldK));
      rig.shield.rotation.x = lerp(0.12, 0, shieldK);
      rig.shield.scale.setScalar(1 + 0.06 * Math.max(0, Math.min(1, Math.max(p.blockFlash, p.parryFlash) * 3)));
    }
    rig.torso.position.y = 19 + bob;
    rig.torso.rotation.z = lean; rig.torso.rotation.y = yaw;
    rig.shR.rotation.y = shY; rig.shR.rotation.z = rArm; rig.handR.rotation.z = hz; rig.sword.rotation.z = 0;
    rig.shL.rotation.z = lArm;
    if (rig.cape) {
      const fl = Math.sin(t * 3.1) * 0.05 + Math.sin(t * 7.3) * 0.02 * mv;
      rig.cape.rotation.z = -(0.08 + mv * 0.16 + sprint * 0.22) + fl + (p.swingT >= 0 ? -0.1 : 0);
      rig.cape2.rotation.z = -(0.04 + mv * 0.2 + sprint * 0.2) + Math.sin(t * 4.3) * 0.08;
    }
    if (rig.plume) rig.plume.rotation.z = -0.1 - mv * 0.25 + Math.sin(t * 4) * 0.05;
    if (rig.head) rig.head.rotation.z = -lean * 0.4;
    if (rig.ring) { rig.ring.rotation.z = now * 1.2; rig.ring.position.y = 5 + Math.sin(now * 2) * 1.2; }
    if (rig.halo) { rig.halo.rotation.z = now * 0.8; }
  }

  /** Alle Meshes im Modell durch ein Material ersetzen (Treffer-Blinken) bzw. zurücksetzen */
  function setFlash(group, mat) {
    group.traverse(o => {
      if (!o.isMesh) return;
      if (mat) { if (!o.userData.m0) { o.userData.m0 = o.material; } o.material = mat; }
      else if (o.userData.m0) { o.material = o.userData.m0; o.userData.m0 = null; }
    });
  }

  /* ============================================================ REQUISITEN & PICKUPS */
  function prop(type) {
    const g = new THREE.Group();
    const wood = M('#7a5230'), iron = M('#2c2a2e', { t: 'p' });
    switch (type) {
      case 'barrel':
        P(g, 'cyl', wood, [11, 26, 11], [0, 13, 0]); P(g, 'cyl', M('#4a3320'), [11.6, 3, 11.6], [0, 6, 0]); P(g, 'cyl', M('#4a3320'), [11.6, 3, 11.6], [0, 19, 0]);
        P(g, 'cyl', M('#8f6339'), [10, 1, 10], [0, 26, 0]); break;
      case 'coffin': {
        const c = P(g, 'box', M('#4b3a2a'), [34, 14, 16], [0, 7, 0], [0, 0.4, 0]); c.scale.set(34, 14, 16);
        P(g, 'box', M('#5a4634'), [30, 3, 12], [0, 15, 0], [0, 0.4, 0]); P(g, 'box', M('#d9b94a', { t: 'p' }), [8, 1, 2], [0, 17, 0], [0, 0.4, 0]); break;
      }
      case 'crystal':
        for (const [x, z, s, rz] of [[0, 0, 1, 0], [9, 6, 0.6, 0.35], [-8, 5, 0.5, -0.4], [4, -8, 0.55, 0.2]]) P(g, 'oct', M('#7fdcff', { em: '#3fb8ff', ei: 1.1, op: 0.92 }), [6 * s, 26 * s, 6 * s], [x, 20 * s, z], [0, x, rz]);
        break;
      case 'spike': P(g, 'cone', M('#3a2024'), [6, 30, 6], [0, 15, 0]); P(g, 'cone', M('#6a2a30'), [3, 22, 3], [3, 11, 2]); break;
      case 'candle': { P(g, 'cyl', M('#e9e1c8'), [3, 12, 3], [0, 6, 0]); const f = FX.flame(5, 12, '#ffcf70', 1.4); f.position.set(0, 12, 0); g.add(f); break; }
      case 'mushroom':
        for (const [x, z, s] of [[0, 0, 1], [7, 3, 0.65], [-5, 5, 0.55]]) { P(g, 'cyl', M('#c9b48a'), [1.6 * s, 7 * s, 1.6 * s], [x, 3.5 * s, z]); P(g, 'sph', M('#b072ff', { em: '#8a4fe0', ei: 1.0 }), [6 * s, 3.6 * s, 6 * s], [x, 8 * s, z]); P(g, 'sph', M('#f1e6ff'), [1 * s, 1 * s, 1 * s], [x + 1.5 * s, 10.5 * s, z]); }
        break;
      case 'shard': P(g, 'oct', M('#7fdcff', { em: '#3fb8ff', ei: 1, op: 0.85 }), [2.4, 6, 2.4], [0, 4, 0], [0.2, 0, 0.3]); break;
      case 'torch':
        P(g, 'box', M('#4a3524'), [4, 16, 4], [0, 38, 0]); P(g, 'box', iron, [10, 4, 10], [0, 47, 0]);
        for (const [w, h, c, dx] of [[11, 24, '#ff9a3a', 0], [7, 18, '#ffd070', 0.8]]) { const f = FX.flame(w, h, c, 1.3); f.position.set(dx, 47, 0); g.add(f); }
        break;
      case 'brazier':
        P(g, 'cyl', iron, [3, 20, 3], [0, 10, 0]); P(g, 'cyl', M('#2c282a', { t: 'p' }), [14, 9, 14], [0, 24, 0]);
        for (const [w, h, c, dx] of [[24, 44, '#ff8a2a', 0], [16, 34, '#ffc060', 2], [10, 26, '#fff0b0', -2]]) { const f = FX.flame(w, h, c, 1.3); f.position.set(dx, 28, 0); g.add(f); }
        break;
    }
    return g;
  }

  return { enemy, player, prop, setFlash, M, P, G, L, GEO, glowM, eye, animPlayer, BODY, SWORD, SHIELD, lerp, smooth, outQ, clamp01 };
})();
