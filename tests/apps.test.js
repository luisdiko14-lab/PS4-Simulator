import test from 'node:test';
import assert from 'node:assert/strict';
class DetailEvent extends Event {
  constructor(type, options = {}) {
    super(type);
    this.detail = options.detail;
  }
}

globalThis.CustomEvent = DetailEvent;
globalThis.window = new EventTarget();
globalThis.window.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {}
};

const { calculateExpression } = await import('../src/apps.js');

test('calculator observes operator precedence and grouping', () => {
  assert.equal(calculateExpression('2 + 3 * 4'), '14');
  assert.equal(calculateExpression('(2 + 3) * 4'), '20');
});

test('calculator handles division and negative values', () => {
  assert.equal(calculateExpression('9 / 2'), '4.5');
  assert.equal(calculateExpression('-3 * 4'), '-12');
  assert.equal(calculateExpression('4 * -3'), '-12');
});

test('calculator rejects malformed and executable expressions', () => {
  assert.throws(() => calculateExpression('2 +'), /complete expression/);
  assert.throws(() => calculateExpression('2 ** 5'), /operator/);
  assert.throws(() => calculateExpression('alert(1)'), /Invalid expression/);
  assert.throws(() => calculateExpression('1 / 0'), /divide by zero/);
});
