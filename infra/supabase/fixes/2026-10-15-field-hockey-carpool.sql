-- One-off fix requested by the family: make "WILTON SPORTS carpool" (The Ganis
-- Family) field hockey only. Touches exactly one carpool or nothing.
do $$
declare
  n int;
begin
  select count(*) into n
  from public.carpools c join public.households h on h.id = c.household_id
  where h.name = 'The Ganis Family' and c.name in ('WILTON SPORTS carpool', 'Field hockey carpool');
  if n <> 1 then
    raise exception 'Expected exactly one matching carpool, found %; nothing changed', n;
  end if;
  update public.carpools c set event_filter = 'WYFH', name = 'Field hockey carpool'
  from public.households h
  where h.id = c.household_id and h.name = 'The Ganis Family' and c.name in ('WILTON SPORTS carpool', 'Field hockey carpool');
end $$;

select c.name, c.event_filter,
       (select count(*) from public.events e where e.team_id = c.team_id and e.start >= now() and public.carpool_event_matches(c.event_filter, e.title)) as upcoming_field_hockey_events
from public.carpools c join public.households h on h.id = c.household_id
where h.name = 'The Ganis Family';
