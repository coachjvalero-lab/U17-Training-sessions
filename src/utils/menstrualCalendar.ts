import type { WellnessPlayerResolution } from './wellnessMatching';
import type { Injury, PhysioComplaint } from '../types';

export type MenstrualWellnessRow = {
  rowId: string;
  playerName: string;
  dateKey: string;
  timestamp: string;
  menstrualCycle: string;
  dayOfPeriod: string;
  cyclePhase: string;
};

export type MenstrualCalendarIdentityStatus = WellnessPlayerResolution['status'];

export type MenstrualCalendarCell = {
  dateKey: string;
  day: number;
  wellnessRow: MenstrualWellnessRow | null;
  hasWellnessResponse: boolean;
  hasMenstrualInformation: boolean;
  menstrualCycle: string;
  periodDay: string;
  cyclePhase: string;
  injuries: Injury[];
  complaints: PhysioComplaint[];
};

export type MenstrualCalendarPhaseKey = 'Follicular' | 'Ovulatory' | 'Luteal' | 'Unknown';

export type MenstrualCalendarPhaseDistribution = Record<MenstrualCalendarPhaseKey, number>;

export type MenstrualCalendarSummary = {
  injuryCount: number;
  complaintCount: number;
  injuriesByPhase: MenstrualCalendarPhaseDistribution;
  complaintsByPhase: MenstrualCalendarPhaseDistribution;
};

export type MenstrualCalendarPlayer = {
  identityKey: string;
  playerName: string;
  displayName: string;
  playerId: string | null;
  status: MenstrualCalendarIdentityStatus;
  cells: MenstrualCalendarCell[];
  summary: MenstrualCalendarSummary;
};

export type MenstrualCalendarModel = {
  monthKey: string;
  year: number;
  month: number;
  days: string[];
  players: MenstrualCalendarPlayer[];
  summary: MenstrualCalendarSummary;
};

export type MenstrualCalendarSnapshot = {
  rows: MenstrualWellnessRow[];
  resolutions: WellnessPlayerResolution[];
};

export type MenstrualCalendarClinicalRecords = {
  injuries?: Injury[];
  complaints?: PhysioComplaint[];
};

export function getLocalMonthKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function shiftMonthKey(monthKey: string, offset: number): string {
  const parsed = parseMonthKey(monthKey);
  const date = new Date(parsed.year, parsed.month - 1 + offset, 1);
  return getLocalMonthKey(date);
}

export function buildMonthDays(monthKey: string): string[] {
  const parsed = parseMonthKey(monthKey);
  const daysInMonth = new Date(parsed.year, parsed.month, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, index) => {
    const day = String(index + 1).padStart(2, '0');
    return `${monthKey}-${day}`;
  });
}

export function buildMenstrualCalendarModel(
  snapshot: MenstrualCalendarSnapshot,
  monthKey: string,
  clinicalRecords: MenstrualCalendarClinicalRecords = {}
): MenstrualCalendarModel {
  const parsed = parseMonthKey(monthKey);
  const days = buildMonthDays(monthKey);
  const daySet = new Set(days);
  const resolutionsByName = new Map(snapshot.resolutions.map((resolution) => [resolution.playerName, resolution]));
  const matchedResolutionsByPlayerId = new Map(
    snapshot.resolutions
      .filter((resolution) => resolution.status === 'matched' && resolution.playerId)
      .map((resolution) => [resolution.playerId as string, resolution])
  );
  const playersByIdentity = new Map<string, MenstrualCalendarPlayer>();
  const latestRowsByIdentityAndDate = new Map<string, MenstrualWellnessRow>();

  snapshot.rows.forEach((row, sheetIndex) => {
    if (!daySet.has(row.dateKey)) return;

    const resolution = resolutionsByName.get(row.playerName);
    const identityKey = resolution?.status === 'matched' && resolution.playerId
      ? `matched:${resolution.playerId}`
      : `${resolution?.status || 'unresolved'}:${row.playerName}`;

    ensurePlayerRow(playersByIdentity, days, row.playerName, resolution);

    const rowKey = `${identityKey}|${row.dateKey}`;
    const current = latestRowsByIdentityAndDate.get(rowKey);
    if (!current || compareRowsByRecency(row, current, sheetIndex, snapshot.rows.indexOf(current)) >= 0) {
      latestRowsByIdentityAndDate.set(rowKey, row);
    }
  });

  latestRowsByIdentityAndDate.forEach((row, key) => {
    const [identityKey] = key.split('|');
    const player = playersByIdentity.get(identityKey);
    if (!player) return;
    const dayIndex = Number(row.dateKey.slice(-2)) - 1;
    player.cells[dayIndex] = makeFilledCell(row, dayIndex + 1);
  });

  (clinicalRecords.injuries || []).forEach((injury) => {
    if (!daySet.has(injury.injuryDate)) return;
    const resolution = matchedResolutionsByPlayerId.get(injury.playerId);
    if (!resolution) return;
    const player = ensurePlayerRow(playersByIdentity, days, resolution.playerName, resolution);
    const dayIndex = Number(injury.injuryDate.slice(-2)) - 1;
    player.cells[dayIndex].injuries.push(injury);
  });

  (clinicalRecords.complaints || []).forEach((complaint) => {
    if (!daySet.has(complaint.occurrenceDate)) return;
    const resolution = matchedResolutionsByPlayerId.get(complaint.playerId);
    if (!resolution) return;
    const player = ensurePlayerRow(playersByIdentity, days, resolution.playerName, resolution);
    const dayIndex = Number(complaint.occurrenceDate.slice(-2)) - 1;
    player.cells[dayIndex].complaints.push(complaint);
  });

  playersByIdentity.forEach((player) => {
    player.summary = buildSummary(player.cells);
  });

  const players = Array.from(playersByIdentity.values()).sort((left, right) => {
    const leftRank = left.status === 'matched' ? 0 : 1;
    const rightRank = right.status === 'matched' ? 0 : 1;
    if (leftRank !== rightRank) return leftRank - rightRank;
    return left.displayName.localeCompare(right.displayName);
  });

  return {
    monthKey,
    year: parsed.year,
    month: parsed.month,
    days,
    players,
    summary: buildSummary(players.flatMap((player) => player.cells))
  };
}

function ensurePlayerRow(
  playersByIdentity: Map<string, MenstrualCalendarPlayer>,
  days: string[],
  playerName: string,
  resolution?: WellnessPlayerResolution
): MenstrualCalendarPlayer {
  const identityKey = resolution?.status === 'matched' && resolution.playerId
    ? `matched:${resolution.playerId}`
    : `${resolution?.status || 'unresolved'}:${playerName}`;

  const existing = playersByIdentity.get(identityKey);
  if (existing) return existing;

  const status = resolution?.status || 'unresolved';
  const player: MenstrualCalendarPlayer = {
    identityKey,
    playerName,
    displayName: status === 'matched' ? resolution?.resolvedLabel || playerName : playerName,
    playerId: status === 'matched' ? resolution?.playerId || null : null,
    status,
    cells: days.map((dateKey, index) => makeEmptyCell(dateKey, index + 1)),
    summary: makeEmptySummary()
  };
  playersByIdentity.set(identityKey, player);
  return player;
}

function parseMonthKey(monthKey: string): { year: number; month: number } {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!match) {
    throw new Error(`Invalid month key: ${monthKey}`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) {
    throw new Error(`Invalid month key: ${monthKey}`);
  }

  return { year, month };
}

function makeEmptyCell(dateKey: string, day: number): MenstrualCalendarCell {
  return {
    dateKey,
    day,
    wellnessRow: null,
    hasWellnessResponse: false,
    hasMenstrualInformation: false,
    menstrualCycle: '',
    periodDay: '',
    cyclePhase: '',
    injuries: [],
    complaints: []
  };
}

function makeFilledCell(row: MenstrualWellnessRow, day: number): MenstrualCalendarCell {
  const menstrualCycle = normalizeSheetBlank(row.menstrualCycle);
  const periodDay = normalizeSheetBlank(row.dayOfPeriod);
  const cyclePhase = normalizeSheetBlank(row.cyclePhase);

  return {
    dateKey: row.dateKey,
    day,
    wellnessRow: row,
    hasWellnessResponse: true,
    hasMenstrualInformation: Boolean(menstrualCycle || periodDay || cyclePhase),
    menstrualCycle,
    periodDay,
    cyclePhase,
    injuries: [],
    complaints: []
  };
}

function makeEmptySummary(): MenstrualCalendarSummary {
  return {
    injuryCount: 0,
    complaintCount: 0,
    injuriesByPhase: makeEmptyPhaseDistribution(),
    complaintsByPhase: makeEmptyPhaseDistribution()
  };
}

function makeEmptyPhaseDistribution(): MenstrualCalendarPhaseDistribution {
  return {
    Follicular: 0,
    Ovulatory: 0,
    Luteal: 0,
    Unknown: 0
  };
}

function buildSummary(cells: MenstrualCalendarCell[]): MenstrualCalendarSummary {
  const summary = makeEmptySummary();
  cells.forEach((cell) => {
    const phase = resolvePhaseKey(cell.cyclePhase);
    if (cell.injuries.length > 0) {
      summary.injuryCount += cell.injuries.length;
      summary.injuriesByPhase[phase] += cell.injuries.length;
    }
    if (cell.complaints.length > 0) {
      summary.complaintCount += cell.complaints.length;
      summary.complaintsByPhase[phase] += cell.complaints.length;
    }
  });
  return summary;
}

function resolvePhaseKey(value: string): MenstrualCalendarPhaseKey {
  if (value === 'Follicular' || value === 'Ovulatory' || value === 'Luteal') return value;
  return 'Unknown';
}

function normalizeSheetBlank(value: string): string {
  const trimmed = String(value || '').trim();
  return trimmed === '—' ? '' : trimmed;
}

function compareRowsByRecency(
  left: MenstrualWellnessRow,
  right: MenstrualWellnessRow,
  leftIndex: number,
  rightIndex: number
): number {
  const leftTime = Date.parse(left.timestamp);
  const rightTime = Date.parse(right.timestamp);
  const leftComparable = Number.isNaN(leftTime) ? null : leftTime;
  const rightComparable = Number.isNaN(rightTime) ? null : rightTime;

  if (leftComparable !== null && rightComparable !== null && leftComparable !== rightComparable) {
    return leftComparable - rightComparable;
  }

  if (leftComparable !== null && rightComparable === null) return 1;
  if (leftComparable === null && rightComparable !== null) return -1;

  return leftIndex - rightIndex;
}
