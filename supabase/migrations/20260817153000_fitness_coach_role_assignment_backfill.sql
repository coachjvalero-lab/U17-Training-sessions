-- Fitness Coach authorization hotfix: ensure normalized role assignment exists
-- for active users already marked as fitness_coach in legacy user_roles.
--
-- Scope: Fitness Coach role assignment backfill only. No grants, section access,
-- team membership, authorization functions, or RLS policies are changed.

insert into public.user_role_assignments (user_id, role_id, assigned_at)
select
  up.user_id,
  ar.id,
  now()
from public.user_profiles up
join public.user_roles ur
  on lower(trim(ur.email)) = lower(trim(up.email))
join public.app_roles ar
  on ar.key = 'fitness_coach'
where up.is_active = true
  and lower(trim(coalesce(ur.role, ''))) = 'fitness_coach'
on conflict (user_id, role_id) do nothing;