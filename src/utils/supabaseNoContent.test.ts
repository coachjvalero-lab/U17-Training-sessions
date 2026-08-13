import test from 'node:test';
import assert from 'node:assert/strict';
import { isNoContentSuccess } from './supabaseNoContent';

test('treats PGRST204 as successful no-content response', () => {
  assert.equal(isNoContentSuccess({ code: 'PGRST204', message: 'No content' }), true);
});

test('treats no-content text messages as successful response', () => {
  assert.equal(isNoContentSuccess({ code: '42P01', message: 'No content returned from the server' }), true);
});

test('does not treat a missing-column schema cache error as success', () => {
  assert.equal(
    isNoContentSuccess({
      code: 'PGRST204',
      message: "Could not find the 'team_id' column of 'sessions' in the schema cache"
    }),
    false
  );
});
