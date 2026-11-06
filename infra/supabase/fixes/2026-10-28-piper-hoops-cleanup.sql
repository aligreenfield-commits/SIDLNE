-- One-off cleanup the Ganis family OK'd (Oct 28): Piper had three basketball teams
-- on the Crossbar (wiltonhoops) link from earlier attempts. Keep one, named after
-- her team "Wilton Hoops Basketball", and delete the two leftover "Crossbar" teams.
-- Stops (changing nothing) if either leftover team has any events or carpools.
do $$
declare
  keep uuid := '540d1064-7e90-44c0-9d83-33ee8b4541f4';
  extra uuid[] := array['80acedfa-4db8-41d0-9950-de16474d1928', '6dba6418-8ea7-495f-b2ba-ce34192dd5db']::uuid[];
begin
  if (select count(*) from public.teams where id = any(extra) and name = 'Crossbar' and sport = 'Basketball') <> 2
     or not exists (select 1 from public.teams where id = keep and sport = 'Basketball') then
    raise exception 'Teams are not as expected; nothing changed';
  end if;
  if exists (select 1 from public.events where team_id = any(extra))
     or exists (select 1 from public.carpools where team_id = any(extra)) then
    raise exception 'A leftover team has events or carpools; nothing changed';
  end if;
  delete from public.teams where id = any(extra);
  update public.teams set name = 'Wilton Hoops Basketball' where id = keep;
end $$;
select json_agg(json_build_object('name', t.name, 'sport', t.sport, 'filter', t.event_filter))
from public.teams t join public.households h on h.id = t.household_id
where h.name = 'The Ganis Family' and t.calendar_url ilike '%wiltonhoops%';
