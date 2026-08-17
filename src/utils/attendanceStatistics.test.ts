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
  assert.equal(result.participationRate, 50);
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