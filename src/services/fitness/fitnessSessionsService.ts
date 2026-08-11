import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../../supabaseClient';
import type { FitnessSession, PlayerGroup, TrainingBlock } from '../../types';

const FITNESS_SESSIONS_TABLE = 'fitness_sessions';
const FITNESS_READ_RETRY_DELAY_MS = 1500;
const FITNESS_MAX_READ_RETRIES = 1;

function createFitnessRealtimeChannelName(): string {
  return `u17-fitness-sessions-realtime-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

type FitnessSessionsErrorKind = 'load' | 'realtime';

type FitnessSessionsError = Error & {
  kind?: FitnessSessionsErrorKind;
};

function withErrorKind(error: unknown, kind: FitnessSessionsErrorKind): FitnessSessionsError {
  if (error instanceof Error) {
    const typed = error as FitnessSessionsError;
    typed.kind = kind;
    return typed;
  }

  const fallback = new Error(String(error)) as FitnessSessionsError;
  fallback.kind = kind;
  return fallback;
}

function isTransientReadError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const details = error as {
    code?: unknown;
    status?: unknown;
    message?: unknown;
    details?: unknown;
    hint?: unknown;
  };

  const code = details.code ? String(details.code) : '';
  const status = typeof details.status === 'number' ? details.status : null;
  const text = [details.message, details.details, details.hint]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase())
    .join(' ');

  return code === '57014'
    || status === 500
    || status === 502
    || status === 503
    || status === 504
    || text.includes('timeout')
    || text.includes('gateway')
    || text.includes('temporar')
    || text.includes('failed to fetch')
    || text.includes('network');
}

type FitnessSessionRow = {
  id: string;
  session_uid: string;
  legacy_session_id: string | null;
  team_name: string | null;
  date: string | null;
  time: string | null;
  session_number: string | null;
  microcycle_day: string | null;
  main_objective: string | null;
  materials_needed: string | null;
  observations: string | null;
  squad_roster: string[] | null;
  attendance: FitnessSession['attendance'] | null;
  warm_up: TrainingBlock | null;
  main_part: TrainingBlock | null;
  cool_down: TrainingBlock | null;
  player_groups: PlayerGroup[] | null;
  created_at: number | null;
  updated_at: number | null;
};

function getClient() {
  if (!supabase) {
    throw new Error('Supabase client is not configured');
  }
  return supabase;
}

function defaultBlock(id: string, title: string): TrainingBlock {
  return {
    id,
    title,
    exercises: []
  };
}

function fromRow(row: FitnessSessionRow): FitnessSession {
  const sessionUid = row.session_uid || row.id;
  return {
    id: row.id,
    sessionUid,
    legacySessionId: row.legacy_session_id || undefined,
    teamName: row.team_name || 'U17 Women Al Ula',
    date: row.date || new Date().toISOString().slice(0, 10),
    time: row.time || '18:30 - 20:00',
    sessionNumber: row.session_number || '001',
    microcycleDay: row.microcycle_day || 'MD-3',
    mainObjective: row.main_objective || '',
    materialsNeeded: row.materials_needed || '',
    observations: row.observations || '',
    squadRoster: row.squad_roster || [],
    attendance: row.attendance || [],
    fitnessWarmUp: row.warm_up || defaultBlock('warmup-block-fitness', 'Warm Up'),
    fitnessMainPart: row.main_part || defaultBlock('main-block-fitness', 'Main Part'),
    fitnessCoolDown: row.cool_down || defaultBlock('cooldown-block-fitness', 'Cool Down'),
    fitnessPlayerGroups: row.player_groups || [],
    createdAt: row.created_at || Date.now(),
    updatedAt: row.updated_at || 0
  };
}

function toRow(session: FitnessSession, updatedAt: number): FitnessSessionRow {
  return {
    id: session.id,
    session_uid: session.sessionUid,
    legacy_session_id: session.legacySessionId || null,
    team_name: session.teamName,
    date: session.date,
    time: session.time,
    session_number: session.sessionNumber,
    microcycle_day: session.microcycleDay,
    main_objective: session.mainObjective,
    materials_needed: session.materialsNeeded,
    observations: session.observations || null,
    squad_roster: session.squadRoster || [],
    attendance: session.attendance || [],
    warm_up: session.fitnessWarmUp,
    main_part: session.fitnessMainPart,
    cool_down: session.fitnessCoolDown,
    player_groups: session.fitnessPlayerGroups || [],
    created_at: session.createdAt || updatedAt,
    updated_at: updatedAt
  };
}

async function listFitnessSessions(): Promise<FitnessSession[]> {
  const { data, error } = await getClient()
    .from(FITNESS_SESSIONS_TABLE)
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return ((data || []) as FitnessSessionRow[]).map(fromRow);
}

export function subscribeToFitnessSessions(
  callback: (sessions: FitnessSession[]) => void,
  onError?: (error: unknown) => void
): () => void {
  const client = getClient();
  let active = true;
  let channel: RealtimeChannel | null = null;
  let hasLoadedAtLeastOnce = false;

  const loadAndEmit = async (attempt = 0) => {
    try {
      const sessions = await listFitnessSessions();
      if (active) {
        hasLoadedAtLeastOnce = true;
        callback(sessions);
      }
    } catch (error) {
      if (
        active
        && attempt < FITNESS_MAX_READ_RETRIES
        && isTransientReadError(error)
      ) {
        setTimeout(() => {
          if (!active) return;
          void loadAndEmit(attempt + 1);
        }, FITNESS_READ_RETRY_DELAY_MS);
        return;
      }

      if (active && onError) onError(withErrorKind(error, 'load'));
    }
  };

  void loadAndEmit();

  channel = client
    .channel(createFitnessRealtimeChannelName())
    .on('postgres_changes', { event: '*', schema: 'public', table: FITNESS_SESSIONS_TABLE }, () => {
      void loadAndEmit();
    })
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR') {
        if (!hasLoadedAtLeastOnce) {
          void loadAndEmit();
        }

        if (onError) {
          onError(withErrorKind(new Error('Supabase realtime channel error for fitness sessions'), 'realtime'));
        }
      }
    });

  return () => {
    active = false;
    if (channel) void client.removeChannel(channel);
  };
}

export async function saveFitnessSession(session: FitnessSession): Promise<number> {
  const updatedAt = Date.now();
  const payload = toRow(session, updatedAt);
  const { error } = await getClient()
    .from(FITNESS_SESSIONS_TABLE)
    .upsert(payload, { onConflict: 'id' });

  if (error) throw error;
  return updatedAt;
}

export async function deleteFitnessSession(fitnessSessionId: string): Promise<void> {
  const { error } = await getClient()
    .from(FITNESS_SESSIONS_TABLE)
    .delete()
    .eq('id', fitnessSessionId);

  if (error) throw error;
}
