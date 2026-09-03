import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Gauge,
  HeartPulse,
  Loader2,
  RefreshCw,
  Shield,
  TrendingUp,
  Users
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import type { Microcycle, SquadPlayer, TrainingSession } from '../types';
import { readAttendanceIdentityMappings } from '../utils/attendanceIdentityStore';
import { fetchRpeSheetRows } from '../services/fitness/rpeSheetService';
import { fetchWellnessReadings } from '../services/fitness/wellnessReadingsService';
import { listMicrocycles } from '../services/planning/microcycleService';
import type { RpeSheetRow } from '../utils/rpeSheetParsing';
import {
  ACUTE_WINDOW_DAYS,
  CHRONIC_WINDOW_DAYS,
  RPE_HIGH_MIN,
  RPE_LOW_MAX,
  buildIdentityDiagnostics,
  buildMicrocycleLoad,
  buildPlayerSummaries,
  buildPlayerTimeline,
  buildRpeEntries,
  buildRpeOverview,
  buildWeeklyLoad,
  buildWellnessRpeAnalysis,
  calculateAcuteChronicLoad,
  isValidDateKey,
  type RpeEntry,
  type WellnessReadingInput
} from '../utils/rpeAnalytics';

interface RpeSectionProps {
  squadPlayers: SquadPlayer[];
  trainingSessions: TrainingSession[];
}

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

const WELLNESS_BANDS = ['green', 'amber', 'red'] as const;
const RPE_BANDS = ['low', 'moderate', 'high'] as const;

const BAND_LABELS: Record<string, string> = {
  green: 'GREEN — Good',
  amber: 'AMBER — Attention',
  red: 'RED — Requires attention',
  low: `Low RPE (≤ ${RPE_LOW_MAX})`,
  moderate: `Moderate RPE (${RPE_LOW_MAX + 1}–${RPE_HIGH_MIN - 1})`,
  high: `High RPE (≥ ${RPE_HIGH_MIN})`
};

function formatNumber(value: number | null | undefined, suffix = ''): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${Math.round(value * 10) / 10}${suffix}`;
}

const StatCard: React.FC<{
  label: string;
  value: string;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: 'default' | 'gk' | 'outfield';
}> = ({ label, value, hint, icon: Icon, tone = 'default' }) => {
  const toneClass =
    tone === 'gk'
      ? 'border-amber-200 bg-amber-50'
      : tone === 'outfield'
        ? 'border-emerald-200 bg-emerald-50'
        : 'border-slate-200 bg-white';

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${toneClass}`}>
      <div className="flex items-center gap-2">
        {Icon ? <Icon className="h-3.5 w-3.5 text-slate-500" /> : null}
        <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</div>
      </div>
      <div className="mt-2 text-2xl font-black text-slate-900">{value}</div>
      {hint ? <div className="mt-1 text-[11px] font-semibold text-slate-500">{hint}</div> : null}
    </div>
  );
};

export const RpeSection: React.FC<RpeSectionProps> = ({ squadPlayers, trainingSessions }) => {
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [sheetRows, setSheetRows] = useState<RpeSheetRow[]>([]);
  const [wellnessReadings, setWellnessReadings] = useState<WellnessReadingInput[]>([]);
  const [microcycles, setMicrocycles] = useState<Microcycle[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('');
  const [reloadToken, setReloadToken] = useState(0);

  const identityMappings = useMemo(() => readAttendanceIdentityMappings(), []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    setLoadState('loading');
    setErrorMessage('');

    Promise.all([
      fetchRpeSheetRows(controller.signal),
      fetchWellnessReadings(controller.signal).catch(() => [] as WellnessReadingInput[]),
      listMicrocycles().catch(() => [] as Microcycle[])
    ])
      .then(([rows, readings, cycles]) => {
        if (!active) return;
        setSheetRows(rows);
        setWellnessReadings(readings);
        setMicrocycles(cycles);
        setLoadState('ready');
      })
      .catch((error) => {
        if (!active || controller.signal.aborted) return;
        setErrorMessage(error instanceof Error ? error.message : 'RPE data is temporarily unavailable.');
        setLoadState('error');
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [reloadToken]);

  const entries = useMemo<RpeEntry[]>(
    () =>
      buildRpeEntries({
        rows: sheetRows,
        squadPlayers,
        sessions: trainingSessions,
        microcycles,
        identityMappings
      }),
    [sheetRows, squadPlayers, trainingSessions, microcycles, identityMappings]
  );

  const overview = useMemo(() => buildRpeOverview(entries), [entries]);
  const weeklyLoad = useMemo(() => buildWeeklyLoad(entries), [entries]);
  const microcycleLoad = useMemo(() => buildMicrocycleLoad(entries), [entries]);
  const playerSummaries = useMemo(() => buildPlayerSummaries(entries), [entries]);
  const diagnostics = useMemo(() => buildIdentityDiagnostics(entries), [entries]);

  const wellnessAnalysis = useMemo(
    () => buildWellnessRpeAnalysis({ entries, wellnessReadings, squadPlayers, identityMappings }),
    [entries, wellnessReadings, squadPlayers, identityMappings]
  );

  const latestDate = useMemo(() => {
    const dates = entries.map((entry) => entry.dateKey).filter(isValidDateKey).sort();
    return dates.length ? dates[dates.length - 1] : '';
  }, [entries]);

  const teamAcuteChronic = useMemo(
    () => (latestDate ? calculateAcuteChronicLoad(entries, latestDate) : null),
    [entries, latestDate]
  );

  useEffect(() => {
    if (selectedPlayerId) return;
    if (playerSummaries.length > 0) setSelectedPlayerId(playerSummaries[0].playerId);
  }, [playerSummaries, selectedPlayerId]);

  const selectedTimeline = useMemo(
    () => (selectedPlayerId ? buildPlayerTimeline(entries, selectedPlayerId) : []),
    [entries, selectedPlayerId]
  );

  const selectedSummary = playerSummaries.find((summary) => summary.playerId === selectedPlayerId) || null;

  const selectedAcuteChronic = useMemo(() => {
    if (!selectedPlayerId || !latestDate) return null;
    return calculateAcuteChronicLoad(
      entries.filter((entry) => entry.playerId === selectedPlayerId),
      latestDate
    );
  }, [entries, selectedPlayerId, latestDate]);

  const selectedWeeklyLoad = useMemo(
    () => (selectedPlayerId ? buildWeeklyLoad(entries.filter((entry) => entry.playerId === selectedPlayerId)) : []),
    [entries, selectedPlayerId]
  );

  const discrepancies = useMemo(
    () => entries.filter((entry) => entry.hasDurationDiscrepancy || entry.matchesReportedVolume === false),
    [entries]
  );

  const unlinkedEntries = useMemo(() => entries.filter((entry) => entry.sessionLink !== 'linked'), [entries]);

  if (loadState === 'loading' || loadState === 'idle') {
    return (
      <div className="mt-4 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-6 text-sm font-bold text-slate-600">
        <Loader2 className="h-4 w-4 animate-spin text-[#002142]" />
        Loading RPE data from the Google Sheet…
      </div>
    );
  }

  if (loadState === 'error') {
    return (
      <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-5">
        <div className="flex items-center gap-2 text-sm font-black text-rose-900">
          <AlertTriangle className="h-4 w-4" />
          RPE data is temporarily unavailable
        </div>
        <p className="mt-2 text-xs font-semibold text-rose-800">{errorMessage}</p>
        <button
          type="button"
          onClick={() => setReloadToken((token) => token + 1)}
          className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#002142] px-3 py-2 text-xs font-black text-white"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="mt-5 space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Training Load</div>
          <h3 className="mt-1 text-lg font-black text-slate-900">Session RPE &amp; Load Monitoring</h3>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            Read-only import from the RPE sheet. Volume (UA) = RPE × Duration. Each record is linked to the training
            session of the same date.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setReloadToken((token) => token + 1)}
          className="inline-flex items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm hover:bg-slate-100"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Reload sheet
        </button>
      </div>

      {/* 1. Average RPE — GK vs Outfield */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-[#002142]" />
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">Average RPE</h4>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Outfield players"
            value={formatNumber(overview.outfield.averageRpe)}
            hint={`${overview.outfield.entryCount} records · ${overview.outfield.playerCount} players`}
            icon={Users}
            tone="outfield"
          />
          <StatCard
            label="Goalkeepers"
            value={formatNumber(overview.gk.averageRpe)}
            hint={`${overview.gk.entryCount} records · ${overview.gk.playerCount} players`}
            icon={Shield}
            tone="gk"
          />
          <StatCard
            label="Total load"
            value={formatNumber(overview.all.totalLoadUa, ' UA')}
            hint={`Outfield ${formatNumber(overview.outfield.totalLoadUa)} · GK ${formatNumber(overview.gk.totalLoadUa)}`}
            icon={BarChart3}
          />
          <StatCard
            label="Unassigned records"
            value={String(overview.unassigned.entryCount)}
            hint="Unresolved / ambiguous / external — excluded from both averages"
            icon={AlertTriangle}
          />
        </div>
      </section>

      {/* 2. Weekly load */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-[#002142]" />
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">Weekly load (UA)</h4>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          {weeklyLoad.length === 0 ? (
            <p className="text-xs font-semibold text-slate-500">No weekly load available.</p>
          ) : (
            <>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyLoad}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="weekStart" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="outfieldLoadUa" name="Outfield" stackId="load" fill="#10b981" />
                    <Bar dataKey="gkLoadUa" name="Goalkeepers" stackId="load" fill="#f59e0b" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[620px] text-left text-[11px] text-slate-700">
                  <thead className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="py-2">Week</th>
                      <th className="py-2">Total UA</th>
                      <th className="py-2">Outfield UA</th>
                      <th className="py-2">GK UA</th>
                      <th className="py-2">Avg RPE</th>
                      <th className="py-2">Records</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weeklyLoad.map((week) => (
                      <tr key={week.weekKey} className="border-t border-slate-100 font-semibold">
                        <td className="py-2">{week.weekStart} → {week.weekEnd}</td>
                        <td className="py-2 font-black text-slate-900">{formatNumber(week.totalLoadUa)}</td>
                        <td className="py-2">{formatNumber(week.outfieldLoadUa)}</td>
                        <td className="py-2">{formatNumber(week.gkLoadUa)}</td>
                        <td className="py-2">{formatNumber(week.averageRpe)}</td>
                        <td className="py-2">{week.entryCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </section>

      {/* 3. Microcycle load */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-[#002142]" />
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">Load by microcycle</h4>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <table className="w-full min-w-[720px] text-left text-[11px] text-slate-700">
            <thead className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              <tr>
                <th className="py-2">Microcycle</th>
                <th className="py-2">Dates</th>
                <th className="py-2">Total UA</th>
                <th className="py-2">Outfield UA</th>
                <th className="py-2">GK UA</th>
                <th className="py-2">Avg RPE</th>
                <th className="py-2">Records</th>
              </tr>
            </thead>
            <tbody>
              {microcycleLoad.map((row) => (
                <tr key={row.microcycleId || 'unassigned'} className="border-t border-slate-100 font-semibold">
                  <td className="py-2 font-black text-slate-900">{row.microcycleName}</td>
                  <td className="py-2">
                    {row.sessionDates.length ? `${row.sessionDates[0]} → ${row.sessionDates[row.sessionDates.length - 1]}` : '—'}
                  </td>
                  <td className="py-2 font-black text-slate-900">{formatNumber(row.totalLoadUa)}</td>
                  <td className="py-2">{formatNumber(row.outfieldLoadUa)}</td>
                  <td className="py-2">{formatNumber(row.gkLoadUa)}</td>
                  <td className="py-2">{formatNumber(row.averageRpe)}</td>
                  <td className="py-2">{row.entryCount}</td>
                </tr>
              ))}
              {microcycleLoad.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-3 text-xs font-semibold text-slate-500">
                    No microcycle load available.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {/* 4. Acute / chronic load */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-[#002142]" />
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">Acute &amp; chronic load</h4>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-semibold text-slate-500">
            Acute = sum of UA over the last {ACUTE_WINDOW_DAYS} days (inclusive). Chronic = sum of UA over the last{' '}
            {CHRONIC_WINDOW_DAYS} days divided by 4 (weekly equivalent). ACWR = acute ÷ chronic weekly. Rest days are not
            counted as zero-load sessions.
          </p>
          {teamAcuteChronic ? (
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label={`Acute (${ACUTE_WINDOW_DAYS}d)`}
                value={formatNumber(teamAcuteChronic.acuteLoadUa, ' UA')}
                hint={`${teamAcuteChronic.acuteEntryCount} records`}
              />
              <StatCard
                label={`Chronic (${CHRONIC_WINDOW_DAYS}d weekly eq.)`}
                value={formatNumber(teamAcuteChronic.chronicWeeklyLoadUa, ' UA')}
                hint={`${teamAcuteChronic.chronicEntryCount} records`}
              />
              <StatCard
                label="ACWR"
                value={teamAcuteChronic.acwr === null ? 'Insufficient data' : formatNumber(teamAcuteChronic.acwr)}
                hint={
                  teamAcuteChronic.status === 'insufficient-history'
                    ? `Only ${teamAcuteChronic.observedSpanDays} days of history (needs ${CHRONIC_WINDOW_DAYS})`
                    : teamAcuteChronic.status === 'no-chronic-load'
                      ? 'No load recorded in the chronic window'
                      : 'Squad-wide ratio'
                }
              />
              <StatCard label="Reference date" value={teamAcuteChronic.referenceDate} hint="Most recent RPE record" />
            </div>
          ) : (
            <p className="mt-3 text-xs font-semibold text-slate-500">No dated RPE records available.</p>
          )}
        </div>
      </section>

      {/* 5. Individual evolution */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-[#002142]" />
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">Individual evolution</h4>
          </div>
          <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
            <span>Player</span>
            <select
              value={selectedPlayerId}
              onChange={(event) => setSelectedPlayerId(event.target.value)}
              className="min-w-52 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#002142]/10"
            >
              {playerSummaries.map((summary) => (
                <option key={summary.playerId} value={summary.playerId}>
                  {summary.displayName} {summary.group === 'gk' ? '(GK)' : ''}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          {selectedSummary ? (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Average RPE" value={formatNumber(selectedSummary.averageRpe)} hint={`${selectedSummary.entryCount} sessions`} />
                <StatCard label="Total load" value={formatNumber(selectedSummary.totalLoadUa, ' UA')} />
                <StatCard label="Average load / session" value={formatNumber(selectedSummary.averageLoadUa, ' UA')} />
                <StatCard
                  label="ACWR"
                  value={selectedAcuteChronic?.acwr === null || !selectedAcuteChronic ? 'Insufficient data' : formatNumber(selectedAcuteChronic.acwr)}
                  hint={
                    selectedAcuteChronic
                      ? `Acute ${formatNumber(selectedAcuteChronic.acuteLoadUa)} · Chronic ${formatNumber(selectedAcuteChronic.chronicWeeklyLoadUa)}`
                      : undefined
                  }
                />
              </div>

              <div className="mt-4 h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={selectedTimeline}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="dateKey" tick={{ fontSize: 10 }} />
                    <YAxis yAxisId="rpe" domain={[0, 10]} tick={{ fontSize: 10 }} />
                    <YAxis yAxisId="load" orientation="right" tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Line yAxisId="rpe" type="monotone" dataKey="rpe" name="RPE" stroke="#002142" strokeWidth={2} dot />
                    <Line yAxisId="load" type="monotone" dataKey="loadUa" name="Load (UA)" stroke="#10b981" strokeWidth={2} dot />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-4 h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={selectedWeeklyLoad}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="weekStart" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Area type="monotone" dataKey="totalLoadUa" name="Weekly load (UA)" stroke="#0f5981" fill="#bae6fd" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[620px] text-left text-[11px] text-slate-700">
                  <thead className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="py-2">Date</th>
                      <th className="py-2">RPE</th>
                      <th className="py-2">Duration</th>
                      <th className="py-2">Load (UA)</th>
                      <th className="py-2">Microcycle</th>
                      <th className="py-2">Session</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedTimeline.map((point) => (
                      <tr key={`${point.dateKey}-${point.sessionId ?? 'none'}`} className="border-t border-slate-100 font-semibold">
                        <td className="py-2">{point.dateKey}</td>
                        <td className="py-2 font-black text-slate-900">{formatNumber(point.rpe)}</td>
                        <td className="py-2">{formatNumber(point.durationMinutes, ' min')}</td>
                        <td className="py-2">{formatNumber(point.loadUa)}</td>
                        <td className="py-2">{point.microcycleName || '—'}</td>
                        <td className="py-2">{point.sessionId ? 'Linked' : 'No session'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="text-xs font-semibold text-slate-500">No squad-matched player has RPE records yet.</p>
          )}
        </div>
      </section>

      {/* 6. Wellness x RPE */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <HeartPulse className="h-4 w-4 text-[#002142]" />
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">Wellness × RPE × Load</h4>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-semibold text-slate-500">
            Matched strictly by player and date. {wellnessAnalysis.points.length} paired records ·{' '}
            {wellnessAnalysis.unmatchedRpeEntries} RPE records without a same-day wellness entry.
          </p>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-[11px] text-slate-700">
              <thead className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="py-2">Wellness \ RPE</th>
                  {RPE_BANDS.map((band) => (
                    <th key={band} className="py-2">{BAND_LABELS[band]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {WELLNESS_BANDS.map((wellnessBand) => (
                  <tr key={wellnessBand} className="border-t border-slate-100 font-semibold">
                    <td className="py-2 font-black text-slate-900">{BAND_LABELS[wellnessBand]}</td>
                    {RPE_BANDS.map((rpeBand) => (
                      <td key={rpeBand} className="py-2">
                        {wellnessAnalysis.matrix[`${wellnessBand}:${rpeBand}`] || 0}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {wellnessAnalysis.points.length > 0 ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-[11px] text-slate-700">
                <thead className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="py-2">Date</th>
                    <th className="py-2">Player</th>
                    <th className="py-2">Readiness</th>
                    <th className="py-2">Wellness</th>
                    <th className="py-2">RPE</th>
                    <th className="py-2">Load (UA)</th>
                  </tr>
                </thead>
                <tbody>
                  {wellnessAnalysis.points.slice(0, 40).map((point) => (
                    <tr key={`${point.playerId}-${point.dateKey}`} className="border-t border-slate-100 font-semibold">
                      <td className="py-2">{point.dateKey}</td>
                      <td className="py-2">{point.displayName}</td>
                      <td className="py-2">{formatNumber(point.readiness)}</td>
                      <td className="py-2 uppercase">{point.wellnessBand || '—'}</td>
                      <td className="py-2 font-black text-slate-900">{point.rpe}</td>
                      <td className="py-2">{formatNumber(point.loadUa)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </section>

      {/* 7. Data quality */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-[#002142]" />
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">Data quality</h4>
        </div>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Player identity</div>
            <div className="mt-2 grid grid-cols-4 gap-2 text-center">
              {[
                ['Matched', diagnostics.matched.length],
                ['Unresolved', diagnostics.unresolved.length],
                ['Ambiguous', diagnostics.ambiguous.length],
                ['External', diagnostics.external.length]
              ].map(([label, count]) => (
                <div key={String(label)} className="rounded-xl border border-slate-200 bg-slate-50 p-2">
                  <div className="text-lg font-black text-slate-900">{count}</div>
                  <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">{label}</div>
                </div>
              ))}
            </div>
            {diagnostics.unresolved.length > 0 || diagnostics.ambiguous.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] font-bold text-slate-600">
                {[...diagnostics.unresolved, ...diagnostics.ambiguous].map((identity) => (
                  <span key={identity.sheetName} className="rounded-full border border-slate-200 bg-white px-2 py-1">
                    {identity.sheetName}
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Session linking</div>
            <p className="mt-2 text-xs font-semibold text-slate-600">
              {entries.length - unlinkedEntries.length} of {entries.length} records are linked to a training session.
            </p>
            <p className="mt-2 text-xs font-semibold text-slate-600">
              {discrepancies.length} records disagree with the session duration (&gt; 10 min) or with the sheet Volume (UA).
            </p>
            {discrepancies.length > 0 ? (
              <div className="mt-3 max-h-40 overflow-y-auto text-[10px] font-semibold text-slate-600">
                {discrepancies.slice(0, 30).map((entry) => (
                  <div key={entry.rowId} className="border-t border-slate-100 py-1">
                    {entry.dateKey} · {entry.displayName} · sheet {formatNumber(entry.durationMinutes, ' min')} vs session{' '}
                    {formatNumber(entry.sessionDurationMinutes, ' min')}
                    {entry.matchesReportedVolume === false ? ' · volume mismatch' : ''}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
};
