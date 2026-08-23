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

async function main() {
  const [{ data: legacyRows, error: legacyErr }, { data: gkRows, error: gkErr }] = await Promise.all([
    supabase
      .from('sessions')
      .select('id,gk_warm_up,gk_main_part,gk_cool_down,gk_player_groups'),
    supabase
      .from('gk_sessions')
      .select('id,session_uid,warm_up,main_part,cool_down,player_groups')
  ]);

  if (legacyErr) throw legacyErr;
  if (gkErr) throw gkErr;

  const gkByUid = new Map<string, GkSessionRow>((gkRows || []).map((row: any) => [row.session_uid || row.id, row]));

  const candidates = (legacyRows || []) as LegacySessionRow[];
  const diffs: Array<{ sessionId: string; field: string }> = [];
  let matched = 0;
  let missing = 0;

  for (const legacy of candidates) {
    const hasLegacyGk = legacy.gk_warm_up || legacy.gk_main_part || legacy.gk_cool_down || legacy.gk_player_groups;
    if (!hasLegacyGk) continue;

    const migrated = gkByUid.get(legacy.id);
    if (!migrated) {
      missing += 1;
      continue;
    }

    matched += 1;

    if (!jsonEqual(legacy.gk_warm_up, migrated.warm_up)) {
      diffs.push({ sessionId: legacy.id, field: 'warm_up' });
    }
    if (!jsonEqual(legacy.gk_main_part, migrated.main_part)) {
      diffs.push({ sessionId: legacy.id, field: 'main_part' });
    }
    if (!jsonEqual(legacy.gk_cool_down, migrated.cool_down)) {
      diffs.push({ sessionId: legacy.id, field: 'cool_down' });
    }
    if (!jsonEqual(legacy.gk_player_groups, migrated.player_groups)) {
      diffs.push({ sessionId: legacy.id, field: 'player_groups' });
    }
  }

  console.log(JSON.stringify({
    ok: diffs.length === 0 && missing === 0,
    totalLegacySessions: (legacyRows || []).length,
    totalGkSessions: (gkRows || []).length,
    matched,
    missing,
    diffsCount: diffs.length,
    diffs: diffs.slice(0, 200)
  }, null, 2));
}

main().catch((error) => {
  console.error('[validate-gk-backfill] failed:', error);
  process.exit(1);
});
