-- Video Analysis module - "Training Sessions" area (Phase 4). Football-only (src/supabaseSessions.ts
-- public.sessions); fitness_sessions/gk_sessions are explicitly out of scope for this area.
-- Video Analysis reads public.sessions but never writes to it; this only adds its own per-session
-- analysis record plus the real FK on video_clips.training_analysis_id left pending in Phase 0.
--
-- FK target note: public.session_catalog (used by fitness_sessions/gk_sessions) is NOT used here.
-- Verified live that session_catalog only reflects a one-time historical backfill from
-- public.sessions and has since drifted out of sync (5 of 29 current football sessions have no
-- session_catalog row) -- FKing there would break for any newer session. public.sessions(id) is
-- the football session's own authoritative, always-present identifier, so the FK targets it
-- directly; the column is still named session_uid to match the "session identifier" terminology
-- used elsewhere in the repo.

create extension if not exists pgcrypto;

create table if not exists public.training_analysis (
  id uuid primary key default gen_random_uuid(),
  session_uid text not null unique references public.sessions(id) on delete cascade,
  summary text not null default '',
  created_by uuid references public.user_profiles(user_id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.video_clips
  add constraint video_clips_training_analysis_id_fkey
  foreign key (training_analysis_id) references public.training_analysis(id) on delete cascade;

alter table public.training_analysis enable row level security;

drop policy if exists training_analysis_read_video on public.training_analysis;
drop policy if exists training_analysis_write_video on public.training_analysis;

-- public.sessions itself is section-only (no team scoping, see
-- 20260812_authorization_section_simplified_rls.sql's sessions_section_football policy), so
-- (unlike matches) there is no team-membership check to add here. The exists-subquery still
-- naturally requires the row to be visible under sessions' own RLS (football section access).
create policy training_analysis_read_video
  on public.training_analysis for select to authenticated
  using (
    public.user_has_section_access('video')
    and exists (
      select 1
      from public.sessions session_row
      where session_row.id = training_analysis.session_uid
    )
  );

create policy training_analysis_write_video
  on public.training_analysis for all to authenticated
  using (
    public.user_has_section_access('video')
    and exists (
      select 1
      from public.sessions session_row
      where session_row.id = training_analysis.session_uid
    )
  )
  with check (
    public.user_has_section_access('video')
    and exists (
      select 1
      from public.sessions session_row
      where session_row.id = training_analysis.session_uid
    )
  );

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'training_analysis'
  ) then
    execute 'alter publication supabase_realtime add table public.training_analysis';
  end if;
end $$;
