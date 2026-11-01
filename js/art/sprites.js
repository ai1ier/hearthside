// Hand-placed pixel sprites. Each char maps to a palette entry; '.' is transparent.
// Avatars are recoloured from a few base colours, so every preset is customisable.

const hx = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const toHex = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
export const shade = (h, f) => toHex(hx(h).map((v) => (f > 1 ? v + (255 - v) * (f - 1) : v * f)));
export const blend = (a, b, t) => { const x = hx(a), y = hx(b); return toHex(x.map((v, i) => v + (y[i] - v) * t)); };

const WITCH = [
  '..........dd....',
  '.........dHd....',
  '........dHhd....',
  '.......dHHhd....',
  '......dHHHhd....',
  '......dHHHHhd...',
  '.....dBBBGBBd...',
  '.dddddHHHHHHdddd',
  'dHHHHHHHHHHHHHHd',
  '.dddRRRRRRRRddd.',
  '..RRRrSSSSrRRR..',
  '..RRSEESSEESRR..',
  '..RRSEeSSEeSRR..',
  '..RRPSSssSSPRR..',
  '..RRRSSSSSSRRR..',
  '..RRWWCCCCWWRR..',
  '...RcCCGCCCcR...',
  '..SCcCCCCCCcCS..',
  '...kCCCGCCCCk...',
  '...kCCCCCCCCk...',
  '..kkCCCCCCCCkk..',
  '..kkkkkkkkkkkk..',
  '.....LL..LL.....',
  '.....ll..ll.....',
  '....FFF..FFF....',
];
const WITCH_BLINK = WITCH.map((r, i) => (i === 11 ? '..RRSSSSSSSSRR..' : i === 12 ? '..RRSEESSEESRR..' : r));

const ADVENTURER = [
  '..hhhh..',
  '.hhhhhh.',
  '.hsssshh',
  '.sesses.',
  '..ssss..',
  '.cccccc.',
  'cccbcccc',
  'cdcbbcdc',
  '.cccccc.',
  '.ll..ll.',
  '.ll..ll.',
  '.ff..ff.',
];
const ADVENTURER_BLINK = ADVENTURER.map((r, i) => (i === 3 ? '.ssssss.' : r));

export const PRESETS = {
  witch: {
    label: 'Cute witch', rows: WITCH, blink: WITCH_BLINK, hand: [13, 18],
    slots: { hat: 'Hat', band: 'Hat band', hair: 'Hair', skin: 'Skin', eyes: 'Eyes', robe: 'Robe', collar: 'Collar & stripes', stockings: 'Stockings', boots: 'Boots' },
    colors: { hat: '#5b3a8c', band: '#e0a83a', hair: '#3b2618', skin: '#f1c9a5', eyes: '#2a1a14', robe: '#2f3a78', collar: '#f3e2c0', stockings: '#8a3a6e', boots: '#2a1e14' },
    pal: (c) => ({
      H: c.hat, h: shade(c.hat, 1.3), d: shade(c.hat, 0.6), B: c.band, G: shade(c.band, 1.4),
      R: c.hair, r: shade(c.hair, 1.35), S: c.skin, s: shade(c.skin, 0.72), P: blend(c.skin, '#f06a7a', 0.45),
      E: c.eyes, e: '#ffffff', W: c.collar, C: c.robe, c: shade(c.robe, 1.3), k: shade(c.robe, 0.65),
      L: c.stockings, l: c.collar, F: c.boots,
    }),
  },
  adventurer: {
    label: 'Adventurer', rows: ADVENTURER, blink: ADVENTURER_BLINK, hand: [8, 6],
    slots: { hair: 'Hair', skin: 'Skin', eyes: 'Eyes', cloak: 'Cloak', belt: 'Belt', legs: 'Legs', boots: 'Boots' },
    colors: { hair: '#3b2618', skin: '#f1c9a5', eyes: '#2a1a14', cloak: '#2f7f7a', belt: '#7a4a26', legs: '#3a3a55', boots: '#2a1e14' },
    pal: (c) => ({ h: c.hair, s: c.skin, e: c.eyes, c: c.cloak, d: shade(c.cloak, 0.7), b: c.belt, l: c.legs, f: c.boots }),
  },
};

export const CAT = {
  frames: [
    ['.k...k..', '.kk.kk..', '.kykyk..', '.kkkkk.k', '..kkkkk.', '..k.k.k.'],
    ['.k...k..', '.kk.kk..', '.kykyk..', '.kkkkkk.', '..kkkkk.', '..k.k.k.'],
  ],
  pal: (fur) => ({ k: fur, y: '#f2d23a' }),
};

export function defaultAvatar() {
  return { preset: 'witch', colors: { ...PRESETS.witch.colors }, familiar: true, familiarColor: '#2a2230', image: null };
}

// -> { rows, blink, pal, w, h, hand } for a sprite avatar (uploaded images are handled by the caller)
export function resolveAvatar(av) {
  const p = PRESETS[av?.preset] || PRESETS.witch;
  const colors = { ...p.colors, ...(av?.colors || {}) };
  return { rows: p.rows, blink: p.blink, pal: p.pal(colors), w: p.rows[0].length, h: p.rows.length, hand: p.hand };
}

const OWL_ROWS = [
  '..d..........d..',
  '..dd........dd..',
  '..dddddddddddd..',
  '.dmmmmmmmmmmmmd.',
  '.dmwwwmmmmwwwmd.',
  '.dwwyywmmwyywwd.',
  '.dwykywmmwykywd.',
  '.dwwyywbbwyywwd.',
  '.dmwwwmbbmwwwmd.',
  '.dmmmmmmmmmmmmd.',
  'ddmmllllllllmmdd',
  'dmmlllalallllmmd',
  'dmmllllllllllmmd',
  '.dmmllallallmmd.',
  '..dmmllllllmmd..',
  '...dddoo.oodd...',
];
const FOX_ROWS = [
  '.d............d.',
  '.dd..........dd.',
  '.dfd........dfd.',
  '.dfid......difd.',
  '.dfffddddddfffd.',
  'dffffffffffffffd',
  'dfffkeffffekfffd',
  'dfffkkffffkkfffd',
  'dwwffffffffffwwd',
  '.dwwwffkkffwwwd.',
  '..dwwwwwwwwwwd..',
  '...ddwwwwwwdd...',
  '..dccccccccccd..',
  '.dffcCccccCcffd.',
  '.dfffwwwwwwfffd.',
  '..dddd....dddd..',
];
const FROG_ROWS = [
  '......y..y......',
  '..ddd.yyyy.ddd..',
  '.dwwwd.yy.dwwwd.',
  '.dwkkwddddwkkwd.',
  'dgwkkwggggwkkwgd',
  'dggwwggggggwwggd',
  'dggggggggggggggd',
  'dgpggggggggggpgd',
  'dggmmmmmmmmmmggd',
  '.dggggggggggggd.',
  '.dgGGGGGGGGGGgd.',
  'dgGGGGGGGGGGGGgd',
  'dgGGGGGGGGGGGGgd',
  '.dgGGGGGGGGGGgd.',
  '.ddggddddddggdd.',
  'dgggd......dgggd',
];

// The oracle (Hoot by default) can be an owl, a fox or a frog, recoloured, or an uploaded picture.
export const KEEPERS = {
  owl: {
    label: 'Owl', species: 'owl', rows: OWL_ROWS,
    slots: { feathers: 'Feathers', face: 'Face', belly: 'Belly', eyes: 'Eyes', beak: 'Beak & feet' },
    colors: { feathers: '#8a6040', face: '#f3e2c0', belly: '#d9b98a', eyes: '#f2b632', beak: '#e09a2a' },
    pal: (c) => ({ d: shade(c.feathers, 0.55), m: c.feathers, w: c.face, y: c.eyes, k: '#1a120c', b: c.beak, o: c.beak, l: c.belly, a: shade(c.belly, 0.85) }),
  },
  fox: {
    label: 'Fox', species: 'fox', rows: FOX_ROWS,
    slots: { fur: 'Fur', muzzle: 'Muzzle', ears: 'Inner ears', eyes: 'Eyes', scarf: 'Scarf' },
    colors: { fur: '#d9772e', muzzle: '#f6ead2', ears: '#f0a0a0', eyes: '#2a1a14', scarf: '#3f7a5a' },
    pal: (c) => ({ d: shade(c.fur, 0.45), f: c.fur, w: c.muzzle, i: c.ears, k: c.eyes, e: '#ffffff', c: c.scarf, C: shade(c.scarf, 1.4) }),
  },
  frog: {
    label: 'Frog sage', species: 'frog', rows: FROG_ROWS,
    slots: { skin: 'Skin', belly: 'Belly', crown: 'Crown', eyes: 'Eyes' },
    colors: { skin: '#5f9e47', belly: '#d8e6a0', crown: '#f2c14a', eyes: '#1a120c' },
    pal: (c) => ({ d: shade(c.skin, 0.5), g: c.skin, G: c.belly, y: c.crown, w: '#ffffff', k: c.eyes, p: blend(c.skin, '#f06a7a', 0.5), m: shade(c.skin, 0.6) }),
  },
};

export function defaultKeeper() {
  return { name: 'Hoot', title: 'the Hearth Oracle', preset: 'owl', colors: { ...KEEPERS.owl.colors }, image: null };
}

// -> a drawSprite-ready { rows, pal, w } for the keeper's preset
export function resolveKeeper(k) {
  const p = KEEPERS[k?.preset] || KEEPERS.owl;
  return { rows: p.rows, pal: p.pal({ ...p.colors, ...(k?.colors || {}) }), w: 16, species: p.species };
}

export const OWL = resolveKeeper(null);

export function drawSprite(ctx, sp, x, y, scale = 1, tint = null) {
  sp.rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === '.' || !sp.pal[ch]) continue;
      ctx.fillStyle = tint ? tint(sp.pal[ch]) : sp.pal[ch];
      ctx.fillRect(x + i * scale, y + j * scale, scale, scale);
    }
  });
}

// Uploaded avatars stand about this many scene pixels tall (the witch is 25), drawn at their own pixels.
export const AVATAR_H = 25;

// Shrinks an uploaded picture to fit max×max; a large picture is smoothed down and its
// edges snapped back to hard pixels. Returns a PNG data URL.
export function pixelateUpload(file, max = 32) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / img.width, max / img.height);
      const w = Math.max(1, Math.round(img.width * k)), h = Math.max(1, Math.round(img.height * k));
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const g = cv.getContext('2d'); g.imageSmoothingEnabled = k < 0.5;
      g.drawImage(img, 0, 0, w, h);
      if (k < 0.5) {
        const d = g.getImageData(0, 0, w, h);
        for (let i = 3; i < d.data.length; i += 4) d.data[i] = d.data[i] < 110 ? 0 : 255;
        g.putImageData(d, 0, 0);
      }
      URL.revokeObjectURL(img.src);
      resolve(cv.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('That file could not be read as an image'));
    img.src = URL.createObjectURL(file);
  });
}
