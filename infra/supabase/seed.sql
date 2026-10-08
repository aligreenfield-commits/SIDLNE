-- seed.sql

-- Seeds for demo/testing. Remove or modify for production.

-- Create a sample household (no created_by)
insert into public.households (id, name) values
  ('11111111-1111-1111-1111-111111111111', 'Demo Family')
on conflict do nothing;

-- Create sample teams
insert into public.teams (id, household_id, name, sport, athlete_name) values
  ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Northside Lacrosse', 'Lacrosse', 'Avery')
  on conflict do nothing;

insert into public.teams (id, household_id, name, sport, athlete_name) values
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Town Hoops', 'Basketball', 'Jordan')
  on conflict do nothing;

-- Create sample events (start times relative to now)
insert into public.events (id, household_id, team_id, title, location, start) values
  ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'Lacrosse practice', 'Community Field', now() + interval '6 hours')
  on conflict do nothing;

insert into public.events (id, household_id, team_id, title, location, start) values
  ('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'Basketball game', 'Middle School Gym', now() + interval '2 days')
  on conflict do nothing;

-- Note: household_members entries require profile ids (auth user ids). Seed users must be created via auth and then household_members inserted referencing their ids.
