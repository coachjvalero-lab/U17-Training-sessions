import test from 'node:test';
import assert from 'node:assert/strict';
import type { PlayerAttendance, SquadPlayer } from '../types';
import {
  buildAttendanceIdentityRows,
  createAttendanceNameResolver,
  type AttendanceAliasMap
} from './attendanceIdentity';
import { calculatePlayerAttendanceStatisticsByPlayerId } from './attendanceStatistics';

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

test('1) tres nombres historicos se agrupan en un solo playerId', () => {
  const players = [makePlayer('p1', 'Alba', 'Almutairi')];
  const aliases: AttendanceAliasMap = {
    Alba: 'p1',
    'Alba A': 'p1'
  };

  const rows = buildAttendanceIdentityRows({
    squadPlayers: players,
    rosterNames: ['Alba Almutairi'],
    attendanceNames: ['Alba', 'Alba A', 'Alba Almutairi'],
    aliases
  });

  const matched = rows.filter((row) => row.resolution === 'matched' && row.playerId === 'p1');
  assert.equal(matched.length, 1);
  assert.deepEqual(matched[0]?.historicalNames.sort(), ['Alba', 'Alba A', 'Alba Almutairi'].sort());
});

test('2) dos jugadoras distintas con el mismo nombre no se fusionan', () => {
  const players = [
    makePlayer('p1', 'Sara', 'Lee'),
    makePlayer('p2', 'Sara', 'Lee')
  ];
  const resolver = createAttendanceNameResolver(players);
  const resolution = resolver.resolveName('Sara Lee');

  assert.equal(resolution.kind, 'ambiguous');

  const sessions = makeSessions([{ playerName: 'Sara Lee', status: 'Attending' }]);
  const p1Stats = calculatePlayerAttendanceStatisticsByPlayerId('p1', 'Sara Lee', sessions, resolver.resolveName);
  const p2Stats = calculatePlayerAttendanceStatisticsByPlayerId('p2', 'Sara Lee', sessions, resolver.resolveName);

  assert.equal(p1Stats.recordedSessions, 0);
  assert.equal(p2Stats.recordedSessions, 0);
});

test('3) nombre corto ambiguo no se asigna automaticamente', () => {
  const players = [
    makePlayer('p1', 'Alba', 'Almutairi'),
    makePlayer('p2', 'Alba', 'Rodriguez')
  ];
  const resolver = createAttendanceNameResolver(players);
  const resolution = resolver.resolveName('Alba');

  assert.equal(resolution.kind, 'ambiguous');
  if (resolution.kind === 'ambiguous') {
    assert.equal(resolution.candidatePlayerIds.length, 2);
  }
});

test('4) Amen Mami con 5 attending + 12 unknown resulta en 5/5 y 100%', () => {
  const players = [makePlayer('amen', 'Amen', 'Mami')];
  const resolver = createAttendanceNameResolver(players);

  const sessions = makeSessions(
    Array.from({ length: 5 }, () => ({ playerName: 'Amen Mami', status: 'Attending' as const }))
  );

  const stats = calculatePlayerAttendanceStatisticsByPlayerId('amen', 'Amen Mami', sessions, resolver.resolveName);

  assert.equal(stats.attendingCount, 5);
  assert.equal(stats.recordedSessions, 5);
  assert.equal(stats.unknownCount, 12);
  assert.equal(stats.attendanceRate, 100);
});

test('5) jugadora presente en 17 sesiones mantiene 17/17', () => {
  const players = [makePlayer('p1', 'Amel', 'Majri')];
  const resolver = createAttendanceNameResolver(players);

  const sessions = makeSessions(
    Array.from({ length: 17 }, () => ({ playerName: 'Amel Majri', status: 'Attending' as const })),
    17
  );

  const stats = calculatePlayerAttendanceStatisticsByPlayerId('p1', 'Amel Majri', sessions, resolver.resolveName);

  assert.equal(stats.recordedSessions, 17);
  assert.equal(stats.attendingCount, 17);
  assert.equal(stats.attendanceRate, 100);
});

test('6) 4 attending + 1 absent + 12 unknown produce 4/5 y 80%', () => {
  const players = [makePlayer('p1', 'Player', 'One')];
  const resolver = createAttendanceNameResolver(players);

  const sessions = makeSessions([
    { playerName: 'Player One', status: 'Attending' },
    { playerName: 'Player One', status: 'Attending' },
    { playerName: 'Player One', status: 'Attending' },
    { playerName: 'Player One', status: 'Attending' },
    { playerName: 'Player One', status: 'Absent', absenceReason: 'Unknown' }
  ]);

  const stats = calculatePlayerAttendanceStatisticsByPlayerId('p1', 'Player One', sessions, resolver.resolveName);

  assert.equal(stats.attendingCount, 4);
  assert.equal(stats.absentCount, 1);
  assert.equal(stats.recordedSessions, 5);
  assert.equal(stats.unknownCount, 12);
  assert.equal(stats.attendanceRate, 80);
});

test('7) una externa no se convierte automaticamente en jugadora de squad', () => {
  const players = [makePlayer('p1', 'Amen', 'Mami')];
  const resolver = createAttendanceNameResolver(players);

  const sessions = makeSessions(
    Array.from({ length: 5 }, () => ({ playerName: 'External Guest', status: 'Attending' as const }))
  );

  const amenStats = calculatePlayerAttendanceStatisticsByPlayerId('p1', 'Amen Mami', sessions, resolver.resolveName);
  const guestResolution = resolver.resolveName('External Guest');

  assert.equal(guestResolution.kind, 'unmatched');
  assert.equal(amenStats.recordedSessions, 0);
  assert.equal(amenStats.unknownCount, 17);
});

test('8) alias confirmado se agrupa bajo su playerId', () => {
  const players = [makePlayer('p1', 'Alba', 'Almutairi')];
  const aliases: AttendanceAliasMap = {
    'Alba A': 'p1'
  };
  const resolver = createAttendanceNameResolver(players, aliases);

  const sessions = makeSessions([
    { playerName: 'Alba A', status: 'Attending' },
    { playerName: 'Alba A', status: 'Attending' }
  ]);

  const stats = calculatePlayerAttendanceStatisticsByPlayerId('p1', 'Alba Almutairi', sessions, resolver.resolveName);

  assert.equal(stats.attendingCount, 2);
  assert.equal(stats.recordedSessions, 2);
  assert.equal(stats.unknownCount, 15);
});
