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
