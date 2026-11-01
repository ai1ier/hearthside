// The focus panel: timer, controls, ambience and session notes.
import { html, useState, useEffect, useRef } from '../vendor.js';
import { focusStatus, pauseFocus, resumeFocus, extendFocus, setPomodoro, setNotes, finishFocus, finishOuting, endFocus, POMOS, pomoOf, OUTINGS } from '../focus.js';
import { setAmbience, setVolume, chime } from '../ambience.js';
import { Portrait, Meter, keeperLabel } from './common.js';
import { hash } from '../time.js';

const CHEER = {
  focus: ['You’re doing wonderfully. One page at a time.', 'Steady quill, steady heart.', 'Every minute here is a stone on the path.', 'The candle burns, and so does your focus. Lovely.', 'Small, patient steps make the grandest quests.'],
  break: ['Tea break! Stretch, sip, and look out the window.', 'Rest your eyes, dear. The book will wait.', 'A little wander around the room does wonders.'],
  done: ['Quest complete! I’m so proud of you — claim your reward.', 'You did it! The hourglass is full.'],
  paused: ['Paused. Take all the time you need.'],
};

export const mmss = (min) => { const t = Math.max(0, Math.round(min * 60)); return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; };

const OUT_CHEER = {
  fitness: ['Strong legs, strong heart! Go at your own pace.', 'Every stride counts — and so does the cool-down.', 'Breathe deep. The river runs right alongside you.'],
  social: ['Good company is the best kind of magic.', 'Laugh loudly, stay late if you like. Rest is part of the quest.', 'Raise a mug to friendship!'],
  outdoors: ['Listen — the woods are saying hello.', 'No hurry out here. Notice one small, lovely thing.', 'Fresh air and quiet paths. Just what the oracle ordered.'],
  chores: ['A tidy hearth is a happy hearth.', 'One shelf at a time — look how it sparkles!', 'Put on a song and let the broom dance.'],
};

function OutingPanel({ state }) {
  const f = state.focus, o = OUTINGS[f.category];
  const [, tick] = useState(0);
  useEffect(() => { const id = setInterval(() => tick((n) => n + 1), 15000); return () => clearInterval(id); }, []);
  const mins = Math.max(1, Math.round((Date.now() - f.startedAt) / 60000));
  const q = state.quests.find((x) => x.id === f.questId);
  const lines = OUT_CHEER[f.category] || OUT_CHEER.chores;
  const cheer = f.doneAt ? `Wonderful! Quest complete${q ? ` — +${q.xp} XP` : ''}. Let’s head home to the meadow.` : lines[Math.floor(hash(f.questId + Math.floor(mins / 10)) * lines.length)];
  return html`<section class="panel focus-panel outing-panel" aria-live="polite">
    <div class="focus-top">
      <div class="focus-quest">
        <small>${o.icon} ${o.where} · ${mins}m so far</small>
        <h3>${f.icon} ${f.title}</h3>
        <small>Planned for ${f.minutes} min — come back and mark it done whenever you finish.</small>
      </div>
    </div>
    <div class="row">
      ${f.doneAt ? html`<span class="tag gold">✨ Complete</span>` : html`
        <button class="btn gold" onClick=${finishOuting}>✓ Mark done</button>
        <button class="btn sm ghost" onClick=${endFocus} title="Stop without completing; the quest stays on your road">Head home without finishing</button>`}
    </div>
    <div class="keeper-row">
      <${Portrait} scale=${3} />
      <div class="speech"><div class="speaker">${keeperLabel(state.profile)}</div><p>${cheer}</p></div>
    </div>
    ${!f.doneAt && html`<label class="field"><span class="field-label">A note for your diary (optional)</span>
      <textarea rows="2" value=${f.notes} placeholder="Who did you see? How did it feel?" onInput=${(e) => setNotes(e.target.value)}></textarea></label>`}
  </section>`;
}

function LoggedPanel({ state }) {
  const f = state.focus, q = state.quests.find((x) => x.id === f.questId);
  return html`<section class="panel focus-panel outing-panel" aria-live="polite">
    <div class="keeper-row">
      <${Portrait} scale=${3} />
      <div class="speech"><div class="speaker">${keeperLabel(state.profile)}</div>
        <p>✨ “${f.icon} ${f.title}” is in the chronicle${q ? ` — +${q.xp} XP` : ''}. Well done, even if the ink is a little late!</p></div>
    </div>
  </section>`;
}

export function FocusPanel({ state }) {
  if (state.focus.logged) return html`<${LoggedPanel} state=${state} />`;
  if (state.focus.mode === 'outing' && OUTINGS[state.focus.category]) return html`<${OutingPanel} state=${state} />`;
  return html`<${StudyPanel} state=${state} />`;
}

function StudyPanel({ state }) {
  const f = state.focus;
  const [, tick] = useState(0);
  const [sound, setSound] = useState(null);
  const [vol, setVol] = useState(0.5);
  const chimed = useRef(false);
  useEffect(() => { const id = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(id); }, []);
  useEffect(() => () => setAmbience(null), []);
  const st = focusStatus(f);
  const paused = !!f.pausedAt;
  const mood = paused ? 'paused' : st.phase;
  useEffect(() => {
    if (st.phase === 'done' && !chimed.current) { chimed.current = true; chime(); }
    document.title = st.phase === 'done' ? '✨ Quest complete · Hearthside' : `${paused ? '⏸ ' : ''}${mmss(st.left)} · ${f.title}`;
  });
  useEffect(() => () => { document.title = 'Hearthside Quest Planner'; }, []);
  const goal = f.goalId ? state.profile.goals.find((g) => g.id === f.goalId) : null;
  const cheer = CHEER[mood][Math.floor(hash(f.questId + Math.floor(st.focused / 5)) * CHEER[mood].length)];
  const toggleSound = (k) => { const next = sound === k ? null : k; setSound(next); setAmbience(next, vol); };

  return html`<section class="panel focus-panel" aria-live="polite">
    <div class="focus-top">
      <div class="focus-quest">
        <small>${st.phase === 'break' ? '☕ Tea break' : st.phase === 'done' ? '✨ Complete' : paused ? '⏸ Paused' : f.pomodoro ? `Focus · round ${st.round}` : 'Focusing'}</small>
        <h3>${f.icon} ${f.title}</h3>
        ${goal && goal.type === 'deadline' ? html`<small>${goal.title}: ${(goal.hoursDone + st.focused / 60).toFixed(1)}/${goal.hoursNeeded}h prepared</small>` : null}
      </div>
      <div class=${'timer' + (st.phase === 'break' ? ' rest' : '') + (paused ? ' paused' : '')}>${st.phase === 'done' ? 'DONE' : mmss(st.left)}</div>
    </div>
    <${Meter} value=${st.progress} color=${st.phase === 'break' ? '#7ab0c0' : '#f2c14a'} label=${`${Math.round(st.focused)} of ${f.minutes} focus minutes`} />
    <div class="focus-meta"><span>${Math.round(st.focused)} / ${f.minutes} min focused</span>${f.pomodoro ? html`<span>${pomoOf(f).focus}m focus · ${pomoOf(f).rest}m tea</span>` : null}</div>

    <div class="row">
      ${st.phase === 'done'
        ? html`<button class="btn gold" onClick=${finishFocus}>✨ Claim reward</button><button class="btn sm" onClick=${() => { chimed.current = false; extendFocus(10); }}>Keep going +10m</button>`
        : html`
          ${paused ? html`<button class="btn sm gold" onClick=${resumeFocus}>▶ Resume</button>` : html`<button class="btn sm" onClick=${pauseFocus}>⏸ Pause</button>`}
          <button class="btn sm" onClick=${() => extendFocus(5)}>+5 min</button>
          <button class="btn sm gold" onClick=${finishFocus} title="Complete now and keep the minutes you focused">✓ Finish early</button>
          <button class="btn sm ghost" onClick=${endFocus} title="Stop without completing; the quest stays on your road">Leave the study</button>`}
    </div>

    <div class="focus-grid">
      <div class="keeper-row">
        <${Portrait} scale=${3} />
        <div class="speech"><div class="speaker">${keeperLabel(state.profile)}</div><p>${cheer}</p></div>
      </div>
      <div class="focus-opts">
        <div class="row"><span class="field-label">Tea breaks</span>
          ${[['', 'Off'], ...Object.keys(POMOS).map((k) => [k, k])].map(([k, label]) => html`<button class=${'btn xs' + ((pomoOf(f) ? Object.keys(POMOS).find((x) => POMOS[x] === pomoOf(f)) : '') === k ? ' on' : '')} onClick=${() => setPomodoro(k)}>${label}</button>`)}
        </div>
        <div class="row">
          <span class="field-label">Ambience</span>
          <button class=${'btn xs' + (sound === 'rain' ? ' on' : '')} onClick=${() => toggleSound('rain')}>🌧️ Rain</button>
          <button class=${'btn xs' + (sound === 'hearth' ? ' on' : '')} onClick=${() => toggleSound('hearth')}>🔥 Hearth</button>
          ${sound && html`<input type="range" min="0" max="1" step="0.05" value=${vol} aria-label="Volume" onInput=${(e) => { setVol(+e.target.value); setVolume(+e.target.value); }} />`}
        </div>
      </div>
    </div>
    <label class="field"><span class="field-label">Session notes — saved to your diary when you finish</span>
      <textarea rows="2" value=${f.notes} placeholder="What did you cover? Anything to remember next time?" onInput=${(e) => setNotes(e.target.value)}></textarea></label>
  </section>`;
}
