import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type DataProvider = 'supabase';
export type BackendProvider = 'supabase';

// import.meta.env only exists under Vite; guard it so pure modules that import this file
// (transitively) can still be run/tested under plain Node (e.g. `tsx --test`) without crashing.
const viteEnv = (import.meta as { env?: Record<string, string | undefined> }).env ?? {};
const supabaseUrl = viteEnv.VITE_SUPABASE_URL;
const supabaseAnonKey = viteEnv.VITE_SUPABASE_ANON_KEY;

export function getDataProvider(): DataProvider {
  return 'supabase';
}

export function resolveAuthProvider(): BackendProvider {
  return 'supabase';
}

export function getPermissionsProvider(): BackendProvider {
  return 'supabase';
}

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl as string, supabaseAnonKey as string)
  : null;

export function isSupabaseEnabled(): boolean {
  return isSupabaseConfigured;
}

export function isSupabaseAuthEnabled(): boolean {
  return isSupabaseConfigured;
}

export function isSupabasePermissionsEnabled(): boolean {
  return isSupabaseConfigured;
}
