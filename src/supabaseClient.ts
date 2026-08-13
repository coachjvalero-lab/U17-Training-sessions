import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type DataProvider = 'supabase';
export type BackendProvider = 'supabase';

const env = typeof import.meta !== 'undefined' && import.meta && 'env' in import.meta ? import.meta.env : {};
const supabaseUrl = (env as Record<string, string | undefined>).VITE_SUPABASE_URL;
const supabaseAnonKey = (env as Record<string, string | undefined>).VITE_SUPABASE_ANON_KEY;

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
