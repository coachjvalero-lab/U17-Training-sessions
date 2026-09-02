import type { MatchEvent } from '../../types';

export type LogicalSubstitution = {
  outEvent: MatchEvent;
  inEvent: MatchEvent;
  minute: number;
};

const isOurSubstitutionEvent = (event: MatchEvent): boolean =>
  (event.teamSide === 'our_team' || !event.teamSide) &&
  (event.eventType === 'substitution_in' || event.eventType === 'substitution_out');

export function findPairedSubstitutionEvent(event: MatchEvent, events: MatchEvent[]): MatchEvent | null {
  if (!isOurSubstitutionEvent(event) || !event.playerId || !event.relatedPlayerId) return null;

  const inverseType = event.eventType === 'substitution_out' ? 'substitution_in' : 'substitution_out';
  return events.find((candidate) =>
    candidate.id !== event.id &&
    isOurSubstitutionEvent(candidate) &&
    candidate.eventType === inverseType &&
    candidate.minute === event.minute &&
    candidate.playerId === event.relatedPlayerId &&
    candidate.relatedPlayerId === event.playerId
  ) ?? null;
}

export function reconstructLogicalSubstitutions(events: MatchEvent[]): {
  substitutions: LogicalSubstitution[];
  incompleteEvents: MatchEvent[];
} {
  const substitutionEvents = events.filter(isOurSubstitutionEvent);
  const consumedIds = new Set<string>();
  const substitutions: LogicalSubstitution[] = [];

  for (const outEvent of substitutionEvents.filter((event) => event.eventType === 'substitution_out')) {
    if (consumedIds.has(outEvent.id)) continue;
    const inEvent = findPairedSubstitutionEvent(outEvent, substitutionEvents);
    if (!inEvent || consumedIds.has(inEvent.id)) continue;

    consumedIds.add(outEvent.id);
    consumedIds.add(inEvent.id);
    substitutions.push({ outEvent, inEvent, minute: outEvent.minute });
  }

  return {
    substitutions: substitutions.sort((left, right) => left.minute - right.minute),
    incompleteEvents: substitutionEvents.filter((event) => !consumedIds.has(event.id))
  };
}

export function countLogicalSubstitutions(events: MatchEvent[]): number {
  return reconstructLogicalSubstitutions(events).substitutions.length;
}

/**
 * True when match_events proves this player left the pitch (their own substitution_out,
 * or another player's substitution_in that explicitly names them via relatedPlayerId) with
 * no own substitution_in recorded beforehand — i.e. they must have started the match.
 */
export function hasImplicitStarterEvidence(playerId: string, events: MatchEvent[]): boolean {
  const ownEvents = events.filter((event) => isOurSubstitutionEvent(event) && event.playerId === playerId);
  if (ownEvents.some((event) => event.eventType === 'substitution_in')) return false;

  const hasOwnOut = ownEvents.some((event) => event.eventType === 'substitution_out');
  if (hasOwnOut) return true;

  return events.some((event) =>
    isOurSubstitutionEvent(event) && event.eventType === 'substitution_in' && event.relatedPlayerId === playerId
  );
}

export function calculatePlayerMinutesFromEvents(
  playerId: string,
  /** Explicit starter flag from match_lineup_entries; undefined when no lineup entry exists. */
  explicitStarter: boolean | undefined,
  events: MatchEvent[],
  matchDurationMinutes = 90
): number {
  const duration = Math.max(0, matchDurationMinutes);
  const ownEvents = events.filter((event) => isOurSubstitutionEvent(event) && event.playerId === playerId);
  const hasOwnSubstitutionOut = ownEvents.some((event) => event.eventType === 'substitution_out');
  const hasOwnSubstitutionIn = ownEvents.some((event) => event.eventType === 'substitution_in');

  // Only look for an implied OUT (another player's IN explicitly naming this player as who they
  // replaced) when this player has no own substitution_out recorded, to avoid double-counting.
  const impliedOutEvent = !hasOwnSubstitutionOut
    ? events
        .filter((event) =>
          isOurSubstitutionEvent(event) && event.eventType === 'substitution_in' && event.relatedPlayerId === playerId
        )
        .sort((left, right) => left.minute - right.minute)[0] ?? null
    : null;

  const playerEvents = [
    ...ownEvents,
    ...(impliedOutEvent
      ? [{ ...impliedOutEvent, eventType: 'substitution_out' as const, playerId, relatedPlayerId: impliedOutEvent.playerId }]
      : [])
  ]
    .map((event) => ({ ...event, minute: Math.min(duration, Math.max(0, event.minute)) }))
    .sort((left, right) => left.minute - right.minute || (
      left.eventType === right.eventType ? 0 : left.eventType === 'substitution_out' ? -1 : 1
    ));

  // Lineup entry (when present) is the explicit source of truth; only fall back to inferring
  // starter status from match_events when there is no lineup entry at all for this player.
  const hasLeftPitchEvidence = hasOwnSubstitutionOut || Boolean(impliedOutEvent);
  const isStarter = explicitStarter !== undefined
    ? explicitStarter
    : hasLeftPitchEvidence && !hasOwnSubstitutionIn;

  let active = isStarter;
  let intervalStart = isStarter ? 0 : null;
  let minutesPlayed = 0;

  for (const event of playerEvents) {
    if (event.eventType === 'substitution_out') {
      if (active && intervalStart !== null) {
        minutesPlayed += Math.max(0, event.minute - intervalStart);
        active = false;
        intervalStart = null;
      }
      continue;
    }

    if (!active) {
      active = true;
      intervalStart = event.minute;
    }
  }

  if (active && intervalStart !== null) {
    minutesPlayed += Math.max(0, duration - intervalStart);
  }

  return Math.min(duration, minutesPlayed);
}