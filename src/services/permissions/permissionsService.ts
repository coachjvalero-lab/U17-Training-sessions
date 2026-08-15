import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../../supabaseClient';
import type { PortalSection } from '../../types';
import type { UserPermission } from './permissionModel';

type UserProfileRow = {
  user_id: string;
  email: string;
  display_name: string | null;
  is_active: boolean;
};

type AuthorizationUserRow = {
  user_id: string;
  email: string;
  display_name: string | null;
  is_active: boolean;
  is_admin: boolean;
  section_keys: string[] | null;
};

export type AuthorizationTeam = {
  id: string;
  name: string;
  isActive: boolean;
  logoUrl?: string | null;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function getClient() {
  if (!supabase) throw new Error('Supabase client is not configured');
  return supabase;
}

function toPermissionFromAuthorizationRow(row: AuthorizationUserRow): UserPermission {
  const sectionKeys = Array.isArray(row.section_keys) ? row.section_keys : [];

  return {
    userId: row.user_id,
    email: normalizeEmail(row.email),
    displayName: row.display_name,
    isActive: Boolean(row.is_active),
    isAdmin: Boolean(row.is_admin),
    allowedSections: sectionKeys.filter(Boolean) as PortalSection[]
  } as UserPermission;
}

export async function listIdentityUsersWithPermissions(): Promise<UserPermission[]> {
  const client = getClient();

  const { data, error } = await client.rpc('admin_list_section_authorization_users');
  if (error) {
    throw error;
  }

  const rows = (data || []) as AuthorizationUserRow[];
  const users = rows
    .filter((row) => Boolean(row.email))
    .map((row) => toPermissionFromAuthorizationRow(row));

  // Legacy fallback only when centralized rows are still empty during migration.
  if (users.length === 0) {
    const { data: profilesData, error: profilesError } = await client
      .from('user_profiles')
      .select('user_id, email, display_name, is_active')
      .eq('is_active', true)
      .order('email', { ascending: true });
    if (profilesError) throw profilesError;

    const fallbackProfiles = (profilesData || []) as UserProfileRow[];
    return fallbackProfiles
      .filter((profile) => Boolean(profile.email))
      .map((profile) => ({
        userId: profile.user_id,
        email: normalizeEmail(profile.email),
        displayName: profile.display_name,
        isActive: Boolean(profile.is_active),
        isAdmin: false,
        allowedSections: []
      } as UserPermission));
  }

  return users
    .sort((a, b) => a.email.localeCompare(b.email));
}

async function listUserPermissions(): Promise<UserPermission[]> {
  const client = getClient();
  const { data, error } = await client.rpc('admin_list_section_authorization_users');
  if (error) throw error;
  return ((data || []) as AuthorizationUserRow[]).map(toPermissionFromAuthorizationRow);
}

export async function listAuthorizationTeams(): Promise<AuthorizationTeam[]> {
  const client = getClient();
  const { data, error } = await client
    .from('auth_teams')
    .select('id, name, is_active, logo_url')
    .eq('is_active', true)
    .order('name', { ascending: true });
  if (error) throw error;
  return (data || []).map((row: any) => ({
    id: row.id,
    name: row.name,
    isActive: Boolean(row.is_active),
    logoUrl: row.logo_url || null
  }));
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
    .channel('u17-authorization-admin-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'user_profiles' }, () => {
      void loadAndEmit();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'user_section_access' }, () => {
      void loadAndEmit();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'user_role_assignments' }, () => {
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
  for (const permission of list) {
    const email = permission.email.trim().toLowerCase();
    const sectionKeys = permission.allowedSections;
    const displayName = typeof permission.displayName === 'string' ? permission.displayName.trim() : '';
    const isActive = permission.isActive;

    const { error } = await client.rpc('admin_set_user_section_access', {
      target_email: email,
      target_display_name: displayName,
      target_is_active: isActive,
      target_section_keys: sectionKeys
    });

    if (error) {
      throw error;
    }
  }
}
