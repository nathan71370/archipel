import { T } from './textures.js';

// ---------- Blocs ----------
export const B = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, MOSS: 4, LOG: 5, LEAVES: 6, SNOW: 7, SLATE: 8, CRYSTAL: 9, PLANKS: 10,
  COAL_ORE: 11, IRON_ORE: 12, COPPER_ORE: 13, BUSH: 14, BENCH: 15, FURNACE: 16, CABLE: 17, TURBINE: 18,
  LAMP: 19, LEVER_OFF: 20, LEVER_ON: 21, FAN: 22, TURRET: 23, PORTAL: 24, BASALT: 25, EMBER: 26, BRAISITE: 27, ASH: 28,
  MYCEL: 29, STEM: 30, CAP: 31, TNT: 32, BEACON: 33,
  CHEST: 34, E_FURNACE: 35, GENERATOR: 36, SOLAR: 37, THERMAL: 38, BATTERY: 39, CNC: 40, PRINTER: 41, CHARGER: 42,
  CORE: 43, CASING: 44, URANITE: 45,
  WATER: 46, LAVA: 47, ITEM_PIPE: 48, FLUID_PIPE: 49, TANK: 50, PUMP: 51, STONER: 52, SIEVE: 53, GROWER: 54, WASHER: 55,
  LAVA_GEN: 56, DRAWER: 57, TERMINAL: 58, ALTAR: 59,
  SAND: 80, SANDSTONE: 81, CACTUS: 82, ICE: 83, PINE_LEAVES: 84, STONE_BRICK: 85, GLASS: 86, LANTERN: 87,
  FORGE: 88, CONDENSER: 89, LIGHTHOUSE: 90, FARMLAND: 91, CROP1: 92, CROP2: 93, CROP3: 94,
  TORCH: 95, HAMMOCK: 96, BOUNCE: 97, MOONDUST: 98, MOONROCK: 99, TITAN_ORE: 60,
  COMPRESSOR: 68, REFINERY: 69, ELECTRO: 70, ROCKET: 78, MODBENCH: 79, ALLOY: 207, CANNER: 208,
  HARVESTER: 209, SPRINKLER: 245, TELEPAD: 246, WOOL: 247, STEEL_BLOCK: 248, MOONBRICK: 249,
  ORE_CROP: 210, // 210 à 221 : pousse puis plant mûr de chacun des six germes de minerai
};
// Blocs pleins mais qui laissent passer la vue et la lumière.
export const CLEAR = new Set([86]);
// Liquides : 46 et 47 sont les sources ; 61-67 (eau) et 71-77 (lave) sont des écoulements de niveau 1 à 7.
export const fluidKind = (id) => (id === 46 || (id > 60 && id < 68) ? 1 : id === 47 || (id > 70 && id < 78) ? 2 : 0);
export const fluidLevel = (id) => (id === 46 || id === 47 ? 8 : id > 70 ? id - 70 : id - 60);
export const flowId = (kind, level) => (kind === 1 ? 60 : 70) + level;
export const LIQUID = new Set([46, 47, 61, 62, 63, 64, 65, 66, 67, 71, 72, 73, 74, 75, 76, 77]);

// ---------- Objets ----------
export const I = {
  STICK: 150, COAL: 151, IRON: 152, COPPER: 153, MEAT_RAW: 154, MEAT_COOKED: 155, BERRIES: 156,
  DUST: 157, GUN: 158, AMMO: 159, EMBER_SHARD: 160, FEATHER: 161, HOOK: 162, MUSHROOM: 163,
  PLATE: 164, WIRE: 165, CIRCUIT: 166, CELL: 167, ROD: 168, DRILL: 169, PULSE: 170, PLASMA: 171, JETPACK: 172,
  BUCKET: 173, BUCKET_WATER: 174, BUCKET_LAVA: 175, WRENCH: 176, COIN: 177, IRON_DUST: 178, COPPER_DUST: 179,
  SEED_COAL: 183, SEED_IRON: 184, SEED_COPPER: 185, SEED_CRYSTAL: 186, SEED_URANITE: 187, SEED_EMBER: 188,
  CHITIN: 189, FROST: 190, BAIT: 191, HEART: 192, WINGS: 193, COMPASS: 194,
  CHITIN_HELM: 195, CHITIN_CHEST: 196, CHITIN_LEGS: 197, CHITIN_BOOTS: 198,
  STAR: 199, SEEDS: 200, WHEAT: 201, BREAD: 202, PIE: 203, HOE: 204, JELLY: 205, SOUP: 206,
  GLIDER1: 222, GLIDER2: 223, GLIDER3: 224, GLIDER4: 241, CARBON: 225, COMPOSITE: 226, FUEL: 227, OXY: 228, TITAN: 229,
  BIO_HELM: 230, BIO_CHEST: 231, BIO_LEGS: 232, BIO_BOOTS: 233,
  MOD_NIGHT: 234, MOD_AIR: 235, MOD_MAGNET: 236, MOD_SHIELD: 237, MOD_SPEED: 238, MOD_SPRING: 239, ENGINE: 240, STEEL: 242, ELECTRUM: 243, CAN: 244, SHEARS: 250,
};
// Carburant : un liquide qui n'existe que dans les réservoirs et les tuyaux (ce n'est pas un bloc).
export const F_FUEL = 300;

// hard = secondes à mains nues ; tool = outil adapté ; tier = palier minimal pour récolter.
const blk = (name, top, side, bottom, hard, tool = null, tier = 0, extra = {}) => ({ name, top, side, bottom, hard, tool, tier, ...extra });
const all = (name, t, hard, tool, tier, extra) => blk(name, t, t, t, hard, tool, tier, extra);

export const BLOCKS = [];
BLOCKS[B.GRASS] = blk('Herbe', T.GRASS_TOP, T.GRASS_SIDE, T.DIRT, 0.7, 'shovel', 0, { icon: T.GRASS_SIDE });
BLOCKS[B.DIRT] = all('Terre', T.DIRT, 0.6, 'shovel');
BLOCKS[B.STONE] = all('Roche', T.STONE, 2.4, 'pick', 1);
BLOCKS[B.MOSS] = blk('Mousse', T.MOSS_TOP, T.MOSS_SIDE, T.DIRT, 0.7, 'shovel', 0, { icon: T.MOSS_SIDE });
BLOCKS[B.LOG] = blk('Tronc', T.LOG_TOP, T.LOG_SIDE, T.LOG_TOP, 1.8, 'axe');
BLOCKS[B.LEAVES] = all('Feuillage', T.LEAVES, 0.3);
BLOCKS[B.SNOW] = all('Neige', T.SNOW, 0.4, 'shovel');
BLOCKS[B.SLATE] = all('Ardoise', T.SLATE, 3, 'pick', 2);
BLOCKS[B.CRYSTAL] = all('Cristal', T.CRYSTAL, 3.4, 'pick', 3, { glow: true });
BLOCKS[B.PLANKS] = all('Planches', T.PLANKS, 1.4, 'axe');
BLOCKS[B.COAL_ORE] = all('Charbon brut', T.COAL_ORE, 2.8, 'pick', 1, { drop: [I.COAL, 1] });
BLOCKS[B.IRON_ORE] = all('Minerai de fer', T.IRON_ORE, 3.2, 'pick', 2);
BLOCKS[B.COPPER_ORE] = all('Minerai de cuivre', T.COPPER_ORE, 3, 'pick', 2);
BLOCKS[B.BUSH] = all('Buisson à baies', T.BUSH, 0.3, null, 0, { drop: [I.BERRIES, 2] });
BLOCKS[B.BENCH] = blk('Établi', T.BENCH_TOP, T.BENCH_SIDE, T.PLANKS, 1.4, 'axe');
BLOCKS[B.FURNACE] = blk('Four', T.FURNACE_TOP, T.FURNACE_SIDE, T.FURNACE_TOP, 2.4, 'pick');
BLOCKS[B.CABLE] = all('Câble', T.CABLE, 0.4, null, 0, { onTile: T.CABLE_ON });
BLOCKS[B.TURBINE] = blk('Éolienne', T.TURBINE_TOP, T.TURBINE_SIDE, T.MACHINE, 1.6, 'pick');
BLOCKS[B.LAMP] = all('Lampe', T.LAMP_OFF, 0.6, null, 0, { onTile: T.LAMP_ON, onGlow: true });
// Blocs retirés du jeu : ils ne se fabriquent plus, mais un ancien monde peut encore en contenir.
BLOCKS[B.LEVER_OFF] = all('Ancien levier', T.LEVER_OFF, 0.6, null, 0, { drop: [B.CABLE, 1], legacy: true });
BLOCKS[B.LEVER_ON] = all('Ancien levier', T.LEVER_ON, 0.6, null, 0, { drop: [B.CABLE, 1], legacy: true });
BLOCKS[B.FAN] = blk('Ventilateur', T.FAN_TOP, T.MACHINE, T.MACHINE, 1.6, 'pick');
BLOCKS[B.TURRET] = blk('Tourelle', T.MACHINE, T.TURRET_SIDE, T.MACHINE, 1.6, 'pick');
BLOCKS[B.PORTAL] = all('Portail', T.PORTAL, 2, 'pick', 0, { glow: true });
BLOCKS[B.BASALT] = all('Basalte', T.BASALT, 2.8, 'pick', 2);
BLOCKS[B.EMBER] = all('Braise', T.EMBER, 3, 'pick', 3, { glow: true });
BLOCKS[B.BRAISITE] = all('Braisite', T.BRAISITE, 4.2, 'pick', 4, { drop: [I.EMBER_SHARD, 1] });
BLOCKS[B.ASH] = all('Cendre', T.ASH, 0.6, 'shovel');
BLOCKS[B.MYCEL] = blk('Mycélium', T.MYCEL_TOP, T.MYCEL_SIDE, T.DIRT, 0.7, 'shovel', 0, { icon: T.MYCEL_SIDE });
BLOCKS[B.STEM] = all('Pied de champignon', T.STEM, 1.2, 'axe');
BLOCKS[B.CAP] = all('Chapeau lumineux', T.CAP, 0.5, 'axe', 0, { glow: true, drop: [I.MUSHROOM, 1] });
BLOCKS[B.TNT] = blk('Poudrière', T.TNT_TOP, T.TNT_SIDE, T.TNT_TOP, 0.4);
BLOCKS[B.BEACON] = all('Balise', T.BEACON, 1.2, 'axe', 0, { glow: true });
BLOCKS[B.CHEST] = blk('Coffre', T.CHEST_TOP, T.CHEST_SIDE, T.CHEST_TOP, 1.4, 'axe');
BLOCKS[B.E_FURNACE] = blk('Four électrique', T.MACHINE, T.EFURNACE, T.MACHINE, 1.8, 'pick');
BLOCKS[B.GENERATOR] = blk('Générateur à charbon', T.MACHINE, T.GENERATOR, T.MACHINE, 1.8, 'pick');
BLOCKS[B.SOLAR] = blk('Panneau solaire', T.SOLAR_TOP, T.MACHINE, T.MACHINE, 1.2, 'pick');
BLOCKS[B.THERMAL] = blk('Ancien générateur thermique', T.MACHINE, T.THERMAL, T.MACHINE, 1.8, 'pick', 0, { drop: [B.LAVA_GEN, 1], legacy: true });
BLOCKS[B.BATTERY] = blk('Accumulateur', T.MACHINE, T.BATTERY, T.MACHINE, 1.8, 'pick');
BLOCKS[B.CNC] = blk('Fraiseuse CNC', T.MACHINE, T.CNC, T.MACHINE, 1.8, 'pick');
BLOCKS[B.PRINTER] = blk('Imprimante 3D', T.MACHINE, T.PRINTER, T.MACHINE, 1.8, 'pick');
BLOCKS[B.CHARGER] = blk('Chargeur', T.MACHINE, T.CHARGER, T.MACHINE, 1.8, 'pick');
BLOCKS[B.CORE] = all('Cœur de réacteur', T.CORE, 3, 'pick', 2);
BLOCKS[B.CASING] = all('Blindage de réacteur', T.CASING, 2.4, 'pick', 1);
BLOCKS[B.URANITE] = all('Uranite', T.URANITE, 4.4, 'pick', 4, { glow: true });
BLOCKS[B.WATER] = all('Eau', T.WATER, 1e9, null, 0, { liquid: true });
BLOCKS[B.LAVA] = all('Lave', T.LAVA, 1e9, null, 0, { liquid: true, glow: true });
for (let l = 1; l <= 7; l++) {
  BLOCKS[60 + l] = { ...BLOCKS[B.WATER], flow: l };
  BLOCKS[70 + l] = { ...BLOCKS[B.LAVA], flow: l };
}
BLOCKS[B.SAND] = all('Sable', T.SAND, 0.5, 'shovel');
BLOCKS[B.SANDSTONE] = all('Grès', T.SANDSTONE, 1.8, 'pick', 1);
BLOCKS[B.CACTUS] = blk('Épineux', T.CACTUS_TOP, T.CACTUS_SIDE, T.CACTUS_TOP, 0.5);
BLOCKS[B.ICE] = all('Glace', T.ICE, 0.8, 'pick');
BLOCKS[B.PINE_LEAVES] = all('Aiguilles de sapin', T.PINE_LEAVES, 0.3);
BLOCKS[B.STONE_BRICK] = all('Briques de roche', T.STONE_BRICK, 2.6, 'pick', 1);
BLOCKS[B.GLASS] = all('Verre', T.GLASS, 0.4, null, 0, { clear: true });
BLOCKS[B.LANTERN] = all('Lanterne', T.LANTERN, 0.5, null, 0, { glow: true });
BLOCKS[B.ITEM_PIPE] = all('Tuyau à objets', T.ITEM_PIPE, 0.4);
BLOCKS[B.FLUID_PIPE] = all('Tuyau à fluides', T.FLUID_PIPE, 0.4);
BLOCKS[B.TANK] = blk('Réservoir', T.MACHINE, T.TANK, T.MACHINE, 1.4, 'pick', 0, { noDrop: true });
BLOCKS[B.PUMP] = blk('Pompe', T.MACHINE, T.PUMP, T.MACHINE, 1.8, 'pick');
BLOCKS[B.STONER] = blk('Générateur de roche', T.MACHINE, T.STONER, T.MACHINE, 1.8, 'pick');
BLOCKS[B.SIEVE] = blk('Ancien tamis à vent', T.SIEVE, T.SIEVE, T.MACHINE, 1.8, 'pick', 0, { drop: [I.PLATE, 4], legacy: true });
BLOCKS[B.GROWER] = blk('Cultivateur de minerai', T.MACHINE, T.GROWER, T.MACHINE, 1.8, 'pick');
BLOCKS[B.WASHER] = blk('Laveur de minerai', T.MACHINE, T.WASHER, T.MACHINE, 1.8, 'pick');
BLOCKS[B.LAVA_GEN] = blk('Générateur thermique', T.MACHINE, T.LAVAGEN, T.MACHINE, 1.8, 'pick');
BLOCKS[B.DRAWER] = blk('Tiroir', T.PLANKS, T.DRAWER, T.PLANKS, 1.4, 'axe');
BLOCKS[B.TERMINAL] = blk('Terminal de stockage', T.MACHINE, T.TERMINAL, T.MACHINE, 1.8, 'pick');
BLOCKS[B.ALTAR] = blk("Autel d'enchantement", T.ALTAR_TOP, T.ALTAR_SIDE, T.SLATE, 2.4, 'pick', 0, { glow: true });
BLOCKS[B.FORGE] = blk('Forge à fusion', T.MACHINE, T.FORGE, T.MACHINE, 2.4, 'pick');
BLOCKS[B.CONDENSER] = blk("Condenseur d'orage", T.MACHINE, T.CONDENSER, T.MACHINE, 1.8, 'pick');
BLOCKS[B.LIGHTHOUSE] = blk("Phare de l'Archipel", T.M_GOLD, T.M_WHITE, T.M_DARK, 3, 'pick');
BLOCKS[B.FARMLAND] = blk('Terre labourée', T.FARMLAND, T.DIRT, T.DIRT, 0.6, 'shovel', 0, { drop: [B.DIRT, 1] });
// Blé céleste : trois stades. Seul le dernier donne du blé.
BLOCKS[B.CROP1] = all('Pousse de blé', T.CROP, 0.1, null, 0, { drop: [I.SEEDS, 1], pass: true, crop: true, hidden: true });
BLOCKS[B.CROP2] = all('Blé en herbe', T.CROP, 0.1, null, 0, { drop: [I.SEEDS, 1], pass: true, crop: true, hidden: true });
BLOCKS[B.CROP3] = all('Blé mûr', T.CROP_RIPE, 0.1, null, 0, { drop: [I.WHEAT, 2], pass: true, crop: true, hidden: true });
BLOCKS[B.MOONDUST] = all("Poussière d'éther", T.MOONDUST, 0.5, 'shovel');
BLOCKS[B.MOONROCK] = all("Roche d'éther", T.MOONROCK, 3, 'pick', 2);
BLOCKS[B.TITAN_ORE] = all('Minerai de titane', T.TITAN_ORE, 4.2, 'pick', 4);
BLOCKS[B.COMPRESSOR] = blk('Compresseur', T.MACHINE, T.MACHINE, T.MACHINE, 1.8, 'pick');
BLOCKS[B.HARVESTER] = blk('Récolteuse', T.MACHINE, T.MACHINE, T.MACHINE, 1.8, 'pick');
BLOCKS[B.SPRINKLER] = blk('Arroseur', T.MACHINE, T.MACHINE, T.MACHINE, 1.4, 'pick');
BLOCKS[B.TELEPAD] = all('Téléporteur', T.M_DARK, 2, 'pick', 0, { onTile: T.M_CYAN });
BLOCKS[B.WOOL] = all('Laine', T.WOOL, 0.5);
BLOCKS[B.STEEL_BLOCK] = all("Tôle d'acier", T.STEEL_BLOCK, 4, 'pick', 2);
BLOCKS[B.MOONBRICK] = all("Briques d'éther", T.MOONBRICK, 3, 'pick', 2);
BLOCKS[B.ALLOY] = blk("Fonderie d'alliages", T.MACHINE, T.MACHINE, T.MACHINE, 1.8, 'pick');
BLOCKS[B.CANNER] = blk('Embouteilleuse', T.MACHINE, T.MACHINE, T.MACHINE, 1.8, 'pick');
BLOCKS[B.REFINERY] = blk('Raffinerie', T.MACHINE, T.MACHINE, T.MACHINE, 1.8, 'pick');
BLOCKS[B.ELECTRO] = blk('Électrolyseur', T.MACHINE, T.MACHINE, T.MACHINE, 1.8, 'pick');
BLOCKS[B.ROCKET] = blk('Fusée', T.M_WHITE, T.M_WHITE, T.M_DARK, 3, 'pick');
BLOCKS[B.MODBENCH] = blk('Atelier bionique', T.M_DARK, T.MACHINE, T.M_DARK, 1.8, 'pick');
BLOCKS[B.TORCH] = all('Torche', T.M_HOT, 0.1, null, 0, { pass: true });
BLOCKS[B.HAMMOCK] = all('Hamac', T.M_RED, 0.8, 'axe');
BLOCKS[B.BOUNCE] = all('Gelée bondissante', T.JELLY, 0.6);
// Germes de minerai plantés en terre : [germe, nom, tuile du minerai, récolte, secondes en moyenne pour mûrir].
// Plus lent que le cultivateur, mais sans eau ni courant. Le germe revient à la récolte.
export const ORE_CROPS = [
  [I.SEED_COAL, 'charbon', T.COAL_ORE, [I.COAL, 2], 90], [I.SEED_IRON, 'fer', T.IRON_ORE, [B.IRON_ORE, 1], 100],
  [I.SEED_COPPER, 'cuivre', T.COPPER_ORE, [B.COPPER_ORE, 1], 100], [I.SEED_CRYSTAL, 'cristal', T.CRYSTAL, [B.CRYSTAL, 1], 150],
  [I.SEED_URANITE, 'uranite', T.URANITE, [B.URANITE, 1], 220], [I.SEED_EMBER, 'braise', T.EMBER, [I.EMBER_SHARD, 1], 220],
];
ORE_CROPS.forEach(([seed, name, tile, out], k) => {
  BLOCKS[B.ORE_CROP + k * 2] = all(`Pousse de ${name}`, T.CROP, 0.1, null, 0, { drop: [seed, 1], pass: true, crop: true, hidden: true });
  BLOCKS[B.ORE_CROP + k * 2 + 1] = all(`Plant de ${name} mûr`, tile, 0.1, null, 0, { drop: out, seed, pass: true, crop: true, hidden: true });
});
// Ce qui pousse tout seul sur de la terre labourée : bloc -> [stade suivant, secondes en moyenne].
export const GROW = { [B.CROP1]: [B.CROP2, 40], [B.CROP2]: [B.CROP3, 40] };
ORE_CROPS.forEach((c, k) => { GROW[B.ORE_CROP + k * 2] = [B.ORE_CROP + k * 2 + 1, c[4]]; });
// Plant mûr -> stade auquel la récolteuse le remet après l'avoir cueilli.
export const REPLANT = { [B.CROP3]: B.CROP1 };
ORE_CROPS.forEach((c, k) => { REPLANT[B.ORE_CROP + k * 2 + 1] = B.ORE_CROP + k * 2; });

export const ELECTRIC = new Set([B.CABLE, B.TURBINE, B.LAMP, B.FAN, B.TURRET, B.TNT,
  B.E_FURNACE, B.GENERATOR, B.SOLAR, B.BATTERY, B.CNC, B.PRINTER, B.CHARGER, B.CORE, B.CASING,
  B.PUMP, B.STONER, B.GROWER, B.WASHER, B.LAVA_GEN, B.FORGE, B.CONDENSER, B.LIGHTHOUSE, B.COMPRESSOR, B.REFINERY, B.ELECTRO, B.ALLOY, B.CANNER, B.HARVESTER, B.SPRINKLER, B.TELEPAD]);
// Blocs qu'on traverse en marchant (cultures, torches).
export const PASS = new Set();
BLOCKS.forEach((def, id) => { if (def?.pass) PASS.add(id); });

// ---------- Paliers d'outils ----------
export const TIERS = [
  { name: 'en bois', mat: B.PLANKS, color: 0xc99a6b, speed: 2, dur: 60, dmg: 1 },
  { name: 'en roche', mat: B.STONE, color: 0x8d8fa3, speed: 3.2, dur: 130, dmg: 2 },
  { name: 'en fer', mat: I.IRON, color: 0xdfe3ea, speed: 5, dur: 300, dmg: 3 },
  { name: 'en cristal', mat: B.CRYSTAL, color: 0x5fdcf5, speed: 7, dur: 600, dmg: 4 },
  { name: 'de braise', mat: I.EMBER_SHARD, color: 0xff7a3d, speed: 9, dur: 1000, dmg: 6 },
  { name: 'stellaire', mat: I.STAR, color: 0xfff1a8, speed: 13, dur: 2500, dmg: 9 },
];
const TOOLS = [
  { type: 'pick', name: 'Pioche', shape: 'pick', n: 3, sticks: 2, base: 2 },
  { type: 'axe', name: 'Hache', shape: 'axe', n: 3, sticks: 2, base: 3 },
  { type: 'shovel', name: 'Pelle', shape: 'shovel', n: 1, sticks: 2, base: 1.5 },
  { type: 'sword', name: 'Épée', shape: 'sword', n: 2, sticks: 1, base: 4 },
];
const ARMOR_TIERS = [{ tier: 2, pts: [2, 4, 3, 2] }, { tier: 3, pts: [3, 5, 4, 3] }, { tier: 4, pts: [3, 6, 5, 3] }];
const ARMOR = [
  { name: 'Casque', shape: 'helmet', n: 5 },
  { name: 'Plastron', shape: 'chest', n: 8 },
  { name: 'Jambières', shape: 'legs', n: 7 },
  { name: 'Bottes', shape: 'boots', n: 4 },
];
export const ARMOR_SLOTS = ['Casque', 'Plastron', 'Jambières', 'Bottes'];
export const toolId = (tier, type) => 100 + tier * 4 + type;
// Les jambières sont arrivées après coup : identifiants à part pour ne pas décaler les anciens.
export const armorId = (ti, slot) => (slot === 2 ? 180 + ti : 130 + ti * 3 + (slot === 3 ? 2 : slot));

// ---------- Table de tous les objets ----------
export const ITEMS = {};
BLOCKS.forEach((def, id) => { if (def) ITEMS[id] = { name: def.name, block: true, tile: def.icon ?? def.side, stack: 99, legacy: def.legacy || def.hidden }; });
TIERS.forEach((tier, ti) => TOOLS.forEach((tool, k) => {
  ITEMS[toolId(ti, k)] = {
    name: `${tool.name} ${tier.name}`, shape: tool.shape, color: tier.color, stack: 1,
    tool: { type: tool.type, tier: ti + 1, speed: tier.speed, dur: tier.dur, dmg: tool.base + tier.dmg * (tool.type === 'sword' ? 1 : 0.5) },
  };
}));
ARMOR_TIERS.forEach((at, ti) => ARMOR.forEach((a, k) => {
  const tier = TIERS[at.tier];
  ITEMS[armorId(ti, k)] = { name: `${a.name} ${tier.name}`, shape: a.shape, color: tier.color, stack: 1, armor: { slot: k, points: at.pts[k] } };
}));
Object.assign(ITEMS, {
  [I.STICK]: { name: 'Bâton', shape: 'stick', color: 0x8a5a3c, stack: 99 },
  [I.COAL]: { name: 'Charbon', shape: 'lump', color: 0x34313d, stack: 99 },
  [I.IRON]: { name: 'Lingot de fer', shape: 'ingot', color: 0xdfe3ea, stack: 99 },
  [I.COPPER]: { name: 'Lingot de cuivre', shape: 'ingot', color: 0xe0822f, stack: 99 },
  [I.MEAT_RAW]: { name: 'Viande crue', shape: 'meat', color: 0xe07a8a, stack: 99, food: 3 },
  [I.MEAT_COOKED]: { name: 'Viande grillée', shape: 'meat', color: 0xa8643a, stack: 99, food: 8 },
  [I.BERRIES]: { name: 'Baies', shape: 'berries', color: 0xd9368b, stack: 99, food: 2 },
  [I.DUST]: { name: "Poussière d'orage", shape: 'lump', color: 0x7ef0ff, stack: 99 },
  [I.GUN]: { name: 'Fusil à étincelles', shape: 'gun', color: 0x8d94a8, stack: 1, gun: true },
  [I.AMMO]: { name: 'Cartouches', shape: 'ammo', color: 0xc9703a, stack: 99 },
  [I.EMBER_SHARD]: { name: 'Éclat de braise', shape: 'lump', color: 0xff7a3d, stack: 99 },
  [I.FEATHER]: { name: 'Plume', shape: 'feather', color: 0xfff1d0, stack: 99 },
  [I.HOOK]: { name: 'Grappin', shape: 'hook', color: 0xc7ccd9, stack: 1, hook: true },
  [I.MUSHROOM]: { name: 'Champignon lumineux', shape: 'cap', color: 0x2fd4b0, stack: 99, food: 4 },
  [I.PLATE]: { name: 'Plaque de fer', shape: 'plate', color: 0xdfe3ea, stack: 99 },
  [I.WIRE]: { name: 'Fil de cuivre', shape: 'wire', color: 0xe0822f, stack: 99 },
  [I.CIRCUIT]: { name: 'Circuit', shape: 'circuit', color: 0x2f9e6b, stack: 99 },
  [I.CELL]: { name: 'Pile', shape: 'cell', color: 0x8d94a8, stack: 99 },
  [I.ROD]: { name: "Barre d'uranium", shape: 'rod', color: 0x9dff5a, stack: 16 },
  // Outils électriques : pas d'usure, mais une charge (c) à refaire au chargeur.
  [I.DRILL]: { name: 'Foreuse', shape: 'drill', color: 0x8d94a8, stack: 1, charge: { max: 500, use: 1 }, tool: { type: 'pick', tier: 5, speed: 11, dmg: 5 } },
  [I.PULSE]: { name: 'Pistolet à impulsion', shape: 'gun', color: 0x5fdcf5, stack: 1, charge: { max: 300, use: 5 }, gun: true, dmg: 8 },
  [I.PLASMA]: { name: 'Lame plasma', shape: 'sword', color: 0xc77dff, stack: 1, charge: { max: 400, use: 2 }, tool: { type: 'sword', tier: 5, speed: 9, dmg: 14 } },
  [I.BUCKET]: { name: 'Seau', shape: 'bucket', color: 0xc7ccd9, stack: 16 },
  [I.BUCKET_WATER]: { name: "Seau d'eau", shape: 'bucket', color: 0x3f9be0, stack: 1, fluid: B.WATER },
  [I.BUCKET_LAVA]: { name: 'Seau de lave', shape: 'bucket', color: 0xff6a1f, stack: 1, fluid: B.LAVA },
  [I.WRENCH]: { name: 'Clé à molette', shape: 'wrench', color: 0xc7ccd9, stack: 1 },
  [I.COIN]: { name: 'Écu céleste', shape: 'coin', color: 0xf4c95d, stack: 99 },
  [I.IRON_DUST]: { name: 'Poudre de fer', shape: 'dustp', color: 0xe2b193, stack: 99 },
  [I.COPPER_DUST]: { name: 'Poudre de cuivre', shape: 'dustp', color: 0xe0822f, stack: 99 },
  [I.SEED_COAL]: { name: 'Germe de charbon', shape: 'seed', color: 0x4a4458, stack: 16, plant: 210 },
  [I.SEED_IRON]: { name: 'Germe de fer', shape: 'seed', color: 0xe2b193, stack: 16, plant: 212 },
  [I.SEED_COPPER]: { name: 'Germe de cuivre', shape: 'seed', color: 0xe0822f, stack: 16, plant: 214 },
  [I.SEED_CRYSTAL]: { name: 'Germe de cristal', shape: 'seed', color: 0x5fdcf5, stack: 16, plant: 216 },
  [I.SEED_URANITE]: { name: "Germe d'uranite", shape: 'seed', color: 0x9dff5a, stack: 16, plant: 218 },
  [I.SEED_EMBER]: { name: 'Germe de braise', shape: 'seed', color: 0xff7a3d, stack: 16, plant: 220 },
  [I.CHITIN]: { name: 'Chitine', shape: 'plate', color: 0x2f8f8a, stack: 99 },
  [I.FROST]: { name: 'Éclat de givre', shape: 'lump', color: 0xbfe9fa, stack: 99 },
  [I.BAIT]: { name: 'Appât du Colosse', shape: 'lump', color: 0xff3d6a, stack: 16 },
  [I.HEART]: { name: 'Cœur ardent', shape: 'heart', color: 0xff5a2a, stack: 16 },
  [I.WINGS]: { name: 'Ailes de braise', shape: 'wing', color: 0xff8a3d, stack: 1, wings: true, armor: { slot: 1, points: 4 } },
  [I.COMPASS]: { name: 'Boussole', shape: 'compass', color: 0xc7ccd9, stack: 1 },
  [I.CHITIN_HELM]: { name: 'Casque en chitine', shape: 'helmet', color: 0x2f8f8a, stack: 1, armor: { slot: 0, points: 1 } },
  [I.CHITIN_CHEST]: { name: 'Plastron en chitine', shape: 'chest', color: 0x2f8f8a, stack: 1, armor: { slot: 1, points: 3 } },
  [I.CHITIN_LEGS]: { name: 'Jambières en chitine', shape: 'legs', color: 0x2f8f8a, stack: 1, armor: { slot: 2, points: 2 } },
  [I.CHITIN_BOOTS]: { name: 'Bottes en chitine', shape: 'boots', color: 0x2f8f8a, stack: 1, armor: { slot: 3, points: 1 } },
  [I.STAR]: { name: 'Alliage stellaire', shape: 'ingot', color: 0xfff1a8, stack: 99 },
  [I.SEEDS]: { name: 'Graines de blé', shape: 'seed', color: 0xd8c46a, stack: 99, plant: B.CROP1 },
  [I.WHEAT]: { name: 'Blé céleste', shape: 'feather', color: 0xf0c94a, stack: 99 },
  [I.BREAD]: { name: 'Pain', shape: 'ingot', color: 0xc98a4a, stack: 99, food: 6 },
  [I.PIE]: { name: 'Tourte du voyageur', shape: 'coin', color: 0xd9a35f, stack: 99, food: 13 },
  // Planeurs : speed = vitesse de croisière, sink = vitesse de chute en vol plané. Le meilleur du sac est utilisé.
  [I.GLIDER1]: { name: 'Planeur de toile', shape: 'wing', color: 0xe8795a, stack: 1, glide: { speed: 8, sink: 1.9, tier: 1 } },
  [I.GLIDER2]: { name: 'Planeur renforcé', shape: 'wing', color: 0xf4c95d, stack: 1, glide: { speed: 11, sink: 1.3, tier: 2 } },
  [I.GLIDER3]: { name: 'Aile de carbone', shape: 'wing', color: 0x4a4f63, stack: 1, glide: { speed: 15, sink: 0.9, tier: 3 } },
  [I.GLIDER4]: { name: 'Aile de titane', shape: 'wing', color: 0xbfd4ff, stack: 1, glide: { speed: 19, sink: 0.6, tier: 4 } },
  [I.CARBON]: { name: 'Carbone compressé', shape: 'lump', color: 0x2a2c36, stack: 99 },
  [I.COMPOSITE]: { name: 'Plaque composite', shape: 'plate', color: 0x4a4f63, stack: 99 },
  [I.STEEL]: { name: "Lingot d'acier", shape: 'ingot', color: 0x7c8496, stack: 99 },
  [I.ELECTRUM]: { name: "Lingot d'électrum", shape: 'ingot', color: 0xb8f0c8, stack: 99 },
  [I.SHEARS]: { name: 'Cisailles', shape: 'wire', color: 0xdfe3ea, stack: 1 },
  [I.CAN]: { name: 'Bidon vide', shape: 'cell', color: 0xc7ccd9, stack: 16 },
  [I.FUEL]: { name: 'Bidon de carburant', shape: 'cell', color: 0xff8a3d, stack: 16 },
  [I.OXY]: { name: "Cartouche d'oxygène", shape: 'cell', color: 0x7ef0ff, stack: 16 },
  [I.TITAN]: { name: 'Lingot de titane', shape: 'ingot', color: 0xbfd4ff, stack: 99 },
  [I.ENGINE]: { name: 'Moteur-fusée', shape: 'pack', color: 0xc7ccd9, stack: 4 },
  // Armure bionique : chaque pièce reçoit jusqu'à deux modules à l'atelier bionique.
  [I.BIO_HELM]: { name: 'Casque bionique', shape: 'helmet', color: 0x9fe8d8, stack: 1, bionic: true, armor: { slot: 0, points: 3 } },
  [I.BIO_CHEST]: { name: 'Plastron bionique', shape: 'chest', color: 0x9fe8d8, stack: 1, bionic: true, armor: { slot: 1, points: 6 } },
  [I.BIO_LEGS]: { name: 'Jambières bioniques', shape: 'legs', color: 0x9fe8d8, stack: 1, bionic: true, armor: { slot: 2, points: 5 } },
  [I.BIO_BOOTS]: { name: 'Bottes bioniques', shape: 'boots', color: 0x9fe8d8, stack: 1, bionic: true, armor: { slot: 3, points: 3 } },
  [I.MOD_NIGHT]: { name: 'Module : vision nocturne', shape: 'circuit', color: 0x9dff5a, stack: 16, mod: 'night' },
  [I.MOD_AIR]: { name: 'Module : respirateur', shape: 'circuit', color: 0x7ef0ff, stack: 16, mod: 'air' },
  [I.MOD_MAGNET]: { name: 'Module : aimant', shape: 'circuit', color: 0xff5470, stack: 16, mod: 'magnet' },
  [I.MOD_SHIELD]: { name: 'Module : bouclier', shape: 'circuit', color: 0xbcd4ff, stack: 16, mod: 'shield' },
  [I.MOD_SPEED]: { name: 'Module : vélocité', shape: 'circuit', color: 0xf4c95d, stack: 16, mod: 'speed' },
  [I.MOD_SPRING]: { name: 'Module : ressorts', shape: 'circuit', color: 0xc77dff, stack: 16, mod: 'spring' },
  [I.JELLY]: { name: 'Gelée lumineuse', shape: 'lump', color: 0x7dffb0, stack: 99, food: 3 },
  [I.SOUP]: { name: 'Soupe de champignons', shape: 'bucket', color: 0xb98a5a, stack: 16, food: 9 },
  [I.HOE]: { name: 'Houe', shape: 'hoe', color: 0xdfe3ea, stack: 1 },
  [I.JETPACK]: { name: 'Réacteur dorsal', shape: 'pack', color: 0x8d94a8, stack: 1, charge: { max: 600, use: 20 }, armor: { slot: 1, points: 2 } },
});

ITEMS[B.TANK].stack = 1; // un réservoir garde son contenu : il ne s'empile pas

// ---------- Enchantements ----------
// for : 'tool' (pioche, hache, pelle), 'pick', 'sword', 'dur' (tout ce qui s'use), 'armor', 'boots'
export const ENCHANTS = {
  eff: { name: 'Efficacité', max: 3, for: 'tool', tip: 'mine 30 % plus vite par niveau' },
  fort: { name: 'Fortune', max: 3, for: 'pick', tip: 'chance de doubler le butin des minerais' },
  unb: { name: 'Solidité', max: 3, for: 'dur', tip: "s'use moins vite" },
  sharp: { name: 'Tranchant', max: 4, for: 'sword', tip: '+2 dégâts par niveau' },
  prot: { name: 'Protection', max: 3, for: 'armor', tip: "+1 point d'armure par niveau" },
  feather: { name: 'Plume', max: 3, for: 'boots', tip: 'réduit les dégâts de chute' },
};
export function enchantsFor(id) {
  const it = ITEMS[id], out = [];
  if (!it) return out;
  const t = it.tool?.type;
  if (t && t !== 'sword') out.push('eff');
  if (t === 'pick') out.push('fort');
  if (t === 'sword') out.push('sharp');
  if (it.tool?.dur) out.push('unb');
  if (it.armor) out.push('prot');
  if (it.armor?.slot === 3) out.push('feather');
  return out;
}
// Modules bioniques : pièce d'armure qui les reçoit (0 casque, 1 plastron, 2 jambières, 3 bottes) et effet.
export const MODS = {
  night: { item: I.MOD_NIGHT, slot: 0, name: 'Vision nocturne', tip: "éclaire la nuit, les grottes et l'Éther" },
  air: { item: I.MOD_AIR, slot: 0, name: 'Respirateur', tip: "plus besoin d'oxygène dans l'Éther" },
  magnet: { item: I.MOD_MAGNET, slot: 1, name: 'Aimant', tip: 'ramasse les objets à six blocs' },
  shield: { item: I.MOD_SHIELD, slot: 1, name: 'Bouclier', tip: "+4 points d'armure" },
  speed: { item: I.MOD_SPEED, slot: 2, name: 'Vélocité', tip: 'marche et course 30 % plus rapides' },
  spring: { item: I.MOD_SPRING, slot: 3, name: 'Ressorts', tip: 'saute plus haut, plus de dégâts de chute' },
};
export const MOD_SLOTS = 2;
export const xpForLevel = (l) => 10 * l * l;
export const levelOf = (xp) => Math.floor(Math.sqrt(xp / 10));

// ---------- Recettes ----------
export const STATIONS = { bench: 'Établi' };
// Ordre d'affichage des catégories dans l'écran de fabrication.
export const CATS = ['Bases', 'Outils', 'Armures', 'Construction', 'Rangement', 'Logistique', 'Machines', 'Énergie', 'Combat', 'Exploration'];
export const RECIPES = [];
const R = (cat, out, n, ins, station = null) => RECIPES.push({ cat, out, n, ins, station });

R('Bases', B.PLANKS, 4, [[B.LOG, 1]]);
R('Bases', I.STICK, 4, [[B.PLANKS, 2]]);
R('Bases', B.BENCH, 1, [[B.PLANKS, 4]]);
R('Bases', B.FURNACE, 1, [[B.STONE, 8]], 'bench');
R('Exploration', I.GLIDER1, 1, [[I.STICK, 4], [B.LEAVES, 6]]);
R('Exploration', I.GLIDER2, 1, [[I.GLIDER1, 1], [I.FEATHER, 6], [I.IRON, 2]], 'bench');
R('Exploration', I.GLIDER3, 1, [[I.GLIDER2, 1], [I.COMPOSITE, 4], [I.WIRE, 4]], 'bench');
R('Exploration', I.GLIDER4, 1, [[I.GLIDER3, 1], [I.TITAN, 4]], 'bench');
R('Machines', B.COMPRESSOR, 1, [[I.PLATE, 6], [I.IRON, 4], [I.CIRCUIT, 2]], 'bench');
R('Machines', B.REFINERY, 1, [[I.PLATE, 6], [I.COPPER, 4], [I.CIRCUIT, 3], [I.BUCKET, 1]], 'bench');
R('Machines', B.ELECTRO, 1, [[I.PLATE, 4], [I.CIRCUIT, 3], [I.CELL, 1], [B.GLASS, 2]], 'bench');
R('Machines', B.MODBENCH, 1, [[I.TITAN, 4], [I.STEEL, 4], [I.ELECTRUM, 4]], 'bench');
R('Machines', B.ALLOY, 1, [[B.FURNACE, 1], [I.PLATE, 6], [I.CIRCUIT, 2]], 'bench');
R('Machines', B.CANNER, 1, [[I.PLATE, 4], [I.CIRCUIT, 2], [B.FLUID_PIPE, 2]], 'bench');
R('Logistique', I.CAN, 2, [[I.PLATE, 1]], 'bench');
R('Exploration', B.ROCKET, 1, [[I.COMPOSITE, 8], [I.STEEL, 8], [I.ENGINE, 1], [I.CIRCUIT, 8]], 'bench');
R('Armures', I.BIO_HELM, 1, [[I.TITAN, 5], [I.COMPOSITE, 2], [I.ELECTRUM, 2]], 'bench');
R('Armures', I.BIO_CHEST, 1, [[I.TITAN, 8], [I.COMPOSITE, 4], [I.ELECTRUM, 3]], 'bench');
R('Armures', I.BIO_LEGS, 1, [[I.TITAN, 7], [I.COMPOSITE, 3], [I.ELECTRUM, 2]], 'bench');
R('Armures', I.BIO_BOOTS, 1, [[I.TITAN, 4], [I.COMPOSITE, 2], [I.ELECTRUM, 2]], 'bench');
R('Bases', I.HOE, 1, [[I.IRON, 2], [I.STICK, 2]], 'bench');
R('Bases', I.BREAD, 1, [[I.WHEAT, 3]]);
R('Bases', I.SOUP, 1, [[I.MUSHROOM, 3]]);
R('Bases', B.TORCH, 4, [[I.STICK, 1], [I.COAL, 1]]);
R('Bases', B.TORCH, 4, [[I.STICK, 1], [I.JELLY, 1]]);
R('Bases', I.PIE, 1, [[I.WHEAT, 2], [I.MEAT_COOKED, 1], [I.BERRIES, 2]], 'bench');
TIERS.forEach((tier, ti) => TOOLS.forEach((tool, k) => R('Outils', toolId(ti, k), 1, [[tier.mat, tool.n], [I.STICK, tool.sticks]], 'bench')));
ARMOR_TIERS.forEach((at, ti) => ARMOR.forEach((a, k) => R('Armures', armorId(ti, k), 1, [[TIERS[at.tier].mat, a.n]], 'bench')));
R('Construction', B.STONE_BRICK, 4, [[B.STONE, 4]], 'bench');
R('Construction', B.SANDSTONE, 2, [[B.SAND, 4]], 'bench');
R('Construction', B.LANTERN, 2, [[B.CRYSTAL, 1], [I.IRON, 1]], 'bench');
R('Armures', I.CHITIN_HELM, 1, [[I.CHITIN, 4]], 'bench');
R('Armures', I.CHITIN_CHEST, 1, [[I.CHITIN, 7]], 'bench');
R('Armures', I.CHITIN_LEGS, 1, [[I.CHITIN, 6]], 'bench');
R('Armures', I.CHITIN_BOOTS, 1, [[I.CHITIN, 3]], 'bench');
R('Rangement', B.CHEST, 1, [[B.PLANKS, 8]], 'bench');
R('Rangement', B.DRAWER, 1, [[B.PLANKS, 4], [I.PLATE, 2]], 'bench');
R('Rangement', B.TERMINAL, 1, [[I.PLATE, 4], [I.CIRCUIT, 4], [B.CRYSTAL, 2]], 'bench');
R('Logistique', I.WRENCH, 1, [[I.IRON, 2], [I.STICK, 1]], 'bench');
R('Logistique', I.BUCKET, 1, [[I.IRON, 3]], 'bench');
R('Logistique', B.ITEM_PIPE, 8, [[I.PLATE, 2]], 'bench');
R('Logistique', B.FLUID_PIPE, 8, [[I.PLATE, 2], [I.COPPER, 1]], 'bench');
R('Logistique', B.TANK, 1, [[I.PLATE, 4], [B.CRYSTAL, 2]], 'bench');
R('Logistique', B.PUMP, 1, [[I.PLATE, 3], [I.CIRCUIT, 2], [I.BUCKET, 1]], 'bench');
R('Machines', B.STONER, 1, [[I.PLATE, 4], [I.CIRCUIT, 2], [I.BUCKET_WATER, 1], [I.BUCKET_LAVA, 1]], 'bench');
R('Machines', B.GROWER, 1, [[I.PLATE, 4], [I.CIRCUIT, 2], [B.CRYSTAL, 2], [B.DIRT, 4]], 'bench');
R('Machines', B.WASHER, 1, [[I.PLATE, 4], [I.CIRCUIT, 2], [I.BUCKET, 1]], 'bench');
R('Énergie', B.LAVA_GEN, 1, [[I.PLATE, 6], [I.CIRCUIT, 2], [B.BASALT, 4]], 'bench');
R('Exploration', I.COMPASS, 1, [[I.IRON, 2], [B.CRYSTAL, 1]], 'bench');
R('Exploration', I.BAIT, 1, [[I.EMBER_SHARD, 4], [I.DUST, 4], [B.URANITE, 1]], 'bench');
R('Exploration', I.WINGS, 1, [[I.HEART, 1], [I.JETPACK, 1], [I.FEATHER, 8], [I.FROST, 4]], 'bench');
R('Machines', B.CONDENSER, 1, [[I.PLATE, 6], [I.CIRCUIT, 4], [I.FEATHER, 4], [B.CRYSTAL, 2]], 'bench');
R('Machines', B.FORGE, 1, [[B.CASING, 4], [I.CIRCUIT, 6], [I.EMBER_SHARD, 6], [I.ROD, 1]], 'bench');
R('Exploration', B.LIGHTHOUSE, 1, [[I.STAR, 12], [I.HEART, 1], [B.CRYSTAL, 8], [I.CIRCUIT, 8]], 'bench');
R('Machines', B.ALTAR, 1, [[B.SLATE, 4], [B.CRYSTAL, 4], [I.DUST, 2]], 'bench');
R('Machines', B.CNC, 1, [[I.IRON, 6], [I.COPPER, 2], [B.CRYSTAL, 1]], 'bench');
R('Machines', B.E_FURNACE, 1, [[B.FURNACE, 1], [I.PLATE, 2], [I.WIRE, 4]], 'bench');
R('Machines', B.PRINTER, 1, [[I.PLATE, 6], [I.WIRE, 6], [B.CRYSTAL, 2]], 'bench');
R('Machines', B.CHARGER, 1, [[I.PLATE, 3], [I.CIRCUIT, 2]], 'bench');
R('Énergie', B.GENERATOR, 1, [[B.FURNACE, 1], [I.PLATE, 4], [I.WIRE, 2]], 'bench');
R('Énergie', B.SOLAR, 1, [[B.CRYSTAL, 3], [I.PLATE, 2], [I.WIRE, 2]], 'bench');
R('Énergie', B.BATTERY, 1, [[I.PLATE, 4], [I.WIRE, 4], [I.CELL, 2]], 'bench');
R('Énergie', B.CASING, 2, [[I.PLATE, 2], [B.BASALT, 2]], 'bench');
R('Énergie', B.CORE, 1, [[I.PLATE, 8], [I.CIRCUIT, 4], [I.EMBER_SHARD, 4], [B.CRYSTAL, 2]], 'bench');
R('Énergie', B.TURBINE, 1, [[I.IRON, 4], [I.COPPER, 2], [B.PLANKS, 4]], 'bench');
R('Énergie', B.CABLE, 6, [[I.COPPER, 1]], 'bench');
R('Construction', B.LAMP, 1, [[B.CRYSTAL, 1], [I.COPPER, 1]], 'bench');
R('Machines', B.FAN, 1, [[I.IRON, 3], [I.COPPER, 2]], 'bench');
R('Combat', B.TURRET, 1, [[I.IRON, 5], [I.COPPER, 3], [B.CRYSTAL, 1]], 'bench');
R('Combat', I.GUN, 1, [[I.IRON, 5], [I.COPPER, 2], [B.CRYSTAL, 2], [B.PLANKS, 2]], 'bench');
R('Combat', I.AMMO, 6, [[I.COPPER, 1], [I.COAL, 1]], 'bench');
R('Combat', I.AMMO, 12, [[I.COPPER, 1], [I.DUST, 1]], 'bench');
R('Combat', B.TNT, 2, [[I.DUST, 2], [I.COAL, 2], [B.PLANKS, 1]], 'bench');
R('Bases', I.SHEARS, 1, [[I.IRON, 2]], 'bench');
R('Construction', B.STEEL_BLOCK, 4, [[I.STEEL, 4]], 'bench');
R('Construction', B.MOONBRICK, 4, [[B.MOONROCK, 4]], 'bench');
R('Machines', B.HARVESTER, 1, [[I.STEEL, 4], [I.CIRCUIT, 3], [I.SHEARS, 1]], 'bench');
R('Machines', B.SPRINKLER, 1, [[I.PLATE, 3], [I.COPPER, 2], [I.BUCKET, 1]], 'bench');
R('Exploration', B.TELEPAD, 2, [[I.STEEL, 4], [I.ELECTRUM, 4], [B.CRYSTAL, 4], [I.CELL, 2]], 'bench');
R('Exploration', B.HAMMOCK, 1, [[B.PLANKS, 3], [B.WOOL, 2], [I.STICK, 2]], 'bench');
R('Exploration', B.HAMMOCK, 1, [[B.PLANKS, 3], [I.FEATHER, 4], [I.STICK, 2]], 'bench');
R('Construction', B.BOUNCE, 1, [[I.JELLY, 4]], 'bench');
R('Exploration', I.HOOK, 1, [[I.IRON, 3], [I.STICK, 4]], 'bench');
R('Exploration', B.BEACON, 1, [[B.PLANKS, 3], [I.FEATHER, 2], [B.CRYSTAL, 1]], 'bench');
R('Exploration', B.PORTAL, 1, [[B.SLATE, 4], [B.CRYSTAL, 4], [I.DUST, 2]], 'bench');

// ---------- Inventaire ----------
export class Inventory {
  constructor() {
    this.slots = new Array(36).fill(null); // 0-8 : barre rapide
    this.armor = [null, null, null, null];
  }

  add(id, n = 1) {
    const it = ITEMS[id];
    if (it.stack > 1) {
      for (const s of this.slots) {
        if (n <= 0) break;
        if (s && s.id === id && s.n < it.stack) { const m = Math.min(n, it.stack - s.n); s.n += m; n -= m; }
      }
    }
    for (let i = 0; i < this.slots.length && n > 0; i++) {
      if (this.slots[i]) continue;
      const m = Math.min(n, it.stack);
      this.slots[i] = { id, n: m };
      if (it.tool?.dur) this.slots[i].d = it.tool.dur;
      if (it.charge) this.slots[i].c = 0;
      n -= m;
    }
    return n; // ce qui n'a pas pu entrer
  }

  // Range une pile existante en conservant son usure et sa charge.
  addStack(st) {
    if (ITEMS[st.id].stack > 1 && !st.f && !st.e && !st.m) return this.add(st.id, st.n);
    const i = this.slots.indexOf(null);
    if (i < 0) return st.n;
    this.slots[i] = { ...st };
    return 0;
  }

  count(id) { return this.slots.reduce((t, s) => t + (s && s.id === id ? s.n : 0), 0); }

  remove(id, n) {
    for (let i = this.slots.length - 1; i >= 0 && n > 0; i--) {
      const s = this.slots[i];
      if (!s || s.id !== id) continue;
      const m = Math.min(n, s.n);
      s.n -= m; n -= m;
      if (s.n <= 0) this.slots[i] = null;
    }
  }

  canCraft(r) { return r.ins.every(([id, n]) => this.count(id) >= n); }
  craft(r) {
    if (!this.canCraft(r)) return false;
    for (const [id, n] of r.ins) this.remove(id, n);
    this.add(r.out, r.n);
    return true;
  }

  armorPoints() { return this.armor.reduce((t, s) => t + (s ? ITEMS[s.id].armor.points + (s.e?.prot ?? 0) + (s.m?.includes('shield') ? 4 : 0) : 0), 0); }
  // Un module bionique est-il installé sur une pièce portée ?
  hasMod(k) { return this.armor.some((s) => s?.m?.includes(k)); }
  // Meilleur planeur du sac, ou null.
  glider() { let best = null; for (const s of this.slots) { const g = s && ITEMS[s.id].glide; if (g && (!best || g.tier > best.tier)) best = g; } return best; }

  toJSON() { return { slots: this.slots, armor: this.armor }; }
  load(data) {
    if (!data) return;
    // Objets retirés du jeu : remplacés par leur équivalent.
    const moved = { [B.LEVER_OFF]: B.CABLE, [B.LEVER_ON]: B.CABLE, [B.THERMAL]: B.LAVA_GEN, [B.SIEVE]: I.PLATE };
    const ok = (s) => (s && ITEMS[s.id] ? (moved[s.id] ? { id: moved[s.id], n: s.n } : s) : null);
    this.slots = Array.from({ length: 36 }, (_, i) => ok(data.slots?.[i]));
    const old = data.armor ?? [];
    // Anciennes sauvegardes : trois pièces, les bottes en dernière position.
    this.armor = (old.length === 3 ? [old[0], old[1], null, old[2]] : [0, 1, 2, 3].map((i) => old[i])).map(ok);
  }
}
