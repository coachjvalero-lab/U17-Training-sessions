import {
  CloudTrainingSession,
  deleteSessionFromCloud,
  saveSessionToCloud,
  subscribeToSessions
} from '../firebase';
import { PortalSection, TrainingSession } from '../types';
import { saveSessionBySection } from './trainingModules';

export function subscribeTrainingSessions(
  callback: (sessions: CloudTrainingSession[]) => void,
  onError?: (error: any) => void
) {
  return subscribeToSessions(callback, undefined, onError);
}

export async function createTrainingSession(session: TrainingSession): Promise<number> {
  return saveSessionToCloud(session);
}

export async function deleteTrainingSession(sessionId: string): Promise<void> {
  return deleteSessionFromCloud(sessionId);
}

export async function saveTrainingSessionBySection(
  section: PortalSection,
  session: TrainingSession
): Promise<{ moduleId: 'football' | 'fitness' | 'gk'; savedAt: number }> {
  return saveSessionBySection(section, session);
}
