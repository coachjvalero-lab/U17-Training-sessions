-- Video Analysis module - Scouting: player observation reports (Phase 5c, final piece).
-- No existing 1-N rating convention found in the repo (only physio's 0-10 pain_score) so ratings
-- use a fresh 1-5 scale, nullable (a scout may only fill in the categories they observed).

create extension if not exists pgcrypto;

create table if not exists public.scouting_player_reports (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.scouting_players(id) on delete cascade,
  -- Nullable: a report can come from a scheduled trip or from a standalone video clip.
  trip_id uuid references public.scouting_trips(id) on delete set null,
  technical_rating smallint check (technical_rating between 1 and 5),
  tactical_rating smallint check (tactical_rating between 1 and 5),
  physical_rating smallint check (physical_rating between 1 and 5),
  mental_rating smallint check (mental_rating between 1 and 5),
  notes text not null default '',
  created_by uuid references public.user_profiles(user_id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists scouting_player_reports_player_id_idx on public.scouting_player_reports (player_id);
create index if not exists scouting_player_reports_trip_id_idx on public.scouting_player_reports (trip_id);

alter table public.video_clips
  add constraint video_clips_scouting_report_id_fkey
  foreign key (scouting_report_id) references public.scouting_player_reports(id) on delete cascade;

alter table public.scouting_player_reports enable row level security;

drop policy if exists scouting_player_reports_section_video on public.scouting_player_reports;
create policy scouting_player_reports_section_video
  on public.scouting_player_reports for all to authenticated
  using (public.user_has_section_access('video'))
  with check (public.user_has_section_access('video'));

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'scouting_player_reports'
  ) then
    execute 'alter publication supabase_realtime add table public.scouting_player_reports';
  end if;
end $$;
