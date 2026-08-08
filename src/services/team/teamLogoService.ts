import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../../supabaseClient';

const TEAM_LOGO_TABLE = 'team_logo_config';
const CURRENT_LOGO_ID = 'current';

type TeamLogoRow = {
  id: string;
  logo_url: string | null;
  initialized: boolean | null;
  updated_at: number | null;
  payload: Record<string, unknown>;
};

function getClient() {
  if (!supabase) throw new Error('Supabase client is not configured');
  return supabase;
}

async function getCurrentTeamLogo(): Promise<string> {
  const { data, error } = await getClient()
    .from(TEAM_LOGO_TABLE)
    .select('logo_url')
    .eq('id', CURRENT_LOGO_ID)
    .maybeSingle();

  if (error) throw error;
  return data?.logo_url || '';
}

export function subscribeToTeamLogo(
  callback: (logo: string) => void,
  onError?: (error: unknown) => void
): () => void {
  const client = getClient();
  let active = true;
  let channel: RealtimeChannel | null = null;

  const loadAndEmit = async () => {
    try {
      const logo = await getCurrentTeamLogo();
      if (active) callback(logo);
    } catch (error) {
      if (active && onError) onError(error);
    }
  };

  void loadAndEmit();

  channel = client
    .channel('u17-team-logo-realtime')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: TEAM_LOGO_TABLE, filter: `id=eq.${CURRENT_LOGO_ID}` },
      () => void loadAndEmit()
    )
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR' && onError) {
        onError(new Error('Supabase realtime channel error for team logo'));
      }
    });

  return () => {
    active = false;
    if (channel) void client.removeChannel(channel);
  };
}

export async function saveTeamLogo(logoUrl: string): Promise<void> {
  const updatedAt = Date.now();
  const row: TeamLogoRow = {
    id: CURRENT_LOGO_ID,
    logo_url: logoUrl,
    initialized: null,
    updated_at: updatedAt,
    payload: { logoUrl, updatedAt }
  };
  const { error } = await getClient()
    .from(TEAM_LOGO_TABLE)
    .upsert(row, { onConflict: 'id' });

  if (error) throw error;
}
