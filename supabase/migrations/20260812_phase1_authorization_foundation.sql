-- U17 Training Sessions - Phase 1 authorization foundation
-- Additive migration:
-- USER -> ROLE -> TEAM MEMBERSHIP -> SECTION -> ACTION
-- Keeps existing behavior by preserving user_roles as compatibility source.

create extension if not exists pgcrypto;

create table if not exists public.auth_teams (
  id text primary key,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_team_memberships (
  user_id uuid not null references public.user_profiles(user_id) on delete cascade,
  team_id text not null references public.auth_teams(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  assigned_by uuid,
  primary key (user_id, team_id)
);

create table if not exists public.app_section_actions (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.app_sections(id) on delete cascade,
  action_key text not null check (action_key in ('read', 'create', 'update', 'delete')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (section_id, action_key)
);

create table if not exists public.app_role_section_action_grants (
  role_id uuid not null references public.app_roles(id) on delete cascade,
  section_action_id uuid not null references public.app_section_actions(id) on delete cascade,
  granted_at timestamptz not null default now(),
  granted_by uuid,
  primary key (role_id, section_action_id)
);

create index if not exists auth_teams_is_active_idx
  on public.auth_teams (is_active);

create index if not exists user_team_memberships_team_id_idx
  on public.user_team_memberships (team_id);

create index if not exists app_section_actions_action_key_idx
  on public.app_section_actions (action_key);

create index if not exists app_role_section_action_grants_section_action_idx
  on public.app_role_section_action_grants (section_action_id);

-- Keep sections complete and aligned with current frontend modules.
insert into public.app_sections (key, label)
values
  ('football', 'Football Session'),
  ('fitness', 'Fitness and Conditioning'),
  ('gk', 'Goalkeeper Training'),
  ('squad', 'Squad Roster'),
  ('attendance', 'Attendance and Analytics'),
  ('physio', 'Physiotherapist Department'),
  ('video', 'Video Analysis Hub'),
  ('exercises', 'Exercise Library'),
  ('planning', 'Planification and Microcycle'),
  ('meetings', 'Meetings')
on conflict (key) do update
set label = excluded.label,
    updated_at = now();

insert into public.auth_teams (id, name)
values
  ('u17-women-alula', 'U17 Women Al Ula')
on conflict (id) do update
set name = excluded.name,
    updated_at = now();

-- If microcycles already exist, register their teams as auth teams.
do $$
begin
  if to_regclass('public.microcycles') is not null then
    insert into public.auth_teams (id, name)
    select distinct
      trim(m.team_id) as id,
      coalesce(nullif(trim(m.team_name), ''), trim(m.team_id)) as name
    from public.microcycles m
    where m.team_id is not null
      and trim(m.team_id) <> ''
    on conflict (id) do update
    set name = excluded.name,
        updated_at = now();
  end if;
end $$;

insert into public.app_section_actions (section_id, action_key)
select
  s.id,
  a.action_key
from public.app_sections s
cross join (
  values
    ('read'::text),
    ('create'::text),
    ('update'::text),
    ('delete'::text)
) as a(action_key)
on conflict (section_id, action_key) do nothing;

-- Backfill team memberships for active users into default team.
insert into public.user_team_memberships (user_id, team_id)
select
  up.user_id,
  'u17-women-alula'
from public.user_profiles up
where up.is_active = true
on conflict (user_id, team_id) do nothing;

-- Backfill role grants from legacy user_roles section permissions.
insert into public.app_role_section_action_grants (role_id, section_action_id)
select distinct
  ar.id as role_id,
  asa.id as section_action_id
from public.user_roles ur
join public.app_roles ar
  on ar.key = ur.role
cross join lateral unnest(coalesce(ur.allowed_sections, '{}'::text[])) as sec(section_key)
join public.app_sections s
  on s.key = sec.section_key
join public.app_section_actions asa
  on asa.section_id = s.id
on conflict (role_id, section_action_id) do nothing;

-- Admin always has full section/action grants.
insert into public.app_role_section_action_grants (role_id, section_action_id)
select
  ar.id as role_id,
  asa.id as section_action_id
from public.app_roles ar
join public.app_section_actions asa on true
where ar.key = 'admin'
on conflict (role_id, section_action_id) do nothing;

create or replace function public.current_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select up.user_id
      from public.user_profiles up
      where up.user_id = auth.uid()
      limit 1
    ),
    (
      select up.user_id
      from public.user_profiles up
      where lower(trim(up.email)) = public.current_user_email()
      limit 1
    )
  )
$$;

create or replace function public.user_has_team_membership(team_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin_user()
    or coalesce(trim(team_key), '') = ''
    or exists (
      select 1
      from public.user_team_memberships utm
      where utm.user_id = public.current_user_id()
        and utm.team_id = trim(team_key)
    )
$$;

create or replace function public.user_has_section_action(
  section_name text,
  action_name text,
  team_key text default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin_user()
    or (
      exists (
        select 1
        from public.user_role_assignments ura
        join public.app_role_section_action_grants rsag
          on rsag.role_id = ura.role_id
        join public.app_section_actions asa
          on asa.id = rsag.section_action_id
        join public.app_sections sec
          on sec.id = asa.section_id
        where ura.user_id = public.current_user_id()
          and sec.key = section_name
          and asa.action_key = lower(action_name)
      )
      and exists (
        select 1
        from public.user_roles ur
        where ur.email = public.current_user_email()
          and section_name = any (ur.allowed_sections)
      )
      and public.user_has_team_membership(team_key)
    )
$$;

create or replace function public.can(
  section_name text,
  action_name text default 'read',
  team_key text default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.user_has_section_action(section_name, action_name, team_key)
$$;

-- Backward-compatible helper currently used by existing RLS policies.
create or replace function public.has_section_access(section_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can(section_name, 'read', null)
$$;

alter table public.auth_teams enable row level security;
alter table public.user_team_memberships enable row level security;
alter table public.app_section_actions enable row level security;
alter table public.app_role_section_action_grants enable row level security;

drop policy if exists auth_teams_read_authenticated on public.auth_teams;
create policy auth_teams_read_authenticated
  on public.auth_teams
  for select
  to authenticated
  using (auth.uid() is not null);

drop policy if exists auth_teams_write_admin_only on public.auth_teams;
create policy auth_teams_write_admin_only
  on public.auth_teams
  for all
  to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

drop policy if exists user_team_memberships_read_self_or_admin on public.user_team_memberships;
create policy user_team_memberships_read_self_or_admin
  on public.user_team_memberships
  for select
  to authenticated
  using (
    user_id = public.current_user_id()
    or public.is_admin_user()
  );

drop policy if exists user_team_memberships_write_admin_only on public.user_team_memberships;
create policy user_team_memberships_write_admin_only
  on public.user_team_memberships
  for all
  to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

drop policy if exists app_section_actions_read_authenticated on public.app_section_actions;
create policy app_section_actions_read_authenticated
  on public.app_section_actions
  for select
  to authenticated
  using (auth.uid() is not null);

drop policy if exists app_section_actions_write_admin_only on public.app_section_actions;
create policy app_section_actions_write_admin_only
  on public.app_section_actions
  for all
  to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

drop policy if exists app_role_section_action_grants_read_authenticated on public.app_role_section_action_grants;
create policy app_role_section_action_grants_read_authenticated
  on public.app_role_section_action_grants
  for select
  to authenticated
  using (auth.uid() is not null);

drop policy if exists app_role_section_action_grants_write_admin_only on public.app_role_section_action_grants;
create policy app_role_section_action_grants_write_admin_only
  on public.app_role_section_action_grants
  for all
  to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

-- Realtime publication (safe to rerun).
do $$
declare
  target_table_name text;
begin
  foreach target_table_name in array array[
    'auth_teams',
    'user_team_memberships',
    'app_section_actions',
    'app_role_section_action_grants'
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
