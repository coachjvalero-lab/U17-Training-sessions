import { supabase } from '../../supabaseClient';
import type { SetPieceDiagram, SetPiecePlay, SetPiecePlayType } from '../../types';
import { EMPTY_SET_PIECE_DIAGRAM } from '../../types';

const SET_PIECE_PLAYS_TABLE = 'set_piece_plays';

type SetPiecePlayRow = {
  id: string;
  match_id: string;
  title: string;
  type: SetPiecePlayType;
  diagram: SetPieceDiagram | null;
  description: string | null;
  coaching_points: string | null;
  image_url: string | null;
  video_url: string | null;
  created_at: string | null;
  updated_at: string | null;
};

function getClient() {
  if (!supabase) throw new Error('Supabase client is not configured');
  return supabase;
}

function fromRow(row: SetPiecePlayRow): SetPiecePlay {
  return {
    id: row.id,
    matchId: row.match_id,
    title: row.title ?? '',
    type: row.type ?? 'other',
    diagram: row.diagram ?? EMPTY_SET_PIECE_DIAGRAM,
    description: row.description ?? '',
    coachingPoints: row.coaching_points ?? '',
    imageUrl: row.image_url ?? null,
    videoUrl: row.video_url ?? null,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined
  };
}

export async function getSetPiecePlays(matchId: string): Promise<SetPiecePlay[]> {
  const { data, error } = await getClient()
    .from(SET_PIECE_PLAYS_TABLE)
    .select('*')
    .eq('match_id', matchId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return ((data || []) as SetPiecePlayRow[]).map(fromRow);
}

export async function createSetPiecePlay(input: Pick<SetPiecePlay, 'matchId' | 'title' | 'type'> & Partial<Pick<SetPiecePlay, 'diagram' | 'description' | 'coachingPoints' | 'imageUrl' | 'videoUrl'>>): Promise<SetPiecePlay> {
  const { data, error } = await getClient()
    .from(SET_PIECE_PLAYS_TABLE)
    .insert({
      match_id: input.matchId,
      title: input.title,
      type: input.type,
      diagram: input.diagram ?? EMPTY_SET_PIECE_DIAGRAM,
      description: input.description ?? '',
      coaching_points: input.coachingPoints ?? '',
      image_url: input.imageUrl ?? null,
      video_url: input.videoUrl ?? null
    })
    .select('*')
    .single();

  if (error) throw error;
  return fromRow(data as SetPiecePlayRow);
}

export async function updateSetPiecePlay(id: string, patch: Partial<Pick<SetPiecePlay, 'title' | 'type' | 'diagram' | 'description' | 'coachingPoints' | 'imageUrl' | 'videoUrl'>>): Promise<SetPiecePlay> {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined) payload.title = patch.title;
  if (patch.type !== undefined) payload.type = patch.type;
  if (patch.diagram !== undefined) payload.diagram = patch.diagram;
  if (patch.description !== undefined) payload.description = patch.description;
  if (patch.coachingPoints !== undefined) payload.coaching_points = patch.coachingPoints;
  if (patch.imageUrl !== undefined) payload.image_url = patch.imageUrl;
  if (patch.videoUrl !== undefined) payload.video_url = patch.videoUrl;

  const { data, error } = await getClient()
    .from(SET_PIECE_PLAYS_TABLE)
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return fromRow(data as SetPiecePlayRow);
}

export async function deleteSetPiecePlay(id: string): Promise<void> {
  const { error } = await getClient()
    .from(SET_PIECE_PLAYS_TABLE)
    .delete()
    .eq('id', id);

  if (error) throw error;
}
