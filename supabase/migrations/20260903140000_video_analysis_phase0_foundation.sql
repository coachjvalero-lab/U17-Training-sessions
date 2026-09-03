-- Video Analysis module - Phase 0 shared foundation.
-- Video Analysis only READS existing entities (matches, training sessions, squad players) and
-- never writes to them; it only creates its own analysis records (this migration + later phases).
--
-- This phase adds:
--   1. public.opponent_match_notes: lightweight PRE-MATCH notes linked to a specific match_id,
--      complementary to the existing per-opponent master record public.opponent_analysis
--      (keyed by opponent_team_id, holds system/patterns/strengths-weaknesses that persist across
--      matches). opponent_analysis itself is NOT modified by this migration.
--   2. public.video_clips: a single shared clips table for all 4 future Video Analysis areas
--      (Matches, Opponent Analysis, Training Sessions, Scouting), using one explicit nullable FK
--      per branch instead of a polymorphic entry_type/entry_id pair. training_analysis_id and
--      scouting_report_id reference tables that don't exist yet (built in later phases): the
--      columns are created now without a FK constraint, added once those tables exist.
--      match_analysis_id is the same situation (no dedicated "match analysis" table yet either;
--      matches themselves are never targets for FKs from Video Analysis per the read-only principle).
--
-- The legacy public.video_analysis table (client-generated text id, no match_id, free-text fields,
-- 0 real rows) is intentionally left untouched here; it will be deprecated in Phase 1 once its
-- replacement is built.

create extension if not exists pgcrypto;

create table if not exists public.opponent_match_notes (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  opponent_team_id text not null references public.auth_teams(id) on delete restrict,
  notes text not null default '',
  created_by uuid references public.user_profiles(user_id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists opponent_match_notes_match_id_unique
  on public.opponent_match_notes (match_id);

create index if not exists opponent_match_notes_opponent_team_id_idx
  on public.opponent_match_notes (opponent_team_id);

create table if not exists public.video_clips (
  id uuid primary key default gen_random_uuid(),
  video_url text not null,
  start_time integer not null default 0 check (start_time >= 0),
  end_time integer check (end_time is null or end_time >= start_time),
  title text not null default '',
  notes text,
  created_by uuid references public.user_profiles(user_id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  -- One explicit nullable FK per Video Analysis branch (no polymorphic entry_type/entry_id).
  match_analysis_id uuid,
  opponent_match_notes_id uuid references public.opponent_match_notes(id) on delete cascade,
  training_analysis_id uuid,
  scouting_report_id uuid,
  constraint video_clips_single_owner check (
    (case when match_analysis_id is not null then 1 else 0 end)
    + (case when opponent_match_notes_id is not null then 1 else 0 end)
    + (case when training_analysis_id is not null then 1 else 0 end)
    + (case when scouting_report_id is not null then 1 else 0 end) <= 1
  )
);

create index if not exists video_clips_match_analysis_id_idx on public.video_clips (match_analysis_id);
create index if not exists video_clips_opponent_match_notes_id_idx on public.video_clips (opponent_match_notes_id);
create index if not exists video_clips_training_analysis_id_idx on public.video_clips (training_analysis_id);
create index if not exists video_clips_scouting_report_id_idx on public.video_clips (scouting_report_id);

alter table public.opponent_match_notes enable row level security;
alter table public.video_clips enable row level security;

drop policy if exists opponent_match_notes_read_video on public.opponent_match_notes;
drop policy if exists opponent_match_notes_write_video on public.opponent_match_notes;

create policy opponent_match_notes_read_video
  on public.opponent_match_notes for select to authenticated
  using (
    public.user_has_section_access('video')
    and exists (
      select 1
      from public.matches match_row
      where match_row.id = opponent_match_notes.match_id
        and public.user_has_team_membership(match_row.team_id)
    )
  );

create policy opponent_match_notes_write_video
  on public.opponent_match_notes for all to authenticated
  using (
    public.user_has_section_access('video')
    and exists (
      select 1
      from public.matches match_row
      where match_row.id = opponent_match_notes.match_id
        and public.user_has_team_membership(match_row.team_id)
    )
  )
  with check (
    public.user_has_section_access('video')
    and exists (
      select 1
      from public.matches match_row
      where match_row.id = opponent_match_notes.match_id
        and public.user_has_team_membership(match_row.team_id)
    )
  );

-- video_clips is section-only (no team scoping), matching the existing video_analysis policy shape.
drop policy if exists video_clips_section_video on public.video_clips;

create policy video_clips_section_video
  on public.video_clips for all to authenticated
  using (public.user_has_section_access('video'))
  with check (public.user_has_section_access('video'));

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'opponent_match_notes'
  ) then
    execute 'alter publication supabase_realtime add table public.opponent_match_notes';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'video_clips'
  ) then
    execute 'alter publication supabase_realtime add table public.video_clips';
  end if;
end $$;
