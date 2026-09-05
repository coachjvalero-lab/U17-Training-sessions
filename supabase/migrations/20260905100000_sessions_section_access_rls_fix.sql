-- Fix: saving a football training session failed with 42501 for coaches whose access is
-- granted only through Administrator Hub (public.user_section_access).
--
-- Root cause: policy `sessions_write_by_section` on public.sessions used the LEGACY helper
-- public.has_section_access(text), which is defined as public.can(section, 'read', null) and
-- therefore requires a row in public.user_role_assignments. Section-only users (e.g. user
-- 63bdf6cf-6eb8-4a09-8996-bd3c82850257, team u17-women-alula) have `football` in
-- user_section_access but no role assignment, so the WITH CHECK evaluated to false on
-- insert/update -> 42501 permission denied.
--
-- Fix: use the canonical helper public.user_has_section_access(text), which reads
-- user_section_access (the model Administrator Hub actually writes). Same three sections as
-- before -- no section is added or removed, no other table's policies are touched.
-- public.sessions has no team_id column (team scoping lives in team_name only), so this stays
-- section-scoped exactly as it was.

drop policy if exists sessions_write_by_section on public.sessions;

create policy sessions_write_by_section
  on public.sessions
  for all
  to authenticated
  using (
    public.user_has_section_access('football')
    or public.user_has_section_access('fitness')
    or public.user_has_section_access('gk')
  )
  with check (
    public.user_has_section_access('football')
    or public.user_has_section_access('fitness')
    or public.user_has_section_access('gk')
  );
