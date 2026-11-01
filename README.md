# Hearthside Quest Planner

A cozy pixel-art RPG planner. It reads your calendar, finds the free stretches between engagements (after commute, meals and buffers), and pins **quests** for them on a board — weighed against your mood, how busy the week is, your weekly targets, training side-effects and long-term goals.

## Run it

No install needed — just Python 3 (already on macOS).

```bash
python3 serve.py
```

Then open http://localhost:5173. Or double-click `start.command`.

Use `localhost` (not `127.0.0.1`) — Google sign-in only allows `localhost` origins.

## Pages

| Page | What it does |
|---|---|
| **Today** | The day's road (events, travel, meals, open quests) and the quest board for the selected slot. Accept, complete or abandon quests. |
| **Week** | The Omen (how busy the week is), weekly outlook, quest balance, and a 7-day map. Click a day to open it. |
| **Quest Log** | Long-term commitments: deadlines (prep hours), events/trips (prep tasks N days before), ongoing goals (weekly habits). Plus your chronicle and XP. |
| **Character** | Every preference: realm, wake/sleep, meals, training rules, places & travel times, activities (liking, intensity, sweaty, where, when, weekly target). Export/import a save file. |
| **Scrolls** | Google Calendar connection, `.ics` import, sample calendar, and the optional Claude Oracle. |

## How suggestions are made

For each open slot the engine scores every enabled activity and active goal:

- **Fits the slot** — duration + travel there and on + wash-up time must fit.
- **Mood** — morning check-in (stamina, what your spirit craves, ailments) and weekly outlook.
- **Week load** — share of waking hours spoken for. Busy weeks favour rest and shorter quests; calm weeks favour adventure.
- **Balance** — weekly targets; once met, that activity is pushed down ("don't overdo it"). Calendar events with matching titles count too.
- **Training side-effects** — no hard training near bedtime, recovery between hard sessions, one hard session a day, saving energy before important events (interview, presentation, dinner…), easing off before a heavy tomorrow, and needing a shower before the next engagement.
- **Long-term goals** — deadline pressure = prep hours left vs realistic free time before the due date; trip tasks surface in the days before they're due.
- **Variety** — the day's picks spread across categories.

Every card lists its reasons so you can see why it was chosen.

## Google Calendar

Scrolls → follow "How to get a client ID". Add `http://localhost:5173` as an authorised JavaScript origin. Tokens live only in the tab's memory; you re-connect after a reload (one click).

## The Oracle (optional)

Paste an Anthropic API key in Scrolls and enable it. "Consult the Oracle" sends that day's timeline, preferences, mood and goals to Claude (`claude-opus-5-5`), which re-ranks the engine's already-valid candidates and narrates the day.

## Art

Everything in the scene is drawn procedurally: the real sun and moon (with phase) for the realm's location, sky colours and lighting through the day, live weather from Open-Meteo, and seasons (jacaranda spring in Melbourne, sakura spring in Taipei, autumn leaves, bare winter trees, fireflies on summer nights). The quest board's notes match today's open quests. Use **🔭 Scry** to preview any hour, season or weather.

## Data

Everything is saved in your browser's localStorage. Use Character → Export save to back it up.
