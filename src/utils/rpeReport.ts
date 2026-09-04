import {
  buildIdentityDiagnostics,
  buildMicrocycleLoad,
  buildPlayerSummaries,
  buildPlayerTimeline,
  buildRpeOverview,
  buildWeeklyLoad,
  calculateAcuteChronicLoad,
  isValidDateKey,
  type AcuteChronicLoad,
  type RpeEntry,
  type RpeIdentityDiagnostics,
  type RpeMicrocycleLoad,
  type RpeOverview,
  type RpePlayerSummary,
  type RpePlayerTimelinePoint,
  type RpeWeeklyLoad,
  type WellnessRpeAnalysis
} from './rpeAnalytics';

/**
 * Report aggregation only: every number below comes from the existing RPE analytics
 * functions applied to the entries already loaded by the RPE view. No new formula here.
 */

export interface RpeReportPeriod {
  startDate: string | null;
  endDate: string | null;
  dateCount: number;
}

export interface RpeEvolutionPoint {
  dateKey: string;
  averageRpe: number | null;
  loadUa: number;
  acuteLoadUa: number;
  chronicWeeklyLoadUa: number;
  acwr: number | null;
  acwrStatus: AcuteChronicLoad['status'];
}

export interface RpePlayerReport {
  summary: RpePlayerSummary;
  position: string | null;
  timeline: RpePlayerTimelinePoint[];
  weekly: RpeWeeklyLoad[];
  microcycles: RpeMicrocycleLoad[];
  acuteChronic: AcuteChronicLoad | null;
}

export interface RpeReportDataQuality {
  totalRecords: number;
  linkedToSession: number;
  withoutSession: number;
  multipleSessionCandidates: number;
  withoutValidLoad: number;
  durationDiscrepancies: number;
  volumeMismatches: number;
  withoutWellnessMatch: number;
  identity: RpeIdentityDiagnostics;
  unassignedRecords: number;
}

export interface RpeDetailedReport {
  period: RpeReportPeriod;
  recordCount: number;
  linkedSessionCount: number;
  overview: RpeOverview;
  weekly: RpeWeeklyLoad[];
  microcycles: RpeMicrocycleLoad[];
  acuteChronic: { all: AcuteChronicLoad; outfield: AcuteChronicLoad; gk: AcuteChronicLoad } | null;
  evolution: RpeEvolutionPoint[];
  outfieldPlayers: RpePlayerReport[];
  gkPlayers: RpePlayerReport[];
  wellness: WellnessRpeAnalysis;
  dataQuality: RpeReportDataQuality;
}

export interface BuildRpeDetailedReportInput {
  entries: RpeEntry[];
  wellness: WellnessRpeAnalysis;
}

function buildPlayerReport(entries: RpeEntry[], summary: RpePlayerSummary, referenceDate: string | null): RpePlayerReport {
  const playerEntries = entries.filter((entry) => entry.playerId === summary.playerId);
  return {
    summary,
    position: playerEntries[0]?.position ?? null,
    timeline: buildPlayerTimeline(entries, summary.playerId),
    weekly: buildWeeklyLoad(playerEntries),
    microcycles: buildMicrocycleLoad(playerEntries),
    acuteChronic: referenceDate ? calculateAcuteChronicLoad(playerEntries, referenceDate) : null
  };
}

export function buildRpeDetailedReport(input: BuildRpeDetailedReportInput): RpeDetailedReport {
  const { entries, wellness } = input;

  const dates = Array.from(new Set(entries.map((entry) => entry.dateKey).filter(isValidDateKey))).sort();
  const referenceDate = dates.length ? dates[dates.length - 1] : null;

  const outfieldEntries = entries.filter((entry) => entry.group === 'outfield');
  const gkEntries = entries.filter((entry) => entry.group === 'gk');

  const evolution: RpeEvolutionPoint[] = dates.map((dateKey) => {
    const dayEntries = entries.filter((entry) => entry.dateKey === dateKey);
    const daySummary = buildRpeOverview(dayEntries).all;
    const rolling = calculateAcuteChronicLoad(entries, dateKey);
    return {
      dateKey,
      averageRpe: daySummary.averageRpe,
      loadUa: daySummary.totalLoadUa,
      acuteLoadUa: rolling.acuteLoadUa,
      chronicWeeklyLoadUa: rolling.chronicWeeklyLoadUa,
      acwr: rolling.acwr,
      acwrStatus: rolling.status
    };
  });

  const summaries = buildPlayerSummaries(entries);

  return {
    period: {
      startDate: dates[0] ?? null,
      endDate: referenceDate,
      dateCount: dates.length
    },
    recordCount: entries.length,
    linkedSessionCount: new Set(
      entries.map((entry) => entry.sessionId).filter((value): value is string => Boolean(value))
    ).size,
    overview: buildRpeOverview(entries),
    weekly: buildWeeklyLoad(entries),
    microcycles: buildMicrocycleLoad(entries),
    acuteChronic: referenceDate
      ? {
          all: calculateAcuteChronicLoad(entries, referenceDate),
          outfield: calculateAcuteChronicLoad(outfieldEntries, referenceDate),
          gk: calculateAcuteChronicLoad(gkEntries, referenceDate)
        }
      : null,
    evolution,
    outfieldPlayers: summaries
      .filter((summary) => summary.group === 'outfield')
      .map((summary) => buildPlayerReport(entries, summary, referenceDate)),
    gkPlayers: summaries
      .filter((summary) => summary.group === 'gk')
      .map((summary) => buildPlayerReport(entries, summary, referenceDate)),
    wellness,
    dataQuality: {
      totalRecords: entries.length,
      linkedToSession: entries.filter((entry) => entry.sessionLink === 'linked').length,
      withoutSession: entries.filter((entry) => entry.sessionLink === 'no-session').length,
      multipleSessionCandidates: entries.filter((entry) => entry.sessionLink === 'multiple-sessions').length,
      withoutValidLoad: entries.filter((entry) => !entry.hasValidLoad).length,
      durationDiscrepancies: entries.filter((entry) => entry.hasDurationDiscrepancy).length,
      volumeMismatches: entries.filter((entry) => entry.matchesReportedVolume === false).length,
      withoutWellnessMatch: wellness.unmatchedRpeEntries,
      identity: buildIdentityDiagnostics(entries),
      unassignedRecords: entries.filter((entry) => entry.group === null).length
    }
  };
}
