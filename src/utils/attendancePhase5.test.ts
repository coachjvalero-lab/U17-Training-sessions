import test from 'node:test';
import assert from 'node:assert/strict';
import type { PlayerAttendance, SquadPlayer } from '../types';
import {
  buildAttendanceAliasMapFromMappings,
  buildAttendanceIdentityRows,
  createAttendanceNameResolver,
  createHistoricalNameMapping,
  type HistoricalNameMapping
} from './attendanceIdentity';
import {
  calculatePlayerAttendanceStatisticsByHistoricalNames,
  calculatePlayerAttendanceStatisticsByPlayerId,
  getAvailablePlayerNamesForGroups
} from './attendanceStatistics';

function makePlayer(id: string, firstName: string, lastName: string): SquadPlayer {
  return {
    id,
    firstName,
    lastName,
    position: 'CM',
    status: 'Active',
    malikaHistory: []
  };
}

function makeSessions(records: Array<PlayerAttendance | undefined>, total = 17) {
  return Array.from({ length: total }, (_, index) => ({
    attendance: records[index] ? [records[index]] : []
  }));
}

function buildResolver(players: SquadPlayer[], mappings: HistoricalNameMapping[] = []) {
  const aliases = buildAttendanceAliasMapFromMappings(mappings);
  return createAttendanceNameResolver(players, aliases, mappings);
}

test('TEST 1: 5 Attending + 12 Unknown -> 5/5, 100%, participation 5/17', () => {
  const squadPlayers = [makePlayer('p1', 'Player', 'One')];
  const resolver = buildResolver(squadPlayers);
  const sessions = makeSessions(
    Array.from({ length: 5 }, () => ({ playerName: 'Player One', status: 'Attending' as const }))
  );

  const stats = calculatePlayerAttendanceStatisticsByPlayerId('p1', 'Player One', sessions, resolver.resolveName);
  assert.equal(stats.attendingCount, 5);
  assert.equal(stats.recordedSessions, 5);
  assert.equal(stats.unknownCount, 12);
  assert.equal(stats.attendanceRate, 100);
  assert.equal(stats.recordedSessions, 5);
  assert.equal(stats.totalSessions, 17);
});

test('TEST 2: 5 Attending + 1 Absent + 11 Unknown -> attendance 83%, recorded 6, unknown 11', () => {
  const squadPlayers = [makePlayer('p1', 'Player', 'One')];
  const resolver = buildResolver(squadPlayers);
  const sessions = makeSessions([
    ...Array.from({ length: 5 }, () => ({ playerName: 'Player One', status: 'Attending' as const })),
    { playerName: 'Player One', status: 'Absent', absenceReason: 'Unknown' }
  ]);

  const stats = calculatePlayerAttendanceStatisticsByPlayerId('p1', 'Player One', sessions, resolver.resolveName);
  assert.equal(stats.recordedSessions, 6);
  assert.equal(stats.unknownCount, 11);
  assert.equal(Math.round(stats.attendanceRate), 83);
});

test('TEST 3: 10 Attending + 1 Absent + 2 First Team -> attendance 91%, First Team 2, Absent 1', () => {
  const squadPlayers = [makePlayer('p1', 'Player', 'One')];
  const resolver = buildResolver(squadPlayers);
  const sessions = makeSessions([
    ...Array.from({ length: 10 }, () => ({ playerName: 'Player One', status: 'Attending' as const })),
    { playerName: 'Player One', status: 'Absent', absenceReason: 'Unknown' },
    { playerName: 'Player One', status: 'First Team' },
    { playerName: 'Player One', status: 'First Team' }
  ], 13);

  const stats = calculatePlayerAttendanceStatisticsByPlayerId('p1', 'Player One', sessions, resolver.resolveName);
  assert.equal(stats.firstTeamCount, 2);
  assert.equal(stats.absentCount, 1);
  assert.equal(stats.recordedSessions, 11);
  assert.equal(Math.round(stats.attendanceRate), 91);
});

test('TEST 4: 10 Attending + 1 Absent + 2 National Team Call -> attendance 91%, National Team 2, Absent 1', () => {
  const squadPlayers = [makePlayer('p1', 'Player', 'One')];
  const resolver = buildResolver(squadPlayers);
  const sessions = makeSessions([
    ...Array.from({ length: 10 }, () => ({ playerName: 'Player One', status: 'Attending' as const })),
    { playerName: 'Player One', status: 'Absent', absenceReason: 'Unknown' },
    { playerName: 'Player One', status: 'National Team Call' },
    { playerName: 'Player One', status: 'National Team Call' }
  ], 13);

  const stats = calculatePlayerAttendanceStatisticsByPlayerId('p1', 'Player One', sessions, resolver.resolveName);
  assert.equal(stats.nationalTeamCount, 2);
  assert.equal(stats.absentCount, 1);
  assert.equal(stats.recordedSessions, 11);
  assert.equal(Math.round(stats.attendanceRate), 91);
});

test('TEST 5: 10 Attending + 1 Absent + 2 Gym + 1 First Team + 1 National Team Call -> attendance 77%', () => {
  const squadPlayers = [makePlayer('p1', 'Player', 'One')];
  const resolver = buildResolver(squadPlayers);
  const sessions = makeSessions([
    ...Array.from({ length: 10 }, () => ({ playerName: 'Player One', status: 'Attending' as const })),
    { playerName: 'Player One', status: 'Absent', absenceReason: 'Unknown' },
    { playerName: 'Player One', status: 'Gym' },
    { playerName: 'Player One', status: 'Gym' },
    { playerName: 'Player One', status: 'First Team' },
    { playerName: 'Player One', status: 'National Team Call' }
  ], 15);

  const stats = calculatePlayerAttendanceStatisticsByPlayerId('p1', 'Player One', sessions, resolver.resolveName);
  assert.equal(stats.recordedSessions, 13);
  assert.equal(Math.round(stats.attendanceRate), 77);
});

test('TEST 6: External con 5 Attending + 12 Unknown -> attendance 100%, participation 5/17, no aparece en Squad Leaderboard', () => {
  const squadPlayers = [makePlayer('p1', 'Amen', 'Mami')];
  const mappings = [
    createHistoricalNameMapping({ historicalName: 'Amel Majri', classification: 'external', now: 1 })
  ];

  const rows = buildAttendanceIdentityRows({
    squadPlayers,
    rosterNames: [],
    attendanceNames: ['Amel Majri'],
    mappings
  });

  const squadRows = rows.filter((row) => row.resolution === 'matched');
  assert.equal(squadRows.length, 1);
  assert.ok(!squadRows.some((row) => row.displayName === 'Amel Majri'));

  const sessions = makeSessions(
    Array.from({ length: 5 }, () => ({ playerName: 'Amel Majri', status: 'Attending' as const }))
  );
  const stats = calculatePlayerAttendanceStatisticsByHistoricalNames('Amel Majri', ['Amel Majri'], sessions);
  assert.equal(stats.attendingCount, 5);
  assert.equal(stats.recordedSessions, 5);
  assert.equal(stats.attendanceRate, 100);
  assert.equal(stats.totalSessions, 17);
});

test('TEST 7: identidad marcada external desaparece de unresolved y aparece en External, conservando estadisticas', () => {
  const squadPlayers = [makePlayer('p1', 'Amen', 'Mami')];
  const mappings = [
    createHistoricalNameMapping({ historicalName: 'Amel Majri', classification: 'external', now: 1 })
  ];

  const rows = buildAttendanceIdentityRows({
    squadPlayers,
    rosterNames: [],
    attendanceNames: ['Amel Majri'],
    mappings
  });

  const unresolved = rows.filter((row) => row.resolution !== 'matched' && row.resolution !== 'external');
  const external = rows.filter((row) => row.resolution === 'external');

  assert.equal(unresolved.some((row) => row.displayName === 'Amel Majri'), false);
  assert.equal(external.length, 1);
  assert.equal(external[0]?.displayName, 'Amel Majri');
});

test('TEST 8: First Team se guarda correctamente, no cuenta como Absent y no aparece en Player Groups', () => {
  const roster = ['Player One', 'Player Two'];
  const attendance: PlayerAttendance[] = [
    { playerName: 'Player One', status: 'First Team' },
    { playerName: 'Player Two', status: 'Attending' }
  ];

  const available = getAvailablePlayerNamesForGroups(roster, attendance);
  assert.deepEqual(available, ['Player Two']);

  const squadPlayers = [makePlayer('p1', 'Player', 'One')];
  const resolver = buildResolver(squadPlayers);
  const sessions = makeSessions([{ playerName: 'Player One', status: 'First Team' }], 1);
  const stats = calculatePlayerAttendanceStatisticsByPlayerId('p1', 'Player One', sessions, resolver.resolveName);
  assert.equal(stats.firstTeamCount, 1);
  assert.equal(stats.absentCount, 0);
});

test('TEST 9: National Team Call se guarda correctamente, no cuenta como Absent y no aparece en Player Groups', () => {
  const roster = ['Player One', 'Player Two'];
  const attendance: PlayerAttendance[] = [
    { playerName: 'Player One', status: 'National Team Call' },
    { playerName: 'Player Two', status: 'Attending' }
  ];

  const available = getAvailablePlayerNamesForGroups(roster, attendance);
  assert.deepEqual(available, ['Player Two']);

  const squadPlayers = [makePlayer('p1', 'Player', 'One')];
  const resolver = buildResolver(squadPlayers);
  const sessions = makeSessions([{ playerName: 'Player One', status: 'National Team Call' }], 1);
  const stats = calculatePlayerAttendanceStatisticsByPlayerId('p1', 'Player One', sessions, resolver.resolveName);
  assert.equal(stats.nationalTeamCount, 1);
  assert.equal(stats.absentCount, 0);
});

test('TEST 10: Alba Rodriguez -> Alba Almutairi produce una unica fila canonica sin unresolved residual', () => {
  const squadPlayers = [makePlayer('p6', 'Alba', 'Almutairi')];
  const mappings = [
    createHistoricalNameMapping({ historicalName: 'Alba Rodriguez', classification: 'squad', playerId: 'p6', now: 1 })
  ];

  const rows = buildAttendanceIdentityRows({
    squadPlayers,
    rosterNames: ['Alba Almutairi'],
    attendanceNames: ['Alba Almutairi', 'Alba Rodriguez'],
    mappings
  });

  const albaRows = rows.filter((row) => row.playerId === 'p6');
  assert.equal(albaRows.length, 1);
  assert.deepEqual(albaRows[0]?.historicalNames.sort(), ['Alba Almutairi', 'Alba Rodriguez'].sort());

  const unresolved = rows.filter((row) => row.resolution !== 'matched');
  assert.equal(unresolved.some((row) => row.displayName === 'Alba Rodriguez'), false);
});

test('PARTICIPATION 1: 5 Attending + 12 Unknown / 17 -> Attendance 100%, Participation 29%', () => {
  const squadPlayers = [makePlayer('p1', 'Player', 'One')];
  const resolver = buildResolver(squadPlayers);
  const sessions = makeSessions(
    Array.from({ length: 5 }, () => ({ playerName: 'Player One', status: 'Attending' as const }))
  );

  const stats = calculatePlayerAttendanceStatisticsByPlayerId('p1', 'Player One', sessions, resolver.resolveName);
  assert.equal(stats.attendingCount, 5);
  assert.equal(stats.recordedSessions, 5);
  assert.equal(stats.unknownCount, 12);
  assert.equal(Math.round(stats.attendanceRate), 100);
  assert.equal(Math.round(stats.participationRate), 29);
});

test('PARTICIPATION 2: 5 Attending + 1 Absent + 11 Unknown / 17 -> Attendance 83%, Participation 29%', () => {
  const squadPlayers = [makePlayer('p1', 'Player', 'One')];
  const resolver = buildResolver(squadPlayers);
  const sessions = makeSessions([
    ...Array.from({ length: 5 }, () => ({ playerName: 'Player One', status: 'Attending' as const })),
    { playerName: 'Player One', status: 'Absent', absenceReason: 'Unknown' }
  ]);

  const stats = calculatePlayerAttendanceStatisticsByPlayerId('p1', 'Player One', sessions, resolver.resolveName);
  assert.equal(stats.recordedSessions, 6);
  assert.equal(stats.unknownCount, 11);
  assert.equal(Math.round(stats.attendanceRate), 83);
  assert.equal(Math.round(stats.participationRate), 29);
});

test('PARTICIPATION 3: 10 Attending + 1 Absent + 2 First Team + 1 National Team Call + 3 Unknown / 17 -> Attendance 91%, Participation 59%', () => {
  const squadPlayers = [makePlayer('p1', 'Player', 'One')];
  const resolver = buildResolver(squadPlayers);
  const sessions = makeSessions([
    ...Array.from({ length: 10 }, () => ({ playerName: 'Player One', status: 'Attending' as const })),
    { playerName: 'Player One', status: 'Absent', absenceReason: 'Unknown' },
    { playerName: 'Player One', status: 'First Team' },
    { playerName: 'Player One', status: 'First Team' },
    { playerName: 'Player One', status: 'National Team Call' }
  ]);

  const stats = calculatePlayerAttendanceStatisticsByPlayerId('p1', 'Player One', sessions, resolver.resolveName);
  assert.equal(stats.attendingCount, 10);
  assert.equal(stats.absentCount, 1);
  assert.equal(stats.firstTeamCount, 2);
  assert.equal(stats.nationalTeamCount, 1);
  assert.equal(stats.unknownCount, 3);
  assert.equal(stats.totalSessions, 17);
  assert.equal(Math.round(stats.attendanceRate), 91);
  assert.equal(Math.round(stats.participationRate), 59);
});

test('First Team y National Team Call no incrementan attendingCount', () => {
  const squadPlayers = [makePlayer('p1', 'Player', 'One')];
  const resolver = buildResolver(squadPlayers);
  const sessions = makeSessions([
    { playerName: 'Player One', status: 'First Team' },
    { playerName: 'Player One', status: 'National Team Call' }
  ], 2);

  const stats = calculatePlayerAttendanceStatisticsByPlayerId('p1', 'Player One', sessions, resolver.resolveName);
  assert.equal(stats.attendingCount, 0);
  assert.equal(stats.firstTeamCount, 1);
  assert.equal(stats.nationalTeamCount, 1);
  assert.equal(stats.participationRate, 0);
});

