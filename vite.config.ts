import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import dotenv from 'dotenv';
import { defineConfig, Plugin } from 'vite';
import { generateMatchEvents, isGenerateMatchEventsFailure } from './api/_lib/matchEventsAi';
import { analyseVideo, isAnalyseVideoFailure } from './api/_lib/videoAnalysisAi';
import { statusForAnalyseVideoError } from './api/video/analyse';
import { requireSupabaseUser } from './api/_lib/supabaseAuth';
import { fetchOfficialSaffStandings, SAFF_COMPETITION_ID, SAFF_COMPETITION_URL } from './api/_lib/saffStandings';

// Server-only secrets (GEMINI_API_KEY) are not exposed by Vite's env handling,
// so load them into process.env for the dev API middleware.
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

function apiEndpointsPlugin(): Plugin {
  return {
    name: 'api-endpoints-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0];

        if (url === '/api/health') {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ status: 'ok', time: new Date().toISOString() }));
          return;
        }

        if (url === '/api/competition/saff-standings') {
          if (req.method !== 'GET') {
            res.statusCode = 405;
            res.setHeader('Allow', 'GET');
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Method not allowed' }));
            return;
          }

          try {
            const standings = await fetchOfficialSaffStandings();
            res.statusCode = 200;
            res.setHeader('Cache-Control', 'public, max-age=300');
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ competitionId: SAFF_COMPETITION_ID, sourceUrl: SAFF_COMPETITION_URL, standings }));
          } catch (error) {
            res.statusCode = 502;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Official SAFF standings are unavailable' }));
          }
          return;
        }

        if (url === '/api/match/generate-events' && req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Allow', 'POST');
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: false, error: 'Method Not Allowed. Use POST.' }));
          return;
        }

        if (url === '/api/match/generate-events' && req.method === 'POST') {
          const isAuthenticated = await requireSupabaseUser(req.headers?.authorization);
          if (!isAuthenticated) {
            res.statusCode = 401;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: 'No autenticado. Inicia sesión para generar eventos con IA.' }));
            return;
          }

          let bodyStr = '';
          req.on('data', (chunk) => {
            bodyStr += chunk;
          });
          req.on('end', async () => {
            try {
              const body = bodyStr ? JSON.parse(bodyStr) : {};
              const result = await generateMatchEvents(body || {}, process.env.GEMINI_API_KEY);
              res.statusCode = !isGenerateMatchEventsFailure(result)
                ? 200
                : result.errorCode === 'not_configured' ? 500 : result.errorCode === 'analysis_failed' ? 502 : 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(result));
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: err?.message || 'Error processing request' }));
            }
          });
          return;
        }

        if (url === '/api/video/analyse' && req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Allow', 'POST');
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: false, error: 'Method Not Allowed. Use POST.' }));
          return;
        }

        if (url === '/api/video/analyse' && req.method === 'POST') {
          const isAuthenticated = await requireSupabaseUser(req.headers?.authorization);
          if (!isAuthenticated) {
            res.statusCode = 401;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: 'Not authenticated. Sign in to analyse video with AI.' }));
            return;
          }

          let videoBodyStr = '';
          req.on('data', (chunk) => {
            videoBodyStr += chunk;
          });
          req.on('end', async () => {
            try {
              const body = videoBodyStr ? JSON.parse(videoBodyStr) : {};
              const result = await analyseVideo(body || {}, process.env.GEMINI_API_KEY);
              res.statusCode = !isAnalyseVideoFailure(result) ? 200 : statusForAnalyseVideoError(result.errorCode);
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(result));
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: err?.message || 'Error processing request' }));
            }
          });
          return;
        }

        next();
      });
    }
  };
}

export default defineConfig(() => {
  return {
    base: '/',
    plugins: [react(), tailwindcss(), apiEndpointsPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
