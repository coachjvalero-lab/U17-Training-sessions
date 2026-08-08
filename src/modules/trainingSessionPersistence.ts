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

let hasTriedSupabaseSessionBootstrap = false;
let supabaseBootstrapPromise: Promise<void> | null = null;

async function bootstrapSupabaseSessionsFromFirebaseIfNeeded(): Promise<void> {
  if (hasTriedSupabaseSessionBootstrap) return;
  if (supabaseBootstrapPromise) {
    await supabaseBootstrapPromise;
    return;
  }

  supabaseBootstrapPromise = (async () => {
    console.info('[F3] inicio bootstrap');
    try {
      const existingCount = await countSessionsSupabase();
      console.info(`[F3] sesiones encontradas en Supabase: ${existingCount}`);
      if (existingCount > 0) return;

      const firebaseSessions = await listSessionsFromCloudOnce();
      console.info(`[F3] sesiones leidas de Firebase: ${firebaseSessions.length}`);
      if (firebaseSessions.length === 0) return;

      console.info('[F3] inicio upsert');
      await upsertSessionsSupabase(firebaseSessions);
      console.info('[F3] fin upsert');
    } catch (error) {
      console.error('[F3] error bootstrap', error);
      throw error;
    } finally {
      hasTriedSupabaseSessionBootstrap = true;
      supabaseBootstrapPromise = null;
    }
  })();

  await supabaseBootstrapPromise;
}

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
