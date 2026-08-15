-- =============================================================================
-- Seed official SAFF fixtures for AlUla U17 Women
-- Source: https://www.saff.com.sa/en/championship.php?id=430&type=all
-- Competition: Women's Premier League U-17
-- Season: 2026-2027
-- Team: AlUla U17 Women
--
-- This is a ONE-TIME seed migration to populate the official calendar.
-- After this initial load, matches are managed exclusively through the app.
-- =============================================================================

DO $$
DECLARE
  v_alula_team_id TEXT := 'u17-women-alula';
  v_competition_name TEXT := 'Women''s Premier League U-17';
  v_opponent_id TEXT;
  v_inserted_count INTEGER := 0;
  v_skipped_count INTEGER := 0;
BEGIN
  RAISE NOTICE 'Starting SAFF fixtures seed for AlUla U17 Women...';

  -- Helper function to ensure opponent team exists
  CREATE TEMP TABLE temp_opponents (
    slug TEXT PRIMARY KEY,
    name TEXT NOT NULL
  );

  -- Define all opponent teams from SAFF
  INSERT INTO temp_opponents (slug, name) VALUES
    ('al-nassr-u17', 'Al Nassr'),
    ('jeddah-united-academy-u17', 'Jeddah United Academy'),
    ('al-hilal-u17', 'Al Hilal'),
    ('al-ahli-u17', 'Al Ahli'),
    ('al-qadisiyah-u17', 'Al Qadisiyah'),
    ('al-ittihad-u17', 'Al Ittihad'),
    ('najmat-jeddah-u17', 'Najmat Jeddah');

  -- Create/update opponent teams in auth_teams
  FOR v_opponent_id IN 
    SELECT slug FROM temp_opponents
  LOOP
    INSERT INTO public.auth_teams (id, name, is_active)
    SELECT slug, name, true
    FROM temp_opponents
    WHERE slug = v_opponent_id
    ON CONFLICT (id) DO UPDATE
    SET name = EXCLUDED.name,
        is_active = true,
        updated_at = NOW();
  END LOOP;

  RAISE NOTICE 'Opponent teams created/updated: %', (SELECT COUNT(*) FROM temp_opponents);

  -- Insert official SAFF fixtures (14 matches for AlUla)
  -- Week 1: AlUla vs Al Nassr (Home)
  INSERT INTO public.matches (
    team_id, opponent_team_id, fixture_id, competition_name, 
    date, time, venue, location, is_home, status
  )
  SELECT 
    v_alula_team_id,
    'al-nassr-u17',
    'saff-wpl-u17-2026-week-1',
    v_competition_name,
    '2026-09-11',
    '19:10',
    'Artificial stadium of Al Ula Club Academy (Al-Madinah)',
    'Al-Madinah',
    true,
    'planned'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.matches WHERE fixture_id = 'saff-wpl-u17-2026-week-1'
  );
  
  IF FOUND THEN v_inserted_count := v_inserted_count + 1; ELSE v_skipped_count := v_skipped_count + 1; END IF;

  -- Week 2: Jeddah United Academy vs AlUla (Away)
  INSERT INTO public.matches (
    team_id, opponent_team_id, fixture_id, competition_name,
    date, time, venue, location, is_home, status
  )
  SELECT 
    v_alula_team_id,
    'jeddah-united-academy-u17',
    'saff-wpl-u17-2026-week-2',
    v_competition_name,
    '2026-09-18',
    '19:00',
    'King Abdulaziz University Stadium (Jeddah)',
    'Jeddah',
    false,
    'planned'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.matches WHERE fixture_id = 'saff-wpl-u17-2026-week-2'
  );
  
  IF FOUND THEN v_inserted_count := v_inserted_count + 1; ELSE v_skipped_count := v_skipped_count + 1; END IF;

  -- Week 3: Al Hilal vs AlUla (Away)
  INSERT INTO public.matches (
    team_id, opponent_team_id, fixture_id, competition_name,
    date, time, venue, location, is_home, status
  )
  SELECT 
    v_alula_team_id,
    'al-hilal-u17',
    'saff-wpl-u17-2026-week-3',
    v_competition_name,
    '2026-09-22',
    '18:30',
    'Inaya Medical Colleges Stadium (Riyadh)',
    'Riyadh',
    false,
    'planned'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.matches WHERE fixture_id = 'saff-wpl-u17-2026-week-3'
  );
  
  IF FOUND THEN v_inserted_count := v_inserted_count + 1; ELSE v_skipped_count := v_skipped_count + 1; END IF;

  -- Week 4: AlUla vs Al Ahli (Home)
  INSERT INTO public.matches (
    team_id, opponent_team_id, fixture_id, competition_name,
    date, time, venue, location, is_home, status
  )
  SELECT 
    v_alula_team_id,
    'al-ahli-u17',
    'saff-wpl-u17-2026-week-4',
    v_competition_name,
    '2026-10-16',
    '15:50',
    'Artificial stadium of Al Ula Club Academy (Al-Madinah)',
    'Al-Madinah',
    true,
    'planned'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.matches WHERE fixture_id = 'saff-wpl-u17-2026-week-4'
  );
  
  IF FOUND THEN v_inserted_count := v_inserted_count + 1; ELSE v_skipped_count := v_skipped_count + 1; END IF;

  -- Week 5: Al Qadisiyah vs AlUla (Away)
  INSERT INTO public.matches (
    team_id, opponent_team_id, fixture_id, competition_name,
    date, time, venue, location, is_home, status
  )
  SELECT 
    v_alula_team_id,
    'al-qadisiyah-u17',
    'saff-wpl-u17-2026-week-5',
    v_competition_name,
    '2026-10-23',
    '15:00',
    'Reserve of Al-Qadisiyah Club Stadium (Al-Khobar)',
    'Al-Khobar',
    false,
    'planned'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.matches WHERE fixture_id = 'saff-wpl-u17-2026-week-5'
  );
  
  IF FOUND THEN v_inserted_count := v_inserted_count + 1; ELSE v_skipped_count := v_skipped_count + 1; END IF;

  -- Week 6: AlUla vs Al Ittihad (Home)
  INSERT INTO public.matches (
    team_id, opponent_team_id, fixture_id, competition_name,
    date, time, venue, location, is_home, status
  )
  SELECT 
    v_alula_team_id,
    'al-ittihad-u17',
    'saff-wpl-u17-2026-week-6',
    v_competition_name,
    '2026-10-30',
    '18:20',
    'Artificial stadium of Al Ula Club Academy (Al-Madinah)',
    'Al-Madinah',
    true,
    'planned'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.matches WHERE fixture_id = 'saff-wpl-u17-2026-week-6'
  );
  
  IF FOUND THEN v_inserted_count := v_inserted_count + 1; ELSE v_skipped_count := v_skipped_count + 1; END IF;

  -- Week 7: Najmat Jeddah vs AlUla (Away)
  INSERT INTO public.matches (
    team_id, opponent_team_id, fixture_id, competition_name,
    date, time, venue, location, is_home, status
  )
  SELECT 
    v_alula_team_id,
    'najmat-jeddah-u17',
    'saff-wpl-u17-2026-week-7',
    v_competition_name,
    '2026-11-06',
    '15:45',
    'Madira Stadium (Jeddah)',
    'Jeddah',
    false,
    'planned'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.matches WHERE fixture_id = 'saff-wpl-u17-2026-week-7'
  );
  
  IF FOUND THEN v_inserted_count := v_inserted_count + 1; ELSE v_skipped_count := v_skipped_count + 1; END IF;

  -- Week 8: Al Nassr vs AlUla (Away)
  INSERT INTO public.matches (
    team_id, opponent_team_id, fixture_id, competition_name,
    date, time, venue, location, is_home, status
  )
  SELECT 
    v_alula_team_id,
    'al-nassr-u17',
    'saff-wpl-u17-2026-week-8',
    v_competition_name,
    '2026-11-13',
    '15:10',
    'Reserve of Al-Nassr Club Stadium (Riyadh)',
    'Riyadh',
    false,
    'planned'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.matches WHERE fixture_id = 'saff-wpl-u17-2026-week-8'
  );
  
  IF FOUND THEN v_inserted_count := v_inserted_count + 1; ELSE v_skipped_count := v_skipped_count + 1; END IF;

  -- Week 9: AlUla vs Jeddah United Academy (Home)
  INSERT INTO public.matches (
    team_id, opponent_team_id, fixture_id, competition_name,
    date, time, venue, location, is_home, status
  )
  SELECT 
    v_alula_team_id,
    'jeddah-united-academy-u17',
    'saff-wpl-u17-2026-week-9',
    v_competition_name,
    '2026-12-11',
    '15:35',
    'Artificial stadium of Al Ula Club Academy (Al-Madinah)',
    'Al-Madinah',
    true,
    'planned'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.matches WHERE fixture_id = 'saff-wpl-u17-2026-week-9'
  );
  
  IF FOUND THEN v_inserted_count := v_inserted_count + 1; ELSE v_skipped_count := v_skipped_count + 1; END IF;

  -- Week 10: AlUla vs Al Hilal (Home)
  INSERT INTO public.matches (
    team_id, opponent_team_id, fixture_id, competition_name,
    date, time, venue, location, is_home, status
  )
  SELECT 
    v_alula_team_id,
    'al-hilal-u17',
    'saff-wpl-u17-2026-week-10',
    v_competition_name,
    '2027-01-22',
    '16:00',
    'Artificial stadium of Al Ula Club Academy (Al-Madinah)',
    'Al-Madinah',
    true,
    'planned'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.matches WHERE fixture_id = 'saff-wpl-u17-2026-week-10'
  );
  
  IF FOUND THEN v_inserted_count := v_inserted_count + 1; ELSE v_skipped_count := v_skipped_count + 1; END IF;

  -- Week 11: Al Ahli vs AlUla (Away)
  INSERT INTO public.matches (
    team_id, opponent_team_id, fixture_id, competition_name,
    date, time, venue, location, is_home, status
  )
  SELECT 
    v_alula_team_id,
    'al-ahli-u17',
    'saff-wpl-u17-2026-week-11',
    v_competition_name,
    '2027-01-29',
    '16:10',
    'Al-Ahli Club Academy Stadium (Jeddah)',
    'Jeddah',
    false,
    'planned'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.matches WHERE fixture_id = 'saff-wpl-u17-2026-week-11'
  );
  
  IF FOUND THEN v_inserted_count := v_inserted_count + 1; ELSE v_skipped_count := v_skipped_count + 1; END IF;

  -- Week 12: AlUla vs Al Qadisiyah (Home)
  INSERT INTO public.matches (
    team_id, opponent_team_id, fixture_id, competition_name,
    date, time, venue, location, is_home, status
  )
  SELECT 
    v_alula_team_id,
    'al-qadisiyah-u17',
    'saff-wpl-u17-2026-week-12',
    v_competition_name,
    '2027-02-05',
    '16:10',
    'Artificial stadium of Al Ula Club Academy (Al-Madinah)',
    'Al-Madinah',
    true,
    'planned'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.matches WHERE fixture_id = 'saff-wpl-u17-2026-week-12'
  );
  
  IF FOUND THEN v_inserted_count := v_inserted_count + 1; ELSE v_skipped_count := v_skipped_count + 1; END IF;

  -- Week 13: Al Ittihad vs AlUla (Away)
  INSERT INTO public.matches (
    team_id, opponent_team_id, fixture_id, competition_name,
    date, time, venue, location, is_home, status
  )
  SELECT 
    v_alula_team_id,
    'al-ittihad-u17',
    'saff-wpl-u17-2026-week-13',
    v_competition_name,
    '2027-02-12',
    '22:00',
    'Reserve No. (1) of Al-Ittihad Club Stadium (Jeddah)',
    'Jeddah',
    false,
    'planned'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.matches WHERE fixture_id = 'saff-wpl-u17-2026-week-13'
  );
  
  IF FOUND THEN v_inserted_count := v_inserted_count + 1; ELSE v_skipped_count := v_skipped_count + 1; END IF;

  -- Week 14: AlUla vs Najmat Jeddah (Home)
  INSERT INTO public.matches (
    team_id, opponent_team_id, fixture_id, competition_name,
    date, time, venue, location, is_home, status
  )
  SELECT 
    v_alula_team_id,
    'najmat-jeddah-u17',
    'saff-wpl-u17-2026-week-14',
    v_competition_name,
    '2027-02-19',
    '22:00',
    'Artificial stadium of Al Ula Club Academy (Al-Madinah)',
    'Al-Madinah',
    true,
    'planned'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.matches WHERE fixture_id = 'saff-wpl-u17-2026-week-14'
  );
  
  IF FOUND THEN v_inserted_count := v_inserted_count + 1; ELSE v_skipped_count := v_skipped_count + 1; END IF;

  DROP TABLE temp_opponents;

  RAISE NOTICE '=== Seed Summary ===';
  RAISE NOTICE 'Fixtures inserted: %', v_inserted_count;
  RAISE NOTICE 'Fixtures skipped (already exist): %', v_skipped_count;
  RAISE NOTICE 'Total AlUla fixtures: %', v_inserted_count + v_skipped_count;

END $$;

-- Verification
DO $$
DECLARE
  v_matches_count INTEGER;
  v_opponents_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_matches_count 
  FROM public.matches 
  WHERE team_id = 'u17-women-alula';

  SELECT COUNT(DISTINCT opponent_team_id) INTO v_opponents_count
  FROM public.matches
  WHERE team_id = 'u17-women-alula';

  RAISE NOTICE '=== Verification ===';
  RAISE NOTICE 'Total AlUla matches: %', v_matches_count;
  RAISE NOTICE 'Unique opponents: %', v_opponents_count;
  RAISE NOTICE 'All matches have status=planned: %', (
    SELECT COUNT(*) = v_matches_count 
    FROM public.matches 
    WHERE team_id = 'u17-women-alula' AND status = 'planned'
  );
  RAISE NOTICE 'No matches have scores: %', (
    SELECT COUNT(*) = v_matches_count
    FROM public.matches
    WHERE team_id = 'u17-women-alula' 
      AND our_score IS NULL 
      AND opponent_score IS NULL
  );
END $$;
