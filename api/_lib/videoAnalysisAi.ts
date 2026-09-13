import { Type } from '@google/genai';
import {
  CANDIDATE_MODELS,
  createGeminiClient,
  isYoutubeUrl,
  type GeminiClient
} from './matchEventsAi';

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
  /** Existing Video Analysis taxonomy (clip categories / opponent tags). Never invent a new one. */
  taxonomy?: VideoAnalysisTaxonomyEntry[];
  subject?: {
    teamName?: string;
    opponentName?: string;
    playerName?: string;
    competition?: string;
    date?: string;
  };
  /** Total video length, when known: used to split long footage into analysable segments. */
  durationSeconds?: number;
  /** Explicit segments override (skips automatic segmentation). */
  segments?: VideoAnalysisSegment[];
  clipMarginBeforeSeconds?: number;
  clipMarginAfterSeconds?: number;
}

export interface GeneratedVideoFinding {
  category: string | null;
  title: string;
  observation: string;
  suggestedTags: string[];
  confidence: number | null;
  /** Absolute seconds in the full video, clip margins already applied. */
  startTime: number;
  endTime: number;
}

export type AnalyseVideoErrorCode =
  | 'missing_video_url'
  | 'unsupported_video_source'
  | 'invalid_context'
  | 'not_configured'
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
  segmentsAnalysed: number;
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
/** Long footage is analysed in chunks rather than asking for a whole 90' match in one call. */
export const MAX_SEGMENT_LENGTH_SECONDS = 900;
export const MAX_SEGMENTS = 8;

export function isVideoAnalysisContext(value: unknown): value is VideoAnalysisContext {
  return typeof value === 'string' && (VIDEO_ANALYSIS_CONTEXTS as string[]).includes(value);
}

/** Splits a video into sequential windows so a long match never hits the model in one request. */
export function buildSegments(
  durationSeconds: number | undefined,
  segmentLengthSeconds: number = MAX_SEGMENT_LENGTH_SECONDS,
  maxSegments: number = MAX_SEGMENTS
): VideoAnalysisSegment[] {
  if (!durationSeconds || !Number.isFinite(durationSeconds) || durationSeconds <= 0) return [];
  if (durationSeconds <= segmentLengthSeconds) return [];

  const segments: VideoAnalysisSegment[] = [];
  for (let start = 0; start < durationSeconds && segments.length < maxSegments; start += segmentLengthSeconds) {
    segments.push({ startSeconds: start, endSeconds: Math.min(start + segmentLengthSeconds, durationSeconds) });
  }
  return segments;
}

/** Turns a detected moment into a playable clip window (margin before/after, never negative). */
export function applyClipMargins(
  startSeconds: number,
  endSeconds: number | null | undefined,
  marginBefore: number = DEFAULT_CLIP_MARGIN_BEFORE_SECONDS,
  marginAfter: number = DEFAULT_CLIP_MARGIN_AFTER_SECONDS
): { startTime: number; endTime: number } {
  const safeStart = Number.isFinite(startSeconds) && startSeconds > 0 ? Math.floor(startSeconds) : 0;
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
  const observation = typeof raw.observation === 'string' ? raw.observation.trim() : '';
  if (!title && !observation) return null;

  const offset = options.offsetSeconds ?? 0;
  const rawStart = Number(raw.startTimeSeconds);
  const rawEnd = raw.endTimeSeconds == null ? null : Number(raw.endTimeSeconds);
  const { startTime, endTime } = applyClipMargins(
    (Number.isFinite(rawStart) ? rawStart : 0) + offset,
    rawEnd == null || !Number.isFinite(rawEnd) ? null : rawEnd + offset,
    options.marginBefore,
    options.marginAfter
  );

  const rawCategory = typeof raw.category === 'string' ? raw.category.trim() : '';
  const allowed = options.allowedCategories;
  const category = rawCategory && (!allowed || allowed.length === 0 || allowed.includes(rawCategory))
    ? rawCategory
    : null;

  const suggestedTags = Array.isArray(raw.suggestedTags)
    ? raw.suggestedTags.filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0).map((tag) => tag.trim())
    : [];

  return {
    category,
    title: title || observation.slice(0, 80),
    observation,
    suggestedTags,
    confidence: clampConfidence(raw.confidence),
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
      return `Focus exclusively on ${opponent}: how they build up, press, defend, transition and attack set pieces. Report recurring behaviours and exploitable weaknesses.`;
    case 'scouting':
      return `Focus exclusively on ${player}: individual technical, tactical, physical and mental actions. Every finding must be evidence a scout could show as a clip.`;
    case 'my_analysis':
    default:
      return `Focus exclusively on ${team} (our own team): relevant situations to review with the squad, both good executions and correctable errors.`;
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

  const segmentNote = segment
    ? `You are watching ONLY the segment from ${segment.startSeconds}s to ${segment.endSeconds}s of a longer video. Report "startTimeSeconds"/"endTimeSeconds" RELATIVE TO THE START OF THIS SEGMENT (0 = the first frame you see).`
    : 'Report "startTimeSeconds"/"endTimeSeconds" as absolute seconds from the start of the video.';

  return `You are a professional football video analyst. Analyse the attached video and extract ONLY what you actually observe in the footage.

${buildContextInstructions(context, body.subject)}

Context:
- Team: ${body.subject?.teamName || 'n/a'}
- Opponent: ${body.subject?.opponentName || 'n/a'}
- Player: ${body.subject?.playerName || 'n/a'}
- Competition: ${body.subject?.competition || 'n/a'} | Date: ${body.subject?.date || 'n/a'}
- Analyst notes: ${body.additionalNotes?.trim() || 'none'}

Use ONLY these category values (exact string) for "category": ${taxonomy}.
${segmentNote}

Rules:
- Never invent situations that are not visible in the footage. If you cannot identify anything with confidence, return an empty "findings" array.
- "confidence" is a number between 0 and 1 expressing how certain you are of what you saw.
- Keep "title" short (max 8 words) and "observation" to 1-3 factual sentences.
- "patterns" are repeated behaviours across several findings; "conclusions" are preliminary takeaways that the analyst still has to validate.`;
}

function buildConfig() {
  return {
    systemInstruction:
      'You are a professional football video analyst. You always return a structured JSON object with summary, patterns, conclusions and findings, based exclusively on what you observe in the attached video.',
    responseMimeType: 'application/json',
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        summary: { type: Type.STRING, description: 'Short analytical summary of what was observed.' },
        patterns: { type: Type.ARRAY, description: 'Repeated behaviours observed.', items: { type: Type.STRING } },
        conclusions: { type: Type.ARRAY, description: 'Preliminary conclusions pending analyst validation.', items: { type: Type.STRING } },
        findings: {
          type: Type.ARRAY,
          description: 'Relevant situations observed in the video.',
          items: {
            type: Type.OBJECT,
            properties: {
              category: { type: Type.STRING, description: 'One of the provided category values, or empty.' },
              title: { type: Type.STRING, description: 'Short label for the situation.' },
              observation: { type: Type.STRING, description: 'Factual description of what happens.' },
              suggestedTags: { type: Type.ARRAY, description: 'Short free tags.', items: { type: Type.STRING } },
              confidence: { type: Type.NUMBER, description: 'Confidence between 0 and 1.' },
              startTimeSeconds: { type: Type.INTEGER, description: 'Second the situation starts.' },
              endTimeSeconds: { type: Type.INTEGER, description: 'Second the situation ends.' }
            },
            required: ['title', 'observation', 'startTimeSeconds']
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

interface RawAnalysisResponse {
  summary: string;
  patterns: string[];
  conclusions: string[];
  findings: Array<Record<string, unknown>>;
}

/**
 * Tries each candidate model, always with the video attached. Never falls back to a text-only
 * prompt: a video analysis failure must surface as an error, not as fabricated findings.
 */
export async function runSegmentAnalysis(
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
      if (!response?.text) {
        lastError = new Error(`Model ${model} returned an empty response.`);
        continue;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(response.text);
      } catch (parseErr) {
        lastError = new Error(`Model ${model} returned invalid JSON: ${parseErr instanceof Error ? parseErr.message : parseErr}`);
        continue;
      }

      const findings = (parsed as { findings?: unknown })?.findings;
      if (!Array.isArray(findings)) {
        lastError = new Error(`Model ${model} response did not include a findings array.`);
        continue;
      }

      const record = parsed as Partial<RawAnalysisResponse>;
      return {
        summary: typeof record.summary === 'string' ? record.summary : '',
        patterns: Array.isArray(record.patterns) ? record.patterns.filter((item): item is string => typeof item === 'string') : [],
        conclusions: Array.isArray(record.conclusions) ? record.conclusions.filter((item): item is string => typeof item === 'string') : [],
        findings: findings as Array<Record<string, unknown>>
      };
    } catch (err) {
      lastError = err;
      console.warn(`[analyseVideo] Model ${model} failed analysing the video:`, err instanceof Error ? err.message : err);
    }
  }

  throw new Error(lastError instanceof Error ? lastError.message : String(lastError ?? 'Unknown error'));
}

export async function analyseVideo(
  body: AnalyseVideoRequestBody,
  apiKey: string | undefined,
  deps: { createClient?: (apiKey: string) => GeminiClient } = {}
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
  const segments = Array.isArray(body.segments) && body.segments.length > 0
    ? body.segments.slice(0, MAX_SEGMENTS)
    : buildSegments(body.durationSeconds);
  const passes: Array<VideoAnalysisSegment | null> = segments.length > 0 ? segments : [null];

  const createClient = deps.createClient ?? createGeminiClient;

  try {
    const client = createClient(apiKey);
    const summaries: string[] = [];
    const patterns: string[] = [];
    const conclusions: string[] = [];
    const findings: GeneratedVideoFinding[] = [];

    for (const segment of passes) {
      const prompt = buildPrompt(context, body, segment);
      const result = await runSegmentAnalysis(client, videoUrl, prompt, segment);

      if (result.summary) summaries.push(result.summary);
      patterns.push(...result.patterns);
      conclusions.push(...result.conclusions);

      for (const raw of result.findings) {
        const finding = normaliseFinding(raw, {
          offsetSeconds: segment ? segment.startSeconds : 0,
          allowedCategories,
          marginBefore: body.clipMarginBeforeSeconds,
          marginAfter: body.clipMarginAfterSeconds
        });
        if (finding) findings.push(finding);
      }
    }

    findings.sort((a, b) => a.startTime - b.startTime);

    return {
      success: true,
      videoAnalyzed: true,
      context,
      summary: summaries.join('\n\n'),
      patterns: Array.from(new Set(patterns)),
      conclusions: Array.from(new Set(conclusions)),
      findings,
      segmentsAnalysed: passes.length
    };
  } catch (err) {
    const rawMessage = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      errorCode: 'analysis_failed',
      error: sanitizeErrorMessage(`The video could not be analysed with AI: ${rawMessage}`, apiKey)
    };
  }
}
