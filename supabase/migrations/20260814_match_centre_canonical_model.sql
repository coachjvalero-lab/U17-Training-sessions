-- U17 Training Sessions - Match Centre canonical model
-- This phase introduces a canonical match data model without removing or altering the legacy competition fixture system.

create extension if not exists pgcrypto;

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  team_id text not null references public.auth_teams(id) on delete restrict,
  opponent_team_id text not null references public.auth_teams(id) on delete restrict,
  fixture_id text null references public.competition_fixtures(id) on delete set null,
  competition_name text not null default '',
  date text not null,
  time text not null default '18:30',
  venue text,
  location text,
  is_home boolean not null default true,
  status text not null default 'planned' check (status in ('planned', 'played')),
  our_score integer,
  opponent_score integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists matches_fixture_id_unique
  on public.matches (fixture_id)
  where fixture_id is not null;

create index if not exists matches_team_id_idx on public.matches (team_id);
create index if not exists matches_opponent_team_id_idx on public.matches (opponent_team_id);
create index if not exists matches_date_idx on public.matches (date desc);
create index if not exists matches_status_idx on public.matches (status);

create table if not exists public.opponent_analysis (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null unique references public.matches(id) on delete cascade,
  opponent_team_id text not null references public.auth_teams(id) on delete restrict,
  tags text[] not null default '{}'::text[],
  slides_url text,
  video_url text,
  summary text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists opponent_analysis_opponent_team_id_idx on public.opponent_analysis (opponent_team_id);
create index if not exists opponent_analysis_updated_at_idx on public.opponent_analysis (updated_at desc);

create table if not exists public.match_lineup_entries (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  player_id text not null references public.squad_players(id) on delete restrict,
  position text not null default '',
  starter boolean not null default false,
  shirt_number integer,
  captain boolean not null default false,
  minute_subbed_in integer,
  minute_subbed_out integer,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists match_lineup_entries_match_player_unique
  on public.match_lineup_entries (match_id, player_id);

create index if not exists match_lineup_entries_match_id_idx on public.match_lineup_entries (match_id);
create index if not exists match_lineup_entries_player_id_idx on public.match_lineup_entries (player_id);

create table if not exists public.match_events (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  player_id text null references public.squad_players(id) on delete set null,
  team_side text not null default 'our_team' check (team_side in ('our_team', 'opponent')),
  event_type text not null check (event_type in ('goal', 'assist', 'yellow_card', 'red_card', 'substitution_in', 'substitution_out', 'own_goal', 'injury', 'other')),
  minute integer not null default 0,
  related_player_id text null references public.squad_players(id) on delete set null,
  description text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists match_events_match_id_idx on public.match_events (match_id);
create index if not exists match_events_player_id_idx on public.match_events (player_id);
create index if not exists match_events_minute_idx on public.match_events (minute);

create table if not exists public.player_match_statistics (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  player_id text not null references public.squad_players(id) on delete restrict,
  minutes_played integer not null default 0,
  starts boolean not null default false,
  goals integer not null default 0,
  assists integer not null default 0,
  yellow_cards integer not null default 0,
  red_cards integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists player_match_statistics_match_player_unique
  on public.player_match_statistics (match_id, player_id);

create index if not exists player_match_statistics_match_id_idx on public.player_match_statistics (match_id);
create index if not exists player_match_statistics_player_id_idx on public.player_match_statistics (player_id);

alter table if exists public.matches enable row level security;
alter table if exists public.opponent_analysis enable row level security;
alter table if exists public.match_lineup_entries enable row level security;
alter table if exists public.match_events enable row level security;
alter table if exists public.player_match_statistics enable row level security;

drop policy if exists matches_read_football on public.matches;
drop policy if exists matches_write_football on public.matches;
create policy matches_read_football
  on public.matches
  for select
  to authenticated
  using (
    public.has_section_access('football')
    and public.user_has_team_membership(team_id)
  );

create policy matches_write_football
  on public.matches
  for all
  to authenticated
  using (
    public.has_section_access('football')
    and public.user_has_team_membership(team_id)
  )
  with check (
    public.has_section_access('football')
    and public.user_has_team_membership(team_id)
  );

drop policy if exists opponent_analysis_read_football on public.opponent_analysis;
drop policy if exists opponent_analysis_write_football on public.opponent_analysis;
create policy opponent_analysis_read_football
  on public.opponent_analysis
  for select
  to authenticated
  using (
    public.has_section_access('football')
    and exists (
      select 1
      from public.matches m
      where m.id = opponent_analysis.match_id
        and public.user_has_team_membership(m.team_id)
    )
  );

create policy opponent_analysis_write_football
  on public.opponent_analysis
  for all
  to authenticated
  using (
    public.has_section_access('football')
    and exists (
      select 1
      from public.matches m
      where m.id = opponent_analysis.match_id
        and public.user_has_team_membership(m.team_id)
    )
  )
  with check (
    public.has_section_access('football')
    and exists (
      select 1
      from public.matches m
      where m.id = opponent_analysis.match_id
        and public.user_has_team_membership(m.team_id)
    )
  );

drop policy if exists match_lineup_entries_read_football on public.match_lineup_entries;
drop policy if exists match_lineup_entries_write_football on public.match_lineup_entries;
create policy match_lineup_entries_read_football
  on public.match_lineup_entries
  for select
  to authenticated
  using (
    public.has_section_access('football')
    and exists (
      select 1
      from public.matches m
      where m.id = match_lineup_entries.match_id
        and public.user_has_team_membership(m.team_id)
    )
  );

create policy match_lineup_entries_write_football
  on public.match_lineup_entries
  for all
  to authenticated
  using (
    public.has_section_access('football')
    and exists (
      select 1
      from public.matches m
      where m.id = match_lineup_entries.match_id
        and public.user_has_team_membership(m.team_id)
    )
  )
  with check (
    public.has_section_access('football')
    and exists (
      select 1
      from public.matches m
      where m.id = match_lineup_entries.match_id
        and public.user_has_team_membership(m.team_id)
    )
  );

drop policy if exists match_events_read_football on public.match_events;
drop policy if exists match_events_write_football on public.match_events;
create policy match_events_read_football
  on public.match_events
  for select
  to authenticated
  using (
    public.has_section_access('football')
    and exists (
      select 1
      from public.matches m
      where m.id = match_events.match_id
        and public.user_has_team_membership(m.team_id)
    )
  );

create policy match_events_write_football
  on public.match_events
  for all
  to authenticated
  using (
    public.has_section_access('football')
    and exists (
      select 1
      from public.matches m
      where m.id = match_events.match_id
        and public.user_has_team_membership(m.team_id)
    )
  )
  with check (
    public.has_section_access('football')
    and exists (
      select 1
      from public.matches m
      where m.id = match_events.match_id
        and public.user_has_team_membership(m.team_id)
    )
  );

drop policy if exists player_match_statistics_read_football on public.player_match_statistics;
drop policy if exists player_match_statistics_write_football on public.player_match_statistics;
create policy player_match_statistics_read_football
  on public.player_match_statistics
  for select
  to authenticated
  using (
    public.has_section_access('football')
    and exists (
      select 1
      from public.matches m
      where m.id = player_match_statistics.match_id
        and public.user_has_team_membership(m.team_id)
    )
  );

create policy player_match_statistics_write_football
  on public.player_match_statistics
  for all
  to authenticated
  using (
    public.has_section_access('football')
    and exists (
      select 1
      from public.matches m
      where m.id = player_match_statistics.match_id
        and public.user_has_team_membership(m.team_id)
    )
  )
  with check (
    public.has_section_access('football')
    and exists (
      select 1
      from public.matches m
      where m.id = player_match_statistics.match_id
        and public.user_has_team_membership(m.team_id)
    )
  );
