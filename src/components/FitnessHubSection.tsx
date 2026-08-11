import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, Edit3, FolderOpen, Layers, Plus, Search } from 'lucide-react';
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
  onSyncLegacyFitness: (session: TrainingSession, meta: { sessionUid: string; sessionNumber: string }) => Promise<void>;
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
  onUpdateLogo,
  onSyncLegacyFitness
}) => {
  const contextStorageKey = 'u17_fitness_hub_context';
  const restoredContext = readWorkspaceRestoreState(contextStorageKey, {
    fitnessSubTab: 'sessions' as const,
    sessionSubNav: 'cards' as const,
    searchTerm: ''
  });

  const [fitnessSubTab, setFitnessSubTab] = useState<'dashboard' | 'sessions' | 'library'>(restoredContext.fitnessSubTab);
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
      await onSyncLegacyFitness(toTrainingSession(fresh), { sessionUid: fresh.sessionUid, sessionNumber: fresh.sessionNumber });
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
      await onSyncLegacyFitness(editorSession, { sessionUid: payload.sessionUid, sessionNumber: payload.sessionNumber });
      setSelectedFitnessId(payload.id);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (item: FitnessSession) => {
    if (!confirm(`Delete Fitness Session #${item.sessionNumber}?`)) return;
    await deleteFitnessSession(item.id);
    if (selectedFitnessId === item.id) {
      setSelectedFitnessId('');
    }
  };

  return (
    <div className="space-y-6 print:hidden">
      <div className="bg-gradient-to-r from-[#002142] via-[#003366] to-[#0f5981] rounded-2xl p-6 text-white shadow-xl border border-[#5ea4c5]/30">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black tracking-tight">Fitness Module</h2>
            <p className="text-xs text-sky-200/80 font-medium">
              Independent Fitness sessions and module-scoped exercise library.
            </p>
          </div>
          <button
            type="button"
            onClick={handleCreateNew}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 rounded-xl text-xs font-extrabold"
          >
            <Plus className="w-4 h-4" />
            <span>New Fitness Session</span>
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-2.5 shadow-sm flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setFitnessSubTab('dashboard')} className={`px-4 py-2 rounded-xl text-xs font-black ${fitnessSubTab === 'dashboard' ? 'bg-[#002142] text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
          Dashboard
        </button>
        <button type="button" onClick={() => setFitnessSubTab('sessions')} className={`px-4 py-2 rounded-xl text-xs font-black ${fitnessSubTab === 'sessions' ? 'bg-[#002142] text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
          Sessions
        </button>
        <button type="button" onClick={() => setFitnessSubTab('library')} className={`px-4 py-2 rounded-xl text-xs font-black ${fitnessSubTab === 'library' ? 'bg-[#002142] text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
          Exercise Library
        </button>
      </div>

      {fitnessSubTab === 'dashboard' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <p className="text-[10px] font-black uppercase text-slate-400">Fitness Sessions</p>
            <p className="text-2xl font-black text-slate-900">{fitnessSessions.length}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <p className="text-[10px] font-black uppercase text-slate-400">Active Session</p>
            <p className="text-sm font-extrabold text-slate-900">#{editorSession.sessionNumber || '---'}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <p className="text-[10px] font-black uppercase text-slate-400">Date</p>
            <p className="text-sm font-extrabold text-slate-900">{editorSession.date || '---'}</p>
          </div>
        </div>
      ) : fitnessSubTab === 'library' ? (
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
      ) : (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-2.5 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <button type="button" onClick={() => setSessionSubNav('cards')} className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center space-x-2 ${sessionSubNav === 'cards' ? 'bg-[#002142] text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'}`}>
                <Layers className="w-4 h-4 text-emerald-400" />
                <span>Session Library</span>
              </button>
              <button type="button" onClick={() => setSessionSubNav('editor')} className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center space-x-2 ${sessionSubNav === 'editor' ? 'bg-[#002142] text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'}`}>
                <Edit3 className="w-4 h-4 text-amber-400" />
                <span>Session Editor</span>
              </button>
            </div>
            <button type="button" onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold px-4 py-2 rounded-xl shadow-sm" disabled={isSaving}>
              Save Fitness Session
            </button>
          </div>

          {sessionSubNav === 'cards' ? (
            <div className="space-y-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center gap-3">
                <Search className="w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search Fitness sessions..."
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold"
                />
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
                        <Calendar className="w-3.5 h-3.5" />
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
      )}
    </div>
  );
};
