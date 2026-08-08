-- U17 Training Sessions - Supabase Phase 3 (Domain RLS)
-- Requires: phase2_auth_rls.sql (functions and user_roles policies)

-- Session cards
alter table if exists public.session_cards enable row level security;

drop policy if exists session_cards_read_authenticated on public.session_cards;
create policy session_cards_read_authenticated
  on public.session_cards
  for select
  to authenticated
  using (auth.uid() is not null);

drop policy if exists session_cards_write_by_section on public.session_cards;
create policy session_cards_write_by_section
  on public.session_cards
  for all
  to authenticated
  using (
    public.has_section_access('football')
    or public.has_section_access('fitness')
    or public.has_section_access('gk')
  )
  with check (
    public.has_section_access('football')
    or public.has_section_access('fitness')
    or public.has_section_access('gk')
  );

-- Squad
alter table if exists public.squad_players enable row level security;

drop policy if exists squad_players_read_authenticated on public.squad_players;
create policy squad_players_read_authenticated
  on public.squad_players
  for select
  to authenticated
  using (auth.uid() is not null);

drop policy if exists squad_players_write_squad on public.squad_players;
create policy squad_players_write_squad
  on public.squad_players
  for all
  to authenticated
  using (public.has_section_access('squad'))
  with check (public.has_section_access('squad'));

-- Attendance excluded players
alter table if exists public.attendance_excluded_players enable row level security;

drop policy if exists attendance_excluded_players_read_authenticated on public.attendance_excluded_players;
create policy attendance_excluded_players_read_authenticated
  on public.attendance_excluded_players
  for select
  to authenticated
  using (auth.uid() is not null);

drop policy if exists attendance_excluded_players_write_attendance on public.attendance_excluded_players;
create policy attendance_excluded_players_write_attendance
  on public.attendance_excluded_players
  for all
  to authenticated
  using (public.has_section_access('attendance'))
  with check (public.has_section_access('attendance'));

-- Team logo
alter table if exists public.team_logo_config enable row level security;

drop policy if exists team_logo_config_read_authenticated on public.team_logo_config;
create policy team_logo_config_read_authenticated
  on public.team_logo_config
  for select
  to authenticated
  using (auth.uid() is not null);

drop policy if exists team_logo_config_write_authenticated on public.team_logo_config;
create policy team_logo_config_write_authenticated
  on public.team_logo_config
  for all
  to authenticated
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- Exercise library
alter table if exists public.exercise_library enable row level security;

drop policy if exists exercise_library_read_authenticated on public.exercise_library;
create policy exercise_library_read_authenticated
  on public.exercise_library
  for select
  to authenticated
  using (auth.uid() is not null);

drop policy if exists exercise_library_write_exercises on public.exercise_library;
create policy exercise_library_write_exercises
  on public.exercise_library
  for all
  to authenticated
  using (public.has_section_access('exercises'))
  with check (public.has_section_access('exercises'));

-- Exercise library deleted IDs
alter table if exists public.exercise_library_deleted_ids enable row level security;

drop policy if exists exercise_library_deleted_ids_read_authenticated on public.exercise_library_deleted_ids;
create policy exercise_library_deleted_ids_read_authenticated
  on public.exercise_library_deleted_ids
  for select
  to authenticated
  using (auth.uid() is not null);

drop policy if exists exercise_library_deleted_ids_write_exercises on public.exercise_library_deleted_ids;
create policy exercise_library_deleted_ids_write_exercises
  on public.exercise_library_deleted_ids
  for all
  to authenticated
  using (public.has_section_access('exercises'))
  with check (public.has_section_access('exercises'));

-- Video analysis
alter table if exists public.video_analysis enable row level security;

drop policy if exists video_analysis_read_authenticated on public.video_analysis;
create policy video_analysis_read_authenticated
  on public.video_analysis
  for select
  to authenticated
  using (auth.uid() is not null);

drop policy if exists video_analysis_write_video on public.video_analysis;
create policy video_analysis_write_video
  on public.video_analysis
  for all
  to authenticated
  using (public.has_section_access('video'))
  with check (public.has_section_access('video'));

-- Fixtures
alter table if exists public.competition_fixtures enable row level security;

drop policy if exists competition_fixtures_read_authenticated on public.competition_fixtures;
create policy competition_fixtures_read_authenticated
  on public.competition_fixtures
  for select
  to authenticated
  using (auth.uid() is not null);

drop policy if exists competition_fixtures_write_football on public.competition_fixtures;
create policy competition_fixtures_write_football
  on public.competition_fixtures
  for all
  to authenticated
  using (public.has_section_access('football'))
  with check (public.has_section_access('football'));

-- Physio
alter table if exists public.physio_records enable row level security;

drop policy if exists physio_records_read_policy on public.physio_records;
create policy physio_records_read_policy
  on public.physio_records
  for select
  to authenticated
  using (
    public.is_admin_user()
    or public.has_section_access('physio')
    or public.has_section_access('football')
    or public.has_section_access('fitness')
    or public.has_section_access('gk')
  );

drop policy if exists physio_records_write_policy on public.physio_records;
create policy physio_records_write_policy
  on public.physio_records
  for all
  to authenticated
  using (public.is_admin_user() or public.has_section_access('physio'))
  with check (public.is_admin_user() or public.has_section_access('physio'));
