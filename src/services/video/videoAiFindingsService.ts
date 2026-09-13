import { supabase } from '../../supabaseClient';
import type { VideoAiFinding, VideoAiFindingStatus, VideoAnalysisAiContext } from '../../types';

const VIDEO_AI_FINDINGS_TABLE = 'video_ai_findings';

/** Exactly one of these identifies the analysis a finding belongs to (mirrors video_clips). */
export interface VideoAiFindingOwner {
  matchAnalysisId?: string | null;
  opponentAnalysisId?: string | null;
  trainingAnalysisId?: string | null;
  scoutingReportId?: string | null;
}

export interface VideoAiFindingInput {
  category?: string | null;
  title: string;
  observation: string;
  suggestedTags?: string[];
  confidence?: number | null;
  videoUrl?: string | null;
  timestampSeconds?: number | null;
  startTime?: number | null;
  endTime?: number | null;
}

type VideoAiFindingRow = {
  id: string;
  context: VideoAnalysisAiContext;
  match_analysis_id: string | null;
  opponent_analysis_id: string | null;
  training_analysis_id: string | null;
  scouting_report_id: string | null;
  category: string | null;
  title: string;
  observation: string;
  suggested_tags: string[] | null;
  confidence: number | string | null;
  review_status: VideoAiFindingStatus;
  video_url: string | null;
  timestamp_seconds: number | null;
  start_time: number | null;
  end_time: number | null;
  model: string | null;
  created_at: string | null;
  updated_at: string | null;
};

function getClient() {
  if (!supabase) throw new Error('Supabase client is not configured');
  return supabase;
}

function fromRow(row: VideoAiFindingRow): VideoAiFinding {
  return {
    id: row.id,
    context: row.context,
    matchAnalysisId: row.match_analysis_id,
    opponentAnalysisId: row.opponent_analysis_id,
    trainingAnalysisId: row.training_analysis_id,
    scoutingReportId: row.scouting_report_id,
    category: row.category,
    title: row.title,
    observation: row.observation,
    suggestedTags: Array.isArray(row.suggested_tags) ? row.suggested_tags : [],
    confidence: row.confidence == null ? null : Number(row.confidence),
    reviewStatus: row.review_status,
    videoUrl: row.video_url,
    timestampSeconds: row.timestamp_seconds,
    startTime: row.start_time,
    endTime: row.end_time,
    model: row.model,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined
  };
}

function ownerColumn(owner: VideoAiFindingOwner): { column: string; value: string } {
  if (owner.matchAnalysisId) return { column: 'match_analysis_id', value: owner.matchAnalysisId };
  if (owner.opponentAnalysisId) return { column: 'opponent_analysis_id', value: owner.opponentAnalysisId };
  if (owner.trainingAnalysisId) return { column: 'training_analysis_id', value: owner.trainingAnalysisId };
  if (owner.scoutingReportId) return { column: 'scouting_report_id', value: owner.scoutingReportId };
  throw new Error('A video AI finding must belong to exactly one analysis');
}

export async function listVideoAiFindings(owner: VideoAiFindingOwner): Promise<VideoAiFinding[]> {
  const { column, value } = ownerColumn(owner);
  const { data, error } = await getClient()
    .from(VIDEO_AI_FINDINGS_TABLE)
    .select('*')
    .eq(column, value)
    .order('timestamp_seconds', { ascending: true });

  if (error) throw error;
  return ((data || []) as VideoAiFindingRow[]).map(fromRow);
}

export async function createVideoAiFindings(
  context: VideoAnalysisAiContext,
  owner: VideoAiFindingOwner,
  findings: VideoAiFindingInput[],
  model?: string | null
): Promise<VideoAiFinding[]> {
  if (findings.length === 0) return [];
  const { column, value } = ownerColumn(owner);

  const rows = findings.map((finding) => ({
    context,
    [column]: value,
    category: finding.category ?? null,
    title: finding.title,
    observation: finding.observation,
    suggested_tags: finding.suggestedTags ?? [],
    confidence: finding.confidence ?? null,
    review_status: 'pending' as VideoAiFindingStatus,
    video_url: finding.videoUrl ?? null,
    timestamp_seconds: finding.timestampSeconds ?? null,
    start_time: finding.startTime ?? null,
    end_time: finding.endTime ?? null,
    model: model ?? null
  }));

  const { data, error } = await getClient()
    .from(VIDEO_AI_FINDINGS_TABLE)
    .insert(rows)
    .select('*');

  if (error) throw error;
  return ((data || []) as VideoAiFindingRow[]).map(fromRow);
}

export async function updateVideoAiFinding(
  findingId: string,
  patch: Partial<Pick<VideoAiFinding, 'title' | 'observation' | 'category' | 'suggestedTags' | 'startTime' | 'endTime' | 'reviewStatus'>>
): Promise<VideoAiFinding> {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined) payload.title = patch.title;
  if (patch.observation !== undefined) payload.observation = patch.observation;
  if (patch.category !== undefined) payload.category = patch.category ?? null;
  if (patch.suggestedTags !== undefined) payload.suggested_tags = patch.suggestedTags;
  if (patch.startTime !== undefined) payload.start_time = patch.startTime ?? null;
  if (patch.endTime !== undefined) payload.end_time = patch.endTime ?? null;
  if (patch.reviewStatus !== undefined) payload.review_status = patch.reviewStatus;

  const { data, error } = await getClient()
    .from(VIDEO_AI_FINDINGS_TABLE)
    .update(payload)
    .eq('id', findingId)
    .select('*')
    .single();

  if (error) throw error;
  return fromRow(data as VideoAiFindingRow);
}

export async function deleteVideoAiFinding(findingId: string): Promise<void> {
  const { error } = await getClient()
    .from(VIDEO_AI_FINDINGS_TABLE)
    .delete()
    .eq('id', findingId);

  if (error) throw error;
}
