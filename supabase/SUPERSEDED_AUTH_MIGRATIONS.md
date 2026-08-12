# Superseded Authorization Migrations

The following migrations are intentionally superseded for the current rollout and must not be executed for the section-only authorization architecture:

- supabase/migrations/20260812_authorization_canonical_model.sql
- supabase/migrations/20260812_authorization_team_scope_rls.sql

Reason:

- Current product requirement is section-only authorization.
- Runtime model is: auth.uid -> user_profiles -> user_section_access -> module visibility + section-based RLS.
- Team membership and role->section->action runtime authorization are not part of the approved rollout.

Replacement migrations:

- supabase/migrations/20260812_authorization_section_simplified_foundation.sql
- supabase/migrations/20260812_authorization_section_simplified_rls.sql
- supabase/migrations/20260812_admin_identity_user_management_section_only.sql
