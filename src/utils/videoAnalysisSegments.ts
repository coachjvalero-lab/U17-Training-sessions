// Segmentation and cross-segment deduplication for AI video analysis.
// The backend analyses ONE segment per request (so a long match never hits a serverless timeout),
// so the sweep plan and the merging of overlapping results live here, on the client.
// SEGMENT_LENGTH_SECONDS mirrors the backend fallback in api/_lib/videoAnalysisAi.ts.

export interface VideoAnalysisSegment {
  startSeconds: number;
  endSeconds: number;
}

/** Finding shape returned by /api/video/analyse, with timestamps already absolute. */
export interface AnalysedFinding {
  category: string | null;
  title: string;
  observation: string;
  suggestedTags: string[];
  confidence: number | null;
  timestampSeconds: number;
  startTime: number;
  endTime: number;
}

export interface SegmentedFinding {
  finding: AnalysedFinding;
  segmentIndex: number;
  /** Already stored in this analysis: it always wins a duplicate comparison. */
  persisted?: boolean;
}

export const SEGMENT_LENGTH_SECONDS = 900;
/** Consecutive segments overlap so an action on a boundary is never cut in half. */
export const SEGMENT_OVERLAP_SECONDS = 10;
export const MAX_SEGMENTS = 8;
/** Stop sweeping once this many consecutive segments come back completely empty. */
export const MAX_CONSECUTIVE_EMPTY_SEGMENTS = 2;
/** Slack allowed on top of the overlap when matching a duplicate across two segments. */
export const DEDUPE_TIME_TOLERANCE_SECONDS = 5;
export const DEDUPE_SIMILARITY_THRESHOLD = 0.5;

/**
 * Every video is swept in overlapping windows; the duration is never needed up front because the
 * sweep stops when the windows stop returning anything.
 */
export function buildSegments(
  segmentLengthSeconds: number = SEGMENT_LENGTH_SECONDS,
  overlapSeconds: number = SEGMENT_OVERLAP_SECONDS,
  maxSegments: number = MAX_SEGMENTS
): VideoAnalysisSegment[] {
  const step = Math.max(1, segmentLengthSeconds - overlapSeconds);
  const segments: VideoAnalysisSegment[] = [];
  for (let index = 0; index < maxSegments; index += 1) {
    const startSeconds = index * step;
    segments.push({ startSeconds, endSeconds: startSeconds + segmentLengthSeconds });
  }
  return segments;
}

function tokenise(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length > 3)
  );
}

/** Jaccard overlap of the meaningful words, used to tell a repeated action from a different one. */
export function describesSameSituation(
  a: Pick<AnalysedFinding, 'title' | 'observation' | 'category'>,
  b: Pick<AnalysedFinding, 'title' | 'observation' | 'category'>,
  threshold: number = DEDUPE_SIMILARITY_THRESHOLD
): boolean {
  if (a.category && b.category && a.category !== b.category) return false;

  const left = tokenise(`${a.title} ${a.observation}`);
  const right = tokenise(`${b.title} ${b.observation}`);
  if (left.size === 0 || right.size === 0) return false;

  let shared = 0;
  for (const token of left) if (right.has(token)) shared += 1;
  return shared / Math.min(left.size, right.size) >= threshold;
}

function findingScore(finding: AnalysedFinding): number {
  return (finding.confidence ?? 0) * 100 + finding.observation.length / 1000;
}

/**
 * Drops the second sighting of an action that was seen in the overlap shared by two consecutive
 * segments. Closeness in time alone is never enough: the descriptions must match too.
 */
export function dedupeFindings(
  entries: SegmentedFinding[],
  overlapSeconds: number = SEGMENT_OVERLAP_SECONDS,
  toleranceSeconds: number = DEDUPE_TIME_TOLERANCE_SECONDS
): SegmentedFinding[] {
  const sorted = entries
    .slice()
    .sort((a, b) => a.finding.timestampSeconds - b.finding.timestampSeconds);
  const kept: SegmentedFinding[] = [];

  for (const entry of sorted) {
    const duplicateIndex = kept.findIndex((candidate) => {
      if (candidate.segmentIndex === entry.segmentIndex) return false;
      if (Math.abs(candidate.segmentIndex - entry.segmentIndex) !== 1) return false;
      if (Math.abs(candidate.finding.timestampSeconds - entry.finding.timestampSeconds) > overlapSeconds + toleranceSeconds) {
        return false;
      }
      return describesSameSituation(candidate.finding, entry.finding);
    });

    if (duplicateIndex === -1) {
      kept.push(entry);
      continue;
    }

    const existing = kept[duplicateIndex];
    // An already stored finding is never replaced, otherwise it would be left orphaned in the DB.
    if (existing.persisted) continue;
    if (entry.persisted || findingScore(entry.finding) > findingScore(existing.finding)) {
      kept[duplicateIndex] = entry;
    }
  }

  return kept.sort((a, b) => a.finding.timestampSeconds - b.finding.timestampSeconds);
}
