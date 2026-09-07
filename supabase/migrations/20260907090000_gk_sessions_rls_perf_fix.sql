-- GK sessions RLS read performance fix (SQLSTATE 57014 statement timeout)
-- Date: 2026-09-07
-- Scope: public.gk_sessions RLS policy ONLY. No other module touched.
--
-- Symptom (confirmed in production):
--   PostgREST repeatedly fails with:
--     SQLSTATE 57014 -- canceling statement due to statement timeout
--   on:
--     SELECT * FROM public.gk_sessions ORDER BY updated_at DESC
--
-- Confirmed production policy before this fix:
--   gk_sessions_section_gk
--   USING (user_has_section_access('gk'))
--   WITH CHECK (user_has_section_access('gk'))
--
-- Root cause (identified before making any change):
--   public.user_has_section_access(text) is `language sql stable security
--   definer`. Postgres NEVER inlines SECURITY DEFINER functions (documented
--   planner restriction), so every call is an opaque function invocation.
--   Internally it calls public.is_admin_user(), which is `language plpgsql
--   stable security definer` (even less inlineable) and runs its own
--   exists()/fallback checks.
--
--   The policy calls this function directly: `USING (user_has_section_access
--   ('gk'))`. The argument 'gk' is a constant and does not reference any
--   column of gk_sessions, so in principle the result could be computed once
--   per statement. However, because it is a plain (non-inlineable) function
--   call rather than a scalar subquery, Postgres does NOT hoist it into a
--   one-time InitPlan -- it re-evaluates the function via ExecQual for every
--   row candidate produced by the scan. This is the well-documented Postgres/
--   Supabase RLS performance pitfall: "wrap function calls used in policies in
--   a `select` so they are evaluated once, not once per row."
--
--   With `SELECT * ... ORDER BY updated_at DESC`, Postgres must evaluate the
--   RLS qual for every candidate row before it can produce the ordered
--   result, multiplying the (otherwise cheap, well-indexed) function cost by
--   the row count and driving the query past the statement timeout.
--
--   The supporting tables used inside user_has_section_access/is_admin_user
--   (user_profiles, user_section_access, app_sections, user_role_assignments)
--   already have correct primary-key/lookup indexes -- this is NOT a missing
--   index problem.
--
-- Fix (minimal, scoped, logically identical):
--   Wrap the function call in a scalar subselect: `(select
--   public.user_has_section_access('gk'))`. This is the standard, minimal fix
--   for exactly this pattern: it forces Postgres to compute the boolean once
--   per statement (InitPlan) and reuse the cached result for every row,
--   instead of re-invoking the function per row. The authorization result is
--   byte-for-byte identical -- only the evaluation count changes.
--
--   public.user_has_section_access() and public.is_admin_user() themselves
--   are NOT modified, so every other module's RLS (football, fitness, physio,
--   sessions, etc.) is completely unaffected.
--
-- Apply manually after review. Do NOT run `supabase db push` automatically.

begin;

drop policy if exists gk_sessions_section_gk on public.gk_sessions;
create policy gk_sessions_section_gk
  on public.gk_sessions
  for all
  to authenticated
  using ((select public.user_has_section_access('gk')))
  with check ((select public.user_has_section_access('gk')));

commit;
