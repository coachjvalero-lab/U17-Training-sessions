import React from 'react';
import { FileText } from 'lucide-react';
import { HeaderSection } from './HeaderSection';
import { SessionAttendanceTracker } from './SessionAttendanceTracker';
import { PlayerGroupsSection } from './PlayerGroupsSection';
import { ExerciseBlock } from './ExerciseBlock';
import { Exercise, PlayerAttendance, PlayerGroup, SharedSessionHeader, TrainingSession } from '../types';
import { getModuleGameMoments, getModuleSessionView, TrainingModuleId } from '../modules/trainingModules';

interface ModuleSessionEditorProps {
  moduleId: TrainingModuleId;
  session: TrainingSession;
  sharedHeader: SharedSessionHeader;
  planningRoster: string[];
  currentLogo: string;
  isSaving: boolean;
  expandedExercises: Record<string, boolean>;
  excludedPlayers: string[];
  onUpdateHeader: (fields: Partial<TrainingSession>) => void;
  onSave: () => void;
  onUpdateAttendance: (attendance: PlayerAttendance[]) => void;
  onUpdateRoster: (squadRoster: string[]) => void;
  onUpdateGroups: (groups: PlayerGroup[]) => void;
  onUpdateExercises: (blockKey: 'warmUp' | 'mainPart' | 'coolDown', exercises: Exercise[]) => void;
  onToggleExpand: (id: string) => void;
  onExcludePlayer: (name: string) => void;
  onIncludePlayer: (name: string) => void;
  onUpdateLogo: (newLogo: string) => void;
}

export const ModuleSessionEditor: React.FC<ModuleSessionEditorProps> = ({
  moduleId,
  session,
  sharedHeader,
  planningRoster,
  currentLogo,
  isSaving,
  expandedExercises,
  excludedPlayers,
  onUpdateHeader,
  onSave,
  onUpdateAttendance,
  onUpdateRoster,
  onUpdateGroups,
  onUpdateExercises,
  onToggleExpand,
  onExcludePlayer,
  onIncludePlayer,
  onUpdateLogo
}) => {
  const moduleView = getModuleSessionView(session, moduleId);
  const isSharedHeaderReadOnly = moduleId !== 'football';
  const planningRosterLookup = new Set(planningRoster.map((name) => name.trim().toLowerCase()));
  const filteredAttendance = (session.attendance || []).filter((playerAttendance) =>
    planningRosterLookup.has(playerAttendance.playerName.trim().toLowerCase())
  );

  const sessionWithSharedHeader: TrainingSession = {
    ...session,
    id: sharedHeader.id,
    sessionNumber: sharedHeader.sessionNumber,
    date: sharedHeader.date,
    time: sharedHeader.time,
    teamName: sharedHeader.teamName,
    microcycleDay: sharedHeader.microcycleDay
  };

  const modulePlanningSession: TrainingSession = {
    ...session,
    squadRoster: planningRoster
  };

  const updateHeaderFields = isSharedHeaderReadOnly ? (() => {}) : onUpdateHeader;
  const updateAttendance = isSharedHeaderReadOnly ? (() => {}) : onUpdateAttendance;
  const updateRoster = isSharedHeaderReadOnly ? (() => {}) : onUpdateRoster;

  return (
    <main className="space-y-6 md:space-y-8 print:space-y-1.5">
      <HeaderSection
        session={sessionWithSharedHeader}
        onChange={updateHeaderFields}
        currentLogo={currentLogo}
        onUpdateLogo={onUpdateLogo}
        onSave={onSave}
        isSaving={isSaving}
        readOnly={isSharedHeaderReadOnly}
      />

      <SessionAttendanceTracker
        attendance={filteredAttendance}
        squadRoster={planningRoster}
        onChangeAttendance={updateAttendance}
        onChangeRoster={updateRoster}
        excludedPlayers={excludedPlayers}
        onExcludePlayer={onExcludePlayer}
        onIncludePlayer={onIncludePlayer}
        readOnly={isSharedHeaderReadOnly}
      />

      <PlayerGroupsSection
        groups={moduleView.playerGroups}
        squadRoster={modulePlanningSession.squadRoster}
        attendance={filteredAttendance}
        onChangeGroups={onUpdateGroups}
        onChangeRoster={updateRoster}
        rosterReadOnly={isSharedHeaderReadOnly}
      />

      <ExerciseBlock
        block={moduleView.warmUp}
        onChange={(exs) => onUpdateExercises('warmUp', exs)}
        expandedExercises={expandedExercises}
        toggleExpand={onToggleExpand}
        sessionGroups={moduleView.playerGroups}
        gameMoments={getModuleGameMoments(moduleId)}
      />

      <ExerciseBlock
        block={moduleView.mainPart}
        onChange={(exs) => onUpdateExercises('mainPart', exs)}
        expandedExercises={expandedExercises}
        toggleExpand={onToggleExpand}
        sessionGroups={moduleView.playerGroups}
        gameMoments={getModuleGameMoments(moduleId)}
      />

      <ExerciseBlock
        block={moduleView.coolDown}
        onChange={(exs) => onUpdateExercises('coolDown', exs)}
        expandedExercises={expandedExercises}
        toggleExpand={onToggleExpand}
        sessionGroups={moduleView.playerGroups}
        gameMoments={getModuleGameMoments(moduleId)}
      />

      <section className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 shadow-md shadow-slate-100/80 space-y-3 print:hidden">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-[#002142] text-[#a79078] rounded-xl shadow-sm">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-display font-black text-slate-900 uppercase tracking-wider">
                Session Observations & Notes
              </h2>
              <p className="text-[10px] text-slate-400 font-bold">
                Private coaching staff notes (Screen view only — hidden when printing PDF)
              </p>
            </div>
          </div>
          <span className="text-[10px] font-extrabold text-[#8a7549] bg-[#ede9e6] px-2.5 py-1 rounded-lg border border-[#a79078]/30">
            Screen Only
          </span>
        </div>

        <textarea
          value={session.observations || ''}
          onChange={(e) => onUpdateHeader({ observations: e.target.value })}
          rows={4}
          readOnly={isSharedHeaderReadOnly}
          placeholder="Write post-training observations, individual player notes, RPE ratings, injury updates, or tactical feedback for the coaching staff..."
          className="w-full text-xs font-semibold text-slate-800 bg-slate-50/70 border border-slate-200 rounded-xl p-3.5 focus:outline-none focus:ring-2 focus:ring-[#002142]/10 focus:border-[#0f5981] focus:bg-white transition-all resize-y"
        />
      </section>
    </main>
  );
};
