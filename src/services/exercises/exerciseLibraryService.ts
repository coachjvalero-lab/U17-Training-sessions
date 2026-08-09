import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../../supabaseClient';
import type { Exercise } from '../../types';

const EXERCISE_LIBRARY_TABLE = 'exercise_library';

type ExerciseRow = {
  id: string;
  name: string;
  game_moment: Exercise['gameMoment'];
  sub_moment: string;
  description: string;
  duration: string;
  series: string | null;
  work_time: string | null;
  rest_time: string | null;
  dimensions: string;
  coach_roles: string;
  image: string | null;
  player_groups: string | null;
  hide_graphics: boolean | null;
  is_fitness: boolean | null;
  malika_challenge: Exercise['malikaChallenge'] | null;
  updated_at: number;
};

export interface CloudExercise extends Exercise {
  updatedAt: number;
}

function getClient() {
  if (!supabase) throw new Error('Supabase client is not configured');
  return supabase;
}

function optionalNumberOrText(value: string | null): string | number | undefined {
  if (value === null) return undefined;
  const numeric = Number(value);
  return value.trim() !== '' && Number.isFinite(numeric) ? numeric : value;
}

function fromRow(row: ExerciseRow): CloudExercise {
  return {
    id: row.id,
    name: row.name,
    gameMoment: row.game_moment,
    subMoment: row.sub_moment,
    description: row.description,
    duration: row.duration,
    series: optionalNumberOrText(row.series),
    workTime: optionalNumberOrText(row.work_time),
    restTime: optionalNumberOrText(row.rest_time),
    dimensions: row.dimensions,
    coachRoles: row.coach_roles,
    image: row.image ?? undefined,
    playerGroups: row.player_groups ?? undefined,
    hideGraphics: row.hide_graphics ?? undefined,
    isFitness: row.is_fitness ?? undefined,
    malikaChallenge: row.malika_challenge ?? undefined,
    updatedAt: row.updated_at
  };
}

function toRow(exercise: Exercise, updatedAt: number): ExerciseRow {
  return {
    id: exercise.id,
    name: exercise.name,
    game_moment: exercise.gameMoment,
    sub_moment: exercise.subMoment,
    description: exercise.description,
    duration: exercise.duration,
    series: exercise.series === undefined || exercise.series === null ? null : String(exercise.series),
    work_time: exercise.workTime === undefined || exercise.workTime === null ? null : String(exercise.workTime),
    rest_time: exercise.restTime === undefined || exercise.restTime === null ? null : String(exercise.restTime),
    dimensions: exercise.dimensions,
    coach_roles: exercise.coachRoles,
    image: exercise.image ?? null,
    player_groups: exercise.playerGroups ?? null,
    hide_graphics: exercise.hideGraphics ?? null,
    is_fitness: exercise.isFitness ?? null,
    malika_challenge: exercise.malikaChallenge ?? null,
    updated_at: updatedAt
  };
}

async function listExercises(): Promise<CloudExercise[]> {
  const { data, error } = await getClient()
    .from(EXERCISE_LIBRARY_TABLE)
    .select('*');

  if (error) throw error;
  const mapped = ((data || []) as ExerciseRow[]).map(fromRow);
  const malikaEnabled = mapped.filter((exercise) => Boolean(exercise.malikaChallenge?.enabled)).length;
  console.log('[ExerciseLibraryService] load list', {
    total: mapped.length,
    malikaEnabled,
    sample: mapped.slice(0, 3).map((exercise) => ({
      id: exercise.id,
      name: exercise.name,
      malikaChallenge: exercise.malikaChallenge || null
    }))
  });
  return mapped;
}

export function subscribeToExerciseLibrary(
  callback: (exercises: CloudExercise[]) => void,
  onError?: (error: unknown) => void
): () => void {
  const client = getClient();
  let active = true;
  let channel: RealtimeChannel | null = null;

  const loadAndEmit = async () => {
    try {
      const exercises = await listExercises();
      if (active) callback(exercises);
    } catch (error) {
      if (active && onError) onError(error);
    }
  };

  void loadAndEmit();

  channel = client
    .channel('u17-exercise-library-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: EXERCISE_LIBRARY_TABLE }, () => {
      void loadAndEmit();
    })
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR' && onError) {
        onError(new Error('Supabase realtime channel error for exercise library'));
      }
    });

  return () => {
    active = false;
    if (channel) void client.removeChannel(channel);
  };
}

export async function saveExerciseToLibrary(exercise: Exercise): Promise<number> {
  const updatedAt = Date.now();
  console.log('[ExerciseLibraryService] save exercise', {
    id: exercise.id,
    name: exercise.name,
    malikaChallenge: exercise.malikaChallenge || null
  });
  const { error } = await getClient()
    .from(EXERCISE_LIBRARY_TABLE)
    .upsert(toRow(exercise, updatedAt), { onConflict: 'id' });

  if (error) throw error;
  console.log('[ExerciseLibraryService] save exercise OK', {
    id: exercise.id,
    updatedAt
  });
  return updatedAt;
}

export async function deleteExerciseFromLibrary(exerciseId: string): Promise<void> {
  const { error } = await getClient()
    .from(EXERCISE_LIBRARY_TABLE)
    .delete()
    .eq('id', exerciseId);

  if (error) throw error;
}
