// audio.js — small Web Audio synth for fighting-game SFX. No external audio
// files; everything generated with oscillators/noise so the game stays
// fully self-contained for GitHub Pages hosting.

export class Audio {
  constructor() {
    this.ctx = null;
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  _noiseBuffer(duration) {
    const ctx = this.ctx;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  _envGain(startVal, duration) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(startVal, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    return g;
  }

  swingWhoosh() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuffer(0.15);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1800, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.12);
    const gain = this._envGain(0.22, 0.15);
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start();
  }

  hitLight() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(340, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.1);
    const gain = this._envGain(0.28, 0.15);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.16);
  }

  hitHeavy() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.32);
    const gain = this._envGain(0.45, 0.35);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.36);

    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuffer(0.1);
    const g2 = this._envGain(0.25, 0.1);
    src.connect(g2).connect(ctx.destination);
    src.start();
  }

  hitSpecial() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    [1, 1.5, 2].forEach((mult, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(90 * mult, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(30 * mult, ctx.currentTime + 0.5);
      const gain = this._envGain(0.28, 0.5);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.02);
      osc.stop(ctx.currentTime + 0.55);
    });
  }

  blockThud() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(180, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(90, ctx.currentTime + 0.1);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 700;
    const gain = this._envGain(0.28, 0.14);
    osc.connect(filter).connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  }

  evadeWhoosh() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuffer(0.2);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(300, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(2000, ctx.currentTime + 0.18);
    const gain = this._envGain(0.18, 0.2);
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start();
  }

  tagSwap() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    [880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const gain = this._envGain(0.001, 0.18);
      const startAt = ctx.currentTime + i * 0.06;
      gain.gain.setValueAtTime(0, startAt);
      gain.gain.linearRampToValueAtTime(0.16, startAt + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, startAt + 0.18);
      osc.connect(gain).connect(ctx.destination);
      osc.start(startAt);
      osc.stop(startAt + 0.2);
    });
  }

  roundStart() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    [440, 660].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const gain = this._envGain(0.001, 0.3);
      gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.15);
      gain.gain.linearRampToValueAtTime(0.22, ctx.currentTime + i * 0.15 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.15);
      osc.stop(ctx.currentTime + i * 0.15 + 0.32);
    });
  }

  koStinger() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.8);
    const gain = this._envGain(0.4, 0.8);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.85);
  }

  victoryFanfare() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    [523, 659, 784, 1046].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const gain = this._envGain(0.001, 0.4);
      const startAt = ctx.currentTime + i * 0.13;
      gain.gain.setValueAtTime(0, startAt);
      gain.gain.linearRampToValueAtTime(0.22, startAt + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startAt + 0.4);
      osc.connect(gain).connect(ctx.destination);
      osc.start(startAt);
      osc.stop(startAt + 0.42);
    });
  }

  defeatStinger() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    [220, 196, 174].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const gain = this._envGain(0.001, 0.6);
      const startAt = ctx.currentTime + i * 0.35;
      gain.gain.setValueAtTime(0, startAt);
      gain.gain.linearRampToValueAtTime(0.25, startAt + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, startAt + 0.6);
      osc.connect(gain).connect(ctx.destination);
      osc.start(startAt);
      osc.stop(startAt + 0.65);
    });
  }
}
