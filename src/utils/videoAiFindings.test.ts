import assert from 'node:assert/strict';
import test from 'node:test';
import type { MatchEvent } from '../types';
import { buildVideoUrlAtSecond, findMatchEventForClipWindow, formatConfidence } from './videoAiFindings';

function makeEvent(id: string, videoTimestampSeconds: number): MatchEvent {
  return {
    id,
    matchId: 'match-1',
    playerId: null,
    teamSide: 'our_team',
    eventType: 'corner',
    minute: Math.floor(videoTimestampSeconds / 60),
    videoTimestampSeconds,
    relatedPlayerId: null,
    description: ''
  };
}

test('findMatchEventForClipWindow links the closest event inside tolerance', () => {
  const events = [makeEvent('a', 100), makeEvent('b', 3801), makeEvent('c', 5000)];
  const found = findMatchEventForClipWindow(events, 3790, 3820);
  assert.equal(found?.id, 'b');
});

test('findMatchEventForClipWindow returns null when nothing is close enough', () => {
  const events = [makeEvent('a', 100)];
  assert.equal(findMatchEventForClipWindow(events, 3790, 3820), null);
  assert.equal(findMatchEventForClipWindow([], 10, 20), null);
});

test('findMatchEventForClipWindow prefers the nearest of two candidates', () => {
  const events = [makeEvent('far', 80), makeEvent('near', 95)];
  assert.equal(findMatchEventForClipWindow(events, 100, 120)?.id, 'near');
});

test('formatConfidence renders percentages and a dash for missing values', () => {
  assert.equal(formatConfidence(0.85), '85%');
  assert.equal(formatConfidence(null), '—');
  assert.equal(formatConfidence(undefined), '—');
});

test('buildVideoUrlAtSecond appends a start time to the video link', () => {
  assert.equal(
    buildVideoUrlAtSecond('https://www.youtube.com/watch?v=abc', 125),
    'https://www.youtube.com/watch?v=abc&t=125s'
  );
  assert.equal(buildVideoUrlAtSecond('https://www.youtube.com/watch?v=abc', 0), 'https://www.youtube.com/watch?v=abc');
});
