import React, { useEffect, useMemo, useState } from 'react';
import { 
  FileText, 
  Calendar, 
  Trophy, 
  Layers, 
  Plus, 
  Search, 
  Edit3, 
  ArrowRight, 
  Clock, 
  FolderOpen,
  BookOpen,
  Trash2
} from 'lucide-react';
import { TrainingSession, Exercise, MatchFixture } from '../types';
import { CloudTrainingSession } from '../firebase';
import { PlanificationSection } from './PlanificationSection';
import { CompetitionSection } from './CompetitionSection';
import { ExercisesLibrary } from './ExercisesLibrary';
import { readWorkspaceRestoreState, writeWorkspaceRestoreState } from '../utils/workspaceRestore';

export interface DrillCard {
  id: string;
  sessionNumber: number;
  title: string;
  coachName?: string;
  coachAvatar?: string;
  date: string;
  category: 'Rondo' | 'Game' | 'Speed' | 'Build-Up' | 'Finishing' | 'Tactical';
  drillType?: 'rondo5v2' | 'game7v7' | 'speed3v0' | 'buildup4v3' | 'finishing2v1';
  likesCount: number;
  isBookmarked: boolean;
  groupCount: number;
  rating: string;
  isSelected?: boolean;
  status: 'active' | 'completed' | 'draft';
  duration?: string;
  intensity?: string;
  description?: string;
  exerciseData?: any;
  createdAt?: number;
  updatedAt?: number;
  role?: 'football' | 'fitness' | 'gk';
}

interface FootballHubSectionProps {
  session: TrainingSession;
  cloudSessions: CloudTrainingSession[];
  onChangeSession: (updatedSession: Partial<TrainingSession>) => void;
  renderActiveSessionEditor: () => React.ReactNode;
  squadRoster?: string[];
  fixtures?: MatchFixture[];
  onUpdateFixtures?: (fixtures: MatchFixture[]) => void;
  onAddExerciseToSession?: (
    blockKey: 'warmUp' | 'mainPart' | 'coolDown', 
    exercise: Exercise,
    targetSection?: 'football' | 'fitness' | 'gk'
  ) => void;
  onLoadCloudSession?: (sess: CloudTrainingSession) => void;
  onDeleteCloudSession?: (id: string, sessNum: string, e: React.MouseEvent) => void;
  onNewSession?: () => void;
  role?: 'football' | 'fitness' | 'gk';
}

export const FootballHubSection: React.FC<FootballHubSectionProps> = ({
  session,
  cloudSessions,
  renderActiveSessionEditor,
  squadRoster = [],
  fixtures,
  onUpdateFixtures,
  onAddExerciseToSession,
  onLoadCloudSession,
  onDeleteCloudSession,
  onNewSession,
  role = 'football'
}) => {
  const contextStorageKey = `u17_football_hub_context_${role}`;
  const restoredContext = readWorkspaceRestoreState(contextStorageKey, {
    footballSubTab: 'sessions' as const,
    sessionSubNav: 'cards' as const,
    searchTerm: ''
  });

  // Main Football Sub-tab Navigation: 'sessions' | 'planning' | 'competition' | 'library'
  const [footballSubTab, setFootballSubTab] = useState<'sessions' | 'planning' | 'competition' | 'library'>(restoredContext.footballSubTab);

  // Sub-navigation inside 'sessions': 'cards' | 'editor'
  const [sessionSubNav, setSessionSubNav] = useState<'cards' | 'editor'>(restoredContext.sessionSubNav);

  // Search term for filtering sessions
  const [searchTerm, setSearchTerm] = useState(restoredContext.searchTerm);
  const sessionCards = useMemo<DrillCard[]>(() => {
    return cloudSessions
      .map((sess) => ({
        id: sess.id,
        sessionNumber: Number(sess.sessionNumber || 0) || 0,
        title: sess.mainObjective || `Session #${sess.sessionNumber || '?'}`,
        date: sess.date || new Date().toLocaleDateString('en-CA'),
        category: 'Tactical' as const,
        description: sess.observations || 'No description',
        duration: 'Session',
        intensity: role === 'fitness' ? 'Fitness' : role === 'gk' ? 'GK' : 'Football',
        drillType: 'rondo5v2' as const,
        likesCount: 0,
        isBookmarked: false,
        groupCount: (sess.playerGroups || []).length,
        rating: '—',
        status: (session.id === sess.id ? 'active' : 'draft') as DrillCard['status'],
        updatedAt: sess.updatedAt,
        role
      }))
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }, [cloudSessions, role, session.id]);

  // Filter cloud sessions
  const filteredSessions = sessionCards
    .filter((sess) => {
      const search = searchTerm.toLowerCase();
      const matchesSearch =
        sess.title?.toLowerCase().includes(search) ||
        String(sess.sessionNumber).includes(search) ||
        `session #${sess.sessionNumber}`.toLowerCase().includes(search);
      return matchesSearch;
    })
    .sort((a, b) => {
      const dateA = a.date || '';
      const dateB = b.date || '';
      return dateB.localeCompare(dateA);
    });

  useEffect(() => {
    writeWorkspaceRestoreState(contextStorageKey, { footballSubTab, sessionSubNav, searchTerm });
  }, [contextStorageKey, footballSubTab, sessionSubNav, searchTerm]);

  const roleTitle = role === 'fitness'
    ? 'Fitness & Conditioning Hub'
    : role === 'gk'
      ? 'Goalkeeper Hub'
      : 'Football Management Hub';

  const roleSubtitle = role === 'fitness'
    ? 'Create and review conditioning blocks, physical themes, and training cards for the fitness department.'
    : role === 'gk'
      ? 'Create and review goalkeeper-specific cards, shot-stopping themes, and distribution drills.'
      : 'Select a module to view daily training sessions, planification microcycles, or match fixtures';

  const roleBadge = role === 'fitness'
    ? 'Fitness Department'
    : role === 'gk'
      ? 'GK Department'
      : 'Al Ula FC';

  return (
    <div className="space-y-6">
      
      {/* 1. ROLE MODULE NAVIGATION HUB (PORTALHUB CARDS STYLE) */}
      <div className="bg-[#002142] p-5 sm:p-6 rounded-3xl shadow-xl border border-slate-800 text-white space-y-5 print:hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
          <div>
            <div className="flex items-center space-x-2.5">
              <span className="p-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl">
                <Layers className="w-5 h-5" />
              </span>
              <div>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center space-x-2">
                  <span>{roleTitle}</span>
                  <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {roleBadge}
                  </span>
                </h1>
                <p className="text-xs text-slate-300 font-medium">
                  {roleSubtitle}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3 text-xs font-mono shrink-0">
            <span className="bg-slate-800/80 border border-slate-700/80 px-3 py-1.5 rounded-xl text-slate-300 font-bold flex items-center space-x-1.5">
              <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
              <span>{sessionCards.length} Session{sessionCards.length !== 1 ? 's' : ''}</span>
            </span>
          </div>
        </div>

        {/* TOP 4 MODULE NAVIGATION CARDS (PortalHub Grid Style) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Card 1: Training Sessions */}
          <button
            type="button"
            onClick={() => setFootballSubTab('sessions')}
            className={`group text-left p-4 sm:p-5 rounded-2xl border transition-all duration-200 flex flex-col justify-between relative overflow-hidden cursor-pointer ${
              footballSubTab === 'sessions'
                ? 'bg-[#0f5981] border-[#5ea4c5] shadow-lg ring-2 ring-[#5ea4c5]/40 scale-[1.01]'
                : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
            }`}
          >
            <div className={`absolute top-0 inset-x-0 h-1 transition-colors ${
              footballSubTab === 'sessions' ? 'bg-emerald-500' : 'bg-slate-800 group-hover:bg-emerald-600'
            }`} />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  DAILY ON-FIELD WORK
                </span>
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                  footballSubTab === 'sessions' 
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black' 
                    : 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60'
                }`}>
                  Core Engine
                </span>
              </div>

              <div className="flex items-start space-x-3">
                <div className={`p-3 rounded-xl border shrink-0 transition-transform ${
                  footballSubTab === 'sessions'
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 scale-105'
                    : 'bg-slate-800 text-slate-300 border-slate-700 group-hover:text-emerald-400'
                }`}>
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white group-hover:text-emerald-300 transition-colors">
                    Training Sessions / Sesiones
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed mt-1 line-clamp-2">
                    Manage daily training sessions, warm-up, main drills, cool down, tactical cards, attendance, and player groups.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-slate-400">
              <span className="text-[11px] font-mono text-slate-400">
                {cloudSessions.length} Session{cloudSessions.length !== 1 ? 's' : ''} Saved
              </span>
              <div className="flex items-center space-x-1 text-emerald-400 font-bold group-hover:translate-x-1 transition-transform">
                <span>Open Module</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </button>

          {/* Card 2: Planification & Microcycle */}
          <button
            type="button"
            onClick={() => setFootballSubTab('planning')}
            className={`group text-left p-4 sm:p-5 rounded-2xl border transition-all duration-200 flex flex-col justify-between relative overflow-hidden cursor-pointer ${
              footballSubTab === 'planning'
                ? 'bg-[#0f5981] border-[#5ea4c5] shadow-lg ring-2 ring-[#5ea4c5]/40 scale-[1.01]'
                : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
            }`}
          >
            <div className={`absolute top-0 inset-x-0 h-1 transition-colors ${
              footballSubTab === 'planning' ? 'bg-emerald-500' : 'bg-slate-800 group-hover:bg-emerald-600'
            }`} />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  PERIODIZATION & STRUCTURE
                </span>
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                  footballSubTab === 'planning' 
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black' 
                    : 'bg-indigo-950/60 text-indigo-400 border-indigo-800/60'
                }`}>
                  Weekly Prep
                </span>
              </div>

              <div className="flex items-start space-x-3">
                <div className={`p-3 rounded-xl border shrink-0 transition-transform ${
                  footballSubTab === 'planning'
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 scale-105'
                    : 'bg-slate-800 text-slate-300 border-slate-700 group-hover:text-emerald-400'
                }`}>
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white group-hover:text-emerald-300 transition-colors">
                    Planification & Microcycle
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed mt-1 line-clamp-2">
                    Macrocycle targets, weekly workload distribution, microcycle planning, and matchday prep (-3, -2, -1, MD).
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-slate-400">
              <span className="text-[11px] font-mono text-slate-400">
                Weekly Load Distribution
              </span>
              <div className="flex items-center space-x-1 text-emerald-400 font-bold group-hover:translate-x-1 transition-transform">
                <span>Open Module</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </button>

          {/* Card 3: Competition & Matches */}
          <button
            type="button"
            onClick={() => setFootballSubTab('competition')}
            className={`group text-left p-4 sm:p-5 rounded-2xl border transition-all duration-200 flex flex-col justify-between relative overflow-hidden cursor-pointer ${
              footballSubTab === 'competition'
                ? 'bg-[#0f5981] border-[#5ea4c5] shadow-lg ring-2 ring-[#5ea4c5]/40 scale-[1.01]'
                : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
            }`}
          >
            <div className={`absolute top-0 inset-x-0 h-1 transition-colors ${
              footballSubTab === 'competition' ? 'bg-emerald-500' : 'bg-slate-800 group-hover:bg-emerald-600'
            }`} />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  MATCHDAY & SCOUTING
                </span>
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                  footballSubTab === 'competition' 
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black' 
                    : 'bg-amber-950/60 text-amber-400 border-amber-800/60'
                }`}>
                  Official Fixtures
                </span>
              </div>

              <div className="flex items-start space-x-3">
                <div className={`p-3 rounded-xl border shrink-0 transition-transform ${
                  footballSubTab === 'competition'
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 scale-105'
                    : 'bg-slate-800 text-slate-300 border-slate-700 group-hover:text-emerald-400'
                }`}>
                  <Trophy className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white group-hover:text-emerald-300 transition-colors">
                    Competition & Matches
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed mt-1 line-clamp-2">
                    Fixture calendar, opposition analysis, starting XI lineups, match outcomes, and tactical scouting notes.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-slate-400">
              <span className="text-[11px] font-mono text-slate-400">
                League Fixtures & Results
              </span>
              <div className="flex items-center space-x-1 text-emerald-400 font-bold group-hover:translate-x-1 transition-transform">
                <span>Open Module</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </button>

          {/* Card 4: Exercises & Session Library */}
          <button
            type="button"
            onClick={() => setFootballSubTab('library')}
            className={`group text-left p-4 sm:p-5 rounded-2xl border transition-all duration-200 flex flex-col justify-between relative overflow-hidden cursor-pointer ${
              footballSubTab === 'library'
                ? 'bg-slate-900 border-emerald-500 shadow-lg ring-2 ring-emerald-500/30 scale-[1.01]'
                : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
            }`}
          >
            <div className={`absolute top-0 inset-x-0 h-1 transition-colors ${
              footballSubTab === 'library' ? 'bg-emerald-500' : 'bg-slate-800 group-hover:bg-emerald-600'
            }`} />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  DRILLS & EXERCISES
                </span>
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                  footballSubTab === 'library' 
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black' 
                    : 'bg-purple-950/60 text-purple-400 border-purple-800/60'
                }`}>
                  Librería Hub
                </span>
              </div>

              <div className="flex items-start space-x-3">
                <div className={`p-3 rounded-xl border shrink-0 transition-transform ${
                  footballSubTab === 'library'
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 scale-105'
                    : 'bg-slate-800 text-slate-300 border-slate-700 group-hover:text-emerald-400'
                }`}>
                  <BookOpen className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white group-hover:text-emerald-300 transition-colors">
                    Librería de Ejercicios
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed mt-1 line-clamp-2">
                    Buscador y repositorio de ejercicios y tareas tácticas por momento de juego, dimensiones y roles.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-slate-400">
              <span className="text-[11px] font-mono text-slate-400">
                Drill Repository
              </span>
              <div className="flex items-center space-x-1 text-emerald-400 font-bold group-hover:translate-x-1 transition-transform">
                <span>Open Library</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </button>

        </div>
      </div>

      {/* 2. SUB-CONTENT VIEW DIRECTED BY SELECTED MODULE */}
      {footballSubTab === 'planning' ? (
        <PlanificationSection session={session} cloudSessions={cloudSessions} />
      ) : footballSubTab === 'competition' ? (
        <CompetitionSection
          session={session}
          squadRoster={squadRoster}
          fixtures={fixtures}
          onUpdateFixtures={onUpdateFixtures}
        />
      ) : footballSubTab === 'library' ? (
        <ExercisesLibrary
          currentSession={session}
          cloudSessions={cloudSessions}
          onAddExerciseToSession={onAddExerciseToSession || (() => {})}
          activeSection="football"
        />
      ) : (
        /* TRAINING SESSIONS SUB MODULE WORKSPACE */
        <div className="space-y-6">
          
          {/* SECONDARY NAVIGATION BAR INSIDE TRAINING SESSIONS */}
          <div className="bg-white border border-slate-200 rounded-2xl p-2.5 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
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
                <Layers className="w-4 h-4 text-emerald-400" />
                <span>Session & Drill Cards / Galería</span>
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
                <span>Active Session Designer / Editor</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => onNewSession && onNewSession()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold px-4 py-2 rounded-xl shadow-sm transition-all flex items-center justify-center space-x-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Sesión / New Session</span>
            </button>
          </div>

          {/* VIEW MODE 1: SESSION & DRILL CARDS GALLERY (SCREENSHOT MATCHING STYLE) */}
          {sessionSubNav === 'cards' ? (
            <div className="space-y-5">
              
              {/* Filter & Search Bar */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
                {/* Search */}
                <div className="relative w-full md:w-80">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search sessions by objective or number..."
                    className="w-full pl-9 pr-4 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                {/* Session Count */}
                <div className="text-xs font-bold text-slate-600">
                  {filteredSessions.length} session{filteredSessions.length !== 1 ? 's' : ''} found
                </div>
              </div>

              {/* CARDS GRID (3-COLUMN RESPONSIVE) */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sessionCards.length === 0 ? (
                  <div className="col-span-full p-8 text-center bg-white rounded-2xl border border-slate-200">
                    <FolderOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-sm text-slate-500 font-semibold">
                      {searchTerm ? 'No sessions match your search' : 'No sessions saved yet'}
                    </p>
                    {!searchTerm && (
                      <button
                        type="button"
                        onClick={() => onNewSession && onNewSession()}
                        className="mt-4 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold rounded-xl transition-all"
                      >
                        Create your first session
                      </button>
                    )}
                  </div>
                ) : (
                  filteredSessions.map((sess) => {
                    const isActive = session.id === sess.id;

                    return (
                      <div
                        key={`${sess.id}-${sess.updatedAt}-${sess.title}`}
                        className={`group bg-white rounded-2xl border transition-all duration-200 shadow-sm hover:shadow-lg flex flex-col justify-between overflow-hidden relative ${
                          isActive 
                            ? 'border-emerald-500 ring-2 ring-emerald-500/20' 
                            : 'border-slate-200/90 hover:border-slate-300'
                        }`}
                      >
                        {/* CARD TOP HEADER */}
                        <div className="p-4 flex items-center justify-between border-b border-slate-100 bg-white">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 rounded-xl bg-[#002142] text-emerald-400 font-mono font-black text-xs flex items-center justify-center shadow-sm shrink-0 border border-slate-800">
                              #{sess.sessionNumber || '?'}
                            </div>
                            <div>
                              <h4 className="text-xs font-black text-slate-900 leading-none tracking-tight">
                                Session #{sess.sessionNumber || '?'}
                              </h4>
                              <p className="text-[11px] font-semibold text-slate-400 mt-1 flex items-center space-x-1">
                                <Clock className="w-3 h-3 text-slate-400 inline" />
                                <span>{sess.date}</span>
                              </p>
                            </div>
                          </div>

                          {/* Active indicator */}
                          {isActive && (
                            <div className="px-2 py-1 bg-emerald-50 border border-emerald-200 rounded-md">
                              <span className="text-[10px] font-black text-emerald-700 uppercase">Active</span>
                            </div>
                          )}
                        </div>

                        {/* CARD BODY */}
                        <div 
                          onClick={() => {
                            const target = cloudSessions.find(s => s.id === sess.id);
                            if (target && onLoadCloudSession) {
                              onLoadCloudSession(target);
                            }
                            setSessionSubNav('editor');
                          }}
                          className="p-4 bg-white space-y-3 flex-1 flex flex-col justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                        >
                          <div className="space-y-2.5">
                            {/* Main Objective / Title */}
                            <h3 className="text-sm font-black text-slate-900 leading-snug line-clamp-3 hover:text-emerald-700 transition-colors min-h-[3rem]">
                              {sess.title || 'No objective assigned'}
                            </h3>
                            {sess.description ? (
                              <p className="text-xs text-slate-500 line-clamp-3">{sess.description}</p>
                            ) : null}

                            {/* Metadata */}
                            <div className="flex items-center gap-2 text-[11px] text-slate-500 font-semibold flex-wrap">
                              <span className="bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-md font-bold text-[10px]">
                                {sess.category || 'Tactical'}
                              </span>
                              <span className="bg-sky-50 text-sky-700 border border-sky-200 px-2 py-0.5 rounded-md font-bold text-[10px]">
                                {sess.duration || 'N/A'}
                              </span>
                              <span className="bg-violet-50 text-violet-700 border border-violet-200 px-2 py-0.5 rounded-md font-bold text-[10px]">
                                {sess.intensity || 'Alta'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* CARD FOOTER - Delete Button */}
                        <div className="p-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onDeleteCloudSession) {
                                onDeleteCloudSession(sess.id, String(sess.sessionNumber || ''), e);
                              }
                            }}
                            className="p-2 text-rose-500 hover:text-white hover:bg-rose-500 rounded-lg transition-all border border-rose-500/30 hover:border-rose-500"
                            title="Delete Session"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

            </div>
          ) : (
            /* VIEW MODE 2: ACTIVE SESSION DESIGNER / EDITOR */
            <div className="space-y-6">
              {renderActiveSessionEditor()}
            </div>
          )}

        </div>
      )}
    </div>
  );
};
