-- U17 Training Sessions - Supabase Phase 2b (Identity and permissions model)
-- Goal: separate ROLE from SECTION ACCESS and prepare long-term growth.
-- Compatible with existing public.user_roles table.

create extension if not exists pgcrypto;

create table if not exists public.app_roles (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_sections (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_role_assignments (
  user_id uuid not null references public.user_profiles(user_id) on delete cascade,
  role_id uuid not null references public.app_roles(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  assigned_by uuid,
  primary key (user_id, role_id)
);

create table if not exists public.user_section_access (
  user_id uuid not null references public.user_profiles(user_id) on delete cascade,
  section_id uuid not null references public.app_sections(id) on delete cascade,
  granted_at timestamptz not null default now(),
  granted_by uuid,
  primary key (user_id, section_id)
);

create index if not exists user_profiles_email_idx on public.user_profiles (email);
create index if not exists user_role_assignments_role_idx on public.user_role_assignments (role_id);
create index if not exists user_section_access_section_idx on public.user_section_access (section_id);

insert into public.app_roles (key, label)
values
  ('admin', 'Admin'),
  ('coach', 'Coach'),
  ('fitness_coach', 'Fitness Coach'),
  ('gk_coach', 'GK Coach'),
  ('physio', 'Physio Staff'),
  ('analyst', 'Video Analyst'),
  ('custom', 'Custom')
on conflict (key) do update
set label = excluded.label,
    updated_at = now();

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
  ('planning', 'Planification and Microcycle')
on conflict (key) do update
set label = excluded.label,
    updated_at = now();

-- Compatibility view so existing app code can keep reading role + allowed sections shape.
create or replace view public.user_roles_v2 as
select
  up.email,
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
  ) as role,
  coalesce(
    (
      select array_agg(distinct sec.key order by sec.key)
      from public.user_section_access usa
      join public.app_sections sec on sec.id = usa.section_id
      where usa.user_id = up.user_id
    ),
    '{}'::text[]
  ) as allowed_sections,
  up.updated_at,
  up.created_at
from public.user_profiles up;
