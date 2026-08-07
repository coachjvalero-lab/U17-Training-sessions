-- U17 Training Sessions - Supabase Phase 2 (Auth + Authorization)
-- Goal: replicate current Firebase role/section permissions with RLS.

create extension if not exists pgcrypto;

create table if not exists public.user_roles (
  email text primary key,
  role text not null check (role in ('admin', 'coach', 'fitness_coach', 'gk_coach', 'physio', 'analyst', 'custom')),
  allowed_sections text[] not null default '{}',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists user_roles_role_idx on public.user_roles (role);
create index if not exists user_roles_updated_at_idx on public.user_roles (updated_at desc);

alter table public.user_roles enable row level security;

create or replace function public.current_user_email()
returns text
language sql
stable
as $$
  select lower(coalesce((auth.jwt() ->> 'email'), ''))
$$;

create or replace function public.is_bootstrap_admin()
returns boolean
language sql
stable
as $$
  select public.current_user_email() = 'admin@alula.com'
$$;

create or replace function public.is_admin_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_bootstrap_admin()
    or exists (
      select 1
      from public.user_roles ur
      where ur.email = public.current_user_email()
        and ur.role = 'admin'
    )
$$;

create or replace function public.has_section_access(section_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin_user()
    or exists (
      select 1
      from public.user_roles ur
      where ur.email = public.current_user_email()
        and section_name = any (ur.allowed_sections)
    )
$$;

-- user_roles policies: self-read, admin-read-all, admin-write, bootstrap first-write

drop policy if exists user_roles_select_self_or_admin on public.user_roles;
create policy user_roles_select_self_or_admin
  on public.user_roles
  for select
  to authenticated
  using (
    email = public.current_user_email()
    or public.is_admin_user()
  );

drop policy if exists user_roles_insert_admin_or_bootstrap on public.user_roles;
create policy user_roles_insert_admin_or_bootstrap
  on public.user_roles
  for insert
  to authenticated
  with check (
    public.is_admin_user() or public.is_bootstrap_admin()
  );

drop policy if exists user_roles_update_admin_only on public.user_roles;
create policy user_roles_update_admin_only
  on public.user_roles
  for update
  to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

drop policy if exists user_roles_delete_admin_only on public.user_roles;
create policy user_roles_delete_admin_only
  on public.user_roles
  for delete
  to authenticated
  using (public.is_admin_user());

-- Replace permissive Phase 1 session policy with role-based policy
-- Matches Firebase behavior: read any signed-in user, write for football|fitness|gk allowed roles.

drop policy if exists sessions_read_authenticated on public.sessions;
create policy sessions_read_authenticated
  on public.sessions
  for select
  to authenticated
  using (auth.uid() is not null);

drop policy if exists sessions_write_authenticated on public.sessions;
drop policy if exists sessions_write_by_section on public.sessions;
create policy sessions_write_by_section
  on public.sessions
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

-- Optional table policies (created only if those tables exist already in this project)

do $do$
begin
  if to_regclass('public.squad_players') is not null then
    execute 'alter table public.squad_players enable row level security';
    execute 'drop policy if exists squad_players_read_authenticated on public.squad_players';
    execute 'create policy squad_players_read_authenticated on public.squad_players for select to authenticated using (auth.uid() is not null)';
    execute 'drop policy if exists squad_players_write_squad on public.squad_players';
    execute $sql$create policy squad_players_write_squad on public.squad_players for all to authenticated using (public.has_section_access('squad')) with check (public.has_section_access('squad'))$sql$;
  end if;

  if to_regclass('public.physio_records') is not null then
    execute 'alter table public.physio_records enable row level security';
    execute 'drop policy if exists physio_records_read_policy on public.physio_records';
    execute $sql$create policy physio_records_read_policy on public.physio_records for select to authenticated using (public.is_admin_user() or public.has_section_access('physio') or public.has_section_access('football') or public.has_section_access('fitness') or public.has_section_access('gk'))$sql$;
    execute 'drop policy if exists physio_records_write_policy on public.physio_records';
    execute $sql$create policy physio_records_write_policy on public.physio_records for all to authenticated using (public.is_admin_user() or public.has_section_access('physio')) with check (public.is_admin_user() or public.has_section_access('physio'))$sql$;
  end if;

  if to_regclass('public.video_analysis') is not null then
    execute 'alter table public.video_analysis enable row level security';
    execute 'drop policy if exists video_analysis_read_authenticated on public.video_analysis';
    execute 'create policy video_analysis_read_authenticated on public.video_analysis for select to authenticated using (auth.uid() is not null)';
    execute 'drop policy if exists video_analysis_write_video on public.video_analysis';
    execute $sql$create policy video_analysis_write_video on public.video_analysis for all to authenticated using (public.has_section_access('video')) with check (public.has_section_access('video'))$sql$;
  end if;

  if to_regclass('public.exercise_library') is not null then
    execute 'alter table public.exercise_library enable row level security';
    execute 'drop policy if exists exercise_library_read_authenticated on public.exercise_library';
    execute 'create policy exercise_library_read_authenticated on public.exercise_library for select to authenticated using (auth.uid() is not null)';
    execute 'drop policy if exists exercise_library_write_exercises on public.exercise_library';
    execute $sql$create policy exercise_library_write_exercises on public.exercise_library for all to authenticated using (public.has_section_access('exercises')) with check (public.has_section_access('exercises'))$sql$;
  end if;

  if to_regclass('public.competition_fixtures') is not null then
    execute 'alter table public.competition_fixtures enable row level security';
    execute 'drop policy if exists competition_fixtures_read_authenticated on public.competition_fixtures';
    execute 'create policy competition_fixtures_read_authenticated on public.competition_fixtures for select to authenticated using (auth.uid() is not null)';
    execute 'drop policy if exists competition_fixtures_write_football on public.competition_fixtures';
    execute $sql$create policy competition_fixtures_write_football on public.competition_fixtures for all to authenticated using (public.has_section_access('football')) with check (public.has_section_access('football'))$sql$;
  end if;
end $do$;
