// Long-term commitments (main quests) and the chronicle of finished quests.
import { html, useState } from '../vendor.js';
import { store } from '../store.js';
import { daysUntil, parseISODate, iso, addDays, fmtTime, fmtDur } from '../time.js';
import { Meter, Field } from './common.js';
import { abandonQuest } from '../actions.js';
import { startFocus, startGoalSession } from '../focus.js';

const TYPES = {
  deadline: { label: 'Deadline / exam', icon: '👑', hint: 'Needs prep hours spread out before a date' },
  event: { label: 'Event / trip', icon: '🧭', hint: 'A dated event with prep tasks to do ahead of time' },
  ongoing: { label: 'Ongoing goal', icon: '🌱', hint: 'A habit worked on every week' },
};

const setGoals = (fn) => store.setProfile((p) => ({ goals: fn(p.goals) }));
const patchGoal = (id, patch) => setGoals((gs) => gs.map((g) => (g.id === id ? { ...g, ...patch } : g)));

export function QuestLog({ state }) {
  const p = state.profile;
  const [adding, setAdding] = useState(null);
  const now = new Date();
  const upcoming = state.quests.filter((q) => !q.done && new Date(q.end) >= now).sort((a, b) => new Date(a.start) - new Date(b.start));
  const done = state.quests.filter((q) => q.done).sort((a, b) => new Date(b.start) - new Date(a.start));

  const add = (type) => {
    const id = 'g-' + Date.now().toString(36);
    const base = { id, type, title: '' };
    const g = type === 'deadline' ? { ...base, due: iso(addDays(now, 14)), hoursNeeded: 8, hoursDone: 0, sessionMin: 60, place: 'any' }
      : type === 'event' ? { ...base, due: iso(addDays(now, 30)), items: [] }
      : { ...base, weeklyTarget: 2, sessionMin: 30, linkedActivityId: '' };
    setGoals((gs) => [...gs, g]); setAdding(id);
  };

  return html`
    <section class="log">
      <div class="panel">
        <h3>👑 Main Quests — long-term commitments</h3>
        <p class="muted">These feed the board ahead of time: prep sessions for deadlines, tasks before trips, and weekly habits.${p.goals.some((g) => g.sample) ? ' The ones marked “sample” are examples — edit or remove them.' : ''}</p>
        <div class="goals">
          ${p.goals.map((g) => html`<${Goal} key=${g.id} g=${g} p=${p} quests=${state.quests} startOpen=${adding === g.id} />`)}
        </div>
        <div class="row">${Object.entries(TYPES).map(([k, t]) => html`<button class="btn sm" title=${t.hint} onClick=${() => add(k)}>+ ${t.icon} ${t.label}</button>`)}</div>
      </div>

      <div class="cols">
        <div class="panel">
          <h3>📜 Accepted quests</h3>
          ${upcoming.length ? html`<ul class="qlist">${upcoming.map((q) => html`<li>
            <span>${q.icon} <b>${q.title}</b> <small>${new Date(q.start).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })} · ${fmtTime(new Date(q.start))} · ${fmtDur(q.minutes)}</small></span>
            <span class="nowrap"><button class="btn xs gold" onClick=${() => startFocus(q.id)}>▶ Start</button><button class="btn xs ghost" onClick=${() => abandonQuest(q.id)}>Abandon</button></span></li>`)}</ul>`
            : html`<p class="muted">Nothing accepted yet.</p>`}
        </div>
        <div class="panel">
          <h3>📖 Chronicle · ${state.xp} XP</h3>
          ${done.length ? html`<ul class="qlist">${done.slice(0, 40).map((q) => html`<li><span>${q.icon} ${q.title} <small>${new Date(q.start).toLocaleDateString([], { day: 'numeric', month: 'short' })} · +${q.xp} XP</small></span></li>`)}</ul>`
            : html`<p class="muted">Your legend is yet unwritten. Complete a quest to begin it.</p>`}
        </div>
      </div>
    </section>`;
}

function Goal({ g, p, quests, startOpen }) {
  const [edit, setEdit] = useState(startOpen || false);
  const t = TYPES[g.type];
  const d = g.due ? daysUntil(new Date(), parseISODate(g.due)) : null;
  let progress = null;
  if (g.type === 'deadline') progress = html`<${Meter} value=${g.hoursDone} max=${g.hoursNeeded || 1} color="#b8892a" /> <small>${g.hoursDone}/${g.hoursNeeded}h prepared</small>`;
  if (g.type === 'event') { const n = g.items?.length || 0, k = g.items?.filter((i) => i.done).length || 0; progress = html`<${Meter} value=${k} max=${n || 1} color="#3a6fb0" /> <small>${k}/${n} prep tasks</small>`; }
  if (g.type === 'ongoing') progress = html`<small>${g.weeklyTarget}× a week, ${g.sessionMin}m each${g.linkedActivityId ? ` · via “${p.activities.find((a) => a.id === g.linkedActivityId)?.name || '?'}”` : ''}</small>`;

  return html`<div class=${'goal' + (g.done ? ' done' : '')}>
    <div class="goal-head">
      <span class="q-icon">${t.icon}</span>
      <div class="grow"><b>${g.title || 'Untitled quest'}</b> ${g.sample ? html`<span class="tag">sample</span>` : null}
        <small>${t.label}${d != null ? ` · ${d >= 0 ? `in ${d} days` : `${-d} days ago`} (${g.due})` : ''}</small>
        <div class="goal-prog">${progress}</div></div>
      ${!g.done && g.type !== 'event' && html`<button class="btn xs gold" onClick=${() => startGoalSession(g)} title=${`Start a ${g.sessionMin || 45}-minute focus session`}>▶ ${g.type === 'deadline' ? 'Start studying' : 'Start'}</button>`}
      <button class="btn xs ghost" onClick=${() => setEdit(!edit)}>${edit ? 'Close' : 'Edit'}</button>
    </div>
    ${g.type === 'event' && !edit && g.items?.length ? html`<ul class="subtasks">
      ${[...g.items].sort((a, b) => b.daysBefore - a.daysBefore).map((it) => {
        const by = addDays(parseISODate(g.due), -it.daysBefore);
        const left = daysUntil(new Date(), by);
        const st = it.done ? 'done' : left < 0 ? 'overdue' : left <= 4 ? 'soon' : 'later';
        const planned = quests.find((q) => q.itemId === it.id && !q.done);
        const when = by.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
        return html`<li class=${st}>
          <label><input type="checkbox" checked=${it.done} onChange=${(e) => patchGoal(g.id, { items: g.items.map((x) => (x.id === it.id ? { ...x, done: e.target.checked } : x)) })} />
            <span>${it.text || '(untitled task)'}</span></label>
          ${!it.done && html`<button class="btn xs" onClick=${() => startGoalSession(g, it)} aria-label=${`Start ${it.text}`}>▶</button>`}
          <small>${it.done ? 'done ✓' : left < 0 ? `overdue — was due ${when}` : left === 0 ? 'do today' : `by ${when}`} · ${it.minutes}m${planned ? ` · 📅 planned ${new Date(planned.start).toLocaleDateString([], { weekday: 'short' })} ${fmtTime(new Date(planned.start))}` : ''}</small>
        </li>`;
      })}
    </ul>` : null}
    ${g.type === 'event' && !edit && !g.items?.length ? html`<p class="muted subtask-empty">No prep tasks yet — press Edit to add some (packing, bookings, gifts…).</p>` : null}
    ${edit && html`<div class="goal-edit">
      <${Field} label="Title"><input value=${g.title} onInput=${(e) => patchGoal(g.id, { title: e.target.value, sample: false })} /></${Field}>
      ${g.type !== 'ongoing' && html`<${Field} label="Date"><input type="date" value=${g.due} onInput=${(e) => patchGoal(g.id, { due: e.target.value })} /></${Field}>`}
      ${g.type === 'deadline' && html`
        <${Field} label="Prep hours needed"><input type="number" min="0" step="0.5" value=${g.hoursNeeded} onInput=${(e) => patchGoal(g.id, { hoursNeeded: +e.target.value })} /></${Field}>
        <${Field} label="Hours done"><input type="number" min="0" step="0.5" value=${g.hoursDone} onInput=${(e) => patchGoal(g.id, { hoursDone: +e.target.value })} /></${Field}>
        <${Field} label="Session length (min)"><input type="number" min="15" step="15" value=${g.sessionMin} onInput=${(e) => patchGoal(g.id, { sessionMin: +e.target.value })} /></${Field}>`}
      ${g.type === 'ongoing' && html`
        <${Field} label="Sessions per week"><input type="number" min="1" value=${g.weeklyTarget} onInput=${(e) => patchGoal(g.id, { weeklyTarget: +e.target.value })} /></${Field}>
        <${Field} label="Session length (min)"><input type="number" min="10" step="5" value=${g.sessionMin} onInput=${(e) => patchGoal(g.id, { sessionMin: +e.target.value })} /></${Field}>
        <${Field} label="Done through activity" hint="Linking boosts that activity instead of adding a separate quest">
          <select value=${g.linkedActivityId || ''} onChange=${(e) => patchGoal(g.id, { linkedActivityId: e.target.value })}>
            <option value="">— its own quest —</option>${p.activities.map((a) => html`<option value=${a.id}>${a.icon} ${a.name}</option>`)}
          </select></${Field}>`}
      ${g.type === 'event' && html`<div class="items">
        ${(g.items || []).map((it) => html`<div class="item-row">
          <input type="checkbox" checked=${it.done} title="Done" onChange=${(e) => patchGoal(g.id, { items: g.items.map((x) => (x.id === it.id ? { ...x, done: e.target.checked } : x)) })} />
          <input class="grow" value=${it.text} placeholder="Prep task" onInput=${(e) => patchGoal(g.id, { items: g.items.map((x) => (x.id === it.id ? { ...x, text: e.target.value } : x)) })} />
          <label class="inline"><input type="number" min="0" value=${it.daysBefore} onInput=${(e) => patchGoal(g.id, { items: g.items.map((x) => (x.id === it.id ? { ...x, daysBefore: +e.target.value } : x)) })} /> days before</label>
          <label class="inline"><input type="number" min="5" step="5" value=${it.minutes} onInput=${(e) => patchGoal(g.id, { items: g.items.map((x) => (x.id === it.id ? { ...x, minutes: +e.target.value } : x)) })} /> min</label>
          <button class="btn xs ghost" aria-label="Remove task" onClick=${() => patchGoal(g.id, { items: g.items.filter((x) => x.id !== it.id) })}>✕</button>
        </div>`)}
        <button class="btn xs" onClick=${() => patchGoal(g.id, { items: [...(g.items || []), { id: 'i' + Date.now().toString(36), text: '', daysBefore: 3, minutes: 30, done: false }] })}>+ prep task</button>
      </div>`}
      <div class="row">
        <button class="btn xs" onClick=${() => patchGoal(g.id, { done: !g.done })}>${g.done ? 'Reopen' : 'Mark fulfilled'}</button>
        <button class="btn xs danger" onClick=${() => setGoals((gs) => gs.filter((x) => x.id !== g.id))}>Delete</button>
      </div>
    </div>`}
  </div>`;
}
