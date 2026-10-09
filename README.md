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
| Web app | `index.html`, `assets/`, `config.js` | Static files with no build step. GitHub Pages serves them from `main`. |
| Database | `infra/supabase/migrations/` | Postgres schema, RLS policies and RPCs. Idempotent, so it's safe to re-run. |
| Calendar sync | `supabase/functions/sync-calendar/` | Supabase Edge Function (Deno) that downloads and parses iCal feeds. |
| Mobile app | `mobile/` | Expo / React Native app that uses the same Supabase backend. |

## Deploy

GitHub Pages publishes the web app straight from the `main` branch. Going live takes three steps:

### 1. Create the Supabase project

1. Create a free project at [supabase.com](https://supabase.com).
2. Open **SQL Editor**, paste in all of [`infra/supabase/setup.sql`](infra/supabase/setup.sql) and click **Run**. It is safe to run again later.
3. Under **Authentication → URL Configuration**, set the **Site URL** to `https://sidlne.pages.dev/` and add the same URL to **Redirect URLs**.

### 2. Point the app at it

In `config.js`, fill in the **Project URL** and the **anon public** key from **Project Settings → API**, then commit to `main`. The anon key is designed to be public, because the Row Level Security policies protect your data. Never put the `service_role` key in the app.

### 3. Turn on team calendar import

Under the repo's **Settings → Secrets and variables → Actions**:

- add the variable `SUPABASE_PROJECT_REF`, the ID in your project URL (for example `abcd1234`),
- add the secret `SUPABASE_ACCESS_TOKEN`, created at supabase.com/dashboard/account/tokens.

Then run the **Deploy calendar sync** workflow from the Actions tab. Until both are set, the workflow skips the deploy instead of failing.

To deploy the function by hand instead, run `supabase functions deploy sync-calendar --project-ref <ref>`.

### Before inviting lots of families

Set up custom SMTP under **Authentication → Emails**. Supabase's built-in email sender is heavily rate-limited.

### Updating the database later

Run `./infra/scripts/migrate.sh` with `SUPABASE_DB_URL` set, or run the **Run Supabase migrations** workflow. If you add a migration, regenerate `setup.sql` too.

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
.github/workflows/                  Edge Function deploy and migrations
```
