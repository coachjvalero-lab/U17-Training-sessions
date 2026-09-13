import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildSegments,
  dedupeFindings,
  describesSameSituation,
  MAX_SEGMENTS,
  SEGMENT_LENGTH_SECONDS,
  SEGMENT_OVERLAP_SECONDS,
  type AnalysedFinding,
  type SegmentedFinding
} from './videoAnalysisSegments';

function makeFinding(overrides: Partial<AnalysedFinding> = {}): AnalysedFinding {
  return {
    category: 'defensive_transition',
    title: 'Counter-press after loss',
    observation: 'The white team loses the ball and presses the carrier immediately near the halfway line.',
    suggestedTags: [],
    confidence: 0.6,
    timestampSeconds: 895,
    startTime: 887,
    endTime: 915,
    ...overrides
  };
}

function entry(finding: AnalysedFinding, segmentIndex: number, persisted = false): SegmentedFinding {
  return { finding, segmentIndex, persisted };
}

test('buildSegments produces 15 minute windows overlapping by 10 seconds', () => {
  const segments = buildSegments();
  assert.equal(segments.length, MAX_SEGMENTS);
  assert.deepEqual(segments[0], { startSeconds: 0, endSeconds: 900 });
  assert.deepEqual(segments[1], { startSeconds: 890, endSeconds: 1790 });
  assert.deepEqual(segments[2], { startSeconds: 1780, endSeconds: 2680 });
  assert.equal(segments[0].endSeconds - segments[1].startSeconds, SEGMENT_OVERLAP_SECONDS);
  assert.equal(segments[0].endSeconds - segments[0].startSeconds, SEGMENT_LENGTH_SECONDS);
});

test('describesSameSituation separates different actions from repeated ones', () => {
  const a = makeFinding();
  const sameAction = makeFinding({
    title: 'Immediate counter-press',
    observation: 'White team loses the ball and presses the carrier immediately near the halfway line.'
  });
  const otherAction = makeFinding({
    title: 'Corner delivered to near post',
    observation: 'The blue team swings a corner towards the near post and clears the second ball.'
  });

  assert.equal(describesSameSituation(a, sameAction), true);
  assert.equal(describesSameSituation(a, otherAction), false);
  assert.equal(describesSameSituation(a, makeFinding({ category: 'set_piece_against' })), false);
});

test('dedupeFindings removes the same action seen twice in the overlap and keeps the best copy', () => {
  const first = entry(makeFinding({ confidence: 0.5 }), 0);
  const second = entry(makeFinding({ confidence: 0.9, timestampSeconds: 897, title: 'Immediate counter-press' }), 1);

  const result = dedupeFindings([first, second]);
  assert.equal(result.length, 1);
  assert.equal(result[0].finding.confidence, 0.9);
});

test('dedupeFindings keeps two different actions that happen close together', () => {
  const press = entry(makeFinding(), 0);
  const corner = entry(
    makeFinding({
      timestampSeconds: 897,
      title: 'Corner delivered to near post',
      observation: 'The blue team swings a corner towards the near post and clears the second ball.'
    }),
    1
  );

  assert.equal(dedupeFindings([press, corner]).length, 2);
});

test('dedupeFindings never merges two sightings from the same segment', () => {
  const a = entry(makeFinding(), 0);
  const b = entry(makeFinding({ timestampSeconds: 898 }), 0);
  assert.equal(dedupeFindings([a, b]).length, 2);
});

test('dedupeFindings returns findings in chronological order', () => {
  const later = entry(makeFinding({ timestampSeconds: 2000, title: 'Late cutback' }), 2);
  const earlier = entry(makeFinding({ timestampSeconds: 100, title: 'Early regain' }), 0);
  assert.deepEqual(dedupeFindings([later, earlier]).map((item) => item.finding.timestampSeconds), [100, 2000]);
});

test('dedupeFindings never replaces an already stored finding', () => {
  const stored = entry(makeFinding({ confidence: 0.2 }), 0, true);
  const better = entry(makeFinding({ confidence: 0.95, timestampSeconds: 897, title: 'Immediate counter-press' }), 1);

  const result = dedupeFindings([stored, better]);
  assert.equal(result.length, 1);
  assert.equal(result[0].persisted, true);
  assert.equal(result[0].finding.confidence, 0.2);
});
