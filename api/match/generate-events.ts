import { generateMatchEvents, isGenerateMatchEventsFailure, type GenerateMatchEventsRequestBody } from '../_lib/matchEventsAi';
import { requireSupabaseUser } from '../_lib/supabaseAuth';

function readJsonBody(req: any): Promise<GenerateMatchEventsRequestBody> {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  if (typeof req.body === 'string') {
    try {
      return Promise.resolve(req.body ? JSON.parse(req.body) : {});
    } catch {
      return Promise.resolve({});
    }
  }

  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk: unknown) => {
      raw += chunk;
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'POST, OPTIONS');
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    res.status(405).json({ success: false, error: 'Method Not Allowed. Use POST.' });
    return;
  }

  const isAuthenticated = await requireSupabaseUser(req.headers?.authorization);
  if (!isAuthenticated) {
    res.status(401).json({ success: false, error: 'No autenticado. Inicia sesión para generar eventos con IA.' });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const result = await generateMatchEvents(body, process.env.GEMINI_API_KEY);
    if (!isGenerateMatchEventsFailure(result)) {
      res.status(200).json(result);
      return;
    }
    const status = result.errorCode === 'not_configured' ? 500 : result.errorCode === 'analysis_failed' ? 502 : 400;
    res.status(status).json(result);
  } catch (error: any) {
    console.error('[api/match/generate-events] Unexpected failure:', error);
    res.status(500).json({ success: false, error: error?.message || 'Error processing request' });
  }
}
