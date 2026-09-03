import type { Microcycle, SquadPlayer, TrainingSession } from '../types';
import type { HistoricalNameMapping } from './attendanceIdentity';
import { calculateSessionTotalDurationMinutes } from './duration';
import { buildRpeIdentityIndex, type RpeIdentity } from './rpeIdentity';
import type { RpeSheetRow } from './rpeSheetParsing';

/**
 * Load model (Foster session-RPE):
 *   Volume (UA) = RPE (Borg CR10) x session duration in minutes
 *
 * Acute / chronic windows (rolling-sum method, documented and fixed):
 *   Acute   = sum of Volume (UA) over the 7 calendar days ending on the reference date (inclusive).
 *   Chronic = sum of Volume (UA) over the 28 calendar days ending on the reference date (inclusive),
 *             divided by 4 to express it as a weekly equivalent comparable to the acute load.
 *   ACWR    = acute / chronic weekly equivalent.
 * Rest days are never materialised as zero-load sessions: they simply contribute nothing to the sums,
 * so an extra day off lowers the weekly sum without polluting any average.
 */
export const ACUTE_WINDOW_DAYS = 7;
export const CHRONIC_WINDOW_DAYS = 28;

/** Borg CR10 session-RPE bands used for the Wellness/RPE cross analysis. */
export const RPE_LOW_MAX = 4;
export const RPE_HIGH_MIN = 7;

/** A duration gap larger than this (minutes) between the sheet and the planned session is flagged. */
export const DURATION_DISCREPANCY_TOLERANCE_MINUTES = 10;

export type RpePlayerGroup = 'gk' | 'outfield';
export type RpeSessionLink = 'linked' | 'no-session' | 'multiple-sessions';
export type RpeMicrocycleLink = 'explicit' | 'date-range' | 'none';
export type RpeBand = 'low' | 'moderate' | 'high';
export type WellnessBand = 'green' | 'amber' | 'red';

export interface RpeEntry {
  rowId: string;
  dateKey: string;
  sheetName: string;
  identity: RpeIdentity;
  playerId: string | null;
  displayName: string;
  position: string | null;
  group: RpePlayerGroup | null;
  rpe: number | null;
  durationMinutes: number | null;
  /** RPE x Duration, recomputed by the app. Null when either input is missing/invalid. */
  volumeUa: number | null;
  reportedVolumeUa: number | null;
  /** Null when the sheet reports no volume at all. */
  matchesReportedVolume: boolean | null;
  sessionId: string | null;
  sessionLink: RpeSessionLink;
  /** SUM(exercise durations) of the linked training session. */
  sessionDurationMinutes: number | null;
  durationDeltaMinutes: number | null;
  hasDurationDiscrepancy: boolean;
  microcycleId: string | null;
  microcycleName: string | null;
  microcycleLink: RpeMicrocycleLink;
  /** True when rpe and duration are both usable, i.e. the row contributes to load totals. */
  hasValidLoad: boolean;
}

export interface RpeGroupSummary {
  entryCount: number;
  playerCount: number;
  averageRpe: number | null;
  totalLoadUa: number;
  averageLoadUa: number | null;
}

export interface RpeOverview {
  all: RpeGroupSummary;
  outfield: RpeGroupSummary;
  gk: RpeGroupSummary;
  unassigned: RpeGroupSummary;
}

export interface RpeWeeklyLoad {
  weekKey: string;
  weekStart: string;
  weekEnd: string;
  totalLoadUa: number;
  outfieldLoadUa: number;
  gkLoadUa: number;
  entryCount: number;
  averageRpe: number | null;
}

export interface RpeMicrocycleLoad {
  microcycleId: string | null;
  microcycleName: string;
  totalLoadUa: number;
  outfieldLoadUa: number;
  gkLoadUa: number;
  entryCount: number;
  averageRpe: number | null;
  sessionDates: string[];
}

export interface RpePlayerSummary {
  playerId: string;
  displayName: string;
  group: RpePlayerGroup | null;
  entryCount: number;
  averageRpe: number | null;
  totalLoadUa: number;
  averageLoadUa: number | null;
  firstDate: string | null;
  lastDate: string | null;
}

export interface RpePlayerTimelinePoint {
  dateKey: string;
  rpe: number | null;
  loadUa: number | null;
  durationMinutes: number | null;
  sessionId: string | null;
  microcycleName: string | null;
}

export type AcuteChronicStatus = 'ok' | 'insufficient-history' | 'no-chronic-load';

export interface AcuteChronicLoad {
  referenceDate: string;
  acuteWindowDays: number;
  chronicWindowDays: number;
  acuteLoadUa: number;
  chronicLoadUa: number;
  chronicWeeklyLoadUa: number;
  acwr: number | null;
  status: AcuteChronicStatus;
  acuteEntryCount: number;
  chronicEntryCount: number;
  /** Calendar days between the first recorded entry and the reference date, inclusive. */
  observedSpanDays: number;
}

export interface WellnessReadingInput {
  playerName: string;
  dateKey: string;
  readiness: number | null;
  status: string | null;
}

export interface WellnessRpePoint {
  playerId: string;
  displayName: string;
  dateKey: string;
  readiness: number | null;
  wellnessBand: WellnessBand | null;
  rpe: number;
  rpeBand: RpeBand;
  loadUa: number | null;
  group: RpePlayerGroup | null;
}

export interface WellnessRpeAnalysis {
  points: WellnessRpePoint[];
  /** Counts keyed as `${wellnessBand}:${rpeBand}`. */
  matrix: Record<string, number>;
  unmatchedWellnessReadings: number;
  unmatchedRpeEntries: number;
}

/* ------------------------------------------------------------------ */
/* Date helpers (UTC-safe, pure string arithmetic on YYYY-MM-DD)       */
/* ------------------------------------------------------------------ */

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function isValidDateKey(value: string | null | undefined): boolean {
  return typeof value === 'string' && DATE_KEY_PATTERN.test(value);
}

function toUtcTime(dateKey: string): number {
  const [year, month, day] = dateKey.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

function fromUtcTime(time: number): string {
  const date = new Date(time);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

export function addDaysToDateKey(dateKey: string, days: number): string {
  return fromUtcTime(toUtcTime(dateKey) + days * MS_PER_DAY);
}

export function diffInDays(fromDateKey: string, toDateKey: string): number {
  return Math.round((toUtcTime(toDateKey) - toUtcTime(fromDateKey)) / MS_PER_DAY);
}

/** ISO-8601 week (Monday start), e.g. 2026-W35. */
export function getIsoWeekKey(dateKey: string): string {
  const date = new Date(toUtcTime(dateKey));
  const dayOfWeek = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayOfWeek + 3);
  const isoYear = date.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  const firstThursdayOffset = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstThursdayOffset + 3);
  const week = 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * MS_PER_DAY));
  return `${isoYear}-W${String(week).padStart(2, '0')}`;
}

export function getIsoWeekStart(dateKey: string): string {
  const dayOfWeek = (new Date(toUtcTime(dateKey)).getUTCDay() + 6) % 7;
  return addDaysToDateKey(dateKey, -dayOfWeek);
}

/* ------------------------------------------------------------------ */
/* Core calculations                                                   */
/* ------------------------------------------------------------------ */

/** Volume (UA) = RPE x Duration. Returns null when either value is missing or non-positive. */
export function calculateVolumeUa(rpe: number | null, durationMinutes: number | null): number | null {
  if (rpe === null || durationMinutes === null) return null;
  if (!Number.isFinite(rpe) || !Number.isFinite(durationMinutes)) return null;
  if (rpe <= 0 || durationMinutes <= 0) return null;
  return Math.round(rpe * durationMinutes * 10) / 10;
}

export function getRpeBand(rpe: number): RpeBand {
  if (rpe <= RPE_LOW_MAX) return 'low';
  if (rpe >= RPE_HIGH_MIN) return 'high';
  return 'moderate';
}

export function getWellnessBand(status: string | null | undefined): WellnessBand | null {
  const normalized = (status || '').trim().toLowerCase();
  if (normalized === 'green') return 'green';
  if (normalized === 'amber') return 'amber';
  if (normalized === 'red') return 'red';
  return null;
}

export function resolveSessionTotalDurationMinutes(session: TrainingSession): number {
  return calculateSessionTotalDurationMinutes([session.warmUp, session.mainPart, session.coolDown]);
}

interface MicrocycleResolution {
  microcycleId: string | null;
  microcycleName: string | null;
  link: RpeMicrocycleLink;
}

/**
 * Training Session -> Microcycle uses the existing explicit link first
 * (microcycle_days.session_id). Only when a session has no explicit link do we fall back
 * to the microcycle whose date range contains the session date.
 */
export function resolveMicrocycleForSession(
  sessionId: string | null,
  sessionDate: string | null,
  microcycles: Microcycle[]
): MicrocycleResolution {
  if (sessionId) {
    for (const microcycle of microcycles) {
      const linked = (microcycle.days || []).some((day) => day.sessionId === sessionId);
      if (linked) {
        return { microcycleId: microcycle.id, microcycleName: microcycle.name, link: 'explicit' };
      }
    }
  }

  if (sessionDate && isValidDateKey(sessionDate)) {
    const containing = microcycles.find(
      (microcycle) =>
        isValidDateKey(microcycle.startDate) &&
        isValidDateKey(microcycle.endDate) &&
        microcycle.startDate <= sessionDate &&
        sessionDate <= microcycle.endDate
    );
    if (containing) {
      return { microcycleId: containing.id, microcycleName: containing.name, link: 'date-range' };
    }
  }

  return { microcycleId: null, microcycleName: null, link: 'none' };
}

export interface BuildRpeEntriesInput {
  rows: RpeSheetRow[];
  squadPlayers: SquadPlayer[];
  sessions: TrainingSession[];
  microcycles?: Microcycle[];
  identityMappings?: HistoricalNameMapping[];
}

/**
 * Turns raw sheet rows into analysis-ready entries.
 * Unresolved / ambiguous / external rows are kept with all their original data.
 */
export function buildRpeEntries(input: BuildRpeEntriesInput): RpeEntry[] {
  const { rows, squadPlayers, sessions, microcycles = [], identityMappings = [] } = input;

  const identityIndex = buildRpeIdentityIndex(
    rows.map((row) => row.playerName),
    squadPlayers,
    identityMappings
  );

  const playersById = new Map(squadPlayers.map((player) => [player.id, player]));

  const sessionsByDate = new Map<string, TrainingSession[]>();
  sessions.forEach((session) => {
    if (!session?.date) return;
    const bucket = sessionsByDate.get(session.date);
    if (bucket) bucket.push(session);
    else sessionsByDate.set(session.date, [session]);
  });

  const microcycleCache = new Map<string, MicrocycleResolution>();

  return rows.map((row) => {
    const identity = identityIndex.get(row.playerName)
      ?? { sheetName: row.playerName, normalizedName: row.playerName, kind: 'unresolved' as const, playerId: null, displayName: row.playerName };

    const player = identity.playerId ? playersById.get(identity.playerId) : undefined;
    const position = player?.position ?? null;
    const group: RpePlayerGroup | null = player ? (player.position === 'GK' ? 'gk' : 'outfield') : null;

    const sameDaySessions = sessionsByDate.get(row.dateKey) || [];
    const sessionLink: RpeSessionLink =
      sameDaySessions.length === 1 ? 'linked' : sameDaySessions.length === 0 ? 'no-session' : 'multiple-sessions';
    const session = sameDaySessions.length === 1 ? sameDaySessions[0] : null;
    const sessionDurationMinutes = session ? resolveSessionTotalDurationMinutes(session) : null;

    const cacheKey = session ? `s:${session.id}` : `d:${row.dateKey}`;
    let microcycle = microcycleCache.get(cacheKey);
    if (!microcycle) {
      microcycle = resolveMicrocycleForSession(session?.id ?? null, session?.date ?? row.dateKey, microcycles);
      microcycleCache.set(cacheKey, microcycle);
    }

    const volumeUa = calculateVolumeUa(row.rpe, row.durationMinutes);
    const durationDeltaMinutes =
      row.durationMinutes !== null && sessionDurationMinutes !== null && sessionDurationMinutes > 0
        ? Math.round((row.durationMinutes - sessionDurationMinutes) * 10) / 10
        : null;

    return {
      rowId: row.rowId,
      dateKey: row.dateKey,
      sheetName: row.playerName,
      identity,
      playerId: identity.playerId,
      displayName: identity.displayName,
      position,
      group,
      rpe: row.rpe,
      durationMinutes: row.durationMinutes,
      volumeUa,
      reportedVolumeUa: row.reportedVolumeUa,
      matchesReportedVolume:
        row.reportedVolumeUa === null || volumeUa === null ? null : Math.abs(row.reportedVolumeUa - volumeUa) < 0.5,
      sessionId: session?.id ?? null,
      sessionLink,
      sessionDurationMinutes,
      durationDeltaMinutes,
      hasDurationDiscrepancy:
        durationDeltaMinutes !== null && Math.abs(durationDeltaMinutes) > DURATION_DISCREPANCY_TOLERANCE_MINUTES,
      microcycleId: microcycle.microcycleId,
      microcycleName: microcycle.microcycleName,
      microcycleLink: microcycle.link,
      hasValidLoad: volumeUa !== null
    } satisfies RpeEntry;
  });
}

function summarizeEntries(entries: RpeEntry[]): RpeGroupSummary {
  const rpeValues = entries.map((entry) => entry.rpe).filter((value): value is number => value !== null && value > 0);
  const loads = entries.map((entry) => entry.volumeUa).filter((value): value is number => value !== null);
  const players = new Set(entries.map((entry) => entry.playerId).filter((value): value is string => Boolean(value)));

  return {
    entryCount: entries.length,
    playerCount: players.size,
    averageRpe: rpeValues.length ? round1(rpeValues.reduce((sum, value) => sum + value, 0) / rpeValues.length) : null,
    totalLoadUa: round1(loads.reduce((sum, value) => sum + value, 0)),
    averageLoadUa: loads.length ? round1(loads.reduce((sum, value) => sum + value, 0) / loads.length) : null
  };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** GK and outfield averages are always kept apart; unmatched rows never pollute either group. */
export function buildRpeOverview(entries: RpeEntry[]): RpeOverview {
  return {
    all: summarizeEntries(entries),
    outfield: summarizeEntries(entries.filter((entry) => entry.group === 'outfield')),
    gk: summarizeEntries(entries.filter((entry) => entry.group === 'gk')),
    unassigned: summarizeEntries(entries.filter((entry) => entry.group === null))
  };
}

export function buildWeeklyLoad(entries: RpeEntry[]): RpeWeeklyLoad[] {
  const buckets = new Map<string, RpeEntry[]>();

  entries.forEach((entry) => {
    if (!isValidDateKey(entry.dateKey)) return;
    const weekKey = getIsoWeekKey(entry.dateKey);
    const bucket = buckets.get(weekKey);
    if (bucket) bucket.push(entry);
    else buckets.set(weekKey, [entry]);
  });

  return Array.from(buckets.entries())
    .map(([weekKey, weekEntries]) => {
      const weekStart = getIsoWeekStart(weekEntries[0].dateKey);
      const summary = summarizeEntries(weekEntries);
      return {
        weekKey,
        weekStart,
        weekEnd: addDaysToDateKey(weekStart, 6),
        totalLoadUa: summary.totalLoadUa,
        outfieldLoadUa: summarizeEntries(weekEntries.filter((entry) => entry.group === 'outfield')).totalLoadUa,
        gkLoadUa: summarizeEntries(weekEntries.filter((entry) => entry.group === 'gk')).totalLoadUa,
        entryCount: weekEntries.length,
        averageRpe: summary.averageRpe
      };
    })
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

export function buildMicrocycleLoad(entries: RpeEntry[]): RpeMicrocycleLoad[] {
  const buckets = new Map<string, RpeEntry[]>();

  entries.forEach((entry) => {
    const key = entry.microcycleId ?? '__unassigned__';
    const bucket = buckets.get(key);
    if (bucket) bucket.push(entry);
    else buckets.set(key, [entry]);
  });

  return Array.from(buckets.entries())
    .map(([key, groupEntries]) => {
      const summary = summarizeEntries(groupEntries);
      return {
        microcycleId: key === '__unassigned__' ? null : key,
        microcycleName: key === '__unassigned__' ? 'Not linked to a microcycle' : groupEntries[0].microcycleName || key,
        totalLoadUa: summary.totalLoadUa,
        outfieldLoadUa: summarizeEntries(groupEntries.filter((entry) => entry.group === 'outfield')).totalLoadUa,
        gkLoadUa: summarizeEntries(groupEntries.filter((entry) => entry.group === 'gk')).totalLoadUa,
        entryCount: groupEntries.length,
        averageRpe: summary.averageRpe,
        sessionDates: Array.from(new Set(groupEntries.map((entry) => entry.dateKey))).sort()
      };
    })
    .sort((a, b) => (a.sessionDates[0] || '').localeCompare(b.sessionDates[0] || ''));
}

/** Only squad-matched players build a leaderboard row; external/unresolved names are excluded. */
export function buildPlayerSummaries(entries: RpeEntry[]): RpePlayerSummary[] {
  const buckets = new Map<string, RpeEntry[]>();

  entries.forEach((entry) => {
    if (!entry.playerId) return;
    const bucket = buckets.get(entry.playerId);
    if (bucket) bucket.push(entry);
    else buckets.set(entry.playerId, [entry]);
  });

  return Array.from(buckets.entries())
    .map(([playerId, playerEntries]) => {
      const summary = summarizeEntries(playerEntries);
      const dates = playerEntries.map((entry) => entry.dateKey).filter(isValidDateKey).sort();
      return {
        playerId,
        displayName: playerEntries[0].displayName,
        group: playerEntries[0].group,
        entryCount: summary.entryCount,
        averageRpe: summary.averageRpe,
        totalLoadUa: summary.totalLoadUa,
        averageLoadUa: summary.averageLoadUa,
        firstDate: dates[0] ?? null,
        lastDate: dates[dates.length - 1] ?? null
      };
    })
    .sort((a, b) => b.totalLoadUa - a.totalLoadUa);
}

export function buildPlayerTimeline(entries: RpeEntry[], playerId: string): RpePlayerTimelinePoint[] {
  return entries
    .filter((entry) => entry.playerId === playerId)
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey))
    .map((entry) => ({
      dateKey: entry.dateKey,
      rpe: entry.rpe,
      loadUa: entry.volumeUa,
      durationMinutes: entry.durationMinutes,
      sessionId: entry.sessionId,
      microcycleName: entry.microcycleName
    }));
}

/**
 * Rolling-sum acute/chronic load. See the window definitions at the top of this file.
 * Returns an explicit status instead of a fabricated ratio when history is too short.
 */
export function calculateAcuteChronicLoad(entries: RpeEntry[], referenceDate: string): AcuteChronicLoad {
  const usable = entries.filter((entry) => entry.hasValidLoad && isValidDateKey(entry.dateKey));
  const acuteStart = addDaysToDateKey(referenceDate, -(ACUTE_WINDOW_DAYS - 1));
  const chronicStart = addDaysToDateKey(referenceDate, -(CHRONIC_WINDOW_DAYS - 1));

  const acuteEntries = usable.filter((entry) => entry.dateKey >= acuteStart && entry.dateKey <= referenceDate);
  const chronicEntries = usable.filter((entry) => entry.dateKey >= chronicStart && entry.dateKey <= referenceDate);

  const acuteLoadUa = round1(acuteEntries.reduce((sum, entry) => sum + (entry.volumeUa || 0), 0));
  const chronicLoadUa = round1(chronicEntries.reduce((sum, entry) => sum + (entry.volumeUa || 0), 0));
  const chronicWeeklyLoadUa = round1(chronicLoadUa / (CHRONIC_WINDOW_DAYS / ACUTE_WINDOW_DAYS));

  const historyDates = usable.map((entry) => entry.dateKey).filter((dateKey) => dateKey <= referenceDate).sort();
  const observedSpanDays = historyDates.length ? diffInDays(historyDates[0], referenceDate) + 1 : 0;

  let status: AcuteChronicStatus = 'ok';
  let acwr: number | null = null;

  if (observedSpanDays < CHRONIC_WINDOW_DAYS) {
    status = 'insufficient-history';
  } else if (chronicWeeklyLoadUa <= 0) {
    status = 'no-chronic-load';
  } else {
    acwr = Math.round((acuteLoadUa / chronicWeeklyLoadUa) * 100) / 100;
  }

  return {
    referenceDate,
    acuteWindowDays: ACUTE_WINDOW_DAYS,
    chronicWindowDays: CHRONIC_WINDOW_DAYS,
    acuteLoadUa,
    chronicLoadUa,
    chronicWeeklyLoadUa,
    acwr,
    status,
    acuteEntryCount: acuteEntries.length,
    chronicEntryCount: chronicEntries.length,
    observedSpanDays
  };
}

export interface BuildWellnessRpeAnalysisInput {
  entries: RpeEntry[];
  wellnessReadings: WellnessReadingInput[];
  squadPlayers: SquadPlayer[];
  identityMappings?: HistoricalNameMapping[];
}

/**
 * Joins Wellness and RPE strictly on (resolved squad player, calendar date).
 * Readings without a same-day RPE row (or vice versa) are counted, never invented.
 */
export function buildWellnessRpeAnalysis(input: BuildWellnessRpeAnalysisInput): WellnessRpeAnalysis {
  const { entries, wellnessReadings, squadPlayers, identityMappings = [] } = input;

  const wellnessIdentityIndex = buildRpeIdentityIndex(
    wellnessReadings.map((reading) => reading.playerName),
    squadPlayers,
    identityMappings
  );

  const wellnessByKey = new Map<string, WellnessReadingInput>();
  let unmatchedWellnessReadings = 0;

  wellnessReadings.forEach((reading) => {
    const identity = wellnessIdentityIndex.get(reading.playerName);
    if (!identity?.playerId || !isValidDateKey(reading.dateKey)) {
      unmatchedWellnessReadings += 1;
      return;
    }
    wellnessByKey.set(`${identity.playerId}|${reading.dateKey}`, reading);
  });

  const points: WellnessRpePoint[] = [];
  const matrix: Record<string, number> = {};
  let unmatchedRpeEntries = 0;

  entries.forEach((entry) => {
    if (!entry.playerId || entry.rpe === null || entry.rpe <= 0) return;
    const reading = wellnessByKey.get(`${entry.playerId}|${entry.dateKey}`);
    if (!reading) {
      unmatchedRpeEntries += 1;
      return;
    }

    const wellnessBand = getWellnessBand(reading.status);
    const rpeBand = getRpeBand(entry.rpe);
    points.push({
      playerId: entry.playerId,
      displayName: entry.displayName,
      dateKey: entry.dateKey,
      readiness: reading.readiness,
      wellnessBand,
      rpe: entry.rpe,
      rpeBand,
      loadUa: entry.volumeUa,
      group: entry.group
    });

    if (wellnessBand) {
      const key = `${wellnessBand}:${rpeBand}`;
      matrix[key] = (matrix[key] || 0) + 1;
    }
  });

  const matchedWellnessKeys = new Set(points.map((point) => `${point.playerId}|${point.dateKey}`));
  unmatchedWellnessReadings += Array.from(wellnessByKey.keys()).filter((key) => !matchedWellnessKeys.has(key)).length;

  return { points, matrix, unmatchedWellnessReadings, unmatchedRpeEntries };
}

export interface RpeIdentityDiagnostics {
  matched: RpeIdentity[];
  unresolved: RpeIdentity[];
  ambiguous: RpeIdentity[];
  external: RpeIdentity[];
}

export function buildIdentityDiagnostics(entries: RpeEntry[]): RpeIdentityDiagnostics {
  const seen = new Map<string, RpeIdentity>();
  entries.forEach((entry) => {
    if (!seen.has(entry.sheetName)) seen.set(entry.sheetName, entry.identity);
  });
  const identities = Array.from(seen.values());

  return {
    matched: identities.filter((identity) => identity.kind === 'matched'),
    unresolved: identities.filter((identity) => identity.kind === 'unresolved'),
    ambiguous: identities.filter((identity) => identity.kind === 'ambiguous'),
    external: identities.filter((identity) => identity.kind === 'external')
  };
}
