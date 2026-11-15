// Serveur d'Archipel : sert le jeu et héberge la partie multijoueur.
// Il fait autorité sur le monde partagé : terrain, blocs, machines, liquides, créatures, objets au sol.
// Il annonce aussi sa présence sur le réseau local (UDP) pour que les autres le trouvent.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import dgram from 'node:dgram';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { Sim, MACHINES, key as posKey } from '../src/sim.js';
import { B, ITEMS } from '../src/items.js';
import { World, recordEdit } from '../src/world.js';
import { MobSim } from '../src/mobsim.js';
import { Fluids } from '../src/fluids.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEV = process.argv.includes('--dev');
const PORT = Number(process.env.PORT) || 5180;
const BEACON_PORT = 51800;
const DAY_LENGTH = 720;
const WORLD_FILE = path.join(ROOT, 'server', 'world.json');
const INSTANCE = crypto.randomUUID();
const NAME = process.env.ARCHIPEL_NAME || os.hostname().replace(/\.local$/, '');
const LOAD_RADIUS = 6; // tronçons de terrain tenus en mémoire autour de chaque joueur

// ---------- Monde partagé ----------
let saved;
try { saved = JSON.parse(fs.readFileSync(WORLD_FILE, 'utf8')); } catch { /* premier lancement */ }
if (!saved?.seed || !Array.isArray(saved.edits?.[0])) saved = { id: crypto.randomUUID().slice(0, 8), seed: (Math.random() * 2 ** 31) | 0, time: 0.34, edits: [[], [], []] };
while (saved.edits.length < 3) saved.edits.push([]); // mondes ajoutés depuis : Ciel, Braise, Éther
// Personnages : sac, position, journal de chaque joueur, retrouvés par son pseudo.
const characters = saved.players && typeof saved.players === 'object' ? saved.players : {};
const charKey = (name) => name.trim().toLowerCase();
const meta = { id: saved.id, seed: saved.seed, time: saved.time, clock: saved.clock ?? 0 };
// Modifications des joueurs, par monde : Map(clé de tronçon -> Map(index local -> bloc))
const edits = saved.edits.map((list) => new Map(list.map(([key, flat]) => {
  const m = new Map();
  for (let i = 0; i < flat.length; i += 2) m.set(flat[i], flat[i + 1]);
  return [key, m];
})));
const editsOut = () => edits.map((m) => [...m].map(([key, mm]) => [key, [...mm].flat()]));
let worldDirty = false;
function snapshot() { return JSON.stringify({ ...meta, edits: editsOut(), sim: sim.toJSON(), players: characters }); }
setInterval(() => { if (worldDirty) { worldDirty = false; fs.writeFile(WORLD_FILE, snapshot(), () => {}); } }, 10000);

// ---------- Joueurs ----------
const players = new Map(); // ws -> { id, name, s: [monde, x, y, z, cap, tangage, planeur, vivant], sub }
let nextId = 1;
const broadcast = (msg, except) => {
  const data = JSON.stringify(msg);
  for (const ws of players.keys()) if (ws !== except && ws.readyState === 1) ws.send(data);
};
const sendTo = (id, msg) => { for (const [ws, p] of players) if (p.id === id && ws.readyState === 1) ws.send(JSON.stringify(msg)); };
const int = (v) => Number.isInteger(v);
const inDim = (d) => [...players.values()].filter((p) => p.s && p.s[0] === d);

// ---------- Objets au sol ----------
const drops = new Map();
let dropSeq = 1;
function spawnDrop(d, x, y, z, s, centered = true) {
  const k = 's' + dropSeq++;
  const drop = { k, d, p: centered ? [x + 0.5, y + 0.6, z + 0.5] : [x, y, z], v: [(Math.random() - 0.5) * 2, 3, (Math.random() - 0.5) * 2], s, born: Date.now() };
  drops.set(k, drop);
  broadcast({ t: 'drop', ...drop });
}
setInterval(() => { const now = Date.now(); for (const [k, d] of drops) if (now - d.born > 300000) { drops.delete(k); broadcast({ t: 'gone', k }); } }, 15000);

// ---------- Terrain, machines, liquides, créatures ----------
const worlds = [0, 1, 2].map((d) => { const w = new World(meta.seed, d, edits[d], null, null); w.headless = true; return w; });

// Toute modification de bloc passe par ici : terrain du serveur, sauvegarde, joueurs, machines, liquides.
function applySet(d, x, y, z, id, info, except) {
  if (y < 0 || y >= 160) return;
  if (!worlds[d].setBlock(x, y, z, id, false)) recordEdit(edits[d], x, y, z, id);
  worldDirty = true;
  broadcast({ t: 'set', d, x, y, z, id }, except);
  sim.onSet(d, x, y, z, id, info);
  fluids[d].touch(x, y, z);
}

function explode(d, x, y, z, r) {
  for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) for (let dz = -r; dz <= r; dz++) {
    if (dx * dx + dy * dy + dz * dz > r * r || y + dy < 0 || y + dy >= 160) continue;
    const bx = x + dx, by = y + dy, bz = z + dz;
    if (!worlds[d].setBlock(bx, by, bz, 0, false)) recordEdit(edits[d], bx, by, bz, 0);
    if (sim.dims[d].blocks.has(posKey(bx, by, bz))) sim.onSet(d, bx, by, bz, 0);
    fluids[d].touch(bx, by, bz);
  }
  mobs[d].blast(x + 0.5, y + 0.5, z + 0.5, r * 2, r * 5);
  worldDirty = true;
  broadcast({ t: 'boom', d, x, y, z, r });
}

const sim = new Sim({
  drop: spawnDrop,
  power: (d) => broadcast({ t: 'pw', d, keys: [...sim.dims[d].powered] }),
  active: (d) => broadcast({ t: 'act', d, keys: [...sim.dims[d].active] }),
  vis: (d, k, v) => broadcast({ t: 'vis', d, k, v }),
  setBlock: (d, x, y, z, id, meta) => applySet(d, x, y, z, id, meta),
  explode,
});
edits.forEach((m, d) => sim.loadEdits(d, m));
sim.load(saved.sim);

const fluids = worlds.map((w, d) => new Fluids(w, (x, y, z, id) => applySet(d, x, y, z, id)));
const mobs = worlds.map((w, d) => new MobSim(w, {
  hitPlayer: (id, dmg, kx, kz) => sendTo(id, { t: 'hurt', dmg, kx, kz }),
  drop: (x, y, z, s) => spawnDrop(d, x, y, z, s, false),
  xp: (id, n) => sendTo(id, { t: 'xp', n }),
  born: (name) => broadcast({ t: 'born', d, name }),
  tracer: (a, b) => { const data = { t: 'fx', a: [a.x, a.y, a.z], b: [b.x, b.y, b.z] }; for (const [ws, p] of players) if (p.s?.[0] === d && ws.readyState === 1) ws.send(JSON.stringify(data)); },
}));

const isNight = () => Math.sin((meta.time - 0.25) * Math.PI * 2) < -0.08;
// Une lampe allumée tient les créatures hostiles à distance.
function safeSpot(d, x, y, z) {
  const D = sim.dims[d];
  for (const b of D.blocks.values()) if (b.id === B.LAMP && D.powered.has(posKey(b.x, b.y, b.z)) && Math.hypot(b.x - x, b.y - y, b.z - z) < 18) return true;
  return false;
}

// Tourelles alimentées d'un monde : la liste n'est refaite qu'une fois par seconde, pas à chaque pas.
const turretCache = [null, null, null];
function turretsOf(d) {
  const c = turretCache[d];
  if (c && tickN - c.at < 20) return c.list;
  const D = sim.dims[d], list = [];
  for (const b of D.blocks.values()) if (b.id === B.TURRET && D.powered.has(posKey(b.x, b.y, b.z))) list.push(b);
  turretCache[d] = { at: tickN, list };
  return list;
}

// Boucle du monde : 20 pas par seconde.
let tickN = 0;
setInterval(() => {
  tickN++;
  meta.time = (meta.time + 0.05 / DAY_LENGTH) % 1;
  meta.clock += 0.05;
  for (let d = 0; d < 3; d++) {
    const here = inDim(d);
    if (tickN % 10 === 0) {
      for (const p of here) worlds[d].loadAround(p.s[1], p.s[3], LOAD_RADIUS, 24);
      if (tickN % 200 === 0) worlds[d].unloadFar(here.map((p) => ({ x: p.s[1], z: p.s[3] })), LOAD_RADIUS + 3);
    }
    if (!here.length) { if (mobs[d].list.length) mobs[d].clear(); continue; }
    const D = sim.dims[d];
    mobs[d].update(0.05, {
      dim: d, night: isNight(),
      players: here.map((p) => ({ id: p.id, pos: { x: p.s[1], y: p.s[2], z: p.s[3] }, alive: p.s[7] !== 0 })),
      safe: (x, y, z) => safeSpot(d, x, y, z),
      turrets: turretsOf(d),
    });
    fluids[d].update(0.05);
  }
  if (tickN % 2 === 0 && players.size) {
    const p = [];
    for (const o of players.values()) if (o.s) p.push([o.id, ...o.s]);
    broadcast({ t: 's', time: meta.time, c: Math.round(meta.clock * 10) / 10, p });
    for (let d = 0; d < 3; d++) {
      const data = JSON.stringify({ t: 'm', d, r: mobs[d].rows() });
      for (const [ws, o] of players) if (o.s?.[0] === d && ws.readyState === 1) ws.send(data);
    }
  }
  if (tickN % 4 === 0) {
    sim.tick(0.2, meta.time);
    for (const [ws, p] of players) if (p.sub && ws.readyState === 1) sendTile(ws, p.sub);
  }
}, 50);

const validStack = (s) => s && ITEMS[s.id] && Number.isInteger(s.n) && s.n > 0 && s.n <= ITEMS[s.id].stack;
const okDim = (d) => d === 0 || d === 1 || d === 2;
const at = (m) => okDim(m.d) && int(m.x) && int(m.y) && int(m.z);
const tileOf = (m) => (at(m) ? sim.dims[m.d].tiles.get(posKey(m.x, m.y, m.z)) : null);
const sendTile = (ws, sub) => ws.send(JSON.stringify({ t: 'tile', d: sub.d, x: sub.x, y: sub.y, z: sub.z, st: sim.view(sub.d, sub.x, sub.y, sub.z) }));
const reply = (ws, m, body) => ws.send(JSON.stringify({ t: 'tres', rid: m.rid, ...body }));

function closeTile(p) {
  if (p.sub) sim.setOpen(p.sub.d, p.sub.x, p.sub.y, p.sub.z, false);
  p.sub = null;
}

function onMessage(ws, raw) {
  let m;
  try { m = JSON.parse(raw); } catch { return; }
  const me = players.get(ws);
  if (m.t === 'hello' && !me) {
    const p = { id: nextId++, name: String(m.name || 'Voyageur').slice(0, 16), s: null };
    players.set(ws, p);
    ws.send(JSON.stringify({
      t: 'welcome', id: p.id, worldId: meta.id, seed: meta.seed, time: meta.time, edits: editsOut(),
      drops: [...drops.values()], powered: sim.dims.map((D) => [...D.powered]), active: sim.dims.map((D) => [...D.active]),
      vis: sim.dims.map((D) => [...D.vis]), me: characters[charKey(p.name)] ?? null,
      players: [...players.values()].filter((o) => o !== p).map((o) => ({ id: o.id, name: o.name })),
    }));
    broadcast({ t: 'join', id: p.id, name: p.name }, ws);
    console.log(`+ ${p.name} (${players.size} en ligne)`);
    return;
  }
  if (!me) return;
  switch (m.t) {
    case 'pos':
      if (Array.isArray(m.s) && m.s.length >= 8 && m.s.length <= 14 && m.s.every((v) => typeof v === 'number' && Number.isFinite(v)) && okDim(m.s[0])) me.s = m.s;
      break;
    case 'set':
      if (at(m) && int(m.id) && m.id >= 0 && m.id < 400) {
        const info = m.meta && typeof m.meta === 'object' ? { src: m.meta.src | 0, rot: m.meta.rot & 3, f: m.meta.f && Number.isFinite(m.meta.f.amt) ? { id: m.meta.f.id | 0, amt: m.meta.f.amt } : undefined } : undefined;
        applySet(m.d, m.x, m.y, m.z, m.id, info, ws);
      }
      break;
    case 'hit': { // un joueur frappe une créature
      const mob = me.s && mobs[me.s[0]].byId(m.id);
      if (mob && typeof m.dmg === 'number' && m.dmg > 0 && m.dmg <= 40 && Math.hypot(mob.pos.x - me.s[1], mob.pos.z - me.s[3]) < 80) mobs[me.s[0]].hurt(mob, m.dmg, Number(m.kx) || 0, Number(m.kz) || 0, me.id);
      break;
    }
    case 'mob': { // nourrir ou tondre : le serveur décide, le joueur ne perd son blé que si ça prend
      const ms = me.s && mobs[me.s[0]], mob = ms?.byId(m.id);
      const near = mob && Math.hypot(mob.pos.x - me.s[1], mob.pos.y - me.s[2], mob.pos.z - me.s[3]) < 8;
      reply(ws, m, { res: !near ? (m.op === 'feed' ? 'no' : false) : m.op === 'feed' ? ms.feed(mob) : ms.shear(mob) });
      break;
    }
    case 'tfilter': reply(ws, m, { res: at(m) && m.o && typeof m.o === 'object' ? sim.filterOp(m.d, m.x, m.y, m.z, m.side | 0, { op: String(m.o.op), i: m.o.i | 0, id: m.o.id | 0 }) : null }); worldDirty = true; break;
    case 'tpadset': if (at(m) && m.set && typeof m.set === 'object') { sim.padSet(m.d, m.x, m.y, m.z, m.set); worldDirty = true; } break;
    case 'tpad': reply(ws, m, { res: at(m) ? sim.padDest(m.d, m.x, m.y, m.z) : null }); break;
    case 'summon': // appât du Colosse, dans la Braise seulement
      if (me.s && me.s[0] === 1 && [m.x, m.y, m.z].every(Number.isFinite) && Math.hypot(m.x - me.s[1], m.z - me.s[3]) < 12) mobs[1].summon(m.x, m.y, m.z);
      break;
    case 'blast': // souffle d'une explosion déclenchée par un joueur
      if (me.s && [m.x, m.y, m.z, m.r, m.dmg].every(Number.isFinite) && m.r <= 16 && m.dmg <= 40) mobs[me.s[0]].blast(m.x, m.y, m.z, m.r, m.dmg, me.id);
      break;
    case 'drop':
      if (okDim(m.d) && validStack(m.s) && Array.isArray(m.p) && m.p.length === 3 && Array.isArray(m.v) && m.v.length === 3 && [...m.p, ...m.v].every(Number.isFinite)) {
        const k = `p${me.id}-${dropSeq++}`;
        const drop = { k, d: m.d, p: m.p, v: m.v, s: m.s, born: Date.now() };
        drops.set(k, drop);
        broadcast({ t: 'drop', ...drop, from: me.id });
      }
      break;
    case 'pick':
      if (drops.has(m.k)) {
        const drop = drops.get(m.k);
        drops.delete(m.k);
        ws.send(JSON.stringify({ t: 'got', k: m.k, s: drop.s }));
        broadcast({ t: 'gone', k: m.k }, ws);
      } else ws.send(JSON.stringify({ t: 'gone', k: m.k }));
      break;
    case 'topen':
      if (at(m) && MACHINES[m.id]) {
        closeTile(me);
        sim.tileAt(m.d, m.x, m.y, m.z, m.id);
        me.sub = { d: m.d, x: m.x, y: m.y, z: m.z };
        sim.setOpen(m.d, m.x, m.y, m.z, true);
        sendTile(ws, me.sub);
      }
      break;
    case 'tclose': closeTile(me); break;
    case 'chat': {
      const text = String(m.text ?? '').trim().slice(0, 160);
      if (text) broadcast({ t: 'chat', name: me.name, text }, ws);
      break;
    }
    case 'cmd': // commandes qui touchent le monde partagé
      if (m.c === 'time' && Number.isFinite(m.v) && m.v >= 0 && m.v < 1) { meta.time = m.v; worldDirty = true; broadcast({ t: 'time', v: m.v }); }
      break;
    case 'save': { // le joueur confie son personnage au serveur
      const raw = m.data && typeof m.data === 'object' ? JSON.stringify(m.data) : '';
      if (raw && raw.length < 30000) { characters[charKey(me.name)] = JSON.parse(raw); worldDirty = true; }
      break;
    }
    case 'tput':
      if (validStack(m.s)) { const tile = tileOf(m); reply(ws, m, { left: tile ? sim.put(tile, m.slot | 0, m.s) : m.s.n }); worldDirty = true; }
      break;
    case 'ttake': reply(ws, m, { s: sim.take(tileOf(m), m.slot | 0, m.n | 0) }); worldDirty = true; break;
    case 'twrench': reply(ws, m, { res: at(m) ? sim.wrench(m.d, m.x, m.y, m.z, m.side | 0) : null }); worldDirty = true; break;
    case 'tbucket':
      reply(ws, m, { id: at(m) && MACHINES[m.id] ? sim.bucket(sim.tileAt(m.d, m.x, m.y, m.z, m.id), m.bucket | 0) : null });
      worldDirty = true;
      break;
    case 'tterm':
      if (!tileOf(m)) break;
      if (m.op === 'take') reply(ws, m, { s: sim.termTake(m.d, m.x, m.y, m.z, m.item | 0, m.n | 0) });
      else if (validStack(m.s)) reply(ws, m, { left: sim.termPut(m.d, m.x, m.y, m.z, m.s) });
      worldDirty = true;
      break;
    default:
  }
}

// ---------- Découverte sur le réseau local ----------
const found = new Map();
function lanAddresses() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) for (const a of list ?? []) {
    if (a.family !== 'IPv4' || a.internal) continue;
    const ip = a.address.split('.').map(Number), mask = a.netmask.split('.').map(Number);
    out.push({ address: a.address, broadcast: ip.map((v, i) => (v | (~mask[i] & 255))).join('.') });
  }
  return out;
}
try {
  const udp = dgram.createSocket({ type: 'udp4', reuseAddr: true });
  udp.on('error', (e) => console.warn('Découverte réseau indisponible :', e.message));
  udp.on('message', (buf, rinfo) => {
    try {
      const m = JSON.parse(buf.toString());
      if (m.app !== 'archipel' || m.instance === INSTANCE) return;
      found.set(m.instance, { name: String(m.name).slice(0, 40), address: rinfo.address, port: m.port | 0, players: m.players | 0, seen: Date.now() });
    } catch { /* paquet étranger */ }
  });
  udp.bind(BEACON_PORT, () => {
    udp.setBroadcast(true);
    setInterval(() => {
      const msg = Buffer.from(JSON.stringify({ app: 'archipel', instance: INSTANCE, name: NAME, port: PORT, players: players.size }));
      for (const target of new Set(['255.255.255.255', ...lanAddresses().map((a) => a.broadcast)])) udp.send(msg, BEACON_PORT, target, () => {});
    }, 2000);
  });
} catch (e) { console.warn('Découverte réseau indisponible :', e.message); }

// ---------- HTTP ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
function serveStatic(req, res) {
  const dist = path.join(ROOT, 'dist');
  const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = path.normalize(path.join(dist, rel));
  if (!file.startsWith(dist) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dist, 'index.html');
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('Lance "npm run build" avant "npm start".'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer();
let vite = null;
if (DEV) {
  const { createServer } = await import('vite');
  vite = await createServer({ root: ROOT, appType: 'spa', server: { middlewareMode: true, hmr: false } });
}
server.on('request', (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname.startsWith('/api/')) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    if (url.pathname === '/api/info') {
      res.end(JSON.stringify({ name: NAME, port: PORT, players: players.size, addresses: lanAddresses().map((a) => a.address) }));
    } else if (url.pathname === '/api/servers') {
      const now = Date.now();
      for (const [k, s] of found) if (now - s.seen > 7000) found.delete(k);
      res.end(JSON.stringify([...found.values()].map(({ seen, ...s }) => s)));
    } else { res.statusCode = 404; res.end('{}'); }
    return;
  }
  if (vite) vite.middlewares(req, res); else serveStatic(req, res);
});

const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });
server.on('upgrade', (req, socket, head) => {
  if (new URL(req.url, 'http://x').pathname !== '/ws') { socket.destroy(); return; }
  wss.handleUpgrade(req, socket, head, (ws) => {
    ws.on('message', (raw) => { try { onMessage(ws, raw); } catch (e) { console.warn('Message ignoré :', e.message); } });
    ws.on('close', () => {
      const p = players.get(ws);
      if (!p) return;
      closeTile(p);
      players.delete(ws);
      broadcast({ t: 'leave', id: p.id });
      console.log(`- ${p.name} (${players.size} en ligne)`);
    });
    ws.on('error', () => {});
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Archipel « ${NAME} » — http://localhost:${PORT}`);
  for (const a of lanAddresses()) console.log(`  sur le réseau local : http://${a.address}:${PORT}`);
});
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { fs.writeFileSync(WORLD_FILE, snapshot()); process.exit(0); });
