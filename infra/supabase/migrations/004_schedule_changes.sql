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
