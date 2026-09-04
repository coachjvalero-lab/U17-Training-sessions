import test from 'node:test';
import assert from 'node:assert/strict';
import type { SquadPlayer } from '../types';
import { buildRpeEntries, buildWellnessRpeAnalysis } from './rpeAnalytics';
import type { RpeSheetRow } from './rpeSheetParsing';
import { buildRpeDetailedReport } from './rpeReport';

function player(id: string, firstName: string, lastName: string, position: SquadPlayer['position']): SquadPlayer {
  return { id, firstName, lastName, position, status: 'Active' } as SquadPlayer;
}

const SQUAD: SquadPlayer[] = [
  player('p1', 'Alba', 'Almutairi', 'CDM'),
  player('p2', 'Ranse', 'Alhejaili', 'GK')
];

function sheetRow(dateKey: string, playerName: string, rpe: number | null, durationMinutes: number | null): RpeSheetRow {
  return {
    rowId: `${dateKey}-${playerName}`,
    timestamp: `${dateKey} 20:00:00`,
    dateKey,
    playerName,
    rpe,
    durationMinutes,
    reportedVolumeUa: null
  };
}

const ROWS: RpeSheetRow[] = [
  sheetRow('2026-08-17', 'Alba Almutairi', 6, 90),
  sheetRow('2026-08-19', 'Alba Almutairi', 8, 60),
  sheetRow('2026-08-17', 'Ranse Alhejaili', 4, 60),
  sheetRow('2026-08-17', 'Linda', 9, 60)
];

function buildReport() {
  const entries = buildRpeEntries({ rows: ROWS, squadPlayers: SQUAD, sessions: [] });
  const wellness = buildWellnessRpeAnalysis({
    entries,
    squadPlayers: SQUAD,
    wellnessReadings: [{ playerName: 'Alba Almutairi', dateKey: '2026-08-17', readiness: 9, status: 'RED' }]
  });
  return buildRpeDetailedReport({ entries, wellness });
}

test('report period spans the first and last recorded date', () => {
  const report = buildReport();
  assert.equal(report.period.startDate, '2026-08-17');
  assert.equal(report.period.endDate, '2026-08-19');
  assert.equal(report.period.dateCount, 2);
  assert.equal(report.recordCount, 4);
});

test('report reuses the existing overview so GK and outfield stay separated', () => {
  const report = buildReport();
  assert.equal(report.overview.outfield.averageRpe, 7);
  assert.equal(report.overview.gk.averageRpe, 4);
  assert.equal(report.overview.all.totalLoadUa, 540 + 480 + 240 + 540);
  assert.equal(report.overview.unassigned.entryCount, 1);
});

test('report splits individual sections by group and excludes unmatched names', () => {
  const report = buildReport();
  assert.deepEqual(report.outfieldPlayers.map((entry) => entry.summary.playerId), ['p1']);
  assert.deepEqual(report.gkPlayers.map((entry) => entry.summary.playerId), ['p2']);
  assert.equal(report.outfieldPlayers[0].position, 'CDM');
  assert.equal(report.outfieldPlayers[0].timeline.length, 2);
  assert.equal(report.outfieldPlayers[0].weekly.length, 1);
  assert.equal(report.outfieldPlayers[0].summary.totalLoadUa, 1020);
});

test('report evolution has one point per session date with rolling acute values', () => {
  const report = buildReport();
  assert.deepEqual(report.evolution.map((point) => point.dateKey), ['2026-08-17', '2026-08-19']);
  assert.equal(report.evolution[0].loadUa, 540 + 240 + 540);
  assert.equal(report.evolution[1].acuteLoadUa, report.overview.all.totalLoadUa);
  assert.equal(report.evolution[1].acwr, null);
  assert.equal(report.evolution[1].acwrStatus, 'insufficient-history');
});

test('report data quality surfaces every diagnostic without hiding records', () => {
  const report = buildReport();
  assert.equal(report.dataQuality.totalRecords, 4);
  assert.equal(report.dataQuality.linkedToSession, 0);
  assert.equal(report.dataQuality.withoutSession, 4);
  assert.equal(report.dataQuality.unassignedRecords, 1);
  assert.equal(report.dataQuality.identity.matched.length, 2);
  assert.equal(report.dataQuality.identity.unresolved.length, 1);
  assert.equal(report.dataQuality.withoutWellnessMatch, 2);
});

test('report keeps the existing wellness analysis untouched', () => {
  const report = buildReport();
  assert.equal(report.wellness.points.length, 1);
  assert.equal(report.wellness.matrix['red:moderate'], 1);
});

test('report degrades safely when there are no records', () => {
  const report = buildRpeDetailedReport({
    entries: [],
    wellness: { points: [], matrix: {}, unmatchedWellnessReadings: 0, unmatchedRpeEntries: 0 }
  });
  assert.equal(report.period.startDate, null);
  assert.equal(report.acuteChronic, null);
  assert.deepEqual(report.evolution, []);
  assert.deepEqual(report.outfieldPlayers, []);
  assert.deepEqual(report.gkPlayers, []);
});
