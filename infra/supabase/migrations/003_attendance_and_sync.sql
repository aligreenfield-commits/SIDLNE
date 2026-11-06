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
