-- 015: a private calendar link for each family, so Skylight, Google Calendar or
-- Apple Calendar can show the SIDLNE schedule (served by the sync-calendar
-- function at ?feed=<token>). Family members can see and reset it.
-- Idempotent: safe to run again.

alter table public.households add column if not exists feed_token text
  default encode(gen_random_bytes(18), 'hex');
update public.households set feed_token = encode(gen_random_bytes(18), 'hex') where feed_token is null;
create unique index if not exists idx_households_feed_token on public.households (feed_token);

-- A new link (the old one stops working), for when it was shared by mistake
create or replace function public.rotate_feed_token(hid uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  t text := encode(gen_random_bytes(18), 'hex');
begin
  if not public.is_household_member(hid) then raise exception 'Not in this family'; end if;
  update public.households set feed_token = t where id = hid;
  return t;
end $$;
revoke all on function public.rotate_feed_token(uuid) from public, anon;
grant execute on function public.rotate_feed_token(uuid) to authenticated;

notify pgrst, 'reload schema';
