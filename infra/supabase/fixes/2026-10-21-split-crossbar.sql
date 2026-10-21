-- One-off fix the Ganis family asked for (Oct 21). Their Crossbar link (the same
-- account calendar on wiltonhoops.org and tripledoublebasketballct.com) mixes
-- several activities and was added as four teams, so games showed under the
-- wrong kid (Miles's rec baseball as Piper's) and up to three times.
--   * remove the two duplicate teams (same link, added again)
--   * WILTON HOOPS (Piper, basketball): only "Rostered Players" events
--   * TRIPLE DOUBLE (Miles, basketball): only "Basketball" events (3rd grade travel evals)
--   * new team "Wilton Rec Baseball" (Miles, baseball): only "Rec Minors" events
-- Targets the teams by id and stops if anything looks different.
do $$
declare
  hoops uuid := '92b73ba0-c70d-404e-874c-768a7cc48ff6';
  hoops_dup uuid := '9e695c1f-ba09-49f8-9d7b-21d24d071c93';
  td uuid := '9e95f95f-b4b9-453e-a375-606a6623fdfc';
  td_dup uuid := 'c38d97fe-d80a-4c5a-a8cd-455e77b998b0';
  hid uuid;
  miles uuid;
  baseball uuid;
begin
  select household_id into hid from public.teams where id = td;
  if hid is null or (select count(*) from public.teams where id in (hoops, hoops_dup, td, td_dup) and household_id = hid) <> 4 then
    raise exception 'Teams are not as expected; nothing changed';
  end if;
  select athlete_id into miles from public.teams where id = td;

  delete from public.teams where id in (hoops_dup, td_dup);

  update public.teams set event_filter = 'Rostered Players' where id = hoops;
  delete from public.events where team_id = hoops and title not ilike '%Rostered Players%';

  insert into public.teams (household_id, athlete_id, athlete_name, name, sport, calendar_url, event_filter, last_synced_at)
  select household_id, athlete_id, athlete_name, 'Wilton Rec Baseball', 'Baseball', calendar_url, 'Rec Minors', last_synced_at
  from public.teams where id = td
  returning id into baseball;
  update public.events set team_id = baseball, athlete_id = miles where team_id = td and title ilike '%Rec Minors%';

  update public.teams set event_filter = 'Basketball' where id = td;
  delete from public.events where team_id = td and title not ilike '%Basketball%';
end $$;

select t.name, t.sport, a.name as athlete, t.event_filter,
       (select count(*) from public.events e where e.team_id = t.id) as events
from public.teams t join public.households h on h.id = t.household_id left join public.athletes a on a.id = t.athlete_id
where h.name = 'The Ganis Family' order by t.name;
