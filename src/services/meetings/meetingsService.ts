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
  team_id: string | null;
  title: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  meeting_type: MeetingType;
  organizer_user_id: string | null;
  topic: string;
  agenda: string;
  summary: string;
  key_points: string[];
  decisions: string[];
  created_at: string;
  updated_at: string;
  created_by_user_id: string | null;
  updated_by_user_id: string | null;
}

interface AttendeeRowWithUser {
  id: string;
  meeting_id: string;
  user_id: string;
  display_name: string | null;
  user_profiles: {
    email: string;
    display_name: string | null;
  } | null;
}

interface ActionItemRowWithUser {
  id: string;
  meeting_id: string;
  description: string;
  assigned_to_user_id: string | null;
  due_date: string | null;
  status: ActionItemStatus;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  user_profiles: {
    email: string;
    display_name: string | null;
  } | null;
}

export interface UserProfile {
  userId: string;
  email: string;
  displayName: string | null;
  isActive: boolean;
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

function meetingFromRow(
  row: MeetingRow,
  organizerUser: UserProfile | null,
  createdByUser: UserProfile | null,
  updatedByUser: UserProfile | null,
  attendees: MeetingAttendee[],
  actionItems: MeetingActionItem[]
): Meeting {
  return {
    id: row.id,
    teamId: row.team_id ?? undefined,
    title: row.title,
    date: row.date,
    startTime: row.start_time ?? undefined,
    endTime: row.end_time ?? undefined,
    location: row.location ?? undefined,
    meetingType: row.meeting_type,
    organizerUserId: row.organizer_user_id ?? undefined,
    organizerDisplayName: organizerUser?.displayName ?? undefined,
    organizerEmail: organizerUser?.email ?? undefined,
    topic: row.topic,
    agenda: row.agenda,
    summary: row.summary,
    keyPoints: row.key_points ?? [],
    decisions: row.decisions ?? [],
    attendees,
    actionItems,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdByUserId: row.created_by_user_id ?? undefined,
    createdByDisplayName: createdByUser?.displayName ?? undefined,
    createdByEmail: createdByUser?.email ?? undefined,
    updatedByUserId: row.updated_by_user_id ?? undefined,
    updatedByDisplayName: updatedByUser?.displayName ?? undefined,
    updatedByEmail: updatedByUser?.email ?? undefined,
  };
}

function attendeeFromRow(row: AttendeeRowWithUser): MeetingAttendee {
  return {
    id: row.id,
    meetingId: row.meeting_id,
    userId: row.user_id,
    displayName: row.display_name ?? undefined,
    userEmail: row.user_profiles?.email ?? undefined,
  };
}

function actionItemFromRow(row: ActionItemRowWithUser): MeetingActionItem {
  return {
    id: row.id,
    meetingId: row.meeting_id,
    description: row.description,
    assignedToUserId: row.assigned_to_user_id ?? undefined,
    assignedToDisplayName: row.user_profiles?.display_name ?? undefined,
    assignedToEmail: row.user_profiles?.email ?? undefined,
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

async function fetchUserProfiles(userIds: string[]): Promise<Map<string, UserProfile>> {
  if (userIds.length === 0) return new Map();
  const client = getClient();
  const { data, error } = await client
    .from('user_profiles')
    .select('user_id, email, display_name, is_active')
    .in('user_id', userIds);
  if (error) throw error;
  const map = new Map<string, UserProfile>();
  (data ?? []).forEach((row: any) => {
    map.set(row.user_id, {
      userId: row.user_id,
      email: row.email,
      displayName: row.display_name,
      isActive: row.is_active,
    });
  });
  return map;
}

async function fetchAttendees(meetingIds: string[]): Promise<Map<string, MeetingAttendee[]>> {
  if (meetingIds.length === 0) return new Map();
  const client = getClient();
  const { data, error } = await client
    .from('meeting_attendees')
    .select(`
      id,
      meeting_id,
      user_id,
      display_name,
      user_profiles!inner (
        email,
        display_name
      )
    `)
    .in('meeting_id', meetingIds);
  if (error) throw error;
  const map = new Map<string, MeetingAttendee[]>();
  (data as any[]).forEach((row: any) => {
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
    .select(`
      id,
      meeting_id,
      description,
      assigned_to_user_id,
      due_date,
      status,
      completed_at,
      created_at,
      updated_at,
      user_profiles (
        email,
        display_name
      )
    `)
    .in('meeting_id', meetingIds)
    .order('created_at', { ascending: true });
  if (error) throw error;
  const map = new Map<string, MeetingActionItem[]>();
  (data as any[]).forEach((row: any) => {
    const list = map.get(row.meeting_id) ?? [];
    list.push(actionItemFromRow(row));
    map.set(row.meeting_id, list);
  });
  return map;
}

async function listMeetings(): Promise<Meeting[]> {
  const client = getClient();
  const query = client
    .from('meetings')
    .select('*')
    .order('date', { ascending: false });

  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as MeetingRow[];
  if (rows.length === 0) return [];

  // Fetch all user profiles referenced in this batch
  const userIds = new Set<string>();
  rows.forEach((row) => {
    if (row.organizer_user_id) userIds.add(row.organizer_user_id);
    if (row.created_by_user_id) userIds.add(row.created_by_user_id);
    if (row.updated_by_user_id) userIds.add(row.updated_by_user_id);
  });

  const userMap = await fetchUserProfiles(Array.from(userIds));

  const ids = rows.map((r) => r.id);
  const [attendeesMap, actionItemsMap] = await Promise.all([
    fetchAttendees(ids),
    fetchActionItems(ids),
  ]);

  return rows.map((row) =>
    meetingFromRow(
      row,
      row.organizer_user_id ? userMap.get(row.organizer_user_id) ?? null : null,
      row.created_by_user_id ? userMap.get(row.created_by_user_id) ?? null : null,
      row.updated_by_user_id ? userMap.get(row.updated_by_user_id) ?? null : null,
      attendeesMap.get(row.id) ?? [],
      actionItemsMap.get(row.id) ?? []
    )
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * List all available users (active profiles).
 * Used to populate participant/assignee selectors.
 */
export async function listAvailableUsers(): Promise<UserProfile[]> {
  const client = getClient();
  const { data, error } = await client
    .from('user_profiles')
    .select('user_id, email, display_name, is_active')
    .eq('is_active', true)
    .order('display_name', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    userId: row.user_id,
    email: row.email,
    displayName: row.display_name,
    isActive: row.is_active,
  }));
}

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

  const userIds = new Set<string>();
  if (row.organizer_user_id) userIds.add(row.organizer_user_id);
  if (row.created_by_user_id) userIds.add(row.created_by_user_id);
  if (row.updated_by_user_id) userIds.add(row.updated_by_user_id);

  const userMap = await fetchUserProfiles(Array.from(userIds));

  const [attendeesMap, actionItemsMap] = await Promise.all([
    fetchAttendees([id]),
    fetchActionItems([id]),
  ]);
  return meetingFromRow(
    row,
    row.organizer_user_id ? userMap.get(row.organizer_user_id) ?? null : null,
    row.created_by_user_id ? userMap.get(row.created_by_user_id) ?? null : null,
    row.updated_by_user_id ? userMap.get(row.updated_by_user_id) ?? null : null,
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
  organizerUserId?: string;  // UUID FK to user_profiles
  topic?: string;
  agenda?: string;
  summary?: string;
  keyPoints?: string[];
  decisions?: string[];
  attendeeUserIds?: { userId: string; displayName?: string }[];  // UUIDs
  actionItems?: Omit<MeetingActionItem, 'id' | 'meetingId' | 'createdAt' | 'updatedAt'>[];
  createdByUserId: string;  // UUID FK to user_profiles
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
      organizer_user_id: input.organizerUserId ?? null,
      topic: input.topic ?? '',
      agenda: input.agenda ?? '',
      summary: input.summary ?? '',
      key_points: input.keyPoints ?? [],
      decisions: input.decisions ?? [],
      created_by_user_id: input.createdByUserId,
      updated_by_user_id: input.createdByUserId,
    })
    .select()
    .single();

  if (meetingError) throw meetingError;
  const row = meetingData as MeetingRow;
  const meetingId = row.id;

  // Fetch user profile info for display
  const userIds = new Set<string>([input.createdByUserId]);
  if (input.organizerUserId) userIds.add(input.organizerUserId);
  if (input.attendeeUserIds) {
    input.attendeeUserIds.forEach((a) => userIds.add(a.userId));
  }
  if (input.actionItems) {
    input.actionItems.forEach((ai) => {
      if (ai.assignedToUserId) userIds.add(ai.assignedToUserId);
    });
  }

  const userMap = await fetchUserProfiles(Array.from(userIds));

  const attendees: MeetingAttendee[] = [];
  if (input.attendeeUserIds && input.attendeeUserIds.length > 0) {
    const { data: attData, error: attError } = await client
      .from('meeting_attendees')
      .insert(
        input.attendeeUserIds.map((a) => ({
          meeting_id: meetingId,
          user_id: a.userId,
          display_name: a.displayName ?? userMap.get(a.userId)?.displayName ?? null,
        }))
      )
      .select(`
        id,
        meeting_id,
        user_id,
        display_name,
        user_profiles!inner (
          email,
          display_name
        )
      `);
    if (attError) throw attError;
    (attData as any[]).forEach((r: any) => attendees.push(attendeeFromRow(r)));
  }

  const actionItems: MeetingActionItem[] = [];
  if (input.actionItems && input.actionItems.length > 0) {
    const { data: aiData, error: aiError } = await client
      .from('meeting_action_items')
      .insert(
        input.actionItems.map((ai) => ({
          meeting_id: meetingId,
          description: ai.description,
          assigned_to_user_id: ai.assignedToUserId ?? null,
          due_date: ai.dueDate ?? null,
          status: ai.status,
          completed_at: ai.completedAt ?? null,
        }))
      )
      .select(`
        id,
        meeting_id,
        description,
        assigned_to_user_id,
        due_date,
        status,
        completed_at,
        created_at,
        updated_at,
        user_profiles!inner (
          email,
          display_name
        )
      `);
    if (aiError) throw aiError;
    (aiData as any[]).forEach((r: any) => actionItems.push(actionItemFromRow(r)));
  }

  return meetingFromRow(
    row,
    input.organizerUserId ? userMap.get(input.organizerUserId) ?? null : null,
    userMap.get(input.createdByUserId) ?? null,
    userMap.get(input.createdByUserId) ?? null,
    attendees,
    actionItems
  );
}

export interface UpdateMeetingInput extends Partial<Omit<CreateMeetingInput, 'createdByUserId'>> {
  updatedByUserId: string;  // UUID FK to user_profiles
}

/**
 * Update a meeting's core fields, replacing attendees and action items wholesale.
 */
export async function updateMeeting(id: string, input: UpdateMeetingInput): Promise<Meeting> {
  const client = getClient();

  const patch: Record<string, unknown> = { updated_by_user_id: input.updatedByUserId };
  if (input.title !== undefined) patch.title = input.title;
  if (input.date !== undefined) patch.date = input.date;
  if (input.startTime !== undefined) patch.start_time = input.startTime ?? null;
  if (input.endTime !== undefined) patch.end_time = input.endTime ?? null;
  if (input.location !== undefined) patch.location = input.location ?? null;
  if (input.meetingType !== undefined) patch.meeting_type = input.meetingType;
  if (input.organizerUserId !== undefined) patch.organizer_user_id = input.organizerUserId ?? null;
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

  // Fetch all relevant user IDs
  const userIds = new Set<string>([input.updatedByUserId]);
  if (row.organizer_user_id) userIds.add(row.organizer_user_id);
  if (row.created_by_user_id) userIds.add(row.created_by_user_id);

  // Replace attendees if provided
  let attendees: MeetingAttendee[] = [];
  if (input.attendeeUserIds !== undefined) {
    if (input.attendeeUserIds.length > 0) {
      input.attendeeUserIds.forEach((a) => userIds.add(a.userId));
    }
    await client.from('meeting_attendees').delete().eq('meeting_id', id);
    if (input.attendeeUserIds.length > 0) {
      const userMap = await fetchUserProfiles(Array.from(userIds));
      const { data: attData, error: attError } = await client
        .from('meeting_attendees')
        .insert(
          input.attendeeUserIds.map((a) => ({
            meeting_id: id,
            user_id: a.userId,
            display_name: a.displayName ?? userMap.get(a.userId)?.displayName ?? null,
          }))
        )
        .select(`
          id,
          meeting_id,
          user_id,
          display_name,
          user_profiles!inner (
            email,
            display_name
          )
        `);
      if (attError) throw attError;
      (attData as any[]).forEach((r: any) => attendees.push(attendeeFromRow(r)));
    }
  } else {
    const map = await fetchAttendees([id]);
    attendees = map.get(id) ?? [];
  }

  // Replace action items if provided
  let actionItems: MeetingActionItem[] = [];
  if (input.actionItems !== undefined) {
    if (input.actionItems.length > 0) {
      input.actionItems.forEach((ai) => {
        if (ai.assignedToUserId) userIds.add(ai.assignedToUserId);
      });
    }
    await client.from('meeting_action_items').delete().eq('meeting_id', id);
    if (input.actionItems.length > 0) {
      const { data: aiData, error: aiError } = await client
        .from('meeting_action_items')
        .insert(
          input.actionItems.map((ai) => ({
            meeting_id: id,
            description: ai.description,
            assigned_to_user_id: ai.assignedToUserId ?? null,
            due_date: ai.dueDate ?? null,
            status: ai.status,
            completed_at: ai.completedAt ?? null,
          }))
        )
        .select(`
          id,
          meeting_id,
          description,
          assigned_to_user_id,
          due_date,
          status,
          completed_at,
          created_at,
          updated_at,
          user_profiles!inner (
            email,
            display_name
          )
        `);
      if (aiError) throw aiError;
      (aiData as any[]).forEach((r: any) => actionItems.push(actionItemFromRow(r)));
    }
  } else {
    const map = await fetchActionItems([id]);
    actionItems = map.get(id) ?? [];
  }

  const userMap = await fetchUserProfiles(Array.from(userIds));

  return meetingFromRow(
    row,
    row.organizer_user_id ? userMap.get(row.organizer_user_id) ?? null : null,
    row.created_by_user_id ? userMap.get(row.created_by_user_id) ?? null : null,
    userMap.get(input.updatedByUserId) ?? null,
    attendees,
    actionItems
  );
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
