import {
  CloudTrainingSession,
  deleteSessionFromCloud,
  listSessionsFromCloudOnce,
  subscribeToSessions
} from '../firebase';
import {
  countSessionsSupabase,
  deleteSessionFromSupabase,
  isSupabaseSessionsEnabled,
  saveSessionFieldsByRoleSupabase,
  subscribeToSessionsSupabase,
  upsertSessionsSupabase
} from '../supabaseSessions';
import { PortalSection, TrainingSession } from '../types';
import { DEFAULT_MODULE_ID, getModuleIdFromSection, saveSessionBySection } from './trainingModules';

const SHOULD_AUTO_MIGRATE_SESSIONS = import.meta.env.VITE_SUPABASE_AUTO_MIGRATE_SESSIONS === 'true';
let hasTriedSupabaseSessionBootstrap = false;

async function bootstrapSupabaseSessionsFromFirebaseIfNeeded(): Promise<void> {
  if (!SHOULD_AUTO_MIGRATE_SESSIONS || hasTriedSupabaseSessionBootstrap) return;
  hasTriedSupabaseSessionBootstrap = true;

  const existingCount = await countSessionsSupabase();
  if (existingCount > 0) return;

  const firebaseSessions = await listSessionsFromCloudOnce();
  if (firebaseSessions.length === 0) return;

  await upsertSessionsSupabase(firebaseSessions);
}

export function subscribeTrainingSessions(
  callback: (sessions: CloudTrainingSession[]) => void,
  onError?: (error: any) => void
) {
  if (isSupabaseSessionsEnabled()) {
    bootstrapSupabaseSessionsFromFirebaseIfNeeded().catch((error) => {
      if (onError) onError(error);
    });

    let unsubscribe: (() => void) | null = null;
    subscribeToSessionsSupabase(callback, onError)
      .then((unsub) => {
        unsubscribe = unsub;
      })
      .catch((error) => {
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
