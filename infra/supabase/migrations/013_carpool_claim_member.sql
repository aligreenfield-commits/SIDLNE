-- 013: "That's me". A parent who is already in a carpool under one name (e.g. their
-- account name) can claim a not-joined driver added under another name (e.g.
-- "Ganis" from a Google Sheet). The not-joined driver's drives move to them, they
-- take that name (so the other parents still see the name they know), and the
-- duplicate is removed. Someone not in the carpool yet just takes over the row.
-- Idempotent: safe to run again.

create or replace function public.claim_carpool_member(member uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  target public.carpool_members;
  mine public.carpool_members;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select * into target from public.carpool_members where id = member;
  if not found then raise exception 'That driver is no longer in the carpool'; end if;
  if target.profile_id is not null then raise exception 'That driver has already joined'; end if;
  select * into mine from public.carpool_members where carpool_id = target.carpool_id and profile_id = auth.uid();
  if not found then
    if not public.is_household_member(public.carpool_household(target.carpool_id)) then
      raise exception 'Join the carpool first';
    end if;
    update public.carpool_members set profile_id = auth.uid() where id = target.id;
    return;
  end if;
  update public.carpool_rides set driver_member_id = mine.id
   where carpool_id = target.carpool_id and driver_member_id = target.id;
  delete from public.carpool_members where id = target.id;
  update public.carpool_members
     set name = target.name, phone = coalesce(mine.phone, target.phone), seats = coalesce(mine.seats, target.seats)
   where id = mine.id;
end $$;

grant execute on function public.claim_carpool_member(uuid) to authenticated;

notify pgrst, 'reload schema';
