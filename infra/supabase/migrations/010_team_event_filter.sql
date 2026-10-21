-- 010: a team can take only some events from its calendar link, e.g. when one
-- club (Crossbar, SportsEngine...) calendar mixes several kids or sports.
-- event_filter holds words separated by commas; an event is imported when its
-- title contains any of them. Idempotent: safe to run again.

alter table public.teams add column if not exists event_filter text
  check (event_filter is null or char_length(event_filter) <= 120);

notify pgrst, 'reload schema';
