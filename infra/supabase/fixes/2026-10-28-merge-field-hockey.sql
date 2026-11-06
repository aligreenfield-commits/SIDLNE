-- The Ganis family OK'd (Oct 28): Piper's field hockey came in twice, from two
-- SportsEngine links ("Field Hockey" and "WYFH"). Merge into one team:
--   * games on both: copy Piper's RSVPs to the WYFH copy, drop the "Field Hockey" copy
--   * events only on "Field Hockey" (e.g. practices): move them to WYFH, RSVPs and all
--   * delete the empty "Field Hockey" team; WYFH becomes "Field Hockey (WYFH)" and takes
--     every event on its link (it's the only team on it)
-- Stops, changing nothing, if the teams aren't as expected or have carpools.
do $$
declare
  fh uuid := '60848553-6947-4a12-8d6c-174cbde0ffff';
  wy uuid := '2ade9bbb-c170-4eec-a275-92f63155538d';
begin
  if (select count(*) from public.teams where id in (fh, wy) and athlete_name = 'Piper') <> 2 then
    raise exception 'Teams are not as expected; nothing changed';
  end if;
  if exists (select 1 from public.carpools where team_id = fh) then
    raise exception 'Field Hockey has a carpool; nothing changed';
  end if;

  -- Field Hockey events that WYFH already has (same game id, or same name and start)
  create temp table dupes on commit drop as
  select f.id as fh_id, w.id as wy_id
  from public.events f
  join public.events w on w.team_id = wy
   and (w.external_uid = f.external_uid or (lower(w.title) = lower(f.title) and w.start = f.start))
  where f.team_id = fh;

  insert into public.event_attendance (event_id, athlete_id, status, updated_by, updated_at)
  select d.wy_id, a.athlete_id, a.status, a.updated_by, a.updated_at
  from dupes d join public.event_attendance a on a.event_id = d.fh_id
  on conflict (event_id, athlete_id) do nothing;

  update public.rides r set event_id = d.wy_id from dupes d
  where r.event_id = d.fh_id and not exists (select 1 from public.rides x where x.event_id = d.wy_id);

  delete from public.events where id in (select fh_id from dupes);
  update public.events set team_id = wy where team_id = fh;
  delete from public.teams where id = fh;
  update public.teams
  set name = 'Field Hockey (WYFH)', sport = 'Field Hockey', event_filter = null,
      event_titles = '{}', hidden_titles = '{}', unsorted_titles = '{}'
  where id = wy;
end $$;
select json_agg(json_build_object('team', t.name, 'sport', t.sport, 'filter', t.event_filter,
  'upcoming', (select count(*) from public.events e where e.team_id = t.id and e.start >= now()),
  'rsvps', (select count(*) from public.event_attendance a join public.events e on e.id = a.event_id where e.team_id = t.id)))
from public.teams t join public.households h on h.id = t.household_id
where h.name = 'The Ganis Family' and t.calendar_url ilike '%sportsengine%';
