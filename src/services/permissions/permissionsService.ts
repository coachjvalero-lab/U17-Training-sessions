import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../../supabaseClient';
import type { UserPermission } from '../../utils/permissions';

const USER_ROLES_TABLE = 'user_roles';

type UserRoleRow = {
  email: string;
  role: UserPermission['role'];
  allowed_sections: string[] | null;
};

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

async function listUserPermissions(): Promise<UserPermission[]> {
  const { data, error } = await getClient()
    .from(USER_ROLES_TABLE)
    .select('email, role, allowed_sections')
    .order('email', { ascending: true });

  if (error) throw error;
  return ((data || []) as UserRoleRow[]).map(fromRow);
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
      if (active) callback(list);
    } catch (error) {
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
