// Écoulement des liquides, sans affichage : exécuté par le navigateur en solo et par le serveur en ligne.
// Une source (eau 46, lave 47) alimente des écoulements de niveau 7 à 1. Un écoulement tombe s'il le peut,
// sinon s'étale ; privé de source il se retire. Eau et lave qui se rencontrent font de la roche.
import { B, fluidKind, fluidLevel, flowId } from './items.js';

const SIDES = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const AROUND = [[0, 0, 0], [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const STEP = { 1: 1, 2: 2 }; // l'eau perd 1 niveau par bloc, la lave 2 (elle va moins loin)
const PERIOD = { 1: 0.25, 2: 0.7 };
const key = (x, y, z) => x + ',' + y + ',' + z;

export class Fluids {
  // set(x, y, z, id) pose un bloc dans le monde (et le fait connaître à qui de droit).
  constructor(world, set) {
    this.world = world;
    this.set = set;
    this.active = new Map();
    this.timer = { 1: 0, 2: 0 };
    this.changed = false;
  }

  // Un bloc a changé ici : les liquides alentour doivent se recalculer.
  touch(x, y, z) {
    for (const [dx, dy, dz] of AROUND) this.active.set(key(x + dx, y + dy, z + dz), [x + dx, y + dy, z + dz]);
  }

  put(x, y, z, id) {
    this.set(x, y, z, id);
    this.changed = true;
    this.touch(x, y, z);
  }

  meetsOther(x, y, z, kind) {
    const w = this.world;
    return AROUND.some(([dx, dy, dz]) => { const k = fluidKind(w.get(x + dx, y + dy, z + dz)); return k && k !== kind; });
  }

  flowInto(x, y, z, kind, level) {
    this.put(x, y, z, this.meetsOther(x, y, z, kind) ? B.STONE : flowId(kind, level));
  }

  // Renvoie true si quelque chose a bougé (le client redessine alors).
  update(dt) {
    this.changed = false;
    for (const kind of [1, 2]) {
      if ((this.timer[kind] += dt) < PERIOD[kind]) continue;
      this.timer[kind] = 0;
      const cells = [...this.active];
      let done = 0;
      for (const [k, [x, y, z]] of cells) {
        const id = this.world.get(x, y, z), fk = fluidKind(id);
        if (fk && fk !== kind) continue; // au tour de l'autre liquide
        this.active.delete(k);
        if (fk === kind && this.world.ready(x, z)) { this.process(x, y, z, id, kind); if (++done > 500) break; }
      }
    }
    return this.changed;
  }

  process(x, y, z, id, kind) {
    const w = this.world, step = STEP[kind];
    let level = fluidLevel(id);
    if (level < 8) {
      // Niveau qu'un écoulement devrait avoir d'après ce qui l'alimente.
      let want = fluidKind(w.get(x, y + 1, z)) === kind ? 7 : 0;
      for (const [dx, dz] of SIDES) {
        const n = w.get(x + dx, y, z + dz);
        if (fluidKind(n) !== kind) continue;
        // Un voisin n'alimente que s'il repose sur du solide ou sur une source (sinon il tombe).
        const under = w.get(x + dx, y - 1, z + dz);
        if (under === 0 || (fluidKind(under) === kind && fluidLevel(under) < 8)) continue;
        want = Math.max(want, fluidLevel(n) - step);
      }
      if (want <= 0) { this.put(x, y, z, 0); return; }
      if (want !== level) { this.put(x, y, z, flowId(kind, want)); return; }
    }
    if (y <= 0) return;
    const below = w.get(x, y - 1, z), bk = fluidKind(below);
    if (below === 0) { this.flowInto(x, y - 1, z, kind, 7); return; }
    if (bk && bk !== kind) { if (fluidLevel(below) < 8) this.put(x, y - 1, z, B.STONE); return; }
    if (bk === kind && fluidLevel(below) < 8) { if (fluidLevel(below) < 7) this.put(x, y - 1, z, flowId(kind, 7)); return; }
    const next = level - step;
    if (next < 1) return;
    for (const [dx, dz] of SIDES) {
      const nx = x + dx, nz = z + dz;
      if (!w.ready(nx, nz)) continue;
      const n = w.get(nx, y, nz), nk = fluidKind(n);
      if (n === 0) this.flowInto(nx, y, nz, kind, next);
      else if (nk === kind && fluidLevel(n) < next) this.put(nx, y, nz, flowId(kind, next));
      else if (nk && nk !== kind && fluidLevel(n) < 8) this.put(nx, y, nz, B.STONE);
    }
  }
}
