-- =============================================================================
-- Remove foreign key constraint from matches.fixture_id to competition_fixtures
-- 
-- Problem: matches.fixture_id has FK constraint to competition_fixtures (legacy)
-- Solution: Drop FK, keep fixture_id as simple unique identifier
--
-- This allows matches to be independent and not require competition_fixtures.
-- fixture_id becomes an optional unique identifier for matches.
-- =============================================================================

-- Drop the foreign key constraint
ALTER TABLE public.matches
  DROP CONSTRAINT IF EXISTS matches_fixture_id_fkey;

-- Verify: fixture_id remains as nullable text with unique index
-- (unique index already exists from 20260814_match_centre_canonical_model.sql)

-- Add comment to clarify new usage
COMMENT ON COLUMN public.matches.fixture_id IS 
  'Optional unique identifier for the match (e.g., saff-wpl-u17-2026-week-1). Not a foreign key.';
