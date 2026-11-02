const STORAGE_KEY = 'console-os-state-v1';
const STORAGE_VERSION = 1;

const defaults = {
  version: STORAGE_VERSION,
  profile: {
    name: 'Guest',
    avatar: 'P',
    color: '#b04d52'
  },
  settings: {
    language: 'en',
    network: 'HomeNet',
    reduceMotion: false,
    sound: true,
    theme: 'night-garden'
  },
  installed: ['neon-afterburn', 'orbit-runner', 'crystal-shift', 'signal-garden', 'browser', 'store', 'settings'],
  recent: [],
  scores: {},
  trophies: [],
  notes: '',
  captures: [],
  downloads: []
};

const allowedLanguages = new Set(['en', 'de', 'sq']);
const allowedNetworks = new Set(['HomeNet', 'Studio Mesh', 'Guest Wi-Fi', 'Offline']);
const listeners = new Set();

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function cleanString(value, fallback, limit = 80) {
  if (typeof value !== 'string') return fallback;
  const cleaned = value.trim().slice(0, limit);
  return cleaned || fallback;
}

function uniqueStrings(value, limit = 100) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((entry) => typeof entry === 'string').map((entry) => entry.slice(0, 80)))].slice(0, limit);
}

function normalize(candidate) {
  const source = candidate && typeof candidate === 'object' ? candidate : {};
  const profile = source.profile && typeof source.profile === 'object' ? source.profile : {};
  const settings = source.settings && typeof source.settings === 'object' ? source.settings : {};
  const normalized = clone(defaults);

  normalized.profile.name = cleanString(profile.name, defaults.profile.name, 18);
  normalized.profile.avatar = cleanString(profile.avatar, defaults.profile.avatar, 2);
  normalized.profile.color = /^#[0-9a-f]{6}$/i.test(profile.color) ? profile.color : defaults.profile.color;
  normalized.settings.language = allowedLanguages.has(settings.language) ? settings.language : defaults.settings.language;
  normalized.settings.network = allowedNetworks.has(settings.network) ? settings.network : defaults.settings.network;
  normalized.settings.reduceMotion = Boolean(settings.reduceMotion);
  normalized.settings.sound = settings.sound !== false;
  normalized.settings.theme = cleanString(settings.theme, defaults.settings.theme, 40);
  normalized.installed = uniqueStrings(source.installed, 100);
  normalized.recent = uniqueStrings(source.recent, 12);
  normalized.trophies = uniqueStrings(source.trophies, 100);
  normalized.notes = typeof source.notes === 'string' ? source.notes.slice(0, 12000) : '';
  normalized.captures = Array.isArray(source.captures)
    ? source.captures.filter((capture) => capture && typeof capture === 'object').slice(0, 40).map((capture) => ({
      id: cleanString(capture.id, crypto.randomUUID(), 40),
      gameId: cleanString(capture.gameId, 'unknown', 80),
      createdAt: cleanString(capture.createdAt, new Date().toISOString(), 40),
      dataUrl: typeof capture.dataUrl === 'string' && capture.dataUrl.startsWith('data:image/') ? capture.dataUrl.slice(0, 1_000_000) : ''
    }))
    : [];
  normalized.downloads = Array.isArray(source.downloads)
    ? source.downloads.filter((entry) => entry && typeof entry === 'object').slice(0, 40).map((entry) => ({
      id: cleanString(entry.id, 'download', 80),
      status: cleanString(entry.status, 'complete', 20),
      progress: Math.max(0, Math.min(100, Number(entry.progress) || 0)),
      updatedAt: cleanString(entry.updatedAt, new Date().toISOString(), 40)
    }))
    : [];
  normalized.scores = source.scores && typeof source.scores === 'object'
    ? Object.fromEntries(Object.entries(source.scores).filter(([id, score]) => typeof id === 'string' && Number.isFinite(Number(score))).slice(0, 100).map(([id, score]) => [id, Math.max(0, Number(score))]))
    : {};

  for (const id of defaults.installed) {
    if (!normalized.installed.includes(id)) normalized.installed.push(id);
  }
  return normalized;
}

function readRaw() {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeRaw(value) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

let state;

try {
  state = normalize(JSON.parse(readRaw() || 'null'));
} catch {
  state = clone(defaults);
}

function notify(change) {
  const snapshot = getState();
  for (const listener of listeners) listener(snapshot, change);
  window.dispatchEvent(new CustomEvent('console-state-change', { detail: { change, state: snapshot } }));
}

function commit(change) {
  state.version = STORAGE_VERSION;
  const saved = writeRaw(state);
  notify({ ...change, persisted: saved });
  return saved;
}

export function getState() {
  return clone(state);
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function updateProfile(patch = {}) {
  if (typeof patch.name === 'string') state.profile.name = cleanString(patch.name, 'Guest', 18);
  if (typeof patch.avatar === 'string') state.profile.avatar = cleanString(patch.avatar, 'P', 2);
  if (typeof patch.color === 'string' && /^#[0-9a-f]{6}$/i.test(patch.color)) state.profile.color = patch.color;
  return commit({ type: 'profile' });
}

export function updateSettings(patch = {}) {
  if (allowedLanguages.has(patch.language)) state.settings.language = patch.language;
  if (allowedNetworks.has(patch.network)) state.settings.network = patch.network;
  if (typeof patch.reduceMotion === 'boolean') state.settings.reduceMotion = patch.reduceMotion;
  if (typeof patch.sound === 'boolean') state.settings.sound = patch.sound;
  if (typeof patch.theme === 'string') state.settings.theme = cleanString(patch.theme, defaults.settings.theme, 40);
  return commit({ type: 'settings' });
}

export function install(id) {
  if (typeof id !== 'string' || state.installed.includes(id)) return false;
  state.installed.push(id);
  state.downloads = [{ id, status: 'complete', progress: 100, updatedAt: new Date().toISOString() }, ...state.downloads].slice(0, 40);
  commit({ type: 'install', id });
  return true;
}

export function uninstall(id) {
  if (defaults.installed.includes(id)) return false;
  const length = state.installed.length;
  state.installed = state.installed.filter((entry) => entry !== id);
  if (state.installed.length === length) return false;
  commit({ type: 'uninstall', id });
  return true;
}

export function recordLaunch(id) {
  if (typeof id !== 'string') return;
  state.recent = [id, ...state.recent.filter((entry) => entry !== id)].slice(0, 12);
  commit({ type: 'launch', id });
}

export function recordScore(id, score) {
  if (typeof id !== 'string' || !Number.isFinite(score)) return;
  state.scores[id] = Math.max(Number(state.scores[id]) || 0, Math.max(0, Math.floor(score)));
  commit({ type: 'score', id, score: state.scores[id] });
}

export function unlockTrophy(id) {
  if (typeof id !== 'string' || state.trophies.includes(id)) return false;
  state.trophies.push(id);
  commit({ type: 'trophy', id });
  return true;
}

export function saveNotes(notes) {
  state.notes = typeof notes === 'string' ? notes.slice(0, 12000) : '';
  return commit({ type: 'notes' });
}

export function saveCapture(capture) {
  if (!capture || typeof capture !== 'object' || typeof capture.dataUrl !== 'string' || !capture.dataUrl.startsWith('data:image/')) return false;
  state.captures.unshift({
    id: crypto.randomUUID(),
    gameId: cleanString(capture.gameId, 'unknown', 80),
    createdAt: new Date().toISOString(),
    dataUrl: capture.dataUrl.slice(0, 1_000_000)
  });
  state.captures = state.captures.slice(0, 40);
  return commit({ type: 'capture' });
}

export function clearUserData() {
  state = clone(defaults);
  return commit({ type: 'reset' });
}

window.addEventListener('storage', (event) => {
  if (event.key !== STORAGE_KEY) return;
  try {
    state = normalize(JSON.parse(event.newValue || 'null'));
    notify({ type: 'external' });
  } catch {
    state = clone(defaults);
    notify({ type: 'external-reset' });
  }
});
