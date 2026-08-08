import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type DataProvider = 'firebase' | 'supabase';
export type BackendProvider = 'firebase' | 'supabase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

function parseProvider(raw: string | undefined | null, fallback: BackendProvider): BackendProvider {
  const normalized = (raw || '').toLowerCase();
  if (normalized === 'supabase') return 'supabase';
  if (normalized === 'firebase') return 'firebase';
  return fallback;
}

export function getDataProvider(): DataProvider {
  const raw = (import.meta.env.VITE_DATA_PROVIDER || 'firebase').toLowerCase();
  return raw === 'supabase' ? 'supabase' : 'firebase';
}

export function getAuthProvider(): BackendProvider {
  const fallback: BackendProvider = isSupabaseConfigured ? 'supabase' : 'firebase';
  return parseProvider(import.meta.env.VITE_AUTH_PROVIDER, fallback);
}

export function getPermissionsProvider(): BackendProvider {
  const fallback: BackendProvider = getAuthProvider();
  return parseProvider(import.meta.env.VITE_PERMISSIONS_DATA_PROVIDER, fallback);
}

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl as string, supabaseAnonKey as string)
  : null;

export function isSupabaseEnabled(): boolean {
  return getDataProvider() === 'supabase' && isSupabaseConfigured;
}

export function isSupabaseAuthEnabled(): boolean {
  return getAuthProvider() === 'supabase' && isSupabaseConfigured;
}

export function isSupabasePermissionsEnabled(): boolean {
  return getPermissionsProvider() === 'supabase' && isSupabaseConfigured;
}
