// Google Calendar via Google Identity Services (browser token flow).
// The access token lives in memory only; it is re-requested after a reload.
const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events';
const API = 'https://www.googleapis.com/calendar/v3';

let tokenClient = null, clientIdUsed = '', token = null, tokenExp = 0;

function gis() {
  const g = window.google?.accounts?.oauth2;
  if (!g) throw new Error('Google sign-in script has not loaded yet — check your connection and try again.');
  return g;
}

export function isSignedIn() { return !!token && Date.now() < tokenExp - 60000; }

export function signIn(clientId, prompt = '') {
  if (!clientId) return Promise.reject(new Error('Add your Google OAuth client ID first.'));
  return new Promise((resolve, reject) => {
    if (!tokenClient || clientIdUsed !== clientId) {
      tokenClient = gis().initTokenClient({ client_id: clientId, scope: SCOPES, callback: () => {} });
      clientIdUsed = clientId;
    }
    tokenClient.callback = (r) => {
      if (r.error) return reject(new Error(r.error_description || r.error));
      token = r.access_token; tokenExp = Date.now() + r.expires_in * 1000; resolve();
    };
    tokenClient.error_callback = (e) => reject(new Error(e.message || e.type || 'Sign-in was closed'));
    tokenClient.requestAccessToken({ prompt });
  });
}

export function signOut() {
  if (token) window.google?.accounts?.oauth2?.revoke(token, () => {});
  token = null; tokenExp = 0;
}

async function api(path, opts = {}) {
  const res = await fetch(API + path, { ...opts, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(opts.headers || {}) } });
  if (!res.ok) throw new Error(`Google Calendar ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.status === 204 ? null : res.json();
}

export async function listCalendars() {
  const r = await api('/users/me/calendarList?minAccessRole=reader');
  return r.items.map((c) => ({ id: c.id, name: c.summaryOverride || c.summary, primary: !!c.primary, color: c.backgroundColor }));
}

export async function fetchEvents(calendarIds, timeMin, timeMax) {
  const out = [];
  for (const cal of calendarIds) {
    let pageToken = '';
    do {
      const q = new URLSearchParams({ timeMin: timeMin.toISOString(), timeMax: timeMax.toISOString(), singleEvents: 'true', orderBy: 'startTime', maxResults: '250' });
      if (pageToken) q.set('pageToken', pageToken);
      const r = await api(`/calendars/${encodeURIComponent(cal)}/events?${q}`);
      for (const e of r.items || []) {
        if (e.status === 'cancelled') continue;
        if (e.transparency === 'transparent' && !e.start?.date) continue; // marked "free"
        const mine = e.attendees?.find((a) => a.self);
        if (mine?.responseStatus === 'declined') continue;
        const allDay = !!e.start.date;
        out.push({
          id: `g:${cal}:${e.id}`, gid: e.id, cal, title: e.summary || '(busy)', location: e.location || '',
          start: allDay ? new Date(e.start.date + 'T00:00').toISOString() : e.start.dateTime,
          end: allDay ? new Date(e.end.date + 'T00:00').toISOString() : e.end.dateTime,
          allDay, source: 'google', questId: e.extendedProperties?.private?.questPlannerId || null,
        });
      }
      pageToken = r.nextPageToken;
    } while (pageToken);
  }
  return out;
}

export async function insertQuestEvent(quest) {
  const body = {
    summary: `${quest.icon || '✦'} ${quest.title}`,
    description: 'Accepted quest from Hearthside Quest Planner',
    start: { dateTime: quest.start }, end: { dateTime: quest.end },
    extendedProperties: { private: { questPlannerId: quest.id } },
  };
  const r = await api('/calendars/primary/events', { method: 'POST', body: JSON.stringify(body) });
  return r.id;
}

export async function deleteQuestEvent(gcalId) {
  await api(`/calendars/primary/events/${encodeURIComponent(gcalId)}`, { method: 'DELETE' });
}
