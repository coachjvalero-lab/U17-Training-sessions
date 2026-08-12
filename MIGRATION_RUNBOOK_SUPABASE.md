# Firebase -> Supabase Migration Runbook

## Scope

This runbook migrates the currently implemented Firebase domains to Supabase:

- auth and permissions foundations
- sessions (already migrated)
- squad
- attendance (excluded players)
- team logo
- exercise library + deleted IDs
- session cards
- fixtures
- video analysis
- physio

Firebase data is never deleted by these steps.

## 1) Apply SQL in Supabase

Run SQL in this order from Supabase SQL Editor:

1. supabase/phase1_schema.sql
2. supabase/phase2_auth_rls.sql
3. supabase/phase2b_identity_model.sql
4. supabase/phase2c_backfill_identity_from_user_roles.sql
5. supabase/phase3_domain_schema.sql
6. supabase/phase3_domain_rls.sql
7. supabase/migrations/20260812_authorization_section_simplified_foundation.sql
8. supabase/migrations/20260812_authorization_section_simplified_rls.sql
9. supabase/migrations/20260812_admin_identity_user_management_section_only.sql

Do NOT execute these superseded migrations for the section-only rollout:

- supabase/migrations/20260812_authorization_canonical_model.sql
- supabase/migrations/20260812_authorization_team_scope_rls.sql

See details in supabase/SUPERSEDED_AUTH_MIGRATIONS.md.

## 2) Environment checks

Ensure these vars are available in .env.local or .env:

- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- Firebase read vars used by migration scripts:
  - VITE_FIREBASE_API_KEY
  - VITE_FIREBASE_AUTH_DOMAIN
  - VITE_FIREBASE_PROJECT_ID
  - VITE_FIREBASE_STORAGE_BUCKET
  - VITE_FIREBASE_MESSAGING_SENDER_ID
  - VITE_FIREBASE_APP_ID
  - VITE_FIREBASE_DATABASE_ID

Recommended provider setup during migration:

- VITE_AUTH_PROVIDER=supabase
- VITE_PERMISSIONS_DATA_PROVIDER=supabase
- VITE_SESSIONS_DATA_PROVIDER=supabase
- VITE_DATA_PROVIDER=firebase (temporary until all runtime services switch)

## 3) Run data migrations

Permissions first:

- npm run migrate:permissions

Then run all domains:

- npm run migrate:all-domains

Or run one by one:

- npm run migrate:squad
- npm run migrate:attendance
- npm run migrate:team-logo
- npm run migrate:exercises
- npm run migrate:exercise-deleted-ids
- npm run migrate:session-cards
- npm run migrate:fixtures
- npm run migrate:video
- npm run migrate:physio

## 4) Validate app build

- npx tsc --noEmit
- npm run build

## 5) Runtime validation checklist

- login (supabase auth session exists)
- logout
- permissions load from public.user_section_access + public.app_sections
- sessions read/write
- squad read/create/edit/delete
- attendance excluded players read/write
- team logo read/write
- exercises read/create/edit/delete
- fixtures read/create/edit/delete
- video read/create/edit/delete
- physio read/create/edit/delete
- realtime subscriptions for all domains that used onSnapshot
- page reload consistency

## 6) Firebase OFF criteria

Firebase can be removed when all conditions are true:

- no firebase imports in src runtime files
- no firestore calls in app runtime
- no firebase auth calls in app runtime
- no firebase onSnapshot listeners
- no firebase pending write queue paths
- all migrated domains use Supabase APIs
- RLS works for all migrated tables
- realtime works for all required domains
- data counts and ID checks are clean

## 7) Section-only authorization checks

- app_sections includes all active modules:
  - football
  - fitness
  - gk
  - squad
  - attendance
  - physio
  - video
  - exercises
  - planning
  - meetings
- compare legacy vs new access via:
  - select * from public.admin_compare_legacy_and_section_access();
- conflict report review:
  - select * from public.authorization_section_backfill_conflicts order by created_at desc;
- frontend context RPC:
  - select public.get_my_allowed_sections();

After that:

- remove firebase SDK dependency
- delete or archive src/firebase.ts
- remove VITE_FIREBASE_* env vars
- remove VITE_DATA_PROVIDER and VITE_SESSIONS_DATA_PROVIDER toggles
- remove firestore.rules if Firebase is fully retired
