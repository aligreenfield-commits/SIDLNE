-- Read-only: upcoming events from the Ganis family's Crossbar club sites (titles,
-- times, places, descriptions) to see whose games they are.
select json_agg(r order by r.team, r.start) from (
  select t.name as team, t.inserted_at::date as team_added, e.title, e.start, e.location, left(e.description, 160) as description
  from public.events e join public.teams t on t.id = e.team_id join public.households h on h.id = t.household_id
  where h.name = 'The Ganis Family' and t.calendar_url ~ '/calendar/ical/' and e.start >= now() - interval '7 days'
) r;
