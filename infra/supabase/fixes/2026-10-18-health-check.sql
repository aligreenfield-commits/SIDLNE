-- Read-only health check for the Ganis family: team calendar syncs, upcoming
-- events, recent schedule changes, carpools, and the 15-minute sync job.
-- Changes nothing. Prints app names, not calendar links.
select json_build_object(
  'teams', (select coalesce(json_agg(json_build_object(
      'team', t.name,
      'has_calendar', t.calendar_url is not null,
      'source_host', substring(t.calendar_url from '://([^/]+)'),
      'last_synced_at', t.last_synced_at,
      'last_sync_error', t.last_sync_error,
      'upcoming_events', (select count(*) from public.events e where e.team_id = t.id and e.start >= now()))
      order by t.name), '[]'::json)
    from public.teams t join public.households h on h.id = t.household_id where h.name = 'The Ganis Family'),
  'events_next_14_days', (select count(*) from public.events e join public.households h on h.id = e.household_id
    where h.name = 'The Ganis Family' and e.start between now() and now() + interval '14 days'),
  'changes_last_3_days', (select coalesce(json_object_agg(kind, n), '{}'::json) from (
    select c.kind, count(*) n from public.schedule_changes c join public.households h on h.id = c.household_id
    where h.name = 'The Ganis Family' and c.created_at > now() - interval '3 days' group by c.kind) x),
  'carpools', (select coalesce(json_agg(json_build_object('name', c.name, 'filter', c.event_filter,
      'drivers', (select count(*) from public.carpool_members m where m.carpool_id = c.id),
      'rides', (select count(*) from public.carpool_rides r where r.carpool_id = c.id))), '[]'::json)
    from public.carpools c join public.households h on h.id = c.household_id where h.name = 'The Ganis Family'),
  'sync_job_last_runs', (select coalesce(json_agg(r), '[]'::json) from (
    select d.status, d.return_message, d.start_time from cron.job_run_details d
    join cron.job j on j.jobid = d.jobid where j.jobname = 'sidlne-sync-calendars'
    order by d.start_time desc limit 3) r),
  'sync_http_last', (select coalesce(json_agg(r), '[]'::json) from (
    select status_code, left(coalesce(content::text, error_msg, ''), 200) as body, created
    from net._http_response order by created desc limit 3) r)
) as health;
