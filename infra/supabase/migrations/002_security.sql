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
