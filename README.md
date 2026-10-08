# SIDLNE

A public, privacy-safe demo of the SIDLNE family sports calendar.

## Overview

This repository now contains a working static web app that matches the SIDLNE demo experience, including:

- family sports calendar overview
- week/month schedule views
- teams, rides, chat, and app connection panels
- install flow for mobile home-screen use
- PWA manifest and service worker scaffolding

## Run locally

Open `index.html` directly in a browser, or serve the folder with a local web server:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Notes

This is a demo-only experience with sample data. User-created entries are stored only in the browser via `localStorage`.
