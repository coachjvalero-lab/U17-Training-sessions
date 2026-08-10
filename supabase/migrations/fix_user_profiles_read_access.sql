-- =============================================================================
-- Fix: Allow authenticated users to read active user_profiles
-- Safe to run at any time, independently of other migrations.
-- Required for the Meetings module participant selector to populate.
-- =============================================================================

alter table public.user_profiles enable row level security;

-- Allow any authenticated user to see active profiles (needed for participant selectors)
drop policy if exists user_profiles_select_active on public.user_profiles;
create policy user_profiles_select_active
  on public.user_profiles
  for select
  to authenticated
  using (is_active = true);

-- Admins can see all profiles (including inactive)
drop policy if exists user_profiles_select_admin on public.user_profiles;
create policy user_profiles_select_admin
  on public.user_profiles
  for select
  to authenticated
  using (public.is_admin_user());

-- Own profile is always readable regardless of is_active
drop policy if exists user_profiles_select_own on public.user_profiles;
create policy user_profiles_select_own
  on public.user_profiles
  for select
  to authenticated
  using (user_id = auth.uid());
