import { supabase } from '../../supabaseClient';
import type { TrainingAnalysis } from '../../types';

const TRAINING_ANALYSIS_TABLE = 'training_analysis';
const SESSIONS_TABLE = 'sessions';

type TrainingAnalysisRow = {
  id: string;
  session_uid: string;
  summary: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export interface FootballSessionSummary {
  id: string;
  date: string;
  sessionNumber: string;
  mainObjective: string;
}

type SessionSummaryRow = {
  id: string;
  date: string | null;
  session_number: string | null;
  main_objective: string | null;
};

function getClient() {
  if (!supabase) throw new Error('Supabase client is not configured');
  return supabase;
}

function fromRow(row: TrainingAnalysisRow): TrainingAnalysis {
  return {
    id: row.id,
    sessionUid: row.session_uid,
    summary: row.summary ?? '',
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined
  };
}

// Video Analysis only reads football training sessions here; it never writes to public.sessions.
export async function listRecentFootballSessions(): Promise<FootballSessionSummary[]> {
  const { data, error } = await getClient()
    .from(SESSIONS_TABLE)
    .select('id, date, session_number, main_objective')
    .order('date', { ascending: false });

  if (error) throw error;
  return ((data || []) as SessionSummaryRow[]).map((row) => ({
    id: row.id,
    date: row.date ?? '',
    sessionNumber: row.session_number ?? '',
    mainObjective: row.main_objective ?? ''
  }));
}

export async function getTrainingAnalysisBySessionUid(sessionUid: string): Promise<TrainingAnalysis | null> {
  const { data, error } = await getClient()
    .from(TRAINING_ANALYSIS_TABLE)
    .select('*')
    .eq('session_uid', sessionUid)
    .maybeSingle();

  if (error) throw error;
  return data ? fromRow(data as TrainingAnalysisRow) : null;
}

export async function createOrUpdateTrainingAnalysis(input: Partial<TrainingAnalysis> & Pick<TrainingAnalysis, 'sessionUid' | 'summary'>): Promise<TrainingAnalysis> {
  const payload = {
    id: input.id,
    session_uid: input.sessionUid,
    summary: input.summary,
    updated_at: new Date().toISOString()
  };

  const { data, error } = await getClient()
    .from(TRAINING_ANALYSIS_TABLE)
    .upsert(payload, { onConflict: 'session_uid' })
    .select('*')
    .single();

  if (error) throw error;
  return fromRow(data as TrainingAnalysisRow);
}
