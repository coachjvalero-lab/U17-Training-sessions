-- Align Match Centre with the canonical section-only authorization model while
-- preserving team membership scope. Admin access remains in is_admin_user().

create or replace function public.can_access_football_team(team_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.user_has_section_access('football')
    and public.user_has_team_membership(team_key)
$$;

revoke all on function public.can_access_football_team(text) from public;
grant execute on function public.can_access_football_team(text) to authenticated;

alter table public.matches enable row level security;
drop policy if exists matches_read_football on public.matches;
drop policy if exists matches_write_football on public.matches;
create policy matches_read_football
  on public.matches for select to authenticated
  using (public.can_access_football_team(team_id));
create policy matches_write_football
  on public.matches for all to authenticated
  using (public.can_access_football_team(team_id))
  with check (public.can_access_football_team(team_id));

alter table public.opponent_analysis enable row level security;
drop policy if exists opponent_analysis_read_football on public.opponent_analysis;
drop policy if exists opponent_analysis_write_football on public.opponent_analysis;
create policy opponent_analysis_read_football
  on public.opponent_analysis for select to authenticated
  using (exists (
    select 1 from public.matches match_row
    where match_row.id = opponent_analysis.match_id
      and public.can_access_football_team(match_row.team_id)
  ));
create policy opponent_analysis_write_football
  on public.opponent_analysis for all to authenticated
  using (exists (
    select 1 from public.matches match_row
    where match_row.id = opponent_analysis.match_id
      and public.can_access_football_team(match_row.team_id)
  ))
  with check (exists (
    select 1 from public.matches match_row
    where match_row.id = opponent_analysis.match_id
      and public.can_access_football_team(match_row.team_id)
  ));

alter table public.match_lineup_entries enable row level security;
drop policy if exists match_lineup_entries_read_football on public.match_lineup_entries;
drop policy if exists match_lineup_entries_write_football on public.match_lineup_entries;
create policy match_lineup_entries_read_football
  on public.match_lineup_entries for select to authenticated
  using (exists (
    select 1 from public.matches match_row
    where match_row.id = match_lineup_entries.match_id
      and public.can_access_football_team(match_row.team_id)
  ));
create policy match_lineup_entries_write_football
  on public.match_lineup_entries for all to authenticated
  using (exists (
    select 1 from public.matches match_row
    where match_row.id = match_lineup_entries.match_id
      and public.can_access_football_team(match_row.team_id)
  ))
  with check (exists (
    select 1 from public.matches match_row
    where match_row.id = match_lineup_entries.match_id
      and public.can_access_football_team(match_row.team_id)
  ));

alter table public.match_events enable row level security;
drop policy if exists match_events_read_football on public.match_events;
drop policy if exists match_events_write_football on public.match_events;
create policy match_events_read_football
  on public.match_events for select to authenticated
  using (exists (
    select 1 from public.matches match_row
    where match_row.id = match_events.match_id
      and public.can_access_football_team(match_row.team_id)
  ));
create policy match_events_write_football
  on public.match_events for all to authenticated
  using (exists (
    select 1 from public.matches match_row
    where match_row.id = match_events.match_id
      and public.can_access_football_team(match_row.team_id)
  ))
  with check (exists (
    select 1 from public.matches match_row
    where match_row.id = match_events.match_id
      and public.can_access_football_team(match_row.team_id)
  ));

alter table public.player_match_statistics enable row level security;
drop policy if exists player_match_statistics_read_football on public.player_match_statistics;
drop policy if exists player_match_statistics_write_football on public.player_match_statistics;
create policy player_match_statistics_read_football
  on public.player_match_statistics for select to authenticated
  using (exists (
    select 1 from public.matches match_row
    where match_row.id = player_match_statistics.match_id
      and public.can_access_football_team(match_row.team_id)
  ));
create policy player_match_statistics_write_football
  on public.player_match_statistics for all to authenticated
  using (exists (
    select 1 from public.matches match_row
    where match_row.id = player_match_statistics.match_id
      and public.can_access_football_team(match_row.team_id)
  ))
  with check (exists (
    select 1 from public.matches match_row
    where match_row.id = player_match_statistics.match_id
      and public.can_access_football_team(match_row.team_id)
  ));

alter table public.match_plan enable row level security;
drop policy if exists match_plan_read_football on public.match_plan;
drop policy if exists match_plan_write_football on public.match_plan;
create policy match_plan_read_football
  on public.match_plan for select to authenticated
  using (exists (
    select 1 from public.matches match_row
    where match_row.id = match_plan.match_id
      and public.can_access_football_team(match_row.team_id)
  ));
create policy match_plan_write_football
  on public.match_plan for all to authenticated
  using (exists (
    select 1 from public.matches match_row
    where match_row.id = match_plan.match_id
      and public.can_access_football_team(match_row.team_id)
  ))
  with check (exists (
    select 1 from public.matches match_row
    where match_row.id = match_plan.match_id
      and public.can_access_football_team(match_row.team_id)
  ));

alter table public.match_set_pieces enable row level security;
drop policy if exists match_set_pieces_read_football on public.match_set_pieces;
drop policy if exists match_set_pieces_write_football on public.match_set_pieces;
create policy match_set_pieces_read_football
  on public.match_set_pieces for select to authenticated
  using (exists (
    select 1 from public.matches match_row
    where match_row.id = match_set_pieces.match_id
      and public.can_access_football_team(match_row.team_id)
  ));
create policy match_set_pieces_write_football
  on public.match_set_pieces for all to authenticated
  using (exists (
    select 1 from public.matches match_row
    where match_row.id = match_set_pieces.match_id
      and public.can_access_football_team(match_row.team_id)
  ))
  with check (exists (
    select 1 from public.matches match_row
    where match_row.id = match_set_pieces.match_id
      and public.can_access_football_team(match_row.team_id)
  ));