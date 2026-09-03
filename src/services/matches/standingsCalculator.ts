import type { Match } from '../../types';

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

/**
 * Pure standings aggregation, kept free of any Supabase import so it can be unit tested
 * directly. Only played matches from the official Saudi competition count towards the
 * table: friendlies, preseason and any other non-official fixtures are ignored entirely,
 * without altering Played/Won/Drawn/Lost/GF/GA/Points for the matches that do count.
 */
export function calculateStandingsFromMatches(matches: Match[], teamId: string): StandingsEntry[] {
  const officialPlayedMatches = matches.filter(
    (match) => match.status === 'played' && match.matchCategory === 'official'
  );

  const teamsMap = new Map<string, {
    played: number;
    won: number;
    drawn: number;
    lost: number;
    gf: number;
    ga: number;
    matches: Match[];
  }>();

  officialPlayedMatches.forEach((match) => {
    if (match.ourScore == null || match.opponentScore == null) return;

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
    const form = recentMatches.map((m): 'W' | 'D' | 'L' => {
      if (m.ourScore == null || m.opponentScore == null) return 'D';
      if (m.teamId === team) {
        if (m.ourScore > m.opponentScore) return 'W';
        if (m.ourScore < m.opponentScore) return 'L';
        return 'D';
      }
      if (m.opponentScore > m.ourScore) return 'W';
      if (m.opponentScore < m.ourScore) return 'L';
      return 'D';
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
