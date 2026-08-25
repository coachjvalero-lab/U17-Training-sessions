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

test('preserves session numbers with leading zeros exactly and keeps 020 distinct from 20', () => {
  const session020 = createSession({ id: 'fit-020', sessionNumber: '020', mainObjective: 'Session 020' });
  const session20 = createSession({ id: 'fit-20', sessionNumber: '20', mainObjective: 'Session 20' });
  const activeDraft = createSession({ id: '', sessionNumber: '020', mainObjective: 'Active 020' });

  const result = mergeSessionsForDisplay([session020, session20], activeDraft);

  assert.equal(result.length, 2);
  const found020 = result.find((s) => s.id === 'fit-020');
  const found20 = result.find((s) => s.id === 'fit-20');

  assert.ok(found020);
  assert.ok(found20);
  assert.equal(found020.sessionNumber, '020');
  assert.equal(found20.sessionNumber, '20');
  assert.notEqual(found020.sessionNumber, found20.sessionNumber);
});

