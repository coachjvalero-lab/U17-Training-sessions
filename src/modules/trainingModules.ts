import { CloudTrainingSession, saveSessionFieldsByRole } from '../firebase';
import { Exercise, GameMoment, PortalSection, PlayerGroup, TrainingBlock, TrainingSession } from '../types';

export type TrainingModuleId = 'football' | 'fitness' | 'gk';
export type SessionBlockKey = 'warmUp' | 'mainPart' | 'coolDown';

type SessionBlockField =
  | 'warmUp'
  | 'mainPart'
  | 'coolDown'
  | 'fitnessWarmUp'
  | 'fitnessMainPart'
  | 'fitnessCoolDown'
  | 'gkWarmUp'
  | 'gkMainPart'
  | 'gkCoolDown';

type SessionGroupsField = 'playerGroups' | 'fitnessPlayerGroups' | 'gkPlayerGroups';

export interface TrainingModuleContract {
  id: TrainingModuleId;
  label: string;
  blockFields: Record<SessionBlockKey, SessionBlockField>;
  playerGroupsField: SessionGroupsField;
  gameMoments: GameMoment[];
  save: (session: TrainingSession) => Promise<number>;
  getCloudUpdatedAt: (session: CloudTrainingSession) => number;
}

const FOOTBALL_GAME_MOMENTS: GameMoment[] = [
  '-',
  'Attack',
  'Defense',
  'Transition A-D',
  'Transition D-A',
  'Set Pieces',
  'Match',
  'Other'
];

const GOALKEEPER_GAME_MOMENTS: GameMoment[] = [
  '-',
  'Shot stop',
  'Depth control',
  '1 vs 1',
  'Feet distribution',
  'Cross defending'
];

const GOALKEEPER_SPECIFIC_MOMENTS = new Set<GameMoment>([
  'Shot stop',
  'Depth control',
  '1 vs 1',
  'Feet distribution',
  'Cross defending'
]);

export const TRAINING_MODULES: Record<TrainingModuleId, TrainingModuleContract> = {
  football: {
    id: 'football',
    label: 'Football',
    blockFields: {
      warmUp: 'warmUp',
      mainPart: 'mainPart',
      coolDown: 'coolDown'
    },
    playerGroupsField: 'playerGroups',
    gameMoments: FOOTBALL_GAME_MOMENTS,
    save: (session) => saveSessionFieldsByRole(session.id, 'football', session),
    getCloudUpdatedAt: (session) => session.footballUpdatedAt || session.updatedAt || 0
  },
  fitness: {
    id: 'fitness',
    label: 'Fitness',
    blockFields: {
      warmUp: 'fitnessWarmUp',
      mainPart: 'fitnessMainPart',
      coolDown: 'fitnessCoolDown'
    },
    playerGroupsField: 'fitnessPlayerGroups',
    gameMoments: FOOTBALL_GAME_MOMENTS,
    save: (session) => saveSessionFieldsByRole(session.id, 'fitness', session),
    getCloudUpdatedAt: (session) => session.fitnessUpdatedAt || session.updatedAt || 0
  },
  gk: {
    id: 'gk',
    label: 'GK',
    blockFields: {
      warmUp: 'gkWarmUp',
      mainPart: 'gkMainPart',
      coolDown: 'gkCoolDown'
    },
    playerGroupsField: 'gkPlayerGroups',
    gameMoments: GOALKEEPER_GAME_MOMENTS,
    save: (session) => {
      console.log('[GK TRACE][GoalkeeperModule.save] before saveSessionFieldsByRole', {
        sessionId: session.id,
        gkWarmUpLength: session.gkWarmUp?.exercises?.length ?? 0,
        gkMainPartLength: session.gkMainPart?.exercises?.length ?? 0,
        gkCoolDownLength: session.gkCoolDown?.exercises?.length ?? 0,
        gkPlayerGroupsLength: session.gkPlayerGroups?.length ?? 0
      });
      return saveSessionFieldsByRole(session.id, 'gk', session);
    },
    getCloudUpdatedAt: (session) => session.gkUpdatedAt || session.updatedAt || 0
  }
};

export const FootballModule = TRAINING_MODULES.football;
export const FitnessModule = TRAINING_MODULES.fitness;
export const GoalkeeperModule = TRAINING_MODULES.gk;

export const DEFAULT_MODULE_ID: TrainingModuleId = 'football';

export function getModuleIdFromSection(section: PortalSection): TrainingModuleId | null {
  if (section === 'football' || section === 'fitness' || section === 'gk') {
    return section;
  }
  return null;
}

export function getModuleGameMoments(moduleId: TrainingModuleId): GameMoment[] {
  return TRAINING_MODULES[moduleId].gameMoments;
}

export function getModuleRoleLabel(moduleId: TrainingModuleId): string {
  return TRAINING_MODULES[moduleId].label;
}

function defaultBlock(blockKey: SessionBlockKey, moduleId: TrainingModuleId): TrainingBlock {
  const blockTitle = blockKey === 'warmUp' ? 'Warm Up' : blockKey === 'mainPart' ? 'Main Part' : 'Cool Down';
  return {
    id: `${blockKey}-block-${moduleId}`,
    title: blockTitle,
    exercises: []
  };
}

function getModuleBlock(session: TrainingSession, moduleId: TrainingModuleId, blockKey: SessionBlockKey): TrainingBlock {
  const blockField = TRAINING_MODULES[moduleId].blockFields[blockKey];
  const existing = session[blockField] as TrainingBlock | undefined;
  return existing || defaultBlock(blockKey, moduleId);
}

function withFootballFitnessOverlay(session: TrainingSession): { warmUp: TrainingBlock; mainPart: TrainingBlock; coolDown: TrainingBlock } {
  const fitnessWarmUpAndMainExercises = [
    ...(session.fitnessWarmUp?.exercises || []),
    ...(session.fitnessMainPart?.exercises || [])
  ].map((ex) => ({
    ...ex,
    isFitness: true,
    hideGraphics: true
  }));

  const fitnessCoolDownExercises = [...(session.fitnessCoolDown?.exercises || [])].map((ex) => ({
    ...ex,
    isFitness: true,
    hideGraphics: true
  }));

  return {
    warmUp: {
      ...session.warmUp,
      exercises: [...session.warmUp.exercises, ...fitnessWarmUpAndMainExercises]
    },
    mainPart: session.mainPart,
    coolDown: {
      ...session.coolDown,
      exercises: [...session.coolDown.exercises, ...fitnessCoolDownExercises]
    }
  };
}

export function getModuleSessionView(session: TrainingSession, moduleId: TrainingModuleId): {
  warmUp: TrainingBlock;
  mainPart: TrainingBlock;
  coolDown: TrainingBlock;
  playerGroups: PlayerGroup[];
} {
  if (moduleId === 'football') {
    const footballView = withFootballFitnessOverlay(session);
    return {
      warmUp: footballView.warmUp,
      mainPart: footballView.mainPart,
      coolDown: footballView.coolDown,
      playerGroups: session.playerGroups
    };
  }

  const moduleDef = TRAINING_MODULES[moduleId];
  const playerGroups = (session[moduleDef.playerGroupsField] as PlayerGroup[] | undefined) || [];

  return {
    warmUp: getModuleBlock(session, moduleId, 'warmUp'),
    mainPart: getModuleBlock(session, moduleId, 'mainPart'),
    coolDown: getModuleBlock(session, moduleId, 'coolDown'),
    playerGroups
  };
}

export function updateSessionExercisesByModule(
  session: TrainingSession,
  moduleId: TrainingModuleId,
  blockKey: SessionBlockKey,
  exercises: Exercise[]
): TrainingSession {
  if (moduleId === 'football') {
    if (blockKey === 'warmUp') {
      const footballWarmUpExercises = exercises.filter((ex) => !ex.isFitness);
      const updatedFitnessExercises = exercises.filter((ex) => ex.isFitness);

      const fitnessWarmUpIds = new Set((session.fitnessWarmUp?.exercises || []).map((e) => e.id));
      const fitnessMainPartIds = new Set((session.fitnessMainPart?.exercises || []).map((e) => e.id));

      const nextFitnessWarmUp = updatedFitnessExercises.filter((e) => fitnessWarmUpIds.has(e.id));
      const nextFitnessMainPart = updatedFitnessExercises.filter((e) => fitnessMainPartIds.has(e.id));
      const unknownFitness = updatedFitnessExercises.filter((e) => !fitnessWarmUpIds.has(e.id) && !fitnessMainPartIds.has(e.id));

      return {
        ...session,
        warmUp: { ...session.warmUp, exercises: footballWarmUpExercises },
        fitnessWarmUp: {
          ...(session.fitnessWarmUp || defaultBlock('warmUp', 'fitness')),
          exercises: [...nextFitnessWarmUp, ...unknownFitness]
        },
        fitnessMainPart: {
          ...(session.fitnessMainPart || defaultBlock('mainPart', 'fitness')),
          exercises: nextFitnessMainPart
        }
      };
    }

    if (blockKey === 'coolDown') {
      const footballCoolDownExercises = exercises.filter((ex) => !ex.isFitness);
      const updatedFitnessExercises = exercises.filter((ex) => ex.isFitness);

      const fitnessCoolDownIds = new Set((session.fitnessCoolDown?.exercises || []).map((e) => e.id));
      const nextFitnessCoolDown = updatedFitnessExercises.filter((e) => fitnessCoolDownIds.has(e.id));
      const unknownFitness = updatedFitnessExercises.filter((e) => !fitnessCoolDownIds.has(e.id));

      return {
        ...session,
        coolDown: { ...session.coolDown, exercises: footballCoolDownExercises },
        fitnessCoolDown: {
          ...(session.fitnessCoolDown || defaultBlock('coolDown', 'fitness')),
          exercises: [...nextFitnessCoolDown, ...unknownFitness]
        }
      };
    }

    return {
      ...session,
      [blockKey]: {
        ...session[blockKey],
        exercises
      }
    };
  }

  const blockField = TRAINING_MODULES[moduleId].blockFields[blockKey];
  const existingBlock = (session[blockField] as TrainingBlock | undefined) || defaultBlock(blockKey, moduleId);

  return {
    ...session,
    [blockField]: {
      ...existingBlock,
      exercises
    }
  };
}

export function addExerciseToSessionByModule(
  session: TrainingSession,
  moduleId: TrainingModuleId,
  blockKey: SessionBlockKey,
  exercise: Exercise
): TrainingSession {
  const blockField = TRAINING_MODULES[moduleId].blockFields[blockKey];
  const existingBlock = (session[blockField] as TrainingBlock | undefined) || defaultBlock(blockKey, moduleId);

  return {
    ...session,
    [blockField]: {
      ...existingBlock,
      exercises: [...(existingBlock.exercises || []), exercise]
    }
  };
}

export function updateSessionGroupsByModule(
  session: TrainingSession,
  moduleId: TrainingModuleId,
  groups: PlayerGroup[]
): TrainingSession {
  const groupsField = TRAINING_MODULES[moduleId].playerGroupsField;
  return {
    ...session,
    [groupsField]: groups
  };
}

export function getModuleCloudUpdatedAt(session: CloudTrainingSession, moduleId: TrainingModuleId): number {
  return TRAINING_MODULES[moduleId].getCloudUpdatedAt(session);
}

export async function saveModuleSession(moduleId: TrainingModuleId, session: TrainingSession): Promise<number> {
  return TRAINING_MODULES[moduleId].save(session);
}

export async function saveSessionBySection(section: PortalSection, session: TrainingSession): Promise<{ moduleId: TrainingModuleId; savedAt: number }> {
  const moduleId = getModuleIdFromSection(section) || DEFAULT_MODULE_ID;
  const savedAt = await saveModuleSession(moduleId, session);
  return { moduleId, savedAt };
}

export function resolveExerciseModule(exercise: Exercise): TrainingModuleId {
  if (exercise.isFitness) {
    return 'fitness';
  }

  if (GOALKEEPER_SPECIFIC_MOMENTS.has(exercise.gameMoment)) {
    return 'gk';
  }

  return 'football';
}
