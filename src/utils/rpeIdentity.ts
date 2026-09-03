import type { SquadPlayer } from '../types';
import { normalizeAttendanceName, type HistoricalNameMapping } from './attendanceIdentity';
import { resolveWellnessPlayerName } from './wellnessMatching';

export type RpeIdentityKind = 'matched' | 'unresolved' | 'ambiguous' | 'external';

export interface RpeIdentity {
  /** Original name exactly as written in the Google Sheet. Never discarded. */
  sheetName: string;
  normalizedName: string;
  kind: RpeIdentityKind;
  playerId: string | null;
  /** Squad display name when matched, otherwise the original sheet name. */
  displayName: string;
  candidates?: Array<{ playerId: string; label: string }>;
}

/**
 * Strict identity resolution for RPE sheet names.
 * Order: confirmed manual/external mapping -> exact normalized full-name squad match.
 * No first-name, partial, includes or fuzzy matching is ever attempted.
 */
export function resolveRpePlayerIdentity(
  sheetName: string,
  squadPlayers: SquadPlayer[],
  mappings: HistoricalNameMapping[] = []
): RpeIdentity {
  const normalizedName = normalizeAttendanceName(sheetName);
  const mapping = mappings.find((entry) => entry.normalizedHistoricalName === normalizedName);

  if (mapping?.classification === 'external') {
    return { sheetName, normalizedName, kind: 'external', playerId: null, displayName: sheetName };
  }

  if (mapping?.classification === 'squad' && mapping.playerId) {
    const player = squadPlayers.find((entry) => entry.id === mapping.playerId);
    if (player) {
      return {
        sheetName,
        normalizedName,
        kind: 'matched',
        playerId: player.id,
        displayName: `${player.firstName} ${player.lastName}`.trim()
      };
    }
  }

  const resolution = resolveWellnessPlayerName(sheetName, squadPlayers);

  if (resolution.status === 'matched' && resolution.playerId) {
    return {
      sheetName,
      normalizedName,
      kind: 'matched',
      playerId: resolution.playerId,
      displayName: resolution.resolvedLabel || sheetName
    };
  }

  if (resolution.status === 'ambiguous') {
    return {
      sheetName,
      normalizedName,
      kind: 'ambiguous',
      playerId: null,
      displayName: sheetName,
      candidates: resolution.options || []
    };
  }

  return { sheetName, normalizedName, kind: 'unresolved', playerId: null, displayName: sheetName };
}

export function buildRpeIdentityIndex(
  sheetNames: string[],
  squadPlayers: SquadPlayer[],
  mappings: HistoricalNameMapping[] = []
): Map<string, RpeIdentity> {
  const index = new Map<string, RpeIdentity>();
  sheetNames.forEach((name) => {
    if (index.has(name)) return;
    index.set(name, resolveRpePlayerIdentity(name, squadPlayers, mappings));
  });
  return index;
}
