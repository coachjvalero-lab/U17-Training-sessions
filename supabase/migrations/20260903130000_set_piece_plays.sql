-- Saved Set Piece plays: a reusable tactical-board playbook per match (corners, free kicks, etc.)
-- Distinct from public.match_set_pieces (a single free-text attacking/defensive notes row per match).

create table if not exists public.set_piece_plays (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  title text not null default '',
  type text not null default 'other'
    check (type in ('corner', 'defensive_corner', 'attacking_free_kick', 'defensive_free_kick', 'throw_in', 'kick_off', 'other')),
  diagram jsonb not null default '{"markers":[],"arrows":[],"zones":[],"texts":[]}'::jsonb,
  description text not null default '',
  coaching_points text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists set_piece_plays_match_id_idx on public.set_piece_plays (match_id);

alter table public.set_piece_plays enable row level security;

drop policy if exists set_piece_plays_read_football on public.set_piece_plays;
drop policy if exists set_piece_plays_write_football on public.set_piece_plays;

create policy set_piece_plays_read_football
  on public.set_piece_plays for select to authenticated
  using (exists (
    select 1 from public.matches match_row
    where match_row.id = set_piece_plays.match_id
      and public.can_access_football_team(match_row.team_id)
  ));

create policy set_piece_plays_write_football
  on public.set_piece_plays for all to authenticated
  using (exists (
    select 1 from public.matches match_row
    where match_row.id = set_piece_plays.match_id
      and public.can_access_football_team(match_row.team_id)
  ))
  with check (exists (
    select 1 from public.matches match_row
    where match_row.id = set_piece_plays.match_id
      and public.can_access_football_team(match_row.team_id)
  ));

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'set_piece_plays'
  ) then
    execute 'alter publication supabase_realtime add table public.set_piece_plays';
  end if;
end $$;

