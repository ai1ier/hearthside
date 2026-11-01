// Minimal .ics reader: VEVENTs with DTSTART/DTEND/SUMMARY/LOCATION and
// simple DAILY/WEEKLY recurrence (COUNT, UNTIL, INTERVAL, BYDAY, EXDATE).
const DAYS = { MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6, SU: 0 };

function unfold(text) { return text.replace(/\r?\n[ \t]/g, ''); }

function parseDate(value, params) {
  const allDay = params.includes('VALUE=DATE') || /^\d{8}$/.test(value);
  const m = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?/);
  if (!m) return null;
  const [, y, mo, d, h = '0', mi = '0', s = '0', z] = m;
  // TZID times are read as local time, which is right when the calendar shares your timezone.
  const date = z ? new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s)) : new Date(+y, +mo - 1, +d, +h, +mi, +s);
  return { date, allDay };
}

function unescape(s) { return s.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1'); }

export function parseICS(text, rangeStart, rangeEnd) {
  const lines = unfold(text).split(/\r?\n/);
  const events = [];
  let cur = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { cur = { exdates: [] }; continue; }
    if (line === 'END:VEVENT') { if (cur?.start) events.push(cur); cur = null; continue; }
    if (!cur) continue;
    const i = line.indexOf(':');
    if (i < 0) continue;
    const [name, ...params] = line.slice(0, i).split(';');
    const value = line.slice(i + 1);
    if (name === 'SUMMARY') cur.title = unescape(value);
    else if (name === 'LOCATION') cur.location = unescape(value);
    else if (name === 'UID') cur.uid = value;
    else if (name === 'STATUS') cur.status = value;
    else if (name === 'DTSTART') { const p = parseDate(value, params); cur.start = p.date; cur.allDay = p.allDay; }
    else if (name === 'DTEND') cur.end = parseDate(value, params)?.date;
    else if (name === 'RRULE') cur.rrule = Object.fromEntries(value.split(';').map((kv) => kv.split('=')));
    else if (name === 'EXDATE') value.split(',').forEach((v) => { const p = parseDate(v, params); if (p) cur.exdates.push(+p.date); });
  }

  const out = [];
  for (const e of events) {
    if (e.status === 'CANCELLED') continue;
    const dur = (e.end ? +e.end : +e.start + (e.allDay ? 86400000 : 3600000)) - +e.start;
    const push = (start) => {
      if (e.exdates.includes(+start)) return;
      const end = new Date(+start + dur);
      if (end < rangeStart || start > rangeEnd) return;
      out.push({ id: `ics:${e.uid || e.title}:${+start}`, title: e.title || '(busy)', location: e.location || '', start: start.toISOString(), end: end.toISOString(), allDay: e.allDay, source: 'ics' });
    };
    if (!e.rrule) { push(e.start); continue; }
    const r = e.rrule, interval = +(r.INTERVAL || 1);
    const until = r.UNTIL ? parseDate(r.UNTIL, []).date : rangeEnd;
    const count = r.COUNT ? +r.COUNT : Infinity;
    const stop = Math.min(+until, +rangeEnd);
    let n = 0;
    if (r.FREQ === 'DAILY') {
      for (let d = new Date(e.start); +d <= stop && n < count; d.setDate(d.getDate() + interval)) { push(new Date(d)); n++; }
    } else if (r.FREQ === 'WEEKLY') {
      const byday = r.BYDAY ? r.BYDAY.split(',').map((x) => DAYS[x.slice(-2)]) : [e.start.getDay()];
      const weekStart = new Date(e.start); weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      for (let w = new Date(weekStart); +w <= stop && n < count; w.setDate(w.getDate() + 7 * interval)) {
        for (const wd of byday.sort()) {
          const d = new Date(w); d.setDate(d.getDate() + wd);
          d.setHours(e.start.getHours(), e.start.getMinutes(), e.start.getSeconds());
          if (d < e.start || +d > stop || n >= count) continue;
          push(d); n++;
        }
      }
    } else push(e.start); // other frequencies: first occurrence only
  }
  return out;
}
