# SIDLNE

A public, privacy-safe demo of the SIDLNE family sports calendar.

## Overview

This repository now contains a working static web app that matches the SIDLNE demo experience, including:

- family sports calendar overview
- week/month schedule views
- teams, rides, chat, and app connection panels
- install flow for mobile home-screen use
- PWA manifest and service worker scaffolding

## Active app source of truth

The active implementation work is in the mobile app and the Supabase integration files, not in the historical uploaded ZIP archives.

- `mobile/` — Expo + Supabase mobile app source
- `infra/` — schema, policies, and deployment/support files
- `index.html` / static web demo — browser demo for the public prototype

The historical upload commit at:

https://github.com/aligreenfield-commits/SIDLNE/commit/f36d2fc3e96da862327e27b5c8bc7acf60059909

is an archival artifact upload. It is not the active application source code, and it should not be treated as the implementation of the current app.

## Run locally

Open `index.html` directly in a browser, or serve the folder with a local web server:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Mobile app quick-start

```bash
cd mobile
npm install
cp .env.example .env
npm start
```

## Notes

This is a demo-first experience with sample data. User-created entries are stored only in the browser via `localStorage` for the web prototype.
The current mobile app work is focused on Supabase-backed data, auth, household onboarding, events, and ride coordination.
