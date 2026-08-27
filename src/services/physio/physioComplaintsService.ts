import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../../supabaseClient';
import type { PhysioComplaint } from '../../types';

function client() { if (!supabase) throw new Error('Supabase client is not configured'); return supabase; }
const fromRow = (row: any): PhysioComplaint => ({ id: row.id, teamId: row.team_id, playerId: row.player_id, occurrenceDate: row.occurrence_date, context: row.context, trainingSessionId: row.training_session_id, matchId: row.match_id, complaintType: row.complaint_type, location: row.location || '', affectedSide: row.affected_side, leftActivity: Boolean(row.left_activity), durationBand: row.duration_band, outcome: row.outcome, resultingInjuryId: row.resulting_injury_id, notes: row.notes || '', createdAt: row.created_at, updatedAt: row.updated_at });
const toRow = (item: Partial<PhysioComplaint>) => {
  const context = item.context || 'unknown';
  const trainingSessionId = context === 'training' && item.trainingSessionId ? String(item.trainingSessionId).trim() : null;
  const matchId = context === 'match' && item.matchId ? String(item.matchId).trim() : null;
  const resultingInjuryId = item.outcome === 'became_injury' && item.resultingInjuryId ? String(item.resultingInjuryId).trim() : null;

  return {
    ...(item.teamId !== undefined && { team_id: String(item.teamId).trim() }),
    ...(item.playerId !== undefined && { player_id: String(item.playerId).trim() }),
    ...(item.occurrenceDate !== undefined && { occurrence_date: item.occurrenceDate }),
    context,
    training_session_id: trainingSessionId,
    match_id: matchId,
    ...(item.complaintType !== undefined && { complaint_type: item.complaintType }),
    ...(item.location !== undefined && { location: String(item.location || '').trim() }),
    ...(item.affectedSide !== undefined && { affected_side: item.affectedSide || 'unknown' }),
    ...(item.leftActivity !== undefined && { left_activity: Boolean(item.leftActivity) }),
    ...(item.durationBand !== undefined && { duration_band: item.durationBand || 'less_than_24h' }),
    ...(item.outcome !== undefined && { outcome: item.outcome || 'ongoing' }),
    resulting_injury_id: resultingInjuryId,
    ...(item.notes !== undefined && { notes: String(item.notes || '').trim() })
  };
};

export async function listPhysioComplaints(teamId: string): Promise<PhysioComplaint[]> {
  const { data, error } = await client().from('physio_complaints').select('*').eq('team_id', teamId).order('occurrence_date', { ascending: false });
  if (error) throw error;
  return (data || []).map(fromRow);
}

export async function getPhysioComplaintById(id: string): Promise<PhysioComplaint | null> {
  const { data, error } = await client().from('physio_complaints').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? fromRow(data) : null;
}

export async function createPhysioComplaint(item: Omit<PhysioComplaint, 'id' | 'createdAt' | 'updatedAt'>): Promise<PhysioComplaint> {
  const { data, error } = await client().from('physio_complaints').insert(toRow(item)).select('*').single();
  if (error) throw error;
  return fromRow(data);
}

export async function updatePhysioComplaint(id: string, patch: Partial<PhysioComplaint>): Promise<PhysioComplaint> {
  const { data, error } = await client().from('physio_complaints').update(toRow(patch)).eq('id', id).select('*').single();
  if (error) throw error;
  return fromRow(data);
}

export async function deletePhysioComplaint(id: string, teamId: string): Promise<void> {
  const { data, error } = await client()
    .from('physio_complaints')
    .delete()
    .eq('id', id)
    .eq('team_id', teamId)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw { code: '42501', message: 'The complaint was not deleted. It may not exist or you may not have clinical delete permission for its team.' };
  }
}

export function subscribeToPhysioComplaints(teamId: string, callback: (items: PhysioComplaint[]) => void, onError?: (error: unknown) => void): () => void {
  let active = true;
  let channel: RealtimeChannel | null = null;
  const load = () => void listPhysioComplaints(teamId).then(items => { if (active) callback(items); }).catch(error => active && onError?.(error));
  load();
  channel = client().channel(`physio-complaints-${teamId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'physio_complaints', filter: `team_id=eq.${teamId}` }, load).subscribe();
  return () => { active = false; if (channel) void client().removeChannel(channel); };
}
