-- Sample data for the App Review demo account (run by .github/workflows/appstore.yml).
-- __REVIEW_UID__ is replaced with the demo user's id. Rebuilds the "Review Family"
-- each run so its games are always in the coming weeks.

do $$
declare
  uid uuid := '__REVIEW_UID__';
  hid uuid;
  avery uuid;
  jordan uuid;
  lax uuid;
  hoops uuid;
  e_game uuid;
  day0 timestamptz := date_trunc('day', now() at time zone 'America/New_York') at time zone 'America/New_York';
  at_ timestamptz;
begin
  update public.profiles set display_name = 'Sam Rivera' where id = uid;
  delete from public.households where created_by = uid;

  insert into public.households (name, created_by) values ('Review Family', uid) returning id into hid;
  insert into public.household_members (household_id, profile_id, role) values (hid, uid, 'owner');
  insert into public.athletes (household_id, name, color) values (hid, 'Avery', '#9a78bf') returning id into avery;
  insert into public.athletes (household_id, name, color) values (hid, 'Jordan', '#6e9bc8') returning id into jordan;
  insert into public.teams (household_id, athlete_id, name, sport) values (hid, avery, 'Hawks U12 Lacrosse', 'Lacrosse') returning id into lax;
  insert into public.teams (household_id, athlete_id, name, sport) values (hid, jordan, 'Thunder Basketball', 'Basketball') returning id into hoops;

  -- Two weeks of practices and games
  for i in 0..13 loop
    if extract(dow from day0 + i * interval '1 day') in (1, 3) then
      at_ := day0 + i * interval '1 day' + interval '17 hours 30 minutes';
      insert into public.events (household_id, team_id, athlete_id, title, start, "end", location, created_by)
      values (hid, lax, avery, 'Lacrosse practice', at_, at_ + interval '90 minutes', 'Riverside Park Field 2', uid);
    end if;
    if extract(dow from day0 + i * interval '1 day') in (2, 4) then
      at_ := day0 + i * interval '1 day' + interval '18 hours';
      insert into public.events (household_id, team_id, athlete_id, title, start, "end", location, created_by)
      values (hid, hoops, jordan, 'Basketball practice', at_, at_ + interval '75 minutes', 'Lincoln Middle School Gym', uid);
    end if;
    if extract(dow from day0 + i * interval '1 day') = 6 then
      at_ := day0 + i * interval '1 day' + interval '10 hours';
      insert into public.events (household_id, team_id, athlete_id, title, start, "end", location, created_by)
      values (hid, lax, avery, 'Lacrosse game vs. Eagles', at_, at_ + interval '2 hours', 'Westfield Sports Complex', uid)
      returning id into e_game;
      at_ := day0 + i * interval '1 day' + interval '11 hours';
      insert into public.events (household_id, team_id, athlete_id, title, start, "end", location, created_by)
      values (hid, hoops, jordan, 'Basketball game vs. Rockets', at_, at_ + interval '90 minutes', 'Community Center Court B', uid);
      insert into public.rides (event_id, driver_profile_id, status) values (e_game, uid, 'assigned');
    end if;
  end loop;

  insert into public.messages (household_id, sender_id, body) values
    (hid, uid, 'Welcome to SIDLNE! Saturday has two games at the same time, so we need a second driver.'),
    (hid, uid, 'I can take Avery to lacrosse. Who has Jordan?');

  if to_regclass('public.game_day_playlists') is not null then
    insert into public.game_day_playlists (household_id, title, url, service, created_by)
    values (hid, 'KIDZ BOP Radio', 'https://www.siriusxm.com/kidzbopradio', 'siriusxm', uid);
  end if;

  if to_regclass('public.carpools') is not null then
    with c as (
      insert into public.carpools (household_id, team_id, name, created_by)
      values (hid, lax, 'Hawks carpool', uid) returning id
    )
    insert into public.carpool_members (carpool_id, profile_id, name, seats)
    select id, uid, 'Sam Rivera', 3 from c
    union all select id, null, 'Dana Lee', 4 from c;
  end if;
end $$;
