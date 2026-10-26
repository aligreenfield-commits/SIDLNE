-- Read-only: open chat reports (newest first) for the SIDLNE team to review.
select json_build_object(
  'open_reports', (select json_agg(r) from (
    select mr.id, mr.inserted_at, h.name as family, mr.body, mr.reason, mr.message_id is not null as message_still_there
    from public.message_reports mr join public.households h on h.id = mr.household_id
    where mr.status = 'open' order by mr.inserted_at desc limit 50) r)
) as chat_reports;
