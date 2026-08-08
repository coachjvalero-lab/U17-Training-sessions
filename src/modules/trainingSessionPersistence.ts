import {
  CloudTrainingSession,
  deleteSessionFromCloud,
  subscribeToSessions
} from '../firebase';
import {
  deleteSessionFromSupabase,
  isSupabaseSessionsEnabled,
  saveSessionFieldsByRoleSupabase,
  subscribeToSessionsSupabase
} from '../supabaseSessions';
import { PortalSection, TrainingSession } from '../types';
import { DEFAULT_MODULE_ID, getModuleIdFromSection, saveSessionBySection } from './trainingModules';

export function subscribeTrainingSessions(
  callback: (sessions: CloudTrainingSession[]) => void,
  onError?: (error: any) => void
) {
  if (isSupabaseSessionsEnabled()) {
    let unsubscribe: (() => void) | null = null;

    const start = async () => {
      try {
        unsubscribe = await subscribeToSessionsSupabase(callback, onError);
      } catch (error) {
        if (onError) onError(error);
      }
    };

    start().catch((error) => {
      if (onError) onError(error);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }

  return subscribeToSessions(callback, undefined, onError);
}

export async function deleteTrainingSession(sessionId: string): Promise<void> {
  if (isSupabaseSessionsEnabled()) {
    return deleteSessionFromSupabase(sessionId);
  }
  return deleteSessionFromCloud(sessionId);
}

export async function saveTrainingSessionBySection(
  section: PortalSection,
  session: TrainingSession
): Promise<{ moduleId: 'football' | 'fitness' | 'gk'; savedAt: number }> {
  if (isSupabaseSessionsEnabled()) {
    const moduleId = getModuleIdFromSection(section) || DEFAULT_MODULE_ID;
    const savedAt = await saveSessionFieldsByRoleSupabase(session.id, moduleId, session);
    return { moduleId, savedAt };
  }

  return saveSessionBySection(section, session);
}
