-- =============================================================================
-- Migrate competition_fixtures to canonical matches
-- 
-- This migration moves historical fixture data from the legacy
-- competition_fixtures table to the canonical matches table.
--
-- Strategy:
-- 1. Create opponent teams in auth_teams if they don't exist
-- 2. Map legacy fixtures to canonical matches using fixture_id for deduplication
-- 3. Preserve results (ourGoals -> our_score, opponentGoals -> opponent_score)
-- 4. Map location to is_home boolean
-- 5. Map status ('Scheduled' -> 'planned', 'Played' -> 'played')
--
-- Idempotent: Safe to run multiple times (uses fixture_id unique constraint)
-- =============================================================================

do $$
declare
  v_fixture_count integer;
  v_migrated_count integer;
  v_skipped_count integer;
  v_our_team_id text := 'u17-women-alula';
  v_fixture record;
  v_opponent_team_id text;
  v_opponent_slug text;
  v_result jsonb;
  v_our_score integer;
  v_opponent_score integer;
  v_status text;
  v_is_home boolean;
begin
  -- Count total legacy fixtures
  select count(*) into v_fixture_count
  from public.competition_fixtures;

  raise notice 'Found % legacy fixtures to migrate', v_fixture_count;

  v_migrated_count := 0;
  v_skipped_count := 0;

  -- Process each legacy fixture
  for v_fixture in
    select
      id,
      opponent,
      date,
      time,
      location,
      venue,
      competition_name,
      matchday,
      status,
      result,
      tactical_notes,
      updated_at
    from public.competition_fixtures
    order by date desc
  loop
    -- Check if already migrated (using fixture_id unique constraint)
    if exists (
      select 1 from public.matches
      where fixture_id = v_fixture.id
    ) then
      v_skipped_count := v_skipped_count + 1;
      raise notice 'Skipping already-migrated fixture: %', v_fixture.id;
      continue;
    end if;

    -- Create opponent team slug from opponent name
    -- Convert "Al Hilal U17" -> "al-hilal-u17"
    v_opponent_slug := lower(
      regexp_replace(
        regexp_replace(trim(v_fixture.opponent), '\s+', '-', 'g'),
        '[^a-z0-9-]',
        '',
        'g'
      )
    );

    -- Ensure opponent team exists in auth_teams
    -- Try to find existing team by exact name match first
    select id into v_opponent_team_id
    from public.auth_teams
    where lower(trim(name)) = lower(trim(v_fixture.opponent))
    limit 1;

    -- If not found, try to find by slug match
    if v_opponent_team_id is null then
      select id into v_opponent_team_id
      from public.auth_teams
      where id = v_opponent_slug
      limit 1;
    end if;

    -- If still not found, create new opponent team
    if v_opponent_team_id is null then
      v_opponent_team_id := v_opponent_slug;
      
      insert into public.auth_teams (id, name, is_active)
      values (v_opponent_team_id, trim(v_fixture.opponent), true)
      on conflict (id) do update
      set name = excluded.name,
          updated_at = now();

      raise notice 'Created opponent team: % (id: %)', v_fixture.opponent, v_opponent_team_id;
    else
      raise notice 'Using existing opponent team: % (id: %)', v_fixture.opponent, v_opponent_team_id;
    end if;

    -- Parse result JSON
    v_result := v_fixture.result;
    v_our_score := null;
    v_opponent_score := null;

    if v_result is not null then
      begin
        v_our_score := (v_result->>'ourGoals')::integer;
        v_opponent_score := (v_result->>'opponentGoals')::integer;
      exception when others then
        raise notice 'Could not parse result for fixture %: %', v_fixture.id, v_result;
      end;
    end if;

    -- Map location to is_home
    v_is_home := case
      when v_fixture.location = 'Home' then true
      when v_fixture.location = 'Away' then false
      else true -- default to home for 'Neutral' or unknown
    end;

    -- Map status
    v_status := case
      when v_fixture.status in ('Played', 'played') then 'played'
      when v_fixture.status in ('Scheduled', 'scheduled', 'Postponed', 'postponed') then 'planned'
      else 'planned' -- default to planned
    end;

    -- If we have scores, ensure status is 'played'
    if v_our_score is not null and v_opponent_score is not null then
      v_status := 'played';
    end if;

    -- Insert into canonical matches table
    begin
      insert into public.matches (
        team_id,
        opponent_team_id,
        fixture_id,
        competition_name,
        date,
        time,
        venue,
        location,
        is_home,
        status,
        our_score,
        opponent_score,
        created_at,
        updated_at
      ) values (
        v_our_team_id,
        v_opponent_team_id,
        v_fixture.id,
        coalesce(v_fixture.competition_name, 'U17 League'),
        v_fixture.date,
        v_fixture.time,
        v_fixture.venue,
        v_fixture.location,
        v_is_home,
        v_status,
        v_our_score,
        v_opponent_score,
        to_timestamp(v_fixture.updated_at / 1000.0),
        to_timestamp(v_fixture.updated_at / 1000.0)
      );

      v_migrated_count := v_migrated_count + 1;
      
      if v_our_score is not null and v_opponent_score is not null then
        raise notice 'Migrated fixture % with result: % - %', 
          v_fixture.id, v_our_score, v_opponent_score;
      else
        raise notice 'Migrated fixture % (no result yet)', v_fixture.id;
      end if;

    exception when others then
      raise warning 'Failed to migrate fixture %: %', v_fixture.id, SQLERRM;
    end;
  end loop;

  raise notice '=== Migration Summary ===';
  raise notice 'Total fixtures found: %', v_fixture_count;
  raise notice 'Successfully migrated: %', v_migrated_count;
  raise notice 'Skipped (already migrated): %', v_skipped_count;
  raise notice 'Failed: %', v_fixture_count - v_migrated_count - v_skipped_count;

end $$;

-- Verify migration results
do $$
declare
  v_matches_count integer;
  v_played_matches_count integer;
  v_fixtures_count integer;
begin
  select count(*) into v_matches_count from public.matches;
  select count(*) into v_played_matches_count from public.matches where status = 'played';
  select count(*) into v_fixtures_count from public.competition_fixtures;

  raise notice '=== Verification ===';
  raise notice 'Total canonical matches: %', v_matches_count;
  raise notice 'Played matches with results: %', v_played_matches_count;
  raise notice 'Legacy fixtures remaining: %', v_fixtures_count;
end $$;
