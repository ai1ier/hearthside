// The meadow's quest board, up close: today's open quests pinned as notes.
import { html, useEffect } from '../vendor.js';
import { fmtTime, fmtDur, hash } from '../time.js';
import { completeQuest } from '../actions.js';
import { startFocus } from '../focus.js';
import { CATEGORIES } from '../defaults.js';

export function BoardModal({ data, focus, onOpen, onClose }) {
  const { dayPlan, offers } = data;
  const open = dayPlan.slots.filter((s) => !s.past);
  const accepted = dayPlan.quests;
  useEffect(() => {
    const f = (e) => e.key === 'Escape' && onClose();
    addEventListener('keydown', f); return () => removeEventListener('keydown', f);
  }, []);

  return html`<div class="modal-back" role="dialog" aria-modal="true" aria-label="Quest board" onClick=${(e) => e.target === e.currentTarget && onClose()}>
    <div class="corkboard">
      <div class="cork-head"><h2>📜 The Quest Board</h2><button class="btn sm" onClick=${onClose} aria-label="Close">✕</button></div>
      ${open.length ? html`<div class="notes">
        ${open.map((s, i) => {
          const top = offers[s.id]?.options.filter((o) => o.kind !== 'free').slice(0, 2) || [];
          const tilt = (hash(s.id) - 0.5) * 5;
          return html`<button class=${'pin-note' + (focus === i ? ' focus' : '')} style=${{ transform: `rotate(${tilt}deg)` }} onClick=${() => onOpen(s.id)}>
            <span class="pin"></span>
            <b>${fmtTime(s.start)} – ${fmtTime(s.end)}</b>
            <small>${fmtDur(s.minutes)} of open road</small>
            ${top.length ? top.map((o) => html`<span class="note-q" style=${{ '--c': (CATEGORIES[o.c.category] || {}).color }}>${o.c.icon} ${o.c.name}</span>`) : html`<span class="note-q">🍃 Free roaming</span>`}
            <span class="note-cta">Take this quest →</span>
          </button>`;
        })}
      </div>` : html`<p class="cork-empty">No open quests left today — the board rests, and so can you.</p>`}
      ${accepted.length ? html`<div class="cork-accepted">
        <h3>Accepted today</h3>
        ${accepted.map((q) => html`<div class="acc-row">
          <span>${q.icon} <b>${q.title}</b> <small>${fmtTime(q.start)}</small></span>
          ${q.done ? html`<span class="tag gold">✓ +${q.xp} XP</span>` : html`<span><button class="btn xs gold" onClick=${() => { onClose(); startFocus(q.id); }}>▶ Start</button><button class="btn xs" onClick=${() => completeQuest(q.id)}>✓ Complete</button></span>`}
        </div>`)}
      </div>` : null}
    </div>
  </div>`;
}
