import {
  deleteSessionFromSupabase,
  saveSessionFieldsByRoleSupabase,
  subscribeToSessionsSupabase
} from '../supabaseSessions';
import { CloudTrainingSession, PortalSection, TrainingSession } from '../types';
import { DEFAULT_MODULE_ID, getModuleIdFromSection } from './trainingModules';

export function subscribeTrainingSessions(
  callback: (sessions: CloudTrainingSession[]) => void,
  onError?: (error: any) => void
) {
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

export async function deleteTrainingSession(sessionId: string): Promise<void> {
  return deleteSessionFromSupabase(sessionId);
}

export async function saveTrainingSessionBySection(
  section: PortalSection,
  session: TrainingSession
): Promise<{ moduleId: 'football' | 'fitness' | 'gk'; savedAt: number }> {
  const moduleId = getModuleIdFromSection(section) || DEFAULT_MODULE_ID;
  const savedAt = await saveSessionFieldsByRoleSupabase(session.id, moduleId, session);
  return { moduleId, savedAt };
}
