import { initializeApp, deleteApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  getDoc,
  getDocs,
  query, 
  orderBy, 
  onSnapshot,
  arrayUnion,
  arrayRemove,
  setLogLevel
} from 'firebase/firestore';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail,
  signOut, 
  onAuthStateChanged, 
  User 
} from 'firebase/auth';
import {
  CloudTrainingSession,
  Exercise,
  MatchFixture,
  PhysioRecord,
  SessionCardDocument,
  SquadPlayer,
  TrainingSession,
  VideoAnalysis
} from './types';
import { getEmptySession } from './defaultSession';
import { OFFICIAL_ALULA_LOGO_DATA_URL } from './constants/logo';
import type { UserPermission } from './utils/permissions';
import { isSupabaseAuthEnabled, isSupabasePermissionsEnabled, supabase } from './supabaseClient';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'demo-api-key',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'demo-project.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'demo-project',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'demo-project.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '000000000000',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:000000000000:web:demo',
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore with a safe fallback database ID
export const db = getFirestore(app, import.meta.env.VITE_FIREBASE_DATABASE_ID || 'default');
const defaultDb = getFirestore(app, 'default');
setLogLevel('silent');

// Initialize Firebase Auth
export const auth = getAuth(app);

let authListeners: ((user: User | null) => void)[] = [];

const SUPABASE_USER_ROLES_TABLE = 'user_roles';

type SupabaseUserRoleRow = {
  email: string;
  role: UserPermission['role'];
  allowed_sections: string[] | null;
  updated_at?: string | null;
};

type SupabaseErrorSummary = {
  code: string;
  message: string;
  details: string | null;
  hint: string | null;
  status: number | null;
};

function summarizeSupabaseError(error: unknown): SupabaseErrorSummary {
  if (error && typeof error === 'object') {
    const err = error as {
      code?: unknown;
      message?: unknown;
      details?: unknown;
      hint?: unknown;
      status?: unknown;
    };
    return {
      code: err.code ? String(err.code) : 'unknown',
      message: err.message ? String(err.message) : 'Unknown Supabase error',
      details: err.details ? String(err.details) : null,
      hint: err.hint ? String(err.hint) : null,
      status: typeof err.status === 'number' ? err.status : null
    };
  }

  return {
    code: 'unknown',
    message: error instanceof Error ? error.message : String(error),
    details: null,
    hint: null,
    status: null
  };
}

export async function getSupabaseAuthDiagnostics(): Promise<{
  sessionExists: boolean;
  userExists: boolean;
  userEmail: string | null;
  userId: string | null;
  sessionError: SupabaseErrorSummary | null;
  userError: SupabaseErrorSummary | null;
}> {
  if (!supabase) {
    return {
      sessionExists: false,
      userExists: false,
      userEmail: null,
      userId: null,
      sessionError: {
        code: 'supabase/not-configured',
        message: 'Supabase client is not configured',
        details: null,
        hint: null,
        status: null
      },
      userError: null
    };
  }

  const [sessionResult, userResult] = await Promise.allSettled([
    supabase.auth.getSession(),
    supabase.auth.getUser()
  ]);

  const sessionData = sessionResult.status === 'fulfilled' ? sessionResult.value.data : null;
  const userData = userResult.status === 'fulfilled' ? userResult.value.data : null;

  const sessionError = sessionResult.status === 'rejected'
    ? summarizeSupabaseError(sessionResult.reason)
    : sessionResult.value.error
      ? summarizeSupabaseError(sessionResult.value.error)
      : null;

  const userError = userResult.status === 'rejected'
    ? summarizeSupabaseError(userResult.reason)
    : userResult.value.error
      ? summarizeSupabaseError(userResult.value.error)
      : null;

  const sessionUser = sessionData?.session?.user || null;
  const currentUser = userData?.user || sessionUser;

  return {
    sessionExists: Boolean(sessionData?.session),
    userExists: Boolean(currentUser),
    userEmail: currentUser?.email || null,
    userId: currentUser?.id || null,
    sessionError,
    userError
  };
}

function normalizeUserEmail(usernameOrEmail: string): string {
  let cleanInput = usernameOrEmail.trim().toLowerCase();
  if (!cleanInput.includes('@')) {
    cleanInput = `${cleanInput}@alula.com`;
  }
  return cleanInput;
}

function isSupabaseEmailNotConfirmedError(error: unknown): boolean {
  const message = (error as { message?: string } | null)?.message?.toLowerCase() || '';
  return message.includes('email not confirmed') || message.includes('email_not_confirmed');
}

function toFirebaseLikeUser(supabaseUser: { id: string; email?: string | null } | null): User | null {
  if (!supabaseUser) return null;
  return {
    uid: supabaseUser.id,
    email: supabaseUser.email || null
  } as unknown as User;
}

function mapSupabaseRoleRowToPermission(row: SupabaseUserRoleRow): UserPermission {
  const allowedSections = Array.isArray(row.allowed_sections)
    ? row.allowed_sections.filter((section): section is UserPermission['allowedSections'][number] => typeof section === 'string')
    : [];

  return {
    email: row.email,
    role: row.role,
    allowedSections
  };
}

async function fetchSupabasePermissionsList(): Promise<UserPermission[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from(SUPABASE_USER_ROLES_TABLE)
    .select('email, role, allowed_sections')
    .order('email', { ascending: true });

  if (error) {
    throw error;
  }

  return ((data || []) as SupabaseUserRoleRow[]).map(mapSupabaseRoleRowToPermission);
}

/**
 * Sign in with username or email and password.
 * Converts plain usernames like 'admin' to 'admin@alula.com' automatically.
 */
export async function loginUser(usernameOrEmail: string, pass: string): Promise<User> {
  const cleanInput = normalizeUserEmail(usernameOrEmail);

  if (isSupabaseAuthEnabled() && supabase) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanInput,
      password: pass
    });
    if (error) {
      if (!isSupabaseEmailNotConfirmedError(error)) {
        throw error;
      }

      // Transitional fallback: keep access operational while Supabase email
      // confirmation is still enabled for existing users.
      const cred = await signInWithEmailAndPassword(auth, cleanInput, pass);
      return cred.user;
    }

    const mapped = toFirebaseLikeUser(data.user);
    if (!mapped) {
      throw new Error('Supabase login succeeded but no user session was returned.');
    }

    const diagnostics = await getSupabaseAuthDiagnostics();
    if (!diagnostics.sessionExists || !diagnostics.userExists) {
      const authError = new Error('Supabase login succeeded but browser auth session is missing.');
      Object.assign(authError, {
        code: 'supabase/auth-session-missing',
        details: diagnostics,
        hint: 'Verify Supabase auth persistence and browser storage settings.',
        status: diagnostics.userError?.status || diagnostics.sessionError?.status || null
      });
      throw authError;
    }

    return mapped;
  }

  const cred = await signInWithEmailAndPassword(auth, cleanInput, pass);
  return cred.user;
}

/**
 * Creates a brand-new staff login (email + password) WITHOUT touching the currently
 * signed-in session. Uses a short-lived secondary Firebase App instance so the admin
 * creating the account is never signed out or replaced by the new user.
 * Only ever call this from an admin-gated UI (e.g. AdminPermissionsModal) — Firestore
 * rules are the real access boundary, this is just so admins don't lose their session.
 */
export async function adminCreateUserAccount(email: string, pass: string): Promise<void> {
  if (isSupabaseAuthEnabled()) {
    const error = new Error('Supabase account creation from client is not enabled yet. Use Supabase dashboard/admin API during migration.');
    (error as any).code = 'auth/operation-not-supported-in-this-environment';
    throw error;
  }

  const cleanEmail = email.trim().toLowerCase();
  const secondaryApp = initializeApp(firebaseConfig, `admin-create-user-${Date.now()}`);
  try {
    const secondaryAuth = getAuth(secondaryApp);
    await createUserWithEmailAndPassword(secondaryAuth, cleanEmail, pass);
    await signOut(secondaryAuth);
  } finally {
    await deleteApp(secondaryApp);
  }
}

/**
 * Send password reset email to user
 */
export async function resetPasswordEmail(email: string): Promise<void> {
  const cleanEmail = normalizeUserEmail(email);

  if (isSupabaseAuthEnabled() && supabase) {
    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail);
    if (error) {
      throw error;
    }
    return;
  }

  await sendPasswordResetEmail(auth, cleanEmail);
}

/**
 * Log out current user
 */
export async function logoutUser(): Promise<void> {
  if (isSupabaseAuthEnabled() && supabase) {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      // ignore
    }
    return;
  }

  try {
    await signOut(auth);
  } catch (e) {
    // ignore
  }
}

/**
 * Subscribe to auth state changes
 */
export function subscribeToAuth(callback: (user: User | null) => void) {
  if (isSupabaseAuthEnabled() && supabase) {
    authListeners.push(callback);

    let supabaseUser: User | null = null;
    let firebaseUser: User | null = auth.currentUser ?? null;

    const emitMergedUser = () => {
      callback(supabaseUser ?? firebaseUser ?? null);
    };

    getSupabaseAuthDiagnostics().then((diagnostics) => {
      supabaseUser = toFirebaseLikeUser(
        diagnostics.userId
          ? {
              id: diagnostics.userId,
              email: diagnostics.userEmail
            }
          : null
      );
      if (diagnostics.sessionError || diagnostics.userError) {
        console.error('[subscribeToAuth] Supabase auth diagnostics', diagnostics);
      }
      emitMergedUser();
    }).catch((error) => {
      console.error('[subscribeToAuth] Supabase auth diagnostics failed', summarizeSupabaseError(error));
      emitMergedUser();
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      supabaseUser = toFirebaseLikeUser(session?.user || null);
      emitMergedUser();
    });

    const firebaseUnsubscribe = onAuthStateChanged(auth, (user) => {
      firebaseUser = user ?? null;
      if (!supabaseUser) {
        emitMergedUser();
      }
    });

    return () => {
      authListeners = authListeners.filter(cb => cb !== callback);
      firebaseUnsubscribe();
      data.subscription.unsubscribe();
    };
  }

  authListeners.push(callback);

  const initialUser = auth.currentUser;
  callback(initialUser ?? null);

  const unsubscribe = onAuthStateChanged(auth, (user) => {
    callback(user ?? null);
  });

  return () => {
    authListeners = authListeners.filter(cb => cb !== callback);
    unsubscribe();
  };
}

const SESSIONS_COLLECTION = 'sessions';
const SESSION_CARDS_COLLECTION = 'sessionCards';

// ---------------------------------------------------------------------------
// Per-collection write quota tracking. A quota hit on one data type (e.g. video)
// must never block saves for another (e.g. sessions/squad), so each scope gets
// its own short-lived lockout key instead of one global switch.
// ---------------------------------------------------------------------------
function quotaKey(scope: string): string {
  return `firestore_write_quota_exceeded_until:${scope}`;
}

export function markQuotaExceeded(scope: string = SESSIONS_COLLECTION, durationMs: number = 30 * 1000): void {
  const until = Date.now() + durationMs;
  try {
    localStorage.setItem(quotaKey(scope), String(until));
  } catch (e) {
    // ignore
  }
}

export function clearQuotaExceeded(scope: string = SESSIONS_COLLECTION): void {
  try {
    localStorage.removeItem(quotaKey(scope));
  } catch (e) {
    // ignore
  }
}

export function isCloudQuotaExceeded(scope: string = SESSIONS_COLLECTION): boolean {
  try {
    const val = localStorage.getItem(quotaKey(scope));
    if (!val) return false;
    const until = parseInt(val, 10);
    if (isNaN(until)) return false;
    if (Date.now() >= until) {
      localStorage.removeItem(quotaKey(scope));
      return false;
    }
    return true;
  } catch (e) {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Visible sync status (so the UI can show "saving…", "retrying…", "saved locally,
// pending upload" instead of silently swallowing failures in console.warn).
// ---------------------------------------------------------------------------
export type SyncStatus = 'saving' | 'retrying' | 'saved' | 'offline-queued' | 'error';
export interface SyncStatusEvent {
  status: SyncStatus;
  scope: string;
  message?: string;
}
type SyncStatusListener = (event: SyncStatusEvent) => void;
let syncStatusListeners: SyncStatusListener[] = [];

export function subscribeSyncStatus(listener: SyncStatusListener): () => void {
  syncStatusListeners.push(listener);
  return () => {
    syncStatusListeners = syncStatusListeners.filter(l => l !== listener);
  };
}

function emitSyncStatus(event: SyncStatusEvent): void {
  syncStatusListeners.forEach(cb => {
    try { cb(event); } catch (e) { /* ignore listener errors */ }
  });
}

/**
 * Firestore rejects undefined values. Normalize nested payloads so writes don't
 * fail with invalid-argument when optional fields are still unset.
 */
function sanitizeForFirestore(value: any): any {
  if (value === undefined) return undefined;
  if (value === null) return null;

  if (typeof value === 'number' && !Number.isFinite(value)) {
    return null;
  }

  if (Array.isArray(value)) {
    return value.map(item => {
      const sanitized = sanitizeForFirestore(item);
      return sanitized === undefined ? null : sanitized;
    });
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value === 'object') {
    const out: Record<string, any> = {};
    Object.entries(value).forEach(([key, val]) => {
      const sanitized = sanitizeForFirestore(val);
      if (sanitized !== undefined) {
        out[key] = sanitized;
      }
    });
    return out;
  }

  return value;
}

async function runWriteWithErrorReporting<T>(scope: string, docId: string, operation: string, writeFn: () => Promise<T>): Promise<T> {
  try {
    return await writeFn();
  } catch (error: any) {
    const errorCode = error?.code ? String(error.code) : 'unknown';
    const isTransient = errorCode === 'resource-exhausted' || errorCode === 'unavailable';
    console.error(`[${operation}] Firestore write failed for ${scope}/${docId} [${errorCode}]`, error);
    if (errorCode === 'resource-exhausted') {
      markQuotaExceeded(scope);
    }
    emitSyncStatus({
      status: isTransient ? 'offline-queued' : 'error',
      scope,
      message: isTransient ? `${operation} pending retry (${errorCode})` : `${operation} failed (${errorCode})`
    });
    throw error;
  }
}

function reportSaveError(scope: string, docId: string, error: unknown, operation: string): void {
  const errorCode = typeof error === 'object' && error && 'code' in error ? String((error as { code?: unknown }).code) : 'unknown';
  const isTransient = errorCode === 'resource-exhausted' || errorCode === 'unavailable';
  console.error(`[${operation}] Firestore write failed for ${scope}/${docId} [${errorCode}]`, error);
  if (errorCode === 'resource-exhausted') {
    markQuotaExceeded(scope);
  }
  emitSyncStatus({
    status: isTransient ? 'offline-queued' : 'error',
    scope,
    message: isTransient ? `${operation} pending retry (${errorCode})` : `${operation} failed (${errorCode})`
  });
}

// ---------------------------------------------------------------------------
// Pending save queue: any write that fails after retries is queued in
// localStorage and replayed automatically once connectivity/quota recovers
// (see flushPendingWrites, called on 'online' and on app start).
// ---------------------------------------------------------------------------
interface PendingWrite {
  key: string; // `${scope}:${docId}`
  scope: string;
  docId: string;
  data: any | null; // null means "delete this document"
  queuedAt: number;
}

const PENDING_QUEUE_KEY = 'firestore_pending_write_queue';

function readPendingQueue(): PendingWrite[] {
  try {
    const raw = localStorage.getItem(PENDING_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function writePendingQueue(items: PendingWrite[]): void {
  try {
    localStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(items));
  } catch (e) {
    // ignore
  }
}

function enqueuePendingWrite(item: PendingWrite): void {
  const items = readPendingQueue().filter(i => i.key !== item.key);
  items.push(item);
  writePendingQueue(items);
}

function dequeuePendingWrite(key: string): void {
  writePendingQueue(readPendingQueue().filter(i => i.key !== key));
}

export function getPendingWriteCount(): number {
  return readPendingQueue().length;
}

/**
 * Retries every queued write once (used on reconnect / app start). Writes that fail
 * again simply stay queued — saveWithRetry re-enqueues them internally.
 */
export async function flushPendingWrites(): Promise<void> {
  const items = readPendingQueue();
  for (const item of items) {
    try {
      const ref = doc(db, item.scope, item.docId);
      if (item.data === null) {
        await deleteDoc(ref);
      } else {
        await setDoc(ref, item.data, { merge: true });
      }
      dequeuePendingWrite(item.key);
      clearQuotaExceeded(item.scope);
      emitSyncStatus({ status: 'saved', scope: item.scope });
    } catch (err: any) {
      // Still failing (offline / quota) — leave queued, it will retry on the next flush.
      if (err?.code === 'resource-exhausted') {
        markQuotaExceeded(item.scope);
      }
    }
  }
}

const MAX_WRITE_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generic "save one document" helper with exponential backoff retries. A failure in one
 * scope (collection) only ever queues/marks quota for that scope — it never blocks writes
 * to other scopes. Pass `data: null` to delete the document instead of writing it.
 */
async function saveDocWithRetry(scope: string, docId: string, data: any | null): Promise<void> {
  const ref = doc(db, scope, docId);
  let attempt = 0;

  while (true) {
    emitSyncStatus({ status: attempt === 0 ? 'saving' : 'retrying', scope });
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Cloud save operation timed out')), 6000);
    });

    try {
      await Promise.race([
        data === null ? deleteDoc(ref) : setDoc(ref, sanitizeForFirestore(data), { merge: true }),
        timeoutPromise
      ]);
      clearQuotaExceeded(scope);
      emitSyncStatus({ status: 'saved', scope });
      return;
    } catch (err: any) {
      attempt++;
      const isQuota = err?.code === 'resource-exhausted' || err?.code === 'quota-exceeded';
      const isTransient = err?.code === 'unavailable' || err?.message === 'Cloud save operation timed out';

      if (isTransient && attempt <= MAX_WRITE_RETRIES) {
        await delay(RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1));
        continue;
      }

      const errorCode = err?.code || 'unknown';
      console.error(`[saveDocWithRetry] Cloud sync failed for ${scope}/${docId} [${errorCode}]`, err);
      enqueuePendingWrite({ key: `${scope}:${docId}`, scope, docId, data, queuedAt: Date.now() });
      if (isQuota) markQuotaExceeded(scope);
      emitSyncStatus({
        status: isTransient ? 'offline-queued' : 'error',
        scope,
        message: errorCode
      });
      throw err;
    }
  }
}

export async function saveSessionCardToCloud(card: SessionCardDocument): Promise<number> {
  const saveTimestamp = Date.now();
  const payload: SessionCardDocument = {
    ...card,
    updatedAt: saveTimestamp,
    createdAt: card.createdAt || saveTimestamp
  };

  await saveDocWithRetry(SESSION_CARDS_COLLECTION, card.id, payload);
  return saveTimestamp;
}

export async function deleteSessionCardFromCloud(cardId: string): Promise<void> {
  await saveDocWithRetry(SESSION_CARDS_COLLECTION, cardId, null);
}

/**
 * Saves only specific fields for a role to avoid overwriting other roles' changes.
 * Used for granular updates when football/fitness/gk coaches work on the same session.
 */
export async function saveSessionFieldsByRole(
  sessionId: string,
  role: 'football' | 'fitness' | 'gk',
  session: TrainingSession
): Promise<number> {
  const saveTimestamp = Date.now();
  const ref = doc(db, SESSIONS_COLLECTION, sessionId);

  const sharedHeaderFields = (input: TrainingSession) => ({
    id: sessionId,
    teamName: input.teamName,
    date: input.date,
    time: input.time,
    sessionNumber: input.sessionNumber,
    microcycleDay: input.microcycleDay,
    mainObjective: input.mainObjective,
    materialsNeeded: input.materialsNeeded
  });

  const roleOwnedFields: Record<'football' | 'fitness' | 'gk', (input: TrainingSession, savedAt: number) => Record<string, any>> = {
    football: (input, savedAt) => ({
      ...sharedHeaderFields(input),
      footballUpdatedAt: savedAt,
      warmUp: input.warmUp,
      mainPart: input.mainPart,
      coolDown: input.coolDown,
      playerGroups: input.playerGroups,
      observations: input.observations || '',
      squadRoster: input.squadRoster,
      attendance: input.attendance
    }),
    fitness: (input, savedAt) => ({
      ...sharedHeaderFields(input),
      fitnessUpdatedAt: savedAt,
      fitnessWarmUp: input.fitnessWarmUp,
      fitnessMainPart: input.fitnessMainPart,
      fitnessCoolDown: input.fitnessCoolDown,
      fitnessPlayerGroups: input.fitnessPlayerGroups
    }),
    gk: (input, savedAt) => ({
      ...sharedHeaderFields(input),
      gkUpdatedAt: savedAt,
      gkWarmUp: input.gkWarmUp,
      gkMainPart: input.gkMainPart,
      gkCoolDown: input.gkCoolDown,
      gkPlayerGroups: input.gkPlayerGroups
    })
  };

  const sanitizedFieldsToUpdate = sanitizeForFirestore({
    updatedAt: saveTimestamp,
    ...roleOwnedFields[role](session, saveTimestamp)
  });

  // Use setDoc with merge to only modify specific fields (creates document if it doesn't exist)
  let attempt = 0;
  while (true) {
    emitSyncStatus({ status: attempt === 0 ? 'saving' : 'retrying', scope: SESSIONS_COLLECTION });
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Cloud save operation timed out')), 6000);
    });

    try {
      await Promise.race([
        setDoc(ref, sanitizedFieldsToUpdate, { merge: true }),
        timeoutPromise
      ]);
      clearQuotaExceeded(SESSIONS_COLLECTION);
      emitSyncStatus({ status: 'saved', scope: SESSIONS_COLLECTION });
      return saveTimestamp;
    } catch (err: any) {
      attempt++;
      const isQuota = err?.code === 'resource-exhausted' || err?.code === 'quota-exceeded';
      const isTransient = err?.code === 'unavailable' || err?.message === 'Cloud save operation timed out';

      if (isTransient && attempt <= MAX_WRITE_RETRIES) {
        await delay(RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1));
        continue;
      }

      const errorCode = err?.code || 'unknown';
      console.error(`[saveSessionFieldsByRole] Cloud sync failed for ${SESSIONS_COLLECTION}/${sessionId} [${errorCode}]`, err);
      enqueuePendingWrite({ 
        key: `${SESSIONS_COLLECTION}:${sessionId}:${role}`, 
        scope: SESSIONS_COLLECTION, 
        docId: sessionId, 
        data: sanitizedFieldsToUpdate,
        queuedAt: Date.now() 
      });
      if (isQuota) markQuotaExceeded(SESSIONS_COLLECTION);
      emitSyncStatus({
        status: isTransient ? 'offline-queued' : 'error',
        scope: SESSIONS_COLLECTION,
        message: errorCode
      });
      throw err;
    }
  }
}

/**
 * Deletes a session from Firestore
 */
export async function deleteSessionFromCloud(sessionId: string): Promise<void> {
  await saveDocWithRetry(SESSIONS_COLLECTION, sessionId, null);
}

/**
 * Real-time listener for ALL sessions (unified).
 * Reads use the read quota (50k/day), so we do NOT block reads even if writes were throttled.
 */
export function subscribeToSessionCards(
  roleOrCallback: 'football' | 'fitness' | 'gk' | ((cards: SessionCardDocument[]) => void),
  maybeCallback?: ((cards: SessionCardDocument[]) => void) | ((error: any) => void),
  onError?: (error: any) => void
) {
  const callback = typeof roleOrCallback === 'function' ? roleOrCallback : maybeCallback as ((cards: SessionCardDocument[]) => void) | undefined;
  const role = typeof roleOrCallback === 'string' ? roleOrCallback : undefined;
  const errorHandler = typeof roleOrCallback === 'function' ? maybeCallback as ((error: any) => void) | undefined : onError;

  const q = query(
    collection(db, SESSION_CARDS_COLLECTION),
    orderBy('updatedAt', 'desc')
  );

  return onSnapshot(q, (querySnapshot) => {
    const cards: SessionCardDocument[] = [];
    querySnapshot.forEach((doc) => {
      if (!doc.metadata.hasPendingWrites) {
        const card = doc.data() as SessionCardDocument;
        if (!role || card.role === role) {
          cards.push(card);
        }
      }
    });
    if (callback) {
      callback(cards);
    }
  }, (error) => {
    console.warn('Session cards subscription error:', error);
    if (errorHandler) {
      errorHandler(error);
    }
  });
}

export function subscribeToSessions(
  typeOrCallback: ('football' | 'fitness') | ((sessions: CloudTrainingSession[]) => void),
  maybeCallback?: (sessions: CloudTrainingSession[]) => void,
  onError?: (error: any) => void
) {
  const callback = typeof typeOrCallback === 'function' ? typeOrCallback : maybeCallback;
  
  if (!callback) {
    throw new Error('Callback function must be provided to subscribeToSessions');
  }

  const sortSessions = (items: CloudTrainingSession[]) => {
    return [...items].sort((a, b) => {
      const tsA = a.updatedAt || 0;
      const tsB = b.updatedAt || 0;
      if (tsA !== tsB) return tsB - tsA;
      return (b.date || '').localeCompare(a.date || '');
    });
  };

  const mapLegacyCardsToSessions = (items: Array<{ id: string; data: Partial<SessionCardDocument> }>): CloudTrainingSession[] => {
    const sessions = items.map(({ id, data }) => {
      const empty = getEmptySession();
      return {
        ...empty,
        id,
        sessionNumber: String(data.sessionNumber ?? empty.sessionNumber),
        date: data.date || empty.date,
        mainObjective: data.title || empty.mainObjective,
        observations: data.description || empty.observations,
        updatedAt: data.updatedAt || data.createdAt || 0
      } as CloudTrainingSession;
    });

    return sortSessions(sessions);
  };

  const sessionsRef = collection(db, SESSIONS_COLLECTION);
  let legacyFallbackCache: CloudTrainingSession[] = [];
  let hasTriedLegacyFallback = false;

  return onSnapshot(sessionsRef, (querySnapshot) => {
    const sessions: CloudTrainingSession[] = [];
    querySnapshot.forEach((doc) => {
      const sessionData = doc.data() as CloudTrainingSession;
      const sessionWithId: CloudTrainingSession = {
        ...sessionData,
        id: sessionData.id || doc.id
      };
      sessions.push(sessionWithId);
    });

    const sortedPrimarySessions = sortSessions(sessions);

    if (sortedPrimarySessions.length > 0) {
      callback(sortedPrimarySessions);
      return;
    }

    if (hasTriedLegacyFallback) {
      callback(legacyFallbackCache);
      return;
    }

    hasTriedLegacyFallback = true;
    Promise.all([
      getDocs(collection(defaultDb, SESSIONS_COLLECTION)).then((snap) => {
        const docs: CloudTrainingSession[] = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data() as CloudTrainingSession;
          docs.push({
            ...data,
            id: data.id || docSnap.id
          });
        });
        return sortSessions(docs);
      }),
      getDocs(collection(db, SESSION_CARDS_COLLECTION)).then((snap) => {
        const docs: Array<{ id: string; data: Partial<SessionCardDocument> }> = [];
        snap.forEach((docSnap) => {
          docs.push({ id: docSnap.id, data: docSnap.data() as Partial<SessionCardDocument> });
        });
        return mapLegacyCardsToSessions(docs);
      }),
      getDocs(collection(defaultDb, SESSION_CARDS_COLLECTION)).then((snap) => {
        const docs: Array<{ id: string; data: Partial<SessionCardDocument> }> = [];
        snap.forEach((docSnap) => {
          docs.push({ id: docSnap.id, data: docSnap.data() as Partial<SessionCardDocument> });
        });
        return mapLegacyCardsToSessions(docs);
      })
    ]).then(([defaultDbSessions, legacyPrimaryCards, legacyDefaultCards]) => {
      const fallbackSessions =
        defaultDbSessions.length > 0 ? defaultDbSessions :
        legacyPrimaryCards.length > 0 ? legacyPrimaryCards :
        legacyDefaultCards;

      legacyFallbackCache = fallbackSessions;
      callback(legacyFallbackCache);
    }).catch((legacyError) => {
      console.warn('Legacy session cards fallback failed:', legacyError);
      callback([]);
      if (onError) {
        onError(legacyError);
      }
    });
  }, (error) => {
    console.warn('Subscription error:', error);
    if (onError) {
      onError(error);
    }
  });
}

/**
 * One-shot sessions snapshot used by migration/bootstrap flows.
 */
export async function listSessionsFromCloudOnce(): Promise<CloudTrainingSession[]> {
  const readFrom = async (database: typeof db): Promise<CloudTrainingSession[]> => {
    const snap = await getDocs(collection(database, SESSIONS_COLLECTION));
    const sessions: CloudTrainingSession[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data() as CloudTrainingSession;
      sessions.push({
        ...data,
        id: data.id || docSnap.id
      });
    });

    return sessions.sort((a, b) => {
      const aTs = a.updatedAt || 0;
      const bTs = b.updatedAt || 0;
      if (bTs !== aTs) return bTs - aTs;
      return (b.date || '').localeCompare(a.date || '');
    });
  };

  let primary: CloudTrainingSession[];
  try {
    primary = await readFrom(db);
  } catch (error) {
    console.error('[F3] error reading Firebase sessions snapshot (primary db)', error);
    throw error;
  }

  if (primary.length > 0) return primary;

  if (db !== defaultDb) {
    try {
      return await readFrom(defaultDb);
    } catch (error) {
      console.error('[F3] error reading Firebase sessions snapshot (default db)', error);
      throw error;
    }
  }

  return primary;
}

// ---------------------------------------------------------------------------
// Team logo (shared badge/logo — Firestore is the source of truth,
// localStorage is only a temporary cache/offline fallback)
// ---------------------------------------------------------------------------

const TEAM_LOGO_COLLECTION = 'teamLogoConfig';

export function subscribeToTeamLogo(
  callback: (logo: string) => void,
  onError?: (error: any) => void
) {
  const docRef = doc(db, TEAM_LOGO_COLLECTION, 'current');
  return onSnapshot(docRef, (docSnap) => {
    callback((docSnap.data()?.logoUrl as string | undefined) || '');
  }, (error) => {
    console.warn('Team logo subscription error:', error);
    if (onError) {
      onError(error);
    }
  });
}

export async function saveTeamLogoToCloud(logoUrl: string): Promise<void> {
  const docRef = doc(db, TEAM_LOGO_COLLECTION, 'current');
  await runWriteWithErrorReporting(TEAM_LOGO_COLLECTION, 'current', 'Save team logo', async () => {
    await setDoc(docRef, { logoUrl, updatedAt: Date.now() }, { merge: true });
  });
}

export async function migrateLocalTeamLogoIfNeeded(localLogo: string): Promise<void> {
  const metaRef = doc(db, TEAM_LOGO_COLLECTION, 'meta');
  try {
    const metaSnap = await getDoc(metaRef);
    if (metaSnap.exists() && metaSnap.data()?.initialized) {
      return;
    }
    await runWriteWithErrorReporting(TEAM_LOGO_COLLECTION, 'meta', 'Initialize team logo meta', async () => {
      await setDoc(metaRef, { initialized: true, updatedAt: Date.now() }, { merge: true });
    });
    if (localLogo && localLogo !== OFFICIAL_ALULA_LOGO_DATA_URL) {
      await saveTeamLogoToCloud(localLogo);
    }
  } catch (e) {
    reportSaveError(TEAM_LOGO_COLLECTION, 'meta', e, 'Migrate team logo');
  }
}

// ---------------------------------------------------------------------------
// Exercise Library (shared team drill library — Firestore is the source of truth,
// localStorage is only a temporary cache/offline fallback)
// ---------------------------------------------------------------------------

const EXERCISE_LIBRARY_COLLECTION = 'exerciseLibrary';
const EXERCISE_LIBRARY_META_COLLECTION = 'exerciseLibraryMeta';

export interface CloudExercise extends Exercise {
  updatedAt: number;
}

/**
 * Real-time listener for the shared exercise library.
 */
export function subscribeToExerciseLibrary(
  callback: (exercises: CloudExercise[]) => void,
  onError?: (error: any) => void
) {
  return onSnapshot(collection(db, EXERCISE_LIBRARY_COLLECTION), (querySnapshot) => {
    const exercises: CloudExercise[] = [];
    querySnapshot.forEach((docSnap) => {
      exercises.push(docSnap.data() as CloudExercise);
    });
    callback(exercises);
  }, (error) => {
    console.warn('Exercise library subscription error:', error);
    if (onError) {
      onError(error);
    }
  });
}

/**
 * Saves or updates a single exercise in the shared cloud library.
 */
export async function saveExerciseToLibraryCloud(exercise: Exercise): Promise<number> {
  const saveTimestamp = Date.now();
  const cleanExercise = JSON.parse(JSON.stringify(exercise));
  await saveDocWithRetry(EXERCISE_LIBRARY_COLLECTION, exercise.id, { ...cleanExercise, updatedAt: saveTimestamp });
  return saveTimestamp;
}

/**
 * Deletes a single exercise from the shared cloud library.
 */
export async function deleteExerciseFromLibraryCloud(exerciseId: string): Promise<void> {
  await saveDocWithRetry(EXERCISE_LIBRARY_COLLECTION, exerciseId, null);
}

/**
 * One-time migration: uploads whatever exercises are cached in this browser's localStorage
 * to the shared cloud library, but only the very first time (guarded by a meta flag) so that
 * later, intentional deletions by the team are never resurrected by a stale local cache.
 */
export async function migrateLocalExerciseLibraryIfNeeded(localExercises: Exercise[]): Promise<void> {
  const metaRef = doc(db, EXERCISE_LIBRARY_META_COLLECTION, 'status');
  try {
    const metaSnap = await getDoc(metaRef);
    if (metaSnap.exists() && metaSnap.data()?.initialized) {
      return;
    }
    // Mark as initialized first to minimize the race window with other clients migrating concurrently
    await runWriteWithErrorReporting(EXERCISE_LIBRARY_META_COLLECTION, 'status', 'Initialize exercise library meta', async () => {
      await setDoc(metaRef, { initialized: true, updatedAt: Date.now() }, { merge: true });
    });
    if (localExercises.length > 0) {
      await Promise.all(localExercises.map(ex => saveExerciseToLibraryCloud(ex)));
    }
  } catch (e) {
    reportSaveError(EXERCISE_LIBRARY_META_COLLECTION, 'status', e, 'Migrate exercise library');
  }
}

// ---------------------------------------------------------------------------
// Video Analysis (shared tactical review sessions — Firestore is the source of truth,
// localStorage is only a temporary cache/offline fallback)
// ---------------------------------------------------------------------------

const VIDEO_ANALYSIS_COLLECTION = 'videoAnalysis';
const VIDEO_ANALYSIS_META_COLLECTION = 'videoAnalysisMeta';

export interface CloudVideoAnalysis extends VideoAnalysis {
  updatedAt: number;
}

export function subscribeToVideoAnalysis(
  callback: (sessions: CloudVideoAnalysis[]) => void,
  onError?: (error: any) => void
) {
  return onSnapshot(collection(db, VIDEO_ANALYSIS_COLLECTION), (querySnapshot) => {
    const sessions: CloudVideoAnalysis[] = [];
    querySnapshot.forEach((docSnap) => {
      sessions.push(docSnap.data() as CloudVideoAnalysis);
    });
    callback(sessions);
  }, (error) => {
    console.warn('Video analysis subscription error:', error);
    if (onError) {
      onError(error);
    }
  });
}

export async function saveVideoAnalysisToCloud(session: VideoAnalysis): Promise<number> {
  const saveTimestamp = Date.now();
  const cleanSession = JSON.parse(JSON.stringify(session));
  await saveDocWithRetry(VIDEO_ANALYSIS_COLLECTION, session.id, { ...cleanSession, updatedAt: saveTimestamp });
  return saveTimestamp;
}

export async function deleteVideoAnalysisFromCloud(sessionId: string): Promise<void> {
  await saveDocWithRetry(VIDEO_ANALYSIS_COLLECTION, sessionId, null);
}

export async function migrateLocalVideoAnalysisIfNeeded(localSessions: VideoAnalysis[]): Promise<void> {
  const metaRef = doc(db, VIDEO_ANALYSIS_META_COLLECTION, 'status');
  try {
    const metaSnap = await getDoc(metaRef);
    if (metaSnap.exists() && metaSnap.data()?.initialized) {
      return;
    }
    await runWriteWithErrorReporting(VIDEO_ANALYSIS_META_COLLECTION, 'status', 'Initialize video analysis meta', async () => {
      await setDoc(metaRef, { initialized: true, updatedAt: Date.now() }, { merge: true });
    });
    if (localSessions.length > 0) {
      await Promise.all(localSessions.map(session => saveVideoAnalysisToCloud(session)));
    }
  } catch (e) {
    reportSaveError(VIDEO_ANALYSIS_META_COLLECTION, 'status', e, 'Migrate video analysis');
  }
}

// ---------------------------------------------------------------------------
// Competition Fixtures (shared match calendar — Firestore is the source of truth,
// localStorage is only a temporary cache/offline fallback)
// ---------------------------------------------------------------------------

const COMPETITION_FIXTURES_COLLECTION = 'competitionFixtures';
const COMPETITION_FIXTURES_META_COLLECTION = 'competitionFixturesMeta';

export interface CloudCompetitionFixture extends MatchFixture {
  updatedAt: number;
}

export function subscribeToCompetitionFixtures(
  callback: (fixtures: CloudCompetitionFixture[]) => void,
  onError?: (error: any) => void
) {
  return onSnapshot(collection(db, COMPETITION_FIXTURES_COLLECTION), (querySnapshot) => {
    const fixtures: CloudCompetitionFixture[] = [];
    querySnapshot.forEach((docSnap) => {
      fixtures.push(docSnap.data() as CloudCompetitionFixture);
    });
    callback(fixtures);
  }, (error) => {
    console.warn('Competition fixtures subscription error:', error);
    if (onError) {
      onError(error);
    }
  });
}

export async function saveCompetitionFixtureToCloud(fixture: MatchFixture): Promise<number> {
  const saveTimestamp = Date.now();
  const cleanFixture = JSON.parse(JSON.stringify(fixture));
  await saveDocWithRetry(COMPETITION_FIXTURES_COLLECTION, fixture.id, { ...cleanFixture, updatedAt: saveTimestamp });
  return saveTimestamp;
}

export async function deleteCompetitionFixtureFromCloud(fixtureId: string): Promise<void> {
  await saveDocWithRetry(COMPETITION_FIXTURES_COLLECTION, fixtureId, null);
}

export async function migrateLocalCompetitionFixturesIfNeeded(localFixtures: MatchFixture[]): Promise<void> {
  const metaRef = doc(db, COMPETITION_FIXTURES_META_COLLECTION, 'status');
  try {
    const metaSnap = await getDoc(metaRef);
    if (metaSnap.exists() && metaSnap.data()?.initialized) {
      return;
    }
    await runWriteWithErrorReporting(COMPETITION_FIXTURES_META_COLLECTION, 'status', 'Initialize competition fixtures meta', async () => {
      await setDoc(metaRef, { initialized: true, updatedAt: Date.now() }, { merge: true });
    });
    if (localFixtures.length > 0) {
      await Promise.all(localFixtures.map(fixture => saveCompetitionFixtureToCloud(fixture)));
    }
  } catch (e) {
    reportSaveError(COMPETITION_FIXTURES_META_COLLECTION, 'status', e, 'Migrate competition fixtures');
  }
}

/**
 * Real-time listener for the shared list of hidden/deleted sample exercise IDs.
 */
export function subscribeToDeletedExerciseIds(
  callback: (ids: string[]) => void,
  onError?: (error: any) => void
) {
  const metaRef = doc(db, EXERCISE_LIBRARY_META_COLLECTION, 'deletedIds');
  return onSnapshot(metaRef, (docSnap) => {
    callback((docSnap.data()?.ids as string[]) || []);
  }, (error) => {
    console.warn('Deleted exercise IDs subscription error:', error);
    if (onError) {
      onError(error);
    }
  });
}

/**
 * Adds IDs to the shared deleted-exercise-IDs list without overwriting concurrent additions.
 */
export async function addDeletedExerciseIdsCloud(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const metaRef = doc(db, EXERCISE_LIBRARY_META_COLLECTION, 'deletedIds');
  await runWriteWithErrorReporting(EXERCISE_LIBRARY_META_COLLECTION, 'deletedIds', 'Update deleted exercise IDs', async () => {
    await setDoc(metaRef, { ids: arrayUnion(...ids), updatedAt: Date.now() }, { merge: true });
  });
}

// ---------------------------------------------------------------------------
// Squad Roster (shared team player list — Firestore is the source of truth,
// localStorage is only a temporary cache/offline fallback)
// ---------------------------------------------------------------------------

const SQUAD_COLLECTION = 'squadPlayers';
const SQUAD_META_COLLECTION = 'squadMeta';

export interface CloudSquadPlayer extends SquadPlayer {
  updatedAt: number;
}

/**
 * Real-time listener for the shared squad roster.
 */
export function subscribeToSquadPlayers(
  callback: (players: CloudSquadPlayer[]) => void,
  onError?: (error: any) => void
) {
  return onSnapshot(collection(db, SQUAD_COLLECTION), (querySnapshot) => {
    const players: CloudSquadPlayer[] = [];
    querySnapshot.forEach((docSnap) => {
      players.push(docSnap.data() as CloudSquadPlayer);
    });
    callback(players);
  }, (error) => {
    console.warn('Squad roster subscription error:', error);
    if (onError) {
      onError(error);
    }
  });
}

/**
 * Saves or updates a single squad player in the shared cloud roster.
 */
export async function saveSquadPlayerToCloud(player: SquadPlayer): Promise<number> {
  const saveTimestamp = Date.now();
  const cleanPlayer = JSON.parse(JSON.stringify(player));
  await saveDocWithRetry(SQUAD_COLLECTION, player.id, { ...cleanPlayer, updatedAt: saveTimestamp });
  return saveTimestamp;
}

/**
 * Deletes a single squad player from the shared cloud roster.
 */
export async function deleteSquadPlayerFromCloud(playerId: string): Promise<void> {
  await saveDocWithRetry(SQUAD_COLLECTION, playerId, null);
}

/**
 * One-time migration: uploads whatever squad roster is cached in this browser's localStorage
 * to the shared cloud roster. If the meta flag is already initialized but the collection was
 * later wiped, reseed it from the current local/base roster so the plantilla can be rebuilt.
 */
export async function migrateLocalSquadIfNeeded(localPlayers: SquadPlayer[]): Promise<void> {
  const metaRef = doc(db, SQUAD_META_COLLECTION, 'status');
  try {
    const metaSnap = await getDoc(metaRef);
    if (metaSnap.exists() && metaSnap.data()?.initialized) {
      const playersSnap = await getDocs(collection(db, SQUAD_COLLECTION));
      if (!playersSnap.empty || localPlayers.length === 0) {
        return;
      }
      await Promise.all(localPlayers.map(p => saveSquadPlayerToCloud(p)));
      return;
    }
    await runWriteWithErrorReporting(SQUAD_META_COLLECTION, 'status', 'Initialize squad meta', async () => {
      await setDoc(metaRef, { initialized: true, updatedAt: Date.now() }, { merge: true });
    });
    if (localPlayers.length > 0) {
      await Promise.all(localPlayers.map(p => saveSquadPlayerToCloud(p)));
    }
  } catch (e) {
    reportSaveError(SQUAD_META_COLLECTION, 'status', e, 'Migrate squad roster');
  }
}

// ---------------------------------------------------------------------------
// Physiotherapy Records (shared team injury/rehab log — Firestore is the source
// of truth, localStorage is only a temporary cache/offline fallback)
// ---------------------------------------------------------------------------

const PHYSIO_COLLECTION = 'physioRecords';
const PHYSIO_META_COLLECTION = 'physioMeta';

export interface CloudPhysioRecord extends PhysioRecord {
  cloudUpdatedAt: number;
}

/**
 * Real-time listener for the shared physiotherapy records.
 */
export function subscribeToPhysioRecords(
  callback: (records: CloudPhysioRecord[]) => void,
  onError?: (error: any) => void
) {
  return onSnapshot(collection(db, PHYSIO_COLLECTION), (querySnapshot) => {
    const records: CloudPhysioRecord[] = [];
    querySnapshot.forEach((docSnap) => {
      records.push(docSnap.data() as CloudPhysioRecord);
    });
    callback(records);
  }, (error) => {
    console.warn('Physio records subscription error:', error);
    if (onError) {
      onError(error);
    }
  });
}

/**
 * Saves or updates a single physio record in the shared cloud log.
 */
export async function savePhysioRecordToCloud(record: PhysioRecord): Promise<number> {
  const saveTimestamp = Date.now();
  const cleanRecord = JSON.parse(JSON.stringify(record));
  await saveDocWithRetry(PHYSIO_COLLECTION, record.id, { ...cleanRecord, cloudUpdatedAt: saveTimestamp });
  return saveTimestamp;
}

/**
 * Deletes a single physio record from the shared cloud log.
 */
export async function deletePhysioRecordFromCloud(recordId: string): Promise<void> {
  await saveDocWithRetry(PHYSIO_COLLECTION, recordId, null);
}

/**
 * One-time migration: uploads whatever physio records are cached in this browser's localStorage
 * to the shared cloud log, but only the very first time (guarded by a meta flag) so that later,
 * intentional deletions by the team are never resurrected by a stale local cache.
 */
export async function migrateLocalPhysioRecordsIfNeeded(localRecords: PhysioRecord[]): Promise<void> {
  const metaRef = doc(db, PHYSIO_META_COLLECTION, 'status');
  try {
    const metaSnap = await getDoc(metaRef);
    if (metaSnap.exists() && metaSnap.data()?.initialized) {
      return;
    }
    await runWriteWithErrorReporting(PHYSIO_META_COLLECTION, 'status', 'Initialize physio meta', async () => {
      await setDoc(metaRef, { initialized: true, updatedAt: Date.now() }, { merge: true });
    });
    if (localRecords.length > 0) {
      await Promise.all(localRecords.map(r => savePhysioRecordToCloud(r)));
    }
  } catch (e) {
    reportSaveError(PHYSIO_META_COLLECTION, 'status', e, 'Migrate physio records');
  }
}

// ---------------------------------------------------------------------------
// Attendance — excluded players list (shared team setting — Firestore is the
// source of truth, localStorage is only a temporary cache/offline fallback)
// ---------------------------------------------------------------------------

const ATTENDANCE_META_COLLECTION = 'attendanceMeta';

/**
 * Real-time listener for the shared list of excluded/removed player names.
 */
export function subscribeToExcludedPlayers(
  callback: (names: string[]) => void,
  onError?: (error: any) => void
) {
  const metaRef = doc(db, ATTENDANCE_META_COLLECTION, 'excludedPlayers');
  return onSnapshot(metaRef, (docSnap) => {
    callback((docSnap.data()?.names as string[]) || []);
  }, (error) => {
    console.warn('Excluded players subscription error:', error);
    if (onError) {
      onError(error);
    }
  });
}

/**
 * Adds names to the shared excluded-players list without overwriting concurrent additions.
 */
export async function addExcludedPlayersCloud(names: string[]): Promise<void> {
  if (names.length === 0) return;
  const metaRef = doc(db, ATTENDANCE_META_COLLECTION, 'excludedPlayers');
  await runWriteWithErrorReporting(ATTENDANCE_META_COLLECTION, 'excludedPlayers', 'Update excluded players', async () => {
    await setDoc(metaRef, { names: arrayUnion(...names), updatedAt: Date.now() }, { merge: true });
  });
}

export async function removeExcludedPlayersCloud(names: string[]): Promise<void> {
  if (names.length === 0) return;
  const metaRef = doc(db, ATTENDANCE_META_COLLECTION, 'excludedPlayers');
  await runWriteWithErrorReporting(ATTENDANCE_META_COLLECTION, 'excludedPlayers', 'Remove excluded players', async () => {
    await setDoc(metaRef, { names: arrayRemove(...names), updatedAt: Date.now() }, { merge: true });
  });
}

/**
 * One-time migration: uploads whatever excluded-players list is cached in this browser's
 * localStorage to the shared cloud list, guarded by a meta flag so it only runs once.
 */
export async function migrateLocalExcludedPlayersIfNeeded(localNames: string[]): Promise<void> {
  const metaRef = doc(db, ATTENDANCE_META_COLLECTION, 'excludedPlayersStatus');
  try {
    const metaSnap = await getDoc(metaRef);
    if (metaSnap.exists() && metaSnap.data()?.initialized) {
      return;
    }
    await runWriteWithErrorReporting(ATTENDANCE_META_COLLECTION, 'excludedPlayersStatus', 'Initialize excluded players meta', async () => {
      await setDoc(metaRef, { initialized: true, updatedAt: Date.now() }, { merge: true });
    });
    if (localNames.length > 0) {
      await addExcludedPlayersCloud(localNames);
    }
  } catch (e) {
    reportSaveError(ATTENDANCE_META_COLLECTION, 'excludedPlayersStatus', e, 'Migrate excluded players');
  }
}

// ---------------------------------------------------------------------------
// User permissions config (shared team setting — Firestore is the source of
// truth so an admin's changes on one device apply to everyone immediately)
// ---------------------------------------------------------------------------

const PERMISSIONS_COLLECTION = 'permissionsConfig';
const USER_ROLES_COLLECTION = 'userRoles';

/**
 * Real-time listener for the shared user-permissions list.
 */
export function subscribeToUserPermissions(
  callback: (list: UserPermission[]) => void,
  onError?: (error: any) => void
) {
  if (isSupabasePermissionsEnabled() && supabase) {
    const loadAndEmit = async () => {
      const list = await fetchSupabasePermissionsList();
      callback(list);
    };

    loadAndEmit().catch((error) => {
      console.warn('Supabase user roles load error:', error);
      if (onError) onError(error);
    });

    const channel = supabase
      .channel('u17-user-roles-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: SUPABASE_USER_ROLES_TABLE },
        () => {
          loadAndEmit().catch((error) => {
            console.warn('Supabase user roles subscription error:', error);
            if (onError) onError(error);
          });
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' && onError) {
          onError(new Error('Supabase realtime channel error for user roles'));
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }

  const docRef = doc(db, PERMISSIONS_COLLECTION, 'list');
  return onSnapshot(docRef, (docSnap) => {
    callback((docSnap.data()?.users as UserPermission[]) || []);
  }, (error) => {
    console.warn('User permissions subscription error:', error);
    if (onError) {
      onError(error);
    }
  });
}

/**
 * Mirrors the full permissions list into one doc per user at userRoles/{email} so
 * Firestore security rules can look up a user's role/sections in O(1) without ever
 * trusting anything computed on the client. Removes docs for users no longer listed.
 */
async function syncUserRolesCloud(list: UserPermission[]): Promise<void> {
  const snap = await getDocs(collection(db, USER_ROLES_COLLECTION));
  const existingIds = new Set(snap.docs.map(d => d.id));
  const nextIds = new Set(list.map(u => u.email.trim().toLowerCase()));

  const writes = list.map(u => {
    const emailId = u.email.trim().toLowerCase();
    return setDoc(doc(db, USER_ROLES_COLLECTION, emailId), {
      role: u.role,
      allowedSections: u.allowedSections,
      updatedAt: Date.now()
    });
  });
  const removals = [...existingIds]
    .filter(id => !nextIds.has(id))
    .map(id => deleteDoc(doc(db, USER_ROLES_COLLECTION, id)));

  await Promise.all([...writes, ...removals]);
}

/**
 * Overwrites the shared permissions list. Used only when an admin explicitly saves
 * changes from the Admin Permissions modal (a single, deliberate batch edit).
 */
export async function saveUserPermissionsListCloud(list: UserPermission[]): Promise<void> {
  if (isSupabasePermissionsEnabled() && supabase) {
    const normalized = list.map((u) => ({
      email: u.email.trim().toLowerCase(),
      role: u.role,
      allowed_sections: u.allowedSections,
      updated_at: new Date().toISOString()
    }));

    const nextIds = new Set(normalized.map((u) => u.email));

    const { data: existing, error: existingError } = await supabase
      .from(SUPABASE_USER_ROLES_TABLE)
      .select('email');

    if (existingError) {
      throw existingError;
    }

    const existingIds = new Set(((existing || []) as Array<{ email: string }>).map((row) => row.email));

    const { error: upsertError } = await supabase
      .from(SUPABASE_USER_ROLES_TABLE)
      .upsert(normalized as Record<string, unknown>[], { onConflict: 'email' });

    if (upsertError) {
      throw upsertError;
    }

    const toDelete = [...existingIds].filter((id) => !nextIds.has(id));
    if (toDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from(SUPABASE_USER_ROLES_TABLE)
        .delete()
        .in('email', toDelete);

      if (deleteError) {
        throw deleteError;
      }
    }

    return;
  }

  const docRef = doc(db, PERMISSIONS_COLLECTION, 'list');
  await runWriteWithErrorReporting(PERMISSIONS_COLLECTION, 'list', 'Save permissions list', async () => {
    await setDoc(docRef, { users: list, updatedAt: Date.now() }, { merge: true });
  });
  await runWriteWithErrorReporting(USER_ROLES_COLLECTION, 'sync', 'Sync user roles', async () => {
    await syncUserRolesCloud(list);
  });
}

/**
 * One-time migration: uploads whatever permissions list is cached in this browser's
 * localStorage to the shared cloud config, guarded so it only runs once.
 */
export async function migrateLocalPermissionsIfNeeded(localList: UserPermission[]): Promise<void> {
  if (isSupabasePermissionsEnabled() && supabase) {
    const { count, error } = await supabase
      .from(SUPABASE_USER_ROLES_TABLE)
      .select('email', { count: 'exact', head: true });

    if (error) {
      throw error;
    }

    if ((count || 0) > 0) {
      return;
    }

    await saveUserPermissionsListCloud(localList);
    return;
  }

  const docRef = doc(db, PERMISSIONS_COLLECTION, 'list');
  try {
    const docSnap = await getDoc(docRef);
    if (docSnap.exists() && docSnap.data()?.users) {
      return;
    }
    await runWriteWithErrorReporting(PERMISSIONS_COLLECTION, 'list', 'Migrate permissions list', async () => {
      await setDoc(docRef, { users: localList, updatedAt: Date.now() }, { merge: true });
    });
    await runWriteWithErrorReporting(USER_ROLES_COLLECTION, 'sync', 'Sync migrated user roles', async () => {
      await syncUserRolesCloud(localList);
    });
  } catch (e) {
    reportSaveError(PERMISSIONS_COLLECTION, 'list', e, 'Migrate permissions');
  }
}

