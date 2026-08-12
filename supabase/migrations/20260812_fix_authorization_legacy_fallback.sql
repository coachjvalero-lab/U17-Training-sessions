-- =============================================================================
-- Fix: restore user_roles fallback in authorization functions.
--
-- The simplified-foundation migration dropped the fallback to the legacy
-- user_roles table.  If user_role_assignments / user_section_access are empty
-- (backfill not yet applied) every user loses all section access.
--
-- This migration:
--   1. Re-runs the backfill (idempotent, ON CONFLICT DO NOTHING).
--   2. Updates is_admin_user() to also check user_roles when the new table
--      has no matching row for the current user.
--   3. Updates get_my_allowed_sections() to fall back to
--      user_roles.allowed_sections when user_section_access is empty for the
--      current user.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Idempotent backfill: auth.users -> user_profiles
-- -----------------------------------------------------------------------------
insert into public.user_profiles (user_id, email, display_name, is_active)
select
  au.id,
  lower(trim(au.email)),
  split_part(lower(trim(au.email)), '@', 1),
  true
from auth.users au
where au.email is not null
  and au.email <> ''
on conflict (user_id) do update
  set email        = excluded.email,
      display_name = coalesce(user_profiles.display_name, excluded.display_name),
      updated_at   = now();

-- -----------------------------------------------------------------------------
-- 2) Idempotent backfill: user_roles.role -> user_role_assignments
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.user_roles') is not null
     and to_regclass('public.user_role_assignments') is not null
     and to_regclass('public.app_roles') is not null then

    insert into public.user_role_assignments (user_id, role_id, assigned_at)
    select
      up.user_id,
      ar.id,
      now()
    from public.user_roles ur
    join public.user_profiles up
      on lower(trim(up.email)) = lower(trim(ur.email))
    join public.app_roles ar
      on ar.key = lower(trim(ur.role))
    on conflict (user_id, role_id) do nothing;

  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3) Idempotent backfill: user_roles.allowed_sections -> user_section_access
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.user_roles') is not null
     and to_regclass('public.user_section_access') is not null
     and to_regclass('public.app_sections') is not null then

    insert into public.user_section_access (user_id, section_id, granted_at)
    select distinct
      up.user_id,
      sec.id,
      now()
    from public.user_roles ur
    join public.user_profiles up
      on lower(trim(up.email)) = lower(trim(ur.email))
    cross join lateral unnest(coalesce(ur.allowed_sections, '{}'::text[])) as s(section_key)
    join public.app_sections sec
      on sec.key = lower(trim(s.section_key))
    where lower(trim(s.section_key)) <> ''
    on conflict (user_id, section_id) do nothing;

  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4) Fix is_admin_user() — check new tables first, then fall back to user_roles
-- -----------------------------------------------------------------------------
create or replace function public.is_admin_user()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return false;
  end if;

  -- Primary check: normalized user_role_assignments + app_roles
  if to_regclass('public.user_role_assignments') is not null
     and to_regclass('public.app_roles') is not null then
    if exists (
      select 1
      from public.user_role_assignments ura
      join public.app_roles ar on ar.id = ura.role_id
      where ura.user_id = auth.uid()
        and ar.key = 'admin'
    ) then
      return true;
    end if;
  end if;

  -- Fallback: legacy user_roles table
  if to_regclass('public.user_roles') is not null then
    return exists (
      select 1
      from public.user_roles ur
      join auth.users au
        on lower(trim(au.email)) = lower(trim(ur.email))
      where au.id   = auth.uid()
        and ur.role = 'admin'
    );
  end if;

  return false;
end;
$$;

-- -----------------------------------------------------------------------------
-- 5) Fix get_my_allowed_sections() — fall back to user_roles.allowed_sections
-- -----------------------------------------------------------------------------
create or replace function public.get_my_allowed_sections()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid      uuid    := auth.uid();
  is_admin boolean := false;
  sections text[];
begin
  if uid is null then
    return jsonb_build_object(
      'userId',   null,
      'isAdmin',  false,
      'sections', '[]'::jsonb
    );
  end if;

  is_admin := public.is_admin_user();

  if is_admin then
    -- Admin gets every registered section
    select coalesce(array_agg(sec.key order by sec.key), '{}'::text[])
    into sections
    from public.app_sections sec;

  else
    -- Primary: read from user_section_access
    select coalesce(array_agg(sec.key order by sec.key), '{}'::text[])
    into sections
    from public.user_profiles up
    join public.user_section_access usa on usa.user_id = up.user_id
    join public.app_sections sec        on sec.id      = usa.section_id
    where up.user_id  = uid
      and up.is_active = true;

    -- Fallback: legacy user_roles.allowed_sections when user_section_access has no rows
    if (sections is null or array_length(sections, 1) is null)
       and to_regclass('public.user_roles') is not null then

      select coalesce(ur.allowed_sections, '{}'::text[])
      into sections
      from public.user_roles ur
      join auth.users au
        on lower(trim(au.email)) = lower(trim(ur.email))
      where au.id = uid;

    end if;

  end if;

  return jsonb_build_object(
    'userId',   uid,
    'isAdmin',  is_admin,
    'sections', to_jsonb(coalesce(sections, '{}'::text[]))
  );
end;
$$;

-- Re-grant execute permissions (security definer functions need explicit grants)
revoke all on function public.is_admin_user()            from public;
revoke all on function public.get_my_allowed_sections()  from public;

grant execute on function public.is_admin_user()            to authenticated;
grant execute on function public.get_my_allowed_sections()  to authenticated;
