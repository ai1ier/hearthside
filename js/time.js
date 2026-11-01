// Small date helpers. All planner math happens in the browser's local time.
export const MIN = 60000;
export const pad = (n) => String(n).padStart(2, '0');

export function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
export function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
export function addMin(d, n) { return new Date(+d + n * MIN); }
export function startOfWeek(d) { const x = startOfDay(d); return addDays(x, -((x.getDay() + 6) % 7)); } // Monday
export function iso(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
export function parseISODate(s) { const [y, m, dd] = s.split('-').map(Number); return new Date(y, m - 1, dd); }
export function hhmm(d) { return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
export function atTime(day, t) { const [h, m] = t.split(':').map(Number); const x = startOfDay(day); x.setHours(h, m || 0, 0, 0); return x; }
export function minutesBetween(a, b) { return Math.round((b - a) / MIN); }
export function sameDay(a, b) { return iso(a) === iso(b); }
export function ceilTo(d, step = 15) { const ms = step * MIN; return new Date(Math.ceil(+d / ms) * ms); }
export function daysUntil(from, to) { return Math.round((startOfDay(to) - startOfDay(from)) / 86400000); }

export function fmtTime(d) { return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }
export function fmtDay(d) { return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' }); }
export function fmtShort(d) { return d.toLocaleDateString([], { weekday: 'short', day: 'numeric' }); }
export function fmtDur(min) {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export const PERIODS = ['morning', 'afternoon', 'evening', 'night'];
export function period(d) {
  const h = d.getHours() + d.getMinutes() / 60;
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 21) return 'evening';
  return 'night';
}

// Day bounds from the profile's wake/sleep times (sleep may be after midnight).
export function dayBounds(day, profile) {
  const wake = atTime(day, profile.day.wake);
  let sleep = atTime(day, profile.day.sleep);
  if (sleep <= wake) sleep = addDays(sleep, 1);
  return { wake, sleep };
}

// Tiny deterministic hash for stable jitter / seeded art.
export function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967295;
}
