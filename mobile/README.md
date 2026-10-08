# SIDLNE Mobile App

This is the Expo + Supabase mobile app scaffold for SIDLNE.

## Quick start

```bash
cd mobile
npm install
cp .env.example .env
npm start
```

Then run the app in iOS/Android simulator or on a physical device.

## Required environment variables

Create a `.env` file in `mobile/` with:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## MVP features included

- Dashboard overview
- Calendar list view
- Team roster cards
- Supabase-ready client
- Demo fallback data

## Next steps

- Add auth screens for households and athletes
- Create a Supabase schema for families, events, rides, and chat
- Add real forms and notifications
- Ship iOS and Android builds
