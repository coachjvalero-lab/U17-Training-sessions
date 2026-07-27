import React, { useState } from 'react';
import { 
  Users, 
  UserCheck, 
  UserX, 
  CheckCircle2, 
  XCircle, 
  Palmtree, 
  GraduationCap, 
  Stethoscope, 
  HelpCircle, 
  TrendingUp, 
  Calendar, 
  Plus, 
  Edit3, 
  Trash2, 
  Printer, 
  Search, 
  Filter, 
  BarChart3, 
  AlertTriangle,
  FileSpreadsheet,
  Check
} from 'lucide-react';
import { TrainingSession, PlayerAttendance, AbsenceReason } from '../types';
import { CloudTrainingSession } from '../firebase';
import { DEFAULT_SQUAD_PLAYERS } from '../constants/squad';
import { ABSENCE_REASONS, getAbsenceReasonConfig } from './SessionAttendanceTracker';

interface AttendanceSectionProps {
  session: TrainingSession;
  cloudSessions: CloudTrainingSession[];
  squadRoster?: string[];
  onChangeSession: (fields: Partial<TrainingSession>) => void;
  onChangeRoster?: (roster: string[]) => void;
}

export const AttendanceSection: React.FC<AttendanceSectionProps> = ({
  session,
  cloudSessions = [],
  squadRoster = DEFAULT_SQUAD_PLAYERS,
  onChangeSession,
  onChangeRoster
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [reasonFilter, setReasonFilter] = useState<'all' | AbsenceReason>('all');
  const [showRosterModal, setShowRosterModal] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState('');

  // Collect all sessions (cloud sessions + current session if not in cloud)
  const allSessionsMap = new Map<string, TrainingSession | CloudTrainingSession>();
  
  // Add current active session
  allSessionsMap.set(session.id, session);
  
  // Add cloud sessions
  cloudSessions.forEach(cs => {
    allSessionsMap.set(cs.id, cs);
  });

  const allSessionsList = Array.from(allSessionsMap.values()).sort((a, b) => {
    // Sort by date descending
    return (b.date || '').localeCompare(a.date || '');
  });

  // Calculate global squad roster (union of squadRoster and any player appearing in attendance)
  const masterPlayerSet = new Set<string>(squadRoster);
  allSessionsList.forEach(s => {
    if (s.attendance && Array.isArray(s.attendance)) {
      s.attendance.forEach(a => {
        if (a.playerName) masterPlayerSet.add(a.playerName);
      });
    }
  });

  const masterPlayerList = Array.from(masterPlayerSet).sort((a, b) => a.localeCompare(b));

  // Build stats per player
  const playerStats = masterPlayerList.map(player => {
    let totalSessions = 0;
    let attendedCount = 0;
    let absentCount = 0;
    const reasonsMap: Record<AbsenceReason, number> = {
      Vacation: 0,
      Study: 0,
      Injury: 0,
      Unknown: 0
    };

    allSessionsList.forEach(s => {
      const attList = s.attendance || [];
      const record = attList.find(a => a.playerName.toLowerCase() === player.toLowerCase());
      
      // If session had attendance recorded
      if (attList.length > 0) {
        totalSessions++;
        if (record) {
          if (record.status === 'Attending') {
            attendedCount++;
          } else {
            absentCount++;
            const r = record.absenceReason || 'Unknown';
            reasonsMap[r] = (reasonsMap[r] || 0) + 1;
          }
        } else {
          // Default if not listed in that session
          attendedCount++;
        }
      }
    });

    const rate = totalSessions > 0 ? Math.round((attendedCount / totalSessions) * 100) : 100;

    return {
      player,
      totalSessions,
      attendedCount,
      absentCount,
      reasonsMap,
      rate
    };
  });

  // Filter player stats based on search & reason filter
  const filteredPlayerStats = playerStats.filter(stat => {
    const matchesSearch = stat.player.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;

    if (reasonFilter !== 'all') {
      return stat.reasonsMap[reasonFilter] > 0;
    }

    return true;
  });

  // Overall statistics
  const totalRecordedSessions = allSessionsList.filter(s => s.attendance && s.attendance.length > 0).length || 1;
  const overallAttendedTotal = playerStats.reduce((sum, p) => sum + p.attendedCount, 0);
  const overallPossibleTotal = playerStats.reduce((sum, p) => sum + p.totalSessions, 0);
  const globalAttendanceRate = overallPossibleTotal > 0 ? Math.round((overallAttendedTotal / overallPossibleTotal) * 100) : 100;

  const totalVacations = playerStats.reduce((sum, p) => sum + p.reasonsMap.Vacation, 0);
  const totalStudies = playerStats.reduce((sum, p) => sum + p.reasonsMap.Study, 0);
  const totalInjuries = playerStats.reduce((sum, p) => sum + p.reasonsMap.Injury, 0);
  const totalUnknowns = playerStats.reduce((sum, p) => sum + p.reasonsMap.Unknown, 0);
  const totalAbsences = totalVacations + totalStudies + totalInjuries + totalUnknowns;

  const handleAddPlayer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlayerName.trim()) return;
    const name = newPlayerName.trim();
    if (squadRoster.includes(name)) {
      alert('Player already in squad roster.');
      return;
    }
    const updatedRoster = [...squadRoster, name];
    if (onChangeRoster) onChangeRoster(updatedRoster);

    // Update active session attendance
    const currentAtt = session.attendance || [];
    onChangeSession({
      attendance: [...currentAtt, { playerName: name, status: 'Attending' }]
    });

    setNewPlayerName('');
    setShowRosterModal(false);
  };

  const handleDeletePlayer = (playerName: string) => {
    if (confirm(`Are you sure you want to remove "${playerName}" from the squad roster?`)) {
      const updatedRoster = squadRoster.filter(p => p !== playerName);
      if (onChangeRoster) onChangeRoster(updatedRoster);

      if (session.attendance) {
        onChangeSession({
          attendance: session.attendance.filter(a => a.playerName !== playerName)
        });
      }
    }
  };

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header Banner */}
      <div className="bg-[#001d3a] border border-[#5ea4c5]/20 text-white rounded-2xl p-6 md:p-8 shadow-xl relative overflow-hidden print:bg-white print:text-slate-900 print:border-slate-300 print:p-4">
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="p-3 bg-[#002b54] text-[#a79078] rounded-2xl border border-[#a79078]/30 shadow-inner">
              <Users className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#a79078]">
                  Squad Management & Analytics
                </span>
                <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-black px-2 py-0.5 rounded-full border border-emerald-500/30">
                  {masterPlayerList.length} Players
                </span>
              </div>
              <h1 className="text-xl md:text-2xl font-display font-black tracking-tight uppercase text-white mt-0.5">
                Player Attendance & Absence Dashboard
              </h1>
              <p className="text-xs text-sky-200/70 font-semibold max-w-xl mt-1">
                Monitor squad presence rates, track absence reasons (Vacation, Study, Injury, Unknown), and evaluate individual availability across all training sessions.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 print:hidden">
            <button
              type="button"
              onClick={() => setShowRosterModal(true)}
              className="px-3.5 py-2 bg-[#a79078] hover:bg-[#b8a088] text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center space-x-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Player</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center space-x-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print Report</span>
            </button>
          </div>
        </div>
      </div>

      {/* Global Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Attendance Rate */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Overall Squad Attendance
            </span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-display font-black text-slate-900">
              {globalAttendanceRate}%
            </span>
            <span className="text-xs font-extrabold text-emerald-600">
              ({overallAttendedTotal}/{overallPossibleTotal} records)
            </span>
          </div>
          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
            <div 
              className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
              style={{ width: `${globalAttendanceRate}%` }} 
            />
          </div>
        </div>

        {/* Card 2: Total Sessions Recorded */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Sessions Tracked
            </span>
            <div className="p-2 bg-sky-50 text-sky-600 rounded-xl">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-display font-black text-slate-900">
              {totalRecordedSessions}
            </span>
            <span className="text-xs font-bold text-slate-500">
              Training Sessions
            </span>
          </div>
          <p className="text-[10px] text-slate-400 font-semibold">
            Active session: #{session.sessionNumber} ({session.date})
          </p>
        </div>

        {/* Card 3: Total Absences Count */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Total Absences Logged
            </span>
            <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
              <UserX className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-display font-black text-slate-900">
              {totalAbsences}
            </span>
            <span className="text-xs font-bold text-rose-600">
              Player Absences
            </span>
          </div>
          <p className="text-[10px] text-slate-400 font-semibold">
            Avg {totalRecordedSessions > 0 ? (totalAbsences / totalRecordedSessions).toFixed(1) : 0} absences per session
          </p>
        </div>

        {/* Card 4: Absence Reasons Breakdown */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-2">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
            Absence Reasons
          </span>
          <div className="grid grid-cols-2 gap-1.5 text-xs font-bold">
            <div className="bg-amber-50 border border-amber-200/60 p-1.5 rounded-lg flex items-center justify-between text-amber-900">
              <span className="flex items-center gap-1 text-[11px]">
                <Palmtree className="w-3 h-3 text-amber-600" />
                Vacation
              </span>
              <span className="font-black">{totalVacations}</span>
            </div>

            <div className="bg-blue-50 border border-blue-200/60 p-1.5 rounded-lg flex items-center justify-between text-blue-900">
              <span className="flex items-center gap-1 text-[11px]">
                <GraduationCap className="w-3 h-3 text-blue-600" />
                Study
              </span>
              <span className="font-black">{totalStudies}</span>
            </div>

            <div className="bg-rose-50 border border-rose-200/60 p-1.5 rounded-lg flex items-center justify-between text-rose-900">
              <span className="flex items-center gap-1 text-[11px]">
                <Stethoscope className="w-3 h-3 text-rose-600" />
                Injury
              </span>
              <span className="font-black">{totalInjuries}</span>
            </div>

            <div className="bg-slate-100 border border-slate-200 p-1.5 rounded-lg flex items-center justify-between text-slate-800">
              <span className="flex items-center gap-1 text-[11px]">
                <HelpCircle className="w-3 h-3 text-slate-500" />
                Unknown
              </span>
              <span className="font-black">{totalUnknowns}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area: Player Leaderboard Table */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-md space-y-4">
        
        {/* Table Header & Search Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-[#002142] text-[#a79078] rounded-xl">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-display font-black text-slate-900 uppercase tracking-wider">
                Individual Attendance Leaderboard
              </h2>
              <p className="text-[10px] text-slate-400 font-bold">
                Detailed attendance rate and absence breakdown per squad member.
              </p>
            </div>
          </div>

          {/* Search & Filter Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative min-w-[180px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search player name..."
                className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Filter by Reason */}
            <select
              value={reasonFilter}
              onChange={(e) => setReasonFilter(e.target.value as any)}
              className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 focus:outline-none cursor-pointer"
            >
              <option value="all">All Absences</option>
              <option value="Vacation">Vacation Only</option>
              <option value="Study">Study Only</option>
              <option value="Injury">Injury Only</option>
              <option value="Unknown">Unknown Only</option>
            </select>
          </div>
        </div>

        {/* Player Roster Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-400 bg-slate-50/80">
                <th className="py-3 px-3">Player Name</th>
                <th className="py-3 px-3 text-center">Attendance %</th>
                <th className="py-3 px-3 text-center">Attended</th>
                <th className="py-3 px-3 text-center">Absences</th>
                <th className="py-3 px-3 text-center">Vacation</th>
                <th className="py-3 px-3 text-center">Study</th>
                <th className="py-3 px-3 text-center">Injury</th>
                <th className="py-3 px-3 text-center">Unknown</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPlayerStats.map((stat) => {
                const isExcellent = stat.rate >= 85;
                const isGood = stat.rate >= 70 && stat.rate < 85;
                const isAttention = stat.rate < 70;

                return (
                  <tr key={stat.player} className="hover:bg-slate-50/80 transition-colors">
                    {/* Player Name & Avatar */}
                    <td className="py-3 px-3">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-7 h-7 rounded-full bg-[#002142] text-[#a79078] font-black text-[10px] flex items-center justify-center shrink-0">
                          {stat.player.substring(0, 2).toUpperCase()}
                        </div>
                        <span className="font-extrabold text-slate-900">
                          {stat.player}
                        </span>
                      </div>
                    </td>

                    {/* Attendance % & Progress bar */}
                    <td className="py-3 px-3 text-center min-w-[120px]">
                      <div className="flex items-center justify-center space-x-2">
                        <span className={`text-xs font-black ${
                          isExcellent ? 'text-emerald-600' : isGood ? 'text-amber-600' : 'text-rose-600'
                        }`}>
                          {stat.rate}%
                        </span>
                        <div className="w-16 bg-slate-100 h-1.5 rounded-full overflow-hidden shrink-0">
                          <div 
                            className={`h-full rounded-full ${
                              isExcellent ? 'bg-emerald-500' : isGood ? 'bg-amber-500' : 'bg-rose-500'
                            }`}
                            style={{ width: `${stat.rate}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Attended Count */}
                    <td className="py-3 px-3 text-center font-bold text-emerald-700">
                      <span className="bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                        {stat.attendedCount} / {stat.totalSessions}
                      </span>
                    </td>

                    {/* Absences Count */}
                    <td className="py-3 px-3 text-center font-bold">
                      {stat.absentCount > 0 ? (
                        <span className="bg-rose-50 border border-rose-200 text-rose-700 px-2 py-0.5 rounded-full">
                          {stat.absentCount}
                        </span>
                      ) : (
                        <span className="text-slate-300">0</span>
                      )}
                    </td>

                    {/* Vacation */}
                    <td className="py-3 px-3 text-center font-bold text-amber-700">
                      {stat.reasonsMap.Vacation > 0 ? stat.reasonsMap.Vacation : <span className="text-slate-300">0</span>}
                    </td>

                    {/* Study */}
                    <td className="py-3 px-3 text-center font-bold text-blue-700">
                      {stat.reasonsMap.Study > 0 ? stat.reasonsMap.Study : <span className="text-slate-300">0</span>}
                    </td>

                    {/* Injury */}
                    <td className="py-3 px-3 text-center font-bold text-rose-700">
                      {stat.reasonsMap.Injury > 0 ? stat.reasonsMap.Injury : <span className="text-slate-300">0</span>}
                    </td>

                    {/* Unknown */}
                    <td className="py-3 px-3 text-center font-bold text-slate-600">
                      {stat.reasonsMap.Unknown > 0 ? stat.reasonsMap.Unknown : <span className="text-slate-300">0</span>}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeletePlayer(stat.player)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Remove player from squad"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Session-by-Session Attendance Matrix */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-md space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-[#002142] text-[#a79078] rounded-xl">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-display font-black text-slate-900 uppercase tracking-wider">
                Session-by-Session Attendance Matrix
              </h2>
              <p className="text-[10px] text-slate-400 font-bold">
                Detailed presence matrix across all saved training sessions.
              </p>
            </div>
          </div>
        </div>

        {/* Matrix Grid Overflow */}
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-xs border-collapse min-w-[600px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase text-slate-500">
                <th className="py-3 px-3 sticky left-0 bg-slate-50 z-10 border-r border-slate-200 shadow-sm min-w-[140px]">
                  Player
                </th>
                {allSessionsList.map((s, idx) => (
                  <th key={s.id} className="py-2 px-2 text-center border-r border-slate-200 min-w-[100px]">
                    <div className="font-extrabold text-slate-900">
                      S#{s.sessionNumber || idx + 1}
                    </div>
                    <div className="text-[9px] text-slate-400 font-bold">
                      {s.date || 'No Date'}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {masterPlayerList.map(player => (
                <tr key={player} className="hover:bg-slate-50/80">
                  <td className="py-2 px-3 font-extrabold text-slate-900 sticky left-0 bg-white border-r border-slate-200 z-10 shadow-sm">
                    {player}
                  </td>
                  {allSessionsList.map(s => {
                    const attList = s.attendance || [];
                    const record = attList.find(a => a.playerName.toLowerCase() === player.toLowerCase());
                    const isPresent = !record || record.status === 'Attending';
                    const reason = record?.absenceReason || 'Unknown';
                    const reasonConfig = getAbsenceReasonConfig(reason);
                    const Icon = reasonConfig.icon;

                    return (
                      <td key={s.id} className="py-2 px-2 text-center border-r border-slate-100">
                        {isPresent ? (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black">
                            <Check className="w-3 h-3" />
                            <span>Present</span>
                          </span>
                        ) : (
                          <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-black ${reasonConfig.bg} ${reasonConfig.color}`}>
                            <Icon className="w-3 h-3" />
                            <span>{reasonConfig.label}</span>
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Player Modal */}
      {showRosterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4">
            <h3 className="text-sm font-display font-black text-slate-900 uppercase tracking-wider">
              Add New Player to Squad
            </h3>
            <form onSubmit={handleAddPlayer} className="space-y-3">
              <div>
                <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={newPlayerName}
                  onChange={(e) => setNewPlayerName(e.target.value)}
                  placeholder="e.g., Sarah, Reem, Layla..."
                  className="w-full text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl p-2.5 focus:outline-none focus:border-emerald-500"
                  autoFocus
                />
              </div>
              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRosterModal(false)}
                  className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#002142] text-white font-bold text-xs rounded-xl hover:bg-[#002e5c]"
                >
                  Add Player
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
