import assert from 'node:assert/strict';
import test from 'node:test';
import {
  analyseVideo,
  applyClipMargins,
  buildFallbackSegments,
  composeObservation,
  isAnalyseVideoFailure,
  isVideoAnalysisContext,
  isVideoTooLongError,
  normaliseFinding,
  parseAnalysisResponse,
  InvalidAiResponseError,
  MAX_SEGMENTS,
  SEGMENT_LENGTH_SECONDS,
  type AnalyseVideoResult,
  type AnalyseVideoSuccess
} from './videoAnalysisAi';
import type { GeminiClient } from './matchEventsAi';

const VIDEO_URL = 'https://www.youtube.com/watch?v=testvideo';

function asSuccess(result: AnalyseVideoResult): AnalyseVideoSuccess {
  assert.equal(isAnalyseVideoFailure(result), false, `expected success, got ${JSON.stringify(result)}`);
  return result as AnalyseVideoSuccess;
}

function makeFinding(overrides: Record<string, unknown> = {}) {
  return {
    category: 'defensive_transition',
    title: 'Counter-press after loss',
    observation: 'Two midfielders press the ball carrier immediately after losing possession.',
    relevance: 'Shows their reaction speed in the first five seconds after a turnover.',
    evidence: 'Both players close within two metres before the first pass is played.',
    suggestedTags: ['counter-press'],
    confidence: 0.8,
    timestampSeconds: 120,
    endTimeSeconds: 132,
    ...overrides
  };
}

/** Fake Gemini client: returns a canned response (or throws) per call, recording requests. */
function makeClient(steps: Array<{ text?: string; error?: Error }>): { client: GeminiClient; calls: any[] } {
  const calls: any[] = [];
  let index = 0;
  const client: GeminiClient = {
    models: {
      generateContent: async (args: unknown) => {
        calls.push(args);
        const step = steps[Math.min(index, steps.length - 1)];
        index += 1;
        if (step.error) throw step.error;
        return { text: step.text };
      }
    }
  };
  return { client, calls };
}

function payload(findings: Array<Record<string, unknown>>, extra: Record<string, unknown> = {}) {
  return JSON.stringify({ summary: 'Observed summary.', patterns: [], conclusions: [], findings, ...extra });
}

test('isVideoAnalysisContext accepts only the three supported contexts', () => {
  assert.equal(isVideoAnalysisContext('my_analysis'), true);
  assert.equal(isVideoAnalysisContext('opponent_analysis'), true);
  assert.equal(isVideoAnalysisContext('scouting'), true);
  assert.equal(isVideoAnalysisContext('training'), false);
  assert.equal(isVideoAnalysisContext(undefined), false);
});

test('applyClipMargins adds margins around the action and never goes negative', () => {
  assert.deepEqual(applyClipMargins(100, 110, 8, 8), { startTime: 92, endTime: 118 });
  assert.deepEqual(applyClipMargins(3, null, 8, 8), { startTime: 0, endTime: 23 });
});

test('buildFallbackSegments produces contiguous windows covering the video', () => {
  const segments = buildFallbackSegments();
  assert.equal(segments.length, MAX_SEGMENTS);
  assert.deepEqual(segments[0], { startSeconds: 0, endSeconds: SEGMENT_LENGTH_SECONDS });
  assert.equal(segments[1].startSeconds, segments[0].endSeconds);
});

test('isVideoTooLongError only matches length/size rejections', () => {
  assert.equal(isVideoTooLongError('Request payload size exceeds the limit'), true);
  assert.equal(isVideoTooLongError('The input token count is too large'), true);
  assert.equal(isVideoTooLongError('permission denied'), false);
});

test('composeObservation merges what, why and evidence into one readable block', () => {
  const text = composeObservation({ observation: 'What', relevance: 'Why', evidence: 'Proof' });
  assert.equal(text, 'What\nWhy it matters: Why\nEvidence: Proof');
});

test('normaliseFinding keeps the action timestamp and derives the clip window', () => {
  const finding = normaliseFinding(makeFinding({ confidence: 85 }), {
    allowedCategories: ['defensive_transition'],
    marginBefore: 5,
    marginAfter: 5
  });

  assert.ok(finding);
  assert.equal(finding!.timestampSeconds, 120);
  assert.equal(finding!.startTime, 115);
  assert.equal(finding!.endTime, 137);
  assert.equal(finding!.confidence, 0.85);
  assert.equal(finding!.category, 'defensive_transition');
});

test('normaliseFinding offsets segment-relative timestamps back to the original video', () => {
  const finding = normaliseFinding(makeFinding({ timestampSeconds: 342, endTimeSeconds: 352 }), {
    offsetSeconds: 1800,
    marginBefore: 0,
    marginAfter: 0
  });

  assert.equal(finding!.timestampSeconds, 2142);
  assert.equal(finding!.startTime, 2142);
  assert.equal(finding!.endTime, 2152);
});

test('normaliseFinding drops categories outside the existing taxonomy', () => {
  const finding = normaliseFinding(makeFinding({ category: 'invented_category' }), {
    allowedCategories: ['set_piece_for']
  });
  assert.equal(finding!.category, null);
});

test('normaliseFinding rejects findings without a usable timestamp', () => {
  assert.equal(normaliseFinding(makeFinding({ timestampSeconds: undefined, startTimeSeconds: undefined })), null);
  assert.equal(normaliseFinding(makeFinding({ timestampSeconds: 'not-a-number' })), null);
});

test('parseAnalysisResponse rejects empty, invalid and incomplete payloads', () => {
  assert.throws(() => parseAnalysisResponse('', 'm'), InvalidAiResponseError);
  assert.throws(() => parseAnalysisResponse('{not json', 'm'), InvalidAiResponseError);
  assert.throws(() => parseAnalysisResponse('{"summary":"x"}', 'm'), InvalidAiResponseError);
  assert.deepEqual(parseAnalysisResponse('{"summary":"x","findings":[]}', 'm').findings, []);
});

test('analyseVideo validates context, url and api key before calling the model', async () => {
  const invalidContext = await analyseVideo({ context: 'nope', videoUrl: VIDEO_URL }, 'key');
  assert.equal((invalidContext as any).errorCode, 'invalid_context');

  const noUrl = await analyseVideo({ context: 'my_analysis' }, 'key');
  assert.equal((noUrl as any).errorCode, 'missing_video_url');

  const badSource = await analyseVideo({ context: 'my_analysis', videoUrl: 'https://vimeo.com/1' }, 'key');
  assert.equal((badSource as any).errorCode, 'unsupported_video_source');

  const noKey = await analyseVideo({ context: 'my_analysis', videoUrl: VIDEO_URL }, undefined);
  assert.equal((noKey as any).errorCode, 'not_configured');
});

test('analyseVideo analyses the whole video in a single pass when possible', async () => {
  const { client, calls } = makeClient([{ text: payload([makeFinding()]) }]);
  const result = asSuccess(
    await analyseVideo(
      { context: 'opponent_analysis', videoUrl: VIDEO_URL, taxonomy: [{ value: 'defensive_transition', label: 'Defensive Transition' }] },
      'key',
      { createClient: () => client, models: ['test-model'] }
    )
  );

  assert.equal(result.passes, 1);
  assert.equal(result.segmented, false);
  assert.equal(result.videoAnalyzed, true);
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].timestampSeconds, 120);
  // No videoMetadata means the whole video was sent as one input.
  assert.equal(calls[0].contents[0].parts[0].videoMetadata, undefined);
});

test('analyseVideo falls back to segments for a long video and keeps absolute timestamps', async () => {
  const tooLong = new Error('Request payload size exceeds the maximum allowed');
  const { client, calls } = makeClient([
    { error: tooLong },
    { text: payload([makeFinding({ timestampSeconds: 60 })]) },
    { text: payload([makeFinding({ timestampSeconds: 342 })]) },
    { error: new Error('start offset is beyond the end of the video') }
  ]);

  const result = asSuccess(
    await analyseVideo({ context: 'my_analysis', videoUrl: VIDEO_URL }, 'key', { createClient: () => client, models: ['test-model'] })
  );

  assert.equal(result.segmented, true);
  assert.equal(result.passes, 2);
  assert.deepEqual(
    result.findings.map((finding) => finding.timestampSeconds),
    [60, SEGMENT_LENGTH_SECONDS + 342]
  );
  // The second window was requested with explicit offsets, invisible to the analyst.
  assert.deepEqual(calls[2].contents[0].parts[0].videoMetadata, { startOffset: '1800s', endOffset: '3600s' });
});

test('analyseVideo stops walking segments after consecutive empty windows', async () => {
  const { client } = makeClient([
    { error: new Error('input token count is too large') },
    { text: payload([makeFinding()]) },
    { text: JSON.stringify({ summary: '', findings: [] }) },
    { text: JSON.stringify({ summary: '', findings: [] }) },
    { text: payload([makeFinding({ timestampSeconds: 10 })]) }
  ]);

  const result = asSuccess(
    await analyseVideo({ context: 'my_analysis', videoUrl: VIDEO_URL }, 'key', { createClient: () => client, models: ['test-model'] })
  );

  assert.equal(result.passes, 3);
  assert.equal(result.findings.length, 1);
});

test('analyseVideo surfaces a real error instead of inventing findings', async () => {
  const { client } = makeClient([{ error: new Error('permission denied for this video') }]);
  const result = await analyseVideo({ context: 'scouting', videoUrl: VIDEO_URL }, 'key', { createClient: () => client, models: ['test-model'] });

  assert.equal(isAnalyseVideoFailure(result), true);
  assert.equal((result as any).errorCode, 'analysis_failed');
  assert.match((result as any).error, /permission denied/);
});

test('analyseVideo reports an invalid AI response instead of storing corrupt results', async () => {
  const { client } = makeClient([{ text: '{"summary":"x"}' }]);
  const result = await analyseVideo({ context: 'my_analysis', videoUrl: VIDEO_URL }, 'key', { createClient: () => client, models: ['test-model'] });

  assert.equal((result as any).errorCode, 'invalid_ai_response');
});

test('analyseVideo rejects a response whose findings have no usable timestamps', async () => {
  const { client } = makeClient([{ text: payload([makeFinding({ timestampSeconds: null, startTimeSeconds: null })]) }]);
  const result = await analyseVideo({ context: 'my_analysis', videoUrl: VIDEO_URL }, 'key', { createClient: () => client, models: ['test-model'] });

  assert.equal((result as any).errorCode, 'invalid_ai_response');
});

test('analyseVideo accepts an honest empty analysis', async () => {
  const { client } = makeClient([{ text: payload([]) }]);
  const result = asSuccess(
    await analyseVideo({ context: 'my_analysis', videoUrl: VIDEO_URL }, 'key', { createClient: () => client, models: ['test-model'] })
  );

  assert.deepEqual(result.findings, []);
  assert.equal(result.videoAnalyzed, true);
});

test('analyseVideo never lets the model introduce a category outside the taxonomy', async () => {
  const { client } = makeClient([{ text: payload([makeFinding({ category: 'made_up' })]) }]);
  const result = asSuccess(
    await analyseVideo(
      { context: 'scouting', videoUrl: VIDEO_URL, taxonomy: [{ value: 'technical', label: 'Technical' }] },
      'key',
      { createClient: () => client, models: ['test-model'] }
    )
  );

  assert.equal(result.findings[0].category, null);
});

test('analyseVideo sorts findings chronologically', async () => {
  const { client } = makeClient([
    { text: payload([makeFinding({ timestampSeconds: 900 }), makeFinding({ timestampSeconds: 120 })]) }
  ]);
  const result = asSuccess(
    await analyseVideo({ context: 'my_analysis', videoUrl: VIDEO_URL }, 'key', { createClient: () => client, models: ['test-model'] })
  );

  assert.deepEqual(result.findings.map((finding) => finding.timestampSeconds), [120, 900]);
});
