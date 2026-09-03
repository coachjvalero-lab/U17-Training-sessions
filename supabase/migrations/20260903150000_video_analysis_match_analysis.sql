-- Video Analysis module - "Matches" area (Phase 2).
-- Video Analysis reads public.matches but never writes to it; this only adds its own
-- per-match analysis record plus the real FK on video_clips.match_analysis_id that was
-- left pending in Phase 0 (the target table didn't exist yet).

create extension if not exists pgcrypto;

create table if not exists public.match_analysis (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null unique references public.matches(id) on delete cascade,
  summary text not null default '',
  created_by uuid references public.user_profiles(user_id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.video_clips
  add constraint video_clips_match_analysis_id_fkey
  foreign key (match_analysis_id) references public.match_analysis(id) on delete cascade;

alter table public.match_analysis enable row level security;

drop policy if exists match_analysis_read_video on public.match_analysis;
drop policy if exists match_analysis_write_video on public.match_analysis;

create policy match_analysis_read_video
  on public.match_analysis for select to authenticated
  using (
    public.user_has_section_access('video')
    and exists (
      select 1
      from public.matches match_row
      where match_row.id = match_analysis.match_id
        and public.user_has_team_membership(match_row.team_id)
    )
  );

create policy match_analysis_write_video
  on public.match_analysis for all to authenticated
  using (
    public.user_has_section_access('video')
    and exists (
      select 1
      from public.matches match_row
      where match_row.id = match_analysis.match_id
        and public.user_has_team_membership(match_row.team_id)
    )
  )
  with check (
    public.user_has_section_access('video')
    and exists (
      select 1
      from public.matches match_row
      where match_row.id = match_analysis.match_id
        and public.user_has_team_membership(match_row.team_id)
    )
  );

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'match_analysis'
  ) then
    execute 'alter publication supabase_realtime add table public.match_analysis';
  end if;
end $$;
