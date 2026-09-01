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

export function calculatePlayerMinutesFromEvents(
  playerId: string,
  isStarter: boolean,
  events: MatchEvent[],
  matchDurationMinutes = 90
): number {
  const duration = Math.max(0, matchDurationMinutes);
  const playerEvents = events
    .filter((event) => isOurSubstitutionEvent(event) && event.playerId === playerId)
    .map((event) => ({ ...event, minute: Math.min(duration, Math.max(0, event.minute)) }))
    .sort((left, right) => left.minute - right.minute || (
      left.eventType === right.eventType ? 0 : left.eventType === 'substitution_out' ? -1 : 1
    ));

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