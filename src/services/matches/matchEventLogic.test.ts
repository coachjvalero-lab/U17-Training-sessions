import test from 'node:test';
import assert from 'node:assert/strict';
import type { MatchEvent, MatchEventType } from '../../types';
import { derivePlayerMatchStatsFromData } from './playerMatchStatisticsService';
import { buildMatchEventInput, deriveTeamEventMetrics } from './matchEventLogic';
import { toMatchEventWriteRow } from './matchEventsService';

function draft(eventType: MatchEventType, playerId: string | null = null) {
  return buildMatchEventInput({
    matchId: 'match-1',
    eventType,
    playerId,
    relatedPlayerId: null,
    minute: 20,
    videoTimestampSeconds: 1200,
    description: `${eventType} description`
  });
}

function savedEvent(id: string, eventType: MatchEventType, playerId: string | null = null): MatchEvent {
  return { id, ...draft(eventType, playerId) };
}

test('creates opponent_goal without player IDs', () => {
  const row = toMatchEventWriteRow(draft('opponent_goal', 'our-player'));
  assert.equal(row.event_type, 'opponent_goal');
  assert.equal(row.player_id, null);
  assert.equal(row.related_player_id, null);
});

test('creates opponent_corner without player IDs', () => {
  const row = toMatchEventWriteRow(draft('opponent_corner', 'our-player'));
  assert.equal(row.event_type, 'opponent_corner');
  assert.equal(row.player_id, null);
  assert.equal(row.related_player_id, null);
});

test('sets team_side opponent for opponent events', () => {
  assert.equal(toMatchEventWriteRow(draft('opponent_goal')).team_side, 'opponent');
  assert.equal(toMatchEventWriteRow(draft('opponent_corner')).team_side, 'opponent');
});

test('existing goal remains an our-team player event', () => {
  const row = toMatchEventWriteRow(draft('goal', 'player-1'));
  assert.equal(row.event_type, 'goal');
  assert.equal(row.team_side, 'our_team');
  assert.equal(row.player_id, 'player-1');
});

test('existing corner remains an our-team event without a player', () => {
  const row = toMatchEventWriteRow(draft('corner'));
  assert.equal(row.event_type, 'corner');
  assert.equal(row.team_side, 'our_team');
  assert.equal(row.player_id, null);
});

test('editing an opponent goal preserves its identity and nullable players', () => {
  const original = savedEvent('event-1', 'opponent_goal');
  const edited = { ...original, minute: 64 };
  const row = toMatchEventWriteRow(edited);

  assert.equal(row.event_type, 'opponent_goal');
  assert.equal(row.team_side, 'opponent');
  assert.equal(row.minute, 64);
  assert.equal(row.player_id, null);
});

test('deleting an opponent goal removes it from team metrics', () => {
  const events = [savedEvent('event-1', 'opponent_goal'), savedEvent('event-2', 'goal', 'player-1')];
  assert.equal(deriveTeamEventMetrics(events).opponentGoals, 1);

  const remaining = events.filter((event) => event.id !== 'event-1');
  assert.equal(deriveTeamEventMetrics(remaining).opponentGoals, 0);
});

test('opponent events do not create player statistics', () => {
  const opponentEvents = [savedEvent('event-1', 'opponent_goal'), savedEvent('event-2', 'opponent_corner')];
  const stats = derivePlayerMatchStatsFromData('player-1', undefined, opponentEvents);
  assert.equal(stats.goals, 0);
  assert.equal(stats.assists, 0);
  assert.equal(stats.yellowCards, 0);
  assert.equal(stats.redCards, 0);
});

test('opponent goal contributes to team goals against', () => {
  const metrics = deriveTeamEventMetrics([savedEvent('event-1', 'opponent_goal')]);
  assert.equal(metrics.opponentGoals, 1);
  assert.equal(metrics.ourGoals, 0);
});

test('opponent corner contributes to opponent corners', () => {
  const metrics = deriveTeamEventMetrics([savedEvent('event-1', 'opponent_corner')]);
  assert.equal(metrics.opponentCorners, 1);
  assert.equal(metrics.ourCorners, 0);
});

test('all four quick actions retain independent team metrics', () => {
  const events = [
    savedEvent('event-1', 'opponent_goal'),
    savedEvent('event-2', 'opponent_corner'),
    savedEvent('event-3', 'goal', 'player-1'),
    savedEvent('event-4', 'corner')
  ];
  assert.deepEqual(deriveTeamEventMetrics(events), {
    ourGoals: 1,
    opponentGoals: 1,
    ourCorners: 1,
    opponentCorners: 1
  });
});