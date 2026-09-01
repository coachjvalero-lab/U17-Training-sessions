import test from 'node:test';
import assert from 'node:assert/strict';
import { selectCalledUpPlayers } from './matchLineup';

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