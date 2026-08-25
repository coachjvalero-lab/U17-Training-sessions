import { getEmptySession } from '../defaultSession';
import { CloudTrainingSession, Exercise, FitnessSession, GameMoment, PortalSection, PlayerAttendance, PlayerGroup, SharedSessionHeader, TrainingBlock, TrainingSession } from '../types';

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

type OverlayDecoration = Pick<Exercise, 'isFitness' | 'hideGraphics'>;

interface SessionOverlayBinding {
  fromModuleId: TrainingModuleId;
  fromBlock: SessionBlockKey;
  toBlock: SessionBlockKey;
  position?: 'prepend' | 'append';
  decorate?: OverlayDecoration;
}

export interface TrainingModuleContract {
  id: TrainingModuleId;
  label: string;
  blockFields: Record<SessionBlockKey, SessionBlockField>;
  playerGroupsField: SessionGroupsField;
  overlayReads?: SessionOverlayBinding[];
  gameMoments: GameMoment[];
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
    overlayReads: [
      {
        fromModuleId: 'fitness',
        fromBlock: 'warmUp',
        toBlock: 'warmUp',
        position: 'prepend',
        decorate: {
          isFitness: true,
          hideGraphics: true
        }
      },
      {
        fromModuleId: 'fitness',
        fromBlock: 'mainPart',
        toBlock: 'warmUp',
        position: 'prepend',
        decorate: {
          isFitness: true,
          hideGraphics: true
        }
      },
      {
        fromModuleId: 'fitness',
        fromBlock: 'coolDown',
        toBlock: 'coolDown',
        position: 'prepend',
        decorate: {
          isFitness: true,
          hideGraphics: true
        }
      }
    ],
    gameMoments: FOOTBALL_GAME_MOMENTS,
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
    getCloudUpdatedAt: (session) => session.fitnessUpdatedAt || 0
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
    getCloudUpdatedAt: (session) => session.gkUpdatedAt || session.updatedAt || 0
  }
};

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

function decorateOverlayExercises(exercises: Exercise[], decorate?: OverlayDecoration): Exercise[] {
  if (!decorate) return exercises;
  return exercises.map((ex) => ({
    ...ex,
    ...decorate
  }));
}

type ModuleSessionView = {
  warmUp: TrainingBlock;
  mainPart: TrainingBlock;
  coolDown: TrainingBlock;
  playerGroups: PlayerGroup[];
};

const moduleSessionViewCache = new WeakMap<TrainingSession, Partial<Record<TrainingModuleId, ModuleSessionView>>>();

function buildModuleSessionView(session: TrainingSession, moduleId: TrainingModuleId): ModuleSessionView {
  const moduleDef = TRAINING_MODULES[moduleId];
  const baseWarmUp = getModuleBlock(session, moduleId, 'warmUp');
  const baseMainPart = getModuleBlock(session, moduleId, 'mainPart');
  const baseCoolDown = getModuleBlock(session, moduleId, 'coolDown');

  const playerGroups = (session[moduleDef.playerGroupsField] as PlayerGroup[] | undefined) || [];

  const blocksByKey: Record<SessionBlockKey, TrainingBlock> = {
    warmUp: baseWarmUp,
    mainPart: baseMainPart,
    coolDown: baseCoolDown
  };

  const overlayPrepends: Record<SessionBlockKey, Exercise[]> = {
    warmUp: [],
    mainPart: [],
    coolDown: []
  };
  const overlayAppends: Record<SessionBlockKey, Exercise[]> = {
    warmUp: [],
    mainPart: [],
    coolDown: []
  };

  (moduleDef.overlayReads || []).forEach((binding) => {
    const sourceBlock = getModuleBlock(session, binding.fromModuleId, binding.fromBlock);
    const overlayExercises = decorateOverlayExercises(sourceBlock.exercises || [], binding.decorate);
    if (binding.position === 'prepend') {
      overlayPrepends[binding.toBlock].push(...overlayExercises);
      return;
    }
    overlayAppends[binding.toBlock].push(...overlayExercises);
  });

  (Object.keys(blocksByKey) as SessionBlockKey[]).forEach((key) => {
    const targetBlock = blocksByKey[key];
    blocksByKey[key] = {
      ...targetBlock,
      exercises: [
        ...overlayPrepends[key],
        ...(targetBlock.exercises || []),
        ...overlayAppends[key]
      ]
    };
  });

  return {
    warmUp: blocksByKey.warmUp,
    mainPart: blocksByKey.mainPart,
    coolDown: blocksByKey.coolDown,
    playerGroups
  };
}

export function getModuleSessionView(session: TrainingSession, moduleId: TrainingModuleId): ModuleSessionView {
  const cachedByModule = moduleSessionViewCache.get(session);
  const cachedView = cachedByModule?.[moduleId];
  if (cachedView) {
    return cachedView;
  }

  const computed = buildModuleSessionView(session, moduleId);
  if (cachedByModule) {
    cachedByModule[moduleId] = computed;
  } else {
    moduleSessionViewCache.set(session, { [moduleId]: computed });
  }
  return computed;
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
  const normalizedExercise = moduleId === 'football' && exercise.isFitness
    ? {
        ...exercise,
        isFitness: false,
        hideGraphics: false
      }
    : exercise;

  return {
    ...session,
    [blockField]: {
      ...existingBlock,
      exercises: [...(existingBlock.exercises || []), normalizedExercise]
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

export function findMatchingFitnessSession(
  footballSession: {
    sessionNumber?: string | null;
    teamName?: string | null;
    date?: string | null;
    id?: string | null;
  },
  fitnessSessions: FitnessSession[]
): FitnessSession | null {
  const targetSessionNumber = (footballSession.sessionNumber || '').trim();
  if (!targetSessionNumber) return null;

  const targetTeam = (footballSession.teamName || '').trim().toLowerCase();
  const targetDate = (footballSession.date || '').trim();

  // 1. Strict canonical session number matching (preserves leading zeros: "020" !== "20")
  const numberMatches = fitnessSessions.filter((f) => {
    const fNumber = (f.sessionNumber || '').trim();
    return fNumber === targetSessionNumber;
  });

  if (numberMatches.length === 0) return null;
  if (numberMatches.length === 1) return numberMatches[0];

  // 2. If multiple candidates share the same session number, narrow by team name when specified
  let candidates = numberMatches;
  if (targetTeam) {
    const teamMatches = candidates.filter((f) => {
      const fTeam = (f.teamName || '').trim().toLowerCase();
      return !fTeam || fTeam === targetTeam;
    });
    if (teamMatches.length > 0) {
      candidates = teamMatches;
    }
  }

  if (candidates.length === 1) return candidates[0];

  // 3. Narrow by date when specified
  if (targetDate) {
    const dateMatches = candidates.filter((f) => (f.date || '').trim() === targetDate);
    if (dateMatches.length > 0) {
      candidates = dateMatches;
    }
  }

  if (candidates.length === 1) return candidates[0];

  // 4. Deterministic tie-breaker: select the most recently updated session
  return candidates.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0] || null;
}

export function resolveLinkedFitnessForFootballSession(
  footballSession: {
    sessionNumber?: string | null;
    teamName?: string | null;
    date?: string | null;
    id?: string | null;
  },
  fitnessSessions: FitnessSession[]
): {
  fitnessWarmUp?: TrainingBlock;
  fitnessMainPart?: TrainingBlock;
  fitnessCoolDown?: TrainingBlock;
  fitnessPlayerGroups?: PlayerGroup[];
} | null {
  const match = findMatchingFitnessSession(footballSession, fitnessSessions);
  if (!match) return null;
  return {
    fitnessWarmUp: match.fitnessWarmUp,
    fitnessMainPart: match.fitnessMainPart,
    fitnessCoolDown: match.fitnessCoolDown,
    fitnessPlayerGroups: match.fitnessPlayerGroups
  };
}

export function mergeFootballSessionWithFitnessSource(
  session: TrainingSession,
  linkedFitness: {
    fitnessWarmUp?: TrainingBlock;
    fitnessMainPart?: TrainingBlock;
    fitnessCoolDown?: TrainingBlock;
    fitnessPlayerGroups?: PlayerGroup[];
  } | null
): TrainingSession {
  if (!linkedFitness) return session;

  return {
    ...session,
    fitnessWarmUp: linkedFitness.fitnessWarmUp ?? session.fitnessWarmUp,
    fitnessMainPart: linkedFitness.fitnessMainPart ?? session.fitnessMainPart,
    fitnessCoolDown: linkedFitness.fitnessCoolDown ?? session.fitnessCoolDown,
    fitnessPlayerGroups: linkedFitness.fitnessPlayerGroups ?? session.fitnessPlayerGroups
  };
}

export function resolveExerciseModule(exercise: Exercise): TrainingModuleId {
  if (exercise.module === 'football' || exercise.module === 'fitness' || exercise.module === 'gk') {
    return exercise.module;
  }

  const moduleByPredicate: Array<{ moduleId: TrainingModuleId; matches: (ex: Exercise) => boolean }> = [
    { moduleId: 'fitness', matches: (ex) => Boolean(ex.isFitness) },
    { moduleId: 'gk', matches: (ex) => GOALKEEPER_SPECIFIC_MOMENTS.has(ex.gameMoment) }
  ];

  const matchingModule = moduleByPredicate.find((entry) => entry.matches(exercise));
  return matchingModule?.moduleId || 'football';
}
