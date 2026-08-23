/// <reference types="node" />

import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: ['.env.local', '.env'] });

type LegacySessionRow = {
  id: string;
  gk_warm_up: any;
  gk_main_part: any;
  gk_cool_down: any;
  gk_player_groups: any;
};

type GkSessionRow = {
  id: string;
  session_uid: string;
  warm_up: any;
  main_part: any;
  cool_down: any;
  player_groups: any;
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

function jsonEqual(a: any, b: any): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

function hasSpecificGkContent(row: any): boolean {
  if (row.gk_updated_at !== null && row.gk_updated_at !== undefined && row.gk_updated_at > 0) {
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

  if (hasBlockContent(row.gk_warm_up)) return true;
  if (hasBlockContent(row.gk_main_part)) return true;
  if (hasBlockContent(row.gk_cool_down)) return true;
  if (Array.isArray(row.gk_player_groups) && row.gk_player_groups.length > 0) return true;

  return false;
}

async function main() {
  const [{ data: legacyRows, error: legacyErr }, { data: gkRows, error: gkErr }] = await Promise.all([
    supabase
      .from('sessions')
      .select('id,gk_warm_up,gk_main_part,gk_cool_down,gk_player_groups,gk_updated_at'),
    supabase
      .from('gk_sessions')
      .select('id,session_uid,legacy_session_id,warm_up,main_part,cool_down,player_groups')
  ]);

  if (legacyErr) throw legacyErr;
  if (gkErr) throw gkErr;

  const legacyMap = new Map<string, any>((legacyRows || []).map((row: any) => [row.id, row]));
  const gkByUid = new Map<string, GkSessionRow>((gkRows || []).map((row: any) => [row.session_uid || row.id, row]));

  const diffs: Array<{ sessionId: string; field: string }> = [];
  let matched = 0;
  let missing = 0;

  for (const legacy of (legacyRows || [])) {
    if (!hasSpecificGkContent(legacy)) continue;

    const migrated = gkByUid.get(legacy.id);
    if (!migrated) {
      missing += 1;
      continue;
    }

    matched += 1;

    if (legacy.gk_warm_up && !jsonEqual(legacy.gk_warm_up, migrated.warm_up)) {
      diffs.push({ sessionId: legacy.id, field: 'warm_up' });
    }
    if (legacy.gk_main_part && !jsonEqual(legacy.gk_main_part, migrated.main_part)) {
      diffs.push({ sessionId: legacy.id, field: 'main_part' });
    }
    if (legacy.gk_cool_down && !jsonEqual(legacy.gk_cool_down, migrated.cool_down)) {
      diffs.push({ sessionId: legacy.id, field: 'cool_down' });
    }
    if (legacy.gk_player_groups && !jsonEqual(legacy.gk_player_groups, migrated.player_groups)) {
      diffs.push({ sessionId: legacy.id, field: 'player_groups' });
    }
  }

  // Check for any legacy sessions in gk_sessions that did NOT have GK content
  const unexpectedNonGkInGk: string[] = [];
  let independentNewGkCount = 0;

  for (const gk of (gkRows || [])) {
    const legacyId = gk.legacy_session_id || gk.session_uid || gk.id.replace(/^gk-/, '');
    const legacyRecord = legacyMap.get(legacyId);

    if (legacyRecord) {
      if (!hasSpecificGkContent(legacyRecord)) {
        unexpectedNonGkInGk.push(gk.id);
      }
    } else {
      // Independent new GK session (created directly in gk_sessions)
      independentNewGkCount += 1;
    }
  }

  console.log(JSON.stringify({
    ok: diffs.length === 0 && missing === 0 && unexpectedNonGkInGk.length === 0,
    totalLegacySessions: (legacyRows || []).length,
    totalGkSessions: (gkRows || []).length,
    historicalGkMatched: matched,
    historicalGkMissing: missing,
    unexpectedNonGkInGkCount: unexpectedNonGkInGk.length,
    unexpectedNonGkInGk,
    independentNewGkCount,
    diffsCount: diffs.length,
    diffs: diffs.slice(0, 200)
  }, null, 2));
}

main().catch((error) => {
  console.error('[validate-gk-backfill] failed:', error);
  process.exit(1);
});
