import type { PlayerWeeklyWeight, SquadPlayer } from '../types';
import { addDaysToDateKey, getIsoWeekStart } from './rpeAnalytics';

export { addDaysToDateKey, getIsoWeekStart };

/**
 * Returns the Sunday (end of ISO week) for a given Monday week start.
 */
export function getIsoWeekEnd(weekStartDate: string): string {
  return addDaysToDateKey(weekStartDate, 6);
}

/**
 * Formats a YYYY-MM-DD date key into a clean string, e.g. "08 Sep 2026".
 */
export function formatWeightDate(dateKey: string): string {
  if (!dateKey) return '—';
  const parsed = new Date(`${dateKey}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return dateKey;
  return parsed.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Groups weekly weight records by playerId, sorted chronologically ascending.
 */
export function groupWeightsByPlayer(weights: PlayerWeeklyWeight[]): Map<string, PlayerWeeklyWeight[]> {
  const map = new Map<string, PlayerWeeklyWeight[]>();
  for (const entry of weights) {
    const list = map.get(entry.playerId) ?? [];
    list.push(entry);
    map.set(entry.playerId, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.weekStartDate.localeCompare(b.weekStartDate));
  }
  return map;
}

/**
 * Returns the most recent weekly weight record for a given player.
 */
export function getLatestWeightForPlayer(
  weights: PlayerWeeklyWeight[],
  playerId: string
): PlayerWeeklyWeight | undefined {
  const playerWeights = weights
    .filter((w) => w.playerId === playerId)
    .sort((a, b) => b.weekStartDate.localeCompare(a.weekStartDate));
  return playerWeights[0];
}

/**
 * Returns the weight recorded in the immediate week prior to the specified week.
 */
export function getPreviousWeight(
  weights: PlayerWeeklyWeight[],
  playerId: string,
  currentWeekStart: string
): PlayerWeeklyWeight | undefined {
  const playerWeights = weights
    .filter((w) => w.playerId === playerId && w.weekStartDate < currentWeekStart)
    .sort((a, b) => b.weekStartDate.localeCompare(a.weekStartDate));
  return playerWeights[0];
}

export interface WeightHistoryPoint {
  id: string;
  weekStartDate: string;
  weightKg: number;
  deltaKg: number | null;
  formattedDate: string;
}

/**
 * Computes the chronological evolution with delta vs preceding measurement.
 * Returns records in reverse chronological order (newest first) for table display.
 */
export function calculateWeightHistoryWithDeltas(
  playerWeights: PlayerWeeklyWeight[]
): WeightHistoryPoint[] {
  const sortedAsc = [...playerWeights].sort((a, b) => a.weekStartDate.localeCompare(b.weekStartDate));
  const points: WeightHistoryPoint[] = [];

  for (let i = 0; i < sortedAsc.length; i++) {
    const current = sortedAsc[i];
    const prev = i > 0 ? sortedAsc[i - 1] : null;
    const deltaKg = prev !== null ? Math.round((current.weightKg - prev.weightKg) * 10) / 10 : null;

    points.push({
      id: current.id,
      weekStartDate: current.weekStartDate,
      weightKg: current.weightKg,
      deltaKg,
      formattedDate: formatWeightDate(current.weekStartDate)
    });
  }

  return points.reverse();
}

/**
 * Validates a weight input in kg. Must be a positive finite number between 25kg and 250kg.
 */
export function validateWeightInput(raw: string | number): {
  valid: boolean;
  weightKg?: number;
  error?: string;
} {
  const trimmed = typeof raw === 'string' ? raw.trim() : String(raw);
  if (!trimmed) {
    return { valid: false, error: 'Weight value is required.' };
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return { valid: false, error: 'Enter a valid positive number.' };
  }
  if (parsed < 25 || parsed > 250) {
    return { valid: false, error: 'Weight must be between 25 and 250 kg.' };
  }
  const rounded = Math.round(parsed * 10) / 10;
  return { valid: true, weightKg: rounded };
}

/**
 * Deterministic player sorting: by squad number first, then alphabetically.
 */
export function compareSquadPlayers(a: SquadPlayer, b: SquadPlayer): number {
  const numA = Number(a.number);
  const numB = Number(b.number);
  if (Number.isFinite(numA) && Number.isFinite(numB) && numA !== numB) {
    return numA - numB;
  }
  if (Number.isFinite(numA) && !Number.isFinite(numB)) return -1;
  if (!Number.isFinite(numA) && Number.isFinite(numB)) return 1;
  return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
}
