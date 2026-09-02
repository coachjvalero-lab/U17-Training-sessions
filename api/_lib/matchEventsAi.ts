import { GoogleGenAI, Type } from '@google/genai';

export interface GenerateMatchEventsRequestBody {
  matchId?: string;
  videoUrl?: string;
  additionalNotes?: string;
  matchContext?: {
    homeTeam?: string;
    awayTeam?: string;
    isHome?: boolean;
    competition?: string;
    date?: string;
    squad?: Array<{ id?: string; name?: string; shirtNumber?: number | string; position?: string }>;
  };
}

export interface GeneratedMatchEvent {
  minute: number;
  videoTimestampSeconds: number;
  eventType: string;
  teamSide: string;
  playerId?: string | null;
  playerName?: string;
  relatedPlayerId?: string | null;
  relatedPlayerName?: string;
  description: string;
}

export type GenerateMatchEventsErrorCode =
  | 'missing_video_url'
  | 'unsupported_video_source'
  | 'not_configured'
  | 'analysis_failed';

export interface GenerateMatchEventsSuccess {
  success: true;
  /** Always true: this codepath never returns events that were not derived from the video itself. */
  videoAnalyzed: true;
  summary: string;
  events: GeneratedMatchEvent[];
}

export interface GenerateMatchEventsFailure {
  success: false;
  errorCode: GenerateMatchEventsErrorCode;
  error: string;
}

export type GenerateMatchEventsResult = GenerateMatchEventsSuccess | GenerateMatchEventsFailure;

// This project does not enable strictNullChecks, so plain `if (result.success)` control-flow
// narrowing on the discriminated union does not work reliably; use this type predicate instead.
export function isGenerateMatchEventsFailure(result: GenerateMatchEventsResult): result is GenerateMatchEventsFailure {
  return result.success === false;
}

// Only stable (non-preview) identifiers confirmed in the installed @google/genai SDK's
// own model type union. Do not add identifiers back without re-verifying against the SDK.
export const CANDIDATE_MODELS = ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-flash-latest'] as const;

const YOUTUBE_HOSTS = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'music.youtube.com'];

export function isYoutubeUrl(rawUrl: string | undefined | null): boolean {
  if (!rawUrl) return false;
  try {
    return YOUTUBE_HOSTS.includes(new URL(rawUrl).hostname.toLowerCase());
  } catch {
    return false;
  }
}

function buildPrompt(body: GenerateMatchEventsRequestBody): string {
  const { matchContext, additionalNotes } = body;
  const squadListRaw = Array.isArray(matchContext?.squad) ? matchContext!.squad! : [];
  const squadList = squadListRaw.length > 0
    ? squadListRaw.slice(0, 18).map((p) => `${p.name || 'Player'} (#${p.shirtNumber ?? '?'}, id: "${p.id}")`).join(', ')
    : 'Plantilla disponible';

  return `Analista táctico de fútbol. Analiza el vídeo adjunto de este partido y extrae ÚNICAMENTE los eventos que observes realmente en la grabación:
- Partido: ${matchContext?.homeTeam || 'Local'} vs ${matchContext?.awayTeam || 'Visitante'}
- Competición: ${matchContext?.competition || 'Liga'} | Fecha: ${matchContext?.date || 'Hoy'}
- Notas del entrenador: ${additionalNotes || 'Sin notas adicionales.'}
- Plantilla jugadoras: ${squadList}

No inventes eventos que no aparezcan en el vídeo. Si no puedes identificar ningún evento con certeza, devuelve una lista vacía en "events".
Para goles/córners rivales, teamSide="opponent".
Para eventos de nuestro equipo, usa jugadoras de la plantilla si es posible.
Para sustituciones usa substitution_out (playerId = quien sale, relatedPlayerId = quien entra) y el mismo minuto para ambas jugadoras.
Descripciones en español breves y tácticas.`;
}

function buildConfig() {
  return {
    systemInstruction: 'Eres un analista táctico de fútbol profesional. Analizas el vídeo adjunto y devuelves siempre un objeto JSON estructurado con summary y events, basado exclusivamente en lo que observas en el vídeo.',
    responseMimeType: 'application/json',
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        summary: {
          type: Type.STRING,
          description: 'Resumen táctico del partido y de los momentos clave en español.'
        },
        events: {
          type: Type.ARRAY,
          description: 'Lista cronológica de eventos del partido observados en el vídeo.',
          items: {
            type: Type.OBJECT,
            properties: {
              minute: { type: Type.INTEGER, description: 'Minuto del partido (1-95)' },
              videoTimestampSeconds: { type: Type.INTEGER, description: 'Segundo en el vídeo' },
              eventType: {
                type: Type.STRING,
                description: 'goal, opponent_goal, corner, opponent_corner, assist, yellow_card, red_card, substitution_in, substitution_out, own_goal, injury, other'
              },
              teamSide: { type: Type.STRING, description: 'our_team o opponent' },
              playerId: { type: Type.STRING, description: 'ID de la jugadora si es de nuestro equipo' },
              playerName: { type: Type.STRING, description: 'Nombre de la jugadora' },
              relatedPlayerId: { type: Type.STRING, description: 'ID de la jugadora relacionada' },
              relatedPlayerName: { type: Type.STRING, description: 'Nombre de jugadora relacionada' },
              description: { type: Type.STRING, description: 'Descripción táctica de la jugada' }
            },
            required: ['minute', 'videoTimestampSeconds', 'eventType', 'teamSide', 'description']
          }
        }
      },
      required: ['summary', 'events']
    }
  };
}

/** Strip an API key value out of an error message before it can ever reach a log or HTTP response. */
function sanitizeErrorMessage(message: string, apiKey: string | undefined): string {
  if (!apiKey) return message;
  return message.split(apiKey).join('[REDACTED]');
}

export interface GeminiClient {
  models: {
    generateContent: (args: unknown) => Promise<{ text?: string } | undefined>;
  };
}

export function createGeminiClient(apiKey: string): GeminiClient {
  return new GoogleGenAI({
    apiKey,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
  });
}

/**
 * Tries each candidate model, always with the video attached. Never falls back to a
 * text-only prompt: a video analysis failure must surface as an error, not as
 * fabricated events that look like a real analysis.
 */
export async function runVideoAnalysis(
  client: GeminiClient,
  videoUrl: string,
  prompt: string,
  models: readonly string[] = CANDIDATE_MODELS
): Promise<{ summary: string; events: GeneratedMatchEvent[] }> {
  const contents = [{ role: 'user', parts: [{ fileData: { fileUri: videoUrl } }, { text: prompt }] }];
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

      const events = (parsed as { events?: unknown })?.events;
      if (!Array.isArray(events)) {
        lastError = new Error(`Model ${model} response did not include an events array.`);
        continue;
      }

      return {
        summary: (parsed as { summary?: string }).summary || 'Timeline táctico generado por IA a partir del análisis del vídeo.',
        events: events as GeneratedMatchEvent[]
      };
    } catch (err) {
      lastError = err;
      console.warn(`[generateMatchEvents] Model ${model} failed analysing the video:`, err instanceof Error ? err.message : err);
    }
  }

  const message = lastError instanceof Error ? lastError.message : String(lastError ?? 'Unknown error');
  throw new Error(message);
}

export async function generateMatchEvents(
  body: GenerateMatchEventsRequestBody,
  apiKey: string | undefined,
  deps: { createClient?: (apiKey: string) => GeminiClient } = {}
): Promise<GenerateMatchEventsResult> {
  const videoUrl = typeof body.videoUrl === 'string' ? body.videoUrl.trim() : '';

  if (!videoUrl) {
    return {
      success: false,
      errorCode: 'missing_video_url',
      error: 'Debes indicar la URL de un vídeo de YouTube para analizar el partido.'
    };
  }

  if (!isYoutubeUrl(videoUrl)) {
    return {
      success: false,
      errorCode: 'unsupported_video_source',
      error: 'La URL debe ser un enlace de YouTube (público o no listado). Otras plataformas no están soportadas para el análisis de vídeo.'
    };
  }

  if (!apiKey) {
    return {
      success: false,
      errorCode: 'not_configured',
      error: 'GEMINI_API_KEY no está configurada en el servidor.'
    };
  }

  const createClient = deps.createClient ?? createGeminiClient;

  try {
    const client = createClient(apiKey);
    const prompt = buildPrompt(body);
    const { summary, events } = await runVideoAnalysis(client, videoUrl, prompt);

    return {
      success: true,
      videoAnalyzed: true,
      summary,
      events
    };
  } catch (err) {
    const rawMessage = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      errorCode: 'analysis_failed',
      error: sanitizeErrorMessage(
        `No se pudo analizar el vídeo con IA: ${rawMessage}`,
        apiKey
      )
    };
  }
}
