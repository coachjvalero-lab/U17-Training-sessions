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
  type: 'football' | 'fitness';
  updatedAt: number;
}

const SESSIONS_COLLECTION = 'sessions';

/**
 * Saves or updates a session in Firestore
 */
export async function saveSessionToCloud(session: TrainingSession, type: 'football' | 'fitness'): Promise<void> {
  const sessionRef = doc(db, SESSIONS_COLLECTION, session.id);
  const cloudData: CloudTrainingSession = {
    ...session,
    type,
    updatedAt: Date.now()
  };
  await setDoc(sessionRef, cloudData, { merge: true });
}

/**
 * Deletes a session from Firestore
 */
export async function deleteSessionFromCloud(sessionId: string): Promise<void> {
  const sessionRef = doc(db, SESSIONS_COLLECTION, sessionId);
  await deleteDoc(sessionRef);
}

/**
 * Fetches all sessions of a specific type from Firestore
 */
export async function getSessionsFromCloud(type: 'football' | 'fitness'): Promise<CloudTrainingSession[]> {
  const q = query(
    collection(db, SESSIONS_COLLECTION), 
    where('type', '==', type),
    orderBy('updatedAt', 'desc')
  );
  
  const querySnapshot = await getDocs(q);
  const sessions: CloudTrainingSession[] = [];
  querySnapshot.forEach((doc) => {
    sessions.push(doc.data() as CloudTrainingSession);
  });
  return sessions;
}

/**
 * Real-time listener for sessions of a specific type
 */
export function subscribeToSessions(type: 'football' | 'fitness', callback: (sessions: CloudTrainingSession[]) => void) {
  const q = query(
    collection(db, SESSIONS_COLLECTION),
    where('type', '==', type),
    orderBy('updatedAt', 'desc')
  );
  
  return onSnapshot(q, (querySnapshot) => {
    const sessions: CloudTrainingSession[] = [];
    querySnapshot.forEach((doc) => {
      sessions.push(doc.data() as CloudTrainingSession);
    });
    callback(sessions);
  }, (error) => {
    console.error(`Error in session subscription for ${type}:`, error);
  });
}
