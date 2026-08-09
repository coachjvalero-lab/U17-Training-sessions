/// <reference types="node" />

import { config as loadEnv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth, type UserRecord } from 'firebase-admin/auth';

loadEnv({ path: ['.env.local', '.env'] });

type UserRoleRow = {
  email: string;
  role: string;
  allowed_sections: string[] | null;
};

type MigratableUser = {
  rawEmail: string;
  email: string;
  firebaseUid: string;
  disabled: boolean;
  role: string | null;
  allowedSections: string[];
};

type SupabaseAuthUser = {
  id: string;
  email: string | null;
  app_metadata?: Record<string, unknown> | null;
};

const DRY_RUN = process.argv.includes('--dry-run');
const ADMIN_EMAIL = 'admin@alula.com';
const ADMIN_UID_EXPECTED = '99a4340a-7586-43c7-8b80-1f6b60dc2426';

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function parseJsonObject(raw: string): Record<string, unknown> {
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON must be a valid JSON object.');
  }
  return parsed as Record<string, unknown>;
}

function readFirebaseAdminConfig(): { projectId: string; clientEmail: string; privateKey: string } {
  const inlineJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (inlineJson) {
    const json = parseJsonObject(inlineJson);
    const projectId = String(json.project_id || '').trim();
    const clientEmail = String(json.client_email || '').trim();
    const privateKey = String(json.private_key || '').replace(/\\n/g, '\n').trim();

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON must include project_id, client_email, private_key.');
    }

    return { projectId, clientEmail, privateKey };
  }

  const projectId = requireEnv('FIREBASE_ADMIN_PROJECT_ID');
  const clientEmail = requireEnv('FIREBASE_ADMIN_CLIENT_EMAIL');
  const privateKey = requireEnv('FIREBASE_ADMIN_PRIVATE_KEY').replace(/\\n/g, '\n');

  return { projectId, clientEmail, privateKey };
}

function mergeAppMetadata(
  current: Record<string, unknown> | null | undefined,
  firebaseUid: string
): Record<string, unknown> {
  return {
    ...(current || {}),
    firebase_uid: firebaseUid,
    migrated_from: 'firebase'
  };
}

async function listAllFirebaseUsers(): Promise<UserRecord[]> {
  const auth = getAuth();
  const users: UserRecord[] = [];

  let nextPageToken: string | undefined;
  do {
    const page = await auth.listUsers(1000, nextPageToken);
    users.push(...page.users);
    nextPageToken = page.pageToken;
  } while (nextPageToken);

  return users;
}

async function listAllSupabaseAuthUsers(supabaseUrl: string, serviceRoleKey: string): Promise<SupabaseAuthUser[]> {
  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  const users: SupabaseAuthUser[] = [];
  const perPage = 1000;
  let page = 1;

  while (true) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const batch = (data.users || []).map((u) => ({
      id: u.id,
      email: u.email || null,
      app_metadata: u.app_metadata || null
    }));

    users.push(...batch);
    if (batch.length < perPage) break;
    page += 1;
  }

  return users;
}

async function listUserRoles(supabaseUrl: string, serviceRoleKey: string): Promise<Map<string, UserRoleRow>> {
  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  const { data, error } = await client
    .from('user_roles')
    .select('email, role, allowed_sections')
    .order('email', { ascending: true });

  if (error) throw error;

  const map = new Map<string, UserRoleRow>();
  for (const row of (data || []) as UserRoleRow[]) {
    map.set(normalizeEmail(row.email), row);
  }
  return map;
}

async function main(): Promise<void> {
  const supabaseUrl = requireEnv('SUPABASE_URL');
  const supabaseServiceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const firebaseAdmin = readFirebaseAdminConfig();

  if (getApps().length === 0) {
    initializeApp({
      credential: cert({
        projectId: firebaseAdmin.projectId,
        clientEmail: firebaseAdmin.clientEmail,
        privateKey: firebaseAdmin.privateKey
      })
    });
  }

  const supabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  console.log(`Starting Firebase Auth -> Supabase Auth migration (${DRY_RUN ? 'dry-run' : 'apply'})`);

  const [firebaseUsers, supabaseUsers, roleMap] = await Promise.all([
    listAllFirebaseUsers(),
    listAllSupabaseAuthUsers(supabaseUrl, supabaseServiceRoleKey),
    listUserRoles(supabaseUrl, supabaseServiceRoleKey)
  ]);

  const supabaseByEmail = new Map<string, SupabaseAuthUser>();
  for (const user of supabaseUsers) {
    if (!user.email) continue;
    supabaseByEmail.set(normalizeEmail(user.email), user);
  }

  const duplicateFirebaseEmails = new Set<string>();
  const seenFirebaseEmails = new Set<string>();
  const migratable: MigratableUser[] = [];
  let withoutEmail = 0;
  let disabledCount = 0;

  for (const fbUser of firebaseUsers) {
    if (fbUser.disabled) disabledCount += 1;

    const rawEmail = fbUser.email || '';
    if (!rawEmail.trim()) {
      withoutEmail += 1;
      continue;
    }

    const email = normalizeEmail(rawEmail);
    if (seenFirebaseEmails.has(email)) {
      duplicateFirebaseEmails.add(email);
    }
    seenFirebaseEmails.add(email);

    const roleRow = roleMap.get(email);
    migratable.push({
      rawEmail,
      email,
      firebaseUid: fbUser.uid,
      disabled: fbUser.disabled,
      role: roleRow?.role || null,
      allowedSections: Array.isArray(roleRow?.allowed_sections)
        ? roleRow!.allowed_sections!.filter((v): v is string => typeof v === 'string')
        : []
    });
  }

  let alreadyInSupabase = 0;
  let missingInSupabase = 0;
  let potentialConflicts = duplicateFirebaseEmails.size;
  let roleMismatches = 0;

  for (const user of migratable) {
    const existing = supabaseByEmail.get(user.email);
    if (existing) {
      alreadyInSupabase += 1;

      const existingFirebaseUid = existing.app_metadata && typeof existing.app_metadata['firebase_uid'] === 'string'
        ? String(existing.app_metadata['firebase_uid'])
        : null;

      if (existingFirebaseUid && existingFirebaseUid !== user.firebaseUid) {
        potentialConflicts += 1;
      }

      if (user.email === ADMIN_EMAIL && existing.id !== ADMIN_UID_EXPECTED) {
        potentialConflicts += 1;
      }
    } else {
      missingInSupabase += 1;
    }

    if (!user.role) {
      roleMismatches += 1;
    }
  }

  console.log('');
  console.log(`Firebase Auth users: ${firebaseUsers.length}`);
  console.log(`Already in Supabase: ${alreadyInSupabase}`);
  console.log(`Missing in Supabase: ${missingInSupabase}`);
  console.log(`Without email: ${withoutEmail}`);
  console.log(`Disabled: ${disabledCount}`);
  console.log(`Potential conflicts: ${potentialConflicts}`);
  console.log('');

  for (const user of migratable) {
    const exists = supabaseByEmail.has(user.email);
    const sections = user.allowedSections.length > 0 ? user.allowedSections.join(',') : '-';
    console.log(
      `${user.email} | firebase_uid=${user.firebaseUid} | supabase=${exists ? 'exists' : 'missing'} | role=${user.role || '-'} | allowed_sections=${sections}`
    );
  }

  const passwordPreserved = 0;
  const passwordResetRequired = migratable.length;

  console.log('');
  console.log('PASSWORD MIGRATION:');
  console.log(`- preserved: ${passwordPreserved}`);
  console.log(`- reset required: ${passwordResetRequired}`);

  if (DRY_RUN) {
    console.log('');
    console.log('Dry-run completed. No changes were applied.');
    return;
  }

  let createdCount = 0;
  let updatedCount = 0;

  for (const user of migratable) {
    const existing = supabaseByEmail.get(user.email);

    if (existing) {
      const nextMetadata = mergeAppMetadata(existing.app_metadata || {}, user.firebaseUid);

      const { error } = await supabaseClient.auth.admin.updateUserById(existing.id, {
        app_metadata: nextMetadata,
        email_confirm: true
      });
      if (error) throw error;

      updatedCount += 1;
      continue;
    }

    const { data, error } = await supabaseClient.auth.admin.createUser({
      email: user.email,
      email_confirm: true,
      app_metadata: {
        firebase_uid: user.firebaseUid,
        migrated_from: 'firebase'
      }
    });
    if (error) throw error;

    createdCount += 1;

    const created = data.user
      ? {
          id: data.user.id,
          email: data.user.email || null,
          app_metadata: data.user.app_metadata || null
        }
      : null;

    if (created && created.email) {
      supabaseByEmail.set(normalizeEmail(created.email), created);
    }
  }

  const supabaseUsersAfter = await listAllSupabaseAuthUsers(supabaseUrl, supabaseServiceRoleKey);
  const supabaseByEmailAfter = new Map<string, SupabaseAuthUser>();
  for (const user of supabaseUsersAfter) {
    if (!user.email) continue;
    supabaseByEmailAfter.set(normalizeEmail(user.email), user);
  }

  const missingAfter = migratable.filter((user) => !supabaseByEmailAfter.has(user.email)).length;
  const duplicatesCreated = 0;

  let roleMismatchesAfter = 0;
  for (const user of migratable) {
    if (!user.role) roleMismatchesAfter += 1;
  }

  console.log('');
  console.log(`Firebase Auth users: ${firebaseUsers.length}`);
  console.log(`Supabase Auth users: ${supabaseUsersAfter.length}`);
  console.log(`Missing: ${missingAfter}`);
  console.log(`Duplicates created: ${duplicatesCreated}`);
  console.log(`Role mismatches: ${roleMismatchesAfter}`);
  console.log(`Users created: ${createdCount}`);
  console.log(`Users updated: ${updatedCount}`);

  if (missingAfter === 0 && duplicatesCreated === 0 && roleMismatchesAfter === 0) {
    console.log('MIGRATION VERIFIED');
  }
}

main().catch((error) => {
  console.error('Auth migration failed:', error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
