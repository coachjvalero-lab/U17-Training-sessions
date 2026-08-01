import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  getDoc,
  query, 
  orderBy, 
  onSnapshot,
  arrayUnion,
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
import { TrainingSession, Exercise, SquadPlayer, PhysioRecord, VideoAnalysis, MatchFixture } from './types';
import { OFFICIAL_ALULA_LOGO_DATA_URL } from './constants/logo';
import type { UserPermission } from './utils/permissions';

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
setLogLevel('silent');

// Initialize Firebase Auth
export const auth = getAuth(app);

let authListeners: ((user: User | null) => void)[] = [];

function notifyAuthListeners(user: User | null) {
  authListeners.forEach(cb => cb(user));
}

/**
 * Sign in with username or email and password.
 * Converts plain usernames like 'admin' to 'admin@alula.com' automatically.
 */
export async function loginUser(usernameOrEmail: string, pass: string): Promise<User> {
  let cleanInput = usernameOrEmail.trim().toLowerCase();
  if (!cleanInput.includes('@')) {
    cleanInput = `${cleanInput}@alula.com`;
  }

  const cred = await signInWithEmailAndPassword(auth, cleanInput, pass);
  return cred.user;
}

/**
 * Register a new user with email and password
 */
export async function registerUser(email: string, pass: string): Promise<User> {
  const cleanEmail = email.trim().toLowerCase();
  const cred = await createUserWithEmailAndPassword(auth, cleanEmail, pass);
  return cred.user;
}

/**
 * Send password reset email to user
 */
export async function resetPasswordEmail(email: string): Promise<void> {
  let cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail.includes('@')) {
    cleanEmail = `${cleanEmail}@alula.com`;
  }

  await sendPasswordResetEmail(auth, cleanEmail);
}

/**
 * Log out current user
 */
export async function logoutUser(): Promise<void> {
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

// Extend TrainingSession type for database-specific attributes if needed
export interface CloudTrainingSession extends TrainingSession {
  updatedAt: number;
}

const SESSIONS_COLLECTION = 'sessions';
const QUOTA_KEY = 'firestore_write_quota_exceeded_until';

export function markQuotaExceeded(durationMs: number = 5 * 60 * 1000): void {
  const until = Date.now() + durationMs;
  try {
    localStorage.setItem(QUOTA_KEY, String(until));
  } catch (e) {
    // ignore
  }
}

export function clearQuotaExceeded(): void {
  try {
    localStorage.removeItem(QUOTA_KEY);
  } catch (e) {
    // ignore
  }
}

export function isCloudQuotaExceeded(): boolean {
  try {
    const val = localStorage.getItem(QUOTA_KEY);
    if (!val) return false;
    const until = parseInt(val, 10);
    if (isNaN(until)) return false;
    if (Date.now() >= until) {
      localStorage.removeItem(QUOTA_KEY);
      return false;
    }
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Saves or updates a session in Firestore. Returns the timestamp used for updatedAt.
 * If force is true, ignores temporary quota lockout and attempts the save directly.
 */
export async function saveSessionToCloud(session: TrainingSession, force: boolean = false): Promise<number> {
  const saveTimestamp = Date.now();

  if (!force && isCloudQuotaExceeded()) {
    return saveTimestamp;
  }
  
  const sessionRef = doc(db, SESSIONS_COLLECTION, session.id);
  
  // Strip teamLogo (base64 can exceed Firestore's 1MB document limit); stored only in localStorage
  const { teamLogo: _logo, ...sessionWithoutLogo } = session;
  const cleanSession = JSON.parse(JSON.stringify(sessionWithoutLogo));
  const cloudData: CloudTrainingSession = {
    ...cleanSession,
    updatedAt: saveTimestamp
  };
  
  // Timeout Promise after 6 seconds
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Cloud save operation timed out')), 6000);
  });

  try {
    await Promise.race([
      setDoc(sessionRef, cloudData, { merge: true }),
      timeoutPromise
    ]);
    clearQuotaExceeded();
    return saveTimestamp;
  } catch (err: any) {
    if (err?.code === 'resource-exhausted') {
      markQuotaExceeded(5 * 60 * 1000);
    }
    console.warn('Cloud sync failed:', err?.code || err?.message);
    throw err;
  }
}

/**
 * Deletes a session from Firestore
 */
export async function deleteSessionFromCloud(sessionId: string): Promise<void> {
  try {
    const sessionRef = doc(db, SESSIONS_COLLECTION, sessionId);
    await deleteDoc(sessionRef);
  } catch (err: any) {
    if (err?.code === 'resource-exhausted') {
      markQuotaExceeded(5 * 60 * 1000);
    }
    console.warn('Delete operation failed:', err?.code || err?.message);
    throw err;
  }
}

/**
 * Real-time listener for ALL sessions (unified).
 * Reads use the read quota (50k/day), so we do NOT block reads even if writes were throttled.
 */
export function subscribeToSessions(
  typeOrCallback: ('football' | 'fitness') | ((sessions: CloudTrainingSession[]) => void),
  maybeCallback?: (sessions: CloudTrainingSession[]) => void,
  onError?: (error: any) => void
) {
  const callback = typeof typeOrCallback === 'function' ? typeOrCallback : maybeCallback;
  
  if (!callback) {
    throw new Error('Callback function must be provided to subscribeToSessions');
  }

  const q = query(
    collection(db, SESSIONS_COLLECTION),
    orderBy('updatedAt', 'desc')
  );
  
  return onSnapshot(q, (querySnapshot) => {
    const sessions: CloudTrainingSession[] = [];
    querySnapshot.forEach((doc) => {
      sessions.push(doc.data() as CloudTrainingSession);
    });
    callback(sessions);
  }, (error) => {
    console.warn('Subscription error:', error);
    if (onError) {
      onError(error);
    }
  });
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
  await setDoc(docRef, { logoUrl, updatedAt: Date.now() }, { merge: true });
}

export async function migrateLocalTeamLogoIfNeeded(localLogo: string): Promise<void> {
  const metaRef = doc(db, TEAM_LOGO_COLLECTION, 'meta');
  try {
    const metaSnap = await getDoc(metaRef);
    if (metaSnap.exists() && metaSnap.data()?.initialized) {
      return;
    }
    await setDoc(metaRef, { initialized: true, updatedAt: Date.now() }, { merge: true });
    if (localLogo && localLogo !== OFFICIAL_ALULA_LOGO_DATA_URL) {
      await saveTeamLogoToCloud(localLogo);
    }
  } catch (e) {
    console.warn('Team logo migration skipped:', e);
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
  const exerciseRef = doc(db, EXERCISE_LIBRARY_COLLECTION, exercise.id);
  const cleanExercise = JSON.parse(JSON.stringify(exercise));
  await setDoc(exerciseRef, { ...cleanExercise, updatedAt: saveTimestamp }, { merge: true });
  return saveTimestamp;
}

/**
 * Deletes a single exercise from the shared cloud library.
 */
export async function deleteExerciseFromLibraryCloud(exerciseId: string): Promise<void> {
  const exerciseRef = doc(db, EXERCISE_LIBRARY_COLLECTION, exerciseId);
  await deleteDoc(exerciseRef);
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
    await setDoc(metaRef, { initialized: true, updatedAt: Date.now() }, { merge: true });
    if (localExercises.length > 0) {
      await Promise.all(localExercises.map(ex => saveExerciseToLibraryCloud(ex)));
    }
  } catch (e) {
    console.warn('Exercise library migration skipped:', e);
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
  const sessionRef = doc(db, VIDEO_ANALYSIS_COLLECTION, session.id);
  const cleanSession = JSON.parse(JSON.stringify(session));
  await setDoc(sessionRef, { ...cleanSession, updatedAt: saveTimestamp }, { merge: true });
  return saveTimestamp;
}

export async function deleteVideoAnalysisFromCloud(sessionId: string): Promise<void> {
  const sessionRef = doc(db, VIDEO_ANALYSIS_COLLECTION, sessionId);
  await deleteDoc(sessionRef);
}

export async function migrateLocalVideoAnalysisIfNeeded(localSessions: VideoAnalysis[]): Promise<void> {
  const metaRef = doc(db, VIDEO_ANALYSIS_META_COLLECTION, 'status');
  try {
    const metaSnap = await getDoc(metaRef);
    if (metaSnap.exists() && metaSnap.data()?.initialized) {
      return;
    }
    await setDoc(metaRef, { initialized: true, updatedAt: Date.now() }, { merge: true });
    if (localSessions.length > 0) {
      await Promise.all(localSessions.map(session => saveVideoAnalysisToCloud(session)));
    }
  } catch (e) {
    console.warn('Video analysis migration skipped:', e);
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
  const fixtureRef = doc(db, COMPETITION_FIXTURES_COLLECTION, fixture.id);
  const cleanFixture = JSON.parse(JSON.stringify(fixture));
  await setDoc(fixtureRef, { ...cleanFixture, updatedAt: saveTimestamp }, { merge: true });
  return saveTimestamp;
}

export async function deleteCompetitionFixtureFromCloud(fixtureId: string): Promise<void> {
  const fixtureRef = doc(db, COMPETITION_FIXTURES_COLLECTION, fixtureId);
  await deleteDoc(fixtureRef);
}

export async function migrateLocalCompetitionFixturesIfNeeded(localFixtures: MatchFixture[]): Promise<void> {
  const metaRef = doc(db, COMPETITION_FIXTURES_META_COLLECTION, 'status');
  try {
    const metaSnap = await getDoc(metaRef);
    if (metaSnap.exists() && metaSnap.data()?.initialized) {
      return;
    }
    await setDoc(metaRef, { initialized: true, updatedAt: Date.now() }, { merge: true });
    if (localFixtures.length > 0) {
      await Promise.all(localFixtures.map(fixture => saveCompetitionFixtureToCloud(fixture)));
    }
  } catch (e) {
    console.warn('Competition fixtures migration skipped:', e);
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
  await setDoc(metaRef, { ids: arrayUnion(...ids), updatedAt: Date.now() }, { merge: true });
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
  const playerRef = doc(db, SQUAD_COLLECTION, player.id);
  const cleanPlayer = JSON.parse(JSON.stringify(player));
  await setDoc(playerRef, { ...cleanPlayer, updatedAt: saveTimestamp }, { merge: true });
  return saveTimestamp;
}

/**
 * Deletes a single squad player from the shared cloud roster.
 */
export async function deleteSquadPlayerFromCloud(playerId: string): Promise<void> {
  const playerRef = doc(db, SQUAD_COLLECTION, playerId);
  await deleteDoc(playerRef);
}

/**
 * One-time migration: uploads whatever squad roster is cached in this browser's localStorage
 * to the shared cloud roster, but only the very first time (guarded by a meta flag) so that
 * later, intentional deletions by the team are never resurrected by a stale local cache.
 */
export async function migrateLocalSquadIfNeeded(localPlayers: SquadPlayer[]): Promise<void> {
  const metaRef = doc(db, SQUAD_META_COLLECTION, 'status');
  try {
    const metaSnap = await getDoc(metaRef);
    if (metaSnap.exists() && metaSnap.data()?.initialized) {
      return;
    }
    await setDoc(metaRef, { initialized: true, updatedAt: Date.now() }, { merge: true });
    if (localPlayers.length > 0) {
      await Promise.all(localPlayers.map(p => saveSquadPlayerToCloud(p)));
    }
  } catch (e) {
    console.warn('Squad roster migration skipped:', e);
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
  const recordRef = doc(db, PHYSIO_COLLECTION, record.id);
  const cleanRecord = JSON.parse(JSON.stringify(record));
  await setDoc(recordRef, { ...cleanRecord, cloudUpdatedAt: saveTimestamp }, { merge: true });
  return saveTimestamp;
}

/**
 * Deletes a single physio record from the shared cloud log.
 */
export async function deletePhysioRecordFromCloud(recordId: string): Promise<void> {
  const recordRef = doc(db, PHYSIO_COLLECTION, recordId);
  await deleteDoc(recordRef);
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
    await setDoc(metaRef, { initialized: true, updatedAt: Date.now() }, { merge: true });
    if (localRecords.length > 0) {
      await Promise.all(localRecords.map(r => savePhysioRecordToCloud(r)));
    }
  } catch (e) {
    console.warn('Physio records migration skipped:', e);
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
  await setDoc(metaRef, { names: arrayUnion(...names), updatedAt: Date.now() }, { merge: true });
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
    await setDoc(metaRef, { initialized: true, updatedAt: Date.now() }, { merge: true });
    if (localNames.length > 0) {
      await addExcludedPlayersCloud(localNames);
    }
  } catch (e) {
    console.warn('Excluded players migration skipped:', e);
  }
}

// ---------------------------------------------------------------------------
// User permissions config (shared team setting — Firestore is the source of
// truth so an admin's changes on one device apply to everyone immediately)
// ---------------------------------------------------------------------------

const PERMISSIONS_COLLECTION = 'permissionsConfig';

/**
 * Real-time listener for the shared user-permissions list.
 */
export function subscribeToUserPermissions(
  callback: (list: UserPermission[]) => void,
  onError?: (error: any) => void
) {
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
 * Overwrites the shared permissions list. Used only when an admin explicitly saves
 * changes from the Admin Permissions modal (a single, deliberate batch edit).
 */
export async function saveUserPermissionsListCloud(list: UserPermission[]): Promise<void> {
  const docRef = doc(db, PERMISSIONS_COLLECTION, 'list');
  await setDoc(docRef, { users: list, updatedAt: Date.now() }, { merge: true });
}

/**
 * One-time migration: uploads whatever permissions list is cached in this browser's
 * localStorage to the shared cloud config, guarded so it only runs once.
 */
export async function migrateLocalPermissionsIfNeeded(localList: UserPermission[]): Promise<void> {
  const docRef = doc(db, PERMISSIONS_COLLECTION, 'list');
  try {
    const docSnap = await getDoc(docRef);
    if (docSnap.exists() && docSnap.data()?.users) {
      return;
    }
    await setDoc(docRef, { users: localList, updatedAt: Date.now() }, { merge: true });
  } catch (e) {
    console.warn('User permissions migration skipped:', e);
  }
}
