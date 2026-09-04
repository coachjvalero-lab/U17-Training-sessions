-- Video Analysis follow-up round: clip categories (Matches + Scouting) and Match Report team analyzed.
--
-- 1) video_clips.category: a single free-text column (NOT a Postgres enum, NOT a separate tags
--    table) because video_clips is shared across all 4 Video Analysis areas and Matches vs
--    Scouting use two different, unrelated taxonomies (offensive/defensive organization... vs
--    technical/tactical/physical/mental/strengths/weaknesses). A rigid enum would force the two
--    taxonomies to share one type; a separate tags table would be overkill for a single value per
--    clip. The taxonomy itself is enforced client-side per tab (a plain dropdown), not in the DB.
alter table public.video_clips
  add column if not exists category text;

-- 2) match_analysis: allow analyzing either "our team" or a specific opponent team for the same
--    match, so the same Match Report form/table serves both own-match review and opponent
--    scouting sourced from that match's footage, without duplicating the table or screen.
alter table public.match_analysis
  add column if not exists analyzed_team_id text references public.auth_teams(id) on delete restrict;

-- Backfill existing rows as "own team" analysis (the only kind that existed before this column).
update public.match_analysis ma
set analyzed_team_id = m.team_id
from public.matches m
where m.id = ma.match_id
  and ma.analyzed_team_id is null;

alter table public.match_analysis
  alter column analyzed_team_id set not null;

alter table public.match_analysis
  drop constraint if exists match_analysis_match_id_key;

create unique index if not exists match_analysis_match_id_analyzed_team_id_unique
  on public.match_analysis (match_id, analyzed_team_id);
