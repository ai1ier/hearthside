// The quest giver: scores every activity/goal against a free slot.
// Each factor leaves a human-readable reason so the suggestion explains itself.
import { MIN, addMin, addDays, startOfWeek, startOfDay, daysUntil, minutesBetween, parseISODate, hash, fmtDur, iso } from '../time.js';
import { travel, homePlace, placeById, placeName, freeMinutesUntil, buildDay } from './plan.js';

export const SPIRITS = {
  adventure: { label: 'Adventure', icon: '🗡️', cats: ['fitness', 'outdoors'] },
  hearth:    { label: 'Cozy hearth', icon: '🔥', cats: ['rest', 'creative'] },
  fellowship:{ label: 'Fellowship', icon: '🍻', cats: ['social'] },
  focus:     { label: 'Scholarly focus', icon: '📜', cats: ['learning', 'main'] },
};

const TITLES = {
  fitness: ['Trial of Strength', 'Rite of Stamina', 'The Training Grounds'],
  outdoors: ['Call of the Wilds', "Wayfarer's Path", 'A Breath of Open Sky'],
  creative: ["Artisan's Hour", 'The Enchanted Easel', 'Workshop of Wonders'],
  learning: ["Scholar's Vigil", 'Delve the Tomes', 'The Quiet Library'],
  social: ['Gathering of Fellows', 'A Raven Home', 'Tales at the Tavern'],
  rest: ['Rest at the Inn', 'Hearthside Respite', 'Restore Your Mana'],
  chores: ['Homestead Duties', 'Tend the Hearth', 'The Provision Run'],
  main: ['Main Quest', 'The Great Preparation', 'The Road Ahead'],
};
export function questTitle(c, seed) {
  const list = TITLES[c.category] || TITLES.rest;
  return list[Math.floor(hash(seed) * list.length)];
}

export function questXP(minutes, intensity = 0, main = false) {
  return Math.max(5, Math.round((minutes / 3) * (1 + intensity * 0.25) * (main ? 1.5 : 1)));
}

// --- context -------------------------------------------------------------

export function makeContext(state, now = new Date()) {
  const { profile } = state;
  const base = { profile, events: [], quests: state.quests, now };
  return { ...base, state };
}

function weekKey(d) { return iso(startOfWeek(d)); }

// What has been done or planned this week, by activity and category.
function weekTally(ctx, day, excludeSlot) {
  const wk = weekKey(day);
  const byAct = {}, byCat = {}, hard = [];
  for (const q of ctx.quests) {
    const s = new Date(q.start);
    if (q.intensity >= 2) hard.push({ start: s, end: new Date(q.end), intensity: q.intensity, title: q.title });
    if (weekKey(s) !== wk) continue;
    if (excludeSlot && s >= excludeSlot.start && s < excludeSlot.end) continue;
    if (q.activityId) byAct[q.activityId] = (byAct[q.activityId] || 0) + 1;
    byCat[q.category] = (byCat[q.category] || 0) + 1;
  }
  for (const e of ctx.fitnessEvents || []) {
    hard.push({ start: e.start, end: e.end, intensity: 2, title: e.title });
    if (weekKey(e.start) === wk) byCat.fitness = (byCat.fitness || 0) + 1;
  }
  // Calendar events that already cover an activity (e.g. "Video call with Mum") count toward it.
  const matchers = ctx.profile.activities.filter((a) => a.matches?.length);
  for (const e of ctx.events) {
    if (e.allDay || weekKey(e.start) !== wk) continue;
    const title = (e.title || '').toLowerCase();
    for (const a of matchers) if (a.matches.some((k) => title.includes(k.toLowerCase()))) byAct[a.id] = (byAct[a.id] || 0) + 1;
  }
  return { byAct, byCat, hard };
}

// --- candidates ----------------------------------------------------------

function goalCandidates(ctx, day) {
  const { profile } = ctx;
  const out = [], boosts = {};
  for (const g of profile.goals) {
    if (g.done) continue;
    if (g.type === 'deadline') {
      const due = parseISODate(g.due);
      const left = Math.max(0, (g.hoursNeeded || 0) - (g.hoursDone || 0));
      const days = daysUntil(day, due);
      if (left <= 0 || days < 0) continue;
      const free = freeMinutesUntil(day, due, ctx, ctx.dayCache) / 60;
      // pressure: share of remaining free time this goal needs (assume ~35% of free time is realistically usable)
      const pressure = Math.min(3, left / Math.max(1, free * 0.35));
      out.push({ key: `goal:${g.id}`, kind: 'goal', goalId: g.id, category: 'main', icon: '👑', name: `Prepare: ${g.title}`,
        minMin: Math.min(45, g.sessionMin || 60), maxMin: g.sessionMin || 90, intensity: 0, place: g.place || 'any',
        times: ['morning', 'afternoon', 'evening'], weight: 3, pressure,
        why: `Due in ${days} day${days === 1 ? '' : 's'} · ${left.toFixed(1)}h of prep left` });
    } else if (g.type === 'event') {
      const due = parseISODate(g.due);
      const days = daysUntil(day, due);
      if (days < 0) continue;
      for (const it of g.items || []) {
        if (it.done) continue;
        const lead = days - it.daysBefore; // days until "should be done by"
        if (lead > 4) continue;           // not yet in the window
        const pressure = lead <= 0 ? 2.5 : 1.5 - lead * 0.25;
        out.push({ key: `item:${g.id}:${it.id}`, kind: 'goal', goalId: g.id, itemId: it.id, category: 'main', icon: '🧭',
          name: `${it.text}`, sub: g.title, minMin: it.minutes || 30, maxMin: it.minutes || 30, intensity: 0, place: it.place || 'any',
          times: ['morning', 'afternoon', 'evening'], weight: 3, pressure,
          why: lead <= 0 ? `Overdue for ${g.title}!` : `For ${g.title} in ${days} days — best done within ${lead} day${lead === 1 ? '' : 's'}` });
      }
    } else if (g.type === 'ongoing') {
      if (g.linkedActivityId) { boosts[g.linkedActivityId] = g; continue; }
      out.push({ key: `goal:${g.id}`, kind: 'goal', goalId: g.id, category: 'main', icon: '🌱', name: g.title,
        minMin: g.sessionMin || 30, maxMin: g.sessionMin || 30, intensity: 0, place: g.place || 'any',
        times: ['morning', 'afternoon', 'evening', 'night'], weight: 3, weeklyTarget: g.weeklyTarget || 1, goalWeekly: true });
    }
  }
  return { out, boosts };
}

export function allCandidates(ctx, day) {
  const { out, boosts } = goalCandidates(ctx, day);
  const acts = ctx.profile.activities.filter((a) => a.enabled !== false).map((a) => ({
    ...a, key: `act:${a.id}`, kind: 'activity', activityId: a.id,
    goal: boosts[a.id] || null,
    weeklyTarget: Math.max(a.weeklyTarget || 0, boosts[a.id]?.weeklyTarget || 0),
  }));
  return [...out, ...acts];
}

// --- scoring -------------------------------------------------------------

export function scoreCandidate(c, slot, ctx, day) {
  const { profile, mood = {}, weekMood = {}, week, tally, tomorrow } = ctx;
  const R = [];
  const home = homePlace(profile).id;
  const place = c.place === 'any' ? slot.from : c.place === 'home' ? home : c.place;
  if (place !== slot.from && place !== home && !placeById(profile, place)) return null; // place from another realm
  const tIn = travel(profile, slot.from, place);
  const tOut = travel(profile, place, slot.to);
  const shower = c.sweat ? profile.fitness.showerMin : 0;
  const avail = slot.minutes - tIn - tOut - shower;
  if (avail < c.minMin) return null;

  let energy = mood.energy ?? 3;
  if (mood.ailment === 'tired') energy -= 1;
  const ambition = { seize: 1, steady: 0, survive: -1 }[weekMood.outlook] ?? 0;
  const load = week?.level.level ?? 1;
  const pressure = load - ambition; // effective heaviness, -1 … 4

  let s = c.weight || 3;

  // Duration: lower energy and heavier weeks favour the short end.
  const f = Math.min(0.85, Math.max(0.15, 0.5 + (energy - 3) * 0.12 - pressure * 0.08));
  let minutes = Math.round((c.minMin + (c.maxMin - c.minMin) * f) / 5) * 5;
  minutes = Math.max(c.minMin, Math.min(minutes, avail, c.maxMin));

  const startAt = addMin(slot.start, tIn);
  const endAt = addMin(startAt, minutes + shower);

  // Time of day
  if ((c.times || []).includes(slot.period)) s *= 1.2;
  else { s *= 0.7; }

  // Spirit / mood
  const spirit = { adventure: ['fitness', 'outdoors'], hearth: ['rest', 'creative'], fellowship: ['social'], focus: ['learning', 'main'] }[mood.spirit];
  if (spirit?.includes(c.category)) { s *= 1.5; R.push({ t: 'Your spirit craves this today', tone: 'good' }); }

  // Energy
  if (c.intensity >= 2 && energy <= 2) { s *= 0.35; R.push({ t: 'Stamina is low for a hard trial', tone: 'warn' }); }
  else if (c.intensity >= 3 && energy === 3) s *= 0.85;
  else if (c.intensity >= 2 && energy >= 4) { s *= 1.2; R.push({ t: 'Your stamina flask is full', tone: 'good' }); }
  if ((c.restores || c.category === 'rest') && energy <= 2) { s *= 1.8; R.push({ t: 'Recovers stamina', tone: 'good' }); }
  if (mood.ailment === 'sore') {
    if (c.category === 'fitness' && c.intensity >= 2) { s *= 0.3; R.push({ t: 'Sore muscles — let them mend', tone: 'warn' }); }
    if (c.category === 'fitness' && c.intensity <= 1) { s *= 1.4; R.push({ t: 'Gentle movement helps soreness', tone: 'good' }); }
  }
  if (mood.ailment === 'stressed' && ['rest', 'creative', 'outdoors'].includes(c.category)) { s *= 1.3; R.push({ t: 'Soothes a stressed mind', tone: 'good' }); }

  // Weekly balance (fitness gets "yes, but not too much")
  const done = c.kind === 'goal' && c.goalWeekly ? (tally.byGoal?.[c.goalId] || 0) : (tally.byAct[c.activityId] || 0);
  const target = c.weeklyTarget || 0;
  if (target > 0) {
    if (done < target) { s *= 1 + 0.25 * (target - done); R.push({ t: `${done}/${target} this week`, tone: 'info' }); }
    else { s *= c.category === 'fitness' ? 0.25 : 0.45; R.push({ t: `Weekly target met (${done}/${target}) — don't overdo it`, tone: 'warn' }); }
  }
  if (c.goal) R.push({ t: `Advances “${c.goal.title}”`, tone: 'good' });
  if (c.category === 'fitness' && (tally.byCat.fitness || 0) >= 4) s *= 0.6;

  // How busy the week is
  if (pressure >= 2) {
    if (c.intensity >= 2) s *= done < target ? 0.85 : 0.6;
    if (c.category === 'rest') { s *= 1.3; R.push({ t: `${week.level.name} week — rest is precious`, tone: 'info' }); }
    if (c.minMin >= 90 && c.category !== 'main') s *= 0.7;
  } else if (pressure <= 0) {
    if (c.category === 'rest') s *= 0.8;
    if (['creative', 'social', 'outdoors', 'fitness'].includes(c.category)) s *= 1.15;
  }

  // Training side-effects on the rest of the schedule
  if (c.intensity >= 2) {
    const toBed = minutesBetween(endAt, ctx.sleep);
    if (toBed < profile.fitness.noIntenseBeforeSleepMin) { s *= 0.3; R.push({ t: 'Too close to bedtime — you’d be wired', tone: 'warn' }); }
    const recent = tally.hard.filter((h) => Math.abs(h.start - startAt) < profile.fitness.recoveryHours * 60 * MIN && !(h.start >= slot.start && h.start < slot.end));
    if (c.intensity >= 3 && recent.some((h) => h.intensity >= 3)) { s *= 0.3; R.push({ t: 'Muscles still recovering from your last trial', tone: 'warn' }); }
    else if (recent.length && sameDayAs(recent, day)) { s *= 0.3; R.push({ t: 'Already trained today', tone: 'warn' }); }
    const nx = slot.next;
    if (nx && nx.kind === 'event' && minutesBetween(endAt, nx.start) < 90 && profile.fitness.importantKeywords.some((k) => (nx.title || '').toLowerCase().includes(k))) {
      s *= 0.55; R.push({ t: `Save your energy for “${nx.title}”`, tone: 'warn' });
    }
    if (tomorrow && tomorrow.load > 0.55 && c.intensity >= 3) { s *= 0.75; R.push({ t: 'Big day tomorrow — keep something in reserve', tone: 'warn' }); }
  }
  if (c.sweat) {
    const pl = placeById(profile, place);
    if (slot.next && slot.to !== home && !pl?.hasShower) { s *= 0.3; R.push({ t: `No shower before ${slot.next.title || 'your next event'}`, tone: 'warn' }); }
    else R.push({ t: `Includes ${shower}m to wash up${pl?.hasShower && place !== home ? ` at ${pl.name}` : ''}`, tone: 'info' });
  }

  // Long-term commitments
  if (c.kind === 'goal' && c.pressure != null) {
    s = 2.5 + c.pressure * 3.2;
    if (spirit?.includes('main')) s *= 1.3;
    if (energy <= 1) s *= 0.7;
    R.unshift({ t: c.why, tone: c.pressure > 1.6 ? 'warn' : 'info' });
  }

  // Commute
  if (tIn + tOut > 0) {
    const legs = [tIn ? `${tIn}m to ${placeName(profile, place)}` : null, tOut ? `${tOut}m on to ${placeName(profile, slot.to)}` : null].filter(Boolean);
    R.push({ t: `Travel: ${legs.join(', then ')}`, tone: 'info' });
    s *= tIn + tOut > minutes ? 0.6 : 0.95;
  }
  if (c.note) R.push({ t: c.note, tone: 'info' });

  s *= 0.92 + hash(slot.id + c.key) * 0.16; // gentle, stable variety
  return {
    key: c.key, kind: c.kind, c, score: s, minutes, shower, tIn, tOut, place,
    start: startAt, end: endAt, reasons: R,
    title: questTitle(c, slot.id + c.key),
    xp: questXP(minutes, c.intensity, c.category === 'main'),
  };
}

function sameDayAs(list, day) { const k = iso(day); return list.some((h) => iso(h.start) === k); }

export function restOption(slot, ctx) {
  return {
    key: 'free', kind: 'free', score: 0, minutes: slot.minutes, shower: 0, tIn: 0, tOut: 0, place: slot.from,
    start: slot.start, end: slot.end, title: 'Unclaimed Wilds',
    c: { name: 'Leave this time open', category: 'rest', icon: '🍃', intensity: 0 },
    reasons: [{ t: 'Free time is a quest too. Wander, nap, or do nothing at all.', tone: 'info' }],
    xp: 5,
  };
}

// Ranks quests for every open slot of a day, with variety across the day.
export function planDay(dayPlan, ctx) {
  const day = dayPlan.date;
  const tally = weekTally(ctx, day);
  tally.byGoal = {};
  for (const q of ctx.quests) if (q.goalId && iso(startOfWeek(new Date(q.start))) === iso(startOfWeek(day))) tally.byGoal[q.goalId] = (tally.byGoal[q.goalId] || 0) + 1;
  const local = { ...ctx, tally, sleep: dayPlan.sleep };
  const cands = allCandidates(local, day);
  const picked = {};
  const usedCats = {};
  let hardToday = dayPlan.quests.some((q) => q.intensity >= 2) || dayPlan.events.some((e) => e.fitness);
  for (const q of dayPlan.quests) usedCats[q.category] = (usedCats[q.category] || 0) + 1;

  const open = dayPlan.slots.filter((s) => !s.past);
  open.forEach((slot, idx) => {
    let ranked = cands.map((c) => scoreCandidate(c, slot, local, day)).filter(Boolean);
    for (const r of ranked) {
      const n = usedCats[r.c.category] || 0;
      if (n) r.score *= Math.pow(0.7, n);
      if (hardToday && r.c.intensity >= 2) r.score *= 0.35;
      if (idx === open.length - 1 && (ctx.week?.level.level ?? 0) >= 2 && r.c.category === 'rest') r.score *= 1.4;
    }
    ranked.sort((a, b) => b.score - a.score);
    // keep options distinct by category where possible
    const opts = [];
    for (const r of ranked) {
      if (opts.length >= 3) break;
      if (opts.some((o) => o.c.category === r.c.category) && ranked.length > 6) continue;
      opts.push(r);
    }
    for (const r of ranked) { if (opts.length >= 3) break; if (!opts.includes(r)) opts.push(r); }
    opts.push(restOption(slot, ctx));
    picked[slot.id] = { slot, options: opts, ranked };
    const top = opts[0];
    if (top && top.kind !== 'free') {
      usedCats[top.c.category] = (usedCats[top.c.category] || 0) + 1;
      if (top.c.intensity >= 2) hardToday = true;
    }
  });
  // bygone hours can still be filled in afterwards, for things done but not yet recorded
  for (const slot of dayPlan.slots.filter((s) => s.past)) {
    const ranked = cands.map((c) => scoreCandidate(c, slot, local, day)).filter(Boolean).sort((a, b) => b.score - a.score);
    picked[slot.id] = { slot, options: ranked.slice(0, 3), ranked, past: true };
  }
  return picked;
}

// Builds a quest record from a chosen option (optionally with an adjusted start/duration).
export function makeQuest(opt, dayPlan, { start, minutes } = {}) {
  const st = start || opt.start;
  const mins = minutes || opt.minutes;
  const c = opt.c;
  return {
    id: `q-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4)}`,
    date: dayPlan.key,
    start: st.toISOString(),
    end: addMin(st, mins + (opt.shower || 0)).toISOString(),
    title: c.name, flavor: opt.title, icon: c.icon, category: c.category,
    activityId: c.activityId || null, goalId: c.goalId || null, itemId: c.itemId || null,
    place: opt.place, intensity: c.intensity || 0, sweat: !!c.sweat, minutes: mins, shower: opt.shower || 0,
    xp: questXP(mins, c.intensity, c.category === 'main'), done: false, oracle: opt.oracle || null,
  };
}

export { fmtDur };
