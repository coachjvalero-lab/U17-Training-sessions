import { supabase } from '../../supabaseClient';
import type { OpponentAnalysis, OpponentAnalysisTag } from '../../types';

const OPPONENT_ANALYSIS_TABLE = 'opponent_analysis';

type OpponentAnalysisRow = {
  id: string;
  opponent_team_id: string;
  tags: string[] | null;
  slides_url: string | null;
  video_url: string | null;
  summary: string | null;
  created_at: string | null;
  updated_at: string | null;
};

function getClient() {
  if (!supabase) throw new Error('Supabase client is not configured');
  return supabase;
}

function fromRow(row: OpponentAnalysisRow): OpponentAnalysis {
  return {
    id: row.id,
    opponentTeamId: row.opponent_team_id,
    tags: Array.isArray(row.tags) ? (row.tags as OpponentAnalysisTag[]) : [],
    slidesUrl: row.slides_url ?? null,
    videoUrl: row.video_url ?? null,
    summary: row.summary ?? '',
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined
  };
}

export async function getOpponentAnalysisByOpponentTeamId(opponentTeamId: string): Promise<OpponentAnalysis | null> {
  const { data, error } = await getClient()
    .from(OPPONENT_ANALYSIS_TABLE)
    .select('*')
    .eq('opponent_team_id', opponentTeamId)
    .maybeSingle();

  if (error) throw error;
  return data ? fromRow(data as OpponentAnalysisRow) : null;
}

export async function createOrUpdateOpponentAnalysis(input: Partial<OpponentAnalysis> & Pick<OpponentAnalysis, 'opponentTeamId' | 'summary'>): Promise<OpponentAnalysis> {
  const payload = {
    id: input.id,
    opponent_team_id: input.opponentTeamId,
    tags: input.tags ?? [],
    slides_url: input.slidesUrl ?? null,
    video_url: input.videoUrl ?? null,
    summary: input.summary,
    updated_at: new Date().toISOString()
  };

  const { data, error } = await getClient()
    .from(OPPONENT_ANALYSIS_TABLE)
    .upsert(payload, { onConflict: 'opponent_team_id' })
    .select('*')
    .single();

  if (error) throw error;
  return fromRow(data as OpponentAnalysisRow);
}

export async function updateOpponentAnalysisTags(opponentTeamId: string, tags: OpponentAnalysisTag[]): Promise<OpponentAnalysis> {
  const { data, error } = await getClient()
    .from(OPPONENT_ANALYSIS_TABLE)
    .update({ tags, updated_at: new Date().toISOString() })
    .eq('opponent_team_id', opponentTeamId)
    .select('*')
    .single();

  if (error) throw error;
  return fromRow(data as OpponentAnalysisRow);
}

export async function updateOpponentAnalysisSlidesUrl(opponentTeamId: string, slidesUrl: string | null): Promise<OpponentAnalysis> {
  const { data, error } = await getClient()
    .from(OPPONENT_ANALYSIS_TABLE)
    .update({ slides_url: slidesUrl, updated_at: new Date().toISOString() })
    .eq('opponent_team_id', opponentTeamId)
    .select('*')
    .single();

  if (error) throw error;
  return fromRow(data as OpponentAnalysisRow);
}

export async function updateOpponentAnalysisVideoUrl(opponentTeamId: string, videoUrl: string | null): Promise<OpponentAnalysis> {
  const { data, error } = await getClient()
    .from(OPPONENT_ANALYSIS_TABLE)
    .update({ video_url: videoUrl, updated_at: new Date().toISOString() })
    .eq('opponent_team_id', opponentTeamId)
    .select('*')
    .single();

  if (error) throw error;
  return fromRow(data as OpponentAnalysisRow);
}
