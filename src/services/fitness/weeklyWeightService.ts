import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from '../../supabaseClient';
import type { PlayerWeeklyWeight } from '../../types';

const TABLE = 'player_weekly_weights';

interface PlayerWeeklyWeightRow {
  id: string;
  player_id: string;
  week_start_date: string;
  weight_kg: number | string;
  notes: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
}

function getClient() {
  if (!supabase) {
    throw new Error('Supabase client is not configured');
  }
  return supabase;
}

function fromRow(row: PlayerWeeklyWeightRow): PlayerWeeklyWeight {
  return {
    id: row.id,
    playerId: row.player_id,
    weekStartDate: row.week_start_date,
    weightKg: Number(row.weight_kg),
    notes: row.notes ?? undefined,
    createdBy: row.created_by ?? undefined,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined
  };
}

/** Every weekly weight record, most recent week first. Used to build per-player history. */
export async function listAllWeeklyWeights(): Promise<PlayerWeeklyWeight[]> {
  const { data, error } = await getClient()
    .from(TABLE)
    .select('*')
    .order('week_start_date', { ascending: false });

  if (error) throw error;
  return (data as PlayerWeeklyWeightRow[] | null)?.map(fromRow) ?? [];
}

/** Existing records for one specific week (used to prefill the Weekly Weight entry table). */
export async function listWeeklyWeightsForWeek(weekStartDate: string): Promise<PlayerWeeklyWeight[]> {
  const { data, error } = await getClient()
    .from(TABLE)
    .select('*')
    .eq('week_start_date', weekStartDate);

  if (error) throw error;
  return (data as PlayerWeeklyWeightRow[] | null)?.map(fromRow) ?? [];
}

export async function listWeeklyWeightsForPlayer(playerId: string): Promise<PlayerWeeklyWeight[]> {
  const { data, error } = await getClient()
    .from(TABLE)
    .select('*')
    .eq('player_id', playerId)
    .order('week_start_date', { ascending: true });

  if (error) throw error;
  return (data as PlayerWeeklyWeightRow[] | null)?.map(fromRow) ?? [];
}

/**
 * Upsert one player's weight for one week (unique on player_id+week_start_date), so
 * re-entering the same week edits the existing row instead of creating a duplicate.
 */
export async function saveWeeklyWeight(input: {
  playerId: string;
  weekStartDate: string;
  weightKg: number;
  notes?: string | null;
}): Promise<void> {
  const { error } = await getClient()
    .from(TABLE)
    .upsert(
      {
        player_id: input.playerId,
        week_start_date: input.weekStartDate,
        weight_kg: input.weightKg,
        notes: input.notes ?? null
      },
      { onConflict: 'player_id,week_start_date' }
    );

  if (error) throw error;
}

/** Realtime feed of the whole table (reloads on any change so deletes/edits are reflected too). */
export function subscribeToWeeklyWeights(
  callback: (weights: PlayerWeeklyWeight[]) => void,
  onError?: (error: unknown) => void
): () => void {
  const client = getClient();
  let active = true;
  let reloadTimer: ReturnType<typeof setTimeout> | null = null;

  const loadAndEmit = async () => {
    try {
      const weights = await listAllWeeklyWeights();
      if (active) callback(weights);
    } catch (error) {
      if (active && onError) onError(error);
    }
  };

  const scheduleReload = () => {
    if (reloadTimer) clearTimeout(reloadTimer);
    reloadTimer = setTimeout(() => {
      void loadAndEmit();
    }, 250);
  };

  void loadAndEmit();

  const channel: RealtimeChannel = client
    .channel(`u17-weekly-weights-realtime-${crypto.randomUUID()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, (_payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
      scheduleReload();
    })
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR' && onError) {
        onError(new Error('Supabase realtime channel error for weekly weights'));
      }
    });

  return () => {
    active = false;
    if (reloadTimer) clearTimeout(reloadTimer);
    void client.removeChannel(channel);
  };
}
