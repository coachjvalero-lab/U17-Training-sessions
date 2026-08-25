import test from 'node:test';
import assert from 'node:assert/strict';
import { getEmptySession } from '../defaultSession';
import type { Exercise, FitnessSession, TrainingSession } from '../types';
import {
  findMatchingFitnessSession,
  getModuleSessionView,
  mergeFootballSessionWithFitnessSource,
  resolveLinkedFitnessForFootballSession,
  updateSessionExercisesByModule
} from './trainingModules';

function makeExercise(id: string, name: string, overrides: Partial<Exercise> = {}): Exercise {
  return {
    id,
    name,
    gameMoment: 'Attack',
    subMoment: '',
    description: '',
    duration: '10 min',
    dimensions: '20x20m',
    coachRoles: '',
    ...overrides
  };
}

function makeSession(): TrainingSession {
  const base = getEmptySession();
  return {
    ...base,
    id: 'session-001',
    teamName: 'U17 Women Al Ula',
    date: '2026-08-11',
    time: '18:30 - 20:00',
    sessionNumber: '25',
    microcycleDay: 'MD-3'
  };
}

test('football warm-up renders fitness warm-up + fitness main part + football warm-up', () => {
  const session = makeSession();
  session.fitnessWarmUp = {
    id: 'fwu',
    title: 'Warm Up',
    exercises: [makeExercise('fit-a', 'Fitness A', { isFitness: true })]
  };
  session.fitnessMainPart = {
    id: 'fmp',
    title: 'Main Part',
    exercises: [makeExercise('fit-b', 'Fitness B', { isFitness: true })]
  };
  session.warmUp = {
    id: 'fow',
    title: 'Warm Up',
    exercises: [makeExercise('fb-c', 'Football C')]
  };

  const view = getModuleSessionView(session, 'football');
  assert.deepEqual(view.warmUp.exercises.map((exercise) => exercise.id), ['fit-a', 'fit-b', 'fb-c']);
});

test('football cool-down renders fitness cool-down + football cool-down', () => {
  const session = makeSession();
  session.fitnessCoolDown = {
    id: 'fcd',
    title: 'Cool Down',
    exercises: [makeExercise('fit-cd', 'Fitness Cool', { isFitness: true })]
  };
  session.coolDown = {
    id: 'focd',
    title: 'Cool Down',
    exercises: [makeExercise('fb-cd', 'Football Cool')]
  };

  const view = getModuleSessionView(session, 'football');
  assert.deepEqual(view.coolDown.exercises.map((exercise) => exercise.id), ['fit-cd', 'fb-cd']);
});

test('football main part stays football-owned only', () => {
  const session = makeSession();
  session.mainPart = {
    id: 'fomp',
    title: 'Main Part',
    exercises: [makeExercise('fb-main', 'Football Main')]
  };
  session.fitnessMainPart = {
    id: 'fmp',
    title: 'Main Part',
    exercises: [makeExercise('fit-main', 'Fitness Main', { isFitness: true })]
  };

  const view = getModuleSessionView(session, 'football');
  assert.deepEqual(view.mainPart.exercises.map((exercise) => exercise.id), ['fb-main']);
});

test('football exercise updates never persist fitness overlay exercises', () => {
  const session = makeSession();
  const updated = updateSessionExercisesByModule(session, 'football', 'warmUp', [
    makeExercise('fit-a', 'Fitness A', { isFitness: true }),
    makeExercise('fb-a', 'Football A')
  ]);

  assert.deepEqual(updated.warmUp.exercises.map((exercise) => exercise.id), ['fb-a']);
});

test('football linked fitness merge updates only fitness-owned fields', () => {
  const session = makeSession();
  const linked = {
    fitnessWarmUp: {
      id: 'fit-warm',
      title: 'Warm Up',
      exercises: [makeExercise('fit-1', 'Fitness 1', { isFitness: true })]
    },
    fitnessMainPart: {
      id: 'fit-main',
      title: 'Main Part',
      exercises: [makeExercise('fit-2', 'Fitness 2', { isFitness: true })]
    },
    fitnessCoolDown: {
      id: 'fit-cool',
      title: 'Cool Down',
      exercises: [makeExercise('fit-3', 'Fitness 3', { isFitness: true })]
    },
    fitnessPlayerGroups: []
  };

  const merged = mergeFootballSessionWithFitnessSource(session, linked);

  assert.equal(merged.id, session.id);
  assert.equal(merged.sessionNumber, session.sessionNumber);
  assert.equal(merged.warmUp.id, session.warmUp.id);
  assert.equal(merged.mainPart.id, session.mainPart.id);
  assert.equal(merged.coolDown.id, session.coolDown.id);
  assert.equal(merged.fitnessWarmUp?.id, 'fit-warm');
  assert.equal(merged.fitnessMainPart?.id, 'fit-main');
  assert.equal(merged.fitnessCoolDown?.id, 'fit-cool');
});

test('missing linked fitness source does not break football session', () => {
  const session = makeSession();
  const merged = mergeFootballSessionWithFitnessSource(session, null);
  assert.equal(merged, session);
});

test('football view reflects updated linked fitness source without manual sync', () => {
  const session = makeSession();

  const initial = mergeFootballSessionWithFitnessSource(session, {
    fitnessWarmUp: {
      id: 'fit-warm-1',
      title: 'Warm Up',
      exercises: [makeExercise('fit-a', 'A', { isFitness: true })]
    },
    fitnessMainPart: {
      id: 'fit-main-1',
      title: 'Main Part',
      exercises: [makeExercise('fit-b', 'B', { isFitness: true })]
    },
    fitnessCoolDown: {
      id: 'fit-cool-1',
      title: 'Cool Down',
      exercises: [makeExercise('fit-c', 'C', { isFitness: true })]
    },
    fitnessPlayerGroups: []
  });

  const updated = mergeFootballSessionWithFitnessSource(session, {
    fitnessWarmUp: {
      id: 'fit-warm-2',
      title: 'Warm Up',
      exercises: [makeExercise('fit-a', 'A', { isFitness: true })]
    },
    fitnessMainPart: {
      id: 'fit-main-2',
      title: 'Main Part',
      exercises: [makeExercise('fit-d', 'D', { isFitness: true })]
    },
    fitnessCoolDown: {
      id: 'fit-cool-2',
      title: 'Cool Down',
      exercises: [makeExercise('fit-e', 'E', { isFitness: true })]
    },
    fitnessPlayerGroups: []
  });

  const initialView = getModuleSessionView(initial, 'football');
  const updatedView = getModuleSessionView(updated, 'football');

  assert.deepEqual(initialView.warmUp.exercises.map((exercise) => exercise.id), ['fit-a', 'fit-b']);
  assert.deepEqual(updatedView.warmUp.exercises.map((exercise) => exercise.id), ['fit-a', 'fit-d']);
  assert.deepEqual(initialView.coolDown.exercises.map((exercise) => exercise.id), ['fit-c']);
  assert.deepEqual(updatedView.coolDown.exercises.map((exercise) => exercise.id), ['fit-e']);
});

test('gk view remains isolated from fitness overlay bindings', () => {
  const session = makeSession();
  session.fitnessWarmUp = {
    id: 'fwu',
    title: 'Warm Up',
    exercises: [makeExercise('fit-a', 'Fitness A', { isFitness: true })]
  };
  session.gkWarmUp = {
    id: 'gkwu',
    title: 'Warm Up',
    exercises: [makeExercise('gk-a', 'GK A')]
  };

  const gkView = getModuleSessionView(session, 'gk');
  assert.deepEqual(gkView.warmUp.exercises.map((exercise) => exercise.id), ['gk-a']);
});

function makeFitnessSession(overrides: Partial<FitnessSession> = {}): FitnessSession {
  return {
    id: 'fit-session-fit123',
    sessionUid: 'session-fit123',
    teamName: 'U17 Women Al Ula',
    date: '2026-08-25',
    time: '18:30 - 20:00',
    sessionNumber: '020',
    microcycleDay: 'MD-3',
    mainObjective: 'Fitness Core',
    materialsNeeded: 'Cones, bibs',
    squadRoster: [],
    attendance: [],
    fitnessWarmUp: {
      id: 'fwu-1',
      title: 'Warm Up',
      exercises: [makeExercise('fit-ex-1', 'Activation Drill', { isFitness: true })]
    },
    fitnessMainPart: {
      id: 'fmp-1',
      title: 'Main Part',
      exercises: [makeExercise('fit-ex-2', 'Endurance Shuttle', { isFitness: true })]
    },
    fitnessCoolDown: {
      id: 'fcd-1',
      title: 'Cool Down',
      exercises: [makeExercise('fit-ex-3', 'Hamstring Stretch', { isFitness: true })]
    },
    fitnessPlayerGroups: [],
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    ...overrides
  };
}

test('cross-module lookup matches "020" with "020" preserving independent IDs', () => {
  const footballSession: TrainingSession = {
    ...makeSession(),
    id: 'fb-session-abc999', // Independent Football ID
    sessionNumber: '020',
    teamName: 'U17 Women Al Ula',
    date: '2026-08-25'
  };

  const fitness020 = makeFitnessSession({
    id: 'fit-record-xyz888', // Independent Fitness ID
    sessionUid: 'session-independent-777', // Independent Fitness sessionUid
    sessionNumber: '020',
    teamName: 'U17 Women Al Ula'
  });

  const match = findMatchingFitnessSession(footballSession, [fitness020]);
  assert.ok(match, 'Expected a match for session number "020"');
  assert.equal(match.id, 'fit-record-xyz888');
  assert.equal(match.sessionNumber, '020');

  // Verify resolveLinkedFitnessForFootballSession resolves overlay data
  const linked = resolveLinkedFitnessForFootballSession(footballSession, [fitness020]);
  assert.ok(linked);
  assert.equal(linked.fitnessWarmUp?.exercises[0].name, 'Activation Drill');

  // Merge into football view and verify exercises are rendered in football view
  const mergedFootball = mergeFootballSessionWithFitnessSource(footballSession, linked);
  assert.equal(mergedFootball.id, 'fb-session-abc999', 'Football ID must not be modified');
  const view = getModuleSessionView(mergedFootball, 'football');
  assert.equal(view.warmUp.exercises[0].id, 'fit-ex-1');
  assert.equal(view.warmUp.exercises[1].id, 'fit-ex-2');
  assert.equal(view.coolDown.exercises[0].id, 'fit-ex-3');
});

test('cross-module lookup strictly separates "020" from "20" (leading zeros preserved)', () => {
  const footballSession020: TrainingSession = {
    ...makeSession(),
    id: 'fb-session-020',
    sessionNumber: '020'
  };

  const fitnessSession20 = makeFitnessSession({
    id: 'fit-session-20',
    sessionNumber: '20'
  });

  // "020" must NOT match "20"
  const matchA = findMatchingFitnessSession(footballSession020, [fitnessSession20]);
  assert.equal(matchA, null, '"020" must not match "20"');

  const footballSession20: TrainingSession = {
    ...makeSession(),
    id: 'fb-session-20',
    sessionNumber: '20'
  };

  const fitnessSession020 = makeFitnessSession({
    id: 'fit-session-020',
    sessionNumber: '020'
  });

  // "20" must NOT match "020"
  const matchB = findMatchingFitnessSession(footballSession20, [fitnessSession020]);
  assert.equal(matchB, null, '"20" must not match "020"');
});

test('cross-module lookup disambiguates by team and date when multiple fitness sessions exist', () => {
  const footballSession: TrainingSession = {
    ...makeSession(),
    id: 'fb-020',
    sessionNumber: '020',
    teamName: 'U17 Women Al Ula',
    date: '2026-08-25'
  };

  const fitnessTeamA = makeFitnessSession({
    id: 'fit-team-a',
    sessionNumber: '020',
    teamName: 'U17 Women Al Ula',
    date: '2026-08-25',
    updatedAt: 100
  });

  const fitnessTeamB = makeFitnessSession({
    id: 'fit-team-b',
    sessionNumber: '020',
    teamName: 'First Team Men',
    date: '2026-08-25',
    updatedAt: 200
  });

  const match = findMatchingFitnessSession(footballSession, [fitnessTeamB, fitnessTeamA]);
  assert.equal(match?.id, 'fit-team-a');
});

test('cross-module lookup uses latest updatedAt as deterministic tie-breaker', () => {
  const footballSession: TrainingSession = {
    ...makeSession(),
    id: 'fb-020',
    sessionNumber: '020',
    teamName: 'U17 Women Al Ula',
    date: '2026-08-25'
  };

  const fitnessOlder = makeFitnessSession({
    id: 'fit-older',
    sessionNumber: '020',
    teamName: 'U17 Women Al Ula',
    date: '2026-08-25',
    updatedAt: 1000
  });

  const fitnessNewer = makeFitnessSession({
    id: 'fit-newer',
    sessionNumber: '020',
    teamName: 'U17 Women Al Ula',
    date: '2026-08-25',
    updatedAt: 2000
  });

  const match = findMatchingFitnessSession(footballSession, [fitnessOlder, fitnessNewer]);
  assert.equal(match?.id, 'fit-newer');
});

test('cross-module lookup returns null for empty or unnumbered sessions', () => {
  const footballBlank: TrainingSession = {
    ...makeSession(),
    id: 'fb-blank',
    sessionNumber: ''
  };

  const fitness020 = makeFitnessSession({
    id: 'fit-020',
    sessionNumber: '020'
  });

  assert.equal(findMatchingFitnessSession(footballBlank, [fitness020]), null);
});
