import assert from 'node:assert/strict';
import test from 'node:test';
import {
  alignTimestampWithEvidence,
  analyseVideo,
  applyClipMargins,
  buildSegments,
  composeObservation,
  dedupeFindings,
  describesSameSituation,
  isAnalyseVideoFailure,
  isFindingCategoryAllowed,
  isVideoAnalysisContext,
  normaliseFinding,
  parseAnalysisResponse,
  InvalidAiResponseError,
  MAX_SEGMENTS,
  SEGMENT_LENGTH_SECONDS,
  SEGMENT_OVERLAP_SECONDS,
  type AnalyseVideoResult,
  type AnalyseVideoSuccess,
  type GeneratedVideoFinding
} from './videoAnalysisAi.js';
import type { GeminiClient } from './matchEventsAi.js';

const VIDEO_URL = 'https://www.youtube.com/watch?v=testvideo';
const TAXONOMY = [
  { value: 'defensive_transition', label: 'Defensive Transition' },
  { value: 'set_piece_against', label: 'Set Piece Against' }
];

function asSuccess(result: AnalyseVideoResult): AnalyseVideoSuccess {
  assert.equal(isAnalyseVideoFailure(result), false, `expected success, got ${JSON.stringify(result)}`);
  return result as AnalyseVideoSuccess;
}

function makeRawFinding(overrides: Record<string, unknown> = {}) {
  return {
    category: 'defensive_transition',
    title: 'Counter-press after loss',
    observation: 'The white team loses the ball and two midfielders press the carrier immediately.',
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

const EMPTY_PAYLOAD = JSON.stringify({ summary: '', findings: [] });

function run(body: Record<string, unknown>, client: GeminiClient) {
  return analyseVideo({ videoUrl: VIDEO_URL, taxonomy: TAXONOMY, ...body }, 'key', {
    createClient: () => client,
    models: ['test-model']
  });
}

function makeFinding(overrides: Partial<GeneratedVideoFinding> = {}): GeneratedVideoFinding {
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

test('buildSegments produces 15 minute windows overlapping by 10 seconds', () => {
  const segments = buildSegments();
  assert.equal(segments.length, MAX_SEGMENTS);
  assert.deepEqual(segments[0], { startSeconds: 0, endSeconds: 900 });
  assert.deepEqual(segments[1], { startSeconds: 890, endSeconds: 1790 });
  assert.deepEqual(segments[2], { startSeconds: 1780, endSeconds: 2680 });
  assert.equal(segments[0].endSeconds - segments[1].startSeconds, SEGMENT_OVERLAP_SECONDS);
  assert.equal(segments[0].endSeconds - segments[0].startSeconds, SEGMENT_LENGTH_SECONDS);
});

test('composeObservation merges what, why and evidence into one readable block', () => {
  const text = composeObservation({ observation: 'What', relevance: 'Why', evidence: 'Proof' });
  assert.equal(text, 'What\nWhy it matters: Why\nEvidence: Proof');
});

test('alignTimestampWithEvidence snaps the timestamp to the second quoted in the evidence', () => {
  assert.equal(alignTimestampWithEvidence(748, 'At 12:55, the opponent loses possession.'), 775);
  assert.equal(alignTimestampWithEvidence(748, 'The defenders drop deep.'), 748);
  // A quote outside this window is a match minute, not a video second: keep the model's value.
  assert.equal(alignTimestampWithEvidence(320, 'At 38:55 the block steps up.', 900), 320);
});

test('normaliseFinding keeps the decisive timestamp and derives the clip window', () => {
  const finding = normaliseFinding(makeRawFinding({ confidence: 85, evidence: 'Clear contact.' }), {
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
  const finding = normaliseFinding(makeRawFinding({ timestampSeconds: 342, endTimeSeconds: 352, evidence: 'Clear contact.' }), {
    offsetSeconds: 890,
    marginBefore: 0,
    marginAfter: 0
  });

  assert.equal(finding!.timestampSeconds, 1232);
  assert.equal(finding!.startTime, 1232);
  assert.equal(finding!.endTime, 1242);
});

test('normaliseFinding rejects findings without a usable timestamp', () => {
  assert.equal(normaliseFinding(makeRawFinding({ timestampSeconds: undefined, startTimeSeconds: undefined })), null);
  assert.equal(normaliseFinding(makeRawFinding({ timestampSeconds: 'not-a-number' })), null);
});

test('isFindingCategoryAllowed only accepts the existing taxonomy values', () => {
  const allowed = TAXONOMY.map((entry) => entry.value);
  assert.equal(isFindingCategoryAllowed({ category: 'set_piece_against' }, allowed), true);
  assert.equal(isFindingCategoryAllowed({ category: 'made_up' }, allowed), false);
  assert.equal(isFindingCategoryAllowed({ category: null }, allowed), false);
  assert.equal(isFindingCategoryAllowed({ category: null }, []), true);
});

test('describesSameSituation separates different actions from repeated ones', () => {
  const a = makeFinding();
  const sameAction = makeFinding({ title: 'Immediate counter-press', observation: 'White team loses the ball and presses the carrier immediately near the halfway line.' });
  const otherAction = makeFinding({ title: 'Corner delivered to near post', observation: 'The blue team swings a corner towards the near post and clears the second ball.' });

  assert.equal(describesSameSituation(a, sameAction), true);
  assert.equal(describesSameSituation(a, otherAction), false);
  assert.equal(describesSameSituation(a, makeFinding({ category: 'set_piece_against' })), false);
});

test('dedupeFindings removes the same action seen twice in the overlap and keeps the best copy', () => {
  const first = { finding: makeFinding({ confidence: 0.5 }), segmentIndex: 0, segment: null };
  const second = {
    finding: makeFinding({ confidence: 0.9, timestampSeconds: 897, title: 'Immediate counter-press' }),
    segmentIndex: 1,
    segment: null
  };

  const result = dedupeFindings([first, second]);
  assert.equal(result.length, 1);
  assert.equal(result[0].confidence, 0.9);
});

test('dedupeFindings keeps two different actions that happen close together', () => {
  const press = { finding: makeFinding(), segmentIndex: 0, segment: null };
  const corner = {
    finding: makeFinding({
      timestampSeconds: 897,
      title: 'Corner delivered to near post',
      observation: 'The blue team swings a corner towards the near post and clears the second ball.'
    }),
    segmentIndex: 1,
    segment: null
  };

  assert.equal(dedupeFindings([press, corner]).length, 2);
});

test('dedupeFindings never merges two sightings from the same segment', () => {
  const a = { finding: makeFinding(), segmentIndex: 0, segment: null };
  const b = { finding: makeFinding({ timestampSeconds: 898 }), segmentIndex: 0, segment: null };
  assert.equal(dedupeFindings([a, b]).length, 2);
});

test('dedupeFindings returns findings in chronological order', () => {
  const later = { finding: makeFinding({ timestampSeconds: 2000, title: 'Late cutback' }), segmentIndex: 2, segment: null };
  const earlier = { finding: makeFinding({ timestampSeconds: 100, title: 'Early regain' }), segmentIndex: 0, segment: null };
  assert.deepEqual(dedupeFindings([later, earlier]).map((f) => f.timestampSeconds), [100, 2000]);
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

test('analyseVideo always sweeps in overlapping segments and rebuilds absolute timestamps', async () => {
  const { client, calls } = makeClient([
    { text: payload([makeRawFinding({ timestampSeconds: 60 })]) },
    { text: payload([makeRawFinding({ timestampSeconds: 342, title: 'Second half press', observation: 'Blue team traps the carrier on the touchline after a long ball.' })]) },
    { text: EMPTY_PAYLOAD },
    { text: EMPTY_PAYLOAD }
  ]);

  const result = asSuccess(await run({ context: 'opponent_analysis' }, client));

  assert.equal(result.segmented, true);
  assert.equal(result.passes, 4);
  assert.deepEqual(result.findings.map((finding) => finding.timestampSeconds), [60, 890 + 342]);
  assert.deepEqual(calls[0].contents[0].parts[0].videoMetadata, { startOffset: '0s', endOffset: '900s' });
  assert.deepEqual(calls[1].contents[0].parts[0].videoMetadata, { startOffset: '890s', endOffset: '1790s' });
});

test('analyseVideo stops sweeping after consecutive empty segments', async () => {
  const { client, calls } = makeClient([
    { text: payload([makeRawFinding()]) },
    { text: EMPTY_PAYLOAD },
    { text: EMPTY_PAYLOAD },
    { text: payload([makeRawFinding({ timestampSeconds: 10 })]) }
  ]);

  const result = asSuccess(await run({ context: 'my_analysis' }, client));
  assert.equal(result.passes, 3);
  assert.equal(calls.length, 3);
  assert.equal(result.findings.length, 1);
});

test('analyseVideo stops sweeping when a later segment runs past the end of the video', async () => {
  const { client } = makeClient([
    { text: payload([makeRawFinding()]) },
    { error: new Error('start offset is beyond the end of the video') }
  ]);

  const result = asSuccess(await run({ context: 'my_analysis' }, client));
  assert.equal(result.passes, 1);
  assert.equal(result.findings.length, 1);
});

test('analyseVideo surfaces a real error instead of inventing findings', async () => {
  const { client } = makeClient([{ error: new Error('permission denied for this video') }]);
  const result = await run({ context: 'scouting' }, client);

  assert.equal(isAnalyseVideoFailure(result), true);
  assert.equal((result as any).errorCode, 'analysis_failed');
  assert.match((result as any).error, /permission denied/);
});

test('analyseVideo reports an invalid AI response instead of storing corrupt results', async () => {
  const { client } = makeClient([{ text: '{"summary":"x"}' }]);
  const result = await run({ context: 'my_analysis' }, client);
  assert.equal((result as any).errorCode, 'invalid_ai_response');
});

test('analyseVideo rejects a response whose findings have no usable timestamps', async () => {
  const { client } = makeClient([{ text: payload([makeRawFinding({ timestampSeconds: null, startTimeSeconds: null })]) }]);
  const result = await run({ context: 'my_analysis' }, client);
  assert.equal((result as any).errorCode, 'invalid_ai_response');
});

test('analyseVideo accepts an honest empty analysis', async () => {
  const { client } = makeClient([{ text: payload([]) }]);
  const result = asSuccess(await run({ context: 'my_analysis' }, client));
  assert.deepEqual(result.findings, []);
  assert.equal(result.videoAnalyzed, true);
});

test('analyseVideo drops a finding whose category is outside the taxonomy', async () => {
  const { client } = makeClient([
    { text: payload([makeRawFinding({ category: 'made_up' }), makeRawFinding({ timestampSeconds: 200 })]) },
    { text: EMPTY_PAYLOAD },
    { text: EMPTY_PAYLOAD }
  ]);

  const result = asSuccess(await run({ context: 'scouting' }, client));
  assert.deepEqual(result.findings.map((finding) => finding.category), ['defensive_transition']);
});

test('analyseVideo sends the category enum and the kit colours to the model', async () => {
  const { client, calls } = makeClient([{ text: EMPTY_PAYLOAD }]);
  await run(
    { context: 'opponent_analysis', kits: { ourKitColour: 'red shirts', opponentKitColour: 'white shirts' } },
    client
  );

  assert.deepEqual(calls[0].config.responseSchema.properties.findings.items.properties.category.enum, [
    'defensive_transition',
    'set_piece_against'
  ]);
  assert.equal(calls[0].config.mediaResolution, 'MEDIA_RESOLUTION_MEDIUM');

  const prompt = calls[0].contents[0].parts[1].text;
  assert.match(prompt, /"our team" wears: red shirts/);
  assert.match(prompt, /"the opponent" wears: white shirts/);
  assert.match(prompt, /never identify individual players by name/);
  assert.match(prompt, /SYSTEMATIC SWEEP/);
});
