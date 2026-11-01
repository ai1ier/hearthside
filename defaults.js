// The starting profile. Everything here is editable from the Character sheet;
// it is seeded for the first user (Melbourne-based, travels home to Taiwan, public transit).
import { addDays, iso } from './time.js';
import { defaultAvatar, defaultKeeper } from './art/sprites.js';

export const REALMS = {
  melbourne: { id: 'melbourne', label: 'Melbourne', lat: -37.81, lon: 144.96, tz: 'Australia/Melbourne', hemisphere: 'south', climate: 'temperate', spring: 'jacaranda' },
  taipei: { id: 'taipei', label: 'Taipei', lat: 25.03, lon: 121.56, tz: 'Asia/Taipei', hemisphere: 'north', climate: 'subtropical', spring: 'sakura' },
};

export const CATEGORIES = {
  fitness:  { label: 'Strength & Stride', icon: '⚔️', color: '#c0563a' },
  outdoors: { label: 'Wilds',             icon: '🌿', color: '#4f8f3a' },
  creative: { label: 'Artisan',           icon: '🎨', color: '#8a5bc4' },
  learning: { label: 'Scholar',           icon: '📜', color: '#3a6fb0' },
  social:   { label: 'Fellowship',        icon: '🍻', color: '#d08a2a' },
  rest:     { label: 'Hearth',            icon: '🕯️', color: '#7a6a5a' },
  chores:   { label: 'Homestead',         icon: '🧺', color: '#5a8a80' },
  main:     { label: 'Main Quest',        icon: '👑', color: '#b8892a' },
};

// intensity: 0 restful … 3 hard training. sweat: needs a wash-up afterwards.
const A = (id, name, category, icon, minMin, maxMin, o = {}) => ({
  id, name, category, icon, minMin, maxMin,
  intensity: 0, sweat: false, place: 'any', times: ['morning', 'afternoon', 'evening'],
  weeklyTarget: 0, weight: 3, enabled: true, ...o,
});

export function defaultProfile() {
  const today = new Date();
  return {
    version: 2,
    name: '', // asked for on first visit (and editable in Settings)
    title: 'Hearth Witch',
    avatar: defaultAvatar(),
    avatarDesigns: [], // uploads you chose to keep: {id, name, image, size}
    keeper: defaultKeeper(),
    realm: 'melbourne',
    day: { wake: '07:30', sleep: '23:30' },
    minSlot: 30,          // shortest gap worth a quest
    bufferMin: 10,        // breathing room around events
    defaultTravelMin: 30, // events at unknown locations
    travelMode: 'transit',
    meals: [
      { name: 'Lunch', at: '12:30', min: 40 },
      { name: 'Dinner', at: '19:00', min: 50 },
    ],
    fitness: {
      showerMin: 20,              // wash-up after sweaty quests
      noIntenseBeforeSleepMin: 150, // keeps hard training away from bedtime
      recoveryHours: 20,          // between hard sessions
      importantKeywords: ['interview', 'presentation', 'exam', 'meeting', 'date', 'dinner', 'party', 'wedding'],
    },
    places: [
      { id: 'home', name: 'Home', realm: 'melbourne', isHome: true, fromHome: 0, keywords: ['home'], hasShower: true },
      { id: 'campus', name: 'Campus / Work', realm: 'melbourne', fromHome: 35, keywords: ['uni', 'campus', 'university', 'unimelb', 'rmit', 'monash', 'swinburne', 'deakin', 'lecture', 'tutorial', 'class', 'office', 'work', 'library'] },
      { id: 'gym', name: 'Gym', realm: 'melbourne', fromHome: 15, keywords: ['gym', 'fitness', 'pilates studio', 'climbing'], hasShower: true },
      { id: 'city', name: 'City centre', realm: 'melbourne', fromHome: 30, keywords: ['cbd', 'city', 'flinders', 'swanston', 'bourke st', 'collins st', 'melbourne central', 'lygon st', 'queen victoria market', 'restaurant', 'cafe', 'café', 'bar', 'cinema'] },
      { id: 'coast', name: 'Bayside / beach', realm: 'melbourne', fromHome: 40, keywords: ['beach', 'st kilda', 'brighton', 'williamstown', 'elwood', 'bayside', 'coastal'] },
      { id: 'park', name: 'Neighbourhood park', realm: 'melbourne', fromHome: 8, keywords: ['park', 'gardens', 'tan track', 'yarra'] },
      { id: 'tp-home', name: 'Family home', realm: 'taipei', isHome: true, fromHome: 0, keywords: ['home', '家'], hasShower: true },
      { id: 'tp-city', name: 'Xinyi / city', realm: 'taipei', fromHome: 25, keywords: ['xinyi', '信義', 'taipei 101', 'restaurant', 'cafe', 'mall'] },
      { id: 'tp-river', name: 'Riverside park', realm: 'taipei', fromHome: 15, keywords: ['riverside', '河濱', 'park'] },
      { id: 'tp-gym', name: 'Sports centre', realm: 'taipei', fromHome: 12, keywords: ['gym', '運動中心', 'sports centre'], hasShower: true },
    ],
    routes: [], // optional overrides: { a: placeId, b: placeId, min }
    activities: [
      A('gym', 'Strength session', 'fitness', '🏋️', 60, 75, { intensity: 3, sweat: true, place: 'gym', times: ['morning', 'afternoon', 'evening'], weeklyTarget: 2, weight: 4, matches: ['gym', 'workout', 'weights'] }),
      A('run', 'Easy run', 'fitness', '🏃', 30, 45, { intensity: 2, sweat: true, place: 'park', times: ['morning', 'evening'], weeklyTarget: 1, weight: 3, matches: ['run', 'parkrun', 'jog'] }),
      A('stretch', 'Yoga & stretch', 'fitness', '🧘', 20, 40, { intensity: 1, place: 'home', times: ['morning', 'evening', 'night'], weeklyTarget: 2, weight: 3, matches: ['yoga', 'pilates', 'stretch'] }),
      A('coastwalk', 'Bayside walk', 'outdoors', '🌊', 75, 150, { intensity: 1, place: 'coast', times: ['morning', 'afternoon'], weeklyTarget: 1, weight: 4 }),
      A('stroll', 'Stroll & fresh air', 'outdoors', '🚶', 20, 40, { intensity: 1, place: 'any', times: ['morning', 'afternoon', 'evening'], weight: 3 }),
      A('pixelart', 'Pixel art / drawing', 'creative', '🎨', 45, 120, { place: 'home', times: ['afternoon', 'evening', 'night'], weeklyTarget: 2, weight: 4 }),
      A('journal', 'Journaling', 'creative', '📓', 15, 30, { place: 'any', times: ['morning', 'night'], weight: 3 }),
      A('read', 'Read a book', 'learning', '📖', 30, 60, { place: 'any', times: ['afternoon', 'evening', 'night'], weeklyTarget: 3, weight: 4 }),
      A('course', 'Online course / skill', 'learning', '💻', 45, 90, { place: 'any', times: ['morning', 'afternoon'], weeklyTarget: 1, weight: 3 }),
      A('callfam', 'Call family in Taiwan', 'social', '📞', 20, 45, { place: 'home', times: ['evening'], weeklyTarget: 1, weight: 5, note: 'Melbourne evening ≈ Taipei afternoon', matches: ['mum', 'dad', 'mom', 'parents', 'family call', '媽', '爸'] }),
      A('coffee', 'Coffee with a friend', 'social', '☕', 60, 90, { place: 'city', times: ['morning', 'afternoon'], weight: 3 }),
      A('nap', 'Power nap', 'rest', '💤', 20, 30, { place: 'home', times: ['afternoon'], weight: 2, restores: true }),
      A('cozy', 'Tea & a cozy show', 'rest', '🍵', 30, 90, { place: 'home', times: ['evening', 'night'], weight: 3, restores: true }),
      A('mealprep', 'Meal prep', 'chores', '🍱', 60, 90, { place: 'home', times: ['afternoon', 'evening'], weeklyTarget: 1, weight: 3 }),
      A('tidy', 'Laundry & tidy', 'chores', '🧺', 30, 45, { place: 'home', times: ['morning', 'afternoon', 'evening'], weeklyTarget: 1, weight: 2 }),
      A('groceries', 'Groceries', 'chores', '🛒', 30, 45, { place: 'any', times: ['afternoon', 'evening'], weeklyTarget: 1, weight: 2 }),
    ],
    // Sample long-term goals — edit them into your own in the Quest Log.
    goals: [
      { id: 'g-final', type: 'deadline', title: 'Final project / exam prep', due: iso(addDays(today, 18)), hoursNeeded: 12, hoursDone: 2, sessionMin: 90, place: 'any', sample: true },
      { id: 'g-taiwan', type: 'event', title: 'Trip back to Taiwan', due: iso(addDays(today, 40)), sample: true, items: [
        { id: 'i1', text: 'Book flights', daysBefore: 30, minutes: 45, done: false },
        { id: 'i2', text: 'Buy gifts for family', daysBefore: 12, minutes: 90, done: false, place: 'city' },
        { id: 'i3', text: 'Sort phone roaming & cards', daysBefore: 5, minutes: 30, done: false },
        { id: 'i4', text: 'Pack luggage', daysBefore: 2, minutes: 60, done: false },
      ] },
      { id: 'g-5k', type: 'ongoing', title: 'Run a comfortable 5k', weeklyTarget: 2, sessionMin: 30, linkedActivityId: 'run', sample: true },
      { id: 'g-books', type: 'ongoing', title: 'Read 2 books a month', weeklyTarget: 3, sessionMin: 30, linkedActivityId: 'read', sample: true },
    ],
    settings: {
      googleClientId: '',
      calendars: [],      // selected Google calendar ids
      claudeKey: '',
      useClaude: false,
    },
  };
}
