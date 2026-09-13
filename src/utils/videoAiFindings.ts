import type { MatchEvent } from '../types';

/**
 * Finds the existing Match Event that corresponds to an AI finding's clip window, so the clip can
 * REFERENCE it instead of duplicating the event. Match Events stay owned by Match.
 */
export function findMatchEventForClipWindow(
  events: MatchEvent[],
  startTime: number,
  endTime: number | null | undefined,
  toleranceSeconds = 20
): MatchEvent | null {
  if (!Array.isArray(events) || events.length === 0) return null;

  const windowEnd = endTime != null && endTime > startTime ? endTime : startTime;
  let best: MatchEvent | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const event of events) {
    const eventTime = event.videoTimestampSeconds;
    if (typeof eventTime !== 'number' || !Number.isFinite(eventTime)) continue;

    const distance = eventTime < startTime
      ? startTime - eventTime
      : eventTime > windowEnd
        ? eventTime - windowEnd
        : 0;

    if (distance <= toleranceSeconds && distance < bestDistance) {
      best = event;
      bestDistance = distance;
    }
  }

  return best;
}

/** Renders a 0-1 model confidence as a percentage label, or '—' when the model gave none. */
export function formatConfidence(confidence: number | null | undefined): string {
  if (confidence == null || !Number.isFinite(confidence)) return '—';
  return `${Math.round(Math.min(1, Math.max(0, confidence)) * 100)}%`;
}

/** Adds a start-time deep link to a YouTube URL so a finding opens at its own moment. */
export function buildVideoUrlAtSecond(videoUrl: string, startTime: number | null | undefined): string {
  if (!videoUrl) return videoUrl;
  const seconds = Math.max(0, Math.floor(startTime ?? 0));
  if (seconds === 0) return videoUrl;

  try {
    const url = new URL(videoUrl);
    url.searchParams.set('t', `${seconds}s`);
    return url.toString();
  } catch {
    return videoUrl;
  }
}
