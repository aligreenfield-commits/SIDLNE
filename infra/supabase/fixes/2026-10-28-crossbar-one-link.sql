-- The Ganis family's Crossbar teams had two different links: Miles's baseball team has
-- the account's full calendar (where Piper's "Rostered Players Practice" events are),
-- while Piper's basketball and Miles's new Triple Double team had an older filtered
-- link without them. Put all three on the full link so they share and sort it.
do $$
declare full_link text;
begin
  select calendar_url into full_link from public.teams
  where id = '5f9c48a3-22a0-4c2e-b988-3a342e84412d' and calendar_url ilike '%wiltonhoops.org/calendar/ical/694638%';
  if full_link is null then raise exception 'Baseball team link is not as expected; nothing changed'; end if;
  update public.teams set calendar_url = full_link, last_sync_error = null
  where id in ('540d1064-7e90-44c0-9d83-33ee8b4541f4', '936117fe-0e9f-49bc-bb83-235a2d8f5182')
    and calendar_url ilike '%wiltonhoops.org/calendar/ical/694638%';
end $$;
select json_agg(json_build_object('team', name, 'fingerprint', left(md5(lower(regexp_replace(trim(calendar_url), '^[a-z]+://', ''))), 8)))
from public.teams where id in ('5f9c48a3-22a0-4c2e-b988-3a342e84412d', '540d1064-7e90-44c0-9d83-33ee8b4541f4', '936117fe-0e9f-49bc-bb83-235a2d8f5182');
