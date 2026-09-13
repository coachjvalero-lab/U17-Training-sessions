// package.json sets "type": "module", so the compiled function runs as native ESM on Vercel:
// relative imports must carry an explicit extension or Node cannot resolve them at runtime.
import { analyseVideo, isAnalyseVideoFailure, type AnalyseVideoRequestBody } from '../_lib/videoAnalysisAi.js';
import { requireSupabaseUser } from '../_lib/supabaseAuth.js';

function readJsonBody(req: any): Promise<AnalyseVideoRequestBody> {
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

export function statusForAnalyseVideoError(errorCode: string): number {
  if (errorCode === 'not_configured') return 500;
  if (errorCode === 'analysis_failed' || errorCode === 'invalid_ai_response') return 502;
  return 400;
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
    res.status(401).json({ success: false, error: 'Not authenticated. Sign in to analyse video with AI.' });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const result = await analyseVideo(body, process.env.GEMINI_API_KEY);
    if (!isAnalyseVideoFailure(result)) {
      res.status(200).json(result);
      return;
    }
    res.status(statusForAnalyseVideoError(result.errorCode)).json(result);
  } catch (error: any) {
    console.error('[api/video/analyse] Unexpected failure:', error);
    res.status(500).json({ success: false, error: error?.message || 'Error processing request' });
  }
}
