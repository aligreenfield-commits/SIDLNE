-- 014: carpool chat. Everyone in a carpool (the organizer family and parents who
-- joined from other families) can message each other. Same safety as family chat:
-- report a message, block a person, and authors or the organizer family can delete.
-- Idempotent: safe to run again.

create table if not exists public.carpool_messages (
  id uuid primary key default gen_random_uuid(),
  carpool_id uuid not null references public.carpools(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete set null default auth.uid(),
  body text not null check (char_length(body) between 1 and 2000),
  inserted_at timestamptz not null default now()
);
create index if not exists idx_carpool_messages on public.carpool_messages (carpool_id, inserted_at);

alter table public.carpool_messages enable row level security;
drop policy if exists carpool_messages_select on public.carpool_messages;
create policy carpool_messages_select on public.carpool_messages for select
  using (public.is_carpool_member(carpool_id));
drop policy if exists carpool_messages_insert on public.carpool_messages;
create policy carpool_messages_insert on public.carpool_messages for insert
  with check (public.is_carpool_member(carpool_id) and sender_id = auth.uid());
drop policy if exists carpool_messages_delete on public.carpool_messages;
create policy carpool_messages_delete on public.carpool_messages for delete
  using (sender_id = auth.uid() or public.is_household_member(public.carpool_household(carpool_id)));

-- Reports of carpool messages go to the same review queue
alter table public.message_reports add column if not exists carpool_id uuid references public.carpools(id) on delete cascade;
alter table public.message_reports add column if not exists carpool_message_id uuid references public.carpool_messages(id) on delete set null;
drop policy if exists message_reports_insert on public.message_reports;
create policy message_reports_insert on public.message_reports for insert
  with check (reporter_id = auth.uid() and (
    public.is_household_member(household_id)
    or (carpool_id is not null and public.is_carpool_member(carpool_id) and household_id = public.carpool_household(carpool_id))
  ));

-- Live updates
alter table public.carpool_messages replica identity full;
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'carpool_messages') then
    alter publication supabase_realtime add table public.carpool_messages;
  end if;
end $$;

notify pgrst, 'reload schema';
