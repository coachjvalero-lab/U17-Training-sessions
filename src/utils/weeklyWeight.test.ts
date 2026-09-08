import test from 'node:test';
import assert from 'node:assert/strict';
import type { PlayerWeeklyWeight, SquadPlayer } from '../types';
import {
  calculateWeightHistoryWithDeltas,
  compareSquadPlayers,
  formatWeightDate,
  getIsoWeekEnd,
  getIsoWeekStart,
  getLatestWeightForPlayer,
  getPreviousWeight,
  groupWeightsByPlayer,
  validateWeightInput
} from './weeklyWeight';

test('getIsoWeekStart returns Monday of the given date', () => {
  // 2026-09-08 is Tuesday -> Monday is 2026-09-07
  assert.equal(getIsoWeekStart('2026-09-08'), '2026-09-07');
  // 2026-09-07 is Monday -> Monday is 2026-09-07
  assert.equal(getIsoWeekStart('2026-09-07'), '2026-09-07');
  // 2026-09-13 is Sunday -> Monday is 2026-09-07
  assert.equal(getIsoWeekStart('2026-09-13'), '2026-09-07');
});

test('getIsoWeekEnd returns Sunday for the given week start', () => {
  assert.equal(getIsoWeekEnd('2026-09-07'), '2026-09-13');
  assert.equal(getIsoWeekEnd('2026-09-14'), '2026-09-20');
});

test('formatWeightDate formats ISO date cleanly', () => {
  assert.equal(formatWeightDate('2026-09-08'), '08 Sept 2026');
  assert.equal(formatWeightDate(''), '—');
});

test('groupWeightsByPlayer groups and orders chronologically', () => {
  const weights: PlayerWeeklyWeight[] = [
    { id: 'w3', playerId: 'p1', weekStartDate: '2026-09-22', weightKg: 61.8 },
    { id: 'w1', playerId: 'p1', weekStartDate: '2026-09-08', weightKg: 62.4 },
    { id: 'w2', playerId: 'p1', weekStartDate: '2026-09-15', weightKg: 62.1 },
    { id: 'w4', playerId: 'p2', weekStartDate: '2026-09-08', weightKg: 55.0 }
  ];

  const grouped = groupWeightsByPlayer(weights);
  assert.equal(grouped.size, 2);
  const p1List = grouped.get('p1');
  assert.ok(p1List);
  assert.equal(p1List.length, 3);
  assert.deepEqual(p1List.map((w) => w.weekStartDate), ['2026-09-08', '2026-09-15', '2026-09-22']);
});

test('getLatestWeightForPlayer retrieves the newest measurement', () => {
  const weights: PlayerWeeklyWeight[] = [
    { id: 'w1', playerId: 'p1', weekStartDate: '2026-09-08', weightKg: 62.4 },
    { id: 'w2', playerId: 'p1', weekStartDate: '2026-09-15', weightKg: 62.1 },
    { id: 'w3', playerId: 'p1', weekStartDate: '2026-09-22', weightKg: 61.8 }
  ];

  const latest = getLatestWeightForPlayer(weights, 'p1');
  assert.ok(latest);
  assert.equal(latest.weekStartDate, '2026-09-22');
  assert.equal(latest.weightKg, 61.8);
});

test('getPreviousWeight retrieves the most recent weight before the current week', () => {
  const weights: PlayerWeeklyWeight[] = [
    { id: 'w1', playerId: 'p1', weekStartDate: '2026-09-08', weightKg: 62.4 },
    { id: 'w2', playerId: 'p1', weekStartDate: '2026-09-15', weightKg: 62.1 },
    { id: 'w3', playerId: 'p1', weekStartDate: '2026-09-22', weightKg: 61.8 }
  ];

  const prev = getPreviousWeight(weights, 'p1', '2026-09-22');
  assert.ok(prev);
  assert.equal(prev.weekStartDate, '2026-09-15');
  assert.equal(prev.weightKg, 62.1);
});

test('calculateWeightHistoryWithDeltas calculates changes accurately', () => {
  const weights: PlayerWeeklyWeight[] = [
    { id: 'w1', playerId: 'p1', weekStartDate: '2026-09-08', weightKg: 62.4 },
    { id: 'w2', playerId: 'p1', weekStartDate: '2026-09-15', weightKg: 62.1 },
    { id: 'w3', playerId: 'p1', weekStartDate: '2026-09-22', weightKg: 61.8 },
    { id: 'w4', playerId: 'p1', weekStartDate: '2026-09-29', weightKg: 62.3 }
  ];

  const history = calculateWeightHistoryWithDeltas(weights);
  // Returned newest first:
  assert.equal(history.length, 4);
  assert.equal(history[0].weekStartDate, '2026-09-29');
  assert.equal(history[0].weightKg, 62.3);
  assert.equal(history[0].deltaKg, 0.5); // 62.3 - 61.8 = +0.5

  assert.equal(history[1].weekStartDate, '2026-09-22');
  assert.equal(history[1].weightKg, 61.8);
  assert.equal(history[1].deltaKg, -0.3); // 61.8 - 62.1 = -0.3

  assert.equal(history[2].weekStartDate, '2026-09-15');
  assert.equal(history[2].weightKg, 62.1);
  assert.equal(history[2].deltaKg, -0.3); // 62.1 - 62.4 = -0.3

  assert.equal(history[3].weekStartDate, '2026-09-08');
  assert.equal(history[3].weightKg, 62.4);
  assert.equal(history[3].deltaKg, null); // First recorded measurement
});

test('validateWeightInput validates numbers correctly', () => {
  assert.deepEqual(validateWeightInput('62.4'), { valid: true, weightKg: 62.4 });
  assert.deepEqual(validateWeightInput(58.7), { valid: true, weightKg: 58.7 });
  assert.equal(validateWeightInput('').valid, false);
  assert.equal(validateWeightInput('-5').valid, false);
  assert.equal(validateWeightInput('abc').valid, false);
  assert.equal(validateWeightInput('10').valid, false); // < 25 kg
  assert.equal(validateWeightInput('350').valid, false); // > 250 kg
});

test('compareSquadPlayers sorts by squad number first', () => {
  const p1: SquadPlayer = { id: '1', firstName: 'Khulud', lastName: 'Khaled', number: '10', position: 'ST', status: 'Active' };
  const p2: SquadPlayer = { id: '2', firstName: 'Asma', lastName: 'Azis', number: '4', position: 'CM', status: 'Active' };
  const p3: SquadPlayer = { id: '3', firstName: 'Sara', lastName: 'Salem', number: undefined, position: 'GK', status: 'Active' };

  const sorted = [p1, p3, p2].sort(compareSquadPlayers);
  assert.equal(sorted[0].id, '2'); // #4
  assert.equal(sorted[1].id, '1'); // #10
  assert.equal(sorted[2].id, '3'); // unnumbered
});
