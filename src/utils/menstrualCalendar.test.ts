import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMenstrualCalendarModel,
  buildMonthDays,
  shiftMonthKey,
  type MenstrualCalendarSnapshot,
  type MenstrualWellnessRow
} from './menstrualCalendar';
import type { Injury, PhysioComplaint } from '../types';

function row(overrides: Partial<MenstrualWellnessRow>): MenstrualWellnessRow {
  return {
    rowId: overrides.rowId || `row-${Math.random()}`,
    playerName: overrides.playerName || 'Alba Almutairi',
    dateKey: overrides.dateKey || '2026-02-03',
    timestamp: overrides.timestamp || '2026-02-03 08:00:00',
    menstrualCycle: overrides.menstrualCycle || '',
    dayOfPeriod: overrides.dayOfPeriod || '',
    cyclePhase: overrides.cyclePhase || ''
  };
}

function snapshot(rows: MenstrualWellnessRow[] = []): MenstrualCalendarSnapshot {
  return {
    rows,
    resolutions: [
      { playerName: 'Alba Almutairi', playerId: 'p-alba', status: 'matched', resolvedLabel: 'Alba Almutairi' },
      { playerName: 'Shaden', playerId: null, status: 'unresolved' },
      { playerName: 'Sara Alreahili', playerId: null, status: 'ambiguous', options: [{ playerId: 'p-sara-1', label: 'Sara Alreahili' }] }
    ]
  };
}

function injury(overrides: Partial<Injury> = {}): Injury {
  return {
    id: overrides.id || 'injury-1',
    teamId: overrides.teamId || 'u17-women-alula',
    playerId: overrides.playerId || 'p-alba',
    injuryDate: overrides.injuryDate || '2026-02-03',
    context: overrides.context || 'training',
    trainingSessionId: overrides.trainingSessionId ?? null,
    matchId: overrides.matchId ?? null,
    location: overrides.location || 'right_knee',
    affectedSide: overrides.affectedSide || 'right',
    injuryType: overrides.injuryType || 'muscle',
    clinicalDiagnosis: overrides.clinicalDiagnosis ?? 'Hamstring overload',
    medicalDiagnosis: overrides.medicalDiagnosis ?? null,
    imagingDiagnosis: overrides.imagingDiagnosis ?? null,
    finalDiagnosis: overrides.finalDiagnosis ?? null,
    diagnosisStatus: overrides.diagnosisStatus || 'clinical',
    injuryGrade: overrides.injuryGrade ?? null,
    previousSimilarInjury: overrides.previousSimilarInjury ?? false,
    occurrenceType: overrides.occurrenceType || 'first_occurrence',
    contactWith: overrides.contactWith || 'not_applicable',
    activities: overrides.activities || [],
    popSensation: overrides.popSensation ?? false,
    swelling: overrides.swelling ?? false,
    instability: overrides.instability ?? false,
    lossOfStrength: overrides.lossOfStrength ?? false,
    reducedRangeOfMotion: overrides.reducedRangeOfMotion ?? false,
    currentStatus: overrides.currentStatus || 'open'
  };
}

function complaint(overrides: Partial<PhysioComplaint> = {}): PhysioComplaint {
  return {
    id: overrides.id || 'complaint-1',
    teamId: overrides.teamId || 'u17-women-alula',
    playerId: overrides.playerId || 'p-alba',
    occurrenceDate: overrides.occurrenceDate || '2026-02-03',
    context: overrides.context || 'training',
    trainingSessionId: overrides.trainingSessionId ?? null,
    matchId: overrides.matchId ?? null,
    complaintType: overrides.complaintType || 'pain',
    location: overrides.location || 'left_ankle',
    affectedSide: overrides.affectedSide || 'left',
    leftActivity: overrides.leftActivity ?? false,
    durationBand: overrides.durationBand || 'less_than_24h',
    outcome: overrides.outcome || 'ongoing',
    resultingInjuryId: overrides.resultingInjuryId ?? null,
    notes: overrides.notes || ''
  };
}

test('includes a matched player with menstrual data in the calendar', () => {
  const model = buildMenstrualCalendarModel(snapshot([
    row({ playerName: 'Alba Almutairi', dateKey: '2026-02-03', menstrualCycle: 'Yes', dayOfPeriod: '2', cyclePhase: 'Follicular' })
  ]), '2026-02');

  assert.equal(model.players.length, 1);
  assert.equal(model.players[0].playerId, 'p-alba');
  assert.equal(model.players[0].status, 'matched');
  assert.equal(model.players[0].cells[2].hasMenstrualInformation, true);
});

test('keeps unresolved players visible in the same calendar', () => {
  const model = buildMenstrualCalendarModel(snapshot([
    row({ playerName: 'Shaden', dateKey: '2026-02-04', menstrualCycle: 'No' })
  ]), '2026-02');

  assert.equal(model.players[0].playerName, 'Shaden');
  assert.equal(model.players[0].status, 'unresolved');
  assert.equal(model.players[0].playerId, null);
});

test('keeps ambiguous players visible in the same calendar', () => {
  const model = buildMenstrualCalendarModel(snapshot([
    row({ playerName: 'Sara Alreahili', dateKey: '2026-02-05', cyclePhase: 'Luteal' })
  ]), '2026-02');

  assert.equal(model.players[0].playerName, 'Sara Alreahili');
  assert.equal(model.players[0].status, 'ambiguous');
});

test('leaves days without a Wellness response empty', () => {
  const model = buildMenstrualCalendarModel(snapshot([
    row({ playerName: 'Alba Almutairi', dateKey: '2026-02-03', menstrualCycle: 'Yes' })
  ]), '2026-02');

  assert.equal(model.players[0].cells[0].hasWellnessResponse, false);
  assert.equal(model.players[0].cells[0].hasMenstrualInformation, false);
  assert.equal(model.players[0].cells[0].wellnessRow, null);
});

test('preserves Menstrual cycle Yes exactly', () => {
  const model = buildMenstrualCalendarModel(snapshot([
    row({ menstrualCycle: 'Yes' })
  ]), '2026-02');

  assert.equal(model.players[0].cells[2].menstrualCycle, 'Yes');
});

test('preserves Period day exactly', () => {
  const model = buildMenstrualCalendarModel(snapshot([
    row({ dayOfPeriod: '4' })
  ]), '2026-02');

  assert.equal(model.players[0].cells[2].periodDay, '4');
});

test('preserves Cycle phase exactly', () => {
  const model = buildMenstrualCalendarModel(snapshot([
    row({ cyclePhase: 'Ovulatory' })
  ]), '2026-02');

  assert.equal(model.players[0].cells[2].cyclePhase, 'Ovulatory');
  assert.equal(model.players[0].cells[2].cyclePhaseKey, 'Ovulatory');
});

test('normalizes Cycle phase casing and spacing for visual phase colors only', () => {
  const model = buildMenstrualCalendarModel(snapshot([
    row({ dateKey: '2026-02-03', cyclePhase: ' follicular phase ' }),
    row({ dateKey: '2026-02-04', cyclePhase: 'OVULATORY PHASE' }),
    row({ dateKey: '2026-02-05', cyclePhase: 'luteal' })
  ]), '2026-02');

  assert.equal(model.players[0].cells[2].cyclePhase, 'follicular phase');
  assert.equal(model.players[0].cells[2].cyclePhaseKey, 'Follicular');
  assert.equal(model.players[0].cells[3].cyclePhaseKey, 'Ovulatory');
  assert.equal(model.players[0].cells[4].cyclePhaseKey, 'Luteal');
});

test('generates 28 or 29 February days correctly', () => {
  assert.equal(buildMonthDays('2026-02').length, 28);
  assert.equal(buildMonthDays('2028-02').length, 29);
});

test('generates 30 and 31 day months correctly', () => {
  assert.equal(buildMonthDays('2026-04').length, 30);
  assert.equal(buildMonthDays('2026-03').length, 31);
});

test('uses the latest Timestamp for duplicate player and date rows', () => {
  const model = buildMenstrualCalendarModel(snapshot([
    row({ rowId: 'older', dateKey: '2026-02-03', timestamp: '2026-02-03 08:00:00', menstrualCycle: 'No', cyclePhase: 'Luteal' }),
    row({ rowId: 'newer', dateKey: '2026-02-03', timestamp: '2026-02-03 09:00:00', menstrualCycle: 'Yes', dayOfPeriod: '1', cyclePhase: 'Follicular' })
  ]), '2026-02');

  const cell = model.players[0].cells[2];
  assert.equal(cell.wellnessRow?.rowId, 'newer');
  assert.equal(cell.menstrualCycle, 'Yes');
  assert.equal(cell.periodDay, '1');
});

test('uses the last sheet row when duplicate Timestamps match', () => {
  const model = buildMenstrualCalendarModel(snapshot([
    row({ rowId: 'first', dateKey: '2026-02-03', timestamp: '2026-02-03 08:00:00', menstrualCycle: 'No' }),
    row({ rowId: 'last', dateKey: '2026-02-03', timestamp: '2026-02-03 08:00:00', menstrualCycle: 'Yes' })
  ]), '2026-02');

  assert.equal(model.players[0].cells[2].wellnessRow?.rowId, 'last');
});

test('month navigation changes the generated columns', () => {
  const previous = shiftMonthKey('2026-03', -1);
  const next = shiftMonthKey('2026-03', 1);

  assert.equal(previous, '2026-02');
  assert.equal(next, '2026-04');
  assert.equal(buildMenstrualCalendarModel(snapshot(), previous).days.length, 28);
  assert.equal(buildMenstrualCalendarModel(snapshot(), next).days.length, 30);
});

test('builds from the provided snapshot without performing additional Wellness fetches', () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (() => {
    throw new Error('Unexpected fetch');
  }) as typeof fetch;

  try {
    const model = buildMenstrualCalendarModel(snapshot([
      row({ playerName: 'Alba Almutairi', dateKey: '2026-02-03', menstrualCycle: 'Yes' })
    ]), '2026-02');

    assert.equal(model.players.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('shows an injury on the correct date', () => {
  const model = buildMenstrualCalendarModel(snapshot([
    row({ playerName: 'Alba Almutairi', dateKey: '2026-02-03', cyclePhase: 'Follicular' })
  ]), '2026-02', { injuries: [injury({ id: 'injury-date', injuryDate: '2026-02-03' })] });

  assert.equal(model.players[0].cells[2].injuries[0].id, 'injury-date');
  assert.equal(model.players[0].cells[1].injuries.length, 0);
});

test('shows a complaint on the correct date', () => {
  const model = buildMenstrualCalendarModel(snapshot([
    row({ playerName: 'Alba Almutairi', dateKey: '2026-02-04', cyclePhase: 'Ovulatory' })
  ]), '2026-02', { complaints: [complaint({ id: 'complaint-date', occurrenceDate: '2026-02-04' })] });

  assert.equal(model.players[0].cells[3].complaints[0].id, 'complaint-date');
  assert.equal(model.players[0].cells[2].complaints.length, 0);
});

test('shows injury and complaint together on the same date', () => {
  const model = buildMenstrualCalendarModel(snapshot([
    row({ playerName: 'Alba Almutairi', dateKey: '2026-02-05', cyclePhase: 'Luteal' })
  ]), '2026-02', {
    injuries: [injury({ id: 'same-day-injury', injuryDate: '2026-02-05' })],
    complaints: [complaint({ id: 'same-day-complaint', occurrenceDate: '2026-02-05' })]
  });

  assert.equal(model.players[0].cells[4].injuries.length, 1);
  assert.equal(model.players[0].cells[4].complaints.length, 1);
});

test('injury overlay preserves menstrual information', () => {
  const model = buildMenstrualCalendarModel(snapshot([
    row({ dateKey: '2026-02-06', menstrualCycle: 'Yes', dayOfPeriod: '2', cyclePhase: 'Follicular' })
  ]), '2026-02', { injuries: [injury({ injuryDate: '2026-02-06' })] });

  const cell = model.players[0].cells[5];
  assert.equal(cell.menstrualCycle, 'Yes');
  assert.equal(cell.periodDay, '2');
  assert.equal(cell.cyclePhase, 'Follicular');
  assert.equal(cell.injuries.length, 1);
});

test('complaint overlay preserves menstrual information', () => {
  const model = buildMenstrualCalendarModel(snapshot([
    row({ dateKey: '2026-02-07', menstrualCycle: 'No', dayOfPeriod: '3', cyclePhase: 'Ovulatory' })
  ]), '2026-02', { complaints: [complaint({ occurrenceDate: '2026-02-07' })] });

  const cell = model.players[0].cells[6];
  assert.equal(cell.menstrualCycle, 'No');
  assert.equal(cell.periodDay, '3');
  assert.equal(cell.cyclePhase, 'Ovulatory');
  assert.equal(cell.complaints.length, 1);
});

test('injury without menstrual information is still visible as an overlay', () => {
  const model = buildMenstrualCalendarModel(snapshot(), '2026-02', {
    injuries: [injury({ id: 'clinical-only-injury', injuryDate: '2026-02-08' })]
  });

  assert.equal(model.players[0].status, 'matched');
  assert.equal(model.players[0].cells[7].hasMenstrualInformation, false);
  assert.equal(model.players[0].cells[7].injuries[0].id, 'clinical-only-injury');
});

test('complaint without menstrual information is still visible as an overlay', () => {
  const model = buildMenstrualCalendarModel(snapshot(), '2026-02', {
    complaints: [complaint({ id: 'clinical-only-complaint', occurrenceDate: '2026-02-09' })]
  });

  assert.equal(model.players[0].cells[8].hasMenstrualInformation, false);
  assert.equal(model.players[0].cells[8].complaints[0].id, 'clinical-only-complaint');
});

test('uses the same-date menstrual phase for an injury summary', () => {
  const model = buildMenstrualCalendarModel(snapshot([
    row({ dateKey: '2026-02-10', cyclePhase: 'Follicular' })
  ]), '2026-02', { injuries: [injury({ injuryDate: '2026-02-10' })] });

  assert.equal(model.players[0].summary.injuriesByPhase.Follicular, 1);
});

test('uses the same-date menstrual phase for a complaint summary', () => {
  const model = buildMenstrualCalendarModel(snapshot([
    row({ dateKey: '2026-02-11', cyclePhase: 'Luteal' })
  ]), '2026-02', { complaints: [complaint({ occurrenceDate: '2026-02-11' })] });

  assert.equal(model.players[0].summary.complaintsByPhase.Luteal, 1);
});

test('does not invent clinical matching for unresolved Wellness players', () => {
  const model = buildMenstrualCalendarModel(snapshot([
    row({ playerName: 'Shaden', dateKey: '2026-02-12', menstrualCycle: 'Yes' })
  ]), '2026-02', {
    injuries: [injury({ playerId: 'p-shaden', injuryDate: '2026-02-12' })],
    complaints: [complaint({ playerId: 'p-shaden', occurrenceDate: '2026-02-12' })]
  });

  assert.equal(model.players[0].playerName, 'Shaden');
  assert.equal(model.players[0].status, 'unresolved');
  assert.equal(model.players[0].cells[11].injuries.length, 0);
  assert.equal(model.players[0].cells[11].complaints.length, 0);
});

test('individual summary counts injuries correctly', () => {
  const model = buildMenstrualCalendarModel(snapshot(), '2026-02', {
    injuries: [injury({ id: 'i1', injuryDate: '2026-02-03' }), injury({ id: 'i2', injuryDate: '2026-02-04' })]
  });

  assert.equal(model.players[0].summary.injuryCount, 2);
});

test('individual summary counts complaints correctly', () => {
  const model = buildMenstrualCalendarModel(snapshot(), '2026-02', {
    complaints: [complaint({ id: 'c1', occurrenceDate: '2026-02-03' }), complaint({ id: 'c2', occurrenceDate: '2026-02-04' })]
  });

  assert.equal(model.players[0].summary.complaintCount, 2);
});

test('phase distribution counts known and unknown phases correctly', () => {
  const model = buildMenstrualCalendarModel(snapshot([
    row({ dateKey: '2026-02-03', cyclePhase: 'Follicular' }),
    row({ dateKey: '2026-02-04', cyclePhase: 'Ovulatory' })
  ]), '2026-02', {
    injuries: [injury({ id: 'i1', injuryDate: '2026-02-03' }), injury({ id: 'i2', injuryDate: '2026-02-05' })],
    complaints: [complaint({ id: 'c1', occurrenceDate: '2026-02-04' }), complaint({ id: 'c2', occurrenceDate: '2026-02-06' })]
  });

  assert.equal(model.players[0].summary.injuriesByPhase.Follicular, 1);
  assert.equal(model.players[0].summary.injuriesByPhase.Unknown, 1);
  assert.equal(model.players[0].summary.complaintsByPhase.Ovulatory, 1);
  assert.equal(model.players[0].summary.complaintsByPhase.Unknown, 1);
});

test('general monthly summary matches visible clinical records', () => {
  const model = buildMenstrualCalendarModel(snapshot([
    row({ playerName: 'Alba Almutairi', dateKey: '2026-02-03', cyclePhase: 'Follicular' }),
    row({ playerName: 'Shaden', dateKey: '2026-02-03', cyclePhase: 'Luteal' })
  ]), '2026-02', {
    injuries: [injury({ id: 'visible-injury', injuryDate: '2026-02-03' }), injury({ id: 'unmatched-injury', playerId: 'unknown-player', injuryDate: '2026-02-03' })],
    complaints: [complaint({ id: 'visible-complaint', occurrenceDate: '2026-02-03' }), complaint({ id: 'unmatched-complaint', playerId: 'unknown-player', occurrenceDate: '2026-02-03' })]
  });

  assert.equal(model.summary.injuryCount, 1);
  assert.equal(model.summary.complaintCount, 1);
  assert.equal(model.summary.injuriesByPhase.Follicular, 1);
  assert.equal(model.summary.complaintsByPhase.Follicular, 1);
});

test('days without menstrual or clinical data remain empty', () => {
  const model = buildMenstrualCalendarModel(snapshot([
    row({ dateKey: '2026-02-03', menstrualCycle: 'Yes' })
  ]), '2026-02', {
    injuries: [injury({ injuryDate: '2026-02-03' })],
    complaints: [complaint({ occurrenceDate: '2026-02-03' })]
  });

  const emptyCell = model.players[0].cells[0];
  assert.equal(emptyCell.hasWellnessResponse, false);
  assert.equal(emptyCell.hasMenstrualInformation, false);
  assert.equal(emptyCell.injuries.length, 0);
  assert.equal(emptyCell.complaints.length, 0);
});