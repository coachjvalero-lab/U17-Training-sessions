import { supabase } from '../../supabaseClient';
import type { VideoClip } from '../../types';

const VIDEO_CLIPS_TABLE = 'video_clips';

type VideoClipRow = {
  id: string;
  video_url: string;
  start_time: number;
  end_time: number | null;
  title: string;
  notes: string | null;
  category: string | null;
  created_at: string | null;
  match_analysis_id: string | null;
  opponent_match_notes_id: string | null;
  opponent_analysis_id: string | null;
  training_analysis_id: string | null;
  scouting_report_id: string | null;
  ai_finding_id: string | null;
  match_event_id: string | null;
};

function getClient() {
  if (!supabase) throw new Error('Supabase client is not configured');
  return supabase;
}

function fromRow(row: VideoClipRow): VideoClip {
  return {
    id: row.id,
    videoUrl: row.video_url,
    startTime: row.start_time,
    endTime: row.end_time,
    title: row.title,
    notes: row.notes,
    category: row.category,
    createdAt: row.created_at ?? undefined,
    matchAnalysisId: row.match_analysis_id,
    opponentMatchNotesId: row.opponent_match_notes_id,
    trainingAnalysisId: row.training_analysis_id,
    scoutingReportId: row.scouting_report_id,
    aiFindingId: row.ai_finding_id,
    matchEventId: row.match_event_id
  };
}

/** Exactly one owner column, mirroring the video_clips_single_owner constraint. */
export interface VideoClipOwner {
  matchAnalysisId?: string | null;
  opponentAnalysisId?: string | null;
  trainingAnalysisId?: string | null;
  scoutingReportId?: string | null;
}

function ownerColumn(owner: VideoClipOwner): { column: string; value: string } {
  if (owner.matchAnalysisId) return { column: 'match_analysis_id', value: owner.matchAnalysisId };
  if (owner.opponentAnalysisId) return { column: 'opponent_analysis_id', value: owner.opponentAnalysisId };
  if (owner.trainingAnalysisId) return { column: 'training_analysis_id', value: owner.trainingAnalysisId };
  if (owner.scoutingReportId) return { column: 'scouting_report_id', value: owner.scoutingReportId };
  throw new Error('A video clip must belong to exactly one analysis');
}

export async function listVideoClipsByOwner(owner: VideoClipOwner): Promise<VideoClip[]> {
  const { column, value } = ownerColumn(owner);
  const { data, error } = await getClient()
    .from(VIDEO_CLIPS_TABLE)
    .select('*')
    .eq(column, value)
    .order('start_time', { ascending: true });

  if (error) throw error;
  return ((data || []) as VideoClipRow[]).map(fromRow);
}

/**
 * Owner-generic clip creation used by the AI review flow (confirming a finding creates its clip).
 * The per-area helpers below stay as they are for the existing manual add-clip forms.
 */
export async function createVideoClipForOwner(
  owner: VideoClipOwner,
  input: Pick<VideoClip, 'videoUrl' | 'startTime' | 'endTime' | 'title' | 'notes' | 'category'> &
    Pick<VideoClip, 'aiFindingId' | 'matchEventId'>
): Promise<VideoClip> {
  const { column, value } = ownerColumn(owner);
  const payload = {
    video_url: input.videoUrl,
    start_time: input.startTime,
    end_time: input.endTime ?? null,
    title: input.title,
    notes: input.notes ?? null,
    category: input.category ?? null,
    ai_finding_id: input.aiFindingId ?? null,
    match_event_id: input.matchEventId ?? null,
    [column]: value
  };

  const { data, error } = await getClient()
    .from(VIDEO_CLIPS_TABLE)
    .insert(payload)
    .select('*')
    .single();

  if (error) throw error;
  return fromRow(data as VideoClipRow);
}


export async function listVideoClipsByMatchAnalysisId(matchAnalysisId: string): Promise<VideoClip[]> {
  const { data, error } = await getClient()
    .from(VIDEO_CLIPS_TABLE)
    .select('*')
    .eq('match_analysis_id', matchAnalysisId)
    .order('start_time', { ascending: true });

  if (error) throw error;
  return ((data || []) as VideoClipRow[]).map(fromRow);
}

export async function createVideoClipForMatchAnalysis(
  matchAnalysisId: string,
  input: Pick<VideoClip, 'videoUrl' | 'startTime' | 'endTime' | 'title' | 'notes' | 'category'>
): Promise<VideoClip> {
  const payload = {
    video_url: input.videoUrl,
    start_time: input.startTime,
    end_time: input.endTime ?? null,
    title: input.title,
    notes: input.notes ?? null,
    category: input.category ?? null,
    match_analysis_id: matchAnalysisId
  };

  const { data, error } = await getClient()
    .from(VIDEO_CLIPS_TABLE)
    .insert(payload)
    .select('*')
    .single();

  if (error) throw error;
  return fromRow(data as VideoClipRow);
}

export async function listVideoClipsByTrainingAnalysisId(trainingAnalysisId: string): Promise<VideoClip[]> {
  const { data, error } = await getClient()
    .from(VIDEO_CLIPS_TABLE)
    .select('*')
    .eq('training_analysis_id', trainingAnalysisId)
    .order('start_time', { ascending: true });

  if (error) throw error;
  return ((data || []) as VideoClipRow[]).map(fromRow);
}

export async function createVideoClipForTrainingAnalysis(
  trainingAnalysisId: string,
  input: Pick<VideoClip, 'videoUrl' | 'startTime' | 'endTime' | 'title' | 'notes' | 'category'>
): Promise<VideoClip> {
  const payload = {
    video_url: input.videoUrl,
    start_time: input.startTime,
    end_time: input.endTime ?? null,
    title: input.title,
    notes: input.notes ?? null,
    category: input.category ?? null,
    training_analysis_id: trainingAnalysisId
  };

  const { data, error } = await getClient()
    .from(VIDEO_CLIPS_TABLE)
    .insert(payload)
    .select('*')
    .single();

  if (error) throw error;
  return fromRow(data as VideoClipRow);
}

export async function deleteVideoClip(clipId: string): Promise<void> {
  const { error } = await getClient()
    .from(VIDEO_CLIPS_TABLE)
    .delete()
    .eq('id', clipId);

  if (error) throw error;
}

export async function listVideoClipsByScoutingReportId(scoutingReportId: string): Promise<VideoClip[]> {
  const { data, error } = await getClient()
    .from(VIDEO_CLIPS_TABLE)
    .select('*')
    .eq('scouting_report_id', scoutingReportId)
    .order('start_time', { ascending: true });

  if (error) throw error;
  return ((data || []) as VideoClipRow[]).map(fromRow);
}

export async function createVideoClipForScoutingReport(
  scoutingReportId: string,
  input: Pick<VideoClip, 'videoUrl' | 'startTime' | 'endTime' | 'title' | 'notes' | 'category'>
): Promise<VideoClip> {
  const payload = {
    video_url: input.videoUrl,
    start_time: input.startTime,
    end_time: input.endTime ?? null,
    title: input.title,
    notes: input.notes ?? null,
    category: input.category ?? null,
    scouting_report_id: scoutingReportId
  };

  const { data, error } = await getClient()
    .from(VIDEO_CLIPS_TABLE)
    .insert(payload)
    .select('*')
    .single();

  if (error) throw error;
  return fromRow(data as VideoClipRow);
}
