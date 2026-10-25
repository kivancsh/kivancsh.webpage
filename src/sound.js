// Procedural record-player sounds. Off by default; nothing is created until the
// listener turns it on (browsers require a gesture for audio anyway).
export class Sound {
  constructor() {
    this.on = false;
    this.ctx = null;
  }

  init() {
    if (this.ctx) return;
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return;
    const ctx = (this.ctx = new C());
    this.master = ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(ctx.destination);

    const sr = ctx.sampleRate;
    const len = sr * 4;
    const buf = ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    let pop = 0;
    let amp = 0;
    for (let i = 0; i < len; i++) {
      if (Math.random() < 0.0007) { pop = 30 + Math.random() * 60; amp = 0.25 + Math.random() * 0.75; }
      let v = (Math.random() * 2 - 1) * 0.018;
      if (pop > 0) { v += (Math.random() * 2 - 1) * amp * (pop / 90); pop--; }
      // slow 33⅓ rpm surface rumble
      v += Math.sin((i / sr) * Math.PI * 2 * 0.555) * 0.004 * (Math.random() * 2 - 1);
      d[i] = v;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 650;
    this.bed = ctx.createGain();
    this.bed.gain.value = 0;
    src.connect(hp).connect(this.bed).connect(this.master);
    src.start();
  }

  setOn(v, { bed = true } = {}) {
    this.on = v;
    this.useBed = bed;
    if (v) {
      this.init();
      if (!this.ctx) return;
      this.ctx.resume();
      this.ramp(this.bed.gain, bed ? 0.22 : 0, 0.6);
    } else if (this.ctx) {
      this.ramp(this.bed.gain, 0, 0.3);
    }
  }

  ramp(param, value, time) {
    const t = this.ctx.currentTime;
    param.cancelScheduledValues(t);
    param.setValueAtTime(param.value, t);
    param.linearRampToValueAtTime(value, t + time);
  }

  burst(dur, freq, gain, type = 'bandpass') {
    const ctx = this.ctx;
    const len = Math.round(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    const s = ctx.createBufferSource();
    s.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = 1.4;
    const g = ctx.createGain();
    g.gain.value = gain;
    s.connect(f).connect(g).connect(this.master);
    s.start();
  }

  tick() {
    if (!this.on || !this.ctx) return;
    this.burst(0.03, 3200, 0.16);
  }

  needle() {
    if (!this.on || !this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(70, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.3);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.4, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.4);
    this.burst(0.18, 1400, 0.25, 'lowpass');
    if (!this.useBed) return;
    this.ramp(this.bed.gain, 0.38, 0.4);
    setTimeout(() => this.on && this.ramp(this.bed.gain, 0.22, 1.2), 1600);
  }

  lift() {
    if (!this.on || !this.ctx) return;
    this.burst(0.09, 2200, 0.12);
  }
}
