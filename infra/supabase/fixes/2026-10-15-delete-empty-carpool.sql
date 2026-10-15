-- One-off fix requested by the family: delete their empty duplicate
-- "WILTON SPORTS carpool". Only deletes it if it still has no assigned drives
-- and at most one driver (whoever created it); otherwise changes nothing.
do $$
declare
  cid uuid := '12566872-a4a6-4f91-b04e-0515ce66dc8d';
begin
  if not exists (select 1 from public.carpools where id = cid) then
    raise exception 'Carpool not found; nothing changed';
  end if;
  if exists (select 1 from public.carpool_rides where carpool_id = cid and driver_member_id is not null)
     or (select count(*) from public.carpool_members where carpool_id = cid) > 1 then
    raise exception 'That carpool is no longer empty; nothing changed';
  end if;
  delete from public.carpools where id = cid;
end $$;

select count(*) as remaining from public.carpools where id = '12566872-a4a6-4f91-b04e-0515ce66dc8d';
