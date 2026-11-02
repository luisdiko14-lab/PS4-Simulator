import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

class DetailEvent extends Event {
  constructor(type, options = {}) {
    super(type);
    this.detail = options.detail;
  }
}

globalThis.CustomEvent = DetailEvent;
globalThis.window = new EventTarget();
globalThis.window.localStorage = new MemoryStorage();

const storage = await import('../src/storage.js');

beforeEach(() => storage.clearUserData());

test('initial state has a working profile, network, and core apps', () => {
  const state = storage.getState();
  assert.equal(state.profile.name, 'Guest');
  assert.equal(state.settings.network, 'HomeNet');
  assert.ok(state.installed.includes('browser'));
  assert.ok(state.installed.includes('settings'));
});

test('profile values are trimmed, limited, and persisted', () => {
  storage.updateProfile({ name: '  Pilot  ', avatar: 'PX', color: '#123456' });
  const state = storage.getState();
  assert.equal(state.profile.name, 'Pilot');
  assert.equal(state.profile.avatar, 'PX');
  assert.equal(state.profile.color, '#123456');
  assert.ok(window.localStorage.getItem('console-os-state-v1'));
});

test('invalid profile colors do not overwrite a valid saved color', () => {
  storage.updateProfile({ color: '#abcdef' });
  storage.updateProfile({ color: 'not-a-color' });
  assert.equal(storage.getState().profile.color, '#abcdef');
});

test('only supported language and network choices are saved', () => {
  storage.updateSettings({ language: 'sq', network: 'Studio Mesh', reduceMotion: true });
  storage.updateSettings({ language: 'fr', network: 'Made Up' });
  const settings = storage.getState().settings;
  assert.equal(settings.language, 'sq');
  assert.equal(settings.network, 'Studio Mesh');
  assert.equal(settings.reduceMotion, true);
});

test('non-built-in apps can be installed and removed', () => {
  assert.equal(storage.install('notes'), true);
  assert.equal(storage.install('notes'), false);
  assert.ok(storage.getState().installed.includes('notes'));
  assert.equal(storage.uninstall('notes'), true);
  assert.ok(!storage.getState().installed.includes('notes'));
});

test('built-in apps cannot be uninstalled', () => {
  assert.equal(storage.uninstall('browser'), false);
  assert.ok(storage.getState().installed.includes('browser'));
});

test('launch history is unique and ordered by recency', () => {
  storage.recordLaunch('browser');
  storage.recordLaunch('settings');
  storage.recordLaunch('browser');
  assert.deepEqual(storage.getState().recent.slice(0, 2), ['browser', 'settings']);
});

test('scores only increase and are stored as integers', () => {
  storage.recordScore('orbit-runner', 12.8);
  storage.recordScore('orbit-runner', 7);
  assert.equal(storage.getState().scores['orbit-runner'], 12);
});

test('trophies are granted once', () => {
  assert.equal(storage.unlockTrophy('first-light'), true);
  assert.equal(storage.unlockTrophy('first-light'), false);
  assert.deepEqual(storage.getState().trophies, ['first-light']);
});

test('notes are bounded and persist', () => {
  storage.saveNotes('A local note');
  assert.equal(storage.getState().notes, 'A local note');
  storage.saveNotes('x'.repeat(13000));
  assert.equal(storage.getState().notes.length, 12000);
});

test('only image data URLs can be saved as captures', () => {
  assert.equal(storage.saveCapture({ gameId: 'runner', dataUrl: 'javascript:alert(1)' }), false);
  assert.equal(storage.saveCapture({ gameId: 'runner', dataUrl: 'data:image/png;base64,AAAA' }), true);
  assert.equal(storage.getState().captures[0].gameId, 'runner');
});

test('state changes notify subscribers and can be reset', () => {
  const changes = [];
  const unsubscribe = storage.subscribe((state, change) => changes.push([state.profile.name, change.type]));
  storage.updateProfile({ name: 'Nova' });
  unsubscribe();
  storage.clearUserData();
  assert.ok(changes.some(([, type]) => type === 'profile'));
  assert.equal(storage.getState().profile.name, 'Guest');
});

test('cross-tab storage updates normalize before notifying', () => {
  const externalState = storage.getState();
  externalState.profile.name = 'Second Device';
  const event = new Event('storage');
  Object.defineProperties(event, {
    key: { value: 'console-os-state-v1' },
    newValue: { value: JSON.stringify(externalState) }
  });
  window.dispatchEvent(event);
  assert.equal(storage.getState().profile.name, 'Second Device');
});
