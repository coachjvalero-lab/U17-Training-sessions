import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../../supabaseClient';
import type { SquadPlayer } from '../../types';

const SQUAD_TABLE = 'squad_players';

type SquadPlayerRow = {
  id: string;
  first_name: string;
  last_name: string;
  number: string | null;
  position: SquadPlayer['position'];
  status: SquadPlayer['status'];
  notes: string | null;
  joined_date: string | null;
  photo_url: string | null;
  age: number | null;
  nationality: string | null;
  preferred_foot: SquadPlayer['preferredFoot'] | null;
  height_cm: number | null;
  weight_kg: number | null;
  attendance_stats: SquadPlayer['attendanceStats'] | null;
  malika_points: number | null;
  malika_history: SquadPlayer['malikaHistory'] | null;
  updated_at: number;
};

export interface CloudSquadPlayer extends SquadPlayer {
  updatedAt: number;
}

function getClient() {
  if (!supabase) {
    throw new Error('Supabase client is not configured');
  }
  return supabase;
}

function fromRow(row: SquadPlayerRow): CloudSquadPlayer {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    number: row.number ?? undefined,
    position: row.position,
    status: row.status,
    notes: row.notes ?? undefined,
    joinedDate: row.joined_date ?? undefined,
    photoUrl: row.photo_url ?? undefined,
    age: row.age ?? undefined,
    nationality: row.nationality ?? undefined,
    preferredFoot: row.preferred_foot ?? undefined,
    heightCm: row.height_cm ?? undefined,
    weightKg: row.weight_kg ?? undefined,
    attendanceStats: row.attendance_stats ?? undefined,
    malikaPoints: row.malika_points ?? undefined,
    malikaHistory: row.malika_history ?? undefined,
    updatedAt: row.updated_at
  };
}

function toRow(player: SquadPlayer, updatedAt: number): SquadPlayerRow {
  return {
    id: player.id,
    first_name: player.firstName,
    last_name: player.lastName,
    number: player.number === undefined || player.number === null ? null : String(player.number),
    position: player.position,
    status: player.status,
    notes: player.notes ?? null,
    joined_date: player.joinedDate ?? null,
    photo_url: player.photoUrl ?? null,
    age: player.age ?? null,
    nationality: player.nationality ?? null,
    preferred_foot: player.preferredFoot ?? null,
    height_cm: player.heightCm ?? null,
    weight_kg: player.weightKg ?? null,
    attendance_stats: player.attendanceStats ?? null,
    malika_points: player.malikaPoints ?? null,
    malika_history: player.malikaHistory ?? [],
    updated_at: updatedAt
  };
}

async function listSquadPlayers(): Promise<CloudSquadPlayer[]> {
  const { data, error } = await getClient()
    .from(SQUAD_TABLE)
    .select('*');

  if (error) throw error;
  return ((data || []) as SquadPlayerRow[]).map(fromRow);
}

export function subscribeToSquadPlayers(
  callback: (players: CloudSquadPlayer[]) => void,
  onError?: (error: unknown) => void
): () => void {
  const client = getClient();
  let active = true;
  let channel: RealtimeChannel | null = null;

  const loadAndEmit = async () => {
    try {
      const players = await listSquadPlayers();
      if (active) callback(players);
    } catch (error) {
      if (active && onError) onError(error);
    }
  };

  void loadAndEmit();

  channel = client
    .channel('u17-squad-players-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: SQUAD_TABLE }, () => {
      void loadAndEmit();
    })
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR' && onError) {
        onError(new Error('Supabase realtime channel error for squad players'));
      }
    });

  return () => {
    active = false;
    if (channel) void client.removeChannel(channel);
  };
}

export async function saveSquadPlayer(player: SquadPlayer): Promise<number> {
  const updatedAt = Date.now();
  const { error } = await getClient()
    .from(SQUAD_TABLE)
    .upsert(toRow(player, updatedAt), { onConflict: 'id' });

  if (error) throw error;
  return updatedAt;
}

export async function deleteSquadPlayer(playerId: string): Promise<void> {
  const { error } = await getClient()
    .from(SQUAD_TABLE)
    .delete()
    .eq('id', playerId);

  if (error) throw error;
}
