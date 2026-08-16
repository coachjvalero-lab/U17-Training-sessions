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

export async function loginUser(usernameOrEmail: string, pass: string): Promise<AppUser> {
  const client = getSupabaseOrThrow();
  const email = normalizeUserEmail(usernameOrEmail);

  if (!email || !pass) {
    throw new Error('Email/username and password are required.');
  }

  const { data, error } = await client.auth.signInWithPassword({ email, password: pass });
  if (error) throw error;

  const mapped = toAppUser(data.user || null);
  if (!mapped) {
    throw new Error('No authenticated user returned by Supabase.');
  }

  return mapped;
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
  const client = getSupabaseOrThrow();
  const { error } = await client.auth['signOut']();
  if (error) throw error;
}

export function subscribeToAuth(callback: (event: string, user: AppUser | null) => void): () => void {
  const client = getSupabaseOrThrow();

  client.auth.getSession()
    .then(({ data, error }) => {
      if (error) {
        console.error('[subscribeToAuth] initial session read failed', error);
      }
      callback('INITIAL_SESSION', toAppUser(data.session?.user || null));
    })
    .catch((error) => {
      console.error('[subscribeToAuth] initial session read failed', error);
      callback('INITIAL_SESSION', null);
    });

  const { data } = client.auth.onAuthStateChange((event, session) => {
    callback(event, toAppUser(session?.user || null));
  });

  return () => {
    data.subscription.unsubscribe();
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
