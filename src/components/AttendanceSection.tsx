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
  FileCheck,
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
  Trophy,
  Crown,
  Medal,
  Award,
  BarChart2,
  Check
} from 'lucide-react';
import { TrainingSession, PlayerAttendance, AbsenceReason } from '../types';
import { CloudTrainingSession } from '../firebase';
import { DEFAULT_SQUAD_PLAYERS } from '../constants/squad';
import { ABSENCE_REASONS, getAbsenceReasonConfig, SessionAttendanceTracker } from './SessionAttendanceTracker';

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
  const [chartSort, setChartSort] = useState<'rate' | 'attended' | 'absences'>('rate');
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
      Permission: 0,
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
  const totalPermissions = playerStats.reduce((sum, p) => sum + p.reasonsMap.Permission, 0);
  const totalUnknowns = playerStats.reduce((sum, p) => sum + p.reasonsMap.Unknown, 0);
  const totalAbsences = totalVacations + totalStudies + totalInjuries + totalPermissions + totalUnknowns;

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

      {/* Active Session Attendance Tracker */}
      <SessionAttendanceTracker
        attendance={session.attendance}
        squadRoster={squadRoster}
        onChangeAttendance={(attendance) => onChangeSession({ attendance })}
        onChangeRoster={onChangeRoster}
      />

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

            <div className="bg-purple-50 border border-purple-200/60 p-1.5 rounded-lg flex items-center justify-between text-purple-900">
              <span className="flex items-center gap-1 text-[11px]">
                <FileCheck className="w-3 h-3 text-purple-600" />
                Permission
              </span>
              <span className="font-black">{totalPermissions}</span>
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
              <option value="Permission">Permission Only</option>
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
                <th className="py-3 px-3 text-center">Permission</th>
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

                    {/* Permission */}
                    <td className="py-3 px-3 text-center font-bold text-purple-700">
                      {stat.reasonsMap.Permission > 0 ? stat.reasonsMap.Permission : <span className="text-slate-300">0</span>}
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

      {/* Attendance Classification & Ranking Chart (Gráfico de Clasificación de Asistencia) */}
      {(() => {
        const sortedChartPlayers = [...playerStats].sort((a, b) => {
          if (chartSort === 'rate') {
            if (b.rate !== a.rate) return b.rate - a.rate;
            return b.attendedCount - a.attendedCount;
          }
          if (chartSort === 'attended') {
            if (b.attendedCount !== a.attendedCount) return b.attendedCount - a.attendedCount;
            return b.rate - a.rate;
          }
          if (chartSort === 'absences') {
            if (a.absentCount !== b.absentCount) return a.absentCount - b.absentCount;
            return b.rate - a.rate;
          }
          return 0;
        });

        const top1 = sortedChartPlayers[0];
        const top2 = sortedChartPlayers[1];
        const top3 = sortedChartPlayers[2];

        return (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-md space-y-6">
            
            {/* Header & View Switchers */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-[#002142] text-[#a79078] rounded-xl shadow-sm">
                  <Trophy className="w-5 h-5 text-[#a79078]" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h2 className="text-base font-display font-black text-slate-900 uppercase tracking-wider">
                      Gráfico de Clasificación de Asistencia
                    </h2>
                    <span className="bg-amber-100 text-amber-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-amber-200 flex items-center gap-1">
                      <Crown className="w-3 h-3 text-amber-600" />
                      Ranking
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Clasificación visual por asistencia, sesiones asistidas y ausencias acumuladas.
                  </p>
                </div>
              </div>

              {/* Sorting Filter */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setChartSort('rate')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    chartSort === 'rate' 
                      ? 'bg-white text-slate-900 shadow-sm' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  % Asistencia
                </button>
                <button
                  type="button"
                  onClick={() => setChartSort('attended')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    chartSort === 'attended' 
                      ? 'bg-white text-slate-900 shadow-sm' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Asistencias
                </button>
                <button
                  type="button"
                  onClick={() => setChartSort('absences')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    chartSort === 'absences' 
                      ? 'bg-white text-slate-900 shadow-sm' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Menos Faltas
                </button>
              </div>
            </div>

            {/* Top 3 Podium Standings */}
            {sortedChartPlayers.length >= 2 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                {/* 2nd Place */}
                {top2 && (
                  <div className="order-2 md:order-1 bg-gradient-to-b from-slate-50 to-slate-100/60 border-2 border-slate-300/80 rounded-2xl p-4 shadow-sm flex flex-col items-center justify-between text-center relative overflow-hidden">
                    <div className="absolute top-2 right-2 bg-slate-200 text-slate-700 text-[10px] font-black px-2 py-0.5 rounded-full border border-slate-300 flex items-center gap-1">
                      <Medal className="w-3 h-3 text-slate-500" /> #2 Plata
                    </div>
                    <div className="w-12 h-12 rounded-full bg-slate-300 text-slate-800 font-black text-sm flex items-center justify-center border-2 border-slate-400 mt-2 shadow-inner">
                      {top2.player.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="mt-3 space-y-0.5">
                      <h4 className="font-extrabold text-slate-900 text-sm truncate max-w-[150px]">
                        {top2.player}
                      </h4>
                      <p className="text-xs font-black text-slate-600">
                        {top2.rate}% Asistencia
                      </p>
                    </div>
                    <div className="mt-3 w-full bg-white/80 border border-slate-200 rounded-xl p-2 text-[11px] font-bold text-slate-600 flex justify-around">
                      <span>Asistidos: <strong className="text-emerald-600">{top2.attendedCount}</strong></span>
                      <span>Faltas: <strong className="text-rose-600">{top2.absentCount}</strong></span>
                    </div>
                  </div>
                )}

                {/* 1st Place (Gold) */}
                {top1 && (
                  <div className="order-1 md:order-2 bg-gradient-to-b from-amber-50 to-amber-100/50 border-2 border-amber-400 rounded-2xl p-5 shadow-md flex flex-col items-center justify-between text-center relative overflow-hidden transform md:-translate-y-2">
                    <div className="absolute top-2 right-2 bg-amber-400 text-amber-950 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-amber-500 flex items-center gap-1 shadow-sm">
                      <Crown className="w-3.5 h-3.5 text-amber-900" /> #1 Oro
                    </div>
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-white font-black text-base flex items-center justify-center border-2 border-amber-300 mt-1 shadow-md">
                      {top1.player.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="mt-3 space-y-0.5">
                      <h4 className="font-black text-amber-950 text-base truncate max-w-[170px]">
                        {top1.player}
                      </h4>
                      <div className="inline-block bg-amber-500 text-white text-xs font-black px-3 py-0.5 rounded-full shadow-sm">
                        {top1.rate}% Asistencia Líder
                      </div>
                    </div>
                    <div className="mt-3 w-full bg-white/90 border border-amber-200/80 rounded-xl p-2 text-[11px] font-bold text-slate-700 flex justify-around shadow-sm">
                      <span>Asistidos: <strong className="text-emerald-600">{top1.attendedCount}</strong></span>
                      <span>Faltas: <strong className="text-rose-600">{top1.absentCount}</strong></span>
                    </div>
                  </div>
                )}

                {/* 3rd Place */}
                {top3 && (
                  <div className="order-3 bg-gradient-to-b from-amber-50/30 to-amber-100/30 border-2 border-amber-300/60 rounded-2xl p-4 shadow-sm flex flex-col items-center justify-between text-center relative overflow-hidden">
                    <div className="absolute top-2 right-2 bg-amber-200 text-amber-900 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-300 flex items-center gap-1">
                      <Award className="w-3 h-3 text-amber-700" /> #3 Bronce
                    </div>
                    <div className="w-12 h-12 rounded-full bg-amber-200 text-amber-900 font-black text-sm flex items-center justify-center border-2 border-amber-400 mt-2 shadow-inner">
                      {top3.player.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="mt-3 space-y-0.5">
                      <h4 className="font-extrabold text-slate-900 text-sm truncate max-w-[150px]">
                        {top3.player}
                      </h4>
                      <p className="text-xs font-black text-amber-800">
                        {top3.rate}% Asistencia
                      </p>
                    </div>
                    <div className="mt-3 w-full bg-white/80 border border-amber-200/50 rounded-xl p-2 text-[11px] font-bold text-slate-600 flex justify-around">
                      <span>Asistidos: <strong className="text-emerald-600">{top3.attendedCount}</strong></span>
                      <span>Faltas: <strong className="text-rose-600">{top3.absentCount}</strong></span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Classification Bar Graph Ranking List */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between text-xs font-black uppercase text-slate-400 px-2">
                <span>Jugador & Posición</span>
                <span>Barra de Clasificación (% Asistencia)</span>
              </div>

              <div className="space-y-2.5">
                {sortedChartPlayers.map((stat, idx) => {
                  const rank = idx + 1;
                  const isExcellent = stat.rate >= 85;
                  const isGood = stat.rate >= 70 && stat.rate < 85;

                  return (
                    <div 
                      key={stat.player} 
                      className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        rank === 1 
                          ? 'bg-amber-50/40 border-amber-300/80 shadow-sm' 
                          : rank === 2 
                          ? 'bg-slate-50 border-slate-300/80' 
                          : rank === 3 
                          ? 'bg-amber-50/20 border-amber-200' 
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {/* Left: Rank # & Player info */}
                      <div className="flex items-center space-x-3 min-w-[200px]">
                        <div className={`w-7 h-7 rounded-xl font-black text-xs flex items-center justify-center shrink-0 ${
                          rank === 1 ? 'bg-amber-400 text-amber-950 border border-amber-500' :
                          rank === 2 ? 'bg-slate-300 text-slate-800 border border-slate-400' :
                          rank === 3 ? 'bg-amber-200 text-amber-900 border border-amber-300' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          #{rank}
                        </div>
                        <div>
                          <h4 className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                            <span>{stat.player}</span>
                            {rank === 1 && <Crown className="w-3.5 h-3.5 text-amber-500 inline" />}
                          </h4>
                          <span className="text-[10px] text-slate-400 font-bold">
                            {stat.attendedCount} de {stat.totalSessions} sesiones asistidas ({stat.absentCount} faltas)
                          </span>
                        </div>
                      </div>

                      {/* Right: Graphic Progress Bar */}
                      <div className="flex-1 max-w-md flex items-center space-x-3">
                        <div className="flex-1 bg-slate-100 h-4 rounded-full overflow-hidden p-0.5 border border-slate-200 relative flex">
                          {/* Attended Portion Bar */}
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${
                              isExcellent ? 'bg-gradient-to-r from-emerald-500 to-emerald-600' :
                              isGood ? 'bg-gradient-to-r from-amber-400 to-amber-500' :
                              'bg-gradient-to-r from-rose-500 to-rose-600'
                            }`}
                            style={{ width: `${stat.rate}%` }}
                          />
                        </div>

                        {/* Percentage badge */}
                        <div className={`min-w-[52px] text-right text-xs font-black ${
                          isExcellent ? 'text-emerald-700' :
                          isGood ? 'text-amber-700' :
                          'text-rose-700'
                        }`}>
                          {stat.rate}%
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        );
      })()}

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
