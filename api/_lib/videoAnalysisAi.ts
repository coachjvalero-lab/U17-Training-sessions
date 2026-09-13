import { MediaResolution, Type } from '@google/genai';
import {
  createGeminiClient,
  isYoutubeUrl,
  type GeminiClient
} from './matchEventsAi.js';

/**
 * Verified against the live API key: gemini-2.5-pro and gemini-2.5-flash return 404 (retired for
 * new users) and gemini-pro-latest / gemini-3.8-flash return 429 (quota), so calling them only
 * wastes a round-trip. These two both analysed a real YouTube match successfully.
 */
export const VIDEO_ANALYSIS_MODELS = ['gemini-flash-latest', 'gemini-3.6-flash'] as const;

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

export interface VideoAnalysisKits {
  /** Free text describing the shirt colour, e.g. "white shirts, black shorts". */
  ourKitColour?: string;
  opponentKitColour?: string;
}

export interface AnalyseVideoRequestBody {
  context?: string;
  videoUrl?: string;
  additionalNotes?: string;
  /** Existing Video Analysis taxonomy (clip categories). The model may not invent new values. */
  taxonomy?: VideoAnalysisTaxonomyEntry[];
  /** Kit colours for this analysis run only; never stored as configuration. */
  kits?: VideoAnalysisKits;
  /** The single window to analyse in this request; the client sweeps the video segment by segment. */
  segment?: VideoAnalysisSegment;
  segmentIndex?: number;
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
  /** Absolute second in the full video where the decisive action happens. */
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
  /** The window that was analysed, echoed back so the client can offset/track it. */
  segmentIndex: number;
  segment: VideoAnalysisSegment;
  summary: string;
  patterns: string[];
  conclusions: string[];
  findings: GeneratedVideoFinding[];
  /** No findings and no summary: the client uses this to know when the video has run out. */
  isEmpty: boolean;
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
/** Fallback window length when the client does not send an explicit segment. */
export const SEGMENT_LENGTH_SECONDS = 900;

export function isVideoAnalysisContext(value: unknown): value is VideoAnalysisContext {
  return typeof value === 'string' && (VIDEO_ANALYSIS_CONTEXTS as string[]).includes(value);
}

/** One request analyses one window; the client owns the sweep plan and sends it explicitly. */
export function resolveSegment(body: AnalyseVideoRequestBody): VideoAnalysisSegment {
  const requested = body.segment;
  const start = Number(requested?.startSeconds);
  const end = Number(requested?.endSeconds);
  if (Number.isFinite(start) && Number.isFinite(end) && start >= 0 && end > start) {
    return { startSeconds: Math.floor(start), endSeconds: Math.floor(end) };
  }

  const index = Number.isFinite(Number(body.segmentIndex)) ? Math.max(0, Math.floor(Number(body.segmentIndex))) : 0;
  const startSeconds = index * SEGMENT_LENGTH_SECONDS;
  return { startSeconds, endSeconds: startSeconds + SEGMENT_LENGTH_SECONDS };
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

/**
 * The evidence sentence is the model's own statement of when the decisive action happens, so when
 * it quotes an explicit `mm:ss` inside the analysed window it wins over a drifted timestamp field.
 */
export function alignTimestampWithEvidence(
  timestampSeconds: number,
  evidence: string | undefined,
  windowLengthSeconds: number = SEGMENT_LENGTH_SECONDS
): number {
  if (!evidence) return timestampSeconds;

  const match = /(?:^|[^\d])(\d{1,2}):([0-5]\d)(?::([0-5]\d))?/.exec(evidence);
  if (!match) return timestampSeconds;

  const quoted = match[3]
    ? Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3])
    : Number(match[1]) * 60 + Number(match[2]);

  // Ignore quotes that cannot belong to this window (e.g. a match minute, not a video second).
  if (!Number.isFinite(quoted) || quoted < 0 || quoted > windowLengthSeconds) return timestampSeconds;
  return quoted;
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
    marginBefore?: number;
    marginAfter?: number;
    windowLengthSeconds?: number;
  } = {}
): GeneratedVideoFinding | null {
  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  const observation = composeObservation(raw);
  const rawTimestamp = readTimestamp(raw);

  // Without a usable timestamp the situation cannot be located or clipped, so it is not a finding.
  if (rawTimestamp === null) return null;
  if (!title && !observation) return null;

  const offset = options.offsetSeconds ?? 0;
  const alignedTimestamp = alignTimestampWithEvidence(
    rawTimestamp,
    typeof raw.evidence === 'string' ? raw.evidence : undefined,
    options.windowLengthSeconds
  );
  const timestampSeconds = alignedTimestamp + offset;
  const rawEnd = Number(raw.endTimeSeconds);
  const { startTime, endTime } = applyClipMargins(
    timestampSeconds,
    Number.isFinite(rawEnd) && rawEnd + offset > timestampSeconds ? rawEnd + offset : null,
    options.marginBefore,
    options.marginAfter
  );

  const suggestedTags = Array.isArray(raw.suggestedTags)
    ? raw.suggestedTags
        .filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0)
        .map((tag) => tag.trim())
        .slice(0, 6)
    : [];

  return {
    category: typeof raw.category === 'string' && raw.category.trim() ? raw.category.trim() : null,
    title: title || observation.split('\n')[0].slice(0, 80),
    observation,
    suggestedTags,
    confidence: clampConfidence(raw.confidence),
    timestampSeconds,
    startTime,
    endTime
  };
}

/**
 * The response schema constrains `category` to an enum, so anything else means the model ignored
 * the schema: the finding is dropped rather than remapped onto an existing category.
 */
export function isFindingCategoryAllowed(
  finding: Pick<GeneratedVideoFinding, 'category'>,
  allowedCategories: string[]
): boolean {
  if (allowedCategories.length === 0) return true;
  return Boolean(finding.category) && allowedCategories.includes(finding.category as string);
}

export function buildContextInstructions(context: VideoAnalysisContext, subject: AnalyseVideoRequestBody['subject']): string {
  const team = subject?.teamName || 'our team';
  const opponent = subject?.opponentName || 'the opponent';
  const player = subject?.playerName || 'the scouted player';

  switch (context) {
    case 'opponent_analysis':
      return [
        `PRIORITY: findings useful to prepare the match against ${opponent} (build-up routines and their triggers, pressing traps, block behaviour and the spaces it concedes, transition reactions, set-piece structures).`,
        'This priority orders the findings; it does not restrict the sweep. Keep reporting every observable situation covered by the allowed categories, including ours.'
      ].join(' ');
    case 'scouting':
      return [
        `PRIORITY: evidence useful to evaluate ${player} (technical execution under pressure, decisions with and without the ball, body orientation and scanning, duels, reactions after mistakes).`,
        'This priority orders the findings; it does not restrict the sweep. Keep reporting every observable situation covered by the allowed categories.'
      ].join(' ');
    case 'my_analysis':
    default:
      return [
        `PRIORITY: findings useful to analyse and coach ${team} (our own team): actions worth reinforcing and concrete errors worth correcting, with the collective cause identified.`,
        'This priority orders the findings; it does not restrict the sweep. Keep reporting every observable situation covered by the allowed categories, including the opponent\'s.'
      ].join(' ');
  }
}

function buildTeamIdentificationRules(kits: VideoAnalysisKits | undefined): string {
  const ours = kits?.ourKitColour?.trim();
  const theirs = kits?.opponentKitColour?.trim();

  if (!ours && !theirs) {
    return [
      'TEAM IDENTIFICATION: no kit colours were provided. Describe each team by its visible shirt colour and do not claim which one is "our team" or "the opponent".',
      'This is team identification only: never identify individual players by name, squad identity or shirt number.'
    ].join('\n');
  }

  return [
    'TEAM IDENTIFICATION (required whenever the two teams can be told apart visually):',
    ours ? `- "our team" wears: ${ours}` : '- our team kit was not provided; infer it as the team that is not wearing the opponent kit.',
    theirs ? `- "the opponent" wears: ${theirs}` : '- the opponent kit was not provided; infer it as the team that is not wearing our kit.',
    '- Use the shirt/kit colour to decide which team is involved and attribute EVERY finding to the correct team, stating it explicitly in the observation.',
    '- If the colours cannot be reliably distinguished in a situation (lighting, distance, similar kits), say so and lower the confidence instead of guessing.',
    '- This is team identification only: never identify individual players by name, squad identity or shirt number.'
  ].join('\n');
}

function buildPrompt(
  context: VideoAnalysisContext,
  body: AnalyseVideoRequestBody,
  segment: VideoAnalysisSegment
): string {
  const taxonomyEntries = Array.isArray(body.taxonomy) ? body.taxonomy : [];
  const taxonomy = taxonomyEntries.length > 0
    ? taxonomyEntries.map((entry) => `"${entry.value}" (${entry.label})`).join(', ')
    : 'no predefined categories available: leave "category" empty';

  return `You are a professional football video analyst preparing material for a coaching staff. Analyse the attached video segment and report ONLY concrete situations you actually see.

${buildContextInstructions(context, body.subject)}

${buildTeamIdentificationRules(body.kits)}

Context data (may be incomplete; never treat it as something you observed):
- Team: ${body.subject?.teamName || 'unknown'}
- Opponent: ${body.subject?.opponentName || 'unknown'}
- Player: ${body.subject?.playerName || 'unknown'}
- Competition: ${body.subject?.competition || 'unknown'} | Date: ${body.subject?.date || 'unknown'}
- Analyst notes: ${body.additionalNotes?.trim() || 'none'}

WORK IN TWO STEPS INSIDE THIS SINGLE ANSWER.

STEP 1 - SYSTEMATIC SWEEP (do this before writing any finding)
Watch the whole segment from start to end and list every observable situation that belongs to the allowed categories. Do not jump to the spectacular moments: goals and shots are only a small part of the work.
Sweep explicitly for, where applicable: build-up, possession progression, pressing, opposition pressing, defensive organisation, defensive transition, attacking transition, regains, losses of possession, progression, wide attacks, crosses, cutbacks, entries into the final third, box defending, set pieces, corners, free kicks, throw-ins, and any other situation represented by the allowed categories.
Minor but clearly observable instances must be included. At this stage over-detecting is better than under-detecting: the goal is high recall across the whole segment, not a highlight reel.

STEP 2 - STRUCTURED FINDINGS
Turn each situation from step 1 into one finding with: timestampSeconds, category, title, observation, relevance, evidence, suggestedTags, confidence.
Each finding answers:
1. WHAT happened -> "observation": the concrete action described factually (which team by kit colour, in which zone, against which structure), by role/position, never by player name.
2. WHEN it happened -> "timestampSeconds" (see the timestamp rules below).
3. WHY it is relevant -> "relevance": the consequence for the coaching staff, in one sentence.
4. WHAT proves it -> "evidence": the visible detail that supports the claim.

TIMESTAMP RULES (critical):
- Times are RELATIVE TO THE FIRST FRAME OF THIS SEGMENT: the first frame you see is second 0, and this segment lasts ${segment.endSeconds - segment.startSeconds} seconds.
- "timestampSeconds" MUST be the exact second of the DECISIVE action described in the evidence: the loss of possession, the regain, the pass that breaks the line, the cross, the contact, the delivery of the set piece.
- It must NOT be an approximation, the start of the build-up, the start of the possession, an earlier setup moment, or a second chosen to make a nicer clip.
- If your evidence text quotes a specific time, "timestampSeconds" MUST be that exact second.
- "endTimeSeconds" is when the situation ends.
- If you cannot establish the decisive moment reliably, lower "confidence" or omit the finding.

HARD RULES:
- NEVER invent player names, shirt numbers, formations, scorelines, statistics or events you cannot see.
- NEVER report a generic football statement. Every finding is anchored to one visible moment with its timestamp.
- Every finding must be a DISTINCT observable situation. Do not emit several findings for the same action just because it can be read in different ways.
- "category" MUST be exactly one of: ${taxonomy}. If a situation does not fit any allowed category, omit the finding instead of inventing a category.
- "title" is a short label (max 8 words). "suggestedTags" are up to 4 short free tags.
- "patterns" may only contain behaviours supported by at least two of the findings you reported, referencing their timestamps. "conclusions" are preliminary takeaways the analyst still has to validate, based only on what you observed in this segment.
- If you genuinely cannot identify any situation, return an empty "findings" array. An empty result is better than an invented one.`;
}

function buildConfig(allowedCategories: string[]) {
  const categoryProperty = allowedCategories.length > 0
    ? {
        type: Type.STRING,
        // Strict enum: the model cannot return a category outside the existing taxonomy.
        enum: allowedCategories,
        description: 'Exactly one of the allowed taxonomy values.'
      }
    : { type: Type.STRING, description: 'Leave empty: no taxonomy was provided.' };

  const requiredFindingFields = ['title', 'observation', 'relevance', 'evidence', 'timestampSeconds'];
  if (allowedCategories.length > 0) requiredFindingFields.push('category');

  return {
    systemInstruction:
      'You are a professional football video analyst. You sweep the whole segment systematically for every observable situation covered by the allowed categories, then return a structured JSON object with summary, patterns, conclusions and findings, based exclusively on what is visible in the attached video. You never fabricate names, numbers or events.',
    // Shorter segments make a higher media resolution affordable.
    mediaResolution: MediaResolution.MEDIA_RESOLUTION_MEDIUM,
    responseMimeType: 'application/json',
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        summary: { type: Type.STRING, description: 'Short analytical summary of what was observed in this segment.' },
        patterns: { type: Type.ARRAY, description: 'Repeated behaviours, each supported by at least two reported findings.', items: { type: Type.STRING } },
        conclusions: { type: Type.ARRAY, description: 'Preliminary conclusions pending analyst validation.', items: { type: Type.STRING } },
        findings: {
          type: Type.ARRAY,
          description: 'Every distinct situation observed in the segment, anchored to its exact timestamp.',
          items: {
            type: Type.OBJECT,
            properties: {
              category: categoryProperty,
              title: { type: Type.STRING, description: 'Short label for the situation.' },
              observation: { type: Type.STRING, description: 'What happened, factually, including which team by kit colour.' },
              relevance: { type: Type.STRING, description: 'Why it matters for the coaching staff.' },
              evidence: { type: Type.STRING, description: 'The visible detail that proves it.' },
              suggestedTags: { type: Type.ARRAY, description: 'Up to 4 short free tags.', items: { type: Type.STRING } },
              confidence: { type: Type.NUMBER, description: 'Confidence between 0 and 1.' },
              timestampSeconds: { type: Type.INTEGER, description: 'Exact second of the decisive action, relative to this segment.' },
              endTimeSeconds: { type: Type.INTEGER, description: 'Second the situation ends, relative to this segment.' }
            },
            required: requiredFindingFields
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
 * Runs one segment pass, always with the video attached. Never falls back to a text-only prompt:
 * a video analysis failure must surface as an error, not as fabricated findings.
 */
export async function runAnalysisPass(
  client: GeminiClient,
  videoUrl: string,
  prompt: string,
  segment: VideoAnalysisSegment,
  allowedCategories: string[] = [],
  models: readonly string[] = VIDEO_ANALYSIS_MODELS
): Promise<RawAnalysisResponse> {
  const videoPart: Record<string, unknown> = {
    fileData: { fileUri: videoUrl },
    videoMetadata: {
      startOffset: `${Math.max(0, Math.floor(segment.startSeconds))}s`,
      endOffset: `${Math.max(1, Math.floor(segment.endSeconds))}s`
    }
  };

  const contents = [{ role: 'user', parts: [videoPart, { text: prompt }] }];
  const config = buildConfig(allowedCategories);

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
  const models = deps.models ?? VIDEO_ANALYSIS_MODELS;
  const segment = resolveSegment(body);
  const segmentIndex = Number.isFinite(Number(body.segmentIndex)) ? Math.max(0, Math.floor(Number(body.segmentIndex))) : 0;

  const findings: GeneratedVideoFinding[] = [];
  let response: RawAnalysisResponse;
  let unusableTimestampCount = 0;

  try {
    const client = createClient(apiKey);
    response = await runAnalysisPass(
      client,
      videoUrl,
      buildPrompt(context, body, segment),
      segment,
      allowedCategories,
      models
    );
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

  for (const raw of response.findings) {
    const finding = normaliseFinding(raw, {
      offsetSeconds: segment.startSeconds,
      marginBefore: body.clipMarginBeforeSeconds,
      marginAfter: body.clipMarginAfterSeconds,
      windowLengthSeconds: segment.endSeconds - segment.startSeconds
    });

    if (!finding) {
      unusableTimestampCount += 1;
      continue;
    }
    if (!isFindingCategoryAllowed(finding, allowedCategories)) continue;
    findings.push(finding);
  }

  // Every reported situation was unusable: never store a corrupt result.
  if (response.findings.length > 0 && unusableTimestampCount === response.findings.length) {
    return {
      success: false,
      errorCode: 'invalid_ai_response',
      error: 'The AI returned situations without usable timestamps, so nothing was saved. Please retry.'
    };
  }

  return {
    success: true,
    videoAnalyzed: true,
    context,
    segmentIndex,
    segment,
    summary: response.summary.trim(),
    patterns: response.patterns,
    conclusions: response.conclusions,
    findings: findings.sort((a, b) => a.timestampSeconds - b.timestampSeconds),
    isEmpty: isEmptyResponse(response)
  };
}
