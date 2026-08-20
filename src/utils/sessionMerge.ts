import type { CloudTrainingSession, TrainingSession } from '../types';

export function mergeSessionsForDisplay(
  cloudSessions: CloudTrainingSession[],
  activeSession: TrainingSession
): CloudTrainingSession[] {
  const byIdentity = new Map<string, CloudTrainingSession>();

  cloudSessions.forEach((session) => {
    const key = session.id || `session-number:${session.sessionNumber || 'draft'}`;
    byIdentity.set(key, session);
  });

  const existingBySessionNumber = activeSession.sessionNumber
    ? cloudSessions.find((s) => s.sessionNumber?.trim() === activeSession.sessionNumber?.trim())
    : undefined;

  const activeKey = activeSession.id || (existingBySessionNumber ? existingBySessionNumber.id : `session-number:${activeSession.sessionNumber || 'draft'}`);

  if (!byIdentity.has(activeKey)) {
    const activeCloud: CloudTrainingSession = {
      ...activeSession,
      id: activeSession.id || activeKey,
      sessionNumber: activeSession.sessionNumber || 'draft',
      updatedAt: (activeSession as Partial<CloudTrainingSession>).updatedAt || Date.now()
    } as CloudTrainingSession;
    byIdentity.set(activeKey, activeCloud);
  }

  const merged = Array.from(byIdentity.values());

  if (activeSession.sessionNumber && existingBySessionNumber && existingBySessionNumber.id !== activeSession.id) {
    const draftEquivalent: CloudTrainingSession = {
      ...existingBySessionNumber,
      id: activeSession.id || existingBySessionNumber.id,
      mainObjective: activeSession.mainObjective || existingBySessionNumber.mainObjective,
      updatedAt: existingBySessionNumber.updatedAt || Date.now()
    };
    const replacementIndex = merged.findIndex((item) => item.id === existingBySessionNumber.id);
    if (replacementIndex !== -1) {
      merged[replacementIndex] = draftEquivalent;
    }
    return merged.filter((item, index) => merged.findIndex((candidate) => candidate.id === item.id) === index);
  }

  return merged;
}
