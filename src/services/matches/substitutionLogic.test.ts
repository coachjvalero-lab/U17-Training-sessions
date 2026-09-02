import test from 'node:test';
import assert from 'node:assert/strict';
import type { MatchEvent } from '../../types';
import {
  calculatePlayerMinutesFromEvents,
  countLogicalSubstitutions,
  findPairedSubstitutionEvent,
  hasImplicitStarterEvidence,
  reconstructLogicalSubstitutions
} from './substitutionLogic';

const substitutionEvent = (
  id: string,
  eventType: 'substitution_in' | 'substitution_out',
  playerId: string,
  relatedPlayerId: string | null,
  minute: number
): MatchEvent => ({
  id,
  matchId: 'match-1',
  playerId,
  relatedPlayerId,
  eventType,
  minute,
  videoTimestampSeconds: 0,
  teamSide: 'our_team',
  description: ''
});

test('reconstructs reciprocal OUT and IN events as one substitution', () => {
  const events = [
    substitutionEvent('out-a', 'substitution_out', 'A', 'B', 60),
    substitutionEvent('in-b', 'substitution_in', 'B', 'A', 60)
  ];

  const result = reconstructLogicalSubstitutions(events);
  assert.equal(result.substitutions.length, 1);
  assert.equal(result.incompleteEvents.length, 0);
  assert.equal(countLogicalSubstitutions(events), 1);
  assert.equal(calculatePlayerMinutesFromEvents('A', true, events, 90), 60);
  assert.equal(calculatePlayerMinutesFromEvents('B', false, events, 90), 30);
});

test('supports half-time substitutions', () => {
  const events = [
    substitutionEvent('out-a', 'substitution_out', 'A', 'B', 45),
    substitutionEvent('in-b', 'substitution_in', 'B', 'A', 45)
  ];

  assert.equal(calculatePlayerMinutesFromEvents('A', true, events, 90), 45);
  assert.equal(calculatePlayerMinutesFromEvents('B', false, events, 90), 45);
});

test('follows multiple substitution intervals for the same player', () => {
  const events = [
    substitutionEvent('out-a', 'substitution_out', 'A', 'B', 60),
    substitutionEvent('in-b', 'substitution_in', 'B', 'A', 60),
    substitutionEvent('out-b', 'substitution_out', 'B', 'C', 75),
    substitutionEvent('in-c', 'substitution_in', 'C', 'B', 75)
  ];

  assert.equal(countLogicalSubstitutions(events), 2);
  assert.equal(calculatePlayerMinutesFromEvents('A', true, events, 90), 60);
  assert.equal(calculatePlayerMinutesFromEvents('B', false, events, 90), 15);
  assert.equal(calculatePlayerMinutesFromEvents('C', false, events, 90), 15);
});

test('uses incomplete events without inventing the missing player', () => {
  const loneOut = substitutionEvent('out-a', 'substitution_out', 'A', 'B', 70);
  const loneIn = substitutionEvent('in-c', 'substitution_in', 'C', null, 70);

  assert.equal(calculatePlayerMinutesFromEvents('A', true, [loneOut], 90), 70);
  assert.equal(calculatePlayerMinutesFromEvents('B', false, [loneOut], 90), 0);
  assert.equal(calculatePlayerMinutesFromEvents('C', false, [loneIn], 90), 20);
  assert.equal(reconstructLogicalSubstitutions([loneOut, loneIn]).incompleteEvents.length, 2);
  assert.equal(countLogicalSubstitutions([loneOut, loneIn]), 0);
});

test('keeps starters without OUT at full time and unused substitutes at zero', () => {
  assert.equal(calculatePlayerMinutesFromEvents('A', true, [], 90), 90);
  assert.equal(calculatePlayerMinutesFromEvents('B', false, [], 90), 0);
});

// --- Regression tests: implicit starter evidence when match_lineup_entries has no entry ---

test('1. A OUT 45 with no lineup entry -> A gets 45 minutes and is treated as a starter', () => {
  const events = [substitutionEvent('out-a', 'substitution_out', 'A', 'B', 45)];

  assert.equal(calculatePlayerMinutesFromEvents('A', undefined, events, 90), 45);
  assert.equal(hasImplicitStarterEvidence('A', events), true);
});

test('2. A OUT 45 + B IN 45 with no lineup entry for either -> A=45, B=45, one logical substitution', () => {
  const events = [
    substitutionEvent('out-a', 'substitution_out', 'A', 'B', 45),
    substitutionEvent('in-b', 'substitution_in', 'B', 'A', 45)
  ];

  assert.equal(calculatePlayerMinutesFromEvents('A', undefined, events, 90), 45);
  assert.equal(hasImplicitStarterEvidence('A', events), true);
  assert.equal(calculatePlayerMinutesFromEvents('B', undefined, events, 90), 45);
  assert.equal(hasImplicitStarterEvidence('B', events), false);
  assert.equal(countLogicalSubstitutions(events), 1);
});

test('3. Same A OUT 45 / B IN 45 case with an explicit lineup starter=true for A -> identical result', () => {
  const events = [
    substitutionEvent('out-a', 'substitution_out', 'A', 'B', 45),
    substitutionEvent('in-b', 'substitution_in', 'B', 'A', 45)
  ];

  assert.equal(calculatePlayerMinutesFromEvents('A', true, events, 90), 45);
  assert.equal(calculatePlayerMinutesFromEvents('B', false, events, 90), 45);
  assert.equal(countLogicalSubstitutions(events), 1);
});

test('4. Only A OUT 45 (no matching IN anywhere) -> A still gets 45 minutes', () => {
  const events = [substitutionEvent('out-a', 'substitution_out', 'A', 'B', 45)];
  assert.equal(calculatePlayerMinutesFromEvents('A', undefined, events, 90), 45);
});

test('5. Only B IN 45 (no matching OUT anywhere) -> B gets 45 minutes', () => {
  const events = [substitutionEvent('in-b', 'substitution_in', 'B', 'A', 45)];
  assert.equal(calculatePlayerMinutesFromEvents('B', undefined, events, 90), 45);
});

test('2b. Orphan substitution_in referencing an unrecorded starter caps their minutes instead of 90', () => {
  // Only B's IN event exists; A has no own substitution_out event at all, but B's
  // relatedPlayerId explicitly identifies A as who they replaced.
  const events = [substitutionEvent('in-b', 'substitution_in', 'B', 'A', 45)];

  assert.equal(calculatePlayerMinutesFromEvents('A', true, events, 90), 45);
  assert.equal(calculatePlayerMinutesFromEvents('A', undefined, events, 90), 45);
  assert.equal(hasImplicitStarterEvidence('A', events), true);
});

test('6. Editing A OUT into a goal and unlinking the pair leaves no stale substitution relationship', () => {
  const outEvent = substitutionEvent('out-a', 'substitution_out', 'A', 'B', 45);
  const inEvent = substitutionEvent('in-b', 'substitution_in', 'B', 'A', 45);

  // Before edit: the pair is found correctly both ways.
  assert.equal(findPairedSubstitutionEvent(outEvent, [outEvent, inEvent])?.id, 'in-b');
  assert.equal(findPairedSubstitutionEvent(inEvent, [outEvent, inEvent])?.id, 'out-a');

  // Simulates MatchCentreSection's edit handler: A's event becomes a goal, and B's
  // event is unlinked (relatedPlayerId cleared) instead of being left pointing at A.
  const editedGoal: MatchEvent = { ...outEvent, eventType: 'goal', relatedPlayerId: null };
  const unlinkedIn: MatchEvent = { ...inEvent, relatedPlayerId: null };

  assert.equal(findPairedSubstitutionEvent(unlinkedIn, [editedGoal, unlinkedIn]), null);
  assert.equal(countLogicalSubstitutions([editedGoal, unlinkedIn]), 0);
  assert.equal(calculatePlayerMinutesFromEvents('B', false, [editedGoal, unlinkedIn], 90), 45);
});

test('7. Double substitution at the same minute keeps each player independent', () => {
  const events = [
    substitutionEvent('out-a1', 'substitution_out', 'A1', 'B1', 60),
    substitutionEvent('in-b1', 'substitution_in', 'B1', 'A1', 60),
    substitutionEvent('out-a2', 'substitution_out', 'A2', 'B2', 60),
    substitutionEvent('in-b2', 'substitution_in', 'B2', 'A2', 60)
  ];

  assert.equal(countLogicalSubstitutions(events), 2);
  assert.equal(calculatePlayerMinutesFromEvents('A1', undefined, events, 90), 60);
  assert.equal(calculatePlayerMinutesFromEvents('A2', undefined, events, 90), 60);
  assert.equal(calculatePlayerMinutesFromEvents('B1', undefined, events, 90), 30);
  assert.equal(calculatePlayerMinutesFromEvents('B2', undefined, events, 90), 30);
});

test('explicit lineup starter=false is respected even when events look like implicit-starter evidence', () => {
  const events = [substitutionEvent('in-b', 'substitution_in', 'B', 'A', 45)];
  assert.equal(calculatePlayerMinutesFromEvents('A', false, events, 90), 0);
});