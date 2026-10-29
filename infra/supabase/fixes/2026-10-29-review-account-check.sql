-- Read-only: what Apple's reviewer sees in the demo account (appreview@sidlne.app):
-- the family, its members, chat messages by sender, upcoming events, carpools,
-- and whether the chat safety tables and policies are in place.
select json_build_object(
  'account', (select json_build_object('confirmed', u.email_confirmed_at is not null, 'last_sign_in', u.last_sign_in_at, 'banned', u.banned_until)
    from auth.users u where u.email = 'appreview@sidlne.app'),
  'families', (select json_agg(json_build_object('name', h.name, 'role', m.role,
      'members', (select json_agg(json_build_object('name', p.display_name, 'role', mm.role)) from public.household_members mm join public.profiles p on p.id = mm.profile_id where mm.household_id = h.id),
      'messages_by_sender', (select json_agg(json_build_object('sender', p.display_name, 'n', x.n)) from (select sender_id, count(*) n from public.messages where household_id = h.id group by sender_id) x join public.profiles p on p.id = x.sender_id),
      'athletes', (select count(*) from public.athletes where household_id = h.id),
      'teams', (select count(*) from public.teams where household_id = h.id),
      'upcoming_events', (select count(*) from public.events where household_id = h.id and start >= now()),
      'next_event', (select min(start) from public.events where household_id = h.id and start >= now()),
      'carpools', (select count(*) from public.carpools where household_id = h.id),
      'playlists', (select count(*) from public.game_day_playlists where household_id = h.id)))
    from public.household_members m join public.households h on h.id = m.household_id join auth.users u on u.id = m.profile_id
    where u.email = 'appreview@sidlne.app'),
  'safety', json_build_object(
    'message_reports', to_regclass('public.message_reports') is not null,
    'blocked_users', to_regclass('public.blocked_users') is not null,
    'policies', (select json_agg(policyname order by policyname) from pg_policies where schemaname = 'public' and tablename in ('message_reports', 'blocked_users', 'messages')),
    'delete_my_account', to_regprocedure('public.delete_my_account()') is not null)
) as review_account;
