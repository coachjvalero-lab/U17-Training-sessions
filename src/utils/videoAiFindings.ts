import type { MatchEvent, VideoAiFinding, VideoAiFindingStatus, VideoClip } from '../types';

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

/** Only a pending finding may be confirmed; anything else already produced its clip. */
export function canConfirmFinding(finding: Pick<VideoAiFinding, 'reviewStatus'>): boolean {
  return finding.reviewStatus === 'pending';
}

export function reviewStatusAfterConfirm(wasEdited: boolean): VideoAiFindingStatus {
  return wasEdited ? 'edited' : 'confirmed';
}

export type ClipFromFindingInput = Pick<VideoClip, 'videoUrl' | 'startTime' | 'endTime' | 'title' | 'notes' | 'category' | 'aiFindingId' | 'matchEventId'>;

/**
 * Builds the real clip a confirmed finding turns into: category and tags carried over, evidence in
 * the notes, and a reference to the existing Match Event when one lines up with the clip window.
 */
export function buildClipFromFinding(
  finding: VideoAiFinding,
  fallbackVideoUrl: string,
  matchEvents: MatchEvent[] = []
): ClipFromFindingInput {
  const startTime = finding.startTime ?? finding.timestampSeconds ?? 0;
  const linkedEvent = findMatchEventForClipWindow(matchEvents, startTime, finding.endTime);
  const tags = finding.suggestedTags.length > 0 ? `\nTags: ${finding.suggestedTags.join(', ')}` : '';

  return {
    videoUrl: finding.videoUrl || fallbackVideoUrl,
    startTime,
    endTime: finding.endTime ?? null,
    title: finding.title,
    notes: `${finding.observation}${tags}`.trim() || null,
    category: finding.category ?? null,
    aiFindingId: finding.id,
    matchEventId: linkedEvent?.id ?? null
  };
}
