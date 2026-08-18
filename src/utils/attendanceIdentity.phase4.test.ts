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
  calculatePlayerAttendanceStatisticsByPlayerId
} from './attendanceStatistics';
import {
  readAttendanceIdentityMappings,
  upsertAttendanceIdentityMapping,
  writeAttendanceIdentityMappings
} from './attendanceIdentityStore';

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

test('1) 24 squad players generan 24 filas principales', () => {
  const squadPlayers = Array.from({ length: 24 }, (_, index) =>
    makePlayer(`p${index + 1}`, `Player${index + 1}`, 'U17')
  );

  const rows = buildAttendanceIdentityRows({
    squadPlayers,
    rosterNames: [],
    attendanceNames: []
  });

  const squadRows = rows.filter((row) => row.resolution === 'matched');
  assert.equal(squadRows.length, 24);
});

test('2) Alba + Alba Almutairi + Alba Rodriguez se agrupan en una identidad', () => {
  const squadPlayers = [makePlayer('p6', 'Alba', 'Almutairi')];
  const mappings = [
    createHistoricalNameMapping({ historicalName: 'Alba', classification: 'squad', playerId: 'p6', now: 1 }),
    createHistoricalNameMapping({ historicalName: 'Alba Rodriguez', classification: 'squad', playerId: 'p6', now: 1 })
  ];

  const rows = buildAttendanceIdentityRows({
    squadPlayers,
    rosterNames: ['Alba Almutairi'],
    attendanceNames: ['Alba', 'Alba Almutairi', 'Alba Rodriguez'],
    mappings
  });

  const albaRow = rows.find((row) => row.playerId === 'p6');
  assert.ok(albaRow);
  assert.deepEqual(albaRow?.historicalNames.sort(), ['Alba', 'Alba Almutairi', 'Alba Rodriguez'].sort());

  const resolver = buildResolver(squadPlayers, mappings);
  const sessions = makeSessions([
    { playerName: 'Alba', status: 'Attending' },
    { playerName: 'Alba Almutairi', status: 'Attending' },
    { playerName: 'Alba Rodriguez', status: 'Attending' }
  ]);

  const stats = calculatePlayerAttendanceStatisticsByPlayerId('p6', 'Alba Almutairi', sessions, resolver.resolveName);
  assert.equal(stats.attendingCount, 3);
  assert.equal(stats.recordedSessions, 3);
});

test('3) nombres similares de jugadoras distintas no se fusionan automaticamente', () => {
  const squadPlayers = [
    makePlayer('p1', 'Sara', 'Lee'),
    makePlayer('p2', 'Sarah', 'Lee')
  ];

  const resolver = buildResolver(squadPlayers);
  const sara = resolver.resolveName('Sara Lee');
  const sarah = resolver.resolveName('Sarah Lee');

  assert.equal(sara.kind, 'matched');
  assert.equal(sarah.kind, 'matched');
  if (sara.kind === 'matched' && sarah.kind === 'matched') {
    assert.notEqual(sara.playerId, sarah.playerId);
  }
});

test('4) nombre ambiguo no se asigna automaticamente', () => {
  const squadPlayers = [
    makePlayer('p1', 'Alba', 'Almutairi'),
    makePlayer('p2', 'Alba', 'Rodriguez')
  ];

  const resolver = buildResolver(squadPlayers);
  const resolution = resolver.resolveName('Alba');
  assert.equal(resolution.kind, 'ambiguous');
});

test('5) unmatched no aparece como jugadora del squad', () => {
  const squadPlayers = [makePlayer('p1', 'Amen', 'Mami')];

  const rows = buildAttendanceIdentityRows({
    squadPlayers,
    rosterNames: [],
    attendanceNames: ['Unknown Guest']
  });

  const squadRows = rows.filter((row) => row.resolution === 'matched');
  const unresolvedRows = rows.filter((row) => row.resolution !== 'matched');

  assert.equal(squadRows.length, 1);
  assert.equal(unresolvedRows.length, 1);
  assert.equal(unresolvedRows[0]?.displayName, 'Unknown Guest');
});

test('6) external no contamina estadisticas del squad', () => {
  const squadPlayers = [makePlayer('p1', 'Amen', 'Mami')];
  const mappings = [
    createHistoricalNameMapping({ historicalName: 'Amel Majri', classification: 'external', now: 1 })
  ];

  const resolver = buildResolver(squadPlayers, mappings);
  const sessions = makeSessions(
    Array.from({ length: 5 }, () => ({ playerName: 'Amel Majri', status: 'Attending' as const }))
  );

  const amenStats = calculatePlayerAttendanceStatisticsByPlayerId('p1', 'Amen Mami', sessions, resolver.resolveName);
  assert.equal(amenStats.recordedSessions, 0);
  assert.equal(amenStats.unknownCount, 17);
});

test('7) alias persistido se mantiene tras recarga', () => {
  const storage: Record<string, string> = {};
  const localStorageMock = {
    getItem: (key: string) => storage[key] ?? null,
    setItem: (key: string, value: string) => {
      storage[key] = value;
    }
  };

  const previousWindow = (globalThis as any).window;
  (globalThis as any).window = { localStorage: localStorageMock };

  try {
    let mappings: HistoricalNameMapping[] = [];
    mappings = upsertAttendanceIdentityMapping(mappings, {
      historicalName: 'Alba Rodriguez',
      classification: 'squad',
      playerId: 'p6'
    });
    writeAttendanceIdentityMappings(mappings);

    const restored = readAttendanceIdentityMappings();
    assert.equal(restored.length, 1);
    assert.equal(restored[0]?.classification, 'squad');
    assert.equal(restored[0]?.playerId, 'p6');
  } finally {
    (globalThis as any).window = previousWindow;
  }
});

test('8) 5 attending + 12 unknown produce 5/5 y 100%', () => {
  const squadPlayers = [makePlayer('p1', 'Amen', 'Mami')];
  const resolver = buildResolver(squadPlayers);
  const sessions = makeSessions(
    Array.from({ length: 5 }, () => ({ playerName: 'Amen Mami', status: 'Attending' as const }))
  );

  const stats = calculatePlayerAttendanceStatisticsByPlayerId('p1', 'Amen Mami', sessions, resolver.resolveName);
  assert.equal(stats.attendingCount, 5);
  assert.equal(stats.recordedSessions, 5);
  assert.equal(stats.unknownCount, 12);
  assert.equal(stats.attendanceRate, 100);
});

test('9) 17 attending produce 17/17', () => {
  const squadPlayers = [makePlayer('p1', 'Amel', 'Majri')];
  const resolver = buildResolver(squadPlayers);
  const sessions = makeSessions(
    Array.from({ length: 17 }, () => ({ playerName: 'Amel Majri', status: 'Attending' as const })),
    17
  );

  const stats = calculatePlayerAttendanceStatisticsByPlayerId('p1', 'Amel Majri', sessions, resolver.resolveName);
  assert.equal(stats.attendingCount, 17);
  assert.equal(stats.recordedSessions, 17);
  assert.equal(stats.attendanceRate, 100);
});

test('10) 4 attending + 1 absent + 12 unknown produce 4/5 y 80%', () => {
  const squadPlayers = [makePlayer('p1', 'Player', 'One')];
  const resolver = buildResolver(squadPlayers);

  const sessions = makeSessions([
    { playerName: 'Player One', status: 'Attending' },
    { playerName: 'Player One', status: 'Attending' },
    { playerName: 'Player One', status: 'Attending' },
    { playerName: 'Player One', status: 'Attending' },
    { playerName: 'Player One', status: 'Absent', absenceReason: 'Unknown' }
  ]);

  const stats = calculatePlayerAttendanceStatisticsByPlayerId('p1', 'Player One', sessions, resolver.resolveName);
  assert.equal(stats.recordedSessions, 5);
  assert.equal(stats.attendingCount, 4);
  assert.equal(stats.absentCount, 1);
  assert.equal(stats.attendanceRate, 80);
});

test('11) cambiar nombre en squad mantiene el mismo playerId canonico', () => {
  const before = [makePlayer('p1', 'Auda', 'Emad')];
  const after = [makePlayer('p1', 'Auda', 'Ahmed')];
  const mappings = [
    createHistoricalNameMapping({ historicalName: 'Auda Emad', classification: 'squad', playerId: 'p1', now: 1 })
  ];

  const beforeResolver = buildResolver(before, mappings);
  const afterResolver = buildResolver(after, mappings);

  const beforeMatch = beforeResolver.resolveName('Auda Emad');
  const afterMatch = afterResolver.resolveName('Auda Emad');

  assert.equal(beforeMatch.kind, 'matched');
  assert.equal(afterMatch.kind, 'matched');
  if (beforeMatch.kind === 'matched' && afterMatch.kind === 'matched') {
    assert.equal(beforeMatch.playerId, 'p1');
    assert.equal(afterMatch.playerId, 'p1');
    assert.notEqual(beforeMatch.displayName, afterMatch.displayName);
  }
});

test('12) no se modifica ningun JSON historico de attendance', () => {
  const squadPlayers = [makePlayer('p1', 'Amen', 'Mami')];
  const resolver = buildResolver(squadPlayers);
  const sessions = makeSessions([
    { playerName: 'Amen Mami', status: 'Attending' },
    { playerName: 'Amen Mami', status: 'Absent', absenceReason: 'Study' }
  ]);

  const snapshot = JSON.stringify(sessions);
  const _stats = calculatePlayerAttendanceStatisticsByPlayerId('p1', 'Amen Mami', sessions, resolver.resolveName);
  assert.equal(JSON.stringify(sessions), snapshot);

  const fallback = calculatePlayerAttendanceStatisticsByHistoricalNames('Amen Mami', ['Amen Mami'], sessions);
  assert.equal(fallback.recordedSessions, 2);
  assert.equal(JSON.stringify(sessions), snapshot);
});
