import { supabase } from '../../supabaseClient';
import type { MatchEvent, MatchEventType, TeamSide } from '../../types';

const MATCH_EVENTS_TABLE = 'match_events';

type MatchEventRow = {
  id: string;
  match_id: string;
  player_id: string | null;
  team_side: TeamSide;
  event_type: MatchEventType;
  minute: number | null;
  video_timestamp_seconds: number | null;
  related_player_id: string | null;
  description: string | null;
  created_at: string | null;
};

function getClient() {
  if (!supabase) throw new Error('Supabase client is not configured');
  return supabase;
}

function fromRow(row: MatchEventRow): MatchEvent {
  return {
    id: row.id,
    matchId: row.match_id,
    playerId: row.player_id ?? null,
    teamSide: row.team_side,
    eventType: row.event_type,
    minute: row.minute ?? 0,
    videoTimestampSeconds: row.video_timestamp_seconds ?? 0,
    relatedPlayerId: row.related_player_id ?? null,
    description: row.description ?? '',
    createdAt: row.created_at ?? undefined
  };
}

export async function getMatchEvents(matchId: string): Promise<MatchEvent[]> {
  const { data, error } = await getClient()
    .from(MATCH_EVENTS_TABLE)
    .select('*')
    .eq('match_id', matchId)
    .order('video_timestamp_seconds', { ascending: true });

  if (error) throw error;
  return ((data || []) as MatchEventRow[]).map(fromRow);
}

export async function createMatchEvent(input: Omit<MatchEvent, 'id' | 'createdAt'> & { id?: string }): Promise<MatchEvent> {
  const { data, error } = await getClient()
    .from(MATCH_EVENTS_TABLE)
    .insert({
      id: input.id,
      match_id: input.matchId,
      player_id: input.playerId ?? null,
      team_side: input.teamSide,
      event_type: input.eventType,
      minute: input.minute,
      video_timestamp_seconds: input.videoTimestampSeconds,
      related_player_id: input.relatedPlayerId ?? null,
      description: input.description ?? ''
    })
    .select('*')
    .single();

  if (error) throw error;
  return fromRow(data as MatchEventRow);
}

export async function updateMatchEvent(eventId: string, patch: Partial<MatchEvent>): Promise<MatchEvent> {
  const payload: Record<string, unknown> = {};
  if (patch.matchId !== undefined) payload.match_id = patch.matchId;
  if (patch.playerId !== undefined) payload.player_id = patch.playerId ?? null;
  if (patch.teamSide !== undefined) payload.team_side = patch.teamSide;
  if (patch.eventType !== undefined) payload.event_type = patch.eventType;
  if (patch.minute !== undefined) payload.minute = patch.minute;
  if (patch.videoTimestampSeconds !== undefined) payload.video_timestamp_seconds = patch.videoTimestampSeconds;
  if (patch.relatedPlayerId !== undefined) payload.related_player_id = patch.relatedPlayerId ?? null;
  if (patch.description !== undefined) payload.description = patch.description;

  const { data, error } = await getClient()
    .from(MATCH_EVENTS_TABLE)
    .update(payload)
    .eq('id', eventId)
    .select('*')
    .single();

  if (error) throw error;
  return fromRow(data as MatchEventRow);
}

export async function deleteMatchEvent(eventId: string): Promise<void> {
  const { error } = await getClient()
    .from(MATCH_EVENTS_TABLE)
    .delete()
    .eq('id', eventId);

  if (error) throw error;
}

export async function batchCreateMatchEvents(inputs: Array<Omit<MatchEvent, 'id' | 'createdAt'>>): Promise<MatchEvent[]> {
  if (inputs.length === 0) return [];
  const rowsToInsert = inputs.map((input) => ({
    match_id: input.matchId,
    player_id: input.playerId ?? null,
    team_side: input.teamSide,
    event_type: input.eventType,
    minute: input.minute,
    video_timestamp_seconds: input.videoTimestampSeconds,
    related_player_id: input.relatedPlayerId ?? null,
    description: input.description ?? ''
  }));

  const { data, error } = await getClient()
    .from(MATCH_EVENTS_TABLE)
    .insert(rowsToInsert)
    .select('*');

  if (error) throw error;
  return ((data || []) as MatchEventRow[]).map(fromRow);
}

