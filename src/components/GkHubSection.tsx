import React, { useEffect, useMemo, useState } from 'react';
import { 
  ArrowRight, 
  BookOpen, 
  Copy, 
  Edit3, 
  FileText, 
  FolderOpen, 
  Layers, 
  Plus, 
  Search, 
  ShieldCheck, 
  Trash2, 
  Users,
  Award,
  Calendar,
  CheckCircle2,
  Clock,
  Sparkles
} from 'lucide-react';
import { getEmptySession } from '../defaultSession';
import type { 
  CloudTrainingSession, 
  GkSession, 
  PlayerAttendance, 
  PlayerGroup, 
  SharedSessionHeader, 
  SquadPlayer, 
  TrainingSession 
} from '../types';
import { ModuleSessionEditor } from './ModuleSessionEditor';
import { ExercisesLibrary } from './ExercisesLibrary';
import { deleteGkSession, saveGkSession, subscribeToGkSessions } from '../services/gk/gkSessionsService';
import { readWorkspaceRestoreState, writeWorkspaceRestoreState } from '../utils/workspaceRestore';
import { SmartImage } from './SmartImage';

interface GkHubSectionProps {
  currentLogo: string;
  squadPlayers: SquadPlayer[];
  excludedPlayers: string[];
  onExcludePlayer: (name: string) => void;
  onIncludePlayer: (name: string) => void;
  onUpdateLogo: (newLogo: string) => void;
}

function defaultGkBlock(id: string, title: string) {
  return { id, title, exercises: [] };
}

function toTrainingSession(gk: GkSession): TrainingSession {
  const empty = getEmptySession();
  const gkWarmUp = gk.gkWarmUp || defaultGkBlock('warmup-block-gk', 'Warm Up');
  const gkMainPart = gk.gkMainPart || defaultGkBlock('main-block-gk', 'Main Part');
  const gkCoolDown = gk.gkCoolDown || defaultGkBlock('cooldown-block-gk', 'Cool Down');
  const gkPlayerGroups = gk.gkPlayerGroups || [];

  return {
    ...empty,
    id: gk.sessionUid || gk.id,
    teamName: gk.teamName || 'U17 Women Al Ula',
    date: gk.date,
    time: gk.time,
    sessionNumber: gk.sessionNumber,
    microcycleDay: gk.microcycleDay,
    mainObjective: gk.mainObjective,
    materialsNeeded: gk.materialsNeeded,
    observations: gk.observations,
    squadRoster: gk.squadRoster || [],
    attendance: gk.attendance || [],
    warmUp: gkWarmUp,
    mainPart: gkMainPart,
    coolDown: gkCoolDown,
    playerGroups: gkPlayerGroups,
    gkWarmUp,
    gkMainPart,
    gkCoolDown,
    gkPlayerGroups
  };
}

function toGkSession(recordId: string, session: TrainingSession, previous?: GkSession): GkSession {
  const now = Date.now();
  const gkWarmUp = session.gkWarmUp || session.warmUp || defaultGkBlock('warmup-block-gk', 'Warm Up');
  const gkMainPart = session.gkMainPart || session.mainPart || defaultGkBlock('main-block-gk', 'Main Part');
  const gkCoolDown = session.gkCoolDown || session.coolDown || defaultGkBlock('cooldown-block-gk', 'Cool Down');
  const gkPlayerGroups = session.gkPlayerGroups || session.playerGroups || [];

  return {
    id: recordId,
    sessionUid: session.id,
    legacySessionId: previous?.legacySessionId || session.id,
    teamName: session.teamName,
    date: session.date,
    time: session.time,
    sessionNumber: session.sessionNumber,
    microcycleDay: session.microcycleDay,
    mainObjective: session.mainObjective,
    materialsNeeded: session.materialsNeeded,
    observations: session.observations,
    squadRoster: session.squadRoster || [],
    attendance: session.attendance || [],
    gkWarmUp,
    gkMainPart,
    gkCoolDown,
    gkPlayerGroups,
    createdAt: previous?.createdAt || now,
    updatedAt: now
  };
}

function createEmptyGkSession(
  squadRoster: string[],
  attendance: PlayerAttendance[],
  sessionNumber: string
): GkSession {
  const uid = `session-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const today = new Date().toISOString().split('T')[0];
  const now = Date.now();

  return {
    id: `gk-${uid}`,
    sessionUid: uid,
    legacySessionId: uid,
    teamName: 'U17 Women Al Ula',
    date: today,
    time: '18:30 - 20:00',
    sessionNumber,
    microcycleDay: 'MD-3',
    mainObjective: '',
    materialsNeeded: '',
    observations: '',
    squadRoster,
    attendance,
    gkWarmUp: defaultGkBlock('warmup-block-gk', 'Warm Up'),
    gkMainPart: defaultGkBlock('main-block-gk', 'Main Part'),
    gkCoolDown: defaultGkBlock('cooldown-block-gk', 'Cool Down'),
    gkPlayerGroups: [],
    createdAt: now,
    updatedAt: now
  };
}

function compareSessionNumbers(leftSessionNumber: string, rightSessionNumber: string): number {
  const left = leftSessionNumber.trim();
  const right = rightSessionNumber.trim();
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  const numCompare = left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' });
  if (numCompare !== 0) return numCompare;
  return left.localeCompare(right);
}

export const GkHubSection: React.FC<GkHubSectionProps> = ({
  currentLogo,
  squadPlayers,
  excludedPlayers,
  onExcludePlayer,
  onIncludePlayer,
  onUpdateLogo
}) => {
  const contextStorageKey = 'u17_gk_hub_context';
  const restoredContext = readWorkspaceRestoreState(contextStorageKey, {
    gkSubTab: 'sessions' as const,
    sessionSubNav: 'cards' as const,
    searchTerm: '',
    selectedMdFilter: 'all'
  });

  const [gkSubTab, setGkSubTab] = useState<'sessions' | 'library' | 'goalkeepers'>(
    restoredContext.gkSubTab === 'sessions' || restoredContext.gkSubTab === 'library' || restoredContext.gkSubTab === 'goalkeepers'
      ? restoredContext.gkSubTab
      : 'sessions'
  );
  const [sessionSubNav, setSessionSubNav] = useState<'cards' | 'editor'>(restoredContext.sessionSubNav || 'cards');
  const [searchTerm, setSearchTerm] = useState(restoredContext.searchTerm || '');
  const [selectedMdFilter, setSelectedMdFilter] = useState<string>(restoredContext.selectedMdFilter || 'all');
  
  const [gkSessions, setGkSessions] = useState<GkSession[]>([]);
  const [selectedGkId, setSelectedGkId] = useState<string>('');
  const [editorSession, setEditorSession] = useState<TrainingSession>(() => getEmptySession());
  const [expandedExercises, setExpandedExercises] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveValidationError, setSaveValidationError] = useState<string | null>(null);
  const [isCreateSessionModalOpen, setIsCreateSessionModalOpen] = useState(false);
  const [newSessionNumberInput, setNewSessionNumberInput] = useState('');
  const [createSessionValidationError, setCreateSessionValidationError] = useState<string | null>(null);

  useEffect(() => {
    writeWorkspaceRestoreState(contextStorageKey, {
      gkSubTab,
      sessionSubNav,
      searchTerm,
      selectedMdFilter
    });
  }, [gkSubTab, sessionSubNav, searchTerm, selectedMdFilter]);

  // Filter Goalkeeper players from the shared squad
  const goalkeeperSquadPlayers = useMemo(() => {
    return squadPlayers.filter((player) => player.position === 'GK');
  }, [squadPlayers]);

  const goalkeeperRoster = useMemo(() => {
    if (goalkeeperSquadPlayers.length > 0) {
      return goalkeeperSquadPlayers.map((player) => `${player.firstName} (GK)`);
    }
    return ['Goalkeeper 1 (GK)', 'Goalkeeper 2 (GK)'];
  }, [goalkeeperSquadPlayers]);

  // Subscribe to GK sessions
  useEffect(() => {
    const unsubscribe = subscribeToGkSessions((items) => {
      setGkSessions(items);
    });
    return () => unsubscribe();
  }, []);

  // Sync selected session
  useEffect(() => {
    if (gkSessions.length === 0) return;
    if (!selectedGkId || !gkSessions.some((item) => item.id === selectedGkId)) {
      const first = gkSessions[0];
      setSelectedGkId(first.id);
      setEditorSession(toTrainingSession(first));
    }
  }, [gkSessions, selectedGkId]);

  const selectedGk = useMemo(
    () => gkSessions.find((item) => item.id === selectedGkId) || null,
    [gkSessions, selectedGkId]
  );

  const filteredCards = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return gkSessions
      .filter((item) => {
        if (selectedMdFilter !== 'all' && (item.microcycleDay || '').toUpperCase() !== selectedMdFilter.toUpperCase()) {
          return false;
        }
        if (!term) return true;
        return (
          item.sessionNumber.toLowerCase().includes(term) ||
          item.mainObjective.toLowerCase().includes(term) ||
          item.date.toLowerCase().includes(term)
        );
      })
      .sort((left, right) => {
        const numComparison = compareSessionNumbers(left.sessionNumber, right.sessionNumber);
        if (numComparison !== 0) {
          return numComparison;
        }
        if (left.updatedAt !== right.updatedAt) {
          return right.updatedAt - left.updatedAt;
        }
        return left.id.localeCompare(right.id);
      });
  }, [gkSessions, searchTerm, selectedMdFilter]);

  const planningRoster = editorSession.squadRoster?.length ? editorSession.squadRoster : goalkeeperRoster;
  const sharedHeader: SharedSessionHeader = {
    id: editorSession.id,
    sessionNumber: editorSession.sessionNumber,
    date: editorSession.date,
    time: editorSession.time,
    teamName: editorSession.teamName,
    microcycleDay: editorSession.microcycleDay,
    attendance: editorSession.attendance || [],
    squadRoster: planningRoster,
    updatedAt: selectedGk?.updatedAt || 0
  };

  const cloudLikeGkSessions: CloudTrainingSession[] = useMemo(() => {
    return gkSessions.map((item) => {
      const ts = toTrainingSession(item);
      return {
        ...ts,
        updatedAt: item.updatedAt,
        footballUpdatedAt: 0,
        fitnessUpdatedAt: 0,
        gkUpdatedAt: item.updatedAt
      };
    });
  }, [gkSessions]);

  const handleUpdateHeader = (fields: Partial<TrainingSession>) => {
    setEditorSession((prev) => ({ ...prev, ...fields }));
  };

  const handleUpdateAttendance = (attendance: PlayerAttendance[]) => {
    setEditorSession((prev) => ({ ...prev, attendance }));
  };

  const handleUpdateRoster = (squadRoster: string[]) => {
    setEditorSession((prev) => ({ ...prev, squadRoster }));
  };

  const handleUpdateGroups = (groups: PlayerGroup[]) => {
    setEditorSession((prev) => ({
      ...prev,
      playerGroups: groups,
      gkPlayerGroups: groups
    }));
  };

  const handleUpdateExercises = (blockKey: 'warmUp' | 'mainPart' | 'coolDown', exercises: any[]) => {
    const field = blockKey === 'warmUp' ? 'gkWarmUp' : blockKey === 'mainPart' ? 'gkMainPart' : 'gkCoolDown';
    const legacyField = blockKey;
    setEditorSession((prev) => ({
      ...prev,
      [field]: {
        ...(prev[field] as any),
        exercises
      },
      [legacyField]: {
        ...(prev[legacyField] as any),
        exercises
      }
    }));
  };

  const toggleExpand = (id: string) => {
    setExpandedExercises((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCreateNew = () => {
    setCreateSessionValidationError(null);
    setNewSessionNumberInput('');
    setIsCreateSessionModalOpen(true);
  };

  const handleCancelCreateSession = () => {
    setIsCreateSessionModalOpen(false);
    setCreateSessionValidationError(null);
    setNewSessionNumberInput('');
  };

  const handleConfirmCreateSession = async () => {
    const normalizedSessionNumber = newSessionNumberInput.trim();
    if (!/^\d+$/.test(normalizedSessionNumber)) {
      setCreateSessionValidationError('Please enter a valid session number.');
      return;
    }

    setIsCreateSessionModalOpen(false);
    setCreateSessionValidationError(null);
    setNewSessionNumberInput('');

    const roster = goalkeeperRoster;
    const attendance: PlayerAttendance[] = roster.map((playerName) => ({ playerName, status: 'Attending' }));
    const fresh = createEmptyGkSession(roster, attendance, normalizedSessionNumber);
    setSaveValidationError(null);
    setEditorSession(toTrainingSession(fresh));
    setSessionSubNav('editor');
    try {
      setIsSaving(true);
      await saveGkSession(fresh);
      setSelectedGkId(fresh.id);
    } catch (error) {
      const err = error as { message?: unknown };
      const message = typeof err?.message === 'string' ? err.message : 'Goalkeeper session save failed.';
      setSaveValidationError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    if (!selectedGk && !editorSession.id) {
      setSaveValidationError('Open or create a Goalkeeper session before saving.');
      return;
    }

    if (!selectedGk && editorSession.id.startsWith('empty-session-')) {
      setSaveValidationError('Cannot save draft placeholder session. Create a New Goalkeeper Session first.');
      return;
    }

    try {
      setSaveValidationError(null);
      setIsSaving(true);
      const recordId = selectedGk?.id || (editorSession.id.startsWith('gk-') ? editorSession.id : `gk-${editorSession.id}`);
      const payload = toGkSession(recordId, editorSession, selectedGk || undefined);
      await saveGkSession(payload);
      setSelectedGkId(payload.id);
    } catch (error) {
      const err = error as { message?: unknown };
      const message = typeof err?.message === 'string' ? err.message : 'Goalkeeper session save failed.';
      setSaveValidationError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectSessionToEdit = (sessionItem: GkSession) => {
    setSelectedGkId(sessionItem.id);
    const converted = toTrainingSession(sessionItem);
    setEditorSession(converted);
    setSessionSubNav('editor');

    // Auto-expand exercises
    const expanded: Record<string, boolean> = {};
    converted.gkWarmUp?.exercises?.forEach((ex) => { expanded[ex.id] = true; });
    converted.gkMainPart?.exercises?.forEach((ex) => { expanded[ex.id] = true; });
    converted.gkCoolDown?.exercises?.forEach((ex) => { expanded[ex.id] = true; });
    setExpandedExercises(expanded);
  };

  const handleDuplicateSession = async (item: GkSession) => {
    const nextNum = String(Date.now()).slice(-3);
    const duplicated: GkSession = {
      ...item,
      id: `gk-session-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      sessionUid: `session-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      sessionNumber: `${item.sessionNumber || 'GK'}-copy`,
      date: new Date().toISOString().split('T')[0],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    try {
      setIsSaving(true);
      await saveGkSession(duplicated);
      setSelectedGkId(duplicated.id);
      setEditorSession(toTrainingSession(duplicated));
      setSessionSubNav('editor');
    } catch (err) {
      console.error('Failed to duplicate session:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (item: GkSession) => {
    if (!confirm(`Are you sure you want to delete Goalkeeper Session #${item.sessionNumber || item.id}?`)) return;
    await deleteGkSession(item.id);
    if (selectedGkId === item.id) {
      const remaining = gkSessions.filter((session) => session.id !== item.id);
      if (remaining.length > 0) {
        setSelectedGkId(remaining[0].id);
        setEditorSession(toTrainingSession(remaining[0]));
      } else {
        setSelectedGkId('');
        setEditorSession(getEmptySession());
      }
    }
  };

  const handleAddExerciseFromLibrary = (
    blockKey: 'warmUp' | 'mainPart' | 'coolDown',
    exercise: any
  ) => {
    const targetBlock = blockKey === 'warmUp' ? 'gkWarmUp' : blockKey === 'mainPart' ? 'gkMainPart' : 'gkCoolDown';
    const legacyBlock = blockKey;
    
    setEditorSession((prev) => {
      const currentExercises = (prev[targetBlock] as any)?.exercises || [];
      const updatedExercises = [...currentExercises, exercise];
      return {
        ...prev,
        [targetBlock]: {
          ...(prev[targetBlock] as any),
          exercises: updatedExercises
        },
        [legacyBlock]: {
          ...(prev[legacyBlock] as any),
          exercises: updatedExercises
        }
      };
    });

    if (exercise.id) {
      setExpandedExercises((prev) => ({ ...prev, [exercise.id]: true }));
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Banner for GK Hub */}
      <div className="bg-[#002142] p-5 sm:p-6 rounded-3xl shadow-xl border border-slate-800 text-white space-y-5 print:hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
          <div>
            <div className="flex items-center space-x-2.5">
              <span className="p-2 bg-sky-500/20 text-sky-400 border border-sky-500/30 rounded-xl shadow-inner">
                <ShieldCheck className="w-5 h-5" />
              </span>
              <div>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center space-x-2">
                  <span>Goalkeeper Management Hub</span>
                  <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30">
                    Goalkeepers Department
                  </span>
                </h1>
                <p className="text-xs text-slate-300 font-medium mt-0.5">
                  Independent goalkeeper training sessions, specialized shot-stopping drills, and dedicated keeper roster.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3 text-xs font-mono shrink-0">
            <span className="bg-slate-800/80 border border-slate-700/80 px-3 py-1.5 rounded-xl text-slate-300 font-bold flex items-center space-x-1.5">
              <FolderOpen className="w-3.5 h-3.5 text-sky-400" />
              <span>{gkSessions.length} Session{gkSessions.length !== 1 ? 's' : ''}</span>
            </span>
            <span className="bg-slate-800/80 border border-slate-700/80 px-3 py-1.5 rounded-xl text-slate-300 font-bold flex items-center space-x-1.5">
              <Users className="w-3.5 h-3.5 text-emerald-400" />
              <span>{goalkeeperSquadPlayers.length} Goalkeeper{goalkeeperSquadPlayers.length !== 1 ? 's' : ''}</span>
            </span>
          </div>
        </div>

        {/* Navigation Cards (Sessions / Library / Goalkeepers) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 1. SESSIONS */}
          <button
            type="button"
            onClick={() => setGkSubTab('sessions')}
            className={`group text-left p-4 sm:p-5 rounded-2xl border transition-all duration-200 flex flex-col justify-between relative overflow-hidden cursor-pointer ${
              gkSubTab === 'sessions'
                ? 'bg-[#0f5981] border-[#5ea4c5] shadow-lg ring-2 ring-[#5ea4c5]/40 scale-[1.01]'
                : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
            }`}
          >
            <div className={`absolute top-0 inset-x-0 h-1 transition-colors ${gkSubTab === 'sessions' ? 'bg-sky-400' : 'bg-slate-800 group-hover:bg-sky-500'}`} />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">DAILY GOALKEEPER WORK</span>
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${gkSubTab === 'sessions' ? 'bg-sky-400 text-slate-950 border-sky-300 font-black' : 'bg-sky-950/60 text-sky-400 border-sky-800/60'}`}>
                  Core Engine
                </span>
              </div>
              <div className="flex items-start space-x-3">
                <div className={`p-3 rounded-xl border shrink-0 transition-transform ${gkSubTab === 'sessions' ? 'bg-sky-500/20 text-sky-400 border-sky-500/40 scale-105' : 'bg-slate-800 text-slate-300 border-slate-700 group-hover:text-sky-400'}`}>
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white group-hover:text-sky-300 transition-colors">Sessions</h3>
                  <p className="text-xs text-slate-400 leading-relaxed mt-1 line-clamp-2">
                    Manage goalkeeper sessions, attendance, and specific GK warm-up, main part, and cool-down exercises.
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-slate-400">
              <span className="text-[11px] font-mono text-slate-400">{cloudLikeGkSessions.length} Session{cloudLikeGkSessions.length !== 1 ? 's' : ''} Saved</span>
              <div className="flex items-center space-x-1 text-sky-400 font-bold group-hover:translate-x-1 transition-transform">
                <span>Open Module</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </button>

          {/* 2. EXERCISE LIBRARY */}
          <button
            type="button"
            onClick={() => setGkSubTab('library')}
            className={`group text-left p-4 sm:p-5 rounded-2xl border transition-all duration-200 flex flex-col justify-between relative overflow-hidden cursor-pointer ${
              gkSubTab === 'library'
                ? 'bg-[#0f5981] border-[#5ea4c5] shadow-lg ring-2 ring-[#5ea4c5]/40 scale-[1.01]'
                : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
            }`}
          >
            <div className={`absolute top-0 inset-x-0 h-1 transition-colors ${gkSubTab === 'library' ? 'bg-sky-400' : 'bg-slate-800 group-hover:bg-sky-500'}`} />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">DRILLS & EXERCISES</span>
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${gkSubTab === 'library' ? 'bg-sky-400 text-slate-950 border-sky-300 font-black' : 'bg-purple-950/60 text-purple-400 border-purple-800/60'}`}>
                  GK Drills
                </span>
              </div>
              <div className="flex items-start space-x-3">
                <div className={`p-3 rounded-xl border shrink-0 transition-transform ${gkSubTab === 'library' ? 'bg-purple-500/20 text-purple-400 border-purple-500/40 scale-105' : 'bg-slate-800 text-slate-300 border-slate-700 group-hover:text-purple-400'}`}>
                  <BookOpen className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white group-hover:text-sky-300 transition-colors">Exercise Library</h3>
                  <p className="text-xs text-slate-400 leading-relaxed mt-1 line-clamp-2">
                    Dedicated goalkeeper exercise repository: shot stopping, high crosses, 1v1 reactions, and footwork drills.
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-slate-400">
              <span className="text-[11px] font-mono text-slate-400">Goalkeeper Drills</span>
              <div className="flex items-center space-x-1 text-sky-400 font-bold group-hover:translate-x-1 transition-transform">
                <span>Open Library</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </button>

          {/* 3. GOALKEEPERS SQUAD */}
          <button
            type="button"
            onClick={() => setGkSubTab('goalkeepers')}
            className={`group text-left p-4 sm:p-5 rounded-2xl border transition-all duration-200 flex flex-col justify-between relative overflow-hidden cursor-pointer ${
              gkSubTab === 'goalkeepers'
                ? 'bg-[#0f5981] border-[#5ea4c5] shadow-lg ring-2 ring-[#5ea4c5]/40 scale-[1.01]'
                : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
            }`}
          >
            <div className={`absolute top-0 inset-x-0 h-1 transition-colors ${gkSubTab === 'goalkeepers' ? 'bg-sky-400' : 'bg-slate-800 group-hover:bg-sky-500'}`} />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">SHOT STOPPERS</span>
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${gkSubTab === 'goalkeepers' ? 'bg-sky-400 text-slate-950 border-sky-300 font-black' : 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60'}`}>
                  GK Roster
                </span>
              </div>
              <div className="flex items-start space-x-3">
                <div className={`p-3 rounded-xl border shrink-0 transition-transform ${gkSubTab === 'goalkeepers' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 scale-105' : 'bg-slate-800 text-slate-300 border-slate-700 group-hover:text-emerald-400'}`}>
                  <Users className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white group-hover:text-sky-300 transition-colors">Goalkeeper Squad</h3>
                  <p className="text-xs text-slate-400 leading-relaxed mt-1 line-clamp-2">
                    Specialized view of goalkeepers, dorsals, status, awards points, and physical profiles.
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-slate-400">
              <span className="text-[11px] font-mono text-slate-400">{goalkeeperSquadPlayers.length} Active Keepers</span>
              <div className="flex items-center space-x-1 text-sky-400 font-bold group-hover:translate-x-1 transition-transform">
                <span>View Roster</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* SESSIONS SUB-TAB */}
      {gkSubTab === 'sessions' ? (
        <div className="space-y-6">
          {/* Sub Navigation Bar: Cards vs Editor */}
          <div className="bg-white border border-slate-200 rounded-2xl p-2.5 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 print:hidden">
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setSessionSubNav('cards')}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center space-x-2 cursor-pointer ${
                  sessionSubNav === 'cards'
                    ? 'bg-[#002142] text-white shadow-md'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Layers className="w-4 h-4 text-sky-400" />
                <span>Session Library</span>
              </button>
              <button
                type="button"
                onClick={() => setSessionSubNav('editor')}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center space-x-2 cursor-pointer ${
                  sessionSubNav === 'editor'
                    ? 'bg-[#002142] text-white shadow-md'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Edit3 className="w-4 h-4 text-amber-400" />
                <span>Session Editor</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleCreateNew}
              className="bg-sky-600 hover:bg-sky-700 text-white text-xs font-extrabold px-4 py-2 rounded-xl shadow-sm transition-all flex items-center justify-center space-x-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New GK Session</span>
            </button>
          </div>

          {/* Modal for creating a new GK session */}
          {isCreateSessionModalOpen ? (
            <div className="fixed inset-0 z-[120] bg-slate-950/70 px-4 py-8 flex items-center justify-center">
              <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900/95 p-6 shadow-2xl">
                <h3 className="text-lg font-black text-white flex items-center space-x-2">
                  <ShieldCheck className="w-5 h-5 text-sky-400" />
                  <span>New Goalkeeper Session</span>
                </h3>
                <div className="mt-4 space-y-2">
                  <label htmlFor="new-gk-session-number" className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                    Session Number
                  </label>
                  <input
                    id="new-gk-session-number"
                    type="text"
                    value={newSessionNumberInput}
                    onChange={(event) => {
                      setNewSessionNumberInput(event.target.value);
                      if (createSessionValidationError) setCreateSessionValidationError(null);
                    }}
                    placeholder="e.g. 14"
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-sm font-semibold text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
                    autoFocus
                  />
                  {createSessionValidationError ? (
                    <p className="text-xs font-semibold text-rose-400">{createSessionValidationError}</p>
                  ) : null}
                </div>
                <div className="mt-6 flex items-center justify-end space-x-3">
                  <button
                    type="button"
                    onClick={handleCancelCreateSession}
                    className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-bold text-slate-300 hover:bg-slate-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmCreateSession}
                    className="rounded-xl bg-sky-600 px-4 py-2 text-xs font-extrabold text-white hover:bg-sky-500 shadow-md cursor-pointer"
                  >
                    Create Session
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {/* SESSIONS CARDS LIST */}
          {sessionSubNav === 'cards' ? (
            <div className="space-y-4">
              {/* Search & MD Filters */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by session #, objective, or date..."
                    className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-sky-500 bg-slate-50/50"
                  />
                </div>

                <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 md:pb-0">
                  {['all', 'MD-4', 'MD-3', 'MD-2', 'MD-1', 'MD', 'MD+1'].map((md) => (
                    <button
                      key={md}
                      type="button"
                      onClick={() => setSelectedMdFilter(md)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-colors shrink-0 cursor-pointer ${
                        selectedMdFilter.toLowerCase() === md.toLowerCase()
                          ? 'bg-[#002142] text-white shadow-sm'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {md}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sessions Grid */}
              {filteredCards.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center space-y-4 shadow-sm">
                  <div className="w-14 h-14 bg-sky-50 rounded-2xl flex items-center justify-center mx-auto text-sky-600 border border-sky-100">
                    <ShieldCheck className="w-7 h-7" />
                  </div>
                  <div className="max-w-md mx-auto space-y-1">
                    <h3 className="text-base font-extrabold text-slate-800">No Goalkeeper Sessions Found</h3>
                    <p className="text-xs text-slate-500">
                      {searchTerm || selectedMdFilter !== 'all'
                        ? 'No sessions match your search or filter criteria.'
                        : 'Create your first dedicated Goalkeeper session to begin planning specific drills and shot-stopping exercises.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCreateNew}
                    className="inline-flex items-center space-x-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-extrabold px-5 py-2.5 rounded-xl shadow-md transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create Goalkeeper Session</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredCards.map((item) => {
                    const warmUpCount = item.gkWarmUp?.exercises?.length || 0;
                    const mainPartCount = item.gkMainPart?.exercises?.length || 0;
                    const coolDownCount = item.gkCoolDown?.exercises?.length || 0;
                    const totalExercises = warmUpCount + mainPartCount + coolDownCount;
                    const attendingKeepersCount = (item.attendance || []).filter((a) => a.status === 'Attending').length;

                    return (
                      <div
                        key={item.id}
                        onClick={() => handleSelectSessionToEdit(item)}
                        className={`group bg-white border rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between relative cursor-pointer ${
                          selectedGkId === item.id ? 'border-sky-500 ring-2 ring-sky-500/20' : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="space-y-3">
                          {/* Card Header: Session Number & MD badge */}
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-black text-slate-900 flex items-center space-x-1.5">
                              <span className="p-1 rounded-lg bg-sky-100 text-sky-700">
                                <ShieldCheck className="w-3.5 h-3.5" />
                              </span>
                              <span>Session #{item.sessionNumber || '—'}</span>
                            </span>
                            <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                              {item.microcycleDay || 'MD'}
                            </span>
                          </div>

                          {/* Date and Time */}
                          <div className="flex items-center space-x-3 text-xs text-slate-500 font-medium">
                            <span className="flex items-center space-x-1">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              <span>{item.date || 'No Date'}</span>
                            </span>
                            <span className="flex items-center space-x-1">
                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                              <span>{item.time || '18:30'}</span>
                            </span>
                          </div>

                          {/* Main Objective */}
                          <div>
                            <p className="text-xs font-bold text-slate-800 line-clamp-2 min-h-[2rem]">
                              {item.mainObjective || <span className="text-slate-400 italic">No specific GK objective defined yet</span>}
                            </p>
                          </div>

                          {/* Exercise Badges */}
                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                            <span className="font-semibold text-slate-600">
                              {totalExercises} GK Drill{totalExercises !== 1 ? 's' : ''}
                            </span>
                            <div className="flex items-center space-x-1 text-[10px]">
                              <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-100">
                                W: {warmUpCount}
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 font-bold border border-sky-100">
                                M: {mainPartCount}
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold border border-indigo-100">
                                C: {coolDownCount}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Card Actions */}
                        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDuplicateSession(item);
                            }}
                            title="Duplicate session"
                            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          
                          <div className="flex items-center space-x-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(item);
                              }}
                              title="Delete session"
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectSessionToEdit(item);
                              }}
                              className="inline-flex items-center space-x-1 text-xs font-extrabold text-sky-700 bg-sky-50 hover:bg-sky-100 px-2.5 py-1 rounded-lg border border-sky-200 transition-colors"
                            >
                              <span>Edit</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* ACTIVE GK SESSION EDITOR */
            <div className="space-y-4">
              {saveValidationError ? (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-800">
                  {saveValidationError}
                </div>
              ) : null}

              <ModuleSessionEditor
                moduleId="gk"
                session={editorSession}
                sharedHeader={sharedHeader}
                planningRoster={planningRoster}
                currentLogo={currentLogo}
                squadPlayers={goalkeeperSquadPlayers}
                isSaving={isSaving}
                expandedExercises={expandedExercises}
                excludedPlayers={excludedPlayers}
                onUpdateHeader={handleUpdateHeader}
                onSave={handleSave}
                onUpdateAttendance={handleUpdateAttendance}
                onUpdateRoster={handleUpdateRoster}
                onUpdateGroups={handleUpdateGroups}
                onUpdateExercises={handleUpdateExercises}
                onToggleExpand={toggleExpand}
                onExcludePlayer={onExcludePlayer}
                onIncludePlayer={onIncludePlayer}
                onUpdateLogo={onUpdateLogo}
              />
            </div>
          )}
        </div>
      ) : gkSubTab === 'library' ? (
        /* EXERCISES LIBRARY TAB SCOPED TO GK */
        <div className="space-y-4">
          <ExercisesLibrary
            currentSession={editorSession}
            cloudSessions={cloudLikeGkSessions}
            onAddExerciseToSession={handleAddExerciseFromLibrary}
            activeSection="gk"
          />
        </div>
      ) : (
        /* GOALKEEPERS SQUAD TAB */
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-black text-slate-900 flex items-center space-x-2">
                  <ShieldCheck className="w-5 h-5 text-sky-600" />
                  <span>Goalkeeper Squad & Status</span>
                </h2>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Goalkeepers registered in the team roster with specific attributes and awards.
                </p>
              </div>
              <span className="text-xs font-mono font-bold px-3 py-1 rounded-xl bg-sky-50 text-sky-700 border border-sky-200">
                {goalkeeperSquadPlayers.length} Goalkeeper{goalkeeperSquadPlayers.length !== 1 ? 's' : ''}
              </span>
            </div>

            {goalkeeperSquadPlayers.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-500 space-y-2">
                <Users className="w-8 h-8 mx-auto text-slate-400" />
                <p className="font-bold text-slate-700">No players with position "GK" found in squad roster.</p>
                <p>Add or set players with position "GK" in the Squad Roster (Plantilla) module.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {goalkeeperSquadPlayers.map((player) => (
                  <div
                    key={player.id}
                    className="bg-slate-50/70 border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4 hover:border-sky-300 transition-colors"
                  >
                    <div className="flex items-center space-x-3.5">
                      <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden flex items-center justify-center shrink-0">
                        {player.photoUrl ? (
                          <SmartImage
                            src={player.photoUrl}
                            alt={`${player.firstName} ${player.lastName}`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <ShieldCheck className="w-7 h-7 text-sky-500" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-mono font-black px-2 py-0.5 rounded-md bg-[#002142] text-white">
                            #{player.number || '—'}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-sky-100 text-sky-800 border border-sky-200">
                            GK
                          </span>
                        </div>
                        <h4 className="text-sm font-extrabold text-slate-900 mt-1">
                          {player.firstName} {player.lastName}
                        </h4>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200 text-xs">
                      <div className="bg-white p-2 rounded-xl border border-slate-100">
                        <span className="text-[10px] text-slate-400 block font-semibold">Status</span>
                        <span className="font-extrabold text-slate-800 capitalize">
                          {player.status || 'Active'}
                        </span>
                      </div>
                      <div className="bg-white p-2 rounded-xl border border-slate-100">
                        <span className="text-[10px] text-slate-400 block font-semibold">Malika Points</span>
                        <span className="font-extrabold text-amber-600 flex items-center space-x-1">
                          <Award className="w-3.5 h-3.5 text-amber-500" />
                          <span>{player.malikaPoints || 0} pts</span>
                        </span>
                      </div>
                    </div>

                    {player.notes ? (
                      <div className="bg-white p-2.5 rounded-xl border border-slate-100 text-xs text-slate-600">
                        <span className="text-[10px] text-slate-400 font-bold block mb-0.5">Notes</span>
                        <p className="line-clamp-2">{player.notes}</p>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
