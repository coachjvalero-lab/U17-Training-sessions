import test from 'node:test';
import assert from 'node:assert/strict';
import { groupSquadPlayersByPosition, resolveSquadPlayersForDisplay } from './squadGrouping';
import type { SquadPlayer } from '../types';

function makePlayer(overrides: Partial<SquadPlayer> = {}): SquadPlayer {
  return {
    id: overrides.id ?? 'p1',
    firstName: overrides.firstName ?? 'Ana',
    lastName: overrides.lastName ?? 'Perez',
    number: overrides.number ?? 1,
    position: overrides.position ?? 'CM',
    status: overrides.status ?? 'Active',
    notes: overrides.notes,
    joinedDate: overrides.joinedDate,
    photoUrl: overrides.photoUrl,
    age: overrides.age,
    nationality: overrides.nationality,
    preferredFoot: overrides.preferredFoot,
    heightCm: overrides.heightCm,
    weightKg: overrides.weightKg,
    attendanceStats: overrides.attendanceStats,
    malikaPoints: overrides.malikaPoints,
    malikaHistory: overrides.malikaHistory ?? []
  };
}

test('resolveSquadPlayersForDisplay prefers cloud data when present', () => {
  const localPlayers = [makePlayer({ id: 'local', firstName: 'Local', lastName: 'Player', position: 'CB' })];
  const cloudPlayers = [makePlayer({ id: 'cloud', firstName: 'Cloud', lastName: 'Player', position: 'GK' })];

  const result = resolveSquadPlayersForDisplay(cloudPlayers, localPlayers);

  assert.equal(result.length, 1);
  assert.equal(result[0]?.id, 'cloud');
});

test('resolveSquadPlayersForDisplay falls back to local data when cloud is empty', () => {
  const localPlayers = [makePlayer({ id: 'local', firstName: 'Local', lastName: 'Player', position: 'CB' })];

  const result = resolveSquadPlayersForDisplay([], localPlayers);

  assert.equal(result.length, 1);
  assert.equal(result[0]?.id, 'local');
});

test('groupSquadPlayersByPosition buckets players by role', () => {
  const players = [
    makePlayer({ id: 'gk', firstName: 'Goalie', lastName: 'One', position: 'GK' }),
    makePlayer({ id: 'def', firstName: 'Def', lastName: 'One', position: 'CB' }),
    makePlayer({ id: 'mid', firstName: 'Mid', lastName: 'One', position: 'CM' }),
    makePlayer({ id: 'str', firstName: 'Str', lastName: 'One', position: 'ST' })
  ];

  const grouped = groupSquadPlayersByPosition(players);

  assert.deepEqual(grouped.gk.map((player) => player.id), ['gk']);
  assert.deepEqual(grouped.defenders.map((player) => player.id), ['def']);
  assert.deepEqual(grouped.midfielders.map((player) => player.id), ['mid']);
  assert.deepEqual(grouped.strikers.map((player) => player.id), ['str']);
});
