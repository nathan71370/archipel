// Vie des créatures, sans affichage : exécutée par le navigateur en solo et par le serveur en ligne.
// Positions, vie, poursuite, coups, butin et tourelles sont décidés ici, pour tous les joueurs à la fois.
import { moveBody } from './player.js';
import { B, I, LIQUID } from './items.js';

export const MOB = {
  nuaki: { name: 'Nuaki', hostile: false, hw: 0.42, h: 1.0, hp: 8, speed: 1.3, xp: 2, breed: I.WHEAT, wool: true, drops: [[I.MEAT_RAW, 1, 2]] },
  picore: { name: 'Picore', hostile: false, hw: 0.25, h: 0.6, hp: 4, speed: 1.7, xp: 1, hop: true, breed: I.SEEDS, drops: [[I.FEATHER, 1, 2], [I.MEAT_RAW, 0, 1]] },
  celien: { name: 'Célien', hostile: false, villager: true, hw: 0.3, h: 1.85, hp: 20, speed: 1.1, xp: 0, drops: [] },
  cendreux: { name: 'Cendreux', hostile: false, villager: true, hw: 0.3, h: 1.85, hp: 24, speed: 1.1, xp: 0, drops: [] },
  scarab: { name: 'Scarabée des sables', hostile: false, hw: 0.36, h: 0.5, hp: 6, speed: 1.5, xp: 2, drops: [[I.CHITIN, 1, 2]] },
  rodeur: { name: 'Rôdeur', hostile: true, nightOnly: true, hw: 0.32, h: 1.9, hp: 16, speed: 3.1, dmg: 3, xp: 8, drops: [[I.DUST, 0, 2]] },
  givrelin: { name: 'Givrelin', hostile: true, nightOnly: true, hw: 0.32, h: 1.9, hp: 22, speed: 2.6, dmg: 4, xp: 10, drops: [[I.FROST, 1, 2]] },
  colosse: { name: 'Colosse de braise', hostile: true, boss: true, hw: 0.8, h: 3.9, hp: 420, speed: 2.9, dmg: 9, reach: 2.6, xp: 150, drops: [[I.HEART, 1, 1], [I.EMBER_SHARD, 6, 10], [I.DUST, 4, 8]] },
  gelee: { name: 'Gelée', hostile: true, hop: true, hw: 0.4, h: 0.7, hp: 12, speed: 2.3, dmg: 2, xp: 5, drops: [[I.JELLY, 1, 2]] },
  cracheur: { name: 'Cracheur des dunes', hostile: true, nightOnly: true, ranged: { range: 13, dmg: 3, cd: 2.4 }, hw: 0.4, h: 0.9, hp: 14, speed: 2.4, dmg: 2, xp: 10, drops: [[I.CHITIN, 1, 2], [I.DUST, 0, 1]] },
  golem: { name: 'Golem de cendre', hostile: true, hw: 0.55, h: 2.5, hp: 70, speed: 1.9, dmg: 8, reach: 1.9, xp: 25, drops: [[I.EMBER_SHARD, 1, 2], [B.BASALT, 2, 4], [I.COIN, 0, 2]] },
  planeuse: { name: 'Planeuse', hostile: false, fly: true, hw: 0.6, h: 0.4, hp: 6, speed: 3.4, xp: 4, drops: [[I.FEATHER, 2, 4]] },
  veilleur: { name: "Veilleur de l'Éther", hostile: true, hw: 0.32, h: 1.9, hp: 34, speed: 3.2, dmg: 6, xp: 20, drops: [[I.DUST, 1, 3], [B.CRYSTAL, 0, 1], [I.OXY, 0, 1]] },
  brandon: { name: 'Brandon', hostile: true, hw: 0.38, h: 2.0, hp: 26, speed: 3.6, dmg: 5, xp: 14, drops: [[I.EMBER_SHARD, 0, 1], [I.DUST, 1, 2]] },
};

export class MobSim {
  // hooks : hitPlayer(joueur, dégâts, kx, kz), drop(x, y, z, pile), xp(joueur, points), tracer(a, b)
  constructor(world, hooks) {
    this.world = world;
    this.hooks = hooks;
    this.list = [];
    this.nextId = 1;
    this.spawnTimer = 2;
    this.hostileTimer = 12;
    this.passiveTimer = 3;
    this.turretTimer = 0;
    this.jellyTimer = 6;
    this.flyTimer = 10;
    this.turn = 0;
  }

  spawn(type, x, y, z, job = 0) {
    const def = MOB[type];
    const m = {
      id: this.nextId++, type, def, job,
      pos: { x, y, z }, vel: { x: 0, y: 0, z: 0 }, hw: def.hw, h: def.h,
      hp: def.hp, yaw: Math.random() * 6.28, wyaw: 0, walk: false, think: 0, cd: 0, flash: 0, flee: 0, strike: 0, chasing: false,
      onGround: false, hitWall: false, home: null, alt: y, love: 0, cool: 0, baby: 0, wool: 0,
    };
    this.list.push(m);
    return m;
  }

  remove(m) { const i = this.list.indexOf(m); if (i >= 0) this.list.splice(i, 1); }
  clear() { this.list.length = 0; }
  byId(id) { return this.list.find((m) => m.id === id) ?? null; }
  count(hostile, near) {
    return this.list.reduce((n, m) => n + (m.def.hostile === hostile && !m.def.villager && (!near || Math.hypot(m.pos.x - near.x, m.pos.z - near.z) < 100) ? 1 : 0), 0);
  }

  // by : identifiant du joueur responsable (reçoit l'expérience), ou null.
  hurt(m, dmg, kx, kz, by = null) {
    if (!m || !(dmg > 0)) return false;
    m.hp -= dmg;
    m.flash = 0.25;
    m.vel.x = kx * 6; m.vel.z = kz * 6; m.vel.y = 5;
    if (!m.def.hostile) m.flee = 5;
    if (m.hp > 0) return false;
    if (m.def.xp && by != null && !(m.baby > 0)) this.hooks.xp(by, m.def.xp);
    for (const [id, min, max] of m.baby > 0 ? [] : m.def.drops) {
      const n = min + Math.floor(Math.random() * (max - min + 1));
      if (n > 0) this.hooks.drop(m.pos.x, m.pos.y + 0.4, m.pos.z, { id, n });
    }
    this.remove(m);
    return true;
  }

  // Nourrir une bête : pendant 40 secondes elle cherche un partenaire nourri lui aussi.
  // Renvoie 'ok', 'baby' (trop jeune), 'wait' (déjà nourrie ou au repos) ou 'no'.
  feed(m) {
    if (!m || !m.def.breed) return 'no';
    if (m.baby > 0) return 'baby';
    if (m.love > 0 || m.cool > 0 || this.count(false, m.pos) >= 16) return 'wait';
    m.love = 40;
    return 'ok';
  }
  // Tondre : de la laine tombe, qui repousse en deux minutes.
  shear(m) {
    if (!m || !m.def.wool || m.wool > 0 || m.baby > 0) return false;
    m.wool = 120;
    this.hooks.drop(m.pos.x, m.pos.y + 0.6, m.pos.z, { id: B.WOOL, n: 1 + Math.floor(Math.random() * 2) });
    return true;
  }

  // Invocation du Colosse (un seul à la fois).
  summon(x, y, z) {
    if (this.list.some((m) => m.def.boss)) return false;
    this.spawn('colosse', x, y, z);
    return true;
  }

  blast(x, y, z, radius, dmg, by = null) {
    for (const m of [...this.list]) {
      const dx = m.pos.x - x, dz = m.pos.z - z, d = Math.hypot(dx, m.pos.y + m.h / 2 - y, dz);
      if (d < radius) this.hurt(m, dmg * (1 - d / radius), dx / (d || 1), dz / (d || 1), by);
    }
  }

  nearestHostile(x, y, z, range) {
    let best = null, bd = range;
    for (const m of this.list) {
      if (!m.def.hostile) continue;
      const d = Math.hypot(m.pos.x - x, m.pos.y + m.h / 2 - y, m.pos.z - z);
      if (d < bd) { bd = d; best = m; }
    }
    return best;
  }

  findGround(P, min, max) {
    const w = this.world;
    const a = Math.random() * 6.283, dist = min + Math.random() * (max - min);
    const x = Math.floor(P.x + Math.cos(a) * dist), z = Math.floor(P.z + Math.sin(a) * dist);
    if (!w.ready(x, z)) return null;
    const y = w.surfaceY(x, z);
    if (y < 0) return null;
    const ground = w.get(x, y, z);
    return LIQUID.has(ground) ? null : { x, y, z, ground };
  }

  // Apparitions autour d'un joueur : loin de lui, lentement, jamais d'hostile près d'un village ou d'une lampe.
  trySpawn(env, P) {
    const w = this.world;
    const v = w.villageNear(P.x, P.z, 70);
    if (v) {
      const kin = this.list.filter((m) => m.home === v).length;
      if (kin < v.houses.length) {
        const h = v.houses[kin], x = v.x + Math.round(h.dx * 0.55), z = v.z + Math.round(h.dz * 0.55);
        if (w.ready(x, z)) {
          const y = w.surfaceY(x, z);
          if (y >= 0 && !LIQUID.has(w.get(x, y, z))) this.spawn(v.kind ? 'cendreux' : 'celien', x + 0.5, y + 1, z + 0.5, kin % 3).home = v;
        }
      }
    }
    const wantHostile = env.dim >= 1 || env.night;
    if (wantHostile && this.hostileTimer <= 0 && this.count(true, P) < (env.dim === 1 ? 5 : 4)) {
      const g = this.findGround(P, 30, 58);
      const tooClose = g && env.players.some((p) => Math.hypot(p.pos.x - g.x, p.pos.z - g.z) < 24);
      if (g && !tooClose && g.ground !== B.LEAVES && g.ground !== B.BUSH && g.ground !== B.CAP && !w.villageNear(g.x, g.z, 34) && !env.safe(g.x, g.y, g.z)) {
        const cold = g.ground === B.SNOW || g.ground === B.ICE;
        this.spawn(env.dim === 2 ? 'veilleur' : env.dim === 1 ? (Math.random() < 0.22 ? 'golem' : 'brandon') : cold ? 'givrelin' : g.ground === B.SAND ? 'cracheur' : 'rodeur', g.x + 0.5, g.y + 1, g.z + 0.5);
        this.hostileTimer = env.dim === 1 ? 8 : env.dim === 2 ? 14 : 11;
      }
    }
    // Gelées : de jour comme de nuit, mais seulement sur le mycélium des champignonnières.
    if (env.dim === 0 && this.jellyTimer <= 0) {
      this.jellyTimer = 5;
      const g = this.findGround(P, 18, 46);
      const near = this.list.reduce((n, m) => n + (m.type === 'gelee' && Math.hypot(m.pos.x - P.x, m.pos.z - P.z) < 80 ? 1 : 0), 0);
      if (g && g.ground === B.MYCEL && near < 3 && !env.players.some((p) => Math.hypot(p.pos.x - g.x, p.pos.z - g.z) < 14) && !env.safe(g.x, g.y, g.z)) { this.spawn('gelee', g.x + 0.5, g.y + 1, g.z + 0.5); this.jellyTimer = 16; }
    }
    // Planeuses : elles tournent haut dans le ciel, de jour.
    if (env.dim === 0 && !env.night && this.flyTimer <= 0) {
      this.flyTimer = 20;
      if (this.list.reduce((n, m) => n + (m.type === 'planeuse' ? 1 : 0), 0) < 2) {
        const a = Math.random() * 6.283, d = 30 + Math.random() * 25;
        this.spawn('planeuse', P.x + Math.cos(a) * d, Math.min(150, P.y + 14 + Math.random() * 12), P.z + Math.sin(a) * d);
      }
    }
    if (env.dim === 0 && !env.night && this.passiveTimer <= 0 && this.count(false, P) < 6) {
      const g = this.findGround(P, 24, 56);
      if (g && (g.ground === B.GRASS || g.ground === B.MOSS || g.ground === B.MYCEL || g.ground === B.SAND)) {
        this.spawn(g.ground === B.SAND ? 'scarab' : Math.random() < 0.55 ? 'nuaki' : 'picore', g.x + 0.5, g.y + 1, g.z + 0.5);
        this.passiveTimer = this.count(false, P) < 3 ? 4 : 35; // le troupeau se reforme lentement
      }
    }
  }

  // env : { dim, night, players: [{ id, pos, alive }], safe(x, y, z), turrets: [{ x, y, z }] }
  update(dt, env) {
    const w = this.world, players = env.players;
    this.hostileTimer -= dt; this.passiveTimer -= dt; this.jellyTimer -= dt; this.flyTimer -= dt;
    if ((this.spawnTimer -= dt) <= 0) {
      this.spawnTimer = 1.5;
      if (players.length) this.trySpawn(env, players[this.turn++ % players.length].pos);
    }

    // Tourelles alimentées
    if ((this.turretTimer -= dt) <= 0) {
      this.turretTimer = 0.7;
      for (const t of env.turrets ?? []) {
        const a = { x: t.x + 0.5, y: t.y + 0.5, z: t.z + 0.5 };
        const m = this.nearestHostile(a.x, a.y, a.z, 15);
        if (!m) continue;
        const b = { x: m.pos.x, y: m.pos.y + m.h * 0.6, z: m.pos.z };
        const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, len = Math.hypot(dx, dy, dz) || 1;
        const d = { x: dx / len, y: dy / len, z: dz / len };
        if (w.raycast({ x: a.x + d.x * 0.9, y: a.y + d.y * 0.9, z: a.z + d.z * 0.9 }, d, len - 0.9)) continue;
        this.hooks.tracer(a, b);
        this.hurt(m, 4, d.x, d.z, null);
      }
    }

    for (let i = this.list.length - 1; i >= 0; i--) {
      const m = this.list[i], def = m.def, v = m.vel;
      // Joueur le plus proche (vivant de préférence)
      let P = null, dist = Infinity, far = Infinity;
      for (const p of players) {
        const d = Math.hypot(p.pos.x - m.pos.x, p.pos.z - m.pos.z);
        if (d < far) far = d;
        if (p.alive && d < dist) { dist = d; P = p; }
      }
      if (far > (m.home ? 130 : def.boss ? 220 : 90) || m.pos.y < -20) { this.remove(m); continue; }
      if (!w.ready(m.pos.x, m.pos.z)) continue;
      m.cd -= dt; m.flash -= dt; m.think -= dt; m.love -= dt; m.cool -= dt; m.wool -= dt;
      // Un petit devient adulte après quatre minutes.
      if (m.baby > 0 && (m.baby -= dt) <= 0) { m.hw = def.hw; m.h = def.h; } m.strike = Math.max(0, m.strike - dt);
      dist = dist || 0.001;
      const dx = P ? P.pos.x - m.pos.x : 0, dz = P ? P.pos.z - m.pos.z : 0, dy = P ? P.pos.y - m.pos.y : 0;

      // Les rôdeurs ne supportent pas le jour.
      if (def.nightOnly && !env.night) {
        m.hp -= 5 * dt; m.flash = 0.1;
        if (m.hp <= 0) { this.remove(m); continue; }
      }

      if (def.fly) {
        // Vol plané en larges cercles autour de son altitude ; frappée, elle s'enfuit plus vite.
        if (m.think <= 0) { m.think = 2 + Math.random() * 3; m.wyaw = (Math.random() - 0.5) * 0.8; }
        m.flee = Math.max(0, m.flee - dt);
        m.yaw += m.wyaw * dt;
        const sp = def.speed * (m.flee > 0 ? 2.2 : 1), k = Math.min(1, 3 * dt);
        v.x += (-Math.sin(m.yaw) * sp - v.x) * k;
        v.z += (-Math.cos(m.yaw) * sp - v.z) * k;
        v.y += ((m.alt + Math.sin(m.id + m.yaw) * 1.5 - m.pos.y) * 0.8 - v.y) * k;
        moveBody(w, m, dt);
        if (m.hitWall) { m.yaw += 2.2; m.alt = Math.min(150, m.alt + 3); }
        continue;
      }
      let wx = 0, wz = 0, speed = def.speed;
      m.chasing = false;
      const reach = def.reach ?? 1.35;
      if (def.hostile && P && dist < (def.boss ? 60 : 22) && Math.abs(dy) < (def.boss ? 30 : 8)) {
        m.chasing = true;
        if (dist > 0.9) { wx = dx / dist; wz = dz / dist; }
        if (def.ranged && dist < def.ranged.range && dist > 3.5) {
          // À distance : il s'arrête, fait face et crache s'il voit sa cible.
          wx = wz = 0;
          const diff = Math.atan2(-dx, -dz) - m.yaw;
          m.yaw += Math.atan2(Math.sin(diff), Math.cos(diff)) * Math.min(1, 8 * dt);
          if (m.cd <= 0) {
            m.cd = def.ranged.cd;
            const a = { x: m.pos.x, y: m.pos.y + m.h * 0.8, z: m.pos.z }, b = { x: P.pos.x, y: P.pos.y + 1.2, z: P.pos.z };
            const len = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) || 1, dd = { x: (b.x - a.x) / len, y: (b.y - a.y) / len, z: (b.z - a.z) / len };
            if (!w.raycast(a, dd, len - 0.5)) { m.strike = 0.3; this.hooks.tracer(a, b); this.hooks.hitPlayer(P.id, def.ranged.dmg, dx / dist * 0.4, dz / dist * 0.4); }
          }
        }
        if (dist < reach && Math.abs(dy) < reach + 0.4 && m.cd <= 0) { m.cd = 1.1; m.strike = 0.3; this.hooks.hitPlayer(P.id, def.dmg, dx / dist, dz / dist); }
      } else if (m.love > 0 && !(m.flee > 0)) {
        // Nourrie : elle cherche un partenaire nourri lui aussi, le rejoint, et un petit naît.
        let mate = null, md = 12;
        for (const o of this.list) {
          if (o === m || o.type !== m.type || !(o.love > 0)) continue;
          const d2 = Math.hypot(o.pos.x - m.pos.x, o.pos.z - m.pos.z);
          if (d2 < md) { md = d2; mate = o; }
        }
        if (mate && md < 1.4) {
          const kid = this.spawn(m.type, (m.pos.x + mate.pos.x) / 2, m.pos.y + 0.2, (m.pos.z + mate.pos.z) / 2);
          kid.baby = 240; kid.hw = def.hw * 0.5; kid.h = def.h * 0.5;
          m.love = mate.love = 0; m.cool = mate.cool = 120;
          this.hooks.born?.(def.name);
        } else if (mate) { wx = (mate.pos.x - m.pos.x) / md; wz = (mate.pos.z - m.pos.z) / md; speed *= 1.4; }
      } else if (m.flee > 0 && P) {
        m.flee -= dt; wx = -dx / dist; wz = -dz / dist; speed *= 2.4;
      } else {
        if (m.think <= 0) {
          m.think = 1.5 + Math.random() * 4; m.walk = Math.random() < 0.6; m.wyaw = Math.random() * 6.283;
          // Un villageois ne s'éloigne pas de sa place.
          if (m.home && Math.hypot(m.home.x - m.pos.x, m.home.z - m.pos.z) > 13) { m.walk = true; m.wyaw = Math.atan2(-(m.home.x - m.pos.x), -(m.home.z - m.pos.z)); }
        }
        if (m.home && dist < 3.5) m.walk = false; // il s'arrête quand on l'approche
        if (m.walk) { wx = -Math.sin(m.wyaw); wz = -Math.cos(m.wyaw); }
      }

      // Ne pas marcher dans le vide ni dans un liquide.
      if (wx || wz) {
        const ax = Math.floor(m.pos.x + wx * 0.9), az = Math.floor(m.pos.z + wz * 0.9), fy = Math.floor(m.pos.y);
        let ground = false;
        for (let k = 0; k <= 4 && !ground; k++) ground = !!w.solid(ax, fy - k, az);
        if (!ground) { wx = wz = 0; m.think = 0; }
      }

      const k = Math.min(1, 8 * dt);
      v.x += (wx * speed - v.x) * k;
      v.z += (wz * speed - v.z) * k;
      v.y = Math.max(-18, v.y - 30 * dt);
      moveBody(w, m, dt);
      if (m.onGround && (wx || wz) && (m.hitWall || def.hop)) v.y = m.hitWall ? 8.6 : 4.2;

      if (wx || wz) {
        let diff = Math.atan2(-wx, -wz) - m.yaw;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        m.yaw += diff * Math.min(1, 10 * dt);
      }
    }
  }

  // État compact envoyé aux joueurs : [id, type, métier, x, y, z, cap, touché, frappe, en chasse, vie]
  rows() {
    const r = (n) => Math.round(n * 100) / 100;
    return this.list.map((m) => [m.id, m.type, m.job, r(m.pos.x), r(m.pos.y), r(m.pos.z), r(m.yaw), m.flash > 0 ? 1 : 0, m.strike > 0 ? 1 : 0, m.chasing ? 1 : 0, Math.ceil(m.hp), m.baby > 0 ? 1 : 0, m.love > 0 ? 1 : 0]);
  }
}
