# SIDLNE Demo

This workspace contains a small static site version of the SIDLNE demo with a cleaner asset layout.

## Run locally

```bash
cd /workspaces/SIDLNE
npm run start
```

Then open:

- http://localhost:8000/
- or the install page at http://localhost:8000/install.html

## Project structure

- `site/` — cleaned static site folder
  - `site/index.html` — main app shell
  - `site/assets/styles.css` — styling
  - `site/assets/app.js` — app logic
  - `site/manifest.webmanifest` — install metadata
  - `site/service-worker.js` — offline shell
  - `site/install.html`, `site/privacy.html`, `site/support.html` — supporting pages

This keeps the app easy to maintain while staying mobile-ready as a static web app.
