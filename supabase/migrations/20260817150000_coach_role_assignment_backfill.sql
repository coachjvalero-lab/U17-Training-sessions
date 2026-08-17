-- Coach role assignment backfill for the canonical authorization model.
--
-- Scope:
--   * assign the existing canonical coach role to the two coach users only
--   * do not assign admin to either user
--   * do not create or modify app_roles, app_section_actions,
--     app_role_section_action_grants, user_section_access, user_team_memberships,
--     or RLS policies
--   * allow idempotent reruns with ON CONFLICT DO NOTHING
--
-- The migration resolves the canonical coach role by key and matches the coach
-- profiles by their existing user_profiles.email values, including both the
-- full email and the local-part fallback used in some legacy records.

insert into public.user_role_assignments (user_id, role_id, assigned_at)
select
  up.user_id,
  ar.id,
  now()
from public.user_profiles up
join public.app_roles ar
  on ar.key = 'coach'
where (
    lower(trim(up.email)) in ('coachjavi@alula.com', 'coachwilian@alula.com')
    or lower(trim(split_part(up.email, '@', 1))) in ('coachjavi', 'coachwilian')
  )
on conflict (user_id, role_id) do nothing;

-- Verification-only notice: these users are expected to already belong to the
-- canonical team and to have the matching user_section_access rows for the coach
-- permission model. We intentionally do not mutate those tables here.
do $$
begin
  if exists (
    select 1
    from public.user_profiles up
    where (
      lower(trim(up.email)) in ('coachjavi@alula.com', 'coachwilian@alula.com')
      or lower(trim(split_part(up.email, '@', 1))) in ('coachjavi', 'coachwilian')
    )
      and not exists (
        select 1
        from public.user_team_memberships utm
        where utm.user_id = up.user_id
          and utm.team_id = 'u17-women-alula'
      )
  ) then
    raise notice 'coach user missing u17-women-alula membership; no membership change made in this migration';
  end if;

  if exists (
    select 1
    from public.user_profiles up
    where (
      lower(trim(up.email)) in ('coachjavi@alula.com', 'coachwilian@alula.com')
      or lower(trim(split_part(up.email, '@', 1))) in ('coachjavi', 'coachwilian')
    )
      and not exists (
        select 1
        from public.user_section_access usa
        join public.app_sections sec on sec.id = usa.section_id
        where usa.user_id = up.user_id
          and sec.key in ('fitness', 'meetings', 'football', 'planning')
      )
  ) then
    raise notice 'coach user missing canonical section access; no section access change made in this migration';
  end if;
end;
$$;
