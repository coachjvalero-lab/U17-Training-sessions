import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Check, Loader2, Scale, TrendingDown, TrendingUp, User } from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import type { PlayerWeeklyWeight, SquadPlayer } from '../types';
import {
  calculateWeightHistoryWithDeltas,
  compareSquadPlayers,
  formatWeightDate,
  getIsoWeekEnd,
  getIsoWeekStart,
  getPreviousWeight,
  groupWeightsByPlayer,
  validateWeightInput
} from '../utils/weeklyWeight';
import { saveWeeklyWeight, subscribeToWeeklyWeights } from '../services/fitness/weeklyWeightService';

interface WeeklyWeightSectionProps {
  squadPlayers: SquadPlayer[];
}

type RowStatus = 'idle' | 'saving' | 'saved' | 'error';

function todayDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export const WeeklyWeightSection: React.FC<WeeklyWeightSectionProps> = ({ squadPlayers }) => {
  const currentWeekStart = useMemo(() => getIsoWeekStart(todayDateKey()), []);
  const currentWeekEnd = useMemo(() => getIsoWeekEnd(currentWeekStart), [currentWeekStart]);

  const [weights, setWeights] = useState<PlayerWeeklyWeight[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [rowStatus, setRowStatus] = useState<Record<string, RowStatus>>({});
  const [rowError, setRowError] = useState<Record<string, string>>({});
  const [historyPlayerId, setHistoryPlayerId] = useState<string>('');
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const hydratedWeekRef = useRef<string>('');

  useEffect(() => {
    const unsubscribe = subscribeToWeeklyWeights(
      (rows) => setWeights(rows),
      (error) => setLoadError(error instanceof Error ? error.message : 'Could not load weekly weight data.')
    );
    return unsubscribe;
  }, []);

  const orderedPlayers = useMemo(() => [...squadPlayers].sort(compareSquadPlayers), [squadPlayers]);

  const weightsByPlayer = useMemo(() => groupWeightsByPlayer(weights), [weights]);

  // Automatically pre-select first player with data or first player in squad for history view
  useEffect(() => {
    if (!historyPlayerId && orderedPlayers.length > 0) {
      setHistoryPlayerId(orderedPlayers[0].id);
    }
  }, [historyPlayerId, orderedPlayers]);

  // Prefill the input row from existing records for the current week (recover, don't duplicate).
  useEffect(() => {
    if (hydratedWeekRef.current === currentWeekStart && Object.keys(drafts).length > 0) return;
    const next: Record<string, string> = {};
    for (const player of orderedPlayers) {
      const existing = weightsByPlayer.get(player.id)?.find((entry) => entry.weekStartDate === currentWeekStart);
      if (existing) next[player.id] = String(existing.weightKg);
    }
    setDrafts((previous) => ({ ...next, ...previous }));
    hydratedWeekRef.current = currentWeekStart;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWeekStart, weightsByPlayer, orderedPlayers.length]);

  const commitRow = async (playerId: string, rawValue: string) => {
    const trimmed = rawValue.trim();
    if (!trimmed) return;

    const validation = validateWeightInput(trimmed);
    if (!validation.valid || validation.weightKg === undefined) {
      setRowStatus((previous) => ({ ...previous, [playerId]: 'error' }));
      setRowError((previous) => ({ ...previous, [playerId]: validation.error || 'Enter a valid weight in kg.' }));
      return;
    }

    const weightKg = validation.weightKg;
    const existing = weightsByPlayer.get(playerId)?.find((entry) => entry.weekStartDate === currentWeekStart);
    if (existing && existing.weightKg === weightKg) {
      setRowStatus((previous) => ({ ...previous, [playerId]: 'saved' }));
      setRowError((previous) => ({ ...previous, [playerId]: '' }));
      return;
    }

    setRowStatus((previous) => ({ ...previous, [playerId]: 'saving' }));
    setRowError((previous) => ({ ...previous, [playerId]: '' }));

    try {
      await saveWeeklyWeight({ playerId, weekStartDate: currentWeekStart, weightKg });
      setRowStatus((previous) => ({ ...previous, [playerId]: 'saved' }));
    } catch (error) {
      setRowStatus((previous) => ({ ...previous, [playerId]: 'error' }));
      setRowError((previous) => ({
        ...previous,
        [playerId]: error instanceof Error ? error.message : 'Could not save weight.'
      }));
    }
  };

  const focusNextInput = (playerId: string) => {
    const index = orderedPlayers.findIndex((player) => player.id === playerId);
    const next = orderedPlayers[index + 1];
    if (next) {
      inputRefs.current[next.id]?.focus();
    }
  };

  const selectedPlayer = useMemo(
    () => orderedPlayers.find((p) => p.id === historyPlayerId) || null,
    [orderedPlayers, historyPlayerId]
  );

  const rawHistoryEntries = historyPlayerId ? weightsByPlayer.get(historyPlayerId) ?? [] : [];
  const historyPoints = useMemo(
    () => calculateWeightHistoryWithDeltas(rawHistoryEntries),
    [rawHistoryEntries]
  );

  const historyChartData = useMemo(() => {
    const asc = [...rawHistoryEntries].sort((a, b) => a.weekStartDate.localeCompare(b.weekStartDate));
    return asc.map((entry) => ({
      weekStart: formatWeightDate(entry.weekStartDate),
      weightKg: entry.weightKg
    }));
  }, [rawHistoryEntries]);

  const savedThisWeekCount = orderedPlayers.filter((player) =>
    weightsByPlayer.get(player.id)?.some((entry) => entry.weekStartDate === currentWeekStart)
  ).length;

  return (
    <div className="mt-4 space-y-6">
      {/* Header Banner */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-slate-400">
              <Scale className="h-3.5 w-3.5 text-emerald-600" />
              <span>Fitness → Testing → Weight</span>
            </div>
            <h3 className="mt-1 text-lg sm:text-xl font-black text-slate-900">
              Weekly Body Weight Testing
            </h3>
            <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
              <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
              <span>
                Current Week: <strong>{formatWeightDate(currentWeekStart)}</strong> → <strong>{formatWeightDate(currentWeekEnd)}</strong> (Detected automatically)
              </span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-extrabold text-emerald-800 bg-emerald-100 px-3 py-1.5 rounded-xl border border-emerald-200 shadow-sm">
              {savedThisWeekCount} / {orderedPlayers.length} recorded this week
            </span>
          </div>
        </div>
      </div>

      {loadError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-900">
          {loadError}
        </div>
      ) : null}

      {/* Weekly Weight Entry Table */}
      <div className="w-full rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="bg-slate-50/80 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">Squad Weekly Weigh-In</h4>
            <p className="text-[11px] font-medium text-slate-500">
              Enter weights in <strong>kg</strong>. Press <strong>Enter</strong> to save and jump to the next player.
            </p>
          </div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            1 measurement / player / week
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] table-fixed border-collapse text-left text-xs text-slate-700">
            <colgroup>
              <col className="w-[8%]" />
              <col className="w-[34%]" />
              <col className="w-[18%]" />
              <col className="w-[22%]" />
              <col className="w-[18%]" />
            </colgroup>
            <thead className="bg-slate-50/50 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-center">#</th>
                <th className="px-4 py-3">Player</th>
                <th className="px-4 py-3">Previous Weight</th>
                <th className="px-4 py-3">This Week ({formatWeightDate(currentWeekStart)})</th>
                <th className="px-4 py-3 text-right pr-6">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orderedPlayers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400 font-semibold">
                    No players found in the squad roster.
                  </td>
                </tr>
              ) : (
                orderedPlayers.map((player) => {
                  const previous = getPreviousWeight(weights, player.id, currentWeekStart);
                  const status = rowStatus[player.id] ?? (weightsByPlayer.get(player.id)?.some((e) => e.weekStartDate === currentWeekStart) ? 'saved' : 'idle');
                  const error = rowError[player.id];
                  const currentDraft = drafts[player.id] ?? '';

                  return (
                    <tr
                      key={player.id}
                      className={`hover:bg-slate-50/80 transition-colors ${historyPlayerId === player.id ? 'bg-[#002142]/5' : ''}`}
                    >
                      <td className="px-4 py-3 text-center font-mono font-bold text-[#002142]">
                        {player.number !== undefined && player.number !== null ? `#${player.number}` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div
                          className="cursor-pointer group"
                          onClick={() => setHistoryPlayerId(player.id)}
                          title="Click to view player weight history"
                        >
                          <div className="font-bold text-slate-900 group-hover:text-emerald-700 transition-colors flex items-center gap-1.5">
                            <span>{player.firstName} {player.lastName}</span>
                          </div>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            {player.position}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-600">
                        {previous ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-800">{previous.weightKg} kg</span>
                            <span className="text-[10px] text-slate-400 font-normal">
                              ({formatWeightDate(previous.weekStartDate)})
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 font-normal">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <input
                            ref={(el) => { inputRefs.current[player.id] = el; }}
                            type="number"
                            step="0.1"
                            min="25"
                            max="250"
                            inputMode="decimal"
                            value={currentDraft}
                            placeholder="e.g. 62.4"
                            onChange={(event) => {
                              const val = event.target.value;
                              setDrafts((prev) => ({ ...prev, [player.id]: val }));
                              if (rowStatus[player.id] === 'error') {
                                setRowStatus((prev) => ({ ...prev, [player.id]: 'idle' }));
                                setRowError((prev) => ({ ...prev, [player.id]: '' }));
                              }
                            }}
                            onBlur={(event) => void commitRow(player.id, event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                event.preventDefault();
                                void commitRow(player.id, (event.target as HTMLInputElement).value);
                                focusNextInput(player.id);
                              }
                            }}
                            className="w-28 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#002142] focus:bg-white focus:ring-2 focus:ring-[#002142]/10 transition-all"
                          />
                          <span className="text-xs font-bold text-slate-400">kg</span>
                        </div>
                        {error ? (
                          <p className="mt-1 text-[10px] font-bold text-rose-600">{error}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-right pr-6">
                        {status === 'saving' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-600" /> Saving
                          </span>
                        ) : status === 'saved' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <Check className="h-3 w-3" /> Saved
                          </span>
                        ) : status === 'error' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                            Error
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-slate-300">Pending</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Historical Evolution Section */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h4 className="text-sm font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <Scale className="h-4 w-4 text-emerald-600" />
              <span>Weight History & Longitudinal Evolution</span>
            </h4>
            <p className="text-xs text-slate-500 font-medium">
              Track multi-week body weight trends for individual players.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-slate-400" />
            <select
              value={historyPlayerId}
              onChange={(event) => setHistoryPlayerId(event.target.value)}
              className="min-w-56 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#002142]/10"
            >
              <option value="">Select a player…</option>
              {orderedPlayers.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.number ? `#${player.number} ` : ''}{player.firstName} {player.lastName}
                </option>
              ))}
            </select>
          </div>
        </div>

        {!selectedPlayer ? (
          <p className="text-xs font-semibold text-slate-500 py-6 text-center">
            Select a player above to inspect their weekly weight history.
          </p>
        ) : historyPoints.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
            <Scale className="mx-auto h-8 w-8 text-slate-300 mb-2" />
            <p className="text-xs font-bold text-slate-600">
              No weight records found for {selectedPlayer.firstName} {selectedPlayer.lastName}.
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              Enter a weight in the table above to start tracking.
            </p>
          </div>
        ) : (
          <div className="space-y-6 pt-2">
            {/* Quick summary metric cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">Latest Weight</span>
                <span className="text-lg font-black text-slate-900">{historyPoints[0].weightKg} kg</span>
                <span className="block text-[10px] text-slate-500 font-semibold">{historyPoints[0].formattedDate}</span>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">Initial Weight</span>
                <span className="text-lg font-black text-slate-900">{historyPoints[historyPoints.length - 1].weightKg} kg</span>
                <span className="block text-[10px] text-slate-500 font-semibold">{historyPoints[historyPoints.length - 1].formattedDate}</span>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">Total Recorded Weeks</span>
                <span className="text-lg font-black text-[#002142]">{historyPoints.length}</span>
                <span className="block text-[10px] text-slate-500 font-semibold">Weekly entries</span>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">Net Season Change</span>
                {(() => {
                  const first = historyPoints[historyPoints.length - 1].weightKg;
                  const latest = historyPoints[0].weightKg;
                  const net = Math.round((latest - first) * 10) / 10;
                  if (net === 0) return <span className="text-lg font-black text-slate-600">0.0 kg</span>;
                  if (net > 0) {
                    return (
                      <span className="text-lg font-black text-rose-600 inline-flex items-center gap-1">
                        <TrendingUp className="h-4 w-4" /> +{net} kg
                      </span>
                    );
                  }
                  return (
                    <span className="text-lg font-black text-emerald-600 inline-flex items-center gap-1">
                      <TrendingDown className="h-4 w-4" /> {net} kg
                    </span>
                  );
                })()}
                <span className="block text-[10px] text-slate-500 font-semibold">Since initial record</span>
              </div>
            </div>

            {/* Line Chart */}
            {historyChartData.length > 1 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-3">
                  Weight Trend (kg)
                </div>
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={historyChartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="weekStart" tick={{ fontSize: 10, fill: '#64748b' }} />
                      <YAxis tick={{ fontSize: 10, fill: '#64748b' }} domain={['dataMin - 1', 'dataMax + 1']} />
                      <Tooltip
                        formatter={(value: number) => [`${value} kg`, 'Weight']}
                        contentStyle={{ backgroundColor: '#002142', borderRadius: '0.75rem', color: '#fff', border: 'none', fontSize: '11px', fontWeight: 'bold' }}
                        itemStyle={{ color: '#34d399' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="weightKg"
                        stroke="#059669"
                        strokeWidth={2.5}
                        dot={{ r: 4, fill: '#059669', strokeWidth: 2, stroke: '#fff' }}
                        activeDot={{ r: 6, fill: '#047857' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : null}

            {/* Evolution Log Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[500px] text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2.5">Measurement Week</th>
                    <th className="px-4 py-2.5">Weight (kg)</th>
                    <th className="px-4 py-2.5">Weekly Change</th>
                    <th className="px-4 py-2.5 text-right pr-6">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {historyPoints.map((point) => (
                    <tr key={point.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-2.5 font-bold text-slate-800">
                        {point.formattedDate}
                      </td>
                      <td className="px-4 py-2.5 font-black text-slate-900">
                        {point.weightKg} kg
                      </td>
                      <td className="px-4 py-2.5">
                        {point.deltaKg === null ? (
                          <span className="text-slate-400 font-semibold">— (Initial)</span>
                        ) : point.deltaKg === 0 ? (
                          <span className="text-slate-400 font-semibold">0.0 kg</span>
                        ) : point.deltaKg > 0 ? (
                          <span className="inline-flex items-center gap-1 font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                            <TrendingUp className="h-3.5 w-3.5" /> +{point.deltaKg} kg
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            <TrendingDown className="h-3.5 w-3.5" /> {point.deltaKg} kg
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right pr-6">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          Recorded
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
