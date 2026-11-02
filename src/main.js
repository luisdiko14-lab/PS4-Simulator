import { apps, findLibraryItem, games, libraryItems } from './catalog.js';
import { mountApplication, getAppName } from './apps.js';
import { GameSession } from './games.js';
import { translate as t } from './i18n.js';
import {
  getState,
  install,
  recordLaunch,
  recordScore,
  saveCapture,
  unlockTrophy,
  subscribe
} from './storage.js';

const elements = {
  homeLibrary: document.querySelector('#homeLibrary'),
  gamesCatalog: document.querySelector('#gamesCatalog'),
  appsCatalog: document.querySelector('#appsCatalog'),
  appDialog: document.querySelector('#appDialog'),
  appContent: document.querySelector('#dialogContent'),
  gameDialog: document.querySelector('#gameDialog'),
  gameCanvas: document.querySelector('#gameCanvas'),
  gameControls: document.querySelector('#gameTouchControls'),
  powerDialog: document.querySelector('#powerDialog'),
  powerStateDialog: document.querySelector('#powerStateDialog'),
  toastRegion: document.querySelector('#toastRegion'),
  clock: document.querySelector('#clock')
};

let activeGame = null;
let activeGameItem = null;
let activeAppId = null;
let activeGameFilter = 'all';
let restartTimeout = null;
let toastSequence = 0;

function activate(element, callback) {
  let lastPointerActivation = 0;
  element.addEventListener('pointerup', (event) => {
    if (event.pointerType === 'mouse') return;
    lastPointerActivation = Date.now();
    callback(event);
  });
  element.addEventListener('click', (event) => {
    if (event.detail === 0 || Date.now() - lastPointerActivation > 500) callback(event);
  });
}

function toast(message, duration = 2600) {
  const id = ++toastSequence;
  const item = document.createElement('div');
  item.className = 'toast';
  item.textContent = message;
  item.dataset.toast = String(id);
  elements.toastRegion.append(item);
  window.setTimeout(() => item.remove(), duration);
}

function setView(viewName) {
  const target = document.querySelector(`#${viewName}View`);
  if (!target) return;
  document.querySelectorAll('.view').forEach((view) => {
    const active = view === target;
    view.classList.toggle('active', active);
    view.hidden = !active;
  });
  document.querySelectorAll('[data-view]').forEach((button) => {
    button.classList.toggle('active', button.dataset.view === viewName);
    button.setAttribute('aria-current', button.dataset.view === viewName ? 'page' : 'false');
  });
  document.querySelector('#mainContent').focus({ preventScroll: true });
}

function updateHeader() {
  const state = getState();
  const language = state.settings.language;
  const profileName = document.querySelector('#profileName');
  const avatar = document.querySelector('#profileAvatar');
  profileName.textContent = state.profile.name;
  avatar.textContent = state.profile.avatar || state.profile.name.charAt(0).toUpperCase();
  avatar.style.background = `linear-gradient(140deg, ${state.profile.color}, #254c43)`;
  document.querySelector('[data-view="home"]').textContent = t(language, 'home');
  document.querySelector('[data-view="games"]').textContent = t(language, 'games');
  document.querySelector('[data-view="apps"]').textContent = t(language, 'apps');
  document.querySelector('#shopShortcut').textContent = t(language, 'shop');
  document.querySelector('#openShopButton').innerHTML = `${t(language, 'openShop')} <span>↗</span>`;
  document.querySelector('#libraryTitle').textContent = t(language, 'allGamesApps');
  document.querySelector('.network-indicator').lastChild.textContent = state.settings.network === 'Offline' ? t(language, 'offline') : t(language, 'online');
  document.querySelector('.system-footer > span:first-child').lastChild.textContent = ` ${t(language, 'systemReady')}`;
  document.documentElement.lang = language;
  document.documentElement.classList.toggle('reduce-motion', state.settings.reduceMotion);
  document.querySelector('#welcomeDate').textContent = new Intl.DateTimeFormat(language, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date()).toUpperCase();
}

function updateClock() {
  const language = getState().settings.language;
  elements.clock.textContent = new Intl.DateTimeFormat(language, { hour: '2-digit', minute: '2-digit' }).format(new Date());
}

function cardMarkup(item) {
  const state = getState();
  const installed = item.type === 'game' || item.builtin || state.installed.includes(item.id);
  const stateText = installed ? t(state.settings.language, 'installed') : t(state.settings.language, 'install');
  return `<span class="card-topline"><span class="card-type">${item.type === 'game' ? item.category : item.category}</span><span class="card-status">${stateText}</span></span><span class="card-symbol" aria-hidden="true">${item.symbol}</span><span class="card-bottomline"><span class="card-name">${item.name}</span><span aria-hidden="true">↗</span></span>`;
}

function makeLibraryCard(item, index) {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'library-card';
  card.style.setProperty('--card-color', item.color);
  card.setAttribute('aria-label', `${item.type === 'game' ? 'Play' : 'Open'} ${item.name}`);
  card.innerHTML = cardMarkup(item);
  card.dataset.libraryId = item.id;
  card.dataset.index = String(index);
  activate(card, () => launchLibraryItem(item));
  return card;
}

function refreshLibraries() {
  const state = getState();
  const installed = new Set(state.installed);
  const featuredItems = libraryItems.filter((item) => item.type === 'game' || item.builtin || installed.has(item.id));
  elements.homeLibrary.replaceChildren(...featuredItems.map(makeLibraryCard));
  renderGames();
  renderApps();
}

function renderGames() {
  const state = getState();
  const filtered = activeGameFilter === 'all' ? games : games.filter((game) => game.mode === activeGameFilter);
  elements.gamesCatalog.replaceChildren(...filtered.map((game, index) => makeLibraryCard({ ...game, type: 'game' }, index)));
  document.querySelectorAll('[data-game-filter]').forEach((button) => {
    button.classList.toggle('active', button.dataset.gameFilter === activeGameFilter);
  });
  if (!filtered.length) elements.gamesCatalog.innerHTML = `<div class="empty-state"><strong>${t(state.settings.language, 'noResults')}</strong>${t(state.settings.language, 'noItems')}</div>`;
}

function renderApps() {
  const state = getState();
  const allApps = apps.map((app, index) => ({ ...app, type: 'app', index }));
  elements.appsCatalog.replaceChildren(...allApps.map((item) => makeLibraryCard(item, item.index)));
}

function launchLibraryItem(item) {
  if (!item) return;
  if (item.type === 'game') {
    launchGame(item);
    return;
  }
  if (!item.builtin && !getState().installed.includes(item.id)) {
    install(item.id);
    toast(`${item.name} installed.`);
    refreshLibraries();
  }
  if (item.id === 'store') {
    openApplication('store');
    return;
  }
  openApplication(item.id);
}

function openApplication(appId) {
  const item = findLibraryItem(appId);
  if (!item) {
    toast('That app is not available.');
    return;
  }
  activeAppId = appId;
  recordLaunch(appId);
  document.querySelector('#dialogIcon').textContent = item.symbol;
  document.querySelector('#dialogCategory').textContent = item.category.toUpperCase();
  document.querySelector('#dialogTitle').textContent = getAppName(appId, getState().settings.language);
  elements.appDialog.showModal();
  mountApplication(item, elements.appContent, {
    toast,
    launch: (id) => launchLibraryItem(findLibraryItem(id)),
    refreshLibraries,
    refreshProfile: updateHeader,
    refreshHeader: () => { updateHeader(); updateClock(); },
    refreshAll: () => { updateHeader(); updateClock(); refreshLibraries(); },
    close: closeApplication
  });
}

function closeApplication() {
  if (activeAppId === 'media') elements.appContent.dispatchEvent(new Event('app-close'));
  if (elements.appDialog.open) elements.appDialog.close();
  activeAppId = null;
}

function launchGame(item) {
  if (activeGame) activeGame.stop();
  activeGameItem = item;
  recordLaunch(item.id);
  document.querySelector('#gameTitle').textContent = item.name;
  document.querySelector('#gameHint').textContent = item.controls;
  document.querySelector('#gameScore').textContent = '0';
  elements.gameDialog.showModal();
  activeGame = new GameSession({
    game: item,
    canvas: elements.gameCanvas,
    controls: elements.gameControls,
    onScore: (score) => { document.querySelector('#gameScore').textContent = String(score); },
    onEnd: ({ id, score, won }) => {
      recordScore(id, score);
      if (id === 'orbit-runner' && score >= 25) unlockTrophy('orbit-25');
      if (id === 'crystal-shift' && score >= 50) unlockTrophy('crystal-50');
      if (id === 'signal-garden' && won) unlockTrophy('signal-garden-clear');
      toast(won ? 'Signal connected. Trophy progress saved.' : 'Run complete. Score saved.');
    },
    onCapture: (capture) => {
      if (saveCapture(capture)) toast('Screenshot saved to Capture Gallery.');
      else toast('Could not save this screenshot.');
    }
  });
  activeGame.start();
}

function closeGame() {
  if (activeGame) activeGame.stop();
  activeGame = null;
  activeGameItem = null;
  if (elements.gameDialog.open) elements.gameDialog.close();
  refreshLibraries();
}

function restartGame() {
  if (!activeGameItem) return;
  const game = activeGameItem;
  if (activeGame) activeGame.stop();
  activeGame = null;
  launchGame(game);
}

function openPowerState(mode) {
  const labels = {
    rest: ['REST MODE', 'Taking a breather.', 'Your session will be waiting when you return.'],
    off: ['SYSTEM OFF', 'Until next time.', 'The simulator is powered off. Tap below to start again.']
  };
  const [label, title, copy] = labels[mode];
  document.querySelector('#powerStateLabel').textContent = label;
  document.querySelector('#powerStateTitle').textContent = title;
  document.querySelector('#powerStateCopy').textContent = copy;
  document.querySelector('#wakeConsole').textContent = 'Wake console';
  document.querySelector('#wakeConsole').hidden = false;
  elements.powerStateDialog.showModal();
}

function startRestart() {
  if (restartTimeout) window.clearTimeout(restartTimeout);
  elements.powerDialog.close();
  document.querySelector('#powerStateLabel').textContent = 'RESTARTING';
  document.querySelector('#powerStateTitle').textContent = 'One moment.';
  document.querySelector('#wakeConsole').hidden = true;
  elements.powerStateDialog.showModal();
  let seconds = 10;
  const update = () => {
    document.querySelector('#powerStateCopy').textContent = t(getState().settings.language, 'restartMessage', { seconds });
    seconds -= 1;
    if (seconds < 0) {
      window.location.reload();
      return;
    }
    restartTimeout = window.setTimeout(update, 1000);
  };
  update();
}

function bindEvents() {
  document.querySelectorAll('[data-view]').forEach((button) => activate(button, () => setView(button.dataset.view)));
  document.querySelector('#browserShortcut').addEventListener('click', () => openApplication('browser'));
  document.querySelector('#shopShortcut').addEventListener('click', () => openApplication('store'));
  document.querySelector('#openShopButton').addEventListener('click', () => openApplication('store'));
  document.querySelector('#powerShortcut').addEventListener('click', () => elements.powerDialog.showModal());
  document.querySelector('#profileButton').addEventListener('click', () => openApplication('settings'));
  document.querySelector('#featurePlay').addEventListener('click', () => launchGame(games.find((game) => game.featured) ?? games[0]));
  document.querySelectorAll('[data-game-filter]').forEach((button) => button.addEventListener('click', () => {
    activeGameFilter = button.dataset.gameFilter;
    renderGames();
  }));
  document.querySelector('#dialogClose').addEventListener('click', closeApplication);
  document.querySelector('#dialogBack').addEventListener('click', () => {
    if (activeAppId === 'browser') {
      try { document.querySelector('#browserFrame')?.contentWindow.history.back(); }
      catch { toast('Browser history is unavailable for this page.'); }
    } else closeApplication();
  });
  document.querySelector('#gameExit').addEventListener('click', closeGame);
  document.querySelector('#gameRestart').addEventListener('click', restartGame);
  document.querySelector('#gameCapture').addEventListener('click', () => {
    if (!activeGame?.capture()) toast('Capture unavailable.');
  });
  elements.appDialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeApplication();
  });
  elements.gameDialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeGame();
  });
  document.querySelectorAll('[data-dialog-close="powerDialog"]').forEach((button) => button.addEventListener('click', () => elements.powerDialog.close()));
  document.querySelectorAll('[data-power]').forEach((button) => button.addEventListener('click', () => {
    const mode = button.dataset.power;
    if (mode === 'restart') startRestart();
    else {
      elements.powerDialog.close();
      openPowerState(mode);
    }
  }));
  document.querySelector('#wakeConsole').addEventListener('click', () => {
    if (restartTimeout) window.clearTimeout(restartTimeout);
    restartTimeout = null;
    elements.powerStateDialog.close();
  });
  elements.powerStateDialog.addEventListener('cancel', (event) => {
    if (document.querySelector('#powerStateLabel').textContent === 'RESTARTING') event.preventDefault();
  });
  document.querySelector('#calculatorInput')?.addEventListener('keydown', (event) => event.stopPropagation());
}

function animateAmbient() {
  const canvas = document.querySelector('#ambient');
  const context = canvas.getContext('2d');
  let width = 0;
  let height = 0;
  let particles = [];
  let frame = 0;
  let previousFrame = 0;
  const resize = () => {
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    particles = Array.from({ length: Math.min(42, Math.max(12, Math.floor(width * height / 42000))) }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: 1 + Math.random() * 1.7,
      speed: 5 + Math.random() * 12,
      phase: Math.random() * Math.PI * 2
    }));
  };
  const draw = (timestamp) => {
    frame = requestAnimationFrame(draw);
    if (document.hidden || timestamp - previousFrame < 33) return;
    previousFrame = timestamp;
    context.clearRect(0, 0, width, height);
    for (const particle of particles) {
      particle.y -= particle.speed / 60;
      particle.x += Math.sin(timestamp * .0004 + particle.phase) * .12;
      if (particle.y < -4) {
        particle.y = height + 4;
        particle.x = Math.random() * width;
      }
      context.fillStyle = 'rgba(204, 239, 209, .38)';
      context.beginPath();
      context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
      context.fill();
    }
    context.strokeStyle = 'rgba(119, 190, 161, .09)';
    context.lineWidth = 1;
    for (let layer = 0; layer < 4; layer += 1) {
      context.beginPath();
      for (let x = 0; x <= width; x += 16) {
        const y = height * (.55 + layer * .065) + Math.sin(x * .006 + timestamp * .00012 + layer) * (14 + layer * 7);
        if (x === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.stroke();
    }
  };
  resize();
  window.addEventListener('resize', resize, { passive: true });
  frame = requestAnimationFrame(draw);
  return () => cancelAnimationFrame(frame);
}

function initialize() {
  bindEvents();
  refreshLibraries();
  updateHeader();
  updateClock();
  window.setInterval(updateClock, 30000);
  animateAmbient();
  subscribe((state, change) => {
    if (change.type === 'external') {
      updateHeader();
      refreshLibraries();
    }
  });
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (elements.appDialog.open) closeApplication();
      else if (elements.gameDialog.open) closeGame();
      else if (elements.powerDialog.open) elements.powerDialog.close();
      else if (elements.powerStateDialog.open && document.querySelector('#powerStateLabel').textContent !== 'RESTARTING') elements.powerStateDialog.close();
    }
  });
}

initialize();
