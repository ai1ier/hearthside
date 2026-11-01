// Google sign-in (Google Identity Services, browser token flow) and Google Calendar.
// The access token lives in memory only; it is re-requested after a reload.
// Calendar and Drive (cloud save) are asked for separately, so a player can allow just one.
import { GOOGLE_CLIENT_ID } from '../config.js';

export const CAL_SCOPES = 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events';
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const API = 'https://www.googleapis.com/calendar/v3';

let tokenClient = null, clientKey = '', token = null, tokenExp = 0, granted = null;

// the player's own client ID if they set one, else the one this copy of the app ships with
export const clientIdFor = (profile) => profile?.settings?.googleClientId?.trim() || GOOGLE_CLIENT_ID;

function gis() {
  const g = window.google?.accounts?.oauth2;
  if (!g) throw new Error('Google sign-in script has not loaded yet — check your connection and try again.');
  return g;
}

export function isSignedIn(scope = CAL_SCOPES) {
  return !!token && Date.now() < tokenExp - 60000 && !!window.google?.accounts?.oauth2?.hasGrantedAllScopes(granted, ...scope.split(' '));
}
export const accessToken = () => token;

export function signIn(clientId, prompt = '', scope = CAL_SCOPES) {
  if (!clientId) return Promise.reject(new Error('Add your Google OAuth client ID first.'));
  return new Promise((resolve, reject) => {
    if (!tokenClient || clientKey !== clientId + scope) {
      tokenClient = gis().initTokenClient({ client_id: clientId, scope, include_granted_scopes: true, callback: () => {} });
      clientKey = clientId + scope;
    }
    tokenClient.callback = (r) => {
      if (r.error) return reject(new Error(r.error_description || r.error));
      if (!gis().hasGrantedAllScopes(r, ...scope.split(' '))) return reject(new Error('Google access wasn’t allowed — tick the permission box when signing in.'));
      token = r.access_token; tokenExp = Date.now() + r.expires_in * 1000; granted = r; resolve();
    };
    tokenClient.error_callback = (e) => reject(new Error(e.message || e.type || 'Sign-in was closed'));
    tokenClient.requestAccessToken({ prompt });
  });
}

export function signOut() {
  if (token) window.google?.accounts?.oauth2?.revoke(token, () => {});
  token = null; tokenExp = 0; granted = null;
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
