import * as THREE from 'three';

// Atlas de textures 16x16 et icônes d'objets, entièrement dessinés par le code.
export const TILE = 16;
export const ATLAS = 16;

const NAMES = [
  'GRASS_TOP', 'GRASS_SIDE', 'DIRT', 'STONE', 'MOSS_TOP', 'MOSS_SIDE', 'LOG_SIDE', 'LOG_TOP',
  'LEAVES', 'SNOW', 'SLATE', 'CRYSTAL', 'PLANKS', 'COAL_ORE', 'IRON_ORE', 'COPPER_ORE',
  'BUSH', 'BENCH_TOP', 'BENCH_SIDE', 'FURNACE_SIDE', 'FURNACE_TOP', 'CABLE', 'CABLE_ON', 'TURBINE_SIDE',
  'TURBINE_TOP', 'LAMP_OFF', 'LAMP_ON', 'LEVER_OFF', 'LEVER_ON', 'FAN_TOP', 'MACHINE', 'TURRET_SIDE',
  'PORTAL', 'BASALT', 'EMBER', 'BRAISITE', 'ASH', 'MYCEL_TOP', 'MYCEL_SIDE', 'STEM',
  'CAP', 'TNT_SIDE', 'TNT_TOP', 'BEACON', 'CHEST_TOP', 'CHEST_SIDE', 'EFURNACE', 'GENERATOR',
  'SOLAR_TOP', 'THERMAL', 'BATTERY', 'CNC', 'PRINTER', 'CHARGER', 'CORE', 'CASING', 'URANITE',
  'WATER', 'LAVA', 'ITEM_PIPE', 'FLUID_PIPE', 'TANK', 'PUMP', 'STONER', 'SIEVE', 'GROWER', 'WASHER', 'LAVAGEN',
  'DRAWER', 'TERMINAL', 'ALTAR_TOP', 'ALTAR_SIDE', 'SAND', 'SANDSTONE', 'CACTUS_SIDE', 'CACTUS_TOP', 'ICE', 'PINE_LEAVES',
  'STONE_BRICK', 'GLASS', 'LANTERN',
  // Matières unies des modèles de machines
  'M_DARK', 'M_STEEL', 'M_COPPER', 'M_BLACK', 'M_HOT', 'M_CYAN', 'M_GREEN', 'M_RED', 'M_BLUE', 'M_GLASS', 'M_GRILL', 'M_WHITE', 'M_GOLD', 'M_VIOLET',
  'FORGE', 'CONDENSER', 'FARMLAND', 'CROP', 'CROP_RIPE', 'M_ORANGE', 'JELLY',
];
export const T = Object.fromEntries(NAMES.map((n, i) => [n, i]));

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hex = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
const mul = (c, f) => [c[0] * f, c[1] * f, c[2] * f];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const css = (c) => `rgb(${c.map((v) => Math.max(0, Math.min(255, Math.round(v)))).join(',')})`;

// Formes 8x8 des objets. a = couleur, A = couleur sombre, w = reflet, h = manche,
// k = tige, o = orange, y = laiton.
const SHAPES = {
  pick: [
    '................', '......aaaaaa....', '....aaawwwaaaa..', '...aaa....aaaaa.', '..aa.......haaA.', '..a.......hd.aA.',
    '..........hd..aA', '.........hd...aA', '........hd....aA', '.......hd......A', '......hd........', '.....hd.........',
    '....hd..........', '...hd...........', '..hd............', '.hd.............',
  ],
  axe: [
    '................', '..........aa....', '.........aaaa...', '........aawaaa..', '.......aawaahaa.', '.......aaaahdaA.',
    '........aAhd.AA.', '.........hd.....', '........hd......', '.......hd.......', '......hd........', '.....hd.........',
    '....hd..........', '...hd...........', '..hd............', '.hd.............',
  ],
  shovel: [
    '................', '...........aaa..', '..........aawaa.', '..........awaaa.', '..........aaaaA.', '..........ahAA..',
    '..........hd....', '.........hd.....', '........hd......', '.......hd.......', '......hd........', '.....hd.........',
    '....hd..........', '...hd...........', '..hd............', '.hd.............',
  ],
  sword: [
    '.............aaw', '............aawa', '...........aawa.', '..........aawa..', '.........aawa...', '........aawa....',
    '.......aawa.....', '......aawa......', '..A..aawa.......', '..AAaawa........', '...AAAa.........', '...hAAA.........',
    '..hd.AA.........', '.hd.............', 'hd..............', '................',
  ],
  gun: [
    '................', '................', '................', '................', '................', '................',
    '.aaaaaaaaaaww...', '.AAAAAAAAAAaahh.', '..o.......Ahhhh.', '..........kkhhh.', '...........hhhd.', '............hhd.',
    '............hdd.', '................', '................', '................',
  ],
  helmet: ['........', '..aaaa..', '.awaaaa.', '.aaaaaa.', '.aA..Aa.', '.a....a.', '........', '........'],
  chest: ['........', 'aa....aa', 'aaa..aaa', 'awaaaaaa', '.aaAAaa.', '.aaaaaa.', '.aaaaaa.', '.AAAAAA.'],
  boots: ['........', '.aa..aa.', '.aa..aa.', '.aw..aw.', '.aa..aa.', 'aaa..aaa', 'AAA..AAA', '........'],
  stick: ['......h.', '.....hd.', '....hd..', '...hd...', '..hd....', '.hd.....', '.d......', '........'],
  lump: ['........', '..aa....', '.aawAa..', '.aaaaAa.', 'aaAaaaA.', '.aaaaA..', '..AAA...', '........'],
  ingot: ['........', '........', '..aaaaaa', '.awwwaaA', 'aaaaaaA.', 'AAAAAA..', '........', '........'],
  meat: ['........', '..aaa...', '.aawaa..', '.aaaaaa.', '..Aaaaa.', '...AA.w.', '.....ww.', '......w.'],
  berries: ['....k...', '...k.k..', '..aa..aa', '.aawa.aw', '.aaaa.aa', '..AA....', '........', '........'],
  ammo: ['........', '..y..y..', '.yyy.yyy', '.aaa.aaa', '.awa.awa', '.aaa.aaa', '.AAA.AAA', '........'],
  hook: ['.aa..aa.', 'a..aa..a', 'a..aa..a', '...aa...', '...hd...', '..hd....', '.hd.....', 'hd......'],
  feather: ['......aa', '.....aaw', '....aaw.', '...aaw..', '..aAa...', '.hA.....', 'h.......', '........'],
  plate: ['........', '.aaaaaa.', '.awwaaa.', '.awaaaa.', '.aaaaaA.', '.aaaaAA.', '.AAAAAA.', '........'],
  wire: ['..aaaa..', '.aAAAAa.', 'aA....Aa', 'aA....Aa', 'aA....Aa', 'aA....Aa', '.aAAAAa.', '..aaaa.a'],
  circuit: ['........', '.aaaaaa.', '.ayaaya.', '.ayyyya.', '.aakkaa.', '.ayaaya.', '.aaaaaa.', '.y.yy.y.'],
  cell: ['...yy...', '..aaaa..', '..awaa..', '..aoaa..', '..aooa..', '..aoaa..', '..aaaA..', '..AAAA..'],
  rod: ['...kk...', '...aw...', '...aw...', '...aa...', '...aa...', '...aa...', '...aA...', '...kk...'],
  drill: ['........', '.....aa.', '..y.aaaa', '.yyyawaa', 'yyyyaaaA', '.yyyaaAA', '..y..hh.', '.....hd.'],
  pack: ['........', '.aa..aa.', '.awaaaw.', '.aaAAaa.', '.aaAAaa.', '.aa..aa.', '.oo..oo.', '..o..o..'],
  legs: ['........', '.aaaaaa.', '.awaaaa.', '.aa..aa.', '.aa..aa.', '.aa..aa.', '.aA..aA.', '........'],
  bucket: ['........', 'A......A', 'aAAAAAAa', 'aoooooow', '.aooooa.', '.aaaaaa.', '..aaaa..', '........'],
  hoe: ['...aaaa.', '....hdAa', '...hd..A', '..hd....', '.hd.....', 'hd......', 'd.......', '........'],
  wrench: ['.....a.a', '.....aaa', '....aaa.', '...aa...', '..aa....', '.aa.....', 'aA......', 'A.......'],
  coin: ['........', '..aaaa..', '.awwaaa.', '.awaaAa.', '.aaaaAa.', '.aaAAAa.', '..aaaa..', '........'],
  seed: ['........', '...ak...', '..aawk..', '.aawaak.', '.aaaaaA.', '..aaaA..', '...AA...', '........'],
  dustp: ['........', '........', '...a....', '..aaa.a.', '.aawaaa.', 'aaaaaaaA', '.AAAAAA.', '........'],
  heart: ['........', '.aa..aa.', 'awaaaaaa', 'aaaaaaaA', '.aaaaaA.', '..aaaA..', '...aA...', '........'],
  wing: ['.......a', '.....aaa', '...aaawa', '.aaawaaA', 'aaawaaA.', '.aaaaA..', '..aAA...', '...A....'],
  compass: ['..aaaa..', '.aAAAAa.', 'aA.o..Aa', 'aA.oo.Aa', 'aA.ww.Aa', 'aA..w.Aa', '.aAAAAa.', '..aaaa..'],
  cap: ['........', '..aaaa..', '.awaaaa.', 'aaaawaaa', 'AAAAAAAA', '...ww...', '...ww...', '..wwww..'],
};

export function makeAtlas() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = TILE * ATLAS;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(canvas.width, canvas.height);

  const paint = (tile, fn) => {
    const r = rng(tile * 7919 + 13);
    const ox = (tile % ATLAS) * TILE, oy = Math.floor(tile / ATLAS) * TILE;
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      const c = fn(x, y, r);
      const i = ((oy + y) * canvas.width + ox + x) * 4;
      img.data[i] = Math.max(0, Math.min(255, c[0]));
      img.data[i + 1] = Math.max(0, Math.min(255, c[1]));
      img.data[i + 2] = Math.max(0, Math.min(255, c[2]));
      img.data[i + 3] = c[3] ?? 255; // quatrième valeur facultative : transparence (verre)
    }
  };

  const GRASS = hex(0x5fbf8a), DIRT = hex(0x8a5a44), STONE = hex(0x8d8fa3), MOSS = hex(0x3f8f6b);
  const PLANK = hex(0xd9a35f), METAL = hex(0x7c8496), BASALT = hex(0x2b2730);

  const dirt = (x, y, r) => {
    const v = r();
    return v > 0.9 ? mul(DIRT, 0.72) : v < 0.08 ? mul(DIRT, 1.22) : mul(DIRT, 0.92 + r() * 0.16);
  };
  const grassTop = (base, fleck) => (x, y, r) => (r() > 0.93 ? fleck : mul(base, 0.88 + r() * 0.24));
  const sideOf = (top) => (x, y, r) => {
    const edge = 3 + ((x * 7 + (x >> 1) * 3) % 3);
    return y < edge ? mul(top, 0.85 + r() * 0.22) : dirt(x, y, r);
  };
  const stone = (x, y, r) => {
    const crack = ((x + y * 3) % 11 === 0 && r() > 0.3) || ((x * 5 + y) % 13 === 0 && r() > 0.5);
    return crack ? mul(STONE, 0.7) : mul(STONE, 0.9 + r() * 0.18);
  };
  const ore = (base, color) => (x, y, r) => {
    const b = base(x, y, r);
    const cx = x >> 1, cy = y >> 1;
    const spot = (cx * 5 + cy * 3) % 7 === 0 || (cx * 3 + cy * 7) % 11 === 0;
    return spot ? mul(color, 0.85 + r() * 0.3) : b;
  };
  const planks = (x, y, r) => {
    if (y % 4 === 3) return mul(PLANK, 0.62);
    const row = Math.floor(y / 4);
    if ((x + row * 5) % 16 === 0) return mul(PLANK, 0.7);
    return mul(PLANK, 0.92 + r() * 0.12 + (row % 2) * 0.05);
  };
  const metal = (x, y, r) => {
    const rim = x === 0 || y === 0 || x === 15 || y === 15;
    const rivet = (x === 2 || x === 13) && (y === 2 || y === 13);
    return rivet ? mul(METAL, 1.5) : rim ? mul(METAL, 0.6) : mul(METAL, 0.94 + r() * 0.1);
  };
  const basalt = (x, y, r) => mul(BASALT, (x % 5 === 0 ? 0.65 : 1) * (0.88 + r() * 0.3));
  const bricks = (x, y, r) => {
    const row = y >> 2;
    const joint = y % 4 === 3 || (x + row * 4) % 8 === 0;
    return joint ? mul(STONE, 0.55) : mul(STONE, 0.8 + r() * 0.14);
  };
  const cable = (color) => (x, y, r) => {
    const wire = (x >= 6 && x <= 9) || (y >= 6 && y <= 9);
    return wire ? mul(color, 0.9 + r() * 0.2) : mul(hex(0x2c2a35), 0.85 + r() * 0.3);
  };
  const lamp = (inner) => (x, y, r) => {
    if (x < 2 || y < 2 || x > 13 || y > 13) return mul(hex(0x3d3f4c), 0.9 + r() * 0.2);
    return (x === 7 || x === 8 || y === 7 || y === 8) ? mul(inner, 0.82) : mul(inner, 0.95 + r() * 0.1);
  };
  const lever = (on) => (x, y, r) => {
    if (x >= 5 && x <= 10 && y >= 3 && y <= 12) {
      const knobY = on ? 4 : 9;
      if (x >= 6 && x <= 9 && y >= knobY && y <= knobY + 2) return on ? hex(0x6fe07a) : hex(0xe0564f);
      if (x >= 7 && x <= 8) return hex(0x22232b);
      return hex(0x4a4d5c);
    }
    return stone(x, y, r);
  };

  paint(T.GRASS_TOP, grassTop(GRASS, hex(0xa6e3a1)));
  paint(T.GRASS_SIDE, sideOf(GRASS));
  paint(T.DIRT, dirt);
  paint(T.STONE, stone);
  paint(T.MOSS_TOP, grassTop(MOSS, hex(0xe6c95a)));
  paint(T.MOSS_SIDE, sideOf(MOSS));
  paint(T.LOG_SIDE, (x, y, r) => mul(hex(0x6b4a3a), (x % 4 === 0 ? 0.74 : x % 4 === 2 ? 1.1 : 0.95) + r() * 0.08));
  paint(T.LOG_TOP, (x, y, r) => {
    const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
    if (d > 6.6) return mul(hex(0x6b4a3a), 0.85 + r() * 0.1);
    return mul(hex(0xc99a6b), (Math.floor(d) % 2 ? 0.86 : 1.04) + r() * 0.05);
  });
  paint(T.LEAVES, (x, y, r) => {
    const v = r(), c = hex(0xe8795a);
    return v > 0.82 ? hex(0xf6b26b) : v < 0.2 ? mul(c, 0.68) : mul(c, 0.92 + r() * 0.14);
  });
  paint(T.SNOW, (x, y, r) => (r() > 0.9 ? hex(0xcfe0f5) : mul(hex(0xf1f5fc), 0.97 + r() * 0.05)));
  paint(T.SLATE, (x, y, r) => {
    const v = r(), c = hex(0x3b3550);
    return v > 0.94 ? hex(0x7b5ea7) : (y % 5 === 4 ? mul(c, 0.78) : mul(c, 0.9 + r() * 0.22));
  });
  paint(T.CRYSTAL, (x, y, r) => {
    const c = mix(hex(0x37c8e8), hex(0xe9fdff), ((x + y) % 6) / 5);
    return x === 0 || y === 0 || x === 15 || y === 15 ? hex(0x2aa3c7) : mul(c, 0.96 + r() * 0.08);
  });
  paint(T.PLANKS, planks);
  paint(T.COAL_ORE, ore(stone, hex(0x24222b)));
  paint(T.IRON_ORE, ore(stone, hex(0xe2b193)));
  paint(T.COPPER_ORE, ore(stone, hex(0xe0822f)));
  paint(T.BUSH, (x, y, r) => {
    const berry = (x * 7 + y * 5) % 13 === 0;
    return berry ? hex(0xd9368b) : mul(hex(0x4fa860), 0.72 + r() * 0.45);
  });
  paint(T.BENCH_TOP, (x, y, r) => ((x === 5 || x === 10 || y === 5 || y === 10) ? mul(PLANK, 0.55) : mul(PLANK, 0.85 + r() * 0.12)));
  paint(T.BENCH_SIDE, (x, y, r) => {
    if (y < 3) return mul(PLANK, 0.6);
    if (x >= 4 && x <= 11 && y >= 6 && y <= 12) return (x === 4 || x === 11 || y === 6 || y === 12) ? mul(PLANK, 0.5) : mul(hex(0x8a5a44), 0.9 + r() * 0.15);
    return planks(x, y, r);
  });
  paint(T.FURNACE_SIDE, (x, y, r) => {
    if (x >= 4 && x <= 11 && y >= 7 && y <= 13) {
      if (y >= 11) return mix(hex(0xff6a1f), hex(0xffd27a), r());
      return hex(0x1a1820);
    }
    return bricks(x, y, r);
  });
  paint(T.FURNACE_TOP, bricks);
  paint(T.CABLE, cable(hex(0xb5622f)));
  paint(T.CABLE_ON, cable(hex(0xffd86b)));
  paint(T.TURBINE_SIDE, (x, y, r) => {
    const blade = (Math.abs(x - y) <= 1 || Math.abs(x + y - 15) <= 1) && x > 1 && x < 14;
    const hub = Math.abs(x - 7.5) < 2 && Math.abs(y - 7.5) < 2;
    return hub ? hex(0x5fbf8a) : blade ? hex(0xf1f5fc) : metal(x, y, r);
  });
  paint(T.TURBINE_TOP, (x, y, r) => (Math.hypot(x - 7.5, y - 7.5) < 3.5 ? hex(0x5fbf8a) : metal(x, y, r)));
  paint(T.LAMP_OFF, lamp(hex(0x5a5f6e)));
  paint(T.LAMP_ON, lamp(hex(0xfff3b0)));
  paint(T.LEVER_OFF, lever(false));
  paint(T.LEVER_ON, lever(true));
  paint(T.FAN_TOP, (x, y, r) => {
    const d = Math.hypot(x - 7.5, y - 7.5);
    if (d > 6.5) return metal(x, y, r);
    const spoke = Math.abs(x - 7.5) < 1 || Math.abs(y - 7.5) < 1 || d < 1.8;
    return spoke ? hex(0xc7ccd9) : hex(0x17181f);
  });
  paint(T.MACHINE, (x, y, r) => ((y === 5 || y === 8 || y === 11) && x > 3 && x < 12 ? hex(0x2c2e3a) : metal(x, y, r)));
  paint(T.TURRET_SIDE, (x, y, r) => {
    if (y >= 6 && y <= 9 && x >= 3 && x <= 12) return (x >= 7 && x <= 8 && y >= 7 && y <= 8) ? hex(0xff4d4d) : hex(0x17181f);
    return metal(x, y, r);
  });
  paint(T.PORTAL, (x, y, r) => {
    const d = Math.hypot(x - 7.5, y - 7.5);
    const s = Math.sin(d * 1.3 + Math.atan2(y - 7.5, x - 7.5) * 2);
    return mix(hex(0x6a2bd9), hex(0x7ef0ff), s * 0.5 + 0.5 + (r() - 0.5) * 0.2);
  });
  paint(T.BASALT, basalt);
  paint(T.EMBER, (x, y, r) => mix(hex(0xff4a12), hex(0xffd866), Math.pow(r(), 2)));
  paint(T.BRAISITE, ore(basalt, hex(0xff8a2a)));
  paint(T.ASH, (x, y, r) => mul(hex(0x6a6470), 0.8 + r() * 0.35));
  const MYCEL = hex(0x8a5fc4);
  paint(T.MYCEL_TOP, grassTop(MYCEL, hex(0x7ef0c8)));
  paint(T.MYCEL_SIDE, sideOf(MYCEL));
  paint(T.STEM, (x, y, r) => mul(hex(0xf0e6d6), (x % 5 === 0 ? 0.84 : 1) * (0.92 + r() * 0.1)));
  paint(T.CAP, (x, y, r) => {
    const spot = Math.hypot((x % 8) - 3.5, (y % 8) - 3.5) < 1.6;
    return spot ? hex(0xeafff8) : mul(hex(0x2fd4b0), 0.88 + r() * 0.2);
  });
  paint(T.TNT_SIDE, (x, y, r) => {
    if (y >= 6 && y <= 9) return (x % 4 === 1 || (x % 4 === 2 && y % 2)) ? hex(0x2a2530) : hex(0xf4e7c5);
    return x % 4 === 0 ? hex(0x8f2b22) : mul(hex(0xd9483b), 0.9 + r() * 0.15);
  });
  paint(T.TNT_TOP, (x, y, r) => (Math.hypot(x - 7.5, y - 7.5) < 2 ? hex(0x2a2530) : mul(hex(0xd9483b), 0.85 + r() * 0.2)));
  const machine = (draw) => (x, y, r) => draw(x, y, r) ?? metal(x, y, r);
  paint(T.CHEST_TOP, (x, y, r) => ((x === 0 || y === 0 || x === 15 || y === 15) ? mul(PLANK, 0.5) : (x === 7 || x === 8) ? mul(hex(0x6b6f80), 0.9) : mul(PLANK, 0.8 + r() * 0.12)));
  paint(T.CHEST_SIDE, (x, y, r) => {
    if (x === 0 || y === 0 || x === 15 || y === 15 || y === 5) return mul(PLANK, 0.5);
    if (x >= 6 && x <= 9 && y >= 4 && y <= 8) return (x === 7 || x === 8) && y >= 5 && y <= 7 ? hex(0xf4c95d) : hex(0x6b6f80);
    return mul(PLANK, 0.78 + r() * 0.14);
  });
  paint(T.EFURNACE, machine((x, y, r) => {
    if (x >= 3 && x <= 12 && y >= 6 && y <= 12) return (y % 2 === 0) ? mix(hex(0xff7a2a), hex(0xffe08a), r()) : hex(0x1a1820);
    if (y === 3 && x >= 3 && x <= 5) return hex(0x7ef0ff);
  }));
  paint(T.GENERATOR, machine((x, y, r) => {
    if (x >= 4 && x <= 11 && y >= 8 && y <= 12) return y >= 11 ? mix(hex(0xff6a1f), hex(0xffd27a), r()) : hex(0x1a1820);
    if (y >= 3 && y <= 5 && x >= 4 && x <= 11) return x % 2 ? hex(0x2c2e3a) : hex(0xf4c95d);
  }));
  paint(T.SOLAR_TOP, (x, y, r) => ((x % 5 === 0 || y % 5 === 0) ? hex(0xc7ccd9) : mix(hex(0x1c3f8f), hex(0x3f7fe0), (x + y) / 30 + r() * 0.1)));
  paint(T.THERMAL, machine((x, y, r) => {
    if (x >= 3 && x <= 12 && y >= 4 && y <= 11) return (x + y) % 3 === 0 ? hex(0xffb347) : hex(0x8f2b22);
  }));
  paint(T.BATTERY, machine((x, y, r) => {
    if (x >= 5 && x <= 10 && y >= 3 && y <= 12) return y >= 6 ? hex(0x6fe07a) : hex(0x22232b);
    if (x >= 7 && x <= 8 && y === 2) return hex(0xf4c95d);
  }));
  paint(T.CNC, machine((x, y, r) => {
    if (x >= 3 && x <= 12 && y >= 4 && y <= 11) return (Math.abs(x - 7.5) < 1 && y < 9) ? hex(0xe0e4ee) : (y === 11 ? hex(0xb5622f) : hex(0x2a3140));
  }));
  paint(T.PRINTER, machine((x, y, r) => {
    if (x >= 3 && x <= 12 && y >= 4 && y <= 12) return (y >= 10 && x >= 5 && x <= 10) ? hex(0x2fd4b0) : (y === 5 && x % 2 ? hex(0xff9a3d) : hex(0x20222c));
  }));
  paint(T.CHARGER, machine((x, y, r) => {
    const bolt = (y >= 3 && y <= 7 && x === 10 - Math.floor((y - 3) / 2)) || (y === 8 && x >= 6 && x <= 9) || (y >= 9 && y <= 12 && x === 8 - Math.floor((y - 9) / 2));
    if (bolt) return hex(0xffe14d);
    if (x >= 4 && x <= 11 && y >= 2 && y <= 13) return hex(0x20222c);
  }));
  paint(T.CORE, machine((x, y, r) => {
    const d = Math.hypot(x - 7.5, y - 7.5);
    if (d < 3) return mix(hex(0x9dff5a), hex(0xeaffd0), r());
    if (d < 5) return hex(0x1d3b22);
  }));
  paint(T.CASING, (x, y, r) => {
    const rim = x === 0 || y === 0 || x === 15 || y === 15;
    const stripe = (x + y) % 8 < 2 && x > 2 && x < 13 && y > 2 && y < 13;
    return rim ? hex(0x2a2c36) : stripe ? hex(0xe8c33c) : mul(hex(0x555a6b), 0.92 + r() * 0.12);
  });
  paint(T.URANITE, ore(basalt, hex(0x9dff5a)));
  paint(T.WATER, (x, y, r) => mix(hex(0x2f7fd9), hex(0x6fc3ee), ((x + y * 2) % 7 === 0 ? 0.8 : 0.2) + r() * 0.2));
  paint(T.LAVA, (x, y, r) => mix(hex(0xff3d0a), hex(0xffd23d), Math.pow(r(), 1.6) * ((x + y) % 5 === 0 ? 1 : 0.7)));
  const pipe = (core) => (x, y, r) => {
    const tube = (x >= 5 && x <= 10) || (y >= 5 && y <= 10);
    if (!tube) return mul(hex(0x30323d), 0.85 + r() * 0.25);
    const inner = (x >= 7 && x <= 8) || (y >= 7 && y <= 8);
    return inner ? core : hex(0xaab0c0);
  };
  paint(T.ITEM_PIPE, pipe(hex(0xf4c95d)));
  paint(T.FLUID_PIPE, pipe(hex(0x3f9be0)));
  paint(T.TANK, (x, y, r) => {
    if (x < 2 || y < 2 || x > 13 || y > 13) return metal(x, y, r);
    return y > 6 ? mix(hex(0x2f7fd9), hex(0x6fc3ee), r() * 0.5) : mix(hex(0xbfe6f5), hex(0xe9fbff), r());
  });
  paint(T.PUMP, machine((x, y, r) => {
    if (x >= 6 && x <= 9 && y >= 2 && y <= 13) return y % 3 === 0 ? hex(0x1f5fa8) : hex(0x3f9be0);
    if (y >= 6 && y <= 9 && x >= 3 && x <= 12) return hex(0x22232b);
  }));
  paint(T.STONER, machine((x, y, r) => {
    if (x >= 3 && x <= 12 && y >= 4 && y <= 11) return x < 8 ? mix(hex(0x2f7fd9), hex(0x6fc3ee), r()) : mix(hex(0xff3d0a), hex(0xffd23d), r());
    if (y >= 12 && y <= 13 && x >= 6 && x <= 9) return hex(0x8d8fa3);
  }));
  paint(T.SIEVE, machine((x, y, r) => {
    if (x >= 3 && x <= 12 && y >= 3 && y <= 12) return (x + y) % 2 ? hex(0xe9fdff) : hex(0x2a3140);
  }));
  paint(T.GROWER, machine((x, y, r) => {
    if (x >= 3 && x <= 12 && y >= 3 && y <= 12) return y >= 10 ? hex(0x6b4a3a) : (Math.abs(x - 7.5) < 1.2 || (y < 7 && Math.abs(x - 7.5) < 3 - (y - 3) * 0.4)) ? hex(0x5fdc8a) : hex(0x17202a);
  }));
  paint(T.WASHER, machine((x, y, r) => {
    const d = Math.hypot(x - 7.5, y - 7.5);
    if (d < 5) return d < 3.6 ? mix(hex(0x2f7fd9), hex(0xbfe6f5), r()) : hex(0x20222c);
  }));
  paint(T.LAVAGEN, machine((x, y, r) => {
    if (x >= 3 && x <= 12 && y >= 7 && y <= 12) return mix(hex(0xff3d0a), hex(0xffd23d), r());
    if (y >= 3 && y <= 5 && x >= 4 && x <= 11) return x % 2 ? hex(0x2c2e3a) : hex(0xf4c95d);
  }));
  paint(T.DRAWER, (x, y, r) => {
    if (x === 0 || y === 0 || x === 15 || y === 15 || y === 7 || y === 8) return mul(PLANK, 0.45);
    if (x >= 6 && x <= 9 && (y === 4 || y === 11)) return hex(0xc7ccd9);
    return mul(PLANK, 0.72 + r() * 0.12);
  });
  paint(T.TERMINAL, machine((x, y, r) => {
    if (x >= 2 && x <= 13 && y >= 2 && y <= 10) return ((x - 2) % 4 === 3 || (y - 2) % 3 === 2) ? hex(0x10202a) : mix(hex(0x2fd4b0), hex(0x7ef0ff), r());
    if (y === 12 && x >= 4 && x <= 11) return x % 2 ? hex(0x2c2e3a) : hex(0x7ef0ff);
  }));
  paint(T.ALTAR_TOP, (x, y, r) => {
    const d = Math.hypot(x - 7.5, y - 7.5);
    return Math.abs(d - 5) < 0.8 || Math.abs(d - 2.2) < 0.7 ? hex(0xc77dff) : mul(hex(0x3b3550), 0.85 + r() * 0.25);
  });
  paint(T.ALTAR_SIDE, (x, y, r) => (y < 3 ? hex(0x7b5ea7) : (x + y) % 6 === 0 ? hex(0xc77dff) : mul(hex(0x3b3550), 0.85 + r() * 0.25)));
  paint(T.SAND, (x, y, r) => { const v = r(); return v > 0.93 ? hex(0xcdb36f) : mul(hex(0xe8d59a), 0.93 + r() * 0.12); });
  paint(T.SANDSTONE, (x, y, r) => mul(hex(0xd9bd7c), (y % 5 === 0 ? 0.78 : y % 5 === 2 ? 1.06 : 0.95) + r() * 0.06));
  paint(T.CACTUS_SIDE, (x, y, r) => (x % 4 === 1 ? (y % 3 === 0 ? hex(0xf3f6d0) : hex(0x2f7340)) : mul(hex(0x4f9e5a), 0.9 + r() * 0.15)));
  paint(T.CACTUS_TOP, (x, y, r) => (Math.hypot(x - 7.5, y - 7.5) < 3 ? hex(0x9fd87a) : mul(hex(0x4f9e5a), 0.85 + r() * 0.15)));
  paint(T.ICE, (x, y, r) => (((x * 3 + y * 2) % 13 === 0 || (x - y + 16) % 11 === 0) ? hex(0xf2fbff) : mix(hex(0x8fd0ee), hex(0xbfe9fa), r())));
  paint(T.PINE_LEAVES, (x, y, r) => { const v = r(); return v > 0.88 ? hex(0x5fc49a) : v < 0.25 ? hex(0x1d5a4c) : mul(hex(0x2f7d6b), 0.9 + r() * 0.2); });
  paint(T.STONE_BRICK, bricks);
  paint(T.GLASS, (x, y, r) => {
    if (x === 0 || y === 0 || x === 15 || y === 15) return [205, 228, 238, 255];
    if (x - y === 3 || x - y === -5) return [255, 255, 255, 150];
    return [185, 222, 240, 46];
  });
  paint(T.LANTERN, (x, y, r) => {
    if (x < 2 || y < 2 || x > 13 || y > 13 || x === 7 || x === 8) return mul(hex(0x3d3f4c), 0.9 + r() * 0.2);
    return mix(hex(0xffb347), hex(0xfff3b0), r());
  });
  paint(T.BEACON, (x, y, r) => {
    if (x < 2 || y < 2 || x > 13 || y > 13) return planks(x, y, r);
    const d = Math.abs(x - 7.5) + Math.abs(y - 7.5);
    return d < 4 ? hex(0xfff7c2) : mix(hex(0xf6b26b), hex(0xe8795a), d / 9);
  });

  const flat = (c, lo = 0.93, hi = 0.12) => (x, y, r) => mul(c, lo + r() * hi);
  paint(T.M_DARK, flat(hex(0x3a3d4b)));
  paint(T.M_STEEL, flat(hex(0xb4bccb)));
  paint(T.M_COPPER, flat(hex(0xc8702f)));
  paint(T.M_BLACK, flat(hex(0x17181f)));
  paint(T.M_HOT, (x, y, r) => mix(hex(0xff5a14), hex(0xffd866), r() * r()));
  paint(T.M_CYAN, flat(hex(0x7ef0ff), 0.9, 0.2));
  paint(T.M_GREEN, flat(hex(0x8cff6a), 0.9, 0.2));
  paint(T.M_RED, flat(hex(0xff4d4d), 0.9, 0.2));
  paint(T.M_BLUE, (x, y, r) => ((x % 4 === 0 || y % 4 === 0) ? hex(0x16254f) : mul(hex(0x2a4fa8), 0.9 + r() * 0.2)));
  paint(T.M_GLASS, (x, y, r) => ((x + y) % 7 === 0 ? hex(0xeafaff) : mul(hex(0x9fd4e6), 0.95 + r() * 0.08)));
  paint(T.M_GRILL, (x, y) => (y % 2 ? hex(0x17181f) : hex(0x5a5f6e)));
  paint(T.M_WHITE, flat(hex(0xf2efe6)));
  paint(T.M_GOLD, flat(hex(0xf4c95d)));
  paint(T.M_VIOLET, flat(hex(0xb48cff), 0.9, 0.2));
  paint(T.M_ORANGE, (x, y, r) => ((x % 4 === 0 || y % 4 === 0) ? hex(0x5a2408) : mul(hex(0xf08a2a), 0.9 + r() * 0.2)));
  paint(T.FORGE, machine((x, y, r) => {
    const d = Math.hypot(x - 7.5, y - 7.5);
    if (d < 5) return d < 3.4 ? mix(hex(0xfff1a8), hex(0xff8a2a), r()) : hex(0x20222c);
  }));
  paint(T.CONDENSER, machine((x, y, r) => {
    if (x >= 3 && x <= 12 && y >= 3 && y <= 12) return (x + (y >> 1)) % 4 === 0 ? hex(0xeafcff) : mix(hex(0x1c2a55), hex(0x4f7fd9), r());
  }));
  paint(T.JELLY, (x, y, r) => ((x === 0 || y === 0 || x === 15 || y === 15) ? hex(0x2f9e6b) : mix(hex(0x5fe39a), hex(0xbfffe0), ((x * 3 + y * 5) % 9 === 0 ? 0.8 : r() * 0.25))));
  paint(T.FARMLAND, (x, y, r) => mul(DIRT, (y % 4 < 2 ? 0.62 : 0.8) + r() * 0.1));
  paint(T.CROP, (x, y, r) => mul(hex(0x6fd16a), 0.8 + r() * 0.3));
  paint(T.CROP_RIPE, (x, y, r) => mul(hex(0xf0c94a), 0.8 + r() * 0.3));
  ctx.putImageData(img, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;

  const tileIcon = (tile) => {
    const c = document.createElement('canvas');
    c.width = c.height = TILE;
    c.getContext('2d').drawImage(canvas, (tile % ATLAS) * TILE, Math.floor(tile / ATLAS) * TILE, TILE, TILE, 0, 0, TILE, TILE);
    return { url: c.toDataURL(), canvas: c };
  };

  const shapeIcon = (shape, color) => {
    const c = document.createElement('canvas');
    c.width = c.height = TILE;
    const g = c.getContext('2d');
    const base = hex(color);
    const pal = {
      a: base, A: mul(base, 0.62), w: mix(base, [255, 255, 255], 0.65), h: hex(0x9a6a44), d: hex(0x5f3d28),
      k: hex(0x2f4a3a), o: hex(0xff9a3d), y: hex(0xf4c95d),
    };
    const rows = SHAPES[shape], s = TILE / rows.length;
    const px = Array.from({ length: TILE }, () => new Array(TILE).fill(null));
    rows.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch === '.') return;
      for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) px[y * s + dy][x * s + dx] = pal[ch];
    }));
    // Contour : les pixels du bord sont assombris, ceux du haut-gauche éclaircis.
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
      let col = px[y][x];
      if (!col) continue;
      const open = (dx, dy) => !(px[y + dy]?.[x + dx]);
      if (open(1, 0) || open(0, 1)) col = mul(col, 0.7);
      else if (open(-1, 0) || open(0, -1)) col = mix(col, [255, 255, 255], 0.16);
      g.fillStyle = css(col);
      g.fillRect(x, y, 1, 1);
    }
    return { url: c.toDataURL(), canvas: c };
  };

  // Fissures de minage : 5 étapes de plus en plus marquées.
  const cracks = [];
  const cc = document.createElement('canvas');
  cc.width = cc.height = TILE;
  const cg = cc.getContext('2d');
  const cr = rng(777);
  for (let stage = 0; stage < 5; stage++) {
    cg.fillStyle = 'rgba(20,16,36,0.85)';
    for (let w = 0; w < 3; w++) {
      let x = 8, y = 8;
      for (let i = 0; i < 7; i++) {
        cg.fillRect(Math.round(x), Math.round(y), 1, 1);
        x = Math.max(0, Math.min(15, x + (cr() - 0.5) * 3.2 + (w - 1) * 0.6));
        y = Math.max(0, Math.min(15, y + (cr() - 0.5) * 3.2 + (stage % 2 ? 0.5 : -0.5)));
      }
    }
    const copy = document.createElement('canvas');
    copy.width = copy.height = TILE;
    copy.getContext('2d').drawImage(cc, 0, 0);
    const t = new THREE.CanvasTexture(copy);
    t.magFilter = t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    cracks.push(t);
  }

  return { texture, tileIcon, shapeIcon, cracks };
}

export function canvasTexture(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Rectangle UV d'une tuile : [u0, v0, u1, v1]
export function tileUV(tile) {
  const e = 0.001;
  const u0 = (tile % ATLAS) / ATLAS, v1 = 1 - Math.floor(tile / ATLAS) / ATLAS;
  return [u0 + e, v1 - 1 / ATLAS + e, u0 + 1 / ATLAS - e, v1 - e];
}

// Objet en volume : chaque pixel opaque de l'icône devient un petit pavé.
export function itemGeometry(canvas, size = 0.5) {
  const n = canvas.width, data = canvas.getContext('2d').getImageData(0, 0, n, n).data;
  const s = size / n, depth = s * 1.6, pos = [], col = [], idx = [];
  const solid = (x, y) => x >= 0 && y >= 0 && x < n && y < n && data[(y * n + x) * 4 + 3] > 0;
  const c = new THREE.Color();
  const quad = (pts, shade, r, g, b) => {
    const base = pos.length / 3;
    for (const p of pts) pos.push(p[0], p[1], p[2]);
    c.setRGB((r / 255) * shade, (g / 255) * shade, (b / 255) * shade, THREE.SRGBColorSpace);
    for (let i = 0; i < 4; i++) col.push(c.r, c.g, c.b);
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (!solid(x, y)) continue;
    const i = (y * n + x) * 4, r = data[i], g = data[i + 1], b = data[i + 2];
    const x0 = (x - n / 2) * s, x1 = x0 + s, y1 = (n / 2 - y) * s, y0 = y1 - s, z0 = -depth / 2, z1 = depth / 2;
    quad([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], 1, r, g, b);
    quad([[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], 0.8, r, g, b);
    if (!solid(x + 1, y)) quad([[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], 0.7, r, g, b);
    if (!solid(x - 1, y)) quad([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], 0.7, r, g, b);
    if (!solid(x, y - 1)) quad([[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], 0.9, r, g, b);
    if (!solid(x, y + 1)) quad([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], 0.55, r, g, b);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  return geo;
}
