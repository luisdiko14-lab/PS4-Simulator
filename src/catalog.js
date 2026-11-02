export const games = [
  {
    id: 'neon-afterburn',
    name: 'Neon Afterburn',
    category: 'Arcade racer',
    mode: 'dodge',
    symbol: '◆',
    color: '#b04d52',
    accent: '#ff876c',
    description: 'Thread a luminous highway and keep the engine alive.',
    controls: 'Touch left and right, or use A and D.',
    players: '1 player',
    fileSize: 'Arcade',
    featured: true
  },
  {
    id: 'orbit-runner',
    name: 'Orbit Runner',
    category: 'Endless runner',
    mode: 'runner',
    symbol: '◉',
    color: '#286874',
    accent: '#78c9d4',
    description: 'Leap between orbital platforms and dodge the debris field.',
    controls: 'Tap Jump, or press Space.',
    players: '1 player',
    fileSize: 'Arcade'
  },
  {
    id: 'crystal-shift',
    name: 'Crystal Shift',
    category: 'Space shooter',
    mode: 'shooter',
    symbol: '✦',
    color: '#66568a',
    accent: '#c4a0ff',
    description: 'Clear a path through a shifting field of crystals.',
    controls: 'Move with arrows; tap Fire or press Space.',
    players: '1 player',
    fileSize: 'Arcade'
  },
  {
    id: 'signal-garden',
    name: 'Signal Garden',
    category: 'Logic puzzle',
    mode: 'puzzle',
    symbol: '▦',
    color: '#527044',
    accent: '#c5e17b',
    description: 'Connect the signal nodes before the board fills.',
    controls: 'Tap a tile to rotate it; use arrows and Enter.',
    players: '1 player',
    fileSize: 'Arcade'
  }
];

export const apps = [
  {
    id: 'browser',
    name: 'Web Browser',
    category: 'Internet',
    symbol: '⌕',
    color: '#315f69',
    accent: '#78c9d4',
    description: 'Open websites inside the simulator.',
    builtin: true
  },
  {
    id: 'store',
    name: 'PlayStation Store',
    category: 'Shopping',
    symbol: '▣',
    color: '#826044',
    accent: '#f5ca67',
    description: 'Browse the local game and app collection.',
    builtin: true
  },
  {
    id: 'settings',
    name: 'Settings',
    category: 'System',
    symbol: '⚙',
    color: '#526b58',
    accent: '#bcf06a',
    description: 'Configure profile, language, display, and sound.',
    builtin: true
  },
  {
    id: 'media',
    name: 'Media Player',
    category: 'Media',
    symbol: '♫',
    color: '#725748',
    accent: '#ffb17a',
    description: 'Play a local audio file from this device.'
  },
  {
    id: 'trophies',
    name: 'Trophies',
    category: 'Collection',
    symbol: '★',
    color: '#806a3a',
    accent: '#f5ca67',
    description: 'See achievements earned in local games.'
  },
  {
    id: 'capture',
    name: 'Capture Gallery',
    category: 'Collection',
    symbol: '▧',
    color: '#426d66',
    accent: '#8de0c0',
    description: 'Save and review your simulator screenshots.'
  },
  {
    id: 'notes',
    name: 'Quick Notes',
    category: 'Utility',
    symbol: '✎',
    color: '#785d42',
    accent: '#f0ce84',
    description: 'Keep notes locally in this browser.'
  },
  {
    id: 'calculator',
    name: 'Calculator',
    category: 'Utility',
    symbol: '＋',
    color: '#4d6174',
    accent: '#94d2e8',
    description: 'A simple calculator for quick sums.'
  },
  {
    id: 'downloads',
    name: 'Downloads',
    category: 'System',
    symbol: '↓',
    color: '#4f6551',
    accent: '#c5e17b',
    description: 'Review local app installs and game updates.'
  },
  {
    id: 'remote-play',
    name: 'Remote Play',
    category: 'Streaming',
    symbol: '⌁',
    color: '#62517a',
    accent: '#c4a0ff',
    description: 'A local connection-status demo for another device.'
  }
];

export const storeItems = [
  ...games.map((game) => ({
    ...game,
    type: 'game',
    price: 'Free',
    installedByDefault: true
  })),
  ...apps
    .filter((app) => !app.builtin)
    .map((app) => ({
      ...app,
      type: 'app',
      price: 'Free',
      installedByDefault: false
    }))
];

export const libraryItems = [
  ...games.map((game) => ({ ...game, type: 'game' })),
  ...apps.map((app) => ({ ...app, type: 'app' }))
];

export function findLibraryItem(id) {
  return libraryItems.find((item) => item.id === id) ?? null;
}

export function findStoreItem(id) {
  return storeItems.find((item) => item.id === id) ?? null;
}

export function getGamesByCategory(category = 'all') {
  if (category === 'all') return [...games];
  return games.filter((game) => game.mode === category || game.category.toLowerCase().includes(category));
}

export function getAppsByCategory(category = 'all') {
  if (category === 'all') return [...apps];
  return apps.filter((app) => app.category.toLowerCase() === category.toLowerCase());
}

export function getInstalledLibraryItems(installedIds) {
  const installed = new Set(installedIds);
  return libraryItems.filter((item) => item.builtin || installed.has(item.id));
}

export function isBuiltIn(item) {
  return item.type === 'game' || item.builtin === true;
}
