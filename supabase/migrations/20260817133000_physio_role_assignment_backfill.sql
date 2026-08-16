-- Physio authorization hotfix: ensure normalized role assignment exists for
-- users already marked as physio in legacy user_roles.
--
-- Why: Physio write policies now use public.can('physio', action, team_id),
-- which requires user_role_assignments + role-action grants + section access
-- + team membership. Some Physio users only have legacy user_roles.role='physio'
-- and section access, so writes are denied.
--
-- Scope: Physio role assignment backfill only. No policy changes.

insert into public.user_role_assignments (user_id, role_id, assigned_at)
select
  up.user_id,
  ar.id,
  now()
from public.user_profiles up
join public.user_roles ur
  on lower(trim(ur.email)) = lower(trim(up.email))
join public.app_roles ar
  on ar.key = 'physio'
where up.is_active = true
  and lower(trim(coalesce(ur.role, ''))) = 'physio'
on conflict (user_id, role_id) do nothing;
