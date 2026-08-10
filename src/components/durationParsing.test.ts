import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDurationValue, formatDurationLabel } from '../utils/duration';

test('parseDurationValue supports colon-based minute-second values', () => {
  assert.equal(parseDurationValue('1:30'), 1.5);
  assert.equal(parseDurationValue('2:15'), 2.25);
});

test('formatDurationLabel preserves decimal minutes', () => {
  assert.equal(formatDurationLabel(1.5), '1.5 min');
});
