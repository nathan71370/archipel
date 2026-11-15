import * as THREE from 'three';
import { shadedBox } from './world.js';
import { MOB } from './mobsim.js';

const RED = new THREE.Color(0xff3b3b);

// Une pièce du modèle : pavé ombré, pivot optionnel en haut (membres) ou à l'arrière (queue).
export function part(parent, w, h, d, color, x, y, z, opts = {}) {
  const g = shadedBox(w, h, d);
  if (opts.hinge) g.translate(0, -h / 2, 0);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, vertexColors: true }));
  m.position.set(x, y, z);
  m.castShadow = true;
  if (opts.rot) m.rotation.set(...opts.rot);
  m.userData = { base: new THREE.Color(color), glow: !!opts.glow };
  parent.add(m);
  return m;
}
const sub = (parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };

// Mouton-nuage : laine en volutes, tête crème, oreilles, queue, sabots.
function buildNuaki() {
  const g = new THREE.Group(), limbs = [];
  const WOOL = 0xf7f9ff, WOOL2 = 0xe6ecfa, SKIN = 0xf3d9c4, DARK = 0x4a4458;
  part(g, 0.78, 0.5, 1.0, WOOL, 0, 0.62, 0);
  part(g, 0.62, 0.22, 0.78, 0xffffff, 0, 0.96, 0.04);
  part(g, 0.4, 0.14, 0.42, 0xffffff, 0.04, 1.1, 0.1);
  part(g, 0.9, 0.3, 0.5, WOOL2, 0, 0.62, -0.18);
  part(g, 0.9, 0.3, 0.42, WOOL2, 0, 0.6, 0.26);
  part(g, 0.5, 0.36, 0.2, WOOL, 0, 0.66, 0.56);
  part(g, 0.2, 0.2, 0.16, 0xffffff, 0, 0.74, 0.7); // queue
  const head = sub(g, 0, 0.74, -0.52);
  part(head, 0.4, 0.38, 0.34, SKIN, 0, 0, -0.14);
  part(head, 0.46, 0.18, 0.3, 0xffffff, 0, 0.24, -0.08); // toupet
  part(head, 0.22, 0.16, 0.12, 0xe9c4ad, 0, -0.08, -0.36); // museau
  part(head, 0.1, 0.05, 0.03, 0xe8795a, 0, -0.04, -0.43);
  for (const s of [-1, 1]) {
    part(head, 0.08, 0.1, 0.03, 0x1b1630, s * 0.12, 0.06, -0.32);
    part(head, 0.03, 0.03, 0.02, 0xffffff, s * 0.1, 0.09, -0.34);
    part(head, 0.16, 0.08, 0.12, SKIN, s * 0.27, 0.06, -0.06, { rot: [0, 0, s * -0.5] }); // oreilles
  }
  for (const [x, z] of [[-0.24, -0.32], [0.24, -0.32], [-0.24, 0.34], [0.24, 0.34]]) {
    const leg = part(g, 0.15, 0.3, 0.15, DARK, x, 0.4, z, { hinge: true });
    part(leg, 0.17, 0.08, 0.17, 0x2a2540, 0, -0.34, 0);
    limbs.push(leg);
  }
  return { group: g, limbs, head };
}

// Petit oiseau rond qui sautille.
function buildPicore() {
  const g = new THREE.Group(), limbs = [];
  const BODY = 0xffd76b, BELLY = 0xfff1c9, WING = 0xf6a53c;
  part(g, 0.4, 0.36, 0.46, BODY, 0, 0.36, 0);
  part(g, 0.3, 0.2, 0.3, BELLY, 0, 0.26, -0.06);
  for (const s of [-1, 1]) part(g, 0.06, 0.22, 0.3, WING, s * 0.23, 0.38, 0.03);
  part(g, 0.16, 0.08, 0.2, WING, 0, 0.44, 0.3, { rot: [0.5, 0, 0] }); // queue
  const head = sub(g, 0, 0.6, -0.14);
  part(head, 0.3, 0.28, 0.28, BODY, 0, 0.04, -0.02);
  part(head, 0.12, 0.08, 0.14, 0xe8795a, 0, 0, -0.22); // bec
  part(head, 0.08, 0.12, 0.1, 0xe8795a, 0, 0.22, 0); // crête
  for (const s of [-1, 1]) part(head, 0.05, 0.06, 0.03, 0x1b1630, s * 0.1, 0.08, -0.17);
  for (const s of [-1, 1]) {
    const leg = part(g, 0.05, 0.2, 0.05, 0xe8795a, s * 0.1, 0.2, 0.02, { hinge: true });
    part(leg, 0.12, 0.03, 0.14, 0xe8795a, 0, -0.2, -0.04);
    limbs.push(leg);
  }
  return { group: g, limbs, head };
}

// Silhouette voûtée, longs bras griffus, éclats lumineux dans le dos.
function buildRodeur(BODY = 0x3b3550, DARK = 0x2a2540, EYE = 0x7ef0ff) {
  const g = new THREE.Group(), limbs = [];
  for (const s of [-1, 1]) {
    const leg = part(g, 0.2, 0.5, 0.22, DARK, s * 0.14, 0.92, 0.04, { hinge: true });
    part(leg, 0.17, 0.46, 0.18, BODY, 0, -0.46, 0.02);
    part(leg, 0.2, 0.08, 0.3, DARK, 0, -0.9, -0.05);
    limbs.push(leg);
  }
  const torso = sub(g, 0, 0.92, 0.04);
  torso.rotation.x = -0.32; // penché en avant
  part(torso, 0.5, 0.42, 0.3, BODY, 0, 0.2, 0);
  part(torso, 0.62, 0.36, 0.36, BODY, 0, 0.56, 0);
  part(torso, 0.3, 0.3, 0.06, 0x51496e, 0, 0.5, -0.19);
  for (const [x, y, h, r] of [[-0.14, 0.78, 0.34, 0.5], [0.12, 0.66, 0.26, 0.9], [0.02, 0.9, 0.22, 0.3]]) {
    part(torso, 0.09, h, 0.09, EYE, x, y, 0.22, { glow: true, rot: [r, 0, x * 2] }); // éclats dorsaux
  }
  const head = sub(torso, 0, 0.82, -0.08);
  part(head, 0.4, 0.36, 0.38, DARK, 0, 0.12, -0.04);
  part(head, 0.3, 0.1, 0.1, 0x1b1630, 0, 0, -0.22); // mâchoire
  for (const s of [-1, 1]) {
    part(head, 0.11, 0.06, 0.04, EYE, s * 0.1, 0.16, -0.24, { glow: true, rot: [0, 0, s * 0.35] });
    const arm = part(torso, 0.14, 0.56, 0.14, DARK, s * 0.4, 0.68, -0.02, { hinge: true });
    part(arm, 0.12, 0.5, 0.12, BODY, 0, -0.54, -0.04);
    part(arm, 0.16, 0.14, 0.05, EYE, 0, -1.08, -0.08, { glow: true }); // griffes
    limbs.push(arm);
  }
  return { group: g, limbs, head, reach: true };
}

// Colosse de basalte fissuré de braise, avec des cornes.
function buildBrandon() {
  const g = new THREE.Group(), limbs = [];
  const ROCK = 0x2b2730, DARK = 0x1a171d, HOT = 0xff6a1f, EYE = 0xffd27a;
  for (const s of [-1, 1]) {
    const leg = part(g, 0.28, 0.84, 0.3, DARK, s * 0.18, 0.84, 0, { hinge: true });
    part(leg, 0.3, 0.07, 0.07, HOT, 0, -0.4, -0.15, { glow: true });
    limbs.push(leg);
  }
  part(g, 0.74, 0.74, 0.46, ROCK, 0, 1.2, 0);
  part(g, 0.34, 0.4, 0.5, HOT, 0, 1.2, 0, { glow: true }); // cœur
  part(g, 0.78, 0.08, 0.5, HOT, 0, 1.0, 0, { glow: true }); // fissure
  part(g, 0.9, 0.24, 0.5, ROCK, 0, 1.52, 0.02); // épaules
  const head = sub(g, 0, 1.66, -0.02);
  part(head, 0.44, 0.38, 0.42, ROCK, 0, 0.16, 0);
  part(head, 0.3, 0.06, 0.05, HOT, 0, 0.02, -0.22, { glow: true }); // gueule
  for (const s of [-1, 1]) {
    part(head, 0.1, 0.08, 0.04, EYE, s * 0.11, 0.2, -0.22, { glow: true });
    part(head, 0.1, 0.3, 0.1, DARK, s * 0.2, 0.44, 0, { rot: [0, 0, s * -0.45] }); // cornes
    part(head, 0.07, 0.12, 0.07, HOT, s * 0.29, 0.6, 0, { glow: true });
    const arm = part(g, 0.24, 0.9, 0.26, ROCK, s * 0.56, 1.58, 0, { hinge: true });
    part(arm, 0.28, 0.24, 0.3, DARK, 0, -0.9, 0);
    part(arm, 0.26, 0.06, 0.28, HOT, 0, -0.5, 0, { glow: true });
    limbs.push(arm);
  }
  return { group: g, limbs, head };
}

// Villageois : longue robe, grand chapeau. La couleur dépend du peuple et du métier.
function buildVillager(robe, trim, hat, skin) {
  const g = new THREE.Group(), limbs = [];
  part(g, 0.56, 0.9, 0.4, robe, 0, 0.5, 0);
  part(g, 0.6, 0.12, 0.44, trim, 0, 0.1, 0);
  part(g, 0.58, 0.1, 0.42, trim, 0, 0.78, 0); // ceinture
  part(g, 0.5, 0.42, 0.34, robe, 0, 1.14, 0);
  const head = sub(g, 0, 1.36, 0);
  part(head, 0.4, 0.4, 0.38, skin, 0, 0.2, 0);
  part(head, 0.1, 0.14, 0.1, skin, 0, 0.14, -0.22); // nez
  for (const s of [-1, 1]) part(head, 0.06, 0.06, 0.03, 0x1b1630, s * 0.1, 0.24, -0.2);
  part(head, 0.74, 0.07, 0.74, hat, 0, 0.42, 0);
  part(head, 0.36, 0.22, 0.36, hat, 0, 0.56, 0);
  part(head, 0.38, 0.06, 0.38, trim, 0, 0.47, 0);
  for (const s of [-1, 1]) {
    const arm = part(g, 0.15, 0.62, 0.17, robe, s * 0.34, 1.32, 0, { hinge: true });
    part(arm, 0.13, 0.12, 0.14, skin, 0, -0.66, 0);
    limbs.push(arm);
  }
  return { group: g, limbs, head };
}
const JOB_COLORS = [[0x5fbf8a, 0xf4c95d], [0x8d94a8, 0xe0822f], [0x7b5ea7, 0x7ef0ff]]; // cultivateur, forgeron, érudit

// Scarabée : carapace bombée, bande dorée, six pattes.
function buildScarab() {
  const g = new THREE.Group(), limbs = [];
  const SHELL = 0x2f8f8a, DARK = 0x1d4f55, GOLD = 0xf4c95d;
  part(g, 0.62, 0.3, 0.8, SHELL, 0, 0.3, 0.04);
  part(g, 0.5, 0.12, 0.66, 0x3fb0a8, 0, 0.5, 0.04);
  part(g, 0.06, 0.14, 0.82, GOLD, 0, 0.5, 0.04);
  const head = sub(g, 0, 0.26, -0.44);
  part(head, 0.34, 0.2, 0.22, DARK, 0, 0, 0);
  for (const s of [-1, 1]) { part(head, 0.05, 0.05, 0.03, 0xffffff, s * 0.1, 0.04, -0.12); part(head, 0.04, 0.04, 0.2, DARK, s * 0.1, 0.1, -0.18, { rot: [0.5, s * 0.4, 0] }); }
  for (const z of [-0.2, 0.08, 0.34]) for (const s of [-1, 1]) {
    const leg = part(g, 0.3, 0.06, 0.06, DARK, s * 0.4, 0.14, z, { rot: [0, 0, s * -0.5] });
    if (limbs.length < 4) limbs.push(leg);
  }
  return { group: g, limbs, head };
}
function buildColosse() {
  const m = buildBrandon();
  m.group.scale.setScalar(2);
  return m;
}

const BUILD = {
  nuaki: buildNuaki, picore: buildPicore, rodeur: () => buildRodeur(), brandon: buildBrandon,
  scarab: buildScarab, colosse: buildColosse, givrelin: () => buildRodeur(0xbfe6f5, 0x7fb4d6, 0xffffff),
  celien: (job) => buildVillager(JOB_COLORS[job][0], JOB_COLORS[job][1], 0xf3d9c4, 0xe9b58f),
  cendreux: (job) => buildVillager(0x3a2a2e, JOB_COLORS[job][1], 0x8f2b22, 0x9a8f96),
};

// Affichage des créatures. Leur état vient de la simulation (locale en solo, serveur en ligne) ;
// ici on ne fait que dessiner, animer et lisser les déplacements.
export class MobView {
  constructor(scene) {
    this.scene = scene;
    this.map = new Map();
  }

  // rows : [id, type, métier, x, y, z, cap, touché, frappe, en chasse, vie]
  sync(rows) {
    const seen = new Set();
    for (const r of rows) {
      seen.add(r[0]);
      let m = this.map.get(r[0]);
      if (!m) {
        const def = MOB[r[1]];
        if (!def) continue;
        const model = BUILD[r[1]](r[2]);
        const meshes = [];
        model.group.traverse((o) => { if (o.isMesh) meshes.push(o); });
        m = { id: r[0], type: r[1], job: r[2], def, hw: def.hw, h: def.h, ...model, meshes, pos: { x: r[3], y: r[4], z: r[5] }, yaw: r[6], phase: Math.random() * 6, strikeT: 0, speed: 0 };
        m.group.position.set(r[3], r[4], r[5]);
        this.scene.add(m.group);
        this.map.set(r[0], m);
      }
      m.tx = r[3]; m.ty = r[4]; m.tz = r[5]; m.tyaw = r[6];
      m.flash = r[7]; m.chasing = r[9]; m.hp = r[10];
      if (r[8] && m.strikeT <= 0) m.strikeT = 0.3;
    }
    for (const [id, m] of this.map) {
      if (seen.has(id)) continue;
      this.scene.remove(m.group);
      for (const o of m.meshes) { o.geometry.dispose(); o.material.dispose(); }
      this.map.delete(id);
    }
  }

  clear() { this.sync([]); }

  // Créature la plus proche le long d'un rayon.
  raycast(o, d, maxDist) {
    let best = null;
    const oo = [o.x, o.y, o.z], dd = [d.x, d.y, d.z];
    for (const m of this.map.values()) {
      const min = [m.pos.x - m.hw, m.pos.y, m.pos.z - m.hw], max = [m.pos.x + m.hw, m.pos.y + m.h, m.pos.z + m.hw];
      let t0 = 0, t1 = maxDist, ok = true;
      for (let a = 0; a < 3 && ok; a++) {
        if (Math.abs(dd[a]) < 1e-8) { if (oo[a] < min[a] || oo[a] > max[a]) ok = false; continue; }
        let ta = (min[a] - oo[a]) / dd[a], tb = (max[a] - oo[a]) / dd[a];
        if (ta > tb) { const s = ta; ta = tb; tb = s; }
        t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
        if (t0 > t1) ok = false;
      }
      if (ok && (!best || t0 < best.t)) best = { mob: m, t: t0 };
    }
    return best;
  }

  // light(x, y, z) renvoie la couleur de la lumière ambiante à cet endroit.
  update(dt, light, eye) {
    for (const m of this.map.values()) {
      const def = m.def, p = m.pos;
      // Lissage vers la dernière position connue (téléporte si l'écart est trop grand).
      const gap = Math.hypot(m.tx - p.x, m.ty - p.y, m.tz - p.z);
      const k = gap > 8 ? 1 : Math.min(1, 14 * dt);
      const sx = (m.tx - p.x) * k, sz = (m.tz - p.z) * k;
      p.x += sx; p.y += (m.ty - p.y) * k; p.z += sz;
      m.speed += ((dt > 0 ? Math.hypot(sx, sz) / dt : 0) - m.speed) * Math.min(1, 10 * dt);
      let dy = m.tyaw - m.yaw;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      m.yaw += dy * Math.min(1, 12 * dt);

      const sp = m.speed;
      m.phase += dt * (1.6 + sp * 4);
      const swing = Math.sin(m.phase) * Math.min(0.8, sp * 0.3);
      m.strikeT = Math.max(0, m.strikeT - dt);
      m.limbs.forEach((l, j) => {
        const arm = j >= 2 && m.limbs.length === 4 && def.hostile;
        l.rotation.x = (j % 2 ? -swing : swing) * (arm ? 0.6 : 1) + (arm ? (m.reach && m.chasing ? -1.0 : 0) - Math.sin((m.strikeT / 0.3) * Math.PI) * 1.3 : 0);
      });
      if (m.head) {
        const ex = eye.x - p.x, ez = eye.z - p.z, dist = Math.hypot(ex, ez);
        let look = 0, nod = Math.sin(m.phase * 0.5) * 0.06;
        if (dist < 9) {
          look = Math.atan2(-ex, -ez) - m.yaw;
          look = Math.max(-0.9, Math.min(0.9, Math.atan2(Math.sin(look), Math.cos(look))));
        } else if (!def.hostile && sp < 0.2) nod = 0.45 + Math.sin(m.phase) * 0.1; // broute, picore
        m.head.rotation.y += (look - m.head.rotation.y) * Math.min(1, 6 * dt);
        m.head.rotation.x += (nod - m.head.rotation.x) * Math.min(1, 5 * dt);
      }
      m.group.position.set(p.x, p.y + (sp > 0.2 ? Math.abs(Math.sin(m.phase)) * 0.04 : 0), p.z);
      m.group.rotation.y = m.yaw;
      const tint = light(p.x, p.y + m.h * 0.6, p.z);
      for (const o of m.meshes) {
        const c = o.material.color.copy(o.userData.base);
        if (o.userData.glow) c.multiplyScalar(1.8); else c.multiply(tint);
        if (m.flash) c.lerp(RED, 0.6);
      }
    }
  }
}
