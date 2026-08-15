#!/usr/bin/env tsx
/**
 * Inspect all matches to identify official SAFF fixtures vs test matches
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use service role to bypass RLS

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  console.error('VITE_SUPABASE_URL:', supabaseUrl);
  console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? '[present]' : '[missing]');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectMatches() {
  console.log('🔍 Fetching all matches...\n');

  const { data: matches, error } = await supabase
    .from('matches')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('❌ Error fetching matches:', error);
    process.exit(1);
  }

  if (!matches || matches.length === 0) {
    console.log('No matches found');
    return;
  }

  console.log(`Total matches: ${matches.length}\n`);
  console.log('='.repeat(120));

  // Group by criteria
  const officialFixtures: any[] = [];
  const testMatches: any[] = [];

  matches.forEach((match) => {
    // Official SAFF fixtures have fixture_id pattern 'saff-wpl-u17-2026-week-*'
    if (match.fixture_id && match.fixture_id.startsWith('saff-wpl-u17-2026-week-')) {
      officialFixtures.push(match);
    } else {
      testMatches.push(match);
    }
  });

  console.log('\n📋 OFFICIAL SAFF FIXTURES (14 expected):');
  console.log('='.repeat(120));
  officialFixtures.forEach((m, idx) => {
    console.log(`\n[${idx + 1}] ID: ${m.id}`);
    console.log(`    fixture_id: ${m.fixture_id}`);
    console.log(`    Date: ${m.date} ${m.time || ''}`);
    console.log(`    Opponent: ${m.opponent_team_id}`);
    console.log(`    Home: ${m.is_home ? 'Home' : 'Away'}`);
    console.log(`    Venue: ${m.venue}`);
    console.log(`    Competition: ${m.competition_name}`);
    console.log(`    Status: ${m.status}`);
    console.log(`    Scores: ${m.our_score ?? 'null'} - ${m.opponent_score ?? 'null'}`);
    console.log(`    Created: ${m.created_at}`);
  });

  console.log('\n\n🧪 TEST MATCHES (4 expected):');
  console.log('='.repeat(120));
  testMatches.forEach((m, idx) => {
    console.log(`\n[${idx + 1}] ID: ${m.id}`);
    console.log(`    fixture_id: ${m.fixture_id || 'NULL'}`);
    console.log(`    Date: ${m.date} ${m.time || ''}`);
    console.log(`    Opponent: ${m.opponent_team_id}`);
    console.log(`    Home: ${m.is_home ? 'Home' : 'Away'}`);
    console.log(`    Venue: ${m.venue || 'NULL'}`);
    console.log(`    Competition: ${m.competition_name || 'NULL'}`);
    console.log(`    Status: ${m.status}`);
    console.log(`    Scores: ${m.our_score ?? 'null'} - ${m.opponent_score ?? 'null'}`);
    console.log(`    Created: ${m.created_at}`);
  });

  console.log('\n\n📊 SUMMARY:');
  console.log('='.repeat(120));
  console.log(`Official SAFF fixtures: ${officialFixtures.length}`);
  console.log(`Test matches: ${testMatches.length}`);
  console.log(`Total: ${matches.length}`);

  console.log('\n\n✅ IDENTIFICATION CRITERIA:');
  console.log('='.repeat(120));
  console.log('Official SAFF fixtures:');
  console.log('  - fixture_id starts with "saff-wpl-u17-2026-week-"');
  console.log('  - competition_name = "Women\'s Premier League U-17"');
  console.log('  - team_id = "u17-women-alula"');
  console.log('  - All created by seed migration');
  console.log('\nTest matches:');
  console.log('  - fixture_id does NOT start with "saff-wpl-u17-2026-week-"');
  console.log('  - OR fixture_id is NULL');
  console.log('  - Created manually from app');

  console.log('\n\n🔍 SQL QUERY TO VERIFY TEST MATCHES TO DELETE:');
  console.log('='.repeat(120));
  console.log(`
SELECT 
  id,
  fixture_id,
  date,
  time,
  opponent_team_id,
  is_home,
  venue,
  competition_name,
  status,
  created_at
FROM public.matches
WHERE team_id = 'u17-women-alula'
  AND (
    fixture_id IS NULL 
    OR fixture_id NOT LIKE 'saff-wpl-u17-2026-week-%'
  )
ORDER BY created_at;
  `);

  console.log('\n🔍 COUNT VERIFICATION:');
  console.log('='.repeat(120));
  console.log(`
-- Should return exactly 4
SELECT COUNT(*) as test_matches_count
FROM public.matches
WHERE team_id = 'u17-women-alula'
  AND (
    fixture_id IS NULL 
    OR fixture_id NOT LIKE 'saff-wpl-u17-2026-week-%'
  );
  `);

  // Test IDs to delete
  if (testMatches.length > 0) {
    console.log('\n\n🗑️  IDs OF TEST MATCHES TO DELETE:');
    console.log('='.repeat(120));
    const testIds = testMatches.map(m => m.id);
    console.log(testIds.join('\n'));
  }
}

inspectMatches().catch(console.error);
