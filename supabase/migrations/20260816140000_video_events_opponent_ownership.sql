-- Add video-synchronised match events and make scouting analysis opponent-owned.

alter table public.matches
  add column if not exists video_url text;

alter table public.match_events
  add column if not exists video_timestamp_seconds integer not null default 0
    check (video_timestamp_seconds >= 0);

create index if not exists match_events_video_timestamp_idx
  on public.match_events (match_id, video_timestamp_seconds);

drop policy if exists opponent_analysis_read_football on public.opponent_analysis;
drop policy if exists opponent_analysis_write_football on public.opponent_analysis;

alter table public.opponent_analysis
  drop constraint if exists opponent_analysis_match_id_key;

drop index if exists public.opponent_analysis_match_id_key;

alter table public.opponent_analysis
  drop column if exists match_id;

create unique index if not exists opponent_analysis_opponent_team_id_unique
  on public.opponent_analysis (opponent_team_id);

create policy opponent_analysis_read_football
  on public.opponent_analysis for select to authenticated
  using (exists (
    select 1
    from public.matches match_row
    where match_row.opponent_team_id = opponent_analysis.opponent_team_id
      and public.can_access_football_team(match_row.team_id)
  ));

create policy opponent_analysis_write_football
  on public.opponent_analysis for all to authenticated
  using (exists (
    select 1
    from public.matches match_row
    where match_row.opponent_team_id = opponent_analysis.opponent_team_id
      and public.can_access_football_team(match_row.team_id)
  ))
  with check (exists (
    select 1
    from public.matches match_row
    where match_row.opponent_team_id = opponent_analysis.opponent_team_id
      and public.can_access_football_team(match_row.team_id)
  ));