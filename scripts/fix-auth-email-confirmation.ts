#!/usr/bin/env node
/**
 * Fix Supabase Auth Email Confirmation
 *
 * This script confirms email addresses for Supabase Auth users.
 * Reads credentials from .env.local and uses Supabase Admin API.
 *
 * Usage:
 *   node scripts/fix-auth-email-confirmation.js [--execute]
 *
 * Default: dry-run only. Add --execute flag to actually confirm emails.
 */

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// ============================================================================
// Load environment from .env.local
// ============================================================================

function loadEnv(filePath: string): Record<string, string> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const env: Record<string, string> = {};
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const match = trimmed.match(/^([A-Z_0-9]+)=(.*)$/);
    if (match) {
      const [, key, value] = match;
      env[key] = value;
    }
  }

  return env;
}

function parseJwt(token: string): Record<string, any> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT format');
  const decoded = Buffer.from(parts[1], 'base64').toString('utf-8');
  return JSON.parse(decoded);
}

// ============================================================================
// Main script
// ============================================================================

async function main() {
  const isDryRun = !process.argv.includes('--execute');
  const mode = isDryRun ? '🔍 DRY-RUN' : '🔄 EXECUTING';

  console.log('\n' + '='.repeat(70));
  console.log(`Supabase Auth Email Confirmation Fix [${mode}]`);
  console.log('='.repeat(70));

  // Load .env.local
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) {
    console.error('❌ .env.local not found');
    process.exit(1);
  }

  const env = loadEnv(envPath);
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!serviceRoleKey) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found in .env.local');
    process.exit(1);
  }

  // Extract URL from JWT payload
  let supabaseUrl: string;
  try {
    const payload = parseJwt(serviceRoleKey);
    const ref = payload.ref;
    if (!ref) throw new Error('ref not found in JWT');
    supabaseUrl = `https://${ref}.supabase.co`;
    console.log(`✓ Supabase URL: ${supabaseUrl}`);
  } catch (err) {
    console.error('❌ Failed to extract Supabase URL from service role key:', err);
    process.exit(1);
  }

  // Create Admin client
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  console.log('');

  // ---- Fetch users ----
  console.log('📋 Fetching Supabase Auth users...\n');

  let users: any[] = [];
  try {
    const { data, error } = await admin.auth.admin.listUsers();
    if (error) throw error;
    users = data?.users || [];
  } catch (err) {
    console.error('❌ Failed to fetch users:', err);
    process.exit(1);
  }

  if (users.length === 0) {
    console.log('⚠️  No users found in Supabase Auth');
    process.exit(0);
  }

  // ---- Analyze users ----
  console.log(`Found ${users.length} user(s):\n`);

  const unconfirmed: any[] = [];
  const confirmed: any[] = [];

  for (const user of users) {
    const isConfirmed = !!user.email_confirmed_at;
    const status = isConfirmed ? '✓ confirmed' : '✗ unconfirmed';
    const indicator = isConfirmed ? '✓' : '✗';

    console.log(`  ${indicator} ${user.email}`);
    console.log(`    ID: ${user.id}`);
    console.log(`    Status: ${status}`);
    console.log(`    Created: ${new Date(user.created_at).toISOString()}`);
    console.log('');

    if (isConfirmed) {
      confirmed.push(user);
    } else {
      unconfirmed.push(user);
    }
  }

  // ---- Report ----
  console.log('='.repeat(70));
  console.log('📊 Summary');
  console.log('='.repeat(70));
  console.log(`Total users:        ${users.length}`);
  console.log(`Confirmed:          ${confirmed.length}`);
  console.log(`Unconfirmed:        ${unconfirmed.length}`);
  console.log('');

  if (unconfirmed.length === 0) {
    console.log('✅ All users are already confirmed. No action needed.');
    process.exit(0);
  }

  console.log(`Users to confirm:\n`);
  for (const user of unconfirmed) {
    console.log(`  - ${user.email} (${user.id})`);
  }
  console.log('');

  // ---- Dry run ----
  if (isDryRun) {
    console.log('='.repeat(70));
    console.log('🔍 DRY-RUN MODE');
    console.log('='.repeat(70));
    console.log(
      '\nTo execute email confirmation, run:\n' +
      '  node scripts/fix-auth-email-confirmation.js --execute\n'
    );
    process.exit(0);
  }

  // ---- Execute ----
  console.log('='.repeat(70));
  console.log('🔄 Confirming emails...');
  console.log('='.repeat(70));
  console.log('');

  const results = { success: 0, failed: 0, errors: [] as string[] };

  for (const user of unconfirmed) {
    try {
      const { error } = await admin.auth.admin.updateUserById(user.id, {
        email_confirm: true,
      });

      if (error) throw error;

      console.log(`✓ ${user.email} - confirmed`);
      results.success++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`✗ ${user.email} - FAILED: ${msg}`);
      results.failed++;
      results.errors.push(`${user.email}: ${msg}`);
    }
  }

  console.log('');
  console.log('='.repeat(70));
  console.log('📋 Confirmation Results');
  console.log('='.repeat(70));
  console.log(`Success:   ${results.success}`);
  console.log(`Failed:    ${results.failed}`);
  console.log('');

  if (results.failed > 0) {
    console.log('Errors:');
    for (const err of results.errors) {
      console.log(`  - ${err}`);
    }
    console.log('');
  }

  // ---- Verify ----
  console.log('='.repeat(70));
  console.log('✓ Verifying confirmation status...');
  console.log('='.repeat(70));
  console.log('');

  try {
    const { data: updatedData, error: fetchError } = await admin.auth.admin.listUsers();
    if (fetchError) throw fetchError;

    const updatedUsers = updatedData?.users || [];
    const adminUser = updatedUsers.find((u) => u.email === 'admin@alula.com');

    if (adminUser) {
      const isConfirmed = !!adminUser.email_confirmed_at;
      console.log(`admin@alula.com:`);
      console.log(`  Email confirmed: ${isConfirmed ? 'YES' : 'NO'}`);
      if (adminUser.email_confirmed_at) {
        console.log(`  Confirmed at: ${new Date(adminUser.email_confirmed_at).toISOString()}`);
      }
      console.log('');
    }

    console.log('All users after confirmation:');
    for (const user of updatedUsers) {
      const isConfirmed = !!user.email_confirmed_at;
      const status = isConfirmed ? '✓' : '✗';
      console.log(`  ${status} ${user.email}`);
    }
  } catch (err) {
    console.error('⚠️  Failed to verify:', err);
  }

  console.log('');
  console.log('='.repeat(70));
  console.log('✅ Done');
  console.log('='.repeat(70));
  console.log('');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
