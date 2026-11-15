import { F_FUEL } from './items.js';
import { B, BLOCKS, ITEMS, RECIPES, STATIONS, CATS, ARMOR_SLOTS, ENCHANTS, ELECTRIC, MODS, MOD_SLOTS, enchantsFor } from './items.js';
import { MACHINES, GEN, GUIDE, fluidOf } from './sim.js';

const $ = (id) => document.getElementById(id);
const SLOT_LABEL = { in: 'Entrée', fuel: 'Combustible', out: 'Sortie', rod: 'Barre', charge: 'À charger', seed: 'Germe', any: 'Contenu' };
const FLUID_NAME = { [B.WATER]: 'Eau', [B.LAVA]: 'Lave', [F_FUEL]: 'Carburant' };
const fmt = (n) => Math.round(n).toLocaleString('fr-FR');
// Recherche : sans majuscules ni accents.
const norm = (t) => t.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
const RECIPE_TEXT = RECIPES.map((r) => norm(ITEMS[r.out].name + ' | ' + r.ins.map(([id]) => ITEMS[id].name).join(' | ')));
// Guide : ce qui se fabrique dans les machines, cherchable comme les recettes.
const GUIDE_TEXT = GUIDE.map((g) => norm(ITEMS[g.out[0]].name + ' | ' + BLOCKS[g.where].name + ' | ' + g.ins.map(([id]) => ITEMS[id].name).join(' | ')));
// Palette du mode créatif : tous les objets du jeu, par famille.
const PALETTE = Object.keys(ITEMS).map(Number).filter((id) => !ITEMS[id].legacy && !(id > 60 && id < 78)).map((id) => {
  const it = ITEMS[id];
  const fam = it.block ? (MACHINES[id] || ELECTRIC.has(id) || id === B.ITEM_PIPE || id === B.FLUID_PIPE ? 'Machines' : 'Blocs') : it.tool || it.gun || it.hook ? 'Outils' : it.armor ? 'Armures' : it.food ? 'Nourriture' : 'Objets';
  return { id, fam, text: norm(it.name) };
});
const FAMS = ['Blocs', 'Machines', 'Outils', 'Armures', 'Nourriture', 'Objets'];
// Notices : les montages qui ne se devinent pas. Affichées dans le guide, trouvées par la recherche.
const NOTES = [
  { title: 'Réacteur nucléaire (400 W)', icon: B.CORE, find: 'reacteur nucleaire coeur blindage uranium barre fission', steps: [
    "1. Fabrique 1 cœur de réacteur et 26 blindages (la recette en donne 2 à la fois).",
    "2. Pose le cœur au centre d'un cube de 3×3×3 : les 26 blindages le recouvrent entièrement, coins compris.",
    "3. Imprime des barres d'uranium à l'imprimante 3D : 2 uranites (dans la Braise) + 1 plaque.",
    "4. Clic droit sur n'importe quel blindage pour ouvrir le cœur, et dépose une barre : elle brûle 15 minutes.",
    "5. Colle un câble contre un blindage : le courant sort par là.",
    "Attention : si un blindage disparaît pendant qu'une barre brûle, le cœur fond et explose en 10 secondes.",
  ] },
  { title: "L'Éther : fusée, oxygène, titane", icon: B.ROCKET, find: 'fusee ether espace titane oxygene carburant planete monde asteroide bionique', steps: [
    "1. Compresseur : charbon → carbone, puis carbone + plaques → plaques composites. Fonderie d'alliages : fer + carbone → acier.",
    "2. Raffinerie : charbon → carburant liquide. Embouteilleuse (collée à la raffinerie ou reliée par tuyau à fluides) : bidons vides → bidons de carburant.",
    "3. Imprime un moteur-fusée, fabrique la fusée, pose-la à ciel ouvert et clic droit pour partir. Il faut 4 bidons par décollage : emporte de quoi revenir. La fusée fait le voyage avec toi.",
    "4. Dans l'Éther il n'y a pas d'air : le planeur ne porte pas (réacteur dorsal ou ailes de braise), et il faut des cartouches d'oxygène (électrolyseur) ou un respirateur.",
    "5. On y trouve le titane : aile de titane, armure bionique et ses modules. Les panneaux solaires y donnent le double, sans nuit.",
  ] },
  { title: 'Ferme automatique', icon: B.HARVESTER, find: 'ferme automatique recolteuse arroseur culture ble recolte', steps: [
    "Récolteuse (40 W) : elle cueille tout ce qui est mûr à 4 blocs autour d'elle, blé comme plants de minerai, et replante aussitôt.",
    "Arroseur (10 W + eau) : à 4 blocs autour de lui, tout pousse trois fois plus vite. Une pompe ou un tuyau à fluides le remplit.",
    "Un tuyau à objets réglé sur « tire » vide la récolteuse vers un coffre.",
  ] },
  { title: 'Élevage et téléporteurs', icon: B.TELEPAD, find: 'elevage nourrir nuaki picore laine cisailles tondre teleporteur', steps: [
    "Nourris deux Nuakis proches au blé (ou deux Picores aux graines) : ils se rejoignent et un petit naît. Il devient adulte en quatre minutes.",
    "Les cisailles tondent un Nuaki adulte : la laine repousse en deux minutes.",
    "Téléporteur : clic droit pour le nommer et choisir sa destination, puis monte dessus. Les deux bouts doivent être alimentés (15 W chacun).",
  ] },
  { title: 'Germes de minerai', icon: 184, find: 'germe minerai planter cultivateur graine pousse', steps: [
    "Un germe s'obtient à l'imprimante 3D (8 minerais + 1 circuit) ou auprès des villageois.",
    "Planté sur de la terre labourée à la houe, il pousse seul en quelques minutes. À la récolte, le germe revient.",
    "Dans un cultivateur de minerai (eau + courant), il pousse bien plus vite et se récolte par tuyau.",
  ] },
  { title: 'Herbes et chimie', icon: B.SYNTH, find: 'cannabis herbe joint coca cocaine ecstasy chimie decomposeur synthetiseur sechoir extracteur fiole substance effet drogue', steps: [
    "Graines : chez les villageois (cultivateur célien, sourcier cendreux) et dans les coffres anciens. Elles se plantent en terre labourée ; la récolte rend la graine.",
    "Trois variétés de cannabis, trois effets : « Verte des prairies » apaise (la vie remonte), « Brume d'altitude » allège (pesanteur réduite), « Lueur mycélienne » éclaire la nuit.",
    "Séchoir : têtes fraîches → têtes séchées. Tête séchée + papier (du blé) = un joint, 90 secondes d'effet. Extracteur : 2 têtes séchées → résine, plus longue.",
    "Décomposeur : charbon → carbone, champignons → azote, cartouche d'oxygène → oxygène, givre ou gelée → hydrogène, en fioles.",
    "Synthétiseur : carbone + hydrogène + azote → base cristalline, pressée au compresseur avec des baies → ecstasy (euphorie).",
    "Coca séchée → pâte (extracteur) → cocaïne au synthétiseur avec hydrogène et oxygène (surexcitation : mine et frappe plus fort).",
    "Reprendre une dose rallonge la durée, jusqu'à cinq minutes.",
  ] },
  { title: 'Filtres', icon: 400, find: 'filtre tuyau trier tri objets liquide raccord', steps: [
    "Filtre en main, clic droit sur le raccord d'un tuyau avec une machine : il s'y fixe (manchon doré).",
    "Clic droit sur ce raccord pour ouvrir le filtre : cinq cases. Clique une case avec un objet en main pour le désigner ; il n'est pas consommé.",
    "Sur un tuyau à fluides, c'est un seau plein ou un bidon de carburant qui désigne le liquide.",
    "Seul ce qui est désigné passe par ce raccord, dans les deux sens. Vide, il laisse tout passer.",
  ] },
  { title: 'Tuyaux et clé à molette', icon: 176, find: 'tuyau cle molette raccord tirer pousser debrancher cable', steps: [
    "Un tuyau se raccorde tout seul aux machines et aux autres tuyaux qu'il touche.",
    "Clé en main, clic droit sur un raccord : automatique (bague grise) → tire (pointe bleue) → pousse (pointe orange) → débranché.",
    "Un coffre, un tiroir ou un réservoir ne se vide que par un raccord réglé sur « tire ».",
    "Sur un câble, la clé branche ou débranche un côté. Sur une machine, elle la fait pivoter.",
  ] },
];
export const enchantText = (s) => (s.e ? Object.entries(s.e).map(([k, l]) => `${ENCHANTS[k].name} ${'I'.repeat(l)}`).join(', ') : '');

export class UI {
  // hooks : stations() -> Set des postes à portée, changed() après toute modification du sac,
  //         crafted(recette, n), drop(pile) pour jeter au sol
  constructor(inv, icons, hooks) {
    this.inv = inv;
    this.icons = icons;
    this.hooks = hooks;
    this.held = null; // pile tenue par le curseur dans le sac
    this.open = false;
    this.tile = null; // conteneur ou machine ouvert
    this.barsKey = '';
    this.cat = 'all'; // onglet de fabrication : 'all', 'ok' (faisables) ou une catégorie
    this.query = '';
    this.el = { inv: $('inv'), bag: $('bag'), armor: $('armor'), recipes: $('recipes'), stations: $('stations'), tilebox: $('tilebox'), cursor: $('cursor'), craftbar: $('craftbar'), search: $('search'), cats: $('cats'), hotbar: $('hotbar'), name: $('itemname'), toasts: $('toasts') };

    this.el.inv.addEventListener('contextmenu', (e) => e.preventDefault());
    this.el.inv.addEventListener('mousedown', (e) => {
      const s = e.target.closest('[data-i]'), a = e.target.closest('[data-a]'), r = e.target.closest('[data-r]');
      const t = e.target.closest('[data-t]'), p = e.target.closest('[data-p]');
      const f = e.target.closest('[data-f]'), g = e.target.closest('[data-g]'), o = e.target.closest('[data-o]'), d = e.target.closest('[data-d]');
      const fi = e.target.closest('[data-fi]');
      if (fi && this.filter) {
        // Poser un objet le désigne sans le consommer ; un clic à vide efface la case.
        const f = this.filter, i = +fi.dataset.fi, id = this.held?.id;
        if (id != null && f.fluid && fluidOf(id) == null) { this.hooks.note?.('Pour un liquide, pose un seau plein ou un bidon de carburant.'); return; }
        f.op(id != null ? { op: 'set', i, id } : { op: 'clear', i }, (res) => { if (Array.isArray(res)) f.slots = res; this.render(); });
        return;
      }
      if (e.target.closest('[data-frem]') && this.filter) { this.filter.op({ op: 'remove' }, (ok) => { if (ok) this.hooks.filterRemoved?.(); }); return; }
      const pad = e.target.closest('[data-pad]');
      if (pad && this.tile?.padSet) { this.tile.padSet({ to: pad.dataset.pad }); this.tile.state.to = pad.dataset.pad; this.renderTile(); return; }
      const c = e.target.closest('[data-c]'), pal = e.target.closest('[data-q]');
      if (pal) { this.takeCreative(+pal.dataset.q, e.button, e.shiftKey); this.refresh(); return; }
      if (c) { this.cat = c.dataset.c; this.el.recipes.scrollTop = 0; this.render(); return; }
      if (g) { this.clickTerminal(g.dataset.g === 'put' ? null : +g.dataset.g, e.button, e.shiftKey); return; }
      const u = e.target.closest('[data-u]');
      if (u) { this.uninstall(u.dataset.u); this.refresh(); return; }
      if (o) { if (this.altar === 'mods') this.install(o.dataset.o); else this.enchant(o.dataset.o); this.refresh(); return; }
      if (d) { this.buy(this.trade.offers[+d.dataset.d]); this.refresh(); return; }
      if (e.target.closest('[data-e]')) { const cur = this.altarItem; this.altarItem = this.held; this.held = cur; this.refresh(); return; }
      if (s) { if (e.shiftKey && this.tile) this.quickStore(+s.dataset.i); else this.click(this.inv.slots, +s.dataset.i, e.button, null); }
      else if (a) this.click(this.inv.armor, +a.dataset.a, e.button, +a.dataset.a);
      else if (r) this.craft(RECIPES[+r.dataset.r], e.shiftKey ? 5 : 1);
      else if (t) this.clickTile(+t.dataset.t, e.button, e.shiftKey);
      else if (p) this.fillPlan(MACHINES[this.tile.id].recipes[+p.dataset.p]);
      else if (e.target === this.el.inv && this.held) { this.hooks.drop(this.held); this.held = null; } // clic hors du panneau : jeter
      else return;
      this.refresh();
    });
    // Nom d'un téléporteur : validé par Entrée ou en quittant le champ.
    this.el.inv.addEventListener('change', (e) => { if (e.target.id === 'padname' && this.tile?.padSet) this.tile.padSet({ name: e.target.value }); });
    this.el.search.addEventListener('input', () => { this.query = this.el.search.value; this.el.recipes.scrollTop = 0; this.render(); });
    addEventListener('mousemove', (e) => {
      if (!this.open) return;
      this.el.cursor.style.left = e.clientX + 'px';
      this.el.cursor.style.top = e.clientY + 'px';
    });
  }

  refresh() { this.render(); this.hooks.changed(); }

  slotHTML(s, attrs, label = '') {
    let inner = label ? `<span class="k">${label}</span>` : '';
    if (s) {
      const it = ITEMS[s.id];
      inner += `<img src="${this.icons[s.id].url}" alt="">`;
      if (s.n > 1) inner += `<span class="n">${s.n > 999 ? (s.n / 1000).toFixed(1) + 'k' : s.n}</span>`;
      if (it.tool?.dur && s.d < it.tool.dur) inner += `<span class="dur"><i style="width:${Math.max(4, (s.d / it.tool.dur) * 100)}%"></i></span>`;
      if (it.charge) inner += `<span class="dur chg"><i style="width:${((s.c ?? 0) / it.charge.max) * 100}%"></i></span>`;
    }
    let title = '';
    if (s) {
      title = ITEMS[s.id].name;
      if (s.e) title += ' — ' + enchantText(s);
      if (s.f) title += ` — ${FLUID_NAME[s.f.id]} ${fmt(s.f.amt)} L`;
      if (s.m?.length) title += ' — modules : ' + s.m.map((k) => MODS[k].name).join(', ');
    }
    return `<div class="slot${s ? '' : ' empty'}${s?.e ? ' ench' : ''}" ${attrs}${s ? ` title="${title}"` : ''}>${inner}</div>`;
  }

  refreshHotbar(selected) {
    const slots = this.inv.slots;
    let html = '';
    for (let i = 0; i < 9; i++) html += this.slotHTML(slots[i], i === selected ? 'data-sel' : '', i + 1);
    this.el.hotbar.innerHTML = html;
    this.el.hotbar.querySelector('[data-sel]')?.classList.add('sel');
    const s = slots[selected];
    const it = s && ITEMS[s.id];
    this.el.name.textContent = s ? it.name + (it.charge ? ` · ${Math.round(((s.c ?? 0) / it.charge.max) * 100)} %` : '') + (s.e ? ` · ${enchantText(s)}` : '') : '';
  }

  refreshBars(hp, hunger, armor) {
    const key = `${Math.ceil(hp)}|${Math.ceil(hunger)}|${armor}`;
    if (key === this.barsKey) return;
    this.barsKey = key;
    const pips = (value, cls) => {
      let h = '';
      for (let i = 0; i < 10; i++) h += `<div class="pip ${cls} ${value >= i * 2 + 2 ? 'full' : value >= i * 2 + 1 ? 'half' : ''}"></div>`;
      return h;
    };
    $('hearts').innerHTML = pips(Math.ceil(hp), 'heart');
    $('foodpips').innerHTML = pips(Math.ceil(hunger), 'food');
    $('armorpips').innerHTML = armor > 0 ? pips(armor, 'shield') : '';
  }

  refreshXp(level, frac) {
    const key = level + '|' + Math.round(frac * 40);
    if (key === this.xpKey) return;
    this.xpKey = key;
    $('xpfill').style.width = frac * 100 + '%';
    $('xplevel').textContent = level > 0 ? level : '';
  }

  toast(text) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = text;
    this.el.toasts.appendChild(t);
    while (this.el.toasts.children.length > 4) this.el.toasts.firstChild.remove();
    setTimeout(() => t.remove(), 3300);
  }

  // ---------- Ouverture ----------
  // ctx : 'all' (touche E) ou 'bench' ; tile : lien vers un coffre ou une machine
  // altar : autel d'enchantement ; trade : { title, offers } d'un villageois
  show({ ctx = 'all', tile = null, altar = false, trade = null, journal = null, filter = null } = {}) {
    this.journal = journal;
    this.filter = filter; // { slots, fluid, op(o, cb) } : filtre d'un raccord de tuyau
    this.ctx = ctx;
    this.tile = tile;
    this.altar = altar;
    this.trade = trade;
    this.altarItem = null;
    this.open = true;
    this.query = this.el.search.value = '';
    this.el.inv.classList.remove('hidden');
    this.el.recipes.scrollTop = 0;
    this.render();
  }
  hide() {
    if (this.held) { const left = this.inv.addStack(this.held); if (left > 0) this.hooks.drop({ ...this.held, n: left }); this.held = null; }
    if (this.altarItem) { const left = this.inv.addStack(this.altarItem); if (left > 0) this.hooks.drop({ ...this.altarItem, n: left }); this.altarItem = null; }
    this.tile?.close?.();
    this.tile = null;
    this.altar = false;
    this.trade = null;
    this.journal = null;
    this.filter = null;
    this.open = false;
    this.el.search.blur();
    this.el.inv.classList.add('hidden');
    this.hooks.changed();
  }
  near() {
    const near = this.hooks.stations();
    if (this.ctx !== 'all') near.add(this.ctx);
    return near;
  }

  // Mode créatif : clic = une pile complète en main, clic droit = un seul, Maj + clic = directement dans le sac.
  takeCreative(id, button, shift) {
    const it = ITEMS[id], st = { id, n: button === 2 ? 1 : it.stack };
    if (it.tool?.dur) st.d = it.tool.dur;
    if (it.charge) st.c = it.charge.max;
    if (shift) this.inv.addStack(st); else this.held = st;
  }

  // ---------- Sac ----------
  click(arr, i, button, armorSlot) {
    const cur = arr[i], held = this.held;
    const stack = held ? ITEMS[held.id].stack : 0;
    if (button === 2) {
      if (held) {
        if (armorSlot != null) return;
        if (!cur) { arr[i] = { ...held, n: 1 }; held.n--; }
        else if (cur.id === held.id && cur.n < stack) { cur.n++; held.n--; }
        if (held.n <= 0) this.held = null;
      } else if (cur) {
        const half = Math.ceil(cur.n / 2);
        this.held = { ...cur, n: half };
        cur.n -= half;
        if (cur.n <= 0) arr[i] = null;
      }
      return;
    }
    if (held && armorSlot != null && ITEMS[held.id].armor?.slot !== armorSlot) return;
    if (held && cur && cur.id === held.id && stack > 1) {
      const m = Math.min(held.n, stack - cur.n);
      cur.n += m; held.n -= m;
      if (held.n <= 0) this.held = null;
    } else {
      arr[i] = held;
      this.held = cur;
    }
  }

  craft(r, times) {
    const near = this.near();
    if (r.station && !near.has(r.station)) return;
    let made = 0;
    for (let k = 0; k < times && this.inv.craft(r); k++) made++;
    if (made) this.hooks.crafted?.(r, made);
  }

  // ---------- Conteneurs et machines ----------
  clickTile(slot, button, shift) {
    const tile = this.tile, cur = tile.state?.slots[slot];
    const done = () => this.refresh();
    if (this.held) {
      const held = this.held, n = button === 2 ? 1 : held.n;
      tile.put(slot, { ...held, n }, (left) => {
        held.n -= n - left;
        if (held.n <= 0 && this.held === held) this.held = null;
        done();
      });
    } else if (cur) {
      const n = button === 2 ? Math.ceil(cur.n / 2) : cur.n;
      tile.take(slot, n, (st) => {
        if (!st) return done();
        if (shift) { const left = this.inv.addStack(st); if (left > 0) this.held = { ...st, n: left }; }
        else this.held = st;
        done();
      });
    }
  }

  // Maj + clic dans le sac : range la pile dans le conteneur ouvert.
  quickStore(i) {
    const st = this.inv.slots[i], tile = this.tile;
    if (!st || !tile.state) return;
    if (MACHINES[tile.id].terminal) {
      const n = st.n;
      tile.termPut({ ...st }, (left) => { st.n -= n - left; if (st.n <= 0 && this.inv.slots[i] === st) this.inv.slots[i] = null; this.refresh(); });
      return;
    }
    const kinds = MACHINES[tile.id].slots;
    const order = kinds.map((k, s) => s).filter((s) => kinds[s] !== 'out');
    const next = (idx) => {
      if (idx >= order.length || st.n <= 0) { if (st.n <= 0 && this.inv.slots[i] === st) this.inv.slots[i] = null; return this.refresh(); }
      const n = st.n;
      tile.put(order[idx], { ...st }, (left) => { st.n -= n - left; next(idx + 1); });
    };
    next(0);
  }

  // Clic sur un plan : dépose ses ingrédients depuis le sac.
  fillPlan(r) {
    const tile = this.tile, kinds = MACHINES[tile.id].slots, state = tile.state;
    if (!state) return;
    const used = new Set();
    const steps = r.ins.map(([id, n]) => {
      let slot = kinds.findIndex((k, s) => k === 'in' && state.slots[s]?.id === id);
      if (slot < 0) slot = kinds.findIndex((k, s) => k === 'in' && !state.slots[s] && !used.has(s));
      used.add(slot);
      const have = state.slots[slot]?.id === id ? state.slots[slot].n : 0;
      return { id, slot, n: Math.min(Math.max(0, n - have), this.inv.count(id)) };
    }).filter((s) => s.slot >= 0 && s.n > 0);
    const next = (i) => {
      if (i >= steps.length) return this.refresh();
      const { id, slot, n } = steps[i];
      this.inv.remove(id, n);
      tile.put(slot, { id, n }, (left) => { if (left > 0) this.inv.add(id, left); next(i + 1); });
    };
    next(0);
  }

  // Terminal : id = objet à retirer, null = déposer la pile tenue.
  clickTerminal(id, button, shift) {
    const tile = this.tile;
    if (this.held) {
      const held = this.held, n = held.n;
      tile.termPut({ ...held }, (left) => { held.n -= n - left; if (held.n <= 0 && this.held === held) this.held = null; this.refresh(); });
    } else if (id != null) {
      tile.termTake(id, button === 2 ? 1 : ITEMS[id].stack, (st) => {
        if (st) { if (shift) { const left = this.inv.addStack(st); if (left > 0) this.held = { ...st, n: left }; } else this.held = st; }
        this.refresh();
      });
    }
  }

  // Coût d'un enchantement en niveaux d'expérience : 3 par niveau visé.
  enchantOptions(st) {
    return enchantsFor(st.id).map((k) => {
      const next = (st.e?.[k] ?? 0) + 1;
      return next > ENCHANTS[k].max ? null : { k, next, cost: next * 3 };
    }).filter(Boolean);
  }
  enchant(k) {
    const st = this.altarItem, opt = st && this.enchantOptions(st).find((o) => o.k === k);
    if (!opt || this.hooks.level() < opt.cost) return;
    this.hooks.spend(opt.cost);
    st.e = { ...(st.e ?? {}), [k]: opt.next };
  }

  // Atelier bionique : installe un module du sac sur la pièce posée.
  install(k) {
    const st = this.altarItem, mod = MODS[k];
    if (!st || !mod || !ITEMS[st.id].bionic || ITEMS[st.id].armor.slot !== mod.slot || st.m?.includes(k) || (st.m?.length ?? 0) >= MOD_SLOTS || this.inv.count(mod.item) < 1) return;
    this.inv.remove(mod.item, 1);
    st.m = [...(st.m ?? []), k];
    this.hooks.installed?.(mod);
  }

  // Retire un module : il revient dans le sac, intact.
  uninstall(k) {
    const st = this.altarItem, mod = MODS[k];
    if (!st?.m?.includes(k)) return;
    st.m = st.m.filter((x) => x !== k);
    if (!st.m.length) delete st.m;
    const left = this.inv.add(mod.item, 1);
    if (left > 0) this.hooks.drop({ id: mod.item, n: 1 });
  }

  buy(offer) {
    const [cid, cn] = offer.cost;
    if (this.inv.count(cid) < cn) return;
    this.inv.remove(cid, cn);
    this.hooks.gain(offer.give[0], offer.give[1]);
  }

  renderSide() {
    const icon = (id, n) => `<span class="ing${this.inv.count(id) < n ? ' miss' : ''}" title="${ITEMS[id].name}"><img src="${this.icons[id].url}" alt="">${n}</span>`;
    if (this.filter) {
      const f = this.filter;
      $('crafttitle').textContent = f.fluid ? 'Filtre à liquides' : 'Filtre à objets';
      this.el.stations.textContent = f.fluid
        ? 'Seuls les liquides désignés passent par ce raccord. Clique une case avec un seau plein ou un bidon : il sert de modèle et reste dans ta main.'
        : "Seuls les objets désignés passent par ce raccord. Clique une case avec l'objet en main : il sert de modèle et reste dans ta main. Vide, le filtre laisse tout passer.";
      this.el.tilebox.innerHTML = '<div class="tslots">' + f.slots.map((id, i) => `<div class="tslot">${this.slotHTML(id != null ? { id, n: 1 } : null, `data-fi="${i}"`)}</div>`).join('') + '</div>';
      this.el.recipes.innerHTML = '<div class="recipe" data-frem="1"><div class="rname">Retirer le filtre<small>il revient dans ton sac</small></div></div>';
      return true;
    }
    if (this.altar === 'mods') {
      $('crafttitle').textContent = 'Atelier bionique';
      const st = this.altarItem, bio = st && ITEMS[st.id].bionic;
      this.el.stations.textContent = `Pose une pièce d'armure bionique : elle reçoit jusqu'à ${MOD_SLOTS} modules, imprimés à l'imprimante 3D. Un clic sur un module installé le retire.`;
      this.el.tilebox.innerHTML = `<div class="tslots"><div class="tslot">${this.slotHTML(st, 'data-e')}<small>Pièce</small></div></div>`;
      let html = '';
      if (st && !bio) html = '<div class="muted">Seule une armure bionique reçoit des modules.</div>';
      else if (st) {
        const full = (st.m?.length ?? 0) >= MOD_SLOTS;
        html = `<h3>Modules<span>${st.m?.length ?? 0} / ${MOD_SLOTS}</span></h3>`;
        for (const [k, mod] of Object.entries(MODS)) {
          if (mod.slot !== ITEMS[st.id].armor.slot) continue;
          const on = st.m?.includes(k), have = this.inv.count(mod.item) > 0, ok = !on && !full && have;
          html += `<div class="recipe${ok || on ? '' : ' off'}" ${on ? `data-u="${k}"` : ok ? `data-o="${k}"` : ''}><img src="${this.icons[mod.item].url}" alt=""><div class="rname">${mod.name}<small>${mod.tip}</small></div><div class="ings"><span class="ing${on || have ? '' : ' miss'}">${on ? 'installé · retirer' : have ? 'installer' : 'module manquant'}</span></div></div>`;
        }
      }
      this.el.recipes.innerHTML = html;
      return true;
    }
    if (this.altar) {
      $('crafttitle').textContent = "Autel d'enchantement";
      const st = this.altarItem, level = this.hooks.level();
      this.el.stations.textContent = `Pose un outil ou une armure sur l'autel. Tu es niveau ${level}.`;
      this.el.tilebox.innerHTML = `<div class="tslots"><div class="tslot">${this.slotHTML(st, 'data-e')}<small>Objet</small></div></div>`;
      let html = '';
      if (st) {
        const opts = this.enchantOptions(st);
        html = opts.length ? '<h3>Enchantements possibles</h3>' : '<div class="muted">Plus rien à enchanter sur cet objet.</div>';
        for (const o of opts) html += `<div class="recipe${level >= o.cost ? '' : ' off'}" data-o="${o.k}"><div class="rname">${ENCHANTS[o.k].name} ${'I'.repeat(o.next)}<small>${ENCHANTS[o.k].tip}</small></div><div class="ings"><span class="ing${level >= o.cost ? '' : ' miss'}">${o.cost} niveaux</span></div></div>`;
      }
      this.el.recipes.innerHTML = html;
      return true;
    }
    if (this.journal) {
      const done = this.journal.filter((g) => g.done).length;
      $('crafttitle').textContent = 'Journal';
      this.el.stations.textContent = `${done} objectifs accomplis sur ${this.journal.length}. Chacun rapporte de l'expérience.`;
      this.el.tilebox.innerHTML = '';
      this.el.recipes.innerHTML = this.journal.map((g) => `<div class="recipe goal${g.done ? ' done' : ''}"><div class="rname">${g.done ? '✓ ' : ''}${g.title}<small>${g.hint}</small></div><div class="ings"><span class="ing">+${g.xp} XP</span></div></div>`).join('');
      return true;
    }
    if (this.trade) {
      $('crafttitle').textContent = this.trade.title;
      this.el.stations.textContent = this.trade.hint;
      this.el.tilebox.innerHTML = '';
      this.el.recipes.innerHTML = '<h3>Échanges</h3>' + this.trade.offers.map((o, i) => {
        const ok = this.inv.count(o.cost[0]) >= o.cost[1];
        return `<div class="recipe${ok ? '' : ' off'}" data-d="${i}"><img src="${this.icons[o.give[0]].url}" alt=""><div class="rname">${ITEMS[o.give[0]].name}${o.give[1] > 1 ? ' ×' + o.give[1] : ''}</div><div class="ings">contre ${icon(o.cost[0], o.cost[1])}</div></div>`;
      }).join('');
      return true;
    }
    return false;
  }

  bar(label, ratio, cls = '') {
    return `<div class="tbar"><span>${label}</span><div class="track ${cls}"><i style="width:${Math.max(0, Math.min(1, ratio)) * 100}%"></i></div></div>`;
  }

  renderTile() {
    const tile = this.tile;
    if (!tile || !this.open) return;
    const def = MACHINES[tile.id], st = tile.state;
    $('crafttitle').textContent = BLOCKS[tile.id].name;
    this.el.stations.textContent = def.hint ?? (tile.id === B.CHEST ? 'Maj + clic pour ranger ou reprendre rapidement.' : '');
    if (!st) { this.el.tilebox.innerHTML = '<div class="muted">Ouverture…</div>'; this.el.recipes.innerHTML = ''; return; }

    let html = '';
    if (def.pad) {
      // Ne pas redessiner pendant qu'on tape le nom.
      if (document.activeElement?.id === 'padname') return;
      const label = (p) => p.name || `Téléporteur ${p.x}, ${p.y}, ${p.z}`;
      html = `<input id="padname" type="text" maxlength="24" placeholder="Nom de ce téléporteur" value="${(st.name ?? '').replace(/"/g, '&quot;')}">`
        + `<div class="tinfo">${st.on ? 'Alimenté.' : '<span class="warn">Non alimenté : il lui faut 15 W.</span>'}</div>`;
      let list = '<h3>Destination</h3>';
      for (const p of st.pads ?? []) {
        const dist = Math.round(Math.hypot(p.x - tile.x, p.y - tile.y, p.z - tile.z));
        list += `<div class="recipe" data-pad="${p.k}"><div class="rname">${st.to === p.k ? '✓ ' : ''}${label(p).replace(/</g, '&lt;')}<small>à ${dist} m${p.on ? '' : ' · non alimenté'}</small></div><div class="ings"><span class="ing">${st.to === p.k ? 'choisi' : 'choisir'}</span></div></div>`;
      }
      if (!st.pads?.length) list += '<div class="muted">Aucun autre téléporteur dans ce monde : pose le second.</div>';
      this.el.tilebox.innerHTML = html;
      const scroll = this.el.recipes.scrollTop;
      this.el.recipes.innerHTML = list;
      this.el.recipes.scrollTop = scroll;
      return;
    }
    if (def.terminal) {
      const items = st.items ?? [];
      html = `<div class="term" data-g="put">${items.map(([id, n]) => `<div class="slot" data-g="${id}" title="${ITEMS[id].name}"><img src="${this.icons[id].url}" alt=""><span class="n">${n > 999 ? (n / 1000).toFixed(1) + 'k' : n}</span></div>`).join('') || `<div class="muted">${st.stores ? `${st.stores} rangement${st.stores > 1 ? 's' : ''} relié${st.stores > 1 ? 's' : ''}, encore vide${st.stores > 1 ? 's' : ''}. Maj + clic dans le sac pour y ranger un objet.` : 'Aucun coffre ni tiroir relié : colle un tuyau à objets au terminal et à tes rangements.'}</div>`}</div>`
        + `<div class="tinfo">${items.length} types d'objets · ${fmt(items.reduce((t, i) => t + i[1], 0))} objets. Clic : prendre une pile · Clic droit : un seul · Maj + clic dans le sac : ranger.</div>`;
    } else if (tile.id === B.CHEST) {
      for (let row = 0; row < 3; row++) {
        html += '<div class="grid">';
        for (let i = row * 9; i < row * 9 + 9; i++) html += this.slotHTML(st.slots[i], `data-t="${i}"`);
        html += '</div>';
      }
      html = `<div class="bag">${html}</div>`;
    } else {
      html += '<div class="tslots">';
      def.slots.forEach((kind, i) => {
        if (kind === 'out') html += '<div class="arrow">→</div>';
        html += `<div class="tslot">${this.slotHTML(st.slots[i], `data-t="${i}"`)}<small>${SLOT_LABEL[kind]}</small></div>`;
      });
      html += '</div>';
      if (def.recipes || def.distill) html += this.bar('Avancement', st.max ? st.prog / st.max : 0);
      if (def.beacon) html += this.bar(st.lit ? 'Allumé pour toujours' : `Allumage : ${Math.round(((st.prog ?? 0) / def.beacon) * 100)} %`, st.lit ? 1 : (st.prog ?? 0) / def.beacon, 'hot');
      if (def.slots.includes('fuel') || def.slots.includes('rod')) html += this.bar(def.slots.includes('rod') ? 'Barre en cours' : 'Flamme', st.burnMax ? st.burn / st.burnMax : 0, 'hot');
      if (def.store) html += this.bar(`Charge : ${Math.round(st.e)} / ${def.store} J`, st.e / def.store, 'elec');
      if (def.drawer) html += this.bar(`${fmt(st.slots[0]?.n ?? 0)} / ${fmt(def.drawer)} objets`, (st.slots[0]?.n ?? 0) / def.drawer);
      if (def.tank) html += this.bar(st.f?.amt > 0 ? `${FLUID_NAME[st.f.id]} : ${fmt(st.f.amt)} / ${fmt(def.tank)} L` : `Vide (${fmt(def.tank)} L)`, (st.f?.amt ?? 0) / def.tank, st.f?.id === B.LAVA || st.f?.id === F_FUEL ? 'hot' : 'elec');
      const s0 = st.slots[0], ch = def.slots[0] === 'charge' && s0 && ITEMS[s0.id].charge;
      if (ch) html += this.bar(`Charge de l'objet : ${Math.round(((s0.c ?? 0) / ch.max) * 100)} %`, (s0.c ?? 0) / ch.max, 'elec');
      const lines = [];
      if (GEN[tile.id]) lines.push(`Production : <b>${st.out ?? 0} W</b> (maximum ${GEN[tile.id]} W)`);
      if (tile.id === B.CORE) lines.push(st.valid ? 'Blindage complet (26 sur 26).' : `<span class="warn">Blindage incomplet : il manque ${st.miss ?? 26} bloc${(st.miss ?? 26) > 1 ? 's' : ''} sur 26. Le cœur ne démarre pas.</span>`);
      if (tile.id === B.CORE && !st.slots[0] && !(st.burn > 0)) lines.push("Pas de barre d'uranium : l'imprimante 3D en fait une avec 2 uranites et 1 plaque.");
      if (tile.id === B.CORE && st.burn > 0 && !st.valid) lines.push('<span class="warn">FUSION IMMINENTE : répare le blindage !</span>');
      if (def.pump) lines.push(st.src ? `Source : ${FLUID_NAME[st.src].toLowerCase()}, inépuisable.` : "<span class=\"warn\">Aucun liquide dessous : repose-la au-dessus d'eau ou de lave.</span>");
      if (def.fluidUse) lines.push(`Consomme ${def.fluidUse} L par opération.`);
      if (def.power) lines.push(`Consomme ${def.power} W en fonctionnement.`);
      if (def.power || def.gen || def.store) {
        lines.push(st.net ? `Réseau : ${st.net.s} W produits · ${st.net.d} W demandés${st.net.r < 100 ? ` · <span class="warn">machines à ${st.net.r} %</span>` : ''}`
          : '<span class="warn">Non relié à un réseau : pose un câble contre la machine.</span>');
      }
      html += `<div class="tinfo">${lines.join('<br>')}</div>`;
    }
    this.el.tilebox.innerHTML = html;

    let plans = '';
    if (def.recipes) {
      plans = '<h3>Plans (clic pour déposer les ingrédients)</h3>';
      def.recipes.forEach((r, idx) => {
        const ok = r.ins.every(([id, n]) => this.inv.count(id) >= n);
        const ings = r.ins.map(([id, n]) => `<span class="ing${this.inv.count(id) < n ? ' miss' : ''}" title="${ITEMS[id].name}"><img src="${this.icons[id].url}" alt="">${n}</span>`).join('');
        plans += `<div class="recipe${ok ? '' : ' off'}" data-p="${idx}"><img src="${this.icons[r.out[0]].url}" alt=""><div class="rname">${ITEMS[r.out[0]].name}${r.out[1] > 1 ? ' ×' + r.out[1] : ''}<small>${r.time} s</small></div><div class="ings">${ings}</div></div>`;
      });
    }
    const scroll = this.el.recipes.scrollTop;
    this.el.recipes.innerHTML = plans;
    this.el.recipes.scrollTop = scroll;
  }

  renderPalette() {
    $('crafttitle').textContent = 'Mode créatif';
    this.el.stations.textContent = 'Clic : une pile · Clic droit : un seul · Maj + clic : dans le sac · Clic hors du panneau : détruire.';
    const q = norm(this.query.trim()), words = q.split(/\s+/);
    if (this.cat !== 'all' && !FAMS.includes(this.cat)) this.cat = 'all';
    const chip = (id, label) => `<button class="chip${this.cat === id && !q ? ' on' : ''}" data-c="${id}">${label}</button>`;
    this.el.cats.innerHTML = chip('all', 'Tout') + FAMS.map((f) => chip(f, f)).join('');
    let html = '';
    for (const fam of FAMS) {
      const list = PALETTE.filter((p) => p.fam === fam && (q ? words.every((w) => p.text.includes(w)) : this.cat === 'all' || this.cat === fam));
      if (!list.length) continue;
      html += `<h3>${fam}<span>${list.length}</span></h3><div class="palette">` + list.map((p) => `<div class="slot" data-q="${p.id}" title="${ITEMS[p.id].name}"><img src="${this.icons[p.id].url}" alt=""></div>`).join('') + '</div>';
    }
    const scroll = this.el.recipes.scrollTop;
    this.el.recipes.innerHTML = html || '<div class="muted">Aucun objet ne correspond.</div>';
    this.el.recipes.scrollTop = scroll;
  }

  render() {
    const inv = this.inv;
    this.el.armor.innerHTML = inv.armor.map((s, i) => this.slotHTML(s, `data-a="${i}" data-label="${ARMOR_SLOTS[i]}"`)).join('')
      + `<div id="armorinfo">Protection<br><b>${Math.round(Math.min(0.8, inv.armorPoints() * 0.05) * 100)} %</b></div>`;
    let bag = '';
    for (let row = 1; row < 4; row++) {
      bag += '<div class="grid">';
      for (let i = row * 9; i < row * 9 + 9; i++) bag += this.slotHTML(inv.slots[i], `data-i="${i}"`);
      bag += '</div>';
    }
    bag += '<div class="sep"></div><div class="grid">';
    for (let i = 0; i < 9; i++) bag += this.slotHTML(inv.slots[i], `data-i="${i}"`, i + 1);
    this.el.bag.innerHTML = bag + '</div>';

    const h = this.held;
    this.el.cursor.innerHTML = h ? `<img src="${this.icons[h.id].url}" alt="">${h.n > 1 ? `<span class="n">${h.n}</span>` : ''}` : '';

    const crafting = !this.tile && !this.altar && !this.journal && !this.trade && !this.filter;
    this.el.craftbar.classList.toggle('hidden', !crafting);
    if (this.tile) { this.renderTile(); return; }
    if (this.renderSide()) return;
    this.el.tilebox.innerHTML = '';
    const palette = this.ctx === 'all' && this.hooks.creative?.();
    this.el.search.placeholder = palette ? 'Rechercher un objet…' : 'Rechercher une recette, un ingrédient ou une machine…';
    if (palette) { this.renderPalette(); return; }
    const near = this.near(), ctx = this.ctx;
    $('crafttitle').textContent = ctx === 'bench' ? 'Établi' : 'Fabrication';
    this.el.stations.textContent = near.has('bench') ? 'Établi à portée : toutes les recettes sont disponibles.' : 'Sans établi : seules les recettes de base sont possibles.';

    // Une ligne par recette, rangée par catégorie ; la recherche porte sur le nom et les ingrédients.
    const q = norm(this.query.trim()), words = q.split(/\s+/);
    const rows = RECIPES.map((r, idx) => {
      const stationOk = !r.station || near.has(r.station);
      return { r, idx, stationOk, ok: stationOk && inv.canCraft(r) };
    });
    const okCount = rows.filter((x) => x.ok).length;
    const chip = (id, label) => `<button class="chip${this.cat === id && !q ? ' on' : ''}" data-c="${id}">${label}</button>`;
    if (this.cat !== 'all' && this.cat !== 'ok' && this.cat !== 'guide' && !CATS.includes(this.cat)) this.cat = 'all';
    this.el.cats.innerHTML = chip('all', 'Tout') + chip('ok', `Faisables · ${okCount}`) + CATS.map((c) => chip(c, c)).join('') + chip('guide', 'Guide des machines');

    const shown = rows.filter((x, i) => (q ? words.every((w) => RECIPE_TEXT[x.idx].includes(w)) : this.cat === 'all' || (this.cat === 'ok' ? x.ok : x.r.cat === this.cat)));
    let html = '';
    for (const cat of CATS) {
      const group = shown.filter((x) => x.r.cat === cat).sort((a, b) => b.ok - a.ok);
      if (!group.length) continue;
      html += `<h3>${cat}<span>${group.filter((x) => x.ok).length} / ${group.length}</span></h3>`;
      for (const { r, idx, stationOk, ok } of group) {
        const ings = r.ins.map(([id, n]) => `<span class="ing${inv.count(id) < n ? ' miss' : ''}" title="${ITEMS[id].name} : ${inv.count(id)} / ${n}"><img src="${this.icons[id].url}" alt="">${n}</span>`).join('');
        const where = stationOk ? '' : `<small>Nécessite : ${STATIONS[r.station]}</small>`;
        html += `<div class="recipe${ok ? '' : ' off'}" data-r="${idx}" title="${ok ? 'Clic : fabriquer · Maj + clic : ×5' : ''}"><img src="${this.icons[r.out].url}" alt=""><div class="rname">${ITEMS[r.out].name}${r.n > 1 ? ' ×' + r.n : ''}${where}</div><div class="ings">${ings}</div></div>`;
      }
    }
    // Guide : ce que font les machines. Affiché dans son onglet, et dans les résultats d'une recherche.
    const guide = GUIDE.map((g, i) => ({ g, i })).filter(({ i }) => (q ? words.every((w) => GUIDE_TEXT[i].includes(w)) : this.cat === 'guide'));
    let last = -1;
    for (const { g } of guide) {
      if (g.where !== last) { last = g.where; html += `<h3>${g.where === B.FURNACE ? 'Four et four électrique' : BLOCKS[g.where].name}<span>dans la machine</span></h3>`; }
      const ings = g.ins.map(([id, n]) => `<span class="ing" title="${ITEMS[id].name}"><img src="${this.icons[id].url}" alt="">${n}</span>`).join('') || '<span class="ing">rien</span>';
      html += `<div class="recipe info"><img src="${this.icons[g.out[0]].url}" alt=""><div class="rname">${ITEMS[g.out[0]].name}${g.out[1] > 1 ? ' ×' + g.out[1] : ''}<small>${g.time} s${g.keep ? ' · le germe reste' : ''}</small></div><div class="ings">${ings}</div></div>`;
    }
    let notes = '';
    for (const n of NOTES) {
      if (q ? !words.every((w) => n.find.includes(w) || norm(n.title).includes(w)) : this.cat !== 'guide') continue;
      notes += `<h3>${n.title}<span>notice</span></h3><div class="note"><img src="${this.icons[n.icon].url}" alt=""><div>${n.steps.map((t) => `<p>${t}</p>`).join('')}</div></div>`;
    }
    html = q ? html + notes : notes + html; // dans l'onglet du guide, les notices d'abord
    if (!html) html = `<div class="muted">${q ? 'Aucune recette ne correspond à cette recherche.' : this.cat === 'ok' ? "Rien de faisable avec ce que tu as dans le sac pour l'instant." : 'Aucune recette ici.'}</div>`;
    const scroll = this.el.recipes.scrollTop;
    this.el.recipes.innerHTML = html;
    this.el.recipes.scrollTop = scroll;
  }
}
