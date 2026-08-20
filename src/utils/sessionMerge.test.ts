import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeSessionsForDisplay } from './sessionMerge';
import type { CloudTrainingSession, TrainingSession } from '../types';

function createSession(overrides: Partial<CloudTrainingSession> = {}): CloudTrainingSession {
  return {
    id: 'session-1',
    sessionNumber: '10',
    date: '2026-08-01',
    time: '18:00',
    teamName: 'U17 Women Al Ula',
    microcycleDay: 'MD-2',
    materialsNeeded: '',
    mainObjective: 'Test',
    updatedAt: Date.now(),
    warmUp: { id: 'w1', title: 'Warmup', exercises: [] },
    mainPart: { id: 'm1', title: 'Main', exercises: [] },
    coolDown: { id: 'c1', title: 'Cool down', exercises: [] },
    playerGroups: [],
    squadRoster: [],
    attendance: [],
    fitnessWarmUp: { id: 'fw1', title: 'Fitness Warmup', exercises: [] },
    fitnessMainPart: { id: 'fm1', title: 'Fitness Main', exercises: [] },
    fitnessCoolDown: { id: 'fc1', title: 'Fitness Cool down', exercises: [] },
    fitnessPlayerGroups: [],
    gkWarmUp: { id: 'gw1', title: 'GK Warmup', exercises: [] },
    gkMainPart: { id: 'gm1', title: 'GK Main', exercises: [] },
    gkCoolDown: { id: 'gc1', title: 'GK Cool down', exercises: [] },
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
