import { html, useEffect, useRef, useState } from '../vendor.js';
import { drawSprite, resolveKeeper } from '../art/sprites.js';
import { store } from '../store.js';
import { CATEGORIES } from '../defaults.js';

export const keeperLabel = (p) => `${p.keeper?.name || 'Hoot'}${p.keeper?.title ? `, ${p.keeper.title}` : ''}`;

// The oracle's portrait: a recoloured preset or an uploaded picture, 16 logical px square.
export function Portrait({ keeper = null, scale = 4 }) {
  const ref = useRef();
  const k = keeper || store.get().profile.keeper;
  useEffect(() => {
    const c = ref.current.getContext('2d');
    c.clearRect(0, 0, 999, 999);
    if (k?.image) {
      const img = new Image();
      img.onload = () => {
        const f = Math.min(16 / img.width, 16 / img.height), w = img.width * f * scale, h = img.height * f * scale;
        c.imageSmoothingEnabled = false; c.clearRect(0, 0, 999, 999);
        c.drawImage(img, (16 * scale - w) / 2, 16 * scale - h, w, h);
      };
      img.src = k.image;
    } else drawSprite(c, resolveKeeper(k), 0, 0, scale);
  }, [JSON.stringify(k), scale]);
  return html`<canvas class="portrait" ref=${ref} width=${16 * scale} height=${16 * scale}></canvas>`;
}

// A 7×6 pixel heart with a 1px outline, drawn as crisp SVG rects.
const HEART = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'];
const HEART_CELLS = (() => {
  const fill = new Set(), out = [];
  HEART.forEach((r, y) => [...r].forEach((ch, x) => ch === '#' && fill.add(`${x + 1},${y + 1}`)));
  for (let y = 0; y < 8; y++) for (let x = 0; x < 9; x++) {
    const k = `${x},${y}`;
    if (fill.has(k)) out.push([x, y, (x === 2 && y === 2) || (x === 3 && y === 2) || (x === 2 && y === 3) ? 'hi' : y >= 5 || x >= 7 ? 'lo' : 'f']);
    else if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => fill.has(`${x + dx},${y + dy}`))) out.push([x, y, 'o']);
  }
  return out;
})();
export function PixelHeart({ full = true, px = 2 }) {
  const col = full ? { f: '#d9433a', lo: '#a82a26', hi: '#ff9a8a', o: '#4a1a14' } : { f: '#e2cfa8', lo: '#cdb88c', hi: '#f2e6cc', o: '#8a7050' };
  return html`<svg class="pheart" width=${9 * px} height=${8 * px} viewBox="0 0 9 8" shape-rendering="crispEdges" aria-hidden="true">
    ${HEART_CELLS.map(([x, y, t]) => html`<rect x=${x} y=${y} width="1" height="1" fill=${col[t]} />`)}</svg>`;
}
export function Hearts({ value, max = 5, px = 2 }) {
  return html`<span class="hearts" role="img" aria-label=${`${value} of ${max} stamina`}>${Array.from({ length: max }, (_, i) => html`<${PixelHeart} full=${i < value} px=${px} />`)}</span>`;
}

export function Meter({ value, max = 1, color, label }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return html`<div class="meter" title=${label || ''}><div class="meter-fill" style=${{ width: pct + '%', background: color }}></div></div>`;
}

export function loadColor(x) { return x > 0.58 ? '#c0392b' : x > 0.4 ? '#d98a2a' : x > 0.22 ? '#c9b33a' : '#5aa84a'; }

export function CatTag({ cat }) {
  const c = CATEGORIES[cat] || CATEGORIES.rest;
  return html`<span class="cat" style=${{ '--c': c.color }}>${c.icon} ${c.label}</span>`;
}

export function Difficulty({ intensity = 0, minutes = 30 }) {
  const n = Math.max(1, Math.min(5, Math.round(intensity + minutes / 50)));
  return html`<span class="stars" title="Difficulty">${'★'.repeat(n)}${'☆'.repeat(5 - n)}</span>`;
}

// tiny global toast
const listeners = new Set();
export function toast(msg) { listeners.forEach((f) => f(msg)); }
export function Toasts() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const f = (msg) => {
      const id = Math.random();
      setItems((x) => [...x, { id, msg }]);
      setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 3800);
    };
    listeners.add(f); return () => listeners.delete(f);
  }, []);
  return html`<div class="toasts" role="status">${items.map((i) => html`<div class="toast" key=${i.id}>${i.msg}</div>`)}</div>`;
}

export function Field({ label, children, hint }) {
  return html`<label class="field"><span class="field-label">${label}</span>${children}${hint ? html`<span class="hint">${hint}</span>` : null}</label>`;
}
