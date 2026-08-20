import {
  createHistoricalNameMapping,
  normalizeAttendanceName,
  type HistoricalNameClassification,
  type HistoricalNameMapping
} from './attendanceIdentity';

const STORAGE_KEY = 'u17_attendance_identity_mappings_v1';

function canUseLocalStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function readAttendanceIdentityMappings(): HistoricalNameMapping[] {
  if (!canUseLocalStorage()) return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((value): value is Partial<HistoricalNameMapping> => Boolean(value && typeof value === 'object'))
      .map((value): HistoricalNameMapping | null => {
        const historicalName = String(value.historicalName || '').trim();
        if (!historicalName) return null;

        const classification = value.classification;
        const normalizedClassification: HistoricalNameClassification =
          classification === 'squad' || classification === 'external' || classification === 'unresolved'
            ? classification
            : 'unresolved';

        const normalizedHistoricalName =
          String(value.normalizedHistoricalName || '').trim() || normalizeAttendanceName(historicalName);

        return {
          historicalName,
          normalizedHistoricalName,
          classification: normalizedClassification,
          playerId: typeof value.playerId === 'string' ? value.playerId : undefined,
          createdAt: typeof value.createdAt === 'number' ? value.createdAt : Date.now(),
          updatedAt: typeof value.updatedAt === 'number' ? value.updatedAt : Date.now()
        };
      })
      .filter((value): value is HistoricalNameMapping => value !== null);
  } catch {
    return [];
  }
}

export function writeAttendanceIdentityMappings(mappings: HistoricalNameMapping[]): void {
  if (!canUseLocalStorage()) return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(mappings));
  } catch {
    // Ignore storage quota/private mode failures.
  }
}

export function upsertAttendanceIdentityMapping(
  mappings: HistoricalNameMapping[],
  input: {
    historicalName: string;
    classification: HistoricalNameClassification;
    playerId?: string;
  }
): HistoricalNameMapping[] {
  const normalized = normalizeAttendanceName(input.historicalName);
  if (!normalized) return mappings;

  const now = Date.now();
  const existingIndex = mappings.findIndex((mapping) => mapping.normalizedHistoricalName === normalized);

  if (existingIndex === -1) {
    return [
      ...mappings,
      createHistoricalNameMapping({
        historicalName: input.historicalName,
        classification: input.classification,
        playerId: input.playerId,
        now
      })
    ];
  }

  const existing = mappings[existingIndex];
  const updated: HistoricalNameMapping = {
    ...existing,
    historicalName: input.historicalName.trim() || existing.historicalName,
    normalizedHistoricalName: normalized,
    classification: input.classification,
    playerId: input.playerId,
    updatedAt: now
  };

  const next = [...mappings];
  next[existingIndex] = updated;
  return next;
}
