-- Video Analysis module - AI engine findings (single reusable entity for the three analysis
-- contexts: my_analysis, opponent_analysis, scouting).
--
-- An AI finding is a PROPOSAL, never a validated conclusion: it starts as review_status
-- 'pending' and only becomes part of the analyst's work once confirmed/edited. Rejected
-- findings are kept so the same video is not re-proposed blindly.
--
-- Ownership follows the exact same "one explicit nullable FK per branch" pattern already used by
-- public.video_clips (Phase 0) instead of a polymorphic entry_type/entry_id pair. No Match Events
-- are duplicated here: a finding (and the clip generated from it) can REFERENCE an existing
-- public.match_events row through video_clips.match_event_id.

create extension if not exists pgcrypto;

create table if not exists public.video_ai_findings (
  id uuid primary key default gen_random_uuid(),
  context text not null check (context in ('my_analysis', 'opponent_analysis', 'scouting')),
  -- Owner analysis (exactly one, mirroring video_clips_single_owner).
  match_analysis_id uuid references public.match_analysis(id) on delete cascade,
  opponent_analysis_id uuid references public.opponent_analysis(id) on delete cascade,
  training_analysis_id uuid references public.training_analysis(id) on delete cascade,
  scouting_report_id uuid references public.scouting_player_reports(id) on delete cascade,
  -- Taxonomy value reused from the existing Video Analysis clip categories / opponent tags.
  category text,
  title text not null default '',
  observation text not null default '',
  suggested_tags text[] not null default '{}'::text[],
  confidence numeric(3, 2) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  review_status text not null default 'pending'
    check (review_status in ('pending', 'confirmed', 'rejected', 'edited')),
  -- Evidence window inside the analysed video, before/independently of clip creation.
  video_url text,
  -- Second where the action actually happens; start/end_time are the clip window around it.
  timestamp_seconds integer check (timestamp_seconds is null or timestamp_seconds >= 0),
  start_time integer check (start_time is null or start_time >= 0),
  end_time integer check (end_time is null or start_time is null or end_time >= start_time),
  model text,
  created_by uuid references public.user_profiles(user_id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint video_ai_findings_single_owner check (
    (case when match_analysis_id is not null then 1 else 0 end)
    + (case when opponent_analysis_id is not null then 1 else 0 end)
    + (case when training_analysis_id is not null then 1 else 0 end)
    + (case when scouting_report_id is not null then 1 else 0 end) = 1
  )
);

create index if not exists video_ai_findings_match_analysis_id_idx on public.video_ai_findings (match_analysis_id);
create index if not exists video_ai_findings_opponent_analysis_id_idx on public.video_ai_findings (opponent_analysis_id);
create index if not exists video_ai_findings_training_analysis_id_idx on public.video_ai_findings (training_analysis_id);
create index if not exists video_ai_findings_scouting_report_id_idx on public.video_ai_findings (scouting_report_id);
create index if not exists video_ai_findings_review_status_idx on public.video_ai_findings (review_status);

-- Evidence link: a clip created from a finding, and (optionally) the already existing Match Event
-- it corresponds to. match_events stays owned by Match; this is a reference, not a copy.
alter table public.video_clips
  add column if not exists ai_finding_id uuid references public.video_ai_findings(id) on delete set null;

alter table public.video_clips
  add column if not exists match_event_id uuid references public.match_events(id) on delete set null;

-- Fifth clip owner: the per-opponent master record used by the Opponent Analysis tab
-- (public.opponent_analysis), which previously had no way to own clips.
alter table public.video_clips
  add column if not exists opponent_analysis_id uuid references public.opponent_analysis(id) on delete cascade;

alter table public.video_clips drop constraint if exists video_clips_single_owner;
alter table public.video_clips add constraint video_clips_single_owner check (
  (case when match_analysis_id is not null then 1 else 0 end)
  + (case when opponent_match_notes_id is not null then 1 else 0 end)
  + (case when opponent_analysis_id is not null then 1 else 0 end)
  + (case when training_analysis_id is not null then 1 else 0 end)
  + (case when scouting_report_id is not null then 1 else 0 end) <= 1
);

create index if not exists video_clips_ai_finding_id_idx on public.video_clips (ai_finding_id);
create index if not exists video_clips_match_event_id_idx on public.video_clips (match_event_id);
create index if not exists video_clips_opponent_analysis_id_idx on public.video_clips (opponent_analysis_id);

-- A confirmed finding produces exactly one clip; re-confirming can never duplicate it.
create unique index if not exists video_clips_ai_finding_id_unique
  on public.video_clips (ai_finding_id)
  where ai_finding_id is not null;

alter table public.video_ai_findings enable row level security;

-- Section-only, matching the existing video_clips_section_video policy shape.
drop policy if exists video_ai_findings_section_video on public.video_ai_findings;
create policy video_ai_findings_section_video
  on public.video_ai_findings for all to authenticated
  using (public.user_has_section_access('video'))
  with check (public.user_has_section_access('video'));

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'video_ai_findings'
  ) then
    execute 'alter publication supabase_realtime add table public.video_ai_findings';
  end if;
end $$;
