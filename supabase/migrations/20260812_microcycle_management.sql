-- U17 Training Sessions - Microcycle management
-- Adds persistent weekly planning entities with structured concepts, session links,
-- and squad availability integration.

create extension if not exists pgcrypto;

create table if not exists public.microcycles (
  id uuid primary key default gen_random_uuid(),
  team_id text not null default 'u17-women-alula',
  team_name text not null default 'U17 Women Al Ula',
  name text not null,
  week_number integer,
  start_date date not null,
  end_date date not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  team_total integer,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create index if not exists microcycles_start_date_idx
  on public.microcycles (start_date desc);

create index if not exists microcycles_week_number_idx
  on public.microcycles (week_number);

create index if not exists microcycles_team_id_idx
  on public.microcycles (team_id);

create table if not exists public.microcycle_days (
  id uuid primary key default gen_random_uuid(),
  microcycle_id uuid not null references public.microcycles(id) on delete cascade,
  day_order integer not null,
  day_date date not null,
  day_label text,
  training_session text,
  session_type text,
  md_label text,
  duration text,
  load text,
  stage text,
  before_text text,
  pre_training_session text,
  warm_up text,
  pitch text,
  objectives_text text,
  post_training_session text,
  after_text text,
  notes text,
  session_id text references public.sessions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (microcycle_id, day_order),
  unique (microcycle_id, day_date)
);

create index if not exists microcycle_days_microcycle_idx
  on public.microcycle_days (microcycle_id, day_order);

create index if not exists microcycle_days_date_idx
  on public.microcycle_days (day_date);

create index if not exists microcycle_days_session_type_idx
  on public.microcycle_days (session_type);

create index if not exists microcycle_days_load_idx
  on public.microcycle_days (load);

create table if not exists public.microcycle_day_concepts (
  id uuid primary key default gen_random_uuid(),
  microcycle_day_id uuid not null references public.microcycle_days(id) on delete cascade,
  sort_order integer not null default 0,
  concept text not null,
  objective text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists microcycle_day_concepts_day_idx
  on public.microcycle_day_concepts (microcycle_day_id, sort_order);

create index if not exists microcycle_day_concepts_concept_idx
  on public.microcycle_day_concepts (lower(concept));

create table if not exists public.microcycle_player_availability (
  id uuid primary key default gen_random_uuid(),
  microcycle_id uuid not null references public.microcycles(id) on delete cascade,
  category text not null check (
    category in (
      'absent',
      'injured',
      'a_team',
      'u15',
      'national_team_u20',
      'national_team_u17'
    )
  ),
  player_id text references public.squad_players(id) on delete set null,
  player_name_snapshot text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists microcycle_player_availability_microcycle_idx
  on public.microcycle_player_availability (microcycle_id, category);

create index if not exists microcycle_player_availability_player_idx
  on public.microcycle_player_availability (player_id);

-- Realtime publication (safe to rerun).
do $$
declare
  target_table_name text;
begin
  foreach target_table_name in array array[
    'microcycles',
    'microcycle_days',
    'microcycle_day_concepts',
    'microcycle_player_availability'
  ]
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = target_table_name
    ) then
      execute format(
        'alter publication supabase_realtime add table public.%I',
        target_table_name
      );
    end if;
  end loop;
end $$;

alter table public.microcycles enable row level security;
alter table public.microcycle_days enable row level security;
alter table public.microcycle_day_concepts enable row level security;
alter table public.microcycle_player_availability enable row level security;

-- Microcycles

drop policy if exists microcycles_read_planning on public.microcycles;
create policy microcycles_read_planning
  on public.microcycles
  for select
  to authenticated
  using (public.has_section_access('planning'));

drop policy if exists microcycles_write_planning on public.microcycles;
create policy microcycles_write_planning
  on public.microcycles
  for all
  to authenticated
  using (public.has_section_access('planning'))
  with check (public.has_section_access('planning'));

-- Microcycle days

drop policy if exists microcycle_days_read_planning on public.microcycle_days;
create policy microcycle_days_read_planning
  on public.microcycle_days
  for select
  to authenticated
  using (public.has_section_access('planning'));

drop policy if exists microcycle_days_write_planning on public.microcycle_days;
create policy microcycle_days_write_planning
  on public.microcycle_days
  for all
  to authenticated
  using (public.has_section_access('planning'))
  with check (public.has_section_access('planning'));

-- Day concepts

drop policy if exists microcycle_day_concepts_read_planning on public.microcycle_day_concepts;
create policy microcycle_day_concepts_read_planning
  on public.microcycle_day_concepts
  for select
  to authenticated
  using (public.has_section_access('planning'));

drop policy if exists microcycle_day_concepts_write_planning on public.microcycle_day_concepts;
create policy microcycle_day_concepts_write_planning
  on public.microcycle_day_concepts
  for all
  to authenticated
  using (public.has_section_access('planning'))
  with check (public.has_section_access('planning'));

-- Player availability

drop policy if exists microcycle_player_availability_read_planning on public.microcycle_player_availability;
create policy microcycle_player_availability_read_planning
  on public.microcycle_player_availability
  for select
  to authenticated
  using (public.has_section_access('planning'));

drop policy if exists microcycle_player_availability_write_planning on public.microcycle_player_availability;
create policy microcycle_player_availability_write_planning
  on public.microcycle_player_availability
  for all
  to authenticated
  using (public.has_section_access('planning'))
  with check (public.has_section_access('planning'));
