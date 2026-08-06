-- U17 Training Sessions - Supabase Phase 1 schema
-- Scope: sessions only (parallel provider mode)

create extension if not exists pgcrypto;

create table if not exists public.sessions (
  id text primary key,
  team_name text not null,
  date text not null,
  time text not null,
  session_number text not null,
  microcycle_day text not null,
  main_objective text not null default '',
  materials_needed text not null default '',
  observations text not null default '',

  warm_up jsonb,
  main_part jsonb,
  cool_down jsonb,
  player_groups jsonb,
  squad_roster jsonb,
  attendance jsonb,

  fitness_warm_up jsonb,
  fitness_main_part jsonb,
  fitness_cool_down jsonb,
  fitness_player_groups jsonb,

  gk_warm_up jsonb,
  gk_main_part jsonb,
  gk_cool_down jsonb,
  gk_player_groups jsonb,

  updated_at bigint not null,
  football_updated_at bigint,
  fitness_updated_at bigint,
  gk_updated_at bigint,

  created_at timestamptz not null default now()
);

create index if not exists sessions_updated_at_idx on public.sessions (updated_at desc);
create index if not exists sessions_date_idx on public.sessions (date desc);
create index if not exists sessions_session_number_idx on public.sessions (session_number);

alter table public.sessions enable row level security;

-- Phase 1 permissive policies for authenticated users only.
-- Replace with section-based role policies in Phase 2.
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'sessions'
      and policyname = 'sessions_read_authenticated'
  ) then
    create policy sessions_read_authenticated
      on public.sessions
      for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'sessions'
      and policyname = 'sessions_write_authenticated'
  ) then
    create policy sessions_write_authenticated
      on public.sessions
      for all
      to authenticated
      using (true)
      with check (true);
  end if;
end $$;

alter publication supabase_realtime add table public.sessions;
