// Cloud save: keeps a copy of the planner in the hidden app-data folder of the player's own
// Google Drive (only this app can see it), so progress follows them to any device.
// Changes are pushed a few seconds after they happen; the cloud copy is checked again on
// sign-in and whenever the tab comes back into view. If two devices both changed since they
// last agreed, the player is asked which one to keep.
import { useEffect, useState } from './vendor.js';
import { store } from './store.js';
import * as gcal from './calendar/google.js';

const META = 'questplanner.cloud';
const FILE = 'hearthside-save.json';
const DRIVE = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const PUSH_EVERY = 8000;

// what this device remembers: sync switched on, the Drive file, and the save both sides last agreed on
let meta = (() => { try { return JSON.parse(localStorage.getItem(META)) || {}; } catch { return {}; } })();
const saveMeta = (patch) => { meta = { ...meta, ...patch }; try { localStorage.setItem(META, JSON.stringify(meta)); } catch { /* blocked */ } };

// status for the UI: off | signin (switched on, needs Google again) | syncing | synced | paused | error
let status = { state: meta.on ? 'signin' : 'off', at: meta.lastSync || null, msg: '' };
const listeners = new Set();
const setStatus = (patch) => { status = { ...status, ...patch }; listeners.forEach((f) => f(status)); };

export function useCloud() {
  const [s, setS] = useState(status);
  useEffect(() => { listeners.add(setS); return () => listeners.delete(setS); }, []);
  return s;
}

const signedIn = () => gcal.isSignedIn(gcal.DRIVE_SCOPE);

async function drive(url, opts = {}) {
  const res = await fetch(url, { ...opts, headers: { Authorization: `Bearer ${gcal.accessToken()}`, ...(opts.headers || {}) } });
  if (res.status === 401) { const e = new Error('Google sign-in expired'); e.expired = true; throw e; }
  if (!res.ok) throw new Error(`Google Drive ${res.status}: ${(await res.text()).slice(0, 160)}`);
  return res.json();
}

const findFile = async () => (await drive(`${DRIVE}/files?spaces=appDataFolder&fields=files(id,modifiedTime)&q=${encodeURIComponent(`name='${FILE}'`)}`)).files[0] || null;
const download = (id) => drive(`${DRIVE}/files/${id}?alt=media`);

// your Claude key never leaves this browser
function pack(s) {
  const { claudeKey, ...settings } = s.profile.settings;
  return { app: 'hearthside', v: 1, savedAt: s.savedAt, data: { ...s, profile: { ...s.profile, settings } } };
}
function unpack(remote) {
  const local = store.get().profile.settings;
  const d = remote.data;
  return { ...d, savedAt: remote.savedAt, profile: { ...d.profile, settings: { ...d.profile.settings, claudeKey: local.claudeKey, googleClientId: local.googleClientId } } };
}

async function upload() {
  const s = store.get(), body = JSON.stringify(pack(s));
  let f;
  if (meta.fileId) {
    f = await drive(`${UPLOAD}/files/${meta.fileId}?uploadType=media&fields=id,modifiedTime`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body, keepalive: body.length < 60000 });
  } else {
    const b = 'hearth' + Math.random().toString(36).slice(2);
    const head = JSON.stringify({ name: FILE, parents: ['appDataFolder'], mimeType: 'application/json' });
    f = await drive(`${UPLOAD}/files?uploadType=multipart&fields=id,modifiedTime`, {
      method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${b}` },
      body: `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${head}\r\n--${b}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${b}--`,
    });
  }
  agreed(f, s.savedAt);
}

function agreed(f, savedAt) {
  saveMeta({ fileId: f.id, remoteModified: f.modifiedTime, syncedAt: savedAt, lastSync: Date.now() });
  setStatus({ state: 'synced', at: meta.lastSync, msg: '' });
}

const summary = (s) => {
  const xp = s.xp || 0, done = (s.quests || []).filter((q) => q.done).length;
  return `${s.profile?.name || 'unnamed'} · ${xp} XP · ${done} quests done`;
};
const untouched = (s) => !s.xp && !(s.quests || []).length && !(s.diary || []).length;

let busy = null;
// Bring this device and the cloud copy back in step.
function reconcile() {
  busy ||= (async () => {
    try {
      setStatus({ state: 'syncing' });
      const f = await findFile();
      if (!f) { saveMeta({ fileId: null }); await upload(); return; }
      saveMeta({ fileId: f.id });
      if (f.modifiedTime === meta.remoteModified) { // nobody else touched the Drive copy
        if (store.get().savedAt !== meta.syncedAt) await upload(); else agreed(f, meta.syncedAt);
        return;
      }
      const remote = await download(f.id);
      const local = store.get();
      const localChanged = local.savedAt !== meta.syncedAt, remoteChanged = remote.savedAt !== meta.syncedAt;
      if (!remoteChanged) { if (localChanged) await upload(); else agreed(f, remote.savedAt); return; }
      if (!localChanged || untouched(local)) { store.replace(unpack(remote)); agreed(f, remote.savedAt); return; }
      // both sides moved on: ask
      const when = new Date(remote.savedAt).toLocaleString();
      if (confirm(`☁️ Your Google Drive has a different save (from ${when}):\n${summary(remote.data)}\n\nThis device has:\n${summary(local)}\n\nOK — load the Drive save onto this device\nCancel — choose something else`)) {
        store.replace(unpack(remote)); agreed(f, remote.savedAt);
      } else if (confirm('Replace the Drive save with this device’s progress instead?\n\n(Cancel pauses cloud saving here, so nothing is overwritten.)')) {
        await upload();
      } else {
        setStatus({ state: 'paused', msg: 'Paused so neither save is overwritten. Press Sync now to choose again.' });
      }
    } catch (e) {
      setStatus(e.expired ? { state: 'signin', msg: '' } : { state: 'error', msg: e.message });
    } finally { busy = null; }
  })();
  return busy;
}

// Turn cloud saving on (needs a click, since Google shows a sign-in window).
export async function connectCloud() {
  try {
    if (!signedIn()) await gcal.signIn(gcal.clientIdFor(store.get().profile), '', gcal.DRIVE_SCOPE);
  } catch (e) { setStatus({ state: meta.on ? 'signin' : 'off', msg: e.message }); throw e; }
  saveMeta({ on: true });
  await reconcile();
}

export function syncNow() { return signedIn() ? reconcile() : connectCloud(); }

export function disconnectCloud() {
  meta = {}; try { localStorage.removeItem(META); } catch { /* blocked */ }
  setStatus({ state: 'off', at: null, msg: '' });
}

// push local changes, a few seconds after they settle (at most every PUSH_EVERY ms)
let timer = null, lastPush = 0;
store.subscribe((s) => {
  if (!meta.on || s.savedAt === meta.syncedAt || status.state === 'paused') return;
  if (!signedIn()) { if (status.state !== 'signin') setStatus({ state: 'signin' }); return; }
  timer ||= setTimeout(() => { timer = null; lastPush = Date.now(); reconcile(); }, Math.max(3000, PUSH_EVERY - (Date.now() - lastPush)));
});
// closing the tab with a change still waiting: send it on the way out
addEventListener('pagehide', () => {
  if (timer && meta.fileId && signedIn() && !busy) { clearTimeout(timer); timer = null; upload().catch(() => {}); }
});
// coming back to the tab: pick up anything saved on another device
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && meta.on && signedIn() && status.state !== 'paused') reconcile();
});
