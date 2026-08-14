import { supabase } from '../../supabaseClient';
import type { MatchLineupEntry, PlayerMatchStatistics } from '../../types';

const PLAYER_MATCH_STATISTICS_TABLE = 'player_match_statistics';

type PlayerMatchStatisticsRow = {
  id: string;
  match_id: string;
  player_id: string;
  minutes_played: number | null;
  starts: boolean | null;
  goals: number | null;
  assists: number | null;
  yellow_cards: number | null;
  red_cards: number | null;
  created_at: string | null;
  updated_at: string | null;
};

function getClient() {
  if (!supabase) throw new Error('Supabase client is not configured');
  return supabase;
}

function fromRow(row: PlayerMatchStatisticsRow): PlayerMatchStatistics {
  return {
    id: row.id,
    matchId: row.match_id,
    playerId: row.player_id,
    minutesPlayed: row.minutes_played ?? 0,
    starts: Boolean(row.starts),
    goals: row.goals ?? 0,
    assists: row.assists ?? 0,
    yellowCards: row.yellow_cards ?? 0,
    redCards: row.red_cards ?? 0,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined
  };
}

export async function getPlayerMatchStatistics(matchId: string): Promise<PlayerMatchStatistics[]> {
  const { data, error } = await getClient()
    .from(PLAYER_MATCH_STATISTICS_TABLE)
    .select('*')
    .eq('match_id', matchId)
    .order('minutes_played', { ascending: false });

  if (error) throw error;
  return ((data || []) as PlayerMatchStatisticsRow[]).map(fromRow);
}

export async function getPlayerMatchStatistic(matchId: string, playerId: string): Promise<PlayerMatchStatistics | null> {
  const { data, error } = await getClient()
    .from(PLAYER_MATCH_STATISTICS_TABLE)
    .select('*')
    .eq('match_id', matchId)
    .eq('player_id', playerId)
    .maybeSingle();

  if (error) throw error;
  return data ? fromRow(data as PlayerMatchStatisticsRow) : null;
}

export async function upsertPlayerMatchStatistics(input: Partial<PlayerMatchStatistics> & Pick<PlayerMatchStatistics, 'matchId' | 'playerId'>): Promise<PlayerMatchStatistics> {
  const payload = {
    id: input.id,
    match_id: input.matchId,
    player_id: input.playerId,
    minutes_played: input.minutesPlayed ?? 0,
    starts: Boolean(input.starts),
    goals: input.goals ?? 0,
    assists: input.assists ?? 0,
    yellow_cards: input.yellowCards ?? 0,
    red_cards: input.redCards ?? 0,
    updated_at: new Date().toISOString()
  };

  const { data, error } = await getClient()
    .from(PLAYER_MATCH_STATISTICS_TABLE)
    .upsert(payload, { onConflict: 'match_id,player_id' })
    .select('*')
    .single();

  if (error) throw error;
  return fromRow(data as PlayerMatchStatisticsRow);
}

export function calculateMinutesPlayedFromLineupEntry(entry: Pick<MatchLineupEntry, 'starter' | 'minuteSubbedIn' | 'minuteSubbedOut'>, matchDurationMinutes = 90): number {
  if (entry.starter && entry.minuteSubbedOut == null) return matchDurationMinutes;
  if (entry.starter && entry.minuteSubbedOut !== null) return Math.max(0, entry.minuteSubbedOut ?? 0);
  if (!entry.starter && entry.minuteSubbedIn == null) return 0;

  const subInMinute = entry.minuteSubbedIn ?? 0;
  if (entry.minuteSubbedOut == null) return Math.max(0, matchDurationMinutes - subInMinute);
  return Math.max(0, (entry.minuteSubbedOut ?? subInMinute) - subInMinute);
}

export function calculateMinutesPlayedFromLineupEntries(entries: Array<Pick<MatchLineupEntry, 'playerId' | 'starter' | 'minuteSubbedIn' | 'minuteSubbedOut'>>, playerId: string, matchDurationMinutes = 90): number {
  const matchEntry = entries.find((entry) => entry.playerId === playerId);
  if (!matchEntry) return 0;
  return calculateMinutesPlayedFromLineupEntry(matchEntry, matchDurationMinutes);
}
