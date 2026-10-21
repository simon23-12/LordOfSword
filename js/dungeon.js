/* Lord of Sword – zufällige Dungeon-Generierung (Raumkette von Eingang bis zum Boss) */
const Dungeon = (function () {
  'use strict';
  const T = LOS.TILE;
  const CW = 25, CH = 22, COLS = 5, ROWS = 4;

  function mulberry(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** Selbstvermeidender Pfad über das Zellraster (DFS mit Zufall) */
  function walkPath(rand, n) {
    for (let attempt = 0; attempt < 200; attempt++) {
      const start = [0, Math.floor(rand() * ROWS)];
      const used = new Set([start[0] + ',' + start[1]]);
      const path = [start];
      const dirs = [[1, 0], [0, 1], [0, -1], [1, 0], [-1, 0]];
      let budget = 4000;
      const rec = () => {
        if (path.length === n) return true;
        if (--budget < 0) return false;
        const [c, r] = path[path.length - 1];
        const order = dirs.slice().sort(() => rand() - 0.5);
        for (const [dc, dr] of order) {
          const nc = c + dc, nr = r + dr;
          if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS || used.has(nc + ',' + nr)) continue;
          used.add(nc + ',' + nr); path.push([nc, nr]);
          if (rec()) return true;
          path.pop(); used.delete(nc + ',' + nr);
        }
        return false;
      };
      if (rec()) return path;
    }
    return null;
  }

  function generate(seed) {
    const rand = mulberry(seed || (Math.random() * 1e9) | 0);
    const n = LOS.NUM_ROOMS;
    const path = walkPath(rand, n) || Array.from({ length: n }, (_, i) => [i % COLS, Math.floor(i / COLS)]);
    const W = COLS * CW, H = ROWS * CH;
    const tiles = new Uint8Array(W * H);          // 0 Wand, 1 Boden
    const roomAt = new Int8Array(W * H).fill(-1);
    const corr = new Uint8Array(W * H);
    const rooms = [];

    path.forEach(([c, r], i) => {
      const boss = i === n - 1, start = i === 0;
      const w = boss ? 21 : start ? 13 : 13 + Math.floor(rand() * 7);
      const h = boss ? 17 : start ? 12 : 11 + Math.floor(rand() * 6);
      const x = c * CW + 2 + Math.floor(rand() * (CW - 4 - w + 1));
      const y = r * CH + 2 + Math.floor(rand() * (CH - 4 - h + 1));
      const room = { i, x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1), zone: Math.floor(i / LOS.BAL.roomsPerZone), boss, start, cleared: false, entered: false, enemies: 0 };
      rooms.push(room);
      for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) { tiles[yy * W + xx] = 1; roomAt[yy * W + xx] = i; }
      // abgeschnittene Ecken
      if (!start) {
        for (const [cxr, cyr, sx, sy] of [[x, y, 1, 1], [x + w - 1, y, -1, 1], [x, y + h - 1, 1, -1], [x + w - 1, y + h - 1, -1, -1]]) {
          if (rand() < 0.6) {
            const s = 1 + Math.floor(rand() * 3);
            for (let a = 0; a < s; a++) for (let b = 0; b < s - a; b++) {
              const tx = cxr + a * sx, ty = cyr + b * sy; tiles[ty * W + tx] = 0; roomAt[ty * W + tx] = -1;
            }
          }
        }
      }
    });

    // Gänge (3 Felder breit)
    function carve(x, y) {
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const tx = x + dx, ty = y + dy;
        if (tx < 1 || ty < 1 || tx >= W - 1 || ty >= H - 1) continue;
        const k = ty * W + tx;
        if (!tiles[k]) { tiles[k] = 1; corr[k] = 1; }
      }
    }
    for (let i = 0; i < n - 1; i++) {
      const a = rooms[i], b = rooms[i + 1];
      let x = a.cx, y = a.cy;
      const sx = Math.sign(b.cx - x), sy = Math.sign(b.cy - y);
      while (x !== b.cx) { carve(x, y); x += sx; }
      while (y !== b.cy) { carve(x, y); y += sy; }
      carve(x, y);
    }

    // Säulen (Deckung gegen Rudel) – nie im Gang und nicht in der Raummitte
    for (const room of rooms) {
      if (room.start) continue;
      const count = room.boss ? 6 : 2 + Math.floor(rand() * 4);
      for (let k = 0; k < count; k++) {
        const sz = rand() < 0.5 ? 1 : 2;
        const px = room.x + 3 + Math.floor(rand() * (room.w - 6 - sz));
        const py = room.y + 3 + Math.floor(rand() * (room.h - 6 - sz));
        if (Math.abs(px - room.cx) < 3 && Math.abs(py - room.cy) < 3 && !room.boss) continue;
        let ok = true;
        for (let yy = py - 1; yy <= py + sz && ok; yy++) for (let xx = px - 1; xx <= px + sz; xx++) {
          const kk = yy * W + xx; if (!tiles[kk] || corr[kk] || roomAt[kk] !== room.i) { ok = false; break; }
        }
        // Bossraum: Mitte frei lassen
        if (room.boss && Math.abs(px - room.cx) < 5 && Math.abs(py - room.cy) < 4) ok = false;
        if (!ok) continue;
        for (let yy = py; yy < py + sz; yy++) for (let xx = px; xx < px + sz; xx++) { tiles[yy * W + xx] = 0; roomAt[yy * W + xx] = -1; }
      }
    }

    const isFloor = (tx, ty) => tx >= 0 && ty >= 0 && tx < W && ty < H && tiles[ty * W + tx] === 1;

    // Dekor und Lichtquellen
    const props = [];     // flach (Boden) oder hoch (y-sortiert)
    const lights = [];    // Fackeln, Kristalle ...
    for (const room of rooms) {
      const z = room.zone;
      // Wandfackeln an der Nordwand
      for (let xx = room.x + 2; xx < room.x + room.w - 1; xx += 5 + Math.floor(rand() * 3)) {
        if (isFloor(xx, room.y) && !isFloor(xx, room.y - 1)) {
          props.push({ type: 'torch', x: xx * T + T / 2, y: room.y * T, tall: true, wall: true, room: room.i });
          lights.push({ x: xx * T + T / 2, y: room.y * T + 8, h: 56, r: 270, flick: rand() * 10, room: room.i, strength: 1, col: '#ff9a50' });
        }
      }
      if (room.boss) {
        for (const [bx, by] of [[room.x + 2, room.y + 2], [room.x + room.w - 3, room.y + 2], [room.x + 2, room.y + room.h - 3], [room.x + room.w - 3, room.y + room.h - 3]]) {
          props.push({ type: 'brazier', x: bx * T + T / 2, y: by * T + T / 2 + 10, tall: true, room: room.i });
          lights.push({ x: bx * T + T / 2, y: by * T + T / 2 + 10, h: 50, r: 300, flick: rand() * 10, room: room.i, strength: 1.1, col: '#ff7a3a' });
        }
      }
      const area = room.w * room.h;
      const decor = [['bones', 'skull', 'crack', 'web'], ['bones', 'coffin', 'crack', 'candle'], ['mushroom', 'goo', 'crack', 'mushroom'], ['crystal', 'shard', 'crack', 'crystal'], ['blood', 'spike', 'bones', 'blood']][z];
      const cnt = Math.floor(area / (room.start ? 30 : 14));
      for (let k = 0; k < cnt; k++) {
        const tx = room.x + 1 + Math.floor(rand() * (room.w - 2)), ty = room.y + 1 + Math.floor(rand() * (room.h - 2));
        if (!isFloor(tx, ty) || roomAt[ty * W + tx] !== room.i) continue;
        const type = decor[Math.floor(rand() * decor.length)];
        const p = { type, x: tx * T + rand() * T, y: ty * T + rand() * T, a: rand() * 6.28, s: 0.7 + rand() * 0.6, tall: ['coffin', 'crystal', 'spike', 'candle'].includes(type), room: room.i };
        props.push(p);
        if (type === 'crystal') lights.push({ x: p.x, y: p.y, h: 30, r: 150, flick: rand() * 10, room: room.i, strength: 0.7, color: true, col: '#6fd8ff' });
        if (type === 'mushroom' && rand() < 0.5) lights.push({ x: p.x, y: p.y, h: 12, r: 100, flick: rand() * 10, room: room.i, strength: 0.5, color: true, col: '#b072ff' });
        if (type === 'candle') lights.push({ x: p.x, y: p.y, h: 18, r: 100, flick: rand() * 10, room: room.i, strength: 0.6, col: '#ffb060' });
      }
      // Fässer / Urnen zum Zerschlagen (nur in den ersten Zonen, nicht im Startraum)
      if (!room.start && !room.boss) {
        const nb = 2 + Math.floor(rand() * 4);
        for (let k = 0; k < nb; k++) {
          const tx = room.x + 1 + Math.floor(rand() * (room.w - 2)), ty = room.y + 1 + Math.floor(rand() * (room.h - 2));
          if (!isFloor(tx, ty) || roomAt[ty * W + tx] !== room.i || corr[ty * W + tx]) continue;
          props.push({ type: 'barrel', x: tx * T + T / 2, y: ty * T + T / 2 + 8, tall: true, breakable: true, hp: 1, room: room.i, z });
        }
      }
    }

    const start = rooms[0];
    return {
      w: W, h: H, tiles, roomAt, corr, rooms, props, lights,
      start: { x: start.cx * T + T / 2, y: start.cy * T + T / 2 },
      explored: new Uint8Array(W * H),
      isFloor,
      solid(px, py) { const tx = Math.floor(px / T), ty = Math.floor(py / T); return !isFloor(tx, ty); },
      /** Kreis (Fußradius) an Position passt auf begehbare Felder? */
      free(x, y, r) {
        const x0 = Math.floor((x - r) / T), x1 = Math.floor((x + r) / T), y0 = Math.floor((y - r) / T), y1 = Math.floor((y + r) / T);
        for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (!isFloor(tx, ty)) return false;
        return true;
      },
      los(x0, y0, x1, y1) {
        const d = Math.hypot(x1 - x0, y1 - y0), steps = Math.ceil(d / 20);
        for (let i = 1; i < steps; i++) {
          const t = i / steps;
          if (!isFloor(Math.floor((x0 + (x1 - x0) * t) / T), Math.floor((y0 + (y1 - y0) * t) / T))) return false;
        }
        return true;
      },
      randomFloorIn(room, margin, rnd) {
        for (let k = 0; k < 60; k++) {
          const tx = room.x + margin + Math.floor(rnd() * Math.max(1, room.w - margin * 2));
          const ty = room.y + margin + Math.floor(rnd() * Math.max(1, room.h - margin * 2));
          if (isFloor(tx, ty) && isFloor(tx + 1, ty) && isFloor(tx, ty + 1) && isFloor(tx - 1, ty) && isFloor(tx, ty - 1))
            return { x: tx * T + T / 2, y: ty * T + T / 2 };
        }
        return { x: room.cx * T + T / 2, y: room.cy * T + T / 2 };
      },
    };
  }

  /** Flussfeld (BFS) vom Spieler – Gegner ohne Sichtlinie laufen dem Gefälle nach. */
  function makeFlow(map) {
    return { dist: new Int16Array(map.w * map.h).fill(-1), tx: -1, ty: -1, queue: new Int32Array(map.w * map.h) };
  }
  function updateFlow(map, flow, px, py, maxDist) {
    const tx = Math.floor(px / T), ty = Math.floor(py / T);
    if (tx === flow.tx && ty === flow.ty) return;
    flow.tx = tx; flow.ty = ty;
    const d = flow.dist, q = flow.queue, W = map.w;
    d.fill(-1);
    let h = 0, t = 0;
    const s = ty * W + tx; d[s] = 0; q[t++] = s;
    while (h < t) {
      const k = q[h++], cd = d[k];
      if (cd >= maxDist) continue;
      const x = k % W, y = (k / W) | 0;
      for (let dir = 0; dir < 4; dir++) {
        const nx = x + (dir === 0 ? 1 : dir === 1 ? -1 : 0), ny = y + (dir === 2 ? 1 : dir === 3 ? -1 : 0);
        if (nx < 0 || ny < 0 || nx >= W || ny >= map.h) continue;
        const nk = ny * W + nx;
        if (d[nk] !== -1 || !map.tiles[nk]) continue;
        d[nk] = cd + 1; q[t++] = nk;
      }
    }
  }
  /** Richtung (Einheitsvektor) vom Pixelpunkt zur nächsten Feldmitte mit kleinerem Abstand */
  function flowDir(map, flow, x, y) {
    const tx = Math.floor(x / T), ty = Math.floor(y / T), W = map.w;
    const cur = flow.dist[ty * W + tx];
    if (cur < 0) return null;
    let best = cur, bx = 0, by = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = tx + dx, ny = ty + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= map.h) continue;
      const dd = flow.dist[ny * W + nx];
      if (dd < 0 || dd >= best) continue;
      if (dx && dy && (!map.tiles[ty * W + nx] || !map.tiles[ny * W + tx])) continue; // keine Diagonale um Ecken
      best = dd; bx = dx; by = dy;
    }
    if (!bx && !by) return null;
    const cx = (tx + bx + 0.5) * T, cy = (ty + by + 0.5) * T;
    const l = Math.hypot(cx - x, cy - y) || 1;
    return { x: (cx - x) / l, y: (cy - y) / l };
  }

  return { generate, makeFlow, updateFlow, flowDir, mulberry };
})();
