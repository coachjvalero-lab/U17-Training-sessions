-- =============================================================================
-- Clean up existing matches data
-- Reset matches to empty state for fresh start
-- =============================================================================

-- Delete all matches (CASCADE will handle dependent records automatically)
-- This will delete:
-- - opponent_analysis (ON DELETE CASCADE from match_id)
-- - match_lineup_entries (ON DELETE CASCADE from match_id)
-- - match_events (ON DELETE CASCADE from match_id)
-- - player_match_statistics (ON DELETE CASCADE from match_id)
-- - match_plan (ON DELETE CASCADE from match_id)
-- - match_set_pieces (ON DELETE CASCADE from match_id)

DELETE FROM public.matches;

-- Verification
DO $$
DECLARE
  v_matches_count INTEGER;
  v_opponent_analysis_count INTEGER;
  v_lineup_count INTEGER;
  v_events_count INTEGER;
  v_stats_count INTEGER;
  v_plan_count INTEGER;
  v_setpieces_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_matches_count FROM public.matches;
  SELECT COUNT(*) INTO v_opponent_analysis_count FROM public.opponent_analysis;
  SELECT COUNT(*) INTO v_lineup_count FROM public.match_lineup_entries;
  SELECT COUNT(*) INTO v_events_count FROM public.match_events;
  SELECT COUNT(*) INTO v_stats_count FROM public.player_match_statistics;
  SELECT COUNT(*) INTO v_plan_count FROM public.match_plan;
  SELECT COUNT(*) INTO v_setpieces_count FROM public.match_set_pieces;

  RAISE NOTICE '=== Cleanup Complete ===';
  RAISE NOTICE 'Matches: %', v_matches_count;
  RAISE NOTICE 'Opponent Analysis: %', v_opponent_analysis_count;
  RAISE NOTICE 'Lineup Entries: %', v_lineup_count;
  RAISE NOTICE 'Match Events: %', v_events_count;
  RAISE NOTICE 'Player Statistics: %', v_stats_count;
  RAISE NOTICE 'Match Plans: %', v_plan_count;
  RAISE NOTICE 'Set Pieces: %', v_setpieces_count;
  
  IF v_matches_count = 0 THEN
    RAISE NOTICE 'SUCCESS: All matches and dependent data cleared.';
  ELSE
    RAISE WARNING 'UNEXPECTED: % matches remain', v_matches_count;
  END IF;
END $$;
