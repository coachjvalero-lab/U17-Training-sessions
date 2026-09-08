import test from 'node:test';
import assert from 'node:assert/strict';
import type { PlayerAttendance } from '../types';
import {
  calculatePlayerAttendanceStatistics,
  getAvailablePlayerNamesForGroups
} from './attendanceStatistics';

const PLAYER_NAME = 'Alba';

function sessionsWithAttendance(records: Array<PlayerAttendance | undefined>, totalSessions = 16) {
  return Array.from({ length: totalSessions }, (_, index) => ({
    attendance: records[index] ? [records[index]] : []
  }));
}

function attending(): PlayerAttendance {
  return { playerName: PLAYER_NAME, status: 'Attending' };
}

function absent(): PlayerAttendance {
  return { playerName: PLAYER_NAME, status: 'Absent', absenceReason: 'Unknown' };
}

function gym(): PlayerAttendance {
  return { playerName: PLAYER_NAME, status: 'Gym' };
}

test('counts five explicit attending records and eleven unknown sessions', () => {
  const result = calculatePlayerAttendanceStatistics(
    PLAYER_NAME,
    sessionsWithAttendance(Array.from({ length: 5 }, attending))
  );

  assert.equal(result.attendingCount, 5);
  assert.equal(result.recordedSessions, 5);
  assert.equal(result.unknownCount, 11);
});

test('separates attending, absent, gym and unknown metrics', () => {
  const records = [
    ...Array.from({ length: 5 }, attending),
    ...Array.from({ length: 2 }, absent),
    gym()
  ];
  const result = calculatePlayerAttendanceStatistics(PLAYER_NAME, sessionsWithAttendance(records));

  assert.equal(result.attendingCount, 5);
  assert.equal(result.absentCount, 2);
  assert.equal(result.gymCount, 1);
  assert.equal(result.recordedSessions, 8);
  assert.equal(result.unknownCount, 8);
  assert.equal(result.attendanceRate, 62.5);
  assert.equal(result.participationRate, 31.25);
});

test('reports three of sixteen participation and three of three attendance', () => {
  const result = calculatePlayerAttendanceStatistics(
    PLAYER_NAME,
    sessionsWithAttendance(Array.from({ length: 3 }, attending))
  );

  assert.equal(result.recordedSessions, 3);
  assert.equal(result.totalSessions, 16);
  assert.equal(result.attendingCount, 3);
  assert.equal(result.attendanceRate, 100);
});

test('counts three attending and two absent as five recorded sessions', () => {
  const records = [
    ...Array.from({ length: 3 }, attending),
    ...Array.from({ length: 2 }, absent)
  ];
  const result = calculatePlayerAttendanceStatistics(PLAYER_NAME, sessionsWithAttendance(records));

  assert.equal(result.recordedSessions, 5);
  assert.equal(result.attendingCount, 3);
  assert.equal(result.absentCount, 2);
});

test('does not create attending records from an empty attendance list', () => {
  const result = calculatePlayerAttendanceStatistics(PLAYER_NAME, [{ attendance: [] }]);

  assert.equal(result.attendingCount, 0);
  assert.equal(result.recordedSessions, 0);
  assert.equal(result.unknownCount, 1);
});

test('only explicitly attending players are available for player groups', () => {
  const roster = ['Alba', 'Ghala', 'Rimah', 'Leen'];
  const attendance: PlayerAttendance[] = [
    { playerName: 'Alba', status: 'Attending' },
    { playerName: 'Ghala', status: 'Gym' },
    { playerName: 'Rimah', status: 'Absent', absenceReason: 'Study' }
  ];

  assert.deepEqual(getAvailablePlayerNamesForGroups(roster, attendance), ['Alba']);
});

test('excludes goalkeepers and injured players from training groups when squadPlayers are provided', () => {
  const squadPlayers: any[] = [
    { id: 'p1', firstName: 'Alba', lastName: 'Mellado', position: 'ST', status: 'Active' },
    { id: 'p2', firstName: 'Ranse', lastName: 'AlGhamdi', position: 'GK', status: 'Active' },
    { id: 'p10', firstName: 'Leen', lastName: 'Alhidari', position: 'CM', status: 'Injured' },
    { id: 'p9', firstName: 'Lateen', lastName: 'AlZahrani', position: 'RW', status: 'Active' }
  ];

  const roster = ['Alba', 'Ranse (GK)', 'Leen', 'Lateen'];
  const attendance: PlayerAttendance[] = [
    { playerName: 'Alba', status: 'Attending' },
    { playerName: 'Ranse (GK)', status: 'Attending' },
    { playerName: 'Leen', status: 'Absent', absenceReason: 'Injury' },
    { playerName: 'Lateen', status: 'Attending' }
  ];

  // Resolver matching names
  const resolver = (name: string) => {
    const clean = name.toLowerCase().replace(/\s*\(gk\)$/i, '').trim();
    const found = squadPlayers.find(p => p.firstName.toLowerCase() === clean);
    if (found) return { kind: 'matched' as const, playerId: found.id, displayName: `${found.firstName} ${found.lastName}` };
    return { kind: 'unmatched' as const, historicalName: name, normalizedHistoricalName: clean };
  };

  const available = getAvailablePlayerNamesForGroups(roster, attendance, {
    resolveName: resolver,
    squadPlayers
  });

  // Ranse is GK -> excluded. Leen is Injured -> excluded. Only Alba and Lateen remain.
  assert.deepEqual(available, ['Alba Mellado', 'Lateen AlZahrani']);
});

test('excludes injured player even if an erroneous attending record exists for the same player', () => {
  const squadPlayers: any[] = [
    { id: 'p10', firstName: 'Leen', lastName: 'Alhidari', position: 'CM', status: 'Injured' }
  ];

  const roster = ['Leen'];
  // Even if both an absent and attending record existed
  const attendance: PlayerAttendance[] = [
    { playerName: 'Leen', status: 'Absent', absenceReason: 'Injury' },
    { playerName: 'Leen', status: 'Attending' }
  ];

  const resolver = (name: string) => ({
    kind: 'matched' as const,
    playerId: 'p10',
    displayName: 'Leen Alhidari'
  });

  const available = getAvailablePlayerNamesForGroups(roster, attendance, {
    resolveName: resolver,
    squadPlayers
  });

  assert.deepEqual(available, []);
});