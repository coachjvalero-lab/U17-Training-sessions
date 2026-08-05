import { CloudTrainingSession, saveSessionFieldsByRole } from '../firebase';
import { getEmptySession } from '../defaultSession';
import { Exercise, GameMoment, PortalSection, PlayerAttendance, PlayerGroup, SharedSessionHeader, TrainingBlock, TrainingSession } from '../types';

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

export function getSharedSessionHeader(session: TrainingSession, updatedAt?: number): SharedSessionHeader {
  return {
    id: session.id,
    sessionNumber: session.sessionNumber,
    date: session.date,
    time: session.time,
    teamName: session.teamName,
    microcycleDay: session.microcycleDay,
    attendance: session.attendance || [],
    squadRoster: session.squadRoster || [],
    updatedAt
  };
}

export function hydrateTrainingSession(base: Partial<TrainingSession>): TrainingSession {
  const empty = getEmptySession();

  return {
    ...empty,
    ...base,
    attendance: Array.isArray(base.attendance) ? base.attendance : (empty.attendance || []),
    squadRoster: Array.isArray(base.squadRoster) ? base.squadRoster : (empty.squadRoster || []),
    warmUp: base.warmUp || empty.warmUp,
    mainPart: base.mainPart || empty.mainPart,
    coolDown: base.coolDown || empty.coolDown,
    playerGroups: base.playerGroups || empty.playerGroups,
    fitnessWarmUp: base.fitnessWarmUp || empty.fitnessWarmUp,
    fitnessMainPart: base.fitnessMainPart || empty.fitnessMainPart,
    fitnessCoolDown: base.fitnessCoolDown || empty.fitnessCoolDown,
    fitnessPlayerGroups: base.fitnessPlayerGroups || empty.fitnessPlayerGroups,
    gkWarmUp: base.gkWarmUp || empty.gkWarmUp,
    gkMainPart: base.gkMainPart || empty.gkMainPart,
    gkCoolDown: base.gkCoolDown || empty.gkCoolDown,
    gkPlayerGroups: base.gkPlayerGroups || empty.gkPlayerGroups,
    observations: base.observations ?? empty.observations,
    materialsNeeded: base.materialsNeeded ?? empty.materialsNeeded,
    mainObjective: base.mainObjective ?? empty.mainObjective,
    microcycleDay: base.microcycleDay ?? empty.microcycleDay,
    sessionNumber: base.sessionNumber ?? empty.sessionNumber,
    date: base.date ?? empty.date,
    time: base.time ?? empty.time,
    teamName: base.teamName ?? empty.teamName,
    id: base.id ?? empty.id
  };
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
  const fitnessWarmUpExercises = [
    ...(session.fitnessWarmUp?.exercises || [])
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
      exercises: [...session.warmUp.exercises, ...fitnessWarmUpExercises]
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
    return {
      ...session,
      [blockKey]: {
        ...session[blockKey],
        // Football can never mutate Fitness-owned overlay exercises.
        exercises: exercises.filter((ex) => !ex.isFitness)
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
  const moduleByPredicate: Array<{ moduleId: TrainingModuleId; matches: (ex: Exercise) => boolean }> = [
    { moduleId: 'fitness', matches: (ex) => Boolean(ex.isFitness) },
    { moduleId: 'gk', matches: (ex) => GOALKEEPER_SPECIFIC_MOMENTS.has(ex.gameMoment) }
  ];

  const matchingModule = moduleByPredicate.find((entry) => entry.matches(exercise));
  return matchingModule?.moduleId || 'football';
}
