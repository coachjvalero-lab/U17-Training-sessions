/// <reference types="node" />

import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

loadEnv({ path: ['.env.local', '.env'] });

type FirestoreDoc = { id: string; data: Record<string, any> };

type Domain =
  | 'squad'
  | 'attendance'
  | 'exercises'
  | 'exercise-deleted-ids'
  | 'fixtures'
  | 'video'
  | 'physio'
  | 'team-logo'
  | 'session-cards'
  | 'permissions';

const ALLOWED_DOMAINS: Domain[] = [
  'squad',
  'attendance',
  'exercises',
  'exercise-deleted-ids',
  'fixtures',
  'video',
  'physio',
  'team-logo',
  'session-cards',
  'permissions'
];

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function requireSupabaseUrl(): string {
  const value = process.env.VITE_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim();
  if (!value) {
    throw new Error('Missing required environment variable: VITE_SUPABASE_URL or SUPABASE_URL');
  }
  return value;
}

function parseJsonObject(raw: string): Record<string, unknown> {
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON must be a JSON object.');
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
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON must include project_id, client_email, and private_key.');
    }

    return { projectId, clientEmail, privateKey };
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.trim().replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Missing Firebase Admin credentials. Provide FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_ADMIN_* vars.');
  }

  return { projectId, clientEmail, privateKey };
}

function readFirebaseDatabaseId(): string {
  const explicit = process.env.VITE_FIREBASE_DATABASE_ID?.trim();
  if (explicit) {
    return explicit === 'default' ? '(default)' : explicit;
  }

  const configPath = resolve(process.cwd(), 'firebase-applet-config.json');
  try {
    const raw = readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(raw) as { firestoreDatabaseId?: string };
    const fromConfig = parsed.firestoreDatabaseId?.trim();
    if (fromConfig) {
      return fromConfig === 'default' ? '(default)' : fromConfig;
    }
  } catch {
    // Fall through to default database when the local config file is absent.
  }

  return '(default)';
}

function normalizeFirestoreDatabaseId(raw: string | undefined): string {
  const value = raw?.trim();
  if (!value || value === 'default') {
    return '(default)';
  }
  return value;
}

function parseDomain(raw: string | undefined): Domain {
  const value = (raw || '').trim().toLowerCase() as Domain;
  if (!ALLOWED_DOMAINS.includes(value)) {
    throw new Error(`Invalid domain. Use one of: ${ALLOWED_DOMAINS.join(', ')}`);
  }
  return value;
}

const domain = parseDomain(process.argv[2]);
const supabaseServiceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
const supabaseUrl = requireSupabaseUrl();

const firebaseAdminConfig = readFirebaseAdminConfig();
let firebaseAdminApp = getApps()[0];

if (!firebaseAdminApp) {
  firebaseAdminApp = initializeApp({
    credential: cert({
      projectId: firebaseAdminConfig.projectId,
      clientEmail: firebaseAdminConfig.clientEmail,
      privateKey: firebaseAdminConfig.privateKey
    })
  });
}

const firebaseDatabaseId = normalizeFirestoreDatabaseId(readFirebaseDatabaseId());
const firebaseDb = getFirestore(firebaseAdminApp, firebaseDatabaseId);
const firebaseDefaultDb = getFirestore(firebaseAdminApp, '(default)');

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function readCollection(database: Firestore, name: string): Promise<FirestoreDoc[]> {
  const snapshot = await database.collection(name).get();
  return snapshot.docs.map((item) => ({ id: item.id, data: item.data() as Record<string, any> }));
}

async function readCollectionWithFallback(name: string): Promise<FirestoreDoc[]> {
  const primary = await readCollection(firebaseDb, name);
  if (primary.length > 0 || firebaseDatabaseId === '(default)') {
    return primary;
  }
  try {
    return await readCollection(firebaseDefaultDb, name);
  } catch (error) {
    if ((error as { code?: unknown }).code === 5) {
      return [];
    }
    throw error;
  }
}

async function readDocWithFallback(collectionName: string, id: string): Promise<Record<string, any> | null> {
  const primary = await readCollection(firebaseDb, collectionName);
  const primaryMatch = primary.find((item) => item.id === id);
  if (primaryMatch) {
    return primaryMatch.data;
  }

  if (firebaseDatabaseId !== '(default)') {
    try {
      const fallback = await readCollection(firebaseDefaultDb, collectionName);
      const fallbackMatch = fallback.find((item) => item.id === id);
      if (fallbackMatch) {
        return fallbackMatch.data;
      }
    } catch (error) {
      if ((error as { code?: unknown }).code !== 5) {
        throw error;
      }
    }
  }

  return null;
}

function toSafeInteger(value: any, fallback: number = 0): number {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? Math.trunc(num) : fallback;
}

function toSafeText(value: any, fallback: string = ''): string {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

async function migrateCollectionDomain(options: {
  sourceCollection: string;
  targetTable: string;
  map: (row: FirestoreDoc) => Record<string, unknown>;
}): Promise<void> {
  const sourceRows = await readCollectionWithFallback(options.sourceCollection);
  console.log(`[${domain}] Firebase documents: ${sourceRows.length}`);

  if (sourceRows.length === 0) {
    console.log(`[${domain}] Nothing to migrate.`);
    return;
  }

  const payload = sourceRows.map(options.map);
  const { error } = await supabase.from(options.targetTable).upsert(payload, { onConflict: 'id' });
  if (error) {
    if (error.code === 'PGRST205') {
      throw new Error(
        `Supabase table not found: public.${options.targetTable}. ` +
        'Run supabase/phase3_domain_schema.sql and supabase/phase3_domain_rls.sql, then retry.'
      );
    }
    throw error;
  }

  const { data: targetRows, error: selectError } = await supabase
    .from(options.targetTable)
    .select('id');

  if (selectError) throw selectError;

  const sourceIds = new Set(sourceRows.map((row) => row.id));
  const targetIds = new Set((targetRows || []).map((row: { id: string }) => row.id));

  const missing = [...sourceIds].filter((id) => !targetIds.has(id));
  const additional = [...targetIds].filter((id) => !sourceIds.has(id));

  console.log(`[${domain}] Firebase count: ${sourceIds.size}`);
  console.log(`[${domain}] Supabase count: ${targetIds.size}`);
  console.log(`[${domain}] IDs missing in Supabase: ${missing.length ? missing.join(', ') : 'none'}`);
  console.log(`[${domain}] IDs additional in Supabase: ${additional.length ? additional.join(', ') : 'none'}`);

  if (missing.length > 0) {
    throw new Error(`[${domain}] Verification failed: missing IDs in Supabase.`);
  }
}

async function migrateSquad(): Promise<void> {
  await migrateCollectionDomain({
    sourceCollection: 'squadPlayers',
    targetTable: 'squad_players',
    map: ({ id, data }) => ({
      id,
      first_name: toSafeText(data.firstName),
      last_name: toSafeText(data.lastName),
      number: data.number === undefined || data.number === null ? null : String(data.number),
      position: toSafeText(data.position),
      status: toSafeText(data.status),
      notes: data.notes || null,
      joined_date: data.joinedDate || null,
      photo_url: data.photoUrl || null,
      age: data.age ?? null,
      nationality: data.nationality || null,
      preferred_foot: data.preferredFoot || null,
      height_cm: data.heightCm ?? null,
      weight_kg: data.weightKg ?? null,
      attendance_stats: data.attendanceStats || null,
      malika_points: data.malikaPoints ?? null,
      malika_history: data.malikaHistory || [],
      updated_at: toSafeInteger(data.updatedAt)
    })
  });
}

async function migrateExercises(): Promise<void> {
  await migrateCollectionDomain({
    sourceCollection: 'exerciseLibrary',
    targetTable: 'exercise_library',
    map: ({ id, data }) => ({
      id,
      name: toSafeText(data.name),
      game_moment: toSafeText(data.gameMoment),
      sub_moment: toSafeText(data.subMoment),
      description: toSafeText(data.description),
      duration: toSafeText(data.duration),
      series: data.series === undefined || data.series === null ? null : String(data.series),
      work_time: data.workTime === undefined || data.workTime === null ? null : String(data.workTime),
      rest_time: data.restTime === undefined || data.restTime === null ? null : String(data.restTime),
      dimensions: toSafeText(data.dimensions),
      coach_roles: toSafeText(data.coachRoles),
      image: data.image || null,
      player_groups: data.playerGroups || null,
      hide_graphics: data.hideGraphics ?? null,
      is_fitness: data.isFitness ?? null,
      malika_challenge: data.malikaChallenge || null,
      updated_at: toSafeInteger(data.updatedAt)
    })
  });
}

async function migrateFixtures(): Promise<void> {
  await migrateCollectionDomain({
    sourceCollection: 'competitionFixtures',
    targetTable: 'competition_fixtures',
    map: ({ id, data }) => ({
      id,
      opponent: toSafeText(data.opponent),
      opponent_logo: data.opponentLogo || null,
      date: toSafeText(data.date),
      time: toSafeText(data.time),
      location: toSafeText(data.location),
      venue: data.venue || null,
      competition_name: toSafeText(data.competitionName),
      matchday: data.matchday || null,
      status: toSafeText(data.status),
      result: data.result || null,
      tactical_notes: data.tacticalNotes || null,
      lineup: data.lineup || null,
      updated_at: toSafeInteger(data.updatedAt)
    })
  });
}

async function migrateVideo(): Promise<void> {
  await migrateCollectionDomain({
    sourceCollection: 'videoAnalysis',
    targetTable: 'video_analysis',
    map: ({ id, data }) => ({
      id,
      title: toSafeText(data.title),
      match_or_session_date: toSafeText(data.matchOrSessionDate),
      opponent_or_topic: toSafeText(data.opponentOrTopic),
      video_url: toSafeText(data.videoUrl),
      game_moment: toSafeText(data.gameMoment),
      tags: data.tags || [],
      key_timestamps: data.keyTimestamps || [],
      summary: toSafeText(data.summary),
      created_at: toSafeText(data.createdAt),
      updated_at: toSafeInteger(data.updatedAt)
    })
  });
}

async function migratePhysio(): Promise<void> {
  await migrateCollectionDomain({
    sourceCollection: 'physioRecords',
    targetTable: 'physio_records',
    map: ({ id, data }) => ({
      id,
      player_id: toSafeText(data.playerId),
      player_name: toSafeText(data.playerName),
      injury_date: toSafeText(data.injuryDate),
      injury_type: toSafeText(data.injuryType),
      severity: toSafeText(data.severity),
      status: toSafeText(data.status),
      treatment_notes: toSafeText(data.treatmentNotes),
      estimated_return_date: data.estimatedReturnDate || null,
      physio_name: data.physioName || null,
      updated_at: toSafeText(data.updatedAt),
      cloud_updated_at: toSafeInteger(data.cloudUpdatedAt, Date.now())
    })
  });
}

async function migrateSessionCards(): Promise<void> {
  await migrateCollectionDomain({
    sourceCollection: 'sessionCards',
    targetTable: 'session_cards',
    map: ({ id, data }) => ({
      id,
      session_number: toSafeInteger(data.sessionNumber),
      title: toSafeText(data.title),
      description: toSafeText(data.description),
      category: toSafeText(data.category),
      duration: toSafeText(data.duration),
      intensity: toSafeText(data.intensity),
      date: toSafeText(data.date),
      role: toSafeText(data.role),
      created_at: toSafeInteger(data.createdAt),
      updated_at: toSafeInteger(data.updatedAt)
    })
  });
}

async function migrateAttendance(): Promise<void> {
  const docData = await readDocWithFallback('attendanceMeta', 'excludedPlayers');
  const names = Array.isArray(docData?.names)
    ? docData?.names.filter((item: unknown): item is string => typeof item === 'string')
    : [];

  console.log(`[${domain}] Firebase entries: ${names.length}`);

  if (names.length === 0) {
    console.log(`[${domain}] Nothing to migrate.`);
    return;
  }

  const updatedAt = toSafeInteger(docData?.updatedAt, Date.now());
  const payload = names.map((name) => ({ name, updated_at: updatedAt }));

  const { error } = await supabase
    .from('attendance_excluded_players')
    .upsert(payload, { onConflict: 'name' });
  if (error) throw error;

  const { data: targetRows, error: selectError } = await supabase
    .from('attendance_excluded_players')
    .select('name');

  if (selectError) throw selectError;

  const targetNames = new Set((targetRows || []).map((row: { name: string }) => row.name));
  const missing = names.filter((name) => !targetNames.has(name));

  console.log(`[${domain}] Supabase entries: ${targetNames.size}`);
  console.log(`[${domain}] Names missing in Supabase: ${missing.length ? missing.join(', ') : 'none'}`);

  if (missing.length > 0) {
    throw new Error(`[${domain}] Verification failed: missing excluded players in Supabase.`);
  }
}

async function migrateExerciseDeletedIds(): Promise<void> {
  const docData = await readDocWithFallback('exerciseLibraryMeta', 'deletedIds');
  const ids = Array.isArray(docData?.ids)
    ? docData?.ids.filter((item: unknown): item is string => typeof item === 'string')
    : [];

  console.log(`[${domain}] Firebase entries: ${ids.length}`);

  if (ids.length === 0) {
    console.log(`[${domain}] Nothing to migrate.`);
    return;
  }

  const updatedAt = toSafeInteger(docData?.updatedAt, Date.now());
  const payload = ids.map((id) => ({ id, updated_at: updatedAt }));

  const { error } = await supabase
    .from('exercise_library_deleted_ids')
    .upsert(payload, { onConflict: 'id' });
  if (error) throw error;

  const { data: targetRows, error: selectError } = await supabase
    .from('exercise_library_deleted_ids')
    .select('id');

  if (selectError) throw selectError;

  const targetIds = new Set((targetRows || []).map((row: { id: string }) => row.id));
  const missing = ids.filter((id) => !targetIds.has(id));

  console.log(`[${domain}] Supabase entries: ${targetIds.size}`);
  console.log(`[${domain}] IDs missing in Supabase: ${missing.length ? missing.join(', ') : 'none'}`);

  if (missing.length > 0) {
    throw new Error(`[${domain}] Verification failed: missing deleted exercise IDs in Supabase.`);
  }
}

async function migrateTeamLogo(): Promise<void> {
  const current = await readDocWithFallback('teamLogoConfig', 'current');
  const meta = await readDocWithFallback('teamLogoConfig', 'meta');

  const rows: Array<Record<string, unknown>> = [];

  if (current) {
    rows.push({
      id: 'current',
      logo_url: current.logoUrl || null,
      initialized: null,
      updated_at: toSafeInteger(current.updatedAt, Date.now()),
      payload: current
    });
  }

  if (meta) {
    rows.push({
      id: 'meta',
      logo_url: null,
      initialized: Boolean(meta.initialized),
      updated_at: toSafeInteger(meta.updatedAt, Date.now()),
      payload: meta
    });
  }

  console.log(`[${domain}] Firebase entries: ${rows.length}`);

  if (rows.length === 0) {
    console.log(`[${domain}] Nothing to migrate.`);
    return;
  }

  const { error } = await supabase
    .from('team_logo_config')
    .upsert(rows, { onConflict: 'id' });
  if (error) throw error;

  const { data: targetRows, error: selectError } = await supabase
    .from('team_logo_config')
    .select('id');

  if (selectError) throw selectError;

  const targetIds = new Set((targetRows || []).map((row: { id: string }) => row.id));
  const sourceIds = rows.map((row) => String(row.id));
  const missing = sourceIds.filter((id) => !targetIds.has(id));

  console.log(`[${domain}] Supabase entries: ${targetIds.size}`);
  console.log(`[${domain}] IDs missing in Supabase: ${missing.length ? missing.join(', ') : 'none'}`);

  if (missing.length > 0) {
    throw new Error(`[${domain}] Verification failed: missing logo docs in Supabase.`);
  }
}

async function migratePermissions(): Promise<void> {
  type PermissionRow = {
    email: string;
    role: string;
    allowedSections: string[];
  };

  const permissionsDoc = await readDocWithFallback('permissionsConfig', 'list');
  const fromPermissionsDoc = Array.isArray(permissionsDoc?.users)
    ? (permissionsDoc.users as PermissionRow[])
    : [];

  let users: PermissionRow[] = fromPermissionsDoc;

  if (users.length === 0) {
    const legacyRows = await readCollectionWithFallback('userRoles');
    users = legacyRows.map(({ id, data }) => ({
      email: id,
      role: toSafeText(data.role, 'coach'),
      allowedSections: Array.isArray(data.allowedSections)
        ? data.allowedSections.filter((item: unknown): item is string => typeof item === 'string')
        : []
    }));
  }

  const normalized = users
    .map((user) => ({
      email: toSafeText(user.email).trim().toLowerCase(),
      role: toSafeText(user.role, 'coach'),
      allowed_sections: Array.isArray(user.allowedSections)
        ? user.allowedSections.filter((item): item is string => typeof item === 'string')
        : [],
      updated_at: new Date().toISOString()
    }))
    .filter((user) => user.email.length > 0);

  console.log(`[${domain}] Firebase entries: ${normalized.length}`);

  if (normalized.length === 0) {
    console.log(`[${domain}] Nothing to migrate.`);
    return;
  }

  const { error } = await supabase
    .from('user_roles')
    .upsert(normalized, { onConflict: 'email' });
  if (error) throw error;

  const { data: targetRows, error: selectError } = await supabase
    .from('user_roles')
    .select('email');

  if (selectError) throw selectError;

  const sourceEmails = new Set(normalized.map((item) => item.email));
  const targetEmails = new Set((targetRows || []).map((row: { email: string }) => row.email));
  const missing = [...sourceEmails].filter((email) => !targetEmails.has(email));

  console.log(`[${domain}] Supabase entries: ${targetEmails.size}`);
  console.log(`[${domain}] Emails missing in Supabase: ${missing.length ? missing.join(', ') : 'none'}`);

  if (missing.length > 0) {
    throw new Error(`[${domain}] Verification failed: missing user_roles rows in Supabase.`);
  }
}

async function run(): Promise<void> {
  console.log(`Starting Firebase -> Supabase migration for domain: ${domain}`);

  if (domain === 'squad') return migrateSquad();
  if (domain === 'attendance') return migrateAttendance();
  if (domain === 'exercises') return migrateExercises();
  if (domain === 'exercise-deleted-ids') return migrateExerciseDeletedIds();
  if (domain === 'fixtures') return migrateFixtures();
  if (domain === 'video') return migrateVideo();
  if (domain === 'physio') return migratePhysio();
  if (domain === 'team-logo') return migrateTeamLogo();
  if (domain === 'session-cards') return migrateSessionCards();
  if (domain === 'permissions') return migratePermissions();

  throw new Error(`Unhandled domain: ${domain}`);
}

run()
  .then(() => {
    console.log(`[${domain}] MIGRATION VERIFIED`);
  })
  .catch((error) => {
    console.error(`[${domain}] Migration failed`, error);
    process.exitCode = 1;
  });
