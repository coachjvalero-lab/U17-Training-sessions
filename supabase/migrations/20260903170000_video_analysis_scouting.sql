-- Video Analysis module - "Scouting" area, Planning + Player Scouting (Phase 5a/5b).
-- Unlike previous Video Analysis phases, this one OWNS new data (scouted players, scouting
-- trips) rather than reading an entity that already lives in another module. Scouting player
-- observation reports (5c) and advanced tagging/timeline are explicitly out of scope here.

create extension if not exists pgcrypto;

create table if not exists public.scouting_players (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  -- Nullable: the player's current club may not exist in auth_teams yet.
  club_team_id text references public.auth_teams(id) on delete set null,
  position text,
  birth_date date,
  nationality text,
  status text not null default 'shortlist' check (status in ('shortlist', 'watching', 'discarded', 'signed')),
  created_by uuid references public.user_profiles(user_id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists scouting_players_club_team_id_idx on public.scouting_players (club_team_id);
create index if not exists scouting_players_status_idx on public.scouting_players (status);

create table if not exists public.scouting_trips (
  id uuid primary key default gen_random_uuid(),
  match_date date not null,
  home_team_id text references public.auth_teams(id) on delete set null,
  away_team_id text references public.auth_teams(id) on delete set null,
  -- Free text fallback for when the fixture isn't (yet) modeled in auth_teams/matches.
  competition text not null default '',
  assigned_to uuid references public.user_profiles(user_id) on delete set null,
  status text not null default 'planned' check (status in ('planned', 'done', 'cancelled')),
  notes text not null default '',
  created_by uuid references public.user_profiles(user_id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists scouting_trips_match_date_idx on public.scouting_trips (match_date desc);
create index if not exists scouting_trips_status_idx on public.scouting_trips (status);

create table if not exists public.scouting_trip_targets (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.scouting_trips(id) on delete cascade,
  player_id uuid not null references public.scouting_players(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (trip_id, player_id)
);

create index if not exists scouting_trip_targets_trip_id_idx on public.scouting_trip_targets (trip_id);
create index if not exists scouting_trip_targets_player_id_idx on public.scouting_trip_targets (player_id);

alter table public.scouting_players enable row level security;
alter table public.scouting_trips enable row level security;
alter table public.scouting_trip_targets enable row level security;

-- Section-only (no team scoping): scouting is general club scouting, not owned by one team,
-- matching the video_clips_section_video policy shape from Phase 0.
drop policy if exists scouting_players_section_video on public.scouting_players;
create policy scouting_players_section_video
  on public.scouting_players for all to authenticated
  using (public.user_has_section_access('video'))
  with check (public.user_has_section_access('video'));

drop policy if exists scouting_trips_section_video on public.scouting_trips;
create policy scouting_trips_section_video
  on public.scouting_trips for all to authenticated
  using (public.user_has_section_access('video'))
  with check (public.user_has_section_access('video'));

drop policy if exists scouting_trip_targets_section_video on public.scouting_trip_targets;
create policy scouting_trip_targets_section_video
  on public.scouting_trip_targets for all to authenticated
  using (public.user_has_section_access('video'))
  with check (public.user_has_section_access('video'));

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'scouting_players'
  ) then
    execute 'alter publication supabase_realtime add table public.scouting_players';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'scouting_trips'
  ) then
    execute 'alter publication supabase_realtime add table public.scouting_trips';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'scouting_trip_targets'
  ) then
    execute 'alter publication supabase_realtime add table public.scouting_trip_targets';
  end if;
end $$;
