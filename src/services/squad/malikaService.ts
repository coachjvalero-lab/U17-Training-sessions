import type { MalikaHistoryEntry, SquadPlayer } from '../../types';

export interface MalikaAwardInput {
  playerId: string;
  points: number;
}

export interface ApplyMalikaAwardsInput {
  sessionId: string;
  exerciseId: string;
  challenge: string;
  awards: MalikaAwardInput[];
  awardedAt?: number;
}

function toFinitePoints(value: number): number {
  const points = Number(value);
  if (!Number.isFinite(points)) return 0;
  return Math.trunc(points);
}

export function buildMalikaAssignmentId(sessionId: string, exerciseId: string, playerId: string): string {
  return `${sessionId}::${exerciseId}::${playerId}`;
}

function normalizeHistoryEntry(entry: MalikaHistoryEntry, fallbackAssignmentId?: string): MalikaHistoryEntry {
  return {
    ...entry,
    assignmentId: entry.assignmentId || fallbackAssignmentId
  };
}

function recalculateMalikaPoints(history: MalikaHistoryEntry[]): number {
  return history.reduce((sum, entry) => sum + toFinitePoints(entry.points), 0);
}

function upsertMalikaHistoryEntry(
  history: MalikaHistoryEntry[],
  nextEntry: MalikaHistoryEntry
): MalikaHistoryEntry[] {
  const assignmentId = nextEntry.assignmentId;
  if (!assignmentId) {
    return [nextEntry, ...history];
  }

  const existingIndex = history.findIndex((entry) => entry.assignmentId === assignmentId);
  if (existingIndex === -1) {
    return [nextEntry, ...history];
  }

  const updated = [...history];
  updated[existingIndex] = nextEntry;
  return updated;
}

export function applyMalikaAwardsToSquad(
  players: SquadPlayer[],
  input: ApplyMalikaAwardsInput
): SquadPlayer[] {
  if (!input.sessionId || !input.exerciseId || !Array.isArray(input.awards) || input.awards.length === 0) {
    return players;
  }

  const awardedAt = input.awardedAt || Date.now();
  const byId = new Map(players.map((player) => [player.id, player]));

  input.awards.forEach(({ playerId, points }) => {
    const current = byId.get(playerId);
    if (!current) return;

    const assignmentId = buildMalikaAssignmentId(input.sessionId, input.exerciseId, playerId);
    const nextEntry: MalikaHistoryEntry = {
      assignmentId,
      sessionId: input.sessionId,
      exerciseId: input.exerciseId,
      challenge: input.challenge,
      points: toFinitePoints(points),
      date: awardedAt
    };

    const baseHistory = Array.isArray(current.malikaHistory) ? current.malikaHistory : [];
    const normalizedHistory = baseHistory.map((entry) =>
      normalizeHistoryEntry(entry, entry.assignmentId)
    );

    const nextHistory = upsertMalikaHistoryEntry(normalizedHistory, nextEntry);

    byId.set(playerId, {
      ...current,
      malikaHistory: nextHistory,
      malikaPoints: recalculateMalikaPoints(nextHistory)
    });
  });

  return players.map((player) => byId.get(player.id) || player);
}
