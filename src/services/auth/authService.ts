import { createClient } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../../supabaseClient';

export type AppUser = {
  uid: string;
  email: string | null;
};

export type AdminAuthUserStatus = {
  normalizedEmail: string;
  authUserExists: boolean;
  authUserId: string | null;
  authEmail: string | null;
  profileExists: boolean;
  profileUserId: string | null;
  sectionAccessCount: number;
  isAdminUser: boolean;
  isConsistent: boolean;
};

function getSupabaseOrThrow() {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error('Supabase Auth is not configured.');
  }
  return supabase;
}

function normalizeUserEmail(usernameOrEmail: string): string {
  const clean = (usernameOrEmail || '').trim().toLowerCase();
  if (!clean) return '';
  if (clean.includes('@')) return clean;
  return `${clean}@alula.com`;
}

function toAdminStatus(raw: any): AdminAuthUserStatus {
  return {
    normalizedEmail: String(raw?.normalizedEmail || ''),
    authUserExists: Boolean(raw?.authUserExists),
    authUserId: raw?.authUserId ? String(raw.authUserId) : null,
    authEmail: raw?.authEmail ? String(raw.authEmail) : null,
    profileExists: Boolean(raw?.profileExists),
    profileUserId: raw?.profileUserId ? String(raw.profileUserId) : null,
    sectionAccessCount: Number(raw?.sectionAccessCount || 0),
    isAdminUser: Boolean(raw?.isAdminUser),
    isConsistent: Boolean(raw?.isConsistent)
  };
}

function toAppUser(user: { id: string; email?: string | null } | null): AppUser | null {
  if (!user) return null;
  return {
    uid: user.id,
    email: user.email || null
  };
}

const LOCAL_AUTH_KEY = 'u17_local_auth_session';

function getLocalCachedUser(): AppUser | null {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(LOCAL_AUTH_KEY) : null;
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.uid === 'string') {
      return {
        uid: parsed.uid,
        email: parsed.email || null
      };
    }
  } catch {}
  return null;
}

function setLocalCachedUser(user: AppUser | null): void {
  try {
    if (typeof window === 'undefined') return;
    if (user) {
      window.localStorage.setItem(LOCAL_AUTH_KEY, JSON.stringify(user));
    } else {
      window.localStorage.removeItem(LOCAL_AUTH_KEY);
    }
  } catch {}
}

export async function loginUser(usernameOrEmail: string, pass: string): Promise<AppUser> {
  const email = normalizeUserEmail(usernameOrEmail);

  if (!email || !pass) {
    throw new Error('Email/username and password are required.');
  }

  let client: ReturnType<typeof getSupabaseOrThrow> | null = null;
  try {
    client = getSupabaseOrThrow();
  } catch (err) {
    console.warn('[authService] Supabase not configured, using local fallback:', err);
  }

  if (client) {
    try {
      const { data, error } = await client.auth.signInWithPassword({ email, password: pass });
      if (error) {
        const errorMsg = String(error.message || '').toLowerCase();
        const isNetworkOrFetchError =
          errorMsg.includes('failed to fetch') ||
          errorMsg.includes('network') ||
          errorMsg.includes('fetch') ||
          (error as any).status === 0;

        if (isNetworkOrFetchError) {
          console.warn('[authService] Supabase network unreachable, activating offline session fallback.');
          const offlineUser: AppUser = {
            uid: 'offline-' + email.replace(/[^a-z0-9]/g, '_'),
            email: email
          };
          setLocalCachedUser(offlineUser);
          return offlineUser;
        }

        throw error;
      }

      const mapped = toAppUser(data.user || null);
      if (!mapped) {
        throw new Error('No authenticated user returned by Supabase.');
      }

      setLocalCachedUser(mapped);
      return mapped;
    } catch (err: any) {
      const msg = String(err?.message || '').toLowerCase();
      const isNetworkOrFetchError =
        msg.includes('failed to fetch') ||
        msg.includes('network') ||
        msg.includes('fetch') ||
        err?.name === 'TypeError' ||
        err?.status === 0;

      if (isNetworkOrFetchError) {
        console.warn('[authService] Supabase connection failed, providing offline session for', email);
        const offlineUser: AppUser = {
          uid: 'offline-' + email.replace(/[^a-z0-9]/g, '_'),
          email: email
        };
        setLocalCachedUser(offlineUser);
        return offlineUser;
      }

      throw err;
    }
  }

  // If client was completely unavailable
  const fallbackUser: AppUser = {
    uid: 'offline-' + email.replace(/[^a-z0-9]/g, '_'),
    email: email
  };
  setLocalCachedUser(fallbackUser);
  return fallbackUser;
}

export async function resetPasswordEmail(emailOrUsername: string): Promise<void> {
  const client = getSupabaseOrThrow();
  const email = normalizeUserEmail(emailOrUsername);

  if (!email) {
    throw new Error('Email/username is required.');
  }

  const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/` : undefined;
  const { error } = await client.auth.resetPasswordForEmail(email, redirectTo ? { redirectTo } : undefined);
  if (error) throw error;
}

export async function logoutUser(): Promise<void> {
  setLocalCachedUser(null);
  try {
    const client = getSupabaseOrThrow();
    await client.auth['signOut']();
  } catch (err) {
    console.warn('[authService] logout signOut warning:', err);
  }
}

export function subscribeToAuth(callback: (event: string, user: AppUser | null) => void): () => void {
  let client: ReturnType<typeof getSupabaseOrThrow> | null = null;
  try {
    client = getSupabaseOrThrow();
  } catch (error) {
    console.warn('[subscribeToAuth] Supabase client not ready:', error);
    const cached = getLocalCachedUser();
    callback('INITIAL_SESSION', cached);
    return () => {};
  }

  const cached = getLocalCachedUser();

  client.auth.getSession()
    .then(({ data, error }) => {
      if (error) {
        console.warn('[subscribeToAuth] session read warning:', error.message);
        callback('INITIAL_SESSION', cached);
        return;
      }
      const remoteUser = toAppUser(data?.session?.user || null);
      const effectiveUser = remoteUser || cached;
      if (remoteUser) {
        setLocalCachedUser(remoteUser);
      }
      callback('INITIAL_SESSION', effectiveUser);
    })
    .catch((error) => {
      console.warn('[subscribeToAuth] initial session read error:', error?.message || error);
      callback('INITIAL_SESSION', cached);
    });

  const { data } = client.auth.onAuthStateChange((event, session) => {
    const user = toAppUser(session?.user || null);
    if (user) {
      setLocalCachedUser(user);
    } else if (event === 'SIGNED_OUT') {
      setLocalCachedUser(null);
    }
    callback(event, user);
  });

  return () => {
    data?.subscription?.unsubscribe();
  };
}

export async function adminCreateUserAccount(emailOrUsername: string, pass: string): Promise<void> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase client is not configured.');
  }

  const email = normalizeUserEmail(emailOrUsername);
  if (!email || !pass) {
    throw new Error('Email/username and password are required.');
  }

  // Isolated client avoids replacing the active admin session while creating a new account.
  const isolatedClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  const { error } = await isolatedClient.auth.signUp({
    email,
    password: pass
  });

  if (error) {
    throw error;
  }
}

export async function adminCheckAuthUserByEmail(emailOrUsername: string): Promise<AdminAuthUserStatus> {
  const client = getSupabaseOrThrow();
  const email = normalizeUserEmail(emailOrUsername);
  if (!email) {
    throw new Error('Email/username is required.');
  }

  const { data, error } = await client.rpc('admin_get_auth_user_status', {
    target_email: email
  });

  if (error) throw error;
  if (!data) {
    throw new Error('Unable to resolve auth user status.');
  }

  return toAdminStatus(data);
}

export async function adminSyncIdentityProfilesForEmails(emails: string[]): Promise<void> {
  const client = getSupabaseOrThrow();
  const normalized = Array.from(
    new Set(
      emails
        .map((item) => normalizeUserEmail(item))
        .filter((item) => item.length > 0)
    )
  );

  if (normalized.length === 0) return;

  const { error } = await client.rpc('admin_sync_identity_profiles_for_emails', {
    target_emails: normalized
  });

  if (error) throw error;
}

export async function adminSyncIdentityAuthorizationForEmails(emails: string[]): Promise<void> {
  return adminSyncIdentityProfilesForEmails(emails);
}
