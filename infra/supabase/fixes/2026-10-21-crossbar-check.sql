-- Read-only: the Ganis family's teams (athlete, sport) and the CROSSBAR team's events.
select json_build_object(
  'athletes', (select json_agg(json_build_object('name', a.name)) from public.athletes a join public.households h on h.id = a.household_id where h.name = 'The Ganis Family'),
  'teams', (select json_agg(json_build_object('team', t.name, 'sport', t.sport, 'athlete', a.name,
      'source_host', substring(t.calendar_url from '://([^/]+)'), 'last_synced_at', t.last_synced_at, 'last_sync_error', t.last_sync_error,
      'events', (select count(*) from public.events e where e.team_id = t.id)))
    from public.teams t join public.households h on h.id = t.household_id left join public.athletes a on a.id = t.athlete_id
    where h.name = 'The Ganis Family'),
  'crossbar_events', (select json_agg(r) from (
    select e.title, e.start, e.location, ea.name as event_athlete
    from public.events e join public.teams t on t.id = e.team_id join public.households h on h.id = t.household_id
    left join public.athletes ea on ea.id = e.athlete_id
    where h.name = 'The Ganis Family' and t.name ilike 'crossbar%' order by e.start limit 25) r)
) as crossbar;
