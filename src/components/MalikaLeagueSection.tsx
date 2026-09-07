import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ChevronRight, Crown, Loader2, ShieldHalf, Users } from 'lucide-react';
import type { CloudTrainingSession, SquadPlayer, TrainingSession } from '../types';
import { subscribeToMalikaAssignments } from '../services/squad/malikaAssignmentsService';
import { fetchWellnessReadings } from '../services/fitness/wellnessReadingsService';
import { resolveWellnessPlayerName } from '../utils/wellnessMatching';
import { calculatePlayerAttendanceStatisticsByPlayerId } from '../utils/attendanceStatistics';
import {
  buildAttendanceAliasMapFromMappings,
  createAttendanceNameResolver,
  DEFAULT_ATTENDANCE_ALIASES
} from '../utils/attendanceIdentity';
import { readAttendanceIdentityMappings } from '../utils/attendanceIdentityStore';
import {
  buildMalikaRanking,
  computeWellnessBonusPlayerIds,
  formatCompetitionMonthLabel,
  listCompetitionMonths,
  listMonthDayKeys,
  toCompetitionMonth,
  type MalikaAssignment,
  type MalikaGroup,
  type MalikaRankingEntry
} from '../utils/malikaLeague';

interface MalikaLeagueSectionProps {
  players: SquadPlayer[];
  session?: TrainingSession;
  cloudSessions?: CloudTrainingSession[];
  getPhotoSrc: (playerId: string) => string;
}

const MEDALS = ['🥇', '🥈', '🥉'];

export const MalikaLeagueSection: React.FC<MalikaLeagueSectionProps> = ({
  players,
  session,
  cloudSessions = [],
  getPhotoSrc
}) => {
  const currentMonth = useMemo(() => toCompetitionMonth(new Date()), []);
  const [assignments, setAssignments] = useState<MalikaAssignment[]>([]);
  const [assignmentsError, setAssignmentsError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [activeGroup, setActiveGroup] = useState<MalikaGroup>('players');
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);
  const [wellnessDaysByPlayerId, setWellnessDaysByPlayerId] = useState<Map<string, Set<string>>>(new Map());
  const [wellnessError, setWellnessError] = useState<string | null>(null);

  // Live feed: points saved by any authorised user reach every open leaderboard.
  useEffect(() => {
    const unsubscribe = subscribeToMalikaAssignments(
      (next) => {
        setAssignments(next);
        setAssignmentsError(null);
        setIsLoading(false);
      },
      (error) => {
        setAssignmentsError((error as { message?: string })?.message || 'Could not load Malika assignments.');
        setIsLoading(false);
      }
    );
    return unsubscribe;
  }, []);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    fetchWellnessReadings(controller.signal)
      .then((readings) => {
        if (!active) return;
        const map = new Map<string, Set<string>>();
        readings.forEach((reading) => {
          if (!reading.dateKey || reading.dateKey === '—') return;
          const resolution = resolveWellnessPlayerName(reading.playerName, players);
          if (resolution.status !== 'matched' || !resolution.playerId) return;
          const days = map.get(resolution.playerId) ?? new Set<string>();
          days.add(reading.dateKey);
          map.set(resolution.playerId, days);
        });
        setWellnessDaysByPlayerId(map);
        setWellnessError(null);
      })
      .catch((error: unknown) => {
        if (!active || (error as { name?: string })?.name === 'AbortError') return;
        setWellnessError('Wellness data unavailable — bonus not applied.');
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [players]);

  const monthOptions = useMemo(
    () => listCompetitionMonths(assignments, currentMonth),
    [assignments, currentMonth]
  );

  const monthSessions = useMemo(() => {
    const byId = new Map<string, TrainingSession | CloudTrainingSession>();
    if (session) byId.set(session.id, session);
    cloudSessions.forEach((cloudSession) => byId.set(cloudSession.id, cloudSession));
    return Array.from(byId.values()).filter((item) => (item.date || '').startsWith(selectedMonth));
  }, [cloudSessions, selectedMonth, session]);

  // Tie-break uses the existing Attendance system, restricted to the same month.
  const attendanceByPlayerId = useMemo(() => {
    const mappings = readAttendanceIdentityMappings();
    const aliasMap = { ...DEFAULT_ATTENDANCE_ALIASES, ...buildAttendanceAliasMapFromMappings(mappings) };
    const { resolveName } = createAttendanceNameResolver(players, aliasMap, mappings);

    return players.reduce<Record<string, number>>((acc, player) => {
      const stats = calculatePlayerAttendanceStatisticsByPlayerId(
        player.id,
        `${player.firstName} ${player.lastName}`.trim(),
        monthSessions,
        resolveName
      );
      acc[player.id] = stats.attendingCount;
      return acc;
    }, {});
  }, [monthSessions, players]);

  const wellnessBonusPlayerIds = useMemo(
    () =>
      computeWellnessBonusPlayerIds({
        completedDaysByPlayerId: wellnessDaysByPlayerId,
        requiredDayKeys: listMonthDayKeys(selectedMonth, new Date())
      }),
    [selectedMonth, wellnessDaysByPlayerId]
  );

  const ranking = useMemo(
    () =>
      buildMalikaRanking({
        players,
        assignments,
        month: selectedMonth,
        wellnessBonusPlayerIds,
        attendanceByPlayerId
      }),
    [assignments, attendanceByPlayerId, players, selectedMonth, wellnessBonusPlayerIds]
  );

  const groupRanking = activeGroup === 'players' ? ranking.players : ranking.goalkeepers;
  const scoredEntries = groupRanking.filter((entry) => entry.totalPoints > 0);
  const podium = scoredEntries.slice(0, 3);
  const isCurrentMonth = selectedMonth === currentMonth;

  const renderPlayerRow = (entry: MalikaRankingEntry) => {
    const isExpanded = expandedPlayerId === entry.playerId;

    return (
      <React.Fragment key={entry.playerId}>
        <tr
          className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${
            entry.rank <= 3 && entry.totalPoints > 0 ? 'bg-amber-50/40' : ''
          }`}
          onClick={() => setExpandedPlayerId(isExpanded ? null : entry.playerId)}
        >
          <td className="py-3 px-3 font-black text-slate-700 whitespace-nowrap">
            {entry.totalPoints > 0 && entry.rank <= 3 ? MEDALS[entry.rank - 1] : `#${entry.rank}`}
          </td>
          <td className="py-3 px-3">
            <div className="flex items-center space-x-2.5">
              <img
                src={getPhotoSrc(entry.playerId)}
                alt={entry.playerName}
                className="w-8 h-8 rounded-full object-cover border border-slate-200"
              />
              <div>
                <div className="font-extrabold text-slate-900">{entry.playerName}</div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider">{entry.position}</div>
              </div>
            </div>
          </td>
          <td className="py-3 px-3 text-center font-bold text-slate-600 tabular-nums">{entry.exercisePoints}</td>
          <td className="py-3 px-3 text-center font-bold tabular-nums">
            {entry.wellnessBonus > 0 ? (
              <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-black">
                +{entry.wellnessBonus}
              </span>
            ) : (
              <span className="text-slate-300">—</span>
            )}
          </td>
          <td className="py-3 px-3 text-center font-black text-amber-700 tabular-nums">{entry.totalPoints}</td>
          <td className="py-3 px-3 text-center text-[11px] font-bold text-slate-500 tabular-nums">
            {entry.attendanceCount}
          </td>
          <td className="py-3 px-3 text-right text-slate-400">
            <ChevronRight className={`w-4 h-4 inline transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
          </td>
        </tr>
        {isExpanded && (
          <tr className="bg-slate-50/70">
            <td colSpan={7} className="px-6 py-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                Points breakdown · {formatCompetitionMonthLabel(selectedMonth)}
              </p>
              {entry.breakdown.length === 0 ? (
                <p className="text-xs text-slate-400 font-semibold">No points recorded this month.</p>
              ) : (
                <ul className="space-y-1">
                  {entry.breakdown.map((item) => (
                    <li
                      key={item.key}
                      className="flex items-center justify-between text-xs bg-white border border-slate-200 rounded-lg px-3 py-1.5"
                    >
                      <span className="font-bold text-slate-700">
                        {item.kind === 'wellness-bonus' ? 'Wellness Bonus' : item.label}
                        {item.kind === 'exercise' && (
                          <span className="text-slate-400 font-semibold ml-2">{item.date}</span>
                        )}
                      </span>
                      <span
                        className={`font-black tabular-nums ${
                          item.kind === 'wellness-bonus' ? 'text-emerald-700' : 'text-amber-700'
                        }`}
                      >
                        +{item.points}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </td>
          </tr>
        )}
      </React.Fragment>
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#001d3a] border border-[#5ea4c5]/20 text-white rounded-2xl p-6 md:p-8 shadow-xl relative overflow-hidden print:bg-white print:text-slate-900 print:border-slate-300 print:p-4">
        <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="p-3 bg-[#002b54] text-amber-300 rounded-2xl border border-amber-300/30 shadow-inner">
              <Crown className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-300">
                Internal monthly competition
              </span>
              <h1 className="text-2xl md:text-3xl font-display font-black tracking-tight uppercase text-white mt-0.5">
                Malika Golden League
              </h1>
              <p className="text-sm text-sky-200/80 font-bold mt-1">
                {formatCompetitionMonthLabel(selectedMonth)}
                {!isCurrentMonth && <span className="ml-2 text-amber-300/80">· Archived month</span>}
              </p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <select
              value={selectedMonth}
              onChange={(event) => {
                setSelectedMonth(event.target.value);
                setExpandedPlayerId(null);
              }}
              className="bg-[#002b54] border border-[#5ea4c5]/30 text-white text-xs font-bold rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-amber-400"
            >
              {monthOptions.map((month) => (
                <option key={month} value={month}>
                  {formatCompetitionMonthLabel(month)}
                </option>
              ))}
            </select>
            <div className="flex items-center bg-[#002b54] p-1 rounded-xl border border-[#5ea4c5]/20">
              <button
                type="button"
                onClick={() => {
                  setActiveGroup('players');
                  setExpandedPlayerId(null);
                }}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all ${
                  activeGroup === 'players' ? 'bg-amber-500 text-slate-950' : 'text-sky-200/70 hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Players</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveGroup('goalkeepers');
                  setExpandedPlayerId(null);
                }}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all ${
                  activeGroup === 'goalkeepers' ? 'bg-amber-500 text-slate-950' : 'text-sky-200/70 hover:text-white'
                }`}
              >
                <ShieldHalf className="w-3.5 h-3.5" />
                <span>Goalkeepers</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {assignmentsError && (
        <div className="flex items-start space-x-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <p className="text-xs font-bold">{assignmentsError}</p>
        </div>
      )}

      {wellnessError && (
        <div className="flex items-start space-x-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <p className="text-xs font-bold">{wellnessError}</p>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-slate-400 text-xs font-bold">
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
          Loading the league...
        </div>
      ) : (
        <>
          {podium.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {podium.map((entry, index) => (
                <div
                  key={entry.playerId}
                  className={`bg-white border rounded-2xl p-5 shadow-sm ${
                    index === 0 ? 'border-amber-300 ring-2 ring-amber-200/60' : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-2xl">{MEDALS[index]}</span>
                    <span className="text-xs font-black uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                      {entry.totalPoints} pts
                    </span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <img
                      src={getPhotoSrc(entry.playerId)}
                      alt={entry.playerName}
                      className="w-14 h-14 rounded-xl object-cover border border-slate-200"
                    />
                    <div className="min-w-0">
                      <h3 className="font-extrabold text-slate-900 truncate">{entry.playerName}</h3>
                      <p className="text-[11px] text-slate-500 font-bold">
                        {entry.exercisePoints} exercise
                        {entry.wellnessBonus > 0 && ` · +${entry.wellnessBonus} wellness`}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-md space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-sm font-display font-black text-slate-900 uppercase tracking-wider">
                  {activeGroup === 'players' ? 'Players ranking' : 'Goalkeepers ranking'}
                </h2>
                <p className="text-[10px] text-slate-400 font-bold">
                  Derived from individual point assignments. Ties broken by attendance in the same month.
                </p>
              </div>
              <div className="text-xs font-black uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl">
                {scoredEntries.length} scored / {groupRanking.length} ranked
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-400 bg-slate-50/80">
                    <th className="py-3 px-3">Pos</th>
                    <th className="py-3 px-3">Player</th>
                    <th className="py-3 px-3 text-center">Exercise</th>
                    <th className="py-3 px-3 text-center">Wellness</th>
                    <th className="py-3 px-3 text-center">Total</th>
                    <th className="py-3 px-3 text-center">Attendance</th>
                    <th className="py-3 px-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {groupRanking.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-slate-400 font-semibold">
                        No players in this category.
                      </td>
                    </tr>
                  ) : (
                    groupRanking.map(renderPlayerRow)
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
