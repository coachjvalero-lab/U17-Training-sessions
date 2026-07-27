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
 * Saves or updates a session in Firestore
 */
export async function saveSessionToCloud(session: TrainingSession, _type?: 'football' | 'fitness'): Promise<void> {
  const sessionRef = doc(db, SESSIONS_COLLECTION, session.id);
  const cloudData: CloudTrainingSession = {
    ...session,
    updatedAt: Date.now()
  };
  
  // Timeout Promise after 5 seconds to prevent infinite spinning if connection lags
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Cloud save operation timed out')), 5000);
  });

  try {
    await Promise.race([
      setDoc(sessionRef, cloudData, { merge: true }),
      timeoutPromise
    ]);
  } catch (err) {
    console.error('saveSessionToCloud error:', err);
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
  maybeCallback?: (sessions: CloudTrainingSession[]) => void
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
    console.error(`Error in session subscription:`, error);
  });
}
