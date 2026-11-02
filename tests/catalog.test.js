import test from 'node:test';
import assert from 'node:assert/strict';
import {
  apps,
  findLibraryItem,
  findStoreItem,
  games,
  getAppsByCategory,
  getGamesByCategory,
  getInstalledLibraryItems,
  isBuiltIn,
  libraryItems,
  storeItems
} from '../src/catalog.js';

test('catalog identifiers are unique', () => {
  const ids = libraryItems.map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('the home catalog includes a browser, store, games, and utility apps', () => {
  for (const id of ['browser', 'store', 'settings', 'media', 'trophies', 'capture', 'notes', 'calculator']) {
    assert.ok(findLibraryItem(id), `expected ${id} in the app library`);
  }
  assert.ok(games.length >= 4);
});

test('each listed store item resolves to a launchable library item', () => {
  for (const item of storeItems) {
    assert.ok(findLibraryItem(item.id), `${item.id} must be launchable`);
    assert.equal(findStoreItem(item.id)?.price, 'Free');
  }
});

test('category filters return only matching entries', () => {
  assert.equal(getGamesByCategory('all').length, games.length);
  assert.ok(getGamesByCategory('runner').every((game) => game.mode === 'runner'));
  assert.ok(getAppsByCategory('Utility').every((app) => app.category === 'Utility'));
});

test('built-in items cannot be treated as store installs', () => {
  assert.equal(isBuiltIn(findLibraryItem('browser')), true);
  assert.equal(isBuiltIn(findLibraryItem('notes')), false);
  assert.equal(isBuiltIn(findLibraryItem('neon-afterburn')), true);
});

test('installed library helper retains built-ins and requested installs', () => {
  const items = getInstalledLibraryItems(['notes']);
  const ids = items.map((item) => item.id);
  assert.ok(ids.includes('browser'));
  assert.ok(ids.includes('notes'));
  assert.ok(!ids.includes('calculator'));
});
