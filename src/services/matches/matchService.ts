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

type MatchRowWithOpponent = MatchRow & {
  opponent_name?: string;
  opponent_logo_url?: string | null;
};

function getClient() {
  if (!supabase) throw new Error('Supabase client is not configured');
  return supabase;
}

function fromRow(row: MatchRow | MatchRowWithOpponent): Match {
  const withOpponent = row as MatchRowWithOpponent;
  return {
    id: row.id,
    teamId: row.team_id,
    opponentTeamId: row.opponent_team_id,
    opponentName: withOpponent.opponent_name ?? undefined,
    opponentLogoUrl: withOpponent.opponent_logo_url ?? null,
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
  // Join with auth_teams to get opponent name
  let query = getClient()
    .from(MATCHES_TABLE)
    .select(`
      *,
      opponent_team:auth_teams!matches_opponent_team_id_fkey(name, logo_url)
    `);
  
  if (teamId) {
    query = query.eq('team_id', teamId);
  }

  const { data, error } = await query.order('date', { ascending: true });
  if (error) throw error;

  // Transform the joined data
  return ((data || []) as any[]).map((row) => {
    const opponent = row.opponent_team as { name?: string; logo_url?: string | null } | null;
    return fromRow({
      ...row,
      opponent_name: opponent?.name,
      opponent_logo_url: opponent?.logo_url
    } as MatchRowWithOpponent);
  });
}

export async function getMatchById(matchId: string): Promise<Match | null> {
  const { data, error } = await getClient()
    .from(MATCHES_TABLE)
    .select(`
      *,
      opponent_team:auth_teams!matches_opponent_team_id_fkey(name, logo_url)
    `)
    .eq('id', matchId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const row = data as MatchRow & { opponent_team?: { name?: string; logo_url?: string | null } | null };
  return fromRow({
    ...row,
    opponent_name: row.opponent_team?.name,
    opponent_logo_url: row.opponent_team?.logo_url
  } as MatchRowWithOpponent);
}

/**
 * Ensures an opponent team exists in auth_teams.
 * If the team doesn't exist, creates it with a slug-based ID.
 * Returns the team ID.
 */
async function ensureOpponentTeam(opponentName: string): Promise<string> {
  if (!opponentName || !opponentName.trim()) {
    throw new Error('Opponent name is required');
  }

  const trimmedName = opponentName.trim();

  // Generate slug: "Al Hilal U17" -> "al-hilal-u17"
  const slug = trimmedName
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');

  // Check if team already exists by name or slug
  const { data: existingByName } = await getClient()
    .from('auth_teams')
    .select('id')
    .ilike('name', trimmedName)
    .maybeSingle();

  if (existingByName) {
    return existingByName.id;
  }

  const { data: existingBySlug } = await getClient()
    .from('auth_teams')
    .select('id')
    .eq('id', slug)
    .maybeSingle();

  if (existingBySlug) {
    return existingBySlug.id;
  }

  // Create new team
  const { data: newTeam, error } = await getClient()
    .from('auth_teams')
    .insert({
      id: slug,
      name: trimmedName,
      is_active: true
    })
    .select('id')
    .single();

  if (error) {
    // Handle conflict if team was created concurrently
    if (error.code === '23505') {
      return slug;
    }
    throw error;
  }

  return newTeam.id;
}

export async function createMatch(input: Partial<Match> & Pick<Match, 'teamId' | 'opponentTeamId' | 'competitionName' | 'date' | 'time' | 'status'>): Promise<Match> {
  const matchId = input.id || crypto.randomUUID();
  
  // Ensure opponent team exists in auth_teams
  const opponentTeamId = await ensureOpponentTeam(input.opponentTeamId);
  
  const payload = toRow({ 
    ...input, 
    id: matchId, 
    teamId: input.teamId, 
    opponentTeamId, 
    competitionName: input.competitionName, 
    date: input.date, 
    time: input.time, 
    status: input.status 
  });

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

export interface StandingsEntry {
  rank: number;
  team: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  pts: number;
  form: Array<'W' | 'D' | 'L'>;
  isUs: boolean;
}

export async function calculateStandings(teamId: string, competitionName?: string): Promise<StandingsEntry[]> {
  let query = getClient().from(MATCHES_TABLE).select('*');
  
  if (competitionName) {
    query = query.eq('competition_name', competitionName);
  }
  
  query = query.eq('status', 'played');
  
  const { data, error } = await query;
  if (error) throw error;

  const matches = ((data || []) as MatchRow[]).map(fromRow);
  
  const teamsMap = new Map<string, {
    played: number;
    won: number;
    drawn: number;
    lost: number;
    gf: number;
    ga: number;
    matches: Match[];
  }>();

  matches.forEach(match => {
    if (match.ourScore === null || match.opponentScore === null) return;

    const ourTeam = match.teamId;
    const opponent = match.opponentTeamId;
    
    if (!teamsMap.has(ourTeam)) {
      teamsMap.set(ourTeam, { played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, matches: [] });
    }
    if (!teamsMap.has(opponent)) {
      teamsMap.set(opponent, { played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, matches: [] });
    }

    const ourStats = teamsMap.get(ourTeam)!;
    const opponentStats = teamsMap.get(opponent)!;

    ourStats.played++;
    ourStats.gf += match.ourScore;
    ourStats.ga += match.opponentScore;
    ourStats.matches.push(match);

    opponentStats.played++;
    opponentStats.gf += match.opponentScore;
    opponentStats.ga += match.ourScore;

    if (match.ourScore > match.opponentScore) {
      ourStats.won++;
      opponentStats.lost++;
    } else if (match.ourScore < match.opponentScore) {
      ourStats.lost++;
      opponentStats.won++;
    } else {
      ourStats.drawn++;
      opponentStats.drawn++;
    }
  });

  const standings: StandingsEntry[] = Array.from(teamsMap.entries()).map(([team, stats]) => {
    const recentMatches = stats.matches.slice(-5).reverse();
    const form = recentMatches.map(m => {
      if (m.ourScore === null || m.opponentScore === null) return 'D';
      if (m.teamId === team) {
        if (m.ourScore > m.opponentScore) return 'W';
        if (m.ourScore < m.opponentScore) return 'L';
        return 'D';
      } else {
        if (m.opponentScore > m.ourScore) return 'W';
        if (m.opponentScore < m.ourScore) return 'L';
        return 'D';
      }
    });

    return {
      rank: 0,
      team,
      played: stats.played,
      won: stats.won,
      drawn: stats.drawn,
      lost: stats.lost,
      gf: stats.gf,
      ga: stats.ga,
      pts: stats.won * 3 + stats.drawn,
      form,
      isUs: team === teamId
    };
  });

  standings.sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    const gdA = a.gf - a.ga;
    const gdB = b.gf - b.ga;
    if (gdB !== gdA) return gdB - gdA;
    return b.gf - a.gf;
  });

  standings.forEach((entry, index) => {
    entry.rank = index + 1;
  });

  return standings;
}

export interface MatchWithScore {
  id: string;
  opponent: string;
  date: string;
  time: string;
  location: 'Home' | 'Away' | 'Neutral';
  venue?: string;
  competitionName: string;
  status: 'Scheduled' | 'Played';
  ourGoals?: number;
  opponentGoals?: number;
}

export function matchToDisplay(match: Match): MatchWithScore {
  return {
    id: match.id,
    opponent: match.opponentName || match.opponentTeamId, // Use human-readable name if available
    date: match.date,
    time: match.time,
    location: match.isHome ? 'Home' : 'Away',
    venue: match.venue ?? undefined,
    competitionName: match.competitionName,
    status: match.status === 'played' ? 'Played' : 'Scheduled',
    ourGoals: match.ourScore ?? undefined,
    opponentGoals: match.opponentScore ?? undefined
  };
}
