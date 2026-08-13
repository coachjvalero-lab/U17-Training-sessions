import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveTeamNameForSessionWrite } from './sessionTeam';

test('uses the default single-team name when no selected team is available', () => {
  const result = resolveTeamNameForSessionWrite({ teamName: '' });
  assert.equal(result, 'U17 Women Al Ula');
});
