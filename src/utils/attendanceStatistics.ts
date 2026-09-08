import type { AbsenceReason, PlayerAttendance, SquadPlayer } from '../types';
import {
  normalizeAttendanceName,
  type AttendanceNameResolution
} from './attendanceIdentity';

export type AttendanceSession = {
  attendance?: PlayerAttendance[];
};

export type PlayerAttendanceStatistics = {
  playerName: string;
  totalSessions: number;
  recordedSessions: number;
  attendingCount: number;
  absentCount: number;
  gymCount: number;
  firstTeamCount: number;
  nationalTeamCount: number;
  unknownCount: number;
  participationRate: number;
  attendanceRate: number;
  reasonsMap: Record<AbsenceReason, number>;
};

export type AttendanceNameResolver = (playerName: string) => AttendanceNameResolution;

type AttendanceRecordPredicate = (record: PlayerAttendance) => boolean;

export function findAttendanceRecord(
  attendance: PlayerAttendance[] | undefined,
  playerName: string,
  predicate?: AttendanceRecordPredicate
): PlayerAttendance | undefined {
  const normalizedPlayerName = normalizeAttendanceName(playerName);
  return (attendance || []).find(
    (record) => {
      if (predicate && !predicate(record)) return false;
      return normalizeAttendanceName(record.playerName) === normalizedPlayerName;
    }
  );
}

function buildReasonsMap(): Record<AbsenceReason, number> {
  return {
    Vacation: 0,
    Study: 0,
    Injury: 0,
    Permission: 0,
    Unknown: 0
  };
}

function calculateStatsFromResolver(
  playerLabel: string,
  sessions: AttendanceSession[],
  resolveRecord: (session: AttendanceSession) => PlayerAttendance | undefined
): PlayerAttendanceStatistics {
  let attendingCount = 0;
  let absentCount = 0;
  let gymCount = 0;
  let firstTeamCount = 0;
  let nationalTeamCount = 0;
  const reasonsMap = buildReasonsMap();

  sessions.forEach((session) => {
    const record = resolveRecord(session);
    if (!record) return;

    if (record.status === 'Attending') {
      attendingCount += 1;
      return;
    }

    if (record.status === 'Gym') {
      gymCount += 1;
      return;
    }

    if (record.status === 'First Team') {
      firstTeamCount += 1;
      return;
    }

    if (record.status === 'National Team Call') {
      nationalTeamCount += 1;
      return;
    }

    absentCount += 1;
    const reason = record.absenceReason || 'Unknown';
    reasonsMap[reason] += 1;
  });

  const totalSessions = sessions.length;
  const recordedSessions = attendingCount + absentCount + gymCount;
  const explicitRecords = recordedSessions + firstTeamCount + nationalTeamCount;
  const unknownCount = totalSessions - explicitRecords;

  return {
    playerName: playerLabel,
    totalSessions,
    recordedSessions,
    attendingCount,
    absentCount,
    gymCount,
    firstTeamCount,
    nationalTeamCount,
    unknownCount,
    // Participation = share of ALL sessions actually attended (not just the recorded ones).
    participationRate: totalSessions > 0 ? (attendingCount / totalSessions) * 100 : 0,
    attendanceRate: recordedSessions > 0 ? (attendingCount / recordedSessions) * 100 : 0,
    reasonsMap
  };
}

export function calculatePlayerAttendanceStatistics(
  playerName: string,
  sessions: AttendanceSession[]
): PlayerAttendanceStatistics {
  return calculateStatsFromResolver(playerName, sessions, (session) =>
    findAttendanceRecord(session.attendance, playerName)
  );
}

export function calculatePlayerAttendanceStatisticsByPlayerId(
  playerId: string,
  playerLabel: string,
  sessions: AttendanceSession[],
  resolveName: AttendanceNameResolver
): PlayerAttendanceStatistics {
  return calculateStatsFromResolver(playerLabel, sessions, (session) =>
    (session.attendance || []).find((record) => {
      const resolution = resolveName(record.playerName);
      return resolution.kind === 'matched' && resolution.playerId === playerId;
    })
  );
}

export function calculatePlayerAttendanceStatisticsByHistoricalNames(
  playerLabel: string,
  historicalNames: string[],
  sessions: AttendanceSession[]
): PlayerAttendanceStatistics {
  const normalizedNames = new Set(
    historicalNames.map((name) => normalizeAttendanceName(name)).filter(Boolean)
  );

  return calculateStatsFromResolver(playerLabel, sessions, (session) =>
    (session.attendance || []).find((record) => normalizedNames.has(normalizeAttendanceName(record.playerName)))
  );
}

export function getPlayerIdentityKey(playerName: string, resolveName?: AttendanceNameResolver): string {
  const normalized = normalizeAttendanceName(playerName);
  if (!resolveName) return `name:${normalized}`;

  const resolution = resolveName(playerName);
  if (resolution.kind === 'matched') return `player:${resolution.playerId}`;
  if (resolution.kind === 'external') return `external:${normalized}`;
  return `name:${normalized}`;
}

export function getAvailablePlayerNamesForGroups(
  squadRoster: string[],
  attendance: PlayerAttendance[] | undefined,
  options?: {
    resolveName?: AttendanceNameResolver;
    includeExternalPlayers?: boolean;
    squadPlayers?: SquadPlayer[];
  }
): string[] {
  const resolveName = options?.resolveName;
  const squadPlayers = options?.squadPlayers;

  if (!resolveName) {
    return squadRoster.filter((playerName) => {
      if (squadPlayers) {
        const clean = playerName.toLowerCase().replace(/\s*\(gk\)$/i, '').trim();
        const sp = squadPlayers.find(
          (p) =>
            p.firstName.toLowerCase() === clean ||
            `${p.firstName} ${p.lastName}`.toLowerCase() === clean
        );
        if (sp?.position === 'GK') return false;
        if (sp?.status === 'Injured') return false;
      }
      return findAttendanceRecord(attendance, playerName)?.status === 'Attending';
    });
  }

  const seenIdentities = new Set<string>();
  const squadNames: string[] = [];

  squadRoster.forEach((playerName) => {
    const playerResolution = resolveName(playerName);
    if (playerResolution.kind !== 'matched') return;
    if (seenIdentities.has(playerResolution.playerId)) return;

    // Check real squad player state
    const matchedPlayer = squadPlayers?.find((p) => p.id === playerResolution.playerId);

    // Exclude Goalkeepers (position === 'GK') from training groups
    if (matchedPlayer?.position === 'GK') return;

    // Exclude players whose real state is Injured
    if (matchedPlayer?.status === 'Injured') return;

    const isAttending = (attendance || []).some((record) => {
      if (record.status !== 'Attending') return false;
      const recordResolution = resolveName(record.playerName);
      return recordResolution.kind === 'matched' && recordResolution.playerId === playerResolution.playerId;
    });
    if (!isAttending) return;

    // A player marked Absent (due to injury or otherwise) must not be treated as attending
    const hasAbsentRecord = (attendance || []).some((record) => {
      if (record.status !== 'Absent') return false;
      const recordResolution = resolveName(record.playerName);
      return recordResolution.kind === 'matched' && recordResolution.playerId === playerResolution.playerId;
    });
    if (hasAbsentRecord) return;

    seenIdentities.add(playerResolution.playerId);
    // Aliases such as "Leen" and "Leen Alhaidari" share one identity, so the squad display name wins.
    squadNames.push(playerResolution.displayName || playerName.trim());
  });

  if (!options?.includeExternalPlayers) {
    return squadNames;
  }

  // External identities are not part of the squad roster, so they are taken from the session's own attendance.
  const seenExternals = new Set<string>();
  const externalNames: string[] = [];

  (attendance || []).forEach((record) => {
    if (record.status !== 'Attending') return;
    if (resolveName(record.playerName).kind !== 'external') return;

    const identityKey = getPlayerIdentityKey(record.playerName, resolveName);
    if (identityKey === 'external:' || seenExternals.has(identityKey)) return;

    seenExternals.add(identityKey);
    externalNames.push(record.playerName.trim());
  });

  return [...squadNames, ...externalNames];
}