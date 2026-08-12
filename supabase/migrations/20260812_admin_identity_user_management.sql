-- =============================================================================
-- Admin identity user-management helpers
-- Purpose: explicit existing/new Auth user flow for AdminPermissionsModal
-- without exposing service-role credentials in the frontend.
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
  role_assignment_count integer := 0;
  team_membership_count integer := 0;
  section_access_count integer := 0;
  has_team_membership_table boolean := to_regclass('public.user_team_memberships') is not null;
  has_role_assignments_table boolean := to_regclass('public.user_role_assignments') is not null;
  has_section_access_table boolean := to_regclass('public.user_section_access') is not null;
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

    if has_role_assignments_table then
      select count(*)::integer
      into role_assignment_count
      from public.user_role_assignments ura
      where ura.user_id = auth_user_id;
    end if;

    if has_team_membership_table then
      select count(*)::integer
      into team_membership_count
      from public.user_team_memberships utm
      where utm.user_id = auth_user_id;
    end if;

    if has_section_access_table then
      select count(*)::integer
      into section_access_count
      from public.user_section_access usa
      where usa.user_id = auth_user_id;
    end if;
  end if;

  return jsonb_build_object(
    'normalizedEmail', normalized_email,
    'authUserExists', auth_user_id is not null,
    'authUserId', auth_user_id,
    'authEmail', auth_email,
    'profileExists', profile_exists,
    'profileUserId', profile_user_id,
    'roleAssignmentCount', role_assignment_count,
    'teamMembershipCount', team_membership_count,
    'sectionAccessCount', section_access_count,
    'isConsistent', (auth_user_id is not null and profile_user_id = auth_user_id)
  );
end;
$$;

create or replace function public.admin_sync_identity_profiles_for_emails(target_emails text[])
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  normalized_emails text[];
  email_item text;
  auth_user_id uuid;
  auth_email text;
  conflict_profile_user_id uuid;
  users_processed integer := 0;
  users_synced integer := 0;
  users_missing_auth integer := 0;
  users_with_profile_conflicts integer := 0;
begin
  if not public.is_admin_user() then
    raise exception 'Only admins can sync identity profiles.' using errcode = '42501';
  end if;

  select array_agg(distinct lower(trim(e)))
  into normalized_emails
  from unnest(coalesce(target_emails, '{}'::text[])) as e
  where lower(trim(e)) <> '';

  if coalesce(array_length(normalized_emails, 1), 0) = 0 then
    return jsonb_build_object(
      'processed', 0,
      'synced', 0,
      'missingAuth', 0,
      'profileConflicts', 0
    );
  end if;

  foreach email_item in array normalized_emails
  loop
    users_processed := users_processed + 1;

    select
      u.id,
      lower(trim(u.email))
    into auth_user_id, auth_email
    from auth.users u
    where u.email is not null
      and lower(trim(u.email)) = email_item
    order by u.created_at desc
    limit 1;

    if auth_user_id is null then
      users_missing_auth := users_missing_auth + 1;
      continue;
    end if;

    select up.user_id
    into conflict_profile_user_id
    from public.user_profiles up
    where lower(trim(up.email)) = email_item
      and up.user_id <> auth_user_id
    limit 1;

    if conflict_profile_user_id is not null then
      users_with_profile_conflicts := users_with_profile_conflicts + 1;
      continue;
    end if;

    insert into public.user_profiles (user_id, email, display_name, is_active)
    values (
      auth_user_id,
      auth_email,
      split_part(auth_email, '@', 1),
      true
    )
    on conflict (user_id) do update
    set email = excluded.email,
        display_name = excluded.display_name,
        is_active = true,
        updated_at = now();

    users_synced := users_synced + 1;
  end loop;

  return jsonb_build_object(
    'processed', users_processed,
    'synced', users_synced,
    'missingAuth', users_missing_auth,
    'profileConflicts', users_with_profile_conflicts
  );
end;
$$;

create or replace function public.admin_sync_identity_authorization_for_emails(target_emails text[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Backward-compatible alias retained for callers that still use the old name.
  -- This operation now performs identity/profile sync only.
  return public.admin_sync_identity_profiles_for_emails(target_emails);
end;
$$;

revoke all on function public.admin_get_auth_user_status(text) from public;
grant execute on function public.admin_get_auth_user_status(text) to authenticated;

revoke all on function public.admin_sync_identity_profiles_for_emails(text[]) from public;
grant execute on function public.admin_sync_identity_profiles_for_emails(text[]) to authenticated;

revoke all on function public.admin_sync_identity_authorization_for_emails(text[]) from public;
grant execute on function public.admin_sync_identity_authorization_for_emails(text[]) to authenticated;
