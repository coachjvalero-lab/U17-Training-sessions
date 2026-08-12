import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../../supabaseClient';
import type {
  Microcycle,
  MicrocycleAvailabilityCategory,
  MicrocycleDay,
  MicrocycleDayConcept,
  MicrocyclePlayerAvailability,
  MicrocycleStatus
} from '../../types';

const MICROCYCLES_TABLE = 'microcycles';
const MICROCYCLE_DAYS_TABLE = 'microcycle_days';
const MICROCYCLE_CONCEPTS_TABLE = 'microcycle_day_concepts';
const MICROCYCLE_AVAILABILITY_TABLE = 'microcycle_player_availability';

type MicrocycleRow = {
  id: string;
  team_id: string;
  team_name: string;
  name: string;
  week_number: number | null;
  start_date: string;
  end_date: string;
  status: MicrocycleStatus;
  team_total: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  microcycle_days?: MicrocycleDayRow[];
  microcycle_player_availability?: MicrocycleAvailabilityRow[];
};

type MicrocycleDayRow = {
  id: string;
  microcycle_id: string;
  day_order: number;
  day_date: string;
  day_label: string | null;
  training_session: string | null;
  session_type: string | null;
  md_label: string | null;
  duration: string | null;
  load: string | null;
  stage: string | null;
  before_text: string | null;
  pre_training_session: string | null;
  warm_up: string | null;
  pitch: string | null;
  objectives_text: string | null;
  post_training_session: string | null;
  after_text: string | null;
  notes: string | null;
  session_id: string | null;
  microcycle_day_concepts?: MicrocycleConceptRow[];
};

type MicrocycleConceptRow = {
  id: string;
  microcycle_day_id: string;
  sort_order: number;
  concept: string;
  objective: string;
};

type MicrocycleAvailabilityRow = {
  id: string;
  microcycle_id: string;
  category: MicrocycleAvailabilityCategory;
  player_id: string | null;
  player_name_snapshot: string;
  notes: string | null;
};

export interface CreateMicrocycleInput {
  teamId: string;
  teamName: string;
  name: string;
  weekNumber?: number;
  startDate: string;
  endDate: string;
  status?: MicrocycleStatus;
  teamTotal?: number;
  notes?: string;
}

function getClient() {
  if (!supabase) throw new Error('Supabase client is not configured');
  return supabase;
}

function toConcept(row: MicrocycleConceptRow): MicrocycleDayConcept {
  return {
    id: row.id,
    microcycleDayId: row.microcycle_day_id,
    sortOrder: row.sort_order,
    concept: row.concept,
    objective: row.objective
  };
}

function toDay(row: MicrocycleDayRow): MicrocycleDay {
  return {
    id: row.id,
    microcycleId: row.microcycle_id,
    dayOrder: row.day_order,
    dayDate: row.day_date,
    dayLabel: row.day_label || '',
    trainingSession: row.training_session || '',
    sessionType: row.session_type || '',
    mdLabel: row.md_label || '',
    duration: row.duration || '',
    load: row.load || '',
    stage: row.stage || '',
    before: row.before_text || '',
    preTrainingSession: row.pre_training_session || '',
    warmUp: row.warm_up || '',
    pitch: row.pitch || '',
    objectivesText: row.objectives_text || '',
    postTrainingSession: row.post_training_session || '',
    after: row.after_text || '',
    notes: row.notes || '',
    sessionId: row.session_id || undefined,
    concepts: (row.microcycle_day_concepts || [])
      .map(toConcept)
      .sort((a, b) => a.sortOrder - b.sortOrder)
  };
}

function toAvailability(row: MicrocycleAvailabilityRow): MicrocyclePlayerAvailability {
  return {
    id: row.id,
    microcycleId: row.microcycle_id,
    category: row.category,
    playerId: row.player_id || undefined,
    playerNameSnapshot: row.player_name_snapshot,
    notes: row.notes || ''
  };
}

function toMicrocycle(row: MicrocycleRow): Microcycle {
  return {
    id: row.id,
    teamId: row.team_id,
    teamName: row.team_name,
    name: row.name,
    weekNumber: row.week_number ?? undefined,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    teamTotal: row.team_total ?? undefined,
    notes: row.notes || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    days: (row.microcycle_days || []).map(toDay).sort((a, b) => a.dayOrder - b.dayOrder),
    availability: (row.microcycle_player_availability || []).map(toAvailability)
  };
}

function toMicrocycleRow(input: Microcycle): Record<string, unknown> {
  return {
    id: input.id,
    team_id: input.teamId,
    team_name: input.teamName,
    name: input.name,
    week_number: input.weekNumber ?? null,
    start_date: input.startDate,
    end_date: input.endDate,
    status: input.status,
    team_total: input.teamTotal ?? null,
    notes: input.notes || null,
    updated_at: new Date().toISOString()
  };
}

function toDayRow(day: MicrocycleDay): Record<string, unknown> {
  return {
    id: day.id,
    microcycle_id: day.microcycleId,
    day_order: day.dayOrder,
    day_date: day.dayDate,
    day_label: day.dayLabel || null,
    training_session: day.trainingSession || null,
    session_type: day.sessionType || null,
    md_label: day.mdLabel || null,
    duration: day.duration || null,
    load: day.load || null,
    stage: day.stage || null,
    before_text: day.before || null,
    pre_training_session: day.preTrainingSession || null,
    warm_up: day.warmUp || null,
    pitch: day.pitch || null,
    objectives_text: day.objectivesText || null,
    post_training_session: day.postTrainingSession || null,
    after_text: day.after || null,
    notes: day.notes || null,
    session_id: day.sessionId || null,
    updated_at: new Date().toISOString()
  };
}

function toConceptRows(days: MicrocycleDay[]): Record<string, unknown>[] {
  const payload: Record<string, unknown>[] = [];
  days.forEach((day) => {
    day.concepts.forEach((concept, index) => {
      payload.push({
        id: concept.id,
        microcycle_day_id: day.id,
        sort_order: concept.sortOrder ?? index,
        concept: concept.concept,
        objective: concept.objective || '',
        updated_at: new Date().toISOString()
      });
    });
  });
  return payload;
}

function toAvailabilityRows(rows: MicrocyclePlayerAvailability[]): Record<string, unknown>[] {
  return rows.map((entry) => ({
    id: entry.id,
    microcycle_id: entry.microcycleId,
    category: entry.category,
    player_id: entry.playerId || null,
    player_name_snapshot: entry.playerNameSnapshot,
    notes: entry.notes || null,
    updated_at: new Date().toISOString()
  }));
}

export function createMicrocycleDayTemplate(startDate: string, dayOrder: number): MicrocycleDay {
  const date = new Date(`${startDate}T00:00:00`);
  date.setDate(date.getDate() + dayOrder);
  const label = date.toLocaleDateString('en-US', { weekday: 'short' });

  return {
    id: crypto.randomUUID(),
    microcycleId: '',
    dayOrder,
    dayDate: date.toISOString().slice(0, 10),
    dayLabel: label,
    trainingSession: '',
    sessionType: '',
    mdLabel: '',
    duration: '',
    load: '',
    stage: '',
    before: '',
    preTrainingSession: '',
    warmUp: '',
    pitch: '',
    objectivesText: '',
    postTrainingSession: '',
    after: '',
    notes: '',
    concepts: []
  };
}

export async function listMicrocycles(teamId?: string | null): Promise<Microcycle[]> {
  let query = getClient()
    .from(MICROCYCLES_TABLE)
    .select(`
      *,
      microcycle_days (
        *,
        microcycle_day_concepts (*)
      ),
      microcycle_player_availability (*)
    `)
    .order('start_date', { ascending: false });

  if (teamId && teamId.trim()) {
    query = query.eq('team_id', teamId.trim());
  }

  const { data, error } = await query;

  if (error) throw error;
  return ((data || []) as MicrocycleRow[]).map(toMicrocycle);
}

export function subscribeToMicrocycles(
  callback: (rows: Microcycle[]) => void,
  onError?: (error: unknown) => void,
  teamId?: string | null
): () => void {
  const client = getClient();
  let active = true;
  let channel: RealtimeChannel | null = null;

  const loadAndEmit = async () => {
    try {
      const rows = await listMicrocycles(teamId);
      if (active) callback(rows);
    } catch (error) {
      if (active && onError) onError(error);
    }
  };

  void loadAndEmit();

  channel = client
    .channel(`u17-microcycles-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: MICROCYCLES_TABLE }, () => {
      void loadAndEmit();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: MICROCYCLE_DAYS_TABLE }, () => {
      void loadAndEmit();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: MICROCYCLE_CONCEPTS_TABLE }, () => {
      void loadAndEmit();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: MICROCYCLE_AVAILABILITY_TABLE }, () => {
      void loadAndEmit();
    })
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR' && onError) {
        onError(new Error('Supabase realtime channel error for microcycles'));
      }
    });

  return () => {
    active = false;
    if (channel) void client.removeChannel(channel);
  };
}

export async function createMicrocycle(input: CreateMicrocycleInput): Promise<Microcycle> {
  const payload = {
    team_id: input.teamId,
    team_name: input.teamName,
    name: input.name,
    week_number: input.weekNumber ?? null,
    start_date: input.startDate,
    end_date: input.endDate,
    status: input.status || 'draft',
    team_total: input.teamTotal ?? null,
    notes: input.notes || null
  };

  const { data, error } = await getClient()
    .from(MICROCYCLES_TABLE)
    .insert(payload)
    .select('*')
    .single();

  if (error) throw error;

  const base = toMicrocycle(data as MicrocycleRow);
  return {
    ...base,
    days: [],
    availability: []
  };
}

export async function saveMicrocycle(microcycle: Microcycle): Promise<void> {
  const client = getClient();

  const { error: cycleErr } = await client
    .from(MICROCYCLES_TABLE)
    .upsert(toMicrocycleRow(microcycle), { onConflict: 'id' });

  if (cycleErr) throw cycleErr;

  const dayIds = microcycle.days.map((day) => day.id);
  if (dayIds.length > 0) {
    const { error: deleteConceptsErr } = await client
      .from(MICROCYCLE_CONCEPTS_TABLE)
      .delete()
      .in('microcycle_day_id', dayIds);

    if (deleteConceptsErr) throw deleteConceptsErr;
  }

  const { error: deleteDaysErr } = await client
    .from(MICROCYCLE_DAYS_TABLE)
    .delete()
    .eq('microcycle_id', microcycle.id);

  if (deleteDaysErr) throw deleteDaysErr;

  const { error: deleteAvailabilityErr } = await client
    .from(MICROCYCLE_AVAILABILITY_TABLE)
    .delete()
    .eq('microcycle_id', microcycle.id);

  if (deleteAvailabilityErr) throw deleteAvailabilityErr;

  if (microcycle.days.length > 0) {
    const dayRows = microcycle.days.map((day) => toDayRow(day));
    const { error: insertDaysErr } = await client
      .from(MICROCYCLE_DAYS_TABLE)
      .insert(dayRows);

    if (insertDaysErr) throw insertDaysErr;

    const conceptRows = toConceptRows(microcycle.days);
    if (conceptRows.length > 0) {
      const { error: insertConceptsErr } = await client
        .from(MICROCYCLE_CONCEPTS_TABLE)
        .insert(conceptRows);
      if (insertConceptsErr) throw insertConceptsErr;
    }
  }

  if (microcycle.availability.length > 0) {
    const availabilityRows = toAvailabilityRows(microcycle.availability);
    const { error: insertAvailabilityErr } = await client
      .from(MICROCYCLE_AVAILABILITY_TABLE)
      .insert(availabilityRows);

    if (insertAvailabilityErr) throw insertAvailabilityErr;
  }
}

export async function deleteMicrocycle(microcycleId: string): Promise<void> {
  const { error } = await getClient()
    .from(MICROCYCLES_TABLE)
    .delete()
    .eq('id', microcycleId);

  if (error) throw error;
}
