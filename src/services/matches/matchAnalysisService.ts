import { supabase } from '../../supabaseClient';
import type { MatchAnalysis } from '../../types';

const MATCH_ANALYSIS_TABLE = 'match_analysis';

type MatchAnalysisRow = {
  id: string;
  match_id: string;
  analyzed_team_id: string;
  summary: string | null;
  created_at: string | null;
  updated_at: string | null;
};

function getClient() {
  if (!supabase) throw new Error('Supabase client is not configured');
  return supabase;
}

function fromRow(row: MatchAnalysisRow): MatchAnalysis {
  return {
    id: row.id,
    matchId: row.match_id,
    analyzedTeamId: row.analyzed_team_id,
    summary: row.summary ?? '',
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined
  };
}

export async function listMatchAnalysesByMatchId(matchId: string): Promise<MatchAnalysis[]> {
  const { data, error } = await getClient()
    .from(MATCH_ANALYSIS_TABLE)
    .select('*')
    .eq('match_id', matchId);

  if (error) throw error;
  return ((data || []) as MatchAnalysisRow[]).map(fromRow);
}

export async function getMatchAnalysis(matchId: string, analyzedTeamId: string): Promise<MatchAnalysis | null> {
  const { data, error } = await getClient()
    .from(MATCH_ANALYSIS_TABLE)
    .select('*')
    .eq('match_id', matchId)
    .eq('analyzed_team_id', analyzedTeamId)
    .maybeSingle();

  if (error) throw error;
  return data ? fromRow(data as MatchAnalysisRow) : null;
}

export async function createOrUpdateMatchAnalysis(input: Partial<MatchAnalysis> & Pick<MatchAnalysis, 'matchId' | 'analyzedTeamId' | 'summary'>): Promise<MatchAnalysis> {
  const payload = {
    id: input.id,
    match_id: input.matchId,
    analyzed_team_id: input.analyzedTeamId,
    summary: input.summary,
    updated_at: new Date().toISOString()
  };

  const { data, error } = await getClient()
    .from(MATCH_ANALYSIS_TABLE)
    .upsert(payload, { onConflict: 'match_id,analyzed_team_id' })
    .select('*')
    .single();

  if (error) throw error;
  return fromRow(data as MatchAnalysisRow);
}
