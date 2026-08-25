import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../../supabaseClient';
import type { Injury, InjuryFollowUp, PhysioMatchContext, PhysioPlayerContext, PhysioTrainingContext } from '../../types';

const INJURIES_TABLE = 'injuries';
const FOLLOW_UPS_TABLE = 'injury_follow_ups';

function client() {
  if (!supabase) throw new Error('Supabase client is not configured');
  return supabase;
}

const injuryFromRow = (row: any): Injury => ({
  id: row.id, teamId: row.team_id, playerId: row.player_id, injuryDate: row.injury_date,
  context: row.context, trainingSessionId: row.training_session_id, matchId: row.match_id,
  location: row.location || '', affectedSide: row.affected_side, injuryType: row.injury_type,
  clinicalDiagnosis: row.clinical_diagnosis, medicalDiagnosis: row.medical_diagnosis, imagingDiagnosis: row.imaging_diagnosis,
  finalDiagnosis: row.final_diagnosis, diagnosisStatus: row.diagnosis_status, injuryGrade: row.injury_grade,
  previousSimilarInjury: Boolean(row.previous_similar_injury), occurrenceType: row.occurrence_type,
  previousInjuryId: row.previous_injury_id, previousInjuryDate: row.previous_injury_date,
  sameLocation: row.same_location, sameDiagnosis: row.same_diagnosis, playingSurface: row.playing_surface,
  contactType: row.contact_type, contactWith: row.contact_with, activities: row.activities || [], painScore: row.pain_score,
  onset: row.onset, popSensation: Boolean(row.pop_sensation), swelling: Boolean(row.swelling), instability: Boolean(row.instability),
  lossOfStrength: Boolean(row.loss_of_strength), reducedRangeOfMotion: Boolean(row.reduced_range_of_motion), otherSymptoms: row.other_symptoms,
  trainingDurationMinutes: row.training_duration_minutes, trainingMinute: row.training_minute, trainingPhase: row.training_phase,
  playerContinued: row.player_continued, continuedWithLimitations: row.continued_with_limitations, leftTraining: row.left_training,
  playingTimeMinutes: row.playing_time_minutes, matchMinute: row.match_minute, matchPhase: row.match_phase, leftMatch: row.left_match,
  currentStatus: row.current_status, estimatedReturnDate: row.estimated_return_date, actualReturnDate: row.actual_return_date,
  closedAt: row.closed_at, createdAt: row.created_at, updatedAt: row.updated_at
});

const injuryToRow = (value: Partial<Injury>): Record<string, unknown> => ({
  ...(value.teamId !== undefined && { team_id: value.teamId }), ...(value.playerId !== undefined && { player_id: value.playerId }),
  ...(value.injuryDate !== undefined && { injury_date: value.injuryDate }), ...(value.context !== undefined && { context: value.context }),
  ...(value.trainingSessionId !== undefined && { training_session_id: value.trainingSessionId }), ...(value.matchId !== undefined && { match_id: value.matchId }),
  ...(value.location !== undefined && { location: value.location }), ...(value.affectedSide !== undefined && { affected_side: value.affectedSide }),
  ...(value.injuryType !== undefined && { injury_type: value.injuryType }), ...(value.clinicalDiagnosis !== undefined && { clinical_diagnosis: value.clinicalDiagnosis }),
  ...(value.medicalDiagnosis !== undefined && { medical_diagnosis: value.medicalDiagnosis }), ...(value.imagingDiagnosis !== undefined && { imaging_diagnosis: value.imagingDiagnosis }),
  ...(value.finalDiagnosis !== undefined && { final_diagnosis: value.finalDiagnosis }), ...(value.diagnosisStatus !== undefined && { diagnosis_status: value.diagnosisStatus }),
  ...(value.injuryGrade !== undefined && { injury_grade: value.injuryGrade }), ...(value.previousSimilarInjury !== undefined && { previous_similar_injury: value.previousSimilarInjury }),
  ...(value.occurrenceType !== undefined && { occurrence_type: value.occurrenceType }), ...(value.previousInjuryId !== undefined && { previous_injury_id: value.previousInjuryId }),
  ...(value.previousInjuryDate !== undefined && { previous_injury_date: value.previousInjuryDate }), ...(value.sameLocation !== undefined && { same_location: value.sameLocation }),
  ...(value.sameDiagnosis !== undefined && { same_diagnosis: value.sameDiagnosis }), ...(value.playingSurface !== undefined && { playing_surface: value.playingSurface }),
  ...(value.contactType !== undefined && { contact_type: value.contactType }), ...(value.contactWith !== undefined && { contact_with: value.contactWith }),
  ...(value.activities !== undefined && { activities: value.activities }), ...(value.painScore !== undefined && { pain_score: value.painScore }), ...(value.onset !== undefined && { onset: value.onset }),
  ...(value.popSensation !== undefined && { pop_sensation: value.popSensation }), ...(value.swelling !== undefined && { swelling: value.swelling }),
  ...(value.instability !== undefined && { instability: value.instability }), ...(value.lossOfStrength !== undefined && { loss_of_strength: value.lossOfStrength }),
  ...(value.reducedRangeOfMotion !== undefined && { reduced_range_of_motion: value.reducedRangeOfMotion }), ...(value.otherSymptoms !== undefined && { other_symptoms: value.otherSymptoms }),
  ...(value.trainingDurationMinutes !== undefined && { training_duration_minutes: value.trainingDurationMinutes }), ...(value.trainingMinute !== undefined && { training_minute: value.trainingMinute }),
  ...(value.trainingPhase !== undefined && { training_phase: value.trainingPhase }), ...(value.playerContinued !== undefined && { player_continued: value.playerContinued }),
  ...(value.continuedWithLimitations !== undefined && { continued_with_limitations: value.continuedWithLimitations }), ...(value.leftTraining !== undefined && { left_training: value.leftTraining }),
  ...(value.playingTimeMinutes !== undefined && { playing_time_minutes: value.playingTimeMinutes }), ...(value.matchMinute !== undefined && { match_minute: value.matchMinute }),
  ...(value.matchPhase !== undefined && { match_phase: value.matchPhase }), ...(value.leftMatch !== undefined && { left_match: value.leftMatch }),
  ...(value.currentStatus !== undefined && { current_status: value.currentStatus }), ...(value.estimatedReturnDate !== undefined && { estimated_return_date: value.estimatedReturnDate }),
  ...(value.actualReturnDate !== undefined && { actual_return_date: value.actualReturnDate }), ...(value.closedAt !== undefined && { closed_at: value.closedAt })
});

export async function listInjuries(teamId: string): Promise<Injury[]> {
  const { data, error } = await client().from(INJURIES_TABLE).select('*').eq('team_id', teamId).order('injury_date', { ascending: false });
  if (error) throw error;
  return (data || []).map(injuryFromRow);
}
export async function createInjury(input: Omit<Injury, 'id' | 'createdAt' | 'updatedAt'>): Promise<Injury> {
  const { data, error } = await client().from(INJURIES_TABLE).insert(injuryToRow(input)).select('*').single();
  if (error) throw error;
  return injuryFromRow(data);
}
export async function updateInjury(id: string, patch: Partial<Injury>): Promise<Injury> {
  const { data, error } = await client().from(INJURIES_TABLE).update(injuryToRow(patch)).eq('id', id).select('*').single();
  if (error) throw error;
  return injuryFromRow(data);
}
export async function deleteInjury(id: string, teamId: string): Promise<void> {
  const { data, error } = await client()
    .from(INJURIES_TABLE)
    .delete()
    .eq('id', id)
    .eq('team_id', teamId)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw { code: '42501', message: 'The injury was not deleted. It may not exist or you may not have clinical delete permission for its team.' };
  }
}
export function subscribeToInjuries(teamId: string, callback: (items: Injury[]) => void, onError?: (error: unknown) => void): () => void {
  let active = true; let channel: RealtimeChannel | null = null;
  const load = () => void listInjuries(teamId).then(items => { if (active) callback(items); }).catch(error => active && onError?.(error));
  load();
  channel = client().channel(`physio-injuries-${teamId}`).on('postgres_changes', { event: '*', schema: 'public', table: INJURIES_TABLE, filter: `team_id=eq.${teamId}` }, load).subscribe();
  return () => { active = false; if (channel) void client().removeChannel(channel); };
}

const followUpFromRow = (row: any): InjuryFollowUp => ({ id: row.id, injuryId: row.injury_id, followUpDate: row.follow_up_date, treatmentPhase: row.treatment_phase, treatmentPerformed: row.treatment_performed, responseToTreatment: row.response_to_treatment, injuryProgression: row.injury_progression, status: row.status, nextReviewDate: row.next_review_date, createdAt: row.created_at, updatedAt: row.updated_at });
export async function listInjuryFollowUps(injuryId: string): Promise<InjuryFollowUp[]> {
  const { data, error } = await client().from(FOLLOW_UPS_TABLE).select('*').eq('injury_id', injuryId).order('follow_up_date', { ascending: false });
  if (error) throw error; return (data || []).map(followUpFromRow);
}
export async function addInjuryFollowUp(input: Omit<InjuryFollowUp, 'id' | 'createdAt' | 'updatedAt'>): Promise<InjuryFollowUp> {
  const { data, error } = await client().from(FOLLOW_UPS_TABLE).insert({ injury_id: input.injuryId, follow_up_date: input.followUpDate, treatment_phase: input.treatmentPhase, treatment_performed: input.treatmentPerformed, response_to_treatment: input.responseToTreatment ?? null, injury_progression: input.injuryProgression ?? null, status: input.status, next_review_date: input.nextReviewDate ?? null }).select('*').single();
  if (error) throw error; return followUpFromRow(data);
}

export async function getPhysioContext(teamId: string): Promise<{ players: PhysioPlayerContext[]; sessions: PhysioTrainingContext[]; matches: PhysioMatchContext[] }> {
  const normalizedTeamId = (teamId || '').trim();
  const [players, sessions, matches] = await Promise.all([
    client().rpc('physio_player_context', { target_team_id: normalizedTeamId }),
    client().rpc('physio_training_context', { target_team_id: normalizedTeamId }),
    client().rpc('physio_match_context', { target_team_id: normalizedTeamId })
  ]);
  if (players.error) throw players.error;
  if (sessions.error) throw sessions.error;

  let matchRows: any[] = matches.data || [];
  if ((matches.error || !matchRows.length) && normalizedTeamId) {
    try {
      const { data: directMatches } = await client()
        .from('matches')
        .select('id, date, status, opponent_team:auth_teams!matches_opponent_team_id_fkey(name)')
        .eq('team_id', normalizedTeamId)
        .order('date', { ascending: false });

      if (directMatches && directMatches.length > 0) {
        matchRows = directMatches.map((row: any) => ({
          match_id: row.id,
          match_date: row.date,
          opponent_name: row.opponent_team?.name || 'Match',
          match_status: row.status
        }));
      }
    } catch {
      // Ignore fallback failure
    }
  }

  return {
    players: (players.data || []).map((row: any) => ({ playerId: row.player_id, playerName: row.player_name, shirtNumber: row.shirt_number, position: row.position, currentStatus: row.current_status })),
    sessions: (sessions.data || []).map((row: any) => ({ sessionId: row.session_id, sessionDate: row.session_date, sessionTime: row.session_time, sessionNumber: row.session_number, durationMinutes: row.duration_minutes })),
    matches: matchRows.map((row: any) => ({ matchId: row.match_id || row.id, matchDate: row.match_date || row.date, opponentName: row.opponent_name || 'Match', matchStatus: row.match_status || row.status }))
  };
}
