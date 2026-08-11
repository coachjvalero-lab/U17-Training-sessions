import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeSessionsForDisplay } from './sessionMerge';

function createSession(overrides: Partial<any> = {}) {
  return {
    id: 'session-1',
    sessionNumber: '10',
    mainObjective: 'Test',
    warmUp: { exercises: [] },
    mainPart: { exercises: [] },
    coolDown: { exercises: [] },
    playerGroups: [],
    squadRoster: [],
    attendance: [],
    fitnessWarmUp: { exercises: [] },
    fitnessMainPart: { exercises: [] },
    fitnessCoolDown: { exercises: [] },
    fitnessPlayerGroups: [],
    gkWarmUp: { exercises: [] },
    gkMainPart: { exercises: [] },
    gkCoolDown: { exercises: [] },
    gkPlayerGroups: [],
    ...overrides
  };
}

test('preserves a cloud session when the active draft shares the same session number', () => {
  const cloudSession = createSession({ id: 'cloud-1' });
  const activeDraft = createSession({ id: '', sessionNumber: '10', mainObjective: 'Draft changes' });

  const result = mergeSessionsForDisplay([cloudSession], activeDraft);

  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'cloud-1');
  assert.equal(result[0].sessionNumber, '10');
});
