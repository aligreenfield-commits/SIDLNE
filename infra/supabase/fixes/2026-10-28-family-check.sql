-- Read-only: the Ganis family's teams after the Oct 28 fixes (rules, last sync,
-- upcoming events), Piper's events Oct 28-30, and any upcoming duplicates.
select json_build_object(
  'teams', (select json_agg(json_build_object('team', t.name, 'athlete', t.athlete_name, 'filter', t.event_filter,
      'titles', t.event_titles, 'unsorted', t.unsorted_titles, 'synced', t.last_synced_at, 'error', t.last_sync_error,
      'upcoming', (select count(*) from public.events e where e.team_id = t.id and e.start >= now())) order by t.name)
    from public.teams t join public.households h on h.id = t.household_id where h.name = 'The Ganis Family'),
  'piper_oct28_30', (select json_agg(json_build_object('title', e.title, 'start', e.start, 'team', t.name) order by e.start)
    from public.events e join public.households h on h.id = e.household_id left join public.teams t on t.id = e.team_id
    left join public.athletes a on a.id = e.athlete_id
    where h.name = 'The Ganis Family' and a.name = 'Piper' and e.start >= '2026-10-28' and e.start < '2026-10-31'),
  'duplicates', (select json_agg(r) from (
    select lower(e.title) as title, e.start, count(*) as copies, string_agg(coalesce(t.name, '-'), ', ') as teams
    from public.events e join public.households h on h.id = e.household_id left join public.teams t on t.id = e.team_id
    where h.name = 'The Ganis Family' and e.start >= now()
    group by lower(e.title), e.start having count(*) > 1 order by e.start limit 30) r)
) as family;
