-- =============================================================================
-- Fix 42501 authorization error for Coach Shouq and coaching staff
-- Ensures:
-- 1. Automatic profile sync from auth.users -> user_profiles
-- 2. Coach Shouq (coachshouq@alula.com, shouq@alula.com, shouq, coachshouq) role and section access
-- 3. All coaching staff (Wilian, Marta, Joao, Javi, Shouq, Mariana) have full coach permissions
-- 4. Auth trigger to automatically provision user_profiles, team membership, and coach section access for newly registered users
-- =============================================================================

-- 1. Ensure any users in auth.users have matching user_profiles
insert into public.user_profiles (user_id, email, display_name, is_active, created_at, updated_at)
select
  au.id as user_id,
  lower(trim(au.email)) as email,
  coalesce(
    nullif(trim(au.raw_user_meta_data ->> 'display_name'), ''),
    nullif(trim(au.raw_user_meta_data ->> 'name'), ''),
    split_part(lower(trim(au.email)), '@', 1)
  ) as display_name,
  true as is_active,
  now() as created_at,
  now() as updated_at
from auth.users au
where au.email is not null
on conflict (user_id) do update
set
  email = excluded.email,
  is_active = true,
  updated_at = now();

-- 2. Ensure coach role exists in app_roles
insert into public.app_roles (key, label)
values
  ('coach', 'Coach'),
  ('admin', 'Administrator'),
  ('fitness_coach', 'Fitness Coach'),
  ('physio', 'Physiotherapist')
on conflict (key) do update
set label = excluded.label;

-- 3. Assign coach role in user_role_assignments for Coach Shouq & all coaches
insert into public.user_role_assignments (user_id, role_id, assigned_at)
select
  up.user_id,
  ar.id,
  now()
from public.user_profiles up
join public.app_roles ar on ar.key = 'coach'
where (
  lower(trim(up.email)) in (
    'coachshouq@alula.com', 'shouq@alula.com',
    'coachjavi@alula.com', 'javi@alula.com',
    'coachwilian@alula.com', 'wilian@alula.com',
    'coachmarta@alula.com', 'marta@alula.com',
    'coachjoao@alula.com', 'joao@alula.com',
    'coachmariana@alula.com', 'mariana@alula.com'
  )
  or lower(trim(split_part(up.email, '@', 1))) in (
    'coachshouq', 'shouq',
    'coachjavi', 'javi',
    'coachwilian', 'wilian',
    'coachmarta', 'marta',
    'coachjoao', 'joao',
    'coachmariana', 'mariana'
  )
)
on conflict (user_id, role_id) do nothing;

-- 4. Ensure team membership in user_team_memberships
insert into public.user_team_memberships (user_id, team_id, assigned_at)
select
  up.user_id,
  'u17-women-alula',
  now()
from public.user_profiles up
where (
  lower(trim(up.email)) in (
    'coachshouq@alula.com', 'shouq@alula.com',
    'coachjavi@alula.com', 'javi@alula.com',
    'coachwilian@alula.com', 'wilian@alula.com',
    'coachmarta@alula.com', 'marta@alula.com',
    'coachjoao@alula.com', 'joao@alula.com',
    'coachmariana@alula.com', 'mariana@alula.com'
  )
  or lower(trim(split_part(up.email, '@', 1))) in (
    'coachshouq', 'shouq',
    'coachjavi', 'javi',
    'coachwilian', 'wilian',
    'coachmarta', 'marta',
    'coachjoao', 'joao',
    'coachmariana', 'mariana'
  )
)
on conflict (user_id, team_id) do nothing;

-- 5. Assign section access in user_section_access for Coach Shouq & all coaches across all modules
insert into public.user_section_access (user_id, section_id, granted_at)
select
  up.user_id,
  sec.id,
  now()
from public.user_profiles up
cross join public.app_sections sec
where (
  lower(trim(up.email)) in (
    'coachshouq@alula.com', 'shouq@alula.com',
    'coachjavi@alula.com', 'javi@alula.com',
    'coachwilian@alula.com', 'wilian@alula.com',
    'coachmarta@alula.com', 'marta@alula.com',
    'coachjoao@alula.com', 'joao@alula.com',
    'coachmariana@alula.com', 'mariana@alula.com'
  )
  or lower(trim(split_part(up.email, '@', 1))) in (
    'coachshouq', 'shouq',
    'coachjavi', 'javi',
    'coachwilian', 'wilian',
    'coachmarta', 'marta',
    'coachjoao', 'joao',
    'coachmariana', 'mariana'
  )
)
and sec.key in (
  'football',
  'fitness',
  'gk',
  'squad',
  'attendance',
  'physio',
  'video',
  'exercises',
  'planning',
  'meetings'
)
on conflict (user_id, section_id) do nothing;

-- 6. Trigger function to auto-provision user_profiles and default coach section access on user signup/creation
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  norm_email text;
  disp_name text;
  target_role text := 'coach';
  role_uuid uuid;
begin
  norm_email := lower(trim(coalesce(new.email, '')));
  if norm_email = '' then
    return new;
  end if;

  disp_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    split_part(norm_email, '@', 1)
  );

  if norm_email = 'admin@alula.com' or norm_email like 'admin@%' or split_part(norm_email, '@', 1) = 'admin' then
    target_role := 'admin';
  end if;

  -- 1) Create or update profile
  insert into public.user_profiles (user_id, email, display_name, is_active, created_at, updated_at)
  values (new.id, norm_email, disp_name, true, now(), now())
  on conflict (user_id) do update
  set email = excluded.email,
      display_name = coalesce(user_profiles.display_name, excluded.display_name),
      is_active = true,
      updated_at = now();

  -- 2) Assign team membership
  insert into public.user_team_memberships (user_id, team_id, assigned_at)
  values (new.id, 'u17-women-alula', now())
  on conflict (user_id, team_id) do nothing;

  -- 3) Assign role
  select id into role_uuid from public.app_roles where key = target_role limit 1;
  if role_uuid is not null then
    insert into public.user_role_assignments (user_id, role_id, assigned_at)
    values (new.id, role_uuid, now())
    on conflict (user_id, role_id) do nothing;
  end if;

  -- 4) Grant section access for all standard sections
  insert into public.user_section_access (user_id, section_id, granted_at)
  select
    new.id,
    sec.id,
    now()
  from public.app_sections sec
  where sec.key in (
    'football',
    'fitness',
    'gk',
    'squad',
    'attendance',
    'physio',
    'video',
    'exercises',
    'planning',
    'meetings'
  )
  on conflict (user_id, section_id) do nothing;

  return new;
end;
$$;

-- Drop trigger if exists and recreate
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();
