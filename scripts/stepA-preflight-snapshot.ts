/// <reference types="node" />

import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';
import { createHash } from 'node:crypto';

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

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function sortSquadIdsNumerically(ids: string[]): string[] {
  return [...ids].sort((left, right) => {
    const leftNumber = Number(left.replace(/^p/i, ''));
    const rightNumber = Number(right.replace(/^p/i, ''));

    if (Number.isNaN(leftNumber) || Number.isNaN(rightNumber)) {
      return left.localeCompare(right);
    }

    return leftNumber - rightNumber;
  });
}

async function fetchIds(table: string): Promise<string[]> {
  const pageSize = 1000;
  const ids: string[] = [];
  let from = 0;

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from(table)
      .select('id')
      .order('id', { ascending: true })
      .range(from, to);

    if (error) throw error;
    const rows = (data || []) as Array<{ id: string }>;
    if (rows.length === 0) break;

    ids.push(...rows.map((row) => row.id));
    if (rows.length < pageSize) break;
    from += pageSize;
  }

  return ids;
}

async function main() {
  const [
    sessionsCountRes,
    fitnessLegacyRes,
    footballLegacyRes,
    gkLegacyRes,
    exerciseCountRes,
    squadCountRes,
    legacyFitnessPayloadRes,
    sessionIds,
    exerciseIds,
    squadIds
  ] = await Promise.all([
    supabase.from('sessions').select('id', { count: 'exact', head: true }),
    supabase
      .from('sessions')
      .select('id', { count: 'exact', head: true })
      .or('fitness_updated_at.not.is.null,fitness_warm_up.not.is.null,fitness_main_part.not.is.null,fitness_cool_down.not.is.null,fitness_player_groups.not.is.null'),
    supabase
      .from('sessions')
      .select('id', { count: 'exact', head: true })
      .or('warm_up.not.is.null,main_part.not.is.null,cool_down.not.is.null,player_groups.not.is.null'),
    supabase
      .from('sessions')
      .select('id', { count: 'exact', head: true })
      .or('gk_updated_at.not.is.null,gk_warm_up.not.is.null,gk_main_part.not.is.null,gk_cool_down.not.is.null,gk_player_groups.not.is.null'),
    supabase.from('exercise_library').select('id', { count: 'exact', head: true }),
    supabase.from('squad_players').select('id', { count: 'exact', head: true }),
    supabase
      .from('sessions')
      .select('id,fitness_warm_up,fitness_main_part,fitness_cool_down,fitness_player_groups')
      .order('id', { ascending: true }),
    fetchIds('sessions'),
    fetchIds('exercise_library'),
    fetchIds('squad_players')
  ]);

  if (sessionsCountRes.error) throw sessionsCountRes.error;
  if (fitnessLegacyRes.error) throw fitnessLegacyRes.error;
  if (footballLegacyRes.error) throw footballLegacyRes.error;
  if (gkLegacyRes.error) throw gkLegacyRes.error;
  if (exerciseCountRes.error) throw exerciseCountRes.error;
  if (squadCountRes.error) throw squadCountRes.error;
  if (legacyFitnessPayloadRes.error) throw legacyFitnessPayloadRes.error;

  const legacyRows = (legacyFitnessPayloadRes.data || []) as Array<{
    id: string;
    fitness_warm_up: any;
    fitness_main_part: any;
    fitness_cool_down: any;
    fitness_player_groups: any;
  }>;

  const payloadLines = legacyRows.map((row) => JSON.stringify({
    id: row.id,
    fitness_warm_up: row.fitness_warm_up,
    fitness_main_part: row.fitness_main_part,
    fitness_cool_down: row.fitness_cool_down,
    fitness_player_groups: row.fitness_player_groups
  }));

  const sessionsIdChecksum = sha256(sessionIds.join('|'));
  const exerciseIdChecksum = sha256(exerciseIds.join('|'));
  const squadIdChecksum = sha256(squadIds.join('|'));
  const legacyFitnessPayloadChecksum = sha256(payloadLines.join('\n'));
  const expectedSquadIds = Array.from({ length: 22 }, (_, index) => `p${index + 1}`);
  const actualSquadIdSet = new Set(squadIds);
  const expectedSquadIdSet = new Set(expectedSquadIds);
  const squadDuplicateIds = [...actualSquadIdSet]
    .filter((id) => squadIds.filter((candidateId) => candidateId === id).length > 1);
  const squadMissingIds = expectedSquadIds.filter((id) => !actualSquadIdSet.has(id));
  const squadUnexpectedIds = [...actualSquadIdSet].filter((id) => !expectedSquadIdSet.has(id));
  const squadIdsNumericOrder = sortSquadIdsNumerically(squadIds);
  const squadHasExactP1ToP22 =
    squadIds.length === 22
    && actualSquadIdSet.size === 22
    && expectedSquadIdSet.size === actualSquadIdSet.size
    && squadMissingIds.length === 0
    && squadUnexpectedIds.length === 0
    && squadDuplicateIds.length === 0;

  const report = {
    ok: true,
    generatedAt: new Date().toISOString(),
    sessionsCount: sessionsCountRes.count || 0,
    sessionsIdList: sessionIds,
    sessionsIdChecksum,
    fitnessLegacySessionsCount: fitnessLegacyRes.count || 0,
    footballLegacySessionsCount: footballLegacyRes.count || 0,
    gkLegacySessionsCount: gkLegacyRes.count || 0,
    exerciseLibraryCount: exerciseCountRes.count || 0,
    exerciseIdList: exerciseIds,
    exerciseIdChecksum,
    squadPlayersCount: squadCountRes.count || 0,
    squadIdList: squadIds,
    squadIdListNumericOrder: squadIdsNumericOrder,
    squadIdChecksum,
    squadMissingIds,
    squadUnexpectedIds,
    squadDuplicateIds,
    squadHasExactP1ToP22,
    legacyFitnessPayloadChecksum
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error('[stepA-preflight-snapshot] failed:', error);
  process.exit(1);
});
