import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Calendar,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Edit3,
  Filter,
  FolderOpen,
  Layers,
  Link2,
  Plus,
  Save,
  Search,
  Sparkles,
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

type PlannerPhase = 'header' | 'preparation' | 'main' | 'post' | 'final';

const DAY_FIELDS: {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'datalist' | 'sessionLink' | 'concepts' | 'objectives';
  listId?: string;
  phase: PlannerPhase;
  subLabel?: string;
}[] = [
  // 1. MICROCYCLE HEADER
  { key: 'dayDate', label: 'Date', type: 'text', phase: 'header', subLabel: 'Fecha' },
  { key: 'dayLabel', label: 'Day', type: 'text', phase: 'header', subLabel: 'Día' },
  { key: 'trainingSession', label: 'Training Session', type: 'text', phase: 'header', subLabel: 'Nº Sesión' },
  { key: 'sessionType', label: 'Session Type', type: 'datalist', listId: 'session-type-list', phase: 'header', subLabel: 'Tipo de Sesión' },
  { key: 'mdLabel', label: 'MD', type: 'datalist', listId: 'md-list', phase: 'header', subLabel: 'Match Day' },
  { key: 'duration', label: 'Duration', type: 'text', phase: 'header', subLabel: 'Duración (min)' },
  { key: 'load', label: 'Load', type: 'datalist', listId: 'load-list', phase: 'header', subLabel: 'Carga' },
  { key: 'stage', label: 'Stage', type: 'text', phase: 'header', subLabel: 'Etapa / Momento' },

  // 2. PREPARATION PHASE
  { key: 'before', label: 'Before', type: 'textarea', phase: 'preparation', subLabel: 'Antes / Activación' },
  { key: 'preTrainingSession', label: 'Pre-training Session', type: 'textarea', phase: 'preparation', subLabel: 'Pre-entreno' },
  { key: 'warmUp', label: 'Warm-up', type: 'textarea', phase: 'preparation', subLabel: 'Calentamiento' },

  // 3. MAIN TRAINING PHASE (DOMINANT VISUAL BLOCK)
  { key: 'pitch', label: 'Pitch', type: 'textarea', phase: 'main', subLabel: 'Campo / Tarea Principal' },
  { key: 'concepts', label: 'Main Concepts', type: 'concepts', phase: 'main', subLabel: 'Conceptos Tácticos' },
  { key: 'objectives', label: 'Objectives', type: 'objectives', phase: 'main', subLabel: 'Objetivos Específicos' },

  // 4. POST-TRAINING PHASE
  { key: 'postTrainingSession', label: 'Post-training Session', type: 'textarea', phase: 'post', subLabel: 'Post-entreno' },
  { key: 'after', label: 'After', type: 'textarea', phase: 'post', subLabel: 'Después / Vuelta a la calma' },

  // 5. FINAL INFORMATION
  { key: 'notes', label: 'Notes', type: 'textarea', phase: 'final', subLabel: 'Observaciones' },
  { key: 'sessionLink', label: 'Linked Session', type: 'sessionLink', phase: 'final', subLabel: 'Sesión Vinculada' }
];

function isoDateFromToday(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function toDisplayDayName(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00`);
  return d.toLocaleDateString('en-US', { weekday: 'short' });
}

function formatDateRange(startDate: string, endDate: string): string {
  try {
    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T00:00:00`);
    const startStr = start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const endStr = end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${startStr} – ${endStr}`;
  } catch {
    return `${startDate} – ${endDate}`;
  }
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
  const cursor = new Date(start);
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

function getNextWeekDefaults(existingMicrocycles: Microcycle[]) {
  if (existingMicrocycles.length === 0) {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diffToMonday = (dayOfWeek + 6) % 7;
    const monday = new Date(today);
    monday.setDate(today.getDate() - diffToMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    return {
      name: 'Microcycle Week 1',
      weekNumber: 1,
      startDate: monday.toISOString().slice(0, 10),
      endDate: sunday.toISOString().slice(0, 10)
    };
  }

  let latestEndDate = existingMicrocycles[0].endDate;
  let maxWeek = 0;
  for (const m of existingMicrocycles) {
    if (m.endDate > latestEndDate) latestEndDate = m.endDate;
    if (m.weekNumber && m.weekNumber > maxWeek) maxWeek = m.weekNumber;
  }

  const nextMonday = new Date(`${latestEndDate}T00:00:00`);
  nextMonday.setDate(nextMonday.getDate() + 1);
  const nextSunday = new Date(nextMonday);
  nextSunday.setDate(nextMonday.getDate() + 6);

  const nextWeekNum = maxWeek > 0 ? maxWeek + 1 : existingMicrocycles.length + 1;

  return {
    name: `Microcycle Week ${nextWeekNum}`,
    weekNumber: nextWeekNum,
    startDate: nextMonday.toISOString().slice(0, 10),
    endDate: nextSunday.toISOString().slice(0, 10)
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
  
  // Navigation between Cards gallery and Active Week editor
  const [subNav, setSubNav] = useState<'cards' | 'editor'>('cards');
  
  // Cards search & filter
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'active' | 'archived'>('all');

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
    const defaults = getNextWeekDefaults(microcycles);
    setCreateInput((prev) => ({
      ...prev,
      teamId: effectiveTeam?.id || prev.teamId || defaultSingleTeam.id,
      teamName: effectiveTeam?.name || prev.teamName || defaultSingleTeam.name,
      name: prev.name || defaults.name,
      weekNumber: prev.weekNumber ?? defaults.weekNumber,
      startDate: prev.startDate || defaults.startDate,
      endDate: prev.endDate || defaults.endDate
    }));
  }, [effectiveTeam, defaultSingleTeam, microcycles]);

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
            if (sorted.length > 0) {
              setSelectedMicrocycleId(sorted[0].id);
              setDraft(createDraftFromLoaded(sorted[0]));
            } else {
              setSelectedMicrocycleId('');
              setDraft(null);
            }
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

  const filteredMicrocycles = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return microcycles.filter((m) => {
      const matchesStatus = statusFilter === 'all' || m.status === statusFilter;
      if (!matchesStatus) return false;

      if (!term) return true;

      const nameMatch = (m.name || '').toLowerCase().includes(term);
      const weekMatch = String(m.weekNumber || '').includes(term) || `week ${m.weekNumber}`.toLowerCase().includes(term);
      const dateMatch = (m.startDate || '').includes(term) || (m.endDate || '').includes(term);
      const teamMatch = (m.teamName || '').toLowerCase().includes(term);
      const conceptMatch = m.days.some((d) => d.concepts.some((c) => (c.concept || '').toLowerCase().includes(term)));

      return nameMatch || weekMatch || dateMatch || teamMatch || conceptMatch;
    });
  }, [microcycles, searchTerm, statusFilter]);

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

  const selectMicrocycle = (id: string, switchView = true) => {
    const target = microcycles.find((row) => row.id === id);
    if (!target) return;
    setSelectedMicrocycleId(id);
    setDraft(createDraftFromLoaded(target));
    setIsDirty(false);
    setSaveStatus('idle');
    setSaveError('');
    if (switchView) {
      setSubNav('editor');
    }
  };

  const handleOpenCreateModal = () => {
    const defaults = getNextWeekDefaults(microcycles);
    setCreateInput({
      teamId: effectiveTeam?.id || defaultSingleTeam.id,
      teamName: effectiveTeam?.name || defaultSingleTeam.name,
      name: defaults.name,
      weekNumber: defaults.weekNumber,
      startDate: defaults.startDate,
      endDate: defaults.endDate,
      status: 'draft'
    });
    setIsCreateOpen(true);
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
        name: createInput.name.trim() || `Microcycle Week ${createInput.weekNumber || ''}`.trim(),
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
      
      // Update local state and switch directly to editor for the newly created microcycle
      setSelectedMicrocycleId(next.id);
      setDraft(next);
      setIsDirty(false);
      setSaveStatus('saved');
      setSubNav('editor');
    } catch (error) {
      console.error('Failed to create microcycle', error);
      const classified = classifySupabaseError(error);
      alert(classified.userMessage);
    }
  };

  const handleDuplicateMicrocycle = async (source: Microcycle) => {
    if (!canCreateMicrocycle) return;
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
            sessionId: day.sessionId,
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
      setSubNav('editor');
    } catch (error) {
      console.error('Failed to duplicate microcycle', error);
      alert('Failed to duplicate microcycle.');
    }
  };

  const handleDeleteMicrocycle = async (id: string, name: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const shouldDelete = window.confirm(`Delete "${name}"? This cannot be undone.`);
    if (!shouldDelete) return;

    try {
      await deleteMicrocycle(id);
      if (selectedMicrocycleId === id) {
        const remaining = microcycles.filter((m) => m.id !== id);
        if (remaining.length > 0) {
          setSelectedMicrocycleId(remaining[0].id);
          setDraft(createDraftFromLoaded(remaining[0]));
        } else {
          setSelectedMicrocycleId('');
          setDraft(null);
          setSubNav('cards');
        }
      }
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
    selectMicrocycle(next.id, true);
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

      {/* SECONDARY NAVIGATION BAR (MATCHING FOOTBALL HUB STYLE) */}
      <div className="no-print-microcycle bg-white border border-slate-200 rounded-2xl p-2.5 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setSubNav('cards')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center space-x-2 cursor-pointer ${
              subNav === 'cards'
                ? 'bg-[#002142] text-white shadow-md'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Layers className="w-4 h-4 text-emerald-400" />
            <span>Weekly Microcycles / Galería</span>
            <span className="ml-1.5 px-2 py-0.5 rounded-full bg-slate-800 text-[10px] text-emerald-300 font-mono">
              {microcycles.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSubNav('editor')}
            disabled={!draft}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center space-x-2 cursor-pointer disabled:opacity-40 ${
              subNav === 'editor'
                ? 'bg-[#002142] text-white shadow-md'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Edit3 className="w-4 h-4 text-amber-400" />
            <span>Active Week Planner / Editor</span>
            {draft && (
              <span className="hidden md:inline text-[10px] text-slate-300 font-medium truncate max-w-[150px]">
                ({draft.name})
              </span>
            )}
          </button>
        </div>

        {canCreateMicrocycle && (
          <button
            type="button"
            onClick={handleOpenCreateModal}
            disabled={isLoadingCreatePermission}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold px-4 py-2 rounded-xl shadow-sm transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            <span>New Microcycle / Nueva Semana</span>
          </button>
        )}
      </div>

      {/* VIEW MODE 1: WEEKLY MICROCYCLES GALLERY (INDEPENDENT WEEK CARDS) */}
      {subNav === 'cards' && (
        <div className="space-y-5">
          {/* Filter & Search Bar */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search microcycles by name, week, concept..."
                className="w-full pl-9 pr-4 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                {(['all', 'draft', 'active', 'archived'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold capitalize transition-all ${
                      statusFilter === st
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>

              <div className="text-xs font-bold text-slate-600 shrink-0">
                {filteredMicrocycles.length} week{filteredMicrocycles.length !== 1 ? 's' : ''} found
              </div>
            </div>
          </div>

          {/* MICROCYCLE CARDS GRID (3-COLUMN RESPONSIVE) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {microcycles.length === 0 ? (
              <div className="col-span-full p-10 text-center bg-white rounded-3xl border border-slate-200 shadow-sm space-y-4">
                <FolderOpen className="w-12 h-12 text-slate-300 mx-auto" />
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-slate-800">No Microcycles Created Yet</h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Create your first weekly microcycle to plan daily training sessions, tactical concepts, and track player availability.
                  </p>
                </div>
                {canCreateMicrocycle && (
                  <button
                    type="button"
                    onClick={handleOpenCreateModal}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-sm transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    Create First Microcycle
                  </button>
                )}
              </div>
            ) : filteredMicrocycles.length === 0 ? (
              <div className="col-span-full p-8 text-center bg-white rounded-2xl border border-slate-200">
                <p className="text-sm text-slate-500 font-semibold">No microcycles match your search criteria.</p>
              </div>
            ) : (
              filteredMicrocycles.map((m) => {
                const isActive = selectedMicrocycleId === m.id;
                const linkedSessionsCount = m.days.filter((d) => d.sessionId).length;
                const totalConceptsCount = m.days.reduce((acc, d) => acc + (d.concepts?.length || 0), 0);
                const availabilityCount = m.availability?.length || 0;

                return (
                  <div
                    key={m.id}
                    className={`group bg-white rounded-2xl border transition-all duration-200 shadow-sm hover:shadow-lg flex flex-col justify-between overflow-hidden relative ${
                      isActive
                        ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {/* CARD TOP HEADER */}
                    <div className="p-4 flex items-center justify-between border-b border-slate-100 bg-slate-50/50">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-xl bg-[#002142] text-emerald-400 font-mono font-black text-xs flex items-center justify-center shadow-sm shrink-0 border border-slate-800">
                          {m.weekNumber ? `W${m.weekNumber}` : 'WK'}
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-slate-900 leading-none tracking-tight">
                            {m.name || `Microcycle Week ${m.weekNumber || '?'}`}
                          </h4>
                          <p className="text-[11px] font-semibold text-slate-500 mt-1 flex items-center space-x-1">
                            <Clock className="w-3 h-3 text-slate-400 inline" />
                            <span>{formatDateRange(m.startDate, m.endDate)}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide border ${
                          m.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : m.status === 'archived'
                            ? 'bg-slate-100 text-slate-600 border-slate-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {m.status}
                        </span>
                        {isActive && (
                          <span className="px-2 py-0.5 bg-emerald-600 text-white rounded text-[10px] font-black uppercase">
                            Open
                          </span>
                        )}
                      </div>
                    </div>

                    {/* CARD BODY */}
                    <div
                      onClick={() => selectMicrocycle(m.id, true)}
                      className="p-4 bg-white space-y-3 flex-1 flex flex-col justify-between cursor-pointer hover:bg-slate-50/70 transition-colors"
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
                          <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-bold text-[10px] border border-slate-200">
                            {m.teamName || 'U17 Women'}
                          </span>
                          <span className="text-slate-500">
                            {m.days.length} planned days
                          </span>
                        </div>

                        {/* Badges metadata */}
                        <div className="flex items-center gap-2 text-[11px] text-slate-600 font-semibold flex-wrap pt-1">
                          <span className="bg-sky-50 text-sky-700 border border-sky-200 px-2 py-0.5 rounded-md font-bold text-[10px] flex items-center gap-1">
                            <Link2 className="w-3 h-3" />
                            {linkedSessionsCount} linked session{linkedSessionsCount !== 1 ? 's' : ''}
                          </span>
                          <span className="bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-md font-bold text-[10px] flex items-center gap-1">
                            <Sparkles className="w-3 h-3" />
                            {totalConceptsCount} concept{totalConceptsCount !== 1 ? 's' : ''}
                          </span>
                          {availabilityCount > 0 && (
                            <span className="bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-md font-bold text-[10px] flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {availabilityCount} availability alert{availabilityCount !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>

                        {m.notes && (
                          <p className="text-xs text-slate-500 line-clamp-2 italic pt-1">
                            {m.notes}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* CARD FOOTER */}
                    <div className="p-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => selectMicrocycle(m.id, true)}
                        className="text-xs font-black text-emerald-700 hover:text-emerald-800 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform cursor-pointer"
                      >
                        <span>Open Planner</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDuplicateMicrocycle(m);
                          }}
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-all"
                          title="Duplicate Week"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteMicrocycle(m.id, m.name, e)}
                          className="p-1.5 text-rose-500 hover:text-white hover:bg-rose-500 rounded-lg transition-all border border-rose-200 hover:border-rose-500"
                          title="Delete Microcycle"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* VIEW MODE 2: ACTIVE MICROCYCLE PLANNER / EDITOR */}
      {subNav === 'editor' && (
        <section className="space-y-4">
          {!draft && (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-600 space-y-3">
              <p>No microcycle is currently selected.</p>
              <button
                type="button"
                onClick={() => setSubNav('cards')}
                className="px-4 py-2 bg-[#002142] text-white text-xs font-black rounded-xl"
              >
                Back to Microcycles Gallery
              </button>
            </div>
          )}

          {draft && (
            <>
              {/* EDITOR TOP CONTROL PANEL */}
              <div className="bg-white rounded-3xl border border-slate-200 p-4 md:p-5 shadow-sm space-y-4">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSubNav('cards')}
                        className="no-print-microcycle px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold inline-flex items-center gap-1 transition-all mr-1"
                        title="Back to all weeks"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        <span>All Weeks</span>
                      </button>

                      <input
                        value={draft.name}
                        onChange={(e) => updateDraft({ ...draft, name: e.target.value })}
                        className="w-full max-w-[420px] text-2xl md:text-3xl font-black tracking-tight text-slate-900 bg-transparent border-0 border-b-2 border-slate-200 focus:border-slate-900 focus:ring-0 px-0 py-1"
                        placeholder="Microcycle Name..."
                      />
                      
                      <select
                        value={draft.status}
                        onChange={(e) => updateDraft({ ...draft, status: e.target.value as any })}
                        className="px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-[11px] font-extrabold uppercase tracking-wide text-slate-700"
                      >
                        <option value="draft">Draft</option>
                        <option value="active">Active</option>
                        <option value="archived">Archived</option>
                      </select>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Week</span>
                        <input
                          type="number"
                          placeholder="W#"
                          value={draft.weekNumber || ''}
                          onChange={(e) => updateDraft({ ...draft, weekNumber: e.target.value ? Number(e.target.value) : undefined })}
                          className="w-14 bg-transparent border-0 font-bold text-slate-800 p-0 text-xs focus:ring-0"
                        />
                      </div>

                      <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <input
                          type="date"
                          value={draft.startDate}
                          onChange={(e) => updateDraft({ ...draft, startDate: e.target.value })}
                          className="bg-transparent border-0 font-semibold text-slate-700 p-0 text-xs focus:ring-0"
                        />
                        <span className="text-slate-400 font-bold">to</span>
                        <input
                          type="date"
                          value={draft.endDate}
                          onChange={(e) => updateDraft({ ...draft, endDate: e.target.value })}
                          className="bg-transparent border-0 font-semibold text-slate-700 p-0 text-xs focus:ring-0"
                        />
                      </div>

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
                        className="min-w-[190px] bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold text-slate-700 text-xs"
                      >
                        <option value="">Select team...</option>
                        {teams.map((team) => (
                          <option key={team.id} value={team.id}>{team.name}</option>
                        ))}
                      </select>

                      <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Squad Total</span>
                        <input
                          type="number"
                          placeholder="Players"
                          value={draft.teamTotal || ''}
                          onChange={(e) => updateDraft({ ...draft, teamTotal: e.target.value ? Number(e.target.value) : undefined })}
                          className="w-16 bg-transparent border-0 font-semibold text-slate-700 p-0 text-xs focus:ring-0"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="no-print-microcycle flex flex-wrap items-center gap-2">
                    {canCreateMicrocycle && (
                      <button
                        type="button"
                        onClick={handleOpenCreateModal}
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
                      disabled={selectedIndex === -1 || selectedIndex >= microcycles.length - 1}
                      className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 disabled:opacity-40 inline-flex items-center gap-1"
                      title="Previous saved microcycle"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      Previous
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviousOrNext(-1)}
                      disabled={selectedIndex <= 0}
                      className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 disabled:opacity-40 inline-flex items-center gap-1"
                      title="Next saved microcycle"
                    >
                      Next
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => draft && handleDuplicateMicrocycle(draft)}
                      disabled={!canCreateMicrocycle || isLoadingCreatePermission}
                      className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 inline-flex items-center gap-1"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Duplicate
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
                      Regenerate Days
                    </button>
                    <button
                      type="button"
                      onClick={() => draft && handleDeleteMicrocycle(draft.id, draft.name)}
                      className="px-3 py-2 rounded-xl border border-rose-300 text-xs font-bold text-rose-700 inline-flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </button>
                    <button
                      type="button"
                      disabled={!isDirty || isSaving}
                      onClick={handleSave}
                      className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black disabled:opacity-40 inline-flex items-center gap-1.5 shadow-sm transition-all"
                    >
                      <Save className="w-3.5 h-3.5" />
                      {isSaving ? 'Saving...' : 'Save Week'}
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
                  {isDirty && <span className="text-amber-700 font-bold bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">Unsaved changes</span>}
                  {!isDirty && saveStatus === 'saved' && <span className="text-emerald-700 font-bold flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Saved</span>}
                  {saveStatus === 'error' && <span className="text-rose-700 font-bold">Save failed: {saveError}</span>}
                </div>
              </div>

              {/* WEEK PLANNING TABLE */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-[1320px] w-full border-collapse text-xs table-fixed">
                    <thead>
                      <tr className="bg-[#002142] text-white border-b border-slate-800">
                        <th className="sticky left-0 z-20 bg-[#002142] text-left px-3.5 py-3.5 font-black uppercase tracking-wider text-white w-[230px] border-r border-slate-800 shadow-[2px_0_5px_rgba(0,0,0,0.15)]">
                          <div className="flex items-center gap-2">
                            <CalendarDays className="w-4 h-4 text-emerald-400 shrink-0" />
                            <div>
                              <div className="font-black text-white text-xs tracking-wider">MICROCYCLE</div>
                              <div className="text-[10px] text-slate-300 font-semibold normal-case tracking-normal">Category / Planning Phase</div>
                            </div>
                          </div>
                        </th>
                        {draft.days.map((day) => (
                          <th key={day.id} className="px-3 py-3 text-left border-l border-slate-700/80 w-[157px] align-bottom bg-[#002142] hover:bg-[#002b56] transition-colors">
                            <div className="flex items-center justify-between">
                              <span className="font-black text-white text-sm tracking-tight">{day.dayLabel || 'Day'}</span>
                              {day.mdLabel && (
                                <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-mono font-black">
                                  {day.mdLabel}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-300 font-bold mt-1 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-slate-400 inline" />
                              <span>{day.dayDate}</span>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {DAY_FIELDS.map((row, rowIndex) => {
                        const prevPhase = rowIndex > 0 ? DAY_FIELDS[rowIndex - 1].phase : null;
                        const isFirstInPhase = prevPhase !== row.phase;

                        const renderPhaseBanner = () => {
                          if (!isFirstInPhase) return null;
                          switch (row.phase) {
                            case 'header':
                              return (
                                <tr key="phase-banner-header" className="bg-slate-100 border-y-2 border-slate-300 select-none">
                                  <td className="sticky left-0 z-20 bg-slate-200 px-3.5 py-2 font-black text-[11px] uppercase tracking-wider text-slate-800 border-r border-slate-300">
                                    <div className="flex items-center gap-1.5">
                                      <Calendar className="w-3.5 h-3.5 text-slate-700 shrink-0" />
                                      <span>Microcycle Header</span>
                                    </div>
                                  </td>
                                  <td colSpan={draft.days.length} className="px-3.5 py-2 bg-slate-100 text-[11px] font-bold text-slate-600 border-l border-slate-200">
                                    <div className="flex items-center justify-between">
                                      <span>Date, Match Day (MD), Session Type, Duration & Load Parameters</span>
                                      <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500 bg-slate-200/80 px-2 py-0.5 rounded border border-slate-300">
                                        Phase A · Header
                                      </span>
                                    </div>
                                  </td>
                                </tr>
                              );

                            case 'preparation':
                              return (
                                <tr key="phase-banner-prep" className="bg-amber-100/90 border-t-2 border-b border-amber-300 select-none">
                                  <td className="sticky left-0 z-20 bg-amber-100 px-3.5 py-2 font-black text-[11px] uppercase tracking-wider text-amber-950 border-r border-amber-300">
                                    <div className="flex items-center gap-1.5">
                                      <Sparkles className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                                      <span>Preparation Phase</span>
                                    </div>
                                  </td>
                                  <td colSpan={draft.days.length} className="px-3.5 py-2 bg-amber-50 text-[11px] font-bold text-amber-900 border-l border-amber-200">
                                    <div className="flex items-center justify-between">
                                      <span>Before, Pre-training Session Protocols & Warm-up Routines</span>
                                      <span className="text-[10px] font-mono uppercase tracking-widest text-amber-800 bg-amber-200/70 px-2 py-0.5 rounded border border-amber-300">
                                        Phase B · Prep
                                      </span>
                                    </div>
                                  </td>
                                </tr>
                              );

                            case 'main':
                              return (
                                <tr key="phase-banner-main" className="bg-[#002142] text-white border-y-2 border-emerald-500 shadow-md select-none">
                                  <td className="sticky left-0 z-20 bg-[#002142] px-3.5 py-3 font-black text-xs uppercase tracking-widest text-emerald-300 border-r border-slate-800">
                                    <div className="flex items-center gap-2">
                                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 ring-4 ring-emerald-400/30 animate-pulse shrink-0" />
                                      <span className="font-extrabold text-sm tracking-wider text-white">MAIN TRAINING</span>
                                    </div>
                                  </td>
                                  <td colSpan={draft.days.length} className="px-4 py-3 bg-[#002142] text-xs font-bold text-white border-l border-slate-800">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <span className="text-emerald-400 text-sm font-black">★</span>
                                        <span className="text-white font-extrabold tracking-wide">Core Pitch Work, Tactical Concepts & Microcycle Objectives</span>
                                      </div>
                                      <span className="text-[11px] font-mono font-black uppercase tracking-widest text-emerald-300 bg-emerald-950/90 px-2.5 py-1 rounded-md border border-emerald-500/60 shadow-xs">
                                        Phase C · Dominant Block
                                      </span>
                                    </div>
                                  </td>
                                </tr>
                              );

                            case 'post':
                              return (
                                <tr key="phase-banner-post" className="bg-sky-100/90 border-t-2 border-b border-sky-300 select-none">
                                  <td className="sticky left-0 z-20 bg-sky-100 px-3.5 py-2 font-black text-[11px] uppercase tracking-wider text-sky-950 border-r border-sky-300">
                                    <div className="flex items-center gap-1.5">
                                      <Clock className="w-3.5 h-3.5 text-sky-700 shrink-0" />
                                      <span>Post-Training Phase</span>
                                    </div>
                                  </td>
                                  <td colSpan={draft.days.length} className="px-3.5 py-2 bg-sky-50 text-[11px] font-bold text-sky-900 border-l border-sky-200">
                                    <div className="flex items-center justify-between">
                                      <span>Post-training Protocols & Regeneration / Cool-down</span>
                                      <span className="text-[10px] font-mono uppercase tracking-widest text-sky-800 bg-sky-200/70 px-2 py-0.5 rounded border border-sky-300">
                                        Phase D · Post-Training
                                      </span>
                                    </div>
                                  </td>
                                </tr>
                              );

                            case 'final':
                              return (
                                <tr key="phase-banner-final" className="bg-slate-200/90 border-t-2 border-b border-slate-300 select-none">
                                  <td className="sticky left-0 z-20 bg-slate-200 px-3.5 py-2 font-black text-[11px] uppercase tracking-wider text-slate-800 border-r border-slate-300">
                                    <div className="flex items-center gap-1.5">
                                      <Link2 className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                                      <span>Final Information</span>
                                    </div>
                                  </td>
                                  <td colSpan={draft.days.length} className="px-3.5 py-2 bg-slate-100 text-[11px] font-bold text-slate-700 border-l border-slate-200">
                                    <div className="flex items-center justify-between">
                                      <span>Coaching Notes & Linked Full Training Session Plans</span>
                                      <span className="text-[10px] font-mono uppercase tracking-widest text-slate-600 bg-slate-200 px-2 py-0.5 rounded border border-slate-300">
                                        Phase E · Notes & Links
                                      </span>
                                    </div>
                                  </td>
                                </tr>
                              );
                          }
                        };

                        // Styling per phase for the left label column
                        const getLeftCellClass = () => {
                          switch (row.phase) {
                            case 'header':
                              return 'sticky left-0 z-10 bg-slate-50 border-r border-slate-200 border-l-3 border-l-slate-400 px-3.5 py-2 text-left align-middle font-bold text-slate-800 text-xs';
                            case 'preparation':
                              return 'sticky left-0 z-10 bg-amber-50/90 border-r border-amber-200 border-l-3 border-l-amber-500 px-3.5 py-2.5 text-left align-top font-bold text-amber-950 text-xs';
                            case 'main':
                              return 'sticky left-0 z-10 bg-emerald-50 border-r border-emerald-200 border-l-4 border-l-emerald-600 px-3.5 py-3 text-left align-top font-black text-slate-900 text-xs shadow-[inset_-2px_0_0_rgba(16,185,129,0.2)]';
                            case 'post':
                              return 'sticky left-0 z-10 bg-sky-50/90 border-r border-sky-200 border-l-3 border-l-sky-500 px-3.5 py-2.5 text-left align-top font-bold text-sky-950 text-xs';
                            case 'final':
                              return 'sticky left-0 z-10 bg-slate-50 border-r border-slate-200 border-l-3 border-l-slate-400 px-3.5 py-2.5 text-left align-top font-bold text-slate-800 text-xs';
                          }
                        };

                        // Styling per phase for the day content cells
                        const getDayCellClass = () => {
                          switch (row.phase) {
                            case 'header':
                              return 'border-l border-slate-200 bg-white hover:bg-slate-50/70 transition-colors px-2 py-1.5 align-middle';
                            case 'preparation':
                              return 'border-l border-amber-100 bg-amber-50/[0.08] hover:bg-amber-50/[0.22] transition-colors px-2.5 py-2 align-top';
                            case 'main':
                              return 'border-l border-emerald-100 bg-emerald-50/[0.15] hover:bg-emerald-50/[0.30] transition-colors px-2.5 py-3 align-top';
                            case 'post':
                              return 'border-l border-sky-100 bg-sky-50/[0.08] hover:bg-sky-50/[0.22] transition-colors px-2.5 py-2 align-top';
                            case 'final':
                              return 'border-l border-slate-200 bg-slate-50/[0.15] hover:bg-slate-50/[0.30] transition-colors px-2.5 py-2.5 align-top';
                          }
                        };

                        return (
                          <React.Fragment key={row.key}>
                            {renderPhaseBanner()}
                            <tr className={`align-top border-b ${row.phase === 'main' ? 'border-emerald-200' : 'border-slate-100'}`}>
                              <td className={getLeftCellClass()}>
                                <div className="space-y-0.5">
                                  <div className="leading-tight">{row.label}</div>
                                  {row.subLabel && (
                                    <div className="text-[10px] text-slate-400 font-medium">{row.subLabel}</div>
                                  )}
                                </div>
                              </td>
                              {draft.days.map((day) => {
                                const linkedOptions = selectedLinkedSessionsByDate.get(day.id) || [];
                                const linkedSession = selectedSessionById(day.sessionId);

                                if (row.type === 'sessionLink') {
                                  return (
                                    <td key={`${row.key}-${day.id}`} className={getDayCellClass()}>
                                      <select
                                        value={day.sessionId || ''}
                                        onChange={(e) => setDayValue(day.id, 'sessionId', e.target.value)}
                                        className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                                      >
                                        <option value="">No linked session</option>
                                        {linkedOptions.map((session) => (
                                          <option key={session.id} value={session.id}>
                                            #{session.sessionNumber} - {session.mainObjective || 'Session'}
                                          </option>
                                        ))}
                                      </select>
                                      {linkedSession && (
                                        <div className="mt-2 p-2.5 bg-emerald-50/90 border border-emerald-300/80 rounded-xl space-y-1 shadow-xs">
                                          <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-black uppercase text-emerald-900 font-mono bg-emerald-200/70 px-1.5 py-0.5 rounded">
                                              #{linkedSession.sessionNumber}
                                            </span>
                                            <span className="text-[10px] font-bold text-slate-500">
                                              {linkedSession.date}
                                            </span>
                                          </div>
                                          <p className="text-xs font-bold text-slate-900 line-clamp-1">
                                            {linkedSession.mainObjective || 'Training Session'}
                                          </p>
                                          <div className="pt-1 flex items-center justify-between">
                                            <button
                                              type="button"
                                              onClick={() => onOpenSession && onOpenSession(linkedSession)}
                                              className="text-[11px] text-emerald-800 hover:text-emerald-950 font-black inline-flex items-center gap-1 hover:underline cursor-pointer"
                                            >
                                              <Link2 className="w-3.5 h-3.5" />
                                              Open Session Plan
                                            </button>
                                            {linkedSession.fitnessUpdatedAt && (
                                              <span className="text-[9px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded">
                                                Fitness Linked
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                    </td>
                                  );
                                }

                                if (row.type === 'concepts') {
                                  return (
                                    <td key={`${row.key}-${day.id}`} className={getDayCellClass()}>
                                      <div className="space-y-2">
                                        {day.concepts.map((concept, cIndex) => (
                                          <div key={concept.id} className="flex items-center gap-1.5 bg-white p-1.5 rounded-lg border border-emerald-300/90 shadow-2xs">
                                            <span className="w-4 h-4 rounded bg-emerald-100 text-emerald-900 font-mono font-black text-[10px] flex items-center justify-center shrink-0">
                                              {cIndex + 1}
                                            </span>
                                            <input
                                              value={concept.concept}
                                              onChange={(e) => setConceptField(day.id, concept.id, 'concept', e.target.value)}
                                              placeholder="Concept / Concepto"
                                              className="w-full bg-transparent border-0 font-bold text-slate-900 text-xs px-1 py-0.5 focus:ring-0"
                                            />
                                            <button
                                              type="button"
                                              onClick={() => removeConcept(day.id, concept.id)}
                                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                                              title="Remove concept"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                          </div>
                                        ))}
                                        <button
                                          type="button"
                                          onClick={() => addConcept(day.id)}
                                          className="w-full py-1.5 text-[11px] font-black text-emerald-800 bg-emerald-100/90 hover:bg-emerald-200 text-center rounded-lg inline-flex items-center justify-center gap-1.5 transition-colors border border-emerald-300 shadow-2xs cursor-pointer"
                                        >
                                          <Plus className="w-3.5 h-3.5" />
                                          <span>Add Concept</span>
                                        </button>
                                      </div>
                                    </td>
                                  );
                                }

                                if (row.type === 'objectives') {
                                  return (
                                    <td key={`${row.key}-${day.id}`} className={getDayCellClass()}>
                                      <div className="space-y-2">
                                        {day.concepts.length === 0 && (
                                          <div className="text-[11px] text-slate-400 italic py-2 text-center bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
                                            Add a concept above first
                                          </div>
                                        )}
                                        {day.concepts.map((concept, cIndex) => (
                                          <div key={concept.id} className="space-y-1 bg-white p-2 rounded-lg border border-emerald-200 shadow-2xs">
                                            <div className="flex items-center justify-between text-[10px] font-black text-emerald-900">
                                              <span>Objective #{cIndex + 1}</span>
                                              {concept.concept && (
                                                <span className="truncate max-w-[110px] text-slate-500 font-medium">
                                                  ({concept.concept})
                                                </span>
                                              )}
                                            </div>
                                            <textarea
                                              value={concept.objective}
                                              onChange={(e) => setConceptField(day.id, concept.id, 'objective', e.target.value)}
                                              placeholder="Objective / Objetivo"
                                              rows={2}
                                              className="w-full bg-slate-50/60 border border-slate-200 rounded-md px-2 py-1.5 resize-y text-xs text-slate-800 focus:bg-white focus:border-emerald-600 focus:ring-1 focus:ring-emerald-500/20"
                                            />
                                          </div>
                                        ))}
                                      </div>
                                    </td>
                                  );
                                }

                                if (row.type === 'textarea') {
                                  const field = row.key as keyof MicrocycleDay;
                                  const isPitch = row.key === 'pitch';
                                  return (
                                    <td key={`${row.key}-${day.id}`} className={getDayCellClass()}>
                                      <textarea
                                        rows={isPitch ? 3 : 2}
                                        value={String((day as any)[field] || '')}
                                        onChange={(e) => setDayValue(day.id, field, e.target.value)}
                                        className={`w-full rounded-lg px-2.5 py-1.5 text-xs text-slate-900 resize-y transition-all ${
                                          isPitch
                                            ? 'bg-white border border-emerald-200 hover:border-emerald-300 focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 shadow-2xs font-medium'
                                            : row.phase === 'preparation'
                                            ? 'bg-white border border-amber-200/80 hover:border-amber-300 focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20'
                                            : row.phase === 'post'
                                            ? 'bg-white border border-sky-200/80 hover:border-sky-300 focus:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20'
                                            : 'bg-white border border-slate-200 hover:border-slate-300 focus:border-slate-400 focus:ring-2 focus:ring-slate-300/20'
                                        }`}
                                      />
                                    </td>
                                  );
                                }

                                const field = row.key as keyof MicrocycleDay;
                                const isMd = row.key === 'mdLabel';
                                const isLoad = row.key === 'load';

                                return (
                                  <td key={`${row.key}-${day.id}`} className={getDayCellClass()}>
                                    <input
                                      type={field === 'dayDate' ? 'date' : 'text'}
                                      list={row.listId}
                                      value={String((day as any)[field] || '')}
                                      onChange={(e) => setDayValue(day.id, field, e.target.value)}
                                      className={`w-full rounded-lg px-2 py-1.5 text-xs transition-all ${
                                        isMd
                                          ? 'bg-sky-50/80 border border-sky-200 font-black text-sky-950 text-center focus:bg-white focus:border-sky-500 focus:ring-1 focus:ring-sky-400'
                                          : isLoad
                                          ? 'bg-slate-50 border border-slate-200 font-bold text-slate-800 focus:bg-white focus:border-slate-400 focus:ring-1 focus:ring-slate-400'
                                          : 'bg-slate-50 border border-slate-200 font-semibold text-slate-800 focus:bg-white focus:border-slate-400'
                                      }`}
                                    />
                                  </td>
                                );
                              })}
                            </tr>
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* SQUAD AVAILABILITY */}
              <div className="bg-white rounded-3xl border border-slate-200 p-4 md:p-5 shadow-sm space-y-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-700" />
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">Squad Availability</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {AVAILABILITY_CATEGORIES.map((category) => {
                    const selected = draft.availability.filter((entry) => entry.category === category.key);
                    return (
                      <div key={category.key} className="border border-slate-200 rounded-xl p-3 bg-slate-50/40">
                        <div className="flex items-center justify-between text-xs font-black text-slate-700 mb-2">
                          <span>{category.label}</span>
                          <span className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded-full text-[10px]">
                            {selected.length}
                          </span>
                        </div>
                        <div className="max-h-40 overflow-auto space-y-1">
                          {squadPlayers.map((player) => {
                            const fullName = playerFullName(player);
                            const checked = selected.some((entry) => entry.playerId === player.id);
                            return (
                              <label key={`${category.key}-${player.id}`} className="flex items-center gap-2 text-xs text-slate-700 hover:bg-white p-1 rounded transition-colors cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleAvailability(category.key, player)}
                                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
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
      )}

      {/* CREATE NEW MICROCYCLE MODAL */}
      {isCreateOpen && (
        <div className="no-print-microcycle fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-white rounded-3xl border border-slate-200 p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
                  <CalendarDays className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">New Microcycle / Nueva Semana</h3>
                  <p className="text-xs text-slate-500">Create an independent weekly planning record</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <label className="space-y-1.5 md:col-span-2">
                <span className="text-xs font-bold text-slate-700">Microcycle Name / Title</span>
                <input
                  value={createInput.name}
                  onChange={(e) => setCreateInput((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Microcycle Week 2 - Pre-Competition"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:bg-white"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-bold text-slate-700">Week Number</span>
                <input
                  type="number"
                  placeholder="e.g. 1"
                  value={createInput.weekNumber || ''}
                  onChange={(e) => setCreateInput((prev) => ({ ...prev, weekNumber: e.target.value ? Number(e.target.value) : undefined }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:bg-white"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-bold text-slate-700">Status</span>
                <select
                  value={createInput.status || 'draft'}
                  onChange={(e) => setCreateInput((prev) => ({ ...prev, status: e.target.value as any }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:bg-white"
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                </select>
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-bold text-slate-700">Start Date (Monday)</span>
                <input
                  type="date"
                  value={createInput.startDate}
                  onChange={(e) => setCreateInput((prev) => ({ ...prev, startDate: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:bg-white"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-bold text-slate-700">End Date (Sunday)</span>
                <input
                  type="date"
                  value={createInput.endDate}
                  onChange={(e) => setCreateInput((prev) => ({ ...prev, endDate: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:bg-white"
                />
              </label>

              {teams.length > 1 ? (
                <label className="space-y-1.5 md:col-span-2">
                  <span className="text-xs font-bold text-slate-700">Team</span>
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
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:bg-white"
                  >
                    <option value="">Select a team...</option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>{team.name}</option>
                    ))}
                  </select>
                </label>
              ) : (
                <div className="space-y-1.5 md:col-span-2">
                  <span className="text-xs font-bold text-slate-700">Team</span>
                  <div className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700">
                    {effectiveTeam?.name || 'Single team available'}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="px-4 py-2.5 text-xs font-bold rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateNew}
                className="px-5 py-2.5 text-xs font-black rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Create Microcycle Record</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
