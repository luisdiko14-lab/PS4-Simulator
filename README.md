# Console OS Simulator

A local, browser-based console dashboard simulator with a visible game and app
library, embedded web browser, local Store, settings, and playable canvas games.
It uses Python's standard-library HTTP server and native browser APIs; no web
packages or external fonts are required. PyQt6/WebEngine remain optional for a
desktop wrapper. Pygame is not used.

## Run

```bash
python3 main.py --web-only --port 8000
```

Open [http://localhost:8000](http://localhost:8000). To use the optional desktop
wrapper, install the packages in `requirements.txt` and run `python3 main.py`.
Choose another port with `--port 8001` if port 8000 is already in use.

## Included

- Four playable games: Neon Afterburn, Orbit Runner, Crystal Shift, and Signal
	Garden. The games support keyboard input and on-screen touch controls.
- A visible Browser app with URL entry, history controls, quick links, and an
	embedded page. Some sites block iframe embedding; use the open-in-new-tab
	control when that happens.
- A Store with game and app listings, filtering, search, installation, and local
	install persistence.
- Apps for Settings, Media Player, Trophies, Capture Gallery, Quick Notes,
	Calculator, Downloads, and Remote Play status.
- English, German, and Albanian interface translations, profile settings, and
	persistent local preferences.
- Rest mode, a simulated power-off screen, wake control, and restart countdown.

All profile, install, score, trophy, note, and capture data stays in browser
local storage on this device. The simulator does not emulate PlayStation
hardware or connect to PlayStation Network.

## Tests

No package installation is needed for the test suite:

```bash
npm test
python3 -m py_compile main.py
```

## Project layout

- `index.html` provides the app shell and destinations.
- `styles.css` provides the responsive interface and game layout.
- `src/catalog.js`, `src/apps.js`, `src/games.js`, `src/i18n.js`, and
	`src/storage.js` provide catalog data, app surfaces, game logic,
	translations, and local persistence.
- `TODO.md` tracks completed work and follow-ups.