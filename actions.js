// State changes shared by several views.
import { store } from './store.js';
import { toast } from './ui/common.js';
import * as gcal from './calendar/google.js';
import { fetchEvents } from './calendar/google.js';
import { addDays, startOfWeek } from './time.js';
import { demoEvents } from './calendar/demo.js';

export async function acceptQuest(quest, { toCalendar, quiet } = {}) {
  store.set((s) => ({ quests: [...s.quests, quest] }));
  if (!quiet) toast(`📜 Quest accepted: ${quest.title}`);
  if (toCalendar && gcal.isSignedIn()) {
    try {
      const gcalId = await gcal.insertQuestEvent(quest);
      store.set((s) => ({ quests: s.quests.map((q) => (q.id === quest.id ? { ...q, gcalId } : q)) }));
      toast('🗓️ Added to Google Calendar');
    } catch (e) { toast(`Couldn't add to calendar: ${e.message}`); }
  }
}

export function completeQuest(id) {
  const q = store.get().quests.find((x) => x.id === id);
  if (!q || q.done) return;
  store.set((s) => ({
    xp: s.xp + q.xp,
    quests: s.quests.map((x) => (x.id === id ? { ...x, done: true, doneAt: Date.now() } : x)),
    profile: { ...s.profile, goals: s.profile.goals.map((g) => {
      if (g.id !== q.goalId && !(g.linkedActivityId && g.linkedActivityId === q.activityId)) return g;
      if (g.type === 'deadline') return { ...g, hoursDone: +(g.hoursDone + q.minutes / 60).toFixed(2) };
      if (g.type === 'event' && q.itemId) return { ...g, items: g.items.map((i) => (i.id === q.itemId ? { ...i, done: true } : i)) };
      return g;
    }) },
  }));
  toast(`✨ Quest complete! +${q.xp} XP`);
}

export async function abandonQuest(id) {
  const q = store.get().quests.find((x) => x.id === id);
  store.set((s) => ({ quests: s.quests.filter((x) => x.id !== id), xp: q?.done ? Math.max(0, s.xp - q.xp) : s.xp }));
  if (q?.gcalId && gcal.isSignedIn()) {
    try { await gcal.deleteQuestEvent(q.gcalId); } catch { toast('Removed here, but the calendar copy could not be deleted.'); }
  }
}

export async function syncGoogle(interactive = true) {
  const { profile } = store.get();
  if (!gcal.isSignedIn()) await gcal.signIn(gcal.clientIdFor(profile), interactive ? '' : 'none');
  let cals = profile.settings.calendars;
  const list = await gcal.listCalendars();
  if (!cals.length) cals = list.filter((c) => c.primary).map((c) => c.id);
  const from = addDays(startOfWeek(new Date()), -7), to = addDays(new Date(), 70);
  const events = await fetchEvents(cals, from, to);
  store.set((s) => ({
    events, source: 'google', lastSync: Date.now(),
    profile: { ...s.profile, settings: { ...s.profile.settings, calendars: cals, calendarList: list } },
  }));
  toast(`🗓️ Synced ${events.length} events from Google Calendar`);
}

export function useDemo() {
  store.set({ events: demoEvents(new Date()), source: 'demo', lastSync: null });
  toast('Sample calendar loaded');
}
