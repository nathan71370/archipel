// Pièces mobiles des machines : rotors, pistons, flammes, têtes d'outil.
// La partie fixe de chaque modèle est dans le maillage du terrain (models.js) ; ici, seulement ce qui bouge ou s'allume.
import * as THREE from 'three';
import { quadGeometry, posKey } from './world.js';
import { quadsOf } from './models.js';
import { T } from './textures.js';
import { B } from './items.js';

const U = 1 / 16;
const GEO = new Map();
// Pavé centré sur lui-même (dimensions en seizièmes), texturé comme les modèles fixes.
function geo(w, h, d, tile, glow) {
  const key = `${w}|${h}|${d}|${typeof tile === 'number' ? tile : JSON.stringify(tile)}|${glow ? 1 : 0}`;
  let g = GEO.get(key);
  if (!g) GEO.set(key, (g = quadGeometry(quadsOf([[0, 0, 0, w, h, d, tile, glow ? 1 : 0]]), 1, w / 32, h / 32, d / 32)));
  return g;
}
const SMOKE_GEO = new THREE.BoxGeometry(0.16, 0.16, 0.16);
const frac = (v) => v - Math.floor(v);

// Outils donnés à chaque modèle pour se construire.
class Kit {
  constructor(root, mat, glowMat) { this.root = root; this.mat = mat; this.glowMat = glowMat; this.smokes = []; }
  lit(w, h, d, tile, x, y, z, parent = this.root) {
    const m = new THREE.Mesh(geo(w, h, d, tile, false), this.mat);
    m.position.set(x * U, y * U, z * U);
    m.castShadow = true;
    parent.add(m);
    return m;
  }
  glow(w, h, d, tile, x, y, z, parent = this.root) {
    const m = new THREE.Mesh(geo(w, h, d, tile, true), this.glowMat);
    m.position.set(x * U, y * U, z * U);
    m.visible = false;
    parent.add(m);
    return m;
  }
  pivot(x, y, z, parent = this.root) {
    const g = new THREE.Group();
    g.position.set(x * U, y * U, z * U);
    parent.add(g);
    return g;
  }
  // Trois volutes de fumée qui montent depuis ce point quand la machine tourne.
  smoke(x, y, z) {
    const puffs = [0, 1, 2].map((i) => {
      const m = new THREE.Mesh(SMOKE_GEO, new THREE.MeshBasicMaterial({ color: 0x6a6672, transparent: true, opacity: 0, depthWrite: false }));
      m.userData.off = i / 3;
      this.root.add(m);
      this.smokes.push(m.material);
      return m;
    });
    return (s) => {
      for (const m of puffs) {
        const f = frac(s.t * 0.45 + m.userData.off);
        m.visible = s.lv > 0.03;
        m.position.set(x * U + Math.sin((f + m.userData.off) * 9) * 0.06, y * U + f * 1.3, z * U + Math.cos((f + m.userData.off) * 7) * 0.06);
        m.scale.setScalar(0.6 + f * 1.4);
        m.material.opacity = (1 - f) * 0.5 * s.lv;
      }
    };
  }
}

// Chaque constructeur renvoie { update(s), drive, sound }.
//   drive : ce qui met la machine en mouvement — 'act' (elle travaille), 'on' (elle est alimentée), 'always'
//   sound : 'fire', 'hum' ou 'rotor' (bruit de fond selon la distance)
//   s = { t, dt, on, act, lv (0 à 1, lissé), ph (temps cumulé de marche), sunTilt, v (état visible du bloc) }
const flick = (m, s, k = 17) => { m.visible = s.lv > 0.04; if (m.visible) m.scale.y = 0.82 + 0.18 * Math.sin(s.t * k + m.position.x * 40) * Math.sin(s.t * 7.3); };
const BUILD = {
  [B.FURNACE]: (k) => {
    const fire = k.glow(11, 6.4, 11, T.M_HOT, 8, 6.2, 8), top = k.glow(3.6, 0.4, 3.6, T.M_HOT, 8, 16.4, 8), smoke = k.smoke(8, 17, 8);
    return { sound: 'fire', update: (s) => { flick(fire, s); top.visible = fire.visible; smoke(s); } };
  },
  [B.E_FURNACE]: (k) => {
    const hot = [k.glow(6, 3, 0.3, T.M_HOT, 8, 6, 0.85), k.glow(6, 3, 0.3, T.M_HOT, 8, 6, 15.15), k.glow(0.3, 3, 6, T.M_HOT, 0.85, 6, 8), k.glow(0.3, 3, 6, T.M_HOT, 15.15, 6, 8), k.glow(9.6, 0.3, 9.6, T.M_HOT, 8, 15.1, 8)];
    return { sound: 'hum', update: (s) => { for (const m of hot) { m.visible = s.lv > 0.04; m.scale.setScalar(0.9 + 0.1 * Math.sin(s.t * 5)); } } };
  },
  [B.GENERATOR]: (k) => {
    const wheel = k.pivot(13, 12.2, 9);
    k.lit(1, 5.6, 5.6, T.M_STEEL, 0, 0, 0, wheel); k.lit(1.4, 6.4, 1.4, T.M_DARK, 0, 0, 0, wheel); k.lit(1.4, 1.4, 6.4, T.M_DARK, 0, 0, 0, wheel);
    k.lit(2.4, 1, 1, T.M_DARK, 12, 12.2, 9);
    const fire = [k.glow(4, 3, 0.3, T.M_HOT, 6, 6.5, 0.85), k.glow(4, 3, 0.3, T.M_HOT, 6, 6.5, 15.15), k.glow(1.8, 0.3, 1.8, T.M_HOT, 13.5, 16.1, 3.5)];
    const smoke = k.smoke(13.5, 16.5, 3.5);
    return { sound: 'fire', update: (s) => { wheel.rotation.x = s.ph * 9; for (const m of fire) flick(m, s); smoke(s); } };
  },
  [B.TURBINE]: (k) => {
    const rotor = k.pivot(8, 22.5, 3);
    k.lit(3, 3, 2.4, T.M_DARK, 0, 0, 0, rotor);
    for (let i = 0; i < 3; i++) {
      const arm = k.pivot(0, 0, -0.4, rotor);
      arm.rotation.z = (i * Math.PI * 2) / 3;
      k.lit(2.2, 13, 0.6, T.M_WHITE, 0, 7.6, 0, arm); k.lit(1.2, 3, 0.7, T.M_RED, 0, 13.4, 0, arm);
    }
    return { drive: 'always', sound: 'rotor', update: (s) => { rotor.rotation.z = s.ph * 2.6; } };
  },
  [B.SOLAR]: (k) => {
    const panel = k.pivot(8, 9.8, 8);
    k.lit(16, 1, 16, { t: T.SOLAR_TOP, s: T.M_DARK, b: T.M_DARK }, 0, 0, 0, panel);
    return { drive: 'always', update: (s) => { panel.rotation.z += (s.sunTilt - panel.rotation.z) * Math.min(1, s.dt * 2); } };
  },
  [B.LAVA_GEN]: (k) => {
    const core = k.glow(7.4, 9, 7.4, T.LAVA, 8, 8.5, 8);
    return { sound: 'fire', update: (s) => { core.visible = s.lv > 0.04; const p = 0.9 + 0.1 * Math.sin(s.t * 4); core.scale.set(p, 1, p); } };
  },
  [B.BATTERY]: (k) => {
    const leds = [k.glow(2, 8, 0.3, T.M_GREEN, 8, 7.5, 1.8), k.glow(2, 8, 0.3, T.M_GREEN, 8, 7.5, 14.2), k.glow(0.3, 8, 2, T.M_GREEN, 1.8, 7.5, 8), k.glow(0.3, 8, 2, T.M_GREEN, 14.2, 7.5, 8)];
    return { drive: 'on', update: (s) => { for (const m of leds) { m.visible = s.lv > 0.04; m.scale.y = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(s.t * 1.6)); } } };
  },
  [B.CNC]: (k) => {
    const head = k.pivot(8, 11.5, 8);
    k.lit(3, 3, 4, T.M_DARK, 0, 0, 0, head);
    const bit = k.lit(1, 4, 1, T.M_STEEL, 0, -3.4, 0, head), spark = k.glow(1.8, 0.6, 1.8, T.M_HOT, 0, -5.1, 0, head);
    k.lit(5, 1.4, 5, T.M_STEEL, 8, 6.7, 8);
    return { sound: 'hum', update: (s) => { head.position.x = (8 + 4.4 * Math.sin(s.ph * 2.2)) * U; bit.rotation.y = s.ph * 30; spark.visible = s.act && Math.sin(s.t * 31) > -0.2; } };
  },
  [B.PRINTER]: (k) => {
    const bar = k.pivot(8, 12, 8);
    k.lit(13, 1, 1, T.M_STEEL, 0, 0, 0, bar);
    const head = k.pivot(0, -1, 0, bar);
    k.lit(2.4, 2, 2.4, T.M_DARK, 0, 0, 0, head);
    const nozzle = k.glow(0.8, 1, 0.8, T.M_CYAN, 0, -1.4, 0, head);
    const obj = k.glow(5, 6, 5, T.M_CYAN, 8, 7, 8);
    return { sound: 'hum', update: (s) => {
      const g = frac(s.ph / 7);
      bar.position.z = (8 + 4.6 * Math.sin(s.ph * 5.1)) * U;
      bar.position.y = (7 + g * 6) * U;
      head.position.x = 4.6 * Math.sin(s.ph * 7.7) * U;
      nozzle.visible = s.act;
      obj.visible = s.lv > 0.04;
      obj.scale.y = Math.max(0.04, g);
      obj.position.y = (4 + 3 * Math.max(0.04, g)) * U;
    } };
  },
  [B.CHARGER]: (k) => {
    const pad = k.glow(9, 0.4, 9, T.M_CYAN, 8, 7.3, 8), arc = k.glow(8, 0.6, 0.6, T.M_CYAN, 8, 14, 8);
    return { sound: 'hum', update: (s) => { pad.visible = s.lv > 0.04; const p = 0.75 + 0.25 * Math.sin(s.t * 6); pad.scale.set(p, 1, p); arc.visible = s.act && Math.sin(s.t * 23) > 0; } };
  },
  [B.PUMP]: (k) => {
    const piston = k.lit(4, 4, 4, T.M_DARK, 8, 14, 8);
    k.lit(2, 3, 2, T.M_STEEL, 8, 13, 8);
    return { sound: 'hum', update: (s) => { piston.position.y = (14.4 + 1.5 * Math.sin(s.ph * 6)) * U; } };
  },
  [B.STONER]: (k) => {
    const press = k.lit(3, 3, 9.6, T.M_STEEL, 8, 12, 8), rod = k.lit(1.2, 4, 1.2, T.M_DARK, 8, 14, 8), stone = k.lit(2.8, 2.6, 2.8, T.STONE, 8, 8.3, 8);
    return { sound: 'hum', update: (s) => {
      const c = frac(s.ph / 2), down = Math.sin(c * Math.PI);
      press.position.y = (12.4 - 2.2 * down) * U; rod.position.y = (14.6 - 1.1 * down) * U;
      stone.visible = s.lv > 0.04 && c > 0.5;
    } };
  },
  [B.GROWER]: (k) => {
    const lamp = k.glow(12, 0.4, 12, T.M_VIOLET, 8, 14.7, 8);
    const plant = k.pivot(8, 7, 8);
    k.glow(2.4, 6, 2.4, T.CRYSTAL, 0, 3, 0, plant).visible = true;
    k.glow(1.6, 3.6, 1.6, T.CRYSTAL, 2.2, 1.8, 0.8, plant).visible = true;
    k.glow(1.4, 2.6, 1.4, T.CRYSTAL, -1.8, 1.3, -1.4, plant).visible = true;
    return { sound: 'hum', update: (s) => { lamp.visible = s.on; plant.visible = s.lv > 0.04; plant.scale.setScalar(0.15 + 0.85 * frac(s.ph / 8)); } };
  },
  [B.WASHER]: (k) => {
    const drum = k.pivot(8, 9, 8);
    k.lit(11.6, 6.4, 6.4, T.M_STEEL, 0, 0, 0, drum); k.lit(11.8, 1.4, 8.2, T.M_COPPER, 0, 0, 0, drum); k.lit(11.8, 8.2, 1.4, T.M_COPPER, 0, 0, 0, drum);
    return { sound: 'hum', update: (s) => { drum.rotation.x = s.ph * 6; } };
  },
  [B.FAN]: (k) => {
    const blades = k.pivot(8, 8.6, 8);
    k.lit(12, 0.6, 2.6, T.M_STEEL, 0, 0, 0, blades); k.lit(2.6, 0.6, 12, T.M_STEEL, 0, 0, 0, blades); k.lit(3, 1.2, 3, T.M_DARK, 0, 0, 0, blades);
    return { drive: 'on', sound: 'rotor', update: (s) => { blades.rotation.y = s.ph * 18; } };
  },
  [B.TURRET]: (k) => {
    const head = k.pivot(8, 11.5, 8);
    k.lit(8, 5, 8, { t: T.M_DARK, s: T.TURRET_SIDE, b: T.M_DARK }, 0, 0, 0, head);
    k.lit(1.6, 1.6, 6, T.M_BLACK, 0, 0, -6.5, head);
    const eye = k.glow(2.4, 1, 0.4, T.M_RED, 0, 1.2, -4.1, head);
    return { drive: 'on', update: (s) => { head.rotation.y = Math.sin(s.ph * 0.9) * 1.5; head.rotation.x = (1 - s.lv) * 0.35; eye.visible = s.on; } };
  },
  [B.CHEST]: (k) => {
    // Couvercle articulé à l'arrière : il se lève quand quelqu'un a le coffre ouvert.
    const lid = k.pivot(8, 10, 15);
    k.lit(15, 4, 15, { t: T.CHEST_TOP, s: T.PLANKS, b: T.M_BLACK }, 0, 2, -7.5, lid);
    k.lit(2, 2, 1, T.M_GOLD, 0, 0.6, -15.3, lid);
    let open = 0;
    return { drive: 'always', update: (s) => { open += (((s.v & 128) ? 1 : 0) - open) * Math.min(1, s.dt * 9); lid.rotation.x = open * 1.15; } };
  },
  [B.TANK]: (k) => {
    const water = k.lit(11.6, 12, 11.6, T.WATER, 8, 8, 8), lava = k.glow(11.6, 12, 11.6, T.LAVA, 8, 8, 8), fuel = k.lit(11.6, 12, 11.6, T.M_ORANGE, 8, 8, 8);
    let h = 0;
    return { drive: 'always', update: (s) => {
      const lvl = ((s.v >> 2) & 15) / 8, hot = !!(s.v & 64), oil = !!(s.v & 128), m = hot ? lava : oil ? fuel : water;
      h += (lvl - h) * Math.min(1, s.dt * 4);
      water.visible = !hot && !oil && h > 0.01; lava.visible = hot && h > 0.01; fuel.visible = oil && h > 0.01;
      m.scale.y = Math.max(0.01, h); m.position.y = (2 + 6 * h) * U;
    } };
  },
  [B.FORGE]: (k) => {
    const bath = k.glow(9.6, 0.6, 9.6, T.M_HOT, 8, 13.4, 8), ingot = k.glow(4, 1.6, 2.4, T.M_GOLD, 8, 17, 8);
    const sides = [k.glow(5, 5, 0.3, T.M_HOT, 8, 7.5, 0.85), k.glow(5, 5, 0.3, T.M_HOT, 8, 7.5, 15.15), k.glow(0.3, 5, 5, T.M_HOT, 0.85, 7.5, 8), k.glow(0.3, 5, 5, T.M_HOT, 15.15, 7.5, 8)];
    const smoke = k.smoke(8, 15, 8);
    return { sound: 'fire', update: (s) => {
      bath.visible = s.lv > 0.04; const p = 0.85 + 0.15 * Math.sin(s.t * 5); bath.scale.set(p, 1, p);
      for (const m of sides) { m.visible = s.lv > 0.04; m.scale.setScalar(0.85 + 0.15 * Math.sin(s.t * 6 + m.position.x * 30)); }
      ingot.visible = s.lv > 0.3; ingot.rotation.y = s.ph * 1.5; ingot.position.y = (17.5 + Math.sin(s.ph * 2) * 1.2) * U;
      smoke(s);
    } };
  },
  [B.CONDENSER]: (k) => {
    const orb = k.glow(3.4, 3.4, 3.4, T.M_CYAN, 8, 19, 8), spin = k.pivot(8, 13, 8);
    k.lit(13, 0.8, 1.2, T.M_COPPER, 0, 0, 0, spin); k.lit(1.2, 0.8, 13, T.M_COPPER, 0, 0, 0, spin);
    const arcs = [k.glow(0.5, 5, 0.5, T.M_CYAN, 5, 16.5, 8), k.glow(0.5, 5, 0.5, T.M_CYAN, 11, 16.5, 8), k.glow(0.5, 5, 0.5, T.M_CYAN, 8, 16.5, 5), k.glow(0.5, 5, 0.5, T.M_CYAN, 8, 16.5, 11)];
    return { sound: 'hum', update: (s) => {
      spin.rotation.y = s.ph * 7;
      orb.visible = s.lv > 0.04; orb.rotation.set(s.t, s.t * 1.3, 0); orb.scale.setScalar(0.7 + 0.3 * Math.sin(s.t * 9));
      arcs.forEach((m, i) => { m.visible = s.act && Math.sin(s.t * 27 + i * 2.1) > 0.35; });
    } };
  },
  [B.LIGHTHOUSE]: (k) => {
    const lamp = k.glow(5, 5, 5, T.M_GOLD, 8, 25, 8), beam = k.pivot(8, 25, 8);
    k.glow(70, 1.6, 1.6, T.M_GOLD, 38, 0, 0, beam).visible = true; k.glow(70, 1.6, 1.6, T.M_GOLD, -38, 0, 0, beam).visible = true;
    const sky = k.glow(1.4, 2400, 1.4, T.M_WHITE, 8, 1232, 8);
    return { sound: 'hum', update: (s) => {
      const lit = !!(s.v & 128);
      // En charge, la lampe palpite ; allumé, le faisceau tourne et une colonne de lumière monte au ciel.
      lamp.visible = lit || s.lv > 0.04; lamp.scale.setScalar(lit ? 1 : 0.4 + 0.3 * Math.sin(s.t * 6));
      beam.visible = sky.visible = lit; beam.rotation.y = s.t * 0.8;
    } };
  },
  [B.DRYER]: (k) => {
    const heat = k.glow(11, 0.4, 11, T.M_HOT, 8, 1.4, 8);
    return { update: (s) => { heat.visible = s.lv > 0.04; heat.scale.x = heat.scale.z = 0.8 + 0.2 * Math.sin(s.t * 4); } };
  },
  [B.DECOMP]: (k) => {
    const spin = k.pivot(8, 16, 8);
    k.lit(10, 1, 2, T.M_STEEL, 0, 0, 0, spin); k.lit(2, 1, 10, T.M_STEEL, 0, 0, 0, spin);
    const core = k.glow(4, 6, 4, T.M_VIOLET, 8, 8.5, 8);
    return { sound: 'hum', update: (s) => { spin.rotation.y = s.ph * 14; core.visible = s.lv > 0.04; core.scale.setScalar(0.8 + 0.2 * Math.sin(s.t * 12)); } };
  },
  [B.EXTRACTOR]: (k) => {
    const liq = k.glow(7, 8, 7, T.M_GREEN, 6, 7.5, 6);
    return { sound: 'hum', update: (s) => { liq.visible = s.lv > 0.04; liq.scale.y = 0.4 + 0.6 * frac(s.ph / 8); liq.position.y = (3.6 + 4 * liq.scale.y) * U; } };
  },
  [B.SYNTH]: (k) => {
    const tubes = [k.glow(3, 5, 3, T.M_CYAN, 4, 11.5, 4), k.glow(3, 5, 3, T.M_VIOLET, 12, 11.5, 4), k.glow(3, 6, 3, T.M_HOT, 8, 12, 12)];
    return { sound: 'hum', update: (s) => { tubes.forEach((m, i) => { m.visible = s.lv > 0.04; m.scale.y = 0.5 + 0.5 * Math.abs(Math.sin(s.ph * 1.5 + i * 2)); }); } };
  },
  [B.HARVESTER]: (k) => {
    const arm = k.pivot(8, 15, 8);
    k.lit(14, 0.8, 1.2, T.M_STEEL, 0, 0, 0, arm); k.lit(1.2, 3, 1.2, T.M_RED, 6.4, -1.4, 0, arm); k.lit(1.2, 3, 1.2, T.M_RED, -6.4, -1.4, 0, arm);
    return { sound: 'rotor', update: (s) => { arm.rotation.y = s.ph * 4; } };
  },
  [B.SPRINKLER]: (k) => {
    const head = k.pivot(8, 13.6, 8);
    k.lit(9, 0.8, 0.8, T.M_COPPER, 0, 0, 0, head);
    const jets = [k.glow(0.5, 0.5, 7, T.M_CYAN, 4.4, 0, 3.6, head), k.glow(0.5, 0.5, 7, T.M_CYAN, -4.4, 0, -3.6, head)];
    return { update: (s) => { head.rotation.y = s.ph * 5; for (const j of jets) j.visible = s.lv > 0.3 && Math.sin(s.t * 30) > -0.5; } };
  },
  [B.ALLOY]: (k) => {
    const hot = [k.glow(6, 4, 0.3, T.M_HOT, 8, 6.5, 0.85), k.glow(6, 4, 0.3, T.M_HOT, 8, 6.5, 15.15), k.glow(2.6, 0.4, 2.6, T.M_HOT, 11.5, 12.2, 4.5)], smoke = k.smoke(11.5, 12.5, 4.5);
    return { sound: 'fire', update: (s) => { for (const m of hot) flick(m, s); smoke(s); } };
  },
  [B.CANNER]: (k) => {
    const can = k.lit(2.4, 4, 2.4, T.M_STEEL, 8, 7, 8), nozzle = k.lit(1.2, 2, 1.2, T.M_DARK, 8, 9.5, 8), drop = k.glow(0.8, 2.6, 0.8, T.M_HOT, 8, 9, 8);
    return { sound: 'hum', update: (s) => { const c = frac(s.ph / 3); can.visible = s.lv > 0.04; can.position.x = (2.5 + 11 * c) * U; nozzle.position.y = (9.6 - (c > 0.4 && c < 0.6 ? 0.8 : 0)) * U; drop.visible = s.act && c > 0.4 && c < 0.6; } };
  },
  [B.COMPRESSOR]: (k) => {
    const press = k.lit(9, 3, 9, T.M_STEEL, 8, 12, 8), rod = k.lit(2.4, 5, 2.4, T.M_DARK, 8, 13, 8), cube = k.lit(3, 2, 3, T.M_BLACK, 8, 8, 8);
    return { sound: 'hum', update: (s) => { const d = Math.pow(Math.abs(Math.sin(s.ph * 3)), 4); press.position.y = (12.4 - 3.4 * d) * U; rod.position.y = (13.6 - 1.7 * d) * U; cube.visible = s.lv > 0.04; } };
  },
  [B.REFINERY]: (k) => {
    const hot = [k.glow(5, 4, 0.3, T.M_HOT, 5, 7, 0.85), k.glow(5, 4, 0.3, T.M_HOT, 5, 7, 15.15)], flame = k.glow(2, 3, 2, T.M_HOT, 12.5, 21.5, 5), smoke = k.smoke(12.5, 22, 5);
    return { sound: 'fire', update: (s) => { for (const m of hot) flick(m, s); flick(flame, s, 23); smoke(s); } };
  },
  [B.ELECTRO]: (k) => {
    const a = k.glow(3.6, 8, 3.6, T.M_CYAN, 4.5, 9, 4.5), b = k.glow(3.6, 8, 3.6, T.M_WHITE, 11.5, 9, 11.5);
    return { sound: 'hum', update: (s) => { a.visible = b.visible = s.lv > 0.04; a.scale.y = 0.5 + 0.5 * Math.abs(Math.sin(s.ph * 2)); b.scale.y = 0.5 + 0.5 * Math.abs(Math.cos(s.ph * 2)); } };
  },
  [B.TERMINAL]: (k) => {
    const cube = k.glow(2.6, 2.6, 2.6, T.M_CYAN, 8, 20, 8);
    cube.visible = true;
    return { drive: 'always', update: (s) => { cube.rotation.set(s.t * 0.7, s.t * 1.1, 0); cube.position.y = (20 + Math.sin(s.t * 1.7) * 0.8) * U; } };
  },
  [B.ALTAR]: (k) => {
    const gem = k.glow(3, 5, 3, T.CRYSTAL, 8, 18, 8), orbit = k.pivot(8, 17, 8);
    gem.visible = true;
    k.glow(1, 1, 1, T.M_VIOLET, 6, 0, 0, orbit).visible = true;
    k.glow(1, 1, 1, T.M_CYAN, -6, 1, 0, orbit).visible = true;
    return { drive: 'always', update: (s) => { gem.rotation.y = s.t * 0.9; gem.position.y = (18.5 + Math.sin(s.t * 1.4) * 1.2) * U; orbit.rotation.y = -s.t * 1.6; } };
  },
};

export class ModelView {
  constructor(scene, texture, glowMat) {
    this.scene = scene;
    this.texture = texture;
    this.glowMat = glowMat;
    this.chunks = new Map(); // clé de tronçon -> Map(position -> instance)
    this.loud = { fire: 0, hum: 0, rotor: 0 };
    this.t = 0;
  }

  // Appelé par le monde à chaque (re)dessin d'un tronçon ; list = null quand il disparaît.
  sync(key, list) {
    let cur = this.chunks.get(key);
    if (!list || !list.length) {
      if (cur) { for (const inst of cur.values()) this.remove(inst); this.chunks.delete(key); }
      return;
    }
    if (!cur) this.chunks.set(key, (cur = new Map()));
    const keep = new Set();
    for (const e of list) {
      const k = posKey(e.x, e.y, e.z);
      keep.add(k);
      const old = cur.get(k);
      if (old && old.id === e.id && old.rot === e.rot) continue;
      if (old) this.remove(old);
      const build = BUILD[e.id];
      if (build) cur.set(k, this.create(e, k, build));
    }
    for (const [k, inst] of cur) if (!keep.has(k)) { this.remove(inst); cur.delete(k); }
  }

  create(e, k, build) {
    // Le modèle tourne autour de l'axe vertical du bloc : un groupe centré, et dedans les pièces en coordonnées du bloc.
    const root = new THREE.Group(), inner = new THREE.Group();
    root.position.set(e.x + 0.5, e.y, e.z + 0.5);
    root.rotation.y = e.id === B.SOLAR ? 0 : (e.rot ?? 0) * Math.PI / 2; // le panneau solaire suit le soleil, pas le joueur
    inner.position.set(-0.5, 0, -0.5);
    root.add(inner);
    const mat = new THREE.MeshBasicMaterial({ map: this.texture, vertexColors: true });
    const kit = new Kit(inner, mat, this.glowMat);
    const spec = build(kit);
    this.scene.add(root);
    return { ...e, k, root, mat, smokes: kit.smokes, update: spec.update, drive: spec.drive ?? 'act', sound: spec.sound ?? null, lv: 0, ph: (e.x * 7 + e.z * 13) % 6, lightIn: Math.random() * 0.4 };
  }

  remove(inst) {
    this.scene.remove(inst.root);
    inst.mat.dispose();
    for (const m of inst.smokes) m.dispose();
  }

  setVisible(key, v) { const cur = this.chunks.get(key); if (cur) for (const inst of cur.values()) inst.root.visible = v; }

  clear() { for (const key of [...this.chunks.keys()]) this.sync(key, null); }

  // env : { powered, active (ensembles de positions), vis (état visible par position), lightAt(x, y, z), eye: {x, y, z}, sunTilt }
  update(dt, env) {
    this.t += dt;
    const loud = this.loud;
    loud.fire = loud.hum = loud.rotor = 0;
    const s = { t: this.t, dt, on: false, act: false, lv: 0, ph: 0, sunTilt: env.sunTilt, v: 0 };
    for (const cur of this.chunks.values()) for (const inst of cur.values()) {
      if (!inst.root.visible) continue;
      const dx = inst.x + 0.5 - env.eye.x, dy = inst.y + 0.5 - env.eye.y, dz = inst.z + 0.5 - env.eye.z, d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > 70 * 70) continue; // trop loin pour se voir bouger
      s.on = env.powered.has(inst.k);
      s.act = env.active.has(inst.k);
      s.v = env.vis.get(inst.k) ?? 0;
      const want = inst.drive === 'always' ? 1 : inst.drive === 'on' ? (s.on ? 1 : 0) : s.act ? 1 : 0;
      inst.lv += (want - inst.lv) * Math.min(1, dt * 2.5);
      inst.ph += dt * inst.lv;
      s.lv = inst.lv; s.ph = inst.ph;
      inst.update(s);
      if ((inst.lightIn -= dt) <= 0) { inst.lightIn = 0.4; inst.mat.color.copy(env.lightAt(inst.x + 0.5, inst.y + 0.5, inst.z + 0.5)); }
      if (inst.sound && inst.lv > 0.05) {
        const f = Math.max(0, 1 - Math.sqrt(d2) / 14);
        loud[inst.sound] = Math.max(loud[inst.sound], f * f * inst.lv);
      }
    }
  }
}
