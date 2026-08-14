import { supabase } from '../../supabaseClient';
import type { Match } from '../../types';

const MATCHES_TABLE = 'matches';

type MatchRow = {
  id: string;
  team_id: string;
  opponent_team_id: string;
  fixture_id: string | null;
  competition_name: string | null;
  date: string;
  time: string | null;
  venue: string | null;
  location: string | null;
  is_home: boolean | null;
  status: Match['status'];
  our_score: number | null;
  opponent_score: number | null;
  created_at: string | null;
  updated_at: string | null;
};

function getClient() {
  if (!supabase) throw new Error('Supabase client is not configured');
  return supabase;
}

function fromRow(row: MatchRow): Match {
  return {
    id: row.id,
    teamId: row.team_id,
    opponentTeamId: row.opponent_team_id,
    fixtureId: row.fixture_id ?? null,
    competitionName: row.competition_name ?? '',
    date: row.date,
    time: row.time ?? '18:30',
    venue: row.venue ?? null,
    location: row.location ?? null,
    isHome: row.is_home ?? true,
    status: row.status,
    ourScore: row.our_score ?? null,
    opponentScore: row.opponent_score ?? null,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined
  };
}

function toRow(input: Partial<Match> & Pick<Match, 'teamId' | 'opponentTeamId' | 'competitionName' | 'date' | 'time' | 'status'>): Record<string, unknown> {
  return {
    id: input.id,
    team_id: input.teamId,
    opponent_team_id: input.opponentTeamId,
    fixture_id: input.fixtureId ?? null,
    competition_name: input.competitionName,
    date: input.date,
    time: input.time,
    venue: input.venue ?? null,
    location: input.location ?? null,
    is_home: input.isHome ?? true,
    status: input.status,
    our_score: input.ourScore ?? null,
    opponent_score: input.opponentScore ?? null,
    updated_at: new Date().toISOString()
  };
}

export async function listMatches(teamId?: string | null): Promise<Match[]> {
  let query = getClient().from(MATCHES_TABLE).select('*');
  if (teamId) {
    query = query.eq('team_id', teamId);
  }

  const { data, error } = await query.order('date', { ascending: false });
  if (error) throw error;

  return ((data || []) as MatchRow[]).map(fromRow);
}

export async function getMatchById(matchId: string): Promise<Match | null> {
  const { data, error } = await getClient()
    .from(MATCHES_TABLE)
    .select('*')
    .eq('id', matchId)
    .maybeSingle();

  if (error) throw error;
  return data ? fromRow(data as MatchRow) : null;
}

export async function createMatch(input: Partial<Match> & Pick<Match, 'teamId' | 'opponentTeamId' | 'competitionName' | 'date' | 'time' | 'status'>): Promise<Match> {
  const matchId = input.id || crypto.randomUUID();
  const payload = toRow({ ...input, id: matchId, teamId: input.teamId, opponentTeamId: input.opponentTeamId, competitionName: input.competitionName, date: input.date, time: input.time, status: input.status });

  const { data, error } = await getClient()
    .from(MATCHES_TABLE)
    .insert(payload)
    .select('*')
    .single();

  if (error) throw error;
  return fromRow(data as MatchRow);
}

export async function updateMatch(matchId: string, patch: Partial<Match>): Promise<Match> {
  const payload: Record<string, unknown> = {
    ...patch,
    updated_at: new Date().toISOString()
  };

  if (patch.teamId) payload.team_id = patch.teamId;
  if (patch.opponentTeamId) payload.opponent_team_id = patch.opponentTeamId;
  if (patch.fixtureId !== undefined) payload.fixture_id = patch.fixtureId ?? null;
  if (patch.competitionName !== undefined) payload.competition_name = patch.competitionName;
  if (patch.date !== undefined) payload.date = patch.date;
  if (patch.time !== undefined) payload.time = patch.time;
  if (patch.venue !== undefined) payload.venue = patch.venue ?? null;
  if (patch.location !== undefined) payload.location = patch.location ?? null;
  if (patch.isHome !== undefined) payload.is_home = patch.isHome;
  if (patch.status !== undefined) payload.status = patch.status;
  if (patch.ourScore !== undefined) payload.our_score = patch.ourScore ?? null;
  if (patch.opponentScore !== undefined) payload.opponent_score = patch.opponentScore ?? null;

  const { data, error } = await getClient()
    .from(MATCHES_TABLE)
    .update(payload)
    .eq('id', matchId)
    .select('*')
    .single();

  if (error) throw error;
  return fromRow(data as MatchRow);
}

export async function deleteMatch(matchId: string): Promise<void> {
  const { error } = await getClient()
    .from(MATCHES_TABLE)
    .delete()
    .eq('id', matchId);

  if (error) throw error;
}

export async function linkMatchToFixture(matchId: string, fixtureId: string | null): Promise<Match> {
  const { data, error } = await getClient()
    .from(MATCHES_TABLE)
    .update({
      fixture_id: fixtureId,
      updated_at: new Date().toISOString()
    })
    .eq('id', matchId)
    .select('*')
    .single();

  if (error) throw error;
  return fromRow(data as MatchRow);
}
