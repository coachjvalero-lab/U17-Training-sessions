import { supabase } from '../../supabaseClient';
import { ensureOpponentTeam } from '../matches/matchService';
import type {
  AssignableUser,
  ClubTeamOption,
  ScoutingPlayer,
  ScoutingPlayerReport,
  ScoutingPlayerStatus,
  ScoutingTrip,
  ScoutingTripTarget
} from '../../types';

const SCOUTING_PLAYERS_TABLE = 'scouting_players';
const SCOUTING_TRIPS_TABLE = 'scouting_trips';
const SCOUTING_TRIP_TARGETS_TABLE = 'scouting_trip_targets';
const SCOUTING_PLAYER_REPORTS_TABLE = 'scouting_player_reports';

type ScoutingPlayerRow = {
  id: string;
  first_name: string;
  last_name: string;
  club_team_id: string | null;
  position: string | null;
  birth_date: string | null;
  nationality: string | null;
  status: ScoutingPlayerStatus;
  created_at: string | null;
  updated_at: string | null;
  club?: { name: string } | null;
};

type ScoutingTripRow = {
  id: string;
  match_date: string;
  home_team_id: string | null;
  away_team_id: string | null;
  competition: string | null;
  assigned_to: string | null;
  status: ScoutingTrip['status'];
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
  home_team?: { name: string } | null;
  away_team?: { name: string } | null;
  assigned_user?: { email: string } | null;
};

type ScoutingTripTargetRow = {
  id: string;
  trip_id: string;
  player_id: string;
  created_at: string | null;
};

type ScoutingPlayerReportRow = {
  id: string;
  player_id: string;
  trip_id: string | null;
  technical_rating: number | null;
  tactical_rating: number | null;
  physical_rating: number | null;
  mental_rating: number | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
};

function getClient() {
  if (!supabase) throw new Error('Supabase client is not configured');
  return supabase;
}

function playerFromRow(row: ScoutingPlayerRow): ScoutingPlayer {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    clubTeamId: row.club_team_id,
    clubName: row.club?.name ?? null,
    position: row.position,
    birthDate: row.birth_date,
    nationality: row.nationality,
    status: row.status,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined
  };
}

function tripFromRow(row: ScoutingTripRow): ScoutingTrip {
  return {
    id: row.id,
    matchDate: row.match_date,
    homeTeamId: row.home_team_id,
    homeTeamName: row.home_team?.name ?? null,
    awayTeamId: row.away_team_id,
    awayTeamName: row.away_team?.name ?? null,
    competition: row.competition ?? '',
    assignedTo: row.assigned_to,
    assignedToEmail: row.assigned_user?.email ?? null,
    status: row.status,
    notes: row.notes ?? '',
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined
  };
}

function tripTargetFromRow(row: ScoutingTripTargetRow): ScoutingTripTarget {
  return {
    id: row.id,
    tripId: row.trip_id,
    playerId: row.player_id,
    createdAt: row.created_at ?? undefined
  };
}

function reportFromRow(row: ScoutingPlayerReportRow): ScoutingPlayerReport {
  return {
    id: row.id,
    playerId: row.player_id,
    tripId: row.trip_id,
    technicalRating: row.technical_rating,
    tacticalRating: row.tactical_rating,
    physicalRating: row.physical_rating,
    mentalRating: row.mental_rating,
    notes: row.notes ?? '',
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined
  };
}

// Video Analysis owns scouting data directly; club/user lookups below only READ auth_teams /
// user_profiles (both already used elsewhere in the repo), never write to them except via the
// existing ensureClubTeam helper (re-exported from matchService's auth_teams upsert logic).
export const ensureClubTeam = ensureOpponentTeam;

export async function listClubTeams(): Promise<ClubTeamOption[]> {
  const { data, error } = await getClient()
    .from('auth_teams')
    .select('id, name')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) throw error;
  return (data || []) as ClubTeamOption[];
}

export async function listAssignableUsers(): Promise<AssignableUser[]> {
  const { data, error } = await getClient()
    .from('user_profiles')
    .select('user_id, email, display_name')
    .eq('is_active', true)
    .order('email', { ascending: true });

  if (error) throw error;
  return ((data || []) as Array<{ user_id: string; email: string; display_name: string | null }>).map((row) => ({
    userId: row.user_id,
    email: row.email,
    displayName: row.display_name
  }));
}

export async function listScoutingPlayers(): Promise<ScoutingPlayer[]> {
  const { data, error } = await getClient()
    .from(SCOUTING_PLAYERS_TABLE)
    .select('*, club:auth_teams(name)')
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return ((data || []) as ScoutingPlayerRow[]).map(playerFromRow);
}

export async function createOrUpdateScoutingPlayer(
  input: Partial<ScoutingPlayer> & Pick<ScoutingPlayer, 'firstName' | 'lastName' | 'status'>
): Promise<ScoutingPlayer> {
  const payload = {
    id: input.id,
    first_name: input.firstName,
    last_name: input.lastName,
    club_team_id: input.clubTeamId ?? null,
    position: input.position ?? null,
    birth_date: input.birthDate ?? null,
    nationality: input.nationality ?? null,
    status: input.status,
    updated_at: new Date().toISOString()
  };

  const { data, error } = await getClient()
    .from(SCOUTING_PLAYERS_TABLE)
    .upsert(payload, { onConflict: 'id' })
    .select('*, club:auth_teams(name)')
    .single();

  if (error) throw error;
  return playerFromRow(data as ScoutingPlayerRow);
}

export async function deleteScoutingPlayer(playerId: string): Promise<void> {
  const { error } = await getClient()
    .from(SCOUTING_PLAYERS_TABLE)
    .delete()
    .eq('id', playerId);

  if (error) throw error;
}

export async function listScoutingTrips(): Promise<ScoutingTrip[]> {
  const { data, error } = await getClient()
    .from(SCOUTING_TRIPS_TABLE)
    .select(`
      *,
      home_team:auth_teams!scouting_trips_home_team_id_fkey(name),
      away_team:auth_teams!scouting_trips_away_team_id_fkey(name),
      assigned_user:user_profiles!scouting_trips_assigned_to_fkey(email)
    `)
    .order('match_date', { ascending: false });

  if (error) throw error;
  return ((data || []) as ScoutingTripRow[]).map(tripFromRow);
}

export async function createOrUpdateScoutingTrip(
  input: Partial<ScoutingTrip> & Pick<ScoutingTrip, 'matchDate' | 'competition' | 'status'>
): Promise<ScoutingTrip> {
  const payload = {
    id: input.id,
    match_date: input.matchDate,
    home_team_id: input.homeTeamId ?? null,
    away_team_id: input.awayTeamId ?? null,
    competition: input.competition,
    assigned_to: input.assignedTo ?? null,
    status: input.status,
    notes: input.notes ?? '',
    updated_at: new Date().toISOString()
  };

  const { data, error } = await getClient()
    .from(SCOUTING_TRIPS_TABLE)
    .upsert(payload, { onConflict: 'id' })
    .select(`
      *,
      home_team:auth_teams!scouting_trips_home_team_id_fkey(name),
      away_team:auth_teams!scouting_trips_away_team_id_fkey(name),
      assigned_user:user_profiles!scouting_trips_assigned_to_fkey(email)
    `)
    .single();

  if (error) throw error;
  return tripFromRow(data as ScoutingTripRow);
}

export async function deleteScoutingTrip(tripId: string): Promise<void> {
  const { error } = await getClient()
    .from(SCOUTING_TRIPS_TABLE)
    .delete()
    .eq('id', tripId);

  if (error) throw error;
}

export async function listTripTargets(tripId: string): Promise<ScoutingTripTarget[]> {
  const { data, error } = await getClient()
    .from(SCOUTING_TRIP_TARGETS_TABLE)
    .select('*')
    .eq('trip_id', tripId);

  if (error) throw error;
  return ((data || []) as ScoutingTripTargetRow[]).map(tripTargetFromRow);
}

export async function listTripTargetsForPlayer(playerId: string): Promise<ScoutingTripTarget[]> {
  const { data, error } = await getClient()
    .from(SCOUTING_TRIP_TARGETS_TABLE)
    .select('*')
    .eq('player_id', playerId);

  if (error) throw error;
  return ((data || []) as ScoutingTripTargetRow[]).map(tripTargetFromRow);
}

export async function addTripTarget(tripId: string, playerId: string): Promise<ScoutingTripTarget> {
  const { data, error } = await getClient()
    .from(SCOUTING_TRIP_TARGETS_TABLE)
    .insert({ trip_id: tripId, player_id: playerId })
    .select('*')
    .single();

  if (error) throw error;
  return tripTargetFromRow(data as ScoutingTripTargetRow);
}

export async function removeTripTarget(targetId: string): Promise<void> {
  const { error } = await getClient()
    .from(SCOUTING_TRIP_TARGETS_TABLE)
    .delete()
    .eq('id', targetId);

  if (error) throw error;
}

export async function listPlayerReports(playerId: string): Promise<ScoutingPlayerReport[]> {
  const { data, error } = await getClient()
    .from(SCOUTING_PLAYER_REPORTS_TABLE)
    .select('*')
    .eq('player_id', playerId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return ((data || []) as ScoutingPlayerReportRow[]).map(reportFromRow);
}

export async function listReportsForTrip(tripId: string): Promise<ScoutingPlayerReport[]> {
  const { data, error } = await getClient()
    .from(SCOUTING_PLAYER_REPORTS_TABLE)
    .select('*')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return ((data || []) as ScoutingPlayerReportRow[]).map(reportFromRow);
}

export async function createOrUpdatePlayerReport(
  input: Partial<ScoutingPlayerReport> & Pick<ScoutingPlayerReport, 'playerId' | 'notes'>
): Promise<ScoutingPlayerReport> {
  const payload = {
    id: input.id,
    player_id: input.playerId,
    trip_id: input.tripId ?? null,
    technical_rating: input.technicalRating ?? null,
    tactical_rating: input.tacticalRating ?? null,
    physical_rating: input.physicalRating ?? null,
    mental_rating: input.mentalRating ?? null,
    notes: input.notes,
    updated_at: new Date().toISOString()
  };

  const { data, error } = await getClient()
    .from(SCOUTING_PLAYER_REPORTS_TABLE)
    .upsert(payload, { onConflict: 'id' })
    .select('*')
    .single();

  if (error) throw error;
  return reportFromRow(data as ScoutingPlayerReportRow);
}

export async function deletePlayerReport(reportId: string): Promise<void> {
  const { error } = await getClient()
    .from(SCOUTING_PLAYER_REPORTS_TABLE)
    .delete()
    .eq('id', reportId);

  if (error) throw error;
}
