import { supabase } from '../../supabaseClient';
import type { MatchSetPieces } from '../../types';

const MATCH_SET_PIECES_TABLE = 'match_set_pieces';

type MatchSetPiecesRow = {
  id: string;
  match_id: string;
  attacking_notes: string | null;
  attacking_video_url: string | null;
  attacking_image_1_url: string | null;
  attacking_image_2_url: string | null;
  defensive_notes: string | null;
  defensive_video_url: string | null;
  defensive_image_1_url: string | null;
  defensive_image_2_url: string | null;
  created_at: string | null;
  updated_at: string | null;
};

function getClient() {
  if (!supabase) throw new Error('Supabase client is not configured');
  return supabase;
}

function fromRow(row: MatchSetPiecesRow): MatchSetPieces {
  return {
    id: row.id,
    matchId: row.match_id,
    attackingNotes: row.attacking_notes ?? '',
    attackingVideoUrl: row.attacking_video_url ?? null,
    attackingImage1Url: row.attacking_image_1_url ?? null,
    attackingImage2Url: row.attacking_image_2_url ?? null,
    defensiveNotes: row.defensive_notes ?? '',
    defensiveVideoUrl: row.defensive_video_url ?? null,
    defensiveImage1Url: row.defensive_image_1_url ?? null,
    defensiveImage2Url: row.defensive_image_2_url ?? null,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined
  };
}

export async function getMatchSetPieces(matchId: string): Promise<MatchSetPieces | null> {
  const { data, error } = await getClient()
    .from(MATCH_SET_PIECES_TABLE)
    .select('*')
    .eq('match_id', matchId)
    .maybeSingle();

  if (error) throw error;
  return data ? fromRow(data as MatchSetPiecesRow) : null;
}

export async function upsertMatchSetPieces(input: Partial<MatchSetPieces> & Pick<MatchSetPieces, 'matchId'>): Promise<MatchSetPieces> {
  const payload = {
    id: input.id,
    match_id: input.matchId,
    attacking_notes: input.attackingNotes ?? '',
    attacking_video_url: input.attackingVideoUrl ?? null,
    attacking_image_1_url: input.attackingImage1Url ?? null,
    attacking_image_2_url: input.attackingImage2Url ?? null,
    defensive_notes: input.defensiveNotes ?? '',
    defensive_video_url: input.defensiveVideoUrl ?? null,
    defensive_image_1_url: input.defensiveImage1Url ?? null,
    defensive_image_2_url: input.defensiveImage2Url ?? null,
    updated_at: new Date().toISOString()
  };

  const { data, error } = await getClient()
    .from(MATCH_SET_PIECES_TABLE)
    .upsert(payload, { onConflict: 'match_id' })
    .select('*')
    .single();

  if (error) throw error;
  return fromRow(data as MatchSetPiecesRow);
}

export async function deleteMatchSetPieces(matchId: string): Promise<void> {
  const { error } = await getClient()
    .from(MATCH_SET_PIECES_TABLE)
    .delete()
    .eq('match_id', matchId);

  if (error) throw error;
}
