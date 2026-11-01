// Sun, moon, season and realm-local clock — everything the art needs to know about "when".
const RAD = Math.PI / 180;

export function solarAltitude(date, lat, lon) {
  const n = date.getTime() / 86400000 + 2440587.5 - 2451545.0;
  const L = (280.46 + 0.9856474 * n) % 360;
  const g = ((357.528 + 0.9856003 * n) % 360) * RAD;
  const lambda = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD;
  const eps = (23.439 - 0.0000004 * n) * RAD;
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda));
  const dec = Math.asin(Math.sin(eps) * Math.sin(lambda));
  const gmst = (18.697374558 + 24.06570982441908 * n) % 24;
  const ha = (gmst * 15 + lon) * RAD - ra;
  return Math.asin(Math.sin(lat * RAD) * Math.sin(dec) + Math.cos(lat * RAD) * Math.cos(dec) * Math.cos(ha)) / RAD;
}

// Minutes the realm's zone is ahead of UTC at `date`.
export function tzOffset(tz, date) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    .formatToParts(date).map((x) => [x.type, x.value]));
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute);
  return Math.round((asUTC - Math.floor(date.getTime() / 60000) * 60000) / 60000);
}

export function realmClock(realm, date) {
  const off = tzOffset(realm.tz, date);
  const local = new Date(date.getTime() + off * 60000); // read with getUTC*
  return { off, month: local.getUTCMonth(), hour: local.getUTCHours() + local.getUTCMinutes() / 60, y: local.getUTCFullYear(), m: local.getUTCMonth(), d: local.getUTCDate() };
}

// The real Date when the realm's wall clock shows `hour` today.
export function realmDateAt(realm, date, hour) {
  const c = realmClock(realm, date);
  return new Date(Date.UTC(c.y, c.m, c.d, 0, 0) + hour * 3600000 - c.off * 60000);
}

export function sunTimes(realm, date) {
  const start = realmDateAt(realm, date, 0);
  let rise = null, set = null, prev = solarAltitude(start, realm.lat, realm.lon);
  for (let m = 10; m <= 1440; m += 10) {
    const t = new Date(+start + m * 60000);
    const a = solarAltitude(t, realm.lat, realm.lon);
    if (prev < -0.83 && a >= -0.83 && !rise) rise = t;
    if (prev >= -0.83 && a < -0.83 && !set) set = t;
    prev = a;
  }
  return { rise, set };
}

export function seasonOf(realm, date) {
  const m = realmClock(realm, date).month; // 0-11
  const north = ['winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter'][m];
  if (realm.hemisphere === 'north') return north;
  return { winter: 'summer', summer: 'winter', spring: 'autumn', autumn: 'spring' }[north];
}

export function moonPhase(date) {
  const ref = Date.UTC(2000, 0, 6, 18, 14); // a known new moon
  const p = ((date - ref) / 86400000 / 29.530588) % 1;
  return p < 0 ? p + 1 : p;
}

export function phaseName(alt, morning) {
  if (alt < -6) return 'night';
  if (alt < 6) return morning ? 'dawn' : 'dusk';
  return 'day';
}

// WMO weather codes from Open-Meteo → the scene's weather kinds.
export function weatherKind(code, cloud = 0) {
  if (code == null) return 'clear';
  if (code >= 95) return 'storm';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if (code === 45 || code === 48) return 'fog';
  if (code === 3 || cloud > 70) return 'cloudy';
  if (code === 2 || cloud > 35) return 'partly';
  return 'clear';
}

const cache = {};
export async function fetchWeather(realm) {
  const c = cache[realm.id];
  if (c && Date.now() - c.at < 30 * 60000) return c.data;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${realm.lat}&longitude=${realm.lon}&current=weather_code,temperature_2m,cloud_cover`;
  const r = await fetch(url);
  if (!r.ok) throw new Error('weather unavailable');
  const j = await r.json();
  const data = { code: j.current.weather_code, temp: j.current.temperature_2m, cloud: j.current.cloud_cover };
  cache[realm.id] = { at: Date.now(), data };
  return data;
}
