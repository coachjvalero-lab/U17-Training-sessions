/// <reference types="node" />

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

console.log('ENV keys present:', {
  VITE_SUPABASE_URL: !!process.env.VITE_SUPABASE_URL,
  SUPABASE_URL: !!process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  VITE_SUPABASE_ANON_KEY: !!process.env.VITE_SUPABASE_ANON_KEY,
  SUPABASE_ANON_KEY: !!process.env.SUPABASE_ANON_KEY,
  SUPABASE_KEY: !!process.env.SUPABASE_KEY
});

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!url || !key) {
  console.log('Cannot connect to Supabase: Missing URL or KEY');
  process.exit(0);
}

const client = createClient(url, key, { auth: { persistSession: false } });

async function check() {
  console.log('Connecting to Supabase at:', url);
  const { data: sessions, error: sErr } = await client.from('sessions').select('id, session_number, date, gk_updated_at, gk_warm_up, gk_main_part, gk_cool_down, gk_player_groups, warm_up, main_part');
  if (sErr) console.error('sessions error:', sErr);
  else {
    console.log(`Total sessions in public.sessions: ${sessions?.length}`);
    sessions?.forEach(s => {
      const hasGkWarm = s.gk_warm_up && (s.gk_warm_up.exercises?.length > 0 || Object.keys(s.gk_warm_up).length > 0);
      const hasGkMain = s.gk_main_part && (s.gk_main_part.exercises?.length > 0 || Object.keys(s.gk_main_part).length > 0);
      console.log(`Session ID=${s.id}, #${s.session_number}, date=${s.date}, gk_updated_at=${s.gk_updated_at}, has_gk_warm=${!!hasGkWarm}, has_gk_main=${!!hasGkMain}`);
    });
  }

  const { data: gkSess, error: gkErr } = await client.from('gk_sessions').select('*');
  if (gkErr) console.error('gk_sessions error:', gkErr);
  else {
    console.log(`Total rows in public.gk_sessions: ${gkSess?.length}`);
    gkSess?.forEach(g => {
      console.log(`GK ID=${g.id}, session_uid=${g.session_uid}, #${g.session_number}, date=${g.date}`);
    });
  }
}

check().catch(console.error);
