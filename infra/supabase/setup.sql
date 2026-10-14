-- setup.sql: the complete SIDLNE database setup in one file.
-- Paste into Supabase > SQL Editor and click Run. Safe to run again.
-- Generated from migrations/ (001-006); edit those, then regenerate with:
--   cat infra/supabase/migrations/*.sql > infra/supabase/setup.sql (keeping this header)
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

-- 002_security.sql
--
-- Row Level Security, helper functions, signup trigger and realtime.
-- Safe to re-run: functions are replaced and policies are dropped first.

-- ---------------------------------------------------------------------------
-- Helpers. SECURITY DEFINER so policies can check membership without
-- recursing into household_members' own RLS.
-- ---------------------------------------------------------------------------
create or replace function public.is_household_member(hid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.household_members
    where household_id = hid and profile_id = auth.uid()
  );
$$;

create or replace function public.is_household_admin(hid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.household_members
    where household_id = hid and profile_id = auth.uid() and role in ('owner', 'admin')
  );
$$;

create or replace function public.shares_household_with(pid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.household_members mine
    join public.household_members theirs on theirs.household_id = mine.household_id
    where mine.profile_id = auth.uid() and theirs.profile_id = pid
  );
$$;

create or replace function public.event_household(eid uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select household_id from public.events where id = eid;
$$;

-- ---------------------------------------------------------------------------
-- Create a profile row for every new auth user.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for users who signed up before the trigger existed
insert into public.profiles (id, email, display_name)
select id, email, split_part(email, '@', 1) from auth.users
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- RPCs for household membership (the only way to join a household).
-- ---------------------------------------------------------------------------
create or replace function public.create_household(household_name text)
returns public.households language plpgsql security definer set search_path = public as $$
declare
  h public.households;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  insert into public.households (name, created_by)
  values (trim(household_name), auth.uid())
  returning * into h;
  insert into public.household_members (household_id, profile_id, role)
  values (h.id, auth.uid(), 'owner');
  return h;
end;
$$;

create or replace function public.join_household(code text)
returns public.households language plpgsql security definer set search_path = public as $$
declare
  h public.households;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  select * into h from public.households where invite_code = upper(trim(code));
  if h.id is null then
    raise exception 'That invite code was not found';
  end if;
  insert into public.household_members (household_id, profile_id, role)
  values (h.id, auth.uid(), 'member')
  on conflict (household_id, profile_id) do nothing;
  return h;
end;
$$;

create or replace function public.rotate_invite_code(hid uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  new_code text := upper(encode(gen_random_bytes(5), 'hex'));
begin
  if not public.is_household_admin(hid) then
    raise exception 'Only household admins can reset the invite code';
  end if;
  update public.households set invite_code = new_code where id = hid;
  return new_code;
end;
$$;

-- Permanently delete the caller's account. Households they own go with it.
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not signed in';
  end if;
  delete from public.households h
  where exists (select 1 from public.household_members m
                where m.household_id = h.id and m.profile_id = uid and m.role = 'owner');
  delete from auth.users where id = uid; -- cascades to profiles, memberships, devices
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
revoke all on function public.create_household(text) from public, anon;
revoke all on function public.join_household(text) from public, anon;
revoke all on function public.rotate_invite_code(uuid) from public, anon;
grant execute on function public.create_household(text) to authenticated;
grant execute on function public.join_household(text) to authenticated;
grant execute on function public.rotate_invite_code(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.athletes enable row level security;
alter table public.teams enable row level security;
alter table public.events enable row level security;
alter table public.rides enable row level security;
alter table public.messages enable row level security;
alter table public.devices enable row level security;

-- Remove policies from earlier versions of this project
do $$
declare p record;
begin
  for p in
    select policyname, tablename from pg_policies
    where schemaname = 'public'
      and tablename in ('profiles','households','household_members','athletes','teams','events','rides','messages','devices')
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

-- profiles
create policy profiles_select on public.profiles for select
  using (id = auth.uid() or public.shares_household_with(id));
create policy profiles_insert on public.profiles for insert
  with check (id = auth.uid());
create policy profiles_update on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- households (inserts go through create_household)
create policy households_select on public.households for select
  using (public.is_household_member(id));
create policy households_update on public.households for update
  using (public.is_household_admin(id)) with check (public.is_household_admin(id));
create policy households_delete on public.households for delete
  using (exists (select 1 from public.household_members m
                 where m.household_id = households.id and m.profile_id = auth.uid() and m.role = 'owner'));

-- household_members (inserts go through create_household / join_household)
create policy members_select on public.household_members for select
  using (public.is_household_member(household_id));
create policy members_update on public.household_members for update
  using (public.is_household_admin(household_id)) with check (public.is_household_admin(household_id));
create policy members_delete on public.household_members for delete
  using (profile_id = auth.uid() or (public.is_household_admin(household_id) and role <> 'owner'));

-- athletes, teams, events: any household member can manage them
create policy athletes_all on public.athletes for all
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy teams_all on public.teams for all
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy events_all on public.events for all
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

-- rides
create policy rides_all on public.rides for all
  using (public.is_household_member(public.event_household(event_id)))
  with check (public.is_household_member(public.event_household(event_id)));

-- messages: members read; members post as themselves; authors delete their own
create policy messages_select on public.messages for select
  using (public.is_household_member(household_id));
create policy messages_insert on public.messages for insert
  with check (public.is_household_member(household_id) and sender_id = auth.uid());
create policy messages_delete on public.messages for delete
  using (sender_id = auth.uid());

-- devices
create policy devices_select on public.devices for select using (profile_id = auth.uid());
create policy devices_insert on public.devices for insert with check (profile_id = auth.uid());
create policy devices_delete on public.devices for delete using (profile_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Realtime: live updates for chat, calendar and rides
-- ---------------------------------------------------------------------------
-- Full row images so DELETE events carry household_id for filtered listeners
alter table public.events replica identity full;
alter table public.messages replica identity full;
alter table public.rides replica identity full;

do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['messages', 'events', 'rides'] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
      ) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

-- Make the API pick up new tables and functions immediately
notify pgrst, 'reload schema';

-- 003: "Are you going?" for each athlete, and calendar sync status.
-- Idempotent: safe to run again.

-- Why a team's last calendar sync failed (null when it worked)
alter table public.teams add column if not exists last_sync_error text;

-- Going / maybe / not going, per athlete per event
create table if not exists public.event_attendance (
  event_id uuid not null references public.events(id) on delete cascade,
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  status text not null check (status in ('going', 'maybe', 'not_going')),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (event_id, athlete_id)
);
create index if not exists idx_attendance_athlete on public.event_attendance (athlete_id);

alter table public.event_attendance enable row level security;

-- Any member of the event's family can answer, only for that family's athletes
drop policy if exists attendance_all on public.event_attendance;
create policy attendance_all on public.event_attendance for all
  using (public.is_household_member(public.event_household(event_id)))
  with check (
    public.is_household_member(public.event_household(event_id))
    and exists (
      select 1 from public.athletes a
      where a.id = athlete_id and a.household_id = public.event_household(event_id)
    )
  );

-- Live updates
alter table public.event_attendance replica identity full;
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'event_attendance'
     ) then
    alter publication supabase_realtime add table public.event_attendance;
  end if;
end $$;

notify pgrst, 'reload schema';

-- 004: schedule-change alerts. When a team calendar re-syncs, the sync function
-- records games and practices whose time or place changed, that were cancelled,
-- or that were newly added, so the whole family sees them.
-- Idempotent: safe to run again.

create table if not exists public.schedule_changes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  team_id uuid references public.teams(id) on delete cascade,
  event_id uuid references public.events(id) on delete set null,
  kind text not null check (kind in ('time', 'location', 'cancelled', 'added')),
  title text not null,
  old_start timestamptz,
  new_start timestamptz,
  old_location text,
  new_location text,
  created_at timestamptz not null default now()
);
create index if not exists idx_schedule_changes_household on public.schedule_changes (household_id, created_at desc);

alter table public.schedule_changes enable row level security;

drop policy if exists schedule_changes_select on public.schedule_changes;
create policy schedule_changes_select on public.schedule_changes for select
  using (public.is_household_member(household_id));

-- The sync function runs as the signed-in member, so members may record changes
drop policy if exists schedule_changes_insert on public.schedule_changes;
create policy schedule_changes_insert on public.schedule_changes for insert
  with check (public.is_household_member(household_id));

-- Live updates
alter table public.schedule_changes replica identity full;
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'schedule_changes'
     ) then
    alter publication supabase_realtime add table public.schedule_changes;
  end if;
end $$;

notify pgrst, 'reload schema';

-- 005: carpools. A carpool belongs to one team of the organizing family and can
-- include parents from other families, who join with an invite code. Each event
-- of the team has a drop-off ("to") and a pick-up ("from") driver.
-- Idempotent: safe to run again.

create table if not exists public.carpools (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  invite_code text not null unique default upper(encode(gen_random_bytes(4), 'hex')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_carpools_household on public.carpools (household_id);

-- People who drive. profile_id is null for names imported from a spreadsheet
-- until that parent joins (joining with the same name claims the row).
create table if not exists public.carpool_members (
  id uuid primary key default gen_random_uuid(),
  carpool_id uuid not null references public.carpools(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  phone text check (phone is null or char_length(phone) <= 30),
  seats int check (seats is null or seats between 0 and 12),
  created_at timestamptz not null default now(),
  unique (carpool_id, profile_id)
);
create index if not exists idx_carpool_members_profile on public.carpool_members (profile_id);

create table if not exists public.carpool_rides (
  carpool_id uuid not null references public.carpools(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  leg text not null check (leg in ('to', 'from')),
  driver_member_id uuid references public.carpool_members(id) on delete set null,
  note text check (note is null or char_length(note) <= 200),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (carpool_id, event_id, leg)
);
create index if not exists idx_carpool_rides_event on public.carpool_rides (event_id);

-- ---------------------------------------------------------------------------
-- Access helpers (security definer so policies don't recurse)
-- ---------------------------------------------------------------------------
create or replace function public.carpool_household(cid uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select household_id from public.carpools where id = cid;
$$;

-- Organizer family members, or anyone who joined the carpool
create or replace function public.is_carpool_member(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_household_member(public.carpool_household(cid))
      or exists (select 1 from public.carpool_members m where m.carpool_id = cid and m.profile_id = auth.uid());
$$;

-- Whether an event belongs to the carpool's team (members from other families
-- can't read the events table, so policies check through this)
create or replace function public.carpool_has_event(cid uuid, eid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.events e join public.carpools c on c.team_id = e.team_id and c.household_id = e.household_id
                 where c.id = cid and e.id = eid);
$$;

-- The carpool's team schedule, readable by members from other families
create or replace function public.carpool_schedule(cid uuid)
returns table (id uuid, title text, start timestamptz, "end" timestamptz, location text)
language sql stable security definer set search_path = public as $$
  select e.id, e.title, e.start, e."end", e.location
  from public.events e join public.carpools c on c.team_id = e.team_id and c.household_id = e.household_id
  where c.id = cid and public.is_carpool_member(cid) and e.start >= now() - interval '12 hours'
  order by e.start
  limit 300;
$$;

-- Join with an invite code. Claims a spreadsheet-imported row with the same name.
create or replace function public.join_carpool(code text, member_name text, member_phone text default null, member_seats int default null)
returns public.carpools language plpgsql security definer set search_path = public as $$
declare
  c public.carpools;
  claimed uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select * into c from public.carpools where invite_code = upper(trim(code));
  if not found then raise exception 'That carpool code is not valid'; end if;
  if exists (select 1 from public.carpool_members where carpool_id = c.id and profile_id = auth.uid()) then
    update public.carpool_members
       set name = coalesce(nullif(trim(member_name), ''), name), phone = coalesce(nullif(trim(member_phone), ''), phone), seats = coalesce(member_seats, seats)
     where carpool_id = c.id and profile_id = auth.uid();
    return c;
  end if;
  update public.carpool_members
     set profile_id = auth.uid(), phone = coalesce(nullif(trim(member_phone), ''), phone), seats = coalesce(member_seats, seats)
   where id = (select id from public.carpool_members
                where carpool_id = c.id and profile_id is null and lower(trim(name)) = lower(trim(member_name))
                limit 1)
   returning id into claimed;
  if claimed is null then
    insert into public.carpool_members (carpool_id, profile_id, name, phone, seats)
    values (c.id, auth.uid(), left(trim(member_name), 60), nullif(trim(member_phone), ''), member_seats);
  end if;
  return c;
end $$;

grant execute on function public.carpool_schedule(uuid) to authenticated;
grant execute on function public.join_carpool(text, text, text, int) to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.carpools enable row level security;
alter table public.carpool_members enable row level security;
alter table public.carpool_rides enable row level security;

drop policy if exists carpools_select on public.carpools;
create policy carpools_select on public.carpools for select using (public.is_carpool_member(id));
drop policy if exists carpools_insert on public.carpools;
create policy carpools_insert on public.carpools for insert with check (
  public.is_household_member(household_id)
  and exists (select 1 from public.teams t where t.id = team_id and t.household_id = carpools.household_id)
);
drop policy if exists carpools_update on public.carpools;
create policy carpools_update on public.carpools for update
  using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
drop policy if exists carpools_delete on public.carpools;
create policy carpools_delete on public.carpools for delete using (public.is_household_member(household_id));

-- Members: everyone in the carpool sees the list. The organizer family adds
-- names (e.g. from a spreadsheet) and manages anyone; others edit or remove themselves.
drop policy if exists carpool_members_select on public.carpool_members;
create policy carpool_members_select on public.carpool_members for select using (public.is_carpool_member(carpool_id));
drop policy if exists carpool_members_insert on public.carpool_members;
create policy carpool_members_insert on public.carpool_members for insert with check (
  public.is_household_member(public.carpool_household(carpool_id)) and (profile_id is null or profile_id = auth.uid())
);
drop policy if exists carpool_members_update on public.carpool_members;
create policy carpool_members_update on public.carpool_members for update
  using (profile_id = auth.uid() or public.is_household_member(public.carpool_household(carpool_id)))
  with check (profile_id = auth.uid() or public.is_household_member(public.carpool_household(carpool_id)));
drop policy if exists carpool_members_delete on public.carpool_members;
create policy carpool_members_delete on public.carpool_members for delete
  using (profile_id = auth.uid() or public.is_household_member(public.carpool_household(carpool_id)));

-- Rides: any carpool member can assign drivers, only for the carpool team's events
drop policy if exists carpool_rides_all on public.carpool_rides;
create policy carpool_rides_all on public.carpool_rides for all
  using (public.is_carpool_member(carpool_id))
  with check (
    public.is_carpool_member(carpool_id)
    and public.carpool_has_event(carpool_id, event_id)
    and (driver_member_id is null or exists (select 1 from public.carpool_members m where m.id = driver_member_id and m.carpool_id = carpool_rides.carpool_id))
  );

-- Live updates
alter table public.carpool_rides replica identity full;
alter table public.carpool_members replica identity full;
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['carpool_rides', 'carpool_members'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

notify pgrst, 'reload schema';

-- 006: push notifications for schedule changes. Phones register here, and the
-- database re-checks every team calendar every 15 minutes so changes are
-- caught (and sent) even when nobody has the app open.
-- Idempotent: safe to run again.

create table if not exists public.push_devices (
  token text primary key check (char_length(token) between 10 and 400),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  platform text not null default 'ios' check (platform in ('ios')),
  time_zone text check (time_zone is null or char_length(time_zone) <= 64),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists idx_push_devices_profile on public.push_devices (profile_id);

alter table public.push_devices enable row level security;
drop policy if exists push_devices_select on public.push_devices;
create policy push_devices_select on public.push_devices for select using (profile_id = auth.uid());
drop policy if exists push_devices_delete on public.push_devices;
create policy push_devices_delete on public.push_devices for delete using (profile_id = auth.uid());

-- A phone's token moves to whoever signed in on it last
create or replace function public.register_push_device(device_token text, device_platform text default 'ios', device_time_zone text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  insert into public.push_devices (token, profile_id, platform, time_zone)
  values (trim(device_token), auth.uid(), coalesce(device_platform, 'ios'), left(device_time_zone, 64))
  on conflict (token) do update
    set profile_id = excluded.profile_id, platform = excluded.platform, time_zone = excluded.time_zone, last_seen_at = now();
end $$;

create or replace function public.unregister_push_device(device_token text)
returns void language sql security definer set search_path = public as $$
  delete from public.push_devices where token = trim(device_token) and profile_id = auth.uid();
$$;

grant execute on function public.register_push_device(text, text, text) to authenticated;
grant execute on function public.unregister_push_device(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Scheduled calendar checks (pg_cron + pg_net, available on Supabase)
-- ---------------------------------------------------------------------------
-- A random key, kept in the database, that the scheduled job sends to the
-- sync-calendar function to prove the call came from here.
create table if not exists public.app_secrets (
  name text primary key,
  value text not null
);
alter table public.app_secrets enable row level security; -- no policies: nobody reads it through the API
revoke all on public.app_secrets from anon, authenticated;
insert into public.app_secrets (name, value)
values ('sync_cron_key', encode(gen_random_bytes(24), 'hex'))
on conflict (name) do nothing;

-- For the sync function (service role only)
create or replace function public.check_sync_cron_key(key text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.app_secrets where name = 'sync_cron_key' and value = key);
$$;
revoke execute on function public.check_sync_cron_key(text) from public, anon, authenticated;
grant execute on function public.check_sync_cron_key(text) to service_role;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron')
     and exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net;
    create extension if not exists pg_cron;
    perform cron.unschedule(jobid) from cron.job where jobname = 'sidlne-sync-calendars';
    -- The project URL is public (it is in config.js)
    perform cron.schedule('sidlne-sync-calendars', '*/15 * * * *', $job$
      select net.http_post(
        url := 'https://reufyrhowxxivpmobouz.supabase.co/functions/v1/sync-calendar',
        headers := jsonb_build_object('Content-Type', 'application/json',
                                      'x-sync-key', (select value from public.app_secrets where name = 'sync_cron_key')),
        body := '{"scheduled": true}'::jsonb,
        timeout_milliseconds := 120000
      );
    $job$);
  end if;
end $$;

notify pgrst, 'reload schema';
