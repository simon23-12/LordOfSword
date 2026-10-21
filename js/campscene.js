/* Lord of Sword – Lager- und Titel-Szene (three.js): Lagerfeuer, Zelt, Dungeon-Eingang und der Kämpfer in seiner aktuellen Rüstung */
const CampScene = (function () {
  'use strict';
  const PI = Math.PI, TAU = PI * 2;
  const sc = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 10, 9000);
  const S = { hero: null, sig: '', flames: [], parts: [], particles: null, fire: null, portal: null, camT: 0, t0: 0, swingAt: 4, fake: null, built: false, cur: { ly: 80, z: 350, cy: 140 } };
  const mat = (c, o) => Models.M(c, o);
  const P = Models.P, G = Models.G;

  function rnd(a, b) { return a + Math.random() * (b - a); }

  function build() {
    sc.background = new THREE.Color('#070916');
    sc.fog = new THREE.FogExp2('#0b0e22', 0.00055);
    sc.add(new THREE.HemisphereLight('#5a6cb0', '#241a14', 2.4));
    const moon = new THREE.DirectionalLight('#a8b8ff', 2.4); moon.position.set(-300, 520, 240); moon.target.position.set(0, 0, 0);
    moon.castShadow = true; moon.shadow.mapSize.set(2048, 2048);
    const sh = moon.shadow.camera; sh.left = -320; sh.right = 320; sh.top = 320; sh.bottom = -320; sh.near = 50; sh.far = 1400; moon.shadow.bias = -0.0006; moon.shadow.normalBias = 0.6;
    sc.add(moon, moon.target);

    // Boden
    const gt = FX.canvasTex(256, 256, (c, w, h) => {
      c.fillStyle = '#3a3430'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 1400; i++) { const v = 40 + Math.random() * 40 | 0; c.fillStyle = `rgba(${v},${v - 4},${v - 8},${Math.random() * 0.5})`; c.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 6, 2 + Math.random() * 5); }
    });
    gt.wrapS = gt.wrapT = THREE.RepeatWrapping; gt.repeat.set(30, 30);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(2600, 48), new THREE.MeshLambertMaterial({ map: gt, color: '#7a7068' }));
    ground.rotation.x = -PI / 2; ground.receiveShadow = true; sc.add(ground);
    // Pfad zum Eingang
    const path = new THREE.Mesh(new THREE.PlaneGeometry(130, 900), new THREE.MeshLambertMaterial({ color: '#463c34' }));
    path.rotation.x = -PI / 2; path.position.set(0, 0.4, -140); path.receiveShadow = true; sc.add(path);

    // Sterne & Mond
    const n = 500, sp = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const a = Math.random() * TAU, e = 0.12 + Math.random() * 1.2, r = 4200; sp[i * 3] = Math.cos(a) * Math.cos(e) * r; sp[i * 3 + 1] = Math.sin(e) * r; sp[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r - 800; }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: '#dfe6ff', size: 2.4, sizeAttenuation: false, fog: false })); sc.add(stars);
    const moonM = new THREE.Mesh(new THREE.SphereGeometry(120, 24, 16), new THREE.MeshBasicMaterial({ color: '#e8ecfa', fog: false })); moonM.position.set(1000, 1000, -3200); sc.add(moonM);
    const halo = FX.sprite('#b8c8ff', 900, 0.5); halo.position.copy(moonM.position); halo.material.fog = false; sc.add(halo);

    // Berge
    const rock = mat('#0d1022'), rock2 = mat('#10142a');
    for (let i = 0; i < 18; i++) {
      const a = -0.9 * PI + i / 17 * 0.8 * PI, r = 2300 + Math.random() * 500, h = 380 + Math.random() * 700;
      const m = P(sc, 'cone', i % 2 ? rock : rock2, [260 + Math.random() * 260, h, 260 + Math.random() * 200], [Math.cos(a) * r, h / 2 - 20, Math.sin(a) * r - 300], [0, Math.random() * 3, 0]);
      m.castShadow = false;
    }
    // Kiefern
    const trunk = mat('#2a1c14'), pine = mat('#0c2018'), pine2 = mat('#102a20');
    const trees = [];
    for (let i = 0; i < 46; i++) {
      const a = Math.random() * TAU, r = 300 + Math.random() * 900;
      let x = Math.cos(a) * r, z = Math.sin(a) * r - 120;
      if (Math.abs(x) < 220 && z > -460) continue;
      const s = 0.8 + Math.random() * 1.4, g = G(sc, x, 0, z);
      P(g, 'cyl', trunk, [5 * s, 40 * s, 5 * s], [0, 20 * s, 0]);
      for (let k = 0; k < 3; k++) P(g, 'cone', k % 2 ? pine : pine2, [(34 - k * 8) * s, (60 - k * 6) * s, (34 - k * 8) * s], [0, (46 + k * 30) * s, 0]);
      g.traverse(o => { o.castShadow = true; }); trees.push(g);
    }

    // Dungeon-Eingang
    const stone = mat('#3a3844', { t: 'p', sh: 10 }), stoneD = mat('#2a2832');
    const arch = G(sc, 0, 0, -330);
    P(arch, 'box', stone, [46, 210, 52], [-100, 105, 0]); P(arch, 'box', stone, [46, 210, 52], [100, 105, 0]);
    P(arch, 'box', stone, [290, 46, 58], [0, 232, 0]);
    for (let i = 0; i < 9; i++) { const a = PI * i / 8; P(arch, 'box', stoneD, [34, 28, 54], [Math.cos(a) * 78 * -1, 205 + Math.sin(a) * 40, 0], [0, 0, a - PI / 2]); }
    P(arch, 'box', stoneD, [54, 24, 60], [-100, 6, 0]); P(arch, 'box', stoneD, [54, 24, 60], [100, 6, 0]);
    const pg = FX.canvasTex(128, 256, (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#120406'); g.addColorStop(0.6, '#5a0c0a'); g.addColorStop(1, '#ff5a1a'); c.fillStyle = g; c.fillRect(0, 0, w, h); });
    const portal = new THREE.Mesh(new THREE.PlaneGeometry(150, 205), new THREE.MeshBasicMaterial({ map: pg, color: new THREE.Color(1.3, 1.0, 1.0) })); portal.position.set(0, 102, -4); arch.add(portal); S.portal = portal;
    S.portalLight = new THREE.PointLight('#ff4a20', 60000, 800, 2); S.portalLight.position.set(0, 80, -300); sc.add(S.portalLight);
    for (const x of [-100, 100]) { const b = G(arch, x, 0, 38); P(b, 'cyl', mat('#2c282a', { t: 'p' }), [12, 10, 12], [0, 40, 0]); P(b, 'cyl', mat('#2c282a'), [3, 40, 3], [0, 20, 0]); const f = FX.flame(22, 40, '#ff9a3a', 1.3); f.position.set(0, 46, 0); b.add(f); S.flames.push(f); const l = new THREE.PointLight('#ff8a3a', 9000, 360, 2); l.position.set(x, 70, 40); l.userData.base = 9000; sc.add(l); S.flames.push(l); }

    // Zelt
    const tent = G(sc, -330, 0, -90); tent.rotation.y = 0.5;
    const tm = new THREE.Mesh(new THREE.ConeGeometry(130, 150, 4, 1, true), new THREE.MeshLambertMaterial({ color: '#4a3c52', side: THREE.DoubleSide, flatShading: true })); tm.rotation.y = PI / 4; tm.position.y = 75; tm.castShadow = true; tent.add(tm);
    P(tent, 'box', mat('#120d16'), [2, 88, 56], [66, 44, 0], [0, 0, 0.0]);
    P(tent, 'cyl', mat('#2a1c14'), [3, 170, 3], [0, 85, 0]);

    // Lagerfeuer
    const fire = G(sc, 34, 0, 10); S.fire = fire;
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; P(fire, 'ico', mat('#4a4a4e'), [8, 6.5, 8], [Math.cos(a) * 26, 3, Math.sin(a) * 26], [Math.random(), Math.random(), 0]); }
    P(fire, 'cyl', mat('#3a2616'), [5, 52, 5], [0, 6, 0], [0, 0.5, PI / 2 - 0.12]); P(fire, 'cyl', mat('#2f1f12'), [5, 52, 5], [0, 6, 0], [0, -0.7, PI / 2 + 0.1]); P(fire, 'cyl', mat('#35200f'), [4.5, 48, 4.5], [0, 8, 0], [PI / 2 - 0.1, 0.2, 0]);
    const coal = P(fire, 'cyl', Models.glowM('#ff5a1a', 1.2, false), [20, 3, 20], [0, 4, 0]); coal.castShadow = false;
    for (const [dx, w, h, c, k] of [[-8, 26, 46, '#ff7a1c', 0], [0, 34, 64, '#ff9a2a', 1], [9, 24, 42, '#ff6a14', 2], [0, 18, 38, '#fff0a0', 3]]) {
      const f = FX.flame(w, h, c, 1.35); f.position.set(dx, 6, 0); f.userData.k = k; fire.add(f); S.flames.push(f);
    }
    S.fireLight = new THREE.PointLight('#ff8a3a', 24000, 900, 2); S.fireLight.position.set(34, 48, 10); S.fireLight.castShadow = false; sc.add(S.fireLight);
    S.particles = FX.createParticles(sc);

    // Kämpfer
    S.fake = { anim: 0, moving: false, sprinting: false, swingT: -1, swingDur: 0.3, swingSide: 1, swingDir: 0, blocking: false, blockT: 0, castT: 0, blockFlash: 0, parryFlash: 0, face: 0 };
    S.built = true;
  }

  function ensureHero() {
    const sv = Save.data || { level: 1, pts: { atk: 0, def: 0, vit: 0, mag: 0 } };
    const S_ = LOS.derive(sv.level, sv.pts, []);
    const tb = LOS.bodyTier(sv.level), ts = LOS.gearTier(sv.pts.atk), tsh = LOS.gearTier(sv.pts.def), sh = !!S_.block;
    const sig = [tb, ts, tsh, sh].join('|');
    if (S.sig === sig && S.hero) return;
    if (S.hero) sc.remove(S.hero.g.parent);
    const rig = Models.player(tb, ts, tsh, sh);
    const holder = new THREE.Group(); holder.add(rig.g); holder.position.set(-30, 0, 24); holder.rotation.y = -0.85; holder.scale.setScalar(1.0);
    rig.g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    sc.add(holder);
    S.hero = rig; S.sig = sig; S.S = S_;
  }

  function init() { build(); }
  function setActive() { /* Szene hat keinen eigenen Zustand zum (de)aktivieren */ }

  function update(now, dt, inCamp) {
    ensureHero();
    // Kamera: im Lager zwischen den Seitenpaneelen, auf dem Titel weiter unten im Bild (Platz fürs Logo)
    const tgt = inCamp ? { y: 96, z: 410, ly: 8 } : { y: 150, z: 400, ly: 70 };
    const k = Math.min(1, dt * 3);
    S.cur.ly += (tgt.ly - S.cur.ly) * k; S.cur.z += (tgt.z - S.cur.z) * k; S.cur.cy += (tgt.y - S.cur.cy) * k;
    camera.position.set(0, S.cur.cy, S.cur.z);
    camera.lookAt(0, S.cur.ly, 0);
    // Flammen & Lichter
    for (const f of S.flames) {
      if (f.isLight) { f.intensity = f.userData.base * (0.85 + 0.25 * Math.sin(now * 11 + f.position.x)); continue; }
      if (!f.userData.sy) f.userData.sy = f.scale.y;
      f.scale.y = f.userData.sy * (0.8 + 0.35 * Math.sin(now * (8 + (f.userData.k || 0) * 3) + f.position.x));
      f.rotation.z = Math.sin(now * 5 + (f.userData.k || 0)) * 0.1;
    }
    S.fireLight.intensity = 24000 * (0.88 + 0.16 * Math.sin(now * 12) + 0.06 * Math.sin(now * 31));
    S.portalLight.intensity = 60000 * (0.9 + 0.12 * Math.sin(now * 3));
    // Funken
    if (Math.random() < dt * 40) S.parts.push({ x: 34 + rnd(-8, 8), y: 10 + rnd(-8, 8), z: 30, vx: rnd(-14, 14), vy: rnd(-14, 14), vz: rnd(50, 110), life: rnd(0.9, 2.0), max: 2.0, color: Math.random() < 0.5 ? '#ffb347' : '#ff7a2a', size: rnd(1.2, 2.4), grav: 0, add: true });
    if (Math.random() < dt * 8) S.parts.push({ x: 34 + rnd(-6, 6), y: 10 + rnd(-6, 6), z: 50, vx: rnd(-6, 6), vy: rnd(-6, 6), vz: rnd(24, 40), life: 3, max: 3, color: '#2a2624', size: rnd(8, 14), grav: 0, add: false });
    for (const q of S.parts) { q.life -= dt; q.x += q.vx * dt + Math.sin(now * 3 + q.z * 0.05) * 6 * dt; q.y += q.vy * dt; q.z += q.vz * dt; }
    S.parts = S.parts.filter(q => q.life > 0);
    FX.updateParticles(S.particles, S.parts, Render.pxPerUnit() * LOS.CAM.view / (2 * Math.tan(15 * PI / 180) * Math.hypot(S.cur.z, S.cur.cy - 20)));
    // Kämpfer: Atmen, gelegentlich ein Übungsschlag
    if (S.hero) {
      const f = S.fake; f.anim = now; f.swingSide = f.swingSide || 1;
      if (f.swingT < 0 && now > S.swingAt) { f.swingT = 0; f.swingSide = -f.swingSide; S.swingAt = now + 4 + Math.random() * 3; }
      if (f.swingT >= 0) { f.swingT += dt; if (f.swingT >= f.swingDur) f.swingT = -1; }
      Models.animPlayer(S.hero, f, S.S, now);
    }
  }

  return { init, update, setActive, scene: sc, camera };
})();
