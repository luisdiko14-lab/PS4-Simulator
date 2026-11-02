const WIDTH = 960;
const HEIGHT = 540;
const COLORS = {
  background: '#071417',
  grid: 'rgba(177, 225, 203, .08)',
  text: '#edf7ee',
  muted: '#91aaa2',
  mint: '#bcf06a',
  coral: '#ff876c',
  blue: '#78c9d4',
  gold: '#f5ca67',
  purple: '#c4a0ff'
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const intersects = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

export class GameSession {
  constructor({ game, canvas, controls, onScore = () => {}, onEnd = () => {}, onCapture = () => {} }) {
    this.game = game;
    this.canvas = canvas;
    this.context = canvas.getContext('2d', { alpha: false });
    this.controlsRoot = controls;
    this.onScore = onScore;
    this.onEnd = onEnd;
    this.onCapture = onCapture;
    this.abortController = new AbortController();
    this.signal = this.abortController.signal;
    this.keys = new Set();
    this.input = new Set();
    this.lastTime = 0;
    this.frame = 0;
    this.spawnClock = 0;
    this.running = false;
    this.over = false;
    this.score = 0;
    this.lives = 3;
    this.elapsed = 0;
    this.random = Math.random;
    this.player = { x: WIDTH / 2 - 20, y: HEIGHT - 82, width: 40, height: 28, speed: 335, velocityY: 0, grounded: true };
    this.objects = [];
    this.bullets = [];
    this.stars = Array.from({ length: 95 }, () => ({ x: this.random() * WIDTH, y: this.random() * HEIGHT, size: .7 + this.random() * 1.8, depth: .35 + this.random() * 1.1 }));
    this.board = [];
    this.bindInput();
    this.initializeMode();
  }

  initializeMode() {
    if (this.game.mode === 'puzzle') {
      this.board = Array.from({ length: 25 }, (_, index) => ({
        x: index % 5,
        y: Math.floor(index / 5),
        orientation: Math.floor(this.random() * 4),
        kind: this.random() > .5 ? 'line' : 'corner'
      }));
      this.board[10].kind = 'line';
      this.board[14].kind = 'line';
    }
    this.configureControls();
  }

  configureControls() {
    const buttons = this.game.mode === 'runner'
      ? [['jump', '▲', 'Jump']]
      : this.game.mode === 'shooter'
        ? [['left', '←', 'Move left'], ['right', '→', 'Move right'], ['fire', '●', 'Fire']]
        : this.game.mode === 'puzzle'
          ? [['rotate', '↻', 'Rotate tile']]
          : [['left', '←', 'Move left'], ['right', '→', 'Move right']];
    this.controlsRoot.replaceChildren();
    this.controlsRoot.hidden = false;
    const movement = document.createElement('div');
    movement.className = 'game-touch-group';
    for (const [action, label, title] of buttons) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'game-pad';
      button.textContent = label;
      button.setAttribute('aria-label', title);
      button.dataset.input = action;
      if (['left', 'right', 'jump'].includes(action)) movement.append(button);
      else this.controlsRoot.append(button);
      button.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        button.setPointerCapture(event.pointerId);
        this.input.add(action);
        button.classList.add('pressed');
        if (action === 'rotate') this.rotateSelected();
      }, { signal: this.signal });
      const release = () => {
        this.input.delete(action);
        button.classList.remove('pressed');
      };
      button.addEventListener('pointerup', release, { signal: this.signal });
      button.addEventListener('pointercancel', release, { signal: this.signal });
      button.addEventListener('lostpointercapture', release, { signal: this.signal });
    }
    if (movement.childElementCount) this.controlsRoot.prepend(movement);
  }

  bindInput() {
    window.addEventListener('keydown', (event) => {
      const key = this.normalizeKey(event.key);
      this.keys.add(key);
      if (key === 'space' || key.startsWith('arrow')) event.preventDefault();
      if (this.game.mode === 'puzzle' && key === 'enter') this.rotateSelected();
      if (key === 'escape') this.stop();
    }, { signal: this.signal });
    window.addEventListener('keyup', (event) => this.keys.delete(this.normalizeKey(event.key)), { signal: this.signal });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.input.clear();
    }, { signal: this.signal });
    this.canvas.addEventListener('pointerdown', (event) => {
      if (this.game.mode !== 'puzzle' || this.over) return;
      const rect = this.canvas.getBoundingClientRect();
      const x = Math.floor((event.clientX - rect.left) / rect.width * WIDTH);
      const y = Math.floor((event.clientY - rect.top) / rect.height * HEIGHT);
      const column = clamp(Math.floor((x - 250) / 92), 0, 4);
      const row = clamp(Math.floor((y - 100) / 72), 0, 4);
      this.board[row * 5 + column].orientation = (this.board[row * 5 + column].orientation + 1) % 4;
      this.score += 2;
      this.onScore(this.score);
      this.checkPuzzle();
    }, { signal: this.signal });
  }

  normalizeKey(key) {
    if (key === ' ') return 'space';
    return key.toLowerCase();
  }

  isDown(...names) {
    return names.some((name) => this.keys.has(name) || this.input.has(name));
  }

  start() {
    this.running = true;
    this.lastTime = 0;
    this.frame = requestAnimationFrame((time) => this.tick(time));
  }

  stop() {
    this.running = false;
    this.abortController.abort();
    cancelAnimationFrame(this.frame);
    this.controlsRoot.replaceChildren();
    this.controlsRoot.hidden = true;
  }

  tick(time) {
    if (!this.running) return;
    const delta = this.lastTime ? Math.min((time - this.lastTime) / 1000, .04) : 0;
    this.lastTime = time;
    this.elapsed += delta;
    this.update(delta);
    this.draw();
    this.frame = requestAnimationFrame((next) => this.tick(next));
  }

  update(delta) {
    this.stars.forEach((star) => {
      star.y += (18 + 34 * star.depth) * delta;
      if (star.y > HEIGHT) {
        star.y = 0;
        star.x = this.random() * WIDTH;
      }
    });
    if (this.game.mode === 'dodge') this.updateDodge(delta);
    else if (this.game.mode === 'runner') this.updateRunner(delta);
    else if (this.game.mode === 'shooter') this.updateShooter(delta);
    else if (this.game.mode === 'puzzle') this.updatePuzzle(delta);
  }

  movePlayer(delta, minX = 26, maxX = WIDTH - 66) {
    let direction = 0;
    if (this.isDown('arrowleft', 'a', 'left')) direction -= 1;
    if (this.isDown('arrowright', 'd', 'right')) direction += 1;
    this.player.x = clamp(this.player.x + direction * this.player.speed * delta, minX, maxX);
  }

  updateDodge(delta) {
    this.movePlayer(delta);
    this.spawnClock += delta;
    if (this.spawnClock > Math.max(.28, .82 - this.score / 180)) {
      this.spawnClock = 0;
      const width = 24 + this.random() * 35;
      this.objects.push({ x: 25 + this.random() * (WIDTH - width - 50), y: -50, width, height: 23 + this.random() * 20, speed: 180 + this.random() * 120 + this.score * 1.2, color: this.random() > .5 ? COLORS.coral : COLORS.gold });
    }
    for (const obstacle of this.objects) {
      obstacle.y += obstacle.speed * delta;
      if (!obstacle.counted && obstacle.y > HEIGHT) {
        obstacle.counted = true;
        this.score += 1;
        this.onScore(this.score);
      }
      if (!obstacle.hit && intersects(this.player, obstacle)) {
        obstacle.hit = true;
        obstacle.y = HEIGHT + 200;
        this.loseLife();
      }
    }
    this.objects = this.objects.filter((object) => object.y < HEIGHT + 80);
  }

  updateRunner(delta) {
    this.spawnClock += delta;
    if (this.isDown('space', 'arrowup', 'w', 'jump') && this.player.grounded) {
      this.player.velocityY = -565;
      this.player.grounded = false;
    }
    this.player.velocityY += 1480 * delta;
    this.player.y += this.player.velocityY * delta;
    if (this.player.y >= HEIGHT - 112) {
      this.player.y = HEIGHT - 112;
      this.player.velocityY = 0;
      this.player.grounded = true;
    }
    if (this.spawnClock > Math.max(.52, 1.1 - this.score / 250)) {
      this.spawnClock = 0;
      const size = 22 + this.random() * 20;
      this.objects.push({ x: WIDTH + size, y: HEIGHT - 105 - size, width: size, height: size, speed: 260 + this.score, color: COLORS.coral });
    }
    for (const obstacle of this.objects) {
      obstacle.x -= obstacle.speed * delta;
      if (!obstacle.counted && obstacle.x + obstacle.width < this.player.x) {
        obstacle.counted = true;
        this.score += 1;
        this.onScore(this.score);
      }
      if (!obstacle.hit && intersects(this.player, obstacle)) {
        obstacle.hit = true;
        obstacle.x = -100;
        this.loseLife();
      }
    }
    this.objects = this.objects.filter((object) => object.x + object.width > -20);
  }

  updateShooter(delta) {
    this.movePlayer(delta, 16, WIDTH - 56);
    this.spawnClock += delta;
    if (this.isDown('space', 'fire') && this.elapsed - (this.lastShot ?? 0) > .24) {
      this.lastShot = this.elapsed;
      this.bullets.push({ x: this.player.x + 17, y: this.player.y - 12, width: 6, height: 19, speed: 450 });
    }
    if (this.spawnClock > Math.max(.3, .78 - this.score / 220)) {
      this.spawnClock = 0;
      const size = 24 + this.random() * 22;
      this.objects.push({ x: 25 + this.random() * (WIDTH - size - 50), y: -35, width: size, height: size, speed: 120 + this.random() * 110 + this.score, color: COLORS.purple });
    }
    this.bullets.forEach((bullet) => { bullet.y -= bullet.speed * delta; });
    for (const enemy of this.objects) {
      enemy.y += enemy.speed * delta;
      if (!enemy.hit && intersects(this.player, enemy)) {
        enemy.hit = true;
        enemy.y = HEIGHT + 100;
        this.loseLife();
      }
      for (const bullet of this.bullets) {
        if (!bullet.hit && !enemy.hit && intersects(enemy, bullet)) {
          bullet.hit = true;
          enemy.hit = true;
          this.score += 10;
          this.onScore(this.score);
        }
      }
    }
    this.bullets = this.bullets.filter((bullet) => !bullet.hit && bullet.y + bullet.height > 0);
    this.objects = this.objects.filter((enemy) => !enemy.hit && enemy.y < HEIGHT + 60);
  }

  updatePuzzle(delta) {
    this.spawnClock += delta;
    if (this.elapsed > 0 && Math.floor(this.elapsed) % 4 === 0 && this.spawnClock > 1) {
      this.spawnClock = 0;
      this.score = Math.max(0, this.score - 1);
      this.onScore(this.score);
    }
  }

  rotateSelected() {
    if (this.game.mode !== 'puzzle' || this.over) return;
    const index = this.selectedCell ?? 12;
    this.board[index].orientation = (this.board[index].orientation + 1) % 4;
    this.score += 2;
    this.onScore(this.score);
    this.checkPuzzle();
  }

  getPorts(cell) {
    const direction = cell.orientation;
    if (cell.kind === 'line') return direction % 2 === 0 ? ['N', 'S'] : ['E', 'W'];
    const corners = [['N', 'E'], ['E', 'S'], ['S', 'W'], ['W', 'N']];
    return corners[direction];
  }

  checkPuzzle() {
    const queue = [];
    const visited = new Set();
    for (let row = 0; row < 5; row += 1) {
      const index = row * 5;
      if (this.getPorts(this.board[index]).includes('W')) queue.push(index);
    }
    while (queue.length) {
      const index = queue.shift();
      if (visited.has(index)) continue;
      visited.add(index);
      const cell = this.board[index];
      const x = index % 5;
      const y = Math.floor(index / 5);
      const edges = this.getPorts(cell);
      if (x === 4 && edges.includes('E')) {
        this.score += 100;
        this.finish(true);
        return;
      }
      const neighbors = [
        ['N', index - 5, 'S', y > 0], ['E', index + 1, 'W', x < 4],
        ['S', index + 5, 'N', y < 4], ['W', index - 1, 'E', x > 0]
      ];
      for (const [out, next, back, valid] of neighbors) {
        if (valid && edges.includes(out) && this.getPorts(this.board[next]).includes(back) && !visited.has(next)) queue.push(next);
      }
    }
  }

  loseLife() {
    if (this.game.mode === 'puzzle') return;
    this.lives -= 1;
    if (this.lives <= 0) this.finish(false);
  }

  finish(won) {
    if (this.over) return;
    this.over = true;
    this.running = false;
    this.onEnd({ id: this.game.id, score: this.score, won });
    this.draw();
  }

  draw() {
    const context = this.context;
    context.fillStyle = COLORS.background;
    context.fillRect(0, 0, WIDTH, HEIGHT);
    this.drawBackdrop(context);
    if (this.game.mode === 'dodge') this.drawDodge(context);
    else if (this.game.mode === 'runner') this.drawRunner(context);
    else if (this.game.mode === 'shooter') this.drawShooter(context);
    else if (this.game.mode === 'puzzle') this.drawPuzzle(context);
    this.drawHud(context);
    if (this.over) this.drawEndCard(context);
  }

  drawBackdrop(context) {
    const gradient = context.createLinearGradient(0, 0, 0, HEIGHT);
    gradient.addColorStop(0, 'rgba(24, 58, 57, .25)');
    gradient.addColorStop(1, 'rgba(4, 12, 14, .8)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, WIDTH, HEIGHT);
    context.strokeStyle = COLORS.grid;
    context.lineWidth = 1;
    for (let y = 55; y < HEIGHT; y += 54) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(WIDTH, y);
      context.stroke();
    }
    for (const star of this.stars) {
      context.fillStyle = `rgba(225, 243, 217, ${.25 + star.depth * .35})`;
      context.fillRect(star.x, star.y, star.size, star.size);
    }
  }

  drawHud(context) {
    context.fillStyle = COLORS.text;
    context.font = '500 16px monospace';
    context.fillText(`SCORE  ${this.score}`, 24, 31);
    context.fillStyle = COLORS.coral;
    context.fillText(`LIVES  ${'◆'.repeat(Math.max(0, this.lives))}`, WIDTH - 145, 31);
  }

  drawDodge(context) {
    context.strokeStyle = 'rgba(188, 240, 106, .12)';
    context.lineWidth = 3;
    for (let x = 225; x <= 735; x += 170) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, HEIGHT);
      context.stroke();
    }
    this.objects.forEach((obstacle) => this.drawDiamond(context, obstacle.x, obstacle.y, obstacle.width, obstacle.color));
    this.drawPlayer(context, this.player.x, this.player.y);
  }

  drawRunner(context) {
    context.fillStyle = 'rgba(120, 201, 212, .18)';
    context.fillRect(0, HEIGHT - 72, WIDTH, 2);
    for (let x = (this.elapsed * 145) % 70; x < WIDTH; x += 70) {
      context.fillStyle = 'rgba(120, 201, 212, .22)';
      context.fillRect(x, HEIGHT - 68, 34, 3);
    }
    this.objects.forEach((obstacle) => this.drawDiamond(context, obstacle.x, obstacle.y, obstacle.width, obstacle.color));
    context.fillStyle = COLORS.blue;
    context.fillRect(this.player.x, this.player.y, this.player.width, this.player.height);
    context.beginPath();
    context.arc(this.player.x + 20, this.player.y - 9, 10, 0, Math.PI * 2);
    context.fill();
  }

  drawShooter(context) {
    this.objects.forEach((enemy) => this.drawDiamond(context, enemy.x, enemy.y, enemy.width, enemy.color));
    this.bullets.forEach((bullet) => {
      context.fillStyle = COLORS.mint;
      context.shadowColor = COLORS.mint;
      context.shadowBlur = 12;
      context.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
      context.shadowBlur = 0;
    });
    this.drawPlayer(context, this.player.x, this.player.y);
  }

  drawPuzzle(context) {
    const cellWidth = 92;
    const cellHeight = 72;
    const startX = 250;
    const startY = 100;
    context.font = '500 13px monospace';
    context.fillStyle = COLORS.mint;
    context.fillText('IN', startX - 29, startY + cellHeight * 2.5);
    context.fillText('OUT', startX + 5 * cellWidth + 4, startY + cellHeight * 2.5);
    this.board.forEach((cell, index) => {
      const x = startX + cell.x * cellWidth;
      const y = startY + cell.y * cellHeight;
      context.fillStyle = index === (this.selectedCell ?? 12) ? 'rgba(188, 240, 106, .12)' : 'rgba(239, 247, 238, .035)';
      context.fillRect(x + 4, y + 4, cellWidth - 8, cellHeight - 8);
      context.strokeStyle = 'rgba(188, 240, 106, .28)';
      context.strokeRect(x + 4, y + 4, cellWidth - 8, cellHeight - 8);
      const centerX = x + cellWidth / 2;
      const centerY = y + cellHeight / 2;
      context.strokeStyle = COLORS.blue;
      context.lineWidth = 5;
      context.lineCap = 'round';
      context.beginPath();
      for (const port of this.getPorts(cell)) {
        const offset = { N: [0, -23], E: [23, 0], S: [0, 23], W: [-23, 0] }[port];
        context.moveTo(centerX, centerY);
        context.lineTo(centerX + offset[0], centerY + offset[1]);
      }
      context.stroke();
      context.fillStyle = COLORS.mint;
      context.beginPath();
      context.arc(centerX, centerY, 5, 0, Math.PI * 2);
      context.fill();
    });
  }

  drawPlayer(context, x, y) {
    context.save();
    context.translate(x + 20, y + 13);
    context.fillStyle = COLORS.coral;
    context.shadowColor = COLORS.coral;
    context.shadowBlur = 22;
    context.beginPath();
    context.moveTo(-26, 13);
    context.lineTo(-14, -10);
    context.lineTo(0, -15);
    context.lineTo(14, -10);
    context.lineTo(26, 13);
    context.closePath();
    context.fill();
    context.restore();
  }

  drawDiamond(context, x, y, size, color) {
    context.save();
    context.translate(x + size / 2, y + size / 2);
    context.rotate(Math.PI / 4);
    context.fillStyle = color;
    context.shadowColor = color;
    context.shadowBlur = 14;
    context.fillRect(-size / 2, -size / 2, size, size);
    context.restore();
  }

  drawEndCard(context) {
    context.fillStyle = 'rgba(3, 10, 11, .75)';
    context.fillRect(0, 0, WIDTH, HEIGHT);
    context.textAlign = 'center';
    context.fillStyle = this.game.mode === 'puzzle' ? COLORS.mint : COLORS.text;
    context.font = '700 40px sans-serif';
    context.fillText(this.game.mode === 'puzzle' ? 'SIGNAL CONNECTED' : 'RUN COMPLETE', WIDTH / 2, HEIGHT / 2 - 15);
    context.fillStyle = COLORS.muted;
    context.font = '500 17px monospace';
    context.fillText(`FINAL SCORE  ${this.score}`, WIDTH / 2, HEIGHT / 2 + 23);
    context.textAlign = 'start';
  }

  capture() {
    try {
      const dataUrl = this.canvas.toDataURL('image/png');
      this.onCapture({ gameId: this.game.id, dataUrl });
      return true;
    } catch {
      return false;
    }
  }
}
