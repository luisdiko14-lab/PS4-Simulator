import test from 'node:test';
import assert from 'node:assert/strict';
import { messages, supportedLanguages, translate } from '../src/i18n.js';

test('supported languages have valid dictionaries', () => {
  const languages = supportedLanguages();
  assert.deepEqual(languages.map((language) => language.code), ['en', 'de', 'sq']);
  for (const language of languages) assert.ok(messages[language.code]);
});

test('core destinations are translated in all supported languages', () => {
  for (const language of ['en', 'de', 'sq']) {
    assert.notEqual(translate(language, 'home'), 'home');
    assert.notEqual(translate(language, 'games'), 'games');
    assert.notEqual(translate(language, 'apps'), 'apps');
    assert.notEqual(translate(language, 'browser'), 'browser');
    assert.notEqual(translate(language, 'store'), 'store');
  }
});

test('unknown language falls back to English', () => {
  assert.equal(translate('fr', 'browserTitle'), messages.en.browserTitle);
});

test('missing translation keys remain visible for debugging', () => {
  assert.equal(translate('en', 'missingExample'), 'missingExample');
});

test('interpolation replaces all supplied values', () => {
  assert.equal(translate('en', 'restartMessage', { seconds: 4 }), 'Restarting in 4 seconds');
});
