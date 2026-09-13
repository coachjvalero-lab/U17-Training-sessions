import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyClipMargins,
  buildSegments,
  isVideoAnalysisContext,
  normaliseFinding,
  MAX_SEGMENT_LENGTH_SECONDS
} from './videoAnalysisAi';

test('isVideoAnalysisContext accepts only the three supported contexts', () => {
  assert.equal(isVideoAnalysisContext('my_analysis'), true);
  assert.equal(isVideoAnalysisContext('opponent_analysis'), true);
  assert.equal(isVideoAnalysisContext('scouting'), true);
  assert.equal(isVideoAnalysisContext('training'), false);
  assert.equal(isVideoAnalysisContext(undefined), false);
});

test('buildSegments returns no segments for short or unknown durations', () => {
  assert.deepEqual(buildSegments(undefined), []);
  assert.deepEqual(buildSegments(0), []);
  assert.deepEqual(buildSegments(MAX_SEGMENT_LENGTH_SECONDS), []);
});

test('buildSegments splits long footage into sequential windows', () => {
  const segments = buildSegments(2000, 900);
  assert.deepEqual(segments, [
    { startSeconds: 0, endSeconds: 900 },
    { startSeconds: 900, endSeconds: 1800 },
    { startSeconds: 1800, endSeconds: 2000 }
  ]);
});

test('buildSegments never exceeds the maximum number of segments', () => {
  assert.equal(buildSegments(100000, 900, 4).length, 4);
});

test('applyClipMargins adds margins and never goes negative', () => {
  assert.deepEqual(applyClipMargins(100, 110, 8, 8), { startTime: 92, endTime: 118 });
  assert.deepEqual(applyClipMargins(3, null, 8, 8), { startTime: 0, endTime: 23 });
});

test('normaliseFinding offsets segment timestamps and clamps confidence', () => {
  const finding = normaliseFinding(
    {
      title: 'High press trap',
      observation: 'Wing trap forcing a turnover.',
      category: 'defensive_transition',
      confidence: 85,
      startTimeSeconds: 30,
      endTimeSeconds: 40,
      suggestedTags: ['press', '  ', 'turnover']
    },
    { offsetSeconds: 900, allowedCategories: ['defensive_transition'], marginBefore: 5, marginAfter: 5 }
  );

  assert.ok(finding);
  assert.equal(finding!.startTime, 925);
  assert.equal(finding!.endTime, 945);
  assert.equal(finding!.confidence, 0.85);
  assert.deepEqual(finding!.suggestedTags, ['press', 'turnover']);
  assert.equal(finding!.category, 'defensive_transition');
});

test('normaliseFinding drops categories outside the existing taxonomy', () => {
  const finding = normaliseFinding(
    { title: 'X', observation: 'Y', category: 'invented_category', startTimeSeconds: 10 },
    { allowedCategories: ['set_piece_for'] }
  );
  assert.equal(finding!.category, null);
});

test('normaliseFinding ignores empty findings', () => {
  assert.equal(normaliseFinding({ startTimeSeconds: 10 }), null);
});
