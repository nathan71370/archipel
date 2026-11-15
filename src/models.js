// Modèles en volume des machines : chaque bloc est un assemblage de pavés au lieu d'un cube plein.
// Ici la partie fixe (fondue dans le maillage du terrain) ; les pièces mobiles sont dans modelview.js.
// Unités : seizièmes de bloc. Un pavé = [x0, y0, z0, x1, y1, z1, tuile, lueur, tuileAllumée]
//   tuile : numéro, ou { t, s, b } pour dessus / côtés / dessous
//   lueur : 0 non, 1 toujours, 2 seulement quand le bloc est alimenté
import { T } from './textures.js';
import { B } from './items.js';
import { connects } from './sim.js';

const FC = [
  { d: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]] },
  { d: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
  { d: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
  { d: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { d: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },
  { d: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]] },
];
export const MODEL_DIRS = FC.map((f) => f.d);

// Découpe des pavés en faces prêtes à dessiner : coins (en blocs), coordonnées de texture (0 à 1 dans la tuile).
// La texture est projetée : un pavé de 4 pixels de large montre 4 pixels de la tuile.
export function quadsOf(boxes) {
  const out = [];
  for (const b of boxes) {
    const lo = [b[0] / 16, b[1] / 16, b[2] / 16], hi = [b[3] / 16, b[4] / 16, b[5] / 16];
    const tile = b[6], glow = b[7] ?? 0, on = b[8] ?? null;
    const org = lo.map(Math.floor);
    for (let fi = 0; fi < 6; fi++) {
      const f = FC[fi], P = [], U = [];
      for (const cn of f.c) {
        const p = [cn[0] ? hi[0] : lo[0], cn[1] ? hi[1] : lo[1], cn[2] ? hi[2] : lo[2]];
        const q = p.map((v, a) => Math.min(1, v - org[a]));
        P.push(p);
        U.push(f.d[0] ? [q[2], q[1]] : f.d[1] ? [q[0], q[2]] : [q[0], q[1]]);
      }
      const axis = f.d[0] ? 0 : f.d[1] ? 1 : 2, at = P[0][axis];
      const pick = (t) => (typeof t === 'number' ? t : fi === 2 ? t.t ?? t.s : fi === 3 ? t.b ?? t.t ?? t.s : t.s);
      out.push({ fi, P, U, tile: pick(tile), on: on == null ? null : pick(on), glow, edge: at === (f.d[axis] > 0 ? 1 : 0) });
    }
  }
  return out;
}

// Quart de tour autour de l'axe vertical du bloc (même sens que rotation.y de Three.js).
const TURN = [5, 4, 2, 3, 0, 1];
function turned(quads) {
  return quads.map((q) => ({ ...q, fi: TURN[q.fi], P: q.P.map((p) => [p[2], p[1], 1 - p[0]]) }));
}

// MODEL[id] = { rq: faces pour chacune des 4 orientations } ou { dyn(masque des 6 voisins reliés, décor), connects(idVoisin) }
// anim : a des pièces mobiles. L'avant d'un modèle est du côté z = 0.
export const MODEL = new Array(256).fill(null);
const def = (id, boxes, extra = {}) => {
  const rq = [quadsOf(boxes)];
  for (let r = 1; r < 4; r++) rq.push(turned(rq[r - 1]));
  MODEL[id] = { quads: rq[0], rq, ...extra };
};

const M = T.MACHINE, D = T.M_DARK, S = T.M_STEEL, C = T.M_COPPER, K = T.M_BLACK, W = T.M_WHITE, G = T.M_GOLD;
// Quatre pavés identiques aux quatre coins.
const corners = (x0, y0, x1, y1, tile) => [[x0, y0, x0, x1, y1, x1, tile], [16 - x1, y0, x0, 16 - x0, y1, x1, tile], [x0, y0, 16 - x1, x1, y1, 16 - x0, tile], [16 - x1, y0, 16 - x1, 16 - x0, y1, 16 - x0, tile]];
// Cadre horizontal (quatre poutres) entre y0 et y1, d'épaisseur w.
const ring = (y0, y1, w, tile, m = 0) => [[m, y0, m, 16 - m, y1, m + w, tile], [m, y0, 16 - m - w, 16 - m, y1, 16 - m, tile], [m, y0, m + w, m + w, y1, 16 - m - w, tile], [16 - m - w, y0, m + w, 16 - m, y1, 16 - m - w, tile]];

def(B.BENCH, [
  [0, 12, 0, 16, 16, 16, { t: T.BENCH_TOP, s: T.BENCH_SIDE, b: T.PLANKS }],
  ...corners(1, 0, 4, 12, T.LOG_SIDE),
  [2, 4, 2, 14, 5, 14, T.PLANKS],
  [10, 16, 3, 12, 17, 9, S], [9, 16, 8, 13, 17, 10, T.LOG_SIDE], // un marteau posé dessus
]);
def(B.FURNACE, [
  [0, 0, 0, 16, 3, 16, T.STONE_BRICK],
  ...corners(0, 3, 5, 10, T.STONE),
  [0, 3, 5, 3, 10, 11, T.STONE], [13, 3, 5, 16, 10, 11, T.STONE], [5, 3, 13, 11, 10, 16, T.STONE], // la gueule reste ouverte à l'avant
  [3, 3, 3, 13, 10, 13, K],
  [0, 10, 0, 16, 13, 16, { t: T.FURNACE_TOP, s: T.STONE_BRICK }],
  [5, 13, 5, 11, 16, 11, D], [6, 16, 6, 10, 16.5, 10, K],
], { anim: true });
def(B.E_FURNACE, [
  [0, 0, 0, 16, 2, 16, D],
  [1, 2, 1, 15, 13, 15, { t: M, s: T.EFURNACE }],
  ...corners(0, 2, 2, 13, S),
  [0, 13, 0, 16, 14, 16, D],
  [3, 14, 3, 13, 15, 13, T.M_GRILL],
], { anim: true });
def(B.GENERATOR, [
  [0, 0, 0, 16, 3, 16, D],
  [1, 3, 1, 11, 12, 15, { t: M, s: T.GENERATOR }],
  [2, 12, 3, 10, 13, 13, T.M_GRILL],
  [12, 3, 2, 15, 16, 5, D], [11.5, 14, 1.5, 15.5, 15, 5.5, S], // cheminée
  [11, 3, 11, 15, 9, 15, C], // réservoir
], { anim: true });
def(B.TURBINE, [
  [3, 0, 3, 13, 2, 13, D], [5, 2, 5, 11, 4, 11, S],
  [6.5, 4, 6.5, 9.5, 22, 9.5, W],
  [5.5, 20, 4, 10.5, 25, 13, { t: T.TURBINE_TOP, s: W }],
  [6.5, 21, 13, 9.5, 24, 15, D],
], { anim: true });
def(B.SOLAR, [
  [4, 0, 4, 12, 1, 12, D], [7, 1, 7, 9, 8, 9, S], [6, 8, 6, 10, 9, 10, D],
], { anim: true });
def(B.LAVA_GEN, [
  [0, 0, 0, 16, 4, 16, { t: D, s: T.LAVAGEN }],
  ...corners(1, 4, 3, 13, S),
  [5.5, 4, 5.5, 10.5, 13, 10.5, T.BASALT],
  [0, 13, 0, 16, 16, 16, { t: M, s: T.LAVAGEN, b: D }],
], { anim: true });
def(B.BATTERY, [
  [1, 0, 1, 15, 2, 15, D],
  [2, 2, 2, 14, 13, 14, { t: D, s: T.BATTERY }],
  [3, 13, 3, 7, 16, 7, C], [9, 13, 9, 13, 16, 13, S],
  ...corners(1, 2, 3, 12, K),
], { anim: true });
def(B.CNC, [
  [0, 0, 0, 16, 5, 16, { t: D, s: T.CNC }],
  [2, 5, 2, 14, 6, 14, S],
  [0, 5, 6, 2, 14, 10, D], [14, 5, 6, 16, 14, 10, D],
  [0, 13, 6.5, 16, 15, 9.5, S],
], { anim: true });
def(B.PRINTER, [
  [0, 0, 0, 16, 4, 16, { t: K, s: T.PRINTER }],
  ...corners(0.5, 4, 2, 14, S),
  ...ring(14, 16, 2, D),
], { anim: true });
def(B.CHARGER, [
  [1, 0, 1, 15, 6, 15, { t: D, s: T.CHARGER }],
  [3, 6, 3, 13, 7, 13, K],
  [1, 6, 6, 3, 14, 10, C], [13, 6, 6, 15, 14, 10, C],
  [1, 13, 6.5, 4, 15, 9.5, S], [12, 13, 6.5, 15, 15, 9.5, S],
], { anim: true });
def(B.TANK, [
  [1, 0, 1, 15, 2, 15, D],
  ...corners(1, 2, 3, 14, S),
  ...ring(7.5, 8.5, 1, D, 1),
  [1, 14, 1, 15, 16, 15, D], [6, 16, 6, 10, 16.5, 10, S],
], { anim: true }); // le liquide, visible entre les montants, est une pièce mobile
def(B.PUMP, [
  [2, 0, 2, 14, 4, 14, { t: D, s: T.PUMP }],
  [6, -1, 6, 10, 0, 10, C],
  [4, 4, 4, 12, 12, 12, S], [3, 6, 3, 13, 7, 13, D], [3, 10, 3, 13, 11, 13, D],
  [12, 6, 6, 16, 10, 10, C], [0, 6, 6, 4, 10, 10, C],
  [5, 12, 5, 11, 13, 11, D],
], { anim: true });
def(B.STONER, [
  [0, 0, 0, 16, 6, 16, { t: D, s: T.STONER }],
  [1, 6, 4, 6, 14, 12, T.WATER], [0.5, 14, 3.5, 6.5, 15, 12.5, S],
  [10, 6, 4, 15, 14, 12, T.LAVA, 1], [9.5, 14, 3.5, 15.5, 15, 12.5, S],
  [6, 6, 1, 10, 7, 15, S],
  [6.5, 7, 1, 9.5, 16, 3, D], [6.5, 7, 13, 9.5, 16, 15, D], [6.5, 14, 3, 9.5, 16, 13, D],
], { anim: true });
def(B.GROWER, [
  [1, 0, 1, 15, 6, 15, { t: D, s: T.GROWER }],
  [2, 6, 2, 14, 7, 14, T.DIRT],
  ...corners(1, 6, 2, 15, S),
  [1, 15, 1, 15, 16, 15, D],
], { anim: true });
def(B.WASHER, [
  [0, 0, 0, 16, 4, 16, { t: D, s: T.WASHER }],
  [0, 4, 0, 2, 14, 16, D], [14, 4, 0, 16, 14, 16, D],
  [0, 14, 5, 16, 16, 11, S],
  [2, 4, 2, 14, 5, 14, T.WATER],
], { anim: true });
def(B.FAN, [
  [1, 0, 1, 15, 4, 15, { t: T.FAN_TOP, s: M, b: D }],
  ...corners(1, 4, 2, 11, S),
  ...ring(11, 12, 1, S, 1),
  [7, 4, 7, 9, 8, 9, D],
], { anim: true });
def(B.TURRET, [
  [2, 0, 2, 14, 5, 14, { t: D, s: M }],
  [5, 5, 5, 11, 6, 11, S], [6.5, 6, 6.5, 9.5, 9, 9.5, D],
], { anim: true });
def(B.LAMP, [
  [5, 0, 5, 11, 2, 11, D], [7, 2, 7, 9, 6, 9, S],
  [4, 6, 4, 12, 14, 12, T.LAMP_OFF, 2, T.LAMP_ON],
  [5, 14, 5, 11, 15, 11, D],
]);
def(B.LANTERN, [
  [5, 0, 5, 11, 1, 11, D],
  [5.5, 1, 5.5, 10.5, 9, 10.5, T.LANTERN, 1],
  ...[[5, 5], [10, 5], [5, 10], [10, 10]].map(([x, z]) => [x, 1, z, x + 1, 9, z + 1, D]),
  [4, 9, 4, 12, 11, 12, D], [7, 11, 7, 9, 13, 9, S],
]);
def(B.CHEST, [
  [1, 0, 1, 15, 10, 15, { t: K, s: T.CHEST_SIDE, b: T.CHEST_TOP }],
  [7, 7, 0, 9, 10, 1, G],
  [0.5, 0, 0.5, 15.5, 1, 15.5, T.LOG_SIDE],
], { anim: true }); // le couvercle est une pièce mobile
def(B.DRAWER, [
  [0, 0, 0, 16, 1, 16, T.LOG_SIDE], [0, 15, 0, 16, 16, 16, T.LOG_SIDE],
  [1, 1, 1, 15, 15, 15, { t: T.PLANKS, s: T.DRAWER }],
  [6, 7, 0, 10, 9, 1, G],
]);
def(B.TERMINAL, [
  [1, 0, 1, 15, 3, 15, D],
  [3, 3, 3, 13, 13, 13, { t: K, s: T.TERMINAL }],
  ...corners(2, 3, 3.5, 13, S),
  [2, 13, 2, 14, 14, 14, D], [7.5, 14, 7.5, 8.5, 17, 8.5, S],
], { anim: true });
def(B.ALTAR, [
  [1, 0, 1, 15, 3, 15, T.SLATE], [4, 3, 4, 12, 9, 12, T.SLATE],
  [1, 9, 1, 15, 12, 15, { t: T.ALTAR_TOP, s: T.ALTAR_SIDE, b: T.SLATE }],
  ...corners(1, 12, 3, 15, T.CRYSTAL).map((b) => [...b, 1]),
], { anim: true });

def(B.FORGE, [
  [0, 0, 0, 16, 3, 16, D],
  [1, 3, 1, 15, 12, 15, { t: K, s: T.FORGE }],
  ...corners(0, 3, 3, 14, C),
  ...ring(12, 14, 3, D),
  [3, 12, 3, 13, 13, 13, K],
], { anim: true });
def(B.CONDENSER, [
  [1, 0, 1, 15, 4, 15, { t: D, s: T.CONDENSER }],
  [6.5, 4, 6.5, 9.5, 15, 9.5, S],
  ...ring(6, 7.5, 2, C, 3), ...ring(10, 11.5, 2, C, 4),
  [5.5, 15, 5.5, 10.5, 16, 10.5, D],
], { anim: true });
// Le phare dépasse largement de son bloc, comme l'éolienne.
def(B.LIGHTHOUSE, [
  [1, 0, 1, 15, 3, 15, D],
  [3, 3, 3, 13, 9, 13, W], [4, 9, 4, 12, 15, 12, T.M_RED], [5, 15, 5, 11, 21, 11, W],
  [3, 21, 3, 13, 22, 13, D],
  ...[[4, 4], [11, 4], [4, 11], [11, 11]].map(([x, z]) => [x, 22, z, x + 1, 28, z + 1, D]),
  [3, 28, 3, 13, 29, 13, D], [6, 29, 6, 10, 31, 10, G],
], { anim: true });
def(B.FARMLAND, [[0, 0, 0, 16, 15, 16, { t: T.FARMLAND, s: T.DIRT, b: T.DIRT }]]);
def(B.CROP1, [[3, -1, 7.5, 13, 4, 8.5, T.CROP], [7.5, -1, 3, 8.5, 4, 13, T.CROP]]);
def(B.CROP2, [[2, -1, 4.5, 14, 9, 5.5, T.CROP], [2, -1, 10.5, 14, 9, 11.5, T.CROP], [4.5, -1, 2, 5.5, 9, 14, T.CROP], [10.5, -1, 2, 11.5, 9, 14, T.CROP]]);
def(B.CROP3, [
  [2, -1, 4.5, 14, 9, 5.5, T.CROP], [2, -1, 10.5, 14, 9, 11.5, T.CROP], [4.5, -1, 2, 5.5, 9, 14, T.CROP], [10.5, -1, 2, 11.5, 9, 14, T.CROP],
  [2, 9, 4, 14, 14, 6, T.CROP_RIPE], [2, 9, 10, 14, 14, 12, T.CROP_RIPE], [4, 9, 2, 6, 14, 14, T.CROP_RIPE], [10, 9, 2, 12, 14, 14, T.CROP_RIPE],
]);
import { ORE_CROPS } from './items.js';
def(B.COMPRESSOR, [
  [0, 0, 0, 16, 4, 16, D], [2, 4, 2, 14, 6, 14, S],
  ...corners(1, 4, 3, 15, S),
  [0, 14, 0, 16, 16, 16, { t: M, s: D, b: D }],
  [5, 6, 5, 11, 7, 11, K],
], { anim: true });
def(B.REFINERY, [
  [0, 0, 0, 16, 3, 16, D],
  [1, 3, 1, 9, 11, 15, { t: M, s: T.LAVAGEN }],
  [10.5, 3, 3, 14.5, 20, 7, C], [10, 8, 2.5, 15, 9, 7.5, D], [10, 14, 2.5, 15, 15, 7.5, D], // colonne de distillation
  [10.5, 3, 10, 14.5, 9, 14, S],
  [9, 6, 11.5, 10.5, 7.5, 12.5, C], [9, 12, 4.5, 10.5, 13, 5.5, C],
], { anim: true });
def(B.ELECTRO, [
  [0, 0, 0, 16, 4, 16, D],
  [2, 4, 2, 7, 14, 7, T.M_GLASS], [9, 4, 9, 14, 14, 14, T.M_GLASS],
  [1.5, 14, 1.5, 7.5, 15, 7.5, S], [8.5, 14, 8.5, 14.5, 15, 14.5, S],
  [4, 15, 4, 5, 16, 12, C], [4, 15, 11, 12, 16, 12, C],
  [9, 4, 2, 14, 8, 7, { t: D, s: M }],
], { anim: true });
// La fusée dépasse de deux blocs au-dessus du sien.
def(B.ROCKET, [
  ...corners(1, 0, 4, 6, D),
  [5, 0, 5, 11, 3, 11, K], [4, 3, 4, 12, 30, 12, W],
  [3.5, 12, 3.5, 12.5, 14, 12.5, T.M_RED], [3.5, 24, 3.5, 12.5, 25, 12.5, T.M_RED],
  [6, 18, 3.5, 10, 22, 4, T.M_CYAN, 1],
  [5, 30, 5, 11, 35, 11, T.M_RED], [6.5, 35, 6.5, 9.5, 39, 9.5, T.M_RED], [7.5, 39, 7.5, 8.5, 42, 8.5, S],
  [1, 3, 7, 4, 12, 9, T.M_RED], [12, 3, 7, 15, 12, 9, T.M_RED], [7, 3, 1, 9, 12, 4, T.M_RED], [7, 3, 12, 9, 12, 15, T.M_RED],
]);
def(B.MODBENCH, [
  [0, 0, 0, 16, 2, 16, D], ...corners(1, 2, 3, 10, S),
  [0, 10, 0, 16, 12, 16, { t: K, s: D, b: D }],
  [2, 12, 2, 8, 12.5, 8, T.M_CYAN, 1],
  [12, 12, 11, 14, 19, 13, S], [6, 18, 11, 14, 19.5, 13, S], [6, 15, 11.5, 7, 18, 12.5, D],
]);
def(B.ALLOY, [
  [0, 0, 0, 16, 3, 16, D],
  [1, 3, 1, 15, 10, 15, { t: K, s: T.FURNACE_SIDE }],
  ...corners(0, 3, 2, 10, S),
  [1, 10, 1, 7, 15, 7, C], [9, 10, 9, 15, 15, 15, S], // deux trémies, une par matière
  [2, 15, 2, 6, 15.5, 6, K], [10, 15, 10, 14, 15.5, 14, K],
  [9, 10, 2, 14, 12, 7, D],
], { anim: true });
def(B.CANNER, [
  [0, 0, 0, 16, 4, 16, D],
  [1, 4, 1, 15, 5, 15, T.M_GRILL],
  [0, 4, 6, 2, 15, 10, S], [14, 4, 6, 16, 15, 10, S], [0, 14, 6.5, 16, 16, 9.5, S],
  [6, 10, 6.5, 10, 14, 9.5, C],
], { anim: true });
def(B.TORCH, [[7, 0, 7, 9, 10, 9, T.LOG_SIDE], [6.5, 10, 6.5, 9.5, 13, 9.5, T.M_HOT, 1]]);
def(B.HAMMOCK, [
  [1, 0, 7, 3, 12, 9, T.LOG_SIDE], [13, 0, 7, 15, 12, 9, T.LOG_SIDE],
  [0, 0, 6, 4, 1, 10, T.LOG_SIDE], [12, 0, 6, 16, 1, 10, T.LOG_SIDE],
  [3, 6, 4, 13, 7, 12, T.M_RED], [3, 7, 4, 4, 9, 12, T.M_RED], [12, 7, 4, 13, 9, 12, T.M_RED],
  [4.5, 7, 5.5, 7, 8, 10.5, T.M_WHITE],
]);
ORE_CROPS.forEach(([, , tile], k) => {
  const glow = tile === T.CRYSTAL || tile === T.EMBER || tile === T.URANITE ? 1 : 0;
  def(B.ORE_CROP + k * 2, [[7, -1, 7, 9, 5, 9, T.CROP], [5, 2, 7.5, 11, 3, 8.5, T.CROP], [6.5, 5, 6.5, 9.5, 7, 9.5, tile, glow]]);
  def(B.ORE_CROP + k * 2 + 1, [
    [7, -1, 7, 9, 10, 9, T.CROP], [3, 4, 7.5, 13, 5, 8.5, T.CROP], [7.5, 7, 3, 8.5, 8, 13, T.CROP],
    [5.5, 10, 5.5, 10.5, 15, 10.5, tile, glow], [1.5, 5, 6, 5.5, 9, 10, tile, glow], [10.5, 5, 6, 14.5, 9, 10, tile, glow], [6, 8, 1.5, 10, 12, 5.5, tile, glow],
  ]);
});

// Câbles et tuyaux : un nœud central, et un bras vers chaque voisin auquel ils se raccordent.
// décor : 2 bits par côté, pour les bras qui vont vers une machine —
//   1 pousse (pointe orange tournée vers la machine), 2 tire (pointe bleue tournée vers le tuyau), 3 automatique (simple bague).
function along(i, d0, d1, w, tile) {
  const b = [8 - w, 8 - w, 8 - w, 8 + w, 8 + w, 8 + w], a = i >> 1;
  if (i & 1) { b[a] = d0; b[a + 3] = d1; } else { b[a] = 16 - d1; b[a + 3] = 16 - d0; }
  return [...b, tile];
}
function linked(id, tile, onTile, core, arm) {
  const a = 8 - core, b = 8 + core, c = 8 - arm, d = 8 + arm;
  const arms = [[b, c, c, 16, d, d], [0, c, c, a, d, d], [c, b, c, d, 16, d], [c, 0, c, d, a, d], [c, c, b, d, d, 16], [c, c, 0, d, d, a]];
  const cache = new Map();
  MODEL[id] = {
    connects: (nb) => connects(id, nb),
    dyn: (mask, deco = 0) => {
      const key = mask | (deco << 6);
      let q = cache.get(key);
      if (q) return q;
      const boxes = [[a, a, a, b, b, b, tile, 0, onTile], ...arms.filter((_, i) => mask & (1 << i)).map((x) => [...x, tile, 0, onTile])];
      for (let i = 0; i < 6; i++) {
        const m = (deco >> (i * 2)) & 3;
        if (!(mask & (1 << i)) || !m) continue;
        if (m === 3) boxes.push(along(i, 0, 1, arm + 0.8, T.M_STEEL));
        else {
          // Trois anneaux de plus en plus étroits : la pointe indique le sens du transport.
          const sizes = m === 1 ? [0.45, 1.0, 1.55] : [1.55, 1.0, 0.45];
          sizes.forEach((g, n) => boxes.push(along(i, 0.2 + n * 1.3, 1.5 + n * 1.3, arm + g, m === 1 ? T.M_ORANGE : T.M_BLUE)));
        }
      }
      cache.set(key, (q = quadsOf(boxes)));
      return q;
    },
  };
}
linked(B.CABLE, T.CABLE, T.CABLE_ON, 2, 1.5);
linked(B.ITEM_PIPE, T.ITEM_PIPE, null, 3, 2.25);
linked(B.FLUID_PIPE, T.FLUID_PIPE, null, 3, 2.25);

// Boîte (en seizièmes) du bras d'un tuyau du côté i : sert à savoir quel raccord vise le joueur.
export function armBox(id, i) {
  const core = id === B.CABLE ? 2 : 3, w = (id === B.CABLE ? 1.5 : 2.25) + 1.6;
  return along(i, 0, 8 - core, w, 0).slice(0, 6).map((v) => v / 16);
}

// Faces d'un modèle hors du monde (objet tenu, objet au sol) : un tuyau y est montré comme un tronçon droit.
export const itemQuads = (id) => { const m = MODEL[id]; return m ? (m.dyn ? m.dyn(3) : m.quads) : null; };
