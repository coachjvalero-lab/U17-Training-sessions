import assert from 'node:assert/strict';
import test from 'node:test';
import type { MatchEvent, VideoAiFinding } from '../types';
import {
  buildClipFromFinding,
  buildVideoUrlAtSecond,
  canConfirmFinding,
  findMatchEventForClipWindow,
  formatConfidence,
  reviewStatusAfterConfirm
} from './videoAiFindings';

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

function makeFinding(overrides: Partial<VideoAiFinding> = {}): VideoAiFinding {
  return {
    id: 'finding-1',
    context: 'opponent_analysis',
    matchAnalysisId: 'analysis-1',
    category: 'set_piece_against',
    title: 'Near-post corner routine',
    observation: 'Two blockers screen the keeper.\nWhy it matters: recurring routine.',
    suggestedTags: ['corner', 'blocking'],
    confidence: 0.7,
    reviewStatus: 'pending',
    videoUrl: 'https://www.youtube.com/watch?v=abc',
    timestampSeconds: 3810,
    startTime: 3802,
    endTime: 3830,
    ...overrides
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

test('canConfirmFinding only allows pending findings, preventing duplicate clips', () => {
  assert.equal(canConfirmFinding(makeFinding()), true);
  assert.equal(canConfirmFinding(makeFinding({ reviewStatus: 'confirmed' })), false);
  assert.equal(canConfirmFinding(makeFinding({ reviewStatus: 'edited' })), false);
  assert.equal(canConfirmFinding(makeFinding({ reviewStatus: 'rejected' })), false);
});

test('reviewStatusAfterConfirm distinguishes a plain confirm from an edited one', () => {
  assert.equal(reviewStatusAfterConfirm(false), 'confirmed');
  assert.equal(reviewStatusAfterConfirm(true), 'edited');
});

test('buildClipFromFinding carries category, tags and evidence into the real clip', () => {
  const clip = buildClipFromFinding(makeFinding(), 'https://fallback');

  assert.equal(clip.videoUrl, 'https://www.youtube.com/watch?v=abc');
  assert.equal(clip.startTime, 3802);
  assert.equal(clip.endTime, 3830);
  assert.equal(clip.category, 'set_piece_against');
  assert.equal(clip.aiFindingId, 'finding-1');
  assert.equal(clip.matchEventId, null);
  assert.match(clip.notes as string, /Tags: corner, blocking/);
});

test('buildClipFromFinding references an existing match event instead of duplicating it', () => {
  const clip = buildClipFromFinding(makeFinding(), 'https://fallback', [makeEvent('event-9', 3811), makeEvent('far', 10)]);
  assert.equal(clip.matchEventId, 'event-9');
});

test('buildClipFromFinding falls back to the analysis video url and the action timestamp', () => {
  const clip = buildClipFromFinding(
    makeFinding({ videoUrl: null, startTime: null, endTime: null, suggestedTags: [] }),
    'https://fallback'
  );

  assert.equal(clip.videoUrl, 'https://fallback');
  assert.equal(clip.startTime, 3810);
  assert.equal(clip.endTime, null);
  assert.equal(clip.notes, 'Two blockers screen the keeper.\nWhy it matters: recurring routine.');
});
