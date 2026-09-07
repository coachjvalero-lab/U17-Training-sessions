import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from '../../supabaseClient';
import { toCompetitionMonth, type MalikaAssignment } from '../../utils/malikaLeague';

const TABLE = 'malika_point_assignments';

interface MalikaAssignmentRow {
  id: string;
  player_id: string;
  session_id: string;
  exercise_id: string;
  exercise_name: string | null;
  competition_month: string;
  awarded_date: string;
  points: number | null;
  updated_at?: string | null;
}

function getClient() {
  if (!supabase) {
    throw new Error('Supabase client is not configured');
  }
  return supabase;
}

function fromRow(row: MalikaAssignmentRow): MalikaAssignment {
  return {
    id: row.id,
    playerId: row.player_id,
    sessionId: row.session_id,
    exerciseId: row.exercise_id,
    exerciseName: row.exercise_name || '',
    competitionMonth: row.competition_month,
    awardedDate: row.awarded_date,
    points: Number(row.points ?? 0) || 0,
    updatedAt: row.updated_at ?? undefined
  };
}

export async function listMalikaAssignments(): Promise<MalikaAssignment[]> {
  const { data, error } = await getClient()
    .from(TABLE)
    .select('*')
    .order('awarded_date', { ascending: false });

  if (error) throw error;
  return (data as MalikaAssignmentRow[] | null)?.map(fromRow) ?? [];
}

export async function listMalikaAssignmentsForExercise(
  sessionId: string,
  exerciseId: string
): Promise<MalikaAssignment[]> {
  const { data, error } = await getClient()
    .from(TABLE)
    .select('*')
    .eq('session_id', sessionId)
    .eq('exercise_id', exerciseId);

  if (error) throw error;
  return (data as MalikaAssignmentRow[] | null)?.map(fromRow) ?? [];
}

export interface SaveMalikaExerciseAwardsInput {
  sessionId: string;
  sessionDate: string;
  exerciseId: string;
  exerciseName: string;
  /** Fixed amount defined by the exercise; identical for every winner. */
  points: number;
  winnerPlayerIds: string[];
}

/**
 * Idempotent per (session, exercise): winners are upserted with the exercise's fixed
 * points and any previously awarded player that is no longer selected is removed.
 * Only rows of this exact session+exercise are touched, so concurrent edits of other
 * exercises (or other sessions) can never be overwritten.
 */
export async function saveMalikaExerciseAwards(
  input: SaveMalikaExerciseAwardsInput
): Promise<MalikaAssignment[]> {
  const client = getClient();
  const winners = Array.from(new Set(input.winnerPlayerIds.filter(Boolean)));
  const competitionMonth = toCompetitionMonth(input.sessionDate);
  const awardedDate = /^\d{4}-\d{2}-\d{2}$/.test(input.sessionDate)
    ? input.sessionDate
    : `${competitionMonth}-01`;
  const points = Math.max(0, Math.trunc(Number(input.points) || 0));

  if (winners.length > 0) {
    const rows = winners.map((playerId) => ({
      player_id: playerId,
      session_id: input.sessionId,
      exercise_id: input.exerciseId,
      exercise_name: input.exerciseName,
      competition_month: competitionMonth,
      awarded_date: awardedDate,
      points
    }));

    const { error } = await client
      .from(TABLE)
      .upsert(rows, { onConflict: 'session_id,exercise_id,player_id' });
    if (error) throw error;
  }

  let deleteQuery = client
    .from(TABLE)
    .delete()
    .eq('session_id', input.sessionId)
    .eq('exercise_id', input.exerciseId);

  if (winners.length > 0) {
    deleteQuery = deleteQuery.not('player_id', 'in', `(${winners.map((id) => `"${id}"`).join(',')})`);
  }

  const { error: deleteError } = await deleteQuery;
  if (deleteError) throw deleteError;

  return listMalikaAssignmentsForExercise(input.sessionId, input.exerciseId);
}

/** Realtime feed of the whole league (reloads on any change so deletes are reflected too). */
export function subscribeToMalikaAssignments(
  callback: (assignments: MalikaAssignment[]) => void,
  onError?: (error: unknown) => void
): () => void {
  const client = getClient();
  let active = true;
  let reloadTimer: ReturnType<typeof setTimeout> | null = null;

  const loadAndEmit = async () => {
    try {
      const assignments = await listMalikaAssignments();
      if (active) callback(assignments);
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
    .channel(`u17-malika-assignments-realtime-${crypto.randomUUID()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, (_payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
      scheduleReload();
    })
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR' && onError) {
        onError(new Error('Supabase realtime channel error for Malika assignments'));
      }
    });

  return () => {
    active = false;
    if (reloadTimer) clearTimeout(reloadTimer);
    void client.removeChannel(channel);
  };
}
