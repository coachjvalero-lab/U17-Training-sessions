import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Check, Loader2, Search, Trophy, X } from 'lucide-react';
import type { SquadPlayer } from '../types';
import {
  listMalikaAssignmentsForExercise,
  saveMalikaExerciseAwards
} from '../services/squad/malikaAssignmentsService';
import { formatCompetitionMonthLabel, toCompetitionMonth } from '../utils/malikaLeague';

interface MalikaAssignPointsModalProps {
  sessionId: string;
  sessionDate: string;
  exerciseId: string;
  exerciseName: string;
  points: number;
  participants: SquadPlayer[];
  onClose: () => void;
  onSaved?: () => void;
}

export const MalikaAssignPointsModal: React.FC<MalikaAssignPointsModalProps> = ({
  sessionId,
  sessionDate,
  exerciseId,
  exerciseName,
  points,
  participants,
  onClose,
  onSaved
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);

    listMalikaAssignmentsForExercise(sessionId, exerciseId)
      .then((assignments) => {
        if (!active) return;
        // Winners already stored are pre-selected so the assignment can be corrected.
        setSelectedIds(new Set(assignments.map((assignment) => assignment.playerId)));
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError((err as { message?: string })?.message || 'Could not load the current Malika assignment.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [sessionId, exerciseId]);

  const filteredParticipants = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const sorted = [...participants].sort((a, b) =>
      `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
    );
    if (!term) return sorted;
    return sorted.filter((player) =>
      `${player.firstName} ${player.lastName}`.toLowerCase().includes(term)
    );
  }, [participants, searchTerm]);

  const togglePlayer = (playerId: string) => {
    setSavedAt(null);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) next.delete(playerId);
      else next.add(playerId);
      return next;
    });
  };

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setError(null);

    try {
      await saveMalikaExerciseAwards({
        sessionId,
        sessionDate,
        exerciseId,
        exerciseName,
        points,
        winnerPlayerIds: Array.from(selectedIds)
      });
      setSavedAt(Date.now());
      onSaved?.();
    } catch (err: unknown) {
      const message = (err as { message?: string; details?: string })?.message
        || (err as { details?: string })?.details
        || 'Could not save the Malika points.';
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const monthLabel = formatCompetitionMonthLabel(toCompetitionMonth(sessionDate));

  return (
    <div className="fixed inset-0 z-[70] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 print:hidden">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-[#001d3a] text-white px-5 py-4 flex items-start justify-between gap-3">
          <div className="flex items-start space-x-3">
            <div className="p-2 bg-[#002b54] text-amber-300 rounded-xl border border-amber-300/30">
              <Trophy className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-300">
                Malika Golden League · {monthLabel}
              </p>
              <h3 className="text-base font-display font-black uppercase tracking-tight">
                {exerciseName || 'Malika Challenge'} — {points} pts
              </h3>
              <p className="text-[11px] text-sky-200/70 font-semibold mt-0.5">
                Select only the winners. Each one receives exactly {points} points.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 pt-4">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search participant..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1.5">
          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-slate-400 text-xs font-bold">
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Loading current assignment...
            </div>
          ) : filteredParticipants.length === 0 ? (
            <p className="text-xs text-slate-400 font-semibold text-center py-10">
              No participants available for this session.
            </p>
          ) : (
            filteredParticipants.map((player) => {
              const isSelected = selectedIds.has(player.id);
              return (
                <button
                  key={player.id}
                  type="button"
                  onClick={() => togglePlayer(player.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-left transition-all ${
                    isSelected
                      ? 'bg-amber-50 border-amber-300 shadow-sm'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <span className="flex items-center space-x-3 min-w-0">
                    <span
                      className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-amber-500 border-amber-500 text-white' : 'border-slate-300'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-slate-900 truncate">
                        {`${player.firstName} ${player.lastName}`.trim()}
                      </span>
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {player.position}
                      </span>
                    </span>
                  </span>
                  <span
                    className={`text-xs font-black tabular-nums ${
                      isSelected ? 'text-amber-700' : 'text-slate-300'
                    }`}
                  >
                    +{points}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {error && (
          <div className="mx-5 mb-3 flex items-start space-x-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl px-3 py-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="text-[11px] font-bold">{error}</p>
          </div>
        )}

        <div className="border-t border-slate-100 px-5 py-4 flex items-center justify-between gap-3 bg-slate-50/60">
          <p className="text-[11px] font-bold text-slate-500">
            {selectedIds.size} winner{selectedIds.size === 1 ? '' : 's'} · {selectedIds.size * points} pts
            {savedAt && <span className="text-emerald-600 ml-2">Saved</span>}
          </p>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || isLoading}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center space-x-2"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trophy className="w-3.5 h-3.5" />}
              <span>Save Malika Points</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
