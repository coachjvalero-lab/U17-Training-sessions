/// <reference types="node" />
// TEMPORARY read-only diagnostic script. Safe to delete after use.
import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: ['.env.local', '.env'] });

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}
const supabaseUrl = process.env.VITE_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim();
if (!supabaseUrl) throw new Error('Missing SUPABASE URL');

const supabase = createClient(supabaseUrl, requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { autoRefreshToken: false, persistSession: false }
});

const SHOUQ_ID = '63bdf6cf-6eb8-4a09-8996-bd3c82850257';

async function main() {
  console.log('=== user_profiles (Shouq) ===');
  console.log(await supabase.from('user_profiles').select('*').eq('user_id', SHOUQ_ID));

  console.log('=== user_team_memberships (Shouq) ===');
  console.log(await supabase.from('user_team_memberships').select('*').eq('user_id', SHOUQ_ID));

  console.log('=== user_section_access (Shouq) joined app_sections ===');
  console.log(
    await supabase
      .from('user_section_access')
      .select('user_id, section_id, granted_at, app_sections(key,label)')
      .eq('user_id', SHOUQ_ID)
  );

  console.log('=== user_role_assignments (Shouq) ===');
  console.log(await supabase.from('user_role_assignments').select('*').eq('user_id', SHOUQ_ID));

  console.log('=== app_roles (all) ===');
  console.log(await supabase.from('app_roles').select('*'));

  console.log('=== legacy user_roles (Shouq by email match) ===');
  const profile = await supabase.from('user_profiles').select('email').eq('user_id', SHOUQ_ID).maybeSingle();
  console.log('email:', profile.data?.email);
  if (profile.data?.email) {
    console.log(await supabase.from('user_roles').select('*').ilike('email', profile.data.email));
  }

  console.log('=== legacy user_roles WHERE role = coach (find working coach) ===');
  const coachRows = await supabase.from('user_roles').select('*').eq('role', 'coach');
  console.log(coachRows);

  if (coachRows.data && coachRows.data.length > 0) {
    for (const row of coachRows.data as any[]) {
      console.log(`--- working coach candidate: ${row.email} ---`);
      const wp = await supabase.from('user_profiles').select('user_id,email,is_active').ilike('email', row.email).maybeSingle();
      console.log('profile:', wp.data);
      if (wp.data?.user_id) {
        console.log(
          'user_role_assignments:',
          await supabase.from('user_role_assignments').select('*').eq('user_id', wp.data.user_id)
        );
        console.log(
          'user_section_access:',
          await supabase
            .from('user_section_access')
            .select('user_id, section_id, app_sections(key)')
            .eq('user_id', wp.data.user_id)
        );
        console.log(
          'user_team_memberships:',
          await supabase.from('user_team_memberships').select('*').eq('user_id', wp.data.user_id)
        );
      }
    }
  }

  console.log('=== app_role_section_action_grants for coach role ===');
  const coachRole = await supabase.from('app_roles').select('id,key').eq('key', 'coach').maybeSingle();
  console.log('coach role id:', coachRole.data);
  if (coachRole.data?.id) {
    console.log(
      await supabase
        .from('app_role_section_action_grants')
        .select('role_id, app_section_actions(action_key, app_sections(key))')
        .eq('role_id', coachRole.data.id)
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
