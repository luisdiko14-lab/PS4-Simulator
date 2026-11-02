import test from 'node:test';
import assert from 'node:assert/strict';

class FakeButton extends EventTarget {
  dataset = {};
  classList = { add() {}, remove() {} };
  type = '';
  textContent = '';
  attributes = new Map();
  append(child) { (this.children ??= []).push(child); }
  get childElementCount() { return this.children?.length ?? 0; }
  setAttribute(name, value) { this.attributes.set(name, value); }
  setPointerCapture() {}
}

class FakeControls {
  children = [];
  hidden = true;
  replaceChildren(...children) { this.children = children; }
  append(child) { this.children.push(child); }
  prepend(child) { this.children.unshift(child); }
}

globalThis.window = new EventTarget();
globalThis.document = { createElement: () => new FakeButton() };
globalThis.requestAnimationFrame = () => 1;
globalThis.cancelAnimationFrame = () => {};

const { GameSession } = await import('../src/games.js');

function createSession(mode) {
  const controls = new FakeControls();
  const canvas = new EventTarget();
  canvas.getContext = () => ({});
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 960, height: 540 });
  const game = { id: `test-${mode}`, name: mode, mode };
  return { session: new GameSession({ game, canvas, controls }), controls };
}

test('dodge mode creates left and right touch controls', () => {
  const { session, controls } = createSession('dodge');
  assert.equal(controls.hidden, false);
  assert.deepEqual(controls.children[0].children.map((button) => button.dataset.input), ['left', 'right']);
  session.stop();
  assert.equal(session.signal.aborted, true);
});

test('runner mode creates a jump control', () => {
  const { session, controls } = createSession('runner');
  assert.equal(controls.children[0].children[0].dataset.input, 'jump');
  session.stop();
});

test('shooter mode creates movement and fire controls', () => {
  const { session, controls } = createSession('shooter');
  assert.equal(controls.children[1].dataset.input, 'fire');
  assert.deepEqual(controls.children[0].children.map((button) => button.dataset.input), ['left', 'right']);
  session.stop();
});

test('puzzle mode creates rotate controls and a board', () => {
  const { session, controls } = createSession('puzzle');
  assert.equal(session.board.length, 25);
  assert.equal(controls.children[0].dataset.input, 'rotate');
  session.stop();
});

test('keyboard input moves the player within game bounds', () => {
  const { session } = createSession('dodge');
  const initial = session.player.x;
  session.keys.add('arrowleft');
  session.movePlayer(.1);
  assert.ok(session.player.x < initial);
  session.player.x = -100;
  session.movePlayer(0);
  assert.equal(session.player.x, 26);
  session.stop();
});

test('cleanup remains available after game over', () => {
  const { session } = createSession('runner');
  session.over = true;
  session.running = false;
  session.stop();
  assert.equal(session.signal.aborted, true);
});
