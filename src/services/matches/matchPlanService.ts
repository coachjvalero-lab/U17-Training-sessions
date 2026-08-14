import { supabase } from '../../supabaseClient';
import type { MatchPlanEntry, MatchPlanPhase } from '../../types';

const MATCH_PLAN_TABLE = 'match_plan';

type MatchPlanRow = {
  id: string;
  match_id: string;
  phase: MatchPlanPhase;
  notes: string | null;
  video_url: string | null;
  image_1_url: string | null;
  image_2_url: string | null;
  pdf_url: string | null;
  created_at: string | null;
  updated_at: string | null;
};

function getClient() {
  if (!supabase) throw new Error('Supabase client is not configured');
  return supabase;
}

function fromRow(row: MatchPlanRow): MatchPlanEntry {
  return {
    id: row.id,
    matchId: row.match_id,
    phase: row.phase,
    notes: row.notes ?? '',
    videoUrl: row.video_url ?? null,
    image1Url: row.image_1_url ?? null,
    image2Url: row.image_2_url ?? null,
    pdfUrl: row.pdf_url ?? null,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined
  };
}

export async function getMatchPlan(matchId: string): Promise<MatchPlanEntry[]> {
  const { data, error } = await getClient()
    .from(MATCH_PLAN_TABLE)
    .select('*')
    .eq('match_id', matchId)
    .order('phase', { ascending: true });

  if (error) throw error;
  return ((data || []) as MatchPlanRow[]).map(fromRow);
}

export async function getMatchPlanPhase(matchId: string, phase: MatchPlanPhase): Promise<MatchPlanEntry | null> {
  const { data, error } = await getClient()
    .from(MATCH_PLAN_TABLE)
    .select('*')
    .eq('match_id', matchId)
    .eq('phase', phase)
    .maybeSingle();

  if (error) throw error;
  return data ? fromRow(data as MatchPlanRow) : null;
}

export async function upsertMatchPlanPhase(input: Partial<MatchPlanEntry> & Pick<MatchPlanEntry, 'matchId' | 'phase'>): Promise<MatchPlanEntry> {
  const payload = {
    id: input.id,
    match_id: input.matchId,
    phase: input.phase,
    notes: input.notes ?? '',
    video_url: input.videoUrl ?? null,
    image_1_url: input.image1Url ?? null,
    image_2_url: input.image2Url ?? null,
    pdf_url: input.pdfUrl ?? null,
    updated_at: new Date().toISOString()
  };

  const { data, error } = await getClient()
    .from(MATCH_PLAN_TABLE)
    .upsert(payload, { onConflict: 'match_id,phase' })
    .select('*')
    .single();

  if (error) throw error;
  return fromRow(data as MatchPlanRow);
}

export async function deleteMatchPlanPhase(matchId: string, phase: MatchPlanPhase): Promise<void> {
  const { error } = await getClient()
    .from(MATCH_PLAN_TABLE)
    .delete()
    .eq('match_id', matchId)
    .eq('phase', phase);

  if (error) throw error;
}
