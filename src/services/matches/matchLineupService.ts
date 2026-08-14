import { supabase } from '../../supabaseClient';
import type { MatchLineupEntry } from '../../types';

const MATCH_LINEUP_TABLE = 'match_lineup_entries';

type MatchLineupRow = {
  id: string;
  match_id: string;
  player_id: string;
  position: string | null;
  starter: boolean | null;
  shirt_number: number | null;
  captain: boolean | null;
  minute_subbed_in: number | null;
  minute_subbed_out: number | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
};

function getClient() {
  if (!supabase) throw new Error('Supabase client is not configured');
  return supabase;
}

function fromRow(row: MatchLineupRow): MatchLineupEntry {
  return {
    id: row.id,
    matchId: row.match_id,
    playerId: row.player_id,
    position: row.position ?? '',
    starter: Boolean(row.starter),
    shirtNumber: row.shirt_number ?? null,
    captain: Boolean(row.captain),
    minuteSubbedIn: row.minute_subbed_in ?? null,
    minuteSubbedOut: row.minute_subbed_out ?? null,
    notes: row.notes ?? null,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined
  };
}

export async function getMatchLineup(matchId: string): Promise<MatchLineupEntry[]> {
  const { data, error } = await getClient()
    .from(MATCH_LINEUP_TABLE)
    .select('*')
    .eq('match_id', matchId)
    .order('starter', { ascending: false })
    .order('shirt_number', { ascending: true, nullsFirst: false });

  if (error) throw error;
  return ((data || []) as MatchLineupRow[]).map(fromRow);
}

export async function upsertMatchLineupEntry(entry: Partial<MatchLineupEntry> & Pick<MatchLineupEntry, 'matchId' | 'playerId'>): Promise<MatchLineupEntry> {
  const payload = {
    id: entry.id,
    match_id: entry.matchId,
    player_id: entry.playerId,
    position: entry.position ?? '',
    starter: Boolean(entry.starter),
    shirt_number: entry.shirtNumber ?? null,
    captain: Boolean(entry.captain),
    minute_subbed_in: entry.minuteSubbedIn ?? null,
    minute_subbed_out: entry.minuteSubbedOut ?? null,
    notes: entry.notes ?? null,
    updated_at: new Date().toISOString()
  };

  const { data, error } = await getClient()
    .from(MATCH_LINEUP_TABLE)
    .upsert(payload, { onConflict: 'match_id,player_id' })
    .select('*')
    .single();

  if (error) throw error;
  return fromRow(data as MatchLineupRow);
}

export async function removeMatchLineupEntry(entryId: string): Promise<void> {
  const { error } = await getClient()
    .from(MATCH_LINEUP_TABLE)
    .delete()
    .eq('id', entryId);

  if (error) throw error;
}

export function calculateMinutesPlayedFromLineup(entry: Pick<MatchLineupEntry, 'starter' | 'minuteSubbedIn' | 'minuteSubbedOut'>, matchDurationMinutes = 90): number {
  if (entry.starter && entry.minuteSubbedOut == null) {
    return matchDurationMinutes;
  }

  if (entry.starter && entry.minuteSubbedOut !== null) {
    return Math.max(0, entry.minuteSubbedOut ?? 0);
  }

  if (!entry.starter && entry.minuteSubbedIn == null) {
    return 0;
  }

  const subInMinute = entry.minuteSubbedIn ?? 0;
  if (entry.minuteSubbedOut == null) {
    return Math.max(0, matchDurationMinutes - subInMinute);
  }

  return Math.max(0, (entry.minuteSubbedOut ?? subInMinute) - subInMinute);
}
