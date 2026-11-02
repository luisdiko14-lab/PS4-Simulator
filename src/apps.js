import { apps, findLibraryItem, storeItems } from './catalog.js';
import { translate as t } from './i18n.js';
import {
  getState,
  install,
  uninstall,
  updateProfile,
  updateSettings,
  saveNotes,
  clearUserData
} from './storage.js';

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[character]);

function utilityCard(symbol, title, copy) {
  return `<article class="utility-card"><span aria-hidden="true">${symbol}</span><strong>${escapeHtml(title)}</strong><p>${escapeHtml(copy)}</p></article>`;
}

function button(label, className = 'button button-light', attributes = '') {
  return `<button class="${className}" type="button" ${attributes}>${escapeHtml(label)}</button>`;
}

function renderBrowser(root, context) {
  const { language } = getState().settings;
  root.innerHTML = `
    <div class="browser-view">
      <form class="browser-toolbar" id="browserForm">
        <button class="tool-button" id="browserBack" type="button" aria-label="${t(language, 'back')}">←</button>
        <button class="tool-button" id="browserForward" type="button" aria-label="${t(language, 'forward')}">→</button>
        <button class="tool-button" id="browserReload" type="button" aria-label="${t(language, 'reload')}">↻</button>
        <label class="browser-address"><span aria-hidden="true">⌕</span><input id="browserUrl" type="url" inputmode="url" autocomplete="url" placeholder="${t(language, 'browserPlaceholder')}" aria-label="${t(language, 'browserPlaceholder')}"><button class="button button-light" type="submit">${t(language, 'go')}</button></label>
        <button class="tool-button" id="browserExternal" type="button" aria-label="Open current page in new tab">↗</button>
      </form>
      <div class="browser-notice"><span>${t(language, 'browserNotice')}</span><a id="browserNewTab" href="https://example.com" target="_blank" rel="noopener noreferrer">${t(language, 'open')} ↗</a></div>
      <iframe class="browser-frame" id="browserFrame" title="${t(language, 'browser')}" referrerpolicy="no-referrer"></iframe>
      <div class="browser-home" id="browserHome"><div><p class="eyebrow">LOCAL BROWSER</p><h3>${t(language, 'browserTitle')}</h3><p>Enter a URL above. This view embeds sites that allow iframe display; other sites can be opened in a new tab.</p><div class="browser-quicklinks"><button type="button" data-url="https://example.com">Example</button><button type="button" data-url="https://www.wikipedia.org">Wikipedia</button><button type="button" data-url="https://developer.mozilla.org">MDN</button></div></div></div>
    </div>`;

  const form = root.querySelector('#browserForm');
  const input = root.querySelector('#browserUrl');
  const frame = root.querySelector('#browserFrame');
  const home = root.querySelector('#browserHome');
  frame.hidden = true;
  const setAddress = (raw) => {
    const value = raw.trim();
    if (!value) return;
    let candidate = value;
    if (!/^[a-z][a-z\d+.-]*:/i.test(candidate)) candidate = `https://${candidate}`;
    try {
      const url = new URL(candidate);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Unsupported address scheme');
      input.value = url.href;
      frame.src = url.href;
      frame.hidden = false;
      home.hidden = true;
      root.querySelector('#browserNewTab').href = url.href;
    } catch (error) {
      context.toast(error.message || 'Enter a valid website address.');
    }
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    setAddress(input.value);
  });
  root.querySelectorAll('[data-url]').forEach((link) => link.addEventListener('click', () => setAddress(link.dataset.url)));
  root.querySelector('#browserReload').addEventListener('click', () => {
    if (frame.src && frame.src !== 'about:blank') frame.contentWindow.location.reload();
  });
  root.querySelector('#browserBack').addEventListener('click', () => {
    try { frame.contentWindow.history.back(); } catch { context.toast('This site does not allow in-frame navigation.'); }
  });
  root.querySelector('#browserForward').addEventListener('click', () => {
    try { frame.contentWindow.history.forward(); } catch { context.toast('This site does not allow in-frame navigation.'); }
  });
  root.querySelector('#browserExternal').addEventListener('click', () => {
    const url = input.value || frame.src;
    if (url && url !== 'about:blank') window.open(url, '_blank', 'noopener,noreferrer');
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') form.requestSubmit();
  });
}

function renderStore(root, context) {
  const language = getState().settings.language;
  root.innerHTML = `
    <div class="store-toolbar"><input class="store-search" id="storeSearch" type="search" placeholder="${t(language, 'search')} games and apps" aria-label="${t(language, 'search')}"></div>
    <div class="store-tabs" role="group" aria-label="Shop categories"><button class="filter-chip active" data-store-filter="all" type="button">All</button><button class="filter-chip" data-store-filter="game" type="button">Games</button><button class="filter-chip" data-store-filter="app" type="button">Apps</button></div>
    <div class="store-grid" id="storeGrid"></div>`;
  let selectedCategory = 'all';
  const search = root.querySelector('#storeSearch');
  const grid = root.querySelector('#storeGrid');

  const draw = () => {
    const state = getState();
    const query = search.value.trim().toLowerCase();
    const visible = storeItems.filter((item) => {
      const categoryMatch = selectedCategory === 'all' || item.type === selectedCategory;
      const searchMatch = `${item.name} ${item.category} ${item.description}`.toLowerCase().includes(query);
      return categoryMatch && searchMatch;
    });
    if (!visible.length) {
      grid.innerHTML = `<div class="empty-state"><strong>${t(language, 'noResults')}</strong>${t(language, 'noItems')}</div>`;
      return;
    }
    grid.innerHTML = visible.map((item) => {
      const owned = item.builtin || state.installed.includes(item.id);
      const verb = owned ? (item.type === 'game' ? t(language, 'play') : t(language, 'open')) : t(language, 'install');
      return `<article class="store-item" style="--store-color:${item.color}"><span class="store-item-symbol" aria-hidden="true">${item.symbol}</span><div><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.category)} · ${escapeHtml(item.description)}</p></div><button class="button ${owned ? 'button-quiet' : 'button-light'}" type="button" data-store-item="${escapeHtml(item.id)}">${verb}</button></article>`;
    }).join('');
    grid.querySelectorAll('[data-store-item]').forEach((control) => control.addEventListener('click', () => {
      const item = storeItems.find((entry) => entry.id === control.dataset.storeItem);
      if (!item) return;
      const owned = item.builtin || getState().installed.includes(item.id);
      if (!owned) {
        install(item.id);
        context.toast(`${item.name} installed.`);
        draw();
        context.refreshLibraries();
      } else {
        context.launch(item.id);
      }
    }));
  };

  search.addEventListener('input', draw);
  root.querySelectorAll('[data-store-filter]').forEach((tab) => tab.addEventListener('click', () => {
    selectedCategory = tab.dataset.storeFilter;
    root.querySelectorAll('[data-store-filter]').forEach((item) => item.classList.toggle('active', item === tab));
    draw();
  }));
  draw();
}

function renderSettings(root, context) {
  const state = getState();
  const language = state.settings.language;
  const tabs = [
    ['profile', t(language, 'profileSettings')], ['network', t(language, 'network')],
    ['language', t(language, 'language')], ['display', t(language, 'display')],
    ['sound', t(language, 'sound')], ['system', t(language, 'system')]
  ];
  root.innerHTML = `
    <div class="settings-layout">
      <nav class="settings-tabs" aria-label="${t(language, 'settings')}">${tabs.map(([id, label], index) => `<button class="settings-tab ${index === 0 ? 'active' : ''}" type="button" data-settings-tab="${id}">${label}</button>`).join('')}</nav>
      <div class="settings-pages">
        <section class="settings-panel active" data-settings-page="profile"><h3>${t(language, 'profileSettings')}</h3><p>${t(language, 'settingsSubtitle')}</p><form id="profileSettingsForm"><div class="form-grid"><label class="form-field">${t(language, 'profileName')}<input name="name" maxlength="18" value="${escapeHtml(state.profile.name)}" required></label><label class="form-field">Avatar<input name="avatar" maxlength="2" value="${escapeHtml(state.profile.avatar)}"></label><label class="form-field">Avatar color<input name="color" type="color" value="${escapeHtml(state.profile.color)}"></label></div><div class="form-actions"><button class="button button-light" type="submit">${t(language, 'save')}</button></div></form></section>
        <section class="settings-panel" data-settings-page="network"><h3>${t(language, 'network')}</h3><p>Choose the simulator's local network state.</p><form id="networkSettingsForm"><label class="form-field">${t(language, 'wifi')}<select name="network"><option>HomeNet</option><option>Studio Mesh</option><option>Guest Wi-Fi</option><option>Offline</option></select></label><div class="setting-row"><span><strong>Connection</strong><small id="networkStatus">Connected</small></span><i class="footer-dot"></i></div><div class="form-actions"><button class="button button-light" type="submit">${t(language, 'save')}</button></div></form></section>
        <section class="settings-panel" data-settings-page="language"><h3>${t(language, 'language')}</h3><p>Choose the interface language.</p><form id="languageSettingsForm"><label class="form-field">${t(language, 'language')}<select name="language"><option value="en">English</option><option value="de">Deutsch</option><option value="sq">Shqip</option></select></label><div class="form-actions"><button class="button button-light" type="submit">${t(language, 'save')}</button></div></form></section>
        <section class="settings-panel" data-settings-page="display"><h3>${t(language, 'display')}</h3><p>Adjust motion behavior for this device.</p><div class="setting-row"><span><strong>${t(language, 'reduceMotion')}</strong><small>Use fewer interface animations.</small></span><label class="switch"><input id="reduceMotionSetting" type="checkbox"><span></span></label></div></section>
        <section class="settings-panel" data-settings-page="sound"><h3>${t(language, 'sound')}</h3><p>Control optional interface sounds.</p><div class="setting-row"><span><strong>${t(language, 'sounds')}</strong><small>Sound effects are local to this page.</small></span><label class="switch"><input id="soundSetting" type="checkbox"><span></span></label></div></section>
        <section class="settings-panel" data-settings-page="system"><h3>${t(language, 'system')}</h3><p>Local simulator information and privacy controls.</p><div class="setting-row"><span><strong>Build</strong><small>Browser edition · 1.0</small></span><span>Ready</span></div><div class="setting-row"><span><strong>Storage</strong><small>Saved in this browser only</small></span><span>Local</span></div><div class="form-actions">${button(t(language, 'clearData'), 'button button-quiet', 'id="clearUserData"')}</div></section>
      </div>
    </div>`;

  root.querySelector('[name="network"]').value = state.settings.network;
  root.querySelector('[name="language"]').value = state.settings.language;
  root.querySelector('#reduceMotionSetting').checked = state.settings.reduceMotion;
  root.querySelector('#soundSetting').checked = state.settings.sound;
  root.querySelectorAll('[data-settings-tab]').forEach((tab) => tab.addEventListener('click', () => {
    root.querySelectorAll('[data-settings-tab]').forEach((item) => item.classList.toggle('active', item === tab));
    root.querySelectorAll('[data-settings-page]').forEach((page) => page.classList.toggle('active', page.dataset.settingsPage === tab.dataset.settingsTab));
  }));
  root.querySelector('#profileSettingsForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    updateProfile(Object.fromEntries(data.entries()));
    context.refreshProfile();
    context.toast('Profile saved.');
  });
  root.querySelector('#networkSettingsForm').addEventListener('submit', (event) => {
    event.preventDefault();
    updateSettings({ network: root.querySelector('[name="network"]').value });
    const online = root.querySelector('[name="network"]').value !== 'Offline';
    root.querySelector('#networkStatus').textContent = online ? 'Connected' : 'Offline';
    context.toast(online ? 'Network saved.' : 'Offline mode enabled.');
    context.refreshHeader();
  });
  root.querySelector('#languageSettingsForm').addEventListener('submit', (event) => {
    event.preventDefault();
    updateSettings({ language: root.querySelector('[name="language"]').value });
    context.toast('Language saved. Reopen this panel to apply every label.');
    context.refreshLibraries();
    context.refreshHeader();
  });
  root.querySelector('#reduceMotionSetting').addEventListener('change', (event) => {
    updateSettings({ reduceMotion: event.target.checked });
    document.documentElement.classList.toggle('reduce-motion', event.target.checked);
  });
  root.querySelector('#soundSetting').addEventListener('change', (event) => updateSettings({ sound: event.target.checked }));
  root.querySelector('#clearUserData').addEventListener('click', () => {
    if (!window.confirm(t(language, 'confirmClear'))) return;
    clearUserData();
    context.refreshAll();
    context.toast('Local data cleared.');
  });
}

function renderNotes(root, context) {
  const language = getState().settings.language;
  root.innerHTML = `<div class="app-content"><h3>${t(language, 'notes')}</h3><p>${t(language, 'notesHint')}</p><label class="form-field" for="notesText">Note<textarea id="notesText" rows="9" maxlength="12000" placeholder="Write something for later..."></textarea></label><div class="form-actions"><span id="noteCount"></span><button class="button button-light" id="saveNotes" type="button">${t(language, 'saveNote')}</button></div></div>`;
  const editor = root.querySelector('#notesText');
  const count = root.querySelector('#noteCount');
  editor.value = getState().notes;
  const updateCount = () => { count.textContent = `${editor.value.length} / 12000`; };
  editor.addEventListener('input', updateCount);
  root.querySelector('#saveNotes').addEventListener('click', () => {
    saveNotes(editor.value);
    context.toast('Note saved on this device.');
  });
  updateCount();
}

function renderMedia(root, context) {
  const language = getState().settings.language;
  root.innerHTML = `<div class="app-content"><h3>${t(language, 'media')}</h3><p>${t(language, 'mediaHint')}</p><div class="media-drop"><label>${t(language, 'chooseAudio')}<input id="audioFiles" type="file" accept="audio/*" multiple></label></div><div class="media-list" id="mediaList"></div></div>`;
  const activeUrls = [];
  const drawFiles = (files) => {
    const list = root.querySelector('#mediaList');
    list.replaceChildren();
    for (const file of files) {
      if (!file.type.startsWith('audio/')) continue;
      const url = URL.createObjectURL(file);
      activeUrls.push(url);
      const row = document.createElement('article');
      row.className = 'media-track';
      const name = document.createElement('strong');
      name.textContent = file.name;
      const size = document.createElement('small');
      size.textContent = `${(file.size / 1024 / 1024).toFixed(1)} MB`;
      const player = document.createElement('audio');
      player.controls = true;
      player.preload = 'metadata';
      player.src = url;
      row.append(name, size, player);
      list.append(row);
    }
    if (!list.children.length) context.toast('Choose an audio file to begin playback.');
  };
  root.querySelector('#audioFiles').addEventListener('change', (event) => drawFiles(event.target.files));
  root.addEventListener('app-close', () => activeUrls.forEach((url) => URL.revokeObjectURL(url)), { once: true });
}

function renderTrophies(root) {
  const language = getState().settings.language;
  const trophies = [
    ['First Light', 'Launch your first game.', 'neon-afterburn'],
    ['High Flyer', 'Score 25 points in Orbit Runner.', 'orbit-25'],
    ['Clear Skies', 'Reach 50 points in Crystal Shift.', 'crystal-50'],
    ['Signal Found', 'Complete a Signal Garden board.', 'signal-garden-clear']
  ];
  const state = getState();
  const unlocked = new Set(state.trophies);
  root.innerHTML = `<div class="app-content"><h3>${t(language, 'trophies')}</h3><p>${unlocked.size} of ${trophies.length} local trophies unlocked.</p><div class="trophy-list">${trophies.map(([name, description, id]) => `<article class="trophy-row"><span class="trophy-medal">${unlocked.has(id) ? '★' : '☆'}</span><span><strong>${escapeHtml(name)}</strong><small>${escapeHtml(description)}</small></span><small>${unlocked.has(id) ? 'UNLOCKED' : 'LOCKED'}</small></article>`).join('')}</div></div>`;
}

function renderCaptures(root, context) {
  const state = getState();
  const language = state.settings.language;
  root.innerHTML = `<div class="app-content"><h3>${t(language, 'captures')}</h3><p>Captures are stored locally in this browser.</p><div class="capture-grid" id="captureGrid"></div></div>`;
  const grid = root.querySelector('#captureGrid');
  if (!state.captures.length) {
    grid.innerHTML = `<div class="empty-state"><strong>${t(language, 'noItems')}</strong>Use the camera button in a game to save a screenshot.</div>`;
    return;
  }
  grid.innerHTML = state.captures.map((capture) => `<a class="capture-item" href="${escapeHtml(capture.dataUrl)}" download="${escapeHtml(capture.gameId)}-${escapeHtml(capture.id)}.png"><img src="${escapeHtml(capture.dataUrl)}" alt="Game capture" loading="lazy"><small>${escapeHtml(new Date(capture.createdAt).toLocaleString())}</small></a>`).join('');
}

function renderDownloads(root) {
  const state = getState();
  const language = state.settings.language;
  const rows = state.downloads.map((entry) => `<article class="setting-row"><span><strong>${escapeHtml(findLibraryItem(entry.id)?.name ?? entry.id)}</strong><small>${escapeHtml(entry.status)} · ${entry.progress}%</small></span><span>${escapeHtml(new Date(entry.updatedAt).toLocaleDateString())}</span></article>`).join('');
  root.innerHTML = `<div class="app-content"><h3>${t(language, 'downloads')}</h3><p>Completed installs and local update history.</p>${rows || `<div class="empty-state"><strong>${t(language, 'noItems')}</strong>Installed items will appear here.</div>`}</div>`;
}

function renderRemotePlay(root, context) {
  const language = getState().settings.language;
  root.innerHTML = `<div class="app-content"><h3>${t(language, 'remotePlay')}</h3><p>Remote Play is represented as a local connection demo.</p><div class="utility-card"><span aria-hidden="true">⌁</span><strong id="remoteStatus">Searching for a console...</strong><p id="remoteDescription">No remote device is paired with this simulator.</p></div><div class="form-actions"><button class="button button-light" id="scanRemote" type="button">Search again</button></div></div>`;
  const runScan = () => {
    root.querySelector('#remoteStatus').textContent = 'No console found';
    root.querySelector('#remoteDescription').textContent = 'This demo cannot discover hardware. Check that the network setting is online.';
  };
  root.querySelector('#scanRemote').addEventListener('click', runScan);
  setTimeout(runScan, 500);
}

function renderCalculator(root) {
  const language = getState().settings.language;
  root.innerHTML = `<div class="app-content"><h3>${t(language, 'calculator')}</h3><p>Calculations run locally in your browser.</p><form id="calculatorForm"><label class="form-field">Expression<input id="calculatorInput" inputmode="decimal" autocomplete="off" placeholder="(12 + 8) * 3"></label><div class="form-actions"><button class="button button-light" type="submit">Calculate</button></div></form><div class="setting-row"><span><strong>Result</strong></span><output id="calculatorResult">—</output></div></div>`;
  root.querySelector('#calculatorForm').addEventListener('submit', (event) => {
    event.preventDefault();
    try {
      root.querySelector('#calculatorResult').textContent = calculateExpression(root.querySelector('#calculatorInput').value);
    } catch (error) {
      root.querySelector('#calculatorResult').textContent = error.message;
    }
  });
}

export function calculateExpression(source) {
  const tokens = source.match(/\d+(?:\.\d+)?|[()+*/-]/g) ?? [];
  if (tokens.join('') !== source.replace(/\s+/g, '')) throw new Error('Invalid expression');
  const values = [];
  const operators = [];
  const precedence = { '+': 1, '-': 1, '*': 2, '/': 2, 'u-': 3 };
  const apply = () => {
    const operator = operators.pop();
    const right = values.pop();
    if (operator === 'u-') {
      if (right === undefined) throw new Error('Incomplete expression');
      values.push(-right);
      return;
    }
    const left = values.pop();
    if (left === undefined || right === undefined) throw new Error('Incomplete expression');
    if (operator === '+') values.push(left + right);
    if (operator === '-') values.push(left - right);
    if (operator === '*') values.push(left * right);
    if (operator === '/') {
      if (right === 0) throw new Error('Cannot divide by zero');
      values.push(left / right);
    }
  };
  let expectsValue = true;
  for (const token of tokens) {
    if (/^\d/.test(token)) {
      if (!expectsValue) throw new Error('Unexpected value');
      values.push(Number(token));
      expectsValue = false;
    } else if (token === '(') {
      operators.push(token);
      expectsValue = true;
    } else if (token === ')') {
      while (operators.length && operators.at(-1) !== '(') apply();
      if (operators.pop() !== '(') throw new Error('Mismatched parentheses');
      expectsValue = false;
    } else {
      if (expectsValue && token === '-') {
        operators.push('u-');
        continue;
      } else if (expectsValue) {
        throw new Error('Unexpected operator');
      }
      while (operators.length && operators.at(-1) !== '(' && precedence[operators.at(-1)] >= precedence[token]) apply();
      operators.push(token);
      expectsValue = true;
    }
  }
  if (!tokens.length || expectsValue) throw new Error('Enter a complete expression');
  while (operators.length) {
    if (operators.at(-1) === '(') throw new Error('Mismatched parentheses');
    apply();
  }
  if (values.length !== 1 || !Number.isFinite(values[0])) throw new Error('Invalid result');
  return Number(values[0].toFixed(8)).toString();
}

export function mountApplication(item, root, context) {
  if (!item) {
    root.innerHTML = `<div class="empty-state"><strong>App unavailable</strong>The selected app could not be found.</div>`;
    return;
  }
  if (item.id === 'browser') return renderBrowser(root, context);
  if (item.id === 'store') return renderStore(root, context);
  if (item.id === 'settings') return renderSettings(root, context);
  if (item.id === 'notes') return renderNotes(root, context);
  if (item.id === 'media') return renderMedia(root, context);
  if (item.id === 'trophies') return renderTrophies(root);
  if (item.id === 'capture') return renderCaptures(root, context);
  if (item.id === 'downloads') return renderDownloads(root);
  if (item.id === 'remote-play') return renderRemotePlay(root, context);
  if (item.id === 'calculator') return renderCalculator(root);
  const language = getState().settings.language;
  root.innerHTML = `<div class="app-content"><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.description)}</p><div class="app-card-grid">${utilityCard(item.symbol, item.category, item.description)}</div></div>`;
}

export function getAppName(id, language) {
  const app = apps.find((entry) => entry.id === id);
  if (!app) return id;
  const keyById = { browser: 'browser', store: 'store', settings: 'settings', media: 'media', trophies: 'trophies', capture: 'captures', notes: 'notes', calculator: 'calculator', downloads: 'downloads', 'remote-play': 'remotePlay' };
  return t(language, keyById[id] ?? app.name);
}
