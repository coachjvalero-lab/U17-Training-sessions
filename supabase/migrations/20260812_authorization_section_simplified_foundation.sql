-- =============================================================================
-- Section-only authorization foundation (NON-DESTRUCTIVE)
-- Final runtime model:
-- auth.uid() -> user_profiles -> user_section_access (+ app_sections catalog)
--
-- Notes:
-- - user_roles is kept for legacy/backfill only.
-- - Team-scoped and role->action runtime models are intentionally not used here.
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- 1) Canonical sections catalog alignment
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- 2) Legacy backfill conflict tracking
-- -----------------------------------------------------------------------------
create table if not exists public.authorization_section_backfill_conflicts (
  id bigint generated always as identity primary key,
  email text not null,
  legacy_section_key text,
  reason text not null,
  created_at timestamptz not null default now(),
  unique (email, legacy_section_key, reason)
);

-- -----------------------------------------------------------------------------
-- 3) Runtime helper functions (section-only)
-- -----------------------------------------------------------------------------
create or replace function public.current_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid()
$$;

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

  if to_regclass('public.user_role_assignments') is null
     or to_regclass('public.app_roles') is null then
    return false;
  end if;

  return exists (
    select 1
    from public.user_role_assignments ura
    join public.app_roles ar on ar.id = ura.role_id
    where ura.user_id = auth.uid()
      and ar.key = 'admin'
  );
end;
$$;

create or replace function public.user_has_section_access(section_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    case
      when auth.uid() is null then false
      when public.is_admin_user() then true
      when coalesce(trim(section_name), '') = '' then false
      else exists (
        select 1
        from public.user_profiles up
        join public.user_section_access usa on usa.user_id = up.user_id
        join public.app_sections sec on sec.id = usa.section_id
        where up.user_id = auth.uid()
          and up.is_active = true
          and sec.key = lower(trim(section_name))
      )
    end
$$;

create or replace function public.get_my_allowed_sections()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  is_admin boolean := false;
  sections text[];
begin
  if uid is null then
    return jsonb_build_object(
      'userId', null,
      'isAdmin', false,
      'sections', '[]'::jsonb
    );
  end if;

  is_admin := public.is_admin_user();

  if is_admin then
    select coalesce(array_agg(sec.key order by sec.key), '{}'::text[])
    into sections
    from public.app_sections sec;
  else
    select coalesce(array_agg(sec.key order by sec.key), '{}'::text[])
    into sections
    from public.user_profiles up
    join public.user_section_access usa on usa.user_id = up.user_id
    join public.app_sections sec on sec.id = usa.section_id
    where up.user_id = uid
      and up.is_active = true;
  end if;

  return jsonb_build_object(
    'userId', uid,
    'isAdmin', is_admin,
    'sections', to_jsonb(sections)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 4) Deterministic backfill from legacy user_roles -> user_section_access
-- -----------------------------------------------------------------------------
insert into public.authorization_section_backfill_conflicts (email, legacy_section_key, reason)
select
  lower(trim(ur.email)) as email,
  null,
  'missing user_profiles row'
from public.user_roles ur
where not exists (
  select 1
  from public.user_profiles up
  where lower(trim(up.email)) = lower(trim(ur.email))
)
on conflict (email, legacy_section_key, reason) do nothing;

insert into public.authorization_section_backfill_conflicts (email, legacy_section_key, reason)
select
  lower(trim(ur.email)) as email,
  lower(trim(sec_key.section_key)) as legacy_section_key,
  'legacy section key not found in app_sections'
from public.user_roles ur
cross join lateral unnest(coalesce(ur.allowed_sections, '{}'::text[])) as sec_key(section_key)
where lower(trim(sec_key.section_key)) <> ''
  and not exists (
    select 1
    from public.app_sections sec
    where sec.key = lower(trim(sec_key.section_key))
  )
on conflict (email, legacy_section_key, reason) do nothing;

insert into public.user_section_access (user_id, section_id, granted_at, granted_by)
select distinct
  up.user_id,
  sec.id,
  now(),
  null::uuid
from public.user_roles ur
join public.user_profiles up
  on lower(trim(up.email)) = lower(trim(ur.email))
cross join lateral unnest(coalesce(ur.allowed_sections, '{}'::text[])) as sec_key(section_key)
join public.app_sections sec
  on sec.key = lower(trim(sec_key.section_key))
where lower(trim(sec_key.section_key)) <> ''
on conflict (user_id, section_id) do nothing;

-- -----------------------------------------------------------------------------
-- 5) Admin APIs (identity + explicit sections)
-- -----------------------------------------------------------------------------
create or replace function public.admin_list_section_authorization_users()
returns table (
  user_id uuid,
  email text,
  display_name text,
  is_active boolean,
  is_admin boolean,
  section_keys text[]
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
    exists (
      select 1
      from public.user_role_assignments ura
      join public.app_roles ar on ar.id = ura.role_id
      where ura.user_id = up.user_id
        and ar.key = 'admin'
    ) as is_admin,
    coalesce(
      (
        select array_agg(sec.key order by sec.key)
        from public.user_section_access usa
        join public.app_sections sec on sec.id = usa.section_id
        where usa.user_id = up.user_id
      ),
      '{}'::text[]
    ) as section_keys
  from public.user_profiles up
  order by up.email asc
$$;

create or replace function public.admin_set_user_section_access(
  target_email text,
  target_display_name text,
  target_is_active boolean,
  target_section_keys text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_email text := lower(trim(coalesce(target_email, '')));
  resolved_display_name text := nullif(trim(coalesce(target_display_name, '')), '');
  resolved_is_active boolean := coalesce(target_is_active, true);
  target_user_id uuid;
  normalized_sections text[];
begin
  if not public.is_admin_user() then
    raise exception 'Only admins can assign section access.' using errcode = '42501';
  end if;

  if normalized_email = '' then
    raise exception 'Email is required.' using errcode = '22023';
  end if;

  select up.user_id
  into target_user_id
  from public.user_profiles up
  where lower(trim(up.email)) = normalized_email
  limit 1;

  if target_user_id is null then
    raise exception 'user_profiles row not found for %', normalized_email using errcode = '23503';
  end if;

  select coalesce(array_agg(distinct lower(trim(v))), '{}'::text[])
  into normalized_sections
  from unnest(coalesce(target_section_keys, '{}'::text[])) as v
  where lower(trim(v)) <> '';

  if exists (
    select 1
    from unnest(normalized_sections) as s(section_key)
    where not exists (
      select 1 from public.app_sections sec where sec.key = s.section_key
    )
  ) then
    raise exception 'One or more section keys do not exist.' using errcode = '23503';
  end if;

  update public.user_profiles
  set
    display_name = coalesce(resolved_display_name, split_part(normalized_email, '@', 1)),
    is_active = resolved_is_active,
    updated_at = now()
  where user_id = target_user_id;

  delete from public.user_section_access where user_id = target_user_id;

  if array_length(normalized_sections, 1) is not null then
    insert into public.user_section_access (user_id, section_id, granted_at, granted_by)
    select
      target_user_id,
      sec.id,
      now(),
      auth.uid()
    from public.app_sections sec
    where sec.key = any(normalized_sections)
    on conflict (user_id, section_id) do update
    set granted_at = excluded.granted_at,
        granted_by = excluded.granted_by;
  end if;

  return jsonb_build_object(
    'email', normalized_email,
    'userId', target_user_id,
    'isActive', resolved_is_active,
    'sections', normalized_sections
  );
end;
$$;

-- Legacy-vs-new validation report (read-only comparison)
create or replace function public.admin_compare_legacy_and_section_access()
returns table (
  email text,
  legacy_sections text[],
  new_sections text[],
  missing_sections text[],
  extra_sections text[],
  status text
)
language sql
stable
security definer
set search_path = public
as $$
  with emails as (
    select lower(trim(ur.email)) as email
    from public.user_roles ur
    union
    select lower(trim(up.email)) as email
    from public.user_profiles up
  ),
  legacy as (
    select
      lower(trim(ur.email)) as email,
      coalesce(array_agg(distinct lower(trim(sec_key.section_key)) order by lower(trim(sec_key.section_key))), '{}'::text[]) as sections
    from public.user_roles ur
    left join lateral unnest(coalesce(ur.allowed_sections, '{}'::text[])) as sec_key(section_key)
      on true
    where coalesce(trim(sec_key.section_key), '') <> ''
    group by lower(trim(ur.email))
  ),
  current_sections as (
    select
      lower(trim(up.email)) as email,
      coalesce(array_agg(distinct sec.key order by sec.key), '{}'::text[]) as sections
    from public.user_profiles up
    left join public.user_section_access usa on usa.user_id = up.user_id
    left join public.app_sections sec on sec.id = usa.section_id
    group by lower(trim(up.email))
  )
  select
    e.email,
    coalesce(l.sections, '{}'::text[]) as legacy_sections,
    coalesce(c.sections, '{}'::text[]) as new_sections,
    coalesce(
      (
        select array_agg(x order by x)
        from (
          select unnest(coalesce(l.sections, '{}'::text[]))
          except
          select unnest(coalesce(c.sections, '{}'::text[]))
        ) as d(x)
      ),
      '{}'::text[]
    ) as missing_sections,
    coalesce(
      (
        select array_agg(x order by x)
        from (
          select unnest(coalesce(c.sections, '{}'::text[]))
          except
          select unnest(coalesce(l.sections, '{}'::text[]))
        ) as d(x)
      ),
      '{}'::text[]
    ) as extra_sections,
    case
      when coalesce(
        (
          select array_agg(x order by x)
          from (
            select unnest(coalesce(l.sections, '{}'::text[]))
            except
            select unnest(coalesce(c.sections, '{}'::text[]))
          ) as d(x)
        ),
        '{}'::text[]
      ) = '{}'::text[] then 'MATCH'
      else 'REQUIRES_REVIEW'
    end as status
  from emails e
  left join legacy l on l.email = e.email
  left join current_sections c on c.email = e.email
  order by e.email asc
$$;

revoke all on function public.get_my_allowed_sections() from public;
grant execute on function public.get_my_allowed_sections() to authenticated;

revoke all on function public.admin_list_section_authorization_users() from public;
grant execute on function public.admin_list_section_authorization_users() to authenticated;

revoke all on function public.admin_set_user_section_access(text, text, boolean, text[]) from public;
grant execute on function public.admin_set_user_section_access(text, text, boolean, text[]) to authenticated;

revoke all on function public.admin_compare_legacy_and_section_access() from public;
grant execute on function public.admin_compare_legacy_and_section_access() to authenticated;
