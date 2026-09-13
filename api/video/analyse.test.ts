import assert from 'node:assert/strict';
import test from 'node:test';
import { statusForAnalyseVideoError } from './analyse';

test('statusForAnalyseVideoError maps server, upstream and client errors', () => {
  assert.equal(statusForAnalyseVideoError('not_configured'), 500);
  assert.equal(statusForAnalyseVideoError('analysis_failed'), 502);
  assert.equal(statusForAnalyseVideoError('invalid_ai_response'), 502);
  assert.equal(statusForAnalyseVideoError('missing_video_url'), 400);
  assert.equal(statusForAnalyseVideoError('unsupported_video_source'), 400);
  assert.equal(statusForAnalyseVideoError('invalid_context'), 400);
});
