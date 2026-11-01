// The Character sheet: every preference the quest giver uses.
import { html, useState } from '../vendor.js';
import { store } from '../store.js';
import { REALMS, CATEGORIES } from '../defaults.js';
import { PERIODS } from '../time.js';
import { Field, toast } from './common.js';

const P = (patch) => store.setProfile(patch);
const num = (e) => +e.target.value;

export function Character({ state }) {
  const p = state.profile;
  const [allRealms, setAllRealms] = useState(false);
  const places = p.places.filter((x) => allRealms || x.realm === p.realm || x.realm === 'any');
  const placeOpts = p.places.filter((x) => x.realm === p.realm || x.realm === 'any');

  const setPlace = (id, patch) => P({ places: p.places.map((x) => (x.id === id ? { ...x, ...patch } : x)) });
  const setAct = (id, patch) => P({ activities: p.activities.map((x) => (x.id === id ? { ...x, ...patch } : x)) });
  const setFit = (patch) => P({ fitness: { ...p.fitness, ...patch } });

  const exportData = () => {
    const blob = new Blob([JSON.stringify(store.get(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'quest-planner-save.json'; a.click();
  };
  const importData = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { const s = JSON.parse(await f.text()); store.set(s); toast('Save file restored'); } catch { toast('That file is not a planner save'); }
  };

  return html`
    <section class="char">
      <div class="cols">
        <div class="panel">
          <h3>🧝 Identity</h3>
          <div class="grid2">
            <${Field} label="Name"><input value=${p.name} onInput=${(e) => P({ name: e.target.value })} /></${Field}>
            <${Field} label="Title"><input value=${p.title} onInput=${(e) => P({ title: e.target.value })} /></${Field}>
            <${Field} label="Current realm" hint="Switches places, seasons, sunrise and weather">
              <select value=${p.realm} onChange=${(e) => P({ realm: e.target.value })}>${Object.values(REALMS).map((r) => html`<option value=${r.id}>${r.label}</option>`)}</select></${Field}>
            <${Field} label="Usual travel">
              <select value=${p.travelMode} onChange=${(e) => P({ travelMode: e.target.value })}>
                <option value="transit">🚆 Public transit</option><option value="car">🐎 Car</option><option value="walk">🥾 Walk / bike</option></select></${Field}>
          </div>
        </div>
        <div class="panel">
          <h3>🌞 Daily rhythm</h3>
          <div class="grid2">
            <${Field} label="Wake"><input type="time" value=${p.day.wake} onInput=${(e) => P({ day: { ...p.day, wake: e.target.value } })} /></${Field}>
            <${Field} label="Sleep"><input type="time" value=${p.day.sleep} onInput=${(e) => P({ day: { ...p.day, sleep: e.target.value } })} /></${Field}>
            <${Field} label="Shortest quest gap (min)"><input type="number" min="15" step="5" value=${p.minSlot} onInput=${(e) => P({ minSlot: num(e) })} /></${Field}>
            <${Field} label="Buffer around events (min)"><input type="number" min="0" step="5" value=${p.bufferMin} onInput=${(e) => P({ bufferMin: num(e) })} /></${Field}>
            <${Field} label="Travel to unknown places (min)"><input type="number" min="0" step="5" value=${p.defaultTravelMin} onInput=${(e) => P({ defaultTravelMin: num(e) })} /></${Field}>
          </div>
          <h4>Meals</h4>
          ${p.meals.map((m, i) => html`<div class="item-row">
            <input class="grow" value=${m.name} onInput=${(e) => P({ meals: p.meals.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
            <input type="time" value=${m.at} onInput=${(e) => P({ meals: p.meals.map((x, j) => (j === i ? { ...x, at: e.target.value } : x)) })} />
            <label class="inline"><input type="number" min="10" step="5" value=${m.min} onInput=${(e) => P({ meals: p.meals.map((x, j) => (j === i ? { ...x, min: num(e) } : x)) })} /> min</label>
            <button class="btn xs ghost" aria-label="Remove meal" onClick=${() => P({ meals: p.meals.filter((_, j) => j !== i) })}>✕</button></div>`)}
          <button class="btn xs" onClick=${() => P({ meals: [...p.meals, { name: 'Snack', at: '15:30', min: 15 }] })}>+ meal</button>
        </div>
      </div>

      <div class="panel">
        <h3>⚔️ Training rules</h3>
        <p class="muted">Fitness is suggested — but never so much that it wrecks the rest of your schedule.</p>
        <div class="grid4">
          <${Field} label="Wash-up after sweaty quests (min)"><input type="number" min="0" step="5" value=${p.fitness.showerMin} onInput=${(e) => setFit({ showerMin: num(e) })} /></${Field}>
          <${Field} label="No hard training within … of bedtime (min)"><input type="number" min="0" step="15" value=${p.fitness.noIntenseBeforeSleepMin} onInput=${(e) => setFit({ noIntenseBeforeSleepMin: num(e) })} /></${Field}>
          <${Field} label="Recovery between hard sessions (h)"><input type="number" min="0" value=${p.fitness.recoveryHours} onInput=${(e) => setFit({ recoveryHours: num(e) })} /></${Field}>
          <${Field} label="Save energy before events containing" hint="comma separated"><input value=${p.fitness.importantKeywords.join(', ')} onChange=${(e) => setFit({ importantKeywords: e.target.value.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean) })} /></${Field}>
        </div>
      </div>

      <div class="panel">
        <h3>🗺️ Places & travel <label class="inline right"><input type="checkbox" checked=${allRealms} onChange=${(e) => setAllRealms(e.target.checked)} /> show all realms</label></h3>
        <p class="muted">Events are matched to a place by keywords in their location or title. Travel time is from home; trips between two other places are estimated.</p>
        <div class="table-wrap"><table class="tbl">
          <thead><tr><th>Name</th><th>Realm</th><th>Min from home</th><th>Keywords</th><th>Shower</th><th>Home</th><th></th></tr></thead>
          <tbody>${places.map((x) => html`<tr>
            <td><input value=${x.name} onInput=${(e) => setPlace(x.id, { name: e.target.value })} /></td>
            <td><select value=${x.realm} onChange=${(e) => setPlace(x.id, { realm: e.target.value })}>${[...Object.values(REALMS), { id: 'any', label: 'Any' }].map((r) => html`<option value=${r.id}>${r.label}</option>`)}</select></td>
            <td><input type="number" min="0" class="n" value=${x.fromHome} disabled=${x.isHome} onInput=${(e) => setPlace(x.id, { fromHome: num(e) })} /></td>
            <td><input value=${x.keywords.join(', ')} onChange=${(e) => setPlace(x.id, { keywords: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} /></td>
            <td><input type="checkbox" checked=${!!x.hasShower} onChange=${(e) => setPlace(x.id, { hasShower: e.target.checked })} /></td>
            <td><input type="radio" name=${'home-' + x.realm} checked=${!!x.isHome} onChange=${() => P({ places: p.places.map((y) => (y.realm === x.realm ? { ...y, isHome: y.id === x.id, fromHome: y.id === x.id ? 0 : y.fromHome } : y)) })} /></td>
            <td>${!x.isHome && html`<button class="btn xs ghost" aria-label="Remove place" onClick=${() => P({ places: p.places.filter((y) => y.id !== x.id) })}>✕</button>`}</td>
          </tr>`)}</tbody></table></div>
        <button class="btn xs" onClick=${() => P({ places: [...p.places, { id: 'pl-' + Date.now().toString(36), name: 'New place', realm: p.realm, fromHome: 20, keywords: [] }] })}>+ place</button>
      </div>

      <div class="panel">
        <h3>🎒 Activities you enjoy</h3>
        <p class="muted">Liking, weekly targets and intensity steer the quest giver. Intensity 2–3 counts as hard training; “sweaty” adds wash-up time. Calendar events with matching titles count toward the weekly target.</p>
        <div class="table-wrap"><table class="tbl acts">
          <thead><tr><th>On</th><th></th><th>Activity</th><th>Type</th><th>Min–max (min)</th><th>Intensity</th><th>Sweaty</th><th>Where</th><th>When</th><th>Per week</th><th>Liking</th><th title="Calendar events whose title contains these words count toward this activity">Counts events titled</th><th></th></tr></thead>
          <tbody>${p.activities.map((a) => html`<tr class=${a.enabled === false ? 'off' : ''}>
            <td><input type="checkbox" checked=${a.enabled !== false} onChange=${(e) => setAct(a.id, { enabled: e.target.checked })} /></td>
            <td><input class="icon" value=${a.icon} onInput=${(e) => setAct(a.id, { icon: e.target.value })} /></td>
            <td><input value=${a.name} onInput=${(e) => setAct(a.id, { name: e.target.value })} /></td>
            <td><select value=${a.category} onChange=${(e) => setAct(a.id, { category: e.target.value })}>${Object.entries(CATEGORIES).filter(([k]) => k !== 'main').map(([k, c]) => html`<option value=${k}>${c.icon} ${c.label}</option>`)}</select></td>
            <td class="nowrap"><input type="number" class="n" min="5" step="5" value=${a.minMin} onInput=${(e) => setAct(a.id, { minMin: num(e) })} />–<input type="number" class="n" min="5" step="5" value=${a.maxMin} onInput=${(e) => setAct(a.id, { maxMin: num(e) })} /></td>
            <td><select value=${a.intensity} onChange=${(e) => setAct(a.id, { intensity: num(e) })}>${[0, 1, 2, 3].map((v) => html`<option value=${v}>${['0 restful', '1 light', '2 moderate', '3 hard'][v]}</option>`)}</select></td>
            <td><input type="checkbox" checked=${a.sweat} onChange=${(e) => setAct(a.id, { sweat: e.target.checked })} /></td>
            <td><select value=${a.place} onChange=${(e) => setAct(a.id, { place: e.target.value })}>
              <option value="any">Anywhere</option><option value="home">Home</option>${placeOpts.filter((x) => !x.isHome).map((x) => html`<option value=${x.id}>${x.name}</option>`)}
              ${a.place !== 'any' && a.place !== 'home' && !placeOpts.some((x) => x.id === a.place) ? html`<option value=${a.place}>(other realm)</option>` : null}</select></td>
            <td class="nowrap">${PERIODS.map((t) => html`<button class=${'btn xs tod' + (a.times.includes(t) ? ' on' : '')} title=${t}
              onClick=${() => setAct(a.id, { times: a.times.includes(t) ? a.times.filter((x) => x !== t) : [...a.times, t] })}>${{ morning: '🌅', afternoon: '☀️', evening: '🌇', night: '🌙' }[t]}</button>`)}</td>
            <td><input type="number" class="n" min="0" value=${a.weeklyTarget} onInput=${(e) => setAct(a.id, { weeklyTarget: num(e) })} /></td>
            <td class="nowrap">${[1, 2, 3, 4, 5].map((v) => html`<button class=${'star' + (v <= a.weight ? ' on' : '')} aria-label=${`Liking ${v}`} onClick=${() => setAct(a.id, { weight: v })}>★</button>`)}</td>
            <td><input value=${(a.matches || []).join(', ')} placeholder="e.g. gym, yoga" onChange=${(e) => setAct(a.id, { matches: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} /></td>
            <td><button class="btn xs ghost" aria-label="Remove activity" onClick=${() => P({ activities: p.activities.filter((x) => x.id !== a.id) })}>✕</button></td>
          </tr>`)}</tbody></table></div>
        <button class="btn xs" onClick=${() => P({ activities: [...p.activities, { id: 'a-' + Date.now().toString(36), name: 'New activity', category: 'creative', icon: '✨', minMin: 30, maxMin: 60, intensity: 0, sweat: false, place: 'any', times: ['afternoon', 'evening'], weeklyTarget: 0, weight: 3, enabled: true }] })}>+ activity</button>
      </div>

      <div class="panel">
        <h3>💾 Save file</h3>
        <p class="muted">Progress is saved in this browser, and in your Google Drive if you turn on Cloud save (Settings → Calendar & stars). You can also export a save file as a backup — it includes your Claude key if you’ve added one, so keep it private.</p>
        <div class="row">
          <button class="btn sm" onClick=${exportData}>Export save</button>
          <label class="btn sm">Import save<input type="file" accept="application/json" hidden onChange=${importData} /></label>
          <button class="btn sm danger" onClick=${() => { if (confirm('Erase all progress, preferences and quests?')) store.reset(); }}>Start a new game</button>
        </div>
      </div>
    </section>`;
}
