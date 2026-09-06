-- GK Coach session view/create consistency (additive, idempotent migration)
-- Date: 2026-09-06
-- Scope: GK Coach session consistency ONLY.
--
-- Correction from the previous draft of this migration:
--   The earlier draft failed with:
--       ERROR: 42P01: relation "public.session_catalog" does not exist
--   Root cause: public.session_catalog is only created by the optional
--   "module independence" migrations (20260811 fitness / 20260822 GK). Those were
--   never applied to production in the form that creates the
--   gk_sessions.session_uid -> session_catalog(session_uid) foreign key, so the
--   deployed public.gk_sessions table has NO dependency on session_catalog and
--   the catalog table itself does not exist. The GK client therefore writes and
--   reads public.gk_sessions directly (single canonical table).
--
-- What this migration does (only objects that actually exist in production):
--   1) Ensure public.gk_sessions RLS uses the canonical helper
--      public.user_has_section_access('gk') so a GK Coach granted via
--      Administrator Hub (public.user_section_access) can read AND write the same
--      sessions. (public.user_has_section_access already exists; it is created by
--      20260812_authorization_section_simplified_foundation.sql.)
--   2) Idempotent backfill of historical GK sessions from the legacy
--      public.sessions table (rows with GK content) into public.gk_sessions, so
--      the GK list (which reads ONLY public.gk_sessions) shows sessions that were
--      created before this consolidation. Backfill is kept ONLY because it is
--      compatible with the real schema (both public.sessions and
--      public.gk_sessions exist; no session_catalog involved).
--
-- Explicitly NOT done:
--   - Does NOT create public.session_catalog (no workaround table).
--   - Does NOT add any new global table.
--   - Does NOT touch Football, Fitness, Matches, Physio, global auth, or the
--     global session model.
--
-- Apply manually after review. Do NOT run `supabase db push` automatically.

begin;

-- -----------------------------------------------------------------------------
-- 1) Canonical GK RLS on public.gk_sessions (drop legacy dual-helper policy)
-- -----------------------------------------------------------------------------
alter table if exists public.gk_sessions enable row level security;

drop policy if exists gk_sessions_section_gk on public.gk_sessions;
create policy gk_sessions_section_gk
  on public.gk_sessions
  for all
  to authenticated
  using (public.user_has_section_access('gk'))
  with check (public.user_has_section_access('gk'));

-- -----------------------------------------------------------------------------
-- 2) Backfill historical GK sessions from legacy public.sessions (only GK content)
--    Uses only public.sessions (source) and public.gk_sessions (target).
--    Fully idempotent via ON CONFLICT (id).
-- -----------------------------------------------------------------------------
insert into public.gk_sessions (
  id,
  session_uid,
  legacy_session_id,
  team_name,
  date,
  time,
  session_number,
  microcycle_day,
  main_objective,
  materials_needed,
  observations,
  squad_roster,
  attendance,
  warm_up,
  main_part,
  cool_down,
  player_groups,
  created_at,
  updated_at
)
select
  'gk-' || s.id,
  s.id,
  s.id,
  coalesce(s.team_name, 'U17 Women Al Ula'),
  coalesce(s.date, to_char(now(), 'YYYY-MM-DD')),
  coalesce(s.time, '18:30 - 20:00'),
  coalesce(s.session_number, ''),
  coalesce(s.microcycle_day, 'MD-3'),
  coalesce(s.main_objective, ''),
  coalesce(s.materials_needed, ''),
  s.observations,
  coalesce(s.squad_roster, '[]'::jsonb),
  coalesce(s.attendance, '[]'::jsonb),
  s.gk_warm_up,
  s.gk_main_part,
  s.gk_cool_down,
  s.gk_player_groups,
  coalesce(s.gk_updated_at, s.updated_at, (extract(epoch from now()) * 1000)::bigint),
  coalesce(s.gk_updated_at, s.updated_at, (extract(epoch from now()) * 1000)::bigint)
from public.sessions s
where
  s.gk_updated_at is not null
  or (s.gk_warm_up is not null and s.gk_warm_up != 'null'::jsonb and s.gk_warm_up != '{}'::jsonb)
  or (s.gk_main_part is not null and s.gk_main_part != 'null'::jsonb and s.gk_main_part != '{}'::jsonb)
  or (s.gk_cool_down is not null and s.gk_cool_down != 'null'::jsonb and s.gk_cool_down != '{}'::jsonb)
  or (s.gk_player_groups is not null and s.gk_player_groups != 'null'::jsonb and s.gk_player_groups != '[]'::jsonb and s.gk_player_groups != '{}'::jsonb)
on conflict (id) do update
set
  session_uid = excluded.session_uid,
  legacy_session_id = excluded.legacy_session_id,
  team_name = excluded.team_name,
  date = excluded.date,
  time = excluded.time,
  session_number = excluded.session_number,
  microcycle_day = excluded.microcycle_day,
  main_objective = excluded.main_objective,
  materials_needed = excluded.materials_needed,
  observations = excluded.observations,
  squad_roster = excluded.squad_roster,
  attendance = excluded.attendance,
  warm_up = excluded.warm_up,
  main_part = excluded.main_part,
  cool_down = excluded.cool_down,
  player_groups = excluded.player_groups,
  updated_at = greatest(public.gk_sessions.updated_at, excluded.updated_at);

commit;
