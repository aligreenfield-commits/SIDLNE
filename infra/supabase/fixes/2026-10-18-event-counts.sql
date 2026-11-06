-- Read-only: where the Ganis family's events come from, to find duplicates.
select json_build_object(
  'total_since_sep_1', (select count(*) from public.events e join public.households h on h.id = e.household_id
    where h.name = 'The Ganis Family' and e.start >= '2026-09-01'),
  'by_day_team_source', (select json_agg(r) from (
    select (e.start at time zone 'America/New_York')::date as day, t.name as team, e.source, count(*) n,
           count(distinct e.title) titles, count(distinct e.start) starts, min(e.title) sample_title
    from public.events e join public.households h on h.id = e.household_id left join public.teams t on t.id = e.team_id
    where h.name = 'The Ganis Family' and e.start >= '2026-09-01'
    group by 1, 2, 3 having count(*) > 5 order by n desc limit 15) r),
  'by_team', (select json_agg(r) from (
    select t.name as team, e.source, count(*) n, min(e.start) first, max(e.start) last
    from public.events e join public.households h on h.id = e.household_id left join public.teams t on t.id = e.team_id
    where h.name = 'The Ganis Family' group by 1, 2 order by n desc) r)
) as counts;
