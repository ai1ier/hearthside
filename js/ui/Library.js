// The Library: a diary of what happened, a shelf of books/shows/films, and Hoot's chronicle.
import { html, useState } from '../vendor.js';
import { store } from '../store.js';
import { iso, parseISODate, startOfWeek, addDays, hash, fmtDur } from '../time.js';
import { CATEGORIES } from '../defaults.js';
import { PixelHeart, Portrait, toast } from './common.js';
import { writeChronicle } from '../ai/claude.js';

export const KINDS = {
  book: { label: 'Book', icon: '📖', by: 'Author', doing: 'Reading', done: 'Read' },
  show: { label: 'Show', icon: '📺', by: 'Network / creator', doing: 'Watching', done: 'Watched' },
  film: { label: 'Film', icon: '🎬', by: 'Director', doing: 'Watching', done: 'Watched' },
  game: { label: 'Game', icon: '🎮', by: 'Studio', doing: 'Playing', done: 'Played' },
  other: { label: 'Other', icon: '✨', by: 'By', doing: 'In progress', done: 'Done' },
};
const STATUS = { doing: 'In progress', done: 'Finished', want: 'Want to' };
const SPINES = ['#7a3a4a', '#3a5a7a', '#5a7a3a', '#8a6a2a', '#5b3a8c', '#2f6a6a', '#9a4a36', '#4a4a6a', '#6a3a2a'];
const uid = () => Date.now().toString(36) + Math.floor(Math.random() * 1e4);

function Rating({ value = 0, onChange }) {
  return html`<span class="rating">${[1, 2, 3, 4, 5].map((v) => html`<button type="button" class="heart-btn" aria-label=${`Rate ${v}`} onClick=${() => onChange?.(v === value ? 0 : v)} disabled=${!onChange}><${PixelHeart} full=${v <= value} px=${2} /></button>`)}</span>`;
}

export function Library({ state }) {
  return html`
    <section class="library">
      <div class="cols lib-cols">
        <${Diary} state=${state} />
        <div>
          <${Chronicle} state=${state} />
          <${Shelf} state=${state} />
        </div>
      </div>
    </section>`;
}

// ---------------- diary ----------------
function Diary({ state }) {
  const [date, setDate] = useState(iso(new Date()));
  const [text, setText] = useState('');
  const [editing, setEditing] = useState(null);
  const save = () => {
    if (!text.trim()) return;
    store.set((s) => ({ diary: [...s.diary, { id: uid(), date, text: text.trim(), at: Date.now() }] }));
    setText(''); toast('📔 Written in your diary');
  };

  // Group diary entries, finished quests and finished shelf items by day.
  const days = {};
  const add = (d, k, v) => { (days[d] ||= { notes: [], quests: [], shelf: [] })[k].push(v); };
  state.diary.forEach((e) => add(e.date, 'notes', e));
  state.quests.filter((q) => q.done).forEach((q) => add(q.date, 'quests', q));
  state.library.filter((i) => i.status === 'done' && i.finished).forEach((i) => add(i.finished, 'shelf', i));
  const keys = Object.keys(days).sort().reverse().slice(0, 30);

  return html`<div class="panel diary">
    <h3>📔 Diary</h3>
    <div class="diary-form">
      <div class="row"><input type="date" value=${date} onInput=${(e) => setDate(e.target.value)} aria-label="Entry date" /></div>
      <textarea rows="4" placeholder="What happened today? A good moment, a small win, something funny…" value=${text} onInput=${(e) => setText(e.target.value)}
        onKeyDown=${(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save(); }}></textarea>
      <div class="row"><button class="btn sm gold" onClick=${save} disabled=${!text.trim()}>✒️ Write it down</button><small class="hint">⌘/Ctrl + Enter</small></div>
    </div>
    ${keys.length ? keys.map((k) => html`<div class="diary-day">
      <div class="diary-date">${parseISODate(k).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}</div>
      ${days[k].notes.map((n) => editing === n.id
        ? html`<div class="note"><textarea rows="3" value=${n.text} onInput=${(e) => store.set((s) => ({ diary: s.diary.map((x) => (x.id === n.id ? { ...x, text: e.target.value } : x)) }))}></textarea>
            <div class="row"><button class="btn xs" onClick=${() => setEditing(null)}>Done</button><button class="btn xs danger" onClick=${() => { store.set((s) => ({ diary: s.diary.filter((x) => x.id !== n.id) })); setEditing(null); }}>Delete</button></div></div>`
        : html`<p class="note" onClick=${() => setEditing(n.id)} title="Click to edit">${n.text}</p>`)}
      ${days[k].quests.length || days[k].shelf.length ? html`<div class="chips">
        ${days[k].quests.map((q) => html`<span class="chip" style=${{ borderColor: (CATEGORIES[q.category] || {}).color }}>✓ ${q.icon} ${q.title}</span>`)}
        ${days[k].shelf.map((i) => html`<span class="chip gold">${KINDS[i.kind].icon} Finished ${i.title}</span>`)}
      </div>` : null}
    </div>`) : html`<p class="muted">Your diary is waiting for its first page. Completed quests and finished books will appear here too.</p>`}
  </div>`;
}

// ---------------- chronicle ----------------
function range(kind, now = new Date()) {
  if (kind === 'week') { const f = startOfWeek(now); return { from: f, to: addDays(f, 7), key: `week:${iso(f)}`, label: 'this week' }; }
  if (kind === 'last') { const f = addDays(startOfWeek(now), -7); return { from: f, to: addDays(f, 7), key: `week:${iso(f)}`, label: 'last week' }; }
  const f = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: f, to: new Date(now.getFullYear(), now.getMonth() + 1, 1), key: `month:${iso(f).slice(0, 7)}`, label: 'this month' };
}

function gather(state, r) {
  const inR = (d) => d >= r.from && d < r.to;
  return {
    quests: state.quests.filter((q) => q.done && inR(new Date(q.start))),
    finished: state.library.filter((i) => i.status === 'done' && i.finished && inR(parseISODate(i.finished))),
    ongoing: state.library.filter((i) => i.status === 'doing'),
    notes: state.diary.filter((e) => inR(parseISODate(e.date))).sort((a, b) => a.date.localeCompare(b.date)),
  };
}

function ruleSummary(g, r) {
  const out = [];
  if (g.quests.length) {
    const byCat = {};
    g.quests.forEach((q) => { byCat[q.category] = (byCat[q.category] || 0) + 1; });
    const top = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k]) => CATEGORIES[k]?.label || k);
    const mins = g.quests.reduce((n, q) => n + q.minutes, 0);
    out.push(`You completed ${g.quests.length} quest${g.quests.length > 1 ? 's' : ''} ${r.label} — mostly ${top.join(' and ')} — ${fmtDur(mins)} of time well spent.`);
  } else out.push(`No quests completed ${r.label} yet — and that’s alright. Rest is part of every good story.`);
  if (g.finished.length) out.push(`You finished ${g.finished.map((i) => `${KINDS[i.kind].icon} ${i.title}`).join(', ')}.`);
  if (g.ongoing.length) out.push(`Still on your nightstand: ${g.ongoing.slice(0, 3).map((i) => `${KINDS[i.kind].icon} ${i.title}`).join(', ')}.`);
  if (g.notes.length) {
    const firsts = g.notes.slice(-3).map((n) => n.text.split(/(?<=[.!?])\s/)[0].slice(0, 90));
    out.push(`From your diary: ${firsts.map((t) => `“${t}”`).join(' · ')}`);
  }
  return out;
}

function Chronicle({ state }) {
  const [kind, setKind] = useState('week');
  const [busy, setBusy] = useState(false);
  const kn = state.profile.keeper?.name || 'Hoot';
  const r = range(kind);
  const g = gather(state, r);
  const saved = state.summaries[r.key];
  const s = state.profile.settings;
  const ask = async () => {
    setBusy(true);
    try {
      const payload = {
        player: state.profile.name, period: `${r.label} (${iso(r.from)} to ${iso(addDays(r.to, -1))})`,
        diary: g.notes.map((n) => ({ date: n.date, text: n.text })),
        questsCompleted: g.quests.map((q) => ({ date: q.date, title: q.title, category: q.category, minutes: q.minutes })),
        finished: g.finished.map((i) => ({ kind: i.kind, title: i.title, by: i.by, rating: i.rating, note: i.note })),
        inProgress: g.ongoing.map((i) => ({ kind: i.kind, title: i.title })),
      };
      const text = await writeChronicle(s.claudeKey, payload);
      store.set((st) => ({ summaries: { ...st.summaries, [r.key]: { text, at: Date.now() } } }));
    } catch (e) { toast(`${kn}: ${e.message}`); }
    setBusy(false);
  };
  return html`<div class="panel chronicle">
    <h3>📜 ${kn}’s chronicle</h3>
    <div class="seg">${[['week', 'This week'], ['last', 'Last week'], ['month', 'This month']].map(([k, l]) => html`<button class=${'btn xs' + (kind === k ? ' on' : '')} onClick=${() => setKind(k)}>${l}</button>`)}</div>
    <div class="keeper-row chron-body">
      <${Portrait} scale=${3} />
      <div class="speech">
        ${saved ? saved.text.split(/\n+/).map((p) => html`<p>${p}</p>`) : ruleSummary(g, r).map((p) => html`<p>${p}</p>`)}
      </div>
    </div>
    ${s.useClaude && s.claudeKey ? html`<div class="row">
      <button class="btn sm gold" disabled=${busy} onClick=${ask}>${busy ? `✨ ${kn} is writing…` : saved ? '✨ Rewrite the story' : `✨ Have ${kn} write it as a story`}</button>
      ${saved && html`<button class="btn sm ghost" onClick=${() => store.set((st) => { const x = { ...st.summaries }; delete x[r.key]; return { summaries: x }; })}>Show the simple summary</button>`}
    </div>` : html`<small class="hint">Add a Claude key in Settings → Calendar & stars to have ${kn} write this as a story from your diary.</small>`}
  </div>`;
}

// ---------------- shelf ----------------
function Shelf({ state }) {
  const [filter, setFilter] = useState('all');
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState(null);
  const items = state.library.filter((i) => filter === 'all' || i.kind === filter);
  const setItem = (id, patch) => store.set((s) => ({ library: s.library.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
  const groups = ['doing', 'done', 'want'].map((st) => [st, items.filter((i) => i.status === st)]).filter(([, l]) => l.length);
  const sel = state.library.find((i) => i.id === open);

  return html`<div class="panel shelf">
    <h3>📚 Shelf</h3>
    <div class="row">
      ${[['all', 'All', '🗂️'], ...Object.entries(KINDS).map(([k, v]) => [k, v.label + 's', v.icon])].map(([k, l, ic]) => html`<button class=${'btn xs' + (filter === k ? ' on' : '')} onClick=${() => setFilter(k)}>${ic} ${l}</button>`)}
      <span class="grow"></span>
      <button class="btn sm gold" onClick=${() => setAdding(!adding)}>${adding ? 'Close' : '+ Add'}</button>
    </div>
    ${adding && html`<${ItemForm} onSave=${(it) => { store.set((s) => ({ library: [...s.library, { ...it, id: uid(), at: Date.now() }] })); setAdding(false); toast(`${KINDS[it.kind].icon} Added to your shelf`); }} />`}
    ${groups.length ? groups.map(([st, list]) => html`<div class="shelf-group">
      <div class="shelf-label">${STATUS[st]}</div>
      <div class="shelf-row">
        ${list.map((i) => {
          const c = SPINES[Math.floor(hash(i.title) * SPINES.length)];
          return html`<button class=${'spine ' + i.kind + (open === i.id ? ' sel' : '')} style=${{ '--c': c, height: 128 + Math.floor(hash(i.id) * 28) + 'px' }} onClick=${() => setOpen(open === i.id ? null : i.id)} title=${i.title}>
            <span class="spine-icon">${KINDS[i.kind].icon}</span><span class="spine-title">${i.title}</span>${i.rating ? html`<span class="spine-r">${'♥'.repeat(i.rating)}</span>` : null}
          </button>`;
        })}
      </div>
      <div class="plank"></div>
    </div>`) : html`<p class="muted">Empty shelves, full of possibility. Add a book you’re reading or a show you’ve watched.</p>`}
    ${sel && html`<${ItemForm} key=${sel.id} item=${sel} onSave=${(it) => { setItem(sel.id, it); setOpen(null); }} onDelete=${() => { store.set((s) => ({ library: s.library.filter((x) => x.id !== sel.id) })); setOpen(null); }} />`}
  </div>`;
}

function ItemForm({ item, onSave, onDelete }) {
  const [f, setF] = useState(item || { kind: 'book', title: '', by: '', status: 'doing', rating: 0, finished: '', note: '' });
  const k = KINDS[f.kind];
  const up = (patch) => setF((x) => ({ ...x, ...patch }));
  return html`<div class="item-form">
    <div class="grid2">
      <label class="field"><span class="field-label">Type</span><select value=${f.kind} onChange=${(e) => up({ kind: e.target.value })}>${Object.entries(KINDS).map(([key, v]) => html`<option value=${key}>${v.icon} ${v.label}</option>`)}</select></label>
      <label class="field"><span class="field-label">Status</span><select value=${f.status} onChange=${(e) => up({ status: e.target.value, finished: e.target.value === 'done' && !f.finished ? iso(new Date()) : f.finished })}>
        <option value="doing">${k.doing}</option><option value="done">${k.done} / finished</option><option value="want">Want to</option></select></label>
      <label class="field"><span class="field-label">Title</span><input value=${f.title} onInput=${(e) => up({ title: e.target.value })} /></label>
      <label class="field"><span class="field-label">${k.by}</span><input value=${f.by} onInput=${(e) => up({ by: e.target.value })} /></label>
      ${f.status === 'done' && html`<label class="field"><span class="field-label">Finished on</span><input type="date" value=${f.finished} onInput=${(e) => up({ finished: e.target.value })} /></label>`}
      <div class="field"><span class="field-label">Rating</span><${Rating} value=${f.rating} onChange=${(v) => up({ rating: v })} /></div>
    </div>
    <label class="field"><span class="field-label">Thoughts</span><textarea rows="2" value=${f.note} onInput=${(e) => up({ note: e.target.value })} placeholder="A line you loved, how it made you feel…"></textarea></label>
    <div class="row">
      <button class="btn sm gold" disabled=${!f.title.trim()} onClick=${() => onSave({ ...f, title: f.title.trim() })}>${item ? 'Save' : 'Place on shelf'}</button>
      ${onDelete && html`<button class="btn sm danger" onClick=${onDelete}>Remove</button>`}
    </div>
  </div>`;
}
