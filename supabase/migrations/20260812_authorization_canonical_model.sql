-- =============================================================================
-- Canonical authorization model hardening
-- Source of truth:
-- auth.users -> user_profiles -> user_team_memberships -> user_role_assignments
-- -> app_role_section_action_grants (section + action)
--
-- Non-destructive migration.
-- =============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Ensure planning section/action catalog includes meetings + all CRUD actions.
-- ---------------------------------------------------------------------------
insert into public.app_sections (key, label)
values
  ('meetings', 'Meetings')
on conflict (key) do update
set label = excluded.label,
    updated_at = now();

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

-- Deterministically preserve the legacy bootstrap admin by converting the known
-- admin profile into an explicit admin role assignment. This is migration-time
-- compatibility only; runtime authorization no longer depends on email checks.
insert into public.user_role_assignments (user_id, role_id)
select
  up.user_id,
  ar.id
from public.user_profiles up
join public.app_roles ar
  on ar.key = 'admin'
where lower(trim(up.email)) = 'admin@alula.com'
on conflict (user_id, role_id) do nothing;

-- ---------------------------------------------------------------------------
-- Canonical helper functions
-- ---------------------------------------------------------------------------

create or replace function public.current_user_email()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select lower(trim(coalesce(auth.jwt() ->> 'email', '')))
$$;

create or replace function public.current_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    auth.uid(),
    (
      select up.user_id
      from public.user_profiles up
      where lower(trim(up.email)) = public.current_user_email()
      limit 1
    )
  )
$$;

create or replace function public.is_admin_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1
      from public.user_role_assignments ura
      join public.app_roles ar on ar.id = ura.role_id
      where ura.user_id = public.current_user_id()
        and ar.key = 'admin'
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
    or (
      coalesce(trim(team_key), '') <> ''
      and exists (
        select 1
        from public.user_team_memberships utm
        where utm.user_id = public.current_user_id()
          and utm.team_id = trim(team_key)
      )
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
    case
      when coalesce(trim(section_name), '') = '' then false
      when coalesce(trim(action_name), '') = '' then false
      when public.is_admin_user() then true
      when not public.user_has_team_membership(team_key) then false
      else exists (
        select 1
        from public.user_role_assignments ura
        join public.app_role_section_action_grants rsag
          on rsag.role_id = ura.role_id
        join public.app_section_actions asa
          on asa.id = rsag.section_action_id
        join public.app_sections sec
          on sec.id = asa.section_id
        join public.user_section_access usa
          on usa.user_id = ura.user_id
         and usa.section_id = sec.id
        where ura.user_id = public.current_user_id()
          and sec.key = lower(trim(section_name))
          and asa.action_key = lower(trim(action_name))
      )
    end
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

create or replace function public.can_any_team(
  section_name text,
  action_name text default 'read'
)
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
      from public.user_team_memberships utm
      where utm.user_id = public.current_user_id()
        and public.can(section_name, action_name, utm.team_id)
    )
$$;

create or replace function public.has_section_access(section_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_any_team(section_name, 'read')
$$;

-- Frontend snapshot helper for centralized can(section, action, teamId).
create or replace function public.authorization_my_context()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := public.current_user_id();
  is_admin boolean := public.is_admin_user();
  team_ids text[];
  role_key text;
  grants jsonb;
begin
  select coalesce(array_agg(utm.team_id order by utm.team_id), '{}'::text[])
  into team_ids
  from public.user_team_memberships utm
  where utm.user_id = uid;

  select ar.key
  into role_key
  from public.user_role_assignments ura
  join public.app_roles ar on ar.id = ura.role_id
  where ura.user_id = uid
  order by ura.assigned_at asc
  limit 1;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'section', sec.key,
        'action', asa.action_key
      )
      order by sec.key, asa.action_key
    ),
    '[]'::jsonb
  )
  into grants
  from public.user_role_assignments ura
  join public.app_role_section_action_grants rsag
    on rsag.role_id = ura.role_id
  join public.app_section_actions asa
    on asa.id = rsag.section_action_id
  join public.app_sections sec
    on sec.id = asa.section_id
  join public.user_section_access usa
    on usa.user_id = ura.user_id
   and usa.section_id = sec.id
  where ura.user_id = uid;

  return jsonb_build_object(
    'userId', uid,
    'isAdmin', is_admin,
    'role', coalesce(role_key, 'custom'),
    'teamIds', coalesce(to_jsonb(team_ids), '[]'::jsonb),
    'grants', grants
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin authorization operations (explicit authorization mutation).
-- Identity synchronization is intentionally separate.
-- ---------------------------------------------------------------------------

create or replace function public.admin_set_user_authorization(
  target_email text,
  target_role_key text,
  target_section_keys text[],
  target_team_ids text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_email text := lower(trim(coalesce(target_email, '')));
  normalized_role text := lower(trim(coalesce(target_role_key, '')));
  target_user_id uuid;
  role_id uuid;
  normalized_sections text[];
  normalized_teams text[];
begin
  if not public.is_admin_user() then
    raise exception 'Only admins can assign authorization.' using errcode = '42501';
  end if;

  if normalized_email = '' then
    raise exception 'Email is required.' using errcode = '22023';
  end if;

  if normalized_role = '' then
    raise exception 'Role is required.' using errcode = '22023';
  end if;

  select up.user_id
  into target_user_id
  from public.user_profiles up
  where lower(trim(up.email)) = normalized_email
  limit 1;

  if target_user_id is null then
    raise exception 'user_profiles row not found for %', normalized_email using errcode = '23503';
  end if;

  select ar.id
  into role_id
  from public.app_roles ar
  where ar.key = normalized_role
  limit 1;

  if role_id is null then
    raise exception 'Unknown role key: %', normalized_role using errcode = '22023';
  end if;

  select coalesce(array_agg(distinct lower(trim(v))), '{}'::text[])
  into normalized_sections
  from unnest(coalesce(target_section_keys, '{}'::text[])) as v
  where lower(trim(v)) <> '';

  select coalesce(array_agg(distinct trim(v)), '{}'::text[])
  into normalized_teams
  from unnest(coalesce(target_team_ids, '{}'::text[])) as v
  where trim(v) <> '';

  -- Validate teams and sections before mutation.
  if exists (
    select 1
    from unnest(normalized_teams) as t(team_id)
    where not exists (
      select 1 from public.auth_teams at where at.id = t.team_id
    )
  ) then
    raise exception 'One or more team IDs do not exist.' using errcode = '23503';
  end if;

  if exists (
    select 1
    from unnest(normalized_sections) as s(section_key)
    where not exists (
      select 1 from public.app_sections sec where sec.key = s.section_key
    )
  ) then
    raise exception 'One or more section keys do not exist.' using errcode = '23503';
  end if;

  -- Single explicit role assignment per user.
  delete from public.user_role_assignments where user_id = target_user_id;
  insert into public.user_role_assignments (user_id, role_id, assigned_by)
  values (target_user_id, role_id, public.current_user_id())
  on conflict (user_id, role_id) do update
  set assigned_by = excluded.assigned_by,
      assigned_at = now();

  -- Explicit per-user section scope.
  delete from public.user_section_access where user_id = target_user_id;
  if array_length(normalized_sections, 1) is not null then
    insert into public.user_section_access (user_id, section_id, granted_by)
    select
      target_user_id,
      sec.id,
      public.current_user_id()
    from public.app_sections sec
    where sec.key = any(normalized_sections)
    on conflict (user_id, section_id) do update
    set granted_by = excluded.granted_by,
        granted_at = now();
  end if;

  -- Explicit team scope.
  delete from public.user_team_memberships where user_id = target_user_id;
  if array_length(normalized_teams, 1) is not null then
    insert into public.user_team_memberships (user_id, team_id, assigned_by)
    select
      target_user_id,
      t.team_id,
      public.current_user_id()
    from unnest(normalized_teams) as t(team_id)
    on conflict (user_id, team_id) do update
    set assigned_by = excluded.assigned_by,
        assigned_at = now();
  end if;

  return jsonb_build_object(
    'email', normalized_email,
    'userId', target_user_id,
    'role', normalized_role,
    'sections', normalized_sections,
    'teams', normalized_teams
  );
end;
$$;

create or replace function public.admin_list_authorization_users()
returns table (
  user_id uuid,
  email text,
  display_name text,
  is_active boolean,
  role_key text,
  section_keys text[],
  team_ids text[]
)
language sql
stable
security definer
set search_path = public
as $$
  select
    up.user_id,
    up.email,
    up.display_name,
    up.is_active,
    coalesce(
      (
        select ar.key
        from public.user_role_assignments ura
        join public.app_roles ar on ar.id = ura.role_id
        where ura.user_id = up.user_id
        order by ura.assigned_at asc
        limit 1
      ),
      'custom'
    ) as role_key,
    coalesce(
      (
        select array_agg(sec.key order by sec.key)
        from public.user_section_access usa
        join public.app_sections sec on sec.id = usa.section_id
        where usa.user_id = up.user_id
      ),
      '{}'::text[]
    ) as section_keys,
    coalesce(
      (
        select array_agg(utm.team_id order by utm.team_id)
        from public.user_team_memberships utm
        where utm.user_id = up.user_id
      ),
      '{}'::text[]
    ) as team_ids
  from public.user_profiles up
  where up.is_active = true
  order by up.email asc
$$;

-- Admin-only execution control for mutation/list helpers.
revoke all on function public.admin_set_user_authorization(text, text, text[], text[]) from public;
grant execute on function public.admin_set_user_authorization(text, text, text[], text[]) to authenticated;

revoke all on function public.admin_list_authorization_users() from public;
grant execute on function public.admin_list_authorization_users() to authenticated;

revoke all on function public.authorization_my_context() from public;
grant execute on function public.authorization_my_context() to authenticated;
