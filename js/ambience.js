// Soft generated background sound for focus sessions (no audio files needed).
// Each ambience is synthesised once into a seamless 12-second stereo loop from
// many small events — fine droplets and soft patter for rain, crackle clusters and a low
// roar for the hearth — so it sounds like texture rather than hiss.
let ctx = null, current = null;
const cache = {};
const LOOP = 12, FADE = 1;

function audio() { ctx ||= new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === 'suspended') ctx.resume(); return ctx; }

// Adds a decaying event at time t (s) to both channels with a pan in [-1, 1].
function addEvent(chs, sr, t, len, pan, fn) {
  const i0 = Math.floor(t * sr), n = Math.floor(len * sr), gl = Math.sqrt((1 - pan) / 2), gr = Math.sqrt((1 + pan) / 2);
  const [L, R] = chs;
  for (let i = 0; i < n && i0 + i < L.length; i++) { const v = fn(i / sr); L[i0 + i] += v * gl; R[i0 + i] += v * gr; }
}

// slow random wander in [lo, hi], sampled per block
function wander(n, sr, lo, hi, speed) {
  const out = new Float32Array(n); let v = (lo + hi) / 2, target = v;
  for (let i = 0; i < n; i++) {
    if (i % Math.floor(sr * speed) === 0) target = lo + Math.random() * (hi - lo);
    v += (target - v) * (1 / (sr * speed * 0.6)); out[i] = v;
  }
  return out;
}

function rain(sr, len) {
  const n = Math.floor(len * sr), chs = [new Float32Array(n), new Float32Array(n)];
  // a soft wash of rain far away (filtered pink noise, gently gusting)
  const gust = wander(n, sr, 0.55, 1, 2.5);
  for (const [c, ch] of chs.entries()) {
    let b0 = 0, b1 = 0, b2 = 0, lp = 0, lp2 = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913;
      const pink = (b0 + b1 + b2 + w * 0.1848) * 0.11;
      lp += (pink - lp) * 0.25; lp2 += (lp - lp2) * 0.4;
      ch[i] += lp2 * 0.28 * gust[(i + c * 997) % n];
    }
  }
  // fine droplets everywhere
  for (let k = 0; k < len * 520; k++) {
    const t = Math.random() * len, f = 2500 + Math.random() * 4500, tau = 0.0007 + Math.random() * 0.0016, a = 0.03 * Math.random() ** 2;
    addEvent(chs, sr, t, tau * 6, Math.random() * 2 - 1, (x) => Math.sin(6.283 * f * x) * Math.exp(-x / tau) * a * gust[Math.floor(t * sr)]);
  }
  // patter on the roof and leaves
  for (let k = 0; k < len * 40; k++) {
    const t = Math.random() * len, f = 700 + Math.random() * 1300, tau = 0.002 + Math.random() * 0.004, a = 0.04 + Math.random() * 0.05;
    addEvent(chs, sr, t, tau * 6, Math.random() * 1.6 - 0.8, (x) => (Math.sin(6.283 * f * x) * 0.3 + (Math.random() * 2 - 1) * 0.7) * Math.exp(-x / tau) * a);
  }
  return chs;
}

function hearth(sr, len) {
  const n = Math.floor(len * sr), chs = [new Float32Array(n), new Float32Array(n)];
  // the fire's low, breathing roar
  const breath = wander(n, sr, 0.45, 1, 1.4);
  for (const [c, ch] of chs.entries()) {
    let br = 0, l1 = 0, l2 = 0, m1 = 0, m2 = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      br = (br + 0.02 * w) / 1.02;
      l1 += (br - l1) * 0.05; l2 += (l1 - l2) * 0.05;
      m1 += (w - m1) * 0.08; m2 += (m1 - m2) * 0.3; // a soft mid "whoosh"
      const b = breath[(i + c * 4001) % n];
      ch[i] += l2 * 3 * b + (m1 - m2) * 0.04 * b * b;
    }
  }
  // crackles: sharp little snaps, often in clusters
  const snap = (t, a, pan) => {
    const tau = 0.0002 + Math.random() * 0.0008; let prev = 0;
    addEvent(chs, sr, t, tau * 8, pan, (x) => { const w = (Math.random() * 2 - 1) * Math.exp(-x / tau); const v = w - prev * 0.6; prev = w; return v * a; });
  };
  for (let t = 0; t < len;) {
    t += -Math.log(1 - Math.random()) / 5;
    const pan = Math.random() * 1.2 - 0.6, a = 0.12 + 0.55 * Math.random() ** 3;
    snap(t, a, pan);
    if (Math.random() < 0.4) { let u = t; for (let j = 0, m = 2 + Math.floor(Math.random() * 6); j < m; j++) { u += 0.006 + Math.random() * 0.05; snap(u, a * (0.3 + Math.random() * 0.6), pan + (Math.random() - 0.5) * 0.2); } }
  }
  // the occasional knot of wood popping, with a soft thump
  for (let k = 0; k < len / 3.5; k++) {
    const t = Math.random() * len, pan = Math.random() - 0.5, f = 90 + Math.random() * 60;
    snap(t, 0.8, pan);
    addEvent(chs, sr, t, 0.12, pan, (x) => Math.sin(6.283 * f * x) * Math.exp(-x / 0.03) * 0.18);
  }
  // now and then a hiss of sap
  for (let k = 0; k < len / 5; k++) {
    const t = Math.random() * len, d = 0.3 + Math.random() * 0.6; let hp = 0;
    addEvent(chs, sr, t, d, Math.random() - 0.5, (x) => { const w = Math.random() * 2 - 1, v = w - hp; hp = w; return v * 0.012 * Math.sin((Math.PI * x) / d); });
  }
  return chs;
}

function buffer(a, kind) {
  if (cache[kind]) return cache[kind];
  const sr = a.sampleRate, n = LOOP * sr, f = FADE * sr;
  const chs = (kind === 'rain' ? rain : hearth)(sr, LOOP + FADE + 0.2);
  let peak = 0;
  for (const ch of chs) for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(ch[i]));
  const buf = a.createBuffer(2, n, sr);
  chs.forEach((ch, c) => {
    const out = buf.getChannelData(c), k = 0.85 / (peak || 1);
    for (let i = 0; i < n; i++) out[i] = ch[i] * k;
    for (let i = 0; i < f; i++) { const x = i / f; out[i] = (ch[i] * Math.sqrt(x) + ch[n + i] * Math.sqrt(1 - x)) * k; } // seamless loop
  });
  return (cache[kind] = buf);
}

export function setAmbience(kind, volume = 0.5) {
  if (current) { current.stop(); current = null; }
  if (!kind) return;
  const a = audio();
  const out = a.createGain(); out.connect(a.destination);
  out.gain.setValueAtTime(0, a.currentTime); out.gain.linearRampToValueAtTime(volume, a.currentTime + 1.2);
  const src = a.createBufferSource(); src.buffer = buffer(a, kind); src.loop = true;
  const soft = a.createBiquadFilter(); soft.type = 'lowpass'; soft.frequency.value = kind === 'rain' ? 9000 : 7000;
  src.connect(soft).connect(out); src.start();
  current = { kind, out, stop: () => {
    const t = a.currentTime; out.gain.cancelScheduledValues(t); out.gain.setValueAtTime(out.gain.value, t); out.gain.linearRampToValueAtTime(0, t + 0.4);
    setTimeout(() => { try { src.stop(); } catch { /* already stopped */ } out.disconnect(); }, 450);
  } };
}

export function setVolume(v) { if (current) current.out.gain.value = v; }

export function chime() {
  const a = audio();
  [660, 880, 1320].forEach((f, i) => {
    const o = a.createOscillator(), g = a.createGain(), t = a.currentTime + i * 0.18;
    o.type = 'triangle'; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + 1);
  });
}
