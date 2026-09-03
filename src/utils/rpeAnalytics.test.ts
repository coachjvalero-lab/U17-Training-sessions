import test from 'node:test';
import assert from 'node:assert/strict';
import type { Microcycle, SquadPlayer, TrainingSession } from '../types';
import type { HistoricalNameMapping } from './attendanceIdentity';
import type { RpeSheetRow } from './rpeSheetParsing';
import { parseRpeSheetRows } from './rpeSheetParsing';
import { resolveRpePlayerIdentity } from './rpeIdentity';
import {
  buildIdentityDiagnostics,
  buildMicrocycleLoad,
  buildPlayerSummaries,
  buildPlayerTimeline,
  buildRpeEntries,
  buildRpeOverview,
  buildWeeklyLoad,
  buildWellnessRpeAnalysis,
  calculateAcuteChronicLoad,
  calculateVolumeUa,
  getIsoWeekKey,
  resolveMicrocycleForSession
} from './rpeAnalytics';

function player(id: string, firstName: string, lastName: string, position: SquadPlayer['position']): SquadPlayer {
  return { id, firstName, lastName, position, status: 'Active' } as SquadPlayer;
}

const SQUAD: SquadPlayer[] = [
  player('p1', 'Alba', 'Almutairi', 'CDM'),
  player('p2', 'Lara', 'Bakheet', 'CB'),
  player('p3', 'Ranse', 'Alhejaili', 'GK'),
  player('p4', 'Rema', 'Aljoaid', 'GK')
];

function sheetRow(overrides: Partial<RpeSheetRow> & { dateKey: string; playerName: string }): RpeSheetRow {
  return {
    rowId: `${overrides.dateKey}-${overrides.playerName}`,
    timestamp: `${overrides.dateKey} 20:00:00`,
    rpe: 6,
    durationMinutes: 90,
    reportedVolumeUa: null,
    ...overrides
  };
}

function session(id: string, date: string, exerciseDurations: string[]): TrainingSession {
  const block = (blockId: string) => ({
    id: blockId,
    title: blockId,
    exercises: exerciseDurations.map((duration, index) => ({
      id: `${blockId}-${index}`,
      name: '',
      gameMoment: '-' as const,
      subMoment: '',
      description: '',
      duration,
      dimensions: '',
      coachRoles: ''
    }))
  });

  return {
    id,
    teamName: 'U17',
    date,
    time: '',
    sessionNumber: '1',
    microcycleDay: '',
    mainObjective: '',
    warmUp: block('warmUp'),
    mainPart: { id: 'mainPart', title: 'mainPart', exercises: [] },
    coolDown: { id: 'coolDown', title: 'coolDown', exercises: [] },
    playerGroups: [],
    materialsNeeded: ''
  };
}

/* ------------------------------- Volume ------------------------------- */

test('Volume (UA) is RPE x Duration', () => {
  assert.equal(calculateVolumeUa(6, 90), 540);
  assert.equal(calculateVolumeUa(5, 90), 450);
});

test('Volume (UA) is null when RPE or Duration is missing or non-positive', () => {
  assert.equal(calculateVolumeUa(null, 90), null);
  assert.equal(calculateVolumeUa(6, null), null);
  assert.equal(calculateVolumeUa(0, 90), null);
  assert.equal(calculateVolumeUa(6, 0), null);
});

/* ------------------------------ Identity ------------------------------ */

test('identity matches only on an exact normalized full name', () => {
  const matched = resolveRpePlayerIdentity('Alba Almutairi', SQUAD);
  assert.equal(matched.kind, 'matched');
  assert.equal(matched.playerId, 'p1');
});

test('identity never falls back to first-name or partial matching', () => {
  const firstNameOnly = resolveRpePlayerIdentity('Alba', SQUAD);
  assert.equal(firstNameOnly.kind, 'unresolved');
  assert.equal(firstNameOnly.playerId, null);
  assert.equal(firstNameOnly.sheetName, 'Alba');

  const misspelled = resolveRpePlayerIdentity('Alba Almutari', SQUAD);
  assert.equal(misspelled.kind, 'unresolved');
});

test('identity reports AMBIGUOUS when two squad players share a normalized name', () => {
  const duplicates = [...SQUAD, player('p5', 'Alba', 'Almutairi', 'CM')];
  const ambiguous = resolveRpePlayerIdentity('Alba Almutairi', duplicates);
  assert.equal(ambiguous.kind, 'ambiguous');
  assert.equal(ambiguous.playerId, null);
  assert.equal(ambiguous.candidates?.length, 2);
});

test('identity honours a confirmed EXTERNAL mapping', () => {
  const mappings: HistoricalNameMapping[] = [
    {
      historicalName: 'Trialist Nine',
      normalizedHistoricalName: 'trialist nine',
      classification: 'external',
      createdAt: 0,
      updatedAt: 0
    }
  ];
  const external = resolveRpePlayerIdentity('Trialist Nine', SQUAD, mappings);
  assert.equal(external.kind, 'external');
  assert.equal(external.playerId, null);
  assert.equal(external.displayName, 'Trialist Nine');
});

test('UNRESOLVED, AMBIGUOUS and EXTERNAL rows keep their data and stay out of the squad leaderboard', () => {
  const mappings: HistoricalNameMapping[] = [
    {
      historicalName: 'Trialist Nine',
      normalizedHistoricalName: 'trialist nine',
      classification: 'external',
      createdAt: 0,
      updatedAt: 0
    }
  ];
  const entries = buildRpeEntries({
    rows: [
      sheetRow({ dateKey: '2026-08-17', playerName: 'Alba Almutairi' }),
      sheetRow({ dateKey: '2026-08-17', playerName: 'Linda', rpe: 8, durationMinutes: 60 }),
      sheetRow({ dateKey: '2026-08-17', playerName: 'Trialist Nine', rpe: 7, durationMinutes: 60 })
    ],
    squadPlayers: SQUAD,
    sessions: [],
    identityMappings: mappings
  });

  assert.equal(entries.length, 3);
  const unresolved = entries.find((entry) => entry.sheetName === 'Linda');
  assert.equal(unresolved?.identity.kind, 'unresolved');
  assert.equal(unresolved?.rpe, 8);
  assert.equal(unresolved?.volumeUa, 480);
  assert.equal(unresolved?.group, null);

  const external = entries.find((entry) => entry.sheetName === 'Trialist Nine');
  assert.equal(external?.identity.kind, 'external');
  assert.equal(external?.volumeUa, 420);

  const leaderboard = buildPlayerSummaries(entries);
  assert.deepEqual(leaderboard.map((row) => row.playerId), ['p1']);

  const diagnostics = buildIdentityDiagnostics(entries);
  assert.equal(diagnostics.matched.length, 1);
  assert.equal(diagnostics.unresolved.length, 1);
  assert.equal(diagnostics.external.length, 1);
});

/* --------------------------- GK vs Outfield --------------------------- */

test('average RPE is reported separately for outfield players and goalkeepers', () => {
  const entries = buildRpeEntries({
    rows: [
      sheetRow({ dateKey: '2026-08-17', playerName: 'Alba Almutairi', rpe: 6, durationMinutes: 90 }),
      sheetRow({ dateKey: '2026-08-17', playerName: 'Lara Bakheet', rpe: 8, durationMinutes: 90 }),
      sheetRow({ dateKey: '2026-08-17', playerName: 'Ranse Alhejaili', rpe: 4, durationMinutes: 60 }),
      sheetRow({ dateKey: '2026-08-17', playerName: 'Rema Aljoaid', rpe: 2, durationMinutes: 60 }),
      sheetRow({ dateKey: '2026-08-17', playerName: 'Linda', rpe: 10, durationMinutes: 60 })
    ],
    squadPlayers: SQUAD,
    sessions: []
  });

  const overview = buildRpeOverview(entries);
  assert.equal(overview.outfield.averageRpe, 7);
  assert.equal(overview.gk.averageRpe, 3);
  assert.equal(overview.outfield.totalLoadUa, 540 + 720);
  assert.equal(overview.gk.totalLoadUa, 240 + 120);
  assert.equal(overview.unassigned.entryCount, 1);
  assert.equal(overview.unassigned.playerCount, 0);
});

/* ---------------------------- Weekly load ----------------------------- */

test('ISO week keys group Monday to Sunday', () => {
  assert.equal(getIsoWeekKey('2026-08-17'), getIsoWeekKey('2026-08-23'));
  assert.notEqual(getIsoWeekKey('2026-08-23'), getIsoWeekKey('2026-08-24'));
});

test('weekly load splits total, outfield and GK', () => {
  const entries = buildRpeEntries({
    rows: [
      sheetRow({ dateKey: '2026-08-17', playerName: 'Alba Almutairi', rpe: 6, durationMinutes: 90 }),
      sheetRow({ dateKey: '2026-08-19', playerName: 'Ranse Alhejaili', rpe: 5, durationMinutes: 60 }),
      sheetRow({ dateKey: '2026-08-25', playerName: 'Alba Almutairi', rpe: 7, durationMinutes: 60 })
    ],
    squadPlayers: SQUAD,
    sessions: []
  });

  const weeks = buildWeeklyLoad(entries);
  assert.equal(weeks.length, 2);
  assert.equal(weeks[0].weekStart, '2026-08-17');
  assert.equal(weeks[0].weekEnd, '2026-08-23');
  assert.equal(weeks[0].totalLoadUa, 540 + 300);
  assert.equal(weeks[0].outfieldLoadUa, 540);
  assert.equal(weeks[0].gkLoadUa, 300);
  assert.equal(weeks[1].totalLoadUa, 420);
});

/* -------------------------- Microcycle load --------------------------- */

const MICROCYCLES: Microcycle[] = [
  {
    id: 'mc1',
    teamId: 't1',
    teamName: 'U17',
    name: 'Pre-Season 4',
    startDate: '2026-08-16',
    endDate: '2026-08-22',
    status: 'archived',
    days: [
      { id: 'd1', microcycleId: 'mc1', dayOrder: 1, dayDate: '2026-08-17', sessionId: 's1', concepts: [] }
    ]
  },
  {
    id: 'mc2',
    teamId: 't1',
    teamName: 'U17',
    name: 'Pre-Season 5',
    startDate: '2026-08-23',
    endDate: '2026-08-29',
    status: 'active',
    days: []
  }
] as unknown as Microcycle[];

test('session to microcycle uses the explicit day link before any date fallback', () => {
  const explicit = resolveMicrocycleForSession('s1', '2026-08-17', MICROCYCLES);
  assert.equal(explicit.microcycleId, 'mc1');
  assert.equal(explicit.link, 'explicit');
});

test('session to microcycle falls back to the containing date range only when no link exists', () => {
  const byDate = resolveMicrocycleForSession('s9', '2026-08-25', MICROCYCLES);
  assert.equal(byDate.microcycleId, 'mc2');
  assert.equal(byDate.link, 'date-range');

  const none = resolveMicrocycleForSession(null, '2026-10-01', MICROCYCLES);
  assert.equal(none.microcycleId, null);
  assert.equal(none.link, 'none');
});

test('microcycle load accumulates through the training session link', () => {
  const entries = buildRpeEntries({
    rows: [
      sheetRow({ dateKey: '2026-08-17', playerName: 'Alba Almutairi', rpe: 6, durationMinutes: 90 }),
      sheetRow({ dateKey: '2026-08-17', playerName: 'Ranse Alhejaili', rpe: 5, durationMinutes: 60 }),
      sheetRow({ dateKey: '2026-08-25', playerName: 'Alba Almutairi', rpe: 7, durationMinutes: 60 })
    ],
    squadPlayers: SQUAD,
    sessions: [session('s1', '2026-08-17', ['90 min']), session('s2', '2026-08-25', ['60 min'])],
    microcycles: MICROCYCLES
  });

  assert.equal(entries[0].microcycleLink, 'explicit');
  assert.equal(entries[2].microcycleLink, 'date-range');

  const loads = buildMicrocycleLoad(entries);
  assert.equal(loads.length, 2);
  assert.equal(loads[0].microcycleName, 'Pre-Season 4');
  assert.equal(loads[0].totalLoadUa, 540 + 300);
  assert.equal(loads[0].gkLoadUa, 300);
  assert.equal(loads[1].microcycleName, 'Pre-Season 5');
  assert.equal(loads[1].totalLoadUa, 420);
});

/* --------------------- Training session relationship ------------------- */

test('RPE rows link to the same-day training session and expose its calculated duration', () => {
  const entries = buildRpeEntries({
    rows: [
      sheetRow({ dateKey: '2026-08-17', playerName: 'Alba Almutairi', durationMinutes: 90 }),
      sheetRow({ dateKey: '2026-08-18', playerName: 'Alba Almutairi', durationMinutes: 90 })
    ],
    squadPlayers: SQUAD,
    sessions: [session('s1', '2026-08-17', ['30 min', '25 min', '25 min'])]
  });

  assert.equal(entries[0].sessionId, 's1');
  assert.equal(entries[0].sessionLink, 'linked');
  assert.equal(entries[0].sessionDurationMinutes, 80);
  assert.equal(entries[0].durationDeltaMinutes, 10);
  assert.equal(entries[0].hasDurationDiscrepancy, false);

  assert.equal(entries[1].sessionId, null);
  assert.equal(entries[1].sessionLink, 'no-session');
  assert.equal(entries[1].sessionDurationMinutes, null);
  assert.equal(entries[1].durationDeltaMinutes, null);
});

test('a large gap between sheet Duration and session duration is flagged', () => {
  const entries = buildRpeEntries({
    rows: [sheetRow({ dateKey: '2026-08-17', playerName: 'Alba Almutairi', durationMinutes: 120 })],
    squadPlayers: SQUAD,
    sessions: [session('s1', '2026-08-17', ['30 min', '30 min'])]
  });

  assert.equal(entries[0].sessionDurationMinutes, 60);
  assert.equal(entries[0].durationDeltaMinutes, 60);
  assert.equal(entries[0].hasDurationDiscrepancy, true);
});

test('a reported Volume (UA) that disagrees with RPE x Duration is flagged', () => {
  const entries = buildRpeEntries({
    rows: [
      sheetRow({ dateKey: '2026-08-17', playerName: 'Alba Almutairi', rpe: 6, durationMinutes: 90, reportedVolumeUa: 540 }),
      sheetRow({ dateKey: '2026-08-18', playerName: 'Alba Almutairi', rpe: 6, durationMinutes: 90, reportedVolumeUa: 500 })
    ],
    squadPlayers: SQUAD,
    sessions: []
  });

  assert.equal(entries[0].matchesReportedVolume, true);
  assert.equal(entries[1].matchesReportedVolume, false);
});

/* ------------------------ Individual evolution ------------------------ */

test('individual evolution returns a chronological per-session series', () => {
  const entries = buildRpeEntries({
    rows: [
      sheetRow({ dateKey: '2026-08-19', playerName: 'Alba Almutairi', rpe: 7, durationMinutes: 60 }),
      sheetRow({ dateKey: '2026-08-17', playerName: 'Alba Almutairi', rpe: 6, durationMinutes: 90 }),
      sheetRow({ dateKey: '2026-08-17', playerName: 'Lara Bakheet', rpe: 3, durationMinutes: 90 })
    ],
    squadPlayers: SQUAD,
    sessions: []
  });

  const timeline = buildPlayerTimeline(entries, 'p1');
  assert.deepEqual(timeline.map((point) => point.dateKey), ['2026-08-17', '2026-08-19']);
  assert.deepEqual(timeline.map((point) => point.loadUa), [540, 420]);

  const summary = buildPlayerSummaries(entries).find((row) => row.playerId === 'p1');
  assert.equal(summary?.entryCount, 2);
  assert.equal(summary?.averageRpe, 6.5);
  assert.equal(summary?.totalLoadUa, 960);
  assert.equal(summary?.firstDate, '2026-08-17');
  assert.equal(summary?.lastDate, '2026-08-19');
});

/* --------------------------- Acute / chronic --------------------------- */

function loadEntries(entriesSpec: Array<{ date: string; rpe: number; duration: number }>): ReturnType<typeof buildRpeEntries> {
  return buildRpeEntries({
    rows: entriesSpec.map((spec) =>
      sheetRow({ dateKey: spec.date, playerName: 'Alba Almutairi', rpe: spec.rpe, durationMinutes: spec.duration })
    ),
    squadPlayers: SQUAD,
    sessions: []
  });
}

test('acute load sums the 7 days ending on the reference date', () => {
  const entries = loadEntries([
    { date: '2026-08-01', rpe: 5, duration: 100 },
    { date: '2026-08-20', rpe: 5, duration: 100 },
    { date: '2026-08-26', rpe: 6, duration: 100 },
    { date: '2026-08-28', rpe: 7, duration: 100 }
  ]);

  const result = calculateAcuteChronicLoad(entries, '2026-08-28');
  assert.equal(result.acuteWindowDays, 7);
  assert.equal(result.acuteLoadUa, 600 + 700);
  assert.equal(result.acuteEntryCount, 2);
});

test('chronic load sums 28 days and is expressed as a weekly equivalent', () => {
  const entries = loadEntries([
    { date: '2026-08-01', rpe: 5, duration: 100 },
    { date: '2026-08-10', rpe: 5, duration: 100 },
    { date: '2026-08-20', rpe: 5, duration: 100 },
    { date: '2026-08-28', rpe: 5, duration: 100 }
  ]);

  const result = calculateAcuteChronicLoad(entries, '2026-08-28');
  assert.equal(result.chronicWindowDays, 28);
  assert.equal(result.chronicLoadUa, 2000);
  assert.equal(result.chronicWeeklyLoadUa, 500);
  assert.equal(result.acuteLoadUa, 500);
  assert.equal(result.status, 'ok');
  assert.equal(result.acwr, 1);
});

test('days without training are not counted as zero-load sessions', () => {
  const dense = loadEntries([
    { date: '2026-08-01', rpe: 5, duration: 100 },
    { date: '2026-08-22', rpe: 5, duration: 100 },
    { date: '2026-08-23', rpe: 5, duration: 100 },
    { date: '2026-08-28', rpe: 5, duration: 100 }
  ]);
  const result = calculateAcuteChronicLoad(dense, '2026-08-28');
  assert.equal(result.chronicEntryCount, 4);
  assert.equal(result.chronicLoadUa, 2000);
  assert.equal(result.acuteLoadUa, 1500);
  assert.equal(result.acwr, 3);
});

test('chronic load reports insufficient history instead of inventing a ratio', () => {
  const entries = loadEntries([
    { date: '2026-08-26', rpe: 6, duration: 90 },
    { date: '2026-08-28', rpe: 7, duration: 90 }
  ]);

  const result = calculateAcuteChronicLoad(entries, '2026-08-28');
  assert.equal(result.status, 'insufficient-history');
  assert.equal(result.acwr, null);
  assert.equal(result.observedSpanDays, 3);
  assert.ok(result.acuteLoadUa > 0);
});

test('chronic load reports no chronic load when the 28 day window is empty', () => {
  const entries = loadEntries([{ date: '2026-06-01', rpe: 6, duration: 90 }]);
  const result = calculateAcuteChronicLoad(entries, '2026-08-28');
  assert.equal(result.status, 'no-chronic-load');
  assert.equal(result.acwr, null);
  assert.equal(result.chronicLoadUa, 0);
});

test('rows with an invalid RPE or Duration never contribute to acute or chronic load', () => {
  const entries = buildRpeEntries({
    rows: [
      sheetRow({ dateKey: '2026-08-28', playerName: 'Alba Almutairi', rpe: null, durationMinutes: 90 }),
      sheetRow({ dateKey: '2026-08-28', playerName: 'Alba Almutairi', rpe: 6, durationMinutes: null })
    ],
    squadPlayers: SQUAD,
    sessions: []
  });

  const result = calculateAcuteChronicLoad(entries, '2026-08-28');
  assert.equal(result.acuteLoadUa, 0);
  assert.equal(result.acuteEntryCount, 0);
  assert.equal(result.observedSpanDays, 0);
});

/* --------------------------- Wellness x RPE ---------------------------- */

test('wellness and RPE join only on the same resolved player and the same date', () => {
  const entries = buildRpeEntries({
    rows: [
      sheetRow({ dateKey: '2026-08-17', playerName: 'Alba Almutairi', rpe: 8, durationMinutes: 90 }),
      sheetRow({ dateKey: '2026-08-18', playerName: 'Alba Almutairi', rpe: 3, durationMinutes: 60 }),
      sheetRow({ dateKey: '2026-08-17', playerName: 'Linda', rpe: 9, durationMinutes: 90 })
    ],
    squadPlayers: SQUAD,
    sessions: []
  });

  const analysis = buildWellnessRpeAnalysis({
    entries,
    squadPlayers: SQUAD,
    wellnessReadings: [
      { playerName: 'Alba Almutairi', dateKey: '2026-08-17', readiness: 9, status: 'RED' },
      { playerName: 'Alba Almutairi', dateKey: '2026-08-19', readiness: 18, status: 'GREEN' },
      { playerName: 'Linda', dateKey: '2026-08-17', readiness: 18, status: 'GREEN' }
    ]
  });

  assert.equal(analysis.points.length, 1);
  assert.equal(analysis.points[0].playerId, 'p1');
  assert.equal(analysis.points[0].dateKey, '2026-08-17');
  assert.equal(analysis.points[0].wellnessBand, 'red');
  assert.equal(analysis.points[0].rpeBand, 'high');
  assert.equal(analysis.points[0].loadUa, 720);
  assert.equal(analysis.matrix['red:high'], 1);
  assert.equal(analysis.unmatchedRpeEntries, 1);
});

test('wellness quadrants cover the four low/high combinations', () => {
  const entries = buildRpeEntries({
    rows: [
      sheetRow({ dateKey: '2026-08-17', playerName: 'Alba Almutairi', rpe: 9, durationMinutes: 60 }),
      sheetRow({ dateKey: '2026-08-18', playerName: 'Alba Almutairi', rpe: 2, durationMinutes: 60 }),
      sheetRow({ dateKey: '2026-08-17', playerName: 'Lara Bakheet', rpe: 8, durationMinutes: 60 }),
      sheetRow({ dateKey: '2026-08-18', playerName: 'Lara Bakheet', rpe: 3, durationMinutes: 60 })
    ],
    squadPlayers: SQUAD,
    sessions: []
  });

  const analysis = buildWellnessRpeAnalysis({
    entries,
    squadPlayers: SQUAD,
    wellnessReadings: [
      { playerName: 'Alba Almutairi', dateKey: '2026-08-17', readiness: 8, status: 'RED' },
      { playerName: 'Alba Almutairi', dateKey: '2026-08-18', readiness: 8, status: 'RED' },
      { playerName: 'Lara Bakheet', dateKey: '2026-08-17', readiness: 19, status: 'GREEN' },
      { playerName: 'Lara Bakheet', dateKey: '2026-08-18', readiness: 19, status: 'GREEN' }
    ]
  });

  assert.equal(analysis.matrix['red:high'], 1);
  assert.equal(analysis.matrix['red:low'], 1);
  assert.equal(analysis.matrix['green:high'], 1);
  assert.equal(analysis.matrix['green:low'], 1);
});

/* ------------------------------ Sheet parse ---------------------------- */

test('the RPE sheet parser maps the documented columns and keeps unmatched names', () => {
  const rows = parseRpeSheetRows([
    ['Timestamp', 'Date', 'Player', 'RPE', 'Duration', 'Volume (UA)', 'Microciclo', 'MD'],
    ['8/16/2026 21:14:54', '2026-08-16', 'Ranse Alhejaili', '6', '90', '540', '4', 'MD-5'],
    ['8/16/2026 21:14:54', '2026-08-16', 'Linda', '', '90', '', '4', 'MD-5'],
    ['', '', '', '', '', '', '', '']
  ]);

  assert.equal(rows.length, 2);
  assert.equal(rows[0].dateKey, '2026-08-16');
  assert.equal(rows[0].playerName, 'Ranse Alhejaili');
  assert.equal(rows[0].rpe, 6);
  assert.equal(rows[0].durationMinutes, 90);
  assert.equal(rows[0].reportedVolumeUa, 540);
  assert.equal(rows[1].playerName, 'Linda');
  assert.equal(rows[1].rpe, null);
});
