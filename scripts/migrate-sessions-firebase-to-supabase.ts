/// <reference types="node" />

import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';
import { deleteApp, initializeApp } from 'firebase/app';
import { collection, getDocs, getFirestore, type Firestore } from 'firebase/firestore';
import type { CloudTrainingSession } from '../src/types';

loadEnv({ path: ['.env.local', '.env'] });

const SESSIONS_COLLECTION = 'sessions';
const SESSIONS_TABLE = 'sessions';

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

const supabaseServiceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
const supabaseUrl = requireSupabaseUrl();

const firebaseApp = initializeApp({
  apiKey: requireEnv('VITE_FIREBASE_API_KEY'),
  authDomain: requireEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: requireEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: requireEnv('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: requireEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: requireEnv('VITE_FIREBASE_APP_ID')
}, 'sessions-manual-migration');

const firebaseDatabaseId = process.env.VITE_FIREBASE_DATABASE_ID?.trim() || 'default';
const firebaseDb = getFirestore(firebaseApp, firebaseDatabaseId);
const firebaseDefaultDb = getFirestore(firebaseApp, 'default');
const supabase = createClient(
  supabaseUrl,
  supabaseServiceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function readSessions(database: Firestore): Promise<CloudTrainingSession[]> {
  const snapshot = await getDocs(collection(database, SESSIONS_COLLECTION));
  return snapshot.docs.map((document) => ({
    ...(document.data() as CloudTrainingSession),
    id: document.id
  }));
}

async function listFirebaseSessions(): Promise<CloudTrainingSession[]> {
  const sessions = await readSessions(firebaseDb);
  if (sessions.length > 0 || firebaseDatabaseId === 'default') {
    return sessions;
  }
  return readSessions(firebaseDefaultDb);
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

async function upsertSupabaseSessions(sessions: CloudTrainingSession[]): Promise<void> {
  const payload = sessions.map(toSupabaseSessionRow);
  const { error } = await supabase.from(SESSIONS_TABLE).upsert(payload, { onConflict: 'id' });
  if (error) throw error;
}

async function countSupabaseSessions(): Promise<number> {
  const { count, error } = await supabase
    .from(SESSIONS_TABLE)
    .select('id', { count: 'exact', head: true });
  if (error) throw error;
  return count || 0;
}

async function getSupabaseSessionIds(): Promise<string[]> {
  const pageSize = 1000;
  const ids: string[] = [];

  for (let start = 0; ; start += pageSize) {
    const { data, error } = await supabase
      .from(SESSIONS_TABLE)
      .select('id')
      .range(start, start + pageSize - 1);
    if (error) throw error;

    const pageIds = (data || [])
      .map((row: { id?: string | null }) => row.id)
      .filter((id): id is string => Boolean(id));
    ids.push(...pageIds);

    if (pageIds.length < pageSize) break;
  }

  return ids;
}

async function main(): Promise<void> {
  console.log('Starting Firebase -> Supabase sessions migration');

  const firebaseSessions = await listFirebaseSessions();
  console.log(`Firebase sessions found: ${firebaseSessions.length}`);

  if (firebaseSessions.length === 0) {
    console.error('No Firebase sessions found. Aborting migration without changing Supabase.');
    process.exit(1);
  }

  try {
    await upsertSupabaseSessions(firebaseSessions);
  } catch (error) {
    console.error('Session migration failed during Supabase upsert.', error);
    throw error;
  }

  const supabaseSessionsCount = await countSupabaseSessions();
  console.log(`Supabase sessions found: ${supabaseSessionsCount}`);

  const firebaseIds = firebaseSessions.map((session) => session.id).filter((id): id is string => Boolean(id));
  const supabaseIds = await getSupabaseSessionIds();

  const missingInSupabase = firebaseIds.filter((id) => !supabaseIds.includes(id));
  const additionalInSupabase = supabaseIds.filter((id) => !firebaseIds.includes(id));

  console.log(`Firebase session count: ${firebaseIds.length}`);
  console.log(`Supabase session count: ${supabaseIds.length}`);
  console.log(`IDs missing in Supabase: ${missingInSupabase.length > 0 ? missingInSupabase.join(', ') : 'none'}`);
  console.log(`IDs additional in Supabase: ${additionalInSupabase.length > 0 ? additionalInSupabase.join(', ') : 'none'}`);

  if (firebaseIds.length === supabaseIds.length && missingInSupabase.length === 0 && additionalInSupabase.length === 0) {
    console.log('SESSION MIGRATION VERIFIED');
    return;
  }

  console.error('Session migration verification failed.');
  process.exit(1);
}

main()
  .catch((error) => {
    console.error('Unexpected migration error.', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await deleteApp(firebaseApp);
  });
