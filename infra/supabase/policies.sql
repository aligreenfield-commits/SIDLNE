-- policies.sql

-- Row Level Security policies for SIDLNE
-- These policies are examples. Review and adjust to match your exact app logic.

-- Enable RLS where appropriate
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

-- Helper: a record is accessible to a user if they are a member of the household
-- We'll use SQL subqueries that reference household_members where appropriate.

-- profiles: allow users to read their own profile; allow authenticated users to insert their profile record with id = auth.uid()
CREATE POLICY "profiles_self_read" ON public.profiles
  FOR SELECT USING ( auth.uid() = id );

CREATE POLICY "profiles_self_insert" ON public.profiles
  FOR INSERT WITH CHECK ( auth.uid() = id );

CREATE POLICY "profiles_self_update" ON public.profiles
  FOR UPDATE USING ( auth.uid() = id ) WITH CHECK ( auth.uid() = id );

-- households: allow members to read, and authenticated users to create households
CREATE POLICY "households_public_read_for_members" ON public.households
  FOR SELECT USING (
    exists (select 1 from public.household_members hm where hm.household_id = public.households.id and hm.profile_id = auth.uid())
  );

CREATE POLICY "households_create_auth" ON public.households
  FOR INSERT WITH CHECK ( auth.role() = 'authenticated' );

-- household_members: allow members to view members; inserting a membership requires being the same profile or being a household owner
CREATE POLICY "household_members_select_if_member" ON public.household_members
  FOR SELECT USING (
    exists (select 1 from public.household_members hm2 where hm2.household_id = public.household_members.household_id and hm2.profile_id = auth.uid())
  );

CREATE POLICY "household_members_insert_profile_self" ON public.household_members
  FOR INSERT WITH CHECK (
    (auth.uid() = new.profile_id) OR
    (exists (select 1 from public.household_members hm where hm.household_id = new.household_id and hm.profile_id = auth.uid() and hm.role in ('owner','admin')))
  );

-- teams: allow household members to read/insert/update teams for their household
CREATE POLICY "teams_select_if_member" ON public.teams
  FOR SELECT USING (
    exists (select 1 from public.household_members hm where hm.household_id = public.teams.household_id and hm.profile_id = auth.uid())
  );

CREATE POLICY "teams_insert_in_household" ON public.teams
  FOR INSERT WITH CHECK (
    exists (select 1 from public.household_members hm where hm.household_id = new.household_id and hm.profile_id = auth.uid())
  );

CREATE POLICY "teams_update_if_member" ON public.teams
  FOR UPDATE USING (
    exists (select 1 from public.household_members hm where hm.household_id = public.teams.household_id and hm.profile_id = auth.uid())
  ) WITH CHECK (
    exists (select 1 from public.household_members hm where hm.household_id = new.household_id and hm.profile_id = auth.uid())
  );

-- events: allow household members to select; allow inserts if the user is a household member; allow updates/deletes if the user created it or is admin
CREATE POLICY "events_select_if_member" ON public.events
  FOR SELECT USING (
    exists (select 1 from public.household_members hm where hm.household_id = public.events.household_id and hm.profile_id = auth.uid())
  );

CREATE POLICY "events_insert_if_member" ON public.events
  FOR INSERT WITH CHECK (
    exists (select 1 from public.household_members hm where hm.household_id = new.household_id and hm.profile_id = auth.uid())
  );

CREATE POLICY "events_update_own_or_admin" ON public.events
  FOR UPDATE USING (
    (public.events.created_by = auth.uid()) OR
    (exists (select 1 from public.household_members hm where hm.household_id = public.events.household_id and hm.profile_id = auth.uid() and hm.role in ('owner','admin')))
  ) WITH CHECK (
    (new.created_by = auth.uid()) OR
    (exists (select 1 from public.household_members hm where hm.household_id = new.household_id and hm.profile_id = auth.uid() and hm.role in ('owner','admin')))
  );

CREATE POLICY "events_delete_own_or_admin" ON public.events
  FOR DELETE USING (
    (public.events.created_by = auth.uid()) OR
    (exists (select 1 from public.household_members hm where hm.household_id = public.events.household_id and hm.profile_id = auth.uid() and hm.role in ('owner','admin')))
  );

-- rides: similar rules to events; only household members can see or create rides
CREATE POLICY "rides_select_if_member" ON public.rides
  FOR SELECT USING (
    exists (select 1 from public.events e join public.household_members hm on e.household_id = hm.household_id where e.id = public.rides.event_id and hm.profile_id = auth.uid())
  );

CREATE POLICY "rides_insert_if_member" ON public.rides
  FOR INSERT WITH CHECK (
    exists (select 1 from public.events e join public.household_members hm on e.household_id = hm.household_id where e.id = new.event_id and hm.profile_id = auth.uid())
  );

CREATE POLICY "rides_update_driver_or_admin" ON public.rides
  FOR UPDATE USING (
    (public.rides.driver_profile_id = auth.uid()) OR
    (exists (select 1 from public.events e join public.household_members hm on e.household_id = hm.household_id where e.id = public.rides.event_id and hm.profile_id = auth.uid() and hm.role in ('owner','admin')))
  ) WITH CHECK (
    (new.driver_profile_id = auth.uid()) OR
    (exists (select 1 from public.events e join public.household_members hm on e.household_id = hm.household_id where e.id = new.event_id and hm.profile_id = auth.uid() and hm.role in ('owner','admin')))
  );

-- messages: household members can insert/select messages in their household
CREATE POLICY "messages_select_if_member" ON public.messages
  FOR SELECT USING (
    exists (select 1 from public.household_members hm where hm.household_id = public.messages.household_id and hm.profile_id = auth.uid())
  );

CREATE POLICY "messages_insert_if_member" ON public.messages
  FOR INSERT WITH CHECK (
    exists (select 1 from public.household_members hm where hm.household_id = new.household_id and hm.profile_id = auth.uid())
  );

-- devices: profile owner can insert/select their tokens
CREATE POLICY "devices_by_owner" ON public.devices
  FOR SELECT USING ( profile_id = auth.uid() );

CREATE POLICY "devices_insert_self" ON public.devices
  FOR INSERT WITH CHECK ( profile_id = auth.uid() );

CREATE POLICY "devices_delete_self" ON public.devices
  FOR DELETE USING ( profile_id = auth.uid() );

-- End of policies
