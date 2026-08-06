import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type DataProvider = 'firebase' | 'supabase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export function getDataProvider(): DataProvider {
  const raw = (import.meta.env.VITE_DATA_PROVIDER || 'firebase').toLowerCase();
  return raw === 'supabase' ? 'supabase' : 'firebase';
}

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl as string, supabaseAnonKey as string)
  : null;

export function isSupabaseEnabled(): boolean {
  return getDataProvider() === 'supabase' && isSupabaseConfigured;
}
