import { getEmptySession } from './defaultSession';
import type { CloudTrainingSession } from './firebase';
import type { TrainingSession } from './types';
import { isSupabaseEnabled, supabase } from './supabaseClient';

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

export function isSupabaseSessionsEnabled(): boolean {
  return isSupabaseEnabled();
}

export async function subscribeToSessionsSupabase(
  callback: (sessions: CloudTrainingSession[]) => void,
  onError?: (error: any) => void
): Promise<() => void> {
  const client = getSupabaseOrThrow();

  const loadAndEmit = async () => {
    const { data, error } = await client
      .from(SESSIONS_TABLE)
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      throw error;
    }

    const sessions = (data || []).map((row) => toCloudTrainingSession(row as SessionRow));
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

  const patch = getRolePatch(role, { ...session, id: sessionId }, saveTimestamp);
  const { error } = await client
    .from(SESSIONS_TABLE)
    .upsert(patch as Record<string, unknown>, { onConflict: 'id' });

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
