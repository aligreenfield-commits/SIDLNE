-- Read-only: Ganis teams by calendar link (who, sport, filter, upcoming events), and the
-- event names each shared Crossbar/SportsEngine link brings in, to design "split by kid/sport".
select json_build_object(
  'teams', (select json_agg(r order by r.link, r.name) from (
    select t.name, t.sport, a.name as athlete, t.event_filter,
           split_part(regexp_replace(t.calendar_url, '^[a-z]+://', ''), '?', 1) as link,
           (select count(*) from public.events e where e.team_id = t.id and e.start >= now()) as upcoming
    from public.teams t join public.households h on h.id = t.household_id left join public.athletes a on a.id = t.athlete_id
    where h.name = 'The Ganis Family') r),
  'titles', (select json_agg(r) from (
    select split_part(regexp_replace(t.calendar_url, '^[a-z]+://', ''), '/', 1) as host,
           regexp_replace(e.title, '[0-9]+', '#', 'g') as title_pattern, count(*) as n
    from public.events e join public.teams t on t.id = e.team_id join public.households h on h.id = t.household_id
    where h.name = 'The Ganis Family' and e.start >= now() - interval '30 days'
      and (t.calendar_url ilike '%crossbar%' or t.calendar_url ilike '%sportngin%' or t.calendar_url ilike '%sportsengine%')
    group by 1, 2 order by 1, 3 desc limit 80) r)
) as shared_links;
