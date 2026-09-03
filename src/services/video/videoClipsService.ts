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
  created_at: string | null;
  match_analysis_id: string | null;
  opponent_match_notes_id: string | null;
  training_analysis_id: string | null;
  scouting_report_id: string | null;
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
    createdAt: row.created_at ?? undefined,
    matchAnalysisId: row.match_analysis_id,
    opponentMatchNotesId: row.opponent_match_notes_id,
    trainingAnalysisId: row.training_analysis_id,
    scoutingReportId: row.scouting_report_id
  };
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
  input: Pick<VideoClip, 'videoUrl' | 'startTime' | 'endTime' | 'title' | 'notes'>
): Promise<VideoClip> {
  const payload = {
    video_url: input.videoUrl,
    start_time: input.startTime,
    end_time: input.endTime ?? null,
    title: input.title,
    notes: input.notes ?? null,
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
  input: Pick<VideoClip, 'videoUrl' | 'startTime' | 'endTime' | 'title' | 'notes'>
): Promise<VideoClip> {
  const payload = {
    video_url: input.videoUrl,
    start_time: input.startTime,
    end_time: input.endTime ?? null,
    title: input.title,
    notes: input.notes ?? null,
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
  input: Pick<VideoClip, 'videoUrl' | 'startTime' | 'endTime' | 'title' | 'notes'>
): Promise<VideoClip> {
  const payload = {
    video_url: input.videoUrl,
    start_time: input.startTime,
    end_time: input.endTime ?? null,
    title: input.title,
    notes: input.notes ?? null,
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
