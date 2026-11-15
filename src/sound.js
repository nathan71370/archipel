// Tous les sons sont fabriqués à la volée (oscillateurs et bruit filtré) : aucun fichier audio.
const VOLUME_KEY = 'archipel-volume';

// Matière sonore d'un bloc : pierre, bois, terre, métal, doux (feuilles, laine), verre.
const MAT = {
  stone: { f: 950, q: 1.2, tone: 0 },
  wood: { f: 420, q: 2.5, tone: 150 },
  dirt: { f: 260, q: 0.8, tone: 0 },
  metal: { f: 2300, q: 5, tone: 620 },
  soft: { f: 3200, q: 0.7, tone: 0 },
  glass: { f: 4200, q: 6, tone: 1500 },
};

export class Sound {
  constructor() {
    this.ctx = null;
    this.volume = 0.7;
    try { const v = parseFloat(localStorage.getItem(VOLUME_KEY)); if (v >= 0 && v <= 1) this.volume = v; } catch { /* réglage par défaut */ }
    this.loops = {};
  }

  // Le navigateur n'autorise le son qu'après un geste du joueur : créé au premier besoin.
  ready() {
    if (this.ctx) return this.ctx.state === 'running' || (this.ctx.resume?.(), this.ctx.state === 'running');
    try {
      const ctx = this.ctx = new AudioContext();
      this.master = ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(ctx.destination);
      const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
      return ctx.state === 'running';
    } catch { this.ctx = null; return false; }
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.master) this.master.gain.value = this.volume;
    try { localStorage.setItem(VOLUME_KEY, String(this.volume)); } catch { /* pas grave */ }
  }

  // Note brève qui descend (l'ancien « blip »).
  tone(freq, dur = 0.07, type = 'square', vol = 0.05, to = 0.6) {
    if (!this.ready()) return;
    const ctx = this.ctx, t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * to), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur);
  }

  // Souffle de bruit filtré : chocs, pas, éclaboussures, explosions.
  noise(dur, vol, freq, q = 1, type = 'bandpass', to = 1) {
    if (!this.ready()) return;
    const ctx = this.ctx, t = ctx.currentTime, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = this.noiseBuf;
    src.loop = true;
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(freq, t);
    if (to !== 1) f.frequency.exponentialRampToValueAtTime(Math.max(30, freq * to), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur);
  }

  // ---------- Sons du jeu ----------
  dig(mat) { const m = MAT[mat] ?? MAT.stone; this.noise(0.06, 0.11, m.f * (0.9 + Math.random() * 0.2), m.q); }
  crack(mat) {
    const m = MAT[mat] ?? MAT.stone;
    this.noise(0.16, 0.2, m.f, m.q, 'bandpass', 0.5);
    if (m.tone) this.tone(m.tone * (0.9 + Math.random() * 0.2), 0.12, 'triangle', 0.05);
  }
  place(mat) { const m = MAT[mat] ?? MAT.stone; this.noise(0.07, 0.14, m.f * 0.6, m.q, 'lowpass'); this.tone(m.tone || 170, 0.06, 'sine', 0.05); }
  step(mat, soft) { const m = MAT[mat] ?? MAT.stone; this.noise(0.05, soft ? 0.02 : 0.055, m.f * (0.5 + Math.random() * 0.15), 0.9, 'lowpass'); }
  land(force) { this.noise(0.14, Math.min(0.3, 0.05 + force * 0.012), 190, 0.7, 'lowpass', 0.5); }
  splash() { this.noise(0.35, 0.16, 1400, 0.6, 'bandpass', 0.35); }
  open(wood) { this.noise(0.05, 0.1, wood ? 380 : 1500, 2, 'bandpass'); setTimeout(() => this.noise(0.07, 0.08, wood ? 300 : 1100, 2, 'bandpass'), 70); }
  boom(size) { this.noise(0.9 + size * 0.1, 0.5, 900, 0.4, 'lowpass', 0.08); this.tone(70, 0.5, 'sawtooth', 0.14); this.tone(45, 0.7, 'square', 0.08); }
  swing() { this.noise(0.09, 0.03, 1800, 0.8, 'bandpass', 2.2); }

  // ---------- Fonds sonores continus ----------
  // Chaque fond tourne en boucle ; on ne règle que son niveau (0 = silence).
  makeLoop(name) {
    const ctx = this.ctx, g = ctx.createGain();
    g.gain.value = 0;
    g.connect(this.master);
    const noise = (type, freq, q) => {
      const src = ctx.createBufferSource(), f = ctx.createBiquadFilter();
      src.buffer = this.noiseBuf; src.loop = true;
      f.type = type; f.frequency.value = freq; f.Q.value = q;
      src.connect(f);
      src.start();
      return f;
    };
    const lfo = (rate, depth, param) => { const o = ctx.createOscillator(), a = ctx.createGain(); o.frequency.value = rate; a.gain.value = depth; o.connect(a).connect(param); o.start(); };
    const loop = { g, max: 0.1 };
    if (name === 'wind') {
      const f = noise('bandpass', 420, 0.6);
      f.connect(g); lfo(0.13, 160, f.frequency);
      loop.max = 0.22; loop.filter = f;
    } else if (name === 'rain') {
      // Pluie : un fond grave et discret, pas un sifflement.
      const f = noise('bandpass', 1100, 0.35), lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 2600;
      f.connect(lp).connect(g);
      loop.max = 0.022;
    } else if (name === 'fire') {
      const f = noise('bandpass', 620, 0.5), a = ctx.createGain();
      a.gain.value = 0.6;
      f.connect(a).connect(g); lfo(11, 0.35, a.gain); lfo(3.1, 0.25, a.gain);
      loop.max = 0.16;
    } else if (name === 'hum') {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 420;
      for (const [fr, type, v] of [[58, 'sawtooth', 0.5], [116.6, 'square', 0.16], [233, 'sine', 0.12]]) {
        const o = ctx.createOscillator(), a = ctx.createGain();
        o.type = type; o.frequency.value = fr; a.gain.value = v;
        o.connect(a).connect(f); o.start();
      }
      f.connect(g); lfo(0.7, 0.012, g.gain);
      loop.max = 0.1;
    } else if (name === 'rotor') {
      const f = noise('bandpass', 260, 1.2), a = ctx.createGain();
      a.gain.value = 0.55;
      f.connect(a).connect(g); lfo(5.2, 0.4, a.gain);
      loop.max = 0.2;
    }
    return loop;
  }

  // level : 0 à 1. pitch (facultatif) : déplace le filtre du vent avec la vitesse.
  loop(name, level, pitch) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    if (!this.loops[name]) { if (level <= 0.001) return; this.loops[name] = this.makeLoop(name); }
    const l = this.loops[name], t = this.ctx.currentTime;
    l.g.gain.setTargetAtTime(Math.max(0, Math.min(1, level)) * l.max, t, 0.25);
    if (pitch && l.filter) l.filter.frequency.setTargetAtTime(pitch, t, 0.3);
  }
  hush() { for (const name in this.loops) this.loop(name, 0); }
}

// Matière sonore d'un bloc d'après sa définition.
export function soundMat(def, id, electric) {
  if (!def) return 'stone';
  if (def.clear || id === 83) return 'glass';
  if (electric) return 'metal';
  if (def.tool === 'pick') return 'stone';
  if (def.tool === 'axe') return 'wood';
  if (def.tool === 'shovel') return 'dirt';
  return 'soft';
}
