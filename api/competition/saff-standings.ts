import { fetchOfficialSaffStandings, SAFF_COMPETITION_ID, SAFF_COMPETITION_URL } from '../_lib/saffStandings';

export default async function handler(request: any, response: any) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const standings = await fetchOfficialSaffStandings();

    response.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
    return response.status(200).json({ competitionId: SAFF_COMPETITION_ID, sourceUrl: SAFF_COMPETITION_URL, standings });
  } catch (error) {
    console.error('[SAFF standings] Failed loading official standings', error);
    return response.status(502).json({ error: error instanceof Error ? error.message : 'Official SAFF standings are unavailable' });
  }
}