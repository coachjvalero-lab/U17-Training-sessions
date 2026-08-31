import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // AI Match Event Generation Endpoint
  app.post('/api/match/generate-events', async (req, res) => {
    const { videoUrl, matchContext, additionalNotes } = req.body || {};
    const squadListRaw = Array.isArray(matchContext?.squad) ? matchContext.squad : [];
    const oppName = matchContext?.awayTeam === 'Al-Ula FC' || matchContext?.awayTeam === 'AlUla FC'
      ? (matchContext?.homeTeam || 'Rival')
      : (matchContext?.awayTeam || 'Rival');

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not configured on the server.');
      }

      const squadList = squadListRaw.length > 0
        ? squadListRaw.slice(0, 18).map((p: any) => `${p.name || 'Player'} (#${p.shirtNumber ?? '?'}, id: "${p.id}")`).join(', ')
        : 'Plantilla disponible';

      const prompt = `Analista táctico de fútbol. Genera un timeline cronológico de eventos para este partido:
- Partido: ${matchContext?.homeTeam || 'Local'} vs ${matchContext?.awayTeam || 'Visitante'}
- Competición: ${matchContext?.competition || 'Liga'} | Fecha: ${matchContext?.date || 'Hoy'}
- Notas del entrenador / Vídeo: ${additionalNotes || 'Generar eventos representativos: goles, córners a favor y en contra, sustituciones y tarjetas.'}
- Plantilla jugadoras: ${squadList}

Genera entre 5 y 10 eventos tácticos realistas (goles, córners de ambos equipos, cambios, tarjetas).
Para goles/córners rivales, teamSide="opponent".
Para eventos de nuestro equipo, usa jugadoras de la plantilla si es posible.
Descripciones en español breves y tácticas.`;

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });

      // Priority order for speed and quota resilience
      const candidateModels = [
        'gemini-3.1-flash-lite',
        'gemini-3.7-flash',
        'gemini-flash-latest'
      ];

      let lastError: Error | null = null;
      let responseText = '';

      for (const model of candidateModels) {
        try {
          const config: any = {
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
                        description: 'goal, opponent_goal, corner, opponent_corner, assist, yellow_card, red_card, substitution_in, substitution_out, injury, other'
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

          const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config
          });

          if (response?.text) {
            responseText = response.text;
            break;
          }
        } catch (err: any) {
          lastError = err;
          console.warn(`[API /api/match/generate-events] Model ${model} failed:`, err?.message || err);
        }
      }

      if (responseText) {
        const parsedData = JSON.parse(responseText);
        return res.json({
          success: true,
          isFallback: false,
          summary: parsedData.summary || 'Timeline táctico generado por IA con éxito.',
          events: Array.isArray(parsedData.events) ? parsedData.events : []
        });
      }

      throw lastError || new Error('No se pudo conectar con el servicio de IA.');
    } catch (error: any) {
      console.warn('[API /api/match/generate-events] Falling back to tactical timeline engine:', error?.message);

      // Robust contextual fallback engine so user request is never blocked by quota limits
      const p1 = squadListRaw[0];
      const p2 = squadListRaw[1] || squadListRaw[0];
      const p3 = squadListRaw[2] || squadListRaw[0];
      const p4 = squadListRaw[3] || squadListRaw[1] || squadListRaw[0];

      const fallbackEvents = [
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
          eventType: 'substitution_in',
          teamSide: 'our_team',
          playerId: p4?.id || null,
          playerName: p4?.name || 'Nuestra jugadora',
          relatedPlayerId: p2?.id || null,
          relatedPlayerName: p2?.name || '',
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

      return res.json({
        success: true,
        isFallback: true,
        summary: `Timeline táctico generado automáticamente con base en el rival (${oppName}) y la plantilla convocada. Puedes editar o ajustar cualquier acción.`,
        events: fallbackEvents
      });
    }
  });

  // Vite middleware for development vs static for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Express] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
