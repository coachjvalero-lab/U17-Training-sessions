-- Step A1 - Fitness module independence schema/backfill (additive migration)
-- Date: 2026-08-11
-- Safety goals:
-- 1) Preserve legacy sessions table and fields
-- 2) Add independent fitness session storage
-- 3) Add nullable module ownership to exercise_library without dropping is_fitness
--
-- IMPORTANT:
-- - This migration intentionally does NOT classify exercise_library.module values.
-- - Exercise ownership classification is handled separately in Step A2 scripts.

begin;

-- -----------------------------------------------------------------------------
-- 1) Session catalog (canonical link layer)
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

drop policy if exists session_catalog_read_authenticated on public.session_catalog;
create policy session_catalog_read_authenticated
  on public.session_catalog
  for select
  to authenticated
  using (auth.uid() is not null);

drop policy if exists session_catalog_write_by_training_sections on public.session_catalog;
create policy session_catalog_write_by_training_sections
  on public.session_catalog
  for all
  to authenticated
  using (
    public.has_section_access('football')
    or public.has_section_access('fitness')
    or public.has_section_access('gk')
  )
  with check (
    public.has_section_access('football')
    or public.has_section_access('fitness')
    or public.has_section_access('gk')
  );

-- -----------------------------------------------------------------------------
-- 2) Independent fitness sessions table
-- -----------------------------------------------------------------------------
create table if not exists public.fitness_sessions (
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

create index if not exists fitness_sessions_updated_at_idx
  on public.fitness_sessions (updated_at desc);

create index if not exists fitness_sessions_session_number_idx
  on public.fitness_sessions (session_number);

create index if not exists fitness_sessions_date_idx
  on public.fitness_sessions (date);

alter table public.fitness_sessions enable row level security;

drop policy if exists fitness_sessions_read_fitness_only on public.fitness_sessions;
create policy fitness_sessions_read_fitness_only
  on public.fitness_sessions
  for select
  to authenticated
  using (public.has_section_access('fitness'));

drop policy if exists fitness_sessions_write_fitness_only on public.fitness_sessions;
create policy fitness_sessions_write_fitness_only
  on public.fitness_sessions
  for all
  to authenticated
  using (public.has_section_access('fitness'))
  with check (public.has_section_access('fitness'));

-- -----------------------------------------------------------------------------
-- 3) Exercise module ownership (additive)
-- -----------------------------------------------------------------------------
alter table public.exercise_library
  add column if not exists module text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'exercise_library_module_check'
      and conrelid = 'public.exercise_library'::regclass
  ) then
    alter table public.exercise_library
      add constraint exercise_library_module_check
      check (module is null or module in ('football', 'fitness', 'gk'));
  end if;
end $$;

create index if not exists exercise_library_module_idx
  on public.exercise_library (module);

-- -----------------------------------------------------------------------------
-- 4) Backfill new structures from legacy sessions (additive only)
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
on conflict (session_uid) do update
set
  session_number = excluded.session_number,
  session_date = excluded.session_date,
  updated_at = greatest(public.session_catalog.updated_at, excluded.updated_at);

insert into public.fitness_sessions (
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
  'fit-' || s.id,
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
  s.fitness_warm_up,
  s.fitness_main_part,
  s.fitness_cool_down,
  s.fitness_player_groups,
  coalesce(s.fitness_updated_at, s.updated_at, (extract(epoch from now()) * 1000)::bigint),
  coalesce(s.fitness_updated_at, s.updated_at, (extract(epoch from now()) * 1000)::bigint)
from public.sessions s
where
  s.fitness_updated_at is not null
  or s.fitness_warm_up is not null
  or s.fitness_main_part is not null
  or s.fitness_cool_down is not null
  or s.fitness_player_groups is not null
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
  updated_at = greatest(public.fitness_sessions.updated_at, excluded.updated_at);

commit;
