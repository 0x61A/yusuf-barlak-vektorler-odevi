// Ses efektleri: hepsi Web Audio ile anında üretilir, ses dosyası yok.

let ctx = null;
let master = null;
let noiseBuf = null;
let enabled = true;
let engine = null;

function ensure() {
  if (!enabled) return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function noise(dur, { freq = 1000, endFreq = freq, type = 'lowpass', gain = 0.6, q = 0.8 } = {}) {
  const c = ensure();
  if (!c) return;
  const t = c.currentTime;
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  const f = c.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(freq, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(endFreq, 20), t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t);
  src.stop(t + dur);
}

function tone(dur, { freq = 440, endFreq = freq, type = 'sine', gain = 0.3, delay = 0 } = {}) {
  const c = ensure();
  if (!c) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(endFreq, 20), t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export const sfx = {
  setEnabled(on) {
    enabled = on;
    if (!on) this.engine(false);
    if (master) master.gain.value = on ? 0.5 : 0;
  },
  unlock() {
    ensure();
  },
  fire(heavy = false) {
    noise(0.25, { freq: 3000, endFreq: 300, gain: 0.5 });
    tone(0.3, { freq: heavy ? 160 : 240, endFreq: 50, type: 'square', gain: 0.18 });
  },
  explosion(radius = 5) {
    const big = radius > 7;
    noise(big ? 1.4 : 0.9, { freq: big ? 1600 : 2400, endFreq: 120, gain: big ? 0.9 : 0.7 });
    tone(big ? 0.8 : 0.5, { freq: big ? 90 : 120, endFreq: 30, gain: big ? 0.6 : 0.45 });
  },
  bounce() {
    tone(0.12, { freq: 700, endFreq: 260, type: 'triangle', gain: 0.25 });
  },
  split() {
    [0, 0.05, 0.1, 0.15].forEach((d, i) => tone(0.08, { freq: 900 + i * 220, type: 'square', gain: 0.08, delay: d }));
  },
  // Ağaç kırılması (kuru çatırtı) veya taş parçalanması (tok gürültü)
  crunch(type) {
    if (type === 'agac') {
      noise(0.35, { freq: 2200, endFreq: 500, type: 'bandpass', gain: 0.55, q: 2 });
      tone(0.12, { freq: 180, endFreq: 90, type: 'square', gain: 0.12 });
    } else {
      noise(0.5, { freq: 900, endFreq: 150, gain: 0.7 });
      tone(0.25, { freq: 110, endFreq: 45, gain: 0.3 });
    }
  },
  hit() {
    tone(0.25, { freq: 220, endFreq: 90, type: 'sawtooth', gain: 0.2 });
  },
  click() {
    tone(0.04, { freq: 1500, endFreq: 1200, type: 'square', gain: 0.05 });
  },
  win() {
    [523, 659, 784, 1046].forEach((f, i) => tone(0.25, { freq: f, type: 'triangle', gain: 0.2, delay: i * 0.12 }));
  },
  lose() {
    [392, 330, 262, 196].forEach((f, i) => tone(0.35, { freq: f, type: 'triangle', gain: 0.2, delay: i * 0.16 }));
  },
  // Motor uğultusu: hareket ederken açık
  engine(on) {
    const c = on ? ensure() : ctx;
    if (!c) return;
    if (on && !engine) {
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = 52;
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 380;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.12, c.currentTime + 0.15);
      o.connect(f).connect(g).connect(master);
      o.start();
      engine = { o, g };
    } else if (!on && engine) {
      const { o, g } = engine;
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.15);
      o.stop(c.currentTime + 0.2);
      engine = null;
    }
  },
};
