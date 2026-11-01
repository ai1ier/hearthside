// The innkeeper's morning (and weekly) questions.
import { html, useState } from '../vendor.js';
import { store } from '../store.js';
import { iso, startOfWeek } from '../time.js';
import { Portrait, Hearts, keeperLabel } from './common.js';
import { SPIRITS } from '../engine/suggest.js';

const ENERGY = [
  { v: 5, label: 'Brimming', say: 'Oh, I can feel that glow from here! Today is going to be a good one.' },
  { v: 4, label: 'Strong', say: 'Wonderful — the stars like a bright flask.' },
  { v: 3, label: 'Steady', say: 'Steady is a lovely way to travel. Good things come to steady walkers.' },
  { v: 2, label: 'Running low', say: 'That’s alright. Gentle days still move you forward.' },
  { v: 1, label: 'Nearly empty', say: 'Then today, resting IS the quest — and you’ll do it beautifully.' },
];
const AILMENTS = [
  { v: 'none', label: 'None — hale and whole', icon: '✨' },
  { v: 'tired', label: 'Slept poorly', icon: '🥱' },
  { v: 'sore', label: 'Sore muscles', icon: '🦵' },
  { v: 'stressed', label: 'A stressed mind', icon: '🌀' },
];
const OUTLOOK = [
  { v: 'seize', label: 'Seize the week!', icon: '🔥', hint: 'More ambitious quests' },
  { v: 'steady', label: 'A steady march', icon: '🥾', hint: 'Balanced' },
  { v: 'survive', label: 'Just survive it', icon: '🛡️', hint: 'Lighter quests, more rest' },
];

export function Checkin({ state, week, onClose }) {
  const today = new Date();
  const wkKey = iso(startOfWeek(today));
  const [needWeek] = useState(() => !state.weekMoods[wkKey]);
  const [needName] = useState(() => !state.profile.name);
  const [step, setStep] = useState(needName ? 'name' : needWeek ? 'week' : 'energy');
  const [ans, setAns] = useState({});
  const [reply, setReply] = useState('');
  const [typed, setTyped] = useState('');
  const name = state.profile.name || 'traveller';

  const finish = (a) => {
    store.set((s) => ({ moods: { ...s.moods, [iso(today)]: { energy: a.energy ?? 3, spirit: a.spirit, ailment: a.ailment || 'none', at: Date.now() } } }));
    onClose();
  };

  const giveName = (e) => {
    e?.preventDefault();
    const n = typed.trim().slice(0, 24);
    if (!n) return;
    store.setProfile({ name: n });
    setReply(`${n}! What a fine name for an adventurer.`);
    setStep(needWeek ? 'week' : 'energy');
  };

  let q;
  if (step === 'name') {
    q = {
      say: 'Well met, traveller, and welcome to the hearth! Before we plan any quests — what shall I call you?',
      form: html`<form class="name-ask" onSubmit=${giveName}>
        <input type="text" value=${typed} maxlength="24" placeholder="Your name" aria-label="Your name" autofocus onInput=${(e) => setTyped(e.target.value)} />
        <button class="btn sm gold" disabled=${!typed.trim()}>That’s me</button>
      </form>`,
      opts: [],
    };
  } else if (step === 'week') {
    q = {
      say: `${reply ? reply + ' And a fresh week begins!' : `A fresh week, ${name}!`} The stars call it ${week.level.icon} ${week.level.name}. Whatever it brings, I believe you’ll meet it well. How do you feel about the road ahead?`,
      opts: OUTLOOK.map((o) => ({ ...o, pick: () => {
        store.set((s) => ({ weekMoods: { ...s.weekMoods, [wkKey]: { outlook: o.v, at: Date.now() } } }));
        setReply(o.v === 'survive' ? 'Getting through is a victory too — and I’ll keep things kind.' : o.v === 'seize' ? 'That spark! The week doesn’t stand a chance.' : 'One lovely step after another, then.');
        setStep('energy');
      } })),
    };
  } else if (step === 'energy') {
    q = {
      say: `${reply ? reply + ' ' : `Welcome back, ${name} — I’m so glad you’re here! `}How full is your stamina flask today?`,
      opts: ENERGY.map((o) => ({ ...o, icon: html`<${Hearts} value=${o.v} px=${2} />`, pick: () => { setAns({ ...ans, energy: o.v }); setReply(o.say); setStep('spirit'); } })),
    };
  } else if (step === 'spirit') {
    q = {
      say: `${reply} And what is your heart wishing for today?`,
      opts: Object.entries(SPIRITS).map(([v, s]) => ({ v, label: s.label, icon: s.icon, pick: () => { setAns({ ...ans, spirit: v }); setReply(''); setStep('ailment'); } })),
    };
  } else {
    q = {
      say: 'Last one, dear — anything weighing on you that I should be gentle about?',
      opts: AILMENTS.map((o) => ({ ...o, pick: () => finish({ ...ans, ailment: o.v }) })),
    };
  }

  return html`
    <div class="modal-back" role="dialog" aria-modal="true" aria-label="Innkeeper check-in">
      <div class="modal panel">
        <div class="keeper-row">
          <${Portrait} scale=${5} />
          <div class="speech">
            <div class="speaker">${keeperLabel(state.profile)}</div>
            <p>${q.say}</p>
          </div>
        </div>
        ${q.form}
        <div class="choices">
          ${q.opts.map((o) => html`<button class="choice" onClick=${o.pick}><span class="choice-icon">${o.icon}</span><span>${o.label}${o.hint ? html`<small>${o.hint}</small>` : null}</span></button>`)}
        </div>
        <div class="modal-foot">
          <button class="link" onClick=${() => finish(ans)}>Skip for today</button>
          <span class="dots">${['name', 'week', 'energy', 'spirit', 'ailment'].filter((s) => (needName || s !== 'name') && (needWeek || s !== 'week')).map((s) => html`<i class=${s === step ? 'on' : ''}></i>`)}</span>
        </div>
      </div>
    </div>`;
}

export { ENERGY, OUTLOOK };
