-- The Ganis family's Crossbar team names (Oct 28): Piper is on "Wilton 7G Blue"
-- (Wilton Hoops) and Miles on "Wilton Bruins" (Triple Double). Use those as the
-- teams' auto-sort words; event names the family sorts by hand still win.
update public.teams set event_filter = '7G Blue'
where id = '540d1064-7e90-44c0-9d83-33ee8b4541f4' and athlete_name is distinct from 'Miles';
update public.teams set event_filter = 'Bruins'
where id = '936117fe-0e9f-49bc-bb83-235a2d8f5182' and name = 'Triple Double';
select json_agg(json_build_object('name', t.name, 'filter', t.event_filter))
from public.teams t where t.id in ('540d1064-7e90-44c0-9d83-33ee8b4541f4', '936117fe-0e9f-49bc-bb83-235a2d8f5182');
