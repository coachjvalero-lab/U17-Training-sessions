import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveTeamForSessionWrite } from './sessionTeam';

test('uses the default single-team id when no selected team is available', () => {
  const result = resolveTeamForSessionWrite({ teamId: '', teamName: '' });
  assert.equal(result.teamId, 'u17-women-alula');
  assert.equal(result.teamName, 'U17 Women Al Ula');
});
