import {
  deleteSessionFromSupabase,
  saveSessionFieldsByRoleSupabase,
  subscribeToSessionsSupabase
} from '../supabaseSessions';
import { saveFitnessSession } from '../services/fitness/fitnessSessionsService';
import { CloudTrainingSession, FitnessSession, PortalSection, TrainingSession } from '../types';
import { DEFAULT_MODULE_ID, getModuleIdFromSection } from './trainingModules';

function toFitnessSessionRecord(session: TrainingSession): FitnessSession {
  const normalizedSessionUid = (session.id || '').trim();
  if (!normalizedSessionUid || normalizedSessionUid.startsWith('empty-session-')) {
    throw new Error('Fitness persistence requires a valid session UID.');
  }

  const now = Date.now();
  return {
    id: `fit-${normalizedSessionUid}`,
    sessionUid: normalizedSessionUid,
    legacySessionId: normalizedSessionUid,
    teamName: session.teamName,
    date: session.date,
    time: session.time,
    sessionNumber: session.sessionNumber,
    microcycleDay: session.microcycleDay,
    mainObjective: session.mainObjective,
    materialsNeeded: session.materialsNeeded,
    observations: session.observations,
    squadRoster: session.squadRoster || [],
    attendance: session.attendance || [],
    fitnessWarmUp: session.fitnessWarmUp,
    fitnessMainPart: session.fitnessMainPart,
    fitnessCoolDown: session.fitnessCoolDown,
    fitnessPlayerGroups: session.fitnessPlayerGroups || [],
    createdAt: now,
    updatedAt: now
  };
}

export function subscribeTrainingSessions(
  callback: (sessions: CloudTrainingSession[]) => void,
  onError?: (error: any) => void
) {
  let unsubscribe: (() => void) | null = null;

  const start = async () => {
    try {
      console.log('[trainingSessionPersistence] subscribeTrainingSessions starting...');
      unsubscribe = await subscribeToSessionsSupabase(callback, onError);
      console.log('[trainingSessionPersistence] subscribeToSessionsSupabase initialized');
    } catch (error) {
      console.error('[trainingSessionPersistence] Failed to subscribe:', error);
      if (onError) onError(error);
    }
  };

  start().catch((error) => {
    console.error('[trainingSessionPersistence] start() caught error:', error);
    if (onError) onError(error);
  });

  return () => {
    if (unsubscribe) unsubscribe();
  };
}

export async function deleteTrainingSession(sessionId: string): Promise<void> {
  return deleteSessionFromSupabase(sessionId);
}

export async function saveTrainingSessionBySection(
  section: PortalSection,
  session: TrainingSession
): Promise<{ moduleId: 'football' | 'fitness' | 'gk'; savedAt: number }> {
  const moduleId = getModuleIdFromSection(section) || DEFAULT_MODULE_ID;

  if (moduleId === 'football') {
    const savedAt = await saveSessionFieldsByRoleSupabase(session.id, moduleId, session);
    return { moduleId, savedAt };
  }

  if (moduleId === 'fitness') {
    const payload = toFitnessSessionRecord(session);
    const savedAt = await saveFitnessSession(payload);
    return { moduleId, savedAt };
  }

  throw new Error('GK module has no independent persistence model yet. Writes are blocked by design.');
}
