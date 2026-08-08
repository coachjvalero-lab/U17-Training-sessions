-- U17 Training Sessions - Supabase Phase 3 (Domain tables)
-- Purpose: create the remaining operational tables currently backed by Firestore.
-- Notes:
-- - IDs are preserved as text primary keys when they exist in Firestore.
-- - JSONB is used for nested payloads to keep migration fast and lossless.
-- - RLS policies are defined in phase3_domain_rls.sql.

create extension if not exists pgcrypto;

create table if not exists public.session_cards (
  id text primary key,
  session_number integer not null,
  title text not null,
  description text not null default '',
  category text not null default '',
  duration text not null default '',
  intensity text not null default '',
  date text not null default '',
  role text not null check (role in ('football', 'fitness', 'gk')),
  created_at bigint not null,
  updated_at bigint not null
);

create index if not exists session_cards_updated_at_idx on public.session_cards (updated_at desc);
create index if not exists session_cards_role_idx on public.session_cards (role);

create table if not exists public.squad_players (
  id text primary key,
  first_name text not null,
  last_name text not null,
  number text,
  position text not null,
  status text not null,
  notes text,
  joined_date text,
  photo_url text,
  age integer,
  nationality text,
  preferred_foot text,
  height_cm integer,
  weight_kg integer,
  attendance_stats jsonb,
  malika_points integer,
  malika_history jsonb not null default '[]'::jsonb,
  updated_at bigint not null
);

create index if not exists squad_players_status_idx on public.squad_players (status);
create index if not exists squad_players_position_idx on public.squad_players (position);
create index if not exists squad_players_updated_at_idx on public.squad_players (updated_at desc);

create table if not exists public.attendance_excluded_players (
  name text primary key,
  updated_at bigint not null
);

create index if not exists attendance_excluded_players_updated_at_idx on public.attendance_excluded_players (updated_at desc);

create table if not exists public.team_logo_config (
  id text primary key,
  logo_url text,
  initialized boolean,
  updated_at bigint,
  payload jsonb not null default '{}'::jsonb
);

create table if not exists public.exercise_library (
  id text primary key,
  name text not null,
  game_moment text not null,
  sub_moment text not null default '',
  description text not null default '',
  duration text not null default '',
  series text,
  work_time text,
  rest_time text,
  dimensions text not null default '',
  coach_roles text not null default '',
  image text,
  player_groups text,
  hide_graphics boolean,
  is_fitness boolean,
  malika_challenge jsonb,
  updated_at bigint not null
);

create index if not exists exercise_library_game_moment_idx on public.exercise_library (game_moment);
create index if not exists exercise_library_updated_at_idx on public.exercise_library (updated_at desc);

create table if not exists public.exercise_library_deleted_ids (
  id text primary key,
  updated_at bigint
);

create table if not exists public.video_analysis (
  id text primary key,
  title text not null,
  match_or_session_date text not null,
  opponent_or_topic text not null,
  video_url text not null,
  game_moment text not null,
  tags jsonb not null default '[]'::jsonb,
  key_timestamps jsonb not null default '[]'::jsonb,
  summary text not null default '',
  created_at text not null,
  updated_at bigint not null
);

create index if not exists video_analysis_updated_at_idx on public.video_analysis (updated_at desc);
create index if not exists video_analysis_game_moment_idx on public.video_analysis (game_moment);

create table if not exists public.competition_fixtures (
  id text primary key,
  opponent text not null,
  opponent_logo text,
  date text not null,
  time text not null,
  location text not null,
  venue text,
  competition_name text not null,
  matchday text,
  status text not null,
  result jsonb,
  tactical_notes text,
  lineup jsonb,
  updated_at bigint not null
);

create index if not exists competition_fixtures_date_idx on public.competition_fixtures (date desc);
create index if not exists competition_fixtures_updated_at_idx on public.competition_fixtures (updated_at desc);

create table if not exists public.physio_records (
  id text primary key,
  player_id text not null,
  player_name text not null,
  injury_date text not null,
  injury_type text not null,
  severity text not null,
  status text not null,
  treatment_notes text not null default '',
  estimated_return_date text,
  physio_name text,
  updated_at text not null,
  cloud_updated_at bigint not null
);

create index if not exists physio_records_status_idx on public.physio_records (status);
create index if not exists physio_records_player_id_idx on public.physio_records (player_id);
create index if not exists physio_records_cloud_updated_at_idx on public.physio_records (cloud_updated_at desc);

-- Realtime publication
alter publication supabase_realtime add table public.session_cards;
alter publication supabase_realtime add table public.squad_players;
alter publication supabase_realtime add table public.attendance_excluded_players;
alter publication supabase_realtime add table public.team_logo_config;
alter publication supabase_realtime add table public.exercise_library;
alter publication supabase_realtime add table public.exercise_library_deleted_ids;
alter publication supabase_realtime add table public.video_analysis;
alter publication supabase_realtime add table public.competition_fixtures;
alter publication supabase_realtime add table public.physio_records;
