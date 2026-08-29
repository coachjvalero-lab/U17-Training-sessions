import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../../supabaseClient';
import { saveSessionFieldsByRoleSupabase } from '../../supabaseSessions';
import type { GkSession, PlayerGroup, TrainingBlock, TrainingSession } from '../../types';
import { getSelectedTeamIdSnapshot, getTeamNameById } from '../permissions/teamSelectionStore';

const GK_SESSIONS_TABLE = 'gk_sessions';
const GK_SESSIONS_CACHE_KEY = 'u17_gk_sessions_cache';
const GK_READ_RETRY_DELAY_MS = 1500;
const GK_MAX_READ_RETRIES = 1;
const DEFAULT_GK_TEAM_NAME = 'U17 Women Al Ula';

export function readCachedGkSessions(): GkSession[] {
  try {
    const raw = localStorage.getItem(GK_SESSIONS_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

export function writeCachedGkSessions(sessions: GkSession[]): void {
  try {
    localStorage.setItem(GK_SESSIONS_CACHE_KEY, JSON.stringify(sessions));
  } catch (e) {
    console.warn('Failed to cache GK sessions:', e);
  }
}

function createGkRealtimeChannelName(): string {
  return `u17-gk-sessions-realtime-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

type GkSessionsErrorKind = 'load' | 'realtime';

type GkSessionsError = Error & {
  kind?: GkSessionsErrorKind;
};

function withErrorKind(error: unknown, kind: GkSessionsErrorKind): GkSessionsError {
  if (error instanceof Error) {
    const typed = error as GkSessionsError;
    typed.kind = kind;
    return typed;
  }

  const fallback = new Error(String(error)) as GkSessionsError;
  fallback.kind = kind;
  return fallback;
}

function isTableNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const withAny = error as { code?: unknown; message?: unknown; details?: unknown; hint?: unknown };
  const code = String(withAny.code || '');
  const message = String(withAny.message || '').toLowerCase();
  const details = String(withAny.details || '').toLowerCase();
  const hint = String(withAny.hint || '').toLowerCase();
  const allText = `${message} ${details} ${hint}`;

  return (
    code === 'PGRST205' ||
    code === 'PGRST204' ||
    code === 'PGRST200' ||
    code === '42P01' ||
    allText.includes('could not find the table') ||
    allText.includes('schema cache') ||
    allText.includes('does not exist') ||
    (allText.includes('relation') && allText.includes('does not exist'))
  );
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

type GkSessionRow = {
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
  attendance: GkSession['attendance'] | null;
  warm_up: TrainingBlock | null;
  main_part: TrainingBlock | null;
  cool_down: TrainingBlock | null;
  player_groups: PlayerGroup[] | null;
  created_at: number | null;
  updated_at: number | null;
};

type SessionCatalogRow = {
  session_uid: string;
  session_number: string;
  session_date: string;
  source_legacy_session_id: string;
  created_at: number;
  updated_at: number;
};

function getClient() {
  if (!supabase) {
    throw new Error('Supabase client is not configured');
  }
  return supabase;
}

function resolveTeamNameForGkWrite(session: { teamName?: string | null }): string {
  const explicitName = (session.teamName || '').trim();
  if (explicitName) return explicitName;

  const selectedTeamId = (getSelectedTeamIdSnapshot() || '').trim();
  const catalogName = selectedTeamId ? (getTeamNameById(selectedTeamId) || '') : '';
  return catalogName || DEFAULT_GK_TEAM_NAME;
}

function defaultBlock(id: string, title: string): TrainingBlock {
  return {
    id,
    title,
    exercises: []
  };
}

function hasExercises(block: any): boolean {
  return Array.isArray(block?.exercises) && block.exercises.length > 0;
}

function fromRow(row: GkSessionRow): GkSession {
  const sessionUid = row.session_uid || row.id;
  return {
    id: row.id,
    sessionUid,
    legacySessionId: row.legacy_session_id || undefined,
    teamName: row.team_name || '',
    date: row.date || new Date().toISOString().slice(0, 10),
    time: row.time || '18:30 - 20:00',
    sessionNumber: row.session_number || '',
    microcycleDay: row.microcycle_day || 'MD-3',
    mainObjective: row.main_objective || '',
    materialsNeeded: row.materials_needed || '',
    observations: row.observations || '',
    squadRoster: row.squad_roster || [],
    attendance: row.attendance || [],
    gkWarmUp: row.warm_up || defaultBlock('warmup-block-gk', 'Warm Up'),
    gkMainPart: row.main_part || defaultBlock('main-block-gk', 'Main Part'),
    gkCoolDown: row.cool_down || defaultBlock('cooldown-block-gk', 'Cool Down'),
    gkPlayerGroups: row.player_groups || [],
    createdAt: row.created_at || Date.now(),
    updatedAt: row.updated_at || 0
  };
}

function fromLegacySessionRow(s: any): GkSession {
  const sessionUid = s.id || `session-${Date.now()}`;
  const recordId = typeof s.id === 'string' && s.id.startsWith('gk-') ? s.id : `gk-${sessionUid}`;

  const gkWarmUp = hasExercises(s.gk_warm_up)
    ? s.gk_warm_up
    : (hasExercises(s.warm_up) ? s.warm_up : (s.gk_warm_up || s.warm_up || defaultBlock('warmup-block-gk', 'Warm Up')));

  const gkMainPart = hasExercises(s.gk_main_part)
    ? s.gk_main_part
    : (hasExercises(s.main_part) ? s.main_part : (s.gk_main_part || s.main_part || defaultBlock('main-block-gk', 'Main Part')));

  const gkCoolDown = hasExercises(s.gk_cool_down)
    ? s.gk_cool_down
    : (hasExercises(s.cool_down) ? s.cool_down : (s.gk_cool_down || s.cool_down || defaultBlock('cooldown-block-gk', 'Cool Down')));

  const gkPlayerGroups = (Array.isArray(s.gk_player_groups) && s.gk_player_groups.length > 0)
    ? s.gk_player_groups
    : (Array.isArray(s.player_groups) ? s.player_groups : []);

  return {
    id: recordId,
    sessionUid,
    legacySessionId: s.id,
    teamName: s.team_name || s.teamName || DEFAULT_GK_TEAM_NAME,
    date: s.date || new Date().toISOString().slice(0, 10),
    time: s.time || '18:30 - 20:00',
    sessionNumber: s.session_number || s.sessionNumber || '',
    microcycleDay: s.microcycle_day || s.microcycleDay || 'MD-3',
    mainObjective: s.main_objective || s.mainObjective || '',
    materialsNeeded: s.materials_needed || s.materialsNeeded || '',
    observations: s.observations || '',
    squadRoster: s.squad_roster || s.squadRoster || [],
    attendance: s.attendance || [],
    gkWarmUp,
    gkMainPart,
    gkCoolDown,
    gkPlayerGroups,
    createdAt: s.gk_updated_at || s.updated_at || s.created_at || Date.now(),
    updatedAt: s.gk_updated_at || s.updated_at || 0
  };
}

function toRow(session: GkSession, updatedAt: number): GkSessionRow {
  const teamName = resolveTeamNameForGkWrite(session);
  return {
    id: session.id,
    session_uid: session.sessionUid,
    legacy_session_id: session.legacySessionId || null,
    team_name: teamName,
    date: session.date,
    time: session.time,
    session_number: session.sessionNumber,
    microcycle_day: session.microcycleDay,
    main_objective: session.mainObjective,
    materials_needed: session.materialsNeeded,
    observations: session.observations || null,
    squad_roster: session.squadRoster || [],
    attendance: session.attendance || [],
    warm_up: session.gkWarmUp,
    main_part: session.gkMainPart,
    cool_down: session.gkCoolDown,
    player_groups: session.gkPlayerGroups || [],
    created_at: session.createdAt || updatedAt,
    updated_at: updatedAt
  };
}

async function ensureSessionCatalogIdentity(session: GkSession, updatedAt: number): Promise<void> {
  const sessionUid = session.sessionUid?.trim();
  if (!sessionUid) {
    throw new Error('Goalkeeper session cannot be saved without a valid session UID.');
  }

  const sessionCatalogPayload: SessionCatalogRow = {
    session_uid: sessionUid,
    session_number: session.sessionNumber || '',
    session_date: session.date,
    source_legacy_session_id: session.legacySessionId || sessionUid,
    created_at: session.createdAt || updatedAt,
    updated_at: updatedAt
  };

  try {
    const { error } = await getClient()
      .from('session_catalog')
      .upsert(sessionCatalogPayload, { onConflict: 'session_uid' });

    if (error && !isTableNotFoundError(error)) {
      console.warn('[gkSessionsService] session_catalog upsert notice:', error);
    }
  } catch (e) {
    // Non-blocking if table is not configured
  }
}

export async function listGkSessions(): Promise<GkSession[]> {
  const client = getClient();
  let gkRows: GkSessionRow[] = [];
  let gkFetchError: unknown = null;
  let hasGkTable = true;

  // 1. Try reading from dedicated gk_sessions table
  try {
    const { data, error } = await client
      .from(GK_SESSIONS_TABLE)
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      if (isTableNotFoundError(error)) {
        hasGkTable = false;
      } else {
        gkFetchError = error;
      }
    } else {
      gkRows = (data || []) as GkSessionRow[];
    }
  } catch (err) {
    if (isTableNotFoundError(err)) {
      hasGkTable = false;
    } else {
      gkFetchError = err;
    }
  }

  let mappedGk = gkRows.map(fromRow);

  // 2. Read from public.sessions table so that existing database sessions are visible
  try {
    const { data: legacyData, error: legacyErr } = await client
      .from('sessions')
      .select('*')
      .order('updated_at', { ascending: false });

    if (!legacyErr && Array.isArray(legacyData) && legacyData.length > 0) {
      const knownUids = new Set(mappedGk.map((s) => s.sessionUid));
      const knownIds = new Set(mappedGk.map((s) => s.id));

      const recovered: GkSession[] = [];
      legacyData.forEach((row) => {
        if (!row || !row.id) return;
        const asGk = fromLegacySessionRow(row);
        if (!knownUids.has(asGk.sessionUid) && !knownIds.has(asGk.id) && !knownIds.has(row.id)) {
          recovered.push(asGk);
          knownUids.add(asGk.sessionUid);
          knownIds.add(asGk.id);
        }
      });

      if (recovered.length > 0) {
        mappedGk = [...mappedGk, ...recovered].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      }
    }
  } catch (legacyCatchErr) {
    console.warn('[gkSessionsService] sessions query fallback notice:', legacyCatchErr);
  }

  // 3. If everything errored or was empty, check local storage cache
  if (mappedGk.length === 0) {
    const fallbackCached = readCachedGkSessions();
    if (fallbackCached.length > 0) {
      return fallbackCached;
    }
  }

  if (gkFetchError && mappedGk.length === 0 && hasGkTable) {
    throw gkFetchError;
  }

  writeCachedGkSessions(mappedGk);
  return mappedGk;
}

export function subscribeToGkSessions(
  callback: (sessions: GkSession[]) => void,
  onError?: (error: unknown) => void
): () => void {
  const client = getClient();
  let active = true;
  let gkChannel: RealtimeChannel | null = null;
  let sessionsChannel: RealtimeChannel | null = null;
  let pollInterval: ReturnType<typeof setInterval> | null = null;
  let hasLoadedAtLeastOnce = false;

  // Emit cached immediately to avoid blank flash
  const initialCached = readCachedGkSessions();
  if (initialCached.length > 0) {
    callback(initialCached);
  }

  const loadAndEmit = async (attempt = 0) => {
    try {
      const sessions = await listGkSessions();
      if (active) {
        hasLoadedAtLeastOnce = true;
        callback(sessions);
      }
    } catch (error) {
      if (
        active
        && attempt < GK_MAX_READ_RETRIES
        && isTransientReadError(error)
      ) {
        setTimeout(() => {
          if (!active) return;
          void loadAndEmit(attempt + 1);
        }, GK_READ_RETRY_DELAY_MS);
        return;
      }

      if (active && onError && !isTableNotFoundError(error)) {
        onError(withErrorKind(error, 'load'));
      }
    }
  };

  void loadAndEmit();

  // Periodic poll fallback (every 25s)
  pollInterval = setInterval(() => {
    if (active) {
      void loadAndEmit();
    }
  }, 25000);

  try {
    gkChannel = client
      .channel(createGkRealtimeChannelName())
      .on('postgres_changes', { event: '*', schema: 'public', table: GK_SESSIONS_TABLE }, () => {
        void loadAndEmit();
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          if (!hasLoadedAtLeastOnce) {
            void loadAndEmit();
          }
        }
      });
  } catch (err) {
    console.warn('[gkSessionsService] Realtime gk_sessions channel notice:', err);
  }

  try {
    sessionsChannel = client
      .channel(`u17-gk-legacy-sessions-realtime-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, () => {
        void loadAndEmit();
      })
      .subscribe();
  } catch (err) {
    console.warn('[gkSessionsService] Realtime sessions channel notice:', err);
  }

  return () => {
    active = false;
    if (pollInterval) clearInterval(pollInterval);
    if (gkChannel) void client.removeChannel(gkChannel);
    if (sessionsChannel) void client.removeChannel(sessionsChannel);
  };
}

export async function saveGkSession(session: GkSession): Promise<number> {
  const client = getClient();
  const updatedAt = Date.now();

  let savedSuccessfully = false;

  // 1. Try to save to gk_sessions table and session_catalog
  try {
    await ensureSessionCatalogIdentity(session, updatedAt);
    const payload = toRow(session, updatedAt);
    const { error } = await client
      .from(GK_SESSIONS_TABLE)
      .upsert(payload, { onConflict: 'id' });

    if (!error) {
      savedSuccessfully = true;
    } else if (!isTableNotFoundError(error)) {
      throw error;
    }
  } catch (tableErr) {
    if (!isTableNotFoundError(tableErr)) {
      throw tableErr;
    }
  }

  // 2. If gk_sessions table does not exist, save GK fields to public.sessions table independently
  if (!savedSuccessfully) {
    const rawSessionUid = session.sessionUid || (session.id.startsWith('gk-') ? session.id.slice(3) : session.id);
    const trainingSessionEquivalent: TrainingSession = {
      id: rawSessionUid,
      teamName: session.teamName,
      date: session.date,
      time: session.time,
      sessionNumber: session.sessionNumber,
      microcycleDay: session.microcycleDay,
      mainObjective: session.mainObjective,
      materialsNeeded: session.materialsNeeded,
      observations: session.observations,
      squadRoster: session.squadRoster || [],
      attendance: session.attendance || [],
      warmUp: defaultBlock('warmup-block', 'Warm Up'),
      mainPart: defaultBlock('main-block', 'Main Part'),
      coolDown: defaultBlock('cooldown-block', 'Cool Down'),
      playerGroups: [],
      gkWarmUp: session.gkWarmUp,
      gkMainPart: session.gkMainPart,
      gkCoolDown: session.gkCoolDown,
      gkPlayerGroups: session.gkPlayerGroups || []
    };

    await saveSessionFieldsByRoleSupabase(rawSessionUid, 'gk', trainingSessionEquivalent);
  }

  // Update local cache
  const cached = readCachedGkSessions();
  const existingIdx = cached.findIndex((s) => s.id === session.id || s.sessionUid === session.sessionUid);
  const updatedSession = { ...session, updatedAt };
  if (existingIdx >= 0) {
    cached[existingIdx] = updatedSession;
  } else {
    cached.unshift(updatedSession);
  }
  writeCachedGkSessions(cached);

  return updatedAt;
}

export async function deleteGkSession(gkSessionId: string): Promise<void> {
  const client = getClient();
  let deletedFromGkTable = false;

  try {
    const { error } = await client
      .from(GK_SESSIONS_TABLE)
      .delete()
      .eq('id', gkSessionId);

    if (!error) {
      deletedFromGkTable = true;
    } else if (!isTableNotFoundError(error)) {
      throw error;
    }
  } catch (err) {
    if (!isTableNotFoundError(err)) throw err;
  }

  // If not deleted from gk_sessions or table not found, also delete from sessions table
  if (!deletedFromGkTable) {
    const rawSessionUid = gkSessionId.startsWith('gk-') ? gkSessionId.slice(3) : gkSessionId;
    try {
      await client.from('sessions').delete().eq('id', rawSessionUid);
    } catch (e) {
      console.warn('[gkSessionsService] Delete legacy session fallback notice:', e);
    }
  }

  const cached = readCachedGkSessions();
  const remaining = cached.filter((s) => s.id !== gkSessionId && s.sessionUid !== gkSessionId);
  writeCachedGkSessions(remaining);
}


