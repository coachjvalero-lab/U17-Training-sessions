import React, { useState } from 'react';
import { BarChart3, CalendarDays } from 'lucide-react';
import type { CloudTrainingSession, SquadPlayer, TrainingSession } from '../types';
import { MicrocyclePlannerSection } from './MicrocyclePlannerSection';
import { PlanificationAnalyticsSection } from './PlanificationAnalyticsSection';

interface PlanificationSectionProps {
  session: TrainingSession;
  cloudSessions: CloudTrainingSession[];
  squadPlayers: SquadPlayer[];
  onOpenSession?: (session: CloudTrainingSession) => void;
}

export const PlanificationSection: React.FC<PlanificationSectionProps> = ({
  session,
  cloudSessions,
  squadPlayers,
  onOpenSession
}) => {
  const [view, setView] = useState<'planner' | 'analytics'>('planner');
  const hasPlanningRead = true;

  if (!hasPlanningRead) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-6 text-sm text-slate-600">
        Planning access is restricted for your account.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="bg-[#002142] text-white rounded-3xl p-5 border border-slate-800 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight">Planification & Microcycle</h1>
            <p className="text-xs text-sky-200 mt-1">
              Weekly microcycle board, editable day planning, session linkage, and squad availability.
            </p>
          </div>

          <div className="inline-flex items-center bg-slate-900/80 border border-slate-700 rounded-xl p-1">
            <button
              type="button"
              onClick={() => setView('planner')}
              className={`px-3 py-2 rounded-lg text-xs font-black inline-flex items-center gap-1.5 ${
                view === 'planner' ? 'bg-emerald-500 text-slate-950' : 'text-slate-200'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              Microcycle Planner
            </button>
            <button
              type="button"
              onClick={() => setView('analytics')}
              className={`px-3 py-2 rounded-lg text-xs font-black inline-flex items-center gap-1.5 ${
                view === 'analytics' ? 'bg-emerald-500 text-slate-950' : 'text-slate-200'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Volume Analytics
            </button>
          </div>
        </div>
      </div>

      {view === 'planner' ? (
        <MicrocyclePlannerSection
          cloudSessions={cloudSessions}
          squadPlayers={squadPlayers}
          onOpenSession={onOpenSession}
        />
      ) : (
        <PlanificationAnalyticsSection session={session} cloudSessions={cloudSessions} />
      )}
    </div>
  );
};
