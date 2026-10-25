import gsap from 'gsap';

// Position of the exhibition as a continuous index. A damped spring pulls `pos`
// toward `target`; drag, wheel and keys only ever move the target, so the motion
// always continues from wherever it is and settles on a whole record.
export class Carousel {
  constructor(count) {
    this.n = count;
    this.pos = 0;
    this.vel = 0;
    this.target = 0;
    this.dragging = false;
    this.tween = null;
    this.enabled = true;
    this.lastDir = 1;
    this.snapTimer = 0;
  }

  get speed() {
    return Math.abs(this.vel);
  }

  update(dt) {
    if (this.tween) return;
    const k = this.dragging ? 300 : 62;
    const c = 2 * Math.sqrt(k) * (this.dragging ? 1 : 0.86);
    const steps = Math.max(1, Math.ceil(dt / (1 / 240)));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      const a = k * (this.target - this.pos) - c * this.vel;
      this.vel += a * h;
      this.pos += this.vel * h;
    }
  }

  stopTween() {
    if (this.tween) {
      this.tween.kill();
      this.tween = null;
      this.target = this.pos;
      this.vel = 0;
    }
  }

  clampTarget() {
    const max = 3.2;
    this.target = Math.min(this.pos + max, Math.max(this.pos - max, this.target));
  }

  step(dir) {
    if (!this.enabled) return;
    this.stopTween();
    this.lastDir = dir;
    this.target = Math.round(this.target) + dir;
    this.clampTarget();
  }

  wheel(delta) {
    if (!this.enabled) return;
    this.stopTween();
    const d = Math.max(-60, Math.min(60, delta)) * 0.0085;
    if (d === 0) return;
    this.lastDir = Math.sign(d);
    this.target += d;
    this.clampTarget();
    clearTimeout(this.snapTimer);
    this.snapTimer = setTimeout(() => this.snap(), 90);
  }

  // settle on the record the gesture was heading to
  snap() {
    const t = this.target;
    this.target = this.lastDir > 0 ? Math.ceil(t - 0.18) : Math.floor(t + 0.18);
  }

  dragStart() {
    if (!this.enabled) return;
    this.stopTween();
    this.dragging = true;
    this.dragOrigin = this.target;
  }

  dragMove(deltaItems) {
    if (!this.dragging) return;
    this.target = this.dragOrigin + deltaItems;
    if (deltaItems !== 0) this.lastDir = Math.sign(deltaItems);
  }

  dragEnd(velItems, maxFling = 3) {
    if (!this.dragging) return;
    this.dragging = false;
    const projected = this.target + velItems * 0.3;
    const clamped = Math.min(this.pos + maxFling, Math.max(this.pos - maxFling, projected));
    this.target = Math.round(clamped);
    this.vel = Math.max(-14, Math.min(14, this.vel));
  }

  // Shortest way to record i, as an unbounded position.
  nearest(i) {
    const cur = Math.round(this.target);
    const base = ((cur % this.n) + this.n) % this.n;
    let d = i - base;
    if (d > this.n / 2) d -= this.n;
    if (d < -this.n / 2) d += this.n;
    return cur + d;
  }

  flyTo(i, opts) {
    return this.flyToPos(this.nearest(i), opts);
  }

  flyToPos(to, { duration, onUpdate, onComplete } = {}) {
    this.stopTween();
    const dist = Math.abs(to - this.pos);
    const proxy = { p: this.pos };
    this.target = to;
    this.tween = gsap.to(proxy, {
      p: to,
      duration: duration ?? Math.min(1.5, 0.85 + dist * 0.14),
      ease: 'power3.inOut',
      onUpdate: () => {
        const prev = this.pos;
        this.pos = proxy.p;
        this.vel = (this.pos - prev) * 60;
        onUpdate && onUpdate(this.tween.progress());
      },
      onComplete: () => {
        this.tween = null;
        this.vel = 0;
        this.pos = to;
        onComplete && onComplete();
      },
    });
    return to - this.pos;
  }

  jumpTo(i) {
    this.stopTween();
    const to = this.nearest(i);
    this.pos = this.target = to;
    this.vel = 0;
  }
}
