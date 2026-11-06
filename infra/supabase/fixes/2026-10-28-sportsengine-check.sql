-- Read-only: the Ganis family's SportsEngine teams (shared link?), their rules, upcoming
-- events, carpools and RSVPs, to stop field hockey games showing twice.
select json_agg(json_build_object('id', t.id, 'team', t.name, 'sport', t.sport, 'athlete', t.athlete_name,
  'filter', t.event_filter, 'titles', t.event_titles, 'hidden', t.hidden_titles, 'unsorted', t.unsorted_titles,
  'fingerprint', left(md5(lower(regexp_replace(trim(t.calendar_url), '^[a-z]+://', ''))), 8),
  'upcoming', (select count(*) from public.events e where e.team_id = t.id and e.start >= now()),
  'carpools', (select count(*) from public.carpools c where c.team_id = t.id),
  'rsvps', (select count(*) from public.event_attendance a join public.events e on e.id = a.event_id where e.team_id = t.id),
  'rides', (select count(*) from public.rides r join public.events e on e.id = r.event_id where e.team_id = t.id)) order by t.inserted_at)
from public.teams t join public.households h on h.id = t.household_id
where h.name = 'The Ganis Family' and t.calendar_url ilike '%sportsengine%';
