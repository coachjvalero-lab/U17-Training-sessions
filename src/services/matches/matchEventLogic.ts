import type { MatchEvent, MatchEventType, TeamSide } from '../../types';

type MatchEventDraft = Pick<
  MatchEvent,
  'matchId' | 'minute' | 'videoTimestampSeconds' | 'description'
> & {
  eventType: MatchEventType;
  playerId?: string | null;
  relatedPlayerId?: string | null;
};

export function isOpponentEventType(eventType: MatchEventType): boolean {
  return eventType === 'opponent_goal' || eventType === 'opponent_corner';
}

export function buildMatchEventInput(draft: MatchEventDraft): Omit<MatchEvent, 'id' | 'createdAt'> {
  const isOpponent = isOpponentEventType(draft.eventType);

  return {
    matchId: draft.matchId,
    playerId: isOpponent ? null : (draft.playerId || null),
    teamSide: (isOpponent ? 'opponent' : 'our_team') as TeamSide,
    eventType: draft.eventType,
    minute: draft.minute,
    videoTimestampSeconds: draft.videoTimestampSeconds,
    relatedPlayerId: isOpponent ? null : (draft.relatedPlayerId || null),
    description: draft.description
  };
}

export function deriveTeamEventMetrics(events: MatchEvent[]) {
  return {
    ourGoals: events.filter(
      (event) => event.eventType === 'goal' && (event.teamSide === 'our_team' || !event.teamSide)
    ).length,
    opponentGoals: events.filter(
      (event) => event.eventType === 'opponent_goal' || (event.eventType === 'goal' && event.teamSide === 'opponent')
    ).length,
    ourCorners: events.filter(
      (event) => event.eventType === 'corner' && (event.teamSide === 'our_team' || !event.teamSide)
    ).length,
    opponentCorners: events.filter(
      (event) => event.eventType === 'opponent_corner' || (event.eventType === 'corner' && event.teamSide === 'opponent')
    ).length
  };
}