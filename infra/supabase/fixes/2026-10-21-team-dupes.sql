-- Read-only: Ganis teams with their calendar link host/path (no query string), when
-- they were added, and how many upcoming events each has, to spot duplicate teams.
select json_agg(r order by r.link, r.inserted_at) from (
  select t.id, t.name, t.sport, a.name as athlete, t.inserted_at,
         split_part(regexp_replace(t.calendar_url, '^[a-z]+://', ''), '?', 1) as link,
         (select count(*) from public.events e where e.team_id = t.id and e.start >= now()) as upcoming,
         (select count(*) from public.carpools c where c.team_id = t.id) as carpools
  from public.teams t join public.households h on h.id = t.household_id left join public.athletes a on a.id = t.athlete_id
  where h.name = 'The Ganis Family'
) r;
