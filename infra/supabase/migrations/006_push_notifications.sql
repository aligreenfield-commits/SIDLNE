-- 006: push notifications for schedule changes. Phones register here, and the
-- database re-checks every team calendar every 15 minutes so changes are
-- caught (and sent) even when nobody has the app open.
-- Idempotent: safe to run again.

create table if not exists public.push_devices (
  token text primary key check (char_length(token) between 10 and 400),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  platform text not null default 'ios' check (platform in ('ios')),
  time_zone text check (time_zone is null or char_length(time_zone) <= 64),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists idx_push_devices_profile on public.push_devices (profile_id);

alter table public.push_devices enable row level security;
drop policy if exists push_devices_select on public.push_devices;
create policy push_devices_select on public.push_devices for select using (profile_id = auth.uid());
drop policy if exists push_devices_delete on public.push_devices;
create policy push_devices_delete on public.push_devices for delete using (profile_id = auth.uid());

-- A phone's token moves to whoever signed in on it last
create or replace function public.register_push_device(device_token text, device_platform text default 'ios', device_time_zone text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  insert into public.push_devices (token, profile_id, platform, time_zone)
  values (trim(device_token), auth.uid(), coalesce(device_platform, 'ios'), left(device_time_zone, 64))
  on conflict (token) do update
    set profile_id = excluded.profile_id, platform = excluded.platform, time_zone = excluded.time_zone, last_seen_at = now();
end $$;

create or replace function public.unregister_push_device(device_token text)
returns void language sql security definer set search_path = public as $$
  delete from public.push_devices where token = trim(device_token) and profile_id = auth.uid();
$$;

grant execute on function public.register_push_device(text, text, text) to authenticated;
grant execute on function public.unregister_push_device(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Scheduled calendar checks (pg_cron + pg_net, available on Supabase)
-- ---------------------------------------------------------------------------
-- A random key, kept in the database, that the scheduled job sends to the
-- sync-calendar function to prove the call came from here.
create table if not exists public.app_secrets (
  name text primary key,
  value text not null
);
alter table public.app_secrets enable row level security; -- no policies: nobody reads it through the API
revoke all on public.app_secrets from anon, authenticated;
insert into public.app_secrets (name, value)
values ('sync_cron_key', encode(gen_random_bytes(24), 'hex'))
on conflict (name) do nothing;

-- For the sync function (service role only)
create or replace function public.check_sync_cron_key(key text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.app_secrets where name = 'sync_cron_key' and value = key);
$$;
revoke execute on function public.check_sync_cron_key(text) from public, anon, authenticated;
grant execute on function public.check_sync_cron_key(text) to service_role;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron')
     and exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net;
    create extension if not exists pg_cron;
    perform cron.unschedule(jobid) from cron.job where jobname = 'sidlne-sync-calendars';
    -- The project URL is public (it is in config.js)
    perform cron.schedule('sidlne-sync-calendars', '*/15 * * * *', $job$
      select net.http_post(
        url := 'https://reufyrhowxxivpmobouz.supabase.co/functions/v1/sync-calendar',
        headers := jsonb_build_object('Content-Type', 'application/json',
                                      'x-sync-key', (select value from public.app_secrets where name = 'sync_cron_key')),
        body := '{"scheduled": true}'::jsonb,
        timeout_milliseconds := 120000
      );
    $job$);
  end if;
end $$;

notify pgrst, 'reload schema';
