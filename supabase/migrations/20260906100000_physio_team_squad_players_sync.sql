-- Fix: creating an Injury failed with 23503 on constraint injuries_team_player_fkey
--   FOREIGN KEY (team_id, player_id) REFERENCES public.team_squad_players(team_id, player_id)
--   DETAIL: Key is not present in table "team_squad_players".
--
-- Root cause: public.team_squad_players was populated ONCE by the hardcoded VALUES list in
-- 20260817120000_physio_clinical_module.sql (23 player ids). Nothing keeps it in sync, so every
-- player added to public.squad_players afterwards has no (team_id, player_id) link row. The Physio
-- injury form lists players from squad_players (getPhysioContext primes the map from
-- listSquadPlayers and only merges physio_player_context afterwards), so those newer players are
-- selectable but can never satisfy the composite FK.
-- The application-side self-heal (ensurePhysioTeamPrerequisites -> upsert on team_squad_players)
-- cannot work either: role `authenticated` only holds SELECT on that table.
--
-- This does not weaken any constraint, does not touch RLS/grants, and does not touch the Matches
-- model. It only makes the referenced link rows exist, at the source.

-- 1) Backfill the missing links. The squad is owned by U17 Women Al Ula, as already established by
--    the original physio migration.
insert into public.team_squad_players (team_id, player_id)
select 'u17-women-alula', sp.id
from public.squad_players sp
on conflict (team_id, player_id) do nothing;

-- 2) Keep the link in sync for players added from now on (deletes are already handled by the
--    existing ON DELETE CASCADE from squad_players). SECURITY DEFINER so it works for the
--    `authenticated` role, which intentionally has no write grant on team_squad_players.
create or replace function public.squad_player_link_default_team()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.team_squad_players (team_id, player_id)
  values ('u17-women-alula', new.id)
  on conflict (team_id, player_id) do nothing;
  return new;
end;
$$;

drop trigger if exists squad_players_link_default_team on public.squad_players;
create trigger squad_players_link_default_team
after insert on public.squad_players
for each row execute function public.squad_player_link_default_team();
