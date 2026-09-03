import test from 'node:test';
import assert from 'node:assert/strict';
import type { Match } from '../../types';
import { calculateStandingsFromMatches } from './standingsCalculator';

const baseMatch = (overrides: Partial<Match>): Match => ({
  id: overrides.id ?? 'match-1',
  teamId: 'us',
  opponentTeamId: 'them',
  competitionName: 'Saudi U17 Premier League',
  matchCategory: 'official',
  date: '2026-01-01',
  time: '18:00',
  isHome: true,
  status: 'played',
  ourScore: 1,
  opponentScore: 0,
  ...overrides
});

test('Official Saudi competition matches are counted in the standings', () => {
  const matches = [baseMatch({ id: 'm1', matchCategory: 'official', ourScore: 2, opponentScore: 1 })];
  const standings = calculateStandingsFromMatches(matches, 'us');
  const us = standings.find((entry) => entry.team === 'us')!;
  assert.equal(us.played, 1);
  assert.equal(us.won, 1);
  assert.equal(us.pts, 3);
  assert.equal(us.gf, 2);
  assert.equal(us.ga, 1);
});

test('Friendly matches are ignored entirely', () => {
  const matches = [baseMatch({ id: 'm1', matchCategory: 'friendly', ourScore: 5, opponentScore: 0 })];
  const standings = calculateStandingsFromMatches(matches, 'us');
  assert.equal(standings.length, 0);
});

test('Preseason matches are ignored entirely', () => {
  const matches = [baseMatch({ id: 'm1', matchCategory: 'preseason', ourScore: 3, opponentScore: 3 })];
  const standings = calculateStandingsFromMatches(matches, 'us');
  assert.equal(standings.length, 0);
});

test('Ambiguous competition names without structural official category are ignored', () => {
  const matches = [baseMatch({ id: 'legacy-null', matchCategory: null as any, competitionName: 'Saudi U17 Premier League', ourScore: 9, opponentScore: 0 })];
  const standings = calculateStandingsFromMatches(matches, 'us');
  assert.equal(standings.length, 0);
});

test('Mixed official + friendly matches only count the official ones', () => {
  const matches = [
    baseMatch({ id: 'official-1', matchCategory: 'official', ourScore: 2, opponentScore: 0 }),
    baseMatch({ id: 'friendly-1', matchCategory: 'friendly', ourScore: 10, opponentScore: 0 }),
    baseMatch({ id: 'preseason-1', matchCategory: 'preseason', ourScore: 0, opponentScore: 5 }),
    baseMatch({ id: 'official-2', matchCategory: 'official', ourScore: 1, opponentScore: 1 })
  ];

  const standings = calculateStandingsFromMatches(matches, 'us');
  const us = standings.find((entry) => entry.team === 'us')!;

  // Only the two official matches (2-0 win, 1-1 draw) should count: Played=2, W=1, D=1, L=0, GF=3, GA=1, Pts=4.
  assert.equal(us.played, 2);
  assert.equal(us.won, 1);
  assert.equal(us.drawn, 1);
  assert.equal(us.lost, 0);
  assert.equal(us.gf, 3);
  assert.equal(us.ga, 1);
  assert.equal(us.pts, 4);
});

test('Non-played matches never affect the standings regardless of category', () => {
  const matches = [baseMatch({ id: 'm1', matchCategory: 'official', status: 'planned', ourScore: null, opponentScore: null })];
  const standings = calculateStandingsFromMatches(matches, 'us');
  assert.equal(standings.length, 0);
});
