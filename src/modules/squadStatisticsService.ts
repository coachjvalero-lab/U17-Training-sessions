import { PlayerAttendance, SquadPlayer, TrainingSession } from '../types';

export interface SquadStatisticsInput {
  players: SquadPlayer[];
  sessions: Array<Pick<TrainingSession, 'id' | 'date' | 'attendance'>>;
  excludedPlayers?: string[];
}

export interface SquadStatisticsResult {
  players: SquadPlayer[];
  attendanceRanking: SquadPlayer[];
  malikaRanking: SquadPlayer[];
  topAttendancePlayers: SquadPlayer[];
  topMalikaPlayers: SquadPlayer[];
  attendanceSummary: {
    totalPlayers: number;
    recordedSessions: number;
    overallAttended: number;
    overallPossible: number;
    attendanceRate: number;
  };
}

function isExcludedPlayer(name: string, excludedPlayers: string[]): boolean {
  const normalized = name.trim().toLowerCase();
  return excludedPlayers.some((excluded) => excluded.trim().toLowerCase() === normalized);
}

function getPlayerFullName(player: SquadPlayer): string {
  return `${player.firstName} ${player.lastName}`.trim();
}

function buildAttendanceStats(
  players: SquadPlayer[],
  sessions: Array<Pick<TrainingSession, 'id' | 'date' | 'attendance'>>,
  excludedPlayers: string[]
): SquadPlayer[] {
  const sessionList = Array.from(
    new Map(
      sessions
        .filter((session) => session && session.id)
        .map((session) => [session.id, session])
    ).values()
  ).sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const enrichedPlayers = players.map((player) => {
    if (isExcludedPlayer(getPlayerFullName(player), excludedPlayers)) {
      return player;
    }

    let total = 0;
    let attended = 0;

    sessionList.forEach((session) => {
      const attendance = Array.isArray(session.attendance) ? session.attendance : [];
      if (attendance.length === 0) return;

      total += 1;
      const record = attendance.find(
        (entry: PlayerAttendance) => entry.playerName.trim().toLowerCase() === getPlayerFullName(player).trim().toLowerCase()
      );

      if (!record || record.status === 'Attending' || record.status === 'Gym') {
        attended += 1;
      }
    });

    const percentage = total > 0 ? Math.round((attended / total) * 100) : 100;

    return {
      ...player,
      attendanceStats: {
        attended,
        total,
        percentage,
        ranking: 0,
        updatedAt: Date.now()
      }
    };
  });

  const rankedPlayers = enrichedPlayers.filter((player) => player.attendanceStats).sort((a, b) => {
    const aStats = a.attendanceStats;
    const bStats = b.attendanceStats;
    if (!aStats || !bStats) return 0;
    if (bStats.percentage !== aStats.percentage) return bStats.percentage - aStats.percentage;
    if (bStats.attended !== aStats.attended) return bStats.attended - aStats.attended;
    return getPlayerFullName(a).localeCompare(getPlayerFullName(b));
  });

  const rankingLookup = new Map<string, number>();
  rankedPlayers.forEach((player, index) => {
    rankingLookup.set(player.id, index + 1);
  });

  return enrichedPlayers.map((player) => ({
    ...player,
    attendanceStats: player.attendanceStats
      ? {
          ...player.attendanceStats,
          ranking: rankingLookup.get(player.id) || 0,
          updatedAt: Date.now()
        }
      : player.attendanceStats
  }));
}

function buildMalikaRanking(players: SquadPlayer[], excludedPlayers: string[]): SquadPlayer[] {
  const filteredPlayers = players.filter((player) => !isExcludedPlayer(getPlayerFullName(player), excludedPlayers));

  const rankedPlayers = [...filteredPlayers].sort((a, b) => {
    const pointsA = a.malikaPoints || 0;
    const pointsB = b.malikaPoints || 0;
    if (pointsB !== pointsA) return pointsB - pointsA;
    return getPlayerFullName(a).localeCompare(getPlayerFullName(b));
  });

  return rankedPlayers.map((player, index) => ({
    ...player,
    malikaPoints: player.malikaPoints || 0,
    attendanceStats: player.attendanceStats,
    malikaHistory: Array.isArray(player.malikaHistory) ? player.malikaHistory : [],
    notes: player.notes,
    joinedDate: player.joinedDate,
    photoUrl: player.photoUrl,
    age: player.age,
    nationality: player.nationality,
    preferredFoot: player.preferredFoot,
    heightCm: player.heightCm,
    weightKg: player.weightKg,
  }));
}

export function calculateSquadStatistics({
  players,
  sessions,
  excludedPlayers = []
}: SquadStatisticsInput): SquadStatisticsResult {
  const playersWithAttendance = buildAttendanceStats(players, sessions, excludedPlayers);
  const attendanceRanking = [...playersWithAttendance].filter((player) => player.attendanceStats).sort((a, b) => {
    const aStats = a.attendanceStats;
    const bStats = b.attendanceStats;
    if (!aStats || !bStats) return 0;
    if (bStats.percentage !== aStats.percentage) return bStats.percentage - aStats.percentage;
    if (bStats.attended !== aStats.attended) return bStats.attended - aStats.attended;
    return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
  });

  const attendanceRankingWithRanks = attendanceRanking.map((player, index) => ({
    ...player,
    attendanceStats: player.attendanceStats
      ? {
          ...player.attendanceStats,
          ranking: index + 1,
          updatedAt: Date.now()
        }
      : player.attendanceStats
  }));

  const attendanceById = new Map(attendanceRankingWithRanks.map((player) => [player.id, player]));
  const playersWithStats = players.map((player) => attendanceById.get(player.id) || player);

  const malikaRanking = buildMalikaRanking(playersWithStats, excludedPlayers);
  const topAttendancePlayers = attendanceRankingWithRanks.slice(0, 3);
  const topMalikaPlayers = [...malikaRanking]
    .sort((a, b) => (b.malikaPoints || 0) - (a.malikaPoints || 0) || `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`))
    .slice(0, 3);

  const totalRecordedSessions = sessions.filter((session) => Array.isArray(session.attendance) && session.attendance.length > 0).length;
  const overallAttended = attendanceRankingWithRanks.reduce((sum, player) => sum + (player.attendanceStats?.attended || 0), 0);
  const overallPossible = attendanceRankingWithRanks.reduce((sum, player) => sum + (player.attendanceStats?.total || 0), 0);
  const attendanceRate = overallPossible > 0 ? Math.round((overallAttended / overallPossible) * 100) : 100;

  return {
    players: playersWithStats.map((player) => {
      const rankedAttendancePlayer = attendanceById.get(player.id);
      return {
        ...player,
        attendanceStats: rankedAttendancePlayer?.attendanceStats || player.attendanceStats || undefined,
        malikaPoints: player.malikaPoints || 0,
        malikaHistory: Array.isArray(player.malikaHistory) ? player.malikaHistory : []
      };
    }),
    attendanceRanking: attendanceRankingWithRanks,
    malikaRanking,
    topAttendancePlayers,
    topMalikaPlayers,
    attendanceSummary: {
      totalPlayers: playersWithStats.length,
      recordedSessions: totalRecordedSessions,
      overallAttended,
      overallPossible,
      attendanceRate
    }
  };
}
