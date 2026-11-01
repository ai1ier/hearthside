// Assembles everything a view needs: timelines, week load, ranked quests and narration.
import { addDays, iso, startOfWeek, fmtDur, fmtTime, daysUntil, parseISODate, hash } from '../time.js';
import { buildDay, buildWeek, matchPlace, eventIsFitness } from './plan.js';
import { planDay } from './suggest.js';
import { CATEGORIES } from '../defaults.js';

export function computeDay(state, events, day, now = new Date()) {
  const base = { profile: state.profile, events, quests: state.quests, now };
  const dayCache = new Map();
  const week = buildWeek(day, base);
  const dayPlan = buildDay(day, base);
  const tomorrow = buildDay(addDays(day, 1), base);
  const fitnessEvents = events.filter((e) => !e.allDay && eventIsFitness(state.profile, e, matchPlace(state.profile, e)));
  const ctx = {
    ...base, dayCache, week, tomorrow, fitnessEvents,
    mood: state.moods[iso(day)] || state.moods[iso(now)] || {},
    weekMood: state.weekMoods[iso(startOfWeek(day))] || {},
  };
  const offers = planDay(dayPlan, ctx);
  applyOracle(offers, state.oracle?.[dayPlan.key]);
  return { dayPlan, week, offers, ctx };
}

// Merge Claude's reading (order + flavour) into the rule-based offers.
function applyOracle(offers, reading) {
  if (!reading?.slots) return;
  for (const s of reading.slots) {
    const o = offers[s.slotId];
    if (!o) continue;
    const chosen = [];
    for (const q of s.quests) {
      const r = o.ranked.find((x) => x.key === q.candidateKey) || o.options.find((x) => x.key === q.candidateKey);
      if (!r || chosen.includes(r)) continue;
      chosen.push({ ...r, title: q.title || r.title, oracle: { flavor: q.flavor, why: q.why } });
    }
    if (chosen.length) o.options = [...chosen.slice(0, 3), o.options[o.options.length - 1]];
  }
}

const pickBy = (arr, seed) => arr[Math.floor(hash(seed) * arr.length) % arr.length];

const OPEN = {
  morning: ['Good morning, {n}!', 'Rise and shine, {n}!', 'Morning, {n} — the kettle’s on.'],
  afternoon: ['Hello again, {n}!', 'There you are, {n}!', 'Good afternoon, {n}.'],
  evening: ['Good evening, {n}.', 'Welcome home, {n}.', 'Come warm your hands, {n}.'],
  night: ['Still up, {n}? I’ll keep you company.', 'A quiet night, {n}.'],
};
const DAY = {
  low: ['Low flame today? That’s alright — even embers keep a hearth warm.', 'Go gently today. Small steps are still steps forward.', 'Rest is not falling behind; it’s how heroes get their strength back.'],
  busy: ['A full road today — but you’ve walked busy roads before, and walked them well.', 'Lots on your plate, and I believe in you. One thing at a time.', 'Big day! Remember to breathe between the engagements — you’ve got this.'],
  light: ['The road is wide open today — a lovely chance to follow your curiosity.', 'A gentle, roomy day. Spend some of it on something that makes you happy.', 'Plenty of sky today. Something good is waiting to be found.'],
  mid: ['A nice balance of duties and daylight today. You’re doing great.', 'Today has a good rhythm to it. Trust it.', 'Steady and well-paced — the kind of day that quietly adds up.'],
};
const SPIRIT = {
  adventure: 'I can sense adventure in your boots!',
  hearth: 'Something cozy is calling — answer it without any guilt.',
  fellowship: 'A wonderful day for warm company.',
  focus: 'Your mind feels sharp today — a fine time for the big quests.',
};
const FORTUNES = [
  'A small kindness you give today will find its way back to you.',
  'Something you’ve been patient about is closer than it seems.',
  'An ordinary moment today will turn out to be a favourite memory.',
  'The thing you’re nervous about will go better than you fear.',
  'A good idea is hiding in the next walk you take.',
  'Someone is thinking fondly of you right now.',
  'Today’s little effort is tomorrow’s easy road.',
  'The stars say: be proud of how far you’ve come.',
  'A cup of something warm will fix more than you expect.',
  'You will learn something delightful by accident.',
  'Your future self is already grateful for today’s choices.',
  'Luck favours the one who rests well. Sleep sweetly tonight.',
];

// Hoot's words: encouragement and a fortune, never a tally of hours or quests.
export function hootSays(state, dayPlan, week, now = new Date()) {
  const name = state.profile.name || 'friend';
  const isToday = iso(dayPlan.date) === iso(now);
  const key = iso(dayPlan.date);
  const h = now.getHours();
  const per = !isToday ? 'morning' : h < 5 ? 'night' : h < 12 ? 'morning' : h < 17 ? 'afternoon' : h < 22 ? 'evening' : 'night';
  const mood = state.moods[iso(now)] || {};
  const lines = [pickBy(OPEN[per], key + per).replace('{n}', name)];

  const doneToday = state.quests.filter((q) => q.done && q.date === key);
  if (doneToday.length && isToday) lines.push(`You finished “${doneToday[doneToday.length - 1].title}” — I’m proud of you!`);
  else if (!isToday) lines.push(dayPlan.date > now ? 'Peeking ahead? Wise. Future you will thank you.' : 'Looking back is how stories get remembered.');
  else {
    // just one more thought, so the oracle stays brief
    const tone = (mood.energy ?? 3) <= 2 ? 'low' : dayPlan.load > 0.5 ? 'busy' : dayPlan.load < 0.2 ? 'light' : 'mid';
    lines.push(mood.spirit && isToday ? SPIRIT[mood.spirit] : pickBy(DAY[tone], key + tone));
  }
  return { text: lines.join(' '), fortune: pickBy(FORTUNES, key + name) };
}

export function weekReading(state, week, events) {
  const out = [];
  const lvl = week.level;
  out.push({ icon: lvl.icon, t: `${lvl.name}. ${lvl.blurb}` });
  const b = week.busiest, f = week.freest;
  if (b.load > 0.4) out.push({ icon: '🛡️', t: `${b.date.toLocaleDateString([], { weekday: 'long' })} is your hardest day (${fmtDur(b.busy)} busy). Keep the evening before it gentle.` });
  if (f.free > 180) out.push({ icon: '🗺️', t: `${f.date.toLocaleDateString([], { weekday: 'long' })} has the most open road — ${fmtDur(f.free)} free. Good for a long quest.` });

  const wk = iso(week.monday);
  const inWeek = state.quests.filter((q) => iso(startOfWeek(new Date(q.start))) === wk);
  const fitTarget = state.profile.activities.filter((a) => a.category === 'fitness' && a.enabled !== false).reduce((n, a) => n + (a.weeklyTarget || 0), 0);
  const fitDone = inWeek.filter((q) => q.category === 'fitness').length + events.filter((e) => !e.allDay && iso(startOfWeek(e.start)) === wk && eventIsFitness(state.profile, e, matchPlace(state.profile, e))).length;
  if (fitTarget) out.push({ icon: '⚔️', t: fitDone >= fitTarget ? `Training: ${fitDone}/${fitTarget} sessions — target met. Extra sessions will be gentle ones.` : `Training: ${fitDone}/${fitTarget} sessions planned. I'll weave in the rest around showers, sleep and big days.` });

  for (const g of state.profile.goals) {
    if (g.done || !g.due) continue;
    const d = daysUntil(new Date(), parseISODate(g.due));
    if (d < 0 || d > 21) continue;
    if (g.type === 'deadline') out.push({ icon: '👑', t: `“${g.title}” in ${d} days — ${Math.max(0, g.hoursNeeded - g.hoursDone).toFixed(1)}h of prep left.` });
    if (g.type === 'event') {
      const due = (g.items || []).filter((i) => !i.done && d - i.daysBefore <= 4);
      if (due.length) out.push({ icon: '🧭', t: `“${g.title}” in ${d} days. Prep now: ${due.map((i) => i.text).join(', ')}.` });
    }
  }
  const allDay = events.filter((e) => e.allDay && e.start >= week.monday && e.start < addDays(week.monday, 7));
  for (const e of allDay.slice(0, 3)) out.push({ icon: '📌', t: `${e.title} — ${e.start.toLocaleDateString([], { weekday: 'long' })}.` });
  return out;
}

export function categoryBalance(state, week) {
  const wk = iso(week.monday);
  const counts = {};
  for (const q of state.quests) if (iso(startOfWeek(new Date(q.start))) === wk) counts[q.category] = (counts[q.category] || 0) + q.minutes;
  return Object.entries(CATEGORIES).map(([k, c]) => ({ key: k, ...c, minutes: counts[k] || 0 }));
}

export { fmtTime };
