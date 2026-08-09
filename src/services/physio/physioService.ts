import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../../supabaseClient';
import type { PhysioRecord } from '../../types';

const PHYSIO_TABLE = 'physio_records';

type PhysioRow = {
  id: string;
  player_id: string;
  player_name: string;
  injury_date: string;
  injury_type: string;
  severity: PhysioRecord['severity'];
  status: PhysioRecord['status'];
  treatment_notes: string;
  estimated_return_date: string | null;
  physio_name: string | null;
  updated_at: string;
  cloud_updated_at: bigint | number;
};

export interface CloudPhysioRecord extends PhysioRecord {
  cloudUpdatedAt: number;
}

function getClient() {
  if (!supabase) throw new Error('Supabase client is not configured');
  return supabase;
}

function fromRow(row: PhysioRow): CloudPhysioRecord {
  return {
    id: row.id,
    playerId: row.player_id,
    playerName: row.player_name,
    injuryDate: row.injury_date,
    injuryType: row.injury_type,
    severity: row.severity,
    status: row.status,
    treatmentNotes: row.treatment_notes,
    estimatedReturnDate: row.estimated_return_date ?? undefined,
    physioName: row.physio_name ?? undefined,
    updatedAt: row.updated_at,
    cloudUpdatedAt: Number(row.cloud_updated_at)
  };
}

function toRow(record: PhysioRecord, cloudUpdatedAt: number): Record<string, unknown> {
  return {
    id: record.id,
    player_id: record.playerId,
    player_name: record.playerName,
    injury_date: record.injuryDate,
    injury_type: record.injuryType,
    severity: record.severity,
    status: record.status,
    treatment_notes: record.treatmentNotes,
    estimated_return_date: record.estimatedReturnDate ?? null,
    physio_name: record.physioName ?? null,
    updated_at: record.updatedAt,
    cloud_updated_at: cloudUpdatedAt
  };
}

async function listPhysioRecords(): Promise<CloudPhysioRecord[]> {
  const { data, error } = await getClient()
    .from(PHYSIO_TABLE)
    .select('*')
    .order('cloud_updated_at', { ascending: false });

  if (error) throw error;
  return ((data || []) as PhysioRow[]).map(fromRow);
}

export function subscribeToPhysioRecords(
  callback: (records: CloudPhysioRecord[]) => void,
  onError?: (error: unknown) => void
): () => void {
  const client = getClient();
  let active = true;
  let channel: RealtimeChannel | null = null;

  const loadAndEmit = async () => {
    try {
      const records = await listPhysioRecords();
      if (active) callback(records);
    } catch (error) {
      if (active && onError) onError(error);
    }
  };

  void loadAndEmit();

  channel = client
    .channel('u17-physio-records-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: PHYSIO_TABLE }, () => {
      void loadAndEmit();
    })
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR' && onError) {
        onError(new Error('Supabase realtime channel error for physio records'));
      }
    });

  return () => {
    active = false;
    if (channel) void client.removeChannel(channel);
  };
}

export async function savePhysioRecordToCloud(record: PhysioRecord): Promise<number> {
  const cloudUpdatedAt = Date.now();
  const { error } = await getClient()
    .from(PHYSIO_TABLE)
    .upsert(toRow(record, cloudUpdatedAt), { onConflict: 'id' });

  if (error) throw error;
  return cloudUpdatedAt;
}

export async function deletePhysioRecordFromCloud(recordId: string): Promise<void> {
  const { error } = await getClient()
    .from(PHYSIO_TABLE)
    .delete()
    .eq('id', recordId);

  if (error) throw error;
}
