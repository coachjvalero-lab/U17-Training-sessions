import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type DataProvider = 'supabase';
export type BackendProvider = 'supabase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

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
