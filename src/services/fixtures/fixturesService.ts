import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../../supabaseClient';
import type { MatchFixture } from '../../types';

const FIXTURES_TABLE = 'competition_fixtures';

type FixtureRow = {
  id: string;
  opponent: string;
  opponent_logo: string | null;
  date: string;
  time: string;
  location: MatchFixture['location'];
  venue: string | null;
  competition_name: string;
  matchday: string | null;
  status: MatchFixture['status'];
  result: MatchFixture['result'] | null;
  tactical_notes: string | null;
  lineup: MatchFixture['lineup'] | null;
  updated_at: bigint | number;
};

export interface CloudCompetitionFixture extends MatchFixture {
  updatedAt: number;
}

function getClient() {
  if (!supabase) throw new Error('Supabase client is not configured');
  return supabase;
}

function fromRow(row: FixtureRow): CloudCompetitionFixture {
  return {
    id: row.id,
    opponent: row.opponent,
    opponentLogo: row.opponent_logo ?? undefined,
    date: row.date,
    time: row.time,
    location: row.location,
    venue: row.venue ?? undefined,
    competitionName: row.competition_name,
    matchday: row.matchday ?? undefined,
    status: row.status,
    result: row.result ?? undefined,
    tacticalNotes: row.tactical_notes ?? undefined,
    lineup: row.lineup ?? undefined,
    updatedAt: Number(row.updated_at)
  };
}

function toRow(fixture: MatchFixture, updatedAt: number): Record<string, unknown> {
  return {
    id: fixture.id,
    opponent: fixture.opponent,
    opponent_logo: fixture.opponentLogo ?? null,
    date: fixture.date,
    time: fixture.time,
    location: fixture.location,
    venue: fixture.venue ?? null,
    competition_name: fixture.competitionName,
    matchday: fixture.matchday ?? null,
    status: fixture.status,
    result: fixture.result ?? null,
    tactical_notes: fixture.tacticalNotes ?? null,
    lineup: fixture.lineup ?? null,
    updated_at: updatedAt
  };
}

async function listFixtures(): Promise<CloudCompetitionFixture[]> {
  const { data, error } = await getClient()
    .from(FIXTURES_TABLE)
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return ((data || []) as FixtureRow[]).map(fromRow);
}

export function subscribeToCompetitionFixtures(
  callback: (fixtures: CloudCompetitionFixture[]) => void,
  onError?: (error: unknown) => void
): () => void {
  const client = getClient();
  let active = true;
  let channel: RealtimeChannel | null = null;

  const loadAndEmit = async () => {
    try {
      const fixtures = await listFixtures();
      if (active) callback(fixtures);
    } catch (error) {
      if (active && onError) onError(error);
    }
  };

  void loadAndEmit();

  channel = client
    .channel('u17-competition-fixtures-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: FIXTURES_TABLE }, () => {
      void loadAndEmit();
    })
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR' && onError) {
        onError(new Error('Supabase realtime channel error for competition fixtures'));
      }
    });

  return () => {
    active = false;
    if (channel) void client.removeChannel(channel);
  };
}

export async function saveCompetitionFixtureToCloud(fixture: MatchFixture): Promise<number> {
  const updatedAt = Date.now();
  const { error } = await getClient()
    .from(FIXTURES_TABLE)
    .upsert(toRow(fixture, updatedAt), { onConflict: 'id' });

  if (error) throw error;
  return updatedAt;
}

export async function deleteCompetitionFixtureFromCloud(fixtureId: string): Promise<void> {
  const { error } = await getClient()
    .from(FIXTURES_TABLE)
    .delete()
    .eq('id', fixtureId);

  if (error) throw error;
}
