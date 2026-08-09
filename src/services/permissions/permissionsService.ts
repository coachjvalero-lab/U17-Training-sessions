import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../../supabaseClient';
import type { PortalSection } from '../../types';
import type { UserPermission } from '../../utils/permissions';

const USER_ROLES_TABLE = 'user_roles';

type UserRoleRow = {
  email: string;
  role: UserPermission['role'];
  allowed_sections: string[] | null;
};

type UserProfileRow = {
  user_id: string;
  email: string;
  display_name: string | null;
  is_active: boolean;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function defaultSectionsByRole(role: UserPermission['role']): PortalSection[] {
  if (role === 'admin') {
    return ['football', 'fitness', 'gk', 'squad', 'attendance', 'physio', 'video', 'exercises', 'planning', 'meetings'];
  }
  if (role === 'coach') {
    return ['football', 'squad', 'attendance', 'video', 'exercises', 'planning'];
  }
  if (role === 'fitness_coach') {
    return ['fitness', 'squad', 'attendance', 'exercises', 'planning'];
  }
  if (role === 'gk_coach') {
    return ['gk', 'squad', 'attendance', 'exercises', 'planning'];
  }
  if (role === 'physio') {
    return ['physio', 'squad', 'attendance'];
  }
  if (role === 'analyst') {
    return ['video', 'exercises', 'football', 'planning'];
  }
  return [];
}

function getClient() {
  if (!supabase) throw new Error('Supabase client is not configured');
  return supabase;
}

function fromRow(row: UserRoleRow): UserPermission {
  return {
    email: row.email,
    role: row.role,
    allowedSections: Array.isArray(row.allowed_sections)
      ? row.allowed_sections as UserPermission['allowedSections']
      : []
  };
}

export async function listIdentityUsersWithPermissions(): Promise<UserPermission[]> {
  const client = getClient();

  const [profilesResult, rolesResult] = await Promise.all([
    client
      .from('user_profiles')
      .select('user_id, email, display_name, is_active')
      .eq('is_active', true)
      .order('email', { ascending: true }),
    client
      .from(USER_ROLES_TABLE)
      .select('email, role, allowed_sections')
  ]);

  if (profilesResult.error) throw profilesResult.error;
  if (rolesResult.error) throw rolesResult.error;

  const rolesByEmail = new Map<string, UserRoleRow>();
  for (const roleRow of (rolesResult.data || []) as UserRoleRow[]) {
    rolesByEmail.set(normalizeEmail(roleRow.email), roleRow);
  }

  const users = ((profilesResult.data || []) as UserProfileRow[])
    .filter((profile) => Boolean(profile.email))
    .map((profile) => {
      const email = normalizeEmail(profile.email);
      const roleRow = rolesByEmail.get(email);
      const role = roleRow?.role || 'custom';
      const allowedSections = Array.isArray(roleRow?.allowed_sections) && roleRow!.allowed_sections!.length > 0
        ? roleRow!.allowed_sections! as PortalSection[]
        : defaultSectionsByRole(role);

      return {
        email,
        role,
        allowedSections
      } as UserPermission;
    });

  return users;
}

async function listUserPermissions(): Promise<UserPermission[]> {
  const client = getClient();
  const { data: authData, error: authError } = await client.auth.getSession();
  const authEmail = authData?.session?.user?.email || null;
  if (authError) {
    console.warn('[PermissionsService] auth session read failed', authError);
  }

  const { data, error } = await client
    .from(USER_ROLES_TABLE)
    .select('email, role, allowed_sections')
    .order('email', { ascending: true });

  if (error) throw error;
  const mapped = ((data || []) as UserRoleRow[]).map(fromRow);
  console.log('[PermissionsService] list user roles', {
    authEmail,
    rows: mapped.length,
    emails: mapped.map((item) => item.email)
  });
  return mapped;
}

export function subscribeToUserPermissions(
  callback: (list: UserPermission[]) => void,
  onError?: (error: unknown) => void
): () => void {
  const client = getClient();
  let active = true;
  let channel: RealtimeChannel | null = null;

  const loadAndEmit = async () => {
    try {
      const list = await listUserPermissions();
      console.log('[PermissionsService] emit permissions list', {
        rows: list.length
      });
      if (active) callback(list);
    } catch (error) {
      console.error('[PermissionsService] loadAndEmit error', error);
      if (active && onError) onError(error);
    }
  };

  void loadAndEmit();

  channel = client
    .channel('u17-user-roles-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: USER_ROLES_TABLE }, () => {
      void loadAndEmit();
    })
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR' && onError) {
        onError(new Error('Supabase realtime channel error for user roles'));
      }
    });

  return () => {
    active = false;
    if (channel) void client.removeChannel(channel);
  };
}

export async function saveUserPermissions(list: UserPermission[]): Promise<void> {
  const client = getClient();
  const rows = list.map((permission) => ({
    email: permission.email.trim().toLowerCase(),
    role: permission.role,
    allowed_sections: permission.allowedSections,
    updated_at: new Date().toISOString()
  }));

  const { data: existing, error: existingError } = await client
    .from(USER_ROLES_TABLE)
    .select('email');
  if (existingError) throw existingError;

  if (rows.length > 0) {
    const { error: upsertError } = await client
      .from(USER_ROLES_TABLE)
      .upsert(rows, { onConflict: 'email' });
    if (upsertError) throw upsertError;
  }

  const desiredEmails = new Set(rows.map((row) => row.email));
  const emailsToDelete = (existing || [])
    .map((row: { email: string }) => row.email)
    .filter((email: string) => !desiredEmails.has(email));

  if (emailsToDelete.length > 0) {
    const { error: deleteError } = await client
      .from(USER_ROLES_TABLE)
      .delete()
      .in('email', emailsToDelete);
    if (deleteError) throw deleteError;
  }
}
