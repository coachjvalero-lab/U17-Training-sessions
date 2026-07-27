import React, { useState } from 'react';
import { 
  UserCheck, 
  UserX, 
  CheckCircle2, 
  XCircle, 
  Palmtree, 
  GraduationCap, 
  Stethoscope, 
  HelpCircle, 
  Plus, 
  Trash2, 
  ChevronDown, 
  ChevronUp, 
  Check, 
  Users, 
  AlertCircle 
} from 'lucide-react';
import { PlayerAttendance, AbsenceReason } from '../types';
import { DEFAULT_SQUAD_PLAYERS } from '../constants/squad';

interface SessionAttendanceTrackerProps {
  attendance?: PlayerAttendance[];
  squadRoster?: string[];
  onChangeAttendance: (attendance: PlayerAttendance[]) => void;
  onChangeRoster?: (roster: string[]) => void;
  compact?: boolean;
}

export const ABSENCE_REASONS: { key: AbsenceReason; label: string; icon: any; color: string; bg: string }[] = [
  { key: 'Vacation', label: 'Vacation', icon: Palmtree, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
  { key: 'Study', label: 'Study', icon: GraduationCap, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
  { key: 'Injury', label: 'Injury', icon: Stethoscope, color: 'text-rose-600', bg: 'bg-rose-50 border-rose-200' },
  { key: 'Unknown', label: 'Unknown', icon: HelpCircle, color: 'text-slate-600', bg: 'bg-slate-100 border-slate-300' },
];

export const getAbsenceReasonConfig = (reason?: AbsenceReason) => {
  return ABSENCE_REASONS.find(r => r.key === reason) || ABSENCE_REASONS[3];
};

export const SessionAttendanceTracker: React.FC<SessionAttendanceTrackerProps> = ({
  attendance = [],
  squadRoster = DEFAULT_SQUAD_PLAYERS,
  onChangeAttendance,
  onChangeRoster,
  compact = false
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [filter, setFilter] = useState<'all' | 'attending' | 'absent'>('all');
  const [newPlayerName, setNewPlayerName] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  // Synchronize attendance list with squad roster
  const effectiveAttendance: PlayerAttendance[] = squadRoster.map(player => {
    const existing = attendance.find(a => a.playerName.toLowerCase() === player.toLowerCase());
    if (existing) return existing;
    return {
      playerName: player,
      status: 'Attending'
    };
  });

  const attendingCount = effectiveAttendance.filter(a => a.status === 'Attending').length;
  const absentCount = effectiveAttendance.filter(a => a.status === 'Absent').length;
  const totalCount = effectiveAttendance.length;
  const attendanceRate = totalCount > 0 ? Math.round((attendingCount / totalCount) * 100) : 0;

  // Count by reason
  const vacationCount = effectiveAttendance.filter(a => a.status === 'Absent' && a.absenceReason === 'Vacation').length;
  const studyCount = effectiveAttendance.filter(a => a.status === 'Absent' && a.absenceReason === 'Study').length;
  const injuryCount = effectiveAttendance.filter(a => a.status === 'Absent' && a.absenceReason === 'Injury').length;
  const unknownCount = effectiveAttendance.filter(a => a.status === 'Absent' && (!a.absenceReason || a.absenceReason === 'Unknown')).length;

  const handleToggleStatus = (playerName: string) => {
    const updated = effectiveAttendance.map(a => {
      if (a.playerName.toLowerCase() === playerName.toLowerCase()) {
        const nextStatus: 'Attending' | 'Absent' = a.status === 'Attending' ? 'Absent' : 'Attending';
        return {
          ...a,
          status: nextStatus,
          absenceReason: nextStatus === 'Absent' ? (a.absenceReason || 'Unknown') : undefined
        };
      }
      return a;
    });
    onChangeAttendance(updated);
  };

  const handleReasonChange = (playerName: string, reason: AbsenceReason) => {
    const updated = effectiveAttendance.map(a => {
      if (a.playerName.toLowerCase() === playerName.toLowerCase()) {
        return {
          ...a,
          status: 'Absent' as const,
          absenceReason: reason
        };
      }
      return a;
    });
    onChangeAttendance(updated);
  };

  const handleMarkAllAttending = () => {
    const updated = effectiveAttendance.map(a => ({
      ...a,
      status: 'Attending' as const,
      absenceReason: undefined
    }));
    onChangeAttendance(updated);
  };

  const handleMarkAllAbsent = () => {
    const updated = effectiveAttendance.map(a => ({
      ...a,
      status: 'Absent' as const,
      absenceReason: a.absenceReason || ('Unknown' as const)
    }));
    onChangeAttendance(updated);
  };

  const handleAddPlayer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlayerName.trim()) return;

    const trimmed = newPlayerName.trim();
    if (squadRoster.some(p => p.toLowerCase() === trimmed.toLowerCase())) {
      alert('Player already exists in squad roster!');
      return;
    }

    const updatedRoster = [...squadRoster, trimmed];
    if (onChangeRoster) {
      onChangeRoster(updatedRoster);
    }

    const updatedAttendance: PlayerAttendance[] = [
      ...effectiveAttendance,
      { playerName: trimmed, status: 'Attending' }
    ];
    onChangeAttendance(updatedAttendance);

    setNewPlayerName('');
    setShowAddModal(false);
  };

  const filteredPlayers = effectiveAttendance.filter(a => {
    if (filter === 'attending') return a.status === 'Attending';
    if (filter === 'absent') return a.status === 'Absent';
    return true;
  });

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 shadow-md shadow-slate-100/80 space-y-4 print:border-slate-300 print:shadow-none print:p-3">
      
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-[#002142] text-[#a79078] rounded-xl shadow-sm">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-display font-black text-slate-900 uppercase tracking-wider">
                Session Attendance Tracker
              </h2>
              <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
                attendanceRate >= 80 
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                  : attendanceRate >= 60 
                  ? 'bg-amber-100 text-amber-800 border-amber-300' 
                  : 'bg-rose-100 text-rose-800 border-rose-300'
              }`}>
                {attendanceRate}% Present ({attendingCount}/{totalCount})
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-bold">
              Mark player attendance and reason for absence for training session analytics.
            </p>
          </div>
        </div>

        {/* Quick Bulk Action Controls */}
        <div className="flex items-center gap-2 print:hidden">
          <button
            type="button"
            onClick={handleMarkAllAttending}
            className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[11px] rounded-xl border border-emerald-200 transition-all flex items-center space-x-1 cursor-pointer"
            title="Mark all players as attending"
          >
            <Check className="w-3.5 h-3.5" />
            <span>All Present</span>
          </button>

          <button
            type="button"
            onClick={handleMarkAllAbsent}
            className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[11px] rounded-xl border border-rose-200 transition-all flex items-center space-x-1 cursor-pointer"
            title="Mark all players as absent"
          >
            <XCircle className="w-3.5 h-3.5" />
            <span>All Absent</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="px-2.5 py-1.5 bg-[#002142] hover:bg-[#002e5c] text-white font-bold text-[11px] rounded-xl transition-all flex items-center space-x-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-[#a79078]" />
            <span>Add Player</span>
          </button>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Summary Stat Chips Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs font-bold">
        <div className="bg-emerald-50 border border-emerald-200/80 p-2.5 rounded-xl flex items-center justify-between text-emerald-900">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Attending</span>
          </div>
          <span className="text-sm font-black">{attendingCount}</span>
        </div>

        <div className="bg-amber-50 border border-amber-200/80 p-2.5 rounded-xl flex items-center justify-between text-amber-900">
          <div className="flex items-center space-x-1.5">
            <Palmtree className="w-3.5 h-3.5 text-amber-600" />
            <span>Vacation</span>
          </div>
          <span className="text-sm font-black">{vacationCount}</span>
        </div>

        <div className="bg-blue-50 border border-blue-200/80 p-2.5 rounded-xl flex items-center justify-between text-blue-900">
          <div className="flex items-center space-x-1.5">
            <GraduationCap className="w-3.5 h-3.5 text-blue-600" />
            <span>Study</span>
          </div>
          <span className="text-sm font-black">{studyCount}</span>
        </div>

        <div className="bg-rose-50 border border-rose-200/80 p-2.5 rounded-xl flex items-center justify-between text-rose-900">
          <div className="flex items-center space-x-1.5">
            <Stethoscope className="w-3.5 h-3.5 text-rose-600" />
            <span>Injury</span>
          </div>
          <span className="text-sm font-black">{injuryCount}</span>
        </div>

        <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl flex items-center justify-between text-slate-800">
          <div className="flex items-center space-x-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
            <span>Unknown</span>
          </div>
          <span className="text-sm font-black">{unknownCount}</span>
        </div>
      </div>

      {isExpanded && (
        <div className="space-y-3 pt-2">
          {/* Filter tabs */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-2 print:hidden">
            <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl text-xs font-bold text-slate-600">
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  filter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900'
                }`}
              >
                All ({totalCount})
              </button>
              <button
                type="button"
                onClick={() => setFilter('attending')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  filter === 'attending' ? 'bg-emerald-600 text-white shadow-sm' : 'hover:text-slate-900'
                }`}
              >
                Attending ({attendingCount})
              </button>
              <button
                type="button"
                onClick={() => setFilter('absent')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  filter === 'absent' ? 'bg-rose-600 text-white shadow-sm' : 'hover:text-slate-900'
                }`}
              >
                Absent ({absentCount})
              </button>
            </div>

            <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">
              Click badge to toggle status
            </span>
          </div>

          {/* Player Grid Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
            {filteredPlayers.map((record) => {
              const isAttending = record.status === 'Attending';
              const reasonConfig = getAbsenceReasonConfig(record.absenceReason);
              const ReasonIcon = reasonConfig.icon;

              return (
                <div
                  key={record.playerName}
                  className={`p-2.5 rounded-2xl border transition-all flex flex-col justify-between space-y-2 ${
                    isAttending
                      ? 'bg-emerald-50/40 border-emerald-200/80 hover:bg-emerald-50'
                      : 'bg-rose-50/40 border-rose-200/80 hover:bg-rose-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-900 truncate pr-1">
                      {record.playerName}
                    </span>

                    {/* Status Toggle Button */}
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(record.playerName)}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer border flex items-center space-x-1 ${
                        isAttending
                          ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                          : 'bg-rose-600 text-white border-rose-700 shadow-sm'
                      }`}
                      title={`Click to mark as ${isAttending ? 'Absent' : 'Attending'}`}
                    >
                      {isAttending ? (
                        <>
                          <Check className="w-3 h-3" />
                          <span>Present</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3 h-3" />
                          <span>Absent</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Absence Reason Selector (shown if absent) */}
                  {!isAttending && (
                    <div className="pt-1 border-t border-rose-200/60 space-y-1">
                      <label className="text-[9px] font-extrabold uppercase text-rose-800 tracking-wider block">
                        Reason:
                      </label>
                      <select
                        value={record.absenceReason || 'Unknown'}
                        onChange={(e) => handleReasonChange(record.playerName, e.target.value as AbsenceReason)}
                        className="w-full text-[11px] font-bold bg-white border border-rose-300 text-rose-950 rounded-lg px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-rose-500 cursor-pointer"
                      >
                        {ABSENCE_REASONS.map(r => (
                          <option key={r.key} value={r.key}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add Player Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 w-full max-w-sm shadow-2xl space-y-4">
            <h3 className="text-sm font-display font-black text-slate-900 uppercase tracking-wider">
              Add New Squad Player
            </h3>
            <form onSubmit={handleAddPlayer} className="space-y-3">
              <div>
                <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">
                  Player Name
                </label>
                <input
                  type="text"
                  value={newPlayerName}
                  onChange={(e) => setNewPlayerName(e.target.value)}
                  placeholder="e.g. Noura, Reem, Fatima..."
                  className="w-full text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl p-2.5 focus:outline-none focus:border-emerald-500"
                  autoFocus
                />
              </div>
              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#002142] text-white font-bold text-xs rounded-xl hover:bg-[#002e5c]"
                >
                  Add to Squad
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
