import * as THREE from 'three';
import { part } from './mobs.js';
import { ITEMS } from './items.js';

// Transforme ce que le joueur tape (IP, IP:port, URL) en adresse WebSocket.
export function wsUrl(input) {
  let s = input.trim().replace(/^(https?|wss?):\/\//, '').replace(/\/.*$/, '');
  if (!s) return null;
  if (!/:\d+$/.test(s)) s += ':5180';
  return `ws://${s}/ws`;
}
export const localWsUrl = () => `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;

// Connexion à une partie hébergée.
export class Net {
  constructor() { this.ws = null; this.handlers = {}; this.closed = false; }

  connect(url, name) {
    return new Promise((resolve, reject) => {
      let done = false;
      const fail = (msg) => { if (!done) { done = true; reject(new Error(msg)); } };
      let ws;
      try { ws = new WebSocket(url); } catch { fail('Adresse invalide.'); return; }
      this.ws = ws;
      const timer = setTimeout(() => { fail('Pas de réponse du serveur.'); ws.close(); }, 5000);
      ws.onopen = () => ws.send(JSON.stringify({ t: 'hello', name }));
      ws.onerror = () => fail('Connexion impossible.');
      ws.onclose = () => { clearTimeout(timer); fail('Connexion refusée.'); if (done && !this.closed) this.handlers.close?.(); };
      ws.onmessage = (e) => {
        let m;
        try { m = JSON.parse(e.data); } catch { return; }
        if (m.t === 'welcome') { clearTimeout(timer); done = true; resolve(m); }
        else this.handlers[m.t]?.(m);
      };
    });
  }

  on(type, fn) { this.handlers[type] = fn; }
  send(msg) { if (this.ws?.readyState === 1) this.ws.send(JSON.stringify(msg)); }
  close() { this.closed = true; this.ws?.close(); }
}

export function nameSprite(name) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.font = '700 30px ui-rounded, system-ui, sans-serif';
  const w = Math.min(248, g.measureText(name).width + 28);
  g.fillStyle = 'rgba(27,22,48,0.7)';
  g.beginPath(); g.roundRect((256 - w) / 2, 10, w, 44, 22); g.fill();
  g.fillStyle = '#fff6e9';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(name, 128, 33, 230);
  // Visible à travers le décor et le brouillard : c'est ce qui permet de se retrouver.
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthWrite: false, depthTest: false, fog: false }));
  s.renderOrder = 10;
  s.scale.set(1.6, 0.4, 1);
  s.position.y = 2.25;
  return s;
}

// Les autres joueurs : petit personnage coloré avec son pseudo au-dessus.
export class RemotePlayers {
  // itemMesh(id) : petit modèle d'un objet, pour ce que chacun tient en main.
  constructor(scene, itemMesh) { this.scene = scene; this.itemMesh = itemMesh; this.map = new Map(); }

  add(id, name) {
    if (this.map.has(id)) return;
    const g = new THREE.Group(), limbs = [];
    const shirt = new THREE.Color().setHSL((id * 0.283) % 1, 0.6, 0.55).getHex();
    for (const s of [-1, 1]) limbs.push(part(g, 0.22, 0.75, 0.24, 0x3b3550, s * 0.13, 0.75, 0, { hinge: true }));
    part(g, 0.52, 0.68, 0.28, shirt, 0, 1.1, 0);
    for (const s of [-1, 1]) limbs.push(part(g, 0.18, 0.68, 0.2, shirt, s * 0.36, 1.42, 0, { hinge: true }));
    const head = new THREE.Group();
    head.position.set(0, 1.46, 0);
    part(head, 0.44, 0.44, 0.44, 0xe9b58f, 0, 0.22, 0);
    part(head, 0.46, 0.14, 0.46, 0x6b4a3a, 0, 0.4, 0.01);
    for (const s of [-1, 1]) part(head, 0.07, 0.07, 0.03, 0x1b1630, s * 0.1, 0.24, -0.23);
    g.add(head);
    const wing = part(g, 3, 0.05, 1.2, 0xe8795a, 0, 2.05, 0.1);
    const meshes = [];
    g.traverse((o) => { if (o.isMesh) meshes.push(o); });
    const tag = nameSprite(name);
    g.add(tag);
    g.visible = false;
    this.scene.add(g);
    // La main droite porte l'objet tenu ; l'armure est faite de coques posées sur le corps.
    const hand = new THREE.Group();
    hand.position.set(0, -0.6, -0.16);
    limbs[3].add(hand);
    this.map.set(id, { g, limbs, head, wing, meshes, name, tag, target: null, phase: 0, hand, held: 0, heldMesh: null, armor: [0, 0, 0, 0], shells: [[], [], [], []], crouch: 0 });
  }

  remove(id) {
    const p = this.map.get(id);
    if (!p) return;
    this.scene.remove(p.g);
    p.g.traverse((o) => { o.geometry?.dispose(); o.material?.map?.dispose(); o.material?.dispose(); });
    this.map.delete(id);
  }

  // rows : [id, dim, x, y, z, yaw, pitch, gliding]
  setState(rows, myId) {
    for (const r of rows) {
      const p = this.map.get(r[0]);
      if (!p || r[0] === myId) continue;
      p.target = { d: r[1], x: r[2], y: r[3], z: r[4], yaw: r[5], pitch: r[6], gl: r[7], held: r[9] ?? 0, armor: [r[10] ?? 0, r[11] ?? 0, r[12] ?? 0, r[13] ?? 0], sneak: r[14] ?? 0 };
    }
  }

  // Objet tenu et pièces d'armure : refaits seulement quand ils changent.
  dress(p, t) {
    const drop = (m) => { m.parent?.remove(m); m.material.dispose(); const i = p.meshes.indexOf(m); if (i >= 0) p.meshes.splice(i, 1); };
    if (t.held !== p.held) {
      if (p.heldMesh) drop(p.heldMesh);
      p.held = t.held;
      p.heldMesh = null;
      if (ITEMS[t.held]) {
        const m = this.itemMesh(t.held);
        m.userData.base = new THREE.Color(0xffffff);
        m.rotation.set(ITEMS[t.held].block ? 0.3 : -1.2, 0.6, 0);
        p.hand.add(m);
        p.meshes.push(m);
        p.heldMesh = m;
      }
    }
    for (let slot = 0; slot < 4; slot++) {
      if (t.armor[slot] === p.armor[slot]) continue;
      p.armor[slot] = t.armor[slot];
      for (const m of p.shells[slot]) { drop(m); m.geometry.dispose(); }
      const it = ITEMS[t.armor[slot]], made = [];
      if (it?.armor) {
        const c = it.color;
        if (slot === 0) made.push(part(p.head, 0.5, 0.3, 0.5, c, 0, 0.34, 0));
        else if (slot === 1) { made.push(part(p.g, 0.58, 0.72, 0.34, c, 0, 1.1, 0)); for (const i of [2, 3]) made.push(part(p.limbs[i], 0.24, 0.3, 0.26, c, 0, 0, 0, { hinge: true })); }
        else if (slot === 2) for (const i of [0, 1]) made.push(part(p.limbs[i], 0.27, 0.46, 0.29, c, 0, 0, 0, { hinge: true }));
        else for (const i of [0, 1]) made.push(part(p.limbs[i], 0.28, 0.22, 0.3, c, 0, -0.64, 0));
        p.meshes.push(...made);
      }
      p.shells[slot] = made;
    }
  }

  update(dt, dim, light, eye) {
    for (const p of this.map.values()) {
      const t = p.target;
      p.g.visible = !!t && t.d === dim;
      if (!p.g.visible) continue;
      this.dress(p, t);
      p.crouch += ((t.sneak ? 1 : 0) - p.crouch) * Math.min(1, 12 * dt);
      p.g.scale.y = 1 - p.crouch * 0.14;
      const pos = p.g.position;
      if (Math.hypot(t.x - pos.x, t.y - pos.y, t.z - pos.z) > 12) pos.set(t.x, t.y, t.z);
      const k = Math.min(1, 12 * dt);
      const moved = Math.hypot(t.x - pos.x, t.z - pos.z);
      pos.x += (t.x - pos.x) * k; pos.y += (t.y - pos.y) * k; pos.z += (t.z - pos.z) * k;
      p.g.rotation.y = t.yaw;
      p.head.rotation.x = t.pitch;
      p.wing.visible = !!t.gl;
      p.phase += dt * 9;
      const swing = Math.sin(p.phase) * Math.min(0.8, moved * 6);
      p.limbs.forEach((l, i) => { l.rotation.x = i % 2 ? -swing : swing; });
      // De loin, l'étiquette grossit pour garder une taille lisible à l'écran.
      const far = eye ? Math.max(1, Math.hypot(pos.x - eye.x, pos.y - eye.y, pos.z - eye.z) / 14) : 1;
      p.tag.scale.set(1.6 * far, 0.4 * far, 1);
      p.tag.position.y = 2.25 + (far - 1) * 0.3;
      const tint = light(pos.x, pos.y + 1, pos.z);
      for (const o of p.meshes) o.material.color.copy(o.userData.base).multiply(tint);
    }
  }
}
