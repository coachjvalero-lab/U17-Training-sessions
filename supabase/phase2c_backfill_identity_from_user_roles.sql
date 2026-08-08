-- U17 Training Sessions - Supabase Phase 2c
-- Backfill normalized identity tables from existing public.user_roles.

insert into public.user_profiles (user_id, email, display_name, is_active)
select
  au.id as user_id,
  lower(au.email) as email,
  split_part(lower(au.email), '@', 1) as display_name,
  true as is_active
from auth.users au
where au.email is not null
on conflict (user_id) do update
set email = excluded.email,
    display_name = excluded.display_name,
    updated_at = now();

insert into public.user_role_assignments (user_id, role_id)
select
  up.user_id,
  ar.id as role_id
from public.user_roles ur
join public.user_profiles up on lower(trim(up.email)) = lower(trim(ur.email))
join public.app_roles ar on ar.key = ur.role
on conflict (user_id, role_id) do nothing;

insert into public.user_section_access (user_id, section_id)
select
  up.user_id,
  sec.id as section_id
from public.user_roles ur
join public.user_profiles up on lower(trim(up.email)) = lower(trim(ur.email))
cross join lateral unnest(coalesce(ur.allowed_sections, '{}'::text[])) as s(section_key)
join public.app_sections sec on sec.key = s.section_key
on conflict (user_id, section_id) do nothing;

-- Diagnostic only: these permission rows are preserved in public.user_roles,
-- but cannot be linked until the corresponding Supabase Auth user exists.
select
  ur.email as permission_email_without_auth_user,
  ur.role,
  ur.allowed_sections
from public.user_roles ur
where not exists (
  select 1
  from auth.users au
  where lower(trim(au.email)) = lower(trim(ur.email))
)
order by ur.email;
