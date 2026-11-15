import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { World, DIMS, shadedBox, blockGeometry, recordEdit } from './world.js';
import { makeAtlas, itemGeometry } from './textures.js';
import { B, I, BLOCKS, ITEMS, ELECTRIC, Inventory, LIQUID, PASS, HERBS, FX, fluidKind, levelOf, xpForLevel, toolId } from './items.js';
import { Player } from './player.js';
import { MobView } from './mobs.js';
import { MobSim } from './mobsim.js';
import { Fluids } from './fluids.js';
import { Sky } from './sky.js';
import { UI } from './ui.js';
import { Net, RemotePlayers, wsUrl, localWsUrl } from './net.js';
import { Sim, MACHINES, PIPE_MODES, N6, isPipe, connects } from './sim.js';
import { MODEL, armBox } from './models.js';
import { Drops } from './drops.js';
import { ModelView } from './modelview.js';
import { Sound, soundMat } from './sound.js';

const SOLO_KEY = 'archipel-save-v2';
const REACH = 6;
const $ = (id) => document.getElementById(id);
const readSave = (key) => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } };
const editsToMaps = (arr) => [0, 1, 2].map((d) => new Map((arr?.[d] ?? []).map(([key, flat]) => {
  const m = new Map();
  for (let i = 0; i < flat.length; i += 2) m.set(flat[i], flat[i + 1]);
  return [key, m];
})));

// =====================================================================
// Menu principal
// =====================================================================
const menu = { home: $('menuhome'), solo: $('solobox'), multi: $('multibox') };
let serverTimer = null;
function showMenu(which) {
  for (const k in menu) menu[k].classList.toggle('hidden', k !== which);
  clearInterval(serverTimer);
  if (which === 'multi') { refreshServers(); serverTimer = setInterval(refreshServers, 2500); }
}
// Sauvegarde solo : un fichier à garder ou à emporter sur une autre machine.
$('export').addEventListener('click', () => {
  const raw = localStorage.getItem(SOLO_KEY);
  if (!raw) return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([raw], { type: 'application/json' }));
  a.download = `archipel-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});
$('import').addEventListener('click', () => $('importfile').click());
$('importfile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Number.isFinite(data.seed) || !data.inv) throw new Error('format');
    if (readSave(SOLO_KEY) && !confirm('Remplacer la partie en cours par ce fichier ?')) return;
    localStorage.setItem(SOLO_KEY, JSON.stringify(data));
    $('solo').click();
    $('soloinfo').textContent = 'Sauvegarde importée : « Continuer » pour la reprendre.';
  } catch { $('soloinfo').textContent = "Ce fichier n'est pas une sauvegarde d'Archipel."; }
});
document.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', () => showMenu('home')));

$('solo').addEventListener('click', () => {
  const save = readSave(SOLO_KEY);
  $('continue').classList.toggle('hidden', !save);
  $('export').classList.toggle('hidden', !save);
  $('soloinfo').textContent = save ? 'Une partie est en cours. « Nouveau monde » la remplace définitivement.' : 'Aucune partie en cours : un nouveau monde sera généré.';
  showMenu('solo');
});
$('continue').addEventListener('click', () => startGame({}));
$('newworld').addEventListener('click', () => {
  if (readSave(SOLO_KEY) && !confirm('Remplacer la partie en cours ? Ton sac et tes constructions seront perdus.')) return;
  localStorage.removeItem(SOLO_KEY);
  startGame({});
});

const pseudo = $('pseudo');
pseudo.value = localStorage.getItem('archipel-name') ?? '';
$('multi').addEventListener('click', () => showMenu('multi'));

async function refreshServers() {
  const list = $('servers');
  const rows = [];
  try {
    const [info, others] = await Promise.all([fetch('/api/info').then((r) => r.json()), fetch('/api/servers').then((r) => r.json())]);
    rows.push({ label: `${info.name} (cette machine)`, sub: `${info.players} en ligne`, url: localWsUrl() });
    for (const s of others) rows.push({ label: s.name, sub: `${s.address} · ${s.players} en ligne`, url: `ws://${s.address}:${s.port}/ws` });
    const ip = info.addresses[0];
    $('hostinfo').textContent = ip
      ? `Pour inviter quelqu'un du même réseau : il ouvre http://${ip}:${info.port} dans son navigateur, ou saisit ${ip} ci-dessus depuis son propre jeu.`
      : 'Cette machine héberge une partie, mais aucune adresse réseau locale n\'a été trouvée.';
  } catch {
    $('hostinfo').textContent = 'Aucun serveur sur cette page : lance le jeu avec « npm run dev » pour héberger, ou saisis l\'adresse d\'un hôte.';
  }
  list.innerHTML = '';
  if (!rows.length) list.innerHTML = '<div class="muted">Aucune partie trouvée sur le réseau.</div>';
  for (const r of rows) {
    const b = document.createElement('button');
    b.className = 'server';
    b.innerHTML = '<b></b><span></span>';
    b.firstChild.textContent = r.label;
    b.lastChild.textContent = r.sub;
    b.addEventListener('click', () => join(r.url));
    list.appendChild(b);
  }
}

let joining = false;
async function join(url) {
  if (joining) return;
  if (!url) { $('mperror').textContent = 'Saisis une adresse.'; return; }
  joining = true;
  const name = pseudo.value.trim() || 'Voyageur';
  localStorage.setItem('archipel-name', name);
  $('mperror').textContent = 'Connexion…';
  const net = new Net();
  try {
    const welcome = await net.connect(url, name);
    $('mperror').textContent = '';
    startGame({ net, welcome });
  } catch (e) {
    $('mperror').textContent = `${e.message} (${url.replace(/^ws:\/\/|\/ws$/g, '')})`;
  }
  joining = false;
}
$('joinip').addEventListener('click', () => join(wsUrl($('ip').value)));
$('ip').addEventListener('keydown', (e) => { if (e.code === 'Enter') join(wsUrl($('ip').value)); });

// =====================================================================
// Partie
// =====================================================================
function startGame({ net = null, welcome = null }) {
  clearInterval(serverTimer);
  $('mainmenu').classList.add('hidden');
  const multi = !!net;
  const SAVE_KEY = multi ? `archipel-mp-${welcome.worldId}` : SOLO_KEY;
  // En ligne, le personnage (sac, position, journal) est gardé par le serveur ; l'ancienne copie locale sert de secours.
  const save = multi ? welcome.me ?? readSave(SAVE_KEY) : readSave(SAVE_KEY);
  const seed = multi ? welcome.seed : save?.seed ?? (Math.random() * 2 ** 31) | 0;
  const editsByDim = editsToMaps(multi ? welcome.edits : save?.edits);

  // ---------- Rendu ----------
  const canvas = $('game');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1800);
  camera.rotation.order = 'YXZ';
  scene.add(camera);
  // La main est dessinée dans une seconde passe, par-dessus le monde.
  const handScene = new THREE.Scene();
  const handCam = new THREE.PerspectiveCamera(55, 1, 0.05, 10);

  const atlas = makeAtlas();
  // Matériau éclairé du terrain : soleil, ciel et ombres par le moteur, modulés par la lumière propre à
  // chaque bloc (attribut « vl » : occlusion, lumière du ciel, lumière des sources).
  const shade = { uTorch: { value: new THREE.Color(1.0, 0.8, 0.52) }, uMin: { value: 0.035 }, uTime: { value: 0 } };
  function litMaterial(opts, wave) {
    const m = new THREE.MeshLambertMaterial({ map: atlas.texture, ...opts });
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, shade);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec3 vl;\nvarying vec3 vVl;\nuniform float uTime;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvVl = vl;' + (wave ? '\ntransformed.y += (sin(position.x * 1.7 + uTime * 1.5) + cos(position.z * 1.3 + uTime * 1.1)) * 0.03 * step(0.5, normal.y + fract(position.y) * 2.0);' : ''));
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vVl;\nuniform vec3 uTorch;\nuniform float uMin;')
        .replace('vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;',
          `float skyL = vVl.y * vVl.y, torchL = vVl.z * vVl.z;
          vec3 fromSky = (reflectedLight.directDiffuse + reflectedLight.indirectDiffuse) * skyL;
          vec3 fromTorch = diffuseColor.rgb * uTorch * torchL;
          vec3 outgoingLight = (max(fromSky, fromTorch) + min(fromSky, fromTorch) * 0.4 + diffuseColor.rgb * uMin) * vVl.x;`);
    };
    m.customProgramCacheKey = () => (wave ? 'lit-wave' : 'lit');
    return m;
  }
  const mats = {
    solid: litMaterial({}, false),
    glow: new THREE.MeshBasicMaterial({ map: atlas.texture, vertexColors: true, color: new THREE.Color(1.9, 1.9, 1.9) }), // plus clair que le blanc : halo
    fluid: litMaterial({ transparent: true, opacity: 0.74, depthWrite: false }, true),
    clear: litMaterial({ transparent: true, alphaTest: 0.08 }, false), // verre
  };
  const snd = new Sound();
  const modelView = new ModelView(scene, atlas.texture, mats.glow);
  const icons = {};
  for (const id in ITEMS) icons[id] = ITEMS[id].block ? atlas.tileIcon(ITEMS[id].tile) : atlas.shapeIcon(ITEMS[id].shape, ITEMS[id].color);
  // Les blocs qui ont un modèle en volume ont une icône en volume : une petite photo prise une fois au lancement.
  try {
    const shot = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    shot.setSize(64, 64, false);
    const sc = new THREE.Scene(), cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10), mat = new THREE.MeshBasicMaterial({ map: atlas.texture, vertexColors: true });
    cam.position.set(0, 0, 5);
    const box = new THREE.Box3(), size = new THREE.Vector3(), mid = new THREE.Vector3(), holder = new THREE.Group();
    holder.rotation.set(0.5, -0.65, 0);
    sc.add(holder);
    for (const id in ITEMS) {
      if (!ITEMS[id].block || !MODEL[id]) continue;
      const geo = blockGeometry(+id, 1), mesh = new THREE.Mesh(geo, mat);
      box.setFromBufferAttribute(geo.attributes.position);
      box.getSize(size); box.getCenter(mid);
      mesh.position.copy(mid).negate();
      holder.add(mesh);
      holder.scale.setScalar(1.25 / Math.max(size.x, size.y, size.z, 0.6));
      shot.render(sc, cam);
      icons[id] = { url: shot.domElement.toDataURL(), canvas: icons[id].canvas };
      holder.remove(mesh);
      geo.dispose();
    }
    mat.dispose();
    shot.dispose();
    shot.forceContextLoss();
  } catch { /* pas de second contexte graphique : on garde les icônes plates */ }

  // ---------- État du jeu ----------
  let dim = save?.dim ?? 0;
  let applyingRemote = false, placeMeta = null;
  // En solo la simulation des machines tourne ici ; en ligne, c'est le serveur qui la fait.
  const sim = multi ? null : new Sim({
    drop: (d, x, y, z, st) => drops.spawn({ d, p: [x + 0.5, y + 0.6, z + 0.5], v: [(Math.random() - 0.5) * 2, 3, (Math.random() - 0.5) * 2], s: st }),
    power: (d) => { if (d === dim) world.applyPower(sim.dims[d].powered); },
    explode: (d, x, y, z, r) => { if (d === dim) blast(x, y, z, r); },
    active: () => {},
    vis: (d, k, v) => { if (d === dim) onVis(k, v); },
    // Une culture pousse (ou meurt) : dans le monde affiché si c'est le nôtre, sinon directement dans ses modifications.
    setBlock: (d, x, y, z, id, meta) => {
      if (d === dim) { placeMeta = meta ?? null; if (world.setBlock(x, y, z, id)) return; placeMeta = null; }
      recordEdit(editsByDim[d], x, y, z, id);
      sim.onSet(d, x, y, z, id, meta);
    },
  });
  if (sim) { editsByDim.forEach((m, d) => sim.loadEdits(d, m)); sim.load(save?.sim); }
  const poweredByDim = multi ? [0, 1, 2].map((d) => new Set(welcome.powered[d] ?? [])) : null;
  const poweredSet = (d) => (multi ? poweredByDim[d] : sim.dims[d].powered);
  const activeByDim = multi ? [0, 1, 2].map((d) => new Set(welcome.active?.[d] ?? [])) : null;
  const activeSet = (d) => (multi ? activeByDim[d] : sim.dims[d].active);
  // État visible des blocs (orientation, raccords des tuyaux, niveau des réservoirs…) : tenu par la simulation.
  const visByDim = multi ? [0, 1, 2].map((d) => new Map(welcome.vis?.[d] ?? [])) : null;
  const visOf = (d) => (multi ? visByDim[d] : sim.dims[d].vis);
  function onVis(k, v) {
    const [x, y, z] = k.split(',').map(Number), id = world.get(x, y, z);
    if (id === B.LIGHTHOUSE && (v & 128)) lighthouseLit();
    // Niveau d'un réservoir, couvercle d'un coffre : seules les pièces mobiles changent, rien à redessiner.
    if (id !== B.TANK && id !== B.CHEST) world.redraw(x, y, z);
  }
  function makeWorld(d) {
    const w = new World(seed, d, editsByDim[d], scene, mats);
    w.powered = poweredSet(d);
    w.vis = visOf(d);
    w.onModels = (key, list) => modelView.sync(key, list);
    w.onModelsVisible = (key, v) => modelView.setVisible(key, v);
    w.onEdit = (x, y, z, id) => {
      if (applyingRemote) return;
      const meta = placeMeta ?? undefined;
      placeMeta = null;
      if (net) net.send({ t: 'set', d, x, y, z, id, meta });
      else { sim.onSet(d, x, y, z, id, meta); fluids.touch(x, y, z); }
    };
    return w;
  }
  let world = makeWorld(dim);
  // Écoulement des liquides : ici en solo, sur le serveur en ligne.
  const fluids = multi ? null : new Fluids(world, (x, y, z, id) => world.setBlock(x, y, z, id, false));
  if (sim) { sim.power(0, 0); sim.power(1, 0); world.powered = poweredSet(dim); }
  const inv = new Inventory();
  inv.load(save?.inv);
  // Le planeur est devenu un objet : une partie commencée avant en reçoit un, une fois.
  if (save && !save.glider && !inv.glider()) inv.add(I.GLIDER1, 1);
  if (save?.owed) inv.add(B.ROCKET, 1); // partie quittée en plein vol : la fusée est rendue
  let air = save?.air ?? 100;
  // Effets passagers des substances : nom -> secondes restantes.
  const fx = { ...(save?.fx ?? {}) };
  // Ce que rend un plant qu'on arrache : les herbes dépendent de leur variété, lue avant de casser le bloc.
  function cropLoot(id, variant) {
    const def = BLOCKS[id], out = [];
    if (def.herb) {
      const h = HERBS[variant & 3];
      if (def.herb === 2) out.push([h.fresh, 2]);
      out.push([h.seed, def.herb === 2 && Math.random() < 0.5 ? 2 : 1]);
    } else {
      out.push(def.drop ?? [id, 1]);
      if (def.seed) out.push([def.seed, 1]);
    }
    return out;
  } // oxygène, ne baisse que dans l'Éther
  let selected = save?.selected ?? 0;
  let respawnPoint = save?.respawn ?? null;
  const player = new Player(world);
  const sky = new Sky(scene);
  sky.setDim(dim);
  sky.time = multi ? welcome.time : save?.time ?? sky.time;
  sky.clock = save?.clock ?? 0;

  function homeSpawn() {
    const isl = world.island(0, 0);
    world.ensure(isl.x, isl.z, 2);
    return { x: isl.x + 0.5, y: world.surfaceY(isl.x, isl.z) + 1, z: isl.z + 0.5 };
  }

  if (save?.pos) {
    world.ensure(save.pos.x, save.pos.z, 2);
    player.teleport(save.pos);
    player.yaw = save.yaw ?? 0;
    player.pitch = save.pitch ?? 0;
    player.hp = save.hp ?? 20;
    player.hunger = save.hunger ?? 20;
    player.xp = save.xp ?? 0;
  } else {
    player.teleport(homeSpawn());
  }
  player.safe = { ...player.pos };
  player.xp ??= 0;
  function gainXp(n) {
    const before = levelOf(player.xp);
    player.xp += n;
    dirty = true;
    if (levelOf(player.xp) > before) { ui.toast(`Niveau ${levelOf(player.xp)} !`); blip(880, 0.25, 'triangle', 0.06); }
  }

  // ---------- Journal des objectifs ----------
  const journal = new Set(save?.journal ?? []), made = new Set(save?.made ?? []), flags = new Set();
  const has = (id, n = 1) => inv.count(id) >= n || (n === 1 && made.has(id));
  const GOALS = [
    ['bois', 'Premier bois', 'Frappe un tronc à mains nues.', () => has(B.LOG) || has(B.PLANKS), 5],
    ['etabli', "L'établi", 'Sac (E) : tronc → planches → établi.', () => has(B.BENCH), 10],
    ['planeur', 'Premier envol', 'Fabrique un planeur de toile : 4 bâtons et 6 feuillages. Espace en l\'air pour l\'ouvrir.', () => !!inv.glider(), 10],
    ['pioche', 'Première pioche', "Près d'un établi : planches et bâtons.", () => has(toolId(0, 0)), 10],
    ['four', 'Le four', '8 roches, puis du combustible et du minerai.', () => has(B.FURNACE), 15],
    ['fer', 'Âge du fer', 'Fonds du minerai de fer.', () => has(I.IRON), 20],
    ['piochefer', 'Pioche en fer', 'Elle ouvre la voie au cristal.', () => has(toolId(2, 0)), 20],
    ['armure', 'Bien protégé', "Porte une pièce d'armure (la chitine des scarabées suffit).", () => inv.armor.some(Boolean), 20],
    ['lanterne', 'Que la lumière soit', 'Fabrique une lanterne pour tes nuits et tes galeries.', () => has(B.LANTERN), 15],
    ['champ', 'Premier champ', 'Laboure la terre à la houe et sème des graines (les buissons en donnent).', () => has(I.WHEAT), 15],
    ['eleveur', 'Éleveur', 'Donne du blé à deux Nuakis proches (ou des graines à deux Picores) : un petit naît.', () => flags.has('breed'), 20],
    ['pain', 'Boulanger', 'Trois blés font un pain, bien plus nourrissant que des baies.', () => has(I.BREAD), 15],
    ['coffre', 'Un peu de rangement', 'Fabrique un coffre.', () => has(B.CHEST), 10],
    ['village', 'Premier contact', 'Trouve un village.', () => flags.has('village'), 25],
    ['troc', 'Marché conclu', 'Échange avec un villageois.', () => flags.has('trade'), 25],
    ['enchant', 'Apprenti enchanteur', "Enchante un objet sur un autel.", () => flags.has('enchant'), 30],
    ['courant', 'Premier courant', 'Fabrique une éolienne et relie-la par câble.', () => has(B.TURBINE), 30],
    ['cnc', 'Usinage', 'Fabrique une fraiseuse CNC.', () => has(B.CNC), 30],
    ['imprimante', 'Atelier complet', 'Fabrique une imprimante 3D.', () => has(B.PRINTER), 40],
    ['tuyaux', 'Tout seul', 'Relie deux machines par un tuyau à objets.', () => has(B.ITEM_PIPE), 30],
    ['germe', 'Minerai en pot', 'Obtiens un germe : il se plante en terre labourée, ou va dans un cultivateur.', () => [I.SEED_COAL, I.SEED_IRON, I.SEED_COPPER, I.SEED_CRYSTAL, I.SEED_URANITE, I.SEED_EMBER].some((id) => inv.count(id) > 0), 40],
    ['terminal', 'Grand magasin', 'Fabrique un terminal de stockage.', () => has(B.TERMINAL), 40],
    ['portail', 'Le passage', 'Fabrique un portail.', () => has(B.PORTAL), 50],
    ['braise', 'De l\'autre côté', 'Entre dans la Braise.', () => flags.has('braise'), 50],
    ['uranite', 'Ça brille', "Récolte de l'uranite.", () => inv.count(B.URANITE) > 0, 50],
    ['foreuse', 'Électrique', 'Imprime une foreuse avec des éclats de braise, et charge-la.', () => inv.count(I.DRILL) > 0, 40],
    ['reacteur', 'Fission', 'Fabrique un cœur de réacteur. Le montage est expliqué dans le sac : onglet « Guide des machines ».', () => has(B.CORE), 80],
    ['colosse', 'Tombeur de Colosse', 'Invoque le Colosse de braise avec un appât, et prends son cœur.', () => inv.count(I.HEART) > 0 || has(I.WINGS), 150],
    ['ailes', 'Libre comme l\'air', 'Fabrique les ailes de braise (il te faut un réacteur dorsal).', () => has(I.WINGS), 100],
    ['forge', 'Fusion', 'Fabrique une forge à fusion. Elle réclame 300 W : un réacteur.', () => has(B.FORGE), 100],
    ['alliage', 'Alliage stellaire', "Fonds braise, cristal et uranite dans la forge.", () => has(I.STAR), 100],
    ['ferme', 'Ferme automatique', 'Fabrique une récolteuse : elle cueille et replante toute seule.', () => has(B.HARVESTER), 60],
    ['telepad', 'Raccourci', 'Pose deux téléporteurs alimentés, choisis la destination (clic droit) et monte dessus.', () => flags.has('telepad'), 80],
    ['herbe', 'Main verte', 'Récolte une tête de cannabis (graines chez les villageois ou dans les coffres anciens).', () => HERBS.some((h) => h.joint && has(h.fresh)), 30],
    ['chimiste', 'Petit chimiste', 'Fabrique un décomposeur : il rend la matière à ses éléments.', () => has(B.DECOMP), 60],
    ['synthese', 'Synthèse', 'Obtiens une substance de synthèse (le guide du sac détaille les chaînes).', () => inv.count(I.ECSTASY) > 0 || inv.count(I.COCAINE) > 0, 100],
    ['composite', 'Plus léger que l\'air', 'Compresseur : du charbon au carbone, puis aux plaques composites.', () => has(I.COMPOSITE), 60],
    ['fusee', 'Compte à rebours', 'Fabrique une fusée (le guide du sac détaille les étapes).', () => has(B.ROCKET), 120],
    ['ether', "L'Éther", 'Décolle avec 4 bidons de carburant. Emporte de l\'oxygène, et de quoi revenir.', () => flags.has('ether'), 150],
    ['titane', 'Métal du ciel', 'Fonds du minerai de titane.', () => has(I.TITAN), 80],
    ['bionique', 'Augmenté', 'Installe un module sur une armure bionique, à l\'atelier bionique.', () => inv.armor.some((a) => a?.m?.length) || flags.has('mod'), 120],
    ['phare', "Le Phare de l'Archipel", "Pose le phare et donne-lui 300 W sans faiblir jusqu'à ce qu'il s'allume.", () => flags.has('phare'), 300],
  ];
  let goalTimer = 0;
  function checkGoals() {
    if (world.villageNear(player.pos.x, player.pos.z, 30)) flags.add('village');
    if (dim === 1) flags.add('braise');
    if (dim === 2) flags.add('ether');
    for (const [k, v] of visOf(dim)) if (v & 128) { const [x, y, z] = k.split(',').map(Number); if (world.get(x, y, z) === B.LIGHTHOUSE) lighthouseLit(); }
    for (const [id, title, , test, xp] of GOALS) {
      if (journal.has(id) || !test()) continue;
      journal.add(id);
      ui.toast(`Objectif accompli : ${title} (+${xp} XP)`);
      blip(990, 0.3, 'triangle', 0.06);
      gainXp(xp);
    }
    const next = GOALS.find((g) => !journal.has(g[0]));
    $('goal').innerHTML = next ? `<b>Objectif · J</b>${next[1]} — ${next[2]}` : '<b>Journal</b>Tous les objectifs sont accomplis.';
  }
  function lighthouseLit() {
    if (flags.has('phare')) return;
    flags.add('phare');
    if (journal.has('phare')) return;
    ui.toast("Le Phare de l'Archipel est rallumé. Tout le ciel le voit.");
    for (let i = 0; i < 5; i++) setTimeout(() => blip(520 + i * 130, 0.5, 'triangle', 0.07), i * 160);
  }
  const journalView = () => GOALS.map(([id, title, hint, , xp]) => ({ title, hint, xp, done: journal.has(id) }));

  // ---------- Interface ----------
  let mode = 'menu'; // menu (pause) | play | inv | chat | dead
  let creative = save?.gm === 'creative'; // mode créatif : vol, tout à disposition, aucun dégât
  let dirty = false, debugLock = false;
  const overlay = $('overlay'), deathScreen = $('death'), fade = $('fade'), vignette = $('vignette'), info = $('info');

  function stationsNear() {
    const out = new Set(), px = Math.floor(player.pos.x), py = Math.floor(player.pos.y), pz = Math.floor(player.pos.z);
    for (let y = py - 3; y <= py + 4; y++) for (let z = pz - 4; z <= pz + 4; z++) for (let x = px - 4; x <= px + 4; x++) {
      const id = world.get(x, y, z);
      if (id === B.BENCH) out.add('bench');
    }
    return out;
  }

  const ui = new UI(inv, icons, {
    drop: (st) => { if (!creative) dropStack(st, true); }, // en créatif, jeter hors du sac détruit l'objet
    creative: () => creative,
    note: (text) => ui.toast(text),
    filterRemoved: () => { give(I.FILTER, 1); closeInventory(); },
    installed: (mod) => { flags.add('mod'); ui.toast(`Module installé : ${mod.name}`); blip(1100, 0.25, 'sine', 0.06); dirty = true; },
    level: () => levelOf(player.xp),
    spend: (levels) => { flags.add('enchant'); const l = levelOf(player.xp); player.xp -= xpForLevel(l) - xpForLevel(l - levels); blip(1200, 0.3, 'sine', 0.06); dirty = true; },
    gain: (id, n) => { flags.add('trade'); give(id, n); },
    stations: stationsNear,
    changed: () => { dirty = true; ui.refreshHotbar(selected); },
    crafted: (r, n) => { made.add(r.out); blip(620, 0.08, 'triangle'); ui.toast(`Fabriqué : ${ITEMS[r.out].name} ×${r.n * n}`); },
  });
  ui.refreshHotbar(selected);

  function give(id, n) {
    const left = inv.add(id, n);
    if (left < n) ui.toast(`+${n - left} ${ITEMS[id].name}`);
    if (left > 0) { dropStack({ id, n: left }, false); ui.toast('Sac plein : le reste tombe à tes pieds.'); }
    dirty = true;
    ui.refreshHotbar(selected);
  }

  // ---------- Son ----------
  const blip = (freq, dur, type, vol) => snd.tone(freq, dur, type, vol);
  const matOf = (id) => soundMat(BLOCKS[id], id, ELECTRIC.has(id) || !!MACHINES[id]);

  // ---------- Objets 3D d'aide ----------
  const highlight = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004)),
    new THREE.LineBasicMaterial({ color: 0x1b1630, transparent: true, opacity: 0.85 }),
  );
  highlight.visible = false;
  const crackMat = new THREE.MeshBasicMaterial({ map: atlas.cracks[0], transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
  const crack = new THREE.Mesh(new THREE.BoxGeometry(1.008, 1.008, 1.008), crackMat);
  crack.visible = false;
  const rope = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0xf3d9c4 }));
  rope.visible = false;
  rope.frustumCulled = false;
  scene.add(highlight, crack, rope);

  // Voile du planeur
  const wingShape = new THREE.BufferGeometry();
  wingShape.setAttribute('position', new THREE.Float32BufferAttribute([-1.7, 0, 0.2, 1.7, 0, 0.2, 0, 0.12, -1.1, -1.7, 0, 0.2, 0, 0.12, -1.1, 0, -0.05, 0.5, 1.7, 0, 0.2, 0, -0.05, 0.5, 0, 0.12, -1.1], 3));
  const wing = new THREE.Mesh(wingShape, new THREE.MeshBasicMaterial({ color: 0xe8795a, side: THREE.DoubleSide, fog: false }));
  wing.position.set(0, 1.05, -0.6);
  wing.visible = false;
  camera.add(wing);

  // Main : bloc en cube, objet en volume, ou bras nu.
  const hand = new THREE.Group();
  const HAND_POS = new THREE.Vector3(0.36, -0.3, -0.62);
  handScene.add(hand);
  const handMats = {
    block: new THREE.MeshBasicMaterial({ map: atlas.texture, vertexColors: true }),
    item: new THREE.MeshBasicMaterial({ vertexColors: true }),
    arm: new THREE.MeshBasicMaterial({ color: 0xe9b58f, vertexColors: true }),
  };
  const handGeo = { 0: shadedBox(0.11, 0.11, 0.5) };
  let handKey = null, swing = 0, bob = 0;
  function setHand(stack) {
    const key = stack ? stack.id : 0;
    if (key === handKey) return;
    handKey = key;
    hand.clear();
    let mesh;
    if (!stack) {
      mesh = new THREE.Mesh(handGeo[0], handMats.arm);
      mesh.rotation.set(0.35, 0.25, 0);
      mesh.position.set(0.04, -0.06, 0.05);
    } else if (ITEMS[key].block) {
      mesh = new THREE.Mesh(handGeo[key] ??= blockGeometry(key, 0.22), handMats.block);
      mesh.rotation.set(0.22, 0.72, 0);
    } else {
      mesh = new THREE.Mesh(handGeo[key] ??= itemGeometry(icons[key].canvas, 0.46), handMats.item);
      // Tenu de profil, la tête de l'outil vers l'avant.
      if (ITEMS[key].gun) { mesh.rotation.set(0, -Math.PI / 2 + 0.16, 0); mesh.position.set(0.02, 0.04, -0.16); }
      else { mesh.rotation.set(-0.1, 0.72, 0.3); mesh.position.set(-0.06, 0.1, -0.1); }
    }
    hand.add(mesh);
  }

  // Objets au sol
  const dropMats = { block: new THREE.MeshBasicMaterial({ map: atlas.texture, vertexColors: true }), item: new THREE.MeshBasicMaterial({ vertexColors: true }) };
  const dropGeo = {};
  const drops = new Drops(scene, (id) => (ITEMS[id].block
    ? new THREE.Mesh(dropGeo[id] ??= blockGeometry(id, 0.26), dropMats.block)
    : new THREE.Mesh(dropGeo[id] ??= itemGeometry(icons[id].canvas, 0.42), dropMats.item)));
  function dropStack(st, thrown) {
    const p = [player.pos.x, player.eyeY - 0.3, player.pos.z];
    const v = thrown ? [dir.x * 5, dir.y * 5 + 2, dir.z * 5] : [(Math.random() - 0.5) * 1.5, 2, (Math.random() - 0.5) * 1.5];
    if (net) net.send({ t: 'drop', d: dim, p, v, s: st });
    else drops.spawn({ d: dim, p, v, s: { ...st }, delay: thrown ? 1.5 : 2.5 });
    dirty = true;
  }
  function roomFor(st) {
    return inv.slots.some((x) => !x || (x.id === st.id && ITEMS[st.id].stack > 1 && x.n < ITEMS[st.id].stack));
  }
  function collect(st) {
    const left = inv.addStack(st);
    if (left < st.n) { ui.toast(`+${st.n - left} ${ITEMS[st.id].name}`); blip(880, 0.05, 'triangle', 0.04); }
    dirty = true;
    ui.refreshHotbar(selected);
    if (ui.open) ui.render();
    return left;
  }
  function pickUp(o) {
    if (!roomFor(o.s)) return;
    if (net) { o.pending = true; net.send({ t: 'pick', k: o.k }); return; }
    const left = collect(o.s);
    if (left > 0) { o.s.n = left; o.delay = 1; } else drops.remove(o.k);
  }

  // Traits lumineux des tirs, éclairs d'explosion
  const tracers = [], booms = [];
  function tracer(a, b, color) {
    const g = new THREE.BufferGeometry().setFromPoints([a, b]);
    const line = new THREE.Line(g, new THREE.LineBasicMaterial({ color, transparent: true, fog: false }));
    scene.add(line);
    tracers.push({ line, life: 0.14 });
  }

  // ---------- Vie, faim, dégâts ----------
  function damage(amount, useArmor = true) {
    if (mode === 'dead' || amount <= 0 || creative || trip) return;
    if (useArmor) amount *= 1 - Math.min(0.8, inv.armorPoints() * 0.05);
    player.hp -= amount;
    vignette.classList.add('on');
    setTimeout(() => vignette.classList.remove('on'), 120);
    blip(140, 0.18, 'sawtooth', 0.07);
    if (player.hp <= 0) die();
  }

  function die() {
    player.hp = 0;
    player.pull = null;
    mode = 'dead';
    deathScreen.classList.remove('hidden');
    if (ui.open) ui.hide();
    document.exitPointerLock?.();
  }

  function respawn() {
    deathScreen.classList.add('hidden');
    let dest = null;
    if (respawnPoint) {
      const rp = respawnPoint;
      if (dim !== rp.dim) switchWorld(rp.dim);
      world.ensure(rp.x, rp.z, 2);
      if (world.get(rp.x, rp.y, rp.z) === B.BEACON) dest = { x: rp.x + 0.5, y: rp.y + 1, z: rp.z + 0.5 };
      else { respawnPoint = null; ui.toast('Ta balise a disparu : retour sur ton île.'); }
    }
    if (!dest) {
      if (dim !== 0) switchWorld(0);
      dest = homeSpawn();
    }
    player.teleport(dest);
    player.safe = { ...dest };
    player.hp = 20;
    player.hunger = 20;
    lock();
  }

  let regenTimer = 4;
  function survival(dt) {
    if (creative) { player.hunger = 20; player.hp = 20; return; }
    if (!fx.euphoria) player.exhaust += dt * (0.02 + (input.run && player.moving && !player.sneaking ? 0.045 : 0) + (player.gliding ? 0.015 : 0));
    if (player.exhaust >= 1) { player.exhaust -= 1; player.hunger = Math.max(0, player.hunger - 1); }
    regenTimer -= dt;
    if (regenTimer <= 0) {
      regenTimer = fx.regen ? 1.2 : 4;
      if (fx.regen && player.hp < 20) player.hp = Math.min(20, player.hp + 1); // apaisé : sans condition de faim
      else if (player.hunger >= 14 && player.hp < 20) { player.hp = Math.min(20, player.hp + 1); player.exhaust += 0.35; }
      else if (player.hunger <= 0 && player.hp > 2) damage(1, false);
    }
  }

  // Couleur de la lumière à un endroit (pour créatures, objets au sol, main) : ciel ou sources, le plus fort.
  const lightColor = new THREE.Color(), TORCH = new THREE.Color(1.0, 0.8, 0.52);
  function lightAt(x, y, z) {
    const b = world.lightAt(Math.floor(x), Math.floor(y), Math.floor(z));
    const s = (b >> 4) / 15, t = (b & 15) / 15, sk = s * s, tk = t * t;
    return lightColor.setRGB(Math.max(sky.tint.r * sk, TORCH.r * tk) + 0.05, Math.max(sky.tint.g * sk, TORCH.g * tk) + 0.05, Math.max(sky.tint.b * sk, TORCH.b * tk) + 0.05);
  }

  // ---------- Créatures et autres joueurs ----------
  // La simulation décide (ici en solo, sur le serveur en ligne) ; l'affichage ne fait que suivre.
  const mobView = new MobView(scene);
  function hitByMob(dmg, kx, kz) { damage(dmg); player.vel.x += kx * 4; player.vel.z += kz * 4; player.vel.y = Math.max(player.vel.y, 4); }
  const mobSim = multi ? null : new MobSim(world, {
    hitPlayer: (id, dmg, kx, kz) => hitByMob(dmg, kx, kz),
    drop: (x, y, z, st) => drops.spawn({ d: dim, p: [x, y, z], v: [(Math.random() - 0.5) * 2, 3, (Math.random() - 0.5) * 2], s: st }),
    xp: (id, n) => gainXp(n),
    born: (name) => { flags.add('breed'); ui.toast(`Un petit ${name} est né.`); blip(880, 0.2, 'triangle', 0.05); },
    tracer: (a, b) => tracer(new THREE.Vector3(a.x, a.y, a.z), new THREE.Vector3(b.x, b.y, b.z), 0xff6a6a),
  });
  function hurtMob(m, dmg, kx, kz) {
    blip(260, 0.09, 'sawtooth', 0.05);
    if (net) net.send({ t: 'hit', id: m.id, dmg, kx, kz }); else mobSim.hurt(mobSim.byId(m.id), dmg, kx, kz, 0);
  }
  function blastMobs(x, y, z, r, dmg) {
    if (net) net.send({ t: 'blast', x, y, z, r, dmg }); else mobSim.blast(x, y, z, r, dmg, 0);
  }
  const remotes = new RemotePlayers(scene, (id) => (ITEMS[id].block
    ? new THREE.Mesh(dropGeo[id] ??= blockGeometry(id, 0.26), new THREE.MeshBasicMaterial({ map: atlas.texture, vertexColors: true }))
    : new THREE.Mesh(dropGeo[id] ??= itemGeometry(icons[id].canvas, 0.42), new THREE.MeshBasicMaterial({ vertexColors: true }))));

  // ---------- Changement de monde ----------
  function switchWorld(d) {
    world.dispose();
    mobSim?.clear();
    mobView.clear();
    modelView.clear();
    fuses.length = 0;
    dim = d;
    world = makeWorld(d);
    world.setView(viewRadius);
    world.applyPower(poweredSet(d));
    player.world = world;
    player.pull = null;
    if (mobSim) mobSim.world = world;
    if (fluids) { fluids.world = world; fluids.active.clear(); }
    sky.setDim(d);
    updraftTimer = 0;
    dirty = true;
  }

  function travel(d, back = B.PORTAL) {
    fade.classList.add('on');
    setTimeout(() => fade.classList.remove('on'), 260);
    const from = { x: player.pos.x, z: player.pos.z };
    switchWorld(d);
    const isl = world.nearestIsland(from.x, from.z);
    world.ensure(isl.x, isl.z, 2);
    const px = isl.x + 2, sy = world.surfaceY(px, isl.z);
    if (world.get(px, sy, isl.z) !== back) world.setBlock(px, sy + 1, isl.z, back); // portail (ou fusée) de retour
    const dest = { x: isl.x + 0.5, y: world.surfaceY(isl.x, isl.z) + 1, z: isl.z + 0.5 };
    player.teleport(dest);
    player.safe = { ...dest };
    blip(180, 0.5, 'sine', 0.08);
    ui.toast(d === 2 ? "L'Éther. Pas d'air ici : surveille ton oxygène." : d === 1 ? 'Tu entres dans la Braise. Reste sur tes gardes.' : 'Retour sous le ciel.');
  }

  // ---------- Voyage en fusée ----------
  // La fusée quitte son bloc, monte jusqu'à disparaître, puis descend se poser dans l'autre monde : c'est la même.
  let trip = null;
  const rocketMat = new THREE.MeshBasicMaterial({ map: atlas.texture, vertexColors: true });
  function launch(x, y, z) {
    const mesh = new THREE.Mesh(blockGeometry(B.ROCKET, 1), rocketMat);
    const flame = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1, 0.45), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.3, 0.4), fog: false }));
    const plume = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1, 0.9), new THREE.MeshBasicMaterial({ color: 0xffe9c2, transparent: true, opacity: 0.45, depthWrite: false, fog: false }));
    flame.visible = plume.visible = false;
    mesh.add(flame, plume);
    mesh.position.set(x + 0.5, y + 0.5, z + 0.5);
    scene.add(mesh);
    world.setBlock(x, y, z, 0);
    for (const k in input) input[k] = false;
    player.gliding = false; player.fly = false; player.pull = null;
    trip = { mesh, flame, plume, phase: 'up', t: 0, v: 0, dest: dim === 2 ? 0 : 2, ground: 0, lx: 0, lz: 0 };
    mode = 'travel';
    ui.toast('Mise à feu…');
    blip(90, 1.2, 'sawtooth', 0.08);
  }
  function updateTrip(dt) {
    const T = trip, m = T.mesh;
    T.t += dt;
    if (T.phase === 'up') {
      // Une seconde de mise à feu, puis ça pousse de plus en plus fort.
      if (T.t > 1) { if (T.v === 0) snd.boom(4); T.v = Math.min(80, T.v + (6 + T.v * 0.9) * dt); }
      m.position.y += T.v * dt;
      if (T.t > 5.2) fade.classList.add('on');
      if (T.t > 5.8) arrive();
    } else {
      // Descente freinée : rapide en haut, douce à l'approche du sol.
      const h = m.position.y - (T.ground + 0.5);
      T.v = Math.max(2.2, Math.min(48, h * 1.3));
      m.position.y = Math.max(T.ground + 0.5, m.position.y - T.v * dt);
      if (h <= 0.02) { land(); return; }
    }
    const burn = T.phase === 'up' ? (T.t > 1 ? 1 : T.t * 0.3) : Math.min(1, 0.35 + T.v / 30), flick = 0.85 + Math.random() * 0.3;
    T.flame.visible = T.plume.visible = burn > 0.05;
    T.flame.scale.set(1, 2.2 * burn * flick, 1); T.flame.position.y = -0.5 - 1.1 * burn * flick;
    T.plume.scale.set(1, 4 * burn * flick, 1); T.plume.position.y = -0.5 - 2 * burn * flick;
    m.position.x += (Math.random() - 0.5) * 0.02 * burn; // vibration
    player.pos.x = m.position.x; player.pos.y = m.position.y - 0.5; player.pos.z = m.position.z;
    player.vel.x = player.vel.y = player.vel.z = 0;
  }
  function arrive() {
    const T = trip, from = { x: T.mesh.position.x, z: T.mesh.position.z };
    switchWorld(T.dest);
    const isl = world.nearestIsland(from.x, from.z);
    world.ensure(isl.x, isl.z, 2);
    T.lx = isl.x + 2; T.lz = isl.z;
    T.ground = world.surfaceY(T.lx, T.lz) + 1;
    T.mesh.position.set(T.lx + 0.5, T.ground + 0.5 + 95, T.lz + 0.5);
    T.phase = 'down'; T.t = 0; T.v = 48;
    setTimeout(() => fade.classList.remove('on'), 150);
  }
  function land() {
    const T = trip;
    world.setBlock(T.lx, T.ground, T.lz, B.ROCKET);
    scene.remove(T.mesh);
    T.mesh.geometry.dispose(); T.flame.geometry.dispose(); T.flame.material.dispose(); T.plume.geometry.dispose(); T.plume.material.dispose();
    const dest = { x: T.lx + 0.5, y: world.surfaceY(T.lx, T.lz + 2) + 1, z: T.lz + 2.5 };
    player.teleport(dest);
    player.safe = { ...dest };
    player.yaw = 0; player.pitch = 0;
    trip = null;
    mode = 'play';
    snd.land(18);
    ui.toast(dim === 2 ? "L'Éther. Pas d'air ici : surveille ton oxygène." : 'Retour sous le ciel.');
    dirty = true;
    if (!debugLock && document.pointerLockElement !== canvas) pause();
  }

  // ---------- Poudrières ----------
  const fuses = [];
  function ignite(x, y, z, delay) {
    if (fuses.some((f) => f.x === x && f.y === y && f.z === z)) return;
    fuses.push({ x, y, z, t: delay });
    blip(900, 0.25, 'sawtooth', 0.04);
  }
  function explode(x, y, z) {
    if (world.get(x, y, z) !== B.TNT) return;
    world.setBlock(x, y, z, 0, false);
    blast(x, y, z, 3.3);
  }
  // Souffle : détruit les blocs dans le rayon, blesse créatures et joueur.
  function blast(x, y, z, R) {
    const n = Math.ceil(R);
    for (let dx = -n; dx <= n; dx++) for (let dy = -n; dy <= n; dy++) for (let dz = -n; dz <= n; dz++) {
      if (dx * dx + dy * dy + dz * dz > R * R) continue;
      const id = world.get(x + dx, y + dy, z + dz);
      if (!id || id === B.PORTAL) continue;
      if (id === B.TNT) ignite(x + dx, y + dy, z + dz, 0.2 + Math.random() * 0.2);
      else world.setBlock(x + dx, y + dy, z + dz, 0, false);
    }
    world.meshAllDirty();
    const cx = x + 0.5, cy = y + 0.5, cz = z + 0.5, reach = R * 2;
    if (!applyingRemote) blastMobs(cx, cy, cz, reach, R * 5); // en ligne, une explosion du serveur a déjà soufflé les créatures
    const d = Math.hypot(player.pos.x - cx, player.pos.y + 0.9 - cy, player.pos.z - cz);
    if (d < reach) {
      damage(R * 4.2 * (1 - d / reach));
      const k = (1 - d / reach) * 11 / (d || 1);
      player.vel.x += (player.pos.x - cx) * k; player.vel.y += 5 * (1 - d / reach); player.vel.z += (player.pos.z - cz) * k;
    }
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshBasicMaterial({ color: R > 4 ? 0xb6ff7a : 0xffc46b, transparent: true, fog: false }));
    m.position.set(cx, cy, cz);
    scene.add(m);
    booms.push({ m, life: 0.3, size: R });
    snd.boom(R);
    dirty = true;
  }
  let powerCheck = 0;
  function updateFuses(dt) {
    if ((powerCheck -= dt) <= 0) {
      powerCheck = 0.3;
      for (const e of world.electric.values()) if (e.id === B.TNT && world.powered.has(e.k)) ignite(e.x, e.y, e.z, 1.2);
    }
    for (let i = fuses.length - 1; i >= 0; i--) {
      const f = fuses[i];
      if ((f.t -= dt) <= 0) { fuses.splice(i, 1); explode(f.x, f.y, f.z); }
    }
  }

  // ---------- Entrées ----------
  const input = { forward: false, back: false, left: false, right: false, run: false, sneak: false, jump: false, mine: false, use: false };
  const IDLE = { forward: false, back: false, left: false, right: false, run: false, sneak: false, jump: false };
  const KEYS = { KeyW: 'forward', ArrowUp: 'forward', KeyS: 'back', ArrowDown: 'back', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', ShiftLeft: 'sneak', ShiftRight: 'sneak', ControlLeft: 'run', Space: 'jump' };
  let lastForward = 0, tapRun = false; // deux appuis rapides sur « avancer » : course

  let pausedAt = 0;
  function pause() {
    mode = 'menu';
    pausedAt = performance.now();
    overlay.classList.remove('hidden');
    for (const k in input) input[k] = false;
    persist();
  }
  // Le navigateur refuse de reprendre la souris dans la seconde qui suit un Échap : on réessaie un court moment.
  let resumedAt = -1e9;
  function resume() {
    mode = 'play';
    resumedAt = performance.now();
    overlay.classList.add('hidden');
    let tries = 0;
    const attempt = () => {
      if (mode !== 'play' || document.pointerLockElement === canvas) return;
      const p = canvas.requestPointerLock();
      if (p?.catch) p.catch(() => { if (++tries < 10 && mode === 'play') setTimeout(attempt, 200); else if (!debugLock && mode === 'play') pause(); });
    };
    attempt();
  }
  function lock() {
    mode = 'play';
    overlay.classList.add('hidden');
    const p = canvas.requestPointerLock();
    if (p?.catch) p.catch(() => { if (!debugLock && mode === 'play') pause(); });
  }

  function openInventory(opts) {
    if (mode !== 'play') return;
    mode = 'inv';
    for (const k in input) input[k] = false;
    ui.show(opts);
    document.exitPointerLock?.();
  }

  // Lien vers un coffre ou une machine : direct en solo, par le serveur en ligne.
  const pending = new Map();
  let rid = 1;
  const request = (msg, cb) => { msg.rid = rid++; pending.set(msg.rid, cb); net.send(msg); };
  function tileLink(x, y, z, id) {
    const link = { id, x, y, z, d: dim, state: null };
    const at = { d: dim, x, y, z };
    if (net) {
      net.send({ t: 'topen', ...at, id });
      link.put = (slot, st, cb) => request({ t: 'tput', ...at, slot, s: st }, (m) => cb(m.left ?? st.n));
      link.take = (slot, n, cb) => request({ t: 'ttake', ...at, slot, n }, (m) => cb(m.s ?? null));
      link.close = () => net.send({ t: 'tclose' });
      link.termTake = (item, n, cb) => request({ t: 'tterm', ...at, op: 'take', item, n }, (m) => cb(m.s ?? null));
      link.termPut = (st, cb) => request({ t: 'tterm', ...at, op: 'put', s: st }, (m) => cb(m.left ?? st.n));
      link.padSet = (set) => net.send({ t: 'tpadset', ...at, set });
    } else {
      const t = sim.tileAt(dim, x, y, z, id), d0 = dim;
      sim.setOpen(d0, x, y, z, true);
      link.close = () => sim.setOpen(d0, x, y, z, false);
      link.state = sim.view(dim, x, y, z);
      link.put = (slot, st, cb) => { cb(sim.put(t, slot, st)); dirty = true; };
      link.take = (slot, n, cb) => { cb(sim.take(t, slot, n)); dirty = true; };
      link.termTake = (item, n, cb) => { cb(sim.termTake(dim, x, y, z, item, n)); link.state = sim.view(dim, x, y, z); dirty = true; };
      link.termPut = (st, cb) => { cb(sim.termPut(dim, x, y, z, st)); link.state = sim.view(dim, x, y, z); dirty = true; };
      link.padSet = (set) => { sim.padSet(d0, x, y, z, set); dirty = true; };
    }
    return link;
  }
  // Opérations sans ouvrir l'écran : seau contre un réservoir, clé sur un tuyau ou un câble.
  function bucketOp(x, y, z, id, bucket, cb) {
    if (net) request({ t: 'tbucket', d: dim, x, y, z, id, bucket }, (m) => cb(m.id ?? null));
    else { cb(sim.bucket(sim.tileAt(dim, x, y, z, id), bucket)); dirty = true; }
  }
  function mobOp(op, id, cb) {
    if (net) request({ t: 'mob', op, id }, (m) => cb(m.res));
    else cb(op === 'feed' ? mobSim.feed(mobSim.byId(id)) : mobSim.shear(mobSim.byId(id)));
  }
  // Monter sur un téléporteur réglé et alimenté suffit à partir.
  let padStand = 0, padLock = false;
  function padStep(dt) {
    const bx = Math.floor(player.pos.x), by = Math.floor(player.pos.y - 0.5), bz = Math.floor(player.pos.z);
    if (!player.onGround || world.get(bx, by, bz) !== B.TELEPAD) { padStand = 0; padLock = false; return; }
    if (padLock || (padStand += dt) < 0.6) return;
    padLock = true;
    const here = dim;
    padOp(bx, by, bz, (res) => {
      if (!res || dim !== here) return;
      if (res.err) { ui.toast({ off: "Ce téléporteur n'est pas alimenté (15 W).", unset: 'Pas de destination : clic droit sur le téléporteur pour la choisir.', destoff: "Le téléporteur d'arrivée n'est pas alimenté." }[res.err]); return; }
      flags.add('telepad');
      fade.classList.add('on'); setTimeout(() => fade.classList.remove('on'), 180);
      world.ensure(res.x, res.z, 2);
      const dest = { x: res.x + 0.5, y: res.y + 1, z: res.z + 0.5 };
      player.teleport(dest);
      player.safe = { ...dest };
      blip(1300, 0.3, 'sine', 0.07); blip(650, 0.4, 'sine', 0.05);
    });
  }
  function padOp(x, y, z, cb) {
    if (net) request({ t: 'tpad', d: dim, x, y, z }, (m) => cb(m.res ?? null));
    else cb(sim.padDest(dim, x, y, z));
  }
  function filterOp(x, y, z, side, o, cb, d = dim) {
    if (net) request({ t: 'tfilter', d, x, y, z, side, o }, (m) => cb(m.res ?? null));
    else { const res = sim.filterOp(d, x, y, z, side, o); cb(Array.isArray(res) ? [...res] : res); dirty = true; }
  }
  function wrenchOp(x, y, z, side, cb) {
    if (net) request({ t: 'twrench', d: dim, x, y, z, side }, (m) => cb(m.res ?? null));
    else { cb(sim.wrench(dim, x, y, z, side)); dirty = true; }
  }
  // Quel raccord du tuyau visé le joueur regarde-t-il ? Le bras touché par le regard, sinon le plus proche du point visé.
  function pipeSide(t) {
    const o = camera.position, sides = [];
    for (let i = 0; i < 6; i++) if (connects(t.id, world.get(t.x + N6[i][0], t.y + N6[i][1], t.z + N6[i][2]))) sides.push(i);
    let best = -1, bt = Infinity;
    for (const i of sides) {
      const b = armBox(t.id, i), lo = [t.x + b[0], t.y + b[1], t.z + b[2]], hi = [t.x + b[3], t.y + b[4], t.z + b[5]];
      let t0 = 0, t1 = REACH + 2;
      for (let a = 0; a < 3; a++) {
        const oa = a === 0 ? o.x : a === 1 ? o.y : o.z, da = a === 0 ? dir.x : a === 1 ? dir.y : dir.z;
        if (Math.abs(da) < 1e-6) { if (oa < lo[a] || oa > hi[a]) { t0 = Infinity; break; } continue; }
        const ta = (lo[a] - oa) / da, tb = (hi[a] - oa) / da;
        t0 = Math.max(t0, Math.min(ta, tb)); t1 = Math.min(t1, Math.max(ta, tb));
      }
      if (t0 <= t1 && t0 < bt) { bt = t0; best = i; }
    }
    if (best >= 0) return best;
    const px = o.x + dir.x * t.t - (t.x + 0.5), py = o.y + dir.y * t.t - (t.y + 0.5), pz = o.z + dir.z * t.t - (t.z + 0.5);
    let bd = -Infinity;
    for (const i of sides) { const dot = px * N6[i][0] + py * N6[i][1] + pz * N6[i][2]; if (dot > bd) { bd = dot; best = i; } }
    return best;
  }

  // ---------- Villageois ----------
  const C = I.COIN;
  const TRADES = [
    [ // Céliens : cultivateur, forgeron, érudit
      [[[C, 1], [I.BERRIES, 6]], [[C, 2], [I.WHEAT, 8]], [[I.SEEDS, 4], [C, 1]], [[C, 2], [I.MEAT_COOKED, 3]], [[C, 2], [I.FEATHER, 6]], [[C, 1], [B.WOOL, 4]], [[401, 1], [C, 6]], [[402, 1], [C, 8]], [[C, 1], [I.MUSHROOM, 4]], [[I.BUCKET, 1], [C, 4]], [[I.SEED_COAL, 1], [C, 14]], [[B.BEACON, 1], [C, 8]]],
      [[[C, 1], [I.COAL, 8]], [[C, 2], [B.IRON_ORE, 4]], [[C, 2], [B.COPPER_ORE, 4]], [[I.IRON, 2], [C, 3]], [[I.WRENCH, 1], [C, 5]], [[I.SHEARS, 1], [C, 4]], [[I.PLATE, 4], [C, 7]], [[I.SEED_IRON, 1], [C, 20]]],
      [[[C, 3], [B.CRYSTAL, 2]], [[C, 2], [I.DUST, 2]], [[B.CRYSTAL, 1], [C, 4]], [[I.CIRCUIT, 2], [C, 9]], [[B.ALTAR, 1], [C, 16]], [[I.SEED_CRYSTAL, 1], [C, 26]]],
    ],
    [ // Cendreux : récupérateur, fondeur, sourcier
      [[[C, 3], [I.COPPER, 4]], [[C, 4], [I.CIRCUIT, 1]], [[C, 2], [I.MEAT_COOKED, 2]], [[I.EMBER_SHARD, 2], [C, 8]], [[B.BASALT, 16], [C, 3]]],
      [[[C, 5], [I.PLATE, 4]], [[C, 3], [I.CELL, 1]], [[B.URANITE, 1], [C, 10]], [[B.CASING, 4], [C, 12]], [[I.SEED_EMBER, 1], [C, 30]]],
      [[[C, 4], [I.BUCKET_WATER, 1]], [[403, 1], [C, 10]], [[404, 1], [C, 12]], [[I.BUCKET_LAVA, 1], [C, 5]], [[B.TANK, 1], [C, 9]], [[I.SEED_URANITE, 1], [C, 40]], [[I.ROD, 1], [C, 24]]],
    ],
  ];
  const JOBS = [['Cultivateur', 'Forgeron', 'Érudit'], ['Récupérateur', 'Fondeur', 'Sourcier']];
  function openTrade(m) {
    const kind = m.type === 'cendreux' ? 1 : 0;
    openInventory({ trade: {
      title: `${JOBS[kind][m.job]} ${kind ? 'cendreux' : 'célien'}`,
      hint: 'Il échange contre des écus célestes, et en donne pour ce dont il a besoin.',
      offers: TRADES[kind][m.job].map(([give, cost]) => ({ give, cost })),
    } });
    blip(520, 0.12, 'triangle', 0.05);
  }
  function closeInventory() {
    ui.hide();
    lock();
  }

  // ---------- Chat et commandes ----------
  const chatBox = $('chat'), chatLog = $('chatlog'), chatIn = $('chatin');
  function say(text, cls = 'sys') {
    const line = document.createElement('div');
    line.className = cls;
    line.textContent = text;
    chatLog.appendChild(line);
    while (chatLog.children.length > 40) chatLog.firstChild.remove();
    chatLog.scrollTop = chatLog.scrollHeight;
  }
  function openChat(prefix) {
    if (mode !== 'play') return;
    mode = 'chat';
    for (const k in input) input[k] = false;
    chatBox.classList.add('open');
    chatIn.value = prefix;
    chatIn.focus();
    chatLog.scrollTop = chatLog.scrollHeight;
  }
  function closeChat() {
    chatBox.classList.remove('open');
    chatIn.blur();
    if (mode !== 'chat') return;
    mode = 'play';
    if (!debugLock && document.pointerLockElement !== canvas) lock();
  }
  function submitChat() {
    const text = chatIn.value.trim().slice(0, 160);
    closeChat();
    if (!text) return;
    if (text.startsWith('/')) { say(text, 'me'); try { command(text); } catch { say('Commande impossible.'); } return; }
    say(`${net ? pseudo.value.trim() || 'Voyageur' : 'Toi'} : ${text}`, 'me');
    if (net) net.send({ t: 'chat', text });
  }
  const plain = (t) => t.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  function findItem(q) {
    if (/^\d+$/.test(q)) return ITEMS[+q] ? +q : null;
    const n = plain(q).replace(/_/g, ' ');
    let starts = null, inside = null;
    for (const id in ITEMS) {
      if (ITEMS[id].legacy) continue;
      const name = plain(ITEMS[id].name);
      if (name === n) return +id;
      if (starts == null && name.startsWith(n)) starts = +id;
      if (inside == null && name.includes(n)) inside = +id;
    }
    return starts ?? inside;
  }
  function setCreative(on) {
    creative = on;
    if (!on) player.fly = false;
    say(on ? 'Mode créatif : tout est dans le sac (E), rien ne se consomme, aucun dégât. Deux fois Espace pour voler.' : 'Mode survie.');
    dirty = true;
    persist();
  }
  const HELP = [
    '/gamemode creative | survival — changer de mode de jeu',
    '/give <objet> [quantité] — recevoir un objet (nom ou début du nom)',
    '/time jour | nuit | midi | <heure> — régler l\'heure',
    '/tp <x> <y> <z> | maison | <joueur> — se téléporter',
    '/heal — vie et faim au maximum · /xp <points> · /clear — vider le sac',
  ];
  function command(line) {
    const args = line.slice(1).trim().split(/\s+/), cmd = plain(args.shift() ?? '');
    if (cmd === 'gamemode' || cmd === 'gm' || cmd === 'mode') {
      const a = plain(args[0] ?? '');
      if (['creative', 'creatif', 'c', '1'].includes(a)) setCreative(true);
      else if (['survival', 'survie', 's', '0'].includes(a)) setCreative(false);
      else say('Usage : /gamemode creative | survival');
    } else if (cmd === 'give' || cmd === 'donne') {
      const n = /^\d+$/.test(args.at(-1) ?? '') && args.length > 1 ? Math.min(999, +args.pop()) : 1;
      const id = findItem(args.join(' '));
      if (id == null) { say(`Objet inconnu : ${args.join(' ') || '?'}`); return; }
      give(id, Math.max(1, n));
      say(`Reçu : ${ITEMS[id].name} ×${Math.max(1, n)}`);
    } else if (cmd === 'time' || cmd === 'heure') {
      const a = plain(args[0] ?? ''), named = { jour: 0.33, day: 0.33, matin: 0.3, midi: 0.5, noon: 0.5, soir: 0.72, nuit: 0.85, night: 0.85, minuit: 0 };
      const v = a in named ? named[a] : /^\d+(\.\d+)?$/.test(a) ? (Math.min(24, +a) % 24) / 24 : null;
      if (v == null) { say('Usage : /time jour | nuit | midi | <heure de 0 à 24>'); return; }
      if (net) net.send({ t: 'cmd', c: 'time', v }); else sky.time = v;
      say(`Il est ${Math.floor(v * 24)} h.`);
    } else if (cmd === 'tp') {
      const a = plain(args[0] ?? '');
      let dest = null;
      if (args.length >= 3 && args.slice(0, 3).every((v) => Number.isFinite(+v))) dest = { x: +args[0], y: +args[1], z: +args[2] };
      else if (a === 'maison' || a === 'home') { if (dim !== 0) switchWorld(0); dest = homeSpawn(); }
      else {
        const other = [...remotes.map.values()].find((q) => plain(q.name).startsWith(a) && a && q.target);
        if (other && other.target.d !== dim) switchWorld(other.target.d);
        if (other) dest = { x: other.target.x, y: other.target.y, z: other.target.z };
      }
      if (!dest) { say('Usage : /tp <x> <y> <z> | maison | <joueur>'); return; }
      world.ensure(dest.x, dest.z, 2);
      player.teleport(dest);
      player.safe = { ...dest };
      say(`Téléporté en ${Math.round(dest.x)}, ${Math.round(dest.y)}, ${Math.round(dest.z)}.`);
    } else if (cmd === 'heal' || cmd === 'soin') {
      player.hp = 20; player.hunger = 20; say('Vie et faim au maximum.');
    } else if (cmd === 'xp') {
      const n = Math.max(0, Math.min(100000, +args[0] || 0));
      gainXp(n); say(`+${n} XP (niveau ${levelOf(player.xp)}).`);
    } else if (cmd === 'clear' || cmd === 'vide') {
      inv.slots.fill(null); ui.refreshHotbar(selected); dirty = true; say('Sac vidé.');
    } else {
      for (const h of HELP) say(h);
    }
  }

  let lastSpace = 0;
  addEventListener('keydown', (e) => {
    if (e.target === chatIn) { if (e.code === 'Enter' || e.code === 'NumpadEnter') submitChat(); else if (e.code === 'Escape') closeChat(); return; }
    // Pendant la saisie dans la recherche de recettes, seules Échap et Entrée comptent.
    if (e.target.tagName === 'INPUT') { if (e.code === 'Escape' && mode === 'inv') closeInventory(); else if (e.code === 'Enter') e.target.blur(); return; }
    if (mode === 'play' && !e.repeat && (e.code === 'KeyT' || e.code === 'Enter' || e.key === '/')) { openChat(e.key === '/' ? '/' : ''); e.preventDefault(); return; }
    if (e.code === 'KeyJ' && !e.repeat) {
      if (mode === 'play') openInventory({ journal: journalView() }); else if (mode === 'inv') closeInventory();
      return;
    }
    if (e.code === 'KeyE' && !e.repeat) {
      if (mode === 'play') openInventory(); else if (mode === 'inv') closeInventory();
      return;
    }
    if (mode === 'inv' && e.code === 'Escape') { closeInventory(); return; }
    // Échap ferme aussi la pause (pas dans la même pression que celle qui l'a ouverte).
    if (mode === 'menu' && e.code === 'Escape' && !e.repeat && performance.now() - pausedAt > 250) { resume(); return; }
    if (mode !== 'play') return;
    if (e.code in KEYS) { input[KEYS[e.code]] = true; e.preventDefault(); }
    if (KEYS[e.code] === 'forward' && !e.repeat) {
      if (performance.now() - lastForward < 280) { tapRun = true; input.run = true; }
      lastForward = performance.now();
    }
    if (e.code === 'Space' && !e.repeat) {
      // Créatif : deux appuis rapides sur Espace pour voler ou se reposer.
      if (creative) {
        if (performance.now() - lastSpace < 300) { player.fly = !player.fly; player.gliding = false; lastSpace = 0; blip(player.fly ? 700 : 420, 0.1, 'triangle'); return; }
        lastSpace = performance.now();
        if (player.fly) return;
      }
      if (player.pull) { player.pull = null; return; }
      // Avec un réacteur dorsal chargé : appui bref = planeur, appui long = poussée.
      if (!player.onGround && jetReady()) return;
      toggleJump();
    }
    if (e.code === 'KeyQ' && !e.repeat) {
      const st = inv.slots[selected];
      if (st) {
        const n = e.ctrlKey || e.metaKey ? st.n : 1;
        dropStack({ ...st, n }, true);
        if ((st.n -= n) <= 0) inv.slots[selected] = null;
        swing = 1;
        ui.refreshHotbar(selected);
      }
    }
    const m = /^Digit([1-9])$/.exec(e.code);
    if (m) { selected = +m[1] - 1; ui.refreshHotbar(selected); }
  });
  addEventListener('keyup', (e) => {
    if (e.code === 'Space' && mode === 'play' && !player.onGround && !player.fly && jetReady() && spaceHeld < 0.22) toggleJump();
    if (e.code in KEYS) input[KEYS[e.code]] = false;
    if (KEYS[e.code] === 'forward' && tapRun) { tapRun = false; input.run = false; }
  });
  let spaceHeld = 0;
  const jetReady = () => { const p = inv.armor[1]; return !player.fly && !!p && (!!ITEMS[p.id].wings || (!!ITEMS[p.id].charge && ((p.c ?? 0) > 0 || creative))); };
  function toggleJump() {
    const wasGliding = player.gliding, grounded = player.onGround;
    player.pressJump();
    if (!grounded) blip(wasGliding ? 300 : 520, 0.12, 'triangle');
  }
  addEventListener('mousemove', (e) => { if (mode === 'play' && document.pointerLockElement === canvas) player.look(e.movementX, e.movementY); });
  addEventListener('mousedown', (e) => {
    if (mode !== 'play') return;
    if (e.button === 0) { input.mine = true; actionCd = 0; }
    if (e.button === 2) { input.use = true; useCd = 0; }
  });
  addEventListener('mouseup', (e) => {
    if (e.button === 0) input.mine = false;
    if (e.button === 2) input.use = false;
  });
  addEventListener('contextmenu', (e) => e.preventDefault());
  addEventListener('wheel', (e) => {
    if (mode !== 'play') return;
    selected = (selected + (e.deltaY > 0 ? 1 : 8)) % 9;
    ui.refreshHotbar(selected);
  }, { passive: true });

  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement === canvas) { resumedAt = -1e9; return; } // souris reprise : fin du délai de grâce
    if (document.pointerLockElement !== canvas && mode === 'chat' && !debugLock) { closeChat(); pause(); }
    else if (document.pointerLockElement !== canvas && mode === 'play' && !debugLock && performance.now() - resumedAt > 2500) pause();
  });
  $('play').addEventListener('click', lock);
  $('respawn').addEventListener('click', respawn);
  $('tomenu').addEventListener('click', () => { persist(); net?.close(); location.reload(); });

  // ---------- Sauvegarde ----------
  let saveTimer = 5;
  function persist() {
    try {
      const data = {
        dim, selected, inv, respawn: respawnPoint,
        pos: player.onGround ? player.pos : player.safe, yaw: player.yaw, pitch: player.pitch,
        hp: Math.max(1, player.hp), hunger: player.hunger, xp: player.xp, journal: [...journal], made: [...made], gm: creative ? 'creative' : 'survival', glider: 1, air, fx, owed: trip ? 1 : 0,
      };
      if (multi) net.send({ t: 'save', data });
      if (!multi) Object.assign(data, { seed, time: sky.time, clock: sky.clock, sim, edits: editsByDim.map((m) => [...m].map(([key, mm]) => [key, [...mm].flat()])) });
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      dirty = false;
    } catch { /* stockage plein ou indisponible */ }
  }
  addEventListener('beforeunload', persist);

  // ---------- Réseau ----------
  if (net) {
    $('pauseinfo').textContent = 'Partie en ligne : le monde continue pendant la pause.';
    for (const p of welcome.players) remotes.add(p.id, p.name);
    net.on('join', (m) => { remotes.add(m.id, m.name); say(`${m.name} rejoint la partie.`); });
    net.on('leave', (m) => { const p = remotes.map.get(m.id); if (p) say(`${p.name} quitte la partie.`); remotes.remove(m.id); });
    net.on('s', (m) => { remotes.setState(m.p, welcome.id); sky.time = m.time; if (m.c != null) sky.clock = m.c; });
    net.on('m', (m) => { if (m.d === dim) mobView.sync(m.r); });
    net.on('hurt', (m) => hitByMob(m.dmg, m.kx, m.kz));
    net.on('xp', (m) => gainXp(m.n));
    net.on('born', (m) => { if (m.d !== dim) return; flags.add('breed'); ui.toast(`Un petit ${m.name} est né.`); });
    net.on('fx', (m) => tracer(new THREE.Vector3(...m.a), new THREE.Vector3(...m.b), 0xff6a6a));
    net.on('set', (m) => {
      applyingRemote = true;
      if (m.d !== dim || !world.setBlock(m.x, m.y, m.z, m.id)) recordEdit(editsByDim[m.d], m.x, m.y, m.z, m.id);
      applyingRemote = false;
    });
    for (const d of welcome.drops ?? []) drops.spawn(d);
    net.on('drop', (m) => drops.spawn({ ...m, delay: m.from === welcome.id ? 1.5 : 0.6 }));
    net.on('gone', (m) => drops.remove(m.k));
    net.on('got', (m) => {
      drops.remove(m.k);
      const left = collect(m.s);
      if (left > 0) dropStack({ ...m.s, n: left }, false);
    });
    net.on('act', (m) => { activeByDim[m.d] = new Set(m.keys); });
    net.on('vis', (m) => { if (m.v == null) visByDim[m.d].delete(m.k); else visByDim[m.d].set(m.k, m.v); if (m.d === dim) onVis(m.k, m.v ?? 0); });
    net.on('chat', (m) => say(`${m.name} : ${m.text}`, 'other'));
    net.on('time', (m) => { sky.time = m.v; });
    net.on('pw', (m) => { poweredByDim[m.d] = new Set(m.keys); if (m.d === dim) world.applyPower(poweredByDim[m.d]); });
    net.on('boom', (m) => { if (m.d !== dim) return; applyingRemote = true; blast(m.x, m.y, m.z, m.r); applyingRemote = false; });
    net.on('tile', (m) => {
      const t = ui.tile;
      if (!t || t.d !== m.d || t.x !== m.x || t.y !== m.y || t.z !== m.z) return;
      t.state = m.st;
      if (!m.st) closeInventory(); else ui.renderTile();
    });
    net.on('tres', (m) => { const cb = pending.get(m.rid); pending.delete(m.rid); cb?.(m); });
    net.on('close', () => { ui.toast('Connexion au serveur perdue.'); $('pauseinfo').textContent = 'Connexion perdue : retourne au menu principal pour te reconnecter.'; });
    if (welcome.players.length) ui.toast(`En ligne : ${welcome.players.map((p) => p.name).join(', ')}`);
  }
  let netTimer = 0, simTimer = 0, tileTimer = 0, lavaTimer = 0;
  // Boussole : distance et direction de la maison et du village le plus proche.
  const ARROWS = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];
  function toward(x, z) {
    const dx = x - player.pos.x, dz = z - player.pos.z;
    let rel = Math.atan2(-dx, -dz) - player.yaw;
    rel = Math.atan2(Math.sin(rel), Math.cos(rel));
    return `${ARROWS[((Math.round(-rel / (Math.PI / 4)) % 8) + 8) % 8]} ${Math.round(Math.hypot(dx, dz))} m`;
  }
  function compassLine() {
    if (inv.count(I.COMPASS) <= 0) return '';
    let out = '';
    const home = respawnPoint && respawnPoint.dim === dim ? respawnPoint : dim === 0 ? world.island(0, 0) : null;
    if (home) out += `<br>Maison ${toward(home.x, home.z)}`;
    const ci = Math.floor(player.pos.x / 112), cj = Math.floor(player.pos.z / 112);
    let best = null, bd = Infinity;
    for (let i = ci - 3; i <= ci + 3; i++) for (let j = cj - 3; j <= cj + 3; j++) {
      const v = world.island(i, j)?.village;
      if (!v) continue;
      const d = Math.hypot(v.x - player.pos.x, v.z - player.pos.z);
      if (d < bd) { bd = d; best = v; }
    }
    if (best) out += `<br>Village ${toward(best.x, best.z)}`;
    return out;
  }
  // Une lampe allumée ou une balise tient les créatures hostiles à distance.
  function safeSpot(x, y, z) {
    for (const e of world.electric.values()) if (e.id === B.LAMP && world.powered.has(e.k) && Math.hypot(e.x - x, e.y - y, e.z - z) < 18) return true;
    return !!respawnPoint && respawnPoint.dim === dim && Math.hypot(respawnPoint.x - x, respawnPoint.z - z) < 24;
  }
  const veil = document.createElement('div');
  veil.style.cssText = 'position:fixed;inset:0;pointer-events:none;opacity:0;transition:opacity .2s';
  $('hud').prepend(veil);

  // ---------- Actions ----------
  let target = null, mobTarget = null, mineKey = null, mineProg = 0, actionCd = 0, useCd = 0, tickSound = 0;
  const dir = new THREE.Vector3(), tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();

  // Un outil électrique déchargé ne vaut pas mieux que la main.
  function usableTool(held) {
    const it = held && ITEMS[held.id];
    if (!it?.tool) return null;
    return it.charge && !creative && (held.c ?? 0) < it.charge.use ? null : it.tool;
  }
  function breakInfo(def, held) {
    const tool = usableTool(held);
    const right = !!tool && !!def.tool && tool.type === def.tool;
    const tierOk = !def.tier || (right && tool.tier >= def.tier);
    let time = def.hard;
    if (right) time /= tool.speed * (1 + 0.3 * (held.e?.eff ?? 0));
    if (fx.rush) time /= 1.8;
    if (!tierOk) time *= 3;
    if (creative) time = 0.12;
    return { time, drop: tierOk };
  }

  function wearTool(slot) {
    const s = inv.slots[slot];
    if (!s || !ITEMS[s.id].tool || creative) return;
    const ch = ITEMS[s.id].charge;
    if (ch) {
      const before = s.c ?? 0;
      s.c = Math.max(0, before - ch.use);
      if (before >= ch.use && s.c < ch.use) ui.toast(`${ITEMS[s.id].name} : déchargé, passe au chargeur.`);
      return;
    }
    if (Math.random() < (s.e?.unb ?? 0) / ((s.e?.unb ?? 0) + 1)) return; // Solidité
    if (--s.d <= 0) {
      inv.slots[slot] = null;
      ui.toast(`${ITEMS[s.id].name} : cassé !`);
      blip(90, 0.25, 'sawtooth', 0.07);
    }
  }

  function breakTarget(held) {
    const def = BLOCKS[target.id], info = breakInfo(def, held);
    // Une culture ne tient pas sans son bloc de terre : elle part avec lui.
    const above = world.get(target.x, target.y + 1, target.z);
    if (PASS.has(above)) { const loot = cropLoot(above, world.vis.get(target.x + ',' + (target.y + 1) + ',' + target.z) ?? 0); world.setBlock(target.x, target.y + 1, target.z, 0); if (!creative) for (const l of loot) give(...l); }
    const herbLoot = def.herb ? cropLoot(target.id, world.vis.get(target.x + ',' + target.y + ',' + target.z) ?? 0) : null;
    world.setBlock(target.x, target.y, target.z, 0);
    if (def.noDrop || creative) { /* réservoir : il tombe de lui-même avec son contenu ; créatif : rien à ramasser */ }
    else if (herbLoot) { for (const l of herbLoot) give(...l); }
    else if (info.drop) {
      const [id, n] = def.drop ?? [target.id, 1];
      const ore = ORE_XP[target.id];
      give(id, ore && Math.random() < 0.25 * (held?.e?.fort ?? 0) ? n * 2 : n);
      if (ore) gainXp(ore);
      if (def.seed) give(def.seed, 1); // le germe revient avec la récolte
      if (target.id === B.CROP3) give(I.SEEDS, 1 + (Math.random() < 0.5 ? 1 : 0));
      if (target.id === B.BUSH && Math.random() < 0.4) give(I.SEEDS, 1);
    } else ui.toast(`Il faut un meilleur outil pour récolter : ${def.name}.`);
    wearTool(selected);
    player.exhaust += 0.025;
    snd.crack(matOf(target.id));
    if (def.glow) blip(880, 0.08);
    dirty = true;
    ui.refreshHotbar(selected);
  }

  const ORE_XP = { [B.COAL_ORE]: 2, [B.IRON_ORE]: 3, [B.COPPER_ORE]: 3, [B.CRYSTAL]: 5, [B.BRAISITE]: 8, [B.URANITE]: 8 };
  function shoot(held) {
    const it = ITEMS[held.id], pulse = it.charge;
    if (creative) { /* munitions et charge illimitées */ }
    else if (pulse) {
      if ((held.c ?? 0) < pulse.use) { ui.toast('Pistolet déchargé : passe au chargeur.'); blip(900, 0.03, 'square', 0.03); actionCd = 0.5; return; }
      held.c -= pulse.use;
    } else {
      if (inv.count(I.AMMO) <= 0) { ui.toast('Plus de cartouches.'); blip(900, 0.03, 'square', 0.03); actionCd = 0.5; return; }
      inv.remove(I.AMMO, 1);
    }
    const bh = world.raycast(camera.position, dir, 70), mh = mobView.raycast(camera.position, dir, 70);
    const hitMob = mh && (!bh || mh.t < bh.t);
    const t = hitMob ? mh.t : bh ? bh.t : 70;
    tmpA.copy(camera.position).addScaledVector(dir, 0.8);
    tmpA.y -= 0.25;
    tmpB.copy(camera.position).addScaledVector(dir, t);
    tracer(tmpA.clone(), tmpB.clone(), pulse ? 0x7ef0ff : 0xfff1a8);
    if (hitMob) hurtMob(mh.mob, it.dmg ?? 9, dir.x, dir.z);
    else if (bh && bh.id === B.TNT) ignite(bh.x, bh.y, bh.z, 0.05);
    player.pitch = Math.min(1.55, player.pitch + 0.025);
    swing = 1;
    if (pulse) blip(1800, 0.12, 'sine', 0.08); else { blip(110, 0.16, 'sawtooth', 0.09); blip(1400, 0.05, 'square', 0.04); }
    actionCd = pulse ? 0.22 : 0.3;
    dirty = true;
    ui.refreshHotbar(selected);
  }

  function primary(dt) {
    const held = inv.slots[selected];
    if (held && ITEMS[held.id].gun) {
      mineProg = 0;
      if (actionCd <= 0) shoot(held);
      return;
    }
    if (mobTarget) {
      mineProg = 0;
      if (actionCd <= 0) {
        const tool = usableTool(held);
        hurtMob(mobTarget, (tool ? tool.dmg + 2 * (held.e?.sharp ?? 0) : 1) * (fx.rush ? 1.5 : 1), dir.x, dir.z);
        if (tool) wearTool(selected);
        player.exhaust += 0.05;
        swing = 1; snd.swing();
        actionCd = 0.42;
        ui.refreshHotbar(selected);
      }
      return;
    }
    if (!target) { mineProg = 0; mineKey = null; return; }
    const key = target.x + ',' + target.y + ',' + target.z;
    if (key !== mineKey) { mineKey = key; mineProg = 0; }
    mineProg += dt / breakInfo(BLOCKS[target.id], held).time;
    if (swing <= 0.05) swing = 1;
    if ((tickSound -= dt) <= 0) { tickSound = 0.22; snd.dig(matOf(target.id)); }
    if (mineProg >= 1) { breakTarget(held); mineProg = 0; mineKey = null; }
  }

  function swapHeld(newId) {
    if (creative) return; // le seau reste tel quel
    const held = inv.slots[selected];
    if (held.n > 1) { held.n--; const left = inv.addStack({ id: newId, n: 1 }); if (left) dropStack({ id: newId, n: 1 }, false); }
    else inv.slots[selected] = { id: newId, n: 1 };
    dirty = true;
    ui.refreshHotbar(selected);
  }
  function secondary() {
    const heldNow = inv.slots[selected], heldIt = heldNow && ITEMS[heldNow.id];
    if (mobTarget?.def.villager) { input.use = false; openTrade(mobTarget); return; }
    // Élevage : nourrir une bête avec ce qu'elle aime, ou la tondre. C'est la simulation qui dit si ça prend.
    if (mobTarget && heldNow && (mobTarget.def.breed === heldNow.id || (heldNow.id === I.SHEARS && mobTarget.def.wool))) {
      const feed = heldNow.id !== I.SHEARS, name = mobTarget.def.name, slot = selected, food = heldNow.id;
      mobOp(feed ? 'feed' : 'shear', mobTarget.id, (res) => {
        if (feed) {
          if (res === 'ok') {
            const st = inv.slots[slot];
            if (!creative && st && st.id === food && --st.n <= 0) inv.slots[slot] = null;
            ui.toast(`${name} est comblé : nourris-en un second tout près.`);
            blip(740, 0.18, 'triangle', 0.05);
            ui.refreshHotbar(selected);
          } else ui.toast(res === 'baby' ? `Ce ${name} est encore trop jeune.` : `${name} n'a pas faim pour l'instant.`);
        } else if (res) snd.swing(); else ui.toast("Rien à tondre : la laine n'a pas repoussé.");
        dirty = true;
      });
      swing = 1; useCd = 0.5;
      return;
    }
    // Seau vide : puiser un liquide du monde.
    if (heldNow?.id === I.BUCKET && !(target && MACHINES[target.id]?.tank)) {
      const hit = world.raycast(camera.position, dir, REACH, true);
      if (hit && LIQUID.has(hit.id)) {
        world.setBlock(hit.x, hit.y, hit.z, 0);
        swapHeld(hit.id === B.LAVA ? I.BUCKET_LAVA : I.BUCKET_WATER);
        blip(500, 0.12, 'sine', 0.05); swing = 1; useCd = 0.35;
        return;
      }
    }
    if (target) {
      const { x, y, z, id } = target;
      if (heldNow?.id === I.FILTER && (id === B.ITEM_PIPE || id === B.FLUID_PIPE)) {
        // Filtre en main : il se fixe sur le raccord visé.
        const side = pipeSide(target), slot = selected;
        if (side < 0) ui.toast("Un filtre se pose sur le raccord d'un tuyau avec une machine.");
        else filterOp(x, y, z, side, { op: 'add' }, (ok) => {
          if (!ok) { ui.toast("Un filtre se pose sur le raccord d'un tuyau avec une machine, un seul par raccord."); return; }
          const st = inv.slots[slot];
          if (!creative && st?.id === I.FILTER && --st.n <= 0) inv.slots[slot] = null;
          ui.toast('Filtre posé : clic droit dessus pour le régler.');
          ui.refreshHotbar(selected);
        });
        blip(700, 0.06, 'square', 0.04); swing = 1; useCd = 0.4;
        return;
      }
      if ((id === B.ITEM_PIPE || id === B.FLUID_PIPE) && heldNow?.id !== I.WRENCH && !input.sneak) {
        // Raccord filtré : clic droit ouvre le filtre.
        const side = pipeSide(target);
        if (side >= 0 && ((world.vis.get(x + ',' + y + ',' + z) ?? 0) >> (12 + side)) & 1) {
          input.use = false;
          const d0 = dim, link = { slots: [], fluid: id === B.FLUID_PIPE, op: (o, cb) => filterOp(x, y, z, side, o, cb, d0) };
          filterOp(x, y, z, side, { op: 'get' }, (res) => { if (Array.isArray(res)) { link.slots = res; openInventory({ filter: link }); snd.open(false); } });
          return;
        }
      }
      if (heldNow?.id === I.WRENCH && isPipe(id)) {
        // Clé sur un tuyau ou un câble : règle le raccord du côté visé.
        const side = pipeSide(target);
        if (side < 0) ui.toast('Rien à raccorder ici : pose ce tuyau contre une machine ou un autre tuyau.');
        else wrenchOp(x, y, z, side, (res) => {
          if (!res) return;
          ui.toast(res.machine ? `Raccord : ${PIPE_MODES[res.mode]}` : res.mode ? 'Rebranché.' : 'Débranché.');
        });
        blip(640, 0.05, 'square', 0.04); swing = 1; useCd = 0.3;
        return;
      }
      if (heldNow?.id === I.WRENCH && MODEL[id] && !MODEL[id].dyn && !PASS.has(id) && id !== B.FARMLAND) {
        // Clé sur une machine : un quart de tour.
        wrenchOp(x, y, z, -1, () => {});
        blip(520, 0.05, 'square', 0.04); swing = 1; useCd = 0.3;
        return;
      }
      if (MACHINES[id]?.tank && (heldNow?.id === I.BUCKET || heldIt?.fluid)) {
        bucketOp(x, y, z, id, heldNow.id, (res) => {
          if (res == null) { ui.toast(heldIt.fluid ? 'Ce réservoir ne peut pas recevoir ce liquide.' : 'Pas assez de liquide pour remplir un seau.'); return; }
          swapHeld(res);
          blip(500, 0.12, 'sine', 0.05);
        });
        swing = 1; useCd = 0.35;
        return;
      }
      // Accroupi avec un bloc en main : on pose contre le bloc visé au lieu de l'utiliser.
      const skip = input.sneak && !!heldIt?.block;
      if (skip) { /* rien : la pose se fait plus bas */ }
      else if (id === B.ALTAR) { input.use = false; openInventory({ altar: true }); return; }
      else if (id === B.PORTAL) {
        input.use = false;
        if (dim === 2) { ui.toast("Le portail reste inerte dans l'Éther : il faut la fusée."); useCd = 0.5; return; }
        travel(1 - dim);
        return;
      }
      else if (id === B.ROCKET) {
        // La fusée relie le Ciel (ou la Braise) à l'Éther. Chaque décollage brûle 4 bidons.
        input.use = false;
        if (!creative && inv.count(I.FUEL) < 4) { ui.toast(`Il faut 4 bidons de carburant pour décoller (tu en as ${inv.count(I.FUEL)}).`); useCd = 0.5; return; }
        if (world.surfaceY(x, z) > y) { ui.toast('La fusée doit avoir le ciel dégagé au-dessus d\'elle.'); useCd = 0.5; return; }
        if (!creative) { inv.remove(I.FUEL, 4); give(I.CAN, 4); } // les bidons vides restent
        launch(x, y, z);
        ui.refreshHotbar(selected);
        return;
      }
      else if (id === B.MODBENCH) { input.use = false; snd.open(false); openInventory({ altar: 'mods' }); return; }
      else if (id === B.CASING) {
        // Un blindage ouvre le cœur du réacteur qu'il protège.
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
          if (world.get(x + dx, y + dy, z + dz) !== B.CORE) continue;
          input.use = false; snd.open(false); openInventory({ tile: tileLink(x + dx, y + dy, z + dz, B.CORE) });
          return;
        }
      }
      else if (id === B.HAMMOCK) {
        if (dim !== 0 || !sky.night) ui.toast('On ne dort que la nuit, sous le ciel.');
        else {
          if (net) net.send({ t: 'cmd', c: 'time', v: 0.27 }); else sky.time = 0.27;
          player.hp = Math.min(20, player.hp + 6);
          fade.classList.add('on'); setTimeout(() => fade.classList.remove('on'), 500);
          ui.toast('Tu dors jusqu\'au matin.');
        }
        useCd = 0.8;
        return;
      }
      else if (id === B.BENCH) { input.use = false; snd.open(true); openInventory({ ctx: 'bench' }); return; }
      else if (MACHINES[id]) { input.use = false; snd.open(id === B.CHEST || id === B.DRAWER); openInventory({ tile: tileLink(x, y, z, id) }); return; }
      else if (id === B.TNT) { ignite(x, y, z, 2.2); ui.toast('Mèche allumée, recule !'); useCd = 0.4; return; }
      else if (id === B.BEACON) {
        respawnPoint = { dim, x, y, z };
        ui.toast('Balise activée : tu réapparaîtras ici.');
        blip(660, 0.2, 'triangle'); dirty = true; useCd = 0.5;
        return;
      }
    }
    const held = inv.slots[selected];
    if (!held) return;
    const it = ITEMS[held.id];
    if (it.hook) {
      const hit = world.raycast(camera.position, dir, 34);
      if (!hit) { ui.toast('Rien à agripper à portée.'); useCd = 0.4; return; }
      const p = tmpA.copy(camera.position).addScaledVector(dir, hit.t);
      player.pull = { x: p.x, y: p.y, z: p.z, t: 2.6 };
      blip(760, 0.12, 'square', 0.05); swing = 1; useCd = 0.6;
      return;
    }
    if (it.fx) {
      // Substance : un effet passager. En reprendre rallonge la durée, jusqu'à cinq minutes.
      const [k, t] = it.fx;
      fx[k] = Math.min(300, (fx[k] ?? 0) + t);
      if (!creative && --held.n <= 0) inv.slots[selected] = null;
      ui.toast(`${FX[k].name} : ${FX[k].tip}.`);
      blip(420, 0.25, 'sine', 0.05); blip(630, 0.35, 'sine', 0.04);
      swing = 1; useCd = 0.6; dirty = true;
      ui.refreshHotbar(selected);
      return;
    }
    if (it.food) {
      if (player.hunger >= 20) return;
      player.hunger = Math.min(20, player.hunger + it.food);
      if (!creative && --held.n <= 0) inv.slots[selected] = null;
      blip(330, 0.1, 'triangle'); swing = 1; useCd = 0.45; dirty = true;
      ui.refreshHotbar(selected);
      return;
    }
    if (held.id === I.BAIT && target) {
      if (dim !== 1) { ui.toast("Le Colosse ne répond qu'à l'appel lancé dans la Braise."); useCd = 0.5; return; }
      const x = target.x + target.nx + 0.5, y = target.y + target.ny, z = target.z + target.nz + 0.5;
      if (net) net.send({ t: 'summon', x, y, z });
      else if (!mobSim.summon(x, y, z)) { ui.toast('Un Colosse rôde déjà.'); useCd = 0.5; return; }
      if (!creative && --held.n <= 0) inv.slots[selected] = null;
      ui.toast('Le sol tremble : le Colosse de braise approche !');
      blip(60, 0.9, 'sawtooth', 0.12); swing = 1; useCd = 0.8; dirty = true;
      ui.refreshHotbar(selected);
      return;
    }
    if (it.fluid && target) {
      // Seau plein : verser le liquide dans le monde.
      const x = target.x + target.nx, y = target.y + target.ny, z = target.z + target.nz;
      if (world.solid(x, y, z) || !world.setBlock(x, y, z, it.fluid)) return;
      if (!creative) inv.slots[selected] = { id: I.BUCKET, n: 1 };
      blip(360, 0.12, 'sine', 0.05); swing = 1; dirty = true; useCd = 0.35;
      ui.refreshHotbar(selected);
      return;
    }
    // Houe : laboure l'herbe ou la terre. Graines : se sèment sur la terre labourée.
    if (held.id === I.HOE && target && (target.id === B.GRASS || target.id === B.DIRT || target.id === B.MOSS)) {
      if (world.get(target.x, target.y + 1, target.z)) { ui.toast('Il faut de la place au-dessus pour labourer.'); useCd = 0.4; return; }
      world.setBlock(target.x, target.y, target.z, B.FARMLAND);
      snd.place('dirt'); swing = 1; dirty = true; useCd = 0.3;
      return;
    }
    if (it.plant && target) {
      if (target.id !== B.FARMLAND) { ui.toast("Graines et germes se plantent sur de la terre labourée (à la houe)."); useCd = 0.5; return; }
      if (world.get(target.x, target.y + 1, target.z)) return;
      // Une herbe garde sa variété dans l'état du bloc.
      const pk = target.x + ',' + (target.y + 1) + ',' + target.z;
      if (it.variant) { world.vis.set(pk, it.variant); placeMeta = { rot: it.variant }; }
      if (!world.setBlock(target.x, target.y + 1, target.z, it.plant)) { placeMeta = null; if (it.variant) world.vis.delete(pk); return; }
      if (!creative && --held.n <= 0) inv.slots[selected] = null;
      snd.place('soft'); swing = 1; dirty = true; useCd = 0.25;
      ui.refreshHotbar(selected);
      return;
    }
    if (!it.block || !target) return;
    const x = target.x + target.nx, y = target.y + target.ny, z = target.z + target.nz;
    if (world.get(x, y, z) && !LIQUID.has(world.get(x, y, z))) return;
    if (!PASS.has(held.id) && player.intersectsBlock(x, y, z)) return;
    if (BLOCKS[held.id].crop && world.get(x, y - 1, z) !== B.FARMLAND) { ui.toast('Une culture ne pousse que sur de la terre labourée.'); useCd = 0.5; return; }
    // Une machine se pose face au joueur.
    const model = MODEL[held.id], rot = model && !model.dyn ? ((Math.round((player.yaw - Math.PI) / (Math.PI / 2)) % 4) + 4) % 4 : 0, vk = x + ',' + y + ',' + z;
    if (rot) world.vis.set(vk, rot);
    if (held.id === B.PUMP) { const k = fluidKind(world.get(x, y - 1, z)); placeMeta = { src: k === 1 ? B.WATER : k === 2 ? B.LAVA : 0 }; }
    if (held.id === B.TANK && held.f) placeMeta = { f: held.f };
    if (rot) placeMeta = { ...placeMeta, rot };
    if (!world.setBlock(x, y, z, held.id)) { placeMeta = null; if (rot) world.vis.delete(vk); return; }
    if (held.id === B.PUMP && !LIQUID.has(world.get(x, y - 1, z))) ui.toast("Une pompe doit être posée au-dessus d'eau ou de lave.");
    if (!creative && --held.n <= 0) inv.slots[selected] = null;
    snd.place(matOf(held.id)); swing = 1; dirty = true;
    ui.refreshHotbar(selected);
  }

  // ---------- Boucle ----------
  // Image finale : le monde, puis la main par-dessus, puis le halo de ce qui brille, puis la mise en couleur.
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const handPass = new RenderPass(handScene, handCam);
  handPass.clear = false;
  handPass.clearDepth = true;
  composer.addPass(handPass);
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.5, 0.55, 1.02);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  // Réglage de qualité (menu pause), mémorisé d'une partie à l'autre.
  const dpr = devicePixelRatio || 1;
  const QUALITY = {
    low: { shadow: 0, bloom: false, ratio: 1, view: 6 },
    medium: { shadow: 1024, bloom: true, ratio: Math.min(dpr, 1.5), view: 8 },
    high: { shadow: 2048, bloom: true, ratio: Math.min(dpr, 2), view: 11 },
    ultra: { shadow: 4096, bloom: true, ratio: Math.min(dpr, 2), view: 11 },
  };
  let viewRadius = 11;
  function applyQuality(name) {
    const q = QUALITY[name] ?? QUALITY.high;
    renderer.setPixelRatio(q.ratio);
    composer.setPixelRatio(q.ratio);
    const light = sky.sunLight;
    light.castShadow = q.shadow > 0;
    if (q.shadow && light.shadow.mapSize.x !== q.shadow) { light.shadow.mapSize.set(q.shadow, q.shadow); light.shadow.map?.dispose(); light.shadow.map = null; }
    bloom.enabled = q.bloom;
    viewRadius = q.view;
    world.setView(q.view);
    sky.setView(q.view);
    resize();
    try { localStorage.setItem('archipel-quality', name); } catch { /* pas grave */ }
    document.querySelectorAll('#quality [data-q]').forEach((b) => b.classList.toggle('on', b.dataset.q === name));
  }
  document.querySelectorAll('#quality [data-q]').forEach((b) => b.addEventListener('click', () => applyQuality(b.dataset.q)));
  function resize() {
    composer.setSize(innerWidth, innerHeight);
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = handCam.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    handCam.updateProjectionMatrix();
  }
  addEventListener('resize', resize);
  applyQuality(localStorage.getItem('archipel-quality') ?? 'high');

  // Pas, vent et bruit des machines proches.
  const GLIDER_COLOR = { 1: 0xe8795a, 2: 0xf4c95d, 3: 0x4a4f63, 4: 0xbfd4ff };
  let chokeTimer = 0;
  let stepDist = 0, lastX = player.pos.x, lastZ = player.pos.z;
  function ambience(dt, running) {
    if (!running) { snd.hush(); return; }
    const moved = Math.hypot(player.pos.x - lastX, player.pos.z - lastZ);
    lastX = player.pos.x; lastZ = player.pos.z;
    if (player.onGround && moved < 1) {
      stepDist += moved;
      if (stepDist > (player.sneaking ? 1.5 : 2.1)) {
        stepDist = 0;
        snd.step(matOf(world.get(Math.floor(player.pos.x), Math.floor(player.pos.y - 0.5), Math.floor(player.pos.z))), player.sneaking);
      }
    }
    const speed = Math.hypot(player.vel.x, player.vel.y, player.vel.z), airborne = !player.onGround && !player.inLiquid;
    const high = dim === 0 ? Math.min(1, Math.max(0, (player.pos.y - 60) / 80)) : 0;
    snd.loop('wind', dim === 2 ? 0 : Math.min(1, 0.1 + high * 0.14 + (airborne ? Math.max(0, speed - 6) / 22 : 0)), 380 + (airborne ? speed * 22 : 0));
    snd.loop('rain', dim === 0 ? sky.rain : 0);
    snd.loop('fire', trip ? 1 : modelView.loud.fire);
    snd.loop('hum', modelView.loud.hum);
    snd.loop('rotor', modelView.loud.rotor);
  }
  const volume = $('volume');
  volume.value = Math.round(snd.volume * 100);
  volume.addEventListener('input', () => { snd.setVolume(volume.value / 100); snd.tone(660, 0.08, 'triangle', 0.06); });

  const WHITE = new THREE.Color(0xffffff);
  let last = performance.now(), fov = 75, infoTimer = 0, updraftTimer = 0, glideHint = false, startHint = !save;
  function frame(now) {
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
    last = Math.max(last, now);
    const playing = mode === 'play', running = playing || mode === 'inv' || mode === 'chat' || mode === 'travel' || (multi && mode === 'menu');

    world.update(player.pos.x, player.pos.z);

    if (running && world.ready(player.pos.x, player.pos.z)) {
      if ((updraftTimer -= dt) <= 0) {
        updraftTimer = 0.5;
        player.updrafts = world.updraftsNear(player.pos.x, player.pos.z)
          .concat(world.fans.map((f) => ({ x: f.x + 0.5, z: f.z + 0.5, r: 1.7, bottom: f.y + 1, top: f.y + 30 })));
        sky.setColumns(player.updrafts);
      }

      // Réacteur dorsal
      // Ce que le sac et l'armure changent au corps : planeur, modules bioniques, pesanteur du monde.
      player.glide = dim === 2 ? null : inv.glider(); // pas d'air dans l'Éther : rien ne porte une voile
      if (player.glide) wing.material.color.setHex(GLIDER_COLOR[player.glide.tier]);
      for (const k in fx) if ((fx[k] -= dt) <= 0) { delete fx[k]; ui.toast(`${FX[k]?.name ?? 'Effet'} : l'effet se dissipe.`); dirty = true; }
      player.gravityK = (dim === 2 ? 0.3 : 1) * (fx.light ? 0.55 : 1);
      player.speedK = (inv.hasMod('speed') ? 1.3 : 1) * (fx.euphoria ? 1.35 : 1) * (fx.rush ? 1.2 : 1);
      player.jumpK = (inv.hasMod('spring') ? 1.4 : 1) * (fx.euphoria ? 1.2 : 1);
      bloom.strength += ((fx.euphoria ? 1.1 : 0.5) - bloom.strength) * Math.min(1, dt * 2);
      player.pickR2 = inv.hasMod('magnet') ? 36 : 2.4;
      shade.uMin.value += ((inv.hasMod('night') || fx.vision ? (dim === 0 && !sky.night ? 0.12 : 0.5) : 0.035) - shade.uMin.value) * Math.min(1, dt * 4);
      // Oxygène : deux minutes et demie d'autonomie dans l'Éther, puis une cartouche part toute seule.
      if (dim === 2 && !creative && !inv.hasMod('air')) {
        air -= dt * (100 / 150);
        if (air <= 0) {
          if (inv.count(I.OXY) > 0) { inv.remove(I.OXY, 1); air = 100; ui.toast(`Cartouche d'oxygène entamée (il en reste ${inv.count(I.OXY)}).`); ui.refreshHotbar(selected); dirty = true; }
          else { air = 0; if ((chokeTimer -= dt) <= 0) { chokeTimer = 1; damage(2, false); ui.toast("Plus d'oxygène !"); } }
        }
      } else air = Math.min(100, air + dt * 25);
      spaceHeld = input.jump ? spaceHeld + dt : 0;
      const pack = inv.armor[1];
      input.jet = playing && jetReady() && spaceHeld > 0.22 && !player.onGround && !player.gliding && !player.pull;
      if (input.jet && ITEMS[pack.id].charge && !creative) { pack.c = Math.max(0, pack.c - ITEMS[pack.id].charge.use * dt); dirty = true; }

      const wasWet = player.inLiquid;
      if (trip) updateTrip(dt);
      const impact = trip ? 0 : player.update(dt, playing ? input : IDLE);
      if (impact > 5) snd.land(impact);
      if (!wasWet !== !player.inLiquid) snd.splash();
      if (impact > 15 && !inv.hasMod('spring') && !fx.light) damage((impact - 15) * 0.9 * (1 - 0.25 * (inv.armor[3]?.e?.feather ?? 0)), false);

      if (player.pos.y < -14) {
        const safe = player.safe ?? homeSpawn();
        world.ensure(safe.x, safe.z, 1);
        player.teleport(safe);
        fade.classList.add('on');
        setTimeout(() => fade.classList.remove('on'), 150);
        damage(4, false);
        if (mode !== 'dead') ui.toast('Le vent te ramène sur la terre ferme, non sans mal.');
      }
      if (!glideHint && !player.onGround && !player.gliding && !player.pull && !player.fly && player.vel.y < -9) {
        glideHint = true;
        ui.toast(player.glide ? 'Espace pour ouvrir le planeur !' : dim === 2 ? "Pas d'air pour planer ici : il faut un réacteur dorsal ou des ailes de braise." : 'Sans planeur, tu tombes : 4 bâtons et 6 feuillages en font un.');
      }
      if (startHint && playing) { startHint = false; ui.toast('Frappe un tronc pour récolter du bois, puis ouvre ton sac avec E.'); }

      survival(dt);
      if (playing) padStep(dt);
      if (mobSim) {
        mobSim.update(dt, { dim, night: sky.night, players: [{ id: 0, pos: player.pos, alive: mode !== 'dead' }], safe: safeSpot, turrets: world.turrets });
        mobView.sync(mobSim.rows());
      }
      if (fluids?.update(dt)) world.meshAllDirty();
      if ((goalTimer -= dt) <= 0) { goalTimer = 1.5; checkGoals(); }
      if (player.inLiquid === B.LAVA && (lavaTimer -= dt) <= 0) { lavaTimer = 0.5; damage(3, false); }
      updateFuses(dt);
      if (sim && (simTimer -= dt) <= 0) { simTimer += 0.2; sim.tick(0.2, sky.time); }
      drops.update(dt, world, dim, player, !multi, mode === 'dead' ? () => {} : pickUp);
      if (ui.tile && (tileTimer -= dt) <= 0) {
        tileTimer = 0.25;
        if (world.get(ui.tile.x, ui.tile.y, ui.tile.z) !== ui.tile.id) closeInventory();
        else { if (sim) ui.tile.state = sim.view(dim, ui.tile.x, ui.tile.y, ui.tile.z); ui.renderTile(); }
      }
    }

    if (trip) {
      // Vue de l'extérieur : la caméra suit la fusée, en retrait.
      const m = trip.mesh.position, back = trip.phase === 'up' ? 7 + Math.min(6, trip.t * 1.2) : 9;
      camera.position.set(m.x + back * 0.7, m.y + (trip.phase === 'up' ? 1.5 - Math.min(4, trip.t) : 3), m.z + back);
      camera.lookAt(m.x, m.y + 0.9, m.z);
    } else {
      camera.position.set(player.pos.x, player.eyeY, player.pos.z);
      camera.rotation.set(player.pitch, player.yaw, player.gliding ? Math.sin(now / 600) * 0.03 : 0);
    }
    const wantFov = player.gliding || player.pull ? 88 : input.run && player.moving && !player.sneaking ? 80 : 75;
    if (Math.abs(wantFov - fov) > 0.05) { fov += (wantFov - fov) * Math.min(1, dt * 6); camera.fov = fov; camera.updateProjectionMatrix(); }
    wing.visible = player.gliding && !player.fly;
    camera.updateMatrixWorld();

    camera.getWorldDirection(dir);
    target = world.raycast(camera.position, dir, REACH);
    const mh = mobView.raycast(camera.position, dir, 4.2);
    mobTarget = mh && (!target || mh.t < target.t) ? mh.mob : null;

    actionCd -= dt; useCd -= dt;
    if (playing) {
      if (input.mine) primary(dt); else { mineProg = 0; mineKey = null; }
      if (input.use && useCd <= 0) { useCd = 0.22; secondary(); }
    } else { mineProg = 0; }

    highlight.visible = !!target && !mobTarget && playing;
    if (target) highlight.position.set(target.x + 0.5, target.y + 0.5, target.z + 0.5);
    crack.visible = mineProg > 0 && !!target;
    if (crack.visible) {
      crack.position.copy(highlight.position);
      const stage = atlas.cracks[Math.min(4, Math.floor(mineProg * 5))];
      if (crackMat.map !== stage) { crackMat.map = stage; crackMat.needsUpdate = true; }
    }

    rope.visible = !!player.pull;
    if (player.pull) {
      const a = rope.geometry.attributes.position;
      tmpA.set(0.3, -0.3, -0.5).applyMatrix4(camera.matrixWorld);
      a.setXYZ(0, tmpA.x, tmpA.y, tmpA.z);
      a.setXYZ(1, player.pull.x, player.pull.y, player.pull.z);
      a.needsUpdate = true;
    }

    // Main
    setHand(inv.slots[selected]);
    swing = Math.max(0, swing - dt * 4.5);
    bob += dt * (player.moving && player.onGround ? 9 : 0);
    const sw = Math.sin(swing * Math.PI);
    hand.position.set(HAND_POS.x - sw * 0.06, HAND_POS.y + Math.sin(bob) * 0.012 - sw * 0.05, HAND_POS.z - sw * 0.1);
    hand.rotation.set(-sw * 0.95, sw * 0.25, 0);
    hand.visible = !player.gliding && !trip;

    for (let i = tracers.length - 1; i >= 0; i--) {
      const t = tracers[i];
      t.life -= dt;
      t.line.material.opacity = Math.max(0, t.life / 0.14);
      if (t.life <= 0) { scene.remove(t.line); t.line.geometry.dispose(); t.line.material.dispose(); tracers.splice(i, 1); }
    }
    for (let i = booms.length - 1; i >= 0; i--) {
      const b = booms[i];
      b.life -= dt;
      b.m.scale.setScalar(1 + (1 - b.life / 0.3) * (b.size + 0.3));
      b.m.material.opacity = Math.max(0, b.life / 0.3);
      if (b.life <= 0) { scene.remove(b.m); b.m.geometry.dispose(); b.m.material.dispose(); booms.splice(i, 1); }
    }

    sky.update(dt, camera);
    shade.uTime.value = now / 1000;
    const eyeIn = world.get(Math.floor(camera.position.x), Math.floor(camera.position.y), Math.floor(camera.position.z));
    veil.style.opacity = LIQUID.has(eyeIn) ? 1 : 0;
    if (LIQUID.has(eyeIn)) veil.style.background = fluidKind(eyeIn) === 2 ? 'rgba(255,90,20,.6)' : 'rgba(40,110,200,.45)';
    { const here = lightAt(player.pos.x, player.pos.y + 1, player.pos.z); dropMats.block.color.copy(here); dropMats.item.color.copy(here); }
    tmpColor.copy(lightAt(camera.position.x, camera.position.y, camera.position.z)).lerp(WHITE, 0.15);
    for (const k in handMats) handMats[k].color.copy(k === 'arm' ? ARM : WHITE).multiply(tmpColor);
    modelView.update(dt, {
      powered: world.powered, active: activeSet(dim), vis: world.vis, lightAt, eye: camera.position,
      sunTilt: dim === 0 && !sky.night ? Math.max(-0.75, Math.min(0.75, -Math.atan2(sky.sunDir.x, Math.max(0.2, sky.sunDir.y)))) : 0,
    });
    ambience(dt, running);
    remotes.update(dt, dim, lightAt);
    mobView.update(dt, lightAt, player.pos);

    if (net && (netTimer -= dt) <= 0) {
      netTimer = 0.1;
      const r = (v) => Math.round(v * 100) / 100;
      // Position, puis ce que les autres voient de nous : objet tenu, armure, accroupi.
      net.send({ t: 'pos', s: [dim, r(player.pos.x), r(player.pos.y), r(player.pos.z), r(player.yaw), r(player.pitch), player.gliding ? 1 : 0, mode === 'dead' ? 0 : 1,
        inv.slots[selected]?.id ?? 0, ...inv.armor.map((a) => a?.id ?? 0), player.sneaking ? 1 : 0] });
    }

    ui.refreshBars(player.hp, player.hunger, inv.armorPoints());
    { const l = levelOf(player.xp); ui.refreshXp(l, (player.xp - xpForLevel(l)) / (xpForLevel(l + 1) - xpForLevel(l))); }
    if ((infoTimer -= dt) <= 0) {
      infoTimer = 0.25;
      const h = Math.floor(sky.time * 24), m = Math.floor((sky.time * 24 % 1) * 6) * 10;
      const biome = world.biomeAt(player.pos.x, player.pos.z) ?? 'Plein ciel';
      const state = player.gliding ? (player.inUpdraft ? ' · courant ascendant' : ' · en vol plané') : '';
      const here = world.island(Math.floor(player.pos.x / 112), Math.floor(player.pos.z / 112));
      sky.biome = here && Math.hypot(here.x - player.pos.x, here.z - player.pos.z) < here.r + 30 ? here.biome : 0;
      const boss = [...mobView.map.values()].find((q) => q.def.boss), bossEl = $('boss');
      bossEl.classList.toggle('hidden', !boss);
      if (boss) { bossEl.firstChild.textContent = boss.def.name; bossEl.querySelector('i').style.width = Math.max(0, (boss.hp / boss.def.hp) * 100) + '%'; }
      const online = compassLine() + (multi ? `<br>${remotes.map.size + 1} en ligne` : '') + (inv.armor[1] && ITEMS[inv.armor[1].id].charge ? `<br>Réacteur dorsal ${Math.round(((inv.armor[1].c ?? 0) / ITEMS[inv.armor[1].id].charge.max) * 100)} %` : '');
      info.innerHTML = `ALTITUDE <b>${Math.max(0, Math.round(player.pos.y))}</b><br>${DIMS[dim]} · ${biome}${player.fly ? ' · en vol' : state}${creative ? '<br>MODE CRÉATIF' : ''}${Object.keys(fx).map((k) => `<br>${FX[k]?.name ?? k} ${Math.floor(fx[k] / 60)}:${String(Math.floor(fx[k] % 60)).padStart(2, '0')}`).join('')}${dim === 2 && !creative ? `<br>OXYGÈNE <b>${inv.hasMod('air') ? '∞' : Math.ceil(air) + ' %'}</b>` : ''}<br>${String(h).padStart(2, '0')}h${String(m).padStart(2, '0')}${sky.night && dim === 0 ? ' · nuit' : ''}${online}`;
    }
    if (dirty && (saveTimer -= dt) <= 0) { saveTimer = 5; persist(); }

    handPass.enabled = hand.visible;
    composer.render();
  }
  const ARM = new THREE.Color(0xe9b58f), tmpColor = new THREE.Color();
  function loop(now) { frame(now); requestAnimationFrame(loop); }
  requestAnimationFrame(loop);
  lock();

  // Accès console pour bricoler / déboguer
  window.archipel = {
    get world() { return world; },
    get target() { return target; },
    get mode() { return mode; },
    get dim() { return dim; },
    get creative() { return creative; }, fx, get trip() { return trip; }, launch, command, say, openChat,
    player, sky, inv, camera, input, mobs: mobSim, mobView, fluids, ui, give, travel, damage, remotes, net, sim, drops, dropStack, blast, B, I, modelView, snd,
    select(i) { selected = i; ui.refreshHotbar(i); },
    tick(ms) { frame(last + ms); },
    forceLock(on) { debugLock = on; if (on) { mode = 'play'; overlay.classList.add('hidden'); } },
  };
}

// Raccourci de test : ?solo démarre directement une partie solo.
if (new URLSearchParams(location.search).has('solo')) startGame({});
