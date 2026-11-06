-- 012: sort a shared calendar (one Crossbar / SportsEngine link for several kids or
-- sports) by event name instead of guessing filter words.
--   event_titles     event names (normalized) the family put on this team
--   hidden_titles    event names the family chose not to show (kept on every team of the link)
--   unsorted_titles  event names in the link that no team takes yet (written by the sync)
-- Idempotent: safe to run again.

alter table public.teams add column if not exists event_titles text[] not null default '{}'
  check (cardinality(event_titles) <= 500);
alter table public.teams add column if not exists hidden_titles text[] not null default '{}'
  check (cardinality(hidden_titles) <= 500);
alter table public.teams add column if not exists unsorted_titles text[] not null default '{}'
  check (cardinality(unsorted_titles) <= 200);

notify pgrst, 'reload schema';
