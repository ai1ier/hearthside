import { html, render, useState, useEffect, useMemo } from './vendor.js';
import { store, useStore } from './store.js';
import { iso, startOfDay, sameDay } from './time.js';
import { computeDay } from './engine/index.js';
import { buildOracleContext, consultOracle } from './ai/claude.js';
import { SceneHeader } from './ui/SceneHeader.js';
import { Checkin } from './ui/Checkin.js';
import { Today } from './ui/Today.js';
import { Week } from './ui/Week.js';
import { QuestLog } from './ui/QuestLog.js';
import { Library } from './ui/Library.js';
import { Character } from './ui/Character.js';
import { Scrolls } from './ui/Scrolls.js';
import { AvatarStudio } from './ui/Avatar.js';
import { BoardModal } from './ui/BoardModal.js';
import { Toasts, toast } from './ui/common.js';
import { useCloud, syncNow } from './cloud.js';
import { FocusPanel } from './ui/Focus.js';

const TABS = [
  { id: 'today', label: 'Today', icon: '🕯️' },
  { id: 'week', label: 'Week', icon: '🗺️' },
  { id: 'log', label: 'Quest Log', icon: '👑' },
  { id: 'library', label: 'Library', icon: '📚' },
];
const SETTINGS = [
  { id: 'avatar', label: 'Avatar & oracle', icon: '🧙' },
  { id: 'char', label: 'Character', icon: '🧝' },
  { id: 'scrolls', label: 'Calendar & stars', icon: '📜' },
];
const parseHash = () => {
  const [t, sub] = location.hash.slice(1).split(':');
  if (t === 'settings') return { tab: 'settings', sub: SETTINGS.some((x) => x.id === sub) ? sub : 'avatar' };
  return { tab: TABS.some((x) => x.id === t) ? t : 'today', sub: null };
};

function App() {
  const state = useStore();
  const [route, setRoute] = useState(parseHash);
  const { tab, sub } = route;
  const go = (t, s = null) => setRoute({ tab: t, sub: t === 'settings' ? s || sub || 'avatar' : null });
  const [day, setDay] = useState(() => startOfDay(new Date()));
  const [sel, setSel] = useState(null);
  const [board, setBoard] = useState(null); // null = closed, else { focus }
  const [minute, setMinute] = useState(0);
  const [checkin, setCheckin] = useState(() => !store.get().moods[iso(new Date())]);
  const [oracleBusy, setOracleBusy] = useState(false);

  useEffect(() => { const id = setInterval(() => setMinute((m) => m + 1), 60000); return () => clearInterval(id); }, []);
  useEffect(() => { history.replaceState(null, '', '#' + (tab === 'settings' ? `settings:${sub}` : tab)); }, [tab, sub]);
  useEffect(() => {
    const f = () => setRoute(parseHash());
    addEventListener('hashchange', f); return () => removeEventListener('hashchange', f);
  }, []);

  const events = store.events();
  const data = useMemo(() => computeDay(state, events, day), [state, events, iso(day), minute]);
  const todayData = useMemo(() => (sameDay(day, new Date()) ? data : computeDay(state, events, new Date())), [data, state, events, minute]);
  const openToday = todayData.dayPlan.slots.filter((s) => !s.past).length;
  const offersFor = (d) => (sameDay(d.date, day) ? data.offers : computeDay(state, events, d.date).offers);

  const openSlot = (id) => { setBoard(null); setDay(startOfDay(new Date())); setSel(id); go('today'); };

  const oracle = async () => {
    setOracleBusy(true);
    try {
      const ctx = buildOracleContext(state, data.dayPlan, data.week, data.offers, data.ctx.mood, data.ctx.weekMood);
      const reading = await consultOracle(state.profile.settings.claudeKey, ctx);
      store.set((s) => ({ oracle: { ...s.oracle, [data.dayPlan.key]: { ...reading, at: Date.now() } } }));
      toast(`✨ ${store.get().profile.keeper?.name || 'Hoot'} has read the stars`);
    } catch (e) { toast(`Stars: ${e.message}`); }
    setOracleBusy(false);
  };

  return html`
    <${SceneHeader} state=${state} openQuests=${openToday}
      onBoard=${(i) => { const s = todayData.dayPlan.slots.filter((x) => !x.past)[i]; if (s) openSlot(s.id); else setBoard({ focus: null }); }}
      onAvatar=${() => go('settings', 'avatar')} />
    <nav class="tabs" role="tablist">
      ${TABS.map((t) => html`<button role="tab" aria-selected=${tab === t.id} class=${'tab' + (tab === t.id ? ' on' : '')} onClick=${() => go(t.id)}><span>${t.icon}</span> ${t.label}</button>`)}
      <button role="tab" aria-selected=${tab === 'settings'} class=${'tab gear' + (tab === 'settings' ? ' on' : '')} onClick=${() => go('settings')} aria-label="Settings"><span>⚙️</span> Settings</button>
    </nav>
    <main>
      <${CloudBanner} />
      ${state.focus && html`<${FocusPanel} state=${state} />`}
      ${tab === 'today' && html`<${Today} state=${state} data=${data} day=${day} setDay=${(d) => setDay(startOfDay(d))} sel=${sel} setSel=${setSel} onCheckin=${() => setCheckin(true)} onOracle=${oracle} oracleBusy=${oracleBusy} />`}
      ${tab === 'week' && html`<${Week} state=${state} events=${events} week=${data.week} day=${day} setDay=${(d) => setDay(startOfDay(d))} offersFor=${offersFor} onPickDay=${(d) => { setDay(startOfDay(d)); go('today'); }} />`}
      ${tab === 'log' && html`<${QuestLog} state=${state} />`}
      ${tab === 'library' && html`<${Library} state=${state} />`}
      ${tab === 'settings' && html`
        <div class="subtabs">${SETTINGS.map((t) => html`<button class=${'btn sm' + (sub === t.id ? ' on' : '')} onClick=${() => go('settings', t.id)}>${t.icon} ${t.label}</button>`)}</div>
        ${sub === 'avatar' && html`<${AvatarStudio} state=${state} />`}
        ${sub === 'char' && html`<${Character} state=${state} />`}
        ${sub === 'scrolls' && html`<${Scrolls} state=${state} />`}`}
    </main>
    <footer class="foot">Hearthside Quest Planner · your data stays in this browser and, if you choose, your own Google Drive</footer>
    ${board && html`<${BoardModal} data=${todayData} focus=${board.focus} onOpen=${openSlot} onClose=${() => setBoard(null)} />`}
    ${checkin && html`<${Checkin} state=${state} week=${todayData.week} onClose=${() => setCheckin(false)} />`}
    <${Toasts} />`;
}

// a gentle nudge when cloud saving is on but Google needs a click to carry on
function CloudBanner() {
  const c = useCloud();
  if (!['signin', 'paused', 'error'].includes(c.state)) return null;
  const go = async () => { try { await syncNow(); } catch (e) { toast(`Google: ${e.message}`); } };
  return html`<div class="cloud-banner" role="status">
    <span>${c.state === 'signin' ? '☁️ Cloud save is waiting — sign in to keep your progress backed up.' : c.state === 'paused' ? '☁️ Cloud save is paused: this device and your Drive have different saves.' : `☁️ Cloud save hit a snag: ${c.msg}`}</span>
    <button class="btn xs gold" onClick=${go}>${c.state === 'signin' ? 'Sign in with Google' : c.state === 'paused' ? 'Choose a save' : 'Try again'}</button>
  </div>`;
}

render(html`<${App} />`, document.getElementById('app'));
