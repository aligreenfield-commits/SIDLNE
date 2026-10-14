-- 007: Game Day music. Families save playlist links (Spotify, Apple Music,
-- SiriusXM, ...) to play in the car on the way to a game, for the whole family
-- or for one athlete.
-- Idempotent: safe to run again.

create table if not exists public.game_day_playlists (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  athlete_id uuid references public.athletes(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  url text not null check (char_length(url) <= 500 and url ~* '^https://'),
  service text not null default 'link' check (service in ('spotify', 'apple', 'siriusxm', 'youtube', 'amazon', 'link')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_game_day_playlists_household on public.game_day_playlists (household_id);

alter table public.game_day_playlists enable row level security;
drop policy if exists game_day_playlists_all on public.game_day_playlists;
create policy game_day_playlists_all on public.game_day_playlists for all
  using (public.is_household_member(household_id))
  with check (
    public.is_household_member(household_id)
    and (athlete_id is null or exists (select 1 from public.athletes a where a.id = athlete_id and a.household_id = game_day_playlists.household_id))
  );

notify pgrst, 'reload schema';
