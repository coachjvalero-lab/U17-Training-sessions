import type { Exercise, ExerciseModule } from '../../types';
import {
  deleteExerciseFromLibrary,
  saveExerciseToLibrary,
  subscribeToExerciseLibraryByModule,
  type CloudExercise
} from '../exercises/exerciseLibraryService';

const FITNESS_MODULE: ExerciseModule = 'fitness';

function ensureFitnessExercise(exercise: Exercise): Exercise {
  return {
    ...exercise,
    module: FITNESS_MODULE,
    isFitness: true
  };
}

export function subscribeToFitnessExercises(
  callback: (exercises: CloudExercise[]) => void,
  onError?: (error: unknown) => void
): () => void {
  return subscribeToExerciseLibraryByModule(FITNESS_MODULE, callback, onError);
}

export async function saveFitnessExercise(exercise: Exercise): Promise<number> {
  return saveExerciseToLibrary(ensureFitnessExercise(exercise));
}

export async function deleteFitnessExercise(exerciseId: string): Promise<void> {
  return deleteExerciseFromLibrary(exerciseId);
}
