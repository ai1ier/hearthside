// Turns calendar events into a day timeline: events, commutes, meals and the
// free slots between them ("open quests"). Also measures how loaded a day/week is.
import { MIN, addDays, addMin, startOfDay, startOfWeek, atTime, dayBounds, iso, hhmm, minutesBetween, ceilTo, period } from '../time.js';

export const HERE = '@here', OUT = '@out';

export const LOAD_LEVELS = [
  { level: 0, max: 0.22, name: 'Calm Seas', icon: '🌤️', blurb: 'An open road. A fine week for bold quests.' },
  { level: 1, max: 0.40, name: 'Fair Winds', icon: '⛅', blurb: 'A balanced week — steady progress, steady rest.' },
  { level: 2, max: 0.58, name: 'Gathering Storm', icon: '🌧️', blurb: 'A crowded week. Keep quests light and guard your rest.' },
  { level: 3, max: Infinity, name: 'Tempest', icon: '⛈️', blurb: 'A brutal week. Survive it — rest is the main quest.' },
];
export const loadLevel = (x) => LOAD_LEVELS.find((l) => x <= l.max);

export function realmPlaces(profile) { return profile.places.filter((p) => p.realm === profile.realm || p.realm === 'any'); }
export function homePlace(profile) { return realmPlaces(profile).find((p) => p.isHome) || { id: 'home', name: 'Home', fromHome: 0, isHome: true, keywords: [] }; }
export function placeById(profile, id) { return profile.places.find((p) => p.id === id); }
export function placeName(profile, id) {
  if (id === OUT) return 'Elsewhere';
  if (id === HERE) return 'Wherever you are';
  return placeById(profile, id)?.name || 'Somewhere';
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function hasKeyword(text, k) {
  if (!k) return false;
  k = k.toLowerCase();
  return /^[\x00-\x7f]+$/.test(k) ? new RegExp(`\\b${esc(k)}\\b`).test(text) : text.includes(k);
}

export function matchPlace(profile, ev) {
  if (ev.place) return ev.place;
  const text = `${ev.location || ''} ${ev.title || ''}`.toLowerCase();
  if (/\b(online|zoom|teams|google meet|video call|phone call|webinar)\b/.test(text)) return HERE;
  for (const p of realmPlaces(profile)) if (p.keywords.some((k) => hasKeyword(text, k))) return p.id;
  return ev.location?.trim() ? OUT : HERE;
}

export function travel(profile, a, b) {
  if (!a || !b || a === b || a === HERE || b === HERE) return 0;
  const route = profile.routes?.find((r) => (r.a === a && r.b === b) || (r.a === b && r.b === a));
  if (route) return +route.min;
  const home = homePlace(profile).id;
  const fh = (id) => (id === OUT ? profile.defaultTravelMin : placeById(profile, id)?.fromHome ?? profile.defaultTravelMin);
  if (a === home) return fh(b);
  if (b === home) return fh(a);
  const x = fh(a), y = fh(b);
  return Math.round(Math.max(x, y) * 0.8 + Math.min(x, y) * 0.2); // rough guess between two non-home places
}

const FITNESS_RE = /\b(gym|run|running|training|workout|pilates|yoga|swim|climb|climbing|bouldering|spin|crossfit|football|soccer|tennis|basketball)\b/i;
export function eventIsFitness(profile, ev, place) {
  return FITNESS_RE.test(ev.title || '') || placeById(profile, place)?.id === 'gym';
}

// Splits a free gap around meal times, then around time-of-day boundaries if it is long.
function carve(start, end, day, profile) {
  let pieces = [{ start, end }];
  const meals = [];
  for (const m of profile.meals || []) {
    const want = atTime(day, m.at);
    pieces = pieces.flatMap((p) => {
      if (minutesBetween(p.start, p.end) < m.min) return [p];
      const s = new Date(Math.min(Math.max(+want, +p.start), +p.end - m.min * MIN));
      if (Math.abs(s - want) > 45 * MIN) return [p];
      const e = addMin(s, m.min);
      meals.push({ kind: 'meal', title: m.name, start: s, end: e });
      return [{ start: p.start, end: s }, { start: e, end: p.end }];
    });
  }
  const bounds = ['12:00', '17:00', '21:00'].map((t) => atTime(day, t));
  pieces = pieces.flatMap((p) => {
    if (minutesBetween(p.start, p.end) <= 180) return [p];
    const out = []; let s = p.start;
    for (const b of bounds) {
      if (minutesBetween(s, b) >= 60 && minutesBetween(b, p.end) >= 60) { out.push({ start: s, end: b }); s = b; }
    }
    out.push({ start: s, end: p.end });
    return out;
  });
  return { pieces, meals };
}

export function buildDay(day, ctx) {
  const { profile, events, quests, now } = ctx;
  day = startOfDay(day);
  const { wake, sleep } = dayBounds(day, profile);
  const home = homePlace(profile).id;
  const dayEnd = addDays(day, 1);
  const questIds = new Set(quests.map((q) => q.id));

  const allDay = events.filter((e) => e.allDay && e.start < dayEnd && e.end > day);
  const timed = [
    ...events.filter((e) => !e.allDay && !(e.questId && questIds.has(e.questId)) && e.end > wake && e.start < sleep).map((e) => ({ ...e, kind: 'event' })),
    ...quests.filter((q) => new Date(q.end) > wake && new Date(q.start) < sleep).map((q) => ({ ...q, kind: 'quest', start: new Date(q.start), end: new Date(q.end) })),
  ].sort((a, b) => a.start - b.start);

  const items = [], slots = [];
  let cursor = wake, here = home, prev = null;

  const gap = (start, end, from, to, next) => {
    const s = prev ? addMin(start, profile.bufferMin) : start;
    const e = next ? addMin(end, -profile.bufferMin) : end;
    if (minutesBetween(s, e) < 15) return;
    const { pieces, meals } = carve(s, e, day, profile);
    items.push(...meals);
    pieces.forEach((p, i) => {
      const minutes = minutesBetween(p.start, p.end);
      if (minutes < profile.minSlot) return;
      const id = `${iso(day)}T${hhmm(p.start)}`;
      const slot = { kind: 'slot', id, start: p.start, end: p.end, minutes, from, to: i === pieces.length - 1 ? to : from, next: i === pieces.length - 1 ? next : null, prev, period: period(p.start) };
      if (now && p.end <= now) slot.past = true;
      else if (now && p.start < now) { slot.start = ceilTo(now, 15); slot.minutes = minutesBetween(slot.start, p.end); slot.isNow = true; if (slot.minutes < 15) return; }
      slots.push(slot); items.push(slot);
    });
  };

  for (const ev of timed) {
    let place = matchPlace(profile, ev);
    if (place === HERE) {
      // Online / location-less: assume you head home first if there's comfortably time to.
      const back = travel(profile, here, home);
      place = here !== home && addMin(cursor, back + profile.minSlot) <= ev.start ? home : here;
    }
    const t = travel(profile, here, place);
    const leave = addMin(ev.start, -t);
    if (leave > cursor) gap(cursor, leave, here, place, ev);
    if (t > 0) {
      const cs = leave < cursor ? cursor : leave;
      items.push({ kind: 'commute', start: cs, end: ev.start, from: here, to: place, minutes: t, tight: leave < cursor });
    }
    const item = { ...ev, place, past: now && ev.end <= now };
    if (ev.kind === 'event') item.fitness = eventIsFitness(profile, ev, place);
    items.push(item);
    if (ev.end > cursor) cursor = ev.end;
    here = place; prev = item;
  }
  const back = travel(profile, here, home);
  if (back > 0 && cursor < sleep) {
    items.push({ kind: 'commute', start: cursor, end: addMin(cursor, back), from: here, to: home, minutes: back });
    cursor = addMin(cursor, back);
  }
  if (cursor < sleep) gap(cursor, sleep, home, home, null);

  items.sort((a, b) => a.start - b.start || (a.kind === 'commute' ? -1 : 1));

  const awake = minutesBetween(wake, sleep);
  const clip = (x) => Math.max(0, minutesBetween(x.start < wake ? wake : x.start, x.end > sleep ? sleep : x.end));
  const busy = items.filter((x) => x.kind === 'event' || x.kind === 'commute').reduce((n, x) => n + clip(x), 0);
  const free = slots.reduce((n, s) => n + (s.past ? 0 : s.minutes), 0);
  return {
    date: day, key: iso(day), wake, sleep, items, slots, allDay,
    events: items.filter((x) => x.kind === 'event'),
    quests: items.filter((x) => x.kind === 'quest'),
    awake, busy, free, load: busy / awake,
  };
}

export function buildWeek(anyDay, ctx) {
  const monday = startOfWeek(anyDay);
  const days = Array.from({ length: 7 }, (_, i) => buildDay(addDays(monday, i), ctx));
  const avgLoad = days.reduce((n, d) => n + d.load, 0) / 7;
  const sorted = [...days].sort((a, b) => b.load - a.load);
  return { monday, key: iso(monday), days, avgLoad, level: loadLevel(avgLoad), busiest: sorted[0], freest: sorted[6] };
}

// Free minutes from `from` until `to` (exclusive), for deadline pressure.
export function freeMinutesUntil(from, to, ctx, cache = new Map()) {
  let total = 0;
  for (let d = startOfDay(from); d < to && total < 1e6; d = addDays(d, 1)) {
    const k = iso(d);
    if (!cache.has(k)) cache.set(k, buildDay(d, ctx));
    total += cache.get(k).free;
    if (minutesBetween(from, d) > 60 * 24 * 90) break;
  }
  return total;
}
