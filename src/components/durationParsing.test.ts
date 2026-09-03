import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDurationValue, formatDurationLabel, calculateSessionTotalDurationMinutes } from '../utils/duration';
import type { TrainingBlock } from '../types';

const block = (durations: Array<string | undefined>): TrainingBlock => ({
  id: 'b',
  title: 'b',
  exercises: durations.map((duration, index) => ({
    id: `e${index}`,
    name: '',
    gameMoment: '-',
    subMoment: '',
    description: '',
    duration: duration as string,
    dimensions: '',
    coachRoles: ''
  }))
});

test('parseDurationValue supports colon-based minute-second values', () => {
  assert.equal(parseDurationValue('1:30'), 1.5);
  assert.equal(parseDurationValue('2:15'), 2.25);
});

test('formatDurationLabel preserves decimal minutes', () => {
  assert.equal(formatDurationLabel(1.5), '1.5 min');
});

test('calculateSessionTotalDurationMinutes sums every block exercise', () => {
  const total = calculateSessionTotalDurationMinutes([
    block(['15 min']),
    block(['20 min', '30 min']),
    block(['15 min'])
  ]);
  assert.equal(total, 80);
});

test('calculateSessionTotalDurationMinutes treats missing or invalid durations as zero', () => {
  assert.equal(calculateSessionTotalDurationMinutes([]), 0);
  assert.equal(calculateSessionTotalDurationMinutes([undefined]), 0);
  assert.equal(calculateSessionTotalDurationMinutes([block([undefined, '', 'n/a', '10 min'])]), 10);
});
