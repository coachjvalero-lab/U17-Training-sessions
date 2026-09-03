import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PREDEFINED_FORMATIONS,
  findSlotOccupant,
  resolveStablePitchPosition
} from './formations';

const slots = PREDEFINED_FORMATIONS['1-4-2-3-1'].slots;

test('formation slots remain unchanged when occupants change', () => {
  const before = slots.map((slot) => ({ ...slot }));
  const starters = [{ id: 'entry-a', playerId: 'player-a', position: 'ST', pitchX: 50, pitchY: 18 }];

  assert.equal(findSlotOccupant(slots.find((slot) => slot.id === 'st')!, starters, slots)?.id, 'entry-a');
  assert.deepEqual(slots, before);

  const withAnotherOccupant = [...starters, { id: 'entry-b', playerId: 'player-b', position: 'CAM', pitchX: 50, pitchY: 36 }];
  assert.equal(findSlotOccupant(slots.find((slot) => slot.id === 'st')!, withAnotherOccupant, slots)?.id, 'entry-a');
  assert.deepEqual(slots, before);
});

test('persisted coordinates never depend on lineup array order', () => {
  const player = { id: 'entry-a', playerId: 'player-a', position: 'ST', pitchX: 41, pitchY: 23 };
  const positionBefore = resolveStablePitchPosition(player, slots);
  const unrelatedPlayers = [
    { id: 'entry-z', playerId: 'player-z', position: 'GK', pitchX: 50, pitchY: 90 },
    player
  ];

  const positionAfter = resolveStablePitchPosition(unrelatedPlayers[1], slots);
  assert.deepEqual(positionBefore, { x: 41, y: 23, position: 'ST' });
  assert.deepEqual(positionAfter, positionBefore);
});

test('manual pitch coordinates remain unchanged when other starters occupy formation slots', () => {
  const manuallyMovedStarter = { id: 'entry-a', playerId: 'player-a', position: 'LB', pitchX: 47.5, pitchY: 51.2 };
  const initialPosition = resolveStablePitchPosition(manuallyMovedStarter, slots);
  const otherStarters = [
    { id: 'entry-b', playerId: 'player-b', position: 'ST', pitchX: 50, pitchY: 18 },
    { id: 'entry-c', playerId: 'player-c', position: 'CAM', pitchX: 50, pitchY: 36 },
    manuallyMovedStarter
  ];

  assert.deepEqual(resolveStablePitchPosition(otherStarters[2], slots), initialPosition);
  assert.deepEqual(initialPosition, { x: 47.5, y: 51.2, position: 'LB' });
});

test('legacy entries without coordinates receive a deterministic player-based fallback', () => {
  const entry = { id: 'entry-a', playerId: 'stable-player-id', position: 'CB' };
  const first = resolveStablePitchPosition(entry, slots);
  const second = resolveStablePitchPosition(entry, slots);

  assert.equal(first.position, 'CB');
  assert.deepEqual(second, first);
  assert.ok(slots.some((slot) => slot.x === first.x && slot.y === first.y));
});