import { srv } from './bridge.js';
import { bus } from './bus.js';
import { debounce } from './util.js';

export const DEFAULT_SETTINGS = {
  wallpaper: 'peaks',
  customWallpaper: '',
  frame: 'obsidian',
  ringtone: 'ember',
  notifSound: 'drop',
  volume: 0.6,
  airplane: false,
  dnd: false,
  silent: false,
  clock24: true,
  showZone: true,
  brightness: 1,
  hints: true,
  previews: true,
  lockEnabled: false,
  pin: '',
  phoneName: '',
  order: [],
};

export const store = {
  me: null,
  settings: { ...DEFAULT_SETTINGS },
  apps: [],
  badges: {},
  config: { filters: [], zooms: [0.5, 1, 3], coins: [], catalog: [], casino: { min: 10, max: 50000 }, emergency: {}, video: true, currency: '$' },
  setupDone: true,
  notifications: [],
  contacts: [],
  time: { h: 12, m: 0, game: false },
  zone: '',
  unlocked: false,
};

const pushSettings = debounce(() => srv('saveSettings', { settings: store.settings }), 600);

export function setSetting(key, value) {
  store.settings[key] = value;
  bus.emit('settings', { key, value });
  if (key === 'airplane') srv('setAirplane', { enabled: value });
  pushSettings();
}

export function setBadge(app, value) {
  store.badges[app] = Math.max(0, value | 0);
  bus.emit('badges', store.badges);
}
export function addBadge(app, n = 1) { setBadge(app, (store.badges[app] || 0) + n); }

export async function refreshContacts() {
  const res = await srv('contacts:list');
  store.contacts = Array.isArray(res) ? res : [];
  bus.emit('contacts', store.contacts);
  return store.contacts;
}

export function contactName(number) {
  const c = store.contacts.find((x) => String(x.number) === String(number));
  return c ? c.name : null;
}
