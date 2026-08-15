/**
 * Verify seed data and opponent team names
 * Run with: npx tsx scripts/verify-seed-data.ts
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

async function verify() {
  console.log('🔍 Verifying seed data...\n');

  // Check opponent teams
  const { data: teams, error: teamsError } = await supabase
    .from('auth_teams')
    .select('id, name')
    .in('id', [
      'al-nassr-u17',
      'jeddah-united-academy-u17',
      'al-hilal-u17',
      'al-ahli-u17',
      'al-qadisiyah-u17',
      'al-ittihad-u17',
      'najmat-jeddah-u17'
    ]);

  if (teamsError) {
    console.error('❌ Error fetching teams:', teamsError.message);
  } else {
    console.log('📊 Opponent teams in auth_teams:');
    teams?.forEach(team => {
      console.log(`  ${team.id} → "${team.name}"`);
    });
  }

  // Check matches
  const { data: matches, error: matchesError } = await supabase
    .from('matches')
    .select(`
      id,
      opponent_team_id,
      date,
      opponent_team:auth_teams!matches_opponent_team_id_fkey(name)
    `)
    .eq('team_id', 'u17-women-alula')
    .order('date', { ascending: true })
    .limit(5);

  if (matchesError) {
    console.error('\n❌ Error fetching matches:', matchesError.message);
  } else {
    console.log('\n📅 First 5 matches with JOIN:');
    matches?.forEach((match: any) => {
      console.log(`  ${match.date}: opponent_team_id="${match.opponent_team_id}" → name="${match.opponent_team?.name || 'NULL'}"`);
    });
  }

  // Count total
  const { count } = await supabase
    .from('matches')
    .select('*', { count: 'exact', head: true })
    .eq('team_id', 'u17-women-alula');

  console.log(`\n📊 Total AlUla matches: ${count || 0}`);
}

verify();
