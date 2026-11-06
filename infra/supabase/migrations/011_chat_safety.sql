-- 011: chat safety (App Store Guideline 1.2). Anyone can report a message or
-- block a person; reports go to a queue the SIDLNE team reviews, and family
-- admins can delete any message in their family. Idempotent: safe to run again.

create table if not exists public.message_reports (
  id uuid primary key default gen_random_uuid(),
  message_id uuid references public.messages(id) on delete set null,
  household_id uuid not null references public.households(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  sender_id uuid references public.profiles(id) on delete set null,
  body text,
  reason text check (reason is null or char_length(reason) <= 500),
  status text not null default 'open' check (status in ('open', 'resolved')),
  inserted_at timestamptz not null default now()
);
create index if not exists idx_message_reports_open on public.message_reports (status, inserted_at);

create table if not exists public.blocked_users (
  blocker_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  inserted_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

alter table public.message_reports enable row level security;
alter table public.blocked_users enable row level security;

drop policy if exists message_reports_insert on public.message_reports;
create policy message_reports_insert on public.message_reports for insert
  with check (reporter_id = auth.uid() and public.is_household_member(household_id));
drop policy if exists message_reports_select on public.message_reports;
create policy message_reports_select on public.message_reports for select
  using (reporter_id = auth.uid());

drop policy if exists blocked_users_all on public.blocked_users;
create policy blocked_users_all on public.blocked_users for all
  using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());

-- Family admins can remove any message in their family, not just their own
drop policy if exists messages_delete on public.messages;
create policy messages_delete on public.messages for delete
  using (sender_id = auth.uid() or public.is_household_admin(household_id));

notify pgrst, 'reload schema';
