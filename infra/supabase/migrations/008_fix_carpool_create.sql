-- 008: creating a carpool failed with "new row violates row-level security
-- policy for table carpools". The app reads the new carpool back right away,
-- and the read policy looked the carpool up again by id, which the same
-- statement can't see yet. Check the row's own household instead.
-- Idempotent: safe to run again.

-- Whether the signed-in user joined this carpool (from another family)
create or replace function public.has_joined_carpool(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.carpool_members m where m.carpool_id = cid and m.profile_id = auth.uid());
$$;

drop policy if exists carpools_select on public.carpools;
create policy carpools_select on public.carpools for select
  using (public.is_household_member(household_id) or public.has_joined_carpool(id));

notify pgrst, 'reload schema';
