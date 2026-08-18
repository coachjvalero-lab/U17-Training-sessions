import type { AbsenceReason, PlayerAttendance } from '../types';
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

export function getAvailablePlayerNamesForGroups(
  squadRoster: string[],
  attendance: PlayerAttendance[] | undefined,
  options?: {
    resolveName?: AttendanceNameResolver;
  }
): string[] {
  const resolveName = options?.resolveName;

  if (!resolveName) {
    return squadRoster.filter(
      (playerName) => findAttendanceRecord(attendance, playerName)?.status === 'Attending'
    );
  }

  return squadRoster.filter(
    (playerName) => {
      const playerResolution = resolveName(playerName);
      if (playerResolution.kind !== 'matched') return false;

      return (attendance || []).some((record) => {
        if (record.status !== 'Attending') return false;
        const recordResolution = resolveName(record.playerName);
        return recordResolution.kind === 'matched' && recordResolution.playerId === playerResolution.playerId;
      });
    }
  );
}