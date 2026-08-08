import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../../supabaseClient';

const EXCLUDED_PLAYERS_TABLE = 'attendance_excluded_players';

type ExcludedPlayerRow = {
  name: string;
  updated_at: number;
};

function getClient() {
  if (!supabase) throw new Error('Supabase client is not configured');
  return supabase;
}

async function listExcludedPlayers(): Promise<string[]> {
  const { data, error } = await getClient()
    .from(EXCLUDED_PLAYERS_TABLE)
    .select('name');

  if (error) throw error;
  return ((data || []) as Pick<ExcludedPlayerRow, 'name'>[]).map((row) => row.name);
}

export function subscribeToExcludedPlayers(
  callback: (names: string[]) => void,
  onError?: (error: unknown) => void
): () => void {
  const client = getClient();
  let active = true;
  let channel: RealtimeChannel | null = null;

  const loadAndEmit = async () => {
    try {
      const names = await listExcludedPlayers();
      if (active) callback(names);
    } catch (error) {
      if (active && onError) onError(error);
    }
  };

  void loadAndEmit();

  channel = client
    .channel('u17-attendance-excluded-players-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: EXCLUDED_PLAYERS_TABLE }, () => {
      void loadAndEmit();
    })
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR' && onError) {
        onError(new Error('Supabase realtime channel error for excluded players'));
      }
    });

  return () => {
    active = false;
    if (channel) void client.removeChannel(channel);
  };
}

export async function addExcludedPlayers(names: string[]): Promise<void> {
  if (names.length === 0) return;
  const updatedAt = Date.now();
  const rows: ExcludedPlayerRow[] = names.map((name) => ({ name, updated_at: updatedAt }));
  const { error } = await getClient()
    .from(EXCLUDED_PLAYERS_TABLE)
    .upsert(rows, { onConflict: 'name' });

  if (error) throw error;
}

export async function removeExcludedPlayers(names: string[]): Promise<void> {
  if (names.length === 0) return;
  const { error } = await getClient()
    .from(EXCLUDED_PLAYERS_TABLE)
    .delete()
    .in('name', names);

  if (error) throw error;
}
