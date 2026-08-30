import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';

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
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          error: 'GEMINI_API_KEY is not configured on the server. Please ensure the API key is set.'
        });
      }

      const { videoUrl, matchContext, additionalNotes } = req.body || {};

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });

      const squadList = Array.isArray(matchContext?.squad)
        ? matchContext.squad.map((p: any) => `- ID: "${p.id}", Name: "${p.name}", #${p.shirtNumber ?? '?'}, Pos: "${p.position || 'UTIL'}"`).join('\n')
        : 'No squad roster provided.';

      const prompt = `
You are an expert tactical football video analyst and match logger.
Analyze this fixture and generate a realistic, detailed chronological timeline of match events based on the provided video URL, match context, and notes.

MATCH CONTEXT:
- Match Video URL: ${videoUrl || 'Not provided'}
- Home Team: ${matchContext?.homeTeam || 'Home Team'}
- Away Team: ${matchContext?.awayTeam || 'Away Team'}
- Is Our Team Home: ${matchContext?.isHome ? 'Yes' : 'No'}
- Competition: ${matchContext?.competition || 'League'}
- Match Date: ${matchContext?.date || 'Today'}
- Additional Coach Notes / Video Description / Timeline:
${additionalNotes || 'Generate a comprehensive set of realistic match events including goals, opponent goals, our corners, opponent corners, cards, and substitutions.'}

OUR SQUAD PLAYERS:
${squadList}

TASK:
Generate a chronological timeline of key match events.
Make sure to include:
1. 'goal' (our team goal, assign to a squad player from the list if possible)
2. 'opponent_goal' (goal scored by the opponent team, teamSide must be "opponent")
3. 'corner' (corner kick for our team, teamSide must be "our_team")
4. 'opponent_corner' (corner kick for opponent team, teamSide must be "opponent")
5. 'yellow_card' / 'red_card' (disciplinary events)
6. 'substitution_in' / 'substitution_out' (tactical changes)
7. 'assist' (key passes leading to our goals)

RULES:
- Video timestamp in seconds (videoTimestampSeconds) must correspond naturally to match minute (e.g., minute 15 -> ~900s, minute 45 -> ~2700s, second half minute 60 -> ~3600s).
- Event type must be one of: "goal", "opponent_goal", "corner", "opponent_corner", "assist", "yellow_card", "red_card", "substitution_in", "substitution_out", "injury", "other".
- For "opponent_goal" and "opponent_corner", teamSide MUST be "opponent" and playerId can be null or empty.
- For our team events, try to use a valid playerId from the OUR SQUAD PLAYERS list above.
- Provide a brief tactical summary of the match in "summary".
- Provide an insightful description for each event in Spanish (e.g., "Córner cerrado al primer palo rematado de cabeza", "Gol en transición rápida tras recuperación", "Gol rival en contraataque").
`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: prompt,
        config: {
          systemInstruction: 'You are a professional tactical match analyst for an elite football academy. Generate accurate, clean structured JSON match event timelines.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: {
                type: Type.STRING,
                description: 'Tactical summary of the match and generated events in Spanish.'
              },
              events: {
                type: Type.ARRAY,
                description: 'List of chronological match events.',
                items: {
                  type: Type.OBJECT,
                  properties: {
                    minute: {
                      type: Type.INTEGER,
                      description: 'Minute of the match (0 to 120).'
                    },
                    videoTimestampSeconds: {
                      type: Type.INTEGER,
                      description: 'Timestamp in the video in seconds.'
                    },
                    eventType: {
                      type: Type.STRING,
                      description: 'Type of event: goal, opponent_goal, corner, opponent_corner, assist, yellow_card, red_card, substitution_in, substitution_out, injury, other.'
                    },
                    teamSide: {
                      type: Type.STRING,
                      description: 'our_team or opponent'
                    },
                    playerId: {
                      type: Type.STRING,
                      description: 'Matching squad player ID if for our team, otherwise null.'
                    },
                    playerName: {
                      type: Type.STRING,
                      description: 'Name of the player involved.'
                    },
                    relatedPlayerId: {
                      type: Type.STRING,
                      description: 'Related squad player ID (e.g. assister or subbed out player).'
                    },
                    relatedPlayerName: {
                      type: Type.STRING,
                      description: 'Name of related player.'
                    },
                    description: {
                      type: Type.STRING,
                      description: 'Short tactical description of the action in Spanish.'
                    }
                  },
                  required: ['minute', 'videoTimestampSeconds', 'eventType', 'teamSide', 'description']
                }
              }
            },
            required: ['summary', 'events']
          }
        }
      });

      const responseText = response.text || '{}';
      const parsedData = JSON.parse(responseText);

      return res.json({
        success: true,
        summary: parsedData.summary || '',
        events: Array.isArray(parsedData.events) ? parsedData.events : []
      });
    } catch (error: any) {
      console.error('[API /api/match/generate-events] Error generating match events:', error);
      return res.status(500).json({
        error: error?.message || 'Error occurred while generating events with AI.'
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
