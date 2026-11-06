-- One-off fix for the Ganis family: an imported event that lost its team was
-- copied again by the next sync, so it showed twice. Move each orphan's RSVPs
-- and rides onto its team copy (same title and start), then delete the orphan.
do $$
declare
  o record;
  twin uuid;
  merged int := 0;
begin
  for o in
    select e.* from public.events e join public.households h on h.id = e.household_id
    where h.name = 'The Ganis Family' and e.team_id is null and e.source = 'ical'
  loop
    select t.id into twin from public.events t
    where t.household_id = o.household_id and t.id <> o.id and t.team_id is not null
      and lower(t.title) = lower(o.title) and t.start = o.start
    order by t.inserted_at limit 1;
    if twin is null then continue; end if;
    insert into public.event_attendance (event_id, athlete_id, status, updated_by, updated_at)
      select twin, a.athlete_id, a.status, a.updated_by, a.updated_at from public.event_attendance a where a.event_id = o.id
      on conflict (event_id, athlete_id) do nothing;
    update public.rides set event_id = twin where event_id = o.id
      and not exists (select 1 from public.rides r where r.event_id = twin);
    update public.carpool_rides c set event_id = twin where c.event_id = o.id
      and not exists (select 1 from public.carpool_rides x where x.event_id = twin and x.carpool_id = c.carpool_id and x.leg = c.leg);
    delete from public.events where id = o.id;
    merged := merged + 1;
  end loop;
  raise notice 'merged %', merged;
end $$;

select count(*) as orphans_left from public.events e join public.households h on h.id = e.household_id
where h.name = 'The Ganis Family' and e.team_id is null and e.source = 'ical';
