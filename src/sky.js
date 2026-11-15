import * as THREE from 'three';
import { mulberry32, VIEW } from './world.js';

const DAY_LENGTH = 720; // secondes pour un cycle complet

const C = (h) => new THREE.Color(h);
const SKY_DAY = C(0x9ad8f5), SKY_NIGHT = C(0x0d1030), SKY_DUSK = C(0xf7a072);
const TINT_DAY = C(0xffffff), TINT_NIGHT = C(0x47508f), TINT_DUSK = C(0xffc9a3);
const EMBER_SKY = C(0x34110f), EMBER_TINT = C(0xe0a48c), EMBER_SEA = C(0xff5a1f);
const TOP_DAY = C(0x3d8fe0), TOP_NIGHT = C(0x04061a), TOP_EMBER = C(0x120406);
const SUN_HIGH = C(0xfff3dc), SUN_LOW = C(0xff9a5a), MOON = C(0x9db4ff);
const GROUND_DAY = C(0x8f8576), GROUND_EMBER = C(0x6a1c0c), HEMI_EMBER = C(0xff9468);
const SHADOW_SPAN = 72; // demi-largeur de la zone ombrée autour du joueur, en blocs
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

const PLANE = 4000, PARTICLES = 700, DROPS = 1500, RAIN_BOX = 44;
const STORM = C(0x6f7f92);
// Tirage stable par tranche de temps : tous les joueurs d'une partie ont la même météo.
function roll(n) { let h = Math.imul(n ^ 0x9e3779b9, 1274126177); h ^= h >>> 15; h = Math.imul(h, 2246822519); return ((h ^ (h >>> 13)) >>> 0) / 4294967296; }
const SPELL = 100; // durée d'une tranche de météo, en secondes

function cloudTexture() {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  const rnd = mulberry32(4242);
  for (let i = 0; i < 70; i++) {
    const x = rnd() * S, y = rnd() * S, r = 14 + rnd() * 38;
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
      const g = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
      g.addColorStop(0, 'rgba(255,255,255,0.55)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Sky {
  constructor(scene) {
    this.scene = scene;
    this.dim = 0;
    this.time = 0.34; // 0 = minuit, 0.5 = midi
    this.night = false;
    this.color = new THREE.Color();
    this.tint = new THREE.Color();
    scene.background = this.color;
    scene.fog = new THREE.Fog(this.color, VIEW * 16 * 0.45, VIEW * 16 * 0.98);

    // Soleil (ou lune) : lumière directionnelle avec ombres portées. Ciel : lumière d'ambiance.
    this.sunLight = new THREE.DirectionalLight(0xffffff, 1);
    this.sunLight.castShadow = true;
    const sh = this.sunLight.shadow;
    sh.mapSize.set(2048, 2048);
    Object.assign(sh.camera, { left: -SHADOW_SPAN, right: SHADOW_SPAN, top: SHADOW_SPAN, bottom: -SHADOW_SPAN, near: 1, far: 460 });
    sh.camera.updateProjectionMatrix();
    sh.bias = -0.0006;
    sh.normalBias = 0.07;
    this.hemi = new THREE.HemisphereLight(0xffffff, GROUND_DAY, 1);
    scene.add(this.sunLight, this.sunLight.target, this.hemi);
    this.sunDir = new THREE.Vector3(0, 1, 0);
    this.clock = 0;   // secondes écoulées depuis le début du monde (météo)
    this.rain = 0;    // 0 : beau temps, 1 : averse
    this.biome = 0;   // biome sous le joueur : neige sur le glacier, rien sur les dunes
    this.viewDist = VIEW * 16;
    // Pluie et neige : des points qui tombent dans un cube autour du joueur.
    this.dropPos = new Float32Array(DROPS * 3);
    for (let i = 0; i < DROPS * 3; i++) this.dropPos[i] = Math.random() * RAIN_BOX;
    const dg = new THREE.BufferGeometry();
    this.dropAttr = new THREE.BufferAttribute(this.dropPos, 3);
    dg.setAttribute('position', this.dropAttr);
    this.dropMat = new THREE.PointsMaterial({ color: 0xbcd6ff, size: 0.11, transparent: true, opacity: 0, depthWrite: false });
    this.drops = new THREE.Points(dg, this.dropMat);
    this.drops.frustumCulled = false;
    scene.add(this.drops);
    this.top = new THREE.Color();

    // Voûte céleste : dégradé du zénith à l'horizon, halo autour de l'astre.
    this.domeMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { uTop: { value: this.top }, uHorizon: { value: this.color }, uSun: { value: new THREE.Color() }, uSunDir: { value: this.sunDir }, uGlow: { value: 1 } },
      vertexShader: 'varying vec3 vDir; void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `varying vec3 vDir; uniform vec3 uTop, uHorizon, uSun, uSunDir; uniform float uGlow;
        void main() {
          vec3 d = normalize(vDir);
          float h = clamp(d.y * 1.25 + 0.1, 0.0, 1.0);
          vec3 c = mix(uHorizon, uTop, pow(h, 0.6));
          float s = max(dot(d, uSunDir), 0.0);
          c += uSun * (pow(s, 10.0) * 0.22 + pow(s, 90.0) * 0.5) * uGlow;
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    this.skyDome = new THREE.Mesh(new THREE.SphereGeometry(1200, 24, 14), this.domeMat);
    this.skyDome.renderOrder = -10;
    this.skyDome.frustumCulled = false;
    scene.add(this.skyDome);

    // Mer de nuages (ou de braise), centrée sur le joueur.
    const plane = new THREE.PlaneGeometry(PLANE, PLANE);
    plane.rotateX(-Math.PI / 2);
    this.floorMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.floor = new THREE.Mesh(plane, this.floorMat);
    this.layers = [[5, 18, 1], [12, 9, 0.8]].map(([y, repeat, opacity]) => {
      const tex = cloudTexture();
      tex.repeat.set(repeat, repeat);
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity });
      const mesh = new THREE.Mesh(plane, mat);
      mesh.position.y = y;
      scene.add(mesh);
      return { mesh, mat, tex, repeat, drift: 0 };
    });
    this.floor.position.y = -4;
    scene.add(this.floor);

    // Soleil et lune carrés, étoiles
    this.dome = new THREE.Group();
    const quad = new THREE.PlaneGeometry(1, 1);
    this.sun = new THREE.Mesh(quad, new THREE.MeshBasicMaterial({ color: 0xfff1b8, fog: false, depthWrite: false }));
    this.sun.material.color.multiplyScalar(2.6); // plus clair que le blanc : il rayonne
    this.sun.scale.setScalar(60);
    this.moon = new THREE.Mesh(quad, new THREE.MeshBasicMaterial({ color: 0xdfe6ff, fog: false, depthWrite: false }));
    this.moon.scale.setScalar(36);
    const rnd = mulberry32(99);
    const stars = new Float32Array(900 * 3);
    for (let i = 0; i < 900; i++) {
      const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      stars.set([Math.cos(a) * s * 800, u * 800, Math.sin(a) * s * 800], i * 3);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(stars, 3));
    this.starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, fog: false, transparent: true, depthWrite: false });
    this.stars = new THREE.Points(sg, this.starMat);
    this.dome.add(this.stars, this.sun, this.moon);
    scene.add(this.dome);

    // Particules des courants ascendants (naturels et ventilateurs)
    this.columns = [];
    this.parts = [];
    for (let i = 0; i < PARTICLES; i++) this.parts.push({ a: rnd() * 6.283, r: Math.sqrt(rnd()), y: rnd(), s: 0.1 + rnd() * 0.12 });
    this.partPos = new Float32Array(PARTICLES * 3);
    const pg = new THREE.BufferGeometry();
    this.partAttr = new THREE.BufferAttribute(this.partPos, 3);
    pg.setAttribute('position', this.partAttr);
    this.partMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.42, transparent: true, opacity: 0.75, depthWrite: false });
    this.points = new THREE.Points(pg, this.partMat);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  setDim(dim) { this.dim = dim; }
  setView(chunks) { this.viewDist = chunks * 16; }
  // Averse prévue à cet instant ? Monte et retombe en douceur aux bords de la tranche.
  wetAt(clock) {
    const n = Math.floor(clock / SPELL), t = clock - n * SPELL;
    return roll(n) < 0.24 ? Math.min(1, t / 8, (SPELL - t) / 8) : 0;
  }
  setColumns(list) { this.columns = list; }

  update(dt, camera) {
    this.time = (this.time + dt / DAY_LENGTH) % 1;
    const ang = (this.time - 0.25) * Math.PI * 2;
    const sunH = Math.sin(ang);
    const day = smooth(-0.18, 0.22, sunH);
    const dusk = Math.max(0, 1 - Math.abs(sunH) / 0.32);
    this.night = sunH < -0.08;

    const ember = this.dim === 1;
    if (ember) {
      const pulse = 0.92 + 0.08 * Math.sin(performance.now() / 900);
      this.color.copy(EMBER_SKY);
      this.tint.copy(EMBER_TINT).multiplyScalar(pulse);
      this.floorMat.color.copy(EMBER_SEA);
      for (const l of this.layers) l.mat.color.setHex(0xff8a4a);
    } else {
      this.color.copy(SKY_NIGHT).lerp(SKY_DAY, day).lerp(SKY_DUSK, dusk * 0.6);
      this.tint.copy(TINT_NIGHT).lerp(TINT_DAY, day).lerp(TINT_DUSK, dusk * 0.45);
      this.floorMat.color.copy(this.tint).lerp(this.color, 0.25);
      for (const l of this.layers) l.mat.color.copy(this.tint);
    }
    // Météo
    this.clock += dt;
    const wet = ember || this.biome === 6 ? 0 : this.wetAt(this.clock);
    this.rain += (wet - this.rain) * Math.min(1, dt * 1.5);
    const snow = this.biome === 7;
    if (this.rain > 0.01) this.color.lerp(STORM, this.rain * 0.6 * day);
    this.scene.fog.near = this.viewDist * 0.45 * (1 - 0.45 * this.rain);
    this.scene.fog.far = this.viewDist * 0.98 * (1 - 0.2 * this.rain);
    this.dropMat.opacity = this.rain * (snow ? 0.95 : 0.6);
    this.dropMat.size = snow ? 0.16 : 0.1;
    this.dropMat.color.setHex(snow ? 0xffffff : 0xa9c8f5);
    this.drops.visible = this.rain > 0.01;
    if (this.drops.visible) {
      const fall = (snow ? 3.2 : 24) * dt, P = this.dropPos, cx = camera.position.x, cy = camera.position.y, cz = camera.position.z, half = RAIN_BOX / 2;
      for (let i = 0; i < DROPS * 3; i += 3) {
        P[i + 1] -= fall * (0.8 + (i % 7) * 0.06);
        if (snow) P[i] += Math.sin(this.clock * 1.3 + i) * dt * 0.8;
        // Chaque goutte reste dans le cube centré sur le joueur.
        P[i] = cx - half + ((((P[i] - cx + half) % RAIN_BOX) + RAIN_BOX) % RAIN_BOX);
        P[i + 1] = cy - half + ((((P[i + 1] - cy + half) % RAIN_BOX) + RAIN_BOX) % RAIN_BOX);
        P[i + 2] = cz - half + ((((P[i + 2] - cz + half) % RAIN_BOX) + RAIN_BOX) % RAIN_BOX);
      }
      this.dropAttr.needsUpdate = true;
    }
    this.scene.fog.color.copy(this.color);

    // Éclairage : le soleil le jour, la lune la nuit ; à l'horizon l'un s'éteint avant que l'autre s'allume.
    const up = sunH > 0, strength = smooth(0.03, 0.26, Math.abs(sunH));
    this.sunDir.set(Math.cos(ang), sunH, 0.28).normalize();
    if (!up) this.sunDir.negate();
    if (ember) {
      this.top.copy(TOP_EMBER);
      this.sunLight.intensity = 0;
      this.hemi.color.copy(HEMI_EMBER); this.hemi.groundColor.copy(GROUND_EMBER);
      this.hemi.intensity = Math.PI * 0.3;
      this.domeMat.uniforms.uGlow.value = 0;
    } else {
      this.top.copy(TOP_NIGHT).lerp(TOP_DAY, day).lerp(STORM, this.rain * 0.5 * day);
      this.sunLight.color.copy(up ? SUN_LOW : MOON);
      if (up) this.sunLight.color.lerp(SUN_HIGH, smooth(0.05, 0.5, sunH));
      this.sunLight.intensity = Math.PI * (up ? 0.8 : 0.16) * strength * (1 - 0.65 * this.rain);
      this.hemi.color.copy(this.tint); this.hemi.groundColor.copy(GROUND_DAY).multiply(this.tint);
      this.hemi.intensity = Math.PI * (0.13 + 0.22 * day);
      this.domeMat.uniforms.uSun.value.copy(this.sunLight.color);
      this.domeMat.uniforms.uGlow.value = strength * (up ? 1 : 0.35);
    }
    // La zone d'ombre suit le joueur, par pas entiers pour que les ombres ne scintillent pas.
    const tx = Math.round(camera.position.x), ty = Math.round(camera.position.y), tz = Math.round(camera.position.z);
    this.sunLight.target.position.set(tx, ty, tz);
    this.sunLight.position.set(tx + this.sunDir.x * 220, ty + this.sunDir.y * 220, tz + this.sunDir.z * 220);
    this.skyDome.position.copy(camera.position);
    this.dome.visible = !ember;
    this.starMat.opacity = 1 - day;
    this.partMat.opacity = ember ? 0.8 : 0.45 + 0.35 * day;
    this.partMat.color.setHex(ember ? 0xffb066 : 0xffffff);

    // Les plans suivent le joueur ; la texture reste ancrée au monde.
    const px = camera.position.x, pz = camera.position.z;
    this.floor.position.x = px; this.floor.position.z = pz;
    this.layers.forEach((l, i) => {
      l.drift += dt * (i ? 0.0028 : 0.0016);
      l.mesh.position.x = px; l.mesh.position.z = pz;
      l.tex.offset.set((px / PLANE) * l.repeat + l.drift, (-pz / PLANE) * l.repeat);
    });

    this.dome.position.copy(camera.position);
    const D = 700;
    this.sun.position.set(Math.cos(ang) * D, sunH * D, 120);
    this.moon.position.set(-Math.cos(ang) * D, -sunH * D, -120);
    this.sun.lookAt(camera.position);
    this.moon.lookAt(camera.position);
    this.stars.rotation.z = ang;

    const cols = this.columns, n = cols.length;
    this.points.visible = n > 0;
    if (n) {
      for (let i = 0; i < PARTICLES; i++) {
        const p = this.parts[i], u = cols[i % n];
        p.y = (p.y + p.s * dt) % 1;
        p.a += dt * 1.4;
        const lo = Math.max(6, u.bottom);
        this.partPos[i * 3] = u.x + Math.cos(p.a) * p.r * u.r;
        this.partPos[i * 3 + 1] = lo + p.y * (u.top - lo);
        this.partPos[i * 3 + 2] = u.z + Math.sin(p.a) * p.r * u.r;
      }
      this.partAttr.needsUpdate = true;
    }
  }
}
