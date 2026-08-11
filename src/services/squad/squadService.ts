import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from '../../supabaseClient';
import { getDataProvider } from '../../supabaseClient';
import type { SquadPlayer } from '../../types';
import { normalizeSquadPhotoUrl } from '../../utils/squadPhotos';

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
    photoUrl: normalizeSquadPhotoUrl(row.photo_url),
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

function coerceUpdatedAt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toRowFromRealtimePayload(raw: unknown): SquadPlayerRow | null {
  if (!raw || typeof raw !== 'object') return null;

  const row = raw as Partial<SquadPlayerRow>;
  const updatedAt = coerceUpdatedAt(row.updated_at);
  if (updatedAt === null) return null;

  if (
    typeof row.id !== 'string' ||
    typeof row.first_name !== 'string' ||
    typeof row.last_name !== 'string' ||
    typeof row.position !== 'string' ||
    typeof row.status !== 'string'
  ) {
    return null;
  }

  return {
    id: row.id,
    first_name: row.first_name,
    last_name: row.last_name,
    number: row.number ?? null,
    position: row.position,
    status: row.status,
    notes: row.notes ?? null,
    joined_date: row.joined_date ?? null,
    photo_url: row.photo_url ?? null,
    age: row.age ?? null,
    nationality: row.nationality ?? null,
    preferred_foot: row.preferred_foot ?? null,
    height_cm: row.height_cm ?? null,
    weight_kg: row.weight_kg ?? null,
    attendance_stats: row.attendance_stats ?? null,
    malika_points: row.malika_points ?? null,
    malika_history: row.malika_history ?? null,
    updated_at: updatedAt
  };
}

export function subscribeToSquadPlayers(
  callback: (players: CloudSquadPlayer[]) => void,
  onError?: (error: unknown) => void
): () => void {
  const client = getClient();
  const provider = getDataProvider();
  const enabled = true;
  let active = true;
  let channel: RealtimeChannel | null = null;
  let localPlayers: CloudSquadPlayer[] = [];
  let reloadTimer: ReturnType<typeof setTimeout> | null = null;

  const emit = (players: CloudSquadPlayer[]) => {
    if (!active) return;
    localPlayers = players;
    callback(players);
  };

  const loadAndEmit = async () => {
    try {
      const players = await listSquadPlayers();
      console.log('[SUPABASE SQUAD]', {
        provider,
        enabled,
        error: null,
        count: players.length
      });
      emit(players);
    } catch (error) {
      console.log('[SUPABASE SQUAD]', {
        provider,
        enabled,
        error: error && typeof error === 'object'
          ? {
              code: 'code' in error && (error as { code?: unknown }).code ? String((error as { code?: unknown }).code) : 'unknown',
              message: 'message' in error && (error as { message?: unknown }).message ? String((error as { message?: unknown }).message) : String(error),
              status: 'status' in error && typeof (error as { status?: unknown }).status === 'number' ? (error as { status?: number }).status : null
            }
          : {
              code: 'unknown',
              message: String(error),
              status: null
            },
        count: null
      });
      if (active && onError) onError(error);
    }
  };

  const scheduleReload = (reason: string) => {
    if (!active || reloadTimer) return;
    reloadTimer = setTimeout(() => {
      reloadTimer = null;
      console.log('[SUPABASE SQUAD]', {
        provider,
        enabled,
        event: 'FALLBACK_RELOAD',
        reason
      });
      void loadAndEmit();
    }, 120);
  };

  const handleRealtimeChange = (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
    if (!active) return;

    const eventType = payload.eventType;

    if (eventType === 'DELETE') {
      const oldRow = payload.old as { id?: unknown } | null;
      const id = oldRow && typeof oldRow.id === 'string' ? oldRow.id : null;
      if (!id) {
        scheduleReload('delete-missing-id');
        return;
      }

      const next = localPlayers.filter((player) => player.id !== id);
      emit(next);
      return;
    }

    if (eventType === 'INSERT' || eventType === 'UPDATE') {
      const row = toRowFromRealtimePayload(payload.new);
      if (!row) {
        scheduleReload(`${eventType.toLowerCase()}-incomplete-payload`);
        return;
      }

      const nextPlayer = fromRow(row);
      const index = localPlayers.findIndex((player) => player.id === nextPlayer.id);
      if (index === -1) {
        emit([...localPlayers, nextPlayer]);
        return;
      }

      const next = [...localPlayers];
      next[index] = nextPlayer;
      emit(next);
      return;
    }

    scheduleReload('unknown-event-type');
  };

  void loadAndEmit();

  channel = client
    .channel('u17-squad-players-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: SQUAD_TABLE }, (payload) => {
      handleRealtimeChange(payload as RealtimePostgresChangesPayload<Record<string, unknown>>);
    })
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR' && onError) {
        onError(new Error('Supabase realtime channel error for squad players'));
      }
    });

  return () => {
    active = false;
    if (reloadTimer) {
      clearTimeout(reloadTimer);
      reloadTimer = null;
    }
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
