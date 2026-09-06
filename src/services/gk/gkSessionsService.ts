import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../../supabaseClient';
import type { GkSession, PlayerGroup, TrainingBlock } from '../../types';
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
  const withAny = error as { code?: unknown; message?: unknown; details?: unknown; hint?: unknown; status?: unknown };
  const code = String(withAny.code || '');
  const status = typeof withAny.status === 'number' ? withAny.status : null;
  const message = String(withAny.message || '').toLowerCase();
  const details = String(withAny.details || '').toLowerCase();
  const hint = String(withAny.hint || '').toLowerCase();
  const allText = `${message} ${details} ${hint}`;

  return (
    code === 'PGRST205' ||
    code === 'PGRST204' ||
    code === 'PGRST200' ||
    code === '42P01' ||
    code === '42501' ||
    status === 401 ||
    status === 403 ||
    allText.includes('could not find the table') ||
    allText.includes('schema cache') ||
    allText.includes('does not exist') ||
    allText.includes('permission denied') ||
    allText.includes('row-level security') ||
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

export async function listGkSessions(): Promise<GkSession[]> {
  const client = getClient();
  let rows: GkSessionRow[] = [];
  let fetchError: unknown = null;

  // Canonical GK session source: the dedicated public.gk_sessions table only.
  try {
    const { data, error } = await client
      .from(GK_SESSIONS_TABLE)
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      fetchError = error;
    } else {
      rows = (data || []) as GkSessionRow[];
    }
  } catch (err) {
    fetchError = err;
  }

  const mapped = rows.map(fromRow);

  // If the read errored and returned nothing, fall back to the local cache
  // so existing GK sessions remain visible during a transient outage.
  if (mapped.length === 0) {
    const fallbackCached = readCachedGkSessions();
    if (fallbackCached.length > 0) {
      return fallbackCached;
    }
  }

  if (fetchError && mapped.length === 0) {
    throw fetchError;
  }

  writeCachedGkSessions(mapped);
  return mapped;
}

export function subscribeToGkSessions(
  callback: (sessions: GkSession[]) => void,
  onError?: (error: unknown) => void
): () => void {
  const client = getClient();
  let active = true;
  let gkChannel: RealtimeChannel | null = null;
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

      if (active && onError) {
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

  return () => {
    active = false;
    if (pollInterval) clearInterval(pollInterval);
    if (gkChannel) void client.removeChannel(gkChannel);
  };
}

export async function saveGkSession(session: GkSession): Promise<number> {
  const updatedAt = Date.now();

  const normalizedSessionUid = (session.sessionUid || (session.id?.startsWith('gk-') ? session.id.slice(3) : session.id) || `session-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`).trim();
  const normalizedId = session.id?.startsWith('gk-') ? session.id : `gk-${normalizedSessionUid}`;
  const completeSession: GkSession = {
    ...session,
    id: normalizedId,
    sessionUid: normalizedSessionUid,
    legacySessionId: session.legacySessionId || normalizedSessionUid,
    updatedAt
  };

  // Single canonical write path: insert/update the public.gk_sessions row only.
  // The deployed gk_sessions table has no session_catalog dependency, so no
  // catalog identity row is required. Errors propagate so the UI can surface
  // the real failure and keep form state.
  const payload = toRow(completeSession, updatedAt);
  const { error } = await getClient()
    .from(GK_SESSIONS_TABLE)
    .upsert(payload, { onConflict: 'id' });

  if (error) throw error;

  const cached = readCachedGkSessions();
  const existingIdx = cached.findIndex((s) => s.id === completeSession.id || s.sessionUid === completeSession.sessionUid);
  if (existingIdx >= 0) {
    cached[existingIdx] = completeSession;
  } else {
    cached.unshift(completeSession);
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
      console.warn('[gkSessionsService] Delete gk_sessions notice:', error);
    }
  } catch (err) {
    if (!isTableNotFoundError(err)) {
      console.warn('[gkSessionsService] Delete gk_sessions catch notice:', err);
    }
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



