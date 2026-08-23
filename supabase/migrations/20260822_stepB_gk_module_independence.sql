-- Step B - Goalkeepers (GK) module independence schema/backfill (additive migration)
-- Date: 2026-08-22
-- Safety goals:
-- 1) Preserve legacy sessions table and fields
-- 2) Preserve fitness_sessions table and fields
-- 3) Add independent Goalkeeper (GK) session storage (public.gk_sessions)
-- 4) Guarantee full CRUD and Realtime for GK without dependencies on football sessions

begin;

-- -----------------------------------------------------------------------------
-- 1) Session catalog (canonical link layer) - ensure table and indexes exist
-- -----------------------------------------------------------------------------
create table if not exists public.session_catalog (
  session_uid text primary key,
  session_number text not null,
  session_date text,
  source_legacy_session_id text unique,
  created_at bigint not null,
  updated_at bigint not null
);

create index if not exists session_catalog_session_number_idx
  on public.session_catalog (session_number);

create index if not exists session_catalog_session_date_idx
  on public.session_catalog (session_date);

alter table public.session_catalog enable row level security;

-- -----------------------------------------------------------------------------
-- 2) Independent Goalkeeper sessions table (public.gk_sessions)
-- -----------------------------------------------------------------------------
create table if not exists public.gk_sessions (
  id text primary key,
  session_uid text not null references public.session_catalog(session_uid) on delete cascade,
  legacy_session_id text,
  team_name text not null,
  date text not null,
  time text not null,
  session_number text not null,
  microcycle_day text not null,
  main_objective text not null default '',
  materials_needed text not null default '',
  observations text,
  squad_roster jsonb not null default '[]'::jsonb,
  attendance jsonb not null default '[]'::jsonb,
  warm_up jsonb,
  main_part jsonb,
  cool_down jsonb,
  player_groups jsonb,
  created_at bigint not null,
  updated_at bigint not null,
  unique (session_uid)
);

create index if not exists gk_sessions_updated_at_idx
  on public.gk_sessions (updated_at desc);

create index if not exists gk_sessions_session_number_idx
  on public.gk_sessions (session_number);

create index if not exists gk_sessions_date_idx
  on public.gk_sessions (date);

alter table public.gk_sessions enable row level security;

drop policy if exists gk_sessions_section_gk on public.gk_sessions;
create policy gk_sessions_section_gk
  on public.gk_sessions
  for all
  to authenticated
  using (
    public.user_has_section_access('gk')
    or public.has_section_access('gk')
  )
  with check (
    public.user_has_section_access('gk')
    or public.has_section_access('gk')
  );

-- -----------------------------------------------------------------------------
-- 3) Backfill historical GK sessions from legacy sessions (only sessions with GK content)
-- -----------------------------------------------------------------------------
insert into public.session_catalog (
  session_uid,
  session_number,
  session_date,
  source_legacy_session_id,
  created_at,
  updated_at
)
select
  s.id,
  coalesce(s.session_number, ''),
  s.date,
  s.id,
  coalesce(s.updated_at, (extract(epoch from now()) * 1000)::bigint),
  coalesce(s.updated_at, (extract(epoch from now()) * 1000)::bigint)
from public.sessions s
where
  s.gk_updated_at is not null
  or (s.gk_warm_up is not null and s.gk_warm_up != 'null'::jsonb and s.gk_warm_up != '{}'::jsonb)
  or (s.gk_main_part is not null and s.gk_main_part != 'null'::jsonb and s.gk_main_part != '{}'::jsonb)
  or (s.gk_cool_down is not null and s.gk_cool_down != 'null'::jsonb and s.gk_cool_down != '{}'::jsonb)
  or (s.gk_player_groups is not null and s.gk_player_groups != 'null'::jsonb and s.gk_player_groups != '[]'::jsonb and s.gk_player_groups != '{}'::jsonb)
on conflict (session_uid) do update
set
  session_number = excluded.session_number,
  session_date = excluded.session_date,
  updated_at = greatest(public.session_catalog.updated_at, excluded.updated_at);

insert into public.gk_sessions (
  id,
  session_uid,
  legacy_session_id,
  team_name,
  date,
  time,
  session_number,
  microcycle_day,
  main_objective,
  materials_needed,
  observations,
  squad_roster,
  attendance,
  warm_up,
  main_part,
  cool_down,
  player_groups,
  created_at,
  updated_at
)
select
  'gk-' || s.id,
  s.id,
  s.id,
  coalesce(s.team_name, 'U17 Women Al Ula'),
  coalesce(s.date, to_char(now(), 'YYYY-MM-DD')),
  coalesce(s.time, '18:30 - 20:00'),
  coalesce(s.session_number, ''),
  coalesce(s.microcycle_day, 'MD-3'),
  coalesce(s.main_objective, ''),
  coalesce(s.materials_needed, ''),
  s.observations,
  coalesce(s.squad_roster, '[]'::jsonb),
  coalesce(s.attendance, '[]'::jsonb),
  s.gk_warm_up,
  s.gk_main_part,
  s.gk_cool_down,
  s.gk_player_groups,
  coalesce(s.gk_updated_at, s.updated_at, (extract(epoch from now()) * 1000)::bigint),
  coalesce(s.gk_updated_at, s.updated_at, (extract(epoch from now()) * 1000)::bigint)
from public.sessions s
where
  s.gk_updated_at is not null
  or (s.gk_warm_up is not null and s.gk_warm_up != 'null'::jsonb and s.gk_warm_up != '{}'::jsonb)
  or (s.gk_main_part is not null and s.gk_main_part != 'null'::jsonb and s.gk_main_part != '{}'::jsonb)
  or (s.gk_cool_down is not null and s.gk_cool_down != 'null'::jsonb and s.gk_cool_down != '{}'::jsonb)
  or (s.gk_player_groups is not null and s.gk_player_groups != 'null'::jsonb and s.gk_player_groups != '[]'::jsonb and s.gk_player_groups != '{}'::jsonb)
on conflict (id) do update
set
  session_uid = excluded.session_uid,
  legacy_session_id = excluded.legacy_session_id,
  team_name = excluded.team_name,
  date = excluded.date,
  time = excluded.time,
  session_number = excluded.session_number,
  microcycle_day = excluded.microcycle_day,
  main_objective = excluded.main_objective,
  materials_needed = excluded.materials_needed,
  observations = excluded.observations,
  squad_roster = excluded.squad_roster,
  attendance = excluded.attendance,
  warm_up = excluded.warm_up,
  main_part = excluded.main_part,
  cool_down = excluded.cool_down,
  player_groups = excluded.player_groups,
  updated_at = greatest(public.gk_sessions.updated_at, excluded.updated_at);

commit;
