# SIDLNE

**Every sport. One place.** SIDLNE is a shared family sports calendar: every practice, game and tournament for every kid, who's driving, and a family chat, all in one installable web app.

## Features

- **Accounts:** email and password sign-up, email confirmation and password reset (Supabase Auth)
- **Families:** create a family, invite people with a code or link, roles (owner, admin, member), switch between families
- **Athletes and teams:** color-coded per athlete
- **Team calendar sync:** paste an iCal or `webcal://` link from TeamSnap, SportsEngine, LeagueApps, GameChanger, Sports Connect, Crossbar or Google Calendar. Recurring events, time zones and cancellations are handled.
- **Calendar:** week and month views, filter by athlete, add, edit and delete events
- **Rides:** claim or release a drive, see which events still need a driver
- **Chat:** realtime family chat
- **Overlap alerts:** warns when two athletes need to be in different places at once
- **Installable PWA:** add to the Home Screen on iPhone and Android
- **Privacy:** Row Level Security on every table, plus in-app account deletion

## Architecture

| Piece | Where | Notes |
| --- | --- | --- |
| Web app | `index.html`, `assets/`, `config.js` | Static files with no build step. Hosted on GitHub Pages. |
| Database | `infra/supabase/migrations/` | Postgres schema, RLS policies and RPCs. Idempotent, so it's safe to re-run. |
| Calendar sync | `supabase/functions/sync-calendar/` | Supabase Edge Function (Deno) that downloads and parses iCal feeds. |
| Mobile app | `mobile/` | Expo / React Native app that uses the same Supabase backend. |

## Deploy

### 1. Create the Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. Apply the schema, using either of these:
   - Run `./infra/scripts/migrate.sh` with `SUPABASE_DB_URL` set to the database connection string (Project Settings → Database → Connection string → URI), **or**
   - Add `SUPABASE_DB_URL` as a repository secret and run the **Run Supabase migrations** workflow from the Actions tab.
3. Under **Authentication → URL Configuration**, set the **Site URL** to your app's URL (for example `https://aligreenfield-commits.github.io/SIDLNE/`) and add it to **Redirect URLs**. Confirmation and password-reset links use it.
4. Optional: under **Authentication → Emails**, set up custom SMTP. Supabase's built-in email sender is heavily rate-limited and is not meant for production use.

### 2. Configure GitHub

In the repository's **Settings**:

- **Pages → Build and deployment → Source:** choose **GitHub Actions**.
- **Secrets and variables → Actions → Variables:**
  - `SUPABASE_URL`, for example `https://abcd1234.supabase.co`
  - `SUPABASE_ANON_KEY`, the project's public anon key (Project Settings → API)
  - `SUPABASE_PROJECT_REF`, for example `abcd1234`
- **Secrets and variables → Actions → Secrets:**
  - `SUPABASE_ACCESS_TOKEN`, a personal access token from supabase.com/dashboard/account/tokens. The workflow uses it to deploy the Edge Function.
  - `SUPABASE_DB_URL`, only needed for the migrations workflow.

### 3. Ship it

Push to `main`. The **Deploy** workflow then:

1. writes `config.js` from your variables,
2. publishes the site to GitHub Pages, and
3. deploys the `sync-calendar` Edge Function.

To deploy the function by hand instead, run `supabase functions deploy sync-calendar --project-ref <ref>`.

The anon key is designed to be public. Your data is protected by the Row Level Security policies in `002_security.sql`, so never put the `service_role` key in the web app.

## Run locally

```bash
# 1. Put your project URL and anon key in config.js
# 2. Serve the folder
python3 -m http.server 8000
```

Then open http://localhost:8000 and add `http://localhost:8000` to Supabase's Redirect URLs.

## Repository layout

```
index.html, config.js, assets/      Web app
manifest.webmanifest, service-worker.js, icons/   PWA
privacy.html, support.html, install.html          Static pages
infra/supabase/migrations/          Database schema and security
infra/scripts/migrate.sh            Applies migrations with psql
supabase/functions/sync-calendar/   iCal import Edge Function
mobile/                             Expo mobile app
.github/workflows/                  Deploy and migration pipelines
```
