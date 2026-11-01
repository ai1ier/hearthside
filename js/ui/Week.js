// Week view: the omen (busyness), balance of quest types, and a 7-day map.
import { html } from '../vendor.js';
import { store } from '../store.js';
import { addDays, fmtDur, fmtTime, iso, minutesBetween, sameDay, atTime } from '../time.js';
import { weekReading, categoryBalance } from '../engine/index.js';
import { buildDay } from '../engine/plan.js';
import { Meter, loadColor } from './common.js';
import { OUTLOOK } from './Checkin.js';
import { CATEGORIES } from '../defaults.js';

const BODY_PX = 600; // height of a day column; keep in sync with .wbody

export function Week({ state, events, week, offersFor, onPickDay, setDay, day }) {
  const reading = weekReading(state, week, events);
  const balance = categoryBalance(state, week).filter((b) => b.minutes > 0);
  const wm = state.weekMoods[week.key];
  const maxBal = Math.max(60, ...balance.map((b) => b.minutes));
  const first = Math.min(...week.days.map((d) => d.wake.getHours()));
  const last = Math.max(...week.days.map((d) => d.sleep.getHours() + (d.sleep.getDate() !== d.wake.getDate() ? 24 : 0) + 1));
  const span = (last - first) * 60;
  const top = (d, t) => (minutesBetween(atTime(d.date, `${first}:00`), t) / span) * 100;

  return html`
    <section class="week">
      <div class="dayhead">
        <button class="btn sm" onClick=${() => setDay(addDays(day, -7))} aria-label="Previous week">◀</button>
        <h2>Week of ${week.monday.toLocaleDateString([], { month: 'long', day: 'numeric' })}</h2>
        <button class="btn sm" onClick=${() => setDay(addDays(day, 7))} aria-label="Next week">▶</button>
        ${!week.days.some((d) => sameDay(d.date, new Date())) && html`<button class="btn sm ghost" onClick=${() => setDay(new Date())}>This week</button>`}
      </div>

      <div class="cols week-top">
        <div class="panel omen">
          <h3>${week.level.icon} The Omen: ${week.level.name}</h3>
          <div class="load-chip">Week burden <${Meter} value=${week.avgLoad} color=${loadColor(week.avgLoad)} /> ${Math.round(week.avgLoad * 100)}%</div>
          <ul class="reading">${reading.map((r) => html`<li><span>${r.icon}</span> ${r.t}</li>`)}</ul>
          <div class="outlook">
            <span>Your outlook:</span>
            ${OUTLOOK.map((o) => html`<button class=${'btn xs' + (wm?.outlook === o.v ? ' on' : '')} title=${o.hint}
              onClick=${() => store.set((s) => ({ weekMoods: { ...s.weekMoods, [week.key]: { outlook: o.v, at: Date.now() } } }))}>${o.icon} ${o.label}</button>`)}
          </div>
        </div>
        <div class="panel balance">
          <h3>Quest balance</h3>
          ${balance.length ? balance.map((b) => html`<div class="bal-row"><span>${b.icon} ${b.label}</span><${Meter} value=${b.minutes} max=${maxBal} color=${b.color} /><span class="n">${fmtDur(b.minutes)}</span></div>`)
            : html`<p class="muted">No quests accepted this week yet. Open a day and claim one from the board.</p>`}
        </div>
      </div>

      <div class="panel weekmap">
        <div class="wgrid">
          ${week.days.map((d) => {
            const off = offersFor(d);
            return html`<button class=${'wcol' + (sameDay(d.date, new Date()) ? ' today' : '')} onClick=${() => onPickDay(d.date)}>
              <div class="whead">
                <b>${d.date.toLocaleDateString([], { weekday: 'short' })}</b> <span>${d.date.getDate()}</span>
                <${Meter} value=${d.load} color=${loadColor(d.load)} />
                <small>${fmtDur(d.free)} free</small>
              </div>
              <div class="wbody">
                ${d.items.map((it) => {
                  if (!['event', 'commute', 'quest', 'slot'].includes(it.kind)) return null;
                  const t0 = top(d, it.start), h = Math.max(1.2, top(d, it.end) - t0);
                  const s = off[it.id]?.options[0];
                  const px = (h * BODY_PX) / 100, lines = Math.max(1, Math.floor((px - 6) / 11));
                  return html`<div class=${'wblk ' + it.kind + (it.past ? ' past' : '')} style=${{ top: t0 + '%', height: h + '%', '--c': it.kind === 'quest' ? (CATEGORIES[it.category] || {}).color : undefined }}
                    title=${`${fmtTime(it.start)}–${fmtTime(it.end)} ${it.title || (it.kind === 'slot' ? 'Open quest' : 'Travel')}`}>
                    ${it.kind === 'event' && px >= 15 ? html`<span class="wtxt" style=${{ WebkitLineClamp: lines }}>${it.title}</span>` : null}
                    ${it.kind === 'quest' && px >= 13 ? html`<span class="wtxt" style=${{ WebkitLineClamp: lines }}>${it.icon} ${it.title}</span>` : null}
                    ${it.kind === 'slot' && !it.past && h > 3 ? html`<span>${s && s.kind !== 'free' ? s.c.icon : '!'}</span>` : null}
                  </div>`;
                })}
              </div>
            </button>`;
          })}
        </div>
        <div class="legend"><span class="lg event"></span>Engagement <span class="lg commute"></span>Travel <span class="lg quest"></span>Accepted quest <span class="lg slot"></span>Open quest</div>
      </div>
    </section>`;
}
