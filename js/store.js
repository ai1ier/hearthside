// One persisted store (localStorage) with a tiny subscribe API.
import { defaultProfile } from './defaults.js';
import { demoEvents } from './calendar/demo.js';
import { useState, useEffect } from './vendor.js';

const KEY = 'questplanner.v1';

function fresh() {
  return {
    profile: defaultProfile(),
    events: demoEvents(new Date()), // [{id,title,location,start,end,allDay,source}], ISO strings
    source: 'demo',
    lastSync: null,
    quests: [],     // accepted quests: {id,date,start,end,title,icon,category,activityId,goalId,itemId,place,intensity,sweat,minutes,done,xp,gcalId}
    moods: {},      // 'YYYY-MM-DD' -> {energy, spirit, ailment}
    weekMoods: {},  // monday 'YYYY-MM-DD' -> {outlook}
    xp: 0,
    oracle: {},     // 'YYYY-MM-DD' -> Claude's reading for that day
    diary: [],      // {id, date, text, at}
    library: [],    // {id, kind: book|show|film|game|other, title, by, status, rating, finished, note, at}
    summaries: {},  // 'week:YYYY-MM-DD' | 'month:YYYY-MM' -> {text, at}
    scry: { time: 'live', season: 'auto', weather: 'live' }, // art preview overrides
    focus: null,    // the running focus session, see focus.js
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    const s = JSON.parse(raw);
    const base = fresh();
    const profile = { ...base.profile, ...s.profile, settings: { ...base.profile.settings, ...(s.profile?.settings || {}) } };
    // fill in fields added after a save was made
    profile.activities = profile.activities.map((a) => ({ matches: base.profile.activities.find((b) => b.id === a.id)?.matches || [], ...a }));
    if (!s.profile?.avatar) { profile.avatar = base.profile.avatar; if (profile.title === 'Wandering Scholar') profile.title = 'Hearth Witch'; }
    // v2: the home realm moved from Sydney to Melbourne; refresh the seeded places' names and keywords
    if ((profile.version || 1) < 2) {
      if (profile.realm === 'sydney') profile.realm = 'melbourne';
      profile.places = profile.places.map((pl) => {
        if (pl.realm !== 'sydney') return pl;
        const seed = base.profile.places.find((b) => b.id === pl.id);
        return seed ? { ...pl, realm: 'melbourne', name: seed.name, keywords: seed.keywords } : { ...pl, realm: 'melbourne' };
      });
      profile.activities = profile.activities.map((a) => {
        const seed = base.profile.activities.find((b) => b.id === a.id);
        return seed && (a.id === 'callfam' || a.id === 'coastwalk') ? { ...a, name: seed.name, note: seed.note } : a;
      });
      profile.version = 2;
    }
    // a quest that was celebrating its completion when the page closed is already done
    const focus = s.focus?.doneAt ? null : s.focus;
    return { ...base, ...s, profile, focus: focus ?? null };
  } catch { return fresh(); }
}

let state = load();
const subs = new Set();
let eventCache = { src: null, list: [] };

export const store = {
  get: () => state,
  set(patch) {
    state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage full or blocked */ }
    subs.forEach((f) => f(state));
  },
  setProfile(patch) {
    store.set((s) => ({ profile: { ...s.profile, ...(typeof patch === 'function' ? patch(s.profile) : patch) } }));
  },
  subscribe(f) { subs.add(f); return () => subs.delete(f); },
  reset() { state = fresh(); store.set({}); },
  // Events with real Date objects, memoised on the stored array.
  events() {
    if (eventCache.src !== state.events) {
      eventCache = { src: state.events, list: state.events.map((e) => ({ ...e, start: new Date(e.start), end: new Date(e.end) })) };
    }
    return eventCache.list;
  },
};

export function useStore() {
  const [s, setS] = useState(state);
  useEffect(() => store.subscribe(setS), []);
  return s;
}

export function levelFor(xp) {
  const level = Math.floor(Math.sqrt(xp / 40)) + 1;
  const cur = 40 * (level - 1) ** 2, next = 40 * level ** 2;
  return { level, into: xp - cur, need: next - cur };
}
