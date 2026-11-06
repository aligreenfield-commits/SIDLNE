-- Read-only: the Ganis family's carpools with their drivers and assigned drives
select c.id, c.name, c.event_filter, c.created_at,
       (select count(*) from public.carpool_members m where m.carpool_id = c.id) as drivers,
       (select count(*) from public.carpool_rides r where r.carpool_id = c.id and r.driver_member_id is not null) as assigned_drives,
       (select string_agg(m.name, ', ' order by m.created_at) from public.carpool_members m where m.carpool_id = c.id) as driver_names
from public.carpools c join public.households h on h.id = c.household_id
where h.name = 'The Ganis Family'
order by c.created_at;
