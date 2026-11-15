import { moveBody } from './player.js';

// Objets posés au sol : ils tombent, tournent sur eux-mêmes et se ramassent en passant dessus.
export class Drops {
  constructor(scene, meshFor) {
    this.scene = scene;
    this.meshFor = meshFor;
    this.map = new Map();
    this.seq = 1;
  }

  spawn({ k, d, p, v, s, delay = 0.6 }) {
    k ??= 'l' + this.seq++;
    if (this.map.has(k)) return;
    const mesh = this.meshFor(s.id);
    mesh.position.set(p[0], p[1], p[2]);
    this.scene.add(mesh);
    this.map.set(k, { k, d, s, mesh, pos: { x: p[0], y: p[1], z: p[2] }, vel: { x: v[0], y: v[1], z: v[2] }, hw: 0.12, h: 0.25, delay, age: Math.random() * 6, life: 0, pending: false });
  }

  remove(k) {
    const o = this.map.get(k);
    if (!o) return;
    this.scene.remove(o.mesh);
    this.map.delete(k);
  }

  // onPick(objet) est appelé quand le joueur est assez près.
  update(dt, world, dim, player, expire, onPick) {
    for (const o of this.map.values()) {
      o.mesh.visible = o.d === dim;
      if (o.d !== dim) continue;
      o.life += dt;
      if (expire && o.life > 300) { this.remove(o.k); continue; }
      if (world.ready(o.pos.x, o.pos.z)) {
        o.vel.y = Math.max(-30, o.vel.y - 24 * dt);
        moveBody(world, o, dt);
        if (o.onGround) { o.vel.x *= Math.max(0, 1 - 8 * dt); o.vel.z *= Math.max(0, 1 - 8 * dt); }
        if (o.pos.y < -30) { this.remove(o.k); continue; }
      }
      o.age += dt;
      o.mesh.position.set(o.pos.x, o.pos.y + 0.22 + Math.sin(o.age * 2.4) * 0.06, o.pos.z);
      o.mesh.rotation.y = o.age * 1.6;
      o.delay -= dt;
      if (o.delay <= 0 && !o.pending) {
        const dx = player.pos.x - o.pos.x, dy = player.pos.y + 0.9 - o.pos.y, dz = player.pos.z - o.pos.z;
        if (dx * dx + dy * dy + dz * dz < 2.4) onPick(o);
      }
    }
  }
}
