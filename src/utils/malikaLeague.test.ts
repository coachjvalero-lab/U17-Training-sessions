import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { SquadPlayer } from '../types';
import {
  buildMalikaRanking,
  computeWellnessBonusPlayerIds,
  formatCompetitionMonthLabel,
  listCompetitionMonths,
  listMonthDayKeys,
  toCompetitionMonth,
  type MalikaAssignment
} from './malikaLeague';

function player(overrides: Partial<SquadPlayer> & { id: string; firstName: string }): SquadPlayer {
  return {
    lastName: '',
    position: 'CM',
    status: 'Active',
    ...overrides
  } as SquadPlayer;
}

function assignment(overrides: Partial<MalikaAssignment> & { id: string; playerId: string }): MalikaAssignment {
  return {
    sessionId: 's1',
    exerciseId: 'e1',
    exerciseName: 'Finishing Challenge',
    competitionMonth: '2026-09',
    awardedDate: '2026-09-03',
    points: 3,
    ...overrides
  };
}

test('toCompetitionMonth derives the month from the session date', () => {
  assert.equal(toCompetitionMonth('2026-09-03'), '2026-09');
  assert.equal(toCompetitionMonth('2026-10-31'), '2026-10');
  assert.equal(toCompetitionMonth(new Date(2026, 10, 5)), '2026-11');
});

test('formatCompetitionMonthLabel renders a readable month', () => {
  assert.equal(formatCompetitionMonthLabel('2026-09'), 'September 2026');
  assert.equal(formatCompetitionMonthLabel(''), '');
});

test('listCompetitionMonths returns months with data plus the current one, newest first', () => {
  const months = listCompetitionMonths(
    [assignment({ id: 'a', playerId: 'p1', competitionMonth: '2026-08' })],
    '2026-09'
  );
  assert.deepEqual(months, ['2026-09', '2026-08']);
});

test('months are isolated: a new month starts from zero without deleting the old one', () => {
  const players = [player({ id: 'p1', firstName: 'A' })];
  const assignments = [
    assignment({ id: 'a1', playerId: 'p1', competitionMonth: '2026-08', awardedDate: '2026-08-10' }),
    assignment({ id: 'a2', playerId: 'p1', competitionMonth: '2026-09', points: 5 })
  ];

  const august = buildMalikaRanking({ players, assignments, month: '2026-08' });
  const september = buildMalikaRanking({ players, assignments, month: '2026-09' });
  const october = buildMalikaRanking({ players, assignments, month: '2026-10' });

  assert.equal(august.players[0].totalPoints, 3);
  assert.equal(september.players[0].totalPoints, 5);
  assert.equal(october.players[0].totalPoints, 0);
});

test('goalkeepers are ranked in a separate competition', () => {
  const players = [
    player({ id: 'p1', firstName: 'Field', position: 'ST' }),
    player({ id: 'gk1', firstName: 'Keeper', position: 'GK' })
  ];
  const assignments = [
    assignment({ id: 'a1', playerId: 'p1', points: 3 }),
    assignment({ id: 'a2', playerId: 'gk1', points: 9 })
  ];

  const ranking = buildMalikaRanking({ players, assignments, month: '2026-09' });

  assert.equal(ranking.players.length, 1);
  assert.equal(ranking.goalkeepers.length, 1);
  assert.equal(ranking.players[0].playerId, 'p1');
  assert.equal(ranking.goalkeepers[0].playerId, 'gk1');
  assert.equal(ranking.goalkeepers[0].rank, 1);
});

test('wellness bonus adds +3 and is listed separately in the breakdown', () => {
  const players = [player({ id: 'p1', firstName: 'A' })];
  const assignments = [
    assignment({ id: 'a1', playerId: 'p1', points: 21, exerciseName: 'Finishing Challenge' })
  ];

  const ranking = buildMalikaRanking({
    players,
    assignments,
    month: '2026-09',
    wellnessBonusPlayerIds: ['p1']
  });

  const entry = ranking.players[0];
  assert.equal(entry.exercisePoints, 21);
  assert.equal(entry.wellnessBonus, 3);
  assert.equal(entry.totalPoints, 24);
  assert.equal(entry.breakdown.length, 2);
  assert.equal(entry.breakdown[1].kind, 'wellness-bonus');
});

test('ties are broken by attendance during the same month', () => {
  const players = [
    player({ id: 'p1', firstName: 'Low', lastName: 'Attendance' }),
    player({ id: 'p2', firstName: 'High', lastName: 'Attendance' })
  ];
  const assignments = [
    assignment({ id: 'a1', playerId: 'p1', points: 6 }),
    assignment({ id: 'a2', playerId: 'p2', points: 6 })
  ];

  const ranking = buildMalikaRanking({
    players,
    assignments,
    month: '2026-09',
    attendanceByPlayerId: { p1: 4, p2: 9 }
  });

  assert.deepEqual(ranking.players.map((entry) => entry.playerId), ['p2', 'p1']);
});

test('listMonthDayKeys caps the running month at the reference date', () => {
  assert.equal(listMonthDayKeys('2026-09').length, 30);
  assert.deepEqual(listMonthDayKeys('2026-09', new Date(2026, 8, 3)), [
    '2026-09-01',
    '2026-09-02',
    '2026-09-03'
  ]);
});

test('wellness bonus requires every required day to be present', () => {
  const winners = computeWellnessBonusPlayerIds({
    completedDaysByPlayerId: new Map([
      ['p1', new Set(['2026-09-01', '2026-09-02'])],
      ['p2', new Set(['2026-09-01'])]
    ]),
    requiredDayKeys: ['2026-09-01', '2026-09-02']
  });

  assert.deepEqual(winners, ['p1']);
});
