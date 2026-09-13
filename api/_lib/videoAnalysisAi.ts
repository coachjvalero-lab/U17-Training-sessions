import { MediaResolution, Type } from '@google/genai';
import {
  CANDIDATE_MODELS,
  createGeminiClient,
  isYoutubeUrl,
  type GeminiClient
} from './matchEventsAi.js';

export type VideoAnalysisContext = 'my_analysis' | 'opponent_analysis' | 'scouting';

export const VIDEO_ANALYSIS_CONTEXTS: VideoAnalysisContext[] = ['my_analysis', 'opponent_analysis', 'scouting'];

export interface VideoAnalysisSegment {
  startSeconds: number;
  endSeconds: number;
}

export interface VideoAnalysisTaxonomyEntry {
  value: string;
  label: string;
}

export interface AnalyseVideoRequestBody {
  context?: string;
  videoUrl?: string;
  additionalNotes?: string;
  /** Existing Video Analysis taxonomy (clip categories). The model may not invent new values. */
  taxonomy?: VideoAnalysisTaxonomyEntry[];
  subject?: {
    teamName?: string;
    opponentName?: string;
    playerName?: string;
    competition?: string;
    date?: string;
  };
  clipMarginBeforeSeconds?: number;
  clipMarginAfterSeconds?: number;
}

export interface GeneratedVideoFinding {
  category: string | null;
  title: string;
  observation: string;
  suggestedTags: string[];
  confidence: number | null;
  /** Absolute second in the full video where the action happens. */
  timestampSeconds: number;
  /** Clip window around the action (margins already applied), absolute seconds. */
  startTime: number;
  endTime: number;
}

export type AnalyseVideoErrorCode =
  | 'missing_video_url'
  | 'unsupported_video_source'
  | 'invalid_context'
  | 'not_configured'
  | 'invalid_ai_response'
  | 'analysis_failed';

export interface AnalyseVideoSuccess {
  success: true;
  /** Always true: this codepath never returns findings that were not derived from the video. */
  videoAnalyzed: true;
  context: VideoAnalysisContext;
  summary: string;
  patterns: string[];
  conclusions: string[];
  findings: GeneratedVideoFinding[];
  /** Diagnostics only; never surfaced as controls in the analyst UI. */
  passes: number;
  segmented: boolean;
}

export interface AnalyseVideoFailure {
  success: false;
  errorCode: AnalyseVideoErrorCode;
  error: string;
}

export type AnalyseVideoResult = AnalyseVideoSuccess | AnalyseVideoFailure;

// strictNullChecks is off in this repo, so `if (result.success)` does not narrow reliably.
export function isAnalyseVideoFailure(result: AnalyseVideoResult): result is AnalyseVideoFailure {
  return result.success === false;
}

export const DEFAULT_CLIP_MARGIN_BEFORE_SECONDS = 8;
export const DEFAULT_CLIP_MARGIN_AFTER_SECONDS = 8;
export const DEFAULT_FINDING_LENGTH_SECONDS = 12;
/** Fallback window size when a whole-video pass is rejected as too long. */
export const SEGMENT_LENGTH_SECONDS = 1800;
export const MAX_SEGMENTS = 8;
/** Stop walking segments once this many consecutive windows come back completely empty. */
export const MAX_CONSECUTIVE_EMPTY_SEGMENTS = 2;

export function isVideoAnalysisContext(value: unknown): value is VideoAnalysisContext {
  return typeof value === 'string' && (VIDEO_ANALYSIS_CONTEXTS as string[]).includes(value);
}

/**
 * A whole-video pass is preferred (Gemini handles long footage at low media resolution). Only when
 * the API rejects the video for length/size do we fall back to sequential windows.
 */
export function isVideoTooLongError(message: string): boolean {
  return /too long|too large|exceeds|token count|context length|payload size|request entity|duration/i.test(message);
}

export function buildFallbackSegments(
  segmentLengthSeconds: number = SEGMENT_LENGTH_SECONDS,
  maxSegments: number = MAX_SEGMENTS
): VideoAnalysisSegment[] {
  const segments: VideoAnalysisSegment[] = [];
  for (let index = 0; index < maxSegments; index += 1) {
    segments.push({
      startSeconds: index * segmentLengthSeconds,
      endSeconds: (index + 1) * segmentLengthSeconds
    });
  }
  return segments;
}

/** Turns a detected moment into a playable clip window (margin before/after, never negative). */
export function applyClipMargins(
  timestampSeconds: number,
  endSeconds: number | null | undefined,
  marginBefore: number = DEFAULT_CLIP_MARGIN_BEFORE_SECONDS,
  marginAfter: number = DEFAULT_CLIP_MARGIN_AFTER_SECONDS
): { startTime: number; endTime: number } {
  const safeStart = Number.isFinite(timestampSeconds) && timestampSeconds > 0 ? Math.floor(timestampSeconds) : 0;
  const rawEnd = Number.isFinite(endSeconds as number) && (endSeconds as number) > safeStart
    ? Math.floor(endSeconds as number)
    : safeStart + DEFAULT_FINDING_LENGTH_SECONDS;

  return {
    startTime: Math.max(0, safeStart - Math.max(0, marginBefore)),
    endTime: rawEnd + Math.max(0, marginAfter)
  };
}

function clampConfidence(value: unknown): number | null {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return null;
  // Accept both 0-1 and 0-100 shaped answers.
  const normalised = numeric > 1 ? numeric / 100 : numeric;
  return Math.min(1, Math.max(0, Math.round(normalised * 100) / 100));
}

/** Reads either the current `timestampSeconds` field or the older `startTimeSeconds` alias. */
function readTimestamp(raw: Record<string, unknown>): number | null {
  for (const candidate of [raw.timestampSeconds, raw.startTimeSeconds]) {
    if (candidate === null || candidate === undefined || candidate === '') continue;
    const numeric = typeof candidate === 'number' ? candidate : Number(candidate);
    if (Number.isFinite(numeric) && numeric >= 0) return Math.floor(numeric);
  }
  return null;
}

/** Composes the model's what / why / evidence answers into one analyst-readable observation. */
export function composeObservation(raw: Record<string, unknown>): string {
  const read = (key: string): string => (typeof raw[key] === 'string' ? (raw[key] as string).trim() : '');
  const relevance = read('relevance');
  const evidence = read('evidence');
  const lines = [read('observation')];
  if (relevance) lines.push(`Why it matters: ${relevance}`);
  if (evidence) lines.push(`Evidence: ${evidence}`);
  return lines.filter(Boolean).join('\n');
}

export function normaliseFinding(
  raw: Record<string, unknown>,
  options: {
    offsetSeconds?: number;
    allowedCategories?: string[];
    marginBefore?: number;
    marginAfter?: number;
  } = {}
): GeneratedVideoFinding | null {
  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  const observation = composeObservation(raw);
  const rawTimestamp = readTimestamp(raw);

  // Without a usable timestamp the situation cannot be located or clipped, so it is not a finding.
  if (rawTimestamp === null) return null;
  if (!title && !observation) return null;

  const offset = options.offsetSeconds ?? 0;
  const timestampSeconds = rawTimestamp + offset;
  const rawEnd = Number(raw.endTimeSeconds);
  const { startTime, endTime } = applyClipMargins(
    timestampSeconds,
    Number.isFinite(rawEnd) ? rawEnd + offset : null,
    options.marginBefore,
    options.marginAfter
  );

  const rawCategory = typeof raw.category === 'string' ? raw.category.trim() : '';
  const allowed = options.allowedCategories;
  const category = rawCategory && (!allowed || allowed.length === 0 || allowed.includes(rawCategory))
    ? rawCategory
    : null;

  const suggestedTags = Array.isArray(raw.suggestedTags)
    ? raw.suggestedTags
        .filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0)
        .map((tag) => tag.trim())
        .slice(0, 6)
    : [];

  return {
    category,
    title: title || observation.split('\n')[0].slice(0, 80),
    observation,
    suggestedTags,
    confidence: clampConfidence(raw.confidence),
    timestampSeconds,
    startTime,
    endTime
  };
}

export function buildContextInstructions(context: VideoAnalysisContext, subject: AnalyseVideoRequestBody['subject']): string {
  const team = subject?.teamName || 'our team';
  const opponent = subject?.opponentName || 'the opponent';
  const player = subject?.playerName || 'the scouted player';

  switch (context) {
    case 'opponent_analysis':
      return [
        `TARGET: ${opponent}.`,
        'Prioritise situations that change how we prepare this match: build-up routines and their triggers, pressing traps and the cues that start them, defensive block behaviour and the spaces it concedes, transition reactions, and set-piece structures.',
        'Every finding must be something a coach could brief to the squad ("when X happens they do Y, which leaves Z open").'
      ].join(' ');
    case 'scouting':
      return [
        `TARGET: ${player}.`,
        'Prioritise individual actions that support or contradict a recruitment decision: technical execution under pressure, decision-making with and without the ball, body orientation and scanning, physical duels, and reactions after mistakes.',
        'Every finding must be one showable action a scout could present as evidence.'
      ].join(' ');
    case 'my_analysis':
    default:
      return [
        `TARGET: ${team} (our own team).`,
        'Prioritise situations worth reviewing with the squad: well-executed team actions worth reinforcing and concrete errors worth correcting, identifying the collective cause (positioning, timing, decision, communication).',
        'Every finding must be usable in a video session with the players.'
      ].join(' ');
  }
}

function buildPrompt(
  context: VideoAnalysisContext,
  body: AnalyseVideoRequestBody,
  segment: VideoAnalysisSegment | null
): string {
  const taxonomy = Array.isArray(body.taxonomy) && body.taxonomy.length > 0
    ? body.taxonomy.map((entry) => `"${entry.value}" (${entry.label})`).join(', ')
    : 'no predefined categories available: leave "category" empty';

  const timestampRule = segment
    ? `You are watching ONLY the portion of a longer video between ${segment.startSeconds}s and ${segment.endSeconds}s. Report "timestampSeconds" and "endTimeSeconds" RELATIVE TO THE FIRST FRAME YOU SEE (that first frame is second 0).`
    : 'Report "timestampSeconds" and "endTimeSeconds" as absolute seconds counted from the very first frame of the video.';

  return `You are a professional football video analyst preparing material for a coaching staff. Analyse the attached video and report ONLY concrete situations you actually see.

${buildContextInstructions(context, body.subject)}

Context data (may be incomplete; never treat it as something you observed):
- Team: ${body.subject?.teamName || 'unknown'}
- Opponent: ${body.subject?.opponentName || 'unknown'}
- Player: ${body.subject?.playerName || 'unknown'}
- Competition: ${body.subject?.competition || 'unknown'} | Date: ${body.subject?.date || 'unknown'}
- Analyst notes: ${body.additionalNotes?.trim() || 'none'}

For EVERY finding answer these four questions:
1. WHAT happened -> "observation": the concrete action described factually (who does what, in which zone, against which structure). Refer to players by role, position or shirt colour, never by name.
2. WHEN it happened -> "timestampSeconds": the exact second the action starts; "endTimeSeconds": the second it ends.
3. WHY it is relevant -> "relevance": the tactical consequence for the coaching staff, in one sentence.
4. WHAT proves it -> "evidence": the visible detail that supports the claim (body position, distances, number of players involved, sequence of passes...).

Hard rules:
- NEVER invent player names, shirt numbers, positions, scorelines, statistics or events you cannot see.
- NEVER report a generic conclusion such as "the team plays down the wings". Every finding must be anchored to one visible moment with its timestamp.
- Only put a behaviour in "patterns" if at least two of your reported findings support it.
- If something cannot be determined with sufficient confidence, lower "confidence" or omit the finding.
- If you cannot identify any concrete situation, return an empty "findings" array. An empty result is better than an invented one.
- "confidence" is a number between 0 and 1 reflecting how sure you are of what you saw.
- "category" MUST be exactly one of these values, or empty: ${taxonomy}.
- "title" is a short label (max 8 words). "suggestedTags" are up to 4 short free tags.
- "conclusions" are preliminary takeaways the analyst still has to validate.
${timestampRule}`;
}

function buildConfig() {
  return {
    systemInstruction:
      'You are a professional football video analyst. You return a structured JSON object with summary, patterns, conclusions and findings, based exclusively on what is visible in the attached video. You never fabricate names, numbers or events.',
    // Low media resolution keeps long full-match footage inside the model's context window.
    mediaResolution: MediaResolution.MEDIA_RESOLUTION_LOW,
    responseMimeType: 'application/json',
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        summary: { type: Type.STRING, description: 'Short analytical summary of what was observed.' },
        patterns: { type: Type.ARRAY, description: 'Repeated behaviours, each supported by at least two findings.', items: { type: Type.STRING } },
        conclusions: { type: Type.ARRAY, description: 'Preliminary conclusions pending analyst validation.', items: { type: Type.STRING } },
        findings: {
          type: Type.ARRAY,
          description: 'Concrete situations observed in the video, each anchored to a timestamp.',
          items: {
            type: Type.OBJECT,
            properties: {
              category: { type: Type.STRING, description: 'One of the provided category values, or empty.' },
              title: { type: Type.STRING, description: 'Short label for the situation.' },
              observation: { type: Type.STRING, description: 'What happened, factually.' },
              relevance: { type: Type.STRING, description: 'Why it matters for the coaching staff.' },
              evidence: { type: Type.STRING, description: 'The visible detail that proves it.' },
              suggestedTags: { type: Type.ARRAY, description: 'Up to 4 short free tags.', items: { type: Type.STRING } },
              confidence: { type: Type.NUMBER, description: 'Confidence between 0 and 1.' },
              timestampSeconds: { type: Type.INTEGER, description: 'Second the action starts.' },
              endTimeSeconds: { type: Type.INTEGER, description: 'Second the action ends.' }
            },
            required: ['title', 'observation', 'relevance', 'evidence', 'timestampSeconds']
          }
        }
      },
      required: ['summary', 'findings']
    }
  };
}

/** Strip an API key value out of an error message before it can reach a log or HTTP response. */
function sanitizeErrorMessage(message: string, apiKey: string | undefined): string {
  if (!apiKey) return message;
  return message.split(apiKey).join('[REDACTED]');
}

export interface RawAnalysisResponse {
  summary: string;
  patterns: string[];
  conclusions: string[];
  findings: Array<Record<string, unknown>>;
}

export class InvalidAiResponseError extends Error {}

/** Rejects anything that is not a usable analysis payload, so corrupt results are never stored. */
export function parseAnalysisResponse(text: string | undefined, model: string): RawAnalysisResponse {
  if (!text || !text.trim()) {
    throw new InvalidAiResponseError(`Model ${model} returned an empty response.`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (parseErr) {
    throw new InvalidAiResponseError(
      `Model ${model} returned invalid JSON: ${parseErr instanceof Error ? parseErr.message : parseErr}`
    );
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new InvalidAiResponseError(`Model ${model} returned a non-object response.`);
  }

  const record = parsed as Partial<RawAnalysisResponse>;
  if (!Array.isArray(record.findings)) {
    throw new InvalidAiResponseError(`Model ${model} response did not include a findings array.`);
  }

  return {
    summary: typeof record.summary === 'string' ? record.summary : '',
    patterns: Array.isArray(record.patterns) ? record.patterns.filter((item): item is string => typeof item === 'string') : [],
    conclusions: Array.isArray(record.conclusions) ? record.conclusions.filter((item): item is string => typeof item === 'string') : [],
    findings: record.findings.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
  };
}

/**
 * Runs one analysis pass, always with the video attached. Never falls back to a text-only prompt:
 * a video analysis failure must surface as an error, not as fabricated findings.
 */
export async function runAnalysisPass(
  client: GeminiClient,
  videoUrl: string,
  prompt: string,
  segment: VideoAnalysisSegment | null,
  models: readonly string[] = CANDIDATE_MODELS
): Promise<RawAnalysisResponse> {
  const videoPart: Record<string, unknown> = { fileData: { fileUri: videoUrl } };
  if (segment) {
    videoPart.videoMetadata = {
      startOffset: `${Math.max(0, Math.floor(segment.startSeconds))}s`,
      endOffset: `${Math.max(1, Math.floor(segment.endSeconds))}s`
    };
  }

  const contents = [{ role: 'user', parts: [videoPart, { text: prompt }] }];
  const config = buildConfig();

  let lastError: unknown = null;

  for (const model of models) {
    try {
      const response = await client.models.generateContent({ model, contents, config });
      return parseAnalysisResponse(response?.text, model);
    } catch (err) {
      lastError = err;
      console.warn(`[analyseVideo] Model ${model} failed analysing the video:`, err instanceof Error ? err.message : err);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError ?? 'Unknown error'));
}

function isEmptyResponse(response: RawAnalysisResponse): boolean {
  return response.findings.length === 0 && !response.summary.trim();
}

export async function analyseVideo(
  body: AnalyseVideoRequestBody,
  apiKey: string | undefined,
  deps: { createClient?: (apiKey: string) => GeminiClient; models?: readonly string[] } = {}
): Promise<AnalyseVideoResult> {
  const videoUrl = typeof body.videoUrl === 'string' ? body.videoUrl.trim() : '';

  if (!isVideoAnalysisContext(body.context)) {
    return {
      success: false,
      errorCode: 'invalid_context',
      error: 'Unknown analysis type. Expected my_analysis, opponent_analysis or scouting.'
    };
  }

  if (!videoUrl) {
    return {
      success: false,
      errorCode: 'missing_video_url',
      error: 'Attach a YouTube video URL to the analysis before running the AI.'
    };
  }

  if (!isYoutubeUrl(videoUrl)) {
    return {
      success: false,
      errorCode: 'unsupported_video_source',
      error: 'The video URL must be a YouTube link (public or unlisted). Other sources are not supported for AI video analysis.'
    };
  }

  if (!apiKey) {
    return {
      success: false,
      errorCode: 'not_configured',
      error: 'GEMINI_API_KEY is not configured on the server.'
    };
  }

  const context = body.context;
  const allowedCategories = Array.isArray(body.taxonomy) ? body.taxonomy.map((entry) => entry.value) : [];
  const createClient = deps.createClient ?? createGeminiClient;
  const models = deps.models ?? CANDIDATE_MODELS;

  const summaries: string[] = [];
  const patterns: string[] = [];
  const conclusions: string[] = [];
  const findings: GeneratedVideoFinding[] = [];
  let rawFindingCount = 0;

  const collect = (response: RawAnalysisResponse, segment: VideoAnalysisSegment | null) => {
    if (response.summary.trim()) summaries.push(response.summary.trim());
    patterns.push(...response.patterns);
    conclusions.push(...response.conclusions);
    rawFindingCount += response.findings.length;

    for (const raw of response.findings) {
      const finding = normaliseFinding(raw, {
        offsetSeconds: segment ? segment.startSeconds : 0,
        allowedCategories,
        marginBefore: body.clipMarginBeforeSeconds,
        marginAfter: body.clipMarginAfterSeconds
      });
      if (finding) findings.push(finding);
    }
  };

  let passes = 0;
  let segmented = false;

  try {
    const client = createClient(apiKey);

    try {
      // Preferred path: the whole video in one request, so segmentation never reaches the user.
      passes = 1;
      collect(await runAnalysisPass(client, videoUrl, buildPrompt(context, body, null), null, models), null);
    } catch (fullPassError) {
      const message = fullPassError instanceof Error ? fullPassError.message : String(fullPassError);
      if (!isVideoTooLongError(message)) throw fullPassError;

      // Too long for one request: walk it in windows until the video runs out.
      segmented = true;
      passes = 0;
      let consecutiveEmpty = 0;

      for (const segment of buildFallbackSegments()) {
        let response: RawAnalysisResponse;
        try {
          response = await runAnalysisPass(client, videoUrl, buildPrompt(context, body, segment), segment, models);
        } catch {
          // Past the end of the video (or a transient window failure): stop walking forward.
          break;
        }

        passes += 1;
        collect(response, segment);
        consecutiveEmpty = isEmptyResponse(response) ? consecutiveEmpty + 1 : 0;
        if (consecutiveEmpty >= MAX_CONSECUTIVE_EMPTY_SEGMENTS) break;
      }

      if (passes === 0) throw fullPassError;
    }
  } catch (err) {
    const rawMessage = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      errorCode: err instanceof InvalidAiResponseError ? 'invalid_ai_response' : 'analysis_failed',
      error: sanitizeErrorMessage(
        err instanceof InvalidAiResponseError
          ? `The AI returned an incomplete response, so nothing was saved: ${rawMessage}`
          : `The video could not be analysed with AI: ${rawMessage}`,
        apiKey
      )
    };
  }

  // The model reported situations but none were usable: never store a corrupt result.
  if (rawFindingCount > 0 && findings.length === 0) {
    return {
      success: false,
      errorCode: 'invalid_ai_response',
      error: 'The AI returned situations without usable timestamps, so nothing was saved. Please retry.'
    };
  }

  findings.sort((a, b) => a.timestampSeconds - b.timestampSeconds);

  return {
    success: true,
    videoAnalyzed: true,
    context,
    summary: summaries.join('\n\n'),
    patterns: Array.from(new Set(patterns)),
    conclusions: Array.from(new Set(conclusions)),
    findings,
    passes,
    segmented
  };
}
