-- =============================================================================
-- Section-only RLS policies (NON-DESTRUCTIVE)
-- Depends on:
-- - public.user_has_section_access(section_name text)
-- - public.is_admin_user()
-- =============================================================================

-- sessions -> football
alter table if exists public.sessions enable row level security;
drop policy if exists sessions_read_authenticated on public.sessions;
drop policy if exists sessions_write_authenticated on public.sessions;
drop policy if exists sessions_write_by_section on public.sessions;
create policy sessions_section_football
  on public.sessions
  for all
  to authenticated
  using (public.user_has_section_access('football'))
  with check (public.user_has_section_access('football'));

-- fitness_sessions -> fitness
alter table if exists public.fitness_sessions enable row level security;
drop policy if exists fitness_sessions_read_fitness_only on public.fitness_sessions;
drop policy if exists fitness_sessions_write_fitness_only on public.fitness_sessions;
drop policy if exists fitness_sessions_insert_fitness_only on public.fitness_sessions;
drop policy if exists fitness_sessions_update_fitness_only on public.fitness_sessions;
drop policy if exists fitness_sessions_delete_fitness_only on public.fitness_sessions;
create policy fitness_sessions_section_fitness
  on public.fitness_sessions
  for all
  to authenticated
  using (public.user_has_section_access('fitness'))
  with check (public.user_has_section_access('fitness'));

-- meetings + children -> meetings
alter table if exists public.meetings enable row level security;
alter table if exists public.meeting_attendees enable row level security;
alter table if exists public.meeting_action_items enable row level security;

drop policy if exists meetings_select on public.meetings;
drop policy if exists meetings_insert on public.meetings;
drop policy if exists meetings_update on public.meetings;
drop policy if exists meetings_delete on public.meetings;
create policy meetings_section_meetings
  on public.meetings
  for all
  to authenticated
  using (public.user_has_section_access('meetings'))
  with check (public.user_has_section_access('meetings'));

drop policy if exists meeting_attendees_select on public.meeting_attendees;
drop policy if exists meeting_attendees_insert on public.meeting_attendees;
drop policy if exists meeting_attendees_update on public.meeting_attendees;
drop policy if exists meeting_attendees_delete on public.meeting_attendees;
create policy meeting_attendees_section_meetings
  on public.meeting_attendees
  for all
  to authenticated
  using (public.user_has_section_access('meetings'))
  with check (public.user_has_section_access('meetings'));

drop policy if exists meeting_action_items_select on public.meeting_action_items;
drop policy if exists meeting_action_items_insert on public.meeting_action_items;
drop policy if exists meeting_action_items_update on public.meeting_action_items;
drop policy if exists meeting_action_items_delete on public.meeting_action_items;
create policy meeting_action_items_section_meetings
  on public.meeting_action_items
  for all
  to authenticated
  using (public.user_has_section_access('meetings'))
  with check (public.user_has_section_access('meetings'));

-- microcycles + children -> planning
alter table if exists public.microcycles enable row level security;
alter table if exists public.microcycle_days enable row level security;
alter table if exists public.microcycle_day_concepts enable row level security;
alter table if exists public.microcycle_player_availability enable row level security;

drop policy if exists microcycles_read_planning on public.microcycles;
drop policy if exists microcycles_write_planning on public.microcycles;
drop policy if exists microcycles_insert_planning on public.microcycles;
drop policy if exists microcycles_update_planning on public.microcycles;
drop policy if exists microcycles_delete_planning on public.microcycles;
create policy microcycles_section_planning
  on public.microcycles
  for all
  to authenticated
  using (public.user_has_section_access('planning'))
  with check (public.user_has_section_access('planning'));

drop policy if exists microcycle_days_read_planning on public.microcycle_days;
drop policy if exists microcycle_days_write_planning on public.microcycle_days;
drop policy if exists microcycle_days_insert_planning on public.microcycle_days;
drop policy if exists microcycle_days_update_planning on public.microcycle_days;
drop policy if exists microcycle_days_delete_planning on public.microcycle_days;
create policy microcycle_days_section_planning
  on public.microcycle_days
  for all
  to authenticated
  using (public.user_has_section_access('planning'))
  with check (public.user_has_section_access('planning'));

drop policy if exists microcycle_day_concepts_read_planning on public.microcycle_day_concepts;
drop policy if exists microcycle_day_concepts_write_planning on public.microcycle_day_concepts;
drop policy if exists microcycle_day_concepts_insert_planning on public.microcycle_day_concepts;
drop policy if exists microcycle_day_concepts_update_planning on public.microcycle_day_concepts;
drop policy if exists microcycle_day_concepts_delete_planning on public.microcycle_day_concepts;
create policy microcycle_day_concepts_section_planning
  on public.microcycle_day_concepts
  for all
  to authenticated
  using (public.user_has_section_access('planning'))
  with check (public.user_has_section_access('planning'));

drop policy if exists microcycle_player_availability_read_planning on public.microcycle_player_availability;
drop policy if exists microcycle_player_availability_write_planning on public.microcycle_player_availability;
drop policy if exists microcycle_player_availability_insert_planning on public.microcycle_player_availability;
drop policy if exists microcycle_player_availability_update_planning on public.microcycle_player_availability;
drop policy if exists microcycle_player_availability_delete_planning on public.microcycle_player_availability;
create policy microcycle_player_availability_section_planning
  on public.microcycle_player_availability
  for all
  to authenticated
  using (public.user_has_section_access('planning'))
  with check (public.user_has_section_access('planning'));

-- section mapped domain tables
alter table if exists public.session_cards enable row level security;
drop policy if exists session_cards_read_authenticated on public.session_cards;
drop policy if exists session_cards_write_by_section on public.session_cards;
create policy session_cards_section_training
  on public.session_cards
  for all
  to authenticated
  using (
    public.user_has_section_access('football')
    or public.user_has_section_access('fitness')
    or public.user_has_section_access('gk')
  )
  with check (
    public.user_has_section_access('football')
    or public.user_has_section_access('fitness')
    or public.user_has_section_access('gk')
  );

alter table if exists public.squad_players enable row level security;
drop policy if exists squad_players_read_authenticated on public.squad_players;
drop policy if exists squad_players_write_squad on public.squad_players;
create policy squad_players_section_squad
  on public.squad_players
  for all
  to authenticated
  using (public.user_has_section_access('squad'))
  with check (public.user_has_section_access('squad'));

alter table if exists public.attendance_excluded_players enable row level security;
drop policy if exists attendance_excluded_players_read_authenticated on public.attendance_excluded_players;
drop policy if exists attendance_excluded_players_write_attendance on public.attendance_excluded_players;
create policy attendance_excluded_players_section_attendance
  on public.attendance_excluded_players
  for all
  to authenticated
  using (public.user_has_section_access('attendance'))
  with check (public.user_has_section_access('attendance'));

alter table if exists public.exercise_library enable row level security;
drop policy if exists exercise_library_read_authenticated on public.exercise_library;
drop policy if exists exercise_library_write_exercises on public.exercise_library;
create policy exercise_library_section_exercises
  on public.exercise_library
  for all
  to authenticated
  using (public.user_has_section_access('exercises'))
  with check (public.user_has_section_access('exercises'));

alter table if exists public.exercise_library_deleted_ids enable row level security;
drop policy if exists exercise_library_deleted_ids_read_authenticated on public.exercise_library_deleted_ids;
drop policy if exists exercise_library_deleted_ids_write_exercises on public.exercise_library_deleted_ids;
create policy exercise_library_deleted_ids_section_exercises
  on public.exercise_library_deleted_ids
  for all
  to authenticated
  using (public.user_has_section_access('exercises'))
  with check (public.user_has_section_access('exercises'));

alter table if exists public.video_analysis enable row level security;
drop policy if exists video_analysis_read_authenticated on public.video_analysis;
drop policy if exists video_analysis_write_video on public.video_analysis;
create policy video_analysis_section_video
  on public.video_analysis
  for all
  to authenticated
  using (public.user_has_section_access('video'))
  with check (public.user_has_section_access('video'));

alter table if exists public.competition_fixtures enable row level security;
drop policy if exists competition_fixtures_read_authenticated on public.competition_fixtures;
drop policy if exists competition_fixtures_write_football on public.competition_fixtures;
create policy competition_fixtures_section_football
  on public.competition_fixtures
  for all
  to authenticated
  using (public.user_has_section_access('football'))
  with check (public.user_has_section_access('football'));

alter table if exists public.physio_records enable row level security;
drop policy if exists physio_records_read_policy on public.physio_records;
drop policy if exists physio_records_write_policy on public.physio_records;
create policy physio_records_section_physio
  on public.physio_records
  for all
  to authenticated
  using (public.user_has_section_access('physio'))
  with check (public.user_has_section_access('physio'));

-- Storage policies: squad photos -> squad
-- Keep same policy names; swap helper dependency.
drop policy if exists squad_player_photos_select on storage.objects;
drop policy if exists squad_player_photos_insert on storage.objects;
drop policy if exists squad_player_photos_update on storage.objects;
drop policy if exists squad_player_photos_delete on storage.objects;

create policy squad_player_photos_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'squad-player-photos'
    and public.user_has_section_access('squad')
  );

create policy squad_player_photos_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'squad-player-photos'
    and public.user_has_section_access('squad')
  );

create policy squad_player_photos_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'squad-player-photos'
    and public.user_has_section_access('squad')
  )
  with check (
    bucket_id = 'squad-player-photos'
    and public.user_has_section_access('squad')
  );

create policy squad_player_photos_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'squad-player-photos'
    and public.user_has_section_access('squad')
  );
