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
  warm_up: any;
  main_part: any;
  cool_down: any;
  player_groups: any;
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

function hasSpecificGkContent(session: SessionRow): boolean {
  if (session.gk_updated_at !== null && session.gk_updated_at !== undefined && session.gk_updated_at > 0) {
    return true;
  }

  const hasBlockContent = (block: any): boolean => {
    if (!block || typeof block !== 'object') return false;
    if (Array.isArray(block.exercises) && block.exercises.length > 0) return true;
    const keys = Object.keys(block);
    if (keys.length === 0) return false;
    if (keys.length === 2 && block.id && block.title && !block.exercises) return false;
    if (block.exercises && Array.isArray(block.exercises) && block.exercises.length === 0 && keys.length <= 3) return false;
    return true;
  };

  if (hasBlockContent(session.gk_warm_up)) return true;
  if (hasBlockContent(session.gk_main_part)) return true;
  if (hasBlockContent(session.gk_cool_down)) return true;

  if (Array.isArray(session.gk_player_groups) && session.gk_player_groups.length > 0) {
    return true;
  }

  return false;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  // 1. Fetch all legacy sessions
  const { data: sessions, error: sessErr } = await supabase
    .from('sessions')
    .select('id,team_name,date,time,session_number,microcycle_day,main_objective,materials_needed,observations,squad_roster,attendance,warm_up,main_part,cool_down,player_groups,gk_warm_up,gk_main_part,gk_cool_down,gk_player_groups,updated_at,gk_updated_at');

  if (sessErr) throw sessErr;

  const allSessions = (sessions || []) as SessionRow[];
  const gkCandidates = allSessions.filter(hasSpecificGkContent);
  const nonGkLegacyIds = allSessions
    .filter((s) => !hasSpecificGkContent(s))
    .flatMap((s) => [s.id, `gk-${s.id}`]);

  const now = Date.now();

  const catalogRows = gkCandidates.map((session) => ({
    session_uid: session.id,
    session_number: session.session_number || '',
    session_date: session.date || new Date().toISOString().slice(0, 10),
    source_legacy_session_id: session.id,
    created_at: session.gk_updated_at || session.updated_at || now,
    updated_at: session.gk_updated_at || session.updated_at || now
  }));

  const gkRows = gkCandidates.map((session) => {
    const defaultGkWarmUp = { id: 'warmup-block-gk', title: 'Warm Up', exercises: [] };
    const defaultGkMainPart = { id: 'main-block-gk', title: 'Main Part', exercises: [] };
    const defaultGkCoolDown = { id: 'cooldown-block-gk', title: 'Cool Down', exercises: [] };

    const warmUp = session.gk_warm_up && (session.gk_warm_up.exercises?.length > 0 || Object.keys(session.gk_warm_up).length > 0)
      ? session.gk_warm_up
      : defaultGkWarmUp;

    const mainPart = session.gk_main_part && (session.gk_main_part.exercises?.length > 0 || Object.keys(session.gk_main_part).length > 0)
      ? session.gk_main_part
      : defaultGkMainPart;

    const coolDown = session.gk_cool_down && (session.gk_cool_down.exercises?.length > 0 || Object.keys(session.gk_cool_down).length > 0)
      ? session.gk_cool_down
      : defaultGkCoolDown;

    const playerGroups = Array.isArray(session.gk_player_groups) ? session.gk_player_groups : [];

    return {
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
      warm_up: warmUp,
      main_part: mainPart,
      cool_down: coolDown,
      player_groups: playerGroups,
      created_at: session.gk_updated_at || session.updated_at || now,
      updated_at: session.gk_updated_at || session.updated_at || now
    };
  });

  if (!dryRun) {
    // 1. Delete any erroneously backfilled non-GK legacy sessions from gk_sessions
    if (nonGkLegacyIds.length > 0) {
      const { error: cleanErr } = await supabase
        .from('gk_sessions')
        .delete()
        .in('id', nonGkLegacyIds);
      if (cleanErr) console.warn('[backfill-gk] Note cleaning non-GK sessions:', cleanErr);
    }

    // 2. Upsert valid GK sessions
    if (catalogRows.length > 0) {
      const { error: catalogErr } = await supabase
        .from('session_catalog')
        .upsert(catalogRows, { onConflict: 'session_uid' });
      if (catalogErr) throw catalogErr;
    }

    if (gkRows.length > 0) {
      const { error: gkErr } = await supabase
        .from('gk_sessions')
        .upsert(gkRows, { onConflict: 'id' });
      if (gkErr) throw gkErr;
    }
  }

  console.log(JSON.stringify({
    ok: true,
    dryRun,
    scannedSessions: allSessions.length,
    gkCandidatesCount: gkCandidates.length,
    cleanedNonGkLegacyCount: nonGkLegacyIds.length,
    upsertCatalogRows: catalogRows.length,
    upsertGkRows: gkRows.length
  }, null, 2));
}

main().catch((error) => {
  console.error('[backfill-gk-sessions-from-legacy] failed:', error);
  process.exit(1);
});
