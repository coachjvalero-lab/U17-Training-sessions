import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../../supabaseClient';

const EXERCISE_LIBRARY_DELETED_IDS_TABLE = 'exercise_library_deleted_ids';

type DeletedExerciseIdRow = {
  id: string;
  updated_at: bigint | number | null;
};

function getClient() {
  if (!supabase) throw new Error('Supabase client is not configured');
  return supabase;
}

async function listDeletedExerciseIds(): Promise<string[]> {
  const { data, error } = await getClient()
    .from(EXERCISE_LIBRARY_DELETED_IDS_TABLE)
    .select('id');

  if (error) throw error;
  return ((data || []) as DeletedExerciseIdRow[]).map((row) => row.id);
}

export function subscribeToDeletedExerciseIds(
  callback: (ids: string[]) => void,
  onError?: (error: unknown) => void
): () => void {
  const client = getClient();
  let active = true;
  let channel: RealtimeChannel | null = null;

  const loadAndEmit = async () => {
    try {
      const ids = await listDeletedExerciseIds();
      if (active) callback(ids);
    } catch (error) {
      if (active && onError) onError(error);
    }
  };

  void loadAndEmit();

  channel = client
    .channel('u17-exercise-deleted-ids-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: EXERCISE_LIBRARY_DELETED_IDS_TABLE }, () => {
      void loadAndEmit();
    })
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR' && onError) {
        onError(new Error('Supabase realtime channel error for deleted exercise IDs'));
      }
    });

  return () => {
    active = false;
    if (channel) void client.removeChannel(channel);
  };
}

export async function addDeletedExerciseIdsCloud(ids: string[]): Promise<void> {
  const uniqueIds = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  if (uniqueIds.length === 0) return;

  const updatedAt = Date.now();
  const payload = uniqueIds.map((id) => ({ id, updated_at: updatedAt }));
  const { error } = await getClient()
    .from(EXERCISE_LIBRARY_DELETED_IDS_TABLE)
    .upsert(payload, { onConflict: 'id' });

  if (error) throw error;
}

export async function removeDeletedExerciseIdsCloud(ids: string[]): Promise<void> {
  const uniqueIds = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  if (uniqueIds.length === 0) return;

  const { error } = await getClient()
    .from(EXERCISE_LIBRARY_DELETED_IDS_TABLE)
    .delete()
    .in('id', uniqueIds);

  if (error) throw error;
}
