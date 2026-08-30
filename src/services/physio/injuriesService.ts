import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../../supabaseClient';
import type { Injury, InjuryFollowUp, PhysioMatchContext, PhysioPlayerContext, PhysioTrainingContext } from '../../types';
import { determineSquadStatusFromPlayerInjuries } from './squadInjurySync';
import { listSquadPlayers } from '../squad/squadService';
import { listMatches } from '../matches/matchService';

const INJURIES_TABLE = 'injuries';
const FOLLOW_UPS_TABLE = 'injury_follow_ups';

function client() {
  if (!supabase) throw new Error('Supabase client is not configured');
  return supabase;
}

export async function syncPlayerSquadStatusInDb(playerId: string): Promise<void> {
  if (!playerId) return;
  try {
    const trimmedId = playerId.trim();
    // Retrieve all injuries for this player (matching by id or name)
    const { data: allInjuries } = await client()
      .from(INJURIES_TABLE)
      .select('*');

    const mappedInjuries = (allInjuries || []).map(injuryFromRow);

    // Try finding squad player by exact id
    let { data: playerRow } = await client()
      .from('squad_players')
      .select('id, status, first_name, last_name')
      .eq('id', trimmedId)
      .maybeSingle();

    // If not found by id, try finding by name
    if (!playerRow) {
      const { data: playersList } = await client()
        .from('squad_players')
        .select('id, status, first_name, last_name');

      const found = (playersList || []).find((p) => {
        const full = `${p.first_name || ''} ${p.last_name || ''}`.trim().toLowerCase();
        const first = (p.first_name || '').trim().toLowerCase();
        const target = trimmedId.toLowerCase();
        return full === target || first === target || target.includes(first) || full.includes(target);
      });

      if (found) {
        playerRow = found;
      }
    }

    if (!playerRow) return;

    // Filter injuries for this specific player
    const playerSquadObj = {
      id: playerRow.id,
      firstName: playerRow.first_name,
      lastName: playerRow.last_name,
      position: 'CM' as const,
      status: playerRow.status
    };

    const targetInjuries = mappedInjuries.filter((inj) => {
      const target = (inj.playerId || '').trim().toLowerCase();
      const pId = playerRow.id.toLowerCase();
      const pFirst = (playerRow.first_name || '').trim().toLowerCase();
      const pFull = `${playerRow.first_name || ''} ${playerRow.last_name || ''}`.trim().toLowerCase();
      return target === pId || target === pFirst || target === pFull || pFull.includes(target) || target.includes(pFirst);
    });

    const calculatedStatus = determineSquadStatusFromPlayerInjuries(targetInjuries, playerSquadObj.status);

    if (playerRow.status !== calculatedStatus) {
      if (playerRow.status === 'Absent' && calculatedStatus === 'Active') {
        return;
      }
      await client()
        .from('squad_players')
        .update({ status: calculatedStatus, updated_at: Date.now() })
        .eq('id', playerRow.id);
    }
  } catch (err) {
    console.warn('[injuriesService] syncPlayerSquadStatusInDb warning:', err);
  }
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

const injuryToRow = (value: Partial<Injury>): Record<string, unknown> => {
  const context = value.context || 'unknown';
  const trainingSessionId = context === 'training' && value.trainingSessionId ? String(value.trainingSessionId).trim() : (value.trainingSessionId ? String(value.trainingSessionId).trim() : null);
  const matchId = context === 'match' && value.matchId ? String(value.matchId).trim() : (value.matchId ? String(value.matchId).trim() : null);

  return {
    ...(value.teamId !== undefined && { team_id: value.teamId }),
    ...(value.playerId !== undefined && { player_id: value.playerId }),
    ...(value.injuryDate !== undefined && { injury_date: value.injuryDate }),
    ...(value.context !== undefined && { context: value.context }),
    training_session_id: trainingSessionId,
    match_id: matchId,
    ...(value.location !== undefined && { location: value.location }),
    ...(value.affectedSide !== undefined && { affected_side: value.affectedSide }),
    ...(value.injuryType !== undefined && { injury_type: value.injuryType }),
    ...(value.clinicalDiagnosis !== undefined && { clinical_diagnosis: value.clinicalDiagnosis }),
    ...(value.medicalDiagnosis !== undefined && { medical_diagnosis: value.medicalDiagnosis }),
    ...(value.imagingDiagnosis !== undefined && { imaging_diagnosis: value.imagingDiagnosis }),
    ...(value.finalDiagnosis !== undefined && { final_diagnosis: value.finalDiagnosis }),
    ...(value.diagnosisStatus !== undefined && { diagnosis_status: value.diagnosisStatus }),
    ...(value.injuryGrade !== undefined && { injury_grade: value.injuryGrade }),
    ...(value.previousSimilarInjury !== undefined && { previous_similar_injury: Boolean(value.previousSimilarInjury) }),
    ...(value.occurrenceType !== undefined && { occurrence_type: value.occurrenceType }),
    ...(value.previousInjuryId !== undefined && { previous_injury_id: value.previousSimilarInjury && value.previousInjuryId ? String(value.previousInjuryId).trim() : null }),
    ...(value.previousInjuryDate !== undefined && { previous_injury_date: value.previousSimilarInjury && value.previousInjuryDate ? value.previousInjuryDate : null }),
    ...(value.sameLocation !== undefined && { same_location: value.sameLocation }),
    ...(value.sameDiagnosis !== undefined && { same_diagnosis: value.sameDiagnosis }),
    ...(value.playingSurface !== undefined && { playing_surface: value.playingSurface }),
    ...(value.contactType !== undefined && { contact_type: value.contactType }),
    ...(value.contactWith !== undefined && { contact_with: value.contactWith }),
    ...(value.activities !== undefined && { activities: value.activities }),
    ...(value.painScore !== undefined && { pain_score: value.painScore }),
    ...(value.onset !== undefined && { onset: value.onset }),
    ...(value.popSensation !== undefined && { pop_sensation: Boolean(value.popSensation) }),
    ...(value.swelling !== undefined && { swelling: Boolean(value.swelling) }),
    ...(value.instability !== undefined && { instability: Boolean(value.instability) }),
    ...(value.lossOfStrength !== undefined && { loss_of_strength: Boolean(value.lossOfStrength) }),
    ...(value.reducedRangeOfMotion !== undefined && { reduced_range_of_motion: Boolean(value.reducedRangeOfMotion) }),
    ...(value.otherSymptoms !== undefined && { other_symptoms: value.otherSymptoms }),
    ...(value.trainingDurationMinutes !== undefined && { training_duration_minutes: value.trainingDurationMinutes }),
    ...(value.trainingMinute !== undefined && { training_minute: value.trainingMinute }),
    ...(value.trainingPhase !== undefined && { training_phase: value.trainingPhase }),
    ...(value.playerContinued !== undefined && { player_continued: value.playerContinued }),
    ...(value.continuedWithLimitations !== undefined && { continued_with_limitations: value.continuedWithLimitations }),
    ...(value.leftTraining !== undefined && { left_training: value.leftTraining }),
    ...(value.playingTimeMinutes !== undefined && { playing_time_minutes: value.playingTimeMinutes }),
    ...(value.matchMinute !== undefined && { match_minute: value.matchMinute }),
    ...(value.matchPhase !== undefined && { match_phase: value.matchPhase }),
    ...(value.leftMatch !== undefined && { left_match: value.leftMatch }),
    ...(value.currentStatus !== undefined && { current_status: value.currentStatus }),
    ...(value.estimatedReturnDate !== undefined && { estimated_return_date: value.estimatedReturnDate }),
    ...(value.actualReturnDate !== undefined && { actual_return_date: value.actualReturnDate }),
    ...(value.closedAt !== undefined && { closed_at: value.closedAt })
  };
};

export async function listInjuries(teamId: string): Promise<Injury[]> {
  const { data, error } = await client().from(INJURIES_TABLE).select('*').eq('team_id', teamId).order('injury_date', { ascending: false });
  if (error) throw error;
  return (data || []).map(injuryFromRow);
}
export async function createInjury(input: Omit<Injury, 'id' | 'createdAt' | 'updatedAt'>): Promise<Injury> {
  const { data, error } = await client().from(INJURIES_TABLE).insert(injuryToRow(input)).select('*').single();
  if (error) throw error;
  const created = injuryFromRow(data);
  void syncPlayerSquadStatusInDb(created.playerId);
  return created;
}
export async function updateInjury(id: string, patch: Partial<Injury>): Promise<Injury> {
  const { data, error } = await client().from(INJURIES_TABLE).update(injuryToRow(patch)).eq('id', id).select('*').single();
  if (error) throw error;
  const updated = injuryFromRow(data);
  void syncPlayerSquadStatusInDb(updated.playerId);
  return updated;
}
export async function deleteInjury(id: string, teamId: string): Promise<void> {
  const { data: existing } = await client().from(INJURIES_TABLE).select('player_id').eq('id', id).maybeSingle();
  const playerId = existing?.player_id;

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
  if (playerId) {
    void syncPlayerSquadStatusInDb(playerId);
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
  if (error) throw error;
  if (input.status) {
    try {
      const { data: updatedInjury } = await client()
        .from(INJURIES_TABLE)
        .update({ current_status: input.status, updated_at: new Date().toISOString() })
        .eq('id', input.injuryId)
        .select('player_id')
        .single();
      if (updatedInjury?.player_id) {
        void syncPlayerSquadStatusInDb(updatedInjury.player_id);
      }
    } catch {}
  }
  return followUpFromRow(data);
}

export async function getPhysioContext(teamId: string): Promise<{ players: PhysioPlayerContext[]; sessions: PhysioTrainingContext[]; matches: PhysioMatchContext[] }> {
  const normalizedTeamId = (teamId || '').trim();

  // 1. Fetch Squad Players from squad_players table + RPC merge to ensure 100% of squad players appear
  const playerMap = new Map<string, PhysioPlayerContext>();

  try {
    const squadPlayers = await listSquadPlayers().catch(() => []);
    for (const p of squadPlayers) {
      const fullName = `${p.firstName || ''} ${p.lastName || ''}`.trim() || p.id;
      playerMap.set(p.id, {
        playerId: p.id,
        playerName: fullName,
        shirtNumber: p.number != null ? String(p.number) : null,
        position: p.position || 'CM',
        currentStatus: p.status || 'Active'
      });
    }
  } catch {
    // If listSquadPlayers fails, fallback to direct query
    try {
      const { data: directSquad } = await client().from('squad_players').select('*');
      if (directSquad) {
        for (const p of directSquad) {
          const fullName = `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.id;
          playerMap.set(p.id, {
            playerId: p.id,
            playerName: fullName,
            shirtNumber: p.number != null ? String(p.number) : null,
            position: p.position || 'CM',
            currentStatus: p.status || 'Active'
          });
        }
      }
    } catch {}
  }

  // Also query physio_player_context RPC if available to catch any team-specific clinical player mappings
  try {
    const rpcPlayers = await client().rpc('physio_player_context', { target_team_id: normalizedTeamId });
    if (!rpcPlayers.error && rpcPlayers.data) {
      for (const row of rpcPlayers.data) {
        if (!playerMap.has(row.player_id)) {
          playerMap.set(row.player_id, {
            playerId: row.player_id,
            playerName: row.player_name,
            shirtNumber: row.shirt_number != null ? String(row.shirt_number) : null,
            position: row.position,
            currentStatus: row.current_status
          });
        }
      }
    }
  } catch {}

  const players = Array.from(playerMap.values()).sort((a, b) => a.playerName.localeCompare(b.playerName));

  // 2. Fetch Sessions
  let sessionRows: PhysioTrainingContext[] = [];
  try {
    const rpcSessions = await client().rpc('physio_training_context', { target_team_id: normalizedTeamId });
    if (!rpcSessions.error && rpcSessions.data && rpcSessions.data.length > 0) {
      sessionRows = rpcSessions.data.map((row: any) => ({
        sessionId: row.session_id,
        sessionDate: row.session_date,
        sessionTime: row.session_time,
        sessionNumber: String(row.session_number || '1'),
        durationMinutes: row.duration_minutes
      }));
    }
  } catch {}

  if (!sessionRows.length) {
    try {
      let sq = client().from('sessions').select('*').order('date', { ascending: false });
      if (normalizedTeamId) {
        sq = sq.eq('team_id', normalizedTeamId);
      }
      const { data: rawSessions } = await sq;
      if (rawSessions && rawSessions.length > 0) {
        sessionRows = rawSessions.map((s: any) => ({
          sessionId: s.id,
          sessionDate: s.date,
          sessionTime: s.time || '',
          sessionNumber: String(s.session_number || '1'),
          durationMinutes: s.duration || 90
        }));
      }
    } catch {}
  }

  // 3. Fetch Matches
  let matchRows: PhysioMatchContext[] = [];
  try {
    const rpcMatches = await client().rpc('physio_match_context', { target_team_id: normalizedTeamId });
    if (!rpcMatches.error && rpcMatches.data && rpcMatches.data.length > 0) {
      matchRows = rpcMatches.data.map((row: any) => ({
        matchId: row.match_id || row.id,
        matchDate: row.match_date || row.date,
        opponentName: row.opponent_name || 'Match',
        matchStatus: row.match_status || row.status
      }));
    }
  } catch {}

  if (!matchRows.length) {
    try {
      const matchesList = await listMatches(normalizedTeamId || undefined);
      if (matchesList && matchesList.length > 0) {
        matchRows = matchesList.map((m) => ({
          matchId: m.id,
          matchDate: m.date,
          opponentName: m.opponentName || m.opponentTeamId || m.competitionName || 'Match',
          matchStatus: m.status
        }));
      }
    } catch {}
  }

  if (!matchRows.length) {
    try {
      const { data: rawMatches } = await client().from('matches').select('*').order('date', { ascending: false });
      if (rawMatches && rawMatches.length > 0) {
        matchRows = rawMatches.map((m: any) => ({
          matchId: m.id,
          matchDate: m.date,
          opponentName: m.opponent_team_id || m.competition_name || 'Match',
          matchStatus: m.status
        }));
      }
    } catch {}
  }

  return {
    players,
    sessions: sessionRows,
    matches: matchRows
  };
}
