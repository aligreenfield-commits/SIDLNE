-- The Ganis family asked (Oct 28): add Miles's Triple Double Athletics basketball as
-- its own team on their Crossbar link. It starts with no sorting rules, so it takes
-- nothing until its event names are sorted to it (no duplicates in the meantime).
do $$
declare
  piper_team uuid := '540d1064-7e90-44c0-9d83-33ee8b4541f4';
  hid uuid;
  miles uuid;
begin
  select household_id into hid from public.teams where id = piper_team;
  if hid is null then raise exception 'Piper''s team is missing; nothing changed'; end if;
  select id into miles from public.athletes where household_id = hid and name = 'Miles';
  if miles is null then raise exception 'No athlete named Miles; nothing changed'; end if;
  if exists (select 1 from public.teams where household_id = hid and name ilike 'Triple Double%') then
    raise exception 'A Triple Double team already exists; nothing changed';
  end if;
  insert into public.teams (household_id, athlete_id, athlete_name, name, sport, calendar_url)
  select household_id, miles, 'Miles', 'Triple Double', 'Basketball', calendar_url from public.teams where id = piper_team;
end $$;
select json_agg(json_build_object('id', t.id, 'name', t.name, 'athlete', t.athlete_name, 'sport', t.sport, 'filter', t.event_filter))
from public.teams t join public.households h on h.id = t.household_id
where h.name = 'The Ganis Family' and t.calendar_url ilike '%wiltonhoops%';
