// The hearthside diorama: a procedurally painted pixel scene that follows the
// real sun, moon, season and weather of the current realm.
import { solarAltitude, realmClock, sunTimes, moonPhase } from './sky.js';
import { resolveAvatar, CAT, AVATAR_H } from './sprites.js';

const H = 120;
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
const hx2 = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const css = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function frame(table, x) {
  if (x <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    if (x <= table[i][0]) {
      const [a0, v0] = table[i - 1], [a1, v1] = table[i], t = (x - a0) / (a1 - a0);
      return Array.isArray(v0[0]) ? v0.map((c, j) => mix(c, v1[j], t)) : mix(v0, v1, t);
    }
  }
  return table[table.length - 1][1];
}

// sun altitude → [sky top, sky horizon]
const SKY = [
  [-18, ['#060a20', '#121838']], [-9, ['#121844', '#2f2c5e']], [-4, ['#262a68', '#93507a']],
  [-0.5, ['#3f4590', '#ee8a68']], [4, ['#5a86cc', '#ffcf96']], [12, ['#4a95de', '#b6e2f6']], [50, ['#3c8be0', '#a3d9f4']],
].map(([a, v]) => [a, v.map(hx2)]);
const AMB = [[-18, [0.26, 0.3, 0.52]], [-7, [0.4, 0.4, 0.62]], [-1, [0.82, 0.6, 0.62]], [4, [1.02, 0.86, 0.74]], [12, [1, 1, 1]]];

function palette(season, spring, climate) {
  const P = {
    spring: { grass: ['#5f9e47', '#78b856', '#4b8238'], hill: '#5a9850', canopy: spring === 'sakura' ? ['#c06a8c', '#f0a3c0', '#fbd6e3'] : ['#5a3e98', '#8668cc', '#b29af0'], under: ['#3f7a3a', '#5c9a48'], flowers: ['#f5e17a', '#f29ac0', '#ffffff', '#b49af0'], drift: spring === 'sakura' ? ['#f6b8cf', '#fbd6e3'] : ['#a586e6', '#c6b0f5'] },
    summer: { grass: ['#4f8f3a', '#68aa48', '#3d7430'], hill: '#4a8a40', canopy: ['#2c672e', '#479a3d', '#76c25a'], under: ['#245626', '#336f30'], flowers: ['#ffd54a', '#ff7a5a', '#ffffff', '#ff9ad0'], drift: [] },
    autumn: { grass: ['#7f9045', '#9aa652', '#66753a'], hill: '#7a8a46', canopy: ['#a1401e', '#da772b', '#f2b04a'], under: ['#7a5a2a', '#8a6a30'], flowers: ['#e0782a', '#c9452a', '#f2c14a'], drift: ['#d8682a', '#f2a03a', '#b8401e'] },
    winter: { grass: ['#5e7a55', '#72906a', '#4c6446'], hill: '#5d7658', canopy: ['#3a5a43', '#527658', '#6d9070'], under: ['#2e4a36', '#3a5a43'], flowers: [], drift: [] },
  }[season];
  if (season === 'summer' && climate === 'temperate') P.grass = ['#8b9a45', '#a6b456', '#73823a']; // dry Aussie summer
  if (season === 'winter' && climate === 'temperate') { // a storybook snowy winter
    Object.assign(P, { snowy: true, grass: ['#e6edf4', '#ffffff', '#c9d5e3'], hill: '#dfe7f0', under: ['#93a4b8', '#c3cfdc'], canopy: ['#aebfd2', '#dfe8f2', '#ffffff'] });
  }
  return P;
}

class Raster {
  constructor(w, h) { this.w = w; this.h = h; this.img = new ImageData(w, h); this.d = this.img.data; }
  put(x, y, c, a = 1) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4, d = this.d;
    if (a >= 1 || d[i + 3] === 0) { d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; }
    else { d[i] += (c[0] - d[i]) * a; d[i + 1] += (c[1] - d[i + 1]) * a; d[i + 2] += (c[2] - d[i + 2]) * a; }
    d[i + 3] = 255;
  }
  rect(x, y, w, h, c, a) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.put(x + i, y + j, c, a); }
  disk(cx, cy, r, fn) { for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * 0.6) fn(cx + x, cy + y, x / r, y / r); }
  line(x0, y0, x1, y1, c) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
    for (let i = 0; i <= n; i++) this.put(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), c);
  }
}

// The avatar (normal + blink frames), pre-tinted for the light.
// Uploads keep every one of their own pixels: they are drawn on the scene's fine overlay
// (see blitHero), each image pixel a whole number `p` of device pixels, so that the
// figure stands about avatar.size scene pixels tall. `dpx` = device pixels per scene pixel.
function heroCanvases(input, avImg, T, amb, dpx = 1) {
  const av = resolveAvatar(input.avatar);
  const img = input.avatar?.image && avImg?.src === input.avatar.image && avImg.ok ? avImg.img : null;
  const p = img ? clamp(Math.round((dpx * (input.avatar.size || AVATAR_H)) / img.height), 1, Math.max(1, Math.floor(dpx))) : 0;
  const iw = img ? img.width : av.w, ih = img ? img.height : av.h;
  const cvs = [av.rows, av.blink].map((rows) => {
    const cv = document.createElement('canvas'); cv.width = iw; cv.height = ih;
    const g = cv.getContext('2d');
    if (img) {
      g.drawImage(img, 0, 0);
      g.globalCompositeOperation = 'multiply'; g.fillStyle = css(amb.map((v) => v * 255)); g.fillRect(0, 0, iw, ih);
      g.globalCompositeOperation = 'destination-in'; g.drawImage(img, 0, 0);
    } else rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) { const ch = row[i]; if (ch !== '.' && av.pal[ch]) { g.fillStyle = css(T(av.pal[ch])); g.fillRect(i, j, 1, 1); } } });
    return cv;
  });
  if (!img) return { cvs, w: iw, h: ih, hand: av.hand, hi: null };
  const w = Math.round((iw * p) / dpx), h = Math.round((ih * p) / dpx);
  return { cvs, w, h, hand: [w - 2, Math.round(h * 0.7)], hi: { p, dpx } };
}

export class Scene {
  constructor(canvas) {
    this.cv = canvas; this.ctx = canvas.getContext('2d');
    this.bg = document.createElement('canvas');
    this.parts = []; this.smoke = []; this.flies = [];
    this.key = ''; this.input = null; this.last = 0; this.t = 0;
    this.sunCache = {};
  }

  update(input) { this.input = input; }

  resize() {
    const box = this.cv.parentElement;
    if (this.big) this.scale = Math.max(2, Math.floor(Math.min(window.innerHeight / H, box.clientWidth / 140)));
    else this.scale = Math.max(2, Math.round(clamp(window.innerHeight * 0.34, 170, 330) / H));
    this.W = Math.ceil(box.clientWidth / this.scale);
    this.cv.width = this.W; this.cv.height = H;
    this.cv.style.width = this.W * this.scale + 'px';
    this.cv.style.height = H * this.scale + 'px';
    const dpr = window.devicePixelRatio || 1;
    this.dpx = this.scale * dpr;
    if (this.hiCv) {
      this.hiCv.width = Math.round(this.W * this.dpx); this.hiCv.height = Math.round(H * this.dpx);
      this.hiCv.style.width = this.cv.style.width; this.hiCv.style.height = this.cv.style.height;
      this.hiCv.style.left = this.cv.offsetLeft + 'px'; this.hiCv.style.top = this.cv.offsetTop + 'px';
      this.hiCtx.imageSmoothingEnabled = false;
    }
    this.key = ''; this.clouds = null;
  }

  start() {
    this.hiCv = document.createElement('canvas'); this.hiCv.className = 'scene-hi'; this.hiCv.setAttribute('aria-hidden', 'true');
    this.cv.after(this.hiCv); this.hiCtx = this.hiCv.getContext('2d');
    this.resize();
    this.onResize = () => this.resize();
    window.addEventListener('resize', this.onResize);
    const loop = (ts) => {
      this.raf = requestAnimationFrame(loop);
      if (ts - this.last < 80 || !this.input) return; // ~12 fps keeps the pixel feel
      const dt = Math.min(0.3, (ts - this.last) / 1000);
      this.last = ts; this.t += dt;
      this.hiCtx.clearRect(0, 0, this.hiCv.width, this.hiCv.height);
      this.frame(dt);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() { cancelAnimationFrame(this.raf); window.removeEventListener('resize', this.onResize); this.hiCv?.remove(); }

  // Draws a hero canvas at logical (x, y), optionally mirrored or cropped to its top cropH rows
  // (in scene pixels). Uploaded avatars go to the fine overlay at their own pixel size.
  blitHero(c, cv, x, y, flip = false, cropH = null) {
    const hi = this.heroHi;
    if (!hi) {
      const rows = cropH == null ? cv.height : Math.min(cv.height, cropH);
      c.save();
      if (flip) { c.translate(x + cv.width, y); c.scale(-1, 1); c.drawImage(cv, 0, 0, cv.width, rows, 0, 0, cv.width, rows); }
      else c.drawImage(cv, 0, 0, cv.width, rows, x, y, cv.width, rows);
      c.restore();
      return;
    }
    const g = this.hiCtx, k = hi.dpx;
    const rows = cropH == null ? cv.height : Math.min(cv.height, Math.round((cropH * k) / hi.p));
    const w = cv.width * hi.p, h = rows * hi.p, X = Math.round(x * k), Y = Math.round(y * k);
    g.save();
    if (flip) { g.translate(X + w, Y); g.scale(-1, 1); g.drawImage(cv, 0, 0, cv.width, rows, 0, 0, w, h); }
    else g.drawImage(cv, 0, 0, cv.width, rows, X, Y, w, h);
    g.restore();
  }

  env() {
    const { realm, date, season, weather } = this.input;
    const alt = solarAltitude(date, realm.lat, realm.lon);
    const clock = realmClock(realm, date);
    const dk = `${realm.id}${clock.y}-${clock.m}-${clock.d}`;
    if (!this.sunCache[dk]) this.sunCache = { [dk]: sunTimes(realm, date) };
    const { rise, set } = this.sunCache[dk];
    const wet = weather === 'rain' || weather === 'storm';
    const grey = wet ? 0.55 : weather === 'cloudy' || weather === 'fog' ? 0.3 : 0;
    let [top, bot] = frame(SKY, alt);
    const g = [120, 128, 142].map((v) => v * clamp((alt + 14) / 20, 0.2, 1));
    top = mix(top, g, grey); bot = mix(bot, g, grey * 0.8);
    let amb = frame(AMB, alt);
    if (grey) amb = amb.map((v, i) => v * (1 - grey * [0.32, 0.28, 0.2][i]));
    return { realm, date, season, weather, alt, clock, rise, set, top, bot, amb, wet, grey, dark: clamp((2 - alt) / 10, 0, 1), morning: clock.hour < 12, pal: palette(season, realm.spring, realm.climate) };
  }

  frame(dt) {
    const e = this.env();
    this.loadAvatarImage();
    const key = [this.W, Math.round(e.alt * 2), e.season, e.weather, e.realm.id, this.input.openQuests, Math.floor(+e.date / 120000), JSON.stringify(this.input.avatar || {}), this.avImg?.ok].join('|');
    if (key !== this.key) { this.build(e); this.key = key; }
    this.drawDynamic(e, dt);
  }

  // ---------- static layer -----------------------------------------------
  build(e) {
    const W = this.W, R = new Raster(W, H), rnd = rng(1337);
    const tc = new Map();
    const T = (h) => { let c = tc.get(h); if (!c) { const b = hx2(h); c = [clamp(b[0] * e.amb[0], 0, 255), clamp(b[1] * e.amb[1], 0, 255), clamp(b[2] * e.amb[2], 0, 255)]; tc.set(h, c); } return c; };
    const haze = (h, t) => mix(T(h), e.bot, t);
    const s = (this.spots = {});

    // sky, dithered into bands
    const horizon = 74, N = 12;
    const steps = Array.from({ length: N }, (_, i) => mix(e.top, e.bot, i / (N - 1)));
    for (let y = 0; y < 92; y++) {
      const v = clamp(y / horizon, 0, 1) ** 1.25 * (N - 1);
      const lo = Math.floor(v), fr = v - lo;
      for (let x = 0; x < W; x++) R.put(x, y, steps[Math.min(N - 1, fr * 16 > BAYER[y & 3][x & 3] ? lo + 1 : lo)]);
    }

    // stars
    s.stars = [];
    if (e.dark > 0.05) {
      const sr = rng(7);
      for (let i = 0; i < W * 0.22; i++) {
        const x = Math.floor(sr() * W), y = Math.floor(sr() * 50), b = sr();
        R.put(x, y, [255, 250, 230], e.dark * (0.25 + b * 0.6) * (1 - e.grey));
        if (b > 0.88) s.stars.push({ x, y, p: sr() * 6 });
      }
    }

    // sun & moon
    const dayLen = e.rise && e.set ? e.set - e.rise : 12 * 3600000;
    if (e.alt > -5) {
      const f = e.rise ? clamp((e.date - e.rise) / dayLen, 0, 1) : 0.5;
      const sx = Math.round(W * (0.08 + 0.84 * f)), sy = Math.round(clamp(horizon - 6 - e.alt * 1.5, 8, horizon + 2));
      const core = e.alt < 6 ? [255, 214, 140] : [255, 246, 200];
      R.disk(sx, sy, 9, (x, y, nx, ny) => R.put(x, y, [255, 230, 170], 0.18 * (1 - e.grey)));
      R.disk(sx, sy, 5, (x, y) => R.put(x, y, core, 1 - e.grey * 0.7));
      s.sun = { x: sx, y: sy };
    }
    if (e.alt < 3) {
      const nightLen = 24 * 3600000 - dayLen;
      let since = e.set ? e.date - e.set : 0;
      if (since < 0) since += 24 * 3600000;
      const f = clamp(since / nightLen, 0, 1);
      const mx = Math.round(W * (0.12 + 0.76 * f)), my = Math.round(14 + (1 - Math.sin(Math.PI * f)) * 26);
      const ph = moonPhase(e.date), k = Math.cos(2 * Math.PI * ph), south = e.realm.hemisphere === 'south';
      R.disk(mx, my, 8, (x, y) => R.put(x, y, [220, 225, 255], 0.08 * e.dark));
      R.disk(mx, my, 5, (x, y, nx, ny) => {
        const xn = south ? -nx : nx, limb = Math.sqrt(Math.max(0, 1 - ny * ny));
        const lit = ph < 0.5 ? xn > k * limb : xn < -k * limb;
        R.put(x, y, lit ? [244, 238, 214] : mix(e.top, [60, 66, 100], 0.4), (lit ? 1 : 0.85) * clamp(e.dark * 1.4, 0.15, 1) * (1 - e.grey * 0.6));
      });
    }

    // far mountains
    const mr = rng(42), m1 = mr() * 10, m2 = mr() * 10, m3 = mr() * 10;
    const far = haze('#6f80b2', 0.45), farHi = haze('#8d9cc8', 0.4), farSnow = haze('#e8eef8', 0.35);
    for (let x = 0; x < W; x++) {
      const top = Math.round(50 + 7 * Math.sin(x * 0.029 + m1) + 5 * Math.sin(x * 0.071 + m2) + 2.5 * Math.sin(x * 0.19 + m3));
      const prevTop = Math.round(50 + 7 * Math.sin((x - 1) * 0.029 + m1) + 5 * Math.sin((x - 1) * 0.071 + m2) + 2.5 * Math.sin((x - 1) * 0.19 + m3));
      for (let y = top; y < 80; y++) R.put(x, y, far);
      if (top < prevTop) R.put(x, top, farHi);
      if (e.season === 'winter' && top < 46) R.put(x, top, farSnow);
    }
    // a lighter misty band at the mountain foot
    for (let y = 70; y < 80; y++) for (let x = 0; x < W; x++) if (BAYER[y & 3][x & 3] < (y - 68) * 1.4) R.put(x, y, mix(far, e.bot, 0.35));

    // rolling hills with distant woods
    const hill = haze(e.pal.hill, 0.2), hillDark = haze(e.pal.under[0], 0.25), hillLite = haze(e.pal.grass[1], 0.2);
    const hillTop = [];
    for (let x = 0; x < W; x++) {
      const top = Math.round(71 + 4 * Math.sin(x * 0.043 + 1.2) + 2.5 * Math.sin(x * 0.12 + 0.3));
      hillTop[x] = top;
      for (let y = top; y < 92; y++) R.put(x, y, (x + y) % 9 === 0 ? hillLite : hill);
    }
    for (let x = 2; x < W; x += 3 + Math.floor(rnd() * 6)) {
      const y = hillTop[x] + 1, tall = rnd() > 0.5;
      if (tall) { for (let j = 0; j < 5; j++) for (let i = -Math.floor(j / 2); i <= Math.floor(j / 2); i++) R.put(x + i, y - 5 + j, hillDark); R.put(x, y, haze('#4a3a2a', 0.3)); }
      else R.disk(x, y - 2, 2, (px, py, nx, ny) => R.put(px, py, ny < -0.2 && nx < 0.3 ? hill : hillDark));
    }

    // foreground meadow
    const [g0, g1, g2] = e.pal.grass.map(T);
    const gtop = (x) => Math.round(89 + 1.5 * Math.sin(x * 0.05) + Math.sin(x * 0.13));
    const nr = rng(99);
    for (let x = 0; x < W; x++) {
      const top = gtop(x);
      for (let y = top; y < H; y++) {
        const n = nr();
        R.put(x, y, y === top ? g1 : n < 0.08 ? g1 : n > 0.9 ? g2 : g0);
      }
      if (nr() < 0.35) R.put(x, top - 1, g1);
    }
    for (let i = 0; i < W * 0.6; i++) { const x = Math.floor(rnd() * W), y = 92 + Math.floor(rnd() * 28); R.put(x, y, e.pal.snowy ? T('#7a907a') : g1); R.put(x, y - 1, e.pal.snowy ? T('#93a88f') : g1); }

    // layout anchors
    // on a narrow screen the cottage shifts left so the quest board stays in frame
    const hx = Math.min(Math.max(78, Math.round(W * 0.55)), W - 104);
    const doorX = hx + 23;
    const pondX = Math.round(Math.min(W * 0.17, hx - 60)), treeX = Math.round(hx - 30), boardX = Math.min(hx + 72, W - 30);

    // path from the door
    const dirt = T(e.pal.snowy ? '#d9d6d2' : '#b89a6a'), dirtD = T(e.pal.snowy ? '#a9a39b' : '#8f7550'), dirtL = T(e.pal.snowy ? '#f4f6f8' : '#d2b88a');
    s.path = [];
    for (let y = 97; y < H; y++) {
      const k = y - 97, cx = doorX + Math.sin(k * 0.11) * 5 + k * 0.55, w = 3 + k * 0.3;
      s.path.push({ y, cx, w });
      for (let x = Math.round(cx - w); x <= Math.round(cx + w); x++) R.put(x, y, rnd() < 0.1 ? dirtD : rnd() < 0.08 ? dirtL : dirt);
      R.put(Math.round(cx - w) - 1, y, g2); R.put(Math.round(cx + w) + 1, y, g2);
    }
    const onPath = (x, y) => { const p = s.path[y - 97]; return p && Math.abs(x - p.cx) <= p.w + 2; };

    // pond with sky reflection
    const prx = 18, pry = 5, pcy = 103;
    s.pond = { x: pondX, y: pcy, rx: prx, ry: pry };
    for (let y = -pry - 1; y <= pry + 1; y++) for (let x = -prx - 2; x <= prx + 2; x++) {
      const d = (x * x) / (prx * prx) + (y * y) / (pry * pry);
      if (d <= 1) R.put(pondX + x, pcy + y, e.pal.snowy ? mix(T('#cfe3f2'), e.top, 0.15 + (y / pry) * 0.1) : mix(mix(e.bot, e.top, 0.55 + (y / pry) * 0.3), [30, 50, 70], 0.3));
      else if (d <= 1.35) R.put(pondX + x, pcy + y, T('#6a6250'));
    }
    if (e.pal.snowy) for (let i = 0; i < 4; i++) R.line(pondX - 10 + i * 6, pcy - 2, pondX - 7 + i * 6, pcy + 1, T('#f4fbff'));
    if (s.sun || e.alt < 3) {
      const refl = s.sun ? [255, 225, 160] : [230, 230, 250];
      for (let i = -3; i <= 3; i++) R.put(pondX + i * 2, pcy - 1 + (i & 1), refl, 0.4);
    }
    if (e.season === 'spring' || e.season === 'summer') for (const [lx, ly] of [[-9, 1], [6, -2], [11, 2]]) { R.rect(pondX + lx, pcy + ly, 3, 1, T('#3f8a3a')); R.put(pondX + lx + 1, pcy + ly - 1, T('#5aa84a')); if (e.season === 'summer') R.put(pondX + lx + 1, pcy + ly, T('#f7a8c8')); }
    for (const rx of [-prx - 1, -prx + 2, prx - 1, prx + 1]) for (let j = 0; j < 4 + (rx & 1) * 2; j++) R.put(pondX + rx, pcy - 1 - j, j > 3 ? T('#7a5a2a') : T('#3f7a35'));

    // flowers / seasonal ground detail
    const fl = e.pal.flowers.map(T);
    const blocked = (x, y) => onPath(x, y) || (Math.abs(x - pondX) < prx + 4 && Math.abs(y - pcy) < pry + 3) || (x > hx - 3 && x < hx + 49 && y < 100);
    const density = { spring: 2.6, summer: 0.9 }[e.season] ?? 0.5;
    const yellow = T('#f7d24a');
    for (let i = 0; i < W * density && fl.length; i++) {
      const x = Math.floor(rnd() * W), y = 93 + Math.floor(rnd() * 26), c = fl[i % fl.length];
      if (blocked(x, y)) continue;
      if (e.season === 'spring' && y > 98 && rnd() < 0.5) { // little plus-shaped blooms in the foreground
        R.put(x - 1, y, c); R.put(x + 1, y, c); R.put(x, y - 1, c); R.put(x, y + 1, c); R.put(x, y, yellow); R.put(x, y + 2, g2);
      } else { R.put(x, y, c); R.put(x, y + 1, g2); }
    }
    if (e.season === 'spring') {
      // wildflowers on the hills
      for (let i = 0; i < W * 0.9; i++) { const x = Math.floor(rnd() * W), y = hillTop[x] + 2 + Math.floor(rnd() * 12); R.put(x, y, mix(fl[i % fl.length], e.bot, 0.25)); }
      // tulip beds along the fence and in front of the cottage
      const tulips = ['#e8506a', '#f29ac0', '#f7d24a', '#ffffff', '#b49af0'].map(T);
      const bed = (x0, x1, y) => { for (let x = x0, k = 0; x <= x1; x += 2, k++) { R.put(x, y + 1, g2); R.put(x, y + 2, g2); R.put(x, y, tulips[k % 5]); R.put(x, y - 1, tulips[k % 5]); } };
      bed(hx - 26, hx - 4, 100); bed(hx, hx + 16, 99); bed(hx + 31, hx + 46, 99);
    }
    if (e.season === 'autumn') for (let i = 0; i < W * 0.4; i++) { const x = Math.floor(rnd() * W), y = 92 + Math.floor(rnd() * 28); if (!onPath(x, y)) R.put(x, y, T(e.pal.drift[i % 3])); }
    if (e.season === 'winter' && !e.pal.snowy && (e.morning || e.dark > 0.5)) for (let i = 0; i < W * 1.2; i++) R.put(Math.floor(rnd() * W), 90 + Math.floor(rnd() * 30), T('#dfe8ee'), 0.5);
    if (e.pal.snowy) {
      // holly bushes by the fence
      for (const bx of [hx - 30, hx - 8]) { R.disk(bx, 99, 3, (x, y, nx, ny) => R.put(x, y, ny < -0.4 ? T('#ffffff') : T('#2f5a3a'))); R.put(bx - 1, 99, T('#d0303a')); R.put(bx + 1, 100, T('#d0303a')); R.put(bx + 2, 98, T('#d0303a')); }
      // a snowman by the pond
      const sx = pondX + prx + 10;
      if (sx < treeX - 12) {
        R.disk(sx, 103, 4, (x, y, nx, ny) => R.put(x, y, nx > 0.4 && ny > 0 ? T('#c9d5e3') : T('#ffffff')));
        R.disk(sx, 96, 3, (x, y, nx, ny) => R.put(x, y, nx > 0.4 ? T('#c9d5e3') : T('#ffffff')));
        R.disk(sx, 91, 2, (x, y) => R.put(x, y, T('#ffffff')));
        R.put(sx - 1, 90, T('#2a2a2a')); R.put(sx + 1, 90, T('#2a2a2a')); R.put(sx + 1, 91, T('#f08a2a')); R.put(sx + 2, 91, T('#f08a2a'));
        R.rect(sx - 2, 93, 5, 1, T('#c0303a')); R.put(sx + 2, 94, T('#c0303a')); R.put(sx + 2, 95, T('#c0303a'));
        R.put(sx, 96, T('#2a2a2a')); R.put(sx, 98, T('#2a2a2a'));
        R.rect(sx - 2, 88, 5, 1, T('#2a2a2a')); R.rect(sx - 1, 86, 3, 2, T('#2a2a2a'));
      }
    }

    // big seasonal tree
    this.paintTree(R, T, e, treeX, 98, 14, rnd, s);
    // little pines filling wide screens
    for (const px of [boardX + 34, boardX + 62, boardX + 95, pondX - 32, pondX - 60].filter((x) => x > 4 && x < W - 4 && (x < pondX - prx - 8 || x > boardX + 26))) this.paintPine(R, T, e, px, 99 + (px % 3), 7 + (px % 4));

    // cottage
    this.paintHouse(R, T, e, hx, s, rnd);

    // fence
    const wood = T('#8a6a46'), woodD = T('#5e4630');
    for (let x = hx - 26; x <= hx - 4; x++) { R.put(x, 93, wood); R.put(x, 96, wood); R.put(x, 94, woodD); }
    for (let x = hx - 26; x <= hx - 4; x += 5) { R.rect(x, 91, 2, 9, wood); R.put(x + 1, 91, woodD); R.put(x, 99, woodD); }

    // lamp post
    const lx = doorX + 17;
    R.rect(lx, 86, 1, 16, T('#3a3030'));
    R.rect(lx - 1, 101, 3, 1, T('#3a3030'));
    R.rect(lx - 1, 82, 3, 4, e.dark > 0.3 ? [255, 214, 120] : T('#c8c0a0'));
    R.rect(lx - 2, 81, 5, 1, T('#3a3030'));
    s.lamp = { x: lx, y: 84 };

    // quest board
    const bw = 20;
    R.rect(boardX, 86, 2, 15, T('#6b4a2e')); R.rect(boardX + bw - 2, 86, 2, 15, T('#6b4a2e'));
    R.rect(boardX - 2, 81, bw + 4, 2, T('#4a2f1d'));
    R.rect(boardX - 1, 83, bw + 2, 12, T('#5e4630'));
    R.rect(boardX, 84, bw, 10, T('#8a6a46'));
    for (let x = boardX; x < boardX + bw; x += 4) R.put(x, 84 + (x % 3), T('#7a5a3a'));
    const n = Math.min(6, this.input.openQuests || 0);
    s.notes = [];
    for (let i = 0; i < n; i++) {
      const px = boardX + 2 + (i % 3) * 6, py = 85 + Math.floor(i / 3) * 4 + (i & 1);
      R.rect(px, py, 4, 4, T('#f3e2c0')); R.put(px + 1, py + 1, T('#9a8a70')); R.put(px + 2, py + 2, T('#9a8a70')); R.put(px + 3, py, T('#c0392b'));
      s.notes.push({ x: px, y: py, w: 4, h: 4 });
    }
    s.board = { x: boardX + bw / 2, y: 78, n, rect: { x: boardX - 2, y: 72, w: bw + 4, h: 30 } };

    // avatar + familiar, pre-tinted for the current light
    const hero = heroCanvases(this.input, this.avImg, T, e.amb, this.dpx);
    s.hero = { x: boardX - hero.w - 3, y: 101 - hero.h, w: hero.w, h: hero.h, hand: hero.hand };
    this.heroCv = hero.cvs; this.heroHi = hero.hi;
    if (this.input.avatar?.familiar !== false) {
      const pal = CAT.pal(this.input.avatar?.familiarColor || '#2a2230');
      this.catCv = CAT.frames.map((rows) => {
        const cv = document.createElement('canvas'); cv.width = 8; cv.height = 6;
        const g = cv.getContext('2d');
        rows.forEach((row, j) => { for (let i = 0; i < 8; i++) if (row[i] !== '.') { g.fillStyle = row[i] === 'y' ? pal.y : css(T(pal.k)); g.fillRect(i, j, 1, 1); } });
        return cv;
      });
      s.cat = { x: s.hero.x - 10, y: 95, w: 8, h: 6 };
    } else { this.catCv = null; s.cat = null; }
    s.ground = gtop;
    s.canopyY = 62; s.W = W;

    const ctx = this.bg.getContext('2d');
    this.bg.width = W; this.bg.height = H;
    ctx.putImageData(R.img, 0, 0);
    this.T = T; this.e = e;
  }

  paintTree(R, T, e, x0, base, r, rnd, s) {
    const bark = T('#5a3a24'), barkD = T('#3e2818'), barkL = T('#7a5234');
    for (let y = base - 30; y <= base; y++) { const w = y > base - 3 ? 4 : 2; for (let i = -w; i <= w; i++) R.put(x0 + i, y, i < 0 ? barkL : i > 0 ? barkD : bark); }
    R.line(x0, base - 18, x0 - 9, base - 27, bark); R.line(x0, base - 20, x0 + 10, base - 29, bark); R.line(x0 + 1, base - 26, x0 + 4, base - 36, bark);
    const [cd, cm, cl] = e.pal.canopy.map(T), [ud] = e.pal.under.map(T);
    const blobs = [[0, -36, r], [-11, -30, r - 4], [11, -31, r - 4], [-6, -44, r - 5], [7, -43, r - 5], [0, -27, r - 5]];
    const nr = rng(5);
    for (const [bx, by, br] of blobs) {
      R.disk(x0 + bx, base + by, br, (x, y, nx, ny) => {
        const n = nr();
        const light = -nx * 0.6 - ny * 0.8 + (n - 0.5) * 0.7;
        const c = light > 0.45 ? cl : light > -0.25 ? cm : cd;
        if (e.pal.snowy && n < 0.07 && ny > 0.1) { R.put(x, y, T('#4a3424')); return; } // branches peeking through the snow
        R.put(x, y, e.season === 'spring' && n < 0.12 ? ud : c);
      });
    }
    // shadow pool under the tree
    for (let i = -14; i <= 14; i++) for (let j = 0; j < 3; j++) if ((i + j) % 2 === 0) R.put(x0 + i, base + 1 + j, [0, 0, 0], 0.12);
    s.tree = { x: x0, y: base - 36, r: r + 6 };
    s.lights = [];
    if (e.pal.snowy) {
      // fairy lights draped in loops across the canopy
      for (const [cy, amp, w] of [[-44, 3, 12], [-36, 4, 18], [-28, 3, 16]]) for (let i = -w; i <= w; i += 3) s.lights.push({ x: x0 + i, y: base + cy + Math.round(Math.cos((i / w) * Math.PI) * -amp) + amp, p: (i + cy) * 0.7 });
    }
  }

  paintPine(R, T, e, x0, base, h) {
    const d = T(e.season === 'winter' ? '#2e5040' : '#2c5a36'), m = T(e.season === 'winter' ? '#3e6650' : '#3d7444');
    for (let j = 0; j < h + 4; j++) { const w = Math.floor((j % 4) + j / 2.4); for (let i = -w; i <= w; i++) R.put(x0 + i, base - h - 4 + j, e.pal.snowy && j % 4 === 0 ? T(i < 0 ? '#ffffff' : '#dfe8f2') : i < 0 ? m : d); }
    R.rect(x0, base, 1, 2, T('#4a3020'));
    if (e.season === 'winter' && e.realm.climate === 'temperate') R.put(x0, base - h - 4, T('#e8eef4'));
  }

  paintHouse(R, T, e, hx, s, rnd) {
    const plaster = T('#e6d4b0'), plasterD = T('#cdb994'), beam = T('#6b4a2e'), beamD = T('#4a3020');
    const stone = T('#8d8478'), stoneD = T('#6a6258'), stoneL = T('#a8a092');
    // shadow
    for (let y = 90; y < 99; y++) for (let x = hx + 46; x < hx + 54 + (y - 90); x++) if ((x + y) & 1) R.put(x, y, [0, 0, 0], 0.18);
    // walls
    R.rect(hx, 74, 46, 20, plaster);
    for (let y = 74; y < 94; y++) for (let x = hx; x < hx + 46; x++) if (rnd() < 0.06) R.put(x, y, plasterD);
    for (const bx of [hx, hx + 15, hx + 30, hx + 44]) R.rect(bx, 74, 2, 20, beam);
    R.rect(hx, 74, 46, 1, beamD); R.rect(hx, 85, 46, 1, beam);
    R.line(hx + 2, 85, hx + 7, 75, beam);
    // foundation
    for (let y = 93; y < 98; y++) for (let x = hx - 1; x < hx + 47; x++) R.put(x, y, ((x + (y & 1) * 3) % 6 === 0 || y === 95) ? stoneD : rnd() < 0.2 ? stoneL : stone);
    // chimney (behind roof top)
    R.rect(hx + 32, 50, 7, 14, stone);
    for (let y = 51; y < 64; y += 3) R.rect(hx + 32, y, 7, 1, stoneD);
    R.rect(hx + 31, 49, 9, 2, stoneD);
    s.chimney = { x: hx + 35, y: 47 };
    // roof
    const sh = [T('#9a4a36'), T('#b35a42'), T('#7e3a2a')];
    for (let r = 0; r <= 16; r++) {
      const y = 58 + r, l = Math.round(hx + 6 - r * 0.72), rr = Math.round(hx + 40 + r * 0.72);
      for (let x = l; x <= rr; x++) {
        const row = Math.floor(r / 3), off = (row & 1) * 2, edge = (x + off) % 4 === 0 || r % 3 === 2;
        let c = edge ? sh[2] : r % 3 === 0 ? sh[1] : sh[0];
        if (x === l || x === rr) c = sh[2];
        R.put(x, y, c);
        if (e.season === 'winter' && (r === 0 || (e.pal.snowy && (r < 3 || (r === 3 && (x * 7) % 5 === 0))))) R.put(x, y, T(r === 0 || r === 1 ? '#ffffff' : '#e3ebf3'));
        if (e.season === 'autumn' && rnd() < 0.03) R.put(x, y, T('#e08a2a'));
      }
    }
    R.rect(hx + 5, 57, 37, 1, T(e.pal.snowy ? '#ffffff' : '#5a2a1e'));
    if (e.pal.snowy) { R.rect(hx + 31, 48, 9, 1, T('#ffffff')); for (let x = hx - 4; x <= hx + 50; x += 3) s.lights.push({ x, y: 75 + ((x - hx) % 2), p: x * 0.9 }); }
    // attic window
    const lit = e.dark > 0.3;
    const glass = lit ? [255, 205, 110] : T('#8fbcdc'), glassL = lit ? [255, 236, 170] : T('#d4ecf7');
    R.disk(hx + 23, 65, 2, (x, y) => R.put(x, y, glass)); R.put(hx + 22, 64, glassL);
    R.rect(hx + 21, 65, 5, 1, beamD); R.rect(hx + 23, 63, 1, 5, beamD);
    // windows
    s.windows = [];
    for (const wx of [hx + 4, hx + 34]) {
      R.rect(wx - 1, 76, 10, 9, beamD);
      R.rect(wx, 77, 8, 7, glass);
      R.put(wx + 1, 78, glassL); R.put(wx + 2, 78, glassL); R.put(wx + 1, 79, glassL);
      R.rect(wx + 4, 77, 1, 7, beamD); R.rect(wx, 80, 8, 1, beamD);
      R.rect(wx - 1, 85, 10, 2, T('#6b4a2e'));
      const fc = e.pal.flowers.length ? e.pal.flowers : ['#3e6b46'];
      for (let i = 0; i < 8; i += 2) { R.put(wx + i, 84, T(fc[(i / 2) % fc.length])); R.put(wx + i + 1, 84, T('#3f7a35')); }
      s.windows.push({ x: wx + 4, y: 80 });
    }
    // door with arched top
    const dx = hx + 19;
    R.rect(dx - 1, 81, 11, 17, beamD);
    for (let y = 82; y < 98; y++) for (let x = dx; x < dx + 9; x++) {
      if (y === 82 && (x === dx || x === dx + 8)) continue;
      R.put(x, y, (x - dx) % 3 === 0 ? T('#5e3a20') : T('#7a4a2a'));
    }
    R.put(dx + 6, 90, T('#e0c060'));
    R.rect(dx - 2, 97, 13, 1, stoneL);
    // little lantern by the door
    R.rect(dx + 11, 80, 2, 3, lit ? [255, 214, 120] : T('#c8c0a0')); R.put(dx + 11, 79, beamD); R.put(dx + 12, 79, beamD);
    s.doorLamp = { x: dx + 12, y: 81 };
    // autumn pumpkins / spring pot
    if (e.season === 'autumn') for (const px of [hx - 3, hx + 48]) { R.rect(px, 96, 4, 3, T('#e07a20')); R.put(px + 1, 96, T('#c0601a')); R.put(px + 2, 95, T('#3f7a35')); }
  }

  // ---------- animated layer ---------------------------------------------
  drawDynamic(e, dt) {
    const c = this.ctx, W = this.W, s = this.spots, t = this.t;
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
    c.drawImage(this.bg, 0, 0);

    // twinkling stars
    for (const st of s.stars) {
      const a = (0.5 + 0.5 * Math.sin(t * 2.2 + st.p)) * e.dark * (1 - e.grey);
      if (a < 0.1) continue;
      c.fillStyle = `rgba(255,250,225,${a})`;
      c.fillRect(st.x, st.y, 1, 1);
      if (a > 0.75) { c.fillStyle = `rgba(255,250,225,${a * 0.5})`; c.fillRect(st.x - 1, st.y, 3, 1); c.fillRect(st.x, st.y - 1, 1, 3); }
    }

    this.drawClouds(e, dt);

    // fog / mist bands
    if (e.weather === 'fog' || (e.season === 'winter' && e.morning && e.alt < 15)) {
      for (let i = 0; i < 4; i++) {
        const y = 78 + i * 9, off = (t * (3 + i) + i * 40) % (W + 80) - 40;
        c.fillStyle = css(mix(e.bot, [230, 230, 235], 0.5), e.weather === 'fog' ? 0.28 : 0.14);
        c.fillRect(Math.round(off), y, 70, 3); c.fillRect(Math.round(off) - 120, y + 2, 90, 2);
      }
    }

    // warm light at night
    if (e.dark > 0.3) {
      c.globalCompositeOperation = 'lighter';
      const fl = 0.85 + 0.15 * Math.sin(t * 9) * Math.sin(t * 3.3);
      const glow = (x, y, r, a) => {
        const g = c.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(255,190,90,${a * fl})`); g.addColorStop(1, 'rgba(255,170,60,0)');
        c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
      };
      for (const w of s.windows) glow(w.x, w.y, 13, 0.35 * e.dark);
      glow(s.lamp.x, s.lamp.y, 16, 0.45 * e.dark);
      glow(s.doorLamp.x, s.doorLamp.y, 7, 0.4 * e.dark);
      glow(s.hero.x + s.hero.hand[0] + 1, s.hero.y + s.hero.hand[1] + 1, 7, 0.4 * e.dark);
      c.globalCompositeOperation = 'source-over';
      // light spill from windows onto the grass
      c.fillStyle = `rgba(255,200,110,${0.12 * e.dark})`;
      for (const w of s.windows) { c.fillRect(w.x - 4, 99, 9, 2); c.fillRect(w.x - 5, 101, 11, 2); }
    }

    // fairy lights (snowy winter)
    if (s.lights?.length) {
      const cols = ['255,214,122', '255,154,122', '255,242,176', '170,220,255'];
      for (const [k, l] of s.lights.entries()) {
        const a = 0.55 + 0.45 * Math.sin(t * 2.5 + l.p);
        c.fillStyle = `rgba(${cols[k % 4]},${a})`; c.fillRect(l.x, l.y, 1, 1);
        if (e.dark > 0.3) { c.fillStyle = `rgba(${cols[k % 4]},${a * 0.25 * e.dark})`; c.fillRect(l.x - 1, l.y - 1, 3, 3); }
      }
    }

    this.drawSmoke(e, dt);

    // pond shimmer
    const p = s.pond;
    for (let i = 0; i < 5; i++) {
      const x = p.x - p.rx + 3 + ((i * 7 + Math.floor(t * 4)) % (p.rx * 2 - 6)), y = p.y - 2 + ((i * 3) % 5);
      c.fillStyle = `rgba(255,255,255,${0.25 + 0.15 * Math.sin(t * 3 + i)})`;
      c.fillRect(x, y, 2, 1);
    }

    this.drawParticles(e, dt);

    // hero, idling by the quest board (with a lantern after dark), and the familiar
    const bob = Math.floor(t * 1.6) % 2;
    const hcv = this.heroCv[Math.floor(t * 10) % 37 === 0 ? 1 : 0];
    const h = s.hero, legs = Math.min(4, Math.floor(h.h / 6));
    if (this.heroHi) this.blitHero(c, hcv, h.x, h.y + bob);
    else {
      c.drawImage(hcv, 0, 0, h.w, h.h - legs, h.x, h.y + bob, h.w, h.h - legs);
      c.drawImage(hcv, 0, h.h - legs, h.w, legs, h.x, h.y + h.h - legs, h.w, legs);
    }
    if (this.hover?.type === 'hero') { c.fillStyle = 'rgba(255,230,140,0.25)'; c.fillRect(h.x - 1, h.y - 1 + bob, h.w + 2, h.h + 2); }
    if (e.dark > 0.3) { const [lx, ly] = h.hand; c.fillStyle = '#5a3c24'; c.fillRect(h.x + lx, h.y + ly - 1 + bob, 2, 1); c.fillStyle = '#ffd27a'; c.fillRect(h.x + lx, h.y + ly + bob, 2, 2); }
    if (this.catCv && s.cat) {
      const hop = this.catHop > 0 ? Math.round(Math.sin((1 - this.catHop) * Math.PI) * 4) : 0;
      if (this.catHop > 0) this.catHop -= 0.08;
      c.drawImage(this.catCv[Math.floor(t * 1.3) % 2], s.cat.x, s.cat.y - hop);
      if (hop) { c.fillStyle = '#f06a8a'; c.fillRect(s.cat.x + 3, s.cat.y - hop - 4, 1, 1); c.fillRect(s.cat.x + 5, s.cat.y - hop - 4, 1, 1); c.fillRect(s.cat.x + 3, s.cat.y - hop - 3, 3, 1); c.fillRect(s.cat.x + 4, s.cat.y - hop - 2, 1, 1); }
    }

    // hover highlight on the board / a note
    if (this.hover?.type === 'board' || this.hover?.type === 'note') {
      const r = s.board.rect;
      c.strokeStyle = 'rgba(255,214,90,0.9)'; c.lineWidth = 1;
      c.strokeRect(r.x + 0.5, r.y + 9.5, r.w - 1, r.h - 10);
      if (this.hover.type === 'note') { const nt = s.notes[this.hover.index]; c.fillStyle = 'rgba(255,240,170,0.6)'; c.fillRect(nt.x - 1, nt.y - 1, nt.w + 2, nt.h + 2); }
    }

    // "!" over the board when quests await
    if (s.board.n > 0) {
      const y = s.board.y - 6 + Math.round(Math.sin(t * 4));
      c.fillStyle = '#4a2f1d'; c.fillRect(s.board.x - 2, y - 1, 4, 8);
      c.fillStyle = '#ffd23f'; c.fillRect(s.board.x - 1, y, 2, 4); c.fillRect(s.board.x - 1, y + 5, 2, 1);
    }

    if (e.wet || e.weather === 'snow' || e.pal.snowy) this.drawRain(e, dt);
    if (e.weather === 'storm' && Math.random() < 0.006) { c.fillStyle = 'rgba(255,255,255,0.5)'; c.fillRect(0, 0, W, H); }
  }

  loadAvatarImage() {
    const src = this.input.avatar?.image;
    if (!src) { this.avImg = null; return; }
    if (this.avImg?.src === src) return;
    const img = new Image();
    this.avImg = { src, img, ok: false };
    img.onload = () => { if (this.avImg?.img === img) { this.avImg.ok = true; this.key = ''; } };
    img.src = src;
  }

  // Logical-pixel hit test for clicks and hover on the scene.
  hitTest(clientX, clientY) {
    const s = this.spots; if (!s) return null;
    const r = this.cv.getBoundingClientRect();
    const x = (clientX - r.left) / this.scale, y = (clientY - r.top) / this.scale;
    const inR = (o, pad = 1) => o && x >= o.x - pad && x < o.x + o.w + pad && y >= o.y - pad && y < o.y + o.h + pad;
    const ni = s.notes.findIndex((n) => inR(n, 0.5));
    if (ni >= 0) return { type: 'note', index: ni };
    if (inR(s.board.rect)) return { type: 'board' };
    if (inR(s.cat, 2)) return { type: 'cat' };
    if (inR(s.hero)) return { type: 'hero' };
    return null;
  }

  petCat() { this.catHop = 1; }

  // hearts and sparkles rising when a quest is marked done (or logged)
  drawCelebration(dt) {
    if (this.input.celebrate) {
      this.cel = (this.cel || 0) + dt;
      for (let i = 0; i < 18; i++) {
        const p = ((this.cel * 0.5 + i / 18) % 1), x = Math.round(((i * 41) % this.W) + Math.sin(p * 6 + i) * 4), y = Math.round(H - 10 - p * 100);
        const col = ['#ffd23f', '#f06a8a', '#ffffff', '#9ae0a0'][i % 4];
        this.ctx.globalAlpha = 1 - p; this.ctx.fillStyle = col;
        if (i % 3 === 0) { this.ctx.fillRect(x, y, 1, 1); this.ctx.fillRect(x + 2, y, 1, 1); this.ctx.fillRect(x, y + 1, 3, 1); this.ctx.fillRect(x + 1, y + 2, 1, 1); }
        else { this.ctx.fillRect(x, y, 1, 1); this.ctx.fillRect(x - 1, y, 3, 1); this.ctx.fillRect(x, y - 1, 1, 3); }
      }
      this.ctx.globalAlpha = 1;
    } else this.cel = 0;
  }


  drawClouds(e, dt) {
    const c = this.ctx, W = this.W;
    const count = { clear: 2, partly: 5, cloudy: 9, fog: 6, rain: 10, storm: 11, snow: 9 }[e.weather] ?? 3;
    const sig = `${count}|${W}|${Math.round(e.alt)}|${e.weather}`;
    if (!this.clouds || this.cloudSig !== sig) {
      const keep = this.clouds?.map((k) => k.x) || [];
      const r = rng(21);
      const dark = e.wet || e.weather === 'storm';
      const lit = mix(dark ? [150, 156, 168] : [255, 255, 255], e.bot, 0.3).map((v, i) => clamp(v * (0.35 + 0.65 * Math.max(e.amb[i], 0.3)), 0, 255));
      const shade = mix(lit, e.top, 0.35);
      this.clouds = Array.from({ length: count }, (_, i) => {
        const w = 18 + Math.floor(r() * 26), h = 10;
        const cv = document.createElement('canvas'); cv.width = w + 8; cv.height = h + 6;
        const g = cv.getContext('2d');
        const puffs = 3 + Math.floor(r() * 3);
        for (let k = 0; k < puffs; k++) {
          const px = 4 + Math.floor((k / (puffs - 1)) * (w - 4)), py = 8 - Math.floor(r() * 4) - (k > 0 && k < puffs - 1 ? 2 : 0), pr = 3 + Math.floor(r() * 3);
          for (let y = -pr; y <= pr; y++) for (let x = -pr; x <= pr; x++) if (x * x + y * y <= pr * pr) { g.fillStyle = css(y > pr * 0.3 ? shade : lit, 1); g.fillRect(px + x, py + y, 1, 1); }
        }
        g.fillStyle = css(shade); g.fillRect(3, h + 1, w - 2, 2);
        return { cv, x: keep[i] ?? r() * W, y: 6 + Math.floor(r() * 34), v: 1.5 + r() * 2.5, a: e.dark > 0.5 && !dark ? 0.5 : 0.92 };
      });
      this.cloudSig = sig;
    }
    for (const k of this.clouds) {
      k.x += k.v * dt;
      if (k.x > W + 10) k.x = -k.cv.width - 10;
      c.globalAlpha = k.a;
      c.drawImage(k.cv, Math.round(k.x), k.y);
    }
    c.globalAlpha = 1;
  }

  drawSmoke(e, dt) {
    const c = this.ctx, ch = this.spots.chimney;
    const rate = e.season === 'winter' || e.season === 'autumn' || e.dark > 0.4 ? 0.35 : e.season === 'summer' ? 1.6 : 0.8;
    this.smokeT = (this.smokeT || 0) + dt;
    if (this.smokeT > rate) { this.smokeT = 0; this.smoke.push({ x: ch.x, y: ch.y, age: 0, r: 1 }); }
    const col = mix([210, 210, 215], e.top, 0.35 + e.dark * 0.3);
    this.smoke = this.smoke.filter((p) => p.age < 4.5);
    for (const p of this.smoke) {
      p.age += dt; p.y -= 4 * dt; p.x += (1.5 + Math.sin(p.age * 2) * 1.2) * dt;
      const r = 1 + Math.floor(p.age * 0.7);
      c.fillStyle = css(col, Math.max(0, 0.55 - p.age * 0.12));
      c.fillRect(Math.round(p.x - r / 2), Math.round(p.y), r, r);
    }
  }

  drawParticles(e, dt) {
    const c = this.ctx, W = this.W, s = this.spots, t = this.t;
    const tree = s.tree;
    // spawn
    const drift = e.pal.drift;
    if ((e.season === 'spring' || e.season === 'autumn') && drift.length && this.parts.length < 26 && Math.random() < (e.wet ? 0.1 : 0.35)) {
      const fromTree = Math.random() < 0.7;
      this.parts.push({ kind: 'drift', x: fromTree ? tree.x + (Math.random() - 0.5) * tree.r * 2 : Math.random() * W, y: fromTree ? tree.y + Math.random() * 10 : -2, vx: 2 + Math.random() * 4, vy: 4 + Math.random() * 4, col: drift[Math.floor(Math.random() * drift.length)], ph: Math.random() * 6 });
    }
    if (e.season === 'summer' && !e.wet) {
      const want = e.dark > 0.4 ? 14 : 3;
      while (this.flies.length < want) this.flies.push({ x: Math.random() * W, y: 82 + Math.random() * 30, ph: Math.random() * 10, night: e.dark > 0.4 });
      if (this.flies.length > want) this.flies.length = want;
    } else this.flies.length = 0;

    this.parts = this.parts.filter((p) => p.y < s.ground(Math.round(p.x)) + 3 && p.x < W + 4);
    for (const p of this.parts) {
      p.x += (p.vx + Math.sin(t * 2 + p.ph) * 4) * dt; p.y += p.vy * dt;
      c.fillStyle = css(this.T(p.col));
      c.fillRect(Math.round(p.x), Math.round(p.y), Math.sin(t * 5 + p.ph) > 0 ? 2 : 1, 1);
    }
    for (const f of this.flies) {
      f.x += Math.sin(t * 0.7 + f.ph) * 6 * dt; f.y += Math.cos(t * 0.9 + f.ph * 1.3) * 3 * dt;
      if (f.night) {
        const a = 0.5 + 0.5 * Math.sin(t * 3 + f.ph);
        c.fillStyle = `rgba(220,255,120,${a})`; c.fillRect(Math.round(f.x), Math.round(f.y), 1, 1);
        if (a > 0.7) { c.fillStyle = `rgba(220,255,120,${a * 0.25})`; c.fillRect(Math.round(f.x) - 1, Math.round(f.y) - 1, 3, 3); }
      } else {
        const flap = Math.floor(t * 8 + f.ph) % 2;
        c.fillStyle = css(this.T(['#ffffff', '#f2c14a', '#f29ac0'][Math.floor(f.ph) % 3]));
        c.fillRect(Math.round(f.x) - (flap ? 1 : 0), Math.round(f.y), flap ? 3 : 1, 1); c.fillRect(Math.round(f.x), Math.round(f.y) + 1, 1, 1);
      }
    }
  }

  drawRain(e, dt) {
    const c = this.ctx, W = this.W;
    if (!this.drops) this.drops = Array.from({ length: 90 }, () => ({ x: Math.random() * W, y: Math.random() * H, v: 70 + Math.random() * 40 }));
    const snow = e.weather === 'snow' || (e.pal.snowy && !e.wet);
    const count = snow && e.weather !== 'snow' ? 45 : 90;
    c.fillStyle = snow ? 'rgba(245,248,255,0.85)' : css(mix([170, 190, 215], e.top, 0.3), 0.6);
    for (const d of this.drops.slice(0, count)) {
      d.y += (snow ? 12 : d.v) * dt; d.x += (snow ? Math.sin(this.t + d.v) * 4 : -10) * dt;
      if (d.y > H) { d.y = -4; d.x = Math.random() * (W + 20); }
      if (d.x < -2) d.x += W;
      if (snow) c.fillRect(Math.round(d.x), Math.round(d.y), 1, 1);
      else { c.fillRect(Math.round(d.x), Math.round(d.y), 1, 3); if (d.y > 112 && Math.random() < 0.1) c.fillRect(Math.round(d.x) - 1, Math.round(d.y), 3, 1); }
    }
  }
}

// shared with the study room
export { H, BAYER, hx2, mix, css, clamp, rng, frame, SKY, AMB, palette, Raster, heroCanvases };
