import { supabase } from '../../supabaseClient';
import type { MatchStatus, PhysioMatchContext } from '../../types';

function client() {
  if (!supabase) throw new Error('Supabase client is not configured');
  return supabase;
}

type MatchTeamRefs = { teamId?: string | null; opponentTeamId?: string | null };

const normalize = (value?: string | null) => (value || '').trim().toLowerCase();

/**
 * Physio ownership rule: a match belongs to the clinical team when that team plays
 * it as the home OR the away side. The Match Centre model stores this as
 * (team_id, opponent_team_id, is_home), so both team columns must be considered.
 */
export function matchInvolvesTeam(match: MatchTeamRefs, teamId: string): boolean {
  const target = normalize(teamId);
  if (!target) return false;
  return normalize(match.teamId) === target || normalize(match.opponentTeamId) === target;
}

type RawMatchRow = {
  id: string;
  date: string;
  status: string;
  team_id: string;
  opponent_team_id: string | null;
  is_home: boolean | null;
};

function toPhysioMatchContext(row: RawMatchRow, teamId: string): PhysioMatchContext {
  const isOurTeamColumn = normalize(row.team_id) === normalize(teamId);
  const opponentTeamId = isOurTeamColumn ? row.opponent_team_id : row.team_id;
  const isHomeFixture = Boolean(row.is_home);
  return {
    matchId: row.id,
    matchDate: row.date,
    opponentName: opponentTeamId || 'Match',
    matchStatus: row.status as MatchStatus,
    homeTeamId: isHomeFixture ? row.team_id : row.opponent_team_id,
    awayTeamId: isHomeFixture ? row.opponent_team_id : row.team_id,
    isHome: isOurTeamColumn ? isHomeFixture : !isHomeFixture
  };
}

/**
 * Single source of truth for the Physio match selector/projection. Used by injury and
 * complaint creation, editing and validation so every path applies the same rule.
 */
export async function listPhysioTeamMatches(teamId: string): Promise<PhysioMatchContext[]> {
  const normalizedTeamId = (teamId || '').trim();
  if (!normalizedTeamId) return [];

  try {
    const rpc = await client().rpc('physio_match_context', { target_team_id: normalizedTeamId });
    if (!rpc.error && Array.isArray(rpc.data) && rpc.data.length > 0) {
      return rpc.data.map((row: any) => ({
        matchId: row.match_id,
        matchDate: row.match_date,
        opponentName: row.opponent_name || 'Match',
        matchStatus: row.match_status as MatchStatus,
        homeTeamId: row.home_team_id ?? null,
        awayTeamId: row.away_team_id ?? null,
        isHome: Boolean(row.is_home)
      }));
    }
  } catch {
    // Fall through to the direct read below.
  }

  // Fallback for staff who can also read `matches` directly. Two scoped queries instead
  // of a composed `.or()` filter so no user-provided value is interpolated into PostgREST syntax.
  try {
    const columns = 'id, date, status, team_id, opponent_team_id, is_home';
    const [homeSide, awaySide] = await Promise.all([
      client().from('matches').select(columns).eq('team_id', normalizedTeamId),
      client().from('matches').select(columns).eq('opponent_team_id', normalizedTeamId)
    ]);
    const byId = new Map<string, RawMatchRow>();
    for (const row of [...(homeSide.data || []), ...(awaySide.data || [])] as RawMatchRow[]) {
      if (matchInvolvesTeam({ teamId: row.team_id, opponentTeamId: row.opponent_team_id }, normalizedTeamId)) {
        byId.set(row.id, row);
      }
    }
    return Array.from(byId.values())
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      .map((row) => toPhysioMatchContext(row, normalizedTeamId));
  } catch {
    return [];
  }
}

/**
 * Defence in depth before writing a clinical record: reject a match that does not involve
 * the clinical team. When no projection can be read the database trigger stays the authority.
 */
export async function assertMatchInPhysioTeamScope(teamId?: string | null, matchId?: string | null): Promise<void> {
  if (!teamId || !matchId) return;
  const scopedMatches = await listPhysioTeamMatches(teamId);
  if (scopedMatches.length === 0) return;
  if (!scopedMatches.some((match) => match.matchId === matchId)) {
    throw {
      code: '23514',
      message: 'Match does not belong to the clinical record team.'
    };
  }
}

export function formatPhysioMatchLabel(match: PhysioMatchContext): string {
  return `${match.matchDate} · ${match.isHome ? 'Home' : 'Away'} vs ${match.opponentName || 'Opponent'}`;
}
