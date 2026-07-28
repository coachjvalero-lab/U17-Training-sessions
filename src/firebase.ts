import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  deleteDoc, 
  query, 
  where, 
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

const QUOTA_KEY = 'firestore_quota_exceeded_until';

export function markQuotaExceeded(durationMs: number = 24 * 60 * 60 * 1000): void {
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
 */
export async function saveSessionToCloud(session: TrainingSession, _type?: 'football' | 'fitness'): Promise<number> {
  const saveTimestamp = Date.now();

  if (isCloudQuotaExceeded()) {
    return saveTimestamp;
  }
  
  const sessionRef = doc(db, SESSIONS_COLLECTION, session.id);
  
  // Clean object via JSON cycle to strip any undefined properties that Firestore setDoc rejects
  const cleanSession = JSON.parse(JSON.stringify(session));
  const cloudData: CloudTrainingSession = {
    ...cleanSession,
    updatedAt: saveTimestamp
  };
  
  // Timeout Promise after 5 seconds to prevent hanging when quota is exhausted or network is slow
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Cloud save operation timed out (quota limit or slow network)')), 5000);
  });

  try {
    await Promise.race([
      setDoc(sessionRef, cloudData, { merge: true }),
      timeoutPromise
    ]);
    return saveTimestamp;
  } catch (err: any) {
    markQuotaExceeded();
    console.warn('Cloud sync temporarily paused (daily quota limit reached). All changes are saved locally in your browser.');
    return saveTimestamp;
  }
}

/**
 * Deletes a session from Firestore
 */
export async function deleteSessionFromCloud(sessionId: string): Promise<void> {
  if (isCloudQuotaExceeded()) {
    return;
  }
  try {
    const sessionRef = doc(db, SESSIONS_COLLECTION, sessionId);
    await deleteDoc(sessionRef);
  } catch (err: any) {
    markQuotaExceeded();
    console.warn('Delete operation paused (daily quota limit reached).');
  }
}

/**
 * Real-time listener for ALL sessions (unified)
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

  if (isCloudQuotaExceeded()) {
    if (onError) {
      onError(new Error('Quota limit exceeded'));
    }
    return () => {};
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
    markQuotaExceeded();
    console.warn('Subscription error (daily quota limit reached or offline).');
    if (onError) {
      onError(error);
    }
  });
}
