import { fluidKind } from './items.js';

const EPS = 0.001;
const GRAVITY = 30, JUMP = 9, WALK = 4.6, RUN = 7, SNEAK = 1.7, EYE = 1.62;

export function collides(w, px, py, pz, hw, h) {
  const x0 = Math.floor(px - hw), x1 = Math.floor(px + hw);
  const y0 = Math.floor(py), y1 = Math.floor(py + h);
  const z0 = Math.floor(pz - hw), z1 = Math.floor(pz + hw);
  for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
    if (w.solid(x, y, z)) return true;
  }
  return false;
}

// Déplace un corps (joueur ou créature) axe par axe. Renvoie la vitesse d'impact au sol.
export function moveBody(w, b, dt) {
  const p = b.pos, v = b.vel, hw = b.hw, h = b.h;
  let impact = 0;
  b.hitWall = false;
  p.x += v.x * dt;
  if (collides(w, p.x, p.y, p.z, hw, h)) {
    p.x = v.x > 0 ? Math.floor(p.x + hw) - hw - EPS : Math.floor(p.x - hw) + 1 + hw + EPS;
    v.x = 0; b.hitWall = true;
  }
  p.z += v.z * dt;
  if (collides(w, p.x, p.y, p.z, hw, h)) {
    p.z = v.z > 0 ? Math.floor(p.z + hw) - hw - EPS : Math.floor(p.z - hw) + 1 + hw + EPS;
    v.z = 0; b.hitWall = true;
  }
  p.y += v.y * dt;
  b.onGround = false;
  if (collides(w, p.x, p.y, p.z, hw, h)) {
    if (v.y <= 0) { impact = -v.y; p.y = Math.floor(p.y) + 1; b.onGround = true; }
    else p.y = Math.floor(p.y + h) - h - EPS;
    v.y = 0;
  }
  return impact;
}

export class Player {
  constructor(world) {
    this.world = world;
    this.pos = { x: 0, y: 0, z: 0 };
    this.vel = { x: 0, y: 0, z: 0 };
    this.hw = 0.3; this.h = 1.8;
    this.yaw = 0; this.pitch = 0;
    this.onGround = false;
    this.gliding = false;
    this.inUpdraft = false;
    this.updrafts = [];
    this.safe = null;
    this.safeTimer = 0;
    this.hp = 20;
    this.hunger = 20;
    this.exhaust = 0;
    this.moving = false;
    this.pull = null;
    this.sneaking = false;
    this.crouch = 0; // 0 debout, 1 accroupi (lissé pour la caméra)
    this.fly = false; // vol libre du mode créatif
  }

  get eyeY() { return this.pos.y + EYE - this.crouch * 0.28; }

  teleport(p) {
    this.pos.x = p.x; this.pos.y = p.y; this.pos.z = p.z;
    this.vel.x = this.vel.y = this.vel.z = 0;
    this.gliding = false;
    this.pull = null;
  }

  intersectsBlock(bx, by, bz) {
    const p = this.pos, hw = this.hw;
    return bx + 1 > p.x - hw && bx < p.x + hw && by + 1 > p.y && by < p.y + this.h && bz + 1 > p.z - hw && bz < p.z + hw;
  }

  look(dx, dy) {
    this.yaw -= dx * 0.0022;
    this.pitch = Math.max(-1.55, Math.min(1.55, this.pitch - dy * 0.0022));
  }

  // Espace : saut au sol, planeur en l'air.
  pressJump() {
    if (this.onGround) { this.vel.y = JUMP; this.onGround = false; }
    else this.gliding = !this.gliding;
  }

  // Renvoie la plus forte vitesse d'impact au sol pendant cette frame.
  update(dt, input) {
    const steps = Math.max(1, Math.ceil(dt / (1 / 90)));
    let impact = 0;
    for (let i = 0; i < steps; i++) impact = Math.max(impact, this.step(dt / steps, input));
    return impact;
  }

  step(dt, input) {
    const p = this.pos, v = this.vel;
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);

    this.inUpdraft = false;
    for (const u of this.updrafts) {
      const dx = p.x - u.x, dz = p.z - u.z;
      if (dx * dx + dz * dz < u.r * u.r && p.y >= u.bottom && p.y < u.top) { this.inUpdraft = true; break; }
    }

    this.moving = false;
    this.sneaking = !!input.sneak && !this.gliding && !this.pull && !this.fly;
    this.crouch += ((this.sneaking ? 1 : 0) - this.crouch) * Math.min(1, 14 * dt);
    // Dans un liquide : on flotte, on nage avec Espace, pas de planeur.
    const here = fluidKind(this.world.get(Math.floor(p.x), Math.floor(p.y + 0.6), Math.floor(p.z)));
    this.inLiquid = here === 1 ? 46 : here === 2 ? 47 : 0;
    if (this.fly) {
      // Vol libre : Espace monte, Maj descend, pas de gravité. Se poser en descendant y met fin.
      this.gliding = false; this.pull = null;
      let mx = 0, mz = 0;
      if (input.forward) { mx += fx; mz += fz; }
      if (input.back) { mx -= fx; mz -= fz; }
      if (input.right) { mx += rx; mz += rz; }
      if (input.left) { mx -= rx; mz -= rz; }
      const len = Math.hypot(mx, mz) || 1, sp = input.run ? 24 : 11, k = Math.min(1, 9 * dt);
      v.x += ((mx / len) * sp - v.x) * k;
      v.z += ((mz / len) * sp - v.z) * k;
      v.y += (((input.jump ? 1 : 0) - (input.sneak ? 1 : 0)) * 9 - v.y) * k;
      this.moving = mx !== 0 || mz !== 0;
      moveBody(this.world, this, dt);
      if (this.onGround && input.sneak) this.fly = false;
      return 0;
    }
    if (this.inLiquid && !this.pull) {
      this.gliding = false;
      let mx = 0, mz = 0;
      if (input.forward) { mx += fx; mz += fz; }
      if (input.back) { mx -= fx; mz -= fz; }
      if (input.right) { mx += rx; mz += rz; }
      if (input.left) { mx -= rx; mz -= rz; }
      const len = Math.hypot(mx, mz) || 1, k = Math.min(1, 6 * dt);
      v.x += ((mx / len) * 2.6 - v.x) * k;
      v.z += ((mz / len) * 2.6 - v.z) * k;
      v.y += ((input.jump ? 3.2 : input.sneak ? -4 : -1.6) - v.y) * Math.min(1, 5 * dt);
      this.moving = len > 1e-3 && (mx !== 0 || mz !== 0);
      moveBody(this.world, this, dt);
      return 0;
    }
    if (this.pull) {
      // Grappin : traction en ligne droite vers le point d'accroche.
      const dx = this.pull.x - p.x, dy = this.pull.y - (p.y + 1), dz = this.pull.z - p.z;
      const d = Math.hypot(dx, dy, dz) || 1;
      this.pull.t -= dt;
      const k = Math.min(1, 6 * dt), sp = 22;
      v.x += ((dx / d) * sp - v.x) * k; v.y += ((dy / d) * sp - v.y) * k; v.z += ((dz / d) * sp - v.z) * k;
      this.gliding = false;
      const impactPull = moveBody(this.world, this, dt);
      if (d < 1.9 || this.pull.t <= 0 || (this.hitWall && d < 3)) { this.pull = null; v.y = Math.max(v.y, 7); }
      return Math.min(impactPull, 0);
    }
    if (this.gliding) {
      const dive = Math.max(0, -Math.sin(this.pitch));
      const speed = 9 + dive * 9;
      const k = Math.min(1, 3 * dt);
      v.x += (fx * speed - v.x) * k;
      v.z += (fz * speed - v.z) * k;
      const targetVy = this.inUpdraft ? 8 : -1.5 - dive * 10;
      v.y += (targetVy - v.y) * Math.min(1, 4 * dt);
    } else {
      let mx = 0, mz = 0;
      if (input.forward) { mx += fx; mz += fz; }
      if (input.back) { mx -= fx; mz -= fz; }
      if (input.right) { mx += rx; mz += rz; }
      if (input.left) { mx -= rx; mz -= rz; }
      const len = Math.hypot(mx, mz);
      const speed = this.sneaking ? SNEAK : input.run && this.hunger > 4 ? RUN : WALK;
      if (len > 0) { mx = (mx / len) * speed; mz = (mz / len) * speed; this.moving = true; }
      const k = Math.min(1, (this.onGround ? 14 : 3) * dt);
      v.x += (mx - v.x) * k;
      v.z += (mz - v.z) * k;
      // Accroupi : on ne tombe pas d'un rebord. Un pas qui ne laisserait plus rien sous les pieds est annulé.
      if (this.sneaking && this.onGround) {
        const w = this.world, hw = this.hw;
        if (v.x && !collides(w, p.x + v.x * dt, p.y - 0.6, p.z, hw, 0.5)) v.x = 0;
        if (v.z && !collides(w, p.x + v.x * dt, p.y - 0.6, p.z + v.z * dt, hw, 0.5)) v.z = 0;
      }
      v.y = Math.max(-50, v.y - GRAVITY * dt);
      if (input.jet) v.y += (8 - v.y) * Math.min(1, 6 * dt); // réacteur dorsal
      if (input.jump && this.onGround) { v.y = JUMP; this.onGround = false; }
    }

    const impact = moveBody(this.world, this, dt);
    if (this.onGround) {
      this.gliding = false;
      this.safeTimer -= dt;
      if (this.safeTimer <= 0) { this.safe = { x: p.x, y: p.y, z: p.z }; this.safeTimer = 0.4; }
    }
    return impact;
  }
}
