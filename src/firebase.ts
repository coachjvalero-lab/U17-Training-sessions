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
  onSnapshot 
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

// Extend TrainingSession type for database-specific attributes if needed
export interface CloudTrainingSession extends TrainingSession {
  updatedAt: number;
}

const SESSIONS_COLLECTION = 'sessions';

/**
 * Saves or updates a session in Firestore. Returns the timestamp used for updatedAt.
 */
export async function saveSessionToCloud(session: TrainingSession, _type?: 'football' | 'fitness'): Promise<number> {
  const sessionRef = doc(db, SESSIONS_COLLECTION, session.id);
  const saveTimestamp = Date.now();
  
  // Clean object via JSON cycle to strip any undefined properties that Firestore setDoc rejects
  const cleanSession = JSON.parse(JSON.stringify(session));
  const cloudData: CloudTrainingSession = {
    ...cleanSession,
    updatedAt: saveTimestamp
  };
  
  // Timeout Promise after 25 seconds to prevent infinite hanging while giving Firestore enough time to connect & sync
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Cloud save operation timed out (network slow)')), 25000);
  });

  try {
    await Promise.race([
      setDoc(sessionRef, cloudData, { merge: true }),
      timeoutPromise
    ]);
    return saveTimestamp;
  } catch (err: any) {
    const isQuotaError = err?.code === 'resource-exhausted' || err?.message?.includes('Quota limit exceeded') || err?.message?.includes('resource-exhausted');
    if (isQuotaError) {
      console.warn('Firestore daily write quota reached. Changes saved locally in browser.');
    } else {
      console.warn('saveSessionToCloud warning:', err?.message || err);
    }
    throw err;
  }
}

/**
 * Deletes a session from Firestore
 */
export async function deleteSessionFromCloud(sessionId: string): Promise<void> {
  const sessionRef = doc(db, SESSIONS_COLLECTION, sessionId);
  await deleteDoc(sessionRef);
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
    console.warn(`Error in session subscription:`, error);
    if (onError) {
      onError(error);
    }
  });
}
