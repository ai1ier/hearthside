// Calendar connections and the optional Claude Oracle.
import { html, useState } from '../vendor.js';
import { store } from '../store.js';
import { Field, toast } from './common.js';
import { syncGoogle, useDemo } from '../actions.js';
import { isSignedIn, signOut } from '../calendar/google.js';
import { parseICS } from '../calendar/ics.js';
import { addDays, startOfWeek } from '../time.js';

const S = (patch) => store.setProfile((p) => ({ settings: { ...p.settings, ...patch } }));

export function Scrolls({ state }) {
  const s = state.profile.settings;
  const [busy, setBusy] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const origin = location.origin;

  const sync = async () => {
    setBusy(true);
    try { await syncGoogle(true); } catch (e) { toast(`Google: ${e.message}`); }
    setBusy(false);
  };
  const importIcs = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    const from = addDays(startOfWeek(new Date()), -7), to = addDays(new Date(), 90);
    const events = parseICS(await f.text(), from, to);
    store.set({ events, source: 'ics', lastSync: Date.now() });
    toast(`Imported ${events.length} events from ${f.name}`);
  };
  const toggleCal = (id, on) => S({ calendars: on ? [...new Set([...s.calendars, id])] : s.calendars.filter((c) => c !== id) });

  return html`
    <section class="scrolls">
      <div class="panel">
        <h3>🗓️ Calendar scrolls</h3>
        <p>Currently reading: <b>${{ demo: 'Sample calendar', google: 'Google Calendar', ics: 'Imported .ics file' }[state.source]}</b>
          ${state.lastSync ? html` · last synced ${new Date(state.lastSync).toLocaleString()}` : null} · ${state.events.length} events</p>

        <h4>Google Calendar</h4>
        <${Field} label="OAuth client ID" hint="Looks like 1234-abc.apps.googleusercontent.com">
          <input value=${s.googleClientId} placeholder="your-client-id.apps.googleusercontent.com" onInput=${(e) => S({ googleClientId: e.target.value.trim() })} />
        </${Field}>
        <div class="row">
          <button class="btn sm gold" disabled=${busy || !s.googleClientId} onClick=${sync}>${busy ? 'Syncing…' : isSignedIn() ? '↻ Sync now' : 'Connect & sync'}</button>
          ${isSignedIn() && html`<button class="btn sm ghost" onClick=${() => { signOut(); toast('Signed out of Google'); store.set({}); }}>Sign out</button>`}
          ${state.source !== 'demo' && html`<button class="btn sm ghost" onClick=${useDemo}>Use sample calendar</button>`}
        </div>
        ${s.calendarList?.length ? html`<div class="cal-list"><span class="field-label">Calendars to read</span>
          ${s.calendarList.map((c) => html`<label class="inline"><input type="checkbox" checked=${s.calendars.includes(c.id)} onChange=${(e) => toggleCal(c.id, e.target.checked)} />
            <span class="swatch" style=${{ background: c.color }}></span>${c.name}</label>`)}
          <small class="hint">Change the selection, then sync again.</small></div>` : null}
        <details class="howto">
          <summary>How to get a client ID (about 5 minutes, free)</summary>
          <ol>
            <li>Open <a href="https://console.cloud.google.com/projectcreate" target="_blank" rel="noopener">Google Cloud Console</a> and create a project (any name).</li>
            <li>Go to <b>APIs & Services → Library</b>, search <b>Google Calendar API</b>, and enable it.</li>
            <li>Go to <b>APIs & Services → OAuth consent screen</b>: choose <b>External</b>, fill in the app name and your email, and add yourself under <b>Test users</b>.</li>
            <li>Go to <b>Credentials → Create credentials → OAuth client ID</b>, type <b>Web application</b>.</li>
            <li>Under <b>Authorised JavaScript origins</b> add <code>${origin}</code>.</li>
            <li>Copy the client ID into the field above and press <b>Connect & sync</b>.</li>
          </ol>
          <p class="muted">Access tokens stay in this tab's memory only. The planner reads your events and, when you tick the box while accepting, writes the quest to your primary calendar.</p>
        </details>

        <h4>Other calendars (.ics)</h4>
        <p class="muted">Apple Calendar: File → Export. Outlook: save calendar as .ics. Recurring weekly/daily events are supported.</p>
        <label class="btn sm">Import .ics file<input type="file" accept=".ics,text/calendar" hidden onChange=${importIcs} /></label>
      </div>

      <div class="panel">
        <h3>🔮 The Oracle (Claude)</h3>
        <p class="muted">Optional. The built-in quest giver works offline. With a Claude API key, “Consult the Oracle” on the Today page asks Claude to re-rank the day's quests and narrate it.
          It sends that day's event titles and times, your preferences, mood and goals to the Anthropic API. Your key is stored in this browser only.</p>
        <${Field} label="Anthropic API key">
          <span class="row"><input class="grow" type=${showKey ? 'text' : 'password'} value=${s.claudeKey} placeholder="sk-ant-…" autocomplete="off" onInput=${(e) => S({ claudeKey: e.target.value.trim() })} />
          <button class="btn xs ghost" onClick=${() => setShowKey(!showKey)}>${showKey ? 'Hide' : 'Show'}</button></span>
        </${Field}>
        <label class="inline"><input type="checkbox" checked=${s.useClaude} onChange=${(e) => S({ useClaude: e.target.checked })} /> Enable the Oracle</label>
      </div>
    </section>`;
}
