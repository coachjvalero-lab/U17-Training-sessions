/// <reference types="node" />

import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: ['.env.local', '.env'] });

type Module = 'football' | 'fitness' | 'gk';

type ExerciseRow = {
  id: string;
  name: string;
  game_moment: string;
  is_fitness: boolean | null;
  module: Module | null;
};

type SessionRow = {
  warm_up: any;
  main_part: any;
  cool_down: any;
  fitness_warm_up: any;
  fitness_main_part: any;
  fitness_cool_down: any;
  gk_warm_up: any;
  gk_main_part: any;
  gk_cool_down: any;
};

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function requireSupabaseUrl(): string {
  const value = process.env.VITE_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim();
  if (!value) throw new Error('Missing required environment variable: VITE_SUPABASE_URL or SUPABASE_URL');
  return value;
}

const supabase = createClient(requireSupabaseUrl(), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { autoRefreshToken: false, persistSession: false }
});

function extractExerciseIds(block: any): string[] {
  const exercises = block?.exercises;
  if (!Array.isArray(exercises)) return [];
  return exercises.map((exercise) => exercise?.id).filter((id): id is string => typeof id === 'string' && id.length > 0);
}

function classifyByUsage(usage: Set<Module>): Module | 'ambiguous' {
  if (usage.size === 1) return [...usage][0];
  if (usage.size === 0) return 'ambiguous';
  return 'ambiguous';
}

function classifyExercise(exercise: ExerciseRow, usage: Set<Module>): { module: Module | 'ambiguous'; reason: string } {
  if (exercise.module === 'football' || exercise.module === 'fitness' || exercise.module === 'gk') {
    return { module: exercise.module, reason: 'module_column' };
  }

  if (exercise.is_fitness === true) {
    return { module: 'fitness', reason: 'is_fitness_true' };
  }

  if (
    exercise.game_moment === 'Shot stop' ||
    exercise.game_moment === 'Depth control' ||
    exercise.game_moment === '1 vs 1' ||
    exercise.game_moment === 'Feet distribution' ||
    exercise.game_moment === 'Cross defending'
  ) {
    return { module: 'gk', reason: 'gk_game_moment' };
  }

  if (exercise.is_fitness === false) {
    return { module: 'football', reason: 'is_fitness_false' };
  }

  const usageClass = classifyByUsage(usage);
  if (usageClass !== 'ambiguous') {
    return { module: usageClass, reason: 'usage_based' };
  }

  return { module: 'ambiguous', reason: 'insufficient_signal' };
}

async function main() {
  const apply = process.argv.includes('--apply');

  const [{ data: exercises, error: exErr }, { data: sessions, error: sessErr }] = await Promise.all([
    supabase.from('exercise_library').select('id,name,game_moment,is_fitness,module'),
    supabase.from('sessions').select('warm_up,main_part,cool_down,fitness_warm_up,fitness_main_part,fitness_cool_down,gk_warm_up,gk_main_part,gk_cool_down')
  ]);

  if (exErr) throw exErr;
  if (sessErr) throw sessErr;

  const usageByExerciseId = new Map<string, Set<Module>>();

  (sessions || []).forEach((row: any) => {
    const session = row as SessionRow;
    extractExerciseIds(session.warm_up).forEach((id) => {
      const usage = usageByExerciseId.get(id) || new Set<Module>();
      usage.add('football');
      usageByExerciseId.set(id, usage);
    });
    extractExerciseIds(session.main_part).forEach((id) => {
      const usage = usageByExerciseId.get(id) || new Set<Module>();
      usage.add('football');
      usageByExerciseId.set(id, usage);
    });
    extractExerciseIds(session.cool_down).forEach((id) => {
      const usage = usageByExerciseId.get(id) || new Set<Module>();
      usage.add('football');
      usageByExerciseId.set(id, usage);
    });

    extractExerciseIds(session.fitness_warm_up).forEach((id) => {
      const usage = usageByExerciseId.get(id) || new Set<Module>();
      usage.add('fitness');
      usageByExerciseId.set(id, usage);
    });
    extractExerciseIds(session.fitness_main_part).forEach((id) => {
      const usage = usageByExerciseId.get(id) || new Set<Module>();
      usage.add('fitness');
      usageByExerciseId.set(id, usage);
    });
    extractExerciseIds(session.fitness_cool_down).forEach((id) => {
      const usage = usageByExerciseId.get(id) || new Set<Module>();
      usage.add('fitness');
      usageByExerciseId.set(id, usage);
    });

    extractExerciseIds(session.gk_warm_up).forEach((id) => {
      const usage = usageByExerciseId.get(id) || new Set<Module>();
      usage.add('gk');
      usageByExerciseId.set(id, usage);
    });
    extractExerciseIds(session.gk_main_part).forEach((id) => {
      const usage = usageByExerciseId.get(id) || new Set<Module>();
      usage.add('gk');
      usageByExerciseId.set(id, usage);
    });
    extractExerciseIds(session.gk_cool_down).forEach((id) => {
      const usage = usageByExerciseId.get(id) || new Set<Module>();
      usage.add('gk');
      usageByExerciseId.set(id, usage);
    });
  });

  const report = {
    total: 0,
    football: 0,
    fitness: 0,
    gk: 0,
    ambiguous: 0,
    ambiguousRecords: [] as Array<{ id: string; name: string; gameMoment: string; isFitness: boolean | null; usage: string[]; reason: string; status: 'AMBIGUOUS / REQUIRES REVIEW' }> ,
    safeUpdates: [] as Array<{ id: string; module: Module; reason: string }>
  };

  for (const exercise of (exercises || []) as ExerciseRow[]) {
    const usage = usageByExerciseId.get(exercise.id) || new Set<Module>();
    const classified = classifyExercise(exercise, usage);

    report.total += 1;
    if (classified.module === 'football') report.football += 1;
    if (classified.module === 'fitness') report.fitness += 1;
    if (classified.module === 'gk') report.gk += 1;

    if (classified.module === 'ambiguous') {
      report.ambiguous += 1;
      report.ambiguousRecords.push({
        id: exercise.id,
        name: exercise.name,
        gameMoment: exercise.game_moment,
        isFitness: exercise.is_fitness,
        usage: [...usage.values()],
        reason: classified.reason,
        status: 'AMBIGUOUS / REQUIRES REVIEW'
      });
    } else if (exercise.module !== classified.module) {
      report.safeUpdates.push({ id: exercise.id, module: classified.module, reason: classified.reason });
    }
  }

  if (apply) {
    if (report.ambiguous > 0) {
      console.log(JSON.stringify({ ok: false, reason: 'ambiguous_records_present', report }, null, 2));
      process.exit(2);
    }

    for (const update of report.safeUpdates) {
      const { error } = await supabase
        .from('exercise_library')
        .update({ module: update.module })
        .eq('id', update.id);
      if (error) {
        throw error;
      }
    }
  }

  console.log(JSON.stringify({ ok: true, apply, report }, null, 2));
}

main().catch((error) => {
  console.error('[report-exercise-module-classification] failed:', error);
  process.exit(1);
});
