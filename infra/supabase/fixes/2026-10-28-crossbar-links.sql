-- Read-only: do the Ganis family's Crossbar teams use the very same link? Shows each
-- link's host/path, a short fingerprint of the full link (no tokens printed) and
-- when each team was added.
select json_agg(json_build_object('team', t.name, 'athlete', t.athlete_name,
  'path', split_part(regexp_replace(t.calendar_url, '^[a-z]+://', ''), '?', 1),
  'has_query', position('?' in t.calendar_url) > 0,
  'fingerprint', left(md5(lower(regexp_replace(trim(t.calendar_url), '^[a-z]+://', ''))), 8),
  'inserted_at', t.inserted_at) order by t.inserted_at)
from public.teams t join public.households h on h.id = t.household_id
where h.name = 'The Ganis Family' and t.calendar_url ilike '%wiltonhoops%';
