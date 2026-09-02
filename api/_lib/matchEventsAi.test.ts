import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateMatchEvents,
  isYoutubeUrl,
  type GeminiClient
} from './matchEventsAi';

const baseBody = {
  matchId: 'match-1',
  videoUrl: 'https://www.youtube.com/watch?v=abc123',
  additionalNotes: '',
  matchContext: {
    homeTeam: 'Al-Ula FC',
    awayTeam: 'Rival FC',
    isHome: true,
    competition: 'Liga',
    date: '2026-01-01',
    squad: [{ id: 'p1', name: 'Jugadora Uno', shirtNumber: 7, position: 'FWD' }]
  }
};

function fakeClient(behavior: (model: string) => { text?: string } | Promise<never>): GeminiClient {
  return {
    models: {
      generateContent: async ({ model }: any) => {
        const result = behavior(model);
        return result as any;
      }
    }
  };
}

test('A. missing API key returns an error, never fabricated events', async () => {
  const result = await generateMatchEvents(baseBody, undefined);
  assert.equal(result.success, false);
  if (result.success) throw new Error('expected failure');
  assert.equal(result.errorCode, 'not_configured');
  assert.equal((result as any).events, undefined);
});

test('missing video URL is rejected before calling Gemini', async () => {
  const result = await generateMatchEvents({ ...baseBody, videoUrl: '' }, 'fake-key');
  assert.equal(result.success, false);
  if (result.success) throw new Error('expected failure');
  assert.equal(result.errorCode, 'missing_video_url');
});

test('non-YouTube video URL is rejected before calling Gemini', async () => {
  const result = await generateMatchEvents({ ...baseBody, videoUrl: 'https://vimeo.com/12345' }, 'fake-key');
  assert.equal(result.success, false);
  if (result.success) throw new Error('expected failure');
  assert.equal(result.errorCode, 'unsupported_video_source');
});

test('B. Gemini error on every model returns ERROR, 0 events, no fictitious fallback', async () => {
  const client = fakeClient(() => {
    throw new Error('quota exceeded');
  });

  const result = await generateMatchEvents(baseBody, 'fake-key', { createClient: () => client });
  assert.equal(result.success, false);
  if (result.success) throw new Error('expected failure');
  assert.equal(result.errorCode, 'analysis_failed');
  assert.equal((result as any).events, undefined);
});

test('C. video not analysable (invalid JSON from every model) returns ERROR, 0 events', async () => {
  const client = fakeClient(() => ({ text: 'not json' }));

  const result = await generateMatchEvents(baseBody, 'fake-key', { createClient: () => client });
  assert.equal(result.success, false);
  if (result.success) throw new Error('expected failure');
  assert.equal(result.errorCode, 'analysis_failed');
});

test('E. successful analysis returns videoAnalyzed:true and the real events', async () => {
  const client = fakeClient(() => ({
    text: JSON.stringify({
      summary: 'Resumen real',
      events: [
        { minute: 23, videoTimestampSeconds: 1380, eventType: 'goal', teamSide: 'our_team', description: 'Gol real observado en el vídeo' }
      ]
    })
  }));

  const result = await generateMatchEvents(baseBody, 'fake-key', { createClient: () => client });
  assert.equal(result.success, true);
  if (!result.success) throw new Error('expected success');
  assert.equal(result.videoAnalyzed, true);
  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].eventType, 'goal');
});

test('failover: first model fails, second model succeeds with video analysis', async () => {
  let calls = 0;
  const client = fakeClient((model) => {
    calls += 1;
    if (calls === 1) throw new Error(`model ${model} unavailable`);
    return { text: JSON.stringify({ summary: 'ok', events: [] }) };
  });

  const result = await generateMatchEvents(baseBody, 'fake-key', { createClient: () => client });
  assert.equal(result.success, true);
  assert.ok(calls >= 2);
});

test('isYoutubeUrl recognises known hosts and rejects others', () => {
  assert.equal(isYoutubeUrl('https://www.youtube.com/watch?v=abc'), true);
  assert.equal(isYoutubeUrl('https://youtu.be/abc'), true);
  assert.equal(isYoutubeUrl('https://vimeo.com/123'), false);
  assert.equal(isYoutubeUrl(''), false);
  assert.equal(isYoutubeUrl(undefined), false);
});
