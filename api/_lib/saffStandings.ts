export const SAFF_COMPETITION_ID = '430';
export const SAFF_COMPETITION_URL = `https://www.saff.com.sa/en/championship.php?id=${SAFF_COMPETITION_ID}&round=0&week=1`;

export interface SaffStanding {
  position: number;
  team: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

function parseNumber(value: string): number | null {
  const parsed = Number(value.replace(/[^0-9-]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseOfficialStandings(html: string): SaffStanding[] {
  const standings: SaffStanding[] = [];

  const standingContainer = html.match(/<div[^>]+id=["']standing["'][^>]*>([\s\S]*?)<\/div>\s*(?:<div|<\/section|$)/i)?.[1]
    ?? html.match(/<div[^>]+id=["']standing["'][^>]*>([\s\S]*)/i)?.[1];
  if (!standingContainer) return standings;

  const table = standingContainer.match(/<table[^>]*>([\s\S]*?)<\/table>/i)?.[1];
  if (!table) return standings;

  for (const row of table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
      .map((cell) => cell[1].replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim());
    if (cells.length < 12) continue;

    const position = parseNumber(cells[1]);
    const values = [cells[4], cells[5], cells[6], cells[7], cells[8], cells[9], cells[10], cells[11]].map(parseNumber);
    const team = cells[3];
    if (position === null || !team || values.some((value) => value === null)) continue;

    const [played, won, drawn, lost, goalsFor, goalsAgainst, goalDifference, points] = values as number[];
    standings.push({ position, team, played, won, drawn, lost, goalsFor, goalsAgainst, goalDifference, points });
  }

  return standings;
}

export async function fetchOfficialSaffStandings(): Promise<SaffStanding[]> {
  const response = await fetch(SAFF_COMPETITION_URL, {
    signal: AbortSignal.timeout(8000),
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'User-Agent': 'Mozilla/5.0'
    }
  });
  if (!response.ok) throw new Error(`SAFF returned HTTP ${response.status}`);

  const standings = parseOfficialStandings(await response.text());
  if (standings.length === 0) {
    throw new Error('SAFF did not publish an official standings table in the competition response');
  }
  return standings;
}