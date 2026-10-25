import * as THREE from 'three';
import gsap from 'gsap';
import { vinylVert, vinylFrag, rimVert, rimFrag } from '../shaders/vinyl.js';
import { bgFrag, compFrag, dustVert, dustFrag } from '../shaders/background.js';
import { fullscreenVert } from '../shaders/common.js';
import { recordLabel, miniLabel, houseLabel, miniColor } from '../labels.js';
import { hexToVec } from '../color.js';

const TAU = Math.PI * 2;
const DISC = 1.45; // hero record radius in world units
const MINI = 0.34;
const THICK = 0.012;
const HOLE = 0.026;
const LABEL_R = 0.34;

// Quality tiers. 2: desktop GPUs. 1: phones and tablets (no MSAA, lower pixel ratio,
// lighter shaders). 0: weak or throttled devices (iOS Low Power Mode, old Android).
const TIERS = [
  { dpr: 1, compactDpr: 1, samples: 0, dust: 70 },
  { dpr: 1.4, compactDpr: 1.5, samples: 0, dust: 140 },
  { dpr: 1.75, compactDpr: 1.6, samples: 4, dust: 240 },
];

const smooth = (t) => t * t * (3 - 2 * t);
const clamp01 = (t) => Math.min(1, Math.max(0, t));
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const damp = (dt, rate) => 1 - Math.exp(-dt * rate);
export const wrap = (v, n) => ((((v % n) + n + n / 2) % n) + n) % n - n / 2;
export const mod = (v, n) => ((v % n) + n) % n;

export class Stage {
  constructor(canvas, content, { reduced = false, tier = 2 } = {}) {
    this.canvas = canvas;
    this.content = content;
    this.records = content.records;
    this.n = this.records.length;
    this.reduced = reduced;
    this.tier = Math.max(0, Math.min(2, tier));
    this.defines = { QUALITY: this.tier };

    const r = (this.renderer = new THREE.WebGLRenderer({
      canvas, antialias: false, alpha: true, premultipliedAlpha: true, powerPreference: 'high-performance',
    }));
    r.setClearColor(0x000000, 0);
    r.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.maxAniso = r.capabilities.getMaxAnisotropy();

    this.scene = new THREE.Scene();
    this.baseFov = 30;
    this.camera = new THREE.PerspectiveCamera(this.baseFov, 1, 0.004, 120);

    this.pos = 0;
    this.speed = 0;
    this.time = 0;
    this.mouse = new THREE.Vector2();
    this.mouseS = new THREE.Vector2();
    this.hover = null;
    this.dv = { approach: 0, cam: 0, hole: 0, spin: 0 };
    this.diveTarget = null;
    this.fly = { index: -1, t: 0, dir: 1 };
    this.minis = { parent: -1, reveal: 0, settle: 0, cam: 0, forced: false };
    this.miniScreen = [];
    this.paused = false;
    this.look = new THREE.Vector3();
    this.v = new THREE.Vector3();

    this.shared = {
      uKey: { value: new THREE.Vector3(-4, 3, 6) },
      uRim: { value: new THREE.Vector3(5, -1.5, -2) },
      uRimColor: { value: new THREE.Color(0.5, 0.3, 0.2) },
      uKeyColor: { value: new THREE.Color(1.0, 0.95, 0.88) },
    };
    this.discGeo = new THREE.CircleGeometry(1, 192);
    this.rimGeo = new THREE.CylinderGeometry(1, 1, THICK, 192, 1, true);
    this.rimGeo.rotateX(Math.PI / 2);

    this.buildComposite();
    this.buildBackground();
    this.buildRecords();
    this.buildArcs();
    this.buildMinis();
    this.buildDust();
    this.raycaster = new THREE.Raycaster();
    this.resize();
  }

  texture(canvas) {
    const t = new THREE.CanvasTexture(canvas);
    t.anisotropy = Math.min(8, this.maxAniso);
    t.colorSpace = THREE.NoColorSpace;
    t.needsUpdate = true;
    return t;
  }

  makeDisc({ label, labelR, seed, kind, index = -1, parent = -1 }) {
    const mat = new THREE.ShaderMaterial({
      vertexShader: vinylVert,
      fragmentShader: vinylFrag,
      defines: this.defines,
      uniforms: {
        uLabel: { value: label },
        uLabelR: { value: labelR },
        uHoleR: { value: HOLE },
        uDim: { value: 0 },
        uFocus: { value: 0 },
        uSeed: { value: seed },
        uOpacity: { value: 1 },
        uGrooves: { value: 1 },
        ...this.shared,
      },
      transparent: true,
      premultipliedAlpha: true,
    });
    const rimMat = new THREE.ShaderMaterial({
      vertexShader: rimVert,
      fragmentShader: rimFrag,
      uniforms: { uDim: { value: 0 }, uOpacity: { value: 1 }, uKey: this.shared.uKey, uRimColor: this.shared.uRimColor },
      transparent: true,
      premultipliedAlpha: true,
    });
    const outer = new THREE.Group();
    const inner = new THREE.Group();
    const front = new THREE.Mesh(this.discGeo, mat);
    const back = new THREE.Mesh(this.discGeo, mat);
    const rim = new THREE.Mesh(this.rimGeo, rimMat);
    front.position.z = THICK / 2;
    back.position.z = -THICK / 2;
    back.rotation.y = Math.PI;
    front.userData = back.userData = { kind, index, parent };
    inner.add(front, back, rim);
    outer.add(inner);
    return { outer, inner, front, back, mat, rimMat, hover: 0, spin: 0 };
  }

  buildBackground() {
    this.bgMat = new THREE.ShaderMaterial({
      defines: this.defines,
      vertexShader: fullscreenVert,
      fragmentShader: bgFrag,
      uniforms: {
        uFrom: { value: new THREE.Color() },
        uTo: { value: new THREE.Color() },
        uProg: { value: 1 },
        uOrigin: { value: new THREE.Vector2(0.5, 0.56) },
        uAspect: { value: 1 },
        uTime: { value: 0 },
        uGlow: { value: 1 },
      },
      depthTest: false,
      depthWrite: false,
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.bgMat);
    m.frustumCulled = false;
    m.renderOrder = -100;
    this.scene.add(m);
  }

  buildRecords() {
    // one disc per record; visFor() keeps the door open for repeated copies later
    this.nVis = this.n;
    const textures = this.records.map((rec, i) => this.texture(recordLabel(rec, i, this.n, this.content.site.name)));
    this.recs = Array.from({ length: this.nVis }, (_, k) => {
      const i = k % this.n;
      const d = this.makeDisc({ label: textures[i], labelR: LABEL_R, seed: k * 1.731 + 0.37, kind: 'record', index: i });
      d.front.userData = d.back.userData = { kind: 'record', index: i, vis: k };
      this.scene.add(d.outer);
      return d;
    });
  }

  buildArcs() {
    const tex = this.texture(houseLabel());
    this.arcs = [0, 1].map((k) => {
      const d = this.makeDisc({ label: tex, labelR: 0.3, seed: 11 + k * 5, kind: 'arc' });
      d.front.raycast = d.back.raycast = () => {};
      this.scene.add(d.outer);
      return d;
    });
  }

  buildMinis() {
    this.miniSets = new Map();
    this.records.forEach((rec, pi) => {
      if (!rec.children?.length) return;
      const set = rec.children.map((ch, ci) => {
        const color = ch.accent || miniColor(rec.accent, ci, rec.children.length);
        ch._color = color;
        const tex = this.texture(miniLabel(rec, ch, ci, color));
        const d = this.makeDisc({ label: tex, labelR: 0.56, seed: 20 + ci * 2.1, kind: 'mini', index: ci, parent: pi });
        d.outer.visible = false;
        this.scene.add(d.outer);
        return d;
      });
      // a pair of minis can be bigger than a full fan of them
      set.radius = set.length <= 4 ? 0.5 : MINI;
      this.miniSets.set(pi, set);
    });
  }

  buildDust() {
    const N = TIERS[this.tier].dust;
    const pos = new Float32Array(N * 3);
    const seed = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() * 2 - 1) * 9;
      pos[i * 3 + 1] = (Math.random() * 2 - 1) * 5;
      pos[i * 3 + 2] = -9 + Math.random() * 12;
      seed[i] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    this.dustMat = new THREE.ShaderMaterial({
      vertexShader: dustVert,
      fragmentShader: dustFrag,
      uniforms: { uTime: { value: 0 }, uScale: { value: 10 }, uColor: { value: new THREE.Color(1, 0.9, 0.8) }, uOpacity: { value: 1 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      premultipliedAlpha: true,
    });
    const pts = new THREE.Points(geo, this.dustMat);
    pts.frustumCulled = false;
    this.scene.add(pts);
  }

  buildComposite() {
    this.rt = new THREE.WebGLRenderTarget(2, 2, { samples: TIERS[this.tier].samples });
    this.compMat = new THREE.ShaderMaterial({
      defines: this.defines,
      vertexShader: fullscreenVert,
      fragmentShader: compFrag,
      uniforms: {
        tScene: { value: this.rt.texture },
        uHole: { value: 0 },
        uAspect: { value: 1 },
        uTime: { value: 0 },
        uAccent: { value: new THREE.Color() },
      },
      depthTest: false,
      depthWrite: false,
      blending: THREE.NoBlending,
    });
    this.compScene = new THREE.Scene();
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.compMat);
    m.frustumCulled = false;
    this.compScene.add(m);
    this.compCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  // language changed: repaint every label texture
  relabel() {
    const site = this.content.site.name;
    const old = new Set();
    const textures = this.records.map((rec, i) => this.texture(recordLabel(rec, i, this.n, site)));
    this.recs.forEach((d, k) => {
      old.add(d.mat.uniforms.uLabel.value);
      d.mat.uniforms.uLabel.value = textures[k % this.n];
    });
    for (const [pi, set] of this.miniSets) {
      const rec = this.records[pi];
      set.forEach((d, ci) => {
        old.add(d.mat.uniforms.uLabel.value);
        d.mat.uniforms.uLabel.value = this.texture(miniLabel(rec, rec.children[ci], ci, rec.children[ci]._color));
      });
    }
    old.forEach((tex) => tex.dispose());
  }

  // step down one tier: lighter shaders, fewer pixels, no MSAA (shaders recompile once)
  setTier(tier) {
    tier = Math.max(0, Math.min(2, tier));
    if (tier === this.tier) return;
    this.tier = tier;
    this.defines.QUALITY = tier;
    this.scene.traverse((o) => o.material && (o.material.needsUpdate = true));
    this.compMat.needsUpdate = true;
    const samples = TIERS[tier].samples;
    if (samples !== this.rt.samples) {
      this.rt.dispose();
      this.rt = new THREE.WebGLRenderTarget(2, 2, { samples });
      this.compMat.uniforms.tScene.value = this.rt.texture;
    }
    this.sized = '';
    this.resize();
  }

  resume() {
    this.paused = false;
    if (this.needsResize) this.resize();
  }

  // nothing on screen is moving: the loop may skip frames on battery-powered devices
  get idle() {
    const bg = this.bgMat.uniforms.uProg.value;
    const M = this.minis;
    return !this.diveTarget && this.fly.index < 0 && bg >= 1 && (M.reveal === 0 || M.reveal === 1) && this.speed < 0.002;
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    // while a blog page covers the canvas (and mobile toolbars come and go), wait
    if (this.paused) {
      this.needsResize = true;
      return;
    }
    this.needsResize = false;
    const aspect = w / h;
    this.w = w;
    this.h = h;
    this.aspect = aspect;
    this.compact = w < 760 || aspect < 0.85;
    const T = TIERS[this.tier];
    this.dpr = Math.min(window.devicePixelRatio || 1, this.compact ? T.compactDpr : T.dpr);
    const key = `${w}x${h}@${this.dpr}`;
    if (key !== this.sized) {
      this.sized = key;
      this.renderer.setPixelRatio(this.dpr);
      this.renderer.setSize(w, h, false);
      this.rt.setSize(Math.round(w * this.dpr), Math.round(h * this.dpr));
    }

    const D = DISC * 2;
    const H = this.compact ? Math.max(D / 0.42, D / (0.78 * aspect)) : Math.max(D / 0.5, D / (0.34 * aspect));
    this.visH = H;
    this.visW = H * aspect;
    this.tanHalf = Math.tan(THREE.MathUtils.degToRad(this.baseFov / 2));
    this.camDist = H / 2 / this.tanHalf;
    this.lookY = this.compact ? -0.1 * H : -0.065 * H;
    this.lay = this.compact
      ? { x1: 1.95, xs: 0.8, z1: 1.3, zs: 0.9, yaw: 1.0 }
      : { x1: 2.35, xs: 1.15, z1: 1.45, zs: 1.0, yaw: 0.95 };
    // a small collection: neighbours turn further toward the viewer, and a record only
    // disappears while it passes behind to the other side
    const few = this.nVis <= 4;
    if (few) {
      this.lay.yaw = 0.62;
      this.lay.x1 *= this.compact ? 1 : 1.12;
    }
    this.fadeFrom = few ? this.nVis / 2 - 0.48 : this.nVis / 2 - 1;
    this.fadeLen = few ? 0.4 : 0.7;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    this.bgMat.uniforms.uAspect.value = aspect;
    this.compMat.uniforms.uAspect.value = aspect;
    this.dustMat.uniforms.uScale.value = h * this.dpr * 0.02;
  }

  setAccent(hex, immediate = false) {
    const to = new THREE.Color().setRGB(...hexToVec(hex));
    const u = this.bgMat.uniforms;
    gsap.killTweensOf(u.uProg);
    gsap.killTweensOf(u.uFrom.value);
    if (immediate) {
      u.uFrom.value.copy(to);
      u.uTo.value.copy(to);
      u.uProg.value = 1;
      this.shared.uRimColor.value.copy(to);
    } else if (this.reduced) {
      u.uProg.value = 1;
      u.uTo.value.copy(to);
      gsap.to(u.uFrom.value, { r: to.r, g: to.g, b: to.b, duration: 0.5 });
      gsap.to(this.shared.uRimColor.value, { r: to.r, g: to.g, b: to.b, duration: 0.5, overwrite: true });
    } else {
      const shown = Math.min(1, u.uProg.value * 1.8);
      u.uFrom.value.lerp(u.uTo.value, shown);
      u.uTo.value.copy(to);
      u.uProg.value = 0;
      gsap.to(u.uProg, { value: 1, duration: 1.6, ease: 'power1.out' });
      gsap.to(this.shared.uRimColor.value, { r: to.r, g: to.g, b: to.b, duration: 0.9, overwrite: true });
    }
    this.compMat.uniforms.uAccent.value.copy(to);
    this.dustMat.uniforms.uColor.value.setRGB(1, 0.9, 0.8).lerp(to, 0.35);
  }

  // Exhibition pose for a record at signed offset o from the centre.
  pose(o) {
    const L = this.lay;
    const a = Math.abs(o);
    const s = Math.sign(o);
    const a1 = Math.min(a, 1);
    const ar = Math.max(a - 1, 0);
    const e = smooth(a1);
    return {
      x: s * (L.x1 * (0.35 * a1 + 0.65 * e) + L.xs * ar),
      y: -0.05 * a * a,
      z: -(L.z1 * e + L.zs * ar),
      yaw: -s * (L.yaw * e + 0.07 * ar),
      pitch: 0,
      roll: s * 0.04 * Math.min(a, 3),
      scale: 1 - 0.12 * e - 0.05 * ar,
      dim: Math.min(1, 0.36 * e + 0.17 * ar),
      focus: 1 - e,
      opacity: 1 - smooth(clamp01((a - this.fadeFrom) / this.fadeLen)),
    };
  }

  applyPose(d, p, spin, radius) {
    d.outer.position.set(p.x, p.y, p.z);
    d.outer.rotation.set(p.pitch, p.yaw, p.roll, 'YXZ');
    d.outer.scale.setScalar(Math.max(p.scale * radius, 1e-4));
    d.inner.rotation.z = spin;
    const u = d.mat.uniforms;
    u.uDim.value = p.dim;
    u.uFocus.value = p.focus;
    u.uOpacity.value = p.opacity;
    d.rimMat.uniforms.uDim.value = p.dim;
    d.rimMat.uniforms.uOpacity.value = p.opacity;
    d.outer.visible = p.opacity > 0.01 && p.scale > 0.002;
  }

  get active() {
    return mod(Math.round(this.pos), this.n);
  }

  // the copy of record `index` closest to the centre
  visFor(index) {
    let best = index;
    let bestA = Infinity;
    for (let k = index; k < this.nVis; k += this.n) {
      const a = Math.abs(wrap(k - this.pos, this.nVis));
      if (a < bestA) {
        bestA = a;
        best = k;
      }
    }
    return best;
  }

  discOf(t) {
    if (!t) return null;
    return t.kind === 'mini' ? this.miniSets.get(t.parent)?.[t.index] : this.recs[this.visFor(t.index)];
  }

  isHover(kind, index) {
    return this.hover && this.hover.kind === kind && this.hover.index === index;
  }

  updateRecords(dt) {
    const ap = this.dv.approach;
    const tgt = this.diveTarget;
    const mini = tgt?.kind === 'mini';
    const tgtDisc = tgt && !mini ? this.discOf(tgt) : null;
    this.recs.forEach((d, k) => {
      const i = k % this.n;
      const o = wrap(k - this.pos, this.nVis);
      const p = this.pose(o);
      p.yaw += this.mouseS.x * 0.14 * p.focus;
      p.pitch = -this.mouseS.y * 0.09 * p.focus;
      p.y += Math.sin(this.time * 0.7 + k * 1.3) * 0.022;
      let spin = Math.sin(this.time * 0.23 + k * 1.7) * 0.035;

      d.hover += ((this.hover?.kind === 'record' && this.hover.vis === k ? 1 : 0) - d.hover) * damp(dt, 8);
      p.z += d.hover * 0.16 * p.focus;
      p.dim *= 1 - d.hover * 0.5;

      if (this.fly.index === k && this.fly.t > 0 && this.fly.t < 1) {
        const f = this.fly.t;
        const b = Math.sin(Math.PI * f);
        p.z += b * 1.5;
        p.y += b * 0.22;
        p.pitch += b * 0.22;
        p.dim *= 1 - b;
        p.focus = Math.max(p.focus, b);
        spin += smooth(f) * TAU * this.fly.dir;
      }

      if (tgtDisc === d) {
        p.x = lerp(p.x, 0, ap);
        p.y = lerp(p.y, 0, ap);
        p.z = lerp(p.z, 1.1, ap);
        p.yaw = lerp(p.yaw, 0, ap);
        p.pitch = lerp(p.pitch, 0, ap);
        p.roll = lerp(p.roll, 0, ap);
        p.scale = lerp(p.scale, 1.06, ap);
        p.dim = lerp(p.dim, 0, ap);
        p.focus = lerp(p.focus, 1, ap);
        spin += this.dv.spin;
      } else if (tgt) {
        const k = mini && tgt.parent === i ? 0.55 : 1;
        p.z -= 2.6 * ap * k;
        p.x *= 1 + 0.4 * ap * k;
        p.dim = lerp(p.dim, 1, ap * 0.85 * k);
      }
      this.applyPose(d, p, spin, DISC);
    });
  }

  updateArcs() {
    const ap = this.dv.approach;
    const R = this.compact ? Math.min(2.2, this.visW * 0.48) : 3.1;
    const tilt = 0.22;
    const zc = -1.6;
    const t = this.tanHalf;
    const lookY = this.look.y;
    const zFar = zc - R * Math.cos(tilt);
    const topF = (this.compact ? 0.055 : 0.07) - ap * 0.4;
    const botF = (this.compact ? 0.955 : 0.935) + this.minis.cam * 0.11 + ap * 0.4;
    const yTopFar = lookY + (1 - 2 * topF) * (this.camDistEff - zFar) * t;
    const yBotFar = lookY + (1 - 2 * botF) * (this.camDistEff - zFar) * t;
    const common = { x: 0, z: zc, yaw: 0, roll: 0, scale: 1, dim: 0.3 + ap * 0.6, focus: 0.35, opacity: 1 - ap * 0.9 };
    this.applyPose(this.arcs[0], { ...common, y: yTopFar + R * Math.sin(tilt), pitch: Math.PI / 2 - tilt }, this.time * 0.06, R);
    this.applyPose(this.arcs[1], { ...common, y: yBotFar - R * Math.sin(tilt), pitch: -(Math.PI / 2 - tilt), roll: 0 }, -this.time * 0.05, R);
    // pitch is applied after yaw (YXZ), the arcs only need pitch
  }

  updateMinis(dt) {
    const M = this.minis;
    const active = this.active;
    const o = wrap(active - this.pos, this.n);
    const has = this.miniSets.has(active);
    const tgt = this.diveTarget;
    const calm = Math.abs(o) < 0.1 && this.speed < 0.8 && !this.compact;
    let want = has && (calm || M.forced) ? 1 : 0;
    if (tgt && tgt.kind === 'record') want = 0;

    if (want && M.parent !== active) {
      if (M.reveal > 0.001) want = 0;
      else M.parent = active;
    }
    M.settle = want ? M.settle + dt : 0;
    const goal = want && (M.settle > 0.14 || M.forced) ? 1 : 0;
    const rate = goal ? 1 / 1.05 : 1 / 0.42;
    M.reveal = goal > M.reveal ? Math.min(goal, M.reveal + dt * rate) : Math.max(goal, M.reveal - dt * rate);
    const camGoal = has && (Math.abs(o) < 0.5 || M.forced) && !(tgt && tgt.kind === 'record') ? 1 : 0;
    M.cam += (camGoal - M.cam) * damp(dt, 3.2);

    this.miniScreen.length = 0;
    for (const [pi, set] of this.miniSets) {
      if (pi !== M.parent || M.reveal <= 0.001) {
        set.forEach((d) => (d.outer.visible = false));
        continue;
      }
      this.layoutMinis(set, pi, dt);
    }
  }

  layoutMinis(set, pi, dt) {
    const M = this.minis;
    const pc = this.recs[this.visFor(pi)].outer.position;
    const R = set.radius;
    const n = set.length;
    const span = n > 1 ? Math.min(this.visW * 0.35, 3.5, 1.25 * (n - 1)) : 0;
    const zRow = 0.75;
    const rowY = this.look.y + (1 - 2 * (R > 0.4 ? 0.6 : 0.585)) * (this.camDistEff - zRow) * this.tanHalf;
    const ap = this.dv.approach;
    const tgt = this.diveTarget;
    set.forEach((d, i) => {
      const u = n > 1 ? (i - (n - 1) / 2) / ((n - 1) / 2) : 0;
      const st = 0.55;
      const local = clamp01(M.reveal * (1 + st) - Math.abs(u) * st);
      const e = easeOut(local);
      d.hover += ((this.isHover('mini', i) ? 1 : 0) - d.hover) * damp(dt, 9);
      const h = d.hover;
      d.spin += dt * (0.12 + 2.4 * h);
      const p = {
        x: lerp(pc.x, u * span, e),
        y: lerp(pc.y, rowY - 0.16 * u * u, e) + 0.12 * h,
        z: lerp(pc.z, zRow - 0.3 * u * u, e) + 0.3 * h,
        yaw: lerp(-u * 0.4, 0, h) + this.mouseS.x * 0.1,
        pitch: -0.14 * (1 - h) - this.mouseS.y * 0.06,
        roll: u * 0.08 * (1 - h),
        scale: e * (1 + 0.18 * h),
        dim: 0.12 * (1 - h),
        focus: 0.55 + 0.45 * h,
        opacity: clamp01(local * 1.6),
      };
      let spin = d.spin;
      if (tgt && tgt.kind === 'mini' && tgt.parent === pi) {
        if (tgt.index === i) {
          p.x = lerp(p.x, 0, ap);
          p.y = lerp(p.y, this.look.y, ap);
          p.z = lerp(p.z, 1.1, ap);
          p.yaw = lerp(p.yaw, 0, ap);
          p.pitch = lerp(p.pitch, 0, ap);
          p.roll = lerp(p.roll, 0, ap);
          p.scale = lerp(p.scale, DISC / R, ap);
          p.dim = lerp(p.dim, 0, ap);
          p.focus = lerp(p.focus, 1, ap);
          spin += this.dv.spin;
        } else {
          p.y -= 1.2 * ap;
          p.z -= 1.5 * ap;
          p.opacity *= 1 - ap;
        }
      }
      this.applyPose(d, p, spin, R);
      // caption anchor just below the disc
      this.v.set(p.x, p.y - R * p.scale * 1.25, p.z).project(this.camera);
      const x = (this.v.x * 0.5 + 0.5) * this.w;
      const y = (-this.v.y * 0.5 + 0.5) * this.h;
      // beside the disc, on its outer side (used when there are only a few)
      const side = Math.sign(u) || 1;
      this.v.set(p.x + side * R * p.scale * 1.3, p.y, p.z).project(this.camera);
      this.miniScreen.push({
        x,
        y,
        sx: (this.v.x * 0.5 + 0.5) * this.w,
        sy: (-this.v.y * 0.5 + 0.5) * this.h,
        side,
        o: tgt ? 0 : p.opacity * clamp01(local * 2 - 0.6),
        hover: h,
      });
    });
  }

  updateCamera() {
    const c = this.minis.cam;
    // with mini records out, pull back and lift the exhibition to make room for the row
    this.camDistEff = this.camDist * (1 + (this.compact ? 0 : 0.22) * c);
    const roomY = this.compact ? this.lookY - 0.06 * this.visH : -0.2 * this.visH * 1.22;
    this.look.set(0, lerp(this.lookY, roomY, c), 0);
    const cam = this.camera;
    cam.position.set(this.mouseS.x * 0.12, this.look.y + this.mouseS.y * 0.08, this.camDistEff);
    let fov = this.baseFov;
    const disc = this.discOf(this.diveTarget);
    const k = this.dv.cam;
    if (disc && k > 0) {
      const c = disc.outer.position;
      this.v.set(c.x, c.y, c.z + 0.025);
      cam.position.lerp(this.v, k);
      this.v.copy(this.look).lerp(c, Math.min(1, k * 2.5));
      cam.lookAt(this.v);
      fov = this.baseFov + 30 * k * k;
    } else {
      cam.lookAt(this.look);
    }
    if (cam.fov !== fov) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
    cam.updateMatrixWorld();
  }

  update(dt) {
    this.time += dt;
    this.mouseS.lerp(this.mouse, damp(dt, 3.5));
    const t = this.time;
    this.shared.uKey.value.set(-4.4 + this.mouseS.x * 5.5 + Math.sin(t * 0.31) * 0.8, 3.4 + this.mouseS.y * 3 + Math.cos(t * 0.23) * 0.5, 5.5);
    this.shared.uRim.value.set(5.2 - this.mouseS.x * 2, -2.2, -1.2);

    // camera first so minis/arcs can place themselves against its framing
    this.updateCamera();
    this.updateRecords(dt);
    this.updateArcs();
    this.updateMinis(dt);
    this.updateCamera();

    const hero = this.recs[this.visFor(this.active)].outer.position;
    this.v.copy(hero).project(this.camera);
    const ox = this.v.x * 0.5 + 0.5;
    const oy = this.v.y * 0.5 + 0.5;
    const og = this.bgMat.uniforms.uOrigin.value;
    og.x += (ox - og.x) * damp(dt, 6);
    og.y += (oy - og.y) * damp(dt, 6);
    this.bgMat.uniforms.uTime.value = t;
    this.bgMat.uniforms.uGlow.value = 1 - this.dv.approach * 0.5;
    this.compMat.uniforms.uTime.value = t;
    this.compMat.uniforms.uHole.value = this.dv.hole;
    this.dustMat.uniforms.uTime.value = t;
    this.dustMat.uniforms.uOpacity.value = 1 - this.dv.cam * 0.8;
  }

  render() {
    const r = this.renderer;
    r.setRenderTarget(this.rt);
    r.clear();
    r.render(this.scene, this.camera);
    r.setRenderTarget(null);
    r.render(this.compScene, this.compCam);
  }

  pick(x, y) {
    if (this.diveTarget) return null;
    this.v.set((x / this.w) * 2 - 1, -(y / this.h) * 2 + 1, 0.5);
    this.raycaster.setFromCamera(this.v, this.camera);
    const objs = [];
    this.recs.forEach((d) => d.outer.visible && d.mat.uniforms.uOpacity.value > 0.4 && objs.push(d.front, d.back));
    const set = this.miniSets.get(this.minis.parent);
    if (set && this.minis.reveal > 0.6) set.forEach((d) => d.outer.visible && objs.push(d.front, d.back));
    const hits = this.raycaster.intersectObjects(objs, false);
    if (!hits.length) return null;
    // minis sit in front; prefer them when both are hit
    const m = hits.find((h) => h.object.userData.kind === 'mini');
    return (m || hits[0]).object.userData;
  }

  // --- portal choreography -------------------------------------------------

  dive(target, { onInside } = {}) {
    this.diveTarget = target;
    if (target.kind === 'mini') this.minis.forced = true;
    gsap.killTweensOf(this.dv);
    return new Promise((resolve) => {
      const tl = gsap.timeline({ onComplete: resolve });
      tl.to(this.dv, { approach: 1, duration: 0.7, ease: 'power3.inOut' }, 0);
      tl.to(this.dv, { spin: 1.3, duration: 1.25, ease: 'power2.in' }, 0);
      tl.to(this.dv, { cam: 1, duration: 0.9, ease: 'power3.in' }, 0.2);
      tl.call(() => onInside && onInside(), null, 1.0);
      tl.to(this.dv, { hole: 1, duration: 0.48, ease: 'power2.out' }, 1.04);
    });
  }

  setDived(target) {
    gsap.killTweensOf(this.dv);
    this.diveTarget = target;
    Object.assign(this.dv, { approach: 1, cam: 1, hole: 1, spin: 1.3 });
    if (target.kind === 'mini') {
      this.minis.forced = true;
      this.minis.parent = target.parent;
      this.minis.reveal = 1;
      this.minis.cam = 1;
    }
  }

  emerge({ onClosed } = {}) {
    gsap.killTweensOf(this.dv);
    return new Promise((resolve) => {
      const tl = gsap.timeline({
        onComplete: () => {
          this.diveTarget = null;
          this.minis.forced = false;
          resolve();
        },
      });
      tl.to(this.dv, { hole: 0, duration: 0.45, ease: 'power2.inOut' }, 0);
      tl.call(() => onClosed && onClosed(), null, 0.45);
      tl.to(this.dv, { cam: 0, duration: 0.95, ease: 'power3.out' }, 0.2);
      tl.to(this.dv, { spin: 0, duration: 1.1, ease: 'power2.out' }, 0.2);
      tl.to(this.dv, { approach: 0, duration: 0.8, ease: 'power3.inOut' }, 0.5);
    });
  }

  clearDive() {
    gsap.killTweensOf(this.dv);
    this.diveTarget = null;
    this.minis.forced = false;
    Object.assign(this.dv, { approach: 0, cam: 0, hole: 0, spin: 0 });
  }
}
