-- 001_init_tables.sql

-- Initial schema for SIDLNE (Supabase / Postgres)
-- Run this in your Supabase SQL editor or via psql against the database.

-- Extensions
create extension if not exists "pgcrypto"; -- for gen_random_uuid()
create extension if not exists "uuid-ossp";

-- profiles table: mirrors auth.users (one row per auth user)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  email text,
  avatar_url text,
  created_at timestamptz default now()
);

-- households: family groups
create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

-- household_members: membership / roles linking profiles -> households
create table if not exists public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text default 'member', -- owner | admin | member
  created_at timestamptz default now(),
  unique (household_id, profile_id)
);

-- teams: optional roster entries owned by a household
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references public.households(id) on delete cascade,
  name text not null,
  sport text,
  athlete_name text,
  inserted_at timestamptz default now()
);

-- events: calendar events belonging to a household (and optionally team)
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references public.households(id) on delete cascade,
  team_id uuid references public.teams(id),
  title text not null,
  description text,
  start timestamptz not null,
  "end" timestamptz,
  location text,
  created_by uuid references public.profiles(id),
  inserted_at timestamptz default now()
);

-- rides: ride coordination for events
create table if not exists public.rides (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete cascade,
  title text,
  pickup_location text,
  driver_profile_id uuid references public.profiles(id),
  seats integer,
  notes text,
  status text default 'open',
  inserted_at timestamptz default now()
);

-- messages: simple chat/messages within a household (or threaded by event)
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references public.households(id) on delete cascade,
  event_id uuid references public.events(id),
  sender_id uuid references public.profiles(id),
  body text not null,
  inserted_at timestamptz default now()
);

-- devices: push notification device tokens
create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  provider text, -- 'expo' | 'fcm' | 'apns'
  token text not null,
  inserted_at timestamptz default now()
);

-- Indexes for common queries
create index if not exists idx_events_start on public.events (start);
create index if not exists idx_events_household on public.events (household_id);
create index if not exists idx_teams_household on public.teams (household_id);
create index if not exists idx_rides_event on public.rides (event_id);
create index if not exists idx_messages_household on public.messages (household_id);

-- NOTE: For production, enable Row Level Security (RLS) with policies in policies.sql
