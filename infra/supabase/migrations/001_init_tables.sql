-- 001_init_tables.sql
--
-- Core schema for SIDLNE (Supabase / Postgres).
-- Safe to re-run: every statement is idempotent.

create extension if not exists "pgcrypto"; -- gen_random_uuid(), gen_random_bytes()

-- profiles: one row per auth user (created automatically by a trigger in 002)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  email text,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- households: a family group that shares one calendar
create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  invite_code text not null unique default upper(encode(gen_random_bytes(5), 'hex')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- household_members: who belongs to which household
create table if not exists public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  unique (household_id, profile_id)
);

-- athletes: the kids (or adults) whose schedules the household tracks
create table if not exists public.athletes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  color text not null default '#9a78bf',
  created_at timestamptz not null default now()
);

-- teams: a team an athlete plays on, optionally linked to an iCal feed
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  athlete_id uuid references public.athletes(id) on delete set null,
  name text not null check (char_length(name) between 1 and 80),
  sport text,
  athlete_name text, -- legacy, kept for the mobile app
  calendar_url text,
  last_synced_at timestamptz,
  inserted_at timestamptz not null default now()
);

-- events: calendar entries for a household
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  team_id uuid references public.teams(id) on delete cascade,
  athlete_id uuid references public.athletes(id) on delete set null,
  title text not null check (char_length(title) between 1 and 200),
  description text,
  start timestamptz not null,
  "end" timestamptz,
  location text,
  source text not null default 'manual', -- 'manual' or 'ical'
  external_uid text, -- UID from an imported calendar feed
  created_by uuid references public.profiles(id) on delete set null,
  inserted_at timestamptz not null default now(),
  check ("end" is null or "end" >= start)
);

-- rides: who is driving to an event
create table if not exists public.rides (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  title text,
  pickup_location text,
  driver_profile_id uuid references public.profiles(id) on delete set null,
  seats integer check (seats is null or seats >= 0),
  notes text,
  status text not null default 'open' check (status in ('open', 'assigned', 'cancelled')),
  inserted_at timestamptz not null default now()
);

-- messages: household chat
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  event_id uuid references public.events(id) on delete set null,
  sender_id uuid references public.profiles(id) on delete set null default auth.uid(),
  body text not null check (char_length(body) between 1 and 2000),
  inserted_at timestamptz not null default now()
);

-- devices: push notification tokens
create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  provider text check (provider in ('expo', 'fcm', 'apns', 'webpush')),
  token text not null,
  inserted_at timestamptz not null default now(),
  unique (profile_id, token)
);

-- Upgrades for databases created by the earlier version of this file
alter table public.households add column if not exists invite_code text unique default upper(encode(gen_random_bytes(5), 'hex'));
alter table public.teams add column if not exists athlete_id uuid references public.athletes(id) on delete set null;
alter table public.teams add column if not exists calendar_url text;
alter table public.teams add column if not exists last_synced_at timestamptz;
alter table public.events add column if not exists athlete_id uuid references public.athletes(id) on delete set null;
alter table public.events add column if not exists source text not null default 'manual';
alter table public.events add column if not exists external_uid text;

-- Re-point foreign keys from the earlier schema so deleting a user or team
-- cleans up correctly
do $$
declare fk record;
begin
  for fk in
    select * from (values
      ('households', 'created_by', 'profiles', 'set null'),
      ('events', 'created_by', 'profiles', 'set null'),
      ('events', 'team_id', 'teams', 'cascade'),
      ('rides', 'driver_profile_id', 'profiles', 'set null'),
      ('messages', 'sender_id', 'profiles', 'set null'),
      ('messages', 'event_id', 'events', 'set null')
    ) as t(tbl, col, ref, action)
  loop
    execute format('alter table public.%I drop constraint if exists %I', fk.tbl, fk.tbl || '_' || fk.col || '_fkey');
    execute format('alter table public.%I add constraint %I foreign key (%I) references public.%I(id) on delete %s',
                   fk.tbl, fk.tbl || '_' || fk.col || '_fkey', fk.col, fk.ref, fk.action);
  end loop;
end $$;

-- Indexes
create index if not exists idx_members_profile on public.household_members (profile_id);
create index if not exists idx_athletes_household on public.athletes (household_id);
create index if not exists idx_teams_household on public.teams (household_id);
create index if not exists idx_events_household_start on public.events (household_id, start);
create unique index if not exists idx_events_team_uid on public.events (team_id, external_uid);
create index if not exists idx_rides_event on public.rides (event_id);
create index if not exists idx_messages_household on public.messages (household_id, inserted_at);

-- Remove the sample household inserted by the old demo seed file
delete from public.households
where id = '11111111-1111-1111-1111-111111111111' and name = 'Demo Family';
