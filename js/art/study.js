// The study: shown while a quest is in focus. A window onto the real sky and season,
// a crackling hearth, a candle, a bookshelf, and your avatar at the desk.
import { Scene, H, hx2, mix, css, clamp, rng, frame, SKY, palette, Raster, heroCanvases } from './scene.js';
import { solarAltitude, realmClock } from './sky.js';

const SLEEPY_CAT = ['.k.k....', '.kkkkkk.', 'kkkkkkkk', '.kkkkkkk'];
const SPINES = ['#7a3a4a', '#3a5a7a', '#5a7a3a', '#8a6a2a', '#5b3a8c', '#2f6a6a', '#9a4a36', '#4a4a6a', '#c08a3a', '#6a2a4a'];

export class StudyScene extends Scene {
  env() {
    const { realm, date, season, weather } = this.input;
    const alt = solarAltitude(date, realm.lat, realm.lon);
    const wet = weather === 'rain' || weather === 'storm';
    const grey = wet ? 0.55 : weather === 'cloudy' || weather === 'fog' ? 0.3 : 0;
    let [top, bot] = frame(SKY, alt);
    const g = [120, 128, 142].map((v) => v * clamp((alt + 14) / 20, 0.2, 1));
    top = mix(top, g, grey); bot = mix(bot, g, grey * 0.8);
    const day = clamp((alt + 4) / 16, 0, 1) * (1 - grey * 0.35);
    // indoors: warm and dim at night, bright and neutral by day
    const amb = mix([0.5, 0.38, 0.33], [1, 0.97, 0.92], day);
    const pal = palette(season, realm.spring, realm.climate);
    return { realm, date, season, weather, alt, top, bot, amb, day, wet, grey, pal, dark: 1 - day, clock: realmClock(realm, date) };
  }

  frame(dt) {
    const e = this.env();
    this.loadAvatarImage();
    const key = [this.W, Math.round(e.alt * 2), e.season, e.weather, e.realm.id, JSON.stringify(this.input.avatar || {}), this.avImg?.ok, (this.input.books || []).join()].join('|');
    if (key !== this.key) { this.build(e); this.key = key; }
    this.drawDynamic(e, dt);
  }

  build(e) {
    const W = this.W, R = new Raster(W, H), rnd = rng(77);
    const tc = new Map();
    const T = (h) => { let c = tc.get(h); if (!c) { const b = hx2(h); c = b.map((v, i) => clamp(v * e.amb[i], 0, 255)); tc.set(h, c); } return c; };
    const s = (this.spots = {});
    const cx = Math.round(W * (W > 300 ? 0.44 : 0.5));
    s.cx = cx;

    // wall + wainscot
    for (let y = 0; y < 96; y++) for (let x = 0; x < W; x++) {
      if (y < 66) R.put(x, y, T(rnd() < 0.05 ? '#cdb48c' : '#dcc49e'));
      else if (y === 66 || y === 67) R.put(x, y, T('#5a3a22'));
      else R.put(x, y, T(x % 18 === 0 || x % 18 === 1 ? '#5e3c24' : y === 70 || y === 92 ? '#6e4a2e' : '#7e5434'));
    }
    // ceiling beam
    R.rect(0, 0, W, 5, T('#4a2f1d')); R.rect(0, 5, W, 1, T('#34210f'));

    // window with the outside world
    const wx0 = cx - 26, wx1 = cx + 26, wy0 = 12, wy1 = 62;
    const inArch = (x, y) => { const r = 26; if (y >= wy0 + r) return x >= wx0 && x <= wx1; const dy = wy0 + r - y; return (x - cx) ** 2 + dy * dy <= r * r; };
    const N = 10, steps = Array.from({ length: N }, (_, i) => mix(e.top, e.bot, i / (N - 1)));
    const hills = (x) => Math.round(50 + 3 * Math.sin(x * 0.09) + 2 * Math.sin(x * 0.23));
    for (let y = wy0 - 26; y <= wy1; y++) for (let x = wx0; x <= wx1; x++) {
      if (!inArch(x, y)) continue;
      const v = clamp((y - wy0 + 26) / (wy1 - wy0 + 26), 0, 1) * (N - 1), lo = Math.floor(v);
      let c = steps[Math.min(N - 1, (v - lo) * 16 > ((x * 7 + y * 3) & 15) ? lo + 1 : lo)];
      if (y >= hills(x)) c = mix(hx2(e.pal.snowy ? '#e6edf4' : e.pal.hill), e.bot, 0.35).map((v2, i) => v2 * clamp(e.day + 0.25, 0.3, 1) * (i === 2 ? 1.05 : 1));
      R.put(x, y, c);
    }
    // stars or sun in the window
    if (e.day < 0.4) { const sr = rng(3); for (let i = 0; i < 26; i++) { const x = wx0 + Math.floor(sr() * 52), y = wy0 - 20 + Math.floor(sr() * 50); if (inArch(x, y) && y < 46) R.put(x, y, [255, 250, 225], (1 - e.day) * 0.8 * (1 - e.grey)); } }
    else if (e.alt > 0 && !e.grey) R.disk(cx + 12, 24, 4, (x, y) => inArch(x, y) && R.put(x, y, [255, 240, 190]));
    // a seasonal branch reaching into the corner
    const leaf = e.pal.canopy.map(hx2);
    R.line(wx0, wy0 + 6, wx0 + 16, wy0 + 14, [70, 48, 32]);
    for (let i = 0; i < 26; i++) { const x = wx0 + 2 + Math.floor(rnd() * 16), y = wy0 + 2 + Math.floor(rnd() * 14); if (inArch(x, y)) R.put(x, y, mix(leaf[i % 3], e.top, 0.15).map((v) => v * clamp(e.day + 0.35, 0.35, 1))); }
    s.window = { x0: wx0, x1: wx1, y0: wy0 - 26, y1: wy1, inArch };
    // frame & mullions
    for (let y = wy0 - 28; y <= wy1 + 2; y++) for (let x = wx0 - 2; x <= wx1 + 2; x++) {
      if (inArch(x, y)) continue;
      const near = [[-2, 0], [2, 0], [0, -2], [0, 2], [-1, 0], [1, 0], [0, -1], [0, 1]].some(([dx, dy]) => inArch(x + dx, y + dy));
      if (near) R.put(x, y, T('#5a3a22'));
    }
    for (let y = wy0 - 25; y <= wy1; y++) R.put(cx, y, T('#5a3a22'));
    for (let x = wx0; x <= wx1; x++) R.put(x, wy0 + 20, T('#5a3a22'));
    // sill + plant
    R.rect(wx0 - 5, wy1 + 1, 63, 3, T('#7a4a2a')); R.rect(wx0 - 5, wy1 + 1, 63, 1, T('#9a6a3a'));
    R.rect(wx1 - 8, wy1 - 4, 6, 5, T('#b0603a')); R.rect(wx1 - 8, wy1 - 4, 6, 1, T('#c8784a'));
    for (const [dx, dy] of [[-1, -7], [1, -9], [3, -8], [5, -6], [0, -5], [4, -5], [2, -6]]) R.put(wx1 - 7 + dx, wy1 - 1 + dy, T('#4f8f3a'));
    if (e.pal.snowy) R.rect(wx0, wy1 - 1, 53, 2, [240, 246, 252]);
    // curtains
    for (const side of [-1, 1]) for (let y = 8; y < 70; y++) {
      const w = 7 + (y > 50 ? Math.min(4, (y - 50) / 4) : 0);
      for (let i = 0; i < w; i++) { const x = side < 0 ? wx0 - 4 - i : wx1 + 4 + i; R.put(x, y, T(i % 3 === 0 ? '#7a3446' : '#9a4a5e')); }
    }
    R.rect(wx0 - 14, 7, 81, 2, T('#3e2818'));
    s.lights = []; for (let x = 4; x < W; x += 5) s.lights.push({ x, y: 7 + Math.round(Math.sin(x * 0.18) * 2) + 3, p: x * 0.8 });

    // fireplace (left), bookshelf (right)
    if (W >= 205) {
      const fx = Math.max(4, Math.round(cx - 26 - 62));
      R.rect(fx, 46, 44, 50, T('#8d8478'));
      for (let y = 46; y < 96; y += 4) for (let x = fx + ((y / 4) % 2) * 4; x < fx + 44; x += 8) R.rect(x, y, 1, 4, T('#6a6258'));
      for (let y = 46; y < 96; y += 4) R.rect(fx, y, 44, 1, T('#6a6258'));
      R.rect(fx - 3, 44, 50, 3, T('#5a3a22'));
      R.rect(fx + 8, 64, 28, 32, T('#1e1410'));
      R.rect(fx + 10, 90, 24, 3, T('#4a3020')); R.rect(fx + 12, 88, 20, 2, T('#5e3c24'));
      // things on the mantel
      R.rect(fx + 4, 38, 3, 6, T('#e8e0d0')); R.rect(fx + 33, 37, 6, 7, T('#3a5a7a')); R.rect(fx + 34, 36, 4, 1, T('#d0b060'));
      s.fire = { x: fx + 22, y: 88 };
    }
    if (W >= 200) {
      const bx = Math.min(W - 54, cx + 26 + 22);
      R.rect(bx, 16, 48, 80, T('#5a3a22')); R.rect(bx + 2, 18, 44, 76, T('#3e2818'));
      const books = this.input.books || [];
      for (let row = 0; row < 4; row++) {
        const sy = 18 + row * 19;
        R.rect(bx + 2, sy + 17, 44, 2, T('#6e4a2e'));
        let x = bx + 3, k = 0;
        while (x < bx + 44) {
          const w = 2 + Math.floor(rnd() * 3), h = 10 + Math.floor(rnd() * 6);
          if (rnd() < 0.12 && x < bx + 38) { R.rect(x, sy + 17 - 5, 4, 5, T(['#7ab0c0', '#c07ab0', '#b0c07a'][row % 3])); R.rect(x + 1, sy + 17 - 7, 2, 2, T('#e0d8c8')); x += 5; continue; }
          const c = books.length && rnd() < 0.5 ? SPINES[Math.abs(hashStr(books[(k++) % books.length])) % SPINES.length] : SPINES[Math.floor(rnd() * SPINES.length)];
          R.rect(x, sy + 17 - h, w, h, T(c)); R.put(x, sy + 17 - h + 2, T('#e0c070'));
          x += w + (rnd() < 0.2 ? 1 : 0);
        }
      }
      for (const [dx, dy] of [[6, -3], [8, -5], [10, -3], [7, -2], [9, -4]]) R.put(bx + dx, 16 + dy, T('#4f8f3a'));
      R.rect(bx + 5, 14, 6, 2, T('#b0603a'));
    }

    // floor + rug
    for (let y = 96; y < H; y++) for (let x = 0; x < W; x++) R.put(x, y, T((y - 96) % 6 === 0 ? '#4a2f1d' : (x + (Math.floor((y - 96) / 6) * 13)) % 29 === 0 ? '#4a2f1d' : '#6b4a2e'));
    for (let y = 102; y < 117; y++) for (let x = cx - 50; x <= cx + 50; x++) {
      const d = ((x - cx) / 50) ** 2 + ((y - 109.5) / 7.5) ** 2;
      if (d <= 1) R.put(x, y, T(d > 0.75 ? '#e0b060' : d > 0.6 ? '#7a2a3a' : (x + y) % 6 === 0 ? '#c05a5a' : '#9a3a4a'));
    }

    // desk
    const dx0 = cx - 38, dx1 = cx + 38;
    R.rect(dx0 + 3, 81, 3, 18, T('#4a2f1d')); R.rect(dx1 - 6, 81, 3, 18, T('#4a2f1d'));
    R.rect(dx0 + 6, 84, dx1 - dx0 - 12, 8, T('#6b4026'));
    R.rect(dx0 + 10, 86, 14, 4, T('#7a4a2a')); R.put(dx0 + 17, 88, T('#e0c060')); R.rect(dx1 - 24, 86, 14, 4, T('#7a4a2a')); R.put(dx1 - 17, 88, T('#e0c060'));

    // avatar (seated behind the desk; only the upper body shows)
    const hero = heroCanvases(this.input, this.avImg, T, e.amb, this.dpx);
    const showH = Math.round(hero.h * 0.72);
    s.hero = { x: cx - Math.round(hero.w / 2) - 2, y: 75 - showH, w: hero.w, h: showH };
    this.heroCv = hero.cvs; this.heroHi = hero.hi;
    // desk top is drawn in the dynamic pass, in front of the avatar
    s.desk = { x0: dx0, x1: dx1, y: 78 };
    s.candle = { x: dx0 + 8, y: 70 };
    s.tea = { x: dx1 - 14, y: 74 };
    s.glass = { x: dx1 - 7, y: 66 };

    // sleepy cat on the rug
    if (this.input.avatar?.familiar !== false) {
      const fur = this.input.avatar?.familiarColor || '#2a2230';
      const cv = document.createElement('canvas'); cv.width = 8; cv.height = 4;
      const g = cv.getContext('2d');
      SLEEPY_CAT.forEach((row, j) => [...row].forEach((ch, i) => { if (ch === 'k') { g.fillStyle = css(T(fur)); g.fillRect(i, j, 1, 1); } }));
      this.catCv = cv;
      s.cat = { x: cx - 34, y: 105, w: 8, h: 4 };
    } else { this.catCv = null; s.cat = null; }

    // the desk itself, pre-rendered so it can sit in front of the avatar
    const dk = new Raster(dx1 - dx0 + 1, 8);
    for (let y = 0; y < 4; y++) for (let x = 0; x <= dx1 - dx0; x++) dk.put(x, y, T(y === 0 ? '#a8784a' : y === 3 ? '#5a3a22' : '#8a5a34'));
    this.deskCv = document.createElement('canvas'); this.deskCv.width = dx1 - dx0 + 1; this.deskCv.height = 8;
    this.deskCv.getContext('2d').putImageData(dk.img, 0, 0);
    this.T = T;

    const ctx = this.bg.getContext('2d');
    this.bg.width = W; this.bg.height = H;
    ctx.putImageData(R.img, 0, 0);
  }

  drawDynamic(e, dt) {
    const c = this.ctx, s = this.spots, t = this.t, T = this.T;
    const P = (h) => css(T(h));
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
    c.drawImage(this.bg, 0, 0);
    const prog = clamp(this.input.progress || 0, 0, 1);

    // weather outside the glass
    const win = s.window;
    if (e.wet || e.pal.snowy || e.weather === 'snow' || e.season === 'autumn' || e.season === 'spring') {
      if (!this.flakes) this.flakes = Array.from({ length: 40 }, () => ({ x: Math.random(), y: Math.random(), v: 0.5 + Math.random() }));
      for (const f of this.flakes) {
        const rain = e.wet;
        f.y += (rain ? 1.4 : 0.12) * f.v * dt; f.x += (rain ? -0.05 : Math.sin(t + f.v * 5) * 0.02) * dt;
        if (f.y > 1) { f.y = 0; f.x = Math.random(); }
        const x = Math.round(win.x0 + f.x * (win.x1 - win.x0)), y = Math.round(win.y0 + f.y * (win.y1 - win.y0));
        if (!win.inArch(x, y)) continue;
        c.fillStyle = rain ? 'rgba(200,215,235,0.55)' : e.season === 'autumn' ? '#d8782a' : e.season === 'spring' && !e.pal.snowy ? (e.realm.spring === 'sakura' ? '#f6b8cf' : '#b49af0') : 'rgba(250,252,255,0.9)';
        if (!rain && (e.season === 'spring' || e.season === 'autumn') && !e.pal.snowy && f.v > 1.1) continue; // fewer petals than raindrops
        c.fillRect(x, y, 1, rain ? 3 : 1);
      }
    }
    // a soft beam of daylight with dust motes
    if (e.day > 0.45 && !e.grey) {
      c.fillStyle = `rgba(255,240,200,${0.07 * e.day})`;
      c.beginPath(); c.moveTo(win.x0, win.y1); c.lineTo(win.x1, win.y1); c.lineTo(win.x1 + 30, 118); c.lineTo(win.x0 + 10, 118); c.fill();
      for (let i = 0; i < 10; i++) { const x = win.x0 + 6 + ((i * 13 + t * 3) % 60), y = win.y1 + 8 + ((i * 7 + t * 2) % 40); c.fillStyle = `rgba(255,245,210,${0.4 + 0.3 * Math.sin(t + i)})`; c.fillRect(Math.round(x), Math.round(y), 1, 1); }
    }

    // fairy lights under the beam
    const cols = ['255,214,122', '255,154,122', '255,242,176', '180,220,255'];
    s.lights.forEach((l, k) => { const a = 0.55 + 0.45 * Math.sin(t * 2 + l.p); c.fillStyle = `rgba(${cols[k % 4]},${a})`; c.fillRect(l.x, l.y, 1, 1); });

    // hearth fire
    if (s.fire) {
      const f = s.fire;
      for (let i = 0; i < 9; i++) {
        const h = 4 + Math.round(4 * Math.abs(Math.sin(t * 6 + i * 1.7)) + (i % 3));
        const x = f.x - 9 + i * 2;
        c.fillStyle = '#e0502a'; c.fillRect(x, f.y - h, 2, h);
        c.fillStyle = '#f2a03a'; c.fillRect(x, f.y - h + 2, 2, Math.max(1, h - 3));
        c.fillStyle = '#ffe08a'; c.fillRect(x + (i & 1), f.y - Math.max(1, h - 4), 1, Math.max(1, h - 5));
      }
      c.globalCompositeOperation = 'lighter';
      const g = c.createRadialGradient(f.x, f.y - 6, 0, f.x, f.y - 6, 40);
      g.addColorStop(0, `rgba(255,150,60,${0.22 + 0.05 * Math.sin(t * 8)})`); g.addColorStop(1, 'rgba(255,120,40,0)');
      c.fillStyle = g; c.fillRect(f.x - 40, f.y - 46, 80, 80);
      c.globalCompositeOperation = 'source-over';
    }

    // avatar at the desk, gently bobbing as she writes
    const h = s.hero, bob = this.input.phase === 'focus' ? Math.floor(t * 2) % 2 : 0;
    const hcv = this.heroCv[Math.floor(t * 10) % 41 === 0 || this.input.phase === 'break' ? 1 : 0];
    this.blitHero(c, hcv, h.x, h.y + bob, false, h.h);

    // desk and things on it
    const d = s.desk;
    c.drawImage(this.deskCv, d.x0, d.y);
    // open book
    c.fillStyle = P('#e8dcc0'); c.fillRect(d.x0 + 28, d.y - 2, 9, 2); c.fillRect(d.x0 + 38, d.y - 2, 9, 2);
    c.fillStyle = P('#f6eedc'); c.fillRect(d.x0 + 28, d.y - 3, 9, 1); c.fillRect(d.x0 + 38, d.y - 3, 9, 1);
    c.fillStyle = P('#5a3a22'); c.fillRect(d.x0 + 37, d.y - 3, 1, 3);
    // quill writing
    const qx = d.x0 + 42 + (this.input.phase === 'focus' ? Math.round(Math.sin(t * 5) * 2) : 0);
    c.fillStyle = P('#f6f2ea'); c.fillRect(qx, d.y - 8, 1, 5); c.fillRect(qx + 1, d.y - 9, 1, 3);
    // ink pot + book stack
    c.fillStyle = P('#2a2a3a'); c.fillRect(d.x0 + 50, d.y - 3, 3, 3);
    [['#7a3a4a', 0], ['#3a5a7a', 2], ['#8a6a2a', 4]].forEach(([col, i]) => { c.fillStyle = P(col); c.fillRect(d.x0 + 14 + (i % 3), d.y - 2 - i, 11, 2); });
    // candle
    const cd = s.candle;
    c.fillStyle = P('#efe6d2'); c.fillRect(cd.x, cd.y + 2, 3, 6);
    c.fillStyle = P('#8a6a46'); c.fillRect(cd.x - 1, cd.y + 7, 5, 1);
    const fl = Math.sin(t * 11) > 0 ? 1 : 0;
    c.fillStyle = '#ffd27a'; c.fillRect(cd.x + 1, cd.y - 1 - fl, 1, 3); c.fillStyle = '#fff6c8'; c.fillRect(cd.x + 1, cd.y + 1, 1, 1);
    c.globalCompositeOperation = 'lighter';
    const cg = c.createRadialGradient(cd.x + 1, cd.y, 0, cd.x + 1, cd.y, 26);
    cg.addColorStop(0, `rgba(255,190,90,${(0.18 + 0.25 * e.dark) * (0.9 + 0.1 * Math.sin(t * 9))})`); cg.addColorStop(1, 'rgba(255,170,60,0)');
    c.fillStyle = cg; c.fillRect(cd.x - 26, cd.y - 26, 52, 52);
    c.globalCompositeOperation = 'source-over';
    // tea with steam
    const tea = s.tea;
    c.fillStyle = P('#f2ece0'); c.fillRect(tea.x, tea.y, 5, 4); c.fillRect(tea.x + 5, tea.y + 1, 1, 2);
    c.fillStyle = P('#a0603a'); c.fillRect(tea.x + 1, tea.y, 3, 1);
    for (let i = 0; i < 3; i++) { const p = (t * 0.8 + i / 3) % 1; c.fillStyle = `rgba(240,240,240,${0.5 * (1 - p)})`; c.fillRect(tea.x + 2 + Math.round(Math.sin(p * 6 + i) * 1.5), tea.y - 2 - Math.round(p * 8), 1, 1); }
    // hourglass = progress
    const gl = s.glass, gh = 12, half = 5;
    c.fillStyle = P('#8a6a2a'); c.fillRect(gl.x - 1, gl.y, 7, 1); c.fillRect(gl.x - 1, gl.y + gh - 1, 7, 1);
    c.fillStyle = 'rgba(220,235,245,0.35)'; c.fillRect(gl.x, gl.y + 1, 5, gh - 2);
    const topSand = Math.round(half * (1 - prog)), botSand = Math.round(half * prog);
    c.fillStyle = '#e8c070';
    for (let j = 0; j < topSand; j++) c.fillRect(gl.x + (j < 2 ? 0 : 1), gl.y + 1 + (half - topSand) + j, j < 2 ? 5 : 3, 1);
    for (let j = 0; j < botSand; j++) c.fillRect(gl.x + (j > botSand - 3 ? 0 : 1), gl.y + gh - 2 - j, j > botSand - 3 ? 5 : 3, 1);
    if (prog < 1 && this.input.phase === 'focus' && Math.floor(t * 4) % 2) c.fillRect(gl.x + 2, gl.y + half + 1, 1, 1);

    // sleepy cat and its z's
    if (this.catCv && s.cat) {
      const breath = Math.floor(t * 0.8) % 2;
      c.drawImage(this.catCv, s.cat.x, s.cat.y - breath, 8, 4 + breath);
      const zp = (t * 0.35) % 1;
      c.fillStyle = `rgba(240,240,255,${1 - zp})`;
      const zx = s.cat.x + 7 + Math.round(zp * 4), zy = s.cat.y - 3 - Math.round(zp * 10);
      c.fillRect(zx, zy, 3, 1); c.fillRect(zx + 1, zy + 1, 1, 1); c.fillRect(zx, zy + 2, 3, 1);
    }
    if (this.hover?.type === 'cat' && s.cat) { c.strokeStyle = 'rgba(255,214,90,0.8)'; c.strokeRect(s.cat.x - 1.5, s.cat.y - 2.5, 11, 8); }
    this.drawCelebration(dt);
  }

  hitTest(clientX, clientY) {
    const s = this.spots; if (!s) return null;
    const r = this.cv.getBoundingClientRect();
    const x = (clientX - r.left) / this.scale, y = (clientY - r.top) / this.scale;
    const inR = (o, pad = 2) => o && x >= o.x - pad && x < o.x + o.w + pad && y >= o.y - pad && y < o.y + o.h + pad;
    if (inR(s.cat, 3)) return { type: 'cat' };
    if (inR(s.hero, 0)) return { type: 'hero' };
    return null;
  }

  petCat() { this.input.onPurr?.(); }
}

function hashStr(str) { let h = 0; for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0; return h; }
