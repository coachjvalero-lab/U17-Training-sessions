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
  Activity,
  Check
} from 'lucide-react';
import { 
  ComposedChart,
  LineChart, 
  Line, 
  AreaChart,
  Area,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell, 
  Legend, 
  ReferenceLine 
} from 'recharts';
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
  const [chartView, setChartView] = useState<'classification' | 'race_progression'>('classification');
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

  // Excluded/deleted players list (persist in localStorage so deletions stick)
  const [excludedPlayers, setExcludedPlayers] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('u17_excluded_players');
      const list: string[] = saved ? JSON.parse(saved) : [];
      if (!list.some(p => p.toLowerCase() === 'jalila')) {
        list.push('jalila');
      }
      return list;
    } catch {
      return ['jalila'];
    }
  });

  const isPlayerExcluded = (name: string) => {
    if (!name) return true;
    const lower = name.trim().toLowerCase();
    return lower === 'jalila' || excludedPlayers.some(e => e.toLowerCase() === lower);
  };

  // Calculate global squad roster (union of squadRoster and any player appearing in attendance, minus excluded)
  const masterPlayerSet = new Set<string>(squadRoster.filter(p => !isPlayerExcluded(p)));
  allSessionsList.forEach(s => {
    if (s.attendance && Array.isArray(s.attendance)) {
      s.attendance.forEach(a => {
        if (a.playerName && !isPlayerExcluded(a.playerName)) {
          masterPlayerSet.add(a.playerName);
        }
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
          if (record.status === 'Attending' || record.status === 'Gym') {
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
    if (confirm(`¿Estás seguro de eliminar a "${playerName}" de la plantilla y de la clasificación?`)) {
      const lower = playerName.toLowerCase();
      const updatedExcluded = Array.from(new Set([...excludedPlayers, lower, 'jalila']));
      setExcludedPlayers(updatedExcluded);
      try {
        localStorage.setItem('u17_excluded_players', JSON.stringify(updatedExcluded));
      } catch (e) {}

      const updatedRoster = squadRoster.filter(p => p.toLowerCase() !== lower);
      if (onChangeRoster) onChangeRoster(updatedRoster);

      if (session.attendance) {
        onChangeSession({
          squadRoster: updatedRoster,
          attendance: session.attendance.filter(a => a.playerName.toLowerCase() !== lower)
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

      {/* Attendance Classification & Ranking Chart (Gráfico de Clasificación de Asistencia con Puntos y Líneas) */}
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

        // Chronological list of sessions for race progression
        const chronologicalSessions = [...allSessionsList].sort((a, b) => 
          (a.date || '').localeCompare(b.date || '')
        );

        // Build race progression data points
        const raceProgressionData = chronologicalSessions.map((sess, sIdx) => {
          const dataPoint: Record<string, any> = {
            sessionName: `S${sIdx + 1}`,
            date: sess.date || `S${sIdx + 1}`,
            fullLabel: `Sesión #${sess.sessionNumber || sIdx + 1}`
          };

          const pastSessions = chronologicalSessions.slice(0, sIdx + 1);
          masterPlayerList.forEach(player => {
            let attended = 0;
            pastSessions.forEach(ps => {
              const rec = (ps.attendance || []).find(a => a.playerName.toLowerCase() === player.toLowerCase());
              if (!rec || rec.status === 'Attending' || rec.status === 'Gym') {
                attended += 1;
              }
            });
            const cumRate = Math.round((attended / pastSessions.length) * 100);
            dataPoint[player] = cumRate;
          });

          return dataPoint;
        });

        const RACE_COLORS = [
          '#f59e0b', '#0284c7', '#10b981', '#8b5cf6', '#ec4899', 
          '#6366f1', '#14b8a6', '#f97316', '#06b6d4', '#84cc16', 
          '#a855f7', '#e11d48', '#3b82f6', '#10b981', '#64748b'
        ];

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
                      Puntos y Líneas
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Clasificación de carrera en gráfico de línea continua y puntos de rendimiento por jugadora.
                  </p>
                </div>
              </div>

              {/* View Switcher & Sorting Controls */}
              <div className="flex flex-wrap items-center gap-2">
                {/* View Switcher Tabs */}
                <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setChartView('classification')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                      chartView === 'classification' 
                        ? 'bg-[#002142] text-white shadow-sm' 
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>Clasificación General</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartView('race_progression')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                      chartView === 'race_progression' 
                        ? 'bg-[#002142] text-white shadow-sm' 
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Activity className="w-3.5 h-3.5" />
                    <span>Carrera por Sesiones</span>
                  </button>
                </div>

                {/* Sorting Filter (for Classification View) */}
                {chartView === 'classification' && (
                  <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setChartSort('rate')}
                      className={`px-2.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        chartSort === 'rate' 
                          ? 'bg-white text-slate-900 shadow-sm' 
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      %
                    </button>
                    <button
                      type="button"
                      onClick={() => setChartSort('attended')}
                      className={`px-2.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
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
                      className={`px-2.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        chartSort === 'absences' 
                          ? 'bg-white text-slate-900 shadow-sm' 
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Faltas
                    </button>
                  </div>
                )}
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

            {/* Line & Points Classification Container */}
            <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 sm:p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-black uppercase text-slate-500 pb-2 border-b border-slate-200/80">
                <span className="flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-[#002142]" />
                  <span>
                    {chartView === 'classification' 
                      ? `Línea de Clasificación por Jugadoras (${sortedChartPlayers.length} Jugadoras)` 
                      : `Evolución Temporal de Carrera por Sesiones (${chronologicalSessions.length} Sesiones)`}
                  </span>
                </span>
                <div className="flex items-center gap-3 text-[11px] font-bold">
                  <span className="flex items-center gap-1 text-amber-700">
                    <span className="w-3 h-3 rounded-full bg-amber-400 border border-amber-600 inline-block" /> Oro / #1
                  </span>
                  <span className="flex items-center gap-1 text-slate-700">
                    <span className="w-3 h-3 rounded-full bg-slate-300 border border-slate-500 inline-block" /> Plata / #2
                  </span>
                  <span className="flex items-center gap-1 text-amber-900">
                    <span className="w-3 h-3 rounded-full bg-amber-600 border border-amber-800 inline-block" /> Bronce / #3
                  </span>
                  <span className="flex items-center gap-1 text-emerald-700">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> ≥85%
                  </span>
                </div>
              </div>

              {/* View 1: General Classification Area / Line Chart with Custom Point Badges (Jugadoras en eje Y) */}
              {chartView === 'classification' ? (
                <div 
                  className="w-full pt-4 overflow-x-auto" 
                  style={{ height: `${Math.max(400, sortedChartPlayers.length * 32 + 60)}px` }}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart 
                      layout="vertical"
                      data={sortedChartPlayers.map((p, idx) => ({
                        name: p.player,
                        rate: p.rate,
                        attended: p.attendedCount,
                        absent: p.absentCount,
                        total: p.totalSessions,
                        rank: idx + 1
                      }))}
                      margin={{ top: 20, right: 35, left: 15, bottom: 20 }}
                    >
                      <defs>
                        <linearGradient id="colorClassification" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="5%" stopColor="#002142" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#002142" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                      <XAxis 
                        type="number"
                        domain={[0, 100]} 
                        tick={{ fontSize: 11, fontWeight: 800, fill: '#64748b' }}
                        unit="%"
                      />
                      <YAxis 
                        type="category"
                        dataKey="name" 
                        tick={{ fontSize: 11, fontWeight: 800, fill: '#1e293b' }}
                        interval={0}
                        width={130}
                      />
                      <Tooltip 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs space-y-1.5 border border-slate-700 min-w-[170px]">
                                <div className="font-black border-b border-slate-700 pb-1 text-amber-400 flex justify-between items-center">
                                  <span>#{data.rank} {data.name}</span>
                                  <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded font-bold">
                                    {data.rate}%
                                  </span>
                                </div>
                                <div className="text-[11px] font-medium space-y-0.5 text-slate-300">
                                  <p className="text-emerald-400 font-bold">✔ Asistencias: {data.attended} sesiones</p>
                                  <p className="text-rose-400 font-bold">✖ Faltas: {data.absent} ausencias</p>
                                  <p className="text-slate-400 text-[10px]">Total evaluado: {data.total} sesiones</p>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <ReferenceLine 
                        x={85} 
                        stroke="#10b981" 
                        strokeDasharray="4 4" 
                        label={{ 
                          value: "Objetivo 85%", 
                          fill: "#059669", 
                          fontSize: 10, 
                          fontWeight: 800, 
                          position: "top" 
                        }} 
                      />
                      <Area 
                        type="monotone" 
                        dataKey="rate" 
                        stroke="#002142" 
                        strokeWidth={3} 
                        fillOpacity={1} 
                        fill="url(#colorClassification)" 
                        dot={(props: any) => {
                          const { cx, cy, payload } = props;
                          if (!cx || !cy) return null;
                          const rank = payload.rank;
                          const rate = payload.rate;

                          let strokeColor = '#002142';
                          let fillColor = '#ffffff';
                          let radius = 6;

                          if (rank === 1) {
                            strokeColor = '#d97706';
                            fillColor = '#fbbf24';
                            radius = 9;
                          } else if (rank === 2) {
                            strokeColor = '#475569';
                            fillColor = '#cbd5e1';
                            radius = 8;
                          } else if (rank === 3) {
                            strokeColor = '#92400e';
                            fillColor = '#d97706';
                            radius = 7.5;
                          } else if (rate >= 85) {
                            strokeColor = '#059669';
                            fillColor = '#10b981';
                          } else if (rate < 70) {
                            strokeColor = '#e11d48';
                            fillColor = '#f43f5e';
                          }

                          return (
                            <g key={`point-${payload.name}-${rank}`}>
                              <circle 
                                cx={cx} 
                                cy={cy} 
                                r={radius + 3} 
                                fill={strokeColor} 
                                fillOpacity={0.2} 
                              />
                              <circle 
                                cx={cx} 
                                cy={cy} 
                                r={radius} 
                                fill={fillColor} 
                                stroke={strokeColor} 
                                strokeWidth={2} 
                              />
                              <text 
                                x={cx + radius + 10} 
                                y={cy + 4} 
                                textAnchor="start" 
                                fill={strokeColor} 
                                fontSize="11" 
                                fontWeight="900"
                              >
                                #{rank} ({rate}%)
                              </text>
                            </g>
                          );
                        }}
                        activeDot={{ r: 8, strokeWidth: 2, stroke: '#002142' }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                /* View 2: Race Progression Across All Sessions (Carrera de Asistencia) */
                <div className="w-full h-[380px] pt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart 
                      data={raceProgressionData}
                      margin={{ top: 15, right: 20, left: -20, bottom: 25 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis 
                        dataKey="sessionName" 
                        tick={{ fontSize: 11, fontWeight: 800, fill: '#334155' }}
                      />
                      <YAxis 
                        domain={[0, 100]} 
                        tick={{ fontSize: 10, fontWeight: 800, fill: '#64748b' }}
                        unit="%"
                      />
                      <Tooltip 
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs space-y-1.5 border border-slate-700 max-h-60 overflow-y-auto">
                                <div className="font-black border-b border-slate-700 pb-1 text-amber-400">
                                  {payload[0]?.payload?.fullLabel || label}
                                </div>
                                <div className="space-y-1">
                                  {payload
                                    .slice()
                                    .sort((a, b) => Number(b.value) - Number(a.value))
                                    .map((p: any) => (
                                      <div key={p.name} className="flex justify-between items-center gap-4 text-[11px]">
                                        <span className="font-bold flex items-center gap-1.5" style={{ color: p.color }}>
                                          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: p.color }} />
                                          {p.name}
                                        </span>
                                        <span className="font-black text-slate-200">{p.value}%</span>
                                      </div>
                                    ))}
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <ReferenceLine 
                        y={85} 
                        stroke="#10b981" 
                        strokeDasharray="4 4" 
                        label={{ 
                          value: "Objetivo 85%", 
                          fill: "#059669", 
                          fontSize: 10, 
                          fontWeight: 800, 
                          position: "top" 
                        }} 
                      />
                      {sortedChartPlayers.map((playerStat, idx) => {
                        const player = playerStat.player;
                        const strokeColor = RACE_COLORS[idx % RACE_COLORS.length];
                        return (
                          <Line
                            key={player}
                            type="monotone"
                            dataKey={player}
                            name={player}
                            stroke={strokeColor}
                            strokeWidth={idx < 3 ? 3 : 2}
                            dot={{ r: idx < 3 ? 5 : 3, strokeWidth: 1.5, fill: '#ffffff', stroke: strokeColor }}
                            activeDot={{ r: 7 }}
                          />
                        );
                      })}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
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
