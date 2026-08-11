import { getEmptySession } from './defaultSession';
import type { CloudTrainingSession, TrainingSession } from './types';
import { isSupabaseConfigured, supabase } from './supabaseClient';

type SessionRole = 'football' | 'fitness' | 'gk';

type SessionRow = {
  id: string;
  team_name: string | null;
  date: string | null;
  time: string | null;
  session_number: string | null;
  microcycle_day: string | null;
  main_objective: string | null;
  materials_needed: string | null;
  observations: string | null;
  warm_up: any;
  main_part: any;
  cool_down: any;
  player_groups: any;
  squad_roster: any;
  attendance: any;
  fitness_warm_up: any;
  fitness_main_part: any;
  fitness_cool_down: any;
  fitness_player_groups: any;
  gk_warm_up: any;
  gk_main_part: any;
  gk_cool_down: any;
  gk_player_groups: any;
  updated_at: number | null;
  football_updated_at: number | null;
  fitness_updated_at: number | null;
  gk_updated_at: number | null;
};

const SESSIONS_TABLE = 'sessions';

function toErrorCode(error: unknown): string {
  if (!error || typeof error !== 'object') return 'unknown';
  const withCode = error as { code?: unknown };
  return withCode.code ? String(withCode.code) : 'unknown';
}

function toErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return error instanceof Error ? error.message : String(error);
  }

  const withMessage = error as { message?: unknown };
  return withMessage.message ? String(withMessage.message) : 'Unknown Supabase error';
}

function toErrorStatus(error: unknown): number | null {
  if (!error || typeof error !== 'object') return null;
  const withStatus = error as { status?: unknown };
  return typeof withStatus.status === 'number' ? withStatus.status : null;
}

function isAuthSessionError(error: unknown): boolean {
  const code = toErrorCode(error).toLowerCase();
  const message = toErrorMessage(error).toLowerCase();
  const status = toErrorStatus(error);

  if (status === 401) return true;
  if (code.includes('jwt') || code.includes('token') || code.includes('auth')) return true;

  return (
    message.includes('jwt') ||
    message.includes('token') ||
    message.includes('not authenticated') ||
    message.includes('invalid claim')
  );
}

function isStatementTimeoutError(error: unknown): boolean {
  const code = toErrorCode(error);
  const message = toErrorMessage(error).toLowerCase();

  if (code === '57014') return true;

  return (
    message.includes('statement timeout') ||
    message.includes('query canceled') ||
    message.includes('canceling statement')
  );
}

async function writeSessionPatchByRole(
  client: NonNullable<typeof supabase>,
  sessionId: string,
  patch: Record<string, unknown>
): Promise<unknown | null> {
  // Update first to avoid ON CONFLICT plans that can timeout under complex RLS checks.
  const { data: updatedRows, error: updateError } = await client
    .from(SESSIONS_TABLE)
    .update(patch)
    .eq('id', sessionId)
    .select('id')
    .limit(1);

  if (updateError) {
    return updateError;
  }

  if (Array.isArray(updatedRows) && updatedRows.length > 0) {
    return null;
  }

  const { error: insertError } = await client
    .from(SESSIONS_TABLE)
    .insert(patch);

  // Race condition: another client inserted just before us; retry as update.
  if (insertError && toErrorCode(insertError) === '23505') {
    const { error: retryUpdateError } = await client
      .from(SESSIONS_TABLE)
      .update(patch)
      .eq('id', sessionId);
    return retryUpdateError || null;
  }

  return insertError || null;
}

function getSupabaseOrThrow() {
  if (!supabase) {
    throw new Error('Supabase client is not configured');
  }
  return supabase;
}

function toCloudTrainingSession(row: SessionRow): CloudTrainingSession {
  const empty = getEmptySession();

  return {
    ...empty,
    id: row.id,
    teamName: row.team_name || empty.teamName,
    date: row.date || empty.date,
    time: row.time || empty.time,
    sessionNumber: row.session_number || empty.sessionNumber,
    microcycleDay: row.microcycle_day || empty.microcycleDay,
    mainObjective: row.main_objective || empty.mainObjective,
    materialsNeeded: row.materials_needed || empty.materialsNeeded,
    observations: row.observations || empty.observations,
    warmUp: row.warm_up || empty.warmUp,
    mainPart: row.main_part || empty.mainPart,
    coolDown: row.cool_down || empty.coolDown,
    playerGroups: row.player_groups || empty.playerGroups,
    squadRoster: row.squad_roster || empty.squadRoster,
    attendance: row.attendance || empty.attendance,
    fitnessWarmUp: row.fitness_warm_up || empty.fitnessWarmUp,
    fitnessMainPart: row.fitness_main_part || empty.fitnessMainPart,
    fitnessCoolDown: row.fitness_cool_down || empty.fitnessCoolDown,
    fitnessPlayerGroups: row.fitness_player_groups || empty.fitnessPlayerGroups,
    gkWarmUp: row.gk_warm_up || empty.gkWarmUp,
    gkMainPart: row.gk_main_part || empty.gkMainPart,
    gkCoolDown: row.gk_cool_down || empty.gkCoolDown,
    gkPlayerGroups: row.gk_player_groups || empty.gkPlayerGroups,
    updatedAt: row.updated_at || 0,
    footballUpdatedAt: row.football_updated_at || undefined,
    fitnessUpdatedAt: row.fitness_updated_at || undefined,
    gkUpdatedAt: row.gk_updated_at || undefined
  };
}

function getRolePatch(role: SessionRole, session: TrainingSession, timestamp: number) {
  const shared = {
    id: session.id,
    team_name: session.teamName,
    date: session.date,
    time: session.time,
    session_number: session.sessionNumber,
    microcycle_day: session.microcycleDay,
    main_objective: session.mainObjective,
    materials_needed: session.materialsNeeded,
    squad_roster: session.squadRoster || [],
    attendance: session.attendance || [],
    updated_at: timestamp
  };

  if (role === 'football') {
    return {
      ...shared,
      football_updated_at: timestamp,
      warm_up: session.warmUp,
      main_part: session.mainPart,
      cool_down: session.coolDown,
      player_groups: session.playerGroups,
      observations: session.observations || '',
      squad_roster: session.squadRoster || [],
      attendance: session.attendance || []
    };
  }

  if (role === 'fitness') {
    return {
      ...shared,
      fitness_updated_at: timestamp,
      fitness_warm_up: session.fitnessWarmUp,
      fitness_main_part: session.fitnessMainPart,
      fitness_cool_down: session.fitnessCoolDown,
      fitness_player_groups: session.fitnessPlayerGroups || []
    };
  }

  return {
    ...shared,
    gk_updated_at: timestamp,
    gk_warm_up: session.gkWarmUp,
    gk_main_part: session.gkMainPart,
    gk_cool_down: session.gkCoolDown,
    gk_player_groups: session.gkPlayerGroups || []
  };
}

export function getSessionsDataProvider(): 'supabase' {
  return 'supabase';
}

export function isSupabaseSessionsEnabled(): boolean {
  return Boolean(supabase) && isSupabaseConfigured;
}

function toSupabaseSessionRow(session: CloudTrainingSession): Record<string, unknown> {
  return {
    id: session.id,
    team_name: session.teamName,
    date: session.date,
    time: session.time,
    session_number: session.sessionNumber,
    microcycle_day: session.microcycleDay,
    main_objective: session.mainObjective,
    materials_needed: session.materialsNeeded,
    observations: session.observations || '',
    warm_up: session.warmUp,
    main_part: session.mainPart,
    cool_down: session.coolDown,
    player_groups: session.playerGroups,
    squad_roster: session.squadRoster || [],
    attendance: session.attendance || [],
    fitness_warm_up: session.fitnessWarmUp || null,
    fitness_main_part: session.fitnessMainPart || null,
    fitness_cool_down: session.fitnessCoolDown || null,
    fitness_player_groups: session.fitnessPlayerGroups || [],
    gk_warm_up: session.gkWarmUp || null,
    gk_main_part: session.gkMainPart || null,
    gk_cool_down: session.gkCoolDown || null,
    gk_player_groups: session.gkPlayerGroups || [],
    updated_at: session.updatedAt || 0,
    football_updated_at: session.footballUpdatedAt || null,
    fitness_updated_at: session.fitnessUpdatedAt || null,
    gk_updated_at: session.gkUpdatedAt || null
  };
}

export async function countSessionsSupabase(): Promise<number> {
  const client = getSupabaseOrThrow();
  const { count, error } = await client
    .from(SESSIONS_TABLE)
    .select('id', { count: 'exact', head: true });

  if (error) {
    throw error;
  }

  return count || 0;
}

export async function upsertSessionsSupabase(sessions: CloudTrainingSession[]): Promise<void> {
  if (sessions.length === 0) return;
  const client = getSupabaseOrThrow();
  const payload = sessions.map(toSupabaseSessionRow);
  const { error } = await client.from(SESSIONS_TABLE).upsert(payload, { onConflict: 'id' });
  if (error) {
    throw error;
  }
}

export async function subscribeToSessionsSupabase(
  callback: (sessions: CloudTrainingSession[]) => void,
  onError?: (error: any) => void
): Promise<() => void> {
  const client = getSupabaseOrThrow();
  const provider = getSessionsDataProvider();
  const enabled = isSupabaseSessionsEnabled();

  // Check current auth session
  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  const hasSession = !!sessionData?.session;
  const userEmail = sessionData?.session?.user?.email || 'anonymous';

  console.log('[SUPABASE SESSIONS] Auth Status', {
    hasSession,
    userEmail,
    sessionError: sessionError ? String(sessionError) : null
  });

  console.log('[SUPABASE SESSIONS] Init', {
    provider: getSessionsDataProvider(),
    enabled,
    error: null,
    count: null
  });

  const loadAndEmit = async () => {
    const { data, error } = await client
      .from(SESSIONS_TABLE)
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      const errorSummary = error as unknown as { code?: unknown; message?: unknown; status?: unknown };
      console.log('[SUPABASE SESSIONS] Query Error', {
        provider,
        enabled,
        error: {
          code: errorSummary.code ? String(errorSummary.code) : 'unknown',
          message: errorSummary.message ? String(errorSummary.message) : 'Unknown Supabase error',
          status: typeof errorSummary.status === 'number' ? errorSummary.status : null
        },
        count: null
      });
      throw error;
    }

    const sessions = (data || []).map((row) => toCloudTrainingSession(row as SessionRow));
    console.log('[SUPABASE SESSIONS] Result', {
      provider,
      enabled,
      error: null,
      count: sessions.length
    });
    callback(sessions);
  };

  try {
    await loadAndEmit();
  } catch (error) {
    if (onError) onError(error);
  }

  const channel = client
    .channel('u17-sessions-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: SESSIONS_TABLE }, async () => {
      try {
        await loadAndEmit();
      } catch (error) {
        if (onError) onError(error);
      }
    })
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR' && onError) {
        onError(new Error('Supabase realtime channel error for sessions'));
      }
    });

  return () => {
    client.removeChannel(channel);
  };
}

export async function saveSessionFieldsByRoleSupabase(
  sessionId: string,
  role: SessionRole,
  session: TrainingSession
): Promise<number> {
  const client = getSupabaseOrThrow();
  const saveTimestamp = Date.now();

  const patch = getRolePatch(role, { ...session, id: sessionId }, saveTimestamp) as Record<string, unknown>;
  const write = async () => writeSessionPatchByRole(client, sessionId, patch);

  let error = await write();

  // Recover once when the browser session/token expired between login and save.
  if (error && isAuthSessionError(error)) {
    const refreshResult = await client.auth.refreshSession();
    if (!refreshResult.error) {
      error = await write();
    }
  }

  // Retry once for transient Postgres query timeout/cancellation (57014).
  if (error && isStatementTimeoutError(error)) {
    error = await write();
  }

  if (error) {
    throw error;
  }

  return saveTimestamp;
}

export async function deleteSessionFromSupabase(sessionId: string): Promise<void> {
  const client = getSupabaseOrThrow();
  const { error } = await client.from(SESSIONS_TABLE).delete().eq('id', sessionId);
  if (error) {
    throw error;
  }
}
