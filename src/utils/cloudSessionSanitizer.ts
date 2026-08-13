import type { CloudTrainingSession } from '../types';

export function sanitizeCloudSessions(sessions: CloudTrainingSession[]): CloudTrainingSession[] {
  return sessions.filter((session) => {
    if (!session || !session.id) return false;

    if (session.id.startsWith('empty-session-') || session.id.startsWith('memory-session-')) {
      return false;
    }

    const sessionNumber = (session.sessionNumber || '').trim();
    const hasMeaningfulData = Boolean(
      sessionNumber ||
      session.mainObjective?.trim() ||
      session.warmUp?.exercises?.length ||
      session.mainPart?.exercises?.length ||
      session.coolDown?.exercises?.length ||
      session.date
    );

    return hasMeaningfulData;
  });
}
