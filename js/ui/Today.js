// Day view: the road (timeline) on the left, the quest board for a chosen slot on the right.
import { html, useState, useEffect } from '../vendor.js';
import { fmtTime, fmtDur, fmtDay, addDays, addMin, iso, minutesBetween, sameDay } from '../time.js';
import { placeName } from '../engine/plan.js';
import { makeQuest } from '../engine/suggest.js';
import { hootSays } from '../engine/index.js';
import { acceptQuest, completeQuest, abandonQuest } from '../actions.js';
import { isSignedIn } from '../calendar/google.js';
import { startFocus, celebrateQuest } from '../focus.js';
import { store } from '../store.js';
import { Portrait, Meter, CatTag, Difficulty, loadColor, Hearts, keeperLabel } from './common.js';
import { ENERGY } from './Checkin.js';
import { SPIRITS } from '../engine/suggest.js';
import { CATEGORIES } from '../defaults.js';

const MODE_ICON = { transit: '🚆', car: '🐎', walk: '🥾' };

export function Today({ state, data, day, setDay, onCheckin, onOracle, oracleBusy, sel, setSel }) {
  const { dayPlan, week, offers } = data;
  const open = dayPlan.slots.filter((s) => !s.past);
  const selected = offers[sel] ? sel : open[0]?.id;
  useEffect(() => { if (sel && !offers[sel]) setSel(null); }, [dayPlan.key]);
  useEffect(() => { if (sel) document.getElementById('slot-' + sel)?.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, [sel]);
  const hoot = hootSays(state, dayPlan, week);

  const mood = state.moods[iso(new Date())];
  const energy = ENERGY.find((e) => e.v === mood?.energy);
  const reading = state.oracle?.[dayPlan.key];
  const isToday = sameDay(day, new Date());
  const p = state.profile;

  return html`
    <section class="today">
      <div class="dayhead">
        <button class="btn sm" onClick=${() => setDay(addDays(day, -1))} aria-label="Previous day">◀</button>
        <h2>${fmtDay(day)}</h2>
        <button class="btn sm" onClick=${() => setDay(addDays(day, 1))} aria-label="Next day">▶</button>
        ${!isToday && html`<button class="btn sm ghost" onClick=${() => setDay(new Date())}>Today</button>`}
        <span class="grow"></span>
        <span class="load-chip" title="Share of waking hours already spoken for (events + travel)">
          Burden <${Meter} value=${dayPlan.load} color=${loadColor(dayPlan.load)} /> ${Math.round(dayPlan.load * 100)}%
        </span>
      </div>

      <div class="panel keeper">
        <${Portrait} scale=${3} />
        <div class="speech">
          <div class="speaker">${keeperLabel(state.profile)}${reading ? ' · reading the stars' : ''}</div>
          <p class="said" title=${reading?.narration || ''}>${reading?.narration || hoot.text} <span class="fortune">✦ ${hoot.fortune}</span></p>
          <div class="mood-row">
            ${mood && !mood.skipped && energy ? html`<span class="chip" title="Stamina"><${Hearts} value=${energy.v} /></span>` : null}
            ${mood?.spirit ? html`<span class="chip">${SPIRITS[mood.spirit].icon} ${SPIRITS[mood.spirit].label}</span>` : null}
            <span class="chip">${week.level.icon} ${week.level.name} week</span>
            <button class="btn sm ghost" onClick=${onCheckin}>${mood ? 'Change mood' : 'Check in'}</button>
            ${p.settings.useClaude && p.settings.claudeKey ? html`<button class="btn sm gold" disabled=${oracleBusy} onClick=${onOracle}>${oracleBusy ? '✨ Reading the stars…' : '✨ Ask the stars'}</button>` : null}
          </div>
        </div>
      </div>

      ${dayPlan.allDay.length ? html`<div class="banners">${dayPlan.allDay.map((e) => html`<div class="banner">📌 ${e.title}</div>`)}</div>` : null}

      <div class="cols">
        <div class="panel road">
          <h3>The Road</h3>
          <div class="timeline">
            <div class="tl-row wake"><span class="tl-time">${fmtTime(dayPlan.wake)}</span><div class="tl-mark">🌄 Rise</div></div>
            ${dayPlan.items.map((it) => html`<${Item} it=${it} p=${p} offers=${offers} selected=${selected} onSelect=${setSel} />`)}
            <div class="tl-row wake"><span class="tl-time">${fmtTime(dayPlan.sleep)}</span><div class="tl-mark">🌙 Rest</div></div>
          </div>
        </div>
        <div class="panel board">
          ${selected && offers[selected]
            ? html`<${Board} offer=${offers[selected]} p=${p} dayPlan=${dayPlan} onDone=${() => setSel(null)} />`
            : html`<div class="empty"><h3>Quest Board</h3><p>${dayPlan.slots.length ? 'All of today’s open time has passed. The board rests until tomorrow.' : 'No open stretches long enough for a quest. A full day — be kind to yourself.'}</p></div>`}
        </div>
      </div>
    </section>`;
}

function Item({ it, p, offers, selected, onSelect }) {
  const h = (min) => ({ minHeight: Math.max(34, Math.min(220, min * 0.75)) + 'px' });
  const mins = minutesBetween(it.start, it.end);
  if (it.kind === 'commute') {
    return html`<div class=${'tl-row commute' + (it.tight ? ' tight' : '')}>
      <span class="tl-time"></span>
      <div class="tl-commute">${MODE_ICON[p.travelMode] || '🚆'} ${fmtDur(it.minutes)} · ${placeName(p, it.from)} → ${placeName(p, it.to)}${it.tight ? ' · tight connection!' : ''}</div>
    </div>`;
  }
  if (it.kind === 'meal') {
    return html`<div class="tl-row meal"><span class="tl-time">${fmtTime(it.start)}</span><div class="tl-meal">🍲 ${it.title} · ${fmtDur(mins)}</div></div>`;
  }
  if (it.kind === 'event') {
    return html`<div class=${'tl-row' + (it.past ? ' lapsed' : '')}>
      <span class="tl-time">${fmtTime(it.start)}</span>
      <div class="tl-event" style=${h(mins)}>
        <b>${it.title}</b>
        <span>${fmtTime(it.start)}–${fmtTime(it.end)} · ${placeName(p, it.place)}</span>
        ${it.fitness ? html`<span class="tag">⚔️ counts as training</span>` : null}
      </div>
    </div>`;
  }
  if (it.kind === 'quest') {
    return html`<div class=${'tl-row' + (it.done ? ' done-row' : '')}>
      <span class="tl-time">${fmtTime(it.start)}</span>
      <div class=${'tl-quest' + (it.done ? ' done' : '')} style=${{ ...h(mins), '--c': (CATEGORIES[it.category] || {}).color }}>
        ${it.done && html`<span class="bloom" aria-hidden="true"></span>`}
        <div class="q-head"><span class="q-icon">${it.icon}</span><div><small>${it.flavor || 'Quest'}</small><b>${it.title}</b></div></div>
        <span>${fmtTime(it.start)}–${fmtTime(it.end)} · ${placeName(p, it.place)}${it.shower ? ` · incl. ${it.shower}m wash-up` : ''}</span>
        <div class="q-actions">
          ${it.done ? html`<span class="tag gold">✓ Completed · +${it.xp} XP</span>`
            : html`<button class="btn sm gold" onClick=${() => startFocus(it.id)}>▶ Start quest</button><button class="btn sm" onClick=${() => completeQuest(it.id)}>✓ Complete</button>`}
          <button class="btn sm ghost" onClick=${() => abandonQuest(it.id)}>${it.done ? 'Undo' : 'Abandon'}</button>
        </div>
      </div>
    </div>`;
  }
  // open slot
  const off = offers[it.id];
  const top = off?.options[0];
  if (it.past) return html`<div class="tl-row past"><span class="tl-time">${fmtTime(it.start)}</span>
    <button id=${'slot-' + it.id} class=${'tl-slot bygone' + (selected === it.id ? ' sel' : '')} style=${h(it.minutes)} onClick=${() => onSelect(it.id)} title="Did something here? Log it">
      <span><b>Bygone hours · ${fmtDur(it.minutes)}</b><small>✎ Log what you did</small></span>
    </button></div>`;
  return html`<div class="tl-row">
    <span class="tl-time">${fmtTime(it.start)}</span>
    <button id=${'slot-' + it.id} class=${'tl-slot' + (selected === it.id ? ' sel' : '')} style=${h(it.minutes)} onClick=${() => onSelect(it.id)}>
      <span class="bang">!</span>
      <span><b>Open quest · ${fmtDur(it.minutes)}</b>${it.isNow ? html` <span class="tag">now</span>` : null}
      ${top && top.kind !== 'free' ? html`<small>Suggested: ${top.c.icon} ${top.c.name}</small>` : html`<small>Free roaming</small>`}</span>
    </button>
  </div>`;
}

function Board({ offer, p, dayPlan, onDone }) {
  const { slot, options, ranked, past } = offer;
  const [more, setMore] = useState(false);
  const extra = ranked.filter((r) => !options.some((o) => o.key === r.key)).slice(0, past ? 20 : 8);
  return html`
    <div class="board-head">
      <h3>${past ? '✎ Log a bygone quest' : 'Quest Board'}</h3>
      ${past && html`<div class="sub small">Did something in these hours? Record it and claim the XP.</div>`}
      <div class="sub">${fmtTime(slot.start)} – ${fmtTime(slot.end)} · ${fmtDur(slot.minutes)} free</div>
      <div class="sub small">At ${placeName(p, slot.from)}${slot.next ? html` · then <b>${slot.next.title}</b> at ${fmtTime(slot.next.start)}` : ' · then home for the night'}</div>
    </div>
    <div class="cards">
      ${options.map((o, i) => html`<${QuestCard} key=${slot.id + o.key} o=${o} slot=${slot} p=${p} dayPlan=${dayPlan} best=${!past && i === 0 && o.kind !== 'free'} log=${past} onDone=${onDone} />`)}
    </div>
    ${extra.length ? html`<button class="link" onClick=${() => setMore(!more)}>${more ? 'Hide' : 'Show'} other quests (${extra.length})</button>` : null}
    ${more && html`<div class="cards compact">${extra.map((o) => html`<${QuestCard} key=${'x' + o.key} o=${o} slot=${slot} p=${p} dayPlan=${dayPlan} compact log=${past} onDone=${onDone} />`)}</div>`}`;
}

function QuestCard({ o, slot, p, dayPlan, best, compact, log, onDone }) {
  const [open, setOpen] = useState(false);
  const c = o.c;
  const free = o.kind === 'free';
  const durs = free ? [] : [...new Set([c.minMin, o.minutes, Math.min(c.maxMin, slot.minutes - o.tIn - o.tOut - o.shower)])].filter((x) => x >= c.minMin).sort((a, b) => a - b);
  const [mins, setMins] = useState(o.minutes);
  const latest = free ? slot.start : addMin(slot.end, -(o.tOut + mins + o.shower));
  const starts = [];
  for (let t = new Date(o.start); t <= latest && starts.length < 24; t = addMin(t, 15)) starts.push(t);
  const [startIdx, setStartIdx] = useState(0);
  const [toCal, setToCal] = useState(true);
  const canBegin = !log && !store.get().focus && o.tIn === 0 && slot.start - Date.now() < 15 * 60000 && slot.end - Date.now() > mins * 60000;

  if (free) {
    return html`<div class="qcard free">
      <div class="q-head"><span class="q-icon">${c.icon}</span><div><small>${o.title}</small><b>${c.name}</b></div></div>
      <p class="reason">${o.reasons[0].t}</p>
      <button class="btn sm ghost" onClick=${onDone}>Leave it open</button>
    </div>`;
  }
  return html`<div class=${'qcard' + (best ? ' best' : '') + (compact ? ' compact' : '')} style=${{ '--c': (CATEGORIES[c.category] || {}).color }}>
    ${best && html`<div class="ribbon">Innkeeper’s pick</div>`}
    <div class="q-head">
      <span class="q-icon">${c.icon}</span>
      <div><small>${o.title}</small><b>${c.name}</b>${c.sub ? html`<small>${c.sub}</small>` : null}</div>
    </div>
    <div class="q-meta"><${CatTag} cat=${c.category} /> <span>⏳ ${fmtDur(o.minutes)}</span> <${Difficulty} intensity=${c.intensity} minutes=${o.minutes} /> <span class="xp">+${o.xp} XP</span></div>
    ${o.oracle ? html`<p class="flavor">“${o.oracle.flavor}”</p><p class="reason good">🔮 ${o.oracle.why}</p>` : null}
    ${!compact && !log && html`<ul class="reasons">${o.reasons.slice(0, 5).map((r) => html`<li class=${r.tone}>${r.tone === 'warn' ? '⚠️' : r.tone === 'good' ? '✦' : '·'} ${r.t}</li>`)}</ul>`}
    ${!open ? html`<button class="btn sm gold" onClick=${() => setOpen(true)}>${log ? '✎ I did this' : 'Accept quest'}</button>` : log ? html`
      <div class="accept">
        ${durs.length > 1 && html`<div class="seg">${durs.map((d) => html`<button class=${'btn xs' + (d === mins ? ' on' : '')} onClick=${() => { setMins(d); setStartIdx(0); }}>${fmtDur(d)}</button>`)}</div>`}
        ${starts.length > 1 && html`<label class="inline">From <select value=${startIdx} onChange=${(e) => setStartIdx(+e.target.value)}>${starts.map((t, i) => html`<option value=${i}>${fmtTime(t)}</option>`)}</select></label>`}
        ${isSignedIn() && html`<label class="inline"><input type="checkbox" checked=${toCal} onChange=${(e) => setToCal(e.target.checked)} /> Add to Google Calendar</label>`}
        <div class="row">
          <button class="btn sm gold" onClick=${async () => { const q = makeQuest(o, dayPlan, { start: starts[startIdx] || o.start, minutes: mins }); await acceptQuest(q, { toCalendar: toCal, quiet: true }); celebrateQuest(q.id); onDone(); }}>✓ Mark done</button>
          <button class="btn sm ghost" onClick=${() => setOpen(false)}>Cancel</button>
        </div>
      </div>` : html`
      <div class="accept">
        ${durs.length > 1 && html`<div class="seg">${durs.map((d) => html`<button class=${'btn xs' + (d === mins ? ' on' : '')} onClick=${() => { setMins(d); setStartIdx(0); }}>${fmtDur(d)}</button>`)}</div>`}
        ${starts.length > 1 && html`<label class="inline">Start <select value=${startIdx} onChange=${(e) => setStartIdx(+e.target.value)}>${starts.map((t, i) => html`<option value=${i}>${fmtTime(t)}</option>`)}</select></label>`}
        ${isSignedIn() && html`<label class="inline"><input type="checkbox" checked=${toCal} onChange=${(e) => setToCal(e.target.checked)} /> Add to Google Calendar</label>`}
        <div class="row">
          ${canBegin && html`<button class="btn sm gold" onClick=${async () => { const q = makeQuest(o, dayPlan, { start: new Date(), minutes: mins }); await acceptQuest(q, { toCalendar: toCal }); startFocus(q.id); onDone(); }}>▶ Begin now</button>`}
          <button class=${'btn sm' + (canBegin ? '' : ' gold')} onClick=${() => { acceptQuest(makeQuest(o, dayPlan, { start: starts[startIdx] || o.start, minutes: mins }), { toCalendar: toCal }); onDone(); }}>${canBegin ? 'Seal for later' : 'Seal it ✦'}</button>
          <button class="btn sm ghost" onClick=${() => setOpen(false)}>Cancel</button>
        </div>
      </div>`}
  </div>`;
}
