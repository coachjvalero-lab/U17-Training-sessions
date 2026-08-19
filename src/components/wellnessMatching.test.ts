import test from 'node:test';
import assert from 'node:assert/strict';
import type { SquadPlayer } from '../types';
import { resolveWellnessPlayerName } from '../utils/wellnessMatching';
import { selectWellnessRowsForDate } from '../utils/wellnessVisibility';

function makePlayer(id: string, firstName: string, lastName: string): SquadPlayer {
  return {
    id,
    firstName,
    lastName,
    position: 'CM',
    status: 'Active',
    malikaHistory: []
  };
}

test('matches one normalized full squad name exactly', () => {
  const resolution = resolveWellnessPlayerName('  ALBA  ALMUTAIRI ', [makePlayer('alba', 'Alba', 'Almutairi')]);

  assert.equal(resolution.status, 'matched');
  assert.equal(resolution.playerId, 'alba');
});

test('does not match a shared first name with a different surname', () => {
  const resolution = resolveWellnessPlayerName('Lara Bakheet', [makePlayer('lara-u17', 'Lara', 'Alharbi')]);

  assert.equal(resolution.status, 'unresolved');
  assert.equal(resolution.playerId, null);
});

test('does not match a partial name contained in a squad name', () => {
  const resolution = resolveWellnessPlayerName('Shaden', [makePlayer('shaden-u17', 'Shaden', 'Alqahtani')]);

  assert.equal(resolution.status, 'unresolved');
  assert.equal(resolution.playerId, null);
});

test('marks duplicate normalized full names as ambiguous', () => {
  const resolution = resolveWellnessPlayerName('Sara Alreahili', [
    makePlayer('sara-1', 'Sara', 'Alreahili'),
    makePlayer('sara-2', 'Sara', 'Alreahili')
  ]);

  assert.equal(resolution.status, 'ambiguous');
  assert.equal(resolution.playerId, null);
  assert.equal(resolution.options?.length, 2);
});

test('keeps an external player unresolved', () => {
  const resolution = resolveWellnessPlayerName('External U15 Player', [makePlayer('alba', 'Alba', 'Almutairi')]);

  assert.equal(resolution.status, 'unresolved');
  assert.equal(resolution.playerId, null);
});

test('uses an explicit confirmed manual mapping before exact matching', () => {
  const resolution = resolveWellnessPlayerName(
    'Alba A.',
    [makePlayer('alba', 'Alba', 'Almutairi')],
    { 'alba a': 'alba' }
  );

  assert.equal(resolution.status, 'matched');
  assert.equal(resolution.playerId, 'alba');
});

test('keeps unresolved Google Sheet responses visible for the selected date', () => {
  const rows = selectWellnessRowsForDate([
    { playerName: 'Alba Almutairi', dateKey: '2026-08-16' },
    { playerName: 'Shaden', dateKey: '2026-08-16' },
    { playerName: 'Lara Bakheet', dateKey: '2026-08-16' }
  ], '2026-08-16');
  const squad = [makePlayer('p1', 'Alba', 'Almutairi')];
  const resolutions = new Map(rows.map((row) => [row.playerName, resolveWellnessPlayerName(row.playerName, squad)]));

  assert.equal(rows.length, 3);
  assert.equal(resolutions.get('Alba Almutairi')?.status, 'matched');
  assert.equal(resolutions.get('Shaden')?.status, 'unresolved');
  assert.equal(resolutions.get('Lara Bakheet')?.status, 'unresolved');
  assert.ok(rows.some((row) => row.playerName === 'Shaden'));
  assert.ok(rows.some((row) => row.playerName === 'Lara Bakheet'));
});