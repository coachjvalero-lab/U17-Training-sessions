import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, BookOpen, Calendar, Edit3, FileText, FolderOpen, Layers, Plus, Search, Trash2 } from 'lucide-react';
import { getEmptySession } from '../defaultSession';
import type { CloudTrainingSession, FitnessSession, PlayerAttendance, PlayerGroup, SharedSessionHeader, SquadPlayer, TrainingSession } from '../types';
import { ModuleSessionEditor } from './ModuleSessionEditor';
import { ExercisesLibrary } from './ExercisesLibrary';
import { deleteFitnessSession, saveFitnessSession, subscribeToFitnessSessions } from '../services/fitness/fitnessSessionsService';
import { readWorkspaceRestoreState, writeWorkspaceRestoreState } from '../utils/workspaceRestore';

interface FitnessHubSectionProps {
  currentLogo: string;
  squadPlayers: SquadPlayer[];
  excludedPlayers: string[];
  onExcludePlayer: (name: string) => void;
  onIncludePlayer: (name: string) => void;
  onUpdateLogo: (newLogo: string) => void;
}

function defaultFitnessBlock(id: string, title: string) {
  return { id, title, exercises: [] };
}

function toTrainingSession(fitness: FitnessSession): TrainingSession {
  const empty = getEmptySession();
  return {
    ...empty,
    id: fitness.sessionUid,
    teamName: fitness.teamName,
    date: fitness.date,
    time: fitness.time,
    sessionNumber: fitness.sessionNumber,
    microcycleDay: fitness.microcycleDay,
    mainObjective: fitness.mainObjective,
    materialsNeeded: fitness.materialsNeeded,
    observations: fitness.observations,
    squadRoster: fitness.squadRoster,
    attendance: fitness.attendance,
    fitnessWarmUp: fitness.fitnessWarmUp || defaultFitnessBlock('warmup-block-fitness', 'Warm Up'),
    fitnessMainPart: fitness.fitnessMainPart || defaultFitnessBlock('main-block-fitness', 'Main Part'),
    fitnessCoolDown: fitness.fitnessCoolDown || defaultFitnessBlock('cooldown-block-fitness', 'Cool Down'),
    fitnessPlayerGroups: fitness.fitnessPlayerGroups || []
  };
}

function toFitnessSession(recordId: string, session: TrainingSession, previous?: FitnessSession): FitnessSession {
  const now = Date.now();
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
    fitnessWarmUp: session.fitnessWarmUp || defaultFitnessBlock('warmup-block-fitness', 'Warm Up'),
    fitnessMainPart: session.fitnessMainPart || defaultFitnessBlock('main-block-fitness', 'Main Part'),
    fitnessCoolDown: session.fitnessCoolDown || defaultFitnessBlock('cooldown-block-fitness', 'Cool Down'),
    fitnessPlayerGroups: session.fitnessPlayerGroups || [],
    createdAt: previous?.createdAt || now,
    updatedAt: now
  };
}

function createEmptyFitnessSession(squadRoster: string[], attendance: PlayerAttendance[]): FitnessSession {
  const uid = `session-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const today = new Date().toISOString().split('T')[0];
  const now = Date.now();

  return {
    id: `fit-${uid}`,
    sessionUid: uid,
    legacySessionId: uid,
    teamName: 'U17 Women Al Ula',
    date: today,
    time: '18:30 - 20:00',
    sessionNumber: '001',
    microcycleDay: 'MD-3',
    mainObjective: '',
    materialsNeeded: '',
    observations: '',
    squadRoster,
    attendance,
    fitnessWarmUp: defaultFitnessBlock('warmup-block-fitness', 'Warm Up'),
    fitnessMainPart: defaultFitnessBlock('main-block-fitness', 'Main Part'),
    fitnessCoolDown: defaultFitnessBlock('cooldown-block-fitness', 'Cool Down'),
    fitnessPlayerGroups: [],
    createdAt: now,
    updatedAt: now
  };
}

export const FitnessHubSection: React.FC<FitnessHubSectionProps> = ({
  currentLogo,
  squadPlayers,
  excludedPlayers,
  onExcludePlayer,
  onIncludePlayer,
  onUpdateLogo
}) => {
  const contextStorageKey = 'u17_fitness_hub_context';
  const restoredContext = readWorkspaceRestoreState(contextStorageKey, {
    fitnessSubTab: 'sessions' as const,
    sessionSubNav: 'cards' as const,
    searchTerm: ''
  });
  const initialFitnessSubTab =
    restoredContext.fitnessSubTab === 'sessions' ||
    restoredContext.fitnessSubTab === 'monitoring' ||
    restoredContext.fitnessSubTab === 'library'
      ? restoredContext.fitnessSubTab
      : restoredContext.fitnessSubTab === 'wellness'
        ? 'monitoring'
        : 'sessions';

  const [fitnessSubTab, setFitnessSubTab] = useState<'sessions' | 'monitoring' | 'library'>(initialFitnessSubTab);
  const [monitoringSubTab, setMonitoringSubTab] = useState<'wellness' | 'trainingLoad' | 'testing'>('wellness');
  const [sessionSubNav, setSessionSubNav] = useState<'cards' | 'editor'>(restoredContext.sessionSubNav);
  const [searchTerm, setSearchTerm] = useState(restoredContext.searchTerm);
  const [fitnessSessions, setFitnessSessions] = useState<FitnessSession[]>([]);
  const [selectedFitnessId, setSelectedFitnessId] = useState<string>('');
  const [editorSession, setEditorSession] = useState<TrainingSession>(() => getEmptySession());
  const [expandedExercises, setExpandedExercises] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    writeWorkspaceRestoreState(contextStorageKey, { fitnessSubTab, sessionSubNav, searchTerm });
  }, [fitnessSubTab, sessionSubNav, searchTerm]);

  useEffect(() => {
    const unsubscribe = subscribeToFitnessSessions((items) => {
      setFitnessSessions(items);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (fitnessSessions.length === 0) return;
    if (!selectedFitnessId || !fitnessSessions.some((item) => item.id === selectedFitnessId)) {
      const first = fitnessSessions[0];
      setSelectedFitnessId(first.id);
      setEditorSession(toTrainingSession(first));
    }
  }, [fitnessSessions, selectedFitnessId]);

  const selectedFitness = useMemo(
    () => fitnessSessions.find((item) => item.id === selectedFitnessId) || null,
    [fitnessSessions, selectedFitnessId]
  );

  const filteredCards = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return fitnessSessions
      .filter((item) => {
        if (!term) return true;
        return (
          item.sessionNumber.toLowerCase().includes(term) ||
          item.mainObjective.toLowerCase().includes(term) ||
          item.date.toLowerCase().includes(term)
        );
      })
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [fitnessSessions, searchTerm]);

  const planningRoster = editorSession.squadRoster || [];
  const sharedHeader: SharedSessionHeader = {
    id: editorSession.id,
    sessionNumber: editorSession.sessionNumber,
    date: editorSession.date,
    time: editorSession.time,
    teamName: editorSession.teamName,
    microcycleDay: editorSession.microcycleDay,
    attendance: editorSession.attendance || [],
    squadRoster: planningRoster,
    updatedAt: selectedFitness?.updatedAt || 0
  };

  const cloudLikeFitnessSessions: CloudTrainingSession[] = fitnessSessions.map((item) => {
    const ts = toTrainingSession(item);
    return {
      ...ts,
      updatedAt: item.updatedAt,
      footballUpdatedAt: 0,
      fitnessUpdatedAt: item.updatedAt,
      gkUpdatedAt: 0
    };
  });

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
    setEditorSession((prev) => ({ ...prev, fitnessPlayerGroups: groups }));
  };

  const handleUpdateExercises = (blockKey: 'warmUp' | 'mainPart' | 'coolDown', exercises: any[]) => {
    const field = blockKey === 'warmUp' ? 'fitnessWarmUp' : blockKey === 'mainPart' ? 'fitnessMainPart' : 'fitnessCoolDown';
    setEditorSession((prev) => ({
      ...prev,
      [field]: {
        ...(prev[field] as any),
        exercises
      }
    }));
  };

  const toggleExpand = (id: string) => {
    setExpandedExercises((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCreateNew = async () => {
    const roster = squadPlayers
      .map((player) => (player.position === 'GK' ? `${player.firstName} (GK)` : `${player.firstName} ${player.lastName}`.trim()));
    const attendance: PlayerAttendance[] = roster.map((playerName) => ({ playerName, status: 'Attending' }));
    const fresh = createEmptyFitnessSession(roster, attendance);
    setEditorSession(toTrainingSession(fresh));
    setSessionSubNav('editor');
    try {
      setIsSaving(true);
      await saveFitnessSession(fresh);
      setSelectedFitnessId(fresh.id);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    if (!selectedFitness && !editorSession.id) return;

    try {
      setIsSaving(true);
      const recordId = selectedFitness?.id || `fit-${editorSession.id}`;
      const payload = toFitnessSession(recordId, editorSession, selectedFitness || undefined);
      await saveFitnessSession(payload);
      setSelectedFitnessId(payload.id);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (item: FitnessSession) => {
    if (!confirm(`Delete Fitness Session #${item.sessionNumber}?`)) return;
    await deleteFitnessSession(item.id);
    if (selectedFitnessId === item.id) {
      const remaining = fitnessSessions.filter((session) => session.id !== item.id);
      if (remaining.length > 0) {
        setSelectedFitnessId(remaining[0].id);
        setEditorSession(toTrainingSession(remaining[0]));
      } else {
        setSelectedFitnessId('');
        setEditorSession(getEmptySession());
      }
    }
  };

  return (
    <div className="space-y-6 print:hidden">
      <div className="bg-[#002142] p-5 sm:p-6 rounded-3xl shadow-xl border border-slate-800 text-white space-y-5 print:hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
          <div>
            <div className="flex items-center space-x-2.5">
              <span className="p-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl">
                <Layers className="w-5 h-5" />
              </span>
              <div>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center space-x-2">
                  <span>Fitness Management Hub</span>
                  <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Fitness Department
                  </span>
                </h1>
                <p className="text-xs text-slate-300 font-medium">
                  Independent fitness sessions, wellness and testing structure, and module-scoped exercise library.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3 text-xs font-mono shrink-0">
            <span className="bg-slate-800/80 border border-slate-700/80 px-3 py-1.5 rounded-xl text-slate-300 font-bold flex items-center space-x-1.5">
              <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
              <span>{fitnessSessions.length} Session{fitnessSessions.length !== 1 ? 's' : ''}</span>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            type="button"
            onClick={() => setFitnessSubTab('sessions')}
            className={`group text-left p-4 sm:p-5 rounded-2xl border transition-all duration-200 flex flex-col justify-between relative overflow-hidden cursor-pointer ${
              fitnessSubTab === 'sessions'
                ? 'bg-[#0f5981] border-[#5ea4c5] shadow-lg ring-2 ring-[#5ea4c5]/40 scale-[1.01]'
                : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
            }`}
          >
            <div className={`absolute top-0 inset-x-0 h-1 transition-colors ${fitnessSubTab === 'sessions' ? 'bg-emerald-500' : 'bg-slate-800 group-hover:bg-emerald-600'}`} />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">DAILY FITNESS WORK</span>
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${fitnessSubTab === 'sessions' ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black' : 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60'}`}>
                  Core Engine
                </span>
              </div>
              <div className="flex items-start space-x-3">
                <div className={`p-3 rounded-xl border shrink-0 transition-transform ${fitnessSubTab === 'sessions' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 scale-105' : 'bg-slate-800 text-slate-300 border-slate-700 group-hover:text-emerald-400'}`}>
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white group-hover:text-emerald-300 transition-colors">Sessions</h3>
                  <p className="text-xs text-slate-400 leading-relaxed mt-1 line-clamp-2">
                    Manage fitness sessions, editor fields, attendance, and the fitness-specific warm-up, main part, and cool-down content.
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-slate-400">
              <span className="text-[11px] font-mono text-slate-400">{cloudLikeFitnessSessions.length} Session{cloudLikeFitnessSessions.length !== 1 ? 's' : ''} Saved</span>
              <div className="flex items-center space-x-1 text-emerald-400 font-bold group-hover:translate-x-1 transition-transform">
                <span>Open Module</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setFitnessSubTab('monitoring')}
            className={`group text-left p-4 sm:p-5 rounded-2xl border transition-all duration-200 flex flex-col justify-between relative overflow-hidden cursor-pointer ${
              fitnessSubTab === 'monitoring'
                ? 'bg-[#0f5981] border-[#5ea4c5] shadow-lg ring-2 ring-[#5ea4c5]/40 scale-[1.01]'
                : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
            }`}
          >
            <div className={`absolute top-0 inset-x-0 h-1 transition-colors ${fitnessSubTab === 'monitoring' ? 'bg-emerald-500' : 'bg-slate-800 group-hover:bg-emerald-600'}`} />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">PLAYER MONITORING</span>
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${fitnessSubTab === 'monitoring' ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black' : 'bg-indigo-950/60 text-indigo-400 border-indigo-800/60'}`}>
                  Structure only
                </span>
              </div>
              <div className="flex items-start space-x-3">
                <div className={`p-3 rounded-xl border shrink-0 transition-transform ${fitnessSubTab === 'monitoring' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 scale-105' : 'bg-slate-800 text-slate-300 border-slate-700 group-hover:text-emerald-400'}`}>
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white group-hover:text-emerald-300 transition-colors">Player Monitoring</h3>
                  <p className="text-xs text-slate-400 leading-relaxed mt-1 line-clamp-2">
                    Visual container for wellness, training load, and testing navigation only.
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-slate-400">
              <span className="text-[11px] font-mono text-slate-400">Monitoring Shell</span>
              <div className="flex items-center space-x-1 text-emerald-400 font-bold group-hover:translate-x-1 transition-transform">
                <span>Open Module</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setFitnessSubTab('library')}
            className={`group text-left p-4 sm:p-5 rounded-2xl border transition-all duration-200 flex flex-col justify-between relative overflow-hidden cursor-pointer ${
              fitnessSubTab === 'library'
                ? 'bg-slate-900 border-emerald-500 shadow-lg ring-2 ring-emerald-500/30 scale-[1.01]'
                : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
            }`}
          >
            <div className={`absolute top-0 inset-x-0 h-1 transition-colors ${fitnessSubTab === 'library' ? 'bg-emerald-500' : 'bg-slate-800 group-hover:bg-emerald-600'}`} />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">DRILLS & EXERCISES</span>
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${fitnessSubTab === 'library' ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black' : 'bg-purple-950/60 text-purple-400 border-purple-800/60'}`}>
                  Library Hub
                </span>
              </div>
              <div className="flex items-start space-x-3">
                <div className={`p-3 rounded-xl border shrink-0 transition-transform ${fitnessSubTab === 'library' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 scale-105' : 'bg-slate-800 text-slate-300 border-slate-700 group-hover:text-emerald-400'}`}>
                  <BookOpen className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white group-hover:text-emerald-300 transition-colors">Exercise Library</h3>
                  <p className="text-xs text-slate-400 leading-relaxed mt-1 line-clamp-2">
                    Fitness-owned exercise library, independent from Football and GK, with coach-managed additions only.
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-slate-400">
              <span className="text-[11px] font-mono text-slate-400">Library Repository</span>
              <div className="flex items-center space-x-1 text-emerald-400 font-bold group-hover:translate-x-1 transition-transform">
                <span>Open Library</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </button>
        </div>
      </div>

      {fitnessSubTab === 'sessions' ? (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-2.5 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <button type="button" onClick={() => setSessionSubNav('cards')} className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center space-x-2 cursor-pointer ${sessionSubNav === 'cards' ? 'bg-[#002142] text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'}`}>
                <Layers className="w-4 h-4 text-emerald-400" />
                <span>Session Library</span>
              </button>
              <button type="button" onClick={() => setSessionSubNav('editor')} className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center space-x-2 cursor-pointer ${sessionSubNav === 'editor' ? 'bg-[#002142] text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'}`}>
                <Edit3 className="w-4 h-4 text-amber-400" />
                <span>Session Editor</span>
              </button>
            </div>
            <button type="button" onClick={handleCreateNew} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold px-4 py-2 rounded-xl shadow-sm transition-all flex items-center justify-center space-x-2 cursor-pointer">
              <Plus className="w-4 h-4" />
              <span>New Fitness Session</span>
            </button>
          </div>

          {sessionSubNav === 'cards' ? (
            <div className="space-y-5">
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="relative w-full md:w-80">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search fitness sessions..."
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#002142]/10 focus:border-[#0f5981] transition-all"
                  />
                </div>

                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  {filteredCards.length} Matching Session{filteredCards.length !== 1 ? 's' : ''}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredCards.map((item) => (
                  <div key={item.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-black uppercase text-slate-400">Fitness Session</span>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">#{item.sessionNumber}</span>
                    </div>
                    <h3 className="text-sm font-extrabold text-slate-900">{item.mainObjective || 'Fitness session'}</h3>
                    <p className="text-xs text-slate-500 mt-1">{item.date} • {item.time}</p>
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedFitnessId(item.id);
                          setEditorSession(toTrainingSession(item));
                          setSessionSubNav('editor');
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#002142] text-white text-xs font-bold"
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                        <span>Open</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <ModuleSessionEditor
              moduleId="fitness"
              session={editorSession}
              sharedHeader={sharedHeader}
              planningRoster={planningRoster}
              currentLogo={currentLogo}
              squadPlayers={squadPlayers}
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
          )}
        </div>
      ) : fitnessSubTab === 'monitoring' ? (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-4">
              <div>
                <h2 className="text-sm font-display font-black text-slate-900 uppercase tracking-wider">Player Monitoring</h2>
                <p className="text-[10px] text-slate-400 font-bold">
                  Visual-only navigation shell. No functionality, tables, hooks, or calculations yet.
                </p>
              </div>
              <span className="text-[10px] font-extrabold text-[#8a7549] bg-[#ede9e6] px-2.5 py-1 rounded-lg border border-[#a79078]/30">Structure Only</span>
            </div>

            <div className="flex flex-wrap gap-2">
              {[
                { key: 'wellness' as const, label: 'Wellness' },
                { key: 'trainingLoad' as const, label: 'Training Load' },
                { key: 'testing' as const, label: 'Testing' }
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setMonitoringSubTab(item.key)}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${monitoringSubTab === item.key ? 'bg-[#002142] text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">{monitoringSubTab === 'trainingLoad' ? 'Training Load' : monitoringSubTab === 'testing' ? 'Testing' : 'Wellness'}</div>
              <p className="mt-2 text-xs font-semibold text-slate-700 leading-relaxed">
                Navigation placeholder only. Functional screens for this area will be added later.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <ExercisesLibrary
          currentSession={editorSession}
          cloudSessions={cloudLikeFitnessSessions}
          onAddExerciseToSession={(blockKey, exercise) => {
            handleUpdateExercises(blockKey, [
              ...(((blockKey === 'warmUp' ? editorSession.fitnessWarmUp : blockKey === 'mainPart' ? editorSession.fitnessMainPart : editorSession.fitnessCoolDown)?.exercises) || []),
              exercise
            ]);
          }}
          activeSection="fitness"
        />
      )}
    </div>
  );
};
