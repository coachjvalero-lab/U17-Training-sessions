import test from 'node:test';
import assert from 'node:assert/strict';
import { selectCalledUpPlayers, hasSquadCallChangedSinceConfirmation } from './matchLineup';

test('returns exactly the players with persisted lineup entries', () => {
  const squadPlayers = Array.from({ length: 23 }, (_, index) => ({
    id: `player-${index + 1}`,
    name: `Player ${index + 1}`
  }));
  const lineupEntries = squadPlayers.slice(0, 18).map((player) => ({ playerId: player.id }));

  const calledUpPlayers = selectCalledUpPlayers(squadPlayers, lineupEntries);

  assert.equal(calledUpPlayers.length, 18);
  assert.deepEqual(calledUpPlayers.map((player) => player.id), squadPlayers.slice(0, 18).map((player) => player.id));
});

test('does not invent players when a lineup entry references missing squad metadata', () => {
  const calledUpPlayers = selectCalledUpPlayers(
    [{ id: 'player-1' }],
    [{ playerId: 'player-1' }, { playerId: 'missing-player' }]
  );

  assert.deepEqual(calledUpPlayers, [{ id: 'player-1' }]);
});

test('squad call: no pending changes when never confirmed', () => {
  assert.equal(hasSquadCallChangedSinceConfirmation(null, ['a', 'b', 'c']), false);
  assert.equal(hasSquadCallChangedSinceConfirmation(undefined, ['a', 'b', 'c']), false);
});

test('squad call: no pending changes when confirmed roster matches exactly (order independent)', () => {
  assert.equal(hasSquadCallChangedSinceConfirmation(['a', 'b', 'c'], ['c', 'a', 'b']), false);
});

test('squad call: adding a player after confirmation marks pending changes', () => {
  assert.equal(hasSquadCallChangedSinceConfirmation(['a', 'b'], ['a', 'b', 'c']), true);
});

test('squad call: removing a player after confirmation marks pending changes', () => {
  assert.equal(hasSquadCallChangedSinceConfirmation(['a', 'b', 'c'], ['a', 'b']), true);
});

test('squad call: swapping a player (same count, different id) marks pending changes', () => {
  assert.equal(hasSquadCallChangedSinceConfirmation(['a', 'b', 'c'], ['a', 'b', 'd']), true);
});