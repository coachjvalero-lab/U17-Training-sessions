import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

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

export interface GenerateMatchEventsResult {
  success: true;
  isFallback: boolean;
  summary: string;
  events: GeneratedMatchEvent[];
  /** Only present when isFallback is true: why the AI path could not be used. */
  fallbackReason?: string;
  /** Only present when isFallback is false and the video was analysed directly. */
  videoAnalyzed?: boolean;
}

const CANDIDATE_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-3.7-flash',
  'gemini-flash-latest',
  'gemini-2.5-flash'
];

const YOUTUBE_HOSTS = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'music.youtube.com'];

export function isYoutubeUrl(rawUrl: string | undefined | null): boolean {
  if (!rawUrl) return false;
  try {
    return YOUTUBE_HOSTS.includes(new URL(rawUrl).hostname.toLowerCase());
  } catch {
    return false;
  }
}

function buildPrompt(body: GenerateMatchEventsRequestBody, hasVideo: boolean): string {
  const { matchContext, additionalNotes, videoUrl } = body;
  const squadListRaw = Array.isArray(matchContext?.squad) ? matchContext!.squad! : [];
  const squadList = squadListRaw.length > 0
    ? squadListRaw.slice(0, 18).map((p) => `${p.name || 'Player'} (#${p.shirtNumber ?? '?'}, id: "${p.id}")`).join(', ')
    : 'Plantilla disponible';

  const videoLine = hasVideo
    ? '- Vídeo adjunto: analiza el vídeo del partido y extrae los eventos reales que observes, con su minuto y su segundo exacto dentro del vídeo.'
    : `- Vídeo de referencia (no analizable directamente): ${videoUrl || 'no disponible'}`;

  return `Analista táctico de fútbol. Genera un timeline cronológico de eventos para este partido:
- Partido: ${matchContext?.homeTeam || 'Local'} vs ${matchContext?.awayTeam || 'Visitante'}
- Competición: ${matchContext?.competition || 'Liga'} | Fecha: ${matchContext?.date || 'Hoy'}
${videoLine}
- Notas del entrenador / Vídeo: ${additionalNotes || 'Generar eventos representativos: goles, córners a favor y en contra, sustituciones y tarjetas.'}
- Plantilla jugadoras: ${squadList}

${hasVideo
    ? 'Genera únicamente los eventos que realmente aparecen en el vídeo.'
    : 'Genera entre 5 y 10 eventos tácticos realistas (goles, córners de ambos equipos, cambios, tarjetas).'}
Para goles/córners rivales, teamSide="opponent".
Para eventos de nuestro equipo, usa jugadoras de la plantilla si es posible.
Para sustituciones usa substitution_out (playerId = quien sale, relatedPlayerId = quien entra) y el mismo minuto para ambas jugadoras.
Descripciones en español breves y tácticas.`;
}

function buildConfig(model: string) {
  const config: Record<string, unknown> = {
    systemInstruction: 'Eres un analista táctico de fútbol profesional. Devuelve siempre un objeto JSON estructurado con summary y events.',
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
          description: 'Lista cronológica de eventos del partido.',
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

  if (model.startsWith('gemini-3')) {
    config.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
  }

  return config;
}

function buildFallbackEvents(body: GenerateMatchEventsRequestBody): { events: GeneratedMatchEvent[]; opponentName: string } {
  const matchContext = body.matchContext;
  const squadListRaw = Array.isArray(matchContext?.squad) ? matchContext!.squad! : [];
  const oppName = matchContext?.awayTeam === 'Al-Ula FC' || matchContext?.awayTeam === 'AlUla FC'
    ? (matchContext?.homeTeam || 'Rival')
    : (matchContext?.awayTeam || 'Rival');

  const p1 = squadListRaw[0];
  const p2 = squadListRaw[1] || squadListRaw[0];
  const p3 = squadListRaw[2] || squadListRaw[0];
  const p4 = squadListRaw[3] || squadListRaw[1] || squadListRaw[0];

  const events: GeneratedMatchEvent[] = [
    {
      minute: 14,
      videoTimestampSeconds: 840,
      eventType: 'corner',
      teamSide: 'our_team',
      playerId: p1?.id || null,
      playerName: p1?.name || 'Nuestra jugadora',
      description: 'Córner cerrado a favor al primer palo con remate de cabeza generado.'
    },
    {
      minute: 27,
      videoTimestampSeconds: 1620,
      eventType: 'goal',
      teamSide: 'our_team',
      playerId: p2?.id || null,
      playerName: p2?.name || 'Nuestra delantera',
      relatedPlayerId: p1?.id || null,
      relatedPlayerName: p1?.name || '',
      description: 'Gol tras triangulación rápida y finalización ajustada dentro del área.'
    },
    {
      minute: 38,
      videoTimestampSeconds: 2280,
      eventType: 'opponent_corner',
      teamSide: 'opponent',
      playerId: null,
      playerName: oppName,
      description: 'Córner botado por el rival al segundo palo defendido sólidamente por nuestra zaga.'
    },
    {
      minute: 54,
      videoTimestampSeconds: 3240,
      eventType: 'yellow_card',
      teamSide: 'our_team',
      playerId: p3?.id || null,
      playerName: p3?.name || 'Nuestra jugadora',
      description: 'Falta táctica en repliegue defensivo para frenar la transición contraria.'
    },
    {
      minute: 65,
      videoTimestampSeconds: 3900,
      eventType: 'substitution_out',
      teamSide: 'our_team',
      playerId: p2?.id || null,
      playerName: p2?.name || 'Nuestra jugadora',
      relatedPlayerId: p4?.id || null,
      relatedPlayerName: p4?.name || '',
      description: 'Cambio táctico para aportar frescura y mayor profundidad ofensiva.'
    },
    {
      minute: 76,
      videoTimestampSeconds: 4560,
      eventType: 'opponent_goal',
      teamSide: 'opponent',
      playerId: null,
      playerName: oppName,
      description: 'Gol del rival tras un disparo exterior en segunda jugada.'
    },
    {
      minute: 85,
      videoTimestampSeconds: 5100,
      eventType: 'goal',
      teamSide: 'our_team',
      playerId: p4?.id || p1?.id || null,
      playerName: p4?.name || p1?.name || 'Nuestra jugadora',
      description: 'Gol decisivo en los minutos finales tras robo en campo rival y disparo cruzado.'
    }
  ];

  return { events, opponentName: oppName };
}

export async function generateMatchEvents(
  body: GenerateMatchEventsRequestBody,
  apiKey: string | undefined
): Promise<GenerateMatchEventsResult> {
  const videoUrl = typeof body.videoUrl === 'string' ? body.videoUrl.trim() : '';
  const canAnalyzeVideo = isYoutubeUrl(videoUrl);
  let fallbackReason = '';

  if (apiKey) {
    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });

      // Try with the video attached first (Gemini accepts public/unlisted YouTube URLs
      // as a fileData part); fall back to a text-only prompt if the video is not usable.
      const attempts = canAnalyzeVideo ? [true, false] : [false];

      for (const withVideo of attempts) {
        const prompt = buildPrompt(body, withVideo);
        const contents = withVideo
          ? [{ role: 'user', parts: [{ fileData: { fileUri: videoUrl } }, { text: prompt }] }]
          : prompt;

        for (const model of CANDIDATE_MODELS) {
          try {
            const response = await ai.models.generateContent({
              model,
              contents: contents as never,
              config: buildConfig(model) as never
            });

            if (response?.text) {
              const parsed = JSON.parse(response.text);
              return {
                success: true,
                isFallback: false,
                videoAnalyzed: withVideo,
                summary: parsed.summary || 'Timeline táctico generado por IA con éxito.',
                events: Array.isArray(parsed.events) ? parsed.events : []
              };
            }
          } catch (err) {
            fallbackReason = err instanceof Error ? err.message : String(err);
            console.warn(`[generateMatchEvents] Model ${model} (video=${withVideo}) failed:`, fallbackReason);
          }
        }
      }
    } catch (err) {
      fallbackReason = err instanceof Error ? err.message : String(err);
      console.warn('[generateMatchEvents] AI client error:', fallbackReason);
    }
  } else {
    fallbackReason = 'GEMINI_API_KEY no está configurada en el servidor.';
  }

  const { events, opponentName } = buildFallbackEvents(body);
  return {
    success: true,
    isFallback: true,
    fallbackReason: fallbackReason || 'El servicio de IA no devolvió resultados.',
    summary: `Timeline táctico generado automáticamente con base en el rival (${opponentName}) y la plantilla convocada. Puedes editar o ajustar cualquier acción.`,
    events
  };
}
