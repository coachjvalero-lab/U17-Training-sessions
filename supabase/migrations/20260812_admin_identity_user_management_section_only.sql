-- =============================================================================
-- Admin identity helpers (section-only alignment)
-- Keeps identity/profile flow and removes team/role/action references.
-- =============================================================================

create or replace function public.admin_get_auth_user_status(target_email text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  normalized_email text;
  auth_user_id uuid;
  auth_email text;
  profile_user_id uuid;
  profile_exists boolean := false;
  section_access_count integer := 0;
  is_admin_user_flag boolean := false;
begin
  if not public.is_admin_user() then
    raise exception 'Only admins can inspect auth user status.' using errcode = '42501';
  end if;

  normalized_email := lower(trim(coalesce(target_email, '')));
  if normalized_email = '' then
    raise exception 'Email is required.' using errcode = '22023';
  end if;

  select
    u.id,
    lower(trim(u.email))
  into auth_user_id, auth_email
  from auth.users u
  where u.email is not null
    and lower(trim(u.email)) = normalized_email
  order by u.created_at desc
  limit 1;

  if auth_user_id is not null then
    select up.user_id
    into profile_user_id
    from public.user_profiles up
    where up.user_id = auth_user_id
       or lower(trim(up.email)) = normalized_email
    order by case when up.user_id = auth_user_id then 0 else 1 end
    limit 1;

    profile_exists := profile_user_id is not null;

    select count(*)::integer
    into section_access_count
    from public.user_section_access usa
    where usa.user_id = auth_user_id;

    select exists (
      select 1
      from public.user_role_assignments ura
      join public.app_roles ar on ar.id = ura.role_id
      where ura.user_id = auth_user_id
        and ar.key = 'admin'
    ) into is_admin_user_flag;
  end if;

  return jsonb_build_object(
    'normalizedEmail', normalized_email,
    'authUserExists', auth_user_id is not null,
    'authUserId', auth_user_id,
    'authEmail', auth_email,
    'profileExists', profile_exists,
    'profileUserId', profile_user_id,
    'sectionAccessCount', section_access_count,
    'isAdminUser', is_admin_user_flag,
    'isConsistent', (auth_user_id is not null and profile_user_id = auth_user_id)
  );
end;
$$;

revoke all on function public.admin_get_auth_user_status(text) from public;
grant execute on function public.admin_get_auth_user_status(text) to authenticated;
