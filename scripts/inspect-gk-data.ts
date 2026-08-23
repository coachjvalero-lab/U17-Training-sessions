/// <reference types="node" />

import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: ['.env.local', '.env'] });

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function requireSupabaseUrl(): string {
  const value = process.env.VITE_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim();
  if (!value) throw new Error('Missing required environment variable: VITE_SUPABASE_URL or SUPABASE_URL');
  return value;
}

const supabase = createClient(requireSupabaseUrl(), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
  console.log('--- Inspecting Supabase Data for GK ---');

  // 1. Check all sessions in public.sessions
  const { data: allSessions, error: sessErr } = await supabase
    .from('sessions')
    .select('*');

  if (sessErr) {
    console.error('Error querying public.sessions:', sessErr);
  } else {
    console.log(`Total sessions in public.sessions: ${allSessions?.length || 0}`);
    
    // Check which ones have GK data
    const withGkFields = (allSessions || []).filter((s) => {
      return (
        s.gk_updated_at !== null ||
        s.gk_warm_up !== null ||
        s.gk_main_part !== null ||
        s.gk_cool_down !== null ||
        s.gk_player_groups !== null
      );
    });
    console.log(`Sessions with non-null gk_* fields: ${withGkFields.length}`);

    // Also check if any session has warm_up/main_part/etc with exercises or if ALL sessions exist
    console.log('\nSample of all sessions found in public.sessions:');
    allSessions?.slice(0, 5).forEach((s) => {
      console.log(`- ID: ${s.id}, Session#: ${s.session_number}, Date: ${s.date}, gk_updated_at: ${s.gk_updated_at}, has_gk_warm_up: ${!!s.gk_warm_up}, has_gk_main: ${!!s.gk_main_part}`);
    });
  }

  // 2. Check public.gk_sessions
  const { data: gkSessions, error: gkErr } = await supabase
    .from('gk_sessions')
    .select('*');

  if (gkErr) {
    console.error('Error querying public.gk_sessions:', gkErr);
  } else {
    console.log(`\nTotal rows in public.gk_sessions: ${gkSessions?.length || 0}`);
    gkSessions?.forEach((g) => {
      console.log(`- GK Session ID: ${g.id}, session_uid: ${g.session_uid}, session_number: ${g.session_number}, date: ${g.date}`);
    });
  }

  // 3. Check public.session_catalog
  const { data: catalog, error: catErr } = await supabase
    .from('session_catalog')
    .select('*');

  if (catErr) {
    console.error('Error querying public.session_catalog:', catErr);
  } else {
    console.log(`\nTotal rows in public.session_catalog: ${catalog?.length || 0}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
