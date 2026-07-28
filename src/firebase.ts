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
import { TrainingSession } from './types';

const firebaseConfig = {
  apiKey: "AIzaSyBUbDCZivcYcg68Hja54tHl0oVC1sPVAgU",
  authDomain: "gen-lang-client-0299867129.firebaseapp.com",
  projectId: "gen-lang-client-0299867129",
  storageBucket: "gen-lang-client-0299867129.firebasestorage.app",
  messagingSenderId: "42565623033",
  appId: "1:42565623033:web:d7e9c92f05052029361628"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore with custom database ID
export const db = getFirestore(app, "ai-studio-u17trainingsessi-8c691063-da9d-42be-8595-dd4dada7f0b7");
setLogLevel('silent');

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
  
  // Clean object via JSON cycle to strip any undefined properties that Firestore setDoc rejects
  const cleanSession = JSON.parse(JSON.stringify(session));
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
    // If write quota limit reached, set backoff for 5 minutes (instead of 24 hours)
    markQuotaExceeded(5 * 60 * 1000);
    console.warn('Cloud sync temporarily throttled (daily write quota limit reached or network error). Changes are saved locally.');
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
    markQuotaExceeded(5 * 60 * 1000);
    console.warn('Delete operation paused (daily quota limit reached).');
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
