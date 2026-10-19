-- Read-only: imported events that have no team, and any same-title same-time twin.
select json_agg(r) from (
  select e.id, e.title, e.start, e.source, e.inserted_at, e.created_by is not null as has_creator,
         left(e.external_uid, 12) as uid_prefix, e.athlete_id is not null as has_athlete,
         (select count(*) from public.event_attendance a where a.event_id = e.id) as rsvps,
         (select count(*) from public.rides r where r.event_id = e.id) as rides,
         (select count(*) from public.carpool_rides c where c.event_id = e.id) as carpool_rides,
         (select json_agg(json_build_object('id', t.id, 'team', tm.name, 'uid_prefix', left(t.external_uid, 12), 'inserted_at', t.inserted_at))
            from public.events t left join public.teams tm on tm.id = t.team_id
            where t.household_id = e.household_id and t.id <> e.id and lower(t.title) = lower(e.title) and t.start = e.start) as twins
  from public.events e join public.households h on h.id = e.household_id
  where h.name = 'The Ganis Family' and e.team_id is null and e.source = 'ical'
) r;
