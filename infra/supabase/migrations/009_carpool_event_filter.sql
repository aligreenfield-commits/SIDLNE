-- 009: a carpool can cover only some of a team's events, e.g. only the field
-- hockey ones when a club calendar mixes sports. event_filter holds words
-- separated by commas; an event is included when its title contains any of them.
-- Idempotent: safe to run again.

alter table public.carpools add column if not exists event_filter text
  check (event_filter is null or char_length(event_filter) <= 120);

create or replace function public.carpool_event_matches(filter text, title text)
returns boolean language sql immutable as $$
  select not exists (select 1 from unnest(string_to_array(coalesce(filter, ''), ',')) w where trim(w) <> '')
      or exists (select 1 from unnest(string_to_array(filter, ',')) w
                 where trim(w) <> '' and title ilike '%' || replace(replace(trim(w), '%', '\%'), '_', '\_') || '%');
$$;

create or replace function public.carpool_schedule(cid uuid)
returns table (id uuid, title text, start timestamptz, "end" timestamptz, location text)
language sql stable security definer set search_path = public as $$
  select e.id, e.title, e.start, e."end", e.location
  from public.events e join public.carpools c on c.team_id = e.team_id and c.household_id = e.household_id
  where c.id = cid and public.is_carpool_member(cid) and e.start >= now() - interval '12 hours'
    and public.carpool_event_matches(c.event_filter, e.title)
  order by e.start
  limit 300;
$$;

notify pgrst, 'reload schema';
