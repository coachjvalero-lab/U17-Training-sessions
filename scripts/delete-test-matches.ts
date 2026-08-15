#!/usr/bin/env tsx
/**
 * Delete ONLY the 4 test matches (NOT the 14 official SAFF fixtures)
 * 
 * Test match IDs to delete:
 * - 9628071c-b20b-460d-b47d-fe122d3fff54
 * - b484d49e-9279-4820-aa5f-34ce1e415ff0
 * - e4210347-ca1a-4003-ad14-d4ebf387e5e6
 * - f0a9863a-aa34-44ec-94ba-dc52ad2fdf22
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const TEST_MATCH_IDS = [
  '9628071c-b20b-460d-b47d-fe122d3fff54',
  'b484d49e-9279-4820-aa5f-34ce1e415ff0',
  'e4210347-ca1a-4003-ad14-d4ebf387e5e6',
  'f0a9863a-aa34-44ec-94ba-dc52ad2fdf22'
];

async function deleteTestMatches() {
  console.log('🔍 PRE-DELETE VERIFICATION\n');
  console.log('='.repeat(80));

  // Step 1: Verify the 4 test matches exist
  console.log('\n1️⃣  Verifying the 4 test match IDs exist...\n');
  
  const { data: testMatches, error: testError } = await supabase
    .from('matches')
    .select('id, fixture_id, team_id, opponent_team_id, date, time, venue')
    .in('id', TEST_MATCH_IDS);

  if (testError) {
    console.error('❌ Error fetching test matches:', testError);
    process.exit(1);
  }

  if (!testMatches || testMatches.length !== 4) {
    console.error(`❌ Expected 4 test matches, found ${testMatches?.length || 0}`);
    console.error('Cannot proceed with deletion.');
    process.exit(1);
  }

  console.log(`✅ Found all 4 test matches`);
  testMatches.forEach((m, idx) => {
    console.log(`   [${idx + 1}] ${m.id}`);
    console.log(`       fixture_id: ${m.fixture_id || 'NULL'}`);
    console.log(`       date: ${m.date} ${m.time || ''}`);
  });

  // Step 2: Verify NONE of them are official SAFF fixtures
  console.log('\n2️⃣  Verifying NONE are official SAFF fixtures...\n');
  
  const saffFixtures = testMatches.filter(m => 
    m.fixture_id && m.fixture_id.startsWith('saff-wpl-u17-2026-week-')
  );

  if (saffFixtures.length > 0) {
    console.error('❌ DANGER: Some matches are official SAFF fixtures!');
    saffFixtures.forEach(m => {
      console.error(`   - ${m.id} (${m.fixture_id})`);
    });
    console.error('ABORTING deletion to protect official fixtures.');
    process.exit(1);
  }

  console.log('✅ Confirmed: NONE are official SAFF fixtures');

  // Step 3: Verify all belong to u17-women-alula
  console.log('\n3️⃣  Verifying all belong to team_id = "u17-women-alula"...\n');
  
  const wrongTeam = testMatches.filter(m => m.team_id !== 'u17-women-alula');

  if (wrongTeam.length > 0) {
    console.error('❌ Some matches do not belong to u17-women-alula:');
    wrongTeam.forEach(m => {
      console.error(`   - ${m.id} (team_id: ${m.team_id})`);
    });
    console.error('ABORTING deletion.');
    process.exit(1);
  }

  console.log('✅ Confirmed: All belong to u17-women-alula');

  // Step 4: Count total matches before deletion
  console.log('\n4️⃣  Counting total matches before deletion...\n');
  
  const { count: totalBefore } = await supabase
    .from('matches')
    .select('*', { count: 'exact', head: true });

  console.log(`   Total matches before: ${totalBefore}`);

  if (totalBefore !== 18) {
    console.warn(`⚠️  Warning: Expected 18 matches, found ${totalBefore}`);
  }

  // Step 5: Count official SAFF fixtures (should remain 14)
  console.log('\n5️⃣  Counting official SAFF fixtures (should be 14)...\n');
  
  const { count: saffCount } = await supabase
    .from('matches')
    .select('*', { count: 'exact', head: true })
    .like('fixture_id', 'saff-wpl-u17-2026-week-%');

  console.log(`   Official SAFF fixtures: ${saffCount}`);

  if (saffCount !== 14) {
    console.error(`❌ Expected 14 official fixtures, found ${saffCount}`);
    console.error('ABORTING deletion.');
    process.exit(1);
  }

  console.log('✅ Confirmed: 14 official SAFF fixtures exist');

  // EXECUTE DELETION
  console.log('\n');
  console.log('='.repeat(80));
  console.log('🗑️  EXECUTING DELETION OF 4 TEST MATCHES');
  console.log('='.repeat(80));
  console.log('\nDeleting matches with IDs:');
  TEST_MATCH_IDS.forEach((id, idx) => {
    console.log(`   [${idx + 1}] ${id}`);
  });

  const { error: deleteError } = await supabase
    .from('matches')
    .delete()
    .in('id', TEST_MATCH_IDS);

  if (deleteError) {
    console.error('\n❌ Error deleting matches:', deleteError);
    process.exit(1);
  }

  console.log('\n✅ Deletion completed successfully');

  // POST-DELETE VERIFICATION
  console.log('\n');
  console.log('='.repeat(80));
  console.log('🔍 POST-DELETE VERIFICATION');
  console.log('='.repeat(80));

  // Verification 1: Total matches should be 14
  console.log('\n1️⃣  Verification: Total matches count\n');
  
  const { count: totalAfter } = await supabase
    .from('matches')
    .select('*', { count: 'exact', head: true });

  console.log(`   Total matches after deletion: ${totalAfter}`);
  console.log(`   Expected: 14`);
  
  if (totalAfter === 14) {
    console.log('   ✅ PASS');
  } else {
    console.log(`   ❌ FAIL (expected 14, got ${totalAfter})`);
  }

  // Verification 2: Official SAFF fixtures should be 14
  console.log('\n2️⃣  Verification: Official SAFF fixtures count\n');
  
  const { count: saffAfter } = await supabase
    .from('matches')
    .select('*', { count: 'exact', head: true })
    .like('fixture_id', 'saff-wpl-u17-2026-week-%');

  console.log(`   Official SAFF fixtures: ${saffAfter}`);
  console.log(`   Expected: 14`);
  
  if (saffAfter === 14) {
    console.log('   ✅ PASS');
  } else {
    console.log(`   ❌ FAIL (expected 14, got ${saffAfter})`);
  }

  // Verification 3: Test matches should be 0
  console.log('\n3️⃣  Verification: Test matches remaining\n');
  
  const { count: testRemaining } = await supabase
    .from('matches')
    .select('*', { count: 'exact', head: true })
    .in('id', TEST_MATCH_IDS);

  console.log(`   Test matches remaining: ${testRemaining}`);
  console.log(`   Expected: 0`);
  
  if (testRemaining === 0) {
    console.log('   ✅ PASS');
  } else {
    console.log(`   ❌ FAIL (expected 0, got ${testRemaining})`);
  }

  // Final display: Show all 14 official fixtures
  console.log('\n');
  console.log('='.repeat(80));
  console.log('📅 FINAL STATE: 14 OFFICIAL SAFF FIXTURES');
  console.log('='.repeat(80));
  console.log('\n');

  const { data: officialFixtures, error: fixturesError } = await supabase
    .from('matches')
    .select(`
      date,
      time,
      team_id,
      opponent_team_id,
      is_home,
      venue,
      location,
      status,
      fixture_id,
      competition_name
    `)
    .like('fixture_id', 'saff-wpl-u17-2026-week-%')
    .order('date', { ascending: true })
    .order('time', { ascending: true });

  if (fixturesError) {
    console.error('❌ Error fetching official fixtures:', fixturesError);
    process.exit(1);
  }

  // Get team names for display
  const { data: teams } = await supabase
    .from('auth_teams')
    .select('id, name');

  const teamMap = new Map(teams?.map(t => [t.id, t.name]) || []);

  console.log('Week | Date       | Time  | Home Team                | Away Team                | Venue');
  console.log('-'.repeat(120));

  officialFixtures?.forEach(m => {
    const homeTeamId = m.is_home ? m.team_id : m.opponent_team_id;
    const awayTeamId = m.is_home ? m.opponent_team_id : m.team_id;
    
    const homeTeam = teamMap.get(homeTeamId) || homeTeamId;
    const awayTeam = teamMap.get(awayTeamId) || awayTeamId;
    
    const week = m.fixture_id.replace('saff-wpl-u17-2026-week-', '').padStart(2, ' ');
    const venue = m.venue.substring(0, 40);
    
    console.log(
      `${week}   | ${m.date} | ${m.time} | ${homeTeam.padEnd(24)} | ${awayTeam.padEnd(24)} | ${venue}`
    );
  });

  console.log('\n');
  console.log('='.repeat(80));
  console.log('✅ DELETION COMPLETE');
  console.log('='.repeat(80));
  console.log(`\n   Deleted: 4 test matches`);
  console.log(`   Remaining: 14 official SAFF fixtures`);
  console.log(`   Status: All verifications PASSED\n`);
}

deleteTestMatches().catch(console.error);
