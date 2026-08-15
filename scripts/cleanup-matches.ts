/**
 * Cleanup script: Delete all matches and related records
 * Run with: npx tsx scripts/cleanup-matches.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase credentials in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function cleanup() {
  console.log('🧹 Starting matches cleanup...\n');

  try {
    // Count before deletion
    const { count: matchesBefore, error: countError } = await supabase
      .from('matches')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('❌ Error counting matches:', countError.message);
      return;
    }

    console.log(`📊 Matches before cleanup: ${matchesBefore || 0}`);

    // Delete all matches (CASCADE will handle dependent records)
    const { error: deleteError } = await supabase
      .from('matches')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (deleteError) {
      console.error('❌ Error deleting matches:', deleteError.message);
      return;
    }

    // Verify cleanup
    const { count: matchesAfter, error: verifyError } = await supabase
      .from('matches')
      .select('*', { count: 'exact', head: true });

    if (verifyError) {
      console.error('❌ Error verifying cleanup:', verifyError.message);
      return;
    }

    console.log(`📊 Matches after cleanup: ${matchesAfter || 0}`);

    // Count related tables
    const tables = [
      'opponent_analysis',
      'match_lineup_entries',
      'match_events',
      'player_match_statistics',
      'match_plan',
      'match_set_pieces'
    ];

    console.log('\n📋 Related tables:');
    for (const table of tables) {
      try {
        const { count, error } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });
        
        if (!error) {
          console.log(`   ${table}: ${count || 0} records`);
        }
      } catch (err) {
        // Table might not exist yet - that's ok
        console.log(`   ${table}: table not found (ok)`);
      }
    }

    console.log('\n✅ Cleanup complete!');
    console.log(`   Deleted: ${(matchesBefore || 0) - (matchesAfter || 0)} matches`);

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

cleanup();
