import test from 'node:test';
import assert from 'node:assert/strict';
import type { MatchEvent, MatchLineupEntry } from '../../types';
import { derivePlayerMatchStatsFromData } from './playerMatchStatisticsService';
import { countLogicalSubstitutions } from './substitutionLogic';

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
  videoTimestampSeconds: minute * 60,
  teamSide: 'our_team',
  description: ''
});

test('Statistics render path: A OUT 45 -> B IN 45 with no lineup entries produces A=45, B=45, Substitutions=1', () => {
  const events = [
    substitutionEvent('out-a', 'substitution_out', 'A', 'B', 45),
    substitutionEvent('in-b', 'substitution_in', 'B', 'A', 45)
  ];

  const statsA = derivePlayerMatchStatsFromData('A', undefined, events);
  const statsB = derivePlayerMatchStatsFromData('B', undefined, events);

  assert.equal(statsA.minutesPlayed, 45);
  assert.equal(statsA.starts, true);
  assert.equal(statsB.minutesPlayed, 45);
  assert.equal(statsB.starts, false);
  assert.equal(countLogicalSubstitutions(events), 1);
});

test('Statistics render path: same case with an explicit lineup starter=true for A gives the identical result', () => {
  const events = [
    substitutionEvent('out-a', 'substitution_out', 'A', 'B', 45),
    substitutionEvent('in-b', 'substitution_in', 'B', 'A', 45)
  ];
  const lineupEntry: MatchLineupEntry = {
    id: 'lineup-a',
    matchId: 'match-1',
    playerId: 'A',
    position: 'ST',
    starter: true,
    captain: false
  };

  const statsA = derivePlayerMatchStatsFromData('A', lineupEntry, events);
  assert.equal(statsA.minutesPlayed, 45);
  assert.equal(statsA.starts, true);
  assert.equal(countLogicalSubstitutions(events), 1);
});

test('Statistics render path: explicit lineup starter=false overrides implicit evidence', () => {
  const events = [substitutionEvent('in-b', 'substitution_in', 'B', 'A', 45)];
  const lineupEntry: MatchLineupEntry = {
    id: 'lineup-a',
    matchId: 'match-1',
    playerId: 'A',
    position: 'ST',
    starter: false,
    captain: false
  };

  const statsA = derivePlayerMatchStatsFromData('A', lineupEntry, events);
  assert.equal(statsA.minutesPlayed, 0);
  assert.equal(statsA.starts, false);
});
