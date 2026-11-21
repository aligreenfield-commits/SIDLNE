-- Read-only: every family has a calendar link token (migration 015). No tokens are printed.
select count(*) as families, count(feed_token) as with_calendar_link from public.households;
