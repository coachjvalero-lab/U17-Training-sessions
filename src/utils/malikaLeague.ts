import type { PlayerAttendance, SquadPlayer } from '../types';
import { createAttendanceNameResolver } from './attendanceIdentity';

/** Automatic bonus granted to players who completed Wellness every day of the month. */
export const MALIKA_WELLNESS_BONUS_POINTS = 3;

export interface MalikaAssignment {
  id: string;
  playerId: string;
  sessionId: string;
  exerciseId: string;
  exerciseName: string;
  competitionMonth: string;
  awardedDate: string;
  points: number;
  updatedAt?: string;
}

export type MalikaGroup = 'players' | 'goalkeepers';

export interface MalikaBreakdownItem {
  key: string;
  label: string;
  points: number;
  date: string;
  kind: 'exercise' | 'wellness-bonus';
}

export interface MalikaRankingEntry {
  playerId: string;
  playerName: string;
  position: SquadPlayer['position'];
  photoUrl?: string;
  group: MalikaGroup;
  exercisePoints: number;
  wellnessBonus: number;
  totalPoints: number;
  attendanceCount: number;
  rank: number;
  breakdown: MalikaBreakdownItem[];
}

const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/** Competition month key ('YYYY-MM') derived from a session/competition date. */
export function toCompetitionMonth(date: string | Date | number | undefined | null): string {
  if (typeof date === 'string') {
    const match = date.trim().match(/^(\d{4})-(\d{2})/);
    if (match) return `${match[1]}-${match[2]}`;
  }

  const parsed = date instanceof Date ? date : new Date(date ?? Date.now());
  if (Number.isNaN(parsed.getTime())) {
    const now = new Date();
    return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
  }
  return `${parsed.getFullYear()}-${pad2(parsed.getMonth() + 1)}`;
}

/** Local (non-UTC) day key 'YYYY-MM-DD' — matches how session dates are stored. */
export function toDayKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function formatCompetitionMonthLabel(month: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(month || '');
  if (!match) return month || '';
  const index = Number(match[2]) - 1;
  return `${MONTH_LABELS[index] ?? match[2]} ${match[1]}`;
}

/** Every month that has data, plus the current month, most recent first. */
export function listCompetitionMonths(assignments: MalikaAssignment[], currentMonth: string): string[] {
  const months = new Set<string>();
  assignments.forEach((assignment) => {
    if (assignment.competitionMonth) months.add(assignment.competitionMonth);
  });
  if (currentMonth) months.add(currentMonth);
  return Array.from(months).sort((a, b) => b.localeCompare(a));
}

/** Day keys of a month, capped at `upTo` so the running month is not judged on future days. */
export function listMonthDayKeys(month: string, upTo?: Date): string[] {
  const match = /^(\d{4})-(\d{2})$/.exec(month || '');
  if (!match) return [];

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();

  const limit = upTo && toCompetitionMonth(upTo) === month ? Math.min(upTo.getDate(), lastDay) : lastDay;

  const keys: string[] = [];
  for (let day = 1; day <= limit; day += 1) {
    keys.push(`${match[1]}-${match[2]}-${pad2(day)}`);
  }
  return keys;
}

/**
 * Players who submitted Wellness on every required day of the month.
 * `completedDaysByPlayerId` holds the day keys actually present in the Wellness source.
 */
export function computeWellnessBonusPlayerIds(params: {
  completedDaysByPlayerId: Map<string, Set<string>>;
  requiredDayKeys: string[];
}): string[] {
  const required = params.requiredDayKeys;
  if (required.length === 0) return [];

  const winners: string[] = [];
  params.completedDaysByPlayerId.forEach((days, playerId) => {
    if (required.every((dayKey) => days.has(dayKey))) winners.push(playerId);
  });
  return winners.sort();
}

function getPlayerGroup(player: SquadPlayer): MalikaGroup {
  return player.position === 'GK' ? 'goalkeepers' : 'players';
}

/**
 * Squad players taking part in the session, resolved through the existing attendance
 * identity system. Falls back to the whole squad when attendance is not recorded yet.
 */
export function selectMalikaParticipants(
  squadPlayers: SquadPlayer[],
  attendance: PlayerAttendance[] = []
): SquadPlayer[] {
  const attending = attendance.filter((entry) => entry.status === 'Attending' && entry.playerName);
  if (attending.length === 0) return squadPlayers;

  const { resolveName } = createAttendanceNameResolver(squadPlayers);
  const attendingIds = new Set<string>();
  attending.forEach((entry) => {
    const resolution = resolveName(entry.playerName);
    if (resolution.kind === 'matched') attendingIds.add(resolution.playerId);
  });

  const matched = squadPlayers.filter((player) => attendingIds.has(player.id));
  return matched.length > 0 ? matched : squadPlayers;
}

function rankEntries(entries: MalikaRankingEntry[]): MalikaRankingEntry[] {
  const sorted = [...entries].sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    // Tie-break rule: attendance during the same month.
    if (b.attendanceCount !== a.attendanceCount) return b.attendanceCount - a.attendanceCount;
    return a.playerName.localeCompare(b.playerName);
  });

  return sorted.map((entry, index) => ({ ...entry, rank: index + 1 }));
}

/**
 * Monthly standings derived exclusively from individual assignments.
 * Field players and goalkeepers are ranked in fully separate competitions.
 */
export function buildMalikaRanking(params: {
  players: SquadPlayer[];
  assignments: MalikaAssignment[];
  month: string;
  wellnessBonusPlayerIds?: Iterable<string>;
  attendanceByPlayerId?: Record<string, number>;
}): { players: MalikaRankingEntry[]; goalkeepers: MalikaRankingEntry[] } {
  const bonusIds = new Set(params.wellnessBonusPlayerIds ?? []);
  const attendance = params.attendanceByPlayerId ?? {};

  const monthAssignments = params.assignments.filter(
    (assignment) => assignment.competitionMonth === params.month
  );

  const byPlayer = new Map<string, MalikaAssignment[]>();
  monthAssignments.forEach((assignment) => {
    const list = byPlayer.get(assignment.playerId);
    if (list) list.push(assignment);
    else byPlayer.set(assignment.playerId, [assignment]);
  });

  const entries = params.players.map((player): MalikaRankingEntry => {
    const playerAssignments = (byPlayer.get(player.id) ?? [])
      .slice()
      .sort((a, b) => a.awardedDate.localeCompare(b.awardedDate));

    const exercisePoints = playerAssignments.reduce((sum, assignment) => sum + (assignment.points || 0), 0);
    const wellnessBonus = bonusIds.has(player.id) ? MALIKA_WELLNESS_BONUS_POINTS : 0;

    const breakdown: MalikaBreakdownItem[] = playerAssignments.map((assignment) => ({
      key: assignment.id,
      label: assignment.exerciseName || 'Malika Challenge',
      points: assignment.points || 0,
      date: assignment.awardedDate,
      kind: 'exercise'
    }));

    if (wellnessBonus > 0) {
      breakdown.push({
        key: `wellness-bonus-${player.id}-${params.month}`,
        label: 'Wellness Bonus',
        points: wellnessBonus,
        date: params.month,
        kind: 'wellness-bonus'
      });
    }

    return {
      playerId: player.id,
      playerName: `${player.firstName} ${player.lastName}`.trim(),
      position: player.position,
      photoUrl: player.photoUrl,
      group: getPlayerGroup(player),
      exercisePoints,
      wellnessBonus,
      totalPoints: exercisePoints + wellnessBonus,
      attendanceCount: attendance[player.id] ?? 0,
      rank: 0,
      breakdown
    };
  });

  return {
    players: rankEntries(entries.filter((entry) => entry.group === 'players')),
    goalkeepers: rankEntries(entries.filter((entry) => entry.group === 'goalkeepers'))
  };
}
