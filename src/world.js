import * as THREE from 'three';
import { tileUV } from './textures.js';
import { B, BLOCKS, ELECTRIC, LIQUID, CLEAR, PASS } from './items.js';
import { MODEL, MODEL_DIRS, itemQuads } from './models.js';
import { sideOf } from './sim.js';

// Les liquides ne bloquent ni le joueur ni la vue.
const LIQ = new Uint8Array(256);
for (const id of LIQUID) LIQ[id] = 1;
// Ce qu'on traverse : liquides et cultures.
const SOFT = new Uint8Array(256);
for (const id of LIQUID) SOFT[id] = 1;
for (const id of PASS) SOFT[id] = 1;
// Lumière : ce qui l'arrête, et ce qui en émet (0 à 15).
const OPAQUE = new Uint8Array(256), EMIT = new Uint8Array(256);
// SEE : ce à travers quoi on voit (liquides, verre) ; ces blocs ne cachent pas leurs voisins.
const SEE = new Uint8Array(256);
for (const id of LIQUID) SEE[id] = 1;
for (const id of CLEAR) SEE[id] = 1;
MODEL.forEach((m, id) => { if (m) SEE[id] = 1; }); // un modèle ne remplit pas son cube : il ne cache ni ses voisins ni la lumière
BLOCKS.forEach((def, id) => { if (def && !SEE[id]) OPAQUE[id] = 1; });
Object.entries({ [B.CRYSTAL]: 13, [B.EMBER]: 13, [B.LAVA]: 14, [B.CAP]: 11, [B.BEACON]: 14, [B.PORTAL]: 11, [B.URANITE]: 7, [B.ALTAR]: 9, [B.CORE]: 8, [B.LANTERN]: 14, [B.TORCH]: 12 }).forEach(([id, l]) => { EMIT[id] = l; });
for (let l = 1; l <= 7; l++) EMIT[70 + l] = 12;
const DIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

export const CS = 16, WY = 160;
const CELL = 112, CPC = CELL / CS; // une île au plus par cellule de 7x7 tronçons
export const VIEW = 11; // rayon de vue en tronçons

export const BIOMES = ['Prairie', 'Forêt', 'Pics rocheux', 'Cristaux', 'Terres de braise', 'Champignonnière', 'Dunes', 'Glacier'];
const SKY_BIOMES = [0, 1, 2, 3, 5, 6, 7];
export const DIMS = ['Ciel', 'Braise'];

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Hachage entier -> [0,1), pour des décisions stables par position.
function hash(x, y, z, s) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1274126177) ^ Math.imul(s, 362437);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  h = Math.imul(h, 2246822519);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

function makeNoise(seed) {
  const rnd = mulberry32(seed);
  const p = new Uint8Array(512);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const t = p[i]; p[i] = p[j]; p[j] = t;
  }
  for (let i = 0; i < 256; i++) p[i + 256] = p[i];
  const GX = [1, -1, 1, -1, 1, -1, 0, 0], GY = [1, 1, -1, -1, 0, 0, 1, -1];
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const g = (ix, iy, dx, dy) => { const h = p[p[ix] + iy] & 7; return GX[h] * dx + GY[h] * dy; };
  const noise = (x, y) => {
    const X = Math.floor(x), Y = Math.floor(y);
    const xf = x - X, yf = y - Y, xi = X & 255, yi = Y & 255;
    const u = fade(xf), v = fade(yf);
    const a = g(xi, yi, xf, yf), b = g(xi + 1, yi, xf - 1, yf);
    const c = g(xi, yi + 1, xf, yf - 1), d = g(xi + 1, yi + 1, xf - 1, yf - 1);
    const top = a + (b - a) * u;
    return top + ((c + (d - c) * u) - top) * v;
  };
  const fbm = (x, y) => noise(x, y) * 0.6 + noise(x * 2.1, y * 2.1) * 0.28 + noise(x * 4.3, y * 4.3) * 0.12;
  return { noise, fbm };
}

const ck = (cx, cz) => (cx + 32768) * 65536 + (cz + 32768);
export const posKey = (x, y, z) => x + ',' + y + ',' + z;

// Note une modification dans la table d'un monde, même si le tronçon n'est pas chargé.
export function recordEdit(edits, x, y, z, id) {
  const key = ck(x >> 4, z >> 4);
  let m = edits.get(key);
  if (!m) edits.set(key, (m = new Map()));
  m.set((y * CS + (z & 15)) * CS + (x & 15), id);
}

class Chunk {
  constructor(cx, cz) {
    this.cx = cx; this.cz = cz;
    this.data = new Uint8Array(CS * CS * WY);
    this.minY = WY; this.maxY = -1;
    this.meshes = [];
    this.dirty = true;
    this.light = null; // par bloc : 4 bits de lumière du ciel, 4 bits de lumière des sources
    this.lit = false;
  }
}

// Tronçons triés du plus proche au plus lointain.
const OFFSETS = [];
for (let dz = -VIEW - 2; dz <= VIEW + 2; dz++) for (let dx = -VIEW - 2; dx <= VIEW + 2; dx++) {
  const d = Math.hypot(dx, dz);
  if (d <= VIEW + 2.2) OFFSETS.push({ dx, dz, d }); // marge : un tronçon ne s'affiche qu'avec ses 8 voisins
}
OFFSETS.sort((a, b) => a.d - b.d);

export class World {
  constructor(seed, dim, edits, scene, mats) {
    this.seed = (seed + dim * 7919) | 0;
    this.dim = dim;
    this.edits = edits; // Map clé de tronçon -> Map(index local -> id)
    this.scene = scene;
    this.mats = mats;
    this.noise = makeNoise(this.seed ^ 0x9e3779b9);
    this.chunks = new Map();
    this.islands = new Map();
    this._last = null;
    this.settled = false;
    this.center = null;
    // Électricité
    this.electric = new Map();
    this.powered = new Set();
    this.fans = [];
    this.turrets = [];
    this.powerDirty = false;
    this.lightBoxes = [];
    this._lighting = null;
    this._touched = new Set();
    this.view = VIEW; // rayon réellement affiché (réglage de qualité), au plus VIEW
    this.vis = new Map(); // état visible des blocs (orientation, raccords des tuyaux…), tenu par la simulation
  }

  // ---------- Accès aux blocs ----------
  chunkAt(x, z) { return this.chunks.get(ck(x >> 4, z >> 4)); }
  ready(x, z) { return this.chunks.has(ck(Math.floor(x) >> 4, Math.floor(z) >> 4)); }

  get(x, y, z) {
    if (y < 0 || y >= WY) return 0;
    const cx = x >> 4, cz = z >> 4;
    let c = this._last;
    if (!c || c.cx !== cx || c.cz !== cz) {
      c = this.chunks.get(ck(cx, cz));
      if (!c) return 0;
      this._last = c;
    }
    return c.data[(y * CS + (z & 15)) * CS + (x & 15)];
  }

  // Bloc plein à cet endroit (les liquides ne comptent pas).
  solid(x, y, z) { const id = this.get(x, y, z); return SOFT[id] ? 0 : id; }

  // Modifie un bloc, l'enregistre comme modification du joueur et met à jour l'affichage.
  setBlock(x, y, z, id, mesh = true) {
    if (y < 0 || y >= WY) return false;
    const c = this.chunkAt(x, z);
    if (!c) return false;
    const i = (y * CS + (z & 15)) * CS + (x & 15);
    const old = c.data[i];
    c.data[i] = id;
    if (id) { if (y < c.minY) c.minY = y; if (y > c.maxY) c.maxY = y; }
    const key = ck(c.cx, c.cz);
    let m = this.edits.get(key);
    if (!m) this.edits.set(key, (m = new Map()));
    m.set(i, id);

    if (ELECTRIC.has(old) || ELECTRIC.has(id)) {
      const k = posKey(x, y, z);
      if (ELECTRIC.has(id)) this.electric.set(k, { x, y, z, id, k }); else this.electric.delete(k);
      this.powerDirty = true;
    }
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      const n = this.chunkAt(x + dx, z + dz);
      if (n) n.dirty = true;
    }
    this.settled = false;
    if (!this.headless) {
      this.queueLight(x, z);
      if (mesh) { for (const n of this.flushLight()) if (this.neighboursReady(n) && this.inView(n)) this.mesh(n); this.meshDirtyNear(x, z); }
    }
    this.onEdit?.(x, y, z, id);
    return true;
  }

  // L'état visible d'un bloc a changé (orientation, raccord, phare allumé) : on redessine autour.
  redraw(x, y, z) {
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) { const n = this.chunkAt(x + dx, z + dz); if (n) n.dirty = true; }
    if (this.headless) return;
    if (this.get(x, y, z) === B.LIGHTHOUSE) { this.queueLight(x, z); this.flushLight(); }
    this.meshDirtyNear(x, z);
  }

  meshDirtyNear(x, z) {
    const done = new Set();
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      const n = this.chunkAt(x + dx, z + dz);
      if (n && n.dirty && !done.has(n) && this.neighboursReady(n)) { done.add(n); this.mesh(n); }
    }
  }

  // Après une série de setBlock(..., false) : redessine tout ce qui a changé.
  meshAllDirty() {
    this.flushLight();
    for (const c of this.chunks.values()) if (c.dirty && this.neighboursReady(c) && this.inView(c)) this.mesh(c);
  }
  inView(c) {
    if (this.center == null) return true;
    const cx = Math.floor(this.center / 65536) - 32768, cz = (this.center % 65536) - 32768;
    return Math.hypot(c.cx - cx, c.cz - cz) <= this.view + 0.5;
  }

  surfaceY(x, z) {
    for (let y = WY - 1; y >= 0; y--) if (this.get(x, y, z)) return y;
    return -1;
  }

  // ---------- Lumière ----------
  // Deux canaux par bloc : la lumière du ciel (15 à l'air libre, s'affaiblit en entrant sous un toit)
  // et la lumière des sources (cristal, lave, lampe...). Chacune perd 1 par bloc parcouru.
  lightAt(x, y, z) {
    if (y >= WY) return 0xf0;
    if (y < 0) return 0;
    const c = this.chunkAt(x, z);
    return c && c.lit ? c.light[(y * CS + (z & 15)) * CS + (x & 15)] : 0xf0;
  }
  emitAt(c, i, x, y, z) {
    const id = c.data[i];
    return EMIT[id] || (id === B.LAMP && this.powered.has(posKey(x, y, z)) ? 15 : id === B.LIGHTHOUSE && (this.vis.get(posKey(x, y, z)) & 128) ? 15 : 0);
  }
  colTop(x, z) {
    const c = this.chunkAt(x, z);
    if (!c) return -1;
    const lx = x & 15, lz = z & 15;
    for (let y = c.maxY; y >= 0; y--) if (c.data[(y * CS + lz) * CS + lx]) return y;
    return -1;
  }
  usable(c) { return !!c && (c.lit || c === this._lighting); }

  // Ciel : chaque colonne reçoit 15 jusqu'au premier bloc plein (l'eau en retire 2 par bloc).
  seedSky(x0, z0, x1, z1, q) {
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      const c = this.chunkAt(x, z);
      if (!this.usable(c)) continue;
      const near = Math.max(this.colTop(x + 1, z), this.colTop(x - 1, z), this.colTop(x, z + 1), this.colTop(x, z - 1));
      const lx = x & 15, lz = z & 15, L8 = c.light, d = c.data;
      let L = 15;
      for (let y = WY - 1; y >= 0; y--) {
        const i = (y * CS + lz) * CS + lx, id = d[i];
        if (OPAQUE[id]) break;
        if (LIQ[id] && (L -= 2) <= 0) break;
        L8[i] = (L8[i] & 15) | (L << 4);
        if (L < 15 || y <= near + 1) q.push(x, y, z); // seules les cases voisines d'une zone sombre ont à se propager
      }
    }
  }
  seedEmit(x0, z0, x1, z1, q) {
    for (let cz = z0 >> 4; cz <= z1 >> 4; cz++) for (let cx = x0 >> 4; cx <= x1 >> 4; cx++) {
      const c = this.chunks.get(ck(cx, cz));
      if (!this.usable(c) || c.maxY < 0) continue;
      const bx = cx * CS, bz = cz * CS, d = c.data;
      const ax = Math.max(x0, bx) - bx, ex = Math.min(x1, bx + 15) - bx, az = Math.max(z0, bz) - bz, ez = Math.min(z1, bz + 15) - bz;
      for (let y = c.minY; y <= c.maxY; y++) for (let lz = az; lz <= ez; lz++) for (let lx = ax; lx <= ex; lx++) {
        const i = (y * CS + lz) * CS + lx;
        if (!d[i]) continue;
        const e = this.emitAt(c, i, bx + lx, y, bz + lz);
        if (e) { c.light[i] = (c.light[i] & 0xf0) | e; q.push(bx + lx, y, bz + lz); }
      }
    }
  }
  // Propagation en largeur : une case éclaire ses six voisines d'un cran de moins.
  spread(q, sky) {
    for (let head = 0; head < q.length; head += 3) {
      const x = q[head], y = q[head + 1], z = q[head + 2];
      const c = this.chunkAt(x, z);
      if (!c) continue;
      const b = c.light[(y * CS + (z & 15)) * CS + (x & 15)], L = sky ? b >> 4 : b & 15;
      if (L <= 1) continue;
      for (let k = 0; k < 6; k++) {
        const nx = x + DIRS[k][0], ny = y + DIRS[k][1], nz = z + DIRS[k][2];
        if (ny < 0 || ny >= WY) continue;
        const nc = nx >> 4 === c.cx && nz >> 4 === c.cz ? c : this.chunks.get(ck(nx >> 4, nz >> 4));
        if (!this.usable(nc)) continue;
        const ni = (ny * CS + (nz & 15)) * CS + (nx & 15), id = nc.data[ni];
        if (OPAQUE[id]) continue;
        const nl = L - 1 - LIQ[id], nb = nc.light[ni];
        if (nl <= (sky ? nb >> 4 : nb & 15)) continue;
        nc.light[ni] = sky ? (nb & 15) | (nl << 4) : (nb & 0xf0) | nl;
        if (nc !== this._lighting) this._touched.add(nc);
        q.push(nx, ny, nz);
      }
    }
  }
  // Fait entrer la lumière déjà calculée autour d'une zone (ses bords extérieurs).
  seedRing(x0, z0, x1, z1, qs, qb) {
    const col = (x, z) => {
      const c = this.chunkAt(x, z);
      if (!c || !c.lit) return;
      const lx = x & 15, lz = z & 15, L8 = c.light;
      for (let y = 0; y < WY; y++) {
        const b = L8[(y * CS + lz) * CS + lx];
        if (b >> 4 > 1) qs.push(x, y, z);
        if ((b & 15) > 1) qb.push(x, y, z);
      }
    };
    for (let x = x0 - 1; x <= x1 + 1; x++) { col(x, z0 - 1); col(x, z1 + 1); }
    for (let z = z0; z <= z1; z++) { col(x0 - 1, z); col(x1 + 1, z); }
  }

  // Premier éclairage d'un tronçon.
  lightChunk(c) {
    c.light ??= new Uint8Array(CS * CS * WY);
    c.light.fill(0);
    this._lighting = c;
    const x0 = c.cx * CS, z0 = c.cz * CS, qs = [], qb = [];
    this.seedSky(x0, z0, x0 + 15, z0 + 15, qs);
    this.seedEmit(x0, z0, x0 + 15, z0 + 15, qb);
    this.seedRing(x0, z0, x0 + 15, z0 + 15, qs, qb);
    this.spread(qs, true);
    this.spread(qb, false);
    c.lit = true;
    this._lighting = null;
    for (const n of this._touched) n.dirty = true;
    this._touched.clear();
  }

  // Un bloc a changé : la lumière est à refaire dans un rayon de 16 (portée maximale d'une source).
  queueLight(x, z) {
    const b = [x - 16, z - 16, x + 16, z + 16];
    for (const o of this.lightBoxes) {
      if (b[0] <= o[2] && b[2] >= o[0] && b[1] <= o[3] && b[3] >= o[1]) { o[0] = Math.min(o[0], b[0]); o[1] = Math.min(o[1], b[1]); o[2] = Math.max(o[2], b[2]); o[3] = Math.max(o[3], b[3]); return; }
    }
    this.lightBoxes.push(b);
  }
  // Recalcule les zones en attente ; renvoie les tronçons dont l'éclairage a réellement changé.
  flushLight() {
    const changed = new Set();
    while (this.lightBoxes.length) {
      const [x0, z0, x1, z1] = this.lightBoxes.pop();
      const list = [];
      for (let cz = z0 >> 4; cz <= z1 >> 4; cz++) for (let cx = x0 >> 4; cx <= x1 >> 4; cx++) {
        const c = this.chunks.get(ck(cx, cz));
        if (c && c.lit) list.push([c, c.light.slice()]);
      }
      if (!list.length) continue;
      for (const [c] of list) {
        const bx = c.cx * CS, bz = c.cz * CS;
        const ax = Math.max(x0, bx) - bx, ex = Math.min(x1, bx + 15) - bx, az = Math.max(z0, bz) - bz, ez = Math.min(z1, bz + 15) - bz;
        for (let y = 0; y < WY; y++) for (let lz = az; lz <= ez; lz++) c.light.fill(0, (y * CS + lz) * CS + ax, (y * CS + lz) * CS + ex + 1);
      }
      const qs = [], qb = [];
      this.seedSky(x0, z0, x1, z1, qs);
      this.seedEmit(x0, z0, x1, z1, qb);
      this.seedRing(x0, z0, x1, z1, qs, qb);
      this.spread(qs, true);
      this.spread(qb, false);
      for (const [c, old] of list) {
        const L8 = c.light;
        for (let i = 0; i < L8.length; i++) if (L8[i] !== old[i]) { changed.add(c); break; }
      }
      for (const n of this._touched) if (!list.some((e) => e[0] === n)) changed.add(n);
      this._touched.clear();
    }
    for (const c of changed) c.dirty = true;
    if (changed.size) this.settled = false;
    return changed;
  }

  // ---------- Îles ----------
  island(i, j) {
    const k = i + ',' + j;
    if (this.islands.has(k)) return this.islands.get(k);
    const s = this.seed, home = this.dim === 0 && i === 0 && j === 0;
    let isl = null;
    if (home || hash(i, j, 1, s) < 0.84) {
      const r = home ? 42 : 22 + Math.floor(hash(i, j, 2, s) * 27);
      const room = CELL - 2 * r - 8;
      isl = {
        r,
        x: i * CELL + r + 4 + Math.floor(hash(i, j, 3, s) * room),
        z: j * CELL + r + 4 + Math.floor(hash(i, j, 4, s) * room),
        y: home ? 72 : 60 + Math.floor(hash(i, j, 5, s) * 36),
        biome: this.dim === 1 ? 4 : home ? 0 : SKY_BIOMES[Math.floor(hash(i, j, 6, s) * SKY_BIOMES.length)],
        wind: hash(i, j, 7, s) * Math.PI * 2,
      };
      // Certaines grandes îles portent un village : Céliens sous le ciel, Cendreux dans la Braise.
      const sky = this.dim === 0;
      if (!home && r >= 28 && (sky ? (isl.biome === 0 || isl.biome === 1) && hash(i, j, 20, s) < 0.55 : hash(i, j, 20, s) < 0.35)) {
        const n = 4 + Math.floor(hash(i, j, 21, s) * 3), a0 = hash(i, j, 22, s) * 6.283;
        isl.village = { x: isl.x, z: isl.z, kind: this.dim, houses: [] };
        for (let k = 0; k < n; k++) {
          const a = a0 + (k / n) * 6.283, dist = 10 + (k % 2) * 3;
          isl.village.houses.push({ dx: Math.round(Math.cos(a) * dist), dz: Math.round(Math.sin(a) * dist) });
        }
      }
    }
    this.islands.set(k, isl);
    return isl;
  }

  nearestIsland(x, z) {
    const ci = Math.floor(x / CELL), cj = Math.floor(z / CELL);
    for (let ring = 1; ring < 6; ring++) {
      let best = null, bd = Infinity;
      for (let i = ci - ring; i <= ci + ring; i++) for (let j = cj - ring; j <= cj + ring; j++) {
        const isl = this.island(i, j);
        if (!isl) continue;
        const d = Math.hypot(isl.x - x, isl.z - z);
        if (d < bd) { bd = d; best = isl; }
      }
      if (best) return best;
    }
    return null;
  }

  villageNear(x, z, radius = 26) {
    const v = this.island(Math.floor(x / CELL), Math.floor(z / CELL))?.village;
    return v && Math.hypot(v.x - x, v.z - z) < radius ? v : null;
  }

  biomeAt(x, z) {
    const isl = this.island(Math.floor(x / CELL), Math.floor(z / CELL));
    return isl && Math.hypot(isl.x - x, isl.z - z) < isl.r + 4 ? BIOMES[isl.biome] : null;
  }

  // Courants ascendants naturels autour d'une position.
  updraftsNear(x, z) {
    const out = [], ci = Math.floor(x / CELL), cj = Math.floor(z / CELL);
    for (let i = ci - 1; i <= ci + 1; i++) for (let j = cj - 1; j <= cj + 1; j++) {
      const isl = this.island(i, j);
      if (isl) out.push({ x: isl.x + Math.cos(isl.wind) * (isl.r + 6), z: isl.z + Math.sin(isl.wind) * (isl.r + 6), r: 3.4, bottom: -20, top: Math.min(WY + 10, isl.y + 44) });
    }
    return out;
  }

  // Profil d'une colonne de l'île : sommet, dessous, distance au bord.
  column(isl, x, z, o) {
    const n = this.noise;
    const rr = isl.r * (0.82 + 0.26 * n.noise(x * 0.045 + 31, z * 0.045 - 17));
    const dist = Math.hypot(x - isl.x, z - isl.z);
    const d = dist / rr;
    if (d >= 1) return false;
    const edge = 1 - d, rise = Math.min(1, edge * 3.5), h = n.fbm(x * 0.028, z * 0.028);
    let top;
    if (isl.biome === 2) top = isl.y + Math.floor(rise * (3 + 26 * Math.max(0, h + 0.15) * Math.min(1, edge * 2)));
    else if (isl.biome === 3) top = isl.y + Math.floor(rise * (2 + 3 * h));
    else if (isl.biome === 4) top = isl.y + Math.floor(rise * (2 + 13 * Math.abs(h)));
    else top = isl.y + Math.floor(rise * (3 + 6 * h));
    let depth = 2 + isl.r * 0.8 * Math.pow(edge, 0.62) * (0.75 + 0.45 * Math.abs(n.noise(x * 0.07, z * 0.07 + 50)));
    depth += Math.max(0, n.noise(x * 0.33 + 9, z * 0.33)) * 5 * edge;
    o.top = Math.min(WY - 14, top);
    o.bottom = Math.max(2, Math.floor(isl.y - depth));
    o.edge = edge;
    o.dist = dist;
    return true;
  }

  blockFor(isl, x, y, z, top, bottom) {
    const s = this.seed, biome = isl.biome, rel = top - isl.y;
    let id;
    if (biome === 4) {
      if (y === top) return B.ASH;
      id = B.BASALT;
      const o = hash(x >> 1, y >> 1, z >> 1, s);
      if (o < 0.03) return B.EMBER;
      if (o < 0.046 && top - y > 4) return B.BRAISITE;
      if (o > 0.985 && top - y > 6) return B.URANITE;
      if (o < 0.066) return B.COAL_ORE;
      return id;
    }
    if (biome === 0 || biome === 1 || biome === 5) id = y === top ? (biome === 0 ? B.GRASS : biome === 1 ? B.MOSS : B.MYCEL) : y > top - 4 ? B.DIRT : B.STONE;
    else if (biome === 2) id = y === top ? (rel > 8 ? B.SNOW : rel > 3 ? B.STONE : B.GRASS) : (y > top - 2 && rel <= 3 ? B.DIRT : B.STONE);
    else if (biome === 6) id = y > top - 4 ? B.SAND : y > top - 7 ? B.SANDSTONE : B.STONE;
    else if (biome === 7) id = y === top ? B.SNOW : y > top - 3 ? B.ICE : B.STONE;
    else id = B.SLATE;
    if (id !== B.STONE && id !== B.SLATE) return id;
    if (y <= bottom + 1 && hash(x, y, z, s) < (biome === 3 ? 0.14 : 0.04)) return B.CRYSTAL;
    const o = hash(x >> 1, y >> 1, z >> 1, s + 5);
    if (o < 0.026) return B.COAL_ORE;
    if (o < 0.042) return B.COPPER_ORE;
    if (o < 0.056 && top - y > 5) return B.IRON_ORE;
    return id;
  }

  // ---------- Génération d'un tronçon ----------
  generate(cx, cz) {
    const c = new Chunk(cx, cz);
    const x0 = cx * CS, z0 = cz * CS;
    const isl = this.island(Math.floor(cx / CPC), Math.floor(cz / CPC));
    if (isl) {
      const R = isl.r * 1.1 + 5;
      const nx = Math.max(x0, Math.min(isl.x, x0 + 15)), nz = Math.max(z0, Math.min(isl.z, z0 + 15));
      if ((nx - isl.x) ** 2 + (nz - isl.z) ** 2 <= R * R) this.fill(c, isl);
    }
    const key = ck(cx, cz);
    const ed = this.edits.get(key);
    if (ed) {
      for (const [i, id] of ed) {
        c.data[i] = id;
        if (ELECTRIC.has(id)) {
          const y = Math.floor(i / (CS * CS)), lz = Math.floor(i / CS) % CS, lx = i % CS;
          const k = posKey(x0 + lx, y, z0 + lz);
          this.electric.set(k, { x: x0 + lx, y, z: z0 + lz, id, k });
          this.powerDirty = true;
        }
      }
    }
    const d = c.data;
    for (let y = 0; y < WY; y++) {
      const base = y * CS * CS;
      for (let i = 0; i < CS * CS; i++) if (d[base + i]) { if (c.minY === WY) c.minY = y; c.maxY = y; break; }
    }
    this.chunks.set(key, c);
    return c;
  }

  fill(c, isl) {
    const M = 3, W = CS + 2 * M, x0 = c.cx * CS, z0 = c.cz * CS, s = this.seed, d = c.data;
    const tops = new Int16Array(W * W).fill(-1), edges = new Float32Array(W * W), dists = new Float32Array(W * W), wet = new Uint8Array(W * W);
    // Lacs dans les creux des îles vertes, rivières de lave dans la Braise.
    const b0 = isl.biome, level = b0 === 4 ? isl.y + 3 : (b0 === 0 || b0 === 1 || b0 === 5 || b0 === 7) ? isl.y + 2 : -1, liquid = b0 === 4 ? B.LAVA : b0 === 7 ? B.ICE : B.WATER; // lacs gelés sur les glaciers
    const col = {};
    const put = (x, y, z, id, onlyAir) => {
      const lx = x - x0, lz = z - z0;
      if (lx < 0 || lz < 0 || lx >= CS || lz >= CS || y < 0 || y >= WY) return;
      const i = (y * CS + lz) * CS + lx;
      if (!onlyAir || !d[i]) d[i] = id;
    };

    for (let gz = 0; gz < W; gz++) for (let gx = 0; gx < W; gx++) {
      const x = x0 + gx - M, z = z0 + gz - M;
      if (!this.column(isl, x, z, col)) continue;
      const i = gz * W + gx;
      tops[i] = col.top; edges[i] = col.edge; dists[i] = col.dist;
      wet[i] = col.edge > 0.4 && col.top < level ? 1 : 0;
      if (gx >= M && gx < M + CS && gz >= M && gz < M + CS) {
        for (let y = col.bottom; y <= col.top; y++) d[(y * CS + (gz - M)) * CS + (gx - M)] = this.blockFor(isl, x, y, z, col.top, col.bottom);
        if (wet[i]) for (let y = col.top + 1; y <= level; y++) d[(y * CS + (gz - M)) * CS + (gx - M)] = liquid;
      }
    }

    // Arbres, buissons, flèches : décidés par colonne, y compris hors du tronçon (marge).
    for (let gz = 0; gz < W; gz++) for (let gx = 0; gx < W; gx++) {
      const i = gz * W + gx, top = tops[i];
      if (top < 0 || edges[i] < 0.12 || dists[i] < 6 || wet[i] || (isl.village && dists[i] < 19)) continue;
      const x = x0 + gx - M, z = z0 + gz - M;
      const f = hash(x, z, 11, s), v = hash(x, z, 12, s), rel = top - isl.y;
      const b = isl.biome;
      const chest = hash(x, z, 13, s) < (b === 4 ? 0.0009 : b === 0 ? 0.0001 : 0.0004);
      if (chest) {
        // Coffre ancien entre quatre piliers.
        const pillar = b === 4 ? B.BASALT : B.SLATE;
        for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) for (let k = 1; k <= 2; k++) put(x + dx, top + k, z + dz, pillar, true);
        put(x, top + 1, z, B.CHEST, false);
        continue;
      }
      const tree = (b === 0 && f < 0.006) || (b === 1 && f < 0.034) || (b === 2 && rel <= 3 && f < 0.004);
      if (tree) {
        const h = 4 + Math.floor(v * 3);
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
          const dist = dx * dx + dz * dz + dy * dy * 1.6;
          if (dist > 6.2 || (dist > 4.6 && hash(x + dx, top + h + dy, z + dz, s) < 0.5)) continue;
          put(x + dx, top + h + dy, z + dz, B.LEAVES, true);
        }
        for (let k = 1; k <= h; k++) put(x, top + k, z, B.LOG, false);
      } else if ((b === 0 && f < 0.013) || (b === 1 && f < 0.046)) {
        put(x, top + 1, z, B.BUSH, true);
      } else if (b === 3 && f < 0.03) {
        const h = 2 + Math.floor(v * 6);
        for (let k = 1; k <= h; k++) put(x, top + k, z, B.CRYSTAL, false);
        if (h > 4) { put(x + 1, top + 1, z, B.CRYSTAL, true); put(x, top + 1, z + 1, B.CRYSTAL, true); put(x - 1, top + 2, z, B.CRYSTAL, true); }
      } else if (b === 6 && f < 0.014) {
        const h = 2 + Math.floor(v * 3);
        for (let k = 1; k <= h; k++) put(x, top + k, z, B.CACTUS, false);
      } else if (b === 7 && f < 0.011) {
        // Sapin : couronnes de plus en plus étroites vers la pointe.
        const h = 5 + Math.floor(v * 3);
        for (let L = 2; L <= h; L++) {
          const r = Math.min(2, Math.floor((h + 2 - L) / 2));
          for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) if (dx * dx + dz * dz <= r * r + 1) put(x + dx, top + L, z + dz, B.PINE_LEAVES, true);
        }
        put(x, top + h + 1, z, B.PINE_LEAVES, true);
        for (let k = 1; k <= h; k++) put(x, top + k, z, B.LOG, false);
      } else if (b === 5 && f < 0.011) {
        // Champignon géant : pied, large chapeau lumineux, bord tombant.
        const h = 4 + Math.floor(v * 5);
        for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) {
          const d2 = dx * dx + dz * dz;
          if (d2 <= 9.5) put(x + dx, top + h, z + dz, B.CAP, true);
          if (d2 <= 3) put(x + dx, top + h + 1, z + dz, B.CAP, true);
          if (d2 > 6 && d2 <= 9.5) put(x + dx, top + h - 1, z + dz, B.CAP, true);
        }
        for (let k = 1; k < h; k++) put(x, top + k, z, B.STEM, false);
      } else if (b === 5 && f < 0.03) {
        put(x, top + 1, z, B.CAP, true);
      } else if (b === 4 && f < 0.022) {
        const h = 3 + Math.floor(v * 7);
        for (let k = 1; k <= h; k++) put(x, top + k, z, k === h ? B.EMBER : B.BASALT, false);
      }
    }
    if (isl.village) this.buildVillage(isl, put);
  }

  // Place d'un village : puits (ou forge) au centre, maisons autour. Chaque tronçon dessine sa part.
  buildVillage(isl, put) {
    const v = isl.village, K = v.kind, col = {};
    const wall = K ? B.BASALT : B.PLANKS, post = K ? B.SLATE : B.LOG, roof = K ? B.ASH : B.LEAVES, light = K ? B.EMBER : B.CRYSTAL, floor = K ? B.SLATE : B.PLANKS;
    const ground = (x, z) => (this.column(isl, x, z, col) ? col.top : isl.y);
    const gy = ground(v.x, v.z);
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
      const x = v.x + dx, z = v.z + dz, ring = Math.max(Math.abs(dx), Math.abs(dz)) === 2, corner = Math.abs(dx) === 2 && Math.abs(dz) === 2;
      for (let k = 1; k <= 3; k++) put(x, gy - k, z, B.STONE, true);
      put(x, gy, z, ring ? B.STONE : K ? B.LAVA : B.WATER, false);
      for (let k = 1; k <= 5; k++) put(x, gy + k, z, ring && k === 1 ? B.STONE : corner && k <= 3 ? post : corner && k === 4 ? light : 0, false);
    }
    v.houses.forEach((h, idx) => {
      const hx = v.x + h.dx, hz = v.z + h.dz, y = ground(hx, hz);
      const alongX = Math.abs(h.dx) > Math.abs(h.dz);
      const doorX = alongX ? -Math.sign(h.dx) * 2 : 0, doorZ = alongX ? 0 : -Math.sign(h.dz || 1) * 2;
      for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) put(hx + dx, y + 4, hz + dz, roof, false);
      for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
        const x = hx + dx, z = hz + dz, ax = Math.abs(dx), az = Math.abs(dz);
        for (let k = 1; k <= 3; k++) put(x, y - k, z, B.STONE, true);
        put(x, y, z, floor, false);
        for (let k = 1; k <= 3; k++) {
          let id = 0;
          if (ax === 2 && az === 2) id = post;
          else if (ax === 2 || az === 2) {
            const door = dx === doorX && dz === doorZ && k <= 2;
            const window = k === 2 && (ax === 0 || az === 0) && !(dx === doorX && dz === doorZ);
            id = door || window ? 0 : wall;
          }
          put(x, y + k, z, id, false);
        }
      }
      put(hx, y + 3, hz, light, false);
      if (idx % 2 === 0) put(hx - (doorX ? Math.sign(doorX) : 1), y + 1, hz - (doorZ ? Math.sign(doorZ) : 1), B.CHEST, false);
      if (idx === 1) put(hx - (doorX ? Math.sign(doorX) : 1), y + 1, hz - (doorZ ? Math.sign(doorZ) : -1), B.BENCH, false);
    });
  }

  // ---------- Chargement autour du joueur ----------
  ensure(x, z, radius) {
    const cx = Math.floor(x) >> 4, cz = Math.floor(z) >> 4;
    for (let dx = -radius - 2; dx <= radius + 2; dx++) for (let dz = -radius - 2; dz <= radius + 2; dz++) {
      if (!this.chunks.has(ck(cx + dx, cz + dz))) this.generate(cx + dx, cz + dz);
    }
    if (this.powerDirty) this.applyPower(this.powered);
    for (let dx = -radius - 1; dx <= radius + 1; dx++) for (let dz = -radius - 1; dz <= radius + 1; dz++) {
      const c = this.chunks.get(ck(cx + dx, cz + dz));
      if (c && !c.lit) this.lightChunk(c);
    }
    for (let dx = -radius; dx <= radius; dx++) for (let dz = -radius; dz <= radius; dz++) {
      const c = this.chunks.get(ck(cx + dx, cz + dz));
      if (c.dirty) this.mesh(c);
    }
  }

  // Côté serveur : génère le terrain autour d'un point, sans rien afficher.
  loadAround(x, z, radius, max = 30) {
    const cx = Math.floor(x) >> 4, cz = Math.floor(z) >> 4;
    let made = 0;
    for (const o of OFFSETS) {
      if (o.d > radius) break;
      if (this.chunks.has(ck(cx + o.dx, cz + o.dz))) continue;
      this.generate(cx + o.dx, cz + o.dz);
      if (++made >= max) return false;
    }
    return true;
  }
  unloadFar(points, radius) {
    for (const [key, c] of this.chunks) {
      if (!points.some((p) => Math.abs(c.cx - (Math.floor(p.x) >> 4)) <= radius && Math.abs(c.cz - (Math.floor(p.z) >> 4)) <= radius)) this.unload(key, c);
    }
  }

  // Un tronçon ne se dessine que si lui et ses huit voisins sont générés et éclairés.
  neighboursReady(c) {
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      const n = this.chunks.get(ck(c.cx + dx, c.cz + dz));
      if (!n || !n.lit) return false;
    }
    return true;
  }

  update(px, pz, budget = 10) {
    const cx = Math.floor(px) >> 4, cz = Math.floor(pz) >> 4;
    const ckey = ck(cx, cz);
    if (ckey !== this.center) {
      this.center = ckey;
      this.settled = false;
      for (const [key, c] of this.chunks) {
        if (Math.abs(c.cx - cx) > VIEW + 3 || Math.abs(c.cz - cz) > VIEW + 3) this.unload(key, c);
      }
      this.applyView();
    }
    if (this.powerDirty) this.applyPower(this.powered);
    if (this.lightBoxes.length) this.flushLight();
    if (this.settled) return;
    const t0 = performance.now();
    let pending = false;
    for (const o of OFFSETS) {
      if (o.d > this.view + 2.2) break;
      if (this.chunks.has(ck(cx + o.dx, cz + o.dz))) continue;
      if (performance.now() - t0 > budget * 0.35) { pending = true; break; }
      this.generate(cx + o.dx, cz + o.dz);
    }
    for (const o of OFFSETS) {
      if (o.d > this.view + 2) break;
      const c = this.chunks.get(ck(cx + o.dx, cz + o.dz));
      if (!c) { pending = true; continue; }
      if (c.lit) continue;
      if (performance.now() - t0 > budget * 0.7) { pending = true; break; }
      this.lightChunk(c);
    }
    for (const o of OFFSETS) {
      if (o.d > this.view + 0.5) break;
      const c = this.chunks.get(ck(cx + o.dx, cz + o.dz));
      if (!c) { pending = true; continue; }
      if (!c.dirty) continue;
      if (!this.neighboursReady(c)) { pending = true; continue; }
      if (performance.now() - t0 > budget) { pending = true; break; }
      this.mesh(c);
    }
    this.settled = !pending;
  }

  // Réglage de qualité : rayon affiché. Ce qui est au-delà est masqué (et caché par le brouillard).
  setView(r) {
    this.view = Math.max(4, Math.min(VIEW, r));
    this.settled = false;
    this.applyView();
  }
  applyView() {
    for (const [key, c] of this.chunks) { const v = this.inView(c); for (const m of c.meshes) m.visible = v; this.onModelsVisible?.(key, v); }
  }

  unload(key, c) {
    for (const m of c.meshes) { this.scene.remove(m); m.geometry.dispose(); }
    const ed = this.edits.get(key);
    if (ed) {
      const x0 = c.cx * CS, z0 = c.cz * CS;
      for (const [i, id] of ed) {
        if (!ELECTRIC.has(id)) continue;
        this.electric.delete(posKey(x0 + (i % CS), Math.floor(i / (CS * CS)), z0 + (Math.floor(i / CS) % CS)));
        this.powerDirty = true;
      }
    }
    if (this._last === c) this._last = null;
    this.onModels?.(key, null);
    this.chunks.delete(key);
  }

  dispose() {
    for (const [key, c] of this.chunks) { for (const m of c.meshes) { this.scene.remove(m); m.geometry.dispose(); } this.onModels?.(key, null); }
    this.chunks.clear();
    this._last = null;
  }

  // ---------- Électricité ----------
  // La simulation dit quels blocs sont alimentés ; le monde en déduit l'affichage,
  // les ventilateurs et les tourelles actifs.
  applyPower(set) {
    this.powerDirty = false;
    const old = this.powered;
    this.powered = set;
    this.fans = [];
    this.turrets = [];
    const redo = new Set();
    for (const e of this.electric.values()) {
      const on = set.has(e.k);
      if (on && e.id === B.FAN) this.fans.push(e);
      if (on && e.id === B.TURRET) this.turrets.push(e);
      if (old !== set && old.has(e.k) !== on && BLOCKS[e.id].onTile != null) { const c = this.chunkAt(e.x, e.z); if (c) redo.add(c); if (e.id === B.LAMP) this.queueLight(e.x, e.z); }
    }
    for (const c of this.flushLight()) redo.add(c);
    for (const c of redo) { c.dirty = true; if (this.neighboursReady(c)) this.mesh(c); }
  }

  // ---------- Rayon (DDA) ----------
  raycast(o, d, maxDist, liquids = false) {
    let x = Math.floor(o.x), y = Math.floor(o.y), z = Math.floor(o.z);
    const sx = Math.sign(d.x), sy = Math.sign(d.y), sz = Math.sign(d.z);
    const tdx = sx ? Math.abs(1 / d.x) : Infinity, tdy = sy ? Math.abs(1 / d.y) : Infinity, tdz = sz ? Math.abs(1 / d.z) : Infinity;
    let tx = sx > 0 ? (x + 1 - o.x) * tdx : sx < 0 ? (o.x - x) * tdx : Infinity;
    let ty = sy > 0 ? (y + 1 - o.y) * tdy : sy < 0 ? (o.y - y) * tdy : Infinity;
    let tz = sz > 0 ? (z + 1 - o.z) * tdz : sz < 0 ? (o.z - z) * tdz : Infinity;
    let nx = 0, ny = 0, nz = 0, t = 0;
    while (t <= maxDist) {
      const id = this.get(x, y, z);
      if (id && (!LIQ[id] || (liquids && (id === 46 || id === 47)))) return { x, y, z, nx, ny, nz, id, t }; // liquides : sources seulement
      if (tx < ty && tx < tz) { x += sx; t = tx; tx += tdx; nx = -sx; ny = 0; nz = 0; }
      else if (ty < tz) { y += sy; t = ty; ty += tdy; nx = 0; ny = -sy; nz = 0; }
      else { z += sz; t = tz; tz += tdz; nx = 0; ny = 0; nz = -sz; }
    }
    return null;
  }

  // ---------- Maillage ----------
  mesh(c) {
    for (const m of c.meshes) { this.scene.remove(m); m.geometry.dispose(); }
    c.meshes = [];
    c.dirty = false;
    if (c.maxY < 0) return;
    const buf = () => ({ pos: [], uv: [], col: [], nor: [], idx: [] });
    const solid = buf(), glow = buf(), fluid = buf(), clear = buf(), anims = [];
    const L8 = c.light;
    const lightOf = (lx, y, lz) => {
      if (y >= WY) return 0xf0;
      if (y < 0) return 0;
      if (lx >= 0 && lx < CS && lz >= 0 && lz < CS) return L8[(y * CS + lz) * CS + lx];
      return this.lightAt(x0 + lx, y, z0 + lz);
    };
    const d = c.data, x0 = c.cx * CS, z0 = c.cz * CS, ao = [0, 0, 0, 0];
    const at = (lx, y, lz) => {
      if (y < 0 || y >= WY) return 0;
      if (lx >= 0 && lx < CS && lz >= 0 && lz < CS) return d[(y * CS + lz) * CS + lx];
      return this.get(x0 + lx, y, z0 + lz);
    };

    for (let y = c.minY; y <= c.maxY; y++) for (let lz = 0; lz < CS; lz++) for (let lx = 0; lx < CS; lx++) {
      const id = d[(y * CS + lz) * CS + lx];
      if (!id) continue;
      const def = BLOCKS[id];
      const on = def.onTile != null && this.powered.has(posKey(x0 + lx, y, z0 + lz));
      const model = MODEL[id];
      if (model) {
        // Modèle en volume : ses pavés sont fondus dans le maillage, éclairés par la lumière de sa propre case.
        const v = this.vis.get(posKey(x0 + lx, y, z0 + lz));
        let quads;
        if (model.dyn) {
          // Un bras par voisin raccordé ; vers une machine, le décor montre le sens réglé à la clé.
          let mask = 0, deco = 0;
          for (let i = 0; i < 6; i++) {
            const dd = MODEL_DIRS[i], nb = at(lx + dd[0], y + dd[1], lz + dd[2]), m = sideOf(v, i);
            if (!m || !model.connects(nb)) continue;
            if (nb === id) { if (sideOf(this.vis.get(posKey(x0 + lx + dd[0], y + dd[1], z0 + lz + dd[2])), i ^ 1) === 0) continue; }
            else if (id !== B.CABLE) deco |= m << (i * 2);
            mask |= 1 << i;
          }
          quads = model.dyn(mask, deco);
        } else quads = model.rq[(v ?? 0) & 3];
        if (model.anim) anims.push({ x: x0 + lx, y, z: z0 + lz, id, rot: (v ?? 0) & 3 });
        const lb = L8[(y * CS + lz) * CS + lx], sk = (lb >> 4) / 15, bl = (lb & 15) / 15;
        for (const q of quads) {
          const f = FACES[q.fi];
          if (q.edge) { const nb = at(lx + f.d[0], y + f.d[1], lz + f.d[2]); if (nb && !SEE[nb]) continue; }
          const shine = q.glow === 1 || (q.glow === 2 && on);
          const out = shine ? glow : solid;
          const uv = uvOf(on && q.on != null ? q.on : q.tile);
          const base = out.pos.length / 3;
          for (let i = 0; i < 4; i++) {
            const p = q.P[i], u = q.U[i];
            out.pos.push(x0 + lx + p[0], y + p[1], z0 + lz + p[2]);
            out.uv.push(uv[0] + u[0] * (uv[2] - uv[0]), uv[1] + u[1] * (uv[3] - uv[1]));
            if (shine) out.col.push(1, 1, 1);
            else { out.col.push(f.shade, sk, bl); out.nor.push(f.d[0], f.d[1], f.d[2]); }
          }
          out.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
        }
        continue;
      }
      const lit = def.glow || (on && def.onGlow);
      const liq = LIQ[id];
      const out = lit ? glow : liq ? fluid : def.clear ? clear : solid;
      const lvl = def.flow ?? 8; // hauteur d'un liquide : pleine sous un autre liquide, sinon selon son niveau
      const low = !liq || LIQ[at(lx, y + 1, lz)] ? 1 : (lvl / 8) * 0.88;
      for (let fi = 0; fi < 6; fi++) {
        const f = FACES[fi];
        const nx = lx + f.d[0], ny = y + f.d[1], nz = lz + f.d[2];
        const nb = at(nx, ny, nz);
        if (nb) {
          if (!SEE[nb]) continue;
          if (liq && LIQ[nb] && (f.d[1] !== 0 || (BLOCKS[nb].flow ?? 8) >= lvl)) continue;
          if (nb === id && def.clear) continue;
        }
        const uv = uvOf(on ? def.onTile : f.d[1] > 0 ? def.top : f.d[1] < 0 ? def.bottom : def.side);
        const base = out.pos.length / 3;
        for (let i = 0; i < 4; i++) {
          const cn = f.c[i], o = f.ao[i];
          out.pos.push(x0 + lx + cn[0], y + cn[1] * low, z0 + lz + cn[2]);
          out.uv.push(UV_CORNER[i][0] ? uv[2] : uv[0], UV_CORNER[i][1] ? uv[3] : uv[1]);
          if (lit) { ao[i] = 3; out.col.push(1, 1, 1); continue; }
          // Occlusion et lumière lissées : moyenne des quatre cases qui touchent ce sommet.
          const v1 = at(nx + o[0], ny + o[1], nz + o[2]), v2 = at(nx + o[3], ny + o[4], nz + o[5]), v3 = at(nx + o[6], ny + o[7], nz + o[8]);
          const s1 = v1 && !SEE[v1] ? 1 : 0, s2 = v2 && !SEE[v2] ? 1 : 0, cr = v3 && !SEE[v3] ? 1 : 0;
          const level = liq ? 3 : s1 && s2 ? 0 : 3 - s1 - s2 - cr;
          ao[i] = level;
          let lb = lightOf(nx, ny, nz), sk = lb >> 4, bl = lb & 15, n = 1;
          if (!s1) { lb = lightOf(nx + o[0], ny + o[1], nz + o[2]); sk += lb >> 4; bl += lb & 15; n++; }
          if (!s2) { lb = lightOf(nx + o[3], ny + o[4], nz + o[5]); sk += lb >> 4; bl += lb & 15; n++; }
          if (!cr && !(s1 && s2)) { lb = lightOf(nx + o[6], ny + o[7], nz + o[8]); sk += lb >> 4; bl += lb & 15; n++; }
          out.col.push(f.shade * AO_LEVEL[level], sk / (15 * n), bl / (15 * n));
          out.nor.push(f.d[0], f.d[1], f.d[2]);
        }
        if (ao[0] + ao[2] < ao[1] + ao[3]) out.idx.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
        else out.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
    }
    for (const [bf, mat, kind] of [[solid, this.mats.solid, 0], [glow, this.mats.glow, 1], [fluid, this.mats.fluid, 2], [clear, this.mats.clear, 3]]) {
      const g = toGeometry(bf, kind === 1);
      if (!g) continue;
      const m = new THREE.Mesh(g, mat);
      m.castShadow = kind === 0;
      m.receiveShadow = kind !== 1;
      this.scene.add(m);
      c.meshes.push(m);
    }
    this.onModels?.(ck(c.cx, c.cz), anims);
  }
}

const FACE_SHADE = [0.92, 0.92, 1, 0.78, 0.96, 0.88]; // léger : le soleil fait désormais le gros du relief
const ENTITY_SHADE = [0.8, 0.8, 1, 0.5, 0.92, 0.66];
const FACES = [
  { d: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]] },
  { d: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
  { d: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
  { d: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { d: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },
  { d: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]] },
];
FACES.forEach((f, i) => {
  f.shade = FACE_SHADE[i];
  const axes = [0, 1, 2].filter((a) => f.d[a] === 0);
  f.ao = f.c.map((c) => {
    const o1 = [0, 0, 0], o2 = [0, 0, 0];
    o1[axes[0]] = c[axes[0]] * 2 - 1;
    o2[axes[1]] = c[axes[1]] * 2 - 1;
    return [...o1, ...o2, o1[0] + o2[0], o1[1] + o2[1], o1[2] + o2[2]];
  });
});
const AO_LEVEL = [0.42, 0.62, 0.82, 1];
const UV_CORNER = [[0, 0], [1, 0], [1, 1], [0, 1]];
const UV_CACHE = [];
const uvOf = (tile) => UV_CACHE[tile] || (UV_CACHE[tile] = tileUV(tile));

// glowing : blocs lumineux, simple couleur. Sinon l'attribut « vl » porte (occlusion, ciel, sources).
function toGeometry(b, glowing) {
  if (!b.idx.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
  g.setAttribute(glowing ? 'color' : 'vl', new THREE.Float32BufferAttribute(b.col, 3));
  if (!glowing) g.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3));
  g.setIndex(b.pos.length / 3 > 65000 ? new THREE.Uint32BufferAttribute(b.idx, 1) : new THREE.Uint16BufferAttribute(b.idx, 1));
  g.computeBoundingSphere();
  return g;
}

// Boîte aux faces ombrées (créatures, bras).
export function shadedBox(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d);
  const col = new Float32Array(24 * 3);
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) col.fill(ENTITY_SHADE[f], (f * 4 + v) * 3, (f * 4 + v) * 3 + 3);
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

// Petit cube texturé d'un bloc (objet tenu en main).
export function blockGeometry(id, size) {
  const def = BLOCKS[id];
  const quads = itemQuads(id);
  if (quads) return quadGeometry(quads, size);
  const g = shadedBox(size, size, size);
  const uv = g.attributes.uv;
  for (let f = 0; f < 6; f++) {
    const r = uvOf(f === 2 ? def.top : f === 3 ? def.bottom : def.side);
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setXY(i, r[0] + uv.getX(i) * (r[2] - r[0]), r[1] + uv.getY(i) * (r[3] - r[1]));
    }
  }
  return g;
}

// Géométrie d'un modèle (objet tenu, objet au sol, pièce mobile) : centrée sur (cx, cy, cz), en blocs × size.
export function quadGeometry(quads, size = 1, cx = 0.5, cy = 0.5, cz = 0.5) {
  const pos = [], uvs = [], col = [], idx = [];
  for (const q of quads) {
    const uv = uvOf(q.tile), base = pos.length / 3, sh = q.glow === 1 ? 1 : ENTITY_SHADE[q.fi];
    for (let i = 0; i < 4; i++) {
      const p = q.P[i], u = q.U[i];
      pos.push((p[0] - cx) * size, (p[1] - cy) * size, (p[2] - cz) * size);
      uvs.push(uv[0] + u[0] * (uv[2] - uv[0]), uv[1] + u[1] * (uv[3] - uv[1]));
      col.push(sh, sh, sh);
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}
