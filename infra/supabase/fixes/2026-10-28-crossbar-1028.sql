-- Read-only: the Ganis family's Crossbar (wiltonhoops) teams after the sorting update:
-- their rules, unsorted names, last sync, and every event Oct 26-30 for the family.
select json_build_object(
  'crossbar_teams', (select json_agg(json_build_object('id', t.id, 'name', t.name, 'sport', t.sport, 'athlete', a.name,
      'filter', t.event_filter, 'titles', t.event_titles, 'hidden', t.hidden_titles, 'unsorted', t.unsorted_titles,
      'last_synced_at', t.last_synced_at, 'error', t.last_sync_error,
      'upcoming', (select count(*) from public.events e where e.team_id = t.id and e.start >= now())))
    from public.teams t join public.households h on h.id = t.household_id left join public.athletes a on a.id = t.athlete_id
    where h.name = 'The Ganis Family' and t.calendar_url ilike '%wiltonhoops%'),
  'events_oct26_30', (select json_agg(json_build_object('title', e.title, 'start', e.start, 'team', t.name, 'athlete', a.name, 'source', e.source) order by e.start)
    from public.events e join public.households h on h.id = e.household_id left join public.teams t on t.id = e.team_id left join public.athletes a on a.id = e.athlete_id
    where h.name = 'The Ganis Family' and e.start >= '2026-10-26' and e.start < '2026-10-31'),
  'recent_changes', (select json_agg(json_build_object('kind', c.kind, 'title', c.title, 'old_start', c.old_start, 'team', t.name, 'at', c.created_at) order by c.created_at desc)
    from public.schedule_changes c join public.households h on h.id = c.household_id left join public.teams t on t.id = c.team_id
    where h.name = 'The Ganis Family' and c.created_at > now() - interval '2 days')
) as crossbar;
