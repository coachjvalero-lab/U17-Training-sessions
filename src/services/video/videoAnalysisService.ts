import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../../supabaseClient';
import type { VideoAnalysis } from '../../types';

const VIDEO_ANALYSIS_TABLE = 'video_analysis';

type VideoAnalysisRow = {
  id: string;
  title: string;
  match_or_session_date: string;
  opponent_or_topic: string;
  video_url: string;
  game_moment: VideoAnalysis['gameMoment'];
  tags: string[] | null;
  key_timestamps: VideoAnalysis['keyTimestamps'] | null;
  summary: string;
  created_at: string;
  updated_at: bigint | number;
};

export interface CloudVideoAnalysis extends VideoAnalysis {
  updatedAt: number;
}

function getClient() {
  if (!supabase) throw new Error('Supabase client is not configured');
  return supabase;
}

function fromRow(row: VideoAnalysisRow): CloudVideoAnalysis {
  return {
    id: row.id,
    title: row.title,
    matchOrSessionDate: row.match_or_session_date,
    opponentOrTopic: row.opponent_or_topic,
    videoUrl: row.video_url,
    gameMoment: row.game_moment,
    tags: Array.isArray(row.tags) ? row.tags : [],
    keyTimestamps: Array.isArray(row.key_timestamps) ? row.key_timestamps : [],
    summary: row.summary,
    createdAt: row.created_at,
    updatedAt: Number(row.updated_at)
  };
}

function toRow(session: VideoAnalysis, updatedAt: number): Record<string, unknown> {
  return {
    id: session.id,
    title: session.title,
    match_or_session_date: session.matchOrSessionDate,
    opponent_or_topic: session.opponentOrTopic,
    video_url: session.videoUrl,
    game_moment: session.gameMoment,
    tags: session.tags ?? [],
    key_timestamps: session.keyTimestamps ?? [],
    summary: session.summary,
    created_at: session.createdAt,
    updated_at: updatedAt
  };
}

async function listVideoAnalysis(): Promise<CloudVideoAnalysis[]> {
  const { data, error } = await getClient()
    .from(VIDEO_ANALYSIS_TABLE)
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return ((data || []) as VideoAnalysisRow[]).map(fromRow);
}

export function subscribeToVideoAnalysis(
  callback: (sessions: CloudVideoAnalysis[]) => void,
  onError?: (error: unknown) => void
): () => void {
  const client = getClient();
  let active = true;
  let channel: RealtimeChannel | null = null;

  const loadAndEmit = async () => {
    try {
      const sessions = await listVideoAnalysis();
      if (active) callback(sessions);
    } catch (error) {
      if (active && onError) onError(error);
    }
  };

  void loadAndEmit();

  channel = client
    .channel('u17-video-analysis-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: VIDEO_ANALYSIS_TABLE }, () => {
      void loadAndEmit();
    })
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR' && onError) {
        onError(new Error('Supabase realtime channel error for video analysis'));
      }
    });

  return () => {
    active = false;
    if (channel) void client.removeChannel(channel);
  };
}

export async function saveVideoAnalysisToCloud(session: VideoAnalysis): Promise<number> {
  const updatedAt = Date.now();
  const { error } = await getClient()
    .from(VIDEO_ANALYSIS_TABLE)
    .upsert(toRow(session, updatedAt), { onConflict: 'id' });

  if (error) throw error;
  return updatedAt;
}

export async function deleteVideoAnalysisFromCloud(sessionId: string): Promise<void> {
  const { error } = await getClient()
    .from(VIDEO_ANALYSIS_TABLE)
    .delete()
    .eq('id', sessionId);

  if (error) throw error;
}
