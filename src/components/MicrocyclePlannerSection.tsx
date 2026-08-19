import React, { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Copy,
  Link2,
  Plus,
  Save,
  Search,
  Trash2,
  Users
} from 'lucide-react';
import type {
  CloudTrainingSession,
  Microcycle,
  MicrocycleAvailabilityCategory,
  MicrocycleDay,
  MicrocycleLoadValue,
  MicrocycleSearchFilters,
  SquadPlayer
} from '../types';
import {
  createMicrocycle,
  createMicrocycleDayTemplate,
  deleteMicrocycle,
  saveMicrocycle,
  subscribeToMicrocycles,
  type CreateMicrocycleInput
} from '../services/planning/microcycleService';
import { useTeamContext } from '../contexts/TeamContext';
import { classifySupabaseError } from '../services/supabaseError';
import { useSectionActionAuthorization } from '../services/permissions/authorization';

interface MicrocyclePlannerSectionProps {
  cloudSessions: CloudTrainingSession[];
  squadPlayers: SquadPlayer[];
  onOpenSession?: (session: CloudTrainingSession) => void;
}

const LOAD_SUGGESTIONS: MicrocycleLoadValue[] = [
  'Very Low',
  'Low / Moderate-Low',
  'Moderate-High',
  'Very High',
  'Match'
];

const SESSION_TYPE_SUGGESTIONS = [
  'Recovery / Compensatory',
  'Strength',
  'Endurance',
  'Speed',
  'Reaction',
  'Match Day'
];

const MD_SUGGESTIONS = ['MD+2', 'MD+1', 'MD', 'MD-1', 'MD-2', 'MD-3', 'MD-4', 'MD-5'];

const AVAILABILITY_CATEGORIES: { key: MicrocycleAvailabilityCategory; label: string }[] = [
  { key: 'absent', label: 'Absent Players' },
  { key: 'injured', label: 'Injured Players' },
  { key: 'a_team', label: 'A Team' },
  { key: 'u15', label: 'U15' },
  { key: 'national_team_u20', label: 'National Team U20' },
  { key: 'national_team_u17', label: 'National Team U17' }
];

const DAY_FIELDS: { key: string; label: string; type: 'text' | 'textarea' | 'datalist' | 'sessionLink' | 'concepts' | 'objectives'; listId?: string }[] = [
  { key: 'dayDate', label: 'Date', type: 'text' },
  { key: 'dayLabel', label: 'Day', type: 'text' },
  { key: 'trainingSession', label: 'Training Session', type: 'text' },
  { key: 'sessionType', label: 'Session Type', type: 'datalist', listId: 'session-type-list' },
  { key: 'mdLabel', label: 'MD', type: 'datalist', listId: 'md-list' },
  { key: 'duration', label: 'Duration', type: 'text' },
  { key: 'load', label: 'Load', type: 'datalist', listId: 'load-list' },
  { key: 'stage', label: 'Stage', type: 'text' },
  { key: 'before', label: 'Before', type: 'textarea' },
  { key: 'preTrainingSession', label: 'Pre-training Session', type: 'textarea' },
  { key: 'warmUp', label: 'Warm-up', type: 'textarea' },
  { key: 'pitch', label: 'Pitch', type: 'textarea' },
  { key: 'concepts', label: 'Main Concepts', type: 'concepts' },
  { key: 'objectives', label: 'Objectives', type: 'objectives' },
  { key: 'postTrainingSession', label: 'Post-training Session', type: 'textarea' },
  { key: 'after', label: 'After', type: 'textarea' },
  { key: 'notes', label: 'Notes', type: 'textarea' },
  { key: 'sessionLink', label: 'Linked Session', type: 'sessionLink' }
];

const DEFAULT_FILTERS: MicrocycleSearchFilters = {
  date: '',
  weekNumber: '',
  concept: '',
  sessionType: '',
  load: ''
};

function isoDateFromToday(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function toDisplayDayName(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00`);
  return d.toLocaleDateString('en-US', { weekday: 'short' });
}

function playerFullName(player: SquadPlayer): string {
  return `${player.firstName} ${player.lastName}`.trim();
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function sortByStartDateDesc(microcycles: Microcycle[]): Microcycle[] {
  return [...microcycles].sort((a, b) => b.startDate.localeCompare(a.startDate));
}

function createDraftFromLoaded(source: Microcycle): Microcycle {
  return deepClone(source);
}

function createDaysFromRange(startDate: string, endDate: string): MicrocycleDay[] {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const days: MicrocycleDay[] = [];
  let cursor = new Date(start);
  let order = 0;

  while (cursor <= end) {
    const base = createMicrocycleDayTemplate(startDate, order);
    const iso = cursor.toISOString().slice(0, 10);
    base.dayDate = iso;
    base.dayLabel = toDisplayDayName(iso);
    days.push(base);
    cursor.setDate(cursor.getDate() + 1);
    order += 1;
  }

  return days;
}

function reconcileDaysForRange(draft: Microcycle): Microcycle {
  const templateDays = createDaysFromRange(draft.startDate, draft.endDate);
  const existingByDate = new Map(draft.days.map((day) => [day.dayDate, day]));

  return {
    ...draft,
    days: templateDays.map((templateDay) => {
      const existing = existingByDate.get(templateDay.dayDate);
      if (!existing) {
        return {
          ...templateDay,
          microcycleId: draft.id
        };
      }

      return {
        ...deepClone(existing),
        id: existing.id,
        microcycleId: draft.id,
        dayOrder: templateDay.dayOrder,
        dayDate: templateDay.dayDate,
        dayLabel: templateDay.dayLabel
      };
    })
  };
}

export const MicrocyclePlannerSection: React.FC<MicrocyclePlannerSectionProps> = ({
  cloudSessions,
  squadPlayers,
  onOpenSession
}) => {
  const { availableTeams: teams, selectedTeamId } = useTeamContext();
  const [microcycles, setMicrocycles] = useState<Microcycle[]>([]);
  const [selectedMicrocycleId, setSelectedMicrocycleId] = useState<string>('');
  const [draft, setDraft] = useState<Microcycle | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState('');
  const [filters, setFilters] = useState<MicrocycleSearchFilters>(DEFAULT_FILTERS);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createInput, setCreateInput] = useState<CreateMicrocycleInput>({
    teamId: '',
    teamName: '',
    name: '',
    startDate: isoDateFromToday(),
    endDate: isoDateFromToday(6),
    status: 'draft'
  });

  const defaultSingleTeam = useMemo(() => ({
    id: 'u17-women-alula',
    name: 'U17 Women Al Ula'
  }), []);
  const effectiveTeam = teams.find((team) => team.id === selectedTeamId) ?? teams[0] ?? defaultSingleTeam;
  const { allowed: canCreateMicrocycle, loading: isLoadingCreatePermission } = useSectionActionAuthorization(
    'planning',
    'create',
    effectiveTeam.id
  );

  useEffect(() => {
    const cleanup = () => {
      document.body.classList.remove('print-microcycle-mode');
    };

    window.addEventListener('afterprint', cleanup);
    return () => {
      window.removeEventListener('afterprint', cleanup);
      cleanup();
    };
  }, []);

  useEffect(() => {
    setCreateInput((prev) => ({
      ...prev,
      teamId: effectiveTeam?.id || prev.teamId || defaultSingleTeam.id,
      teamName: effectiveTeam?.name || prev.teamName || defaultSingleTeam.name
    }));
  }, [effectiveTeam, defaultSingleTeam]);

  useEffect(() => {
    const unsubscribe = subscribeToMicrocycles(
      (rows) => {
        const sorted = sortByStartDateDesc(rows);
        setMicrocycles(sorted);

        if (!selectedMicrocycleId && sorted.length > 0) {
          const first = sorted[0];
          setSelectedMicrocycleId(first.id);
          setDraft(createDraftFromLoaded(first));
          setIsDirty(false);
          return;
        }

        if (selectedMicrocycleId) {
          const selected = sorted.find((row) => row.id === selectedMicrocycleId);
          if (!selected) {
            setSelectedMicrocycleId(sorted[0]?.id || '');
            setDraft(sorted[0] ? createDraftFromLoaded(sorted[0]) : null);
            setIsDirty(false);
            return;
          }

          if (!isDirty) {
            setDraft(createDraftFromLoaded(selected));
          }
        }
      },
      (error) => {
        console.error('Failed to subscribe microcycles', error);
      }
    );

    return unsubscribe;
  }, [isDirty, selectedMicrocycleId]);

  useEffect(() => {
    if (!draft) return;

    const expectedDates = createDaysFromRange(draft.startDate, draft.endDate).map((day) => day.dayDate).join('|');
    const currentDates = draft.days.map((day) => day.dayDate).join('|');
    if (expectedDates === currentDates) return;

    const reconciled = reconcileDaysForRange(draft);
    if (reconciled.days.length !== draft.days.length || reconciled.days.some((day, index) => day.dayDate !== draft.days[index]?.dayDate)) {
      updateDraft(reconciled);
    }
  }, [draft?.startDate, draft?.endDate]);

  const filteredHistory = useMemo(() => {
    return microcycles.filter((microcycle) => {
      const dateMatch = !filters.date || microcycle.days.some((day) => day.dayDate === filters.date);
      const weekMatch = !filters.weekNumber || String(microcycle.weekNumber || '').includes(filters.weekNumber.trim());
      const conceptNeedle = filters.concept.trim().toLowerCase();
      const conceptMatch = !conceptNeedle || microcycle.days.some((day) =>
        day.concepts.some((c) => c.concept.toLowerCase().includes(conceptNeedle))
      );
      const sessionTypeNeedle = filters.sessionType.trim().toLowerCase();
      const sessionTypeMatch = !sessionTypeNeedle || microcycle.days.some((day) =>
        day.sessionType.toLowerCase().includes(sessionTypeNeedle)
      );
      const loadNeedle = filters.load.trim().toLowerCase();
      const loadMatch = !loadNeedle || microcycle.days.some((day) =>
        String(day.load || '').toLowerCase().includes(loadNeedle)
      );

      return dateMatch && weekMatch && conceptMatch && sessionTypeMatch && loadMatch;
    });
  }, [filters, microcycles]);

  const selectedIndex = useMemo(() => microcycles.findIndex((row) => row.id === selectedMicrocycleId), [microcycles, selectedMicrocycleId]);

  const selectedLinkedSessionsByDate = useMemo(() => {
    if (!draft) return new Map<string, CloudTrainingSession[]>();
    const map = new Map<string, CloudTrainingSession[]>();

    draft.days.forEach((day) => {
      map.set(day.id, cloudSessions);
    });

    return map;
  }, [cloudSessions, draft]);

  const updateDraft = (next: Microcycle) => {
    setDraft(next);
    setIsDirty(true);
    setSaveStatus('idle');
    setSaveError('');
  };

  const selectMicrocycle = (id: string) => {
    const target = microcycles.find((row) => row.id === id);
    if (!target) return;
    setSelectedMicrocycleId(id);
    setDraft(createDraftFromLoaded(target));
    setIsDirty(false);
    setSaveStatus('idle');
    setSaveError('');
  };

  const handleCreateNew = async () => {
    if (!canCreateMicrocycle) return;

    try {
      const team = teams.find((item) => item.id === createInput.teamId) ?? effectiveTeam;
      if (!team) {
        alert('No team is available for this microcycle.');
        return;
      }

      const created = await createMicrocycle({
        ...createInput,
        teamId: team.id,
        teamName: team.name,
        name: createInput.name.trim() || `Microcycle ${createInput.weekNumber || ''}`.trim(),
        status: createInput.status || 'draft'
      });

      const days = createDaysFromRange(createInput.startDate, createInput.endDate).map((day) => ({
        ...day,
        microcycleId: created.id
      }));

      const next: Microcycle = {
        ...created,
        name: createInput.name.trim() || created.name,
        days,
        availability: [],
        teamTotal: createInput.teamTotal,
        weekNumber: createInput.weekNumber
      };

      await saveMicrocycle(next);
      setIsCreateOpen(false);
      setCreateInput((prev) => ({
        ...prev,
        name: '',
        startDate: isoDateFromToday(),
        endDate: isoDateFromToday(6),
        teamId: effectiveTeam?.id || defaultSingleTeam.id,
        teamName: effectiveTeam?.name || defaultSingleTeam.name
      }));
      setSelectedMicrocycleId(next.id);
      setDraft(next);
      setIsDirty(false);
      setSaveStatus('saved');
    } catch (error) {
      console.error('Failed to create microcycle', error);
      const classified = classifySupabaseError(error);
      alert(classified.userMessage);
    }
  };

  const handleDuplicateCurrent = async () => {
    if (!canCreateMicrocycle) return;
    if (!draft) return;
    try {
      const created = await createMicrocycle({
        teamId: draft.teamId,
        teamName: draft.teamName,
        name: `${draft.name} (Copy)`,
        weekNumber: draft.weekNumber,
        startDate: draft.startDate,
        endDate: draft.endDate,
        status: 'draft',
        teamTotal: draft.teamTotal,
        notes: draft.notes
      });

      const next: Microcycle = {
        ...deepClone(draft),
        id: created.id,
        name: `${draft.name} (Copy)`,
        status: 'draft',
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
        days: draft.days.map((day) => {
          const newDayId = crypto.randomUUID();
          return {
            ...deepClone(day),
            id: newDayId,
            microcycleId: created.id,
            sessionId: day.sessionId,
            concepts: day.concepts.map((concept, index) => ({
              ...deepClone(concept),
              id: crypto.randomUUID(),
              microcycleDayId: newDayId,
              sortOrder: index
            }))
          };
        }),
        availability: draft.availability.map((entry) => ({
          ...deepClone(entry),
          id: crypto.randomUUID(),
          microcycleId: created.id
        }))
      };

      await saveMicrocycle(next);
      setSelectedMicrocycleId(next.id);
      setDraft(next);
      setIsDirty(false);
      setSaveStatus('saved');
    } catch (error) {
      console.error('Failed to duplicate microcycle', error);
      alert('Failed to duplicate microcycle.');
    }
  };

  const handleDuplicatePrevious = async () => {
    if (!canCreateMicrocycle) return;
    if (selectedIndex === -1) return;
    const source = microcycles[selectedIndex + 1];
    if (!source) {
      alert('No previous microcycle available to duplicate.');
      return;
    }

    try {
      const created = await createMicrocycle({
        teamId: source.teamId,
        teamName: source.teamName,
        name: `${source.name} (Copy)`,
        weekNumber: source.weekNumber,
        startDate: source.startDate,
        endDate: source.endDate,
        status: 'draft',
        teamTotal: source.teamTotal,
        notes: source.notes
      });

      const next: Microcycle = {
        ...deepClone(source),
        id: created.id,
        name: `${source.name} (Copy)`,
        status: 'draft',
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
        days: source.days.map((day) => {
          const newDayId = crypto.randomUUID();
          return {
            ...deepClone(day),
            id: newDayId,
            microcycleId: created.id,
            concepts: day.concepts.map((concept, index) => ({
              ...deepClone(concept),
              id: crypto.randomUUID(),
              microcycleDayId: newDayId,
              sortOrder: index
            }))
          };
        }),
        availability: source.availability.map((entry) => ({
          ...deepClone(entry),
          id: crypto.randomUUID(),
          microcycleId: created.id
        }))
      };

      await saveMicrocycle(next);
      setSelectedMicrocycleId(next.id);
      setDraft(next);
      setIsDirty(false);
      setSaveStatus('saved');
    } catch (error) {
      console.error('Failed to duplicate previous microcycle', error);
      alert('Failed to duplicate previous microcycle.');
    }
  };

  const handleDeleteCurrent = async () => {
    if (!draft) return;
    const shouldDelete = window.confirm(`Delete ${draft.name}? This cannot be undone.`);
    if (!shouldDelete) return;

    try {
      await deleteMicrocycle(draft.id);
      setIsDirty(false);
      setSaveStatus('idle');
    } catch (error) {
      console.error('Failed to delete microcycle', error);
      alert('Failed to delete microcycle.');
    }
  };

  const handleSave = async () => {
    if (!draft) return;

    try {
      setIsSaving(true);
      await saveMicrocycle(draft);
      setIsDirty(false);
      setSaveStatus('saved');
      setSaveError('');
    } catch (error) {
      console.error('Failed to save microcycle', error);
      setSaveStatus('error');
      setSaveError(error instanceof Error ? error.message : 'Unknown save error');
    } finally {
      setIsSaving(false);
    }
  };

  const setPreviousOrNext = (direction: -1 | 1) => {
    if (selectedIndex === -1) return;
    const next = microcycles[selectedIndex + direction];
    if (!next) return;
    selectMicrocycle(next.id);
  };

  const patchDay = (dayId: string, updater: (day: MicrocycleDay) => MicrocycleDay) => {
    if (!draft) return;
    const next = deepClone(draft);
    next.days = next.days.map((day) => (day.id === dayId ? updater(day) : day));
    updateDraft(next);
  };

  const setDayValue = (dayId: string, field: keyof MicrocycleDay, value: string) => {
    patchDay(dayId, (day) => {
      const patched = { ...day, [field]: value } as MicrocycleDay;
      if (field === 'dayDate') {
        patched.dayLabel = toDisplayDayName(value);
      }
      return patched;
    });
  };

  const addConcept = (dayId: string) => {
    patchDay(dayId, (day) => ({
      ...day,
      concepts: [
        ...day.concepts,
        {
          id: crypto.randomUUID(),
          microcycleDayId: day.id,
          sortOrder: day.concepts.length,
          concept: '',
          objective: ''
        }
      ]
    }));
  };

  const setConceptField = (dayId: string, conceptId: string, field: 'concept' | 'objective', value: string) => {
    patchDay(dayId, (day) => ({
      ...day,
      concepts: day.concepts.map((concept) => (concept.id === conceptId ? { ...concept, [field]: value } : concept))
    }));
  };

  const removeConcept = (dayId: string, conceptId: string) => {
    patchDay(dayId, (day) => ({
      ...day,
      concepts: day.concepts.filter((concept) => concept.id !== conceptId).map((concept, index) => ({
        ...concept,
        sortOrder: index
      }))
    }));
  };

  const toggleAvailability = (category: MicrocycleAvailabilityCategory, player: SquadPlayer) => {
    if (!draft) return;

    const playerId = player.id;
    const exists = draft.availability.find((entry) => entry.category === category && entry.playerId === playerId);
    const next = deepClone(draft);

    if (exists) {
      next.availability = next.availability.filter((entry) => entry.id !== exists.id);
    } else {
      next.availability.push({
        id: crypto.randomUUID(),
        microcycleId: draft.id,
        category,
        playerId,
        playerNameSnapshot: playerFullName(player),
        notes: ''
      });
    }

    updateDraft(next);
  };

  const handleExportPdf = () => {
    document.body.classList.add('print-microcycle-mode');
    window.requestAnimationFrame(() => {
      window.print();
    });
  };

  const selectedSessionById = (sessionId?: string) => {
    if (!sessionId) return null;
    return cloudSessions.find((session) => session.id === sessionId) || null;
  };

  return (
    <div className="microcycle-print-shell space-y-5 pb-10">
      <datalist id="load-list">
        {LOAD_SUGGESTIONS.map((item) => (
          <option key={item} value={item} />
        ))}
      </datalist>
      <datalist id="session-type-list">
        {SESSION_TYPE_SUGGESTIONS.map((item) => (
          <option key={item} value={item} />
        ))}
      </datalist>
      <datalist id="md-list">
        {MD_SUGGESTIONS.map((item) => (
          <option key={item} value={item} />
        ))}
      </datalist>

      <section className="space-y-4">
        {!draft && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 text-sm text-slate-600 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <span>No microcycles yet. Use New Microcycle to create the first week.</span>
            {canCreateMicrocycle && (
              <button
                type="button"
                onClick={() => setIsCreateOpen(true)}
                disabled={isLoadingCreatePermission}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-black inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                New Microcycle
              </button>
            )}
          </div>
        )}

        {draft && (
          <>
            <div className="bg-white rounded-3xl border border-slate-200 p-4 md:p-5 shadow-sm space-y-4">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      value={draft.name}
                      onChange={(e) => updateDraft({ ...draft, name: e.target.value })}
                      className="w-full max-w-[420px] text-2xl md:text-3xl font-black tracking-tight text-slate-900 bg-transparent border-0 border-b-2 border-slate-200 focus:border-slate-900 focus:ring-0 px-0 py-1"
                    />
                    <span className="px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-[11px] font-extrabold uppercase tracking-wide text-slate-600">
                      {draft.status}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <input
                      type="number"
                      placeholder="Week"
                      value={draft.weekNumber || ''}
                      onChange={(e) => updateDraft({ ...draft, weekNumber: e.target.value ? Number(e.target.value) : undefined })}
                      className="w-20 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-700"
                    />
                    <input
                      type="date"
                      value={draft.startDate}
                      onChange={(e) => updateDraft({ ...draft, startDate: e.target.value })}
                      className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold text-slate-700"
                    />
                    <span className="text-slate-400 font-bold">to</span>
                    <input
                      type="date"
                      value={draft.endDate}
                      onChange={(e) => updateDraft({ ...draft, endDate: e.target.value })}
                      className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold text-slate-700"
                    />
                    <select
                      value={draft.teamId}
                      onChange={(e) => {
                        const nextTeamId = e.target.value;
                        const selectedTeam = teams.find((team) => team.id === nextTeamId);
                        updateDraft({
                          ...draft,
                          teamId: nextTeamId,
                          teamName: selectedTeam?.name || draft.teamName
                        });
                      }}
                      className="min-w-[190px] bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold text-slate-700"
                    >
                      <option value="">Select team...</option>
                      {teams.map((team) => (
                        <option key={team.id} value={team.id}>{team.name}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      placeholder="Team total"
                      value={draft.teamTotal || ''}
                      onChange={(e) => updateDraft({ ...draft, teamTotal: e.target.value ? Number(e.target.value) : undefined })}
                      className="w-28 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold text-slate-700"
                    />
                  </div>
                </div>

                <div className="no-print-microcycle flex flex-wrap items-center gap-2">
                  {canCreateMicrocycle && (
                    <button
                      type="button"
                      onClick={() => setIsCreateOpen(true)}
                      disabled={isLoadingCreatePermission}
                      className="px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-black inline-flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      New Week
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setPreviousOrNext(1)}
                    disabled={selectedIndex <= 0}
                    className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 disabled:opacity-40 inline-flex items-center gap-1"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviousOrNext(-1)}
                    disabled={selectedIndex === -1 || selectedIndex >= microcycles.length - 1}
                    className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 disabled:opacity-40 inline-flex items-center gap-1"
                  >
                    Next
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleDuplicateCurrent}
                    disabled={!canCreateMicrocycle || isLoadingCreatePermission}
                    className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 inline-flex items-center gap-1"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Duplicate
                  </button>
                  <button
                    type="button"
                    onClick={handleDuplicatePrevious}
                    disabled={!canCreateMicrocycle || isLoadingCreatePermission}
                    className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 inline-flex items-center gap-1"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Duplicate Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!draft) return;
                      const next = deepClone(draft);
                      next.days = createDaysFromRange(next.startDate, next.endDate).map((day) => {
                        const existing = draft.days.find((item) => item.dayDate === day.dayDate);
                        return existing
                          ? { ...deepClone(existing), id: existing.id, microcycleId: draft.id, dayOrder: day.dayOrder, dayLabel: day.dayLabel }
                          : { ...day, microcycleId: draft.id };
                      });
                      updateDraft(next);
                    }}
                    className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700"
                  >
                    Regenerate Week Days
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteCurrent}
                    className="px-3 py-2 rounded-xl border border-rose-300 text-xs font-bold text-rose-700 inline-flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                  <button
                    type="button"
                    disabled={!isDirty || isSaving}
                    onClick={handleSave}
                    className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-black disabled:opacity-40 inline-flex items-center gap-1"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {isSaving ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={handleExportPdf}
                    className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-black text-slate-700 inline-flex items-center gap-1"
                  >
                    Export PDF
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold text-slate-500">
                <span>Weekly board view</span>
                <span className="h-1 w-1 rounded-full bg-slate-300" />
                <span>{draft.teamName}</span>
                <span className="h-1 w-1 rounded-full bg-slate-300" />
                <span>{draft.days.length} days</span>
                {isDirty && <span className="text-amber-700">Unsaved changes</span>}
                {!isDirty && saveStatus === 'saved' && <span className="text-emerald-700">Saved</span>}
                {saveStatus === 'error' && <span className="text-rose-700">Save failed: {saveError}</span>}
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-[1320px] w-full border-collapse text-xs table-fixed">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200">
                      <th className="sticky left-0 z-20 bg-slate-100 text-left px-3 py-3 font-black uppercase tracking-wide text-slate-600 w-[220px]">
                        Planning Category
                      </th>
                      {draft.days.map((day) => (
                        <th key={day.id} className="px-3 py-3 text-left border-l border-slate-200 w-[157px] align-bottom">
                          <div className="font-black text-slate-800 text-sm">{day.dayLabel || 'Day'}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5 font-medium">{day.dayDate}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {DAY_FIELDS.map((row, rowIndex) => (
                      <tr key={row.key} className={`align-top border-b border-slate-100 ${rowIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}>
                        <td className="sticky left-0 z-10 bg-inherit px-3 py-2.5 font-bold text-slate-700 border-r border-slate-100 align-top">
                          {row.label}
                        </td>
                        {draft.days.map((day) => {
                          const linkedOptions = selectedLinkedSessionsByDate.get(day.id) || [];
                          const linkedSession = selectedSessionById(day.sessionId);

                          if (row.type === 'sessionLink') {
                            return (
                              <td key={`${row.key}-${day.id}`} className="px-2 py-2 border-l border-slate-100 bg-inherit">
                                <select
                                  value={day.sessionId || ''}
                                  onChange={(e) => setDayValue(day.id, 'sessionId', e.target.value)}
                                  className="w-full bg-slate-50 border border-slate-200 rounded-md px-2 py-1.5"
                                >
                                  <option value="">No linked session</option>
                                  {linkedOptions.map((session) => (
                                    <option key={session.id} value={session.id}>
                                      #{session.sessionNumber} - {session.mainObjective || 'Session'}
                                    </option>
                                  ))}
                                </select>
                                {linkedSession && (
                                  <div className="mt-1.5 space-y-1">
                                    <button
                                      type="button"
                                      onClick={() => onOpenSession && onOpenSession(linkedSession)}
                                      className="text-[11px] text-emerald-700 font-bold inline-flex items-center gap-1"
                                    >
                                      <Link2 className="w-3 h-3" />
                                      Open linked session
                                    </button>
                                    {linkedSession.fitnessUpdatedAt && (
                                      <div className="text-[10px] text-indigo-600 font-bold">
                                        Fitness-linked session detected
                                      </div>
                                    )}
                                  </div>
                                )}
                              </td>
                            );
                          }

                          if (row.type === 'concepts') {
                            return (
                              <td key={`${row.key}-${day.id}`} className="px-2 py-2 border-l border-slate-100 space-y-1.5 bg-inherit">
                                {day.concepts.map((concept) => (
                                  <div key={concept.id} className="flex items-center gap-1.5">
                                    <input
                                      value={concept.concept}
                                      onChange={(e) => setConceptField(day.id, concept.id, 'concept', e.target.value)}
                                      placeholder="Concept"
                                      className="w-full bg-slate-50 border border-slate-200 rounded-md px-2 py-1.5"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => removeConcept(day.id, concept.id)}
                                      className="text-rose-700"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ))}
                                <button
                                  type="button"
                                  onClick={() => addConcept(day.id)}
                                  className="text-[11px] font-bold text-emerald-700 inline-flex items-center gap-1"
                                >
                                  <Plus className="w-3 h-3" />
                                  Add concept
                                </button>
                              </td>
                            );
                          }

                          if (row.type === 'objectives') {
                            return (
                              <td key={`${row.key}-${day.id}`} className="px-2 py-2 border-l border-slate-100 space-y-1.5 bg-inherit">
                                {day.concepts.length === 0 && (
                                  <div className="text-[11px] text-slate-400">Add a concept first</div>
                                )}
                                {day.concepts.map((concept) => (
                                  <textarea
                                    key={concept.id}
                                    value={concept.objective}
                                    onChange={(e) => setConceptField(day.id, concept.id, 'objective', e.target.value)}
                                    placeholder="Objective"
                                    rows={2}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-md px-2 py-1.5 resize-y"
                                  />
                                ))}
                              </td>
                            );
                          }

                          if (row.type === 'textarea') {
                            const field = row.key as keyof MicrocycleDay;
                            return (
                              <td key={`${row.key}-${day.id}`} className="px-2 py-2 border-l border-slate-100 bg-inherit">
                                <textarea
                                  rows={2}
                                  value={String((day as any)[field] || '')}
                                  onChange={(e) => setDayValue(day.id, field, e.target.value)}
                                  className="w-full bg-slate-50 border border-slate-200 rounded-md px-2 py-1.5 resize-y"
                                />
                              </td>
                            );
                          }

                          const field = row.key as keyof MicrocycleDay;
                          return (
                            <td key={`${row.key}-${day.id}`} className="px-2 py-2 border-l border-slate-100 bg-inherit">
                              <input
                                type={field === 'dayDate' ? 'date' : 'text'}
                                list={row.listId}
                                value={String((day as any)[field] || '')}
                                onChange={(e) => setDayValue(day.id, field, e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-md px-2 py-1.5"
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 p-4 md:p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-700" />
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">Squad Availability</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {AVAILABILITY_CATEGORIES.map((category) => {
                  const selected = draft.availability.filter((entry) => entry.category === category.key);
                  return (
                    <div key={category.key} className="border border-slate-200 rounded-xl p-3">
                      <div className="text-xs font-black text-slate-700 mb-2">{category.label}</div>
                      <div className="max-h-40 overflow-auto space-y-1">
                        {squadPlayers.map((player) => {
                          const fullName = playerFullName(player);
                          const checked = selected.some((entry) => entry.playerId === player.id);
                          return (
                            <label key={`${category.key}-${player.id}`} className="flex items-center gap-2 text-xs text-slate-700">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleAvailability(category.key, player)}
                              />
                              <span>{fullName}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="text-xs text-slate-500 inline-flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                Team total can be edited in the header and players are always sourced from the current squad table.
              </div>
            </div>
          </>
        )}
      </section>

      {isCreateOpen && (
        <div className="no-print-microcycle fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
            <h3 className="text-lg font-black text-slate-900">New Microcycle</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <label className="space-y-1">
                <span className="text-xs font-bold text-slate-600">Name</span>
                <input
                  value={createInput.name}
                  onChange={(e) => setCreateInput((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-bold text-slate-600">Week Number</span>
                <input
                  type="number"
                  value={createInput.weekNumber || ''}
                  onChange={(e) => setCreateInput((prev) => ({ ...prev, weekNumber: e.target.value ? Number(e.target.value) : undefined }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-bold text-slate-600">Start Date</span>
                <input
                  type="date"
                  value={createInput.startDate}
                  onChange={(e) => setCreateInput((prev) => ({ ...prev, startDate: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-bold text-slate-600">End Date</span>
                <input
                  type="date"
                  value={createInput.endDate}
                  onChange={(e) => setCreateInput((prev) => ({ ...prev, endDate: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2"
                />
              </label>
              {teams.length > 1 ? (
                <label className="space-y-1">
                  <span className="text-xs font-bold text-slate-600">Team</span>
                  <select
                    value={createInput.teamId}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      const selectedTeam = teams.find((team) => team.id === selectedId);
                      setCreateInput((prev) => ({
                        ...prev,
                        teamId: selectedId,
                        teamName: selectedTeam?.name || ''
                      }));
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2"
                  >
                    <option value="">Select a team...</option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>{team.name}</option>
                    ))}
                  </select>
                </label>
              ) : (
                <div className="space-y-1">
                  <span className="text-xs font-bold text-slate-600">Team</span>
                  <div className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-sm text-slate-700">
                    {effectiveTeam?.name || 'Single team available'}
                  </div>
                </div>
              )}
              <label className="space-y-1">
                <span className="text-xs font-bold text-slate-600">Duplicate from current</span>
                <button
                  type="button"
                  onClick={() => {
                    if (!draft) return;
                    setCreateInput((prev) => ({
                      ...prev,
                      name: `${draft.name} (Next)`,
                      weekNumber: draft.weekNumber ? draft.weekNumber + 1 : undefined,
                      teamName: draft.teamName,
                      teamId: draft.teamId,
                      teamTotal: draft.teamTotal
                    }));
                  }}
                  className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-xs font-bold text-slate-700 bg-slate-50"
                >
                  Use current as template metadata
                </button>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="px-3 py-2 text-xs font-bold rounded-lg border border-slate-300 text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateNew}
                className="px-3 py-2 text-xs font-black rounded-lg bg-emerald-600 text-white"
              >
                Create Week
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
