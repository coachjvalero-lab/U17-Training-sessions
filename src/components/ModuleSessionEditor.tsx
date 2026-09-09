import React, { useState } from 'react';
import { FileText, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { HeaderSection } from './HeaderSection';
import { SessionAttendanceTracker } from './SessionAttendanceTracker';
import { PlayerGroupsSection } from './PlayerGroupsSection';
import { ExerciseBlock } from './ExerciseBlock';
import { Exercise, PlayerAttendance, PlayerGroup, SharedSessionHeader, SquadPlayer, TrainingSession } from '../types';
import { getModuleGameMoments, getModuleSessionView, TrainingModuleId } from '../modules/trainingModules';
import { calculateSessionTotalDurationMinutes } from '../utils/duration';
import { selectMalikaParticipants } from '../utils/malikaLeague';

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
  onDuplicate?: () => Promise<void> | void;
  isDuplicating?: boolean;
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
  squadPlayers = [],
  isSaving,
  expandedExercises,
  excludedPlayers,
  onUpdateHeader,
  onSave,
  onDuplicate,
  isDuplicating,
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
  const totalDurationMinutes = calculateSessionTotalDurationMinutes([
    moduleView.warmUp,
    moduleView.mainPart,
    moduleView.coolDown
  ]);
  const isGk = moduleId === 'gk';
  const isHeaderReadOnly = false;
  const isSharedDataReadOnly = moduleId !== 'football' && !isGk;

  const rawAttendance = Array.isArray(session.attendance) ? session.attendance : [];
  const sessionAttendance = isGk
    ? rawAttendance.filter((entry) => {
        const name = (entry.playerName || '').trim();
        if (!name) return false;
        // In GK module, only retain attendance entries matching Goalkeepers
        return squadPlayers.some((sp) => {
          if (sp.position !== 'GK') return false;
          const first = sp.firstName.toLowerCase();
          const full = `${sp.firstName} ${sp.lastName}`.toLowerCase().trim();
          const gkTag = `${sp.firstName} (gk)`.toLowerCase();
          const lowerName = name.toLowerCase();
          return lowerName === first || lowerName === full || lowerName === gkTag || lowerName.includes('(gk)');
        });
      })
    : rawAttendance;

  const attendanceOnlyPlayers = sessionAttendance
    .map((entry) => entry.playerName?.trim())
    .filter((name): name is string => Boolean(name));
  const rosterForAttendance = Array.from(new Set([...planningRoster, ...attendanceOnlyPlayers]));
  const malikaParticipants = selectMalikaParticipants(squadPlayers, sessionAttendance);

  const sessionWithSharedHeader: TrainingSession = isGk
    ? session
    : {
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

  const [internalIsDuplicating, setInternalIsDuplicating] = useState(false);
  const [duplicateFeedback, setDuplicateFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const effectiveIsDuplicating = isDuplicating ?? internalIsDuplicating;

  const handleDuplicate = onDuplicate
    ? async () => {
        if (effectiveIsDuplicating || isSaving) return;
        setDuplicateFeedback(null);
        setInternalIsDuplicating(true);
        try {
          await onDuplicate();
          setDuplicateFeedback({
            type: 'success',
            message: 'Session duplicated successfully! You are now editing the new independent session.'
          });
          setTimeout(() => {
            setDuplicateFeedback((prev) => (prev?.type === 'success' ? null : prev));
          }, 6000);
        } catch (err: any) {
          console.error('[ModuleSessionEditor] Failed to duplicate session:', err);
          const msg = err?.message || 'Failed to duplicate session. Please try again.';
          setDuplicateFeedback({
            type: 'error',
            message: msg
          });
        } finally {
          setInternalIsDuplicating(false);
        }
      }
    : undefined;

  return (
    <main className="session-print-flow space-y-6 md:space-y-8 print:space-y-1.5">
      {duplicateFeedback && (
        <div
          role="status"
          aria-live="polite"
          className={`flex items-center justify-between p-4 rounded-2xl border text-xs sm:text-sm font-bold shadow-sm transition-all print:hidden ${
            duplicateFeedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}
        >
          <div className="flex items-center space-x-2.5">
            {duplicateFeedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span>{duplicateFeedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setDuplicateFeedback(null)}
            className="p-1 rounded-lg hover:bg-black/5 text-slate-500 hover:text-slate-800 transition-colors"
            title="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <HeaderSection
        session={sessionWithSharedHeader}
        onChange={updateHeaderFields}
        currentLogo={currentLogo}
        onUpdateLogo={onUpdateLogo}
        onSave={onSave}
        isSaving={isSaving}
        onDuplicate={handleDuplicate}
        isDuplicating={effectiveIsDuplicating}
        readOnly={isHeaderReadOnly}
        totalDurationMinutes={totalDurationMinutes}
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
        sessionDate={session.date}
        squadPlayers={squadPlayers}
        malikaParticipants={malikaParticipants}
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
        sessionDate={session.date}
        squadPlayers={squadPlayers}
        malikaParticipants={malikaParticipants}
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
          sessionDate={session.date}
          squadPlayers={squadPlayers}
          malikaParticipants={malikaParticipants}
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
