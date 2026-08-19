import React from 'react';
import { FileText } from 'lucide-react';
import { HeaderSection } from './HeaderSection';
import { SessionAttendanceTracker } from './SessionAttendanceTracker';
import { PlayerGroupsSection } from './PlayerGroupsSection';
import { ExerciseBlock } from './ExerciseBlock';
import { Exercise, PlayerAttendance, PlayerGroup, SharedSessionHeader, SquadPlayer, TrainingSession } from '../types';
import { getModuleGameMoments, getModuleSessionView, TrainingModuleId } from '../modules/trainingModules';

interface ModuleSessionEditorProps {
  moduleId: TrainingModuleId;
  session: TrainingSession;
  sharedHeader: SharedSessionHeader;
  planningRoster: string[];
  currentLogo: string;
  squadPlayers?: SquadPlayer[];
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
  onApplyMalikaPoints?: (payload: {
    sessionId: string;
    exerciseId: string;
    challenge: string;
    awards: Array<{ playerId: string; points: number }>;
  }) => void;
}

export const ModuleSessionEditor: React.FC<ModuleSessionEditorProps> = ({
  moduleId,
  session,
  sharedHeader,
  planningRoster,
  currentLogo,
  squadPlayers = [],
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
  onUpdateLogo,
  onApplyMalikaPoints
}) => {
  const moduleView = getModuleSessionView(session, moduleId);
  const isHeaderReadOnly = moduleId === 'gk';
  const isSharedDataReadOnly = moduleId !== 'football';
  const sessionAttendance = Array.isArray(session.attendance) ? session.attendance : [];
  const attendanceOnlyPlayers = sessionAttendance
    .map((entry) => entry.playerName?.trim())
    .filter((name): name is string => Boolean(name));
  const rosterForAttendance = Array.from(new Set([...planningRoster, ...attendanceOnlyPlayers]));

  const sessionWithSharedHeader: TrainingSession = {
    ...session,
    id: sharedHeader.id,
    sessionNumber: sharedHeader.sessionNumber,
    date: sharedHeader.date,
    time: sharedHeader.time,
    teamName: sharedHeader.teamName,
    microcycleDay: sharedHeader.microcycleDay
  };

  const updateHeaderFields = isHeaderReadOnly ? (() => {}) : onUpdateHeader;
  const updateAttendance = isSharedDataReadOnly ? (() => {}) : onUpdateAttendance;
  const updateRoster = isSharedDataReadOnly ? (() => {}) : onUpdateRoster;

  return (
    <main className="space-y-6 md:space-y-8 print:space-y-1.5">
      <HeaderSection
        session={sessionWithSharedHeader}
        onChange={updateHeaderFields}
        currentLogo={currentLogo}
        onUpdateLogo={onUpdateLogo}
        onSave={onSave}
        isSaving={isSaving}
        readOnly={isHeaderReadOnly}
      />

      <div className="print:hidden">
        <SessionAttendanceTracker
          attendance={sessionAttendance}
          squadRoster={rosterForAttendance}
          squadPlayers={squadPlayers}
          onChangeAttendance={updateAttendance}
          onChangeRoster={updateRoster}
          excludedPlayers={excludedPlayers}
          onExcludePlayer={onExcludePlayer}
          onIncludePlayer={onIncludePlayer}
          readOnly={isSharedDataReadOnly}
        />
      </div>

      <div className="print:hidden">
        <PlayerGroupsSection
          groups={moduleView.playerGroups}
          squadRoster={rosterForAttendance}
          squadPlayers={squadPlayers}
          attendance={sessionAttendance}
          onChangeGroups={onUpdateGroups}
          onChangeRoster={updateRoster}
          rosterReadOnly={isSharedDataReadOnly}
          includeExternalPlayers={moduleId === 'football'}
        />
      </div>

      <ExerciseBlock
        block={moduleView.warmUp}
        onChange={(exs) => onUpdateExercises('warmUp', exs)}
        expandedExercises={expandedExercises}
        toggleExpand={onToggleExpand}
        sessionGroups={moduleView.playerGroups}
        gameMoments={getModuleGameMoments(moduleId)}
        allowSecondGameMoment={moduleId === 'football'}
        sessionId={session.id}
        squadPlayers={squadPlayers}
        onApplyMalikaPoints={onApplyMalikaPoints}
      />

      <ExerciseBlock
        block={moduleView.mainPart}
        onChange={(exs) => onUpdateExercises('mainPart', exs)}
        expandedExercises={expandedExercises}
        toggleExpand={onToggleExpand}
        sessionGroups={moduleView.playerGroups}
        gameMoments={getModuleGameMoments(moduleId)}
        allowSecondGameMoment={moduleId === 'football'}
        sessionId={session.id}
        squadPlayers={squadPlayers}
        onApplyMalikaPoints={onApplyMalikaPoints}
      />

      <div className="print:hidden">
        <ExerciseBlock
          block={moduleView.coolDown}
          onChange={(exs) => onUpdateExercises('coolDown', exs)}
          expandedExercises={expandedExercises}
          toggleExpand={onToggleExpand}
          sessionGroups={moduleView.playerGroups}
          gameMoments={getModuleGameMoments(moduleId)}
          allowSecondGameMoment={moduleId === 'football'}
          sessionId={session.id}
          squadPlayers={squadPlayers}
          onApplyMalikaPoints={onApplyMalikaPoints}
        />
      </div>

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
          readOnly={isHeaderReadOnly}
          placeholder="Write post-training observations, individual player notes, RPE ratings, injury updates, or tactical feedback for the coaching staff..."
          className="w-full text-xs font-semibold text-slate-800 bg-slate-50/70 border border-slate-200 rounded-xl p-3.5 focus:outline-none focus:ring-2 focus:ring-[#002142]/10 focus:border-[#0f5981] focus:bg-white transition-all resize-y"
        />
      </section>
    </main>
  );
};
