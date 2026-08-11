import type { CloudTrainingSession, TrainingSession } from '../types';

export function mergeSessionsForDisplay(
  cloudSessions: CloudTrainingSession[],
  activeSession: TrainingSession
): CloudTrainingSession[] {
  const map = new Map<string, CloudTrainingSession>();

  cloudSessions.forEach((cloudSession) => {
    const key = cloudSession.id || `sess-${cloudSession.sessionNumber || 'draft'}`;
    map.set(key, cloudSession);
  });

  const activeKey = activeSession.id || `sess-${activeSession.sessionNumber || 'draft'}`;
  if (!map.has(activeKey)) {
    const activeCloud = {
      ...activeSession,
      id: activeSession.id || activeKey,
      updatedAt: activeSession.updatedAt || 0,
      footballUpdatedAt: activeSession.updatedAt || 0,
      fitnessUpdatedAt: activeSession.updatedAt || 0,
      gkUpdatedAt: activeSession.updatedAt || 0
    } as CloudTrainingSession;
    map.set(activeKey, activeCloud);
  }

  const merged = Array.from(map.values());

  const bySessionNumber = new Map<string, CloudTrainingSession>();
  merged.forEach((session) => {
    const sessionNumber = session.sessionNumber?.trim();
    if (sessionNumber) {
      bySessionNumber.set(sessionNumber, session);
    }
  });

  return Array.from(bySessionNumber.values()).length > 0
    ? Array.from(bySessionNumber.values())
    : merged;
}
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

  const activeKey = activeSession.id || `session-number:${activeSession.sessionNumber || 'draft'}`;
  if (!byIdentity.has(activeKey)) {
    const activeCloud: CloudTrainingSession = {
      ...activeSession,
      id: activeSession.id || `session-number:${activeSession.sessionNumber || 'draft'}`,
      sessionNumber: activeSession.sessionNumber || 'draft'
    } as CloudTrainingSession;
    byIdentity.set(activeKey, activeCloud);
  }

  const merged = Array.from(byIdentity.values());

  if (activeSession.sessionNumber && merged.some((item) => item.sessionNumber === activeSession.sessionNumber && item.id !== activeSession.id)) {
    const existingMatch = merged.find((item) => item.sessionNumber === activeSession.sessionNumber && item.id !== activeSession.id);
    if (existingMatch && !merged.some((item) => item.id === activeSession.id)) {
      const draftEquivalent = {
        ...existingMatch,
        id: activeSession.id || `session-number:${activeSession.sessionNumber}`,
        mainObjective: activeSession.mainObjective || existingMatch.mainObjective
      } as CloudTrainingSession;
      const replacementIndex = merged.findIndex((item) => item.id === existingMatch.id);
      merged[replacementIndex] = draftEquivalent;
      return merged.filter((item, index) => merged.findIndex((candidate) => candidate.id === item.id) === index);
    }
  }

  return merged;
}
