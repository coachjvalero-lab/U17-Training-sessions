/// <reference types="node" />

import { config as loadEnv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

loadEnv({ path: ['.env.local', '.env'] });

type AuthUserLite = {
  id: string;
  email: string | null;
  user_metadata?: Record<string, unknown> | null;
};

type UserProfileRow = {
  user_id: string;
  email: string;
  display_name: string | null;
  is_active: boolean;
};

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getSupabaseUrl(): string {
  return process.env.SUPABASE_URL?.trim() || process.env.VITE_SUPABASE_URL?.trim() || requireEnv('SUPABASE_URL');
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function deriveDisplayName(email: string, metadata?: Record<string, unknown> | null): string {
  const displayName = typeof metadata?.display_name === 'string' ? metadata.display_name.trim() : '';
  if (displayName) return displayName;

  const fullName = typeof metadata?.full_name === 'string' ? metadata.full_name.trim() : '';
  if (fullName) return fullName;

  const name = typeof metadata?.name === 'string' ? metadata.name.trim() : '';
  if (name) return name;

  return email.split('@')[0];
}

async function listAllAuthUsers(supabaseUrl: string, serviceRoleKey: string): Promise<AuthUserLite[]> {
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const users: AuthUserLite[] = [];
  const perPage = 1000;
  let page = 1;

  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const batch = (data.users || []).map((user) => ({
      id: user.id,
      email: user.email || null,
      user_metadata: user.user_metadata || null
    }));

    users.push(...batch);
    if (batch.length < perPage) break;
    page += 1;
  }

  return users;
}

async function main(): Promise<void> {
  const supabaseUrl = getSupabaseUrl();
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const authUsers = await listAllAuthUsers(supabaseUrl, serviceRoleKey);
  const authUsersWithEmail = authUsers.filter((user) => typeof user.email === 'string' && user.email.trim().length > 0);

  const { data: profilesBefore, error: profilesBeforeError, count: countBefore } = await adminClient
    .from('user_profiles')
    .select('user_id, email, display_name, is_active', { count: 'exact' });

  if (profilesBeforeError) throw profilesBeforeError;

  const byUserId = new Map<string, UserProfileRow>();
  const byEmail = new Map<string, UserProfileRow>();
  for (const profile of (profilesBefore || []) as UserProfileRow[]) {
    byUserId.set(profile.user_id, profile);
    byEmail.set(normalizeEmail(profile.email), profile);
  }

  const rowsToUpsert: UserProfileRow[] = [];
  const emailConflicts: Array<{ email: string; profileUserId: string; authUserId: string }> = [];

  for (const user of authUsersWithEmail) {
    const email = normalizeEmail(user.email as string);
    const displayName = deriveDisplayName(email, user.user_metadata);
    const existingById = byUserId.get(user.id);
    const existingByEmail = byEmail.get(email);

    if (!existingById && existingByEmail && existingByEmail.user_id !== user.id) {
      emailConflicts.push({
        email,
        profileUserId: existingByEmail.user_id,
        authUserId: user.id
      });
      continue;
    }

    rowsToUpsert.push({
      user_id: user.id,
      email,
      display_name: displayName,
      is_active: true
    });
  }

  if (rowsToUpsert.length > 0) {
    const { error: upsertError } = await adminClient
      .from('user_profiles')
      .upsert(rowsToUpsert, { onConflict: 'user_id' });

    if (upsertError) throw upsertError;
  }

  const { count: countAfter, error: countAfterError } = await adminClient
    .from('user_profiles')
    .select('user_id', { count: 'exact', head: true });

  if (countAfterError) throw countAfterError;

  console.log('Backfill user_profiles from auth.users completed');
  console.log(`Auth users total: ${authUsers.length}`);
  console.log(`Auth users with email: ${authUsersWithEmail.length}`);
  console.log(`user_profiles before: ${countBefore ?? 0}`);
  console.log(`user_profiles after: ${countAfter ?? 0}`);
  console.log(`Rows upserted: ${rowsToUpsert.length}`);
  console.log(`Conflicts skipped: ${emailConflicts.length}`);

  if (emailConflicts.length > 0) {
    console.log('Conflicts (same email mapped to different user_id):');
    for (const conflict of emailConflicts) {
      console.log(`- ${conflict.email} profile_user_id=${conflict.profileUserId} auth_user_id=${conflict.authUserId}`);
    }
  }

  const authEmailSet = new Set(authUsersWithEmail.map((user) => normalizeEmail(user.email as string)));
  const { data: profilesAfterData, error: profilesAfterError } = await adminClient
    .from('user_profiles')
    .select('email')
    .order('email', { ascending: true });

  if (profilesAfterError) throw profilesAfterError;

  const profileEmails = ((profilesAfterData || []) as Array<{ email: string }>).map((row) => normalizeEmail(row.email));
  const profileOnly = profileEmails.filter((email) => !authEmailSet.has(email));

  console.log(`Profiles not present in auth.users: ${profileOnly.length}`);
  if (profileOnly.length > 0) {
    for (const email of profileOnly) {
      console.log(`- ${email}`);
    }
  }
}

main().catch((error) => {
  console.error('Backfill failed:', error);
  process.exit(1);
});
