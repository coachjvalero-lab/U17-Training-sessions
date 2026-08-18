import type { SquadPlayer } from '../types';

export type AttendanceAliasMap = Record<string, string>;

export type AttendanceNameResolution =
  | {
      kind: 'matched';
      playerId: string;
      displayName: string;
      normalizedName: string;
    }
  | {
      kind: 'ambiguous';
      normalizedName: string;
      candidatePlayerIds: string[];
      candidateDisplayNames: string[];
    }
  | {
      kind: 'unmatched';
      normalizedName: string;
    };

export interface ResolvedAttendanceIdentity {
  playerId: string;
  displayName: string;
  historicalNames: string[];
}

export interface UnresolvedAttendanceIdentity {
  key: string;
  displayName: string;
  historicalNames: string[];
  resolution: 'ambiguous' | 'unmatched';
}

export interface AttendanceIdentityRow {
  key: string;
  displayName: string;
  historicalNames: string[];
  resolution: 'matched' | 'ambiguous' | 'unmatched';
  playerId?: string;
}

type SquadIdentity = {
  playerId: string;
  displayName: string;
  fullNameNormalized: string;
  firstNameNormalized: string;
};

export function normalizeAttendanceName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\(\s*gk\s*\)/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getPlayerDisplayName(player: SquadPlayer): string {
  return `${player.firstName} ${player.lastName}`.trim();
}

function uniqueSorted(values: Iterable<string>): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

export function createAttendanceNameResolver(
  squadPlayers: SquadPlayer[],
  aliases: AttendanceAliasMap = {}
): {
  resolveName: (playerName: string) => AttendanceNameResolution;
  getPlayerIdentity: (playerId: string) => ResolvedAttendanceIdentity | undefined;
  listSquadIdentities: () => ResolvedAttendanceIdentity[];
} {
  const identities: SquadIdentity[] = squadPlayers.map((player) => ({
    playerId: player.id,
    displayName: getPlayerDisplayName(player),
    fullNameNormalized: normalizeAttendanceName(getPlayerDisplayName(player)),
    firstNameNormalized: normalizeAttendanceName(player.firstName || '')
  }));

  const byId = new Map(identities.map((identity) => [identity.playerId, identity]));

  const fullNameIndex = new Map<string, string[]>();
  const firstNameIndex = new Map<string, string[]>();

  identities.forEach((identity) => {
    if (identity.fullNameNormalized) {
      const full = fullNameIndex.get(identity.fullNameNormalized) || [];
      full.push(identity.playerId);
      fullNameIndex.set(identity.fullNameNormalized, full);
    }

    if (identity.firstNameNormalized) {
      const first = firstNameIndex.get(identity.firstNameNormalized) || [];
      first.push(identity.playerId);
      firstNameIndex.set(identity.firstNameNormalized, first);
    }
  });

  const normalizedAliases = new Map<string, string>();
  Object.entries(aliases).forEach(([rawAlias, playerId]) => {
    const normalizedAlias = normalizeAttendanceName(rawAlias);
    if (normalizedAlias) {
      normalizedAliases.set(normalizedAlias, playerId);
    }
  });

  const resolveName = (playerName: string): AttendanceNameResolution => {
    const normalizedName = normalizeAttendanceName(playerName);

    if (!normalizedName) {
      return {
        kind: 'unmatched',
        normalizedName
      };
    }

    const aliasedPlayerId = normalizedAliases.get(normalizedName);
    if (aliasedPlayerId) {
      const aliasedIdentity = byId.get(aliasedPlayerId);
      if (aliasedIdentity) {
        return {
          kind: 'matched',
          playerId: aliasedIdentity.playerId,
          displayName: aliasedIdentity.displayName,
          normalizedName
        };
      }
    }

    const fullNameCandidates = uniqueSorted(fullNameIndex.get(normalizedName) || []);
    if (fullNameCandidates.length === 1) {
      const identity = byId.get(fullNameCandidates[0]);
      if (identity) {
        return {
          kind: 'matched',
          playerId: identity.playerId,
          displayName: identity.displayName,
          normalizedName
        };
      }
    }

    if (fullNameCandidates.length > 1) {
      return {
        kind: 'ambiguous',
        normalizedName,
        candidatePlayerIds: fullNameCandidates,
        candidateDisplayNames: fullNameCandidates
          .map((playerId) => byId.get(playerId)?.displayName || playerId)
          .sort((a, b) => a.localeCompare(b))
      };
    }

    const firstNameCandidates = uniqueSorted(firstNameIndex.get(normalizedName) || []);
    if (firstNameCandidates.length === 1) {
      const identity = byId.get(firstNameCandidates[0]);
      if (identity) {
        return {
          kind: 'matched',
          playerId: identity.playerId,
          displayName: identity.displayName,
          normalizedName
        };
      }
    }

    if (firstNameCandidates.length > 1) {
      return {
        kind: 'ambiguous',
        normalizedName,
        candidatePlayerIds: firstNameCandidates,
        candidateDisplayNames: firstNameCandidates
          .map((playerId) => byId.get(playerId)?.displayName || playerId)
          .sort((a, b) => a.localeCompare(b))
      };
    }

    return {
      kind: 'unmatched',
      normalizedName
    };
  };

  const getPlayerIdentity = (playerId: string): ResolvedAttendanceIdentity | undefined => {
    const identity = byId.get(playerId);
    if (!identity) return undefined;

    return {
      playerId: identity.playerId,
      displayName: identity.displayName,
      historicalNames: [identity.displayName]
    };
  };

  const listSquadIdentities = (): ResolvedAttendanceIdentity[] => {
    return identities.map((identity) => ({
      playerId: identity.playerId,
      displayName: identity.displayName,
      historicalNames: [identity.displayName]
    }));
  };

  return {
    resolveName,
    getPlayerIdentity,
    listSquadIdentities
  };
}

export function buildAttendanceIdentityRows(params: {
  squadPlayers: SquadPlayer[];
  rosterNames: string[];
  attendanceNames: string[];
  aliases?: AttendanceAliasMap;
}): AttendanceIdentityRow[] {
  const { squadPlayers, rosterNames, attendanceNames, aliases = {} } = params;
  const resolver = createAttendanceNameResolver(squadPlayers, aliases);

  const matchedByPlayerId = new Map<string, Set<string>>();
  resolver.listSquadIdentities().forEach((identity) => {
    matchedByPlayerId.set(identity.playerId, new Set(identity.historicalNames));
  });

  const unresolvedByKey = new Map<string, UnresolvedAttendanceIdentity>();
  const observedNames = Array.from(new Set([...rosterNames, ...attendanceNames]));

  observedNames.forEach((rawName) => {
    const name = rawName.trim();
    if (!name) return;

    const resolution = resolver.resolveName(name);
    if (resolution.kind === 'matched') {
      const historicalNames = matchedByPlayerId.get(resolution.playerId) || new Set<string>();
      historicalNames.add(name);
      matchedByPlayerId.set(resolution.playerId, historicalNames);
      return;
    }

    const key = `${resolution.kind}:${resolution.normalizedName || normalizeAttendanceName(name)}`;
    const existing = unresolvedByKey.get(key);
    if (existing) {
      existing.historicalNames = uniqueSorted([...existing.historicalNames, name]);
      return;
    }

    unresolvedByKey.set(key, {
      key,
      displayName: name,
      historicalNames: [name],
      resolution: resolution.kind
    });
  });

  const matchedRows: AttendanceIdentityRow[] = resolver.listSquadIdentities().map((identity) => ({
    key: `player:${identity.playerId}`,
    playerId: identity.playerId,
    displayName: identity.displayName,
    historicalNames: uniqueSorted(matchedByPlayerId.get(identity.playerId) || identity.historicalNames),
    resolution: 'matched'
  }));

  const unresolvedRows: AttendanceIdentityRow[] = Array.from(unresolvedByKey.values())
    .map((identity) => ({
      key: identity.key,
      displayName: identity.displayName,
      historicalNames: identity.historicalNames,
      resolution: identity.resolution
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  return [...matchedRows, ...unresolvedRows];
}

export const DEFAULT_ATTENDANCE_ALIASES: AttendanceAliasMap = {};