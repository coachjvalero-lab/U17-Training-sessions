/// <reference types="node" />

import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: ['.env.local', '.env'] });

type SessionRow = {
  id: string;
  team_name: string | null;
  date: string | null;
  time: string | null;
  session_number: string | null;
  microcycle_day: string | null;
  main_objective: string | null;
  materials_needed: string | null;
  observations: string | null;
  squad_roster: any;
  attendance: any;
  fitness_warm_up: any;
  fitness_main_part: any;
  fitness_cool_down: any;
  fitness_player_groups: any;
  updated_at: number | null;
  fitness_updated_at: number | null;
};

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
  const dryRun = process.argv.includes('--dry-run');

  const { data: sessions, error: sessErr } = await supabase
    .from('sessions')
    .select('id,team_name,date,time,session_number,microcycle_day,main_objective,materials_needed,observations,squad_roster,attendance,fitness_warm_up,fitness_main_part,fitness_cool_down,fitness_player_groups,updated_at,fitness_updated_at');

  if (sessErr) throw sessErr;

  const candidates = ((sessions || []) as SessionRow[]).filter((session) =>
    session.fitness_updated_at !== null
    || session.fitness_warm_up !== null
    || session.fitness_main_part !== null
    || session.fitness_cool_down !== null
    || session.fitness_player_groups !== null
  );

  const now = Date.now();

  const catalogRows = candidates.map((session) => ({
    session_uid: session.id,
    session_number: session.session_number || '',
    session_date: session.date || new Date().toISOString().slice(0, 10),
    source_legacy_session_id: session.id,
    created_at: session.updated_at || now,
    updated_at: session.updated_at || now
  }));

  const fitnessRows = candidates.map((session) => ({
    id: `fit-${session.id}`,
    session_uid: session.id,
    legacy_session_id: session.id,
    team_name: session.team_name || 'U17 Women Al Ula',
    date: session.date || new Date().toISOString().slice(0, 10),
    time: session.time || '18:30 - 20:00',
    session_number: session.session_number || '',
    microcycle_day: session.microcycle_day || 'MD-3',
    main_objective: session.main_objective || '',
    materials_needed: session.materials_needed || '',
    observations: session.observations,
    squad_roster: session.squad_roster || [],
    attendance: session.attendance || [],
    warm_up: session.fitness_warm_up,
    main_part: session.fitness_main_part,
    cool_down: session.fitness_cool_down,
    player_groups: session.fitness_player_groups,
    created_at: session.fitness_updated_at || session.updated_at || now,
    updated_at: session.fitness_updated_at || session.updated_at || now
  }));

  if (!dryRun) {
    const { error: catalogErr } = await supabase
      .from('session_catalog')
      .upsert(catalogRows, { onConflict: 'session_uid' });
    if (catalogErr) throw catalogErr;

    const { error: fitnessErr } = await supabase
      .from('fitness_sessions')
      .upsert(fitnessRows, { onConflict: 'id' });
    if (fitnessErr) throw fitnessErr;
  }

  console.log(JSON.stringify({
    ok: true,
    dryRun,
    scannedSessions: (sessions || []).length,
    candidateFitnessSessions: candidates.length,
    upsertCatalogRows: catalogRows.length,
    upsertFitnessRows: fitnessRows.length
  }, null, 2));
}

main().catch((error) => {
  console.error('[backfill-fitness-sessions-from-legacy] failed:', error);
  process.exit(1);
});
