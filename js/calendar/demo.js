// A believable sample calendar (three weeks from this Monday) so the planner
// is alive before any real calendar is connected.
import { startOfWeek, addDays, atTime } from '../time.js';

const WEEK = [
  // [weekday 0=Mon, title, start, end, location]
  [0, 'Lecture: Interaction Design', '10:00', '12:00', 'University – Building 11'],
  [0, 'Tutorial', '14:00', '15:00', 'University – Building 3'],
  [1, 'Work shift', '09:00', '17:00', 'Office, Level 4'],
  [2, 'Lecture: Data Visualisation', '13:00', '15:00', 'University – Library lecture hall'],
  [2, 'Dinner with Mia', '19:00', '21:00', 'Restaurant, Lygon St'],
  [3, 'Work shift', '09:00', '13:00', 'Office, Level 4'],
  [3, 'Group project meeting', '15:00', '16:30', 'University – Library room 2'],
  [4, 'Lecture: Interaction Design', '10:00', '12:00', 'University – Building 11'],
  [4, 'Game night', '19:30', '22:30', "Sam's place, Fitzroy"],
  [5, 'Brunch with friends', '11:00', '13:00', 'Cafe in the city'],
  [6, 'Farmers market', '09:30', '11:00', 'Queen Victoria Market, city'],
  [6, 'Video call with Mum & Dad', '17:00', '17:45', 'Online'],
];

export function demoEvents(now) {
  const monday = startOfWeek(now);
  const out = [];
  for (let w = 0; w < 3; w++) {
    for (const [wd, title, s, e, loc] of WEEK) {
      if (w === 1 && title === 'Game night') continue; // a little variety between weeks
      const day = addDays(monday, w * 7 + wd);
      out.push({ id: `demo-${w}-${wd}-${s}`, title, location: loc, start: atTime(day, s).toISOString(), end: atTime(day, e).toISOString(), allDay: false, source: 'demo' });
    }
  }
  out.push({ id: 'demo-deadline', title: 'Assignment 2 due', location: '', start: addDays(monday, 9).toISOString(), end: addDays(monday, 10).toISOString(), allDay: true, source: 'demo' });
  return out;
}
