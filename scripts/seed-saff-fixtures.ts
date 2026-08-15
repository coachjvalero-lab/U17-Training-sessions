/**
 * Seed SAFF fixtures for AlUla U17 Women
 * Source: https://www.saff.com.sa/en/championship.php?id=430&type=all
 * Run with: npx tsx scripts/seed-saff-fixtures.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Using service role key to bypass RLS

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const ALULA_TEAM_ID = 'u17-women-alula';
const COMPETITION_NAME = "Women's Premier League U-17";

// Opponent teams to create
const OPPONENTS = [
  { id: 'al-nassr-u17', name: 'Al Nassr' },
  { id: 'jeddah-united-academy-u17', name: 'Jeddah United Academy' },
  { id: 'al-hilal-u17', name: 'Al Hilal' },
  { id: 'al-ahli-u17', name: 'Al Ahli' },
  { id: 'al-qadisiyah-u17', name: 'Al Qadisiyah' },
  { id: 'al-ittihad-u17', name: 'Al Ittihad' },
  { id: 'najmat-jeddah-u17', name: 'Najmat Jeddah' }
];

// Official SAFF fixtures
const FIXTURES = [
  { week: 1, opponent: 'al-nassr-u17', date: '2026-09-11', time: '19:10', isHome: true, venue: 'Artificial stadium of Al Ula Club Academy (Al-Madinah)', location: 'Al-Madinah' },
  { week: 2, opponent: 'jeddah-united-academy-u17', date: '2026-09-18', time: '19:00', isHome: false, venue: 'King Abdulaziz University Stadium (Jeddah)', location: 'Jeddah' },
  { week: 3, opponent: 'al-hilal-u17', date: '2026-09-22', time: '18:30', isHome: false, venue: 'Inaya Medical Colleges Stadium (Riyadh)', location: 'Riyadh' },
  { week: 4, opponent: 'al-ahli-u17', date: '2026-10-16', time: '15:50', isHome: true, venue: 'Artificial stadium of Al Ula Club Academy (Al-Madinah)', location: 'Al-Madinah' },
  { week: 5, opponent: 'al-qadisiyah-u17', date: '2026-10-23', time: '15:00', isHome: false, venue: 'Reserve of Al-Qadisiyah Club Stadium (Al-Khobar)', location: 'Al-Khobar' },
  { week: 6, opponent: 'al-ittihad-u17', date: '2026-10-30', time: '18:20', isHome: true, venue: 'Artificial stadium of Al Ula Club Academy (Al-Madinah)', location: 'Al-Madinah' },
  { week: 7, opponent: 'najmat-jeddah-u17', date: '2026-11-06', time: '15:45', isHome: false, venue: 'Madira Stadium (Jeddah)', location: 'Jeddah' },
  { week: 8, opponent: 'al-nassr-u17', date: '2026-11-13', time: '15:10', isHome: false, venue: 'Reserve of Al-Nassr Club Stadium (Riyadh)', location: 'Riyadh' },
  { week: 9, opponent: 'jeddah-united-academy-u17', date: '2026-12-11', time: '15:35', isHome: true, venue: 'Artificial stadium of Al Ula Club Academy (Al-Madinah)', location: 'Al-Madinah' },
  { week: 10, opponent: 'al-hilal-u17', date: '2027-01-22', time: '16:00', isHome: true, venue: 'Artificial stadium of Al Ula Club Academy (Al-Madinah)', location: 'Al-Madinah' },
  { week: 11, opponent: 'al-ahli-u17', date: '2027-01-29', time: '16:10', isHome: false, venue: 'Al-Ahli Club Academy Stadium (Jeddah)', location: 'Jeddah' },
  { week: 12, opponent: 'al-qadisiyah-u17', date: '2027-02-05', time: '16:10', isHome: true, venue: 'Artificial stadium of Al Ula Club Academy (Al-Madinah)', location: 'Al-Madinah' },
  { week: 13, opponent: 'al-ittihad-u17', date: '2027-02-12', time: '22:00', isHome: false, venue: 'Reserve No. (1) of Al-Ittihad Club Stadium (Jeddah)', location: 'Jeddah' },
  { week: 14, opponent: 'najmat-jeddah-u17', date: '2027-02-19', time: '22:00', isHome: true, venue: 'Artificial stadium of Al Ula Club Academy (Al-Madinah)', location: 'Al-Madinah' }
];

async function seed() {
  console.log('🌱 Seeding SAFF fixtures for AlUla U17 Women...\n');

  try {
    // 1. Create opponent teams
    console.log('📝 Creating opponent teams...');
    for (const opponent of OPPONENTS) {
      const { error } = await supabase
        .from('auth_teams')
        .upsert({ 
          id: opponent.id, 
          name: opponent.name, 
          is_active: true 
        }, { onConflict: 'id' });

      if (error) {
        console.warn(`⚠️  Warning creating team ${opponent.name}:`, error.message);
      } else {
        console.log(`  ✓ ${opponent.name}`);
      }
    }

    // 2. Insert fixtures
    console.log('\n⚽ Inserting official fixtures...');
    let inserted = 0;
    let skipped = 0;

    for (const fixture of FIXTURES) {
      const fixtureId = `saff-wpl-u17-2026-week-${fixture.week}`;

      // Check if fixture already exists
      const { data: existing } = await supabase
        .from('matches')
        .select('id')
        .eq('fixture_id', fixtureId)
        .maybeSingle();

      if (existing) {
        skipped++;
        continue;
      }

      // Insert new fixture
      const { error } = await supabase
        .from('matches')
        .insert({
          team_id: ALULA_TEAM_ID,
          opponent_team_id: fixture.opponent,
          fixture_id: fixtureId,
          competition_name: COMPETITION_NAME,
          date: fixture.date,
          time: fixture.time,
          venue: fixture.venue,
          location: fixture.location,
          is_home: fixture.isHome,
          status: 'planned',
          our_score: null,
          opponent_score: null
        });

      if (error) {
        console.error(`  ❌ Week ${fixture.week}:`, error.message);
      } else {
        inserted++;
        console.log(`  ✓ Week ${fixture.week}: vs ${fixture.opponent} (${fixture.isHome ? 'Home' : 'Away'})`);
      }
    }

    // 3. Verify
    const { count } = await supabase
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', ALULA_TEAM_ID);

    console.log('\n=== Seed Summary ===');
    console.log(`Fixtures inserted: ${inserted}`);
    console.log(`Fixtures skipped: ${skipped}`);
    console.log(`Total AlUla matches: ${count || 0}`);
    console.log('\n✅ Seed complete!');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

seed();
