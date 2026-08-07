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
import { supabase } from '../supabaseClient';
import { PortalSection, TrainingSession } from '../types';
import { DEFAULT_MODULE_ID, getModuleIdFromSection, saveSessionBySection } from './trainingModules';

const SHOULD_AUTO_MIGRATE_SESSIONS = import.meta.env.VITE_SUPABASE_AUTO_MIGRATE_SESSIONS === 'true';
let hasTriedSupabaseSessionBootstrap = false;
let supabaseBootstrapPromise: Promise<void> | null = null;
let shouldUseFirebaseForRuntime = false;

async function bootstrapSupabaseSessionsFromFirebaseIfNeeded(): Promise<void> {
  if (!SHOULD_AUTO_MIGRATE_SESSIONS || hasTriedSupabaseSessionBootstrap) return;
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
  if (isSupabaseSessionsEnabled() && !shouldUseFirebaseForRuntime) {
    let unsubscribe: (() => void) | null = null;
    let isDisposed = false;
    let authSubscription: { unsubscribe: () => void } | null = null;

    const fallbackToFirebase = (error: unknown) => {
      console.error('[F3] error', error);
      shouldUseFirebaseForRuntime = true;
      if (onError) onError(error);
      if (isDisposed) return;
      unsubscribe = subscribeToSessions(callback, undefined, onError);
    };

    const start = async () => {
      try {
        if (!supabase) {
          throw new Error('Supabase client unavailable while provider is set to supabase');
        }

        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          throw sessionError;
        }

        if (!sessionData.session) {
          console.info('[F3] no hay sesion Supabase activa; fallback inmediato a Firebase');
          fallbackToFirebase(new Error('Missing Supabase session'));
          return;
        }

        await bootstrapSupabaseSessionsFromFirebaseIfNeeded();
        if (isDisposed) return;

        console.info('[F3] inicio subscribe Supabase');
        unsubscribe = await subscribeToSessionsSupabase(callback, onError);
      } catch (error) {
        fallbackToFirebase(error);
      }
    };

    start().catch((error) => {
      fallbackToFirebase(error);
    });

    return () => {
      isDisposed = true;
      if (authSubscription) {
        authSubscription.unsubscribe();
      }
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
