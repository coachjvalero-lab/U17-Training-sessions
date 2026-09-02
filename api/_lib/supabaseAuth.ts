import { createClient } from '@supabase/supabase-js';

export interface SupabaseUserLookup {
  getUser: (token: string) => Promise<{ data: { user: unknown } | null; error: unknown }>;
}

export function extractBearerToken(authorizationHeader: string | string[] | undefined): string | null {
  const header = Array.isArray(authorizationHeader) ? authorizationHeader[0] : authorizationHeader;
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
}

/**
 * Validates the caller's Supabase session token. Reuses the same Supabase project the
 * frontend already talks to (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY) — no new auth
 * system, no service-role key involved.
 */
export async function verifySupabaseUser(
  authorizationHeader: string | string[] | undefined,
  deps: SupabaseUserLookup
): Promise<boolean> {
  const token = extractBearerToken(authorizationHeader);
  if (!token) return false;

  try {
    const { data, error } = await deps.getUser(token);
    return Boolean(data?.user) && !error;
  } catch {
    return false;
  }
}

export function createSupabaseUserLookup(): SupabaseUserLookup | null {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return null;

  const client = createClient(supabaseUrl, supabaseAnonKey);
  return {
    getUser: (token: string) => client.auth.getUser(token)
  };
}

export async function requireSupabaseUser(authorizationHeader: string | string[] | undefined): Promise<boolean> {
  const lookup = createSupabaseUserLookup();
  if (!lookup) return false;
  return verifySupabaseUser(authorizationHeader, lookup);
}
