import test from 'node:test';
import assert from 'node:assert/strict';
import type { MatchEvent } from '../../types';
import {
  calculatePlayerMinutesFromEvents,
  countLogicalSubstitutions,
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