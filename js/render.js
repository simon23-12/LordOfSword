/* Lord of Sword – Rendering mit three.js: isometrische Dungeon-Ansicht, Licht, Schatten, Bloom, Figuren, Effekte
 * Die Spiellogik (game.js) bleibt 2D (x/y auf dem Boden, z = Höhe); hier wird sie als 3D-Szene (x, z, y) dargestellt. */
const Render = (function () {
  'use strict';
  const T = LOS.TILE, W = 1280, H = 720, ZONES = LOS.ZONES, CAM = LOS.CAM, TAU = Math.PI * 2;
  const CY = Math.cos(CAM.yaw), SY = Math.sin(CAM.yaw);
  const WALL_H = 78;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return d; };
  const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

  let renderer, composer, renderPass, bloom, pxRatio = 1, glOk = false;
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 50, 4000);
  let particles = null;
  const tune = { ambient: 1.0, key: 1.0, lantern: 1.0, lights: 1.0, bloom: 0.55 };

  /* ============================================================ Start */
  function init() {
    Hud.init();
    const canvas = document.getElementById('gl');
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    } catch (err) { console.error(err); document.getElementById('nogl').classList.remove('hidden'); return; }
    glOk = true;
    renderer.setPixelRatio(1); renderer.setSize(W, H, false);
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
    const aspect = W / H, hh = CAM.view / 2;
    camera.left = -hh * aspect; camera.right = hh * aspect; camera.top = hh; camera.bottom = -hh; camera.updateProjectionMatrix();
    const target = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 });
    composer = new THREE.EffectComposer(renderer, target);
    renderPass = new THREE.RenderPass(new THREE.Scene(), camera);
    bloom = new THREE.UnrealBloomPass(new THREE.Vector2(W, H), tune.bloom, 0.55, 0.85);
    composer.addPass(renderPass); composer.addPass(bloom); composer.addPass(new THREE.OutputPass());
    buildRunScene();
    CampScene.init();
  }
  /** Auflösung (Bildschirm-Pixel pro Spielpixel) */
  function setQuality(q) {
    pxRatio = q;
    if (!glOk) return;
    renderer.setPixelRatio(q); renderer.setSize(W, H, false);
    composer.setPixelRatio(q); composer.setSize(W, H);
  }
  const pxPerUnit = () => H * pxRatio / CAM.view;

  function placeCamera(cx, cz, sx, sz) {
    const d = 1500, cp = Math.cos(CAM.pitch), sp = Math.sin(CAM.pitch);
    camera.position.set(cx + CY * cp * d + sx, sp * d, cz + SY * cp * d + sz);
    camera.lookAt(cx + sx, 8, cz + sz);
    camera.updateMatrixWorld();
  }
  const _v = new THREE.Vector3();
  function proj(x, h, z) {
    _v.set(x, h, z).project(camera);
    return { x: (_v.x + 1) / 2 * W, y: (1 - _v.y) / 2 * H };
  }

  /* ============================================================ Texturen */
  function stoneTexture(kind) {
    return FX.canvasTex(256, 256, (c, w, h) => {
      c.fillStyle = '#d4d0c8'; c.fillRect(0, 0, w, h);
      const rows = kind === 'wall' ? 4 : 2, cols = 2;
      const bh = h / rows;
      for (let r = 0; r < rows; r++) {
        const off = kind === 'wall' && r % 2 ? w / cols / 2 : 0, bw = w / cols;
        for (let q = -1; q <= cols; q++) {
          const sh = 190 + Math.random() * 55 | 0;
          c.fillStyle = `rgb(${sh},${sh - 4},${sh - 10})`; c.fillRect(q * bw + off, r * bh, bw, bh);
          const g = c.createLinearGradient(0, r * bh, 0, r * bh + bh); g.addColorStop(0, 'rgba(255,255,255,0.14)'); g.addColorStop(1, 'rgba(0,0,0,0.16)');
          c.fillStyle = g; c.fillRect(q * bw + off, r * bh, bw, bh);
        }
      }
      c.strokeStyle = 'rgba(40,36,32,0.85)'; c.lineWidth = kind === 'wall' ? 5 : 6;
      for (let r = 0; r <= rows; r++) { c.beginPath(); c.moveTo(0, r * bh); c.lineTo(w, r * bh); c.stroke(); }
      for (let r = 0; r < rows; r++) { const off = kind === 'wall' && r % 2 ? w / cols / 2 : 0; for (let q = 0; q <= cols; q++) { const x = (q * w / cols + off) % w; c.beginPath(); c.moveTo(x, r * bh); c.lineTo(x, r * bh + bh); c.stroke(); } }
      for (let i = 0; i < 900; i++) { c.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${Math.random() * 0.12})`; c.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 1 + Math.random() * 3); }
      for (let i = 0; i < 6; i++) { c.strokeStyle = 'rgba(30,26,22,0.35)'; c.lineWidth = 1.4; c.beginPath(); let x = Math.random() * w, y = Math.random() * h; c.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (Math.random() - 0.5) * 36; y += (Math.random() - 0.3) * 30; c.lineTo(x, y); } c.stroke(); }
    });
  }
  const decalDraw = {
    bones(c) { c.strokeStyle = 'rgba(225,218,196,0.9)'; c.lineWidth = 5; c.lineCap = 'round'; c.beginPath(); c.moveTo(14, 28); c.lineTo(50, 38); c.moveTo(20, 50); c.lineTo(46, 18); c.stroke(); for (const [x, y] of [[14, 28], [50, 38], [20, 50], [46, 18]]) { c.fillStyle = '#e6dfc8'; c.beginPath(); c.arc(x, y, 4, 0, TAU); c.fill(); } },
    skull(c) { c.fillStyle = '#dcd5bd'; c.beginPath(); c.arc(32, 32, 13, 0, TAU); c.fill(); c.fillRect(26, 40, 12, 8); c.fillStyle = '#201a14'; c.beginPath(); c.arc(27, 30, 3.4, 0, TAU); c.arc(37, 30, 3.4, 0, TAU); c.fill(); c.fillRect(30, 38, 4, 4); },
    crack(c) { c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 2.4; c.lineJoin = 'round'; c.beginPath(); c.moveTo(4, 32); c.lineTo(22, 38); c.lineTo(34, 26); c.lineTo(60, 34); c.moveTo(34, 26); c.lineTo(40, 12); c.stroke(); },
    web(c) { c.strokeStyle = 'rgba(225,225,225,0.4)'; c.lineWidth = 1.2; for (let i = 0; i < 7; i++) { c.beginPath(); c.moveTo(32, 32); c.lineTo(32 + Math.cos(i * 0.9) * 30, 32 + Math.sin(i * 0.9) * 30); c.stroke(); } for (const r of [8, 16, 24]) { c.beginPath(); c.arc(32, 32, r, 0, TAU); c.stroke(); } },
    goo(c) { c.fillStyle = 'rgba(110,200,70,0.5)'; c.beginPath(); c.ellipse(32, 32, 26, 16, 0, 0, TAU); c.fill(); c.fillStyle = 'rgba(190,255,130,0.4)'; c.beginPath(); c.ellipse(36, 30, 11, 6, 0, 0, TAU); c.fill(); },
    blood(c) { c.fillStyle = 'rgba(120,10,16,0.7)'; c.beginPath(); c.ellipse(32, 32, 28, 17, 0, 0, TAU); c.fill(); c.fillStyle = 'rgba(170,22,28,0.5)'; c.beginPath(); c.ellipse(24, 36, 11, 6, 0, 0, TAU); c.fill(); },
  };
  const decalTex = {};
  function decalTexture(type) {
    if (!decalTex[type]) decalTex[type] = FX.canvasTex(64, 64, (c) => decalDraw[type](c));
    return decalTex[type];
  }
  let blobMat, floorMat, wallSideMat, wallTopMat, floorGeo, wallGeo;
  function sharedAssets() {
    blobMat = new THREE.MeshBasicMaterial({ map: FX.canvasTex(64, 64, (c, w, h) => { const g = c.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(0,0,0,0.75)'); g.addColorStop(0.6, 'rgba(0,0,0,0.35)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); }), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    const ft = stoneTexture('floor'), wt = stoneTexture('wall');
    floorMat = new THREE.MeshLambertMaterial({ map: ft });
    wallSideMat = new THREE.MeshLambertMaterial({ map: wt });
    wallTopMat = new THREE.MeshLambertMaterial({ color: '#d8d4cc' });
    floorGeo = new THREE.BoxGeometry(T, 6, T);
    wallGeo = new THREE.BoxGeometry(T, WALL_H, T);
  }

  /* ============================================================ Lauf-Szene */
  const run = { scene: null, mapGroup: null, ent: null, fxg: null, curR: null, map: null, views: {}, stampN: 0, pool: [], fxPool: [], hoverRing: null, slash: null, playerView: null, flames: [], fires: [], breakables: [], wall: null, wallIdx: null, wallCur: null, lastNow: 0 };
  const POOL = 6, FXPOOL = 3;

  function buildRunScene() {
    sharedAssets();
    const sc = run.scene = new THREE.Scene();
    sc.background = new THREE.Color('#050406');
    run.amb = new THREE.HemisphereLight('#7c86b8', '#2a2018', 1.6); sc.add(run.amb);
    run.key = new THREE.DirectionalLight('#9fb4ff', 1.5); run.key.castShadow = true;
    const sh = run.key.shadow; sh.mapSize.set(2048, 2048); sh.camera.left = -330; sh.camera.right = 330; sh.camera.top = 330; sh.camera.bottom = -330; sh.camera.near = 50; sh.camera.far = 1500; sh.bias = -0.0006; sh.normalBias = 0.8; sh.radius = 2.5;
    sc.add(run.key, run.key.target);
    run.lantern = new THREE.PointLight('#ffd9a8', 15000, 520, 2); sc.add(run.lantern);
    for (let i = 0; i < POOL; i++) { const L = new THREE.PointLight('#ffb060', 0, 400, 2); sc.add(L); run.pool.push({ L, src: null, cur: 0, want: 0 }); }
    for (let i = 0; i < FXPOOL; i++) { const L = new THREE.PointLight('#ffffff', 0, 380, 2); sc.add(L); run.fxPool.push(L); }
    run.mapGroup = new THREE.Group(); run.ent = new THREE.Group(); run.fxg = new THREE.Group();
    sc.add(run.mapGroup, run.ent, run.fxg);
    particles = FX.createParticles(sc);
    run.views = { enemy: new Map(), pickup: new Map(), eproj: new Map(), pproj: new Map(), fx: new Map(), tele: new Map() };
    const hr = new THREE.Mesh(FX.geo.ring, FX.add('#ff6a4a', 0.9, 1.6)); hr.visible = false; hr.position.y = 1.5; run.hoverRing = hr; run.ent.add(hr);
    run.slash = makeSlash(); run.ent.add(run.slash.mesh);
  }

  /** Schwung-Spur: leuchtende Sichel, die dem Schwertschlag folgt */
  function makeSlash() {
    const N = 36, pos = [], aT = [], aR = [], idx = [];
    for (let i = 0; i <= N; i++) { const t = i / N; for (const r of [0, 1]) { pos.push(0, 0, 0); aT.push(t); aR.push(r); } if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aT', new THREE.Float32BufferAttribute(aT, 1)); g.setAttribute('aR', new THREE.Float32BufferAttribute(aR, 1)); g.setIndex(idx);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uArc: { value: 1.9 }, uHead: { value: 0 }, uSide: { value: 1 }, uAlpha: { value: 1 }, uReach: { value: 60 }, uColor: { value: new THREE.Color('#fff') } },
      vertexShader: `attribute float aT; attribute float aR; uniform float uArc; uniform float uReach; varying float vT; varying float vR;
        void main(){ vT = aT; vR = aR; float ang = (aT - 0.5) * (uArc + 0.5); float rin = 1.0 - 0.62 * sin(3.14159 * aT); float r = mix(rin, 1.0, aR) * uReach;
          vec3 p = vec3(cos(ang) * r, 26.0 + sin(aT * 3.14159) * 3.0, sin(ang) * r); gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
      fragmentShader: `varying float vT; varying float vR; uniform float uHead; uniform float uSide; uniform float uAlpha; uniform vec3 uColor;
        void main(){ float tp = uSide > 0.0 ? vT : 1.0 - vT; float d = uHead - tp; if (d < 0.0) discard;
          float a = exp(-d * 3.6); float edge = mix(0.25, 1.0, vR * vR); vec3 c = mix(uColor, vec3(1.0), exp(-d * 12.0)) * 1.7; gl_FragColor = vec4(c, a * edge * uAlpha); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false; mesh.visible = false; mesh.renderOrder = 6;
    return { mesh, mat };
  }

  /* ------------------------------------------------------------ Karte bauen */
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
  function wallVisible(map, x, y) {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < map.w && ny < map.h && map.tiles[ny * map.w + nx]) return true;
    }
    return false;
  }

  function clearGroup(g) { while (g.children.length) { const o = g.children[0]; g.remove(o); if (o.isInstancedMesh) o.dispose(); } }

  function buildMap(map) {
    clearGroup(run.mapGroup);
    run.flames = []; run.breakables = []; run.fires = [];
    let nf = 0, nw = 0;
    for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) { if (map.tiles[y * map.w + x]) nf++; else if (wallVisible(map, x, y)) nw++; }
    const floor = new THREE.InstancedMesh(floorGeo, floorMat, nf), wall = new THREE.InstancedMesh(wallGeo, [wallSideMat, wallSideMat, wallTopMat, wallTopMat, wallSideMat, wallSideMat], nw);
    floor.receiveShadow = true; wall.receiveShadow = true; wall.castShadow = true; floor.frustumCulled = false; wall.frustumCulled = false;
    const m4 = new THREE.Matrix4(), col = new THREE.Color();
    let fi = 0, wi = 0;
    const wallIdx = new Int32Array(map.w * map.h).fill(-1);
    for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
      const k = y * map.w + x, z = zoneAt(map, x, y), Z = ZONES[z], h = hash(x, y);
      if (map.tiles[k]) {
        m4.makeTranslation(x * T + T / 2, -3, y * T + T / 2); floor.setMatrixAt(fi, m4);
        col.set(Z.floor[(x + y) & 1]).multiplyScalar(h < 0.2 ? 1.7 : h > 0.85 ? 2.35 : 2.0); floor.setColorAt(fi, col); fi++;
      } else if (wallVisible(map, x, y)) {
        m4.makeTranslation(x * T + T / 2, WALL_H / 2, y * T + T / 2); wall.setMatrixAt(wi, m4);
        col.set(Z.wall[0]).multiplyScalar(h < 0.3 ? 2.9 : 2.5); wall.setColorAt(wi, col);
        wallIdx[k] = wi; wi++;
      }
    }
    floor.instanceMatrix.needsUpdate = true; wall.instanceMatrix.needsUpdate = true;
    if (floor.instanceColor) floor.instanceColor.needsUpdate = true;
    if (wall.instanceColor) wall.instanceColor.needsUpdate = true;
    run.mapGroup.add(floor, wall);
    run.wall = wall; run.wallIdx = wallIdx; run.wallCur = new Float32Array(nw).fill(1); run.map = map;
    const decals = new THREE.Group(); run.mapGroup.add(decals);
    for (const pr of map.props) {
      const type = pr.type;
      if (decalDraw[type]) {
        const m = new THREE.Mesh(FX.geo.plane, new THREE.MeshLambertMaterial({ map: decalTexture(type), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
        const s = 44 * pr.s; m.scale.set(s, 1, s); m.position.set(pr.x, 0.35, pr.y); m.rotation.y = pr.a || 0; m.receiveShadow = true; decals.add(m);
        continue;
      }
      const g = Models.prop(type);
      if (!g.children.length) continue;
      g.position.set(pr.x, 0, type === 'torch' ? pr.y + 5 : type === 'barrel' ? pr.y - 6 : pr.y);
      if (pr.a && type !== 'torch' && type !== 'brazier') g.rotation.y = pr.a;
      g.traverse(o => { if (o.isMesh) { o.receiveShadow = true; if (o.userData.flame) { o.castShadow = false; run.flames.push(o); } } });
      run.mapGroup.add(g);
      if (pr.breakable) run.breakables.push({ pr, obj: g });
      if (type === 'bonfire') run.fires.push({ pr, fireG: g.userData.fireG, readyG: g.userData.readyG });
    }
  }

  /** Mauern zwischen Kamera und Spieler absenken, damit man die Figur immer sieht */
  const _m4 = new THREE.Matrix4(), _s = new THREE.Vector3(), _q = new THREE.Quaternion();
  function updateWalls(map, px, py, dt) {
    const wall = run.wall; if (!wall) return;
    const tx0 = Math.floor(px / T), ty0 = Math.floor(py / T), R = 5;
    let dirty = false;
    for (let ty = ty0 - R; ty <= ty0 + R; ty++) for (let tx = tx0 - R; tx <= tx0 + R; tx++) {
      if (tx < 0 || ty < 0 || tx >= map.w || ty >= map.h) continue;
      const wi = run.wallIdx[ty * map.w + tx]; if (wi < 0) continue;
      const dx = (tx + 0.5) * T - px, dy = (ty + 0.5) * T - py;
      const s = dx * CY + dy * SY, q = -dx * SY + dy * CY;
      const target = s > -T * 0.4 && s < T * 7 && Math.abs(q) < T * 2.3 ? 0.22 : 1;
      const cur = run.wallCur[wi];
      if (Math.abs(cur - target) < 0.004) continue;
      const n = cur + (target - cur) * Math.min(1, dt * 9);
      run.wallCur[wi] = Math.abs(n - target) < 0.01 ? target : n;
      _s.set(1, run.wallCur[wi], 1);
      _m4.compose(_v.set(tx * T + T / 2, WALL_H * run.wallCur[wi] / 2, ty * T + T / 2), _q.identity(), _s);
      wall.setMatrixAt(wi, _m4); dirty = true;
    }
    if (dirty) wall.instanceMatrix.needsUpdate = true;
  }

  /* ------------------------------------------------------------ Synchronisation (Spielzustand -> Szene) */
  function sync(store, list, make, upd, parent) {
    const stamp = ++run.stampN;
    for (const it of list) {
      let v = store.get(it);
      if (!v) { v = make(it); if (!v) continue; store.set(it, v); parent.add(v.obj); }
      v.stamp = stamp; upd(v, it);
    }
    for (const [it, v] of store) if (v.stamp !== stamp) { parent.remove(v.obj); if (v.dispose) v.dispose(); store.delete(it); }
  }

  const FLASH = Models.M('#ffffff', { t: 'b', glow: 1.15 }), HURT = Models.M('#ff7a6a', { t: 'b', glow: 1.0 });
  function setShadow(group, on) { group.traverse(o => { if (o.isMesh) o.castShadow = on; }); }

  function makeEnemyView(e, R) {
    const rig = Models.enemy(e.look), obj = new THREE.Group();
    obj.add(rig.g); rig.g.scale.setScalar(e.r * (rig.scale || 1));
    const blob = new THREE.Mesh(FX.geo.plane, blobMat); blob.scale.set(e.r * 3.4, 1, e.r * 3.4); blob.position.y = 0.4; obj.add(blob);
    let ring = null;
    if (e.elite) {
      ring = new THREE.Mesh(FX.geo.ring, FX.add(e.tint, 0.85, 1.7)); ring.scale.set(e.r * 2.3, 1, e.r * 2.3); ring.position.y = 1; obj.add(ring);
      const halo = FX.sprite(e.tint, e.r * 6, 0.45); halo.position.y = e.r * 1.8; obj.add(halo);
    }
    return { obj, rig, blob, ring, face: Math.atan2(R.p.y - e.y, R.p.x - e.x), flashed: false, shadow: false, dispose() { if (ring) ring.material.dispose(); } };
  }
  function updateEnemyView(v, e, R, now, dt) {
    const p = R.p, rig = v.rig;
    v.obj.position.set(e.x, 0, e.y);
    let tf = v.face;
    if (e.dash > 0) tf = Math.atan2(e.dashY, e.dashX);
    else if (e.state === 'awake' && !p.dead) tf = Math.atan2(p.y - e.y, p.x - e.x);
    v.face += clamp(angDiff(tf, v.face), -11 * dt, 11 * dt);
    rig.g.rotation.y = -v.face;
    rig.anim(rig, e, now);
    rig.g.position.y = (rig.g.userData.hoverY || 0) * e.r;
    if (e.dead) {
      const k = clamp(e.deadT / 0.8, 0, 1), fall = Math.min(1, k * 2.6);
      if (rig.kind === 'blob') rig.g.scale.set(e.r * (1 + fall * 0.5), e.r * (1 - fall * 0.85), e.r * (1 + fall * 0.5));
      else if (rig.kind === 'bat') rig.g.position.y *= (1 - fall);
      else { rig.g.rotation.z = -fall * 1.45; rig.g.position.y = -k * k * e.r * 0.5; }
      v.blob.scale.set(e.r * 3.4 * (1 - k * 0.7), 1, e.r * 3.4 * (1 - k * 0.7));
      if (v.ring) v.ring.visible = false;
    }
    if ((e.flash > 0) !== v.flashed) { v.flashed = e.flash > 0; Models.setFlash(rig.g, v.flashed ? FLASH : null); }
    const near = Math.hypot(e.x - p.x, e.y - p.y) < 480 && !e.dead;
    if (near !== v.shadow) { v.shadow = near; setShadow(rig.g, near); }
    if (v.ring) { v.ring.rotation.y = now * 1.5; const s = e.r * 2.3 * (1 + 0.06 * Math.sin(now * 5)); v.ring.scale.set(s, 1, s); }
  }

  /* ------------------------------------------------------------ Kämpfer */
  function playerSig(R) {
    const sv = Save.data, S = R.S;
    return [LOS.bodyTier(sv.level), LOS.gearTier(sv.pts.atk), LOS.gearTier(sv.pts.def), !!S.block].join('|');
  }
  function ensurePlayerView(R) {
    const sig = playerSig(R), pv = run.playerView;
    if (pv && pv.sig === sig) return pv;
    const keep = pv ? pv.rig.faceCur : R.p.face;
    if (pv) run.ent.remove(pv.obj);
    const sv = Save.data, S = R.S;
    const tb = LOS.bodyTier(sv.level), ts = LOS.gearTier(sv.pts.atk);
    const rig = Models.player(tb, ts, LOS.gearTier(sv.pts.def), !!S.block);
    rig.faceCur = keep;
    const obj = new THREE.Group(); obj.add(rig.g);
    const blob = new THREE.Mesh(FX.geo.plane, blobMat); blob.scale.set(40, 1, 40); blob.position.y = 0.45; obj.add(blob);
    setShadow(rig.g, true);
    run.ent.add(obj);
    run.playerView = { sig, rig, obj, blob, hurt: false, tb, ts };
    return run.playerView;
  }
  function updatePlayerView(R, now, dt) {
    const p = R.p, S = R.S, pv = ensurePlayerView(R), rig = pv.rig;
    pv.obj.position.set(p.x, 0, p.y);
    const rate = p.swingT >= 0 ? 45 : 18;
    rig.faceCur += clamp(angDiff(p.face, rig.faceCur), -rate * dt, rate * dt);
    rig.g.rotation.y = -rig.faceCur;
    Models.animPlayer(rig, p, S, now);
    if (p.dead) { const k = Math.min(1, R.overT * 2.2); rig.g.rotation.z = -k * 1.5; rig.g.position.y = -k * 4; }
    else { rig.g.rotation.z = 0; rig.g.position.y = 0; }
    const hurt = p.hurtT > 0 && Math.sin(now * 70) > 0;
    if (hurt !== pv.hurt) { pv.hurt = hurt; Models.setFlash(rig.g, hurt ? HURT : null); }
    const B = Models.BODY[pv.tb];
    if (B.aura && Math.random() < dt * 26) R.parts.push({ x: p.x + (Math.random() - 0.5) * 20, y: p.y + (Math.random() - 0.5) * 20, z: 4 + Math.random() * 20, vx: 0, vy: 0, vz: 24 + Math.random() * 30, life: 0.9, max: 0.9, color: B.aura, size: 2.2, grav: 0, add: true });
    const sl = run.slash;
    if (p.swingT >= 0) {
      const k = p.swingT / p.swingDur, head = (k - 0.24) / 0.3;
      if (k > 0.24 && k < 0.95) {
        sl.mesh.visible = true;
        sl.mesh.position.set(p.x, 0, p.y); sl.mesh.rotation.y = -p.swingDir;
        const u = sl.mat.uniforms; u.uArc.value = S.arc; u.uHead.value = Math.min(head, 1.5); u.uSide.value = p.swingSide; u.uReach.value = S.reach * 0.98;
        u.uAlpha.value = k < 0.56 ? 1 : Math.max(0, 1 - (k - 0.56) / 0.36); u.uColor.value.set(Models.SWORD[pv.ts].slash);
        if (pv.ts >= 3 && k > 0.28 && k < 0.62) {
          const a = p.swingDir - rig.shR.rotation.y, rr = S.reach * 0.92;
          R.parts.push({ x: p.x + Math.cos(a) * rr, y: p.y + Math.sin(a) * rr, z: 26, vx: Math.cos(a) * 30, vy: Math.sin(a) * 30, vz: 20, life: 0.35, max: 0.35, color: Models.SWORD[pv.ts].slash, size: 2.4, grav: 0, add: true });
        }
      } else sl.mesh.visible = false;
    } else sl.mesh.visible = false;
  }

  /* ------------------------------------------------------------ Licht */
  const ZONE_AMB = [
    { sky: '#7c82b0', ground: '#2e2418', key: '#a8b4ff', bg: '#050406' },
    { sky: '#6e9c84', ground: '#1e2a1e', key: '#a8d4b4', bg: '#040605' },
    { sky: '#8a6cc8', ground: '#241c34', key: '#c0a4ff', bg: '#06040a' },
    { sky: '#6a9ccc', ground: '#1a2634', key: '#a0d4ff', bg: '#03060a' },
    { sky: '#c8685c', ground: '#2e1416', key: '#ff9c88', bg: '#0a0304' },
  ];
  const tmpC = new THREE.Color();
  function updateLights(R, now, dt) {
    const p = R.p, map = R.map, room = map.rooms[R.room], zi = room ? room.zone : 0;
    const Z = ZONE_AMB[zi], k2 = Math.min(1, dt * 2);
    run.amb.color.lerp(tmpC.set(Z.sky), k2); run.amb.groundColor.lerp(tmpC.set(Z.ground), k2);
    run.amb.intensity = 1.9 * tune.ambient;
    run.scene.background.lerp(tmpC.set(Z.bg), k2);
    run.key.color.lerp(tmpC.set(Z.key), k2); run.key.intensity = 1.5 * tune.key;
    const sx = Math.round(p.x / 8) * 8, sz = Math.round(p.y / 8) * 8;
    run.key.position.set(sx - 260, 640, sz + 120); run.key.target.position.set(sx, 0, sz); run.key.target.updateMatrixWorld();
    const flick = 1 + Math.sin(now * 9) * 0.04 + Math.sin(now * 23) * 0.03;
    run.lantern.position.set(p.x, 150, p.y); run.lantern.intensity = 14000 * flick * tune.lantern;
    // Lichtquellen der Karte: die nächsten sechs, mit sanftem Ein-/Ausblenden
    const cand = [];
    for (const l of map.lights) { if (l.off) continue; const dx = l.x - p.x, dy = l.y - p.y, d2 = dx * dx + dy * dy; if (d2 < 640 * 640) cand.push([d2, l]); }
    cand.sort((a, b) => a[0] - b[0]);
    const top = new Set(cand.slice(0, POOL).map(c => c[1]));
    for (const s of run.pool) {
      if (s.src && !top.has(s.src)) s.want = 0;
      s.cur += (s.want - s.cur) * Math.min(1, dt * 7);
      if (s.want === 0 && s.cur < 0.02) { s.src = null; s.cur = 0; }
    }
    const assigned = new Set(run.pool.map(s => s.src));
    for (const l of top) if (!assigned.has(l)) { const s = run.pool.find(q => !q.src); if (!s) break; s.src = l; s.want = 1; s.cur = 0; assigned.add(l); }
    for (const s of run.pool) {
      if (!s.src) { s.L.intensity = 0; continue; }
      const l = s.src, fl = 1 + 0.06 * Math.sin(now * 9 + l.flick) + 0.05 * Math.sin(now * 23 + l.flick * 2);
      s.L.position.set(l.x, Math.max(l.h || 50, 58), l.y); // tiefe Lichter würden den Boden darunter ausbrennen s.L.color.set(l.col || '#ffb060');
      s.L.distance = l.r * 1.7; s.L.intensity = 70000 * (l.strength || 1) * fl * s.cur * tune.lights;
    }
    // Effektlichter (Feuerbälle, Explosionen, Blitze ...)
    const cands = [];
    for (const st of [run.views.fx, run.views.pproj, run.views.tele, run.views.eproj, run.views.pickup]) for (const v of st.values()) if (v.light && v.light.intensity > 1500) {
      const dx = v.light.x - p.x, dy = v.light.y - p.y;
      cands.push([v.light.intensity / (1 + (dx * dx + dy * dy) / 160000), v.light]);
    }
    cands.sort((a, b) => b[0] - a[0]);
    for (let i = 0; i < FXPOOL; i++) {
      const L = run.fxPool[i], c = cands[i];
      if (!c) { L.intensity = 0; continue; }
      const l = c[1]; L.position.set(l.x, l.h, l.y); L.color.set(l.color); L.intensity = l.intensity * tune.lights; L.distance = 520;
    }
    for (const f of run.flames) { if (!f.userData.sy) f.userData.sy = f.scale.y; f.scale.y = f.userData.sy * (0.85 + 0.3 * Math.sin(now * 14 + f.position.x * 3 + f.id)); }
  }

  /* ------------------------------------------------------------ Zeigerziel (Maus -> Welt / Gegner) */
  const ndc = new THREE.Vector2(), ray = new THREE.Raycaster(), _oc = new THREE.Vector3();
  function pointer(R) {
    if (!glOk || !R) return;
    ndc.set(Input.mx / W * 2 - 1, -(Input.my / H * 2 - 1));
    ray.setFromCamera(ndc, camera);
    const o = ray.ray.origin, d = ray.ray.direction;
    const t = d.y !== 0 ? -o.y / d.y : 0;
    Input.wx = o.x + d.x * t; Input.wy = o.z + d.z * t;
    let best = null, bt = 1e9;
    const p = R.p;
    const test = (cx, cy, cz, rad, obj) => {
      _oc.set(cx - o.x, cy - o.y, cz - o.z);
      const tca = _oc.dot(d), d2 = _oc.lengthSq() - tca * tca;
      if (tca > 0 && d2 < rad * rad && tca < bt) { bt = tca; best = obj; }
    };
    for (const e of R.enemies) {
      if (e.dead) continue;
      if (Math.abs(e.x - p.x) > 700 || Math.abs(e.y - p.y) > 700) continue;
      const hy = (e.look === 'bat' || e.look === 'cbat' || e.look === 'imp') ? e.r * 2.2 : e.r * 1.9;
      test(e.x, hy, e.y, Math.max(e.r * 1.35, 14), e);
    }
    for (const pr of R.map.props) if (pr.breakable && !pr.broken && Math.abs(pr.x - p.x) < 500 && Math.abs(pr.y - p.y) < 500) test(pr.x, 13, pr.y - 6, 17, pr);
    Input.hover = best;
    document.getElementById('game').style.cursor = best ? 'pointer' : 'crosshair';
  }

  /* ------------------------------------------------------------ Frame (Lauf) */
  function setupRun(R) {
    run.curR = R;
    for (const st of Object.values(run.views)) { for (const v of st.values()) { v.obj.parent && v.obj.parent.remove(v.obj); v.dispose && v.dispose(); } st.clear(); }
    if (run.playerView) { run.ent.remove(run.playerView.obj); run.playerView = null; }
    buildMap(R.map);
    CampScene.setActive(false);
  }

  function drawRun(c, R, now) {
    if (!glOk) return;
    const dt = Math.min(0.05, Math.max(0.001, now - run.lastNow)); run.lastNow = now;
    if (run.curR !== R) setupRun(R);
    const p = R.p, map = R.map, sh = R.cam.shake;
    const sx = sh ? (Math.random() - 0.5) * sh * 1.4 : 0, sz = sh ? (Math.random() - 0.5) * sh * 1.4 : 0;
    placeCamera(R.cam.x, R.cam.y, sx, sz);
    updateWalls(map, p.x, p.y, dt);
    for (const b of run.breakables) if (b.pr.broken && b.obj.visible) b.obj.visible = false;
    for (const f of run.fires) { f.fireG.visible = !!f.pr.lit; f.readyG.visible = !f.pr.lit && map.rooms[f.pr.room].cleared; }

    const vis = [];
    for (const e of R.enemies) { if (e.dead && e.deadT > 0.9) continue; if (Math.abs(e.x - R.cam.x) < 760 && Math.abs(e.y - R.cam.y) < 760) vis.push(e); }
    sync(run.views.enemy, vis, e => makeEnemyView(e, R), (v, e) => updateEnemyView(v, e, R, now, dt), run.ent);
    updatePlayerView(R, now, dt);
    const near = it => Math.abs(it.x - R.cam.x) < 800 && Math.abs(it.y - R.cam.y) < 800;
    sync(run.views.pickup, R.pickups.filter(near), k => FX.makePickup(k), (v, k) => v.update(k, now, dt), run.ent);
    sync(run.views.eproj, R.eproj, b => FX.makeEnemyProj(b), (v, b) => v.update(b, now, dt), run.fxg);
    sync(run.views.pproj, R.pproj, b => FX.makePlayerProj(b), (v, b) => v.update(b, now, dt), run.fxg);
    sync(run.views.tele, R.tele, t => FX.makeTele(t), (v, t) => v.update(t, now, dt), run.fxg);
    sync(run.views.fx, R.fx, f => FX.makeFx(f), (v, f) => v.update(f, now, dt), run.fxg);
    updateLights(R, now, dt);
    FX.updateParticles(particles, R.parts, pxPerUnit());

    const h = Input.hover, hr = run.hoverRing;
    if (h && h.r && !h.dead) { hr.visible = true; hr.position.set(h.x, 1.5, h.y); const s = h.r * 1.7; hr.scale.set(s, 1, s); }
    else hr.visible = false;

    bloom.strength = tune.bloom;
    renderPass.scene = run.scene; renderPass.camera = camera;
    composer.render();

    c.clearRect(0, 0, W, H);
    Hud.drawWorldOverlay(c, R, now, proj, Input.hover && Input.hover.r ? Input.hover : null);
    Hud.drawScreenFx(c, R);
    Hud.drawBars(c, R, now);
    Hud.drawInfo(c, R, now);
  }

  /* ------------------------------------------------------------ Lager / Titel */
  function drawCamp(c, now, dt, inCamp) {
    c.clearRect(0, 0, W, H);
    if (!glOk) return;
    run.curR = null;
    CampScene.setActive(true);
    CampScene.update(now, dt, inCamp);
    renderPass.scene = CampScene.scene; renderPass.camera = CampScene.camera;
    bloom.strength = 0.7;
    composer.render();
  }

  return { init, setQuality, drawRun, drawCamp, pointer, proj, tune, get ok() { return glOk; }, get run() { return run; }, get renderer() { return renderer; }, get camera() { return camera; }, get particles() { return particles; }, pxPerUnit };
})();
