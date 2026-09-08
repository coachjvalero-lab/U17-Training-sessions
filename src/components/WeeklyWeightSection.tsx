import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Check, Loader2, Scale, TrendingDown, TrendingUp } from 'lucide-react';
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
import { addDaysToDateKey, getIsoWeekStart } from '../utils/rpeAnalytics';
import { saveWeeklyWeight, subscribeToWeeklyWeights } from '../services/fitness/weeklyWeightService';

interface WeeklyWeightSectionProps {
  squadPlayers: SquadPlayer[];
}

type RowStatus = 'idle' | 'saving' | 'saved' | 'error';

function todayDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDateLabel(dateKey: string): string {
  if (!dateKey) return '—';
  const parsed = new Date(`${dateKey}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateKey;
  return parsed.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function comparePlayers(a: SquadPlayer, b: SquadPlayer): number {
  const numA = Number(a.number);
  const numB = Number(b.number);
  if (Number.isFinite(numA) && Number.isFinite(numB) && numA !== numB) return numA - numB;
  return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
}

export const WeeklyWeightSection: React.FC<WeeklyWeightSectionProps> = ({ squadPlayers }) => {
  const currentWeekStart = useMemo(() => getIsoWeekStart(todayDateKey()), []);
  const currentWeekEnd = useMemo(() => addDaysToDateKey(currentWeekStart, 6), [currentWeekStart]);

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

  const orderedPlayers = useMemo(() => [...squadPlayers].sort(comparePlayers), [squadPlayers]);

  const weightsByPlayer = useMemo(() => {
    const map = new Map<string, PlayerWeeklyWeight[]>();
    for (const entry of weights) {
      const list = map.get(entry.playerId) ?? [];
      list.push(entry);
      map.set(entry.playerId, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.weekStartDate.localeCompare(b.weekStartDate));
    }
    return map;
  }, [weights]);

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

  const getPreviousWeight = (playerId: string): PlayerWeeklyWeight | undefined => {
    const list = weightsByPlayer.get(playerId);
    if (!list) return undefined;
    return [...list].reverse().find((entry) => entry.weekStartDate < currentWeekStart);
  };

  const commitRow = async (playerId: string, rawValue: string) => {
    const trimmed = rawValue.trim();
    if (!trimmed) return;
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setRowStatus((previous) => ({ ...previous, [playerId]: 'error' }));
      setRowError((previous) => ({ ...previous, [playerId]: 'Enter a valid weight in kg.' }));
      return;
    }

    const existing = weightsByPlayer.get(playerId)?.find((entry) => entry.weekStartDate === currentWeekStart);
    if (existing && existing.weightKg === parsed) return;

    setRowStatus((previous) => ({ ...previous, [playerId]: 'saving' }));
    setRowError((previous) => ({ ...previous, [playerId]: '' }));

    try {
      await saveWeeklyWeight({ playerId, weekStartDate: currentWeekStart, weightKg: parsed });
      setRowStatus((previous) => ({ ...previous, [playerId]: 'saved' }));
    } catch (error) {
      setRowStatus((previous) => ({ ...previous, [playerId]: 'error' }));
      setRowError((previous) => ({
        ...previous,
        [playerId]: error instanceof Error ? error.message : 'Could not save this weight.'
      }));
    }
  };

  const focusNextInput = (playerId: string) => {
    const index = orderedPlayers.findIndex((player) => player.id === playerId);
    const next = orderedPlayers[index + 1];
    if (next) inputRefs.current[next.id]?.focus();
  };

  const historyEntries = historyPlayerId ? weightsByPlayer.get(historyPlayerId) ?? [] : [];
  const historyChartData = historyEntries.map((entry) => ({
    weekStart: formatDateLabel(entry.weekStartDate),
    weightKg: entry.weightKg
  }));

  const savedThisWeekCount = orderedPlayers.filter((player) =>
    weightsByPlayer.get(player.id)?.some((entry) => entry.weekStartDate === currentWeekStart)
  ).length;

  return (
    <div className="mt-4 space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-slate-400">
              <Scale className="h-3.5 w-3.5" />
              Weekly Weight
            </div>
            <h3 className="mt-1 text-lg font-black text-slate-900">
              Weekly Weight — {formatDateLabel(currentWeekStart)}
            </h3>
            <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
              <CalendarDays className="h-3.5 w-3.5" />
              Week of {formatDateLabel(currentWeekStart)} → {formatDateLabel(currentWeekEnd)} · detected automatically
            </p>
          </div>
          <span className="text-[10px] font-extrabold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-200">
            {savedThisWeekCount}/{orderedPlayers.length} recorded this week
          </span>
        </div>
      </div>

      {loadError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-900">
          {loadError}
        </div>
      ) : null}

      <div className="w-full rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] table-fixed border-collapse text-left text-[12px] text-slate-700">
            <colgroup>
              <col className="w-[8%]" />
              <col className="w-[34%]" />
              <col className="w-[16%]" />
              <col className="w-[20%]" />
              <col className="w-[22%]" />
            </colgroup>
            <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
              <tr>
                <th className="px-3 py-3">#</th>
                <th className="px-3 py-3">Player</th>
                <th className="px-3 py-3">Previous</th>
                <th className="px-3 py-3">This week (kg)</th>
                <th className="px-3 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {orderedPlayers.map((player) => {
                const previous = getPreviousWeight(player.id);
                const status = rowStatus[player.id] ?? 'idle';
                const error = rowError[player.id];
                return (
                  <tr key={player.id} className="border-t border-slate-200">
                    <td className="px-3 py-2.5 align-top font-black text-slate-400">
                      {player.number !== undefined && player.number !== null ? `#${player.number}` : '—'}
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <div className="font-black text-slate-900">{player.firstName} {player.lastName}</div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{player.position}</div>
                    </td>
                    <td className="px-3 py-2.5 align-top font-semibold text-slate-600">
                      {previous ? `${previous.weightKg} kg` : '—'}
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <input
                        ref={(el) => { inputRefs.current[player.id] = el; }}
                        type="number"
                        step="0.1"
                        min="0"
                        inputMode="decimal"
                        value={drafts[player.id] ?? ''}
                        placeholder="—"
                        onChange={(event) => setDrafts((previousDrafts) => ({ ...previousDrafts, [player.id]: event.target.value }))}
                        onBlur={(event) => void commitRow(player.id, event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            void commitRow(player.id, (event.target as HTMLInputElement).value);
                            focusNextInput(player.id);
                          }
                        }}
                        className="w-28 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-[#002142] focus:bg-white"
                      />
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      {status === 'saving' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving
                        </span>
                      ) : status === 'saved' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-emerald-700">
                          <Check className="h-3.5 w-3.5" /> Saved
                        </span>
                      ) : status === 'error' ? (
                        <span className="text-[10px] font-black uppercase tracking-wider text-rose-700">{error || 'Error'}</span>
                      ) : (
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 mb-4">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">Weight history</h4>
          <select
            value={historyPlayerId}
            onChange={(event) => setHistoryPlayerId(event.target.value)}
            className="min-w-56 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#002142]/10"
          >
            <option value="">Select a player…</option>
            {orderedPlayers.map((player) => (
              <option key={player.id} value={player.id}>{player.firstName} {player.lastName}</option>
            ))}
          </select>
        </div>

        {!historyPlayerId ? (
          <p className="text-xs font-semibold text-slate-500">Select a player to see their weekly weight history.</p>
        ) : historyEntries.length === 0 ? (
          <p className="text-xs font-semibold text-slate-500">No weight history recorded yet for this player.</p>
        ) : (
          <div className="space-y-4">
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={historyChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="weekStart" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} domain={['dataMin - 2', 'dataMax + 2']} />
                  <Tooltip formatter={(value: number) => [`${value} kg`, 'Weight']} />
                  <Line type="monotone" dataKey="weightKg" stroke="#002142" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-left text-[11px] text-slate-700">
                <thead className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="py-2">Week</th>
                    <th className="py-2">Weight</th>
                    <th className="py-2">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {[...historyEntries].reverse().map((entry, index, array) => {
                    const nextOlder = array[index + 1];
                    const delta = nextOlder ? Math.round((entry.weightKg - nextOlder.weightKg) * 10) / 10 : null;
                    return (
                      <tr key={entry.id} className="border-t border-slate-100 font-semibold">
                        <td className="py-2">{formatDateLabel(entry.weekStartDate)}</td>
                        <td className="py-2 font-black text-slate-900">{entry.weightKg} kg</td>
                        <td className="py-2">
                          {delta === null || delta === 0 ? (
                            <span className="text-slate-400">—</span>
                          ) : delta > 0 ? (
                            <span className="inline-flex items-center gap-1 text-rose-700"><TrendingUp className="h-3.5 w-3.5" />+{delta} kg</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-emerald-700"><TrendingDown className="h-3.5 w-3.5" />{delta} kg</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
