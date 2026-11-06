-- The Ganis family's Crossbar link (Oct 28): the only event name no team took is
-- "Rostered Players Practice", which is Piper's Wilton 7G Blue practices at
-- Middlebrook New Gym (Oct 28, 30, Nov 3, 6). Put it, and "Rostered Players"
-- events in general, on her Wilton Hoops Basketball team.
update public.teams
set event_titles = array['rostered players practice'], event_filter = 'Rostered Players, 7G Blue'
where id = '540d1064-7e90-44c0-9d83-33ee8b4541f4' and athlete_name is distinct from 'Miles' and sport = 'Basketball';
select json_agg(json_build_object('name', name, 'filter', event_filter, 'titles', event_titles))
from public.teams where id = '540d1064-7e90-44c0-9d83-33ee8b4541f4';
