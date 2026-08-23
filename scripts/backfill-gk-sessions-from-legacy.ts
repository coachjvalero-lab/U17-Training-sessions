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
  gk_warm_up: any;
  gk_main_part: any;
  gk_cool_down: any;
  gk_player_groups: any;
  updated_at: number | null;
  gk_updated_at: number | null;
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

  // 1. Fetch all legacy sessions
  const { data: sessions, error: sessErr } = await supabase
    .from('sessions')
    .select('id,team_name,date,time,session_number,microcycle_day,main_objective,materials_needed,observations,squad_roster,attendance,gk_warm_up,gk_main_part,gk_cool_down,gk_player_groups,updated_at,gk_updated_at');

  if (sessErr) throw sessErr;

  const candidates = ((sessions || []) as SessionRow[]).filter((session) =>
    session.gk_updated_at !== null
    || session.gk_warm_up !== null
    || session.gk_main_part !== null
    || session.gk_cool_down !== null
    || session.gk_player_groups !== null
  );

  // 2. Fetch existing gk_sessions to check what already exists
  const { data: existingGk, error: existingErr } = await supabase
    .from('gk_sessions')
    .select('id,session_uid');

  if (existingErr) throw existingErr;

  const existingIds = new Set<string>();
  (existingGk || []).forEach((row: any) => {
    if (row.id) existingIds.add(row.id);
    if (row.session_uid) existingIds.add(row.session_uid);
  });

  const now = Date.now();

  const toMigrate = candidates.filter((session) => {
    const targetId = session.id.startsWith('gk-') ? session.id : `gk-${session.id}`;
    return !existingIds.has(targetId) && !existingIds.has(session.id);
  });

  const catalogRows = candidates.map((session) => ({
    session_uid: session.id,
    session_number: session.session_number || '',
    session_date: session.date || new Date().toISOString().slice(0, 10),
    source_legacy_session_id: session.id,
    created_at: session.updated_at || now,
    updated_at: session.updated_at || now
  }));

  const gkRows = toMigrate.map((session) => ({
    id: session.id.startsWith('gk-') ? session.id : `gk-${session.id}`,
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
    warm_up: session.gk_warm_up || { id: 'warmup-block-gk', title: 'Warm Up', exercises: [] },
    main_part: session.gk_main_part || { id: 'main-block-gk', title: 'Main Part', exercises: [] },
    cool_down: session.gk_cool_down || { id: 'cooldown-block-gk', title: 'Cool Down', exercises: [] },
    player_groups: session.gk_player_groups || [],
    created_at: session.gk_updated_at || session.updated_at || now,
    updated_at: session.gk_updated_at || session.updated_at || now
  }));

  if (!dryRun && toMigrate.length > 0) {
    const { error: catalogErr } = await supabase
      .from('session_catalog')
      .upsert(catalogRows, { onConflict: 'session_uid' });
    if (catalogErr) throw catalogErr;

    const { error: gkErr } = await supabase
      .from('gk_sessions')
      .upsert(gkRows, { onConflict: 'id' });
    if (gkErr) throw gkErr;
  }

  console.log(JSON.stringify({
    ok: true,
    dryRun,
    scannedSessions: (sessions || []).length,
    candidateGkSessions: candidates.length,
    alreadyExistingInGk: (existingGk || []).length,
    toMigrateCount: toMigrate.length,
    upsertCatalogRows: catalogRows.length,
    upsertGkRows: gkRows.length
  }, null, 2));
}

main().catch((error) => {
  console.error('[backfill-gk-sessions-from-legacy] failed:', error);
  process.exit(1);
});
