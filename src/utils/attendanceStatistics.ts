import type { AbsenceReason, PlayerAttendance } from '../types';

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
  unknownCount: number;
  participationRate: number;
  attendanceRate: number;
  reasonsMap: Record<AbsenceReason, number>;
};

function normalizePlayerName(name: string): string {
  return name.trim().toLowerCase();
}

export function findAttendanceRecord(
  attendance: PlayerAttendance[] | undefined,
  playerName: string
): PlayerAttendance | undefined {
  const normalizedPlayerName = normalizePlayerName(playerName);
  return (attendance || []).find(
    (record) => normalizePlayerName(record.playerName) === normalizedPlayerName
  );
}

export function calculatePlayerAttendanceStatistics(
  playerName: string,
  sessions: AttendanceSession[]
): PlayerAttendanceStatistics {
  let attendingCount = 0;
  let absentCount = 0;
  let gymCount = 0;
  const reasonsMap: Record<AbsenceReason, number> = {
    Vacation: 0,
    Study: 0,
    Injury: 0,
    Permission: 0,
    Unknown: 0
  };

  sessions.forEach((session) => {
    const record = findAttendanceRecord(session.attendance, playerName);
    if (!record) return;

    if (record.status === 'Attending') {
      attendingCount += 1;
      return;
    }

    if (record.status === 'Gym') {
      gymCount += 1;
      return;
    }

    absentCount += 1;
    const reason = record.absenceReason || 'Unknown';
    reasonsMap[reason] += 1;
  });

  const totalSessions = sessions.length;
  const recordedSessions = attendingCount + absentCount + gymCount;
  const unknownCount = totalSessions - recordedSessions;

  return {
    playerName,
    totalSessions,
    recordedSessions,
    attendingCount,
    absentCount,
    gymCount,
    unknownCount,
    participationRate: totalSessions > 0 ? (recordedSessions / totalSessions) * 100 : 0,
    attendanceRate: recordedSessions > 0 ? (attendingCount / recordedSessions) * 100 : 0,
    reasonsMap
  };
}

export function getAvailablePlayerNamesForGroups(
  squadRoster: string[],
  attendance: PlayerAttendance[] | undefined
): string[] {
  return squadRoster.filter(
    (playerName) => findAttendanceRecord(attendance, playerName)?.status === 'Attending'
  );
}