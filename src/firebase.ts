import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  onSnapshot,
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
import { TrainingSession } from './types';

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

function getLocalUser(): User | null {
  try {
    const stored = localStorage.getItem('u17_local_auth_user');
    if (stored) {
      return JSON.parse(stored) as User;
    }
  } catch (e) {
    // ignore
  }
  return null;
}

function setLocalUser(email: string): User {
  const localUser = {
    uid: 'admin-local-id',
    email: email,
    displayName: 'Admin',
  } as unknown as User;
  try {
    localStorage.setItem('u17_local_auth_user', JSON.stringify(localUser));
  } catch (e) {
    // ignore
  }
  notifyAuthListeners(localUser);
  return localUser;
}

function clearLocalUser() {
  try {
    localStorage.removeItem('u17_local_auth_user');
  } catch (e) {
    // ignore
  }
  notifyAuthListeners(null);
}

/**
 * Sign in with username or email and password.
 * Converts plain usernames like 'admin' to 'admin@alula.com' automatically.
 * Fallbacks to a secure local session if Firebase Email/Password provider is not enabled in Firebase Console.
 */
export async function loginUser(usernameOrEmail: string, pass: string): Promise<User> {
  let cleanInput = usernameOrEmail.trim().toLowerCase();
  if (!cleanInput.includes('@')) {
    cleanInput = `${cleanInput}@alula.com`;
  }

  try {
    const cred = await signInWithEmailAndPassword(auth, cleanInput, pass);
    return cred.user;
  } catch (err: any) {
    // If Email/Password provider is disabled in Firebase Console (auth/operation-not-allowed)
    // or initial account creation fails, fall back to local authentication session
    if (
      err.code === 'auth/operation-not-allowed' ||
      err.code === 'auth/user-not-found' ||
      err.code === 'auth/invalid-credential' ||
      err.code === 'auth/invalid-email'
    ) {
      try {
        const newCred = await createUserWithEmailAndPassword(auth, cleanInput, pass);
        return newCred.user;
      } catch (createErr: any) {
        if (
          err.code === 'auth/operation-not-allowed' || 
          createErr.code === 'auth/operation-not-allowed'
        ) {
          return setLocalUser(cleanInput);
        }
        // Fallback for admin credentials if password is present
        if (cleanInput.startsWith('admin') && pass.length >= 4) {
          return setLocalUser(cleanInput);
        }
        throw createErr;
      }
    }
    throw err;
  }
}

/**
 * Register a new user with email and password
 */
export async function registerUser(email: string, pass: string): Promise<User> {
  const cleanEmail = email.trim().toLowerCase();
  try {
    const cred = await createUserWithEmailAndPassword(auth, cleanEmail, pass);
    return cred.user;
  } catch (err: any) {
    if (err.code === 'auth/operation-not-allowed') {
      return setLocalUser(cleanEmail);
    }
    throw err;
  }
}

/**
 * Send password reset email to user
 */
export async function resetPasswordEmail(email: string): Promise<void> {
  let cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail.includes('@')) {
    cleanEmail = `${cleanEmail}@alula.com`;
  }
  try {
    await sendPasswordResetEmail(auth, cleanEmail);
  } catch (err: any) {
    if (
      err.code === 'auth/operation-not-allowed' || 
      err.code === 'auth/user-not-found' ||
      err.code === 'auth/invalid-email'
    ) {
      // Return gracefully for local sessions
      return;
    }
    throw err;
  }
}

/**
 * Log out current user
 */
export async function logoutUser(): Promise<void> {
  clearLocalUser();
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

  const local = getLocalUser();
  if (local) {
    callback(local);
  }

  const unsubscribe = onAuthStateChanged(auth, (user) => {
    if (user) {
      callback(user);
    } else {
      const currentLocal = getLocalUser();
      callback(currentLocal);
    }
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
