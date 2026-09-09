import { buildDefaultAttendanceFromRoster } from '../services/physio/squadInjurySync';
import type {
  Exercise,
  PlayerAttendance,
  PlayerGroup,
  SquadPlayer,
  TrainingBlock,
  TrainingSession
} from '../types';

export type TrainingModuleId = 'football' | 'fitness' | 'gk';

export interface DuplicateSessionOptions {
  moduleId: TrainingModuleId;
  nextSessionNumber?: string;
  existingSessions?: Array<{ sessionNumber?: string | number | null }>;
  todayDate?: string;
  squadPlayers?: SquadPlayer[];
  roster?: string[];
}

export function generateSessionId(moduleId: TrainingModuleId): string {
  const timestamp = Date.now();
  const rand = Math.random().toString(36).slice(2, 7);
  return moduleId === 'gk'
    ? `gk-session-${timestamp}-${rand}`
    : `session-${timestamp}-${rand}`;
}

export function generateExerciseId(_moduleHint?: string): string {
  const timestamp = Date.now();
  const rand = Math.random().toString(36).slice(2, 7);
  return `ex-${timestamp}-${rand}`;
}

export function generateGroupId(): string {
  const timestamp = Date.now();
  const rand = Math.random().toString(36).slice(2, 6);
  return `group-${timestamp}-${rand}`;
}

export function generateBlockId(prefix = 'block'): string {
  const timestamp = Date.now();
  const rand = Math.random().toString(36).slice(2, 6);
  return `${prefix}-${timestamp}-${rand}`;
}

/**
 * Calculates the next available non-conflicting session number.
 * Follows the existing pattern in the project (max numeric value + 1)
 * while preserving zero-padding if the sequence uses it (e.g. "001" -> "002")
 * and guaranteeing no conflict with existing session numbers.
 */
export function getNextSessionNumber(
  sessions: Array<{ sessionNumber?: string | number | null }> = [],
  currentSessionNumber?: string | number | null
): string {
  const existingNumbers = new Set<string>();
  let maxNumeric = 0;
  let hasPadding = false;
  let padLength = 1;

  for (const s of sessions) {
    if (!s || s.sessionNumber == null) continue;
    const str = String(s.sessionNumber).trim();
    if (!str) continue;
    existingNumbers.add(str.toLowerCase());

    const parsed = parseInt(str, 10);
    if (!isNaN(parsed) && /^\d+$/.test(str)) {
      if (parsed > maxNumeric) {
        maxNumeric = parsed;
      }
      if (str.startsWith('0') && str.length > 1) {
        hasPadding = true;
        padLength = Math.max(padLength, str.length);
      }
    }
  }

  if (currentSessionNumber != null) {
    const curStr = String(currentSessionNumber).trim();
    const curParsed = parseInt(curStr, 10);
    if (!isNaN(curParsed) && /^\d+$/.test(curStr)) {
      if (curParsed > maxNumeric) {
        maxNumeric = curParsed;
      }
      if (curStr.startsWith('0') && curStr.length > 1) {
        hasPadding = true;
        padLength = Math.max(padLength, curStr.length);
      }
    }
  }

  let candidateNum = maxNumeric + 1;
  let candidateStr = hasPadding
    ? String(candidateNum).padStart(padLength, '0')
    : String(candidateNum);

  while (existingNumbers.has(candidateStr.toLowerCase())) {
    candidateNum++;
    candidateStr = hasPadding
      ? String(candidateNum).padStart(padLength, '0')
      : String(candidateNum);
  }

  return candidateStr;
}

export function cloneExercise(exercise: Exercise): Exercise {
  return {
    ...exercise,
    id: generateExerciseId(exercise.module),
    name: exercise.name || '',
    module: exercise.module,
    gameMoment: exercise.gameMoment || '-',
    subMoment: exercise.subMoment || '',
    gameMoment2: exercise.gameMoment2,
    subMoment2: exercise.subMoment2,
    description: exercise.description || '',
    duration: exercise.duration || '',
    series: exercise.series,
    workTime: exercise.workTime,
    restTime: exercise.restTime,
    dimensions: exercise.dimensions,
    coachRoles: exercise.coachRoles,
    image: exercise.image,
    playerGroups: exercise.playerGroups,
    hideGraphics: exercise.hideGraphics,
    isFitness: exercise.isFitness,
    malikaChallenge: exercise.malikaChallenge
      ? {
          enabled: exercise.malikaChallenge.enabled,
          title: exercise.malikaChallenge.title,
          defaultPoints: exercise.malikaChallenge.defaultPoints
        }
      : undefined
  };
}

export function cloneBlock(block?: TrainingBlock, fallbackId = 'block'): TrainingBlock {
  if (!block) {
    return {
      id: generateBlockId(fallbackId),
      title: 'Training Block',
      exercises: []
    };
  }
  return {
    id: generateBlockId(fallbackId),
    title: block.title,
    exercises: Array.isArray(block.exercises)
      ? block.exercises.filter(Boolean).map(cloneExercise)
      : []
  };
}

export function clonePlayerGroups(groups?: PlayerGroup[]): PlayerGroup[] {
  if (!Array.isArray(groups)) return [];
  return groups.filter(Boolean).map((g) => ({
    id: generateGroupId(),
    groupNumber: g.groupNumber,
    bibColor: g.bibColor,
    players: g.players,
    name: g.name
  }));
}

export function extractExerciseIds(session: TrainingSession): string[] {
  const ids: string[] = [];
  const blocks = [
    session.warmUp,
    session.mainPart,
    session.coolDown,
    session.fitnessWarmUp,
    session.fitnessMainPart,
    session.fitnessCoolDown,
    session.gkWarmUp,
    session.gkMainPart,
    session.gkCoolDown
  ];
  for (const b of blocks) {
    if (b && Array.isArray(b.exercises)) {
      for (const ex of b.exercises) {
        if (ex && ex.id && !ids.includes(ex.id)) {
          ids.push(ex.id);
        }
      }
    }
  }
  return ids;
}

/**
 * Creates a complete independent copy of a training session.
 * - Generates new unique session_id, exercise IDs, and group IDs.
 * - Sets the session date to today.
 * - Assigns the next available session number without conflicts.
 * - Copies exercise configuration and player group setups.
 * - Explicitly strips execution data: clears observations, clears attendance/absence statuses,
 *   and creates a clean default roster attendance.
 */
export function duplicateTrainingSession(
  session: TrainingSession,
  options: DuplicateSessionOptions
): TrainingSession {
  const today = options.todayDate || new Date().toISOString().split('T')[0];
  const nextSessionNumber =
    options.nextSessionNumber ||
    getNextSessionNumber(options.existingSessions || [], session.sessionNumber);
  const newSessionId = generateSessionId(options.moduleId);

  const effectiveRoster =
    options.roster && options.roster.length > 0
      ? options.roster
      : Array.isArray(session.squadRoster)
        ? session.squadRoster
        : [];

  const cleanAttendance: PlayerAttendance[] =
    options.squadPlayers && options.squadPlayers.length > 0
      ? buildDefaultAttendanceFromRoster(effectiveRoster, options.squadPlayers)
      : buildDefaultAttendanceFromRoster(effectiveRoster);

  // Clone module-specific or standard blocks
  let warmUp: TrainingBlock;
  let mainPart: TrainingBlock;
  let coolDown: TrainingBlock;
  let playerGroups: PlayerGroup[];

  let fitnessWarmUp: TrainingBlock | undefined;
  let fitnessMainPart: TrainingBlock | undefined;
  let fitnessCoolDown: TrainingBlock | undefined;
  let fitnessPlayerGroups: PlayerGroup[] | undefined;

  let gkWarmUp: TrainingBlock | undefined;
  let gkMainPart: TrainingBlock | undefined;
  let gkCoolDown: TrainingBlock | undefined;
  let gkPlayerGroups: PlayerGroup[] | undefined;

  if (options.moduleId === 'fitness') {
    const sourceWarmUp = session.fitnessWarmUp || session.warmUp;
    const sourceMainPart = session.fitnessMainPart || session.mainPart;
    const sourceCoolDown = session.fitnessCoolDown || session.coolDown;
    const sourceGroups = session.fitnessPlayerGroups || session.playerGroups;

    fitnessWarmUp = cloneBlock(sourceWarmUp, 'warmup-block-fitness');
    fitnessMainPart = cloneBlock(sourceMainPart, 'main-block-fitness');
    fitnessCoolDown = cloneBlock(sourceCoolDown, 'cooldown-block-fitness');
    fitnessPlayerGroups = clonePlayerGroups(sourceGroups);

    // Keep top-level mirrors for universal editor compatibility
    warmUp = fitnessWarmUp;
    mainPart = fitnessMainPart;
    coolDown = fitnessCoolDown;
    playerGroups = fitnessPlayerGroups;
  } else if (options.moduleId === 'gk') {
    const sourceWarmUp = session.gkWarmUp || session.warmUp;
    const sourceMainPart = session.gkMainPart || session.mainPart;
    const sourceCoolDown = session.gkCoolDown || session.coolDown;
    const sourceGroups = session.gkPlayerGroups || session.playerGroups;

    gkWarmUp = cloneBlock(sourceWarmUp, 'warmup-block-gk');
    gkMainPart = cloneBlock(sourceMainPart, 'main-block-gk');
    gkCoolDown = cloneBlock(sourceCoolDown, 'cooldown-block-gk');
    gkPlayerGroups = clonePlayerGroups(sourceGroups);

    // Keep top-level mirrors for universal editor compatibility
    warmUp = gkWarmUp;
    mainPart = gkMainPart;
    coolDown = gkCoolDown;
    playerGroups = gkPlayerGroups;
  } else {
    // football (default)
    warmUp = cloneBlock(session.warmUp, 'warmup-block-football');
    mainPart = cloneBlock(session.mainPart, 'main-block-football');
    coolDown = cloneBlock(session.coolDown, 'cooldown-block-football');
    playerGroups = clonePlayerGroups(session.playerGroups);

    if (session.fitnessWarmUp || session.fitnessMainPart || session.fitnessCoolDown) {
      fitnessWarmUp = cloneBlock(session.fitnessWarmUp, 'warmup-block-fitness');
      fitnessMainPart = cloneBlock(session.fitnessMainPart, 'main-block-fitness');
      fitnessCoolDown = cloneBlock(session.fitnessCoolDown, 'cooldown-block-fitness');
      fitnessPlayerGroups = clonePlayerGroups(session.fitnessPlayerGroups);
    }

    if (session.gkWarmUp || session.gkMainPart || session.gkCoolDown) {
      gkWarmUp = cloneBlock(session.gkWarmUp, 'warmup-block-gk');
      gkMainPart = cloneBlock(session.gkMainPart, 'main-block-gk');
      gkCoolDown = cloneBlock(session.gkCoolDown, 'cooldown-block-gk');
      gkPlayerGroups = clonePlayerGroups(session.gkPlayerGroups);
    }
  }

  return {
    ...session,
    id: newSessionId,
    sessionNumber: nextSessionNumber,
    date: today,
    time: session.time || '18:30 - 20:00',
    teamName: session.teamName || 'U17 Women Al Ula',
    microcycleDay: session.microcycleDay || 'MD-3',
    mainObjective: session.mainObjective || '',
    materialsNeeded: session.materialsNeeded || '',
    observations: '', // Execution results/observations are explicitly cleared
    attendance: cleanAttendance, // Execution attendance status is reset
    squadRoster: effectiveRoster,
    warmUp,
    mainPart,
    coolDown,
    playerGroups,
    fitnessWarmUp,
    fitnessMainPart,
    fitnessCoolDown,
    fitnessPlayerGroups,
    gkWarmUp,
    gkMainPart,
    gkCoolDown,
    gkPlayerGroups
  };
}
