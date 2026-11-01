// Outing scenes: shown while you are out on a training, fellowship, wilds or homestead quest.
// Training grounds by the river, the wild woods, the Lantern Tavern, and the cottage kitchen.
// Each follows the real sky, season and weather like the meadow does.
import { Scene, H, BAYER, hx2, mix, css, clamp, rng, Raster, heroCanvases } from './scene.js';
import { StudyScene } from './study.js';
import { CAT } from './sprites.js';

// ping-pong along [x0, x1] at `speed` px/s -> [x, direction]
const pingPong = (t, speed, x0, x1) => {
  const span = Math.max(1, x1 - x0), d = (t * speed) % (2 * span);
  return d < span ? [x0 + d, 1] : [x1 - (d - span), -1];
};

// dithered sky in a box (optionally clipped to a window shape), with stars, sun or moon
function paintSky(R, e, x0, y0, x1, y1, clip = null) {
  const N = 12, steps = Array.from({ length: N }, (_, i) => mix(e.top, e.bot, i / (N - 1)));
  const inside = (x, y) => !clip || clip(x, y);
  for (let y = y0; y < y1; y++) {
    const v = clamp((y - y0) / (y1 - y0), 0, 1) ** 1.2 * (N - 1), lo = Math.floor(v), fr = v - lo;
    for (let x = x0; x < x1; x++) if (inside(x, y)) R.put(x, y, steps[Math.min(N - 1, fr * 16 > BAYER[y & 3][x & 3] ? lo + 1 : lo)]);
  }
  const dark = e.dark;
  if (dark > 0.1) {
    const sr = rng(7);
    for (let i = 0; i < (x1 - x0) * (y1 - y0) * 0.012; i++) {
      const x = x0 + Math.floor(sr() * (x1 - x0)), y = y0 + Math.floor(sr() * (y1 - y0) * 0.75);
      if (inside(x, y)) R.put(x, y, [255, 250, 230], dark * (0.3 + sr() * 0.6) * (1 - e.grey));
    }
  }
  if (e.alt > -3 && !e.grey) {
    const sx = Math.round(x0 + (x1 - x0) * 0.78), sy = Math.round(clamp(y1 - 8 - e.alt * 1.1, y0 + 6, y1 - 4));
    R.disk(sx, sy, 7, (x, y) => inside(x, y) && R.put(x, y, [255, 230, 170], 0.18));
    R.disk(sx, sy, 4, (x, y) => inside(x, y) && R.put(x, y, e.alt < 6 ? [255, 214, 140] : [255, 246, 200]));
  } else if (dark > 0.5) {
    const mx = Math.round(x0 + (x1 - x0) * 0.22), my = y0 + 9;
    R.disk(mx, my, 3, (x, y, nx) => inside(x, y) && R.put(x, y, nx > 0.35 ? mix(e.top, [60, 66, 100], 0.4) : [244, 238, 214], (1 - e.grey * 0.6)));
  }
}

// a rectangular cottage window onto the real sky, with hills and a sill
function paintWindow(R, T, e, x0, y0, w, h) {
  const x1 = x0 + w, y1 = y0 + h;
  paintSky(R, e, x0, y0, x1, y1);
  const hill = mix(hx2(e.pal.snowy ? '#e6edf4' : e.pal.hill), e.bot, 0.35).map((v) => v * clamp((e.day ?? 1 - e.dark) + 0.25, 0.3, 1));
  for (let x = x0; x < x1; x++) for (let y = Math.round(y1 - h * 0.25 + 2 * Math.sin(x * 0.2)); y < y1; y++) R.put(x, y, hill);
  const fr = T('#5a3a22');
  R.rect(x0 - 2, y0 - 2, w + 4, 2, fr); R.rect(x0 - 2, y1, w + 4, 2, fr);
  R.rect(x0 - 2, y0, 2, h, fr); R.rect(x1, y0, 2, h, fr);
  R.rect(x0 + Math.floor(w / 2), y0, 1, h, fr); R.rect(x0, y0 + Math.floor(h / 2), w, 1, fr);
  R.rect(x0 - 4, y1 + 2, w + 8, 2, T('#7a4a2a')); R.rect(x0 - 4, y1 + 2, w + 8, 1, T('#9a6a3a'));
  if (e.pal.snowy) R.rect(x0, y1 - 1, w, 1, [240, 246, 252]);
  return { x0, y0, x1, y1 };
}

function catCanvases(T, fur) {
  const pal = CAT.pal(fur);
  return CAT.frames.map((rows) => {
    const cv = document.createElement('canvas'); cv.width = 8; cv.height = 6;
    const g = cv.getContext('2d');
    rows.forEach((row, j) => { for (let i = 0; i < 8; i++) if (row[i] !== '.') { g.fillStyle = row[i] === 'y' ? pal.y : css(T(pal.k)); g.fillRect(i, j, 1, 1); } });
    return cv;
  });
}

function tree(R, T, pal, x, base, r, rnd) {
  R.rect(x - 1, base - r - 4, 3, r + 4, T('#5a3c24')); R.put(x + 1, base - r, T('#3e2818'));
  const cols = pal.canopy.map(T);
  R.disk(x, base - r - 6, r, (px, py, nx, ny) => { const n = rnd(); R.put(px, py, ny < -0.3 && nx < 0.2 ? cols[2] : n < 0.15 ? cols[0] : ny > 0.4 ? cols[0] : cols[1]); });
  if (pal.snowy) R.disk(x, base - r - 6, r, (px, py, nx, ny) => ny < -0.35 && rnd() < 0.8 && R.put(px, py, [250, 252, 255]));
}


// a little pixel sprite: rows of palette keys ('.' is clear), pre-tinted for the light
function sprite(T, rows, pal) {
  const cv = document.createElement('canvas'); cv.width = rows[0].length; cv.height = rows.length;
  const g = cv.getContext('2d');
  rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] !== '.' && pal[row[i]]) { g.fillStyle = css(T(pal[row[i]])); g.fillRect(i, j, 1, 1); } });
  return cv;
}

const BEAR = [
  '.bb........bb.',
  'bppb......bppb',
  'bppbbbbbbbbppb',
  '.bbbbbbbbbbbb.',
  'bbbbbbbbbbbbbb',
  'bbbkbbbbbbkbbb',
  'bbbbbmmmmbbbbb',
  'bbpbmmnnmmbpbb',
  'bbbbmmmmmmbbbb',
  '.bbbbbmmbbbbb.',
  '..cccccccccc..',
  '.bbbbBBBBbbbb.',
  'bbbbBBBBBBbbbb',
  'bbbBBBBBBBBbbb',
  'bbbBBBBBBBBbbb',
  'bbbbBBBBBBbbbb',
];
const BEAR_CHEER = BEAR.map((r, i) => (i === 5 ? 'bbbbbbbbbbbbbb' : i === 4 ? 'bbkbkbbbbkbkbb' : i === 9 ? '.bbbbmrrmbbbb.' : r));
function bearFrames(T, fur, muzzle, scarf) {
  const pal = { b: fur, p: '#d89a8a', k: '#1a120c', m: muzzle, n: '#2a1a14', B: muzzle, c: scarf, r: '#a03040' };
  return [sprite(T, BEAR, pal), sprite(T, BEAR_CHEER, pal)];
}

const MILK = ['.bbb.', '.www.', '.www.', 'wwwww', 'wwwww', 'wbbbw', 'wbwbw', 'wwwww', '.www.'];
const FLOUR = ['..t..t..', '...tt...', '.ssssss.', 'ssssssss', 'ssFFFFss', 'ssFssFss', 'ssFFsFss', 'ssssssss', '.ssssss.'];
const EGG = ['.ee.', 'eeeE', 'eeeE', 'eeeE', '.eE.'];
const BOWL = ['kkkkkkkkkkkkkk', '.KKKKKKKKKKKK.', '.KKwKKKKKKKKK.', '..KKKKKKKKKK..', '...KKKKKKKK...', '....kkkkkk....'];
const CAKE = [
  '.......g........',
  '..oo..goo...oo..',
  '..oh.c.oh.c.oh..',
  '.FFFFFFFFFFFFFF.',
  '.FFFFFFFFFFFFFF.',
  '.FsFsssFssssFsF.',
  '.Fsssssssssssss.',
  '.ssssssssssssss.',
  '.cccccccccccccc.',
  '.ssssssssssssss.',
  '.ssssssssssssss.',
  '.SSSSSSSSSSSSSS.',
  'pppppppppppppppp',
  '......PPPP......',
  '.....PPPPPP.....',
];

const KINDS = {
  // ---- training grounds by the river ------------------------------------
  training: {
    outdoor: true, clouds: true,
    build(R, T, e, W, s, rnd) {
      paintSky(R, e, 0, 0, W, 82);
      // city skyline across the river
      const sky = (h, t) => mix(T(h), e.bot, t);
      const far = sky('#5a6888', 0.45), farD = sky('#46526e', 0.4);
      s.windows = [];
      const taipei = e.realm.id === 'taipei';
      for (let x = Math.round(W * 0.35), i = 0; x < W * 0.92; i++) {
        const w = 5 + Math.floor(rnd() * 7), h = 8 + Math.floor(rnd() * 16);
        R.rect(x, 80 - h, w, h, i % 2 ? far : farD);
        for (let yy = 82 - h; yy < 78; yy += 3) for (let xx = x + 1; xx < x + w - 1; xx += 2) if (rnd() < 0.35) s.windows.push({ x: xx, y: yy });
        x += w + (rnd() < 0.3 ? 2 : 0);
      }
      const tx = Math.round(W * 0.62);
      if (taipei) for (let k = 0; k < 8; k++) R.rect(tx - 4 + (k % 2), 76 - 6 - k * 5, 9 - (k % 2) * 2, 5, k % 2 ? far : farD), R.rect(tx, 30, 1, 6, farD);
      else { R.rect(tx, 44, 6, 36, farD); R.rect(tx + 1, 40, 4, 4, far); R.rect(tx + 2, 36, 1, 4, farD); }
      // far bank trees
      for (let x = 0; x < W; x += 4 + Math.floor(rnd() * 4)) R.disk(x, 80, 2 + Math.floor(rnd() * 2), (px, py) => R.put(px, py, sky(e.pal.under[0], 0.3)));
      // the river
      const water = mix(mix(e.bot, [60, 110, 150], 0.45), [0, 0, 0], 0.08);
      for (let y = 81; y < 90; y++) for (let x = 0; x < W; x++) R.put(x, y, (x * 3 + y * 7) % 23 === 0 ? mix(water, [255, 255, 255], 0.25) : water);
      s.river = { y0: 82, y1: 89 };
      // near bank, grass and the running track
      const [g0, g1, g2] = e.pal.grass.map(T);
      for (let y = 90; y < H; y++) for (let x = 0; x < W; x++) { const n = rnd(); R.put(x, y, y === 90 ? g1 : n < 0.08 ? g1 : n > 0.92 ? g2 : g0); }
      const track = T('#b8643a'), trackD = T('#9a4e2e'), line = T('#f3e2c0');
      for (let y = 101; y < 111; y++) for (let x = 0; x < W; x++) R.put(x, y, y === 101 || y === 110 ? trackD : (y === 105 || y === 106) && x % 8 < 4 ? line : rnd() < 0.06 ? trackD : track);
      s.track = 108;
      // flowers in the grass, or snow
      const fl = e.pal.flowers;
      for (let i = 0; i < W * 0.5; i++) { const x = Math.floor(rnd() * W), y = rnd() < 0.5 ? 92 + Math.floor(rnd() * 8) : 112 + Math.floor(rnd() * 7); if (fl.length && rnd() < 0.6) R.put(x, y, T(fl[i % fl.length])); else R.put(x, y, g1); }
      // bench with a water flask, lamp post, distance marker, bunting
      const bx = Math.round(W * 0.12);
      R.rect(bx, 95, 14, 2, T('#7a4a2a')); R.rect(bx, 92, 14, 1, T('#8a5a34')); R.rect(bx + 1, 97, 1, 3, T('#4a2f1d')); R.rect(bx + 12, 97, 1, 3, T('#4a2f1d'));
      R.rect(bx + 9, 92, 2, 3, T('#3a8ac0')); R.put(bx + 9, 91, T('#e8e8e8'));
      R.rect(bx + 3, 93, 4, 2, T('#c0563a')); // a folded towel
      const lx = Math.round(W * 0.84);
      R.rect(lx, 78, 1, 22, T('#3a3a44')); R.rect(lx - 1, 76, 3, 2, T('#3a3a44')); R.put(lx, 78, T('#ffe08a'));
      s.lamp = { x: lx, y: 78 };
      R.rect(Math.round(W * 0.5), 94, 2, 6, T('#e8dcc0')); R.put(Math.round(W * 0.5), 95, T('#c0392b'));
      const p0 = Math.round(W * 0.28), p1 = Math.round(W * 0.72);
      R.rect(p0, 84, 1, 16, T('#5a3c24')); R.rect(p1, 84, 1, 16, T('#5a3c24'));
      const flags = ['#c0563a', '#f2c14a', '#4f8f3a', '#3a6fb0', '#8a5bc4'];
      for (let x = p0 + 2, k = 0; x < p1 - 1; x += 4, k++) {
        const y = 85 + Math.round(Math.sin(((x - p0) / (p1 - p0)) * Math.PI) * 3);
        R.put(x - 1, y - 1, T('#e8dcc0')); R.rect(x, y, 3, 1, T(flags[k % 5])); R.put(x + 1, y + 1, T(flags[k % 5]));
      }
      if (W > 170) tree(R, T, e.pal, W - 10, 100, 9, rnd), tree(R, T, e.pal, 6, 99, 7, rnd);
      s.walk = [Math.round(W * 0.08), Math.round(W * 0.88)];
    },
    draw(c, sc, e, t, s, P) {
      // river shimmer + city lights at night
      for (let i = 0; i < 8; i++) { c.fillStyle = `rgba(255,255,255,${0.2 + 0.15 * Math.sin(t * 3 + i)})`; c.fillRect((i * 37 + Math.floor(t * 6)) % sc.W, 83 + (i * 3) % 6, 3, 1); }
      if (e.dark > 0.3) for (const [k, w] of s.windows.entries()) if ((k * 7 + Math.floor(t / 3)) % 5) { c.fillStyle = `rgba(255,214,120,${0.7 * e.dark})`; c.fillRect(w.x, w.y, 1, 1); }
      if (e.dark > 0.3) sc.glow(s.lamp.x, s.lamp.y, 14, 0.45 * e.dark);
      // a jog along the track, the cat trotting behind
      const [x, dir] = pingPong(t, 14, s.walk[0], s.walk[1] - sc.hw);
      const bob = Math.floor(t * 8) % 2;
      const y = s.track - sc.hh - bob;
      sc.drawHero(c, Math.round(x), y, dir < 0, 0);
      if (Math.floor(t * 8) % 4 === 0) { c.fillStyle = P('#c08a5a'); c.fillRect(Math.round(x + (dir > 0 ? -2 : sc.hw + 1)), s.track - 1, 2, 1); }
      if (Math.floor(t * 1.5) % 3 === 0) { c.fillStyle = 'rgba(160,210,255,0.9)'; c.fillRect(Math.round(x + (dir > 0 ? 3 : sc.hw - 4)), y + 4 + Math.floor((t * 6) % 4), 1, 2); }
      if (sc.catCv) c.drawImage(sc.catCv[Math.floor(t * 6) % 2], Math.round(dir > 0 ? x - 12 : x + sc.hw + 4), s.track - 6 - (Math.floor(t * 6 + 1) % 2));
      sc.birds(c, e, t);
    },
  },

  // ---- the wild woods -----------------------------------------------------
  woods: {
    outdoor: true,
    build(R, T, e, W, s, rnd) {
      paintSky(R, e, 0, 0, W, 90);
      const back = mix(T(e.pal.under[0]), e.bot, 0.55);
      // far pines
      for (let x = -4; x < W + 4; x += 5 + Math.floor(rnd() * 5)) {
        const h = 26 + Math.floor(rnd() * 22), base = 92;
        for (let j = 0; j < h; j++) { const half = Math.floor((j / h) * 6) + (j % 4 === 3 ? -1 : 0); for (let i = -half; i <= half; i++) R.put(x + i, base - h + j, back); }
        if (e.pal.snowy) for (let j = 0; j < h; j += 4) R.put(x, base - h + j, mix([250, 252, 255], e.bot, 0.3));
      }
      // forest floor + trail
      const [g0, g1, g2] = e.pal.grass.map(T);
      const floor = e.pal.snowy ? g0 : mix(g0, T('#5a4a2a'), 0.25);
      for (let y = 90; y < H; y++) for (let x = 0; x < W; x++) { const n = rnd(); R.put(x, y, n < 0.1 ? g1 : n > 0.9 ? g2 : floor); }
      const trail = (x) => Math.round(104 + 3 * Math.sin(x * 0.04));
      for (let x = 0; x < W; x++) for (let y = trail(x) - 3; y <= trail(x) + 3; y++) R.put(x, y, T(e.pal.snowy ? '#e2e6ea' : rnd() < 0.15 ? '#9a7a50' : '#b08a5a'));
      s.trail = trail;
      // mid trunks rising into a thick canopy overhead, light filtering between
      // spring woods stay green, sprinkled with blossom
      const cols = (e.season === 'spring' ? ['#2c672e', '#479a3d', '#76c25a'] : e.pal.canopy).map(T);
      const bloom = e.season === 'spring' ? e.pal.canopy.map(T) : null;
      const leaves = (cx0, cy0, r) => R.disk(cx0, cy0, r, (px, py, nx, ny) => { const n = rnd(); if (n < 0.06 && ny > 0) return; R.put(px, py, bloom && n > 0.93 ? bloom[1 + (n > 0.97)] : ny < -0.35 && nx < 0.3 ? cols[2] : n < 0.22 || ny > 0.45 ? cols[0] : cols[1]); });
      const snowCap = (cx0, cy0, r) => e.pal.snowy && R.disk(cx0, cy0, r, (px, py, nx, ny) => ny < -0.45 && rnd() < 0.85 && R.put(px, py, [250, 252, 255]));
      for (let x = 4; x < W; x += 20 + Math.floor(rnd() * 14)) {
        const tw = 3 + Math.floor(rnd() * 3);
        for (let y = 10; y < 96; y++) for (let i = 0; i < tw; i++) R.put(x + i, y, T(i === 0 ? '#6a4a30' : i === tw - 1 ? '#3e2818' : (y * 3 + i) % 11 === 0 ? '#3e2818' : '#54382a'));
        R.rect(x - 1, 94, tw + 2, 2, T('#3e2818')); R.put(x - 2, 95, T('#3e2818')); R.put(x + tw + 1, 95, T('#3e2818'));
        if (rnd() < 0.6) { const by = 40 + Math.floor(rnd() * 16), d = rnd() < 0.5 ? -1 : 1; R.line(x + (d > 0 ? tw : -1), by, x + d * 8, by - 6, T('#54382a')); leaves(x + d * 9, by - 8, 5); snowCap(x + d * 9, by - 8, 5); }
      }
      for (let x = -6; x < W + 8; x += 7 + Math.floor(rnd() * 5)) { const r = 9 + Math.floor(rnd() * 6), y = 2 + Math.floor(rnd() * 10); leaves(x, y, r); snowCap(x, y, r); }
      for (let x = 0; x < W; x += 10 + Math.floor(rnd() * 8)) { const r = 6 + Math.floor(rnd() * 4), y = 16 + Math.floor(rnd() * 8); leaves(x, y, r); }
      // undergrowth behind the trail
      for (let x = -4; x < W + 4; x += 6 + Math.floor(rnd() * 6)) R.disk(x, 95, 3 + Math.floor(rnd() * 3), (px, py, nx, ny) => py <= 96 && R.put(px, py, e.pal.snowy ? (ny < -0.3 ? [250, 252, 255] : T('#7a8a90')) : ny < -0.4 ? T(e.pal.grass[1]) : T(e.pal.under[1])));
      // ferns, mushrooms, stones, flowers
      for (let i = 0; i < W / 9; i++) {
        const x = Math.floor(rnd() * W), y = rnd() < 0.5 ? 93 + Math.floor(rnd() * 6) : 110 + Math.floor(rnd() * 8);
        const k = rnd();
        if (k < 0.4 && !e.pal.snowy) { const f = T(e.season === 'autumn' ? '#a0782a' : '#3f7a35'); R.line(x, y, x - 3, y - 4, f); R.line(x, y, x + 3, y - 4, f); R.line(x, y, x, y - 5, f); }
        else if (k < 0.55) { R.rect(x, y - 2, 1, 2, T('#efe6d2')); R.rect(x - 1, y - 4, 3, 2, T('#c0392b')); R.put(x, y - 4, T('#ffffff')); }
        else if (k < 0.7) { R.rect(x, y - 2, 4, 2, T('#8a8a90')); R.rect(x + 1, y - 3, 2, 1, T(e.pal.snowy ? '#ffffff' : '#a0a0a8')); }
        else if (e.pal.flowers.length) { R.put(x, y, T(e.pal.flowers[i % e.pal.flowers.length])); R.put(x + 2, y + 1, T(e.pal.flowers[(i + 1) % e.pal.flowers.length])); }
      }
      // a little stream on the right
      if (W > 180) {
        const sx = Math.round(W * 0.78);
        for (let y = 92; y < H; y++) { const cx = sx + Math.round((y - 92) * 0.4 + Math.sin(y * 0.3) * 2); for (let i = -2; i <= 2 + Math.floor((y - 92) / 12); i++) R.put(cx + i, y, mix(e.bot, [70, 130, 170], 0.5)); }
        s.stream = { x: sx, y: 92 };
      }
      s.walk = [Math.round(W * 0.06), Math.round(W * 0.7)];
    },
    draw(c, sc, e, t, s, P) {
      // sun shafts through the canopy
      if (e.dark < 0.4 && !e.grey) {
        c.fillStyle = `rgba(255,240,190,${0.09 * (1 - e.dark)})`;
        for (let k = 0; k < 3; k++) { const x = sc.W * (0.15 + k * 0.32); c.beginPath(); c.moveTo(x, 14); c.lineTo(x + 7, 14); c.lineTo(x + 30, 112); c.lineTo(x + 15, 112); c.fill(); }
      }
      if (s.stream) for (let i = 0; i < 6; i++) { const y = 94 + ((i * 5 + Math.floor(t * 8)) % 24); c.fillStyle = 'rgba(255,255,255,0.45)'; c.fillRect(s.stream.x + Math.round((y - 92) * 0.4 + Math.sin(y * 0.3) * 2), y, 1, 1); }
      // a slow wander along the trail with a walking stick
      const [x, dir] = pingPong(t, 6, s.walk[0], s.walk[1]);
      const xi = Math.round(x), base = s.trail(xi + (sc.hw >> 1)) + 1, bob = Math.floor(t * 3) % 2;
      sc.drawHero(c, xi, base - sc.hh - bob, dir < 0, 0);
      const sx = dir > 0 ? xi + sc.hw : xi - 1;
      c.fillStyle = P('#7a4a2a'); c.fillRect(sx, base - Math.round(sc.hh * 0.6) - bob, 1, Math.round(sc.hh * 0.6) + bob);
      if (sc.catCv) c.drawImage(sc.catCv[Math.floor(t * 3) % 2], dir > 0 ? xi - 12 : xi + sc.hw + 4, base - 6);
      // butterflies by day, fireflies by night
      for (let i = 0; i < (e.dark > 0.4 ? 12 : e.season === 'winter' ? 0 : 4); i++) {
        const fx = (i * 53 + Math.sin(t * 0.6 + i) * 20 + t * 3) % sc.W, fy = 70 + (i * 13) % 34 + Math.cos(t * 0.8 + i * 2) * 5;
        if (e.dark > 0.4) { const a = 0.5 + 0.5 * Math.sin(t * 3 + i); c.fillStyle = `rgba(220,255,120,${a})`; c.fillRect(Math.round(fx), Math.round(fy), 1, 1); }
        else { const flap = Math.floor(t * 8 + i) % 2; c.fillStyle = P(['#f2c14a', '#f29ac0', '#ffffff', '#b49af0'][i % 4]); c.fillRect(Math.round(fx) - flap, Math.round(fy), flap ? 3 : 1, 1); }
      }
      // a rabbit pops out now and then
      const rp = (t % 14) / 14;
      if (rp < 0.35 && sc.W > 160) {
        const rx = Math.round(sc.W * 0.88 - rp * 60), hop = Math.round(Math.abs(Math.sin(rp * 40)) * 2);
        c.fillStyle = P(e.pal.snowy ? '#f2f2f2' : '#a08060'); c.fillRect(rx, 112 - hop, 4, 3); c.fillRect(rx, 110 - hop, 2, 2); c.fillRect(rx, 108 - hop, 1, 2);
        c.fillStyle = P('#ffffff'); c.fillRect(rx + 4, 112 - hop, 1, 1);
      }
      sc.birds(c, e, t);
    },
  },

  // ---- the Lantern Tavern ---------------------------------------------------
  tavern: {
    build(R, T, e, W, s, rnd) {
      const cx = Math.round(W / 2);
      // plaster and timber upper wall, panelled lower wall
      for (let y = 0; y < 96; y++) for (let x = 0; x < W; x++) {
        if (y < 60) R.put(x, y, T(rnd() < 0.05 ? '#c8ac80' : '#d8bc90'));
        else R.put(x, y, T(x % 12 === 0 ? '#4a2f1d' : y === 61 || y === 94 ? '#5a3a22' : '#6b4026'));
      }
      R.rect(0, 0, W, 6, T('#3e2818')); R.rect(0, 58, W, 3, T('#4a2f1d'));
      for (let x = 10; x < W; x += 40) { R.rect(x, 6, 3, 52, T('#4a2f1d')); R.line(x + 3, 30, x + 14, 6, T('#4a2f1d')); }
      // window
      s.win = paintWindow(R, T, e, Math.max(6, cx - 70), 16, 26, 30);
      // shelf of bottles and barrels at the bar (right)
      const bx = Math.min(W - 40, cx + 72);
      R.rect(bx, 30, 36, 2, T('#5a3a22')); R.rect(bx, 46, 36, 2, T('#5a3a22'));
      for (let i = 0; i < 9; i++) { const c = ['#3a7a4a', '#7a3a2a', '#c0a040', '#3a4a7a'][i % 4]; R.rect(bx + 2 + i * 4, 24 + (i % 2), 2, 6 - (i % 2), T(c)); R.put(bx + 2 + i * 4, 23 + (i % 2), T('#e8dcc0')); }
      for (let i = 0; i < 4; i++) { R.rect(bx + 3 + i * 8, 40, 6, 6, T('#8a5a30')); R.rect(bx + 3 + i * 8, 42, 6, 1, T('#5a3a22')); }
      R.rect(bx - 4, 72, 44, 4, T('#7a4a2a')); R.rect(bx - 4, 76, 44, 20, T('#5a3a22')); R.rect(bx - 4, 72, 44, 1, T('#a8784a'));
      for (let x = bx; x < bx + 40; x += 9) R.rect(x, 78, 1, 16, T('#4a2f1d'));
      // a lute and a chalkboard on the wall
      if (W > 200) {
        const lx = cx - 34;
        R.disk(lx, 44, 3, (x, y) => R.put(x, y, T('#c08040'))); R.put(lx, 44, T('#3e2818'));
        R.line(lx + 2, 41, lx + 8, 30, T('#8a5a30')); R.rect(lx + 7, 28, 3, 2, T('#5a3a22'));
        R.rect(cx + 22, 20, 16, 12, T('#5a3a22')); R.rect(cx + 23, 21, 14, 10, T('#2a3a32'));
        for (let k = 0; k < 3; k++) R.rect(cx + 25, 23 + k * 3, 6 + (k % 2) * 4, 1, T('#e8e8e0'));
      }
      // bunting along the beam
      const flags = ['#c0563a', '#f2c14a', '#4f8f3a', '#3a6fb0', '#8a5bc4'];
      for (let x = 2, k = 0; x < W; x += 5, k++) { const y = 8 + Math.round(Math.sin(x * 0.12) * 1.5); R.rect(x, y, 3, 1, T(flags[k % 5])); R.put(x + 1, y + 1, T(flags[k % 5])); }
      // floor
      for (let y = 96; y < H; y++) for (let x = 0; x < W; x++) R.put(x, y, T((y - 96) % 5 === 0 ? '#3e2818' : (x + Math.floor((y - 96) / 5) * 11) % 23 === 0 ? '#3e2818' : '#5e3e26'));
      // two bears at a little table
      s.table = { x0: cx - 22, x1: cx + 22, y: 98 };
      s.bearX = [cx - 32, cx + 18];
      s.bearFur = ['#7a4a2a', '#c08a48'];
      s.bears = [bearFrames(T, '#7a4a2a', '#c8a070', '#c0392b'), bearFrames(T, '#c08a48', '#f0d8a8', '#3a6fb0')];
      // lanterns hanging from the beam
      s.lanterns = [];
      for (let x = cx + 2 - Math.floor((cx - 4) / 42) * 42; x < W - 4; x += 42) if (x > 4) s.lanterns.push({ x, y: 18 });
      // a hearth and a second window when the room is wide
      if (W > 300) {
        const fx = Math.round(W * 0.08);
        R.rect(fx, 50, 40, 46, T('#8d8478'));
        for (let y = 50; y < 96; y += 4) { R.rect(fx, y, 40, 1, T('#6a6258')); for (let x = fx + ((y / 4) % 2) * 4; x < fx + 40; x += 8) R.rect(x, y, 1, 4, T('#6a6258')); }
        R.rect(fx - 3, 48, 46, 3, T('#5a3a22')); R.rect(fx + 8, 68, 24, 28, T('#1e1410')); R.rect(fx + 10, 90, 20, 3, T('#4a3020'));
        R.rect(fx + 4, 42, 3, 6, T('#e8e0d0')); R.rect(fx + 30, 41, 5, 7, T('#c0a040'));
        s.fire = { x: fx + 20, y: 90 };
        s.win2 = paintWindow(R, T, e, Math.round(W * 0.88) - 13, 16, 26, 30);
      }
      for (const l of s.lanterns) { R.rect(l.x, 6, 1, 12, T('#3e2818')); R.rect(l.x - 2, 18, 5, 1, T('#3e2818')); R.rect(l.x - 2, 24, 5, 1, T('#3e2818')); }
      s.walk = null;
    },
    draw(c, sc, e, t, s, P) {
      if (s.fire) {
        const f = s.fire;
        for (let i = 0; i < 8; i++) {
          const h = 4 + Math.round(4 * Math.abs(Math.sin(t * 6 + i * 1.7)) + (i % 3)), x = f.x - 8 + i * 2;
          c.fillStyle = '#e0502a'; c.fillRect(x, f.y - h, 2, h); c.fillStyle = '#f2a03a'; c.fillRect(x, f.y - h + 2, 2, Math.max(1, h - 3));
          c.fillStyle = '#ffe08a'; c.fillRect(x + (i & 1), f.y - Math.max(1, h - 4), 1, Math.max(1, h - 5));
        }
        sc.glow(f.x, f.y - 6, 40, 0.22);
      }
      for (const l of s.lanterns) {
        const f = Math.sin(t * 9 + l.x) > 0 ? 1 : 0;
        c.fillStyle = '#ffd27a'; c.fillRect(l.x - 1, 19, 3, 5); c.fillStyle = '#fff2b0'; c.fillRect(l.x, 20 + f, 1, 2);
        sc.glow(l.x, 21, 26, 0.22 + 0.3 * e.dark);
      }
      // two bears raise their mugs and clink them together, over and over (drawn at double size)
      const tb = s.table, mid = Math.round((tb.x0 + tb.x1) / 2);
      const cyc = t % 3.6, up = cyc < 0.5 ? cyc / 0.5 : cyc < 1.4 ? 1 : cyc < 1.9 ? 1 - (cyc - 1.4) / 0.5 : 0;
      const ease = up * up * (3 - 2 * up), clink = cyc >= 0.5 && cyc < 1.4;
      const Z = sc.zoom2(mid - 36, 66, 72, 48, mid, 114, (c) => {
      s.bears.forEach((fr, i) => {
        const sway = clink ? 0 : Math.round(Math.sin(t * 2.2 + i * 2.5)), bx = s.bearX[i] + sway, by = tb.y - 15 - (clink ? 1 : 0);
        c.drawImage(fr[clink ? 1 : 0], bx, by);
        const restX = i === 0 ? bx + 15 : bx - 5, restY = tb.y - 5;
        const meetX = i === 0 ? mid - 5 : mid + 1, meetY = tb.y - 19;
        const mx = Math.round(restX + (meetX - restX) * ease), my = Math.round(restY + (meetY - restY) * ease);
        // the arm, from shoulder to paw
        const sx = i === 0 ? bx + 12 : bx + 1, sy = by + 12, px = i === 0 ? mx - 1 : mx + 4, py = my + 3;
        c.fillStyle = P(s.bearFur[i]);
        for (let k = 0; k <= 6; k++) c.fillRect(Math.round(sx + ((px - sx) * k) / 6), Math.round(sy + ((py - sy) * k) / 6), 2, 2);
        c.fillStyle = P('#3e2818'); c.fillRect(px, py, 2, 2);
        // the mug: wood-banded, foamy top, handle on the outside
        c.fillStyle = P('#c8a060'); c.fillRect(mx, my, 4, 5); c.fillStyle = P('#8a6a3a'); c.fillRect(mx, my + 1, 4, 1); c.fillRect(mx, my + 4, 4, 1);
        c.fillRect(i === 0 ? mx - 1 : mx + 4, my + 2, 1, 2);
        c.fillStyle = P('#fff6dc'); c.fillRect(mx, my - 1, 4, 1); c.fillRect(mx + 1, my - 2, 2, 1);
      });
      if (clink) {
        const k = (cyc - 0.5) / 0.9, y0 = tb.y - 22;
        c.fillStyle = '#fff6dc';
        for (let j = 0; j < 6; j++) c.fillRect(mid - 1 + Math.round(Math.cos(j * 1.05) * k * 8), y0 - Math.round(Math.abs(Math.sin(j * 1.05 + 0.4)) * k * 7) + Math.round(k * k * 8), 1, 1);
        c.fillStyle = '#ffe08a'; c.fillRect(mid - 1, y0 - 2, 1, 3); c.fillRect(mid - 2, y0 - 1, 3, 1);
        // hearts over their heads
        for (const [j, hx0] of [s.bearX[0] + 5, s.bearX[1] + 5].entries()) {
          const hy = tb.y - 22 - Math.round(k * 6) - j;
          c.globalAlpha = 1 - k * 0.6; c.fillStyle = '#f06a8a';
          c.fillRect(hx0, hy, 1, 1); c.fillRect(hx0 + 2, hy, 1, 1); c.fillRect(hx0, hy + 1, 3, 1); c.fillRect(hx0 + 1, hy + 2, 1, 1);
          c.globalAlpha = 1;
        }
      }
      // the table in front of them, with a candle
      c.fillStyle = P('#8a5a34'); c.fillRect(tb.x0, tb.y, tb.x1 - tb.x0, 3); c.fillStyle = P('#a8784a'); c.fillRect(tb.x0, tb.y, tb.x1 - tb.x0, 1);
      c.fillStyle = P('#5a3a22'); c.fillRect(tb.x0 + 4, tb.y + 3, 3, 12); c.fillRect(tb.x1 - 7, tb.y + 3, 3, 12);
      c.fillStyle = P('#efe6d2'); c.fillRect(mid - 1, tb.y - 4, 2, 4); c.fillStyle = '#ffd27a'; c.fillRect(mid - 1, tb.y - 6 - (Math.sin(t * 11) > 0 ? 1 : 0), 1, 2);
      });
      sc.glow(...Z(mid, tb.y - 6), 32, 0.25 + 0.2 * e.dark);
      // music drifting from somewhere
      for (let i = 0; i < 3; i++) {
        const p = (t * 0.25 + i / 3) % 1, nx = Math.round(sc.W * 0.2 + p * 30 + Math.sin(p * 9) * 3), ny = Math.round(54 - p * 34);
        c.fillStyle = `rgba(90,58,34,${1 - p})`; c.fillRect(nx, ny, 2, 2); c.fillRect(nx + 1, ny - 4, 1, 4); c.fillRect(nx + 2, ny - 4, 1, 1);
      }
      if (sc.catCv) c.drawImage(sc.catCv[Math.floor(t * 1.3) % 2], Z(tb.x1, 0)[0] + 8, 110);
      sc.windowWeather(c, e, t, s.win);
      if (s.win2) sc.windowWeather(c, e, t, s.win2);
    },
  },

  // ---- the cottage kitchen --------------------------------------------------
  cottage: {
    build(R, T, e, W, s, rnd) {
      const cx = Math.round(W / 2);
      for (let y = 0; y < 96; y++) for (let x = 0; x < W; x++) {
        if (y < 64) R.put(x, y, T(rnd() < 0.05 ? '#d8c8a8' : '#e6d6b6'));
        else R.put(x, y, T(((x + (Math.floor(y / 4) % 2) * 4) % 8 === 0 || y % 4 === 0) ? '#8a8078' : '#a49a8e'));
      }
      R.rect(0, 0, W, 5, T('#4a2f1d')); R.rect(0, 63, W, 2, T('#5a3a22'));
      // window with potted herbs
      const wx = Math.max(8, cx - 60);
      s.win = paintWindow(R, T, e, wx, 18, 30, 26);
      for (let k = 0; k < 3; k++) { const px = wx + 2 + k * 10; R.rect(px, 42, 5, 4, T('#b0603a')); for (const [dx, dy] of [[1, -2], [2, -4], [3, -2], [2, -1], [0, -3], [4, -3]]) R.put(px + dx, 42 + dy, T(['#4f8f3a', '#5aa04a', '#8a5bc4'][k])); }
      // hanging herbs + copper pots along the beam
      for (let x = 6; x < W - 6; x += 14) {
        if (Math.abs(x - (wx + 15)) < 18) continue;
        R.rect(x, 5, 1, 4, T('#7a5a3a'));
        if ((x / 14) % 2 < 1) { const col = T(['#4f7a35', '#7a5a9a', '#9a8a3a'][(x / 14) % 3 | 0]); for (let j = 0; j < 6; j++) R.rect(x - 1 + (j % 2), 9 + j, 3 - (j % 2), 1, col); }
        else { R.disk(x, 12, 3, (px, py, nx, ny) => py >= 11 && R.put(px, py, T(nx < -0.2 ? '#e08a50' : '#c06a30'))); R.rect(x - 3, 11, 7, 1, T('#9a4a20')); }
      }
      // shelves of jars
      const sx = Math.min(W - 48, cx + 8);
      for (const sy of [26, 42]) {
        R.rect(sx, sy, 40, 2, T('#6b4026'));
        for (let i = 0; i < 6; i++) { const c = ['#e0a040', '#a03a3a', '#5a8a3a', '#e8dcc0', '#7a5a9a', '#c08a50'][(i + sy) % 6]; R.rect(sx + 2 + i * 6, sy - 6, 4, 6, T(c)); R.rect(sx + 2 + i * 6, sy - 7, 4, 1, T('#8a6a46')); R.put(sx + 3 + i * 6, sy - 5, T('#ffffff')); }
      }
      // stove with a kettle (right)
      const kx = Math.min(W - 26, sx + 46);
      if (kx + 22 < W) {
        R.rect(kx, 66, 22, 30, T('#3a3a40')); R.rect(kx, 66, 22, 2, T('#55555c')); R.rect(kx + 4, 80, 14, 10, T('#1e1e22'));
        R.rect(kx + 6, 84, 10, 4, T('#e0602a')); R.rect(kx + 8, 85, 6, 2, T('#f2c14a'));
        R.rect(kx + 8, 22, 6, 44, T('#3a3a40'));
        s.kettle = { x: kx + 7, y: 60 };
      }
      // tiled floor + rag rug
      for (let y = 96; y < H; y++) for (let x = 0; x < W; x++) R.put(x, y, T(((Math.floor(x / 6) + Math.floor((y - 96) / 6)) % 2) ? '#b8643a' : '#a4542e'));
      for (let y = 106; y < 117; y++) for (let x = cx - 48; x < cx + 48; x++) R.put(x, y, T(['#c05a5a', '#e0b060', '#5a8a9a', '#e8dcc0'][Math.floor((y - 106) / 2.75) % 4]));
      s.cx = cx;
      s.sp = {
        milk: sprite(T, MILK, { b: '#3a6fb0', w: '#f6f4ee' }),
        flour: sprite(T, FLOUR, { t: '#8a6a46', s: '#e8dcc0', F: '#c0a070' }),
        egg: sprite(T, EGG, { e: '#f6efe0', E: '#d8c8b0' }),
        bowl: sprite(T, BOWL, { k: '#5a8a9a', K: '#7ab0c0', w: '#c8e4ec' }),
        cake: sprite(T, CAKE, { g: '#5aa04a', o: '#3a4a9a', h: '#8a9ae0', c: '#fff6e8', F: '#9a8ae0', s: '#f0c878', S: '#d8a858', p: '#e8e8f0', P: '#c8c8d4' }),
      };
    },
    draw(c, sc, e, t, s, P) {
      if (s.kettle) {
        const k = s.kettle;
        c.fillStyle = P('#c06a30'); c.fillRect(k.x, k.y, 8, 6); c.fillRect(k.x + 8, k.y + 1, 2, 1); c.fillStyle = P('#e08a50'); c.fillRect(k.x + 1, k.y, 3, 1); c.fillRect(k.x + 3, k.y - 1, 2, 1);
        for (let i = 0; i < 4; i++) { const p = (t * 0.9 + i / 4) % 1; c.fillStyle = `rgba(245,245,245,${0.6 * (1 - p)})`; c.fillRect(k.x + 10 + Math.round(p * 4 + Math.sin(p * 7) * 1.5), k.y - Math.round(p * 12), 1, 1); }
        sc.glow(k.x + 5, 86, 18, 0.2 + 0.25 * e.dark);
      }
      // a little kitchen magic: milk, flour and eggs float up, tumble into the bowl,
      // swirl, and — poof — a blueberry cake (the table and its magic are drawn at double size)
      const cx = s.cx, sp = s.sp, T0 = t % 10, bowlY = 88;
      const sm = (x) => x * x * (3 - 2 * x), seg = (a0, a1) => clamp((T0 - a0) / (a1 - a0), 0, 1);
      const items = [
        { cv: sp.milk, from: [cx - 30, 84], hover: [cx - 17, 72], dive: [2.6, 3.2] },
        { cv: sp.flour, from: [cx + 24, 70], hover: [cx + 8, 68], dive: [3.1, 3.7] },
        { cv: sp.egg, from: [cx - 24, 72], hover: [cx - 7, 64], dive: [3.6, 4.1] },
        { cv: sp.egg, from: [cx + 26, 84], hover: [cx + 2, 62], dive: [4.0, 4.5] },
      ];
      sc.zoom2(cx - 34, 60, 70, 54, cx, 114, (c) => {
      // a worktable with a checked cloth, where the magic happens
      c.fillStyle = P('#a8784a'); c.fillRect(cx - 22, 94, 44, 2); c.fillStyle = P('#7a4a2a'); c.fillRect(cx - 22, 96, 44, 1);
      for (let x = cx - 22; x < cx + 22; x += 2) for (let y = 97; y < 101; y += 2) { c.fillStyle = P(((x >> 1) + (y >> 1)) % 2 ? '#c0563a' : '#f3e2c0'); c.fillRect(x, y, 2, 2); }
      c.fillStyle = P('#5a3a22'); c.fillRect(cx - 19, 101, 3, 12); c.fillRect(cx + 16, 101, 3, 12);
      let inBowl = 0;
      const spark = (x, y, a) => { c.fillStyle = `rgba(255,236,150,${a})`; c.fillRect(x, y, 1, 1); if (a > 0.7) { c.fillRect(x - 1, y, 3, 1); c.fillRect(x, y - 1, 1, 3); } };
      if (T0 < 6.4) {
        for (const [k, it] of items.entries()) {
          const d = seg(it.dive[0], it.dive[1]);
          if (d >= 1) { inBowl++; const pf = (T0 - it.dive[1]) / 0.5; if (pf < 1) for (let j = 0; j < 5; j++) { c.fillStyle = k === 1 ? `rgba(250,248,240,${1 - pf})` : `rgba(255,236,150,${1 - pf})`; c.fillRect(cx + Math.round(Math.cos(j * 1.3 + k) * pf * 9), bowlY - 1 - Math.round(Math.abs(Math.sin(j * 1.3 + k)) * pf * 6), 1, 1); } continue; }
          const f = sm(seg(0.2 + k * 0.25, 2.4 + k * 0.1)), bob = Math.round(Math.sin(t * 3 + k) * 1.5 * (1 - d));
          let x = it.from[0] + (it.hover[0] - it.from[0]) * f, y = it.from[1] + (it.hover[1] - it.from[1]) * f + bob;
          if (d > 0) { x += (cx - it.cv.width / 2 - x) * sm(d); y += (bowlY - 2 - y) * sm(d); }
          if (f <= 0) continue;
          c.drawImage(it.cv, Math.round(x), Math.round(y));
          for (let j = 1; j <= 3; j++) spark(Math.round(x + it.cv.width / 2 + Math.sin(t * 5 + j + k) * 3), Math.round(y + it.cv.height + j * 2), 0.8 - j * 0.2);
        }
        if (T0 < 6.3) c.drawImage(sp.bowl, cx - 7, bowlY);
        if (inBowl) { c.fillStyle = P('#f6e8c8'); c.fillRect(cx - 5, bowlY + 1, 10, 1); }
        // swirling stars once everything is in
        const sw = seg(4.5, 6.2);
        if (sw > 0) for (let j = 0; j < 8; j++) { const a = t * 6 + (j * Math.PI) / 4; spark(Math.round(cx + Math.cos(a) * (12 - sw * 4)), Math.round(bowlY + 2 + Math.sin(a) * 4 - sw * 3), 0.5 + 0.5 * Math.sin(t * 9 + j)); }
      }
      // poof!
      const pf = seg(6.1, 6.7);
      if (pf > 0 && pf < 1) for (let j = 0; j < 14; j++) { const a = (j * Math.PI * 2) / 14; spark(Math.round(cx + Math.cos(a) * pf * 18), Math.round(86 + Math.sin(a) * pf * 12), 1 - pf); }
      if (T0 >= 6.3) {
        c.globalAlpha = Math.min(seg(6.3, 6.7), 1 - seg(9.5, 10));
        c.drawImage(sp.cake, cx - 8, 94 - sp.cake.height);
        for (let j = 0; j < 5; j++) spark(Math.round(cx - 10 + ((j * 7) % 21)), 78 + ((j * 5) % 12), 0.5 + 0.5 * Math.sin(t * 4 + j * 2));
        const hp = (T0 - 6.6) / 3;
        if (hp > 0) { const hx0 = cx + 9, hy = Math.round(80 - hp * 16); c.fillStyle = '#f06a8a'; c.fillRect(hx0, hy, 1, 1); c.fillRect(hx0 + 2, hy, 1, 1); c.fillRect(hx0, hy + 1, 3, 1); c.fillRect(hx0 + 1, hy + 2, 1, 1); }
        c.globalAlpha = 1;
      }
      // the wand that does it all, drifting beside the table
      const wx = Math.round(cx + 22 + Math.sin(t * 1.3) * 3), wy = Math.round(72 + Math.cos(t * 1.7) * 3);
      c.fillStyle = P('#5a3a22'); for (let j = 0; j < 7; j++) c.fillRect(wx + j, wy + 7 - j, 1, 1);
      spark(wx + 7, wy, 0.6 + 0.4 * Math.sin(t * 8)); c.fillStyle = '#ffe08a'; c.fillRect(wx + 7, wy, 1, 1);
      });
      if (sc.catCv) c.drawImage(sc.catCv[Math.floor(t * 1.2) % 2], cx - 58, 108);
      sc.windowWeather(c, e, t, s.win);
    },
  },
};

export class OutingScene extends Scene {
  constructor(canvas, kind) { super(canvas); this.kind = KINDS[kind] ? kind : 'training'; }

  env() {
    if (KINDS[this.kind].outdoor) { const e = super.env(); e.day = 1 - e.dark; return e; }
    return StudyScene.prototype.env.call(this);
  }

  frame(dt) {
    const e = this.env();
    this.loadAvatarImage();
    const key = [this.W, Math.round(e.alt * 2), e.season, e.weather, e.realm.id, JSON.stringify(this.input.avatar || {}), this.avImg?.ok].join('|');
    if (key !== this.key) { this.build(e); this.key = key; }
    this.drawDynamic(e, dt);
  }

  build(e) {
    const W = this.W, R = new Raster(W, H), rnd = rng(31);
    const tc = new Map();
    const T = (h) => { let c = tc.get(h); if (!c) { const b = hx2(h); c = b.map((v, i) => clamp(v * e.amb[i], 0, 255)); tc.set(h, c); } return c; };
    this.T = T;
    const s = (this.spots = { stars: [], windows: [] });
    KINDS[this.kind].build(R, T, e, W, s, rnd);
    const hero = heroCanvases(this.input, this.avImg, T, e.amb, this.dpx);
    this.heroCv = hero.cvs; this.heroHi = hero.hi; this.hw = hero.w; this.hh = hero.h;
    this.catCv = this.input.avatar?.familiar !== false ? catCanvases(T, this.input.avatar?.familiarColor || '#2a2230') : null;
    this.bg.width = W; this.bg.height = H;
    this.bg.getContext('2d').putImageData(R.img, 0, 0);
  }

  drawHero(c, x, y, flip, blink) {
    const cv = this.heroCv[blink || Math.floor(this.t * 10) % 37 === 0 ? 1 : 0];
    this.blitHero(c, cv, x, y, flip);
  }

  glow(x, y, r, a) {
    const c = this.ctx;
    c.globalCompositeOperation = 'lighter';
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,190,90,${a * (0.9 + 0.1 * Math.sin(this.t * 9))})`); g.addColorStop(1, 'rgba(255,170,60,0)');
    c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
    c.globalCompositeOperation = 'source-over';
  }

  // Draws one part of the scene at double size: fn paints the box (ox, oy, w, h) in scene
  // coordinates, Scale2x smooths the steps so it still reads as pixel art, and the anchor
  // (ax, ay) — a spot on the floor — stays put. Returns a scene -> screen point mapper.
  zoom2(ox, oy, w, h, ax, ay, fn) {
    const z = (this.z2 ||= {});
    if (z.w !== w || z.h !== h) {
      z.w = w; z.h = h;
      z.src = document.createElement('canvas'); z.src.width = w; z.src.height = h;
      z.dst = document.createElement('canvas'); z.dst.width = w * 2; z.dst.height = h * 2;
      z.g = z.src.getContext('2d', { willReadFrequently: true }); z.out = z.dst.getContext('2d'); z.img = z.out.createImageData(w * 2, h * 2);
    }
    const g = z.g;
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.clearRect(0, 0, w, h); g.translate(-ox, -oy);
    fn(g);
    const a = new Uint32Array(g.getImageData(0, 0, w, h).data.buffer), o = new Uint32Array(z.img.data.buffer), w2 = w * 2;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const p = a[y * w + x], A = y ? a[(y - 1) * w + x] : p, D = y < h - 1 ? a[(y + 1) * w + x] : p;
      const C = x ? a[y * w + x - 1] : p, B = x < w - 1 ? a[y * w + x + 1] : p, i = y * 2 * w2 + x * 2;
      o[i] = C === A && C !== D && A !== B ? A : p;
      o[i + 1] = A === B && A !== C && B !== D ? B : p;
      o[i + w2] = D === C && D !== B && C !== A ? C : p;
      o[i + w2 + 1] = B === D && B !== A && D !== C ? D : p;
    }
    z.out.putImageData(z.img, 0, 0);
    const dx = ax - (ax - ox) * 2, dy = ay - (ay - oy) * 2;
    this.ctx.drawImage(z.dst, dx, dy);
    return (x, y) => [dx + (x - ox) * 2, dy + (y - oy) * 2];
  }

  birds(c, e, t) {
    if (e.dark > 0.5 || e.wet) return;
    for (let i = 0; i < 3; i++) {
      const x = Math.round(((t * (8 + i * 2) + i * 70) % (this.W + 40)) - 20), y = 20 + i * 7 + Math.round(Math.sin(t + i) * 2), f = Math.floor(t * 4 + i) % 2;
      c.fillStyle = css(mix([40, 40, 50], e.top, 0.3));
      c.fillRect(x - 2, y - f, 2, 1); c.fillRect(x, y, 1, 1); c.fillRect(x + 1, y - f, 2, 1);
    }
  }

  windowWeather(c, e, t, w) {
    if (!(e.wet || e.pal.snowy || e.weather === 'snow')) return;
    if (!this.flakes) this.flakes = Array.from({ length: 24 }, () => ({ x: Math.random(), y: Math.random(), v: 0.5 + Math.random() }));
    c.fillStyle = e.wet ? 'rgba(200,215,235,0.6)' : 'rgba(250,252,255,0.9)';
    for (const f of this.flakes) {
      f.y += (e.wet ? 1.4 : 0.12) * f.v * (1 / 12); if (f.y > 1) { f.y = 0; f.x = Math.random(); }
      c.fillRect(Math.round(w.x0 + f.x * (w.x1 - w.x0 - 1)), Math.round(w.y0 + f.y * (w.y1 - w.y0 - 2)), 1, e.wet ? 2 : 1);
    }
  }

  drawDynamic(e, dt) {
    const c = this.ctx, t = this.t, s = this.spots, T = this.T;
    const P = (h) => css(T(h));
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
    c.drawImage(this.bg, 0, 0);
    const k = KINDS[this.kind];
    if (k.clouds) this.drawClouds(e, dt);
    k.draw(c, this, e, t, s, P);
    if (k.outdoor && (e.wet || e.weather === 'snow' || e.pal.snowy)) this.drawRain(e, dt);
    if (k.outdoor && e.pal.drift.length) {
      if (!this.leaves) this.leaves = Array.from({ length: 14 }, () => ({ x: Math.random() * this.W, y: Math.random() * H, ph: Math.random() * 6 }));
      for (const p of this.leaves) {
        p.x += (3 + Math.sin(t * 2 + p.ph) * 4) * dt; p.y += 5 * dt;
        if (p.y > H || p.x > this.W) { p.y = -2; p.x = Math.random() * this.W; }
        c.fillStyle = P(e.pal.drift[Math.floor(p.ph) % e.pal.drift.length]); c.fillRect(Math.round(p.x), Math.round(p.y), Math.sin(t * 5 + p.ph) > 0 ? 2 : 1, 1);
      }
    }
    this.drawCelebration(dt);
  }

  hitTest() { return null; }
}
