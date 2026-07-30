import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { TrainingSession } from './types';
import { CloudTrainingSession } from './firebase';

const DEFAULT_SUPABASE_URL = 'https://qbvdasmfvezvritbaypf.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFidmRhc21mdmV6dnJpdGJheXBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2NDIwMDIsImV4cCI6MjEwMDIxODAwMn0.gR--8s41Hvm07Y0IH2z0Qqo3KCaT2FC0-4fVlehRW7Y';

const SUPABASE_URL_KEY = 'u17_supabase_url';
const SUPABASE_ANON_KEY = 'u17_supabase_anon_key';

export function getSupabaseCredentials(): { url: string; key: string } | null {
  const meta = import.meta as any;
  const envUrl = meta.env?.VITE_SUPABASE_URL || '';
  const envKey = meta.env?.VITE_SUPABASE_ANON_KEY || '';

  const localUrl = localStorage.getItem(SUPABASE_URL_KEY) || '';
  const localKey = localStorage.getItem(SUPABASE_ANON_KEY) || '';

  const url = (localUrl || envUrl || DEFAULT_SUPABASE_URL).trim();
  const key = (localKey || envKey || DEFAULT_SUPABASE_ANON_KEY).trim();

  if (url && key) {
    return { url, key };
  }
  return null;
}

export function saveSupabaseCredentials(url: string, key: string): void {
  if (url && key) {
    localStorage.setItem(SUPABASE_URL_KEY, url.trim());
    localStorage.setItem(SUPABASE_ANON_KEY, key.trim());
  } else {
    localStorage.removeItem(SUPABASE_URL_KEY);
    localStorage.removeItem(SUPABASE_ANON_KEY);
  }
}

let cachedClient: SupabaseClient | null = null;
let lastUrl = '';
let lastKey = '';

export function getSupabaseClient(): SupabaseClient | null {
  const creds = getSupabaseCredentials();
  if (!creds) return null;

  if (!cachedClient || lastUrl !== creds.url || lastKey !== creds.key) {
    cachedClient = createClient(creds.url, creds.key);
    lastUrl = creds.url;
    lastKey = creds.key;
  }
  return cachedClient;
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseCredentials() !== null;
}

export async function saveSessionToSupabase(session: TrainingSession): Promise<number> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase client is not configured');
  }

  const saveTimestamp = Date.now();
  const cleanSession = JSON.parse(JSON.stringify(session));

  // Upsert session object into 'sessions' table
  const { error } = await supabase
    .from('sessions')
    .upsert({
      id: session.id,
      updated_at: saveTimestamp,
      data: {
        ...cleanSession,
        updatedAt: saveTimestamp
      }
    }, { onConflict: 'id' });

  if (error) {
    console.error('Supabase save error:', error);
    throw error;
  }

  return saveTimestamp;
}

export async function deleteSessionFromSupabase(sessionId: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const { error } = await supabase
    .from('sessions')
    .delete()
    .eq('id', sessionId);

  if (error) {
    console.error('Supabase delete error:', error);
  }
}

export async function fetchSupabaseSessions(): Promise<CloudTrainingSession[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Supabase fetch error:', error);
    return [];
  }

  return (data || []).map(row => {
    if (row.data) {
      return {
        ...row.data,
        updatedAt: row.updated_at || row.data.updatedAt || Date.now()
      };
    }
    return row as CloudTrainingSession;
  });
}

export function subscribeToSupabaseSessions(
  callback: (sessions: CloudTrainingSession[]) => void,
  onError?: (err: any) => void
) {
  const supabase = getSupabaseClient();
  if (!supabase) return () => {};

  // First fetch current data
  fetchSupabaseSessions()
    .then(sessions => callback(sessions))
    .catch(err => onError?.(err));

  // Subscribe to real-time changes on 'sessions' table
  const channel = supabase
    .channel('public:sessions')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'sessions' },
      () => {
        fetchSupabaseSessions()
          .then(sessions => callback(sessions))
          .catch(err => onError?.(err));
      }
    )
    .subscribe((status, err) => {
      if (status === 'CHANNEL_ERROR') {
        console.warn('Supabase real-time channel error:', err);
        onError?.(err);
      }
    });

  return () => {
    supabase.removeChannel(channel);
  };
}
