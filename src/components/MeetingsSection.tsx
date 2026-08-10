import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  MessageSquare,
  Plus,
  Search,
  Filter,
  Calendar,
  Clock,
  MapPin,
  Users,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Trash2,
  CheckCircle2,
  Circle,
  XCircle,
  AlertCircle,
  Loader2,
  X,
  Save,
  LayoutGrid,
  ListChecks,
  FileText,
  Target,
  Lightbulb,
} from 'lucide-react';
import type { Meeting, MeetingType, MeetingAttendee, MeetingActionItem, ActionItemStatus } from '../types';
import {
  subscribeMeetings,
  createMeeting,
  updateMeeting,
  deleteMeeting,
  updateActionItemStatus,
  listAvailableUsers,
  type UserProfile,
} from '../services/meetings/meetingsService';
import type { AppUser } from '../services/auth/authService';
import { isUserAdmin } from '../utils/permissions';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MEETING_TYPE_LABELS: Record<MeetingType, string> = {
  staff_meeting: 'Staff Meeting',
  coaching_meeting: 'Coaching Meeting',
  player_meeting: 'Player Meeting',
  performance_meeting: 'Performance Meeting',
  medical_physio_meeting: 'Medical / Physio Meeting',
  recruitment_meeting: 'Recruitment Meeting',
  other: 'Other',
};

const MEETING_TYPE_COLORS: Record<MeetingType, { bg: string; text: string; border: string }> = {
  staff_meeting:        { bg: 'bg-indigo-50',  text: 'text-indigo-700',  border: 'border-indigo-200' },
  coaching_meeting:     { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  player_meeting:       { bg: 'bg-sky-50',     text: 'text-sky-700',     border: 'border-sky-200' },
  performance_meeting:  { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200' },
  medical_physio_meeting: { bg: 'bg-rose-50',  text: 'text-rose-700',    border: 'border-rose-200' },
  recruitment_meeting:  { bg: 'bg-violet-50',  text: 'text-violet-700',  border: 'border-violet-200' },
  other:                { bg: 'bg-slate-100',  text: 'text-slate-600',   border: 'border-slate-300' },
};

const ACTION_STATUS_CONFIG: Record<ActionItemStatus, { label: string; icon: React.ReactNode; color: string }> = {
  pending:     { label: 'Pending',     icon: <Circle className="w-4 h-4" />,       color: 'text-amber-600' },
  in_progress: { label: 'In Progress', icon: <AlertCircle className="w-4 h-4" />,  color: 'text-blue-600' },
  completed:   { label: 'Completed',   icon: <CheckCircle2 className="w-4 h-4" />, color: 'text-emerald-600' },
  cancelled:   { label: 'Cancelled',   icon: <XCircle className="w-4 h-4" />,      color: 'text-slate-400' },
};

const ALL_MEETING_TYPES: MeetingType[] = [
  'staff_meeting', 'coaching_meeting', 'player_meeting',
  'performance_meeting', 'medical_physio_meeting', 'recruitment_meeting', 'other',
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface MeetingsSectionProps {
  currentUser: AppUser;
  onBack?: () => void;
}

// ---------------------------------------------------------------------------
// Draft types for the form
// ---------------------------------------------------------------------------

interface ActionItemDraft {
  id: string; // local-only draft id
  description: string;
  assignedToUserId: string;  // UUID, not email
  dueDate: string;
  status: ActionItemStatus;
}

interface MeetingFormState {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  meetingType: MeetingType;
  organizerUserId: string;  // UUID, not email
  topic: string;
  agenda: string;
  summary: string;
  keyPoints: string;     // newline-separated
  decisions: string;     // newline-separated
  attendeeUserIds: string[];  // Array of UUIDs, not emails
  actionItems: ActionItemDraft[];
}

function emptyForm(currentUserId: string): MeetingFormState {
  return {
    title: '',
    date: new Date().toISOString().split('T')[0],
    startTime: '',
    endTime: '',
    location: '',
    meetingType: 'staff_meeting',
    organizerUserId: currentUserId,  // Assume organizer is current user
    topic: '',
    agenda: '',
    summary: '',
    keyPoints: '',
    decisions: '',
    attendeeUserIds: [],  // Start with no attendees
    actionItems: [],
  };
}

function meetingToForm(m: Meeting): MeetingFormState {
  return {
    title: m.title,
    date: m.date,
    startTime: m.startTime ?? '',
    endTime: m.endTime ?? '',
    location: m.location ?? '',
    meetingType: m.meetingType,
    organizerUserId: m.organizerUserId ?? '',
    topic: m.topic,
    agenda: m.agenda,
    summary: m.summary,
    keyPoints: m.keyPoints.join('\n'),
    decisions: m.decisions.join('\n'),
    attendeeUserIds: m.attendees.map((a) => a.userId),
    actionItems: m.actionItems.map((ai) => ({
      id: ai.id,
      description: ai.description,
      assignedToUserId: ai.assignedToUserId ?? '',
      dueDate: ai.dueDate ?? '',
      status: ai.status,
    })),
  };
}

function parseLines(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TypeBadge({ type }: { type: MeetingType }) {
  const c = MEETING_TYPE_COLORS[type];
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${c.bg} ${c.text} ${c.border}`}>
      {MEETING_TYPE_LABELS[type]}
    </span>
  );
}

function ActionStatusBadge({ status }: { status: ActionItemStatus }) {
  const cfg = ACTION_STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${cfg.color}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">
      {children}
    </h3>
  );
}

// ---------------------------------------------------------------------------
// Meeting Form Modal
// ---------------------------------------------------------------------------

interface MeetingFormModalProps {
  initial?: Meeting | null;
  currentUserId: string;
  availableUsers: UserProfile[];
  loadingUsers: boolean;
  usersLoadError: string | null;
  onSave: (form: MeetingFormState) => Promise<void>;
  onClose: () => void;
}

const MeetingFormModal: React.FC<MeetingFormModalProps> = ({ initial, currentUserId, availableUsers, loadingUsers, usersLoadError, onSave, onClose }) => {
  const [form, setForm] = useState<MeetingFormState>(() => initial ? meetingToForm(initial) : emptyForm(currentUserId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const draftIdCounter = useRef(0);

  const set = <K extends keyof MeetingFormState>(key: K, value: MeetingFormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const toggleAttendee = (userId: string) => {
    setForm((prev) => ({
      ...prev,
      attendeeUserIds: prev.attendeeUserIds.includes(userId)
        ? prev.attendeeUserIds.filter((id) => id !== userId)
        : [...prev.attendeeUserIds, userId],
    }));
  };

  const addActionItem = () => {
    draftIdCounter.current += 1;
    setForm((prev) => ({
      ...prev,
      actionItems: [
        ...prev.actionItems,
        {
          id: `draft-${draftIdCounter.current}`,
          description: '',
          assignedToUserId: '',
          dueDate: '',
          status: 'pending' as ActionItemStatus,
        },
      ],
    }));
  };

  const removeActionItem = (id: string) =>
    setForm((prev) => ({
      ...prev,
      actionItems: prev.actionItems.filter((ai) => ai.id !== id),
    }));

  const updateActionItem = (id: string, patch: Partial<ActionItemDraft>) =>
    setForm((prev) => ({
      ...prev,
      actionItems: prev.actionItems.map((ai) => (ai.id === id ? { ...ai, ...patch } : ai)),
    }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { setError('Title is required.'); return; }
    if (!form.date) { setError('Date is required.'); return; }
    for (const ai of form.actionItems) {
      if (!ai.description.trim()) { setError('All action items must have a description.'); return; }
    }
    setSaving(true);
    setError('');
    try {
      await onSave(form);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save meeting.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl my-6">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-violet-50 border border-violet-200 text-violet-700">
              <MessageSquare className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-slate-800">
              {initial ? 'Edit Meeting' : 'New Meeting'}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Identification */}
          <div className="space-y-4">
            <SectionLabel>Identification</SectionLabel>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Title *</label>
              <input
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
                placeholder="e.g. Pre-season Staff Review"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Date *</label>
                <input
                  type="date"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                  value={form.date}
                  onChange={(e) => set('date', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Start Time</label>
                <input
                  type="time"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                  value={form.startTime}
                  onChange={(e) => set('startTime', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">End Time</label>
                <input
                  type="time"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                  value={form.endTime}
                  onChange={(e) => set('endTime', e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Location</label>
                <input
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                  value={form.location}
                  onChange={(e) => set('location', e.target.value)}
                  placeholder="e.g. Conference Room A"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Meeting Type</label>
                <select
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white"
                  value={form.meetingType}
                  onChange={(e) => set('meetingType', e.target.value as MeetingType)}
                >
                  {ALL_MEETING_TYPES.map((t) => (
                    <option key={t} value={t}>{MEETING_TYPE_LABELS[t]}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Organizer</label>
                {loadingUsers ? (
                  <div className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-400 flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading users…
                  </div>
                ) : usersLoadError ? (
                  <div className="w-full border border-rose-200 rounded-xl px-3 py-2 text-xs text-rose-500">{usersLoadError}</div>
                ) : (
                  <select
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white"
                    value={form.organizerUserId}
                    onChange={(e) => set('organizerUserId', e.target.value)}
                  >
                    <option value="">Select organizer…</option>
                    {availableUsers.map((u) => (
                      <option key={u.userId} value={u.userId}>
                        {u.displayName || u.email}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Topic</label>
                <input
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                  value={form.topic}
                  onChange={(e) => set('topic', e.target.value)}
                  placeholder="e.g. Tactical preparation for next match"
                />
              </div>
            </div>
          </div>

          {/* Participants */}
          <div>
            <SectionLabel>Participants</SectionLabel>
            <div className="space-y-2">
              {loadingUsers ? (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center gap-2 text-xs text-slate-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading users…
                </div>
              ) : usersLoadError ? (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-600">
                  <p className="font-semibold">Could not load users</p>
                  <p className="mt-0.5 text-rose-500">{usersLoadError}</p>
                </div>
              ) : availableUsers.length === 0 ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
                  No active users found in user_profiles. Run the DB migrations and ensure user_profiles is populated.
                </div>
              ) : (
                <>
                  <p className="text-xs text-slate-500">Select attendees:</p>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 max-h-48 overflow-y-auto space-y-2">
                    {availableUsers.map((user) => (
                      <label key={user.userId} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.attendeeUserIds.includes(user.userId)}
                          onChange={() => toggleAttendee(user.userId)}
                          className="w-4 h-4 rounded border-slate-300 text-violet-600 focus:ring-violet-300"
                        />
                        <span className="text-sm text-slate-700">
                          {user.displayName || user.email}
                          {user.displayName && <span className="text-xs text-slate-500 ml-1">({user.email})</span>}
                        </span>
                      </label>
                    ))}
                  </div>
                  {form.attendeeUserIds.length > 0 && (
                    <p className="text-xs text-slate-500">
                      {form.attendeeUserIds.length} attendee{form.attendeeUserIds.length !== 1 ? 's' : ''} selected
                    </p>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="space-y-4">
            <SectionLabel>Content</SectionLabel>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Agenda</label>
              <textarea
                rows={3}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                value={form.agenda}
                onChange={(e) => set('agenda', e.target.value)}
                placeholder="Meeting agenda points..."
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Summary</label>
              <textarea
                rows={3}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                value={form.summary}
                onChange={(e) => set('summary', e.target.value)}
                placeholder="Brief summary of what was discussed..."
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Key Points <span className="font-normal text-slate-400">(one per line)</span>
                </label>
                <textarea
                  rows={4}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                  value={form.keyPoints}
                  onChange={(e) => set('keyPoints', e.target.value)}
                  placeholder={'Intensity review agreed\nNew training schedule confirmed'}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Decisions <span className="font-normal text-slate-400">(one per line)</span>
                </label>
                <textarea
                  rows={4}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                  value={form.decisions}
                  onChange={(e) => set('decisions', e.target.value)}
                  placeholder={'Increase gym sessions to 3/week\nAdd video review Fridays'}
                />
              </div>
            </div>
          </div>

          {/* Action Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <SectionLabel>Action Items</SectionLabel>
              <button
                type="button"
                onClick={addActionItem}
                className="flex items-center gap-1 text-xs font-bold text-violet-600 hover:text-violet-700 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add item
              </button>
            </div>
            {form.actionItems.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No action items. Click "Add item" to create one.</p>
            ) : (
              <div className="space-y-3">
                {form.actionItems.map((ai) => (
                  <div key={ai.id} className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <input
                        className="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white"
                        placeholder="Action item description *"
                        value={ai.description}
                        onChange={(e) => updateActionItem(ai.id, { description: e.target.value })}
                      />
                      <button
                        type="button"
                        onClick={() => removeActionItem(ai.id)}
                        className="text-slate-400 hover:text-rose-500 shrink-0 mt-1.5 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <select
                        className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white"
                        value={ai.assignedToUserId}
                        onChange={(e) => updateActionItem(ai.id, { assignedToUserId: e.target.value })}
                      >
                        <option value="">Unassigned</option>
                        {availableUsers.map((u) => (
                          <option key={u.userId} value={u.userId}>
                            {u.displayName || u.email}
                          </option>
                        ))}
                      </select>
                      <input
                        type="date"
                        className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white"
                        value={ai.dueDate}
                        onChange={(e) => updateActionItem(ai.id, { dueDate: e.target.value })}
                      />
                      <select
                        className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white"
                        value={ai.status}
                        onChange={(e) => updateActionItem(ai.id, { status: e.target.value as ActionItemStatus })}
                      >
                        <option value="pending">Pending</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && (
            <p className="text-sm text-rose-600 font-semibold bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 text-sm font-bold text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-60 rounded-xl cursor-pointer transition-colors shadow-sm"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving…' : 'Save Meeting'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Meeting Detail View
// ---------------------------------------------------------------------------

interface MeetingDetailProps {
  meeting: Meeting;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onBack: () => void;
  onStatusChange: (actionItemId: string, status: ActionItemStatus) => Promise<void>;
}

const MeetingDetail: React.FC<MeetingDetailProps> = ({
  meeting, canEdit, canDelete, onEdit, onDelete, onBack, onStatusChange,
}) => {
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const handleStatusToggle = async (ai: MeetingActionItem) => {
    const next: ActionItemStatus = ai.status === 'completed' ? 'pending' : 'completed';
    setUpdatingId(ai.id);
    try {
      await onStatusChange(ai.id, next);
    } finally {
      setUpdatingId(null);
    }
  };

  const pendingCount = meeting.actionItems.filter((ai) => ai.status === 'pending' || ai.status === 'in_progress').length;
  const completedCount = meeting.actionItems.filter((ai) => ai.status === 'completed').length;

  return (
    <div className="space-y-6">
      {/* Back bar */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-700 cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" /> Back to Meetings
        </button>
        <div className="flex items-center gap-2">
          {canEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-xl cursor-pointer transition-colors"
            >
              <Edit2 className="w-3.5 h-3.5" /> Edit
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl cursor-pointer transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          )}
        </div>
      </div>

      {/* Title card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <TypeBadge type={meeting.meetingType} />
          {pendingCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-amber-50 text-amber-700 border border-amber-200">
              <AlertCircle className="w-3 h-3" /> {pendingCount} pending
            </span>
          )}
        </div>
        <h1 className="text-xl font-black text-[#002142]">{meeting.title}</h1>
        {meeting.topic && (
          <p className="text-sm text-slate-600 font-medium">{meeting.topic}</p>
        )}
        <div className="flex flex-wrap gap-4 text-xs text-slate-500 font-medium pt-1">
          <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-slate-400" />{new Date(meeting.date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
          {(meeting.startTime || meeting.endTime) && (
            <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-slate-400" />{meeting.startTime}{meeting.endTime ? ` – ${meeting.endTime}` : ''}</span>
          )}
          {meeting.location && (
            <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-slate-400" />{meeting.location}</span>
          )}
          {meeting.organizerEmail && (
            <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5 text-slate-400" />Org: {meeting.organizerDisplayName || meeting.organizerEmail}</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Content */}
        <div className="lg:col-span-2 space-y-5">

          {/* Agenda */}
          {meeting.agenda && (
            <DetailCard icon={<FileText className="w-4 h-4" />} title="Agenda">
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{meeting.agenda}</p>
            </DetailCard>
          )}

          {/* Summary */}
          {meeting.summary && (
            <DetailCard icon={<LayoutGrid className="w-4 h-4" />} title="Summary">
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{meeting.summary}</p>
            </DetailCard>
          )}

          {/* Key Points */}
          {meeting.keyPoints.length > 0 && (
            <DetailCard icon={<Lightbulb className="w-4 h-4" />} title="Key Points">
              <ul className="space-y-1.5">
                {meeting.keyPoints.map((kp, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="mt-1 w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />
                    {kp}
                  </li>
                ))}
              </ul>
            </DetailCard>
          )}

          {/* Decisions */}
          {meeting.decisions.length > 0 && (
            <DetailCard icon={<Target className="w-4 h-4" />} title="Decisions">
              <ul className="space-y-1.5">
                {meeting.decisions.map((d, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                    {d}
                  </li>
                ))}
              </ul>
            </DetailCard>
          )}

          {/* Action Items */}
          <DetailCard icon={<ListChecks className="w-4 h-4" />} title={`Action Items (${completedCount}/${meeting.actionItems.length} done)`}>
            {meeting.actionItems.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No action items for this meeting.</p>
            ) : (
              <div className="space-y-2">
                {meeting.actionItems.map((ai) => (
                  <div
                    key={ai.id}
                    className={`flex items-start gap-3 p-3 rounded-xl border ${ai.status === 'completed' ? 'bg-emerald-50 border-emerald-200' : ai.status === 'cancelled' ? 'bg-slate-50 border-slate-200 opacity-60' : 'bg-white border-slate-200'}`}
                  >
                    <button
                      type="button"
                      disabled={!!updatingId || ai.status === 'cancelled'}
                      onClick={() => handleStatusToggle(ai)}
                      className={`mt-0.5 shrink-0 cursor-pointer ${ACTION_STATUS_CONFIG[ai.status].color} disabled:opacity-50 disabled:cursor-default`}
                    >
                      {updatingId === ai.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        ACTION_STATUS_CONFIG[ai.status].icon
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${ai.status === 'completed' ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                        {ai.description}
                      </p>
                      <div className="flex flex-wrap gap-3 mt-1 text-[11px] text-slate-500">
                        {ai.assignedToEmail && <span>→ {ai.assignedToDisplayName || ai.assignedToEmail}</span>}
                        {ai.dueDate && <span>Due: {new Date(ai.dueDate + 'T12:00:00').toLocaleDateString('en-GB')}</span>}
                        <ActionStatusBadge status={ai.status} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DetailCard>
        </div>

        {/* Right column: Attendees + meta */}
        <div className="space-y-5">
          <DetailCard icon={<Users className="w-4 h-4" />} title={`Attendees (${meeting.attendees.length})`}>
            {meeting.attendees.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No attendees recorded.</p>
            ) : (
              <ul className="space-y-2">
                {meeting.attendees.map((a) => (
                  <li key={a.id} className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-xs font-bold border border-violet-200 shrink-0">
                      {(a.displayName || a.userEmail).substring(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      {a.displayName && <p className="text-xs font-semibold text-slate-700 truncate">{a.displayName}</p>}
                      <p className="text-[11px] text-slate-500 truncate">{a.userEmail}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </DetailCard>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs text-slate-500 space-y-1.5">
            <p><span className="font-semibold text-slate-600">Created by:</span> {meeting.createdByEmail ?? meeting.createdByDisplayName ?? '—'}</p>
            <p><span className="font-semibold text-slate-600">Created:</span> {new Date(meeting.createdAt).toLocaleString('en-GB')}</p>
            <p><span className="font-semibold text-slate-600">Last updated:</span> {new Date(meeting.updatedAt).toLocaleString('en-GB')}</p>
            {meeting.updatedByEmail && <p><span className="font-semibold text-slate-600">Updated by:</span> {meeting.updatedByEmail}</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

function DetailCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-violet-600">{icon}</span>
        <h3 className="text-sm font-bold text-slate-700">{title}</h3>
      </div>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Meeting List Card
// ---------------------------------------------------------------------------

function MeetingCard({
  meeting,
  onClick,
}: {
  meeting: Meeting;
  onClick: () => void;
}) {
  const pending = meeting.actionItems.filter((ai) => ai.status === 'pending' || ai.status === 'in_progress').length;
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:border-violet-300 hover:shadow-md transition-all group cursor-pointer"
    >
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <TypeBadge type={meeting.meetingType} />
        {pending > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            <AlertCircle className="w-3 h-3" /> {pending} open
          </span>
        )}
      </div>
      <h3 className="text-sm font-bold text-[#002142] group-hover:text-violet-700 transition-colors mb-1 truncate">
        {meeting.title}
      </h3>
      {meeting.topic && (
        <p className="text-xs text-slate-500 truncate mb-2">{meeting.topic}</p>
      )}
      {meeting.summary && (
        <p className="text-xs text-slate-400 line-clamp-2 mb-2">{meeting.summary}</p>
      )}
      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 border-t border-slate-100 pt-2.5 mt-2">
        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(meeting.date + 'T12:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
        {meeting.startTime && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{meeting.startTime}</span>}
        {meeting.attendees.length > 0 && <span className="flex items-center gap-1"><Users className="w-3 h-3" />{meeting.attendees.length} attendee{meeting.attendees.length !== 1 ? 's' : ''}</span>}
        <span className="ml-auto flex items-center gap-1 text-violet-500 font-semibold group-hover:translate-x-1 transition-transform">
          Open <ChevronRight className="w-3.5 h-3.5" />
        </span>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main Section
// ---------------------------------------------------------------------------

export const MeetingsSection: React.FC<MeetingsSectionProps> = ({ currentUser, onBack }) => {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<MeetingType | 'all'>('all');

  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);

  const [availableUsers, setAvailableUsers] = useState<UserProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [usersLoadError, setUsersLoadError] = useState<string | null>(null);

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const userEmail = currentUser.email ?? '';
  const userId = currentUser.uid ?? '';  // Get UUID from Supabase Auth
  const userIsAdminFlag = isUserAdmin(userEmail);

  // Load available users
  useEffect(() => {
    (async () => {
      try {
        const users = await listAvailableUsers();
        setAvailableUsers(users);
        setLoadingUsers(false);
      } catch (err: unknown) {
        console.error('[Meetings] Failed to load users:', err);
        setUsersLoadError(err instanceof Error ? err.message : 'Error loading users');
        setLoadingUsers(false);
      }
    })();
  }, []);

  // Subscribe to meetings
  useEffect(() => {
    const unsubscribe = subscribeMeetings(
      (list) => {
        setMeetings(list);
        setLoading(false);
        // Keep selected meeting in sync
        setSelectedMeeting((prev) => prev ? (list.find((m) => m.id === prev.id) ?? null) : null);
      },
      (err) => {
        console.error('Meetings subscription error:', err);
        setError('Failed to load meetings. Please try again.');
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // Filtered list
  const filtered = meetings.filter((m) => {
    const matchesType = filterType === 'all' || m.meetingType === filterType;
    const q = search.toLowerCase();
    const matchesSearch = !q || [m.title, m.topic, m.summary, m.organizerEmail ?? ''].some((f) => f.toLowerCase().includes(q));
    return matchesType && matchesSearch;
  });

  // ---- save handler ----
  const handleSave = useCallback(async (form: MeetingFormState) => {
    const attendeeUserIds = form.attendeeUserIds.map((userId) => {
      const user = availableUsers.find((u) => u.userId === userId);
      return {
        userId,
        displayName: user?.displayName ?? undefined,
      };
    });

    const actionItemPayload = form.actionItems.map((ai) => ({
      description: ai.description,
      assignedToUserId: ai.assignedToUserId || undefined,
      dueDate: ai.dueDate || undefined,
      status: ai.status,
    }));

    if (editingMeeting) {
      await updateMeeting(editingMeeting.id, {
        title: form.title,
        date: form.date,
        startTime: form.startTime || undefined,
        endTime: form.endTime || undefined,
        location: form.location || undefined,
        meetingType: form.meetingType,
        organizerUserId: form.organizerUserId || undefined,
        topic: form.topic,
        agenda: form.agenda,
        summary: form.summary,
        keyPoints: parseLines(form.keyPoints),
        decisions: parseLines(form.decisions),
        attendeeUserIds,
        actionItems: actionItemPayload,
        updatedByUserId: userId,
      });
    } else {
      await createMeeting({
        title: form.title,
        date: form.date,
        startTime: form.startTime || undefined,
        endTime: form.endTime || undefined,
        location: form.location || undefined,
        meetingType: form.meetingType,
        organizerUserId: form.organizerUserId || undefined,
        topic: form.topic,
        agenda: form.agenda,
        summary: form.summary,
        keyPoints: parseLines(form.keyPoints),
        decisions: parseLines(form.decisions),
        attendeeUserIds,
        actionItems: actionItemPayload,
        createdByUserId: userId,
      });
    }
    setShowForm(false);
    setEditingMeeting(null);
  }, [editingMeeting, userId, availableUsers]);

  // ---- delete handler ----
  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    setDeleting(true);
    try {
      await deleteMeeting(deleteConfirmId);
      if (selectedMeeting?.id === deleteConfirmId) setSelectedMeeting(null);
      setDeleteConfirmId(null);
    } catch (err) {
      console.error('Delete meeting error:', err);
      alert('Failed to delete the meeting. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  // ---- action item status toggle ----
  const handleStatusChange = async (actionItemId: string, status: ActionItemStatus) => {
    await updateActionItemStatus(actionItemId, status);
  };

  // ---- permission helpers ----
  const canWrite = (m?: Meeting | null) => {
    if (userIsAdminFlag) return true;
    if (!m) return true; // creation
    return true; // section access is enforced by RLS
  };
  const canDeleteMeeting = (m: Meeting) =>
    userIsAdminFlag || m.createdByUserId === userId;

  // ---- Detail view ----
  if (selectedMeeting && !showForm) {
    return (
      <div className="space-y-6">
        <MeetingDetail
          meeting={selectedMeeting}
          canEdit={canWrite(selectedMeeting)}
          canDelete={canDeleteMeeting(selectedMeeting)}
          onEdit={() => { setEditingMeeting(selectedMeeting); setShowForm(true); }}
          onDelete={() => setDeleteConfirmId(selectedMeeting.id)}
          onBack={() => setSelectedMeeting(null)}
          onStatusChange={handleStatusChange}
        />

        {deleteConfirmId && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 max-w-sm w-full space-y-4">
              <h3 className="text-base font-bold text-slate-800">Delete meeting?</h3>
              <p className="text-sm text-slate-600">This will permanently remove the meeting, all attendees, and all action items. This cannot be undone.</p>
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => setDeleteConfirmId(null)} className="px-4 py-2 text-sm font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer">Cancel</button>
                <button type="button" onClick={handleDelete} disabled={deleting} className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-xl cursor-pointer disabled:opacity-60">
                  {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {showForm && editingMeeting && (
          <MeetingFormModal
            initial={editingMeeting}
            currentUserId={userId}
            availableUsers={availableUsers}
            loadingUsers={loadingUsers}
            usersLoadError={usersLoadError}
            onSave={handleSave}
            onClose={() => { setShowForm(false); setEditingMeeting(null); }}
          />
        )}
      </div>
    );
  }

  // ---- List view ----
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          {onBack && (
            <button type="button" onClick={onBack} className="text-slate-400 hover:text-slate-600 cursor-pointer">
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <div className="p-2.5 rounded-xl bg-violet-100 border border-violet-200 text-violet-700">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-black text-[#002142]">Meetings</h1>
            <p className="text-xs text-slate-500 font-medium">Staff meeting registry & follow-up tracker</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => { setEditingMeeting(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-violet-600 hover:bg-violet-500 rounded-xl cursor-pointer transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" /> New Meeting
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white"
            placeholder="Search meetings…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <select
            className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white cursor-pointer"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as MeetingType | 'all')}
          >
            <option value="all">All Types</option>
            {ALL_MEETING_TYPES.map((t) => (
              <option key={t} value={t}>{MEETING_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
          <p className="text-sm text-slate-400 font-medium">Loading meetings…</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-16 space-y-3">
          <AlertCircle className="w-8 h-8 text-rose-400" />
          <p className="text-sm text-rose-600 font-semibold">{error}</p>
          <button type="button" onClick={() => window.location.reload()} className="text-xs text-slate-500 underline cursor-pointer">Reload</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <div className="p-4 rounded-2xl bg-violet-50 border border-violet-200">
            <MessageSquare className="w-10 h-10 text-violet-300" />
          </div>
          <div className="text-center">
            <p className="text-base font-bold text-slate-600">
              {meetings.length === 0 ? 'No meetings yet' : 'No meetings match your filters'}
            </p>
            <p className="text-sm text-slate-400 mt-1">
              {meetings.length === 0 ? 'Create your first meeting to start the record.' : 'Try adjusting your search or filter.'}
            </p>
          </div>
          {meetings.length === 0 && (
            <button
              type="button"
              onClick={() => { setEditingMeeting(null); setShowForm(true); }}
              className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-violet-700 bg-violet-50 border border-violet-200 rounded-xl cursor-pointer hover:bg-violet-100 transition-colors"
            >
              <Plus className="w-4 h-4" /> Create Meeting
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((m) => (
            <MeetingCard key={m.id} meeting={m} onClick={() => setSelectedMeeting(m)} />
          ))}
        </div>
      )}

      {/* Metrics bar */}
      {meetings.length > 0 && !loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Meetings', value: meetings.length },
            { label: 'This Month', value: meetings.filter((m) => m.date.startsWith(new Date().toISOString().slice(0, 7))).length },
            { label: 'Open Actions', value: meetings.flatMap((m) => m.actionItems).filter((ai) => ai.status === 'pending' || ai.status === 'in_progress').length },
            { label: 'Completed Actions', value: meetings.flatMap((m) => m.actionItems).filter((ai) => ai.status === 'completed').length },
          ].map((metric) => (
            <div key={metric.label} className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{metric.label}</p>
              <p className="text-lg font-extrabold text-[#002142] font-mono">{metric.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <MeetingFormModal
          initial={editingMeeting}
          currentUserId={userId}
          availableUsers={availableUsers}
          loadingUsers={loadingUsers}
          usersLoadError={usersLoadError}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditingMeeting(null); }}
        />
      )}

      {/* Delete confirm */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 max-w-sm w-full space-y-4">
            <h3 className="text-base font-bold text-slate-800">Delete meeting?</h3>
            <p className="text-sm text-slate-600">This will permanently remove the meeting, all attendees, and all action items.</p>
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => setDeleteConfirmId(null)} className="px-4 py-2 text-sm font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer">Cancel</button>
              <button type="button" onClick={handleDelete} disabled={deleting} className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-xl cursor-pointer disabled:opacity-60">
                {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
