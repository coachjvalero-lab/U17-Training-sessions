-- Physio clinical module: fix match context validation and projection.
--
-- The Match Centre model stores a match as (team_id, opponent_team_id, is_home);
-- there are no home_team_id/away_team_id columns. A match therefore "belongs" to
-- the Physio team when that team plays it as the home OR the away side, i.e. when
-- the team is either matches.team_id or matches.opponent_team_id.
--
-- Two defects are fixed here, both scoped to Physio only (the matches model and
-- its RLS policies are untouched):
--   1. public.physio_validate_context_team() required matches.team_id = new.team_id
--      AND ran with invoker rights, so `public.matches` was filtered by its own
--      football-only RLS (can_access_football_team). For a Physio user the match
--      row was invisible, the EXISTS returned false and every match-context injury
--      or complaint failed with "Match does not belong to the clinical record team."
--   2. public.physio_match_context() projected only matches.team_id matches and
--      exposed no home/away information.
--
-- The clinical record keeps storing its own team_id; the opponent never becomes
-- the clinical team.

create or replace function public.physio_validate_context_team()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.context = 'training' and not exists (
    select 1
    from public.sessions session
    join public.auth_teams team on team.id = new.team_id
    where session.id = new.training_session_id
      and lower(trim(session.team_name)) in (lower(trim(team.id)), lower(trim(team.name)))
  ) then
    raise exception 'Training session does not belong to the clinical record team.' using errcode = '23514';
  end if;

  if new.context = 'match' and not exists (
    select 1
    from public.matches match
    where match.id = new.match_id
      and trim(new.team_id) in (match.team_id, match.opponent_team_id)
  ) then
    raise exception 'Match does not belong to the clinical record team.' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop function if exists public.physio_match_context(text);
create function public.physio_match_context(target_team_id text)
returns table (
  match_id uuid,
  match_date text,
  opponent_name text,
  match_status text,
  home_team_id text,
  away_team_id text,
  is_home boolean
)
language sql stable security definer set search_path = public as $$
  select
    match.id,
    match.date,
    coalesce(other.name, other.id, 'Match'),
    match.status,
    case when match.is_home then match.team_id else match.opponent_team_id end,
    case when match.is_home then match.opponent_team_id else match.team_id end,
    case when match.team_id = trim(target_team_id) then match.is_home else not match.is_home end
  from public.matches match
  left join public.auth_teams other
    on other.id = case
      when match.team_id = trim(target_team_id) then match.opponent_team_id
      else match.team_id
    end
  where trim(target_team_id) in (match.team_id, match.opponent_team_id)
    and public.can_access_physio_team(trim(target_team_id))
  order by match.date desc;
$$;

revoke all on function public.physio_match_context(text) from public;
grant execute on function public.physio_match_context(text) to authenticated;
