// Simulation partagée (navigateur en solo, serveur en multijoueur) :
// conteneurs, machines, réseau électrique, tuyaux à objets et à fluides.
// Aucun accès au DOM ni à Three.js.
import { B, I, ITEMS, BLOCKS, ELECTRIC, GROW } from './items.js';

const rec = (ins, out, time) => ({ ins, out, time });

export const SMELT = [
  rec([[B.IRON_ORE, 1]], [I.IRON, 1], 6),
  rec([[B.COPPER_ORE, 1]], [I.COPPER, 1], 6),
  rec([[I.IRON_DUST, 1]], [I.IRON, 1], 4),
  rec([[I.COPPER_DUST, 1]], [I.COPPER, 1], 4),
  rec([[I.MEAT_RAW, 1]], [I.MEAT_COOKED, 1], 5),
  rec([[B.SAND, 1]], [B.GLASS, 1], 4),
  rec([[B.LOG, 1]], [I.COAL, 1], 6),
];
const MILL = [
  rec([[I.IRON, 1]], [I.PLATE, 1], 4),
  rec([[I.COPPER, 1]], [I.WIRE, 3], 3),
];
const WASH = [
  rec([[B.IRON_ORE, 1]], [I.IRON_DUST, 2], 5),
  rec([[B.COPPER_ORE, 1]], [I.COPPER_DUST, 2], 5),
];
// Les plans les plus précis d'abord : le premier dont tous les ingrédients sont présents est lancé.
const PRINT = [
  rec([[I.PLATE, 4], [I.CELL, 1], [I.EMBER_SHARD, 2]], [I.DRILL, 1], 14),
  rec([[I.PLATE, 3], [I.CIRCUIT, 2], [B.CRYSTAL, 2]], [I.PULSE, 1], 14),
  rec([[I.CELL, 1], [B.CRYSTAL, 3], [I.EMBER_SHARD, 2]], [I.PLASMA, 1], 14),
  rec([[I.PLATE, 4], [I.CELL, 2], [I.EMBER_SHARD, 2]], [I.JETPACK, 1], 18),
  rec([[B.URANITE, 2], [I.PLATE, 1]], [I.ROD, 1], 10),
  rec([[I.PLATE, 1], [I.WIRE, 2], [B.CRYSTAL, 1]], [I.CIRCUIT, 2], 6),
  rec([[I.PLATE, 1], [I.WIRE, 2], [I.COAL, 2]], [I.CELL, 1], 6),
  rec([[I.PLATE, 1], [I.COAL, 1]], [I.AMMO, 16], 4),
  rec([[I.COAL, 8], [I.CIRCUIT, 1]], [I.SEED_COAL, 1], 10),
  rec([[B.IRON_ORE, 8], [I.CIRCUIT, 1]], [I.SEED_IRON, 1], 10),
  rec([[B.COPPER_ORE, 8], [I.CIRCUIT, 1]], [I.SEED_COPPER, 1], 10),
  rec([[B.CRYSTAL, 8], [I.CIRCUIT, 1]], [I.SEED_CRYSTAL, 1], 10),
  rec([[B.URANITE, 8], [I.CIRCUIT, 1]], [I.SEED_URANITE, 1], 10),
  rec([[I.EMBER_SHARD, 8], [I.CIRCUIT, 1]], [I.SEED_EMBER, 1], 10),
];
// Ce qu'un germe fait pousser dans le cultivateur : [objet, quantité, secondes].
export const SEEDS = {
  [I.SEED_COAL]: [I.COAL, 2, 8], [I.SEED_IRON]: [B.IRON_ORE, 1, 8], [I.SEED_COPPER]: [B.COPPER_ORE, 1, 8],
  [I.SEED_CRYSTAL]: [B.CRYSTAL, 1, 12], [I.SEED_URANITE]: [B.URANITE, 1, 16], [I.SEED_EMBER]: [I.EMBER_SHARD, 1, 16],
};
const FUSE = [
  rec([[I.EMBER_SHARD, 2], [B.CRYSTAL, 2], [B.URANITE, 1]], [I.STAR, 1], 20),
];
// Durée de combustion en secondes.
export const FUEL = { [I.COAL]: 48, [B.LOG]: 12, [B.PLANKS]: 9, [I.STICK]: 3 };
const ROD_LIFE = 900;
export const BUCKET = 1000; // litres par seau

// slots : 'any' (coffre, tiroir), 'in', 'fuel', 'rod', 'charge', 'seed', 'out'
export const MACHINES = {
  [B.CHEST]: { slots: new Array(27).fill('any') },
  [B.DRAWER]: { slots: ['any'], drawer: 4096, hint: "Un seul type d'objet, jusqu'à 4 096. Pour qu'un tuyau le vide, règle le raccord sur « Tirer » avec la clé (flèche bleue)." },
  [B.TERMINAL]: { slots: [], terminal: true, hint: 'Montre tout ce que contiennent les coffres et tiroirs reliés par des tuyaux à objets.' },
  [B.FURNACE]: { slots: ['in', 'fuel', 'out'], recipes: SMELT, hint: 'Mets du combustible (charbon, bois) et de quoi cuire.' },
  [B.E_FURNACE]: { slots: ['in', 'out'], recipes: SMELT, power: 20, speed: 2, hint: 'Cuit deux fois plus vite, sans combustible.' },
  [B.CNC]: { slots: ['in', 'out'], recipes: MILL, power: 30, hint: 'Usine les lingots en plaques et en fils.' },
  [B.PRINTER]: { slots: ['in', 'in', 'in', 'out'], recipes: PRINT, power: 40, hint: 'Assemble composants, outils, armes et germes.' },
  [B.WASHER]: { slots: ['in', 'out'], recipes: WASH, power: 25, tank: 4000, fluid: B.WATER, fluidUse: 250, hint: "Lave un minerai à l'eau : deux poudres à fondre au lieu d'un lingot." },
  [B.GROWER]: { slots: ['seed', 'out', 'out'], grower: true, power: 30, tank: 4000, fluid: B.WATER, fluidUse: 250, hint: "Fait pousser le minerai de son germe, avec de l'eau. Le germe n'est pas consommé." },
  [B.STONER]: { slots: ['out'], makes: [B.STONE, 1], time: 2, power: 15, hint: "Fige de la roche à l'infini." },
  [B.CHARGER]: { slots: ['charge'], power: 50, hint: 'Recharge les outils électriques.' },
  [B.PUMP]: { slots: [], pump: true, tank: 4000, power: 10, hint: "Posée au-dessus d'eau ou de lave, elle en tire sans fin." },
  [B.TANK]: { slots: [], tank: 16000, hint: "Garde son contenu quand on le casse. Seau : clic droit. Pour qu'un tuyau le vide, règle le raccord sur « Tirer » avec la clé (flèche bleue)." },
  [B.GENERATOR]: { slots: ['fuel'], gen: 40, hint: 'Brûle du combustible tant que le réseau en a besoin.' },
  [B.LAVA_GEN]: { slots: [], gen: 120, tank: 8000, fluid: B.LAVA, hint: 'Brûle de la lave : un seau donne 120 W pendant une minute. Une pompe posée sur de la lave le nourrit sans fin.' },
  [B.BATTERY]: { slots: [], store: 20000, hint: 'Stocke le surplus et le rend quand la production manque.' },
  [B.CORE]: { slots: ['rod'], gen: 400, hint: "Le cœur va au centre d'un cube de 3×3×3 : 26 blindages l'entourent de tous côtés, coins compris. Une barre d'uranium y brûle 15 minutes. Le courant sort par un câble collé à un blindage ; un clic droit sur un blindage ouvre le cœur." },
  [B.CONDENSER]: { slots: ['out'], makes: [I.DUST, 1], time: 10, power: 150, hint: "Tire de la poussière d'orage de l'air. Gourmand : 150 W." },
  [B.FORGE]: { slots: ['in', 'in', 'in', 'out'], recipes: FUSE, power: 300, hint: "Fond braise, cristal et uranite en alliage stellaire. Il lui faut 300 W : c'est un travail pour un réacteur." },
  [B.LIGHTHOUSE]: { slots: [], power: 300, beacon: 90, hint: "Donne-lui 300 W sans faiblir pendant une minute et demie pour le rallumer. Une fois allumé, il l'est pour toujours." },
};
// Tout ce qui se fait dans une machine, pour le guide de l'écran de fabrication : { where, ins, out, time }.
export const GUIDE = [];
for (const [id, list] of [[B.FURNACE, SMELT], [B.CNC, MILL], [B.WASHER, WASH], [B.PRINTER, PRINT], [B.FORGE, FUSE]]) for (const r of list) GUIDE.push({ where: id, ins: r.ins, out: r.out, time: r.time });
for (const id in SEEDS) GUIDE.push({ where: B.GROWER, ins: [[+id, 1]], out: [SEEDS[id][0], SEEDS[id][1]], time: SEEDS[id][2], keep: true });
GUIDE.push({ where: B.STONER, ins: [], out: [B.STONE, 1], time: 2 }, { where: B.CONDENSER, ins: [], out: [I.DUST, 1], time: 10 });
export const GEN = { [B.TURBINE]: 8, [B.SOLAR]: 12, [B.GENERATOR]: 40, [B.LAVA_GEN]: 120, [B.CORE]: 400 };
// Raccord d'un tuyau avec une machine : bit 1 = pousser dedans, bit 2 = tirer dehors. 0 = débranché.
export const PIPE_MODES = ['débranché', 'pousse vers la machine', 'tire de la machine', 'automatique'];
export const isPipe = (id) => id === B.CABLE || id === B.ITEM_PIPE || id === B.FLUID_PIPE;
// État visible d'un bloc (« vis »), partagé avec l'affichage :
//   tuyaux et câbles : 2 bits par côté (ordre de N6), 0xfff par défaut — voir PIPE_MODES ;
//   autres blocs : bits 0-1 orientation, bits 2-5 niveau d'un réservoir (0 à 8), bit 6 lave, bit 7 ouvert (coffre) ou allumé (phare).
export const sideOf = (v, i) => ((v ?? 0xfff) >> (i * 2)) & 3;
// Ce à quoi un câble ou un tuyau se raccorde.
export function connects(pipe, id) {
  if (!id) return false;
  if (pipe === B.CABLE) return ELECTRIC.has(id);
  if (pipe === B.ITEM_PIPE) return id === B.ITEM_PIPE || MACHINES[id]?.slots.length > 0 || !!MACHINES[id]?.terminal;
  return id === B.FLUID_PIPE || !!MACHINES[id]?.tank;
}
const DRAW = { [B.LAMP]: 1, [B.FAN]: 5, [B.TURRET]: 5, [B.TNT]: 0 };
// Câbles, générateurs et machines conduisent ; lampes, ventilateurs, tourelles et poudrières sont en bout de ligne.
const CONDUCT = new Set([B.CABLE, B.CASING, B.BATTERY, B.TURBINE, B.SOLAR, B.GENERATOR, B.LAVA_GEN, B.CORE,
  B.E_FURNACE, B.CNC, B.PRINTER, B.CHARGER, B.PUMP, B.STONER, B.GROWER, B.WASHER, B.FORGE, B.CONDENSER, B.LIGHTHOUSE]);
const RELEVANT = new Set([...ELECTRIC, B.CHEST, B.FURNACE, B.DRAWER, B.TERMINAL, B.TANK, B.ITEM_PIPE, B.FLUID_PIPE, B.FARMLAND, ...Object.keys(GROW).map(Number)]);

export const N6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
export const key = (x, y, z) => x + ',' + y + ',' + z;
const isDay = (time) => Math.sin((time - 0.25) * Math.PI * 2) > 0.05;
const plain = (s) => ITEMS[s.id].stack > 1 && !s.e && !s.f; // empilable sans données propres

function hash(x, y, z) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Butin d'un coffre ancien, stable pour une position donnée.
const LOOT = [
  [[I.IRON, 2, 6], [I.COPPER, 2, 6], [I.COAL, 4, 10], [B.CRYSTAL, 1, 4], [I.DUST, 2, 5], [I.MEAT_COOKED, 2, 4], [I.AMMO, 6, 16], [B.TNT, 1, 3], [I.COIN, 2, 8]],
  [[I.EMBER_SHARD, 2, 5], [B.URANITE, 1, 3], [I.CIRCUIT, 1, 3], [I.PLATE, 2, 6], [I.DUST, 3, 7], [B.CRYSTAL, 2, 5], [I.CELL, 1, 2], [B.EMBER, 2, 6], [I.COIN, 4, 12]],
];
function lootFor(d, x, y, z) {
  const slots = new Array(27).fill(null), table = LOOT[d];
  const count = 4 + Math.floor(hash(x, y, z) * 4);
  for (let i = 0; i < count; i++) {
    const [id, min, max] = table[Math.floor(hash(x + i * 7, y, z + 3) * table.length)];
    slots[Math.floor(hash(x, y + i * 13, z) * 27)] = { id, n: min + Math.floor(hash(x + i, y + i, z + i) * (max - min + 1)) };
  }
  return slots;
}

export class Sim {
  // hooks : drop(d, x, y, z, stack), power(d), explode(d, x, y, z, radius), active(d) quand l'ensemble des machines en marche change,
  //         vis(d, clé, valeur ou null) quand l'état visible d'un bloc change, setBlock(d, x, y, z, id) pour les cultures qui poussent
  constructor(hooks) {
    this.hooks = hooks;
    this.dims = [0, 1].map(() => ({ blocks: new Map(), tiles: new Map(), vis: new Map(), open: new Map(), nets: null, pipes: null, powered: new Set(), active: new Set(), logi: 0 }));
    this._act = null; // machines en marche pendant le pas en cours
    this.time = 0.3;
    this.rolls = 0;
  }

  // edits : itérable de [cléDeTronçon, itérable de [indexLocal, id]]
  loadEdits(d, edits) {
    const blocks = this.dims[d].blocks;
    for (const [ck, cells] of edits) {
      const cx = Math.floor(ck / 65536) - 32768, cz = (ck % 65536) - 32768;
      for (const [i, id] of cells) {
        if (!RELEVANT.has(id)) continue;
        const x = cx * 16 + (i % 16), y = Math.floor(i / 256), z = cz * 16 + (Math.floor(i / 16) % 16);
        blocks.set(key(x, y, z), { x, y, z, id });
      }
    }
    this.dims[d].nets = this.dims[d].pipes = null;
  }

  toJSON() {
    return this.dims.map((D) => ({
      tiles: [...D.tiles].map(([k, t]) => [k, { ...t, net: undefined, items: undefined }]),
      // Niveau des réservoirs, coffres ouverts, phare allumé : recalculés à chaque pas, inutile de les garder.
      vis: [...D.vis].map(([k, v]) => [k, isPipe(D.blocks.get(k)?.id) ? v : v & 3]).filter(([, v]) => v),
    }));
  }
  load(data) {
    if (!Array.isArray(data)) return;
    data.forEach((entry, d) => {
      const D = this.dims[d];
      const tiles = Array.isArray(entry) ? entry : entry?.tiles ?? []; // ancien format : liste seule
      for (const [k, t] of tiles) if (MACHINES[t.id]) D.tiles.set(k, t);
      for (const [k, v] of entry?.vis ?? []) D.vis.set(k, v);
      // Ancien format : un seul mode par tuyau, appliqué à tous ses côtés.
      for (const [k, m] of entry?.pmode ?? []) if (m !== 3) D.vis.set(k, (m & 3) * 0x555);
      D.nets = D.pipes = null;
    });
  }

  setVis(d, k, v, pipe) {
    const D = this.dims[d], def = pipe ? 0xfff : 0;
    if ((D.vis.get(k) ?? def) === v) return false;
    if (v === def) D.vis.delete(k); else D.vis.set(k, v);
    this.hooks.vis?.(d, k, v === def ? null : v);
    return true;
  }
  // Un joueur ouvre ou referme un coffre : le couvercle suit.
  setOpen(d, x, y, z, on) {
    const D = this.dims[d], k = key(x, y, z);
    if (D.tiles.get(k)?.id !== B.CHEST) return;
    const n = Math.max(0, (D.open.get(k) ?? 0) + (on ? 1 : -1));
    if (n) D.open.set(k, n); else D.open.delete(k);
    this.setVis(d, k, ((D.vis.get(k) ?? 0) & ~128) | (n ? 128 : 0), false);
  }

  newTile(id) { return { id, slots: new Array(MACHINES[id].slots.length).fill(null), prog: 0, max: 0, burn: 0, burnMax: 0, e: 0 }; }

  // Un bloc change : mise à jour de l'index, du conteneur et des réseaux.
  // meta : { f } contenu d'un réservoir reposé, { src } liquide sous une pompe, { rot } orientation (0 à 3).
  onSet(d, x, y, z, id, meta) {
    const D = this.dims[d], k = key(x, y, z);
    const old = D.blocks.get(k), tile = D.tiles.get(k);
    D.open.delete(k);
    this.setVis(d, k, isPipe(id) ? 0xfff : (meta?.rot ?? 0) & 3, isPipe(id));
    // Un tuyau neuf se raccorde à ses voisins, même à ceux qu'on avait débranchés de son prédécesseur.
    if (isPipe(id)) N6.forEach(([dx, dy, dz], i) => {
      const nk = key(x + dx, y + dy, z + dz);
      if (D.blocks.get(nk)?.id === id && sideOf(D.vis.get(nk), i ^ 1) === 0) this.setVis(d, nk, D.vis.get(nk) | (3 << ((i ^ 1) * 2)), true);
    });
    if (tile && tile.id !== id) {
      for (const s of tile.slots) if (s) this.spill(d, x, y, z, s);
      if (tile.id === B.TANK) this.hooks.drop(d, x, y, z, tile.f?.amt > 0 ? { id: B.TANK, n: 1, f: { id: tile.f.id, amt: tile.f.amt } } : { id: B.TANK, n: 1 });
      D.tiles.delete(k);
    }
    if (RELEVANT.has(id)) D.blocks.set(k, { x, y, z, id }); else D.blocks.delete(k);
    if (MACHINES[id] && !D.tiles.has(k)) {
      const t = this.newTile(id);
      const f = meta?.f;
      if (id === B.TANK && f && (f.id === B.WATER || f.id === B.LAVA) && f.amt > 0) t.f = { id: f.id, amt: Math.min(MACHINES[id].tank, f.amt) };
      if (id === B.PUMP) t.src = meta?.src === B.WATER || meta?.src === B.LAVA ? meta.src : 0;
      D.tiles.set(k, t);
    }
    if (old || RELEVANT.has(id)) D.pipes = null;
    if (ELECTRIC.has(id) || (old && ELECTRIC.has(old.id))) { D.nets = null; this.power(d, 0); }
  }

  // Les piles d'un tiroir peuvent dépasser la taille normale : on les rend par paquets.
  spill(d, x, y, z, s) {
    const max = ITEMS[s.id].stack;
    for (let n = s.n; n > 0; n -= max) this.hooks.drop(d, x, y, z, { ...s, n: Math.min(max, n) });
  }

  // Conteneur à cette position ; les coffres naturels reçoivent leur butin à la première ouverture.
  tileAt(d, x, y, z, blockId) {
    const D = this.dims[d], k = key(x, y, z);
    let t = D.tiles.get(k);
    if (!t && MACHINES[blockId]) {
      t = this.newTile(blockId);
      if (blockId === B.CHEST && !D.blocks.has(k)) t.slots = lootFor(d, x, y, z);
      D.tiles.set(k, t);
    }
    return t ?? null;
  }

  // État envoyé à l'interface (le terminal y ajoute l'inventaire du réseau).
  view(d, x, y, z) {
    const t = this.dims[d].tiles.get(key(x, y, z));
    if (t && t.id === B.TERMINAL) { t.items = this.termItems(d, x, y, z); t.stores = this.termStores(d, x, y, z).length; }
    return t ?? null;
  }

  // ---------- Clé à molette ----------
  // Sur un tuyau ou un câble, la clé règle le raccord du côté visé (side : index dans N6) :
  //   vers une machine, un tuyau passe par automatique → tire → pousse → débranché ;
  //   vers un autre tuyau, ou pour un câble, c'est branché ou débranché (des deux côtés à la fois).
  // Sur tout autre bloc, elle le fait pivoter d'un quart de tour.
  // Renvoie { mode, machine } ou { rot }, ou null s'il n'y a rien à régler de ce côté.
  wrench(d, x, y, z, side) {
    const D = this.dims[d], k = key(x, y, z), b = D.blocks.get(k);
    if (!b || !isPipe(b.id)) {
      const rot = (((D.vis.get(k) ?? 0) & 3) + 1) & 3;
      this.setVis(d, k, ((D.vis.get(k) ?? 0) & ~3) | rot, false);
      return { rot };
    }
    if (!(side >= 0 && side < 6)) return null;
    const [dx, dy, dz] = N6[side], nk = key(x + dx, y + dy, z + dz), nb = D.blocks.get(nk);
    if (!nb || !connects(b.id, nb.id)) return null;
    const cur = sideOf(D.vis.get(k), side), machine = b.id !== B.CABLE && nb.id !== b.id;
    const mode = machine ? [3, 0, 1, 2][cur] : cur ? 0 : 3;
    const put = (kk, i) => this.setVis(d, kk, ((D.vis.get(kk) ?? 0xfff) & ~(3 << (i * 2))) | (mode << (i * 2)), true);
    put(k, side);
    if (nb.id === b.id) put(nk, side ^ 1);
    D.pipes = null;
    if (b.id === B.CABLE) { D.nets = null; this.power(d, 0); }
    return { mode, machine };
  }
  // Un rangement (coffre, tiroir, réservoir) ne se vide que par un raccord réglé sur « tire » :
  // sinon deux coffres sur le même réseau se renverraient leurs objets sans fin.
  canPull(D, att, tile, fluid) {
    const m = sideOf(D.vis.get(att.pk), att.side), def = MACHINES[tile.id];
    if (!(m & 2)) return false;
    // Fluides : un réservoir est un rangement, et une machine qui consomme un fluide ne le rend pas.
    const keeps = fluid ? tile.id === B.TANK || !!def.fluid : def.slots.includes('any');
    return m === 2 || !keeps;
  }
  canPush(D, att) { return (sideOf(D.vis.get(att.pk), att.side) & 1) !== 0; }
  // Le courant passe-t-il de a vers b, voisin dans la direction i ? Un câble peut être débranché de ce côté.
  wired(D, a, i, b) {
    if (a.id === B.CABLE && sideOf(D.vis.get(key(a.x, a.y, a.z)), i) === 0) return false;
    return !(b.id === B.CABLE && sideOf(D.vis.get(key(b.x, b.y, b.z)), i ^ 1) === 0);
  }

  // ---------- Cases ----------
  accepts(tile, slot, st) {
    const def = MACHINES[tile.id], kind = def.slots[slot], id = st.id;
    if (def.drawer) return plain(st) && (!tile.slots[0] || tile.slots[0].id === id);
    if (kind === 'any' || kind === 'in') return true;
    if (kind === 'fuel') return FUEL[id] != null;
    if (kind === 'rod') return id === I.ROD;
    if (kind === 'charge') return !!ITEMS[id]?.charge;
    if (kind === 'seed') return SEEDS[id] != null;
    return false;
  }
  // Un tuyau est plus difficile qu'une main : il ne remplit que ce qui sert à la machine.
  pipeAccepts(tile, slot, st) {
    const def = MACHINES[tile.id];
    if (def.slots[slot] === 'in') return !!def.recipes?.some((r) => r.ins.some(([id]) => id === st.id));
    return this.accepts(tile, slot, st);
  }

  // Dépose une pile ; renvoie la quantité refusée.
  put(tile, slot, st) {
    if (!tile || !ITEMS[st.id] || !(st.n > 0) || slot < 0 || slot >= tile.slots.length || !this.accepts(tile, slot, st)) return st.n;
    const cur = tile.slots[slot], max = MACHINES[tile.id].drawer ?? ITEMS[st.id].stack;
    if (!cur) { const m = Math.min(st.n, max); tile.slots[slot] = { ...st, n: m }; return st.n - m; }
    if (cur.id !== st.id || !plain(cur) || !plain(st)) return st.n;
    const m = Math.min(st.n, max - cur.n);
    cur.n += m;
    return st.n - m;
  }

  take(tile, slot, n) {
    const cur = tile?.slots[slot];
    if (!cur || !(n > 0)) return null;
    const m = Math.min(n, cur.n, ITEMS[cur.id].stack);
    const out = { ...cur, n: m };
    cur.n -= m;
    if (cur.n <= 0) tile.slots[slot] = null;
    return out;
  }

  // Insertion automatique dans la première case qui convient ; renvoie la quantité acceptée.
  insert(tile, st, viaPipe) {
    let left = st.n;
    for (let i = 0; i < tile.slots.length && left > 0; i++) {
      if (MACHINES[tile.id].slots[i] === 'out') continue;
      if (viaPipe ? !this.pipeAccepts(tile, i, st) : !this.accepts(tile, i, st)) continue;
      left = this.put(tile, i, { ...st, n: left });
    }
    return st.n - left;
  }

  // Seau contre réservoir : renvoie l'objet qui remplace le seau, ou null si rien ne se passe.
  bucket(tile, bucketId) {
    const def = tile && MACHINES[tile.id];
    if (!def?.tank) return null;
    const f = tile.f, fluid = ITEMS[bucketId]?.fluid;
    if (bucketId === I.BUCKET) {
      if (!f || f.amt < BUCKET) return null;
      f.amt -= BUCKET;
      return f.id === B.LAVA ? I.BUCKET_LAVA : I.BUCKET_WATER;
    }
    if (!fluid || (def.fluid && def.fluid !== fluid) || (f?.amt > 0 && f.id !== fluid) || (f?.amt ?? 0) + BUCKET > def.tank) return null;
    tile.f = { id: fluid, amt: (f?.amt ?? 0) + BUCKET };
    return I.BUCKET;
  }

  // ---------- Travail des machines ----------
  outRoom(tile, def, id, n) {
    return def.slots.some((kd, i) => {
      if (kd !== 'out') return false;
      const s = tile.slots[i];
      return !s || (s.id === id && plain(s) && s.n + n <= ITEMS[id].stack);
    });
  }
  addOut(tile, def, id, n) {
    let i = def.slots.findIndex((kd, j) => kd === 'out' && tile.slots[j]?.id === id && plain(tile.slots[j]) && tile.slots[j].n + n <= ITEMS[id].stack);
    if (i >= 0) { tile.slots[i].n += n; return; }
    i = def.slots.findIndex((kd, j) => kd === 'out' && !tile.slots[j]);
    if (i < 0) return;
    const st = { id, n }, it = ITEMS[id];
    if (it.tool?.dur) st.d = it.tool.dur;
    if (it.charge) st.c = 0;
    tile.slots[i] = st;
  }

  findRecipe(tile, def) {
    const have = {};
    def.slots.forEach((kd, i) => { const s = tile.slots[i]; if (kd === 'in' && s) have[s.id] = (have[s.id] ?? 0) + s.n; });
    return def.recipes.find((r) => r.ins.every(([id, n]) => (have[id] ?? 0) >= n) && this.outRoom(tile, def, r.out[0], r.out[1])) ?? null;
  }

  // Ce que la machine ferait maintenant : { time, ins, out } ou null.
  plan(tile, def) {
    if (def.fluidUse && (tile.f?.amt ?? 0) < def.fluidUse) return null;
    if (def.recipes) return this.findRecipe(tile, def);
    if (def.makes) return this.outRoom(tile, def, def.makes[0], def.makes[1]) ? { time: def.time, out: def.makes } : null;
    if (def.grower) {
      const sd = SEEDS[tile.slots[0]?.id];
      return sd && this.outRoom(tile, def, sd[0], sd[1]) ? { time: sd[2], out: [sd[0], sd[1]] } : null;
    }
    return null;
  }

  wants(tile, def) {
    if (def.slots[0] === 'charge') { const s = tile.slots[0], ch = s && ITEMS[s.id].charge; return !!ch && (s.c ?? 0) < ch.max; }
    if (def.pump) return !!tile.src && (tile.f?.amt ?? 0) < def.tank;
    if (def.beacon) return !tile.lit;
    return !!this.plan(tile, def);
  }

  // dt : temps utile (réduit si le réseau manque de courant) ; full : temps réel écoulé.
  work(tile, def, dt, full = dt) {
    if (def.slots[0] === 'charge') {
      const s = tile.slots[0], ch = s && ITEMS[s.id].charge;
      if (ch && (s.c ?? 0) < ch.max) s.c = Math.min(ch.max, (s.c ?? 0) + 25 * dt);
      return;
    }
    if (def.pump) {
      if (tile.src) tile.f = { id: tile.src, amt: Math.min(def.tank, (tile.f?.id === tile.src ? tile.f.amt : 0) + 500 * dt) };
      return;
    }
    if (def.beacon) {
      // Le phare se charge tant que le réseau tient ; à la moindre faiblesse, il perd du terrain.
      tile.max = def.beacon;
      tile.prog = Math.max(0, tile.prog + (dt >= full * 0.95 ? dt : -full));
      if (tile.prog >= def.beacon) tile.lit = true;
      return;
    }
    const p = this.plan(tile, def);
    if (!p) { tile.prog = 0; tile.max = 0; return; }
    tile.max = p.time;
    tile.prog += dt * (def.speed ?? 1);
    if (tile.prog < p.time) return;
    tile.prog = 0;
    for (const [id, n] of p.ins ?? []) {
      let left = n;
      def.slots.forEach((kd, i) => {
        const s = tile.slots[i];
        if (kd !== 'in' || !s || s.id !== id || left <= 0) return;
        const m = Math.min(left, s.n);
        s.n -= m; left -= m;
        if (s.n <= 0) tile.slots[i] = null;
      });
    }
    if (def.fluidUse) tile.f.amt -= def.fluidUse;
    this.addOut(tile, def, p.out[0], p.out[1]);
  }

  burnFuel(tile, slot) {
    const s = tile.slots[slot];
    if (!s || FUEL[s.id] == null) return false;
    tile.burn = tile.burnMax = FUEL[s.id];
    if (--s.n <= 0) tile.slots[slot] = null;
    return true;
  }

  // ---------- Réseau électrique ----------
  build(D) {
    const nets = [], seen = new Set(), leaf = new Set();
    for (const start of D.blocks.values()) {
      const sk = key(start.x, start.y, start.z);
      if (!CONDUCT.has(start.id) || seen.has(sk)) continue;
      const net = { gens: [], cons: [], bats: [], keys: [], s: 0, d: 0 };
      const stack = [start];
      seen.add(sk);
      while (stack.length) {
        const n = stack.pop(), nk = key(n.x, n.y, n.z);
        net.keys.push(nk);
        if (GEN[n.id] != null) net.gens.push({ ...n, k: nk });
        if (n.id === B.BATTERY) net.bats.push(nk);
        if (MACHINES[n.id]?.power) net.cons.push({ ...n, k: nk });
        for (let i = 0; i < 6; i++) {
          const [dx, dy, dz] = N6[i];
          const k = key(n.x + dx, n.y + dy, n.z + dz), nb = D.blocks.get(k);
          if (!nb || !this.wired(D, n, i, nb)) continue;
          if (CONDUCT.has(nb.id)) { if (!seen.has(k)) { seen.add(k); stack.push(nb); } }
          else if (DRAW[nb.id] != null && !leaf.has(k)) { leaf.add(k); net.cons.push({ ...nb, k }); net.keys.push(k); }
        }
      }
      nets.push(net);
    }
    D.nets = nets;
  }

  // Nombre de blindages qui manquent autour d'un cœur (0 : le réacteur est complet).
  coreMissing(D, c) {
    let n = 0;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      if (!dx && !dy && !dz) continue;
      if (D.blocks.get(key(c.x + dx, c.y + dy, c.z + dz))?.id !== B.CASING) n++;
    }
    return n;
  }

  // Calcule production et demande de chaque réseau, fait avancer les machines branchées.
  power(d, dt) {
    const D = this.dims[d];
    if (!D.nets) this.build(D);
    const powered = new Set();
    for (const net of D.nets) {
      let demand = 0;
      for (const c of net.cons) {
        const def = MACHINES[c.id];
        c.tile = def ? D.tiles.get(c.k) : null;
        c.w = def ? (c.tile && this.wants(c.tile, def) ? def.power : 0) : DRAW[c.id];
        demand += c.w;
      }
      let cap = 0, stored = 0;
      for (const k of net.bats) { const t = D.tiles.get(k); if (t) { cap += MACHINES[B.BATTERY].store; stored += t.e; } }

      let supply = 0;
      for (const g of net.gens) {
        if (g.id === B.TURBINE) supply += GEN[g.id];
        else if (g.id === B.SOLAR) supply += d === 0 && isDay(this.time) ? GEN[g.id] : 0;
      }
      for (const g of net.gens) {
        const t = D.tiles.get(g.k);
        if (!t) continue;
        const needed = dt > 0 && (demand > supply || stored < cap);
        if (g.id === B.GENERATOR) {
          if (t.burn <= 0 && needed) this.burnFuel(t, 0);
          if (t.burn > 0) { t.burn -= dt; supply += GEN[g.id]; }
          t.out = t.burn > 0 ? GEN[g.id] : 0;
          if (t.out) this._act?.add(g.k);
        } else if (g.id === B.LAVA_GEN) {
          if (t.burn <= 0 && needed && t.f?.id === B.LAVA && t.f.amt >= BUCKET) { t.f.amt -= BUCKET; t.burn = t.burnMax = 60; }
          if (t.burn > 0) { t.burn -= dt; supply += GEN[g.id]; }
          t.out = t.burn > 0 ? GEN[g.id] : 0;
          if (t.out) this._act?.add(g.k);
        } else if (g.id === B.CORE) {
          const miss = this.coreMissing(D, g), valid = miss === 0;
          t.miss = miss;
          if (t.burn <= 0 && valid && t.slots[0]?.id === I.ROD && dt > 0) {
            t.burn = t.burnMax = ROD_LIFE;
            if (--t.slots[0].n <= 0) t.slots[0] = null;
          }
          t.valid = valid;
          t.out = 0;
          if (t.burn > 0) {
            t.burn -= dt;
            if (valid) { supply += GEN[g.id]; t.out = GEN[g.id]; t.melt = 0; this._act?.add(g.k); }
            else if ((t.melt = (t.melt ?? 0) + dt) > 10) { this.hooks.explode(d, g.x, g.y, g.z, 6); return; } // fusion du cœur
          }
        }
      }

      let ratio = 1;
      if (dt > 0) {
        let delta = (supply - demand) * dt; // > 0 : surplus à stocker ; < 0 : manque à puiser
        if (delta < 0) {
          const need = Math.min(-delta, 200 * net.bats.length * dt);
          let got = 0;
          for (const k of net.bats) { const t = D.tiles.get(k); if (!t) continue; const m = Math.min(t.e, need - got); t.e -= m; got += m; }
          ratio = demand > 0 ? Math.min(1, (supply * dt + got) / (demand * dt)) : 1;
          stored -= got;
        } else {
          for (const k of net.bats) { const t = D.tiles.get(k); if (!t) continue; const m = Math.min(MACHINES[B.BATTERY].store - t.e, delta, 200 * dt); t.e += m; delta -= m; stored += m; }
        }
        for (const c of net.cons) if (c.tile && c.w > 0) { this.work(c.tile, MACHINES[c.id], dt * ratio, dt); if (ratio > 0.05) this._act?.add(c.k); }
      }
      net.s = supply; net.d = demand;
      const info = { s: Math.round(supply), d: demand, r: Math.round(ratio * 100) };
      for (const c of net.cons) if (c.tile) c.tile.net = info;
      for (const g of net.gens) { const t = D.tiles.get(g.k); if (t) t.net = info; }
      for (const k of net.bats) { const t = D.tiles.get(k); if (t) t.net = info; }
      if (supply > 0 || stored > 0.5) for (const k of net.keys) powered.add(k);
    }

    let same = powered.size === D.powered.size;
    if (same) for (const k of powered) if (!D.powered.has(k)) { same = false; break; }
    if (!same) { D.powered = powered; this.hooks.power(d); }
  }

  // ---------- Tuyaux ----------
  // Un réseau = des tuyaux qui se touchent, et les conteneurs collés dessus (avec la face concernée).
  buildPipes(D) {
    const out = { [B.ITEM_PIPE]: [], [B.FLUID_PIPE]: [] };
    const seen = new Set();
    for (const start of D.blocks.values()) {
      const sk = key(start.x, start.y, start.z);
      if (out[start.id] === undefined || seen.has(sk)) continue;
      const net = { atts: [], turn: 0 }, got = new Set(), stack = [start];
      seen.add(sk);
      while (stack.length) {
        const n = stack.pop();
        N6.forEach(([dx, dy, dz], i) => {
          const x = n.x + dx, y = n.y + dy, z = n.z + dz, k = key(x, y, z), nb = D.blocks.get(k);
          if (!nb) return;
          const pk = key(n.x, n.y, n.z);
          if (sideOf(D.vis.get(pk), i) === 0) return; // débranché de ce côté
          if (nb.id === start.id) { if (!seen.has(k) && sideOf(D.vis.get(k), i ^ 1) !== 0) { seen.add(k); stack.push(nb); } }
          else if (MACHINES[nb.id] && !got.has(k + '|' + pk)) { got.add(k + '|' + pk); net.atts.push({ k, x, y, z, pk, side: i }); }
        });
      }
      out[start.id].push(net);
    }
    D.pipes = out;
  }

  firstOut(tile) {
    const kinds = MACHINES[tile.id].slots;
    const i = kinds.findIndex((kd, j) => (kd === 'out' || kd === 'any') && tile.slots[j]);
    return i < 0 ? null : { slot: i, st: tile.slots[i] };
  }

  moveFluid(src, dst, max) {
    const def = MACHINES[dst.id], f = src.f;
    if (!def?.tank || !f || f.amt <= 0 || src === dst) return 0;
    if ((def.fluid && def.fluid !== f.id) || (dst.f?.amt > 0 && dst.f.id !== f.id)) return 0;
    const m = Math.min(f.amt, max, def.tank - (dst.f?.amt ?? 0));
    if (m <= 0) return 0;
    dst.f = { id: f.id, amt: (dst.f?.amt ?? 0) + m };
    f.amt -= m;
    return m;
  }

  // Une fois par seconde : chaque source envoie un lot vers la première destination preneuse.
  logistics(d) {
    const D = this.dims[d];
    if (!D.pipes) this.buildPipes(D);
    for (const net of D.pipes[B.ITEM_PIPE]) {
      const ends = net.atts.map((a) => ({ a, tile: D.tiles.get(a.k) })).filter((e) => e.tile && !MACHINES[e.tile.id].terminal);
      const dests = ends.filter((e) => this.canPush(D, e.a));
      if (!dests.length) continue;
      net.turn++;
      for (const src of ends) {
        if (!this.canPull(D, src.a, src.tile, false)) continue;
        const first = this.firstOut(src.tile);
        if (!first) continue;
        const batch = { ...first.st, n: Math.min(8, first.st.n) };
        for (let j = 0; j < dests.length; j++) {
          const dst = dests[(j + net.turn) % dests.length];
          if (dst.tile === src.tile) continue;
          const moved = this.insert(dst.tile, batch, true);
          if (moved > 0) { this.take(src.tile, first.slot, moved); break; }
        }
      }
    }
    for (const net of D.pipes[B.FLUID_PIPE]) {
      const ends = net.atts.map((a) => ({ a, tile: D.tiles.get(a.k) })).filter((e) => e.tile && MACHINES[e.tile.id].tank);
      for (const src of ends) {
        if (!this.canPull(D, src.a, src.tile, true) || !(src.tile.f?.amt > 0)) continue;
        // Le débit est partagé entre les destinations, chacune à son tour en premier.
        const dsts = ends.filter((e) => e.tile !== src.tile && this.canPush(D, e.a));
        let budget = 1000;
        net.turn++;
        for (let j = 0; j < dsts.length && budget > 0; j++) {
          const dst = dsts[(j + net.turn) % dsts.length];
          budget -= this.moveFluid(src.tile, dst.tile, Math.min(budget, Math.ceil(1000 / dsts.length)));
        }
      }
    }
    // Une pompe remplit aussi directement ce qui est collé à elle.
    for (const b of D.blocks.values()) {
      if (b.id !== B.PUMP) continue;
      const src = D.tiles.get(key(b.x, b.y, b.z));
      if (!(src?.f?.amt > 0)) continue;
      for (const [dx, dy, dz] of N6) { const dst = D.tiles.get(key(b.x + dx, b.y + dy, b.z + dz)); if (dst) this.moveFluid(src, dst, 1000); }
    }
  }

  // ---------- Terminal de stockage ----------
  termStores(d, x, y, z) {
    const D = this.dims[d], k = key(x, y, z);
    if (!D.pipes) this.buildPipes(D);
    const net = D.pipes[B.ITEM_PIPE].find((n) => n.atts.some((a) => a.k === k));
    if (!net) return [];
    const seen = new Set(), out = [];
    for (const a of net.atts) {
      const t = D.tiles.get(a.k);
      if (!t || seen.has(a.k) || (t.id !== B.CHEST && t.id !== B.DRAWER)) continue;
      seen.add(a.k);
      out.push(t);
    }
    return out.sort((p, q) => (q.id === B.DRAWER) - (p.id === B.DRAWER)); // les tiroirs d'abord
  }
  termItems(d, x, y, z) {
    const total = new Map();
    for (const t of this.termStores(d, x, y, z)) for (const s of t.slots) if (s && plain(s)) total.set(s.id, (total.get(s.id) ?? 0) + s.n);
    return [...total].sort((a, b) => b[1] - a[1]);
  }
  termTake(d, x, y, z, id, n) {
    if (!ITEMS[id]) return null;
    let left = Math.min(n, ITEMS[id].stack), got = 0;
    for (const t of this.termStores(d, x, y, z)) {
      for (let i = 0; i < t.slots.length && left > 0; i++) {
        const s = t.slots[i];
        if (!s || s.id !== id || !plain(s)) continue;
        const m = Math.min(left, s.n);
        s.n -= m; left -= m; got += m;
        if (s.n <= 0) t.slots[i] = null;
      }
    }
    return got > 0 ? { id, n: got } : null;
  }
  termPut(d, x, y, z, st) {
    let left = st.n;
    for (const t of this.termStores(d, x, y, z)) { if (left <= 0) break; left -= this.insert(t, { ...st, n: left }, false); }
    return left;
  }

  tick(dt, time) {
    this.time = time;
    for (let d = 0; d < 2; d++) {
      const D = this.dims[d];
      // Fours à combustible : indépendants du réseau.
      const act = this._act = new Set();
      for (const [k, t] of D.tiles) {
        if (t.id !== B.FURNACE) continue;
        const def = MACHINES[t.id], r = this.findRecipe(t, def);
        if (r && t.burn <= 0) this.burnFuel(t, 1);
        if (t.burn > 0) { t.burn -= dt; act.add(k); if (r) this.work(t, def, dt); else t.prog = 0; }
        else if (t.prog > 0) t.prog = Math.max(0, t.prog - dt * 2);
      }
      this.power(d, dt);
      this._act = null;
      let same = act.size === D.active.size;
      if (same) for (const k of act) if (!D.active.has(k)) { same = false; break; }
      if (!same) { D.active = act; this.hooks.active?.(d); }
      if ((D.logi += dt) >= 1) { D.logi -= 1; this.logistics(d); this.grow(d); }
      // État visible recalculé : niveau des réservoirs, phare allumé.
      for (const [k, t] of D.tiles) {
        if (t.id === B.TANK) {
          const amt = t.f?.amt ?? 0, lvl = amt > 0 ? Math.max(1, Math.round((amt / MACHINES[B.TANK].tank) * 8)) : 0;
          this.setVis(d, k, ((D.vis.get(k) ?? 0) & 131) | (lvl << 2) | (amt > 0 && t.f.id === B.LAVA ? 64 : 0), false);
        } else if (t.id === B.LIGHTHOUSE) this.setVis(d, k, ((D.vis.get(k) ?? 0) & 3) | (t.lit ? 128 : 0), false);
      }
    }
  }

  // Cultures : chaque seconde, une pousse a une chance de passer au stade suivant. Sans terre labourée dessous, elle meurt.
  grow(d) {
    const D = this.dims[d];
    for (const b of [...D.blocks.values()]) {
      const g = GROW[b.id];
      if (!g) continue;
      if (D.blocks.get(key(b.x, b.y - 1, b.z))?.id !== B.FARMLAND) { const [id, n] = BLOCKS[b.id].drop; this.hooks.setBlock?.(d, b.x, b.y, b.z, 0); this.hooks.drop(d, b.x, b.y, b.z, { id, n }); }
      else if (Math.random() < 1 / g[1]) this.hooks.setBlock?.(d, b.x, b.y, b.z, g[0]);
    }
  }
}
