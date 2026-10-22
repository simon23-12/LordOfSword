/* Lord of Sword – Effekte (three.js): Partikel, Zauber, Projektile, Telegraphen, Pickups
 * Alle Ansichten haben die Form { obj, update(data, now, dt), dispose(), light? } und werden von render.js synchronisiert. */
const FX = (function () {
  'use strict';
  const PI = Math.PI, TAU = PI * 2;
  const clamp01 = x => Math.max(0, Math.min(1, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOut = k => 1 - (1 - k) * (1 - k);
  const rnd = (a, b) => a + Math.random() * (b - a);

  const ringGeo = new THREE.RingGeometry(0.86, 1, 72); ringGeo.rotateX(-PI / 2);
  const ringThinGeo = new THREE.RingGeometry(0.95, 1, 72); ringThinGeo.rotateX(-PI / 2);
  const discGeo = new THREE.CircleGeometry(1, 48); discGeo.rotateX(-PI / 2);
  const sphGeo = new THREE.SphereGeometry(1, 16, 12);
  const coneGeo = new THREE.ConeGeometry(1, 1, 8); coneGeo.translate(0, 0.5, 0);
  const beamGeo = new THREE.CylinderGeometry(1, 1, 1, 20, 1, true); beamGeo.translate(0, 0.5, 0);
  const boltGeo = new THREE.BoxGeometry(1, 1, 1); boltGeo.translate(0, 0, 0.5);
  const planeGeo = new THREE.PlaneGeometry(1, 1); planeGeo.rotateX(-PI / 2);

  function add(color, op, glow) {
    const c = new THREE.Color(color); if (glow) c.multiplyScalar(glow);
    return new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: op === undefined ? 1 : op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  }

  /* ------------------------------------------------------------ Texturen */
  function canvasTex(w, h, draw) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  }
  const glowTex = canvasTex(128, 128, (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.55)'); g.addColorStop(0.6, 'rgba(255,255,255,0.12)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  });
  const scorchTex = canvasTex(128, 128, (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(10,6,4,0.95)'); g.addColorStop(0.55, 'rgba(14,9,6,0.7)'); g.addColorStop(0.85, 'rgba(20,12,8,0.25)'); g.addColorStop(1, 'rgba(20,12,8,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) { c.fillStyle = `rgba(0,0,0,${Math.random() * 0.25})`; c.beginPath(); c.arc(w / 2 + (Math.random() - 0.5) * w * 0.8, h / 2 + (Math.random() - 0.5) * h * 0.8, 2 + Math.random() * 6, 0, TAU); c.fill(); }
  });
  const flameTex = canvasTex(64, 128, (c, w, h) => {
    const g = c.createLinearGradient(0, h, 0, 0);
    g.addColorStop(0, 'rgba(255,250,210,1)'); g.addColorStop(0.3, 'rgba(255,196,80,0.95)'); g.addColorStop(0.65, 'rgba(255,100,20,0.65)'); g.addColorStop(1, 'rgba(190,30,0,0)');
    c.fillStyle = g; c.beginPath(); c.moveTo(w / 2, 2); c.bezierCurveTo(w * 0.98, h * 0.42, w * 0.98, h * 0.96, w / 2, h - 1); c.bezierCurveTo(w * 0.02, h * 0.96, w * 0.02, h * 0.42, w / 2, 2); c.fill();
  });
  /** Flamme als Billboard (Fuß unten); w/h in Welteinheiten */
  function flame(w, h, tint, glow) {
    const col = new THREE.Color(tint || '#ffffff').multiplyScalar(glow || 1.4);
    const m = new THREE.SpriteMaterial({ map: flameTex, color: col, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const s = new THREE.Sprite(m); s.center.set(0.5, 0.08); s.scale.set(w, h, 1); s.userData.flame = true;
    return s;
  }
  function sprite(color, size, op) {
    const m = new THREE.SpriteMaterial({ map: glowTex, color: new THREE.Color(color), transparent: true, opacity: op === undefined ? 1 : op, blending: THREE.AdditiveBlending, depthWrite: false });
    const s = new THREE.Sprite(m); s.scale.set(size, size, 1); return s;
  }

  /* ------------------------------------------------------------ Partikel */
  const VS = `attribute float aSize; attribute vec3 aColor; attribute float aAlpha; varying vec3 vC; varying float vA; uniform float uScale;
    void main(){ vC = aColor; vA = aAlpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_PointSize = max(1.0, aSize * uScale); }`;
  const FS = `varying vec3 vC; varying float vA;
    void main(){ vec2 d = gl_PointCoord - 0.5; float r = dot(d, d) * 4.0; if (r > 1.0) discard; gl_FragColor = vec4(max(vC, vec3(0.0)), (1.0 - smoothstep(0.1, 1.0, r)) * clamp(vA, 0.0, 1.0)); }`;

  function makeSystem(scene, cap, additive) {
    const s = { cap, n: 0, pos: new Float32Array(cap * 3), col: new Float32Array(cap * 3), size: new Float32Array(cap), alpha: new Float32Array(cap) };
    const g = new THREE.BufferGeometry();
    s.aPos = new THREE.BufferAttribute(s.pos, 3).setUsage(THREE.DynamicDrawUsage);
    s.aCol = new THREE.BufferAttribute(s.col, 3).setUsage(THREE.DynamicDrawUsage);
    s.aSize = new THREE.BufferAttribute(s.size, 1).setUsage(THREE.DynamicDrawUsage);
    s.aAlpha = new THREE.BufferAttribute(s.alpha, 1).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', s.aPos); g.setAttribute('aColor', s.aCol); g.setAttribute('aSize', s.aSize); g.setAttribute('aAlpha', s.aAlpha);
    s.mat = new THREE.ShaderMaterial({ uniforms: { uScale: { value: 1 } }, vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
    s.pts = new THREE.Points(g, s.mat); s.pts.frustumCulled = false; s.pts.renderOrder = additive ? 5 : 4;
    s.geo = g; scene.add(s.pts);
    return s;
  }
  const colCache = new Map();
  function rgb(hex) {
    let c = colCache.get(hex);
    if (!c) { const t = new THREE.Color(hex); c = [t.r, t.g, t.b]; colCache.set(hex, c); }
    return c;
  }
  function putParticle(s, q, boost) {
    if (!isFinite(q.x + q.y + q.z + q.size + q.life / q.max)) return;
    const i = s.n++, c = rgb(q.color), a = clamp01(q.life / q.max);
    s.pos[i * 3] = q.x; s.pos[i * 3 + 1] = q.z; s.pos[i * 3 + 2] = q.y;
    s.col[i * 3] = c[0] * boost; s.col[i * 3 + 1] = c[1] * boost; s.col[i * 3 + 2] = c[2] * boost;
    s.size[i] = q.size * 2.6 * (q.add ? 0.45 + 0.55 * a : 1);
    s.alpha[i] = q.add ? Math.min(1, a * 1.6) : Math.min(1, a * 1.3) * 0.85;
  }
  function flush(s) {
    s.geo.setDrawRange(0, s.n);
    s.aPos.needsUpdate = s.aCol.needsUpdate = s.aSize.needsUpdate = s.aAlpha.needsUpdate = true;
  }
  function createParticles(scene) { return { add: makeSystem(scene, 2600, true), norm: makeSystem(scene, 1800, false) }; }
  function updateParticles(sys, parts, pxPerUnit) {
    sys.add.n = 0; sys.norm.n = 0;
    for (const q of parts) {
      const s = q.add ? sys.add : sys.norm;
      if (s.n < s.cap) putParticle(s, q, q.add ? 1.7 : 1);
    }
    flush(sys.add); flush(sys.norm);
    sys.add.mat.uniforms.uScale.value = sys.norm.mat.uniforms.uScale.value = pxPerUnit;
  }

  /* ------------------------------------------------------------ Hilfen für Ansichten */
  function view(obj, update, mats) {
    return { obj, update, mats: mats || [], dispose() { for (const m of this.mats) m.dispose(); } };
  }
  const flat = (v, y) => { v.position.y = y; return v; };

  /* ------------------------------------------------------------ Zauber-/Szeneneffekte (R.fx) */
  function makeFx(f) {
    switch (f.k) {
      case 'ring': {
        const g = new THREE.Group(), m1 = add(f.color, 0.9, 1.6), m2 = add(f.color, 0.14, 1);
        const ring = new THREE.Mesh(f.r1 > 300 ? ringThinGeo : ringGeo, m1), disc = new THREE.Mesh(discGeo, m2);
        g.add(ring, disc); g.position.y = f.z === undefined ? 3 : f.z;
        const v = view(g, (d) => {
          const k = d.t / d.dur, r = d.r0 + (d.r1 - d.r0) * easeOut(k);
          ring.scale.set(r, 1, r); disc.scale.set(r, 1, r);
          m1.opacity = (1 - k) * 0.95; m2.opacity = (1 - k) * 0.14 * Math.min(1, 160 / d.r1);
          const th = 1 + (1 - k) * 0.12; ring.scale.x = r; ring.scale.z = r; ring.scale.y = th;
          v.light = { x: d.x, y: d.y, h: 20, color: d.color, intensity: 22000 * (1 - k) * (1 - k) };
        }, [m1, m2]);
        g.position.x = f.x; g.position.z = f.y;
        return v;
      }
      case 'boom': {
        const g = new THREE.Group(), mC = add('#fff4d0', 1, 2), mS = add(f.color, 0.55, 1.6), mR = add(f.color, 0.8, 1.4), mG = add('#ffb060', 0.4, 1);
        const core = new THREE.Mesh(sphGeo, mC), shell = new THREE.Mesh(sphGeo, mS), ring = new THREE.Mesh(ringGeo, mR);
        const halo = sprite(f.color, f.r * 3.4, 0.7);
        g.add(core, shell, ring, halo); g.position.set(f.x, 0, f.y);
        core.position.y = shell.position.y = 16; halo.position.y = 22; ring.position.y = 3;
        const v = view(g, (d) => {
          const k = d.t / d.dur, e = easeOut(k);
          const r = d.r;
          core.scale.setScalar(r * (0.25 + 0.55 * e) * (1 - k * 0.6)); mC.opacity = Math.pow(1 - k, 1.6);
          shell.scale.set(r * (0.4 + 0.75 * e), r * (0.3 + 0.55 * e), r * (0.4 + 0.75 * e)); mS.opacity = (1 - k) * 0.5;
          ring.scale.set(r * (0.3 + 1.0 * e), 1, r * (0.3 + 1.0 * e)); mR.opacity = (1 - k) * 0.9;
          halo.material.opacity = (1 - k) * 0.5; halo.scale.setScalar(r * (2.0 + 2.2 * e));
          v.light = { x: d.x, y: d.y, h: 40, color: d.color, intensity: 90000 * Math.pow(1 - k, 1.5) };
        }, [mC, mS, mR, mG, halo.material]);
        return v;
      }
      case 'scorch': {
        const m = new THREE.MeshBasicMaterial({ map: scorchTex, transparent: true, depthWrite: false, opacity: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
        const ember = add(f.color, 0.6, 1.4);
        const g = new THREE.Group(), s = new THREE.Mesh(discGeo, m), e2 = new THREE.Mesh(discGeo, ember);
        s.scale.set(f.r, 1, f.r); e2.scale.set(f.r * 0.8, 1, f.r * 0.8); e2.position.y = 0.2; s.position.y = 0.15;
        g.add(s, e2); g.position.set(f.x, 0.3, f.y);
        return view(g, (d) => { const k = d.t / d.dur; m.opacity = 0.7 * (1 - k * k); ember.opacity = Math.max(0, 0.55 * (1 - k * 4)); }, [m, ember]);
      }
      case 'bolt': {
        const N = 10, g = new THREE.Group(), glow = add(f.color, 0.55, 1.4), core = add('#ffffff', 1, 1.5);
        const segs = [];
        for (let i = 0; i < N; i++) { const a = new THREE.Mesh(boltGeo, glow), b = new THREE.Mesh(boltGeo, core); g.add(a, b); segs.push([a, b]); }
        const halo = sprite(f.color, 70, 0.8); g.add(halo);
        const A = new THREE.Vector3(f.a.x, f.a.z, f.a.y), B = new THREE.Vector3(f.b.x, f.b.z, f.b.y);
        const dir = B.clone().sub(A), len = dir.length(); dir.normalize();
        const u = new THREE.Vector3(0, 1, 0).cross(dir).normalize(), w = dir.clone().cross(u).normalize();
        let tj = -1; const pts = Array.from({ length: N + 1 }, () => new THREE.Vector3());
        const v = view(g, (d, now) => {
          const k = d.t / d.dur;
          const step = Math.floor(now * 38);
          if (step !== tj) {
            tj = step;
            for (let i = 0; i <= N; i++) {
              const t = i / N, amp = Math.sin(t * PI) * Math.min(26, len * 0.18);
              pts[i].copy(A).lerp(B, t).addScaledVector(u, (Math.random() - 0.5) * 2 * amp).addScaledVector(w, (Math.random() - 0.5) * 2 * amp);
            }
          }
          for (let i = 0; i < N; i++) {
            const p0 = pts[i], p1 = pts[i + 1], dist = p0.distanceTo(p1);
            for (let j = 0; j < 2; j++) { const s = segs[i][j]; s.position.copy(p0); s.lookAt(p1); const th = j ? 1.4 : 4.2; s.scale.set(th * (1 - k * 0.5), th * (1 - k * 0.5), dist); }
          }
          glow.opacity = (1 - k) * 0.6; core.opacity = Math.min(1, (1 - k) * 1.6);
          halo.position.copy(B); halo.material.opacity = (1 - k) * 0.9;
          v.light = { x: d.b.x, y: d.b.y, h: d.b.z + 20, color: d.color, intensity: 32000 * (1 - k) };
        }, [glow, core, halo.material]);
        return v;
      }
      case 'beam': {
        const g = new THREE.Group(), R0 = f.slim ? 9 : 22;
        const outer = new THREE.Mesh(beamGeo, add(f.color, 0.25, 1.1)), inner = new THREE.Mesh(beamGeo, add('#ffffff', 0.7, 1.4));
        const flare = new THREE.Mesh(discGeo, add(f.color, 0.7, 1.4)), ring = new THREE.Mesh(ringGeo, add(f.color, 0.8, 1.4));
        outer.scale.set(R0, 900, R0); inner.scale.set(R0 * 0.4, 900, R0 * 0.4);
        g.add(outer, inner, flare, ring); g.position.set(f.x, 0, f.y); flare.position.y = ring.position.y = 3;
        const halo = sprite(f.color, 130, 0.4); halo.position.y = 30; g.add(halo);
        const v = view(g, (d, now) => {
          const k = d.t / d.dur, e = 1 - k, pulse = 1 + Math.sin(now * 40) * 0.08;
          const q = R0 * Math.max(0.05, e) * pulse;
          outer.scale.set(q, 900, q); inner.scale.set(q * 0.4, 900, q * 0.4);
          outer.material.opacity = e * 0.26; inner.material.opacity = e * 0.6;
          const fr = 40 + 40 * k; flare.scale.set(fr, 1, fr); flare.material.opacity = e * 0.4;
          ring.scale.set(30 + 90 * easeOut(k), 1, 30 + 90 * easeOut(k)); ring.material.opacity = e * 0.9;
          halo.material.opacity = e * 0.4;
          v.light = { x: d.x, y: d.y, h: 60, color: d.color, intensity: 45000 * e };
        }, [outer.material, inner.material, flare.material, ring.material, halo.material]);
        return v;
      }
      case 'frost': {
        const g = new THREE.Group(), spikes = [];
        const mat = new THREE.MeshPhongMaterial({ color: '#b8ecff', emissive: '#3fb8ff', emissiveIntensity: 0.55, transparent: true, opacity: 0.88, shininess: 120, specular: new THREE.Color('#ffffff'), flatShading: true });
        const n = 34;
        for (let i = 0; i < n; i++) {
          const a = Math.random() * TAU, rr = f.r * Math.sqrt(0.08 + Math.random() * 0.92) * 0.95;
          const m = new THREE.Mesh(coneGeo, mat);
          const h = rnd(22, 66) * (0.6 + rr / f.r * 0.5), th = rnd(3.5, 7);
          m.position.set(Math.cos(a) * rr, 0, Math.sin(a) * rr); m.rotation.set(rnd(-0.25, 0.25), 0, rnd(-0.25, 0.25));
          m.userData = { h, th, delay: (rr / f.r) * 0.16 + Math.random() * 0.05 };
          m.castShadow = false; g.add(m); spikes.push(m);
        }
        const mFrost = add('#bfeaff', 0.22, 1.0), fd = new THREE.Mesh(discGeo, mFrost); fd.position.y = 0.6; g.add(fd);
        g.position.set(f.x, 0, f.y);
        const v = view(g, (d) => {
          const k = d.t / d.dur;
          for (const s of spikes) {
            const u = clamp01((k - s.userData.delay) / 0.12), shrink = clamp01((k - 0.62) / 0.38);
            const grow = easeOut(u) * (1 + 0.12 * Math.sin(u * PI)), hh = s.userData.h * grow * (1 - shrink * shrink);
            s.scale.set(s.userData.th * (1 - shrink * 0.5), Math.max(0.01, hh), s.userData.th * (1 - shrink * 0.5));
          }
          mat.opacity = 0.9 * (1 - clamp01((k - 0.7) / 0.3));
          const r = d.r * (0.2 + 0.8 * easeOut(clamp01(k * 3)));
          fd.scale.set(r, 1, r); mFrost.opacity = 0.24 * (1 - k);
          v.light = { x: d.x, y: d.y, h: 40, color: '#7fd8ff', intensity: 30000 * (1 - k) };
        }, [mat, mFrost]);
        return v;
      }
    }
    return null;
  }

  /* ------------------------------------------------------------ Telegraphen & Meteore (R.tele) */
  function makeTele(t) {
    const g = new THREE.Group(); const fr = t.friendly;
    const col = fr ? '#ff7a2a' : '#ff3a2a';
    if (t.kind === 'circle') {
      const mA = add(col, 0.18, 1), mB = add(col, 0.3, 1), mR = add(col, 0.9, 1.3);
      const a = new THREE.Mesh(discGeo, mA), b = new THREE.Mesh(discGeo, mB), r = new THREE.Mesh(ringGeo, mR);
      a.scale.set(t.r, 1, t.r); r.scale.set(t.r, 1, t.r); a.position.y = 0.5; b.position.y = 0.6; r.position.y = 0.7;
      g.add(a, b, r); g.position.set(t.x, 0, t.y);
      let meteor = null;
      if (fr) {
        meteor = new THREE.Group();
        const rockM = new THREE.MeshPhongMaterial({ color: '#4a2a1a', emissive: '#ff6a1f', emissiveIntensity: 0.9, flatShading: true });
        const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), rockM); rock.scale.set(17, 17, 17);
        const trail = new THREE.Mesh(coneGeo, add('#ff9a3a', 0.55, 1.3)); trail.scale.set(11, 130, 11); trail.rotation.x = PI; trail.position.y = 0;
        const halo = sprite('#ff8a3a', 110, 0.9);
        meteor.add(rock, trail, halo); meteor.visible = false; g.add(meteor);
        const rt = new THREE.Vector3(Math.sin(LOS.CAM.yaw), 0, -Math.cos(LOS.CAM.yaw));
        const off = rt.multiplyScalar(170).add(new THREE.Vector3(0, 640, 0)); const dirv = off.clone().normalize();
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dirv);
        trail.quaternion.copy(q); trail.rotation.x = 0; trail.quaternion.copy(q);
        const rings = [mA, mB, mR, trail.material, halo.material, rockM];
        const v = view(g, (d) => {
          const k = Math.min(1, d.t / d.dur), rem = d.dur - d.t;
          b.scale.set(t.r * k, 1, t.r * k); mA.opacity = 0.12 + 0.1 * k; mB.opacity = 0.14 + 0.22 * k;
          if (rem < 0.5 && rem > 0) {
            const u = rem / 0.5; meteor.visible = true; meteor.position.copy(off).multiplyScalar(u); meteor.position.y += 14;
            rock.rotation.x += 0.2; rock.rotation.y += 0.13;
            v.light = { x: d.x + off.x * u, y: d.y + off.z * u, h: 14 + off.y * u, color: '#ff8a3a', intensity: 90000 };
          } else { meteor.visible = false; v.light = null; }
        }, rings);
        return v;
      }
      return view(g, (d) => {
        const k = Math.min(1, d.t / d.dur);
        b.scale.set(t.r * k, 1, t.r * k); mA.opacity = 0.1 + 0.1 * k; mB.opacity = 0.16 + 0.24 * k; mR.opacity = 0.55 + 0.4 * Math.sin(k * 20) * 0.5 + 0.2;
      }, [mA, mB, mR]);
    }
    const mL = add(col, 0.25, 1.2), pl = new THREE.Mesh(planeGeo, mL);
    const dx = t.x2 - t.x, dy = t.y2 - t.y, len = Math.hypot(dx, dy);
    pl.scale.set(len, 1, t.w); pl.rotation.y = -Math.atan2(dy, dx);
    g.add(pl); g.position.set((t.x + t.x2) / 2, 0.7, (t.y + t.y2) / 2);
    return view(g, (d) => { const k = Math.min(1, d.t / d.dur); mL.opacity = 0.14 + 0.4 * k; }, [mL]);
  }

  /* ------------------------------------------------------------ Projektile */
  function makePlayerProj(b) {
    const g = new THREE.Group(), r = b.r;
    const core = new THREE.Mesh(sphGeo, add('#fff4c0', 1, 2)), mid = new THREE.Mesh(sphGeo, add(b.color, 0.85, 1.6)), out = new THREE.Mesh(sphGeo, add(b.color, 0.3, 1.2));
    core.scale.setScalar(r * 0.7); mid.scale.setScalar(r * 1.25); out.scale.setScalar(r * 2.1);
    const tails = [];
    for (let i = 0; i < 3; i++) {
      const c = new THREE.Mesh(coneGeo, add(i === 0 ? '#ffe0a0' : b.color, 0.6 - i * 0.12, 1.5)); c.rotation.z = PI / 2;
      c.scale.set(r * (1.5 - i * 0.35), 46 + i * 22, r * (1.5 - i * 0.35)); c.userData.i = i; g.add(c); tails.push(c);
    }
    const halo = sprite(b.color, 120, 0.85);
    g.add(core, mid, out, halo);
    const v = view(g, (d, now) => {
      g.position.set(d.x, d.z, d.y);
      g.rotation.y = -Math.atan2(d.vy, d.vx);
      const fl = 1 + Math.sin(now * 40 + d.x) * 0.1;
      mid.scale.setScalar(r * 1.25 * fl); out.scale.setScalar(r * 2.1 * (2 - fl));
      for (const c of tails) c.scale.y = (46 + c.userData.i * 22) * (0.8 + 0.4 * Math.sin(now * 33 + c.userData.i * 2));
      halo.material.opacity = 0.7 + 0.2 * Math.sin(now * 30);
      v.light = { x: d.x, y: d.y, h: d.z, color: b.color, intensity: 70000 * fl };
    }, [core.material, mid.material, out.material, halo.material, ...tails.map(t => t.material)]);
    return v;
  }

  function makeEnemyProj(b) {
    const g = new THREE.Group(), mats = [];
    if (b.look === 'spear') {
      const m = new THREE.MeshPhongMaterial({ color: '#e8e2cf', emissive: '#aaa', emissiveIntensity: 0.3, flatShading: true });
      const shaft = new THREE.Mesh(sphGeo, m); shaft.scale.set(24, 2.6, 2.6);
      const tip = new THREE.Mesh(coneGeo, m); tip.scale.set(5, 14, 5); tip.rotation.z = -PI / 2; tip.position.x = 24;
      g.add(shaft, tip); mats.push(m);
      const tr = new THREE.Mesh(coneGeo, add('#ffffff', 0.35, 1)); tr.scale.set(3, 30, 3); tr.rotation.z = PI / 2; tr.position.x = -20; g.add(tr); mats.push(tr.material);
    } else if (b.look === 'archer') {
      const m = new THREE.MeshLambertMaterial({ color: '#d8c8a0' });
      const shaft = new THREE.Mesh(sphGeo, m); shaft.scale.set(13, 0.9, 0.9);
      const tip = new THREE.Mesh(coneGeo, new THREE.MeshPhongMaterial({ color: '#cfd4de' })); tip.scale.set(2.2, 6, 2.2); tip.rotation.z = -PI / 2; tip.position.x = 13;
      g.add(shaft, tip); mats.push(m, tip.material);
    } else {
      const c = new THREE.Mesh(sphGeo, add('#ffffff', 1, 1.8)), o = new THREE.Mesh(sphGeo, add(b.color, 0.75, 1.6)), halo = sprite(b.color, 62, 0.8);
      c.scale.setScalar(b.r * 0.6); o.scale.setScalar(b.r * 1.15);
      const tail = new THREE.Mesh(coneGeo, add(b.color, 0.4, 1.4)); tail.scale.set(b.r * 0.9, 26, b.r * 0.9); tail.rotation.z = PI / 2;
      g.add(c, o, halo, tail); mats.push(c.material, o.material, halo.material, tail.material);
    }
    const v = view(g, (d, now) => {
      g.position.set(d.x, d.z || 22, d.y); g.rotation.y = -Math.atan2(d.vy, d.vx);
      v.light = d.look !== 'spear' && d.look !== 'archer' ? { x: d.x, y: d.y, h: d.z || 22, color: d.color, intensity: 18000 } : null;
    }, mats);
    return v;
  }

  /* ------------------------------------------------------------ Pickups */
  const runeTex = new Map();
  function runeTexture(def, tier) {
    const key = def.id + tier;
    let t = runeTex.get(key);
    if (!t) {
      const col = LOS.TIERS[tier].color;
      t = canvasTex(96, 128, (c, w, h) => {
        c.fillStyle = '#17120e'; c.fillRect(0, 0, w, h);
        const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, 'rgba(255,255,255,0.1)'); g.addColorStop(1, 'rgba(0,0,0,0.3)'); c.fillStyle = g; c.fillRect(0, 0, w, h);
        c.strokeStyle = col; c.lineWidth = 6; c.strokeRect(6, 6, w - 12, h - 12);
        c.fillStyle = col; c.font = 'bold 74px serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.shadowColor = col; c.shadowBlur = 14; c.fillText(def.glyph, w / 2, h / 2 + 4);
      });
      runeTex.set(key, t);
    }
    return t;
  }
  function makePickup(k) {
    const g = new THREE.Group(), mats = [];
    const shadow = new THREE.Mesh(discGeo, new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.35, depthWrite: false })); shadow.scale.set(6, 1, 6); shadow.position.y = 0.4; g.add(shadow); mats.push(shadow.material);
    let body, spin = false;
    if (k.type === 'hp' || k.type === 'mana') {
      const hp = k.type === 'hp', col = hp ? '#e0202a' : '#2f7fe8', hi = hp ? '#ff7a7a' : '#8cc4ff';
      const m = new THREE.MeshPhongMaterial({ color: col, emissive: col, emissiveIntensity: 0.9, shininess: 120, specular: new THREE.Color(hi) });
      body = new THREE.Mesh(sphGeo, m); body.scale.setScalar(6.5); mats.push(m);
      const halo = sprite(hi, 50, 0.65); body.add(halo); halo.scale.set(7, 7, 1); mats.push(halo.material);
    } else if (k.type === 'essence') {
      // Essenz: violetter Kristall mit weißem Kern, dreht sich
      body = new THREE.Group(); spin = true;
      const cm = new THREE.MeshPhongMaterial({ color: '#8f5cff', emissive: '#7a3cff', emissiveIntensity: 0.9, shininess: 140, specular: new THREE.Color('#e8d8ff'), flatShading: true });
      const crys = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), cm); crys.scale.set(4.2, 7.4, 4.2); body.add(crys); mats.push(cm);
      const core = new THREE.Mesh(sphGeo, new THREE.MeshBasicMaterial({ color: '#f3eaff' })); core.scale.setScalar(2); body.add(core); mats.push(core.material);
      const halo = sprite('#c9a8ff', 32, 0.7); body.add(halo); mats.push(halo.material);
    } else {
      const tier = LOS.TIERS[k.rune.tier], def = LOS.RUNE_BY_ID[k.rune.id];
      body = new THREE.Group(); spin = true;
      const tab = new THREE.Mesh(new THREE.BoxGeometry(2.6, 14, 10.5), new THREE.MeshPhongMaterial({ color: '#211a14', emissive: tier.color, emissiveIntensity: 0.25, flatShading: true })); mats.push(tab.material);
      const face = new THREE.Mesh(new THREE.PlaneGeometry(9.5, 12.6), new THREE.MeshBasicMaterial({ map: runeTexture(def, k.rune.tier), toneMapped: false })); face.rotation.y = PI / 2; face.position.x = 1.4; mats.push(face.material);
      const face2 = face.clone(); face2.rotation.y = -PI / 2; face2.position.x = -1.4;
      body.add(tab, face, face2);
      const beam = new THREE.Mesh(beamGeo, add(tier.color, 0.32, 1.4)); beam.scale.set(7, 110, 7); beam.position.y = -9; body.add(beam); mats.push(beam.material);
      const halo = sprite(tier.color, 74, 0.8); body.add(halo); mats.push(halo.material);
      const ring = new THREE.Mesh(ringGeo, add(tier.color, 0.7, 1.4)); ring.scale.set(15, 1, 15); ring.position.y = -9; body.add(ring); mats.push(ring.material);
      body.userData.tier = tier.color;
    }
    g.add(body);
    const v = view(g, (d, now) => {
      const bob = d.z > 0 ? 0 : Math.sin(now * 3 + d.x) * 2;
      g.position.set(d.x, 0, d.y);
      body.position.y = 9 + d.z + bob;
      if (spin) { body.rotation.y = now * 1.8; body.position.y = (d.type === 'essence' ? 12 : 15) + d.z + bob; }
      shadow.scale.setScalar(Math.max(2, 6 - d.z * 0.03));
      v.light = d.type === 'rune' ? { x: d.x, y: d.y, h: 24, color: body.userData.tier, intensity: 26000 } : null;
    }, mats);
    return v;
  }

  return { flame, createParticles, updateParticles, makeFx, makeTele, makePlayerProj, makeEnemyProj, makePickup, sprite, add, glowTex, canvasTex, geo: { ring: ringGeo, ringThin: ringThinGeo, disc: discGeo, sph: sphGeo, cone: coneGeo, beam: beamGeo, plane: planeGeo } };
})();
