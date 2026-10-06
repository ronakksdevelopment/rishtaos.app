# RishtaOS · Beta 1.0

A private, frontend-only relationship companion PWA. No backend, no login, no server. Everything is stored locally in your browser.

## Features
- **Relationship Uptime**: live counter (years/months/days/hrs/min/sec) since your start date
- **Special Dates**: anniversaries, birthdays, date plans, festivals, with reminders
- **Period Tracker**: private, estimate-only cycle awareness tool (not medical advice)
- **Profile**: local data export/reset, dark mode, install controls
- Installable PWA (manifest + service worker), works offline after first load

## Run locally
Just open `index.html` in a browser, or serve the folder:
```bash
npx serve .
# or
python3 -m http.server 8080
```

## Deploy to GitHub Pages
1. Push this folder's contents to a repo (root, or a `/docs` folder).
2. In repo **Settings → Pages**, set source to the branch/folder you used.
3. All asset paths are relative (`./css/...`, `./js/...`), so it works at any sub-path, no config needed.
4. Visit the published URL, you'll get the "Install RishtaOS" prompt on supported browsers.

## Project structure
```
rishtaos/
├── index.html        # App shell + all screen templates
├── manifest.json      # PWA manifest
├── sw.js              # Service worker (offline app-shell caching)
├── css/style.css       # Design tokens + all component styles
├── js/app.js            # State, rendering, interactions (localStorage-backed)
└── icons/               # App icons (standard + maskable)
```

## Data & privacy
All data (profile, dates, notes, cycle logs) lives in `localStorage` on the device only. Nothing is sent to a server. Use **Profile → Export my data** for a local JSON backup, and **Profile → Reset all data** to wipe everything.

## Notes for beta 1.0
- No backend/auth: single local profile per browser/device.
- Browser notifications require explicit permission and aren't guaranteed on all platforms; the app degrades gracefully when unsupported.
- Period tracker provides estimates only, clearly labeled, with an in-app disclaimer. It is not a medical tool.
