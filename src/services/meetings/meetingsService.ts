import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../../supabaseClient';
import type {
  Meeting,
  MeetingAttendee,
  MeetingActionItem,
  MeetingType,
  ActionItemStatus,
} from '../../types';

// ---------------------------------------------------------------------------
// DB row types
// ---------------------------------------------------------------------------

interface MeetingRow {
  id: string;
  title: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  meeting_type: MeetingType;
  organizer_email: string | null;
  topic: string;
  agenda: string;
  summary: string;
  key_points: string[];
  decisions: string[];
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

interface AttendeeRow {
  id: string;
  meeting_id: string;
  email: string;
  display_name: string | null;
}

interface ActionItemRow {
  id: string;
  meeting_id: string;
  description: string;
  assigned_to: string | null;
  due_date: string | null;
  status: ActionItemStatus;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

function meetingFromRow(
  row: MeetingRow,
  attendees: MeetingAttendee[],
  actionItems: MeetingActionItem[]
): Meeting {
  return {
    id: row.id,
    title: row.title,
    date: row.date,
    startTime: row.start_time ?? undefined,
    endTime: row.end_time ?? undefined,
    location: row.location ?? undefined,
    meetingType: row.meeting_type,
    organizerEmail: row.organizer_email ?? undefined,
    topic: row.topic,
    agenda: row.agenda,
    summary: row.summary,
    keyPoints: row.key_points ?? [],
    decisions: row.decisions ?? [],
    attendees,
    actionItems,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by ?? undefined,
    updatedBy: row.updated_by ?? undefined,
  };
}

function attendeeFromRow(row: AttendeeRow): MeetingAttendee {
  return {
    id: row.id,
    meetingId: row.meeting_id,
    email: row.email,
    displayName: row.display_name ?? undefined,
  };
}

function actionItemFromRow(row: ActionItemRow): MeetingActionItem {
  return {
    id: row.id,
    meetingId: row.meeting_id,
    description: row.description,
    assignedTo: row.assigned_to ?? undefined,
    dueDate: row.due_date ?? undefined,
    status: row.status,
    completedAt: row.completed_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Client guard
// ---------------------------------------------------------------------------

function getClient() {
  if (!supabase) throw new Error('Supabase client is not configured');
  return supabase;
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

async function fetchAttendees(meetingIds: string[]): Promise<Map<string, MeetingAttendee[]>> {
  if (meetingIds.length === 0) return new Map();
  const client = getClient();
  const { data, error } = await client
    .from('meeting_attendees')
    .select('*')
    .in('meeting_id', meetingIds);
  if (error) throw error;
  const map = new Map<string, MeetingAttendee[]>();
  (data as AttendeeRow[]).forEach((row) => {
    const list = map.get(row.meeting_id) ?? [];
    list.push(attendeeFromRow(row));
    map.set(row.meeting_id, list);
  });
  return map;
}

async function fetchActionItems(meetingIds: string[]): Promise<Map<string, MeetingActionItem[]>> {
  if (meetingIds.length === 0) return new Map();
  const client = getClient();
  const { data, error } = await client
    .from('meeting_action_items')
    .select('*')
    .in('meeting_id', meetingIds)
    .order('created_at', { ascending: true });
  if (error) throw error;
  const map = new Map<string, MeetingActionItem[]>();
  (data as ActionItemRow[]).forEach((row) => {
    const list = map.get(row.meeting_id) ?? [];
    list.push(actionItemFromRow(row));
    map.set(row.meeting_id, list);
  });
  return map;
}

async function listMeetings(): Promise<Meeting[]> {
  const client = getClient();
  const { data, error } = await client
    .from('meetings')
    .select('*')
    .order('date', { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as MeetingRow[];
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const [attendeesMap, actionItemsMap] = await Promise.all([
    fetchAttendees(ids),
    fetchActionItems(ids),
  ]);

  return rows.map((row) =>
    meetingFromRow(
      row,
      attendeesMap.get(row.id) ?? [],
      actionItemsMap.get(row.id) ?? []
    )
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Subscribe to the meetings list with Realtime updates.
 * Returns an unsubscribe function.
 */
export function subscribeMeetings(
  callback: (meetings: Meeting[]) => void,
  onError?: (error: unknown) => void
): () => void {
  const client = getClient();
  let active = true;
  let channel: RealtimeChannel | null = null;

  const loadAndEmit = async () => {
    try {
      const meetings = await listMeetings();
      if (active) callback(meetings);
    } catch (error) {
      if (active && onError) onError(error);
    }
  };

  void loadAndEmit();

  channel = client
    .channel('u17-meetings-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'meetings' }, () => {
      void loadAndEmit();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'meeting_attendees' }, () => {
      void loadAndEmit();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'meeting_action_items' }, () => {
      void loadAndEmit();
    })
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR' && onError) {
        onError(new Error('Meetings realtime channel error'));
      }
    });

  return () => {
    active = false;
    if (channel) {
      client.removeChannel(channel).catch(() => {});
      channel = null;
    }
  };
}

/**
 * Fetch a single meeting with attendees and action items.
 */
export async function getMeeting(id: string): Promise<Meeting | null> {
  const client = getClient();
  const { data, error } = await client
    .from('meetings')
    .select('*')
    .eq('id', id)
    .single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  const row = data as MeetingRow;
  const [attendeesMap, actionItemsMap] = await Promise.all([
    fetchAttendees([id]),
    fetchActionItems([id]),
  ]);
  return meetingFromRow(
    row,
    attendeesMap.get(id) ?? [],
    actionItemsMap.get(id) ?? []
  );
}

export interface CreateMeetingInput {
  title: string;
  date: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  meetingType: MeetingType;
  organizerEmail?: string;
  topic?: string;
  agenda?: string;
  summary?: string;
  keyPoints?: string[];
  decisions?: string[];
  attendeeEmails?: { email: string; displayName?: string }[];
  actionItems?: Omit<MeetingActionItem, 'id' | 'meetingId' | 'createdAt' | 'updatedAt'>[];
  createdBy: string;
}

/**
 * Create a meeting together with its attendees and action items.
 */
export async function createMeeting(input: CreateMeetingInput): Promise<Meeting> {
  const client = getClient();

  const { data: meetingData, error: meetingError } = await client
    .from('meetings')
    .insert({
      title: input.title,
      date: input.date,
      start_time: input.startTime ?? null,
      end_time: input.endTime ?? null,
      location: input.location ?? null,
      meeting_type: input.meetingType,
      organizer_email: input.organizerEmail ?? null,
      topic: input.topic ?? '',
      agenda: input.agenda ?? '',
      summary: input.summary ?? '',
      key_points: input.keyPoints ?? [],
      decisions: input.decisions ?? [],
      created_by: input.createdBy,
      updated_by: input.createdBy,
    })
    .select()
    .single();

  if (meetingError) throw meetingError;
  const row = meetingData as MeetingRow;
  const meetingId = row.id;

  const attendees: MeetingAttendee[] = [];
  if (input.attendeeEmails && input.attendeeEmails.length > 0) {
    const { data: attData, error: attError } = await client
      .from('meeting_attendees')
      .insert(
        input.attendeeEmails.map((a) => ({
          meeting_id: meetingId,
          email: a.email,
          display_name: a.displayName ?? null,
        }))
      )
      .select();
    if (attError) throw attError;
    (attData as AttendeeRow[]).forEach((r) => attendees.push(attendeeFromRow(r)));
  }

  const actionItems: MeetingActionItem[] = [];
  if (input.actionItems && input.actionItems.length > 0) {
    const { data: aiData, error: aiError } = await client
      .from('meeting_action_items')
      .insert(
        input.actionItems.map((ai) => ({
          meeting_id: meetingId,
          description: ai.description,
          assigned_to: ai.assignedTo ?? null,
          due_date: ai.dueDate ?? null,
          status: ai.status,
          completed_at: ai.completedAt ?? null,
        }))
      )
      .select();
    if (aiError) throw aiError;
    (aiData as ActionItemRow[]).forEach((r) => actionItems.push(actionItemFromRow(r)));
  }

  return meetingFromRow(row, attendees, actionItems);
}

export interface UpdateMeetingInput extends Partial<Omit<CreateMeetingInput, 'createdBy'>> {
  updatedBy: string;
}

/**
 * Update a meeting's core fields, replacing attendees and action items wholesale.
 */
export async function updateMeeting(id: string, input: UpdateMeetingInput): Promise<Meeting> {
  const client = getClient();

  const patch: Record<string, unknown> = { updated_by: input.updatedBy };
  if (input.title !== undefined) patch.title = input.title;
  if (input.date !== undefined) patch.date = input.date;
  if (input.startTime !== undefined) patch.start_time = input.startTime ?? null;
  if (input.endTime !== undefined) patch.end_time = input.endTime ?? null;
  if (input.location !== undefined) patch.location = input.location ?? null;
  if (input.meetingType !== undefined) patch.meeting_type = input.meetingType;
  if (input.organizerEmail !== undefined) patch.organizer_email = input.organizerEmail ?? null;
  if (input.topic !== undefined) patch.topic = input.topic;
  if (input.agenda !== undefined) patch.agenda = input.agenda;
  if (input.summary !== undefined) patch.summary = input.summary;
  if (input.keyPoints !== undefined) patch.key_points = input.keyPoints;
  if (input.decisions !== undefined) patch.decisions = input.decisions;

  const { data: meetingData, error: meetingError } = await client
    .from('meetings')
    .update(patch)
    .eq('id', id)
    .select()
    .single();

  if (meetingError) throw meetingError;
  const row = meetingData as MeetingRow;

  // Replace attendees if provided
  let attendees: MeetingAttendee[] = [];
  if (input.attendeeEmails !== undefined) {
    await client.from('meeting_attendees').delete().eq('meeting_id', id);
    if (input.attendeeEmails.length > 0) {
      const { data: attData, error: attError } = await client
        .from('meeting_attendees')
        .insert(
          input.attendeeEmails.map((a) => ({
            meeting_id: id,
            email: a.email,
            display_name: a.displayName ?? null,
          }))
        )
        .select();
      if (attError) throw attError;
      (attData as AttendeeRow[]).forEach((r) => attendees.push(attendeeFromRow(r)));
    }
  } else {
    const map = await fetchAttendees([id]);
    attendees = map.get(id) ?? [];
  }

  // Replace action items if provided
  let actionItems: MeetingActionItem[] = [];
  if (input.actionItems !== undefined) {
    await client.from('meeting_action_items').delete().eq('meeting_id', id);
    if (input.actionItems.length > 0) {
      const { data: aiData, error: aiError } = await client
        .from('meeting_action_items')
        .insert(
          input.actionItems.map((ai) => ({
            meeting_id: id,
            description: ai.description,
            assigned_to: ai.assignedTo ?? null,
            due_date: ai.dueDate ?? null,
            status: ai.status,
            completed_at: ai.completedAt ?? null,
          }))
        )
        .select();
      if (aiError) throw aiError;
      (aiData as ActionItemRow[]).forEach((r) => actionItems.push(actionItemFromRow(r)));
    }
  } else {
    const map = await fetchActionItems([id]);
    actionItems = map.get(id) ?? [];
  }

  return meetingFromRow(row, attendees, actionItems);
}

/**
 * Delete a meeting (attendees and action items cascade).
 */
export async function deleteMeeting(id: string): Promise<void> {
  const { error } = await getClient().from('meetings').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Update a single action item's status (e.g. mark as completed).
 */
export async function updateActionItemStatus(
  actionItemId: string,
  status: ActionItemStatus
): Promise<void> {
  const patch: Record<string, unknown> = { status };
  if (status === 'completed') {
    patch.completed_at = new Date().toISOString();
  } else {
    patch.completed_at = null;
  }
  const { error } = await getClient()
    .from('meeting_action_items')
    .update(patch)
    .eq('id', actionItemId);
  if (error) throw error;
}
