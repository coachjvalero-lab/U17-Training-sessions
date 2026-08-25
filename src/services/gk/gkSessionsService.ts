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
  const sessionUid = s.id;
  const recordId = s.id.startsWith('gk-') ? s.id : `gk-${s.id}`;
  const gkWarmUp = s.gk_warm_up || s.warm_up || defaultBlock('warmup-block-gk', 'Warm Up');
  const gkMainPart = s.gk_main_part || s.main_part || defaultBlock('main-block-gk', 'Main Part');
  const gkCoolDown = s.gk_cool_down || s.cool_down || defaultBlock('cooldown-block-gk', 'Cool Down');
  const gkPlayerGroups = s.gk_player_groups || s.player_groups || [];

  return {
    id: recordId,
    sessionUid,
    legacySessionId: s.id,
    teamName: s.team_name || 'U17 Women Al Ula',
    date: s.date || new Date().toISOString().slice(0, 10),
    time: s.time || '18:30 - 20:00',
    sessionNumber: s.session_number || '',
    microcycleDay: s.microcycle_day || 'MD-3',
    mainObjective: s.main_objective || '',
    materialsNeeded: s.materials_needed || '',
    observations: s.observations || '',
    squadRoster: s.squad_roster || [],
    attendance: s.attendance || [],
    gkWarmUp,
    gkMainPart,
    gkCoolDown,
    gkPlayerGroups,
    createdAt: s.gk_updated_at || s.updated_at || Date.now(),
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

  const { error } = await getClient()
    .from('session_catalog')
    .upsert(sessionCatalogPayload, { onConflict: 'session_uid' });

  if (error) {
    console.warn('[gkSessionsService] session_catalog upsert notice:', error);
  }
}

export async function listGkSessions(): Promise<GkSession[]> {
  const client = getClient();
  
  // 1. Read existing rows in gk_sessions
  let gkRows: GkSessionRow[] = [];
  let fetchError: unknown = null;
  try {
    const { data, error } = await client
      .from(GK_SESSIONS_TABLE)
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      fetchError = error;
    } else {
      gkRows = (data || []) as GkSessionRow[];
    }
  } catch (err) {
    fetchError = err;
  }

  let mappedGk = gkRows.map(fromRow);

  // 2. Check for legacy sessions in public.sessions that should be recovered
  try {
    const { data: legacyData, error: legacyErr } = await client
      .from('sessions')
      .select('*')
      .order('updated_at', { ascending: false });

    if (!legacyErr && Array.isArray(legacyData) && legacyData.length > 0) {
      const knownUids = new Set(mappedGk.map((s) => s.sessionUid));
      const knownIds = new Set(mappedGk.map((s) => s.id));

      const missingLegacySessions = legacyData.filter((legacy) => {
        const potentialId = legacy.id.startsWith('gk-') ? legacy.id : `gk-${legacy.id}`;
        return !knownUids.has(legacy.id) && !knownIds.has(potentialId) && !knownIds.has(legacy.id);
      });

      if (missingLegacySessions.length > 0) {
        const recovered = missingLegacySessions.map(fromLegacySessionRow);
        mappedGk = [...mappedGk, ...recovered];

        // Background auto-heal: persist recovered legacy sessions to gk_sessions table
        void Promise.allSettled(
          recovered.map(async (rec) => {
            const updatedAt = rec.updatedAt || Date.now();
            await ensureSessionCatalogIdentity(rec, updatedAt);
            const rowPayload = toRow(rec, updatedAt);
            await client.from(GK_SESSIONS_TABLE).upsert(rowPayload, { onConflict: 'id' });
          })
        ).catch((healErr) => {
          console.warn('[gkSessionsService] Background recovery sync notice:', healErr);
        });
      }
    }
  } catch (legacyCatchErr) {
    console.warn('[gkSessionsService] Legacy sessions query check notice:', legacyCatchErr);
  }

  // If both queries failed or returned nothing, check cache
  if (mappedGk.length === 0) {
    const cached = readCachedGkSessions();
    if (cached.length > 0) {
      return cached;
    }
    // Also check cloud sessions cache if available
    try {
      const cloudRaw = localStorage.getItem('u17_cloud_sessions_cache');
      if (cloudRaw) {
        const cloudParsed = JSON.parse(cloudRaw);
        if (Array.isArray(cloudParsed) && cloudParsed.length > 0) {
          const fromCloudCache = cloudParsed.map(fromLegacySessionRow);
          writeCachedGkSessions(fromCloudCache);
          return fromCloudCache;
        }
      }
    } catch {}
  }

  if (fetchError && mappedGk.length === 0) {
    throw fetchError;
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
  let channel: RealtimeChannel | null = null;
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

      if (active && onError) onError(withErrorKind(error, 'load'));
    }
  };

  void loadAndEmit();

  channel = client
    .channel(createGkRealtimeChannelName())
    .on('postgres_changes', { event: '*', schema: 'public', table: GK_SESSIONS_TABLE }, () => {
      void loadAndEmit();
    })
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR') {
        if (!hasLoadedAtLeastOnce) {
          void loadAndEmit();
        }

        if (onError) {
          onError(withErrorKind(new Error('Supabase realtime channel error for GK sessions'), 'realtime'));
        }
      }
    });

  return () => {
    active = false;
    if (channel) void client.removeChannel(channel);
  };
}

export async function saveGkSession(session: GkSession): Promise<number> {
  const updatedAt = Date.now();
  await ensureSessionCatalogIdentity(session, updatedAt);
  const payload = toRow(session, updatedAt);
  const { error } = await getClient()
    .from(GK_SESSIONS_TABLE)
    .upsert(payload, { onConflict: 'id' });

  if (error) throw error;

  // Update local cache
  const cached = readCachedGkSessions();
  const existingIdx = cached.findIndex((s) => s.id === session.id);
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
  const { error } = await getClient()
    .from(GK_SESSIONS_TABLE)
    .delete()
    .eq('id', gkSessionId);

  if (error) throw error;

  const cached = readCachedGkSessions();
  const remaining = cached.filter((s) => s.id !== gkSessionId);
  writeCachedGkSessions(remaining);
}

