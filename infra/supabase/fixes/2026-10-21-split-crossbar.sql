-- One-off fix the Ganis family asked for (Oct 21). Their Crossbar link (an
-- account calendar on wiltonhoops.org) mixes several activities. They removed
-- the duplicate teams; this splits the one that's left between the kids:
--   * WILTON HOOPS (Piper, basketball): only "Rostered Players" events
--   * new "Triple Double" (Miles, basketball): only "Basketball" events (3rd grade travel evals)
--   * new "Wilton Rec Baseball" (Miles, baseball): only "Rec Minors" events
-- Existing events move to the right team (keeping RSVPs); stops if things look different.
do $$
declare
  hoops uuid := '92b73ba0-c70d-404e-874c-768a7cc48ff6';
  hid uuid;
  miles uuid;
  td uuid;
  baseball uuid;
begin
  select household_id into hid from public.teams where id = hoops and event_filter is null;
  if hid is null then raise exception 'WILTON HOOPS is not as expected; nothing changed'; end if;
  select id into miles from public.athletes where household_id = hid and name = 'Miles';
  if miles is null then raise exception 'No athlete named Miles; nothing changed'; end if;
  if exists (select 1 from public.teams where household_id = hid and id <> hoops and calendar_url ~ '/calendar/ical/694638') then
    raise exception 'Another team already uses this calendar; nothing changed';
  end if;

  insert into public.teams (household_id, athlete_id, athlete_name, name, sport, calendar_url, event_filter, last_synced_at)
  select household_id, miles, 'Miles', 'Triple Double', 'Basketball', calendar_url, 'Basketball', last_synced_at
  from public.teams where id = hoops returning id into td;
  insert into public.teams (household_id, athlete_id, athlete_name, name, sport, calendar_url, event_filter, last_synced_at)
  select household_id, miles, 'Miles', 'Wilton Rec Baseball', 'Baseball', calendar_url, 'Rec Minors', last_synced_at
  from public.teams where id = hoops returning id into baseball;

  update public.events set team_id = baseball, athlete_id = miles where team_id = hoops and title ilike '%Rec Minors%';
  update public.events set team_id = td, athlete_id = miles where team_id = hoops and title ilike '%Basketball%' and title not ilike '%Rostered Players%';
  update public.teams set event_filter = 'Rostered Players' where id = hoops;
  delete from public.events where team_id = hoops and title not ilike '%Rostered Players%';
end $$;

select t.name, t.sport, a.name as athlete, t.event_filter,
       (select count(*) from public.events e where e.team_id = t.id) as events
from public.teams t join public.households h on h.id = t.household_id left join public.athletes a on a.id = t.athlete_id
where h.name = 'The Ganis Family' order by t.name;
