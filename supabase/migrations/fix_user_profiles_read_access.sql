-- =============================================================================
-- Fix: Allow authenticated users to read active user_profiles
-- Safe to run at any time, independently of other migrations.
-- Required for the Meetings module participant selector to populate.
-- =============================================================================

alter table public.user_profiles enable row level security;

-- Any authenticated user can read active profiles (needed for participant selectors)
drop policy if exists user_profiles_select_active on public.user_profiles;
create policy user_profiles_select_active
  on public.user_profiles
  for select
  to authenticated
  using (is_active = true);

-- Users can always read their own profile regardless of is_active
drop policy if exists user_profiles_select_own on public.user_profiles;
create policy user_profiles_select_own
  on public.user_profiles
  for select
  to authenticated
  using (user_id = auth.uid());
