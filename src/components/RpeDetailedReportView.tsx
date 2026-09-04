import React from 'react';
import { createPortal } from 'react-dom';
import { Printer, X } from 'lucide-react';
import {
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
import { ACUTE_WINDOW_DAYS, CHRONIC_WINDOW_DAYS, type AcuteChronicLoad, type WellnessBand } from '../utils/rpeAnalytics';
import type { RpeDetailedReport, RpePlayerReport } from '../utils/rpeReport';

interface RpeDetailedReportViewProps {
  report: RpeDetailedReport;
  wellnessBands: readonly WellnessBand[];
  rpeBands: readonly string[];
  bandLabels: Record<string, string>;
  renderWellnessDot: (band: WellnessBand | null) => React.ReactNode;
  onClose: () => void;
  onPrint: () => void;
}

function formatNumber(value: number | null | undefined, suffix = ''): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${Math.round(value * 10) / 10}${suffix}`;
}

function describeAcwr(result: AcuteChronicLoad | null): string {
  if (!result) return '—';
  if (result.acwr !== null) return formatNumber(result.acwr);
  if (result.status === 'insufficient-history') return `Insufficient history (${result.observedSpanDays}d)`;
  return 'No chronic load';
}

const ReportSection: React.FC<{ title: string; subtitle?: string; children: React.ReactNode }> = ({
  title,
  subtitle,
  children
}) => (
  <section className="rpe-report-block mt-6 first:mt-0">
    <h2 className="border-b border-slate-300 pb-1 text-sm font-black uppercase tracking-wider text-slate-900">{title}</h2>
    {subtitle ? <p className="mt-1 text-[11px] font-semibold text-slate-500">{subtitle}</p> : null}
    <div className="mt-3">{children}</div>
  </section>
);

const SummaryTile: React.FC<{ label: string; value: string; hint?: string }> = ({ label, value, hint }) => (
  <div className="rounded-lg border border-slate-300 bg-white px-3 py-2">
    <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">{label}</div>
    <div className="mt-0.5 text-base font-black text-slate-900">{value}</div>
    {hint ? <div className="text-[10px] font-semibold text-slate-500">{hint}</div> : null}
  </div>
);

const PlayerCard: React.FC<{ player: RpePlayerReport }> = ({ player }) => (
  <div className="rpe-report-block mt-3 rounded-lg border border-slate-300 bg-white p-3">
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200 pb-2">
      <div className="text-sm font-black text-slate-900">
        {player.summary.displayName}
        <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          {player.position || 'No position'}
        </span>
      </div>
      <div className="text-[10px] font-bold text-slate-500">
        {player.summary.firstDate} → {player.summary.lastDate}
      </div>
    </div>

    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
      <SummaryTile label="Records" value={String(player.summary.entryCount)} />
      <SummaryTile label="Avg RPE" value={formatNumber(player.summary.averageRpe)} />
      <SummaryTile label="Total load" value={formatNumber(player.summary.totalLoadUa, ' UA')} />
      <SummaryTile label="Avg load / session" value={formatNumber(player.summary.averageLoadUa, ' UA')} />
      <SummaryTile
        label="ACWR"
        value={describeAcwr(player.acuteChronic)}
        hint={
          player.acuteChronic
            ? `Acute ${formatNumber(player.acuteChronic.acuteLoadUa)} · Chronic ${formatNumber(player.acuteChronic.chronicWeeklyLoadUa)}`
            : undefined
        }
      />
    </div>

    <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
      <div>
        <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">RPE &amp; load per session</div>
        <table className="mt-1 w-full text-left text-[10px] text-slate-700">
          <thead className="text-[9px] font-black uppercase tracking-wider text-slate-400">
            <tr>
              <th className="py-1">Date</th>
              <th className="py-1">RPE</th>
              <th className="py-1">Duration</th>
              <th className="py-1">Load (UA)</th>
              <th className="py-1">Microcycle</th>
            </tr>
          </thead>
          <tbody>
            {player.timeline.map((point) => (
              <tr key={`${point.dateKey}-${point.sessionId ?? 'none'}`} className="border-t border-slate-100 font-semibold">
                <td className="py-1">{point.dateKey}</td>
                <td className="py-1 font-black text-slate-900">{formatNumber(point.rpe)}</td>
                <td className="py-1">{formatNumber(point.durationMinutes, ' min')}</td>
                <td className="py-1">{formatNumber(point.loadUa)}</td>
                <td className="py-1">{point.microcycleName || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">Weekly load</div>
        <table className="mt-1 w-full text-left text-[10px] text-slate-700">
          <thead className="text-[9px] font-black uppercase tracking-wider text-slate-400">
            <tr>
              <th className="py-1">Week</th>
              <th className="py-1">Load (UA)</th>
              <th className="py-1">Avg RPE</th>
              <th className="py-1">Records</th>
            </tr>
          </thead>
          <tbody>
            {player.weekly.map((week) => (
              <tr key={week.weekKey} className="border-t border-slate-100 font-semibold">
                <td className="py-1">{week.weekStart} → {week.weekEnd}</td>
                <td className="py-1 font-black text-slate-900">{formatNumber(week.totalLoadUa)}</td>
                <td className="py-1">{formatNumber(week.averageRpe)}</td>
                <td className="py-1">{week.entryCount}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-2 text-[9px] font-black uppercase tracking-wider text-slate-400">Microcycle load</div>
        <table className="mt-1 w-full text-left text-[10px] text-slate-700">
          <thead className="text-[9px] font-black uppercase tracking-wider text-slate-400">
            <tr>
              <th className="py-1">Microcycle</th>
              <th className="py-1">Load (UA)</th>
              <th className="py-1">Avg RPE</th>
              <th className="py-1">Records</th>
            </tr>
          </thead>
          <tbody>
            {player.microcycles.map((cycle) => (
              <tr key={cycle.microcycleId || 'unassigned'} className="border-t border-slate-100 font-semibold">
                <td className="py-1">{cycle.microcycleName}</td>
                <td className="py-1 font-black text-slate-900">{formatNumber(cycle.totalLoadUa)}</td>
                <td className="py-1">{formatNumber(cycle.averageRpe)}</td>
                <td className="py-1">{cycle.entryCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);

export const RpeDetailedReportView: React.FC<RpeDetailedReportViewProps> = ({
  report,
  wellnessBands,
  rpeBands,
  bandLabels,
  renderWellnessDot,
  onClose,
  onPrint
}) => {
  const { period, overview, acuteChronic, dataQuality } = report;
  const periodLabel = period.startDate && period.endDate ? `${period.startDate} → ${period.endDate}` : 'No dated records';

  return createPortal(
    <div className="rpe-report-overlay fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 p-2 sm:p-6">
      <div className="rpe-report-print-shell mx-auto w-full max-w-5xl rounded-2xl bg-white p-5 shadow-2xl sm:p-8">
        <div className="rpe-report-controls flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Report preview</div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onPrint}
              className="inline-flex items-center gap-2 rounded-xl bg-[#002142] px-3 py-2 text-xs font-black text-white"
            >
              <Printer className="h-3.5 w-3.5" />
              Print / Save as PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-100"
            >
              <X className="h-3.5 w-3.5" />
              Close
            </button>
          </div>
        </div>

        <header className="rpe-report-block mt-4 border-b-2 border-[#002142] pb-3">
          <h1 className="text-xl font-black uppercase tracking-tight text-[#002142]">Training Load — RPE Detailed Report</h1>
          <p className="mt-1 text-xs font-bold text-slate-600">
            Period: {periodLabel} · {period.dateCount} session days
          </p>
        </header>

        {/* 1. Executive summary */}
        <ReportSection
          title="1. Executive summary"
          subtitle="Volume (UA) = RPE × Duration. Goalkeepers and outfield players are averaged separately."
        >
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            <SummaryTile label="Session days" value={String(period.dateCount)} />
            <SummaryTile label="Linked sessions" value={String(report.linkedSessionCount)} />
            <SummaryTile label="RPE records" value={String(report.recordCount)} />
            <SummaryTile label="Total load" value={formatNumber(overview.all.totalLoadUa, ' UA')} />
            <SummaryTile label="Avg RPE (all)" value={formatNumber(overview.all.averageRpe)} />
            <SummaryTile
              label="Avg RPE outfield"
              value={formatNumber(overview.outfield.averageRpe)}
              hint={`${overview.outfield.playerCount} players`}
            />
            <SummaryTile
              label="Avg RPE GK"
              value={formatNumber(overview.gk.averageRpe)}
              hint={`${overview.gk.playerCount} players`}
            />
          </div>
        </ReportSection>

        {/* 2. Load */}
        <ReportSection
          title="2. Load"
          subtitle={`Acute = sum of UA over the last ${ACUTE_WINDOW_DAYS} days. Chronic = sum of UA over the last ${CHRONIC_WINDOW_DAYS} days ÷ 4 (weekly equivalent). ACWR = acute ÷ chronic weekly.`}
        >
          {acuteChronic ? (
            <table className="w-full text-left text-[11px] text-slate-700">
              <thead className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="py-1">Group</th>
                  <th className="py-1">Acute ({ACUTE_WINDOW_DAYS}d)</th>
                  <th className="py-1">Chronic ({CHRONIC_WINDOW_DAYS}d weekly eq.)</th>
                  <th className="py-1">ACWR</th>
                  <th className="py-1">Records (acute / chronic)</th>
                </tr>
              </thead>
              <tbody>
                {([
                  ['All players', acuteChronic.all],
                  ['Outfield', acuteChronic.outfield],
                  ['Goalkeepers', acuteChronic.gk]
                ] as const).map(([label, value]) => (
                  <tr key={label} className="border-t border-slate-100 font-semibold">
                    <td className="py-1 font-black text-slate-900">{label}</td>
                    <td className="py-1">{formatNumber(value.acuteLoadUa)}</td>
                    <td className="py-1">{formatNumber(value.chronicWeeklyLoadUa)}</td>
                    <td className="py-1 font-black text-slate-900">{describeAcwr(value)}</td>
                    <td className="py-1">{value.acuteEntryCount} / {value.chronicEntryCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-[11px] font-semibold text-slate-500">No dated records available.</p>
          )}

          <div className="rpe-report-block mt-4">
            <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">Weekly load</div>
            <table className="mt-1 w-full text-left text-[11px] text-slate-700">
              <thead className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="py-1">Week</th>
                  <th className="py-1">Total UA</th>
                  <th className="py-1">Outfield UA</th>
                  <th className="py-1">GK UA</th>
                  <th className="py-1">Avg RPE</th>
                  <th className="py-1">Records</th>
                </tr>
              </thead>
              <tbody>
                {report.weekly.map((week) => (
                  <tr key={week.weekKey} className="border-t border-slate-100 font-semibold">
                    <td className="py-1">{week.weekStart} → {week.weekEnd}</td>
                    <td className="py-1 font-black text-slate-900">{formatNumber(week.totalLoadUa)}</td>
                    <td className="py-1">{formatNumber(week.outfieldLoadUa)}</td>
                    <td className="py-1">{formatNumber(week.gkLoadUa)}</td>
                    <td className="py-1">{formatNumber(week.averageRpe)}</td>
                    <td className="py-1">{week.entryCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rpe-report-block mt-4">
            <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">Microcycle load</div>
            <table className="mt-1 w-full text-left text-[11px] text-slate-700">
              <thead className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="py-1">Microcycle</th>
                  <th className="py-1">Dates</th>
                  <th className="py-1">Total UA</th>
                  <th className="py-1">Outfield UA</th>
                  <th className="py-1">GK UA</th>
                  <th className="py-1">Avg RPE</th>
                  <th className="py-1">Records</th>
                </tr>
              </thead>
              <tbody>
                {report.microcycles.map((cycle) => (
                  <tr key={cycle.microcycleId || 'unassigned'} className="border-t border-slate-100 font-semibold">
                    <td className="py-1 font-black text-slate-900">{cycle.microcycleName}</td>
                    <td className="py-1">
                      {cycle.sessionDates.length
                        ? `${cycle.sessionDates[0]} → ${cycle.sessionDates[cycle.sessionDates.length - 1]}`
                        : '—'}
                    </td>
                    <td className="py-1 font-black text-slate-900">{formatNumber(cycle.totalLoadUa)}</td>
                    <td className="py-1">{formatNumber(cycle.outfieldLoadUa)}</td>
                    <td className="py-1">{formatNumber(cycle.gkLoadUa)}</td>
                    <td className="py-1">{formatNumber(cycle.averageRpe)}</td>
                    <td className="py-1">{cycle.entryCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ReportSection>

        {/* 3. Evolution */}
        <ReportSection title="3. Evolution" subtitle="Rolling acute / chronic values recomputed at every session date.">
          {report.evolution.length > 0 ? (
            <>
              <div className="rpe-report-chart h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={report.evolution}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="dateKey" tick={{ fontSize: 9 }} />
                    <YAxis tick={{ fontSize: 9 }} />
                    <Tooltip />
                    <Bar dataKey="loadUa" name="Daily load (UA)" fill="#0f5981" isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="rpe-report-chart mt-3 h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={report.evolution}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="dateKey" tick={{ fontSize: 9 }} />
                    <YAxis yAxisId="load" tick={{ fontSize: 9 }} />
                    <YAxis yAxisId="rpe" orientation="right" domain={[0, 10]} tick={{ fontSize: 9 }} />
                    <Tooltip />
                    <Line
                      yAxisId="load"
                      type="monotone"
                      dataKey="acuteLoadUa"
                      name={`Acute (${ACUTE_WINDOW_DAYS}d)`}
                      stroke="#e11d48"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                    <Line
                      yAxisId="load"
                      type="monotone"
                      dataKey="chronicWeeklyLoadUa"
                      name={`Chronic (${CHRONIC_WINDOW_DAYS}d weekly eq.)`}
                      stroke="#0ea5e9"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                    <Line
                      yAxisId="rpe"
                      type="monotone"
                      dataKey="averageRpe"
                      name="Avg RPE"
                      stroke="#002142"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <table className="mt-3 w-full text-left text-[11px] text-slate-700">
                <thead className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="py-1">Date</th>
                    <th className="py-1">Avg RPE</th>
                    <th className="py-1">Daily load (UA)</th>
                    <th className="py-1">Acute (UA)</th>
                    <th className="py-1">Chronic weekly (UA)</th>
                    <th className="py-1">ACWR</th>
                  </tr>
                </thead>
                <tbody>
                  {report.evolution.map((point) => (
                    <tr key={point.dateKey} className="border-t border-slate-100 font-semibold">
                      <td className="py-1">{point.dateKey}</td>
                      <td className="py-1">{formatNumber(point.averageRpe)}</td>
                      <td className="py-1 font-black text-slate-900">{formatNumber(point.loadUa)}</td>
                      <td className="py-1">{formatNumber(point.acuteLoadUa)}</td>
                      <td className="py-1">{formatNumber(point.chronicWeeklyLoadUa)}</td>
                      <td className="py-1">
                        {point.acwr !== null
                          ? formatNumber(point.acwr)
                          : point.acwrStatus === 'insufficient-history'
                            ? 'Insufficient history'
                            : 'No chronic load'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <p className="text-[11px] font-semibold text-slate-500">Not enough dated records to build an evolution.</p>
          )}
        </ReportSection>

        {/* 4. Individual analysis */}
        <ReportSection
          title="4. Individual analysis — Outfield"
          subtitle={`${report.outfieldPlayers.length} squad-matched outfield players.`}
        >
          {report.outfieldPlayers.length === 0 ? (
            <p className="text-[11px] font-semibold text-slate-500">No outfield player records.</p>
          ) : (
            report.outfieldPlayers.map((player) => <PlayerCard key={player.summary.playerId} player={player} />)
          )}
        </ReportSection>

        <ReportSection
          title="5. Individual analysis — Goalkeepers"
          subtitle={`${report.gkPlayers.length} squad-matched goalkeepers.`}
        >
          {report.gkPlayers.length === 0 ? (
            <p className="text-[11px] font-semibold text-slate-500">No goalkeeper records.</p>
          ) : (
            report.gkPlayers.map((player) => <PlayerCard key={player.summary.playerId} player={player} />)
          )}
        </ReportSection>

        {/* 6. Wellness x RPE */}
        <ReportSection
          title="6. Wellness × RPE"
          subtitle={`${report.wellness.points.length} paired records (same player, same date). ${report.wellness.unmatchedRpeEntries} RPE records without a same-day wellness entry.`}
        >
          <table className="w-full text-left text-[11px] text-slate-700">
            <thead className="text-[9px] font-black uppercase tracking-wider text-slate-400">
              <tr>
                <th className="py-1">Wellness \ RPE</th>
                {rpeBands.map((band) => (
                  <th key={band} className="py-1">{bandLabels[band]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {wellnessBands.map((band) => (
                <tr key={band} className="border-t border-slate-100 font-semibold">
                  <td className="py-1 font-black text-slate-900">
                    <span className="inline-flex items-center gap-2">
                      {renderWellnessDot(band)}
                      {bandLabels[band]}
                    </span>
                  </td>
                  {rpeBands.map((rpeBand) => (
                    <td key={rpeBand} className="py-1">{report.wellness.matrix[`${band}:${rpeBand}`] || 0}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          {report.wellness.points.length > 0 ? (
            <table className="mt-3 w-full text-left text-[11px] text-slate-700">
              <thead className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="py-1">Date</th>
                  <th className="py-1">Player</th>
                  <th className="py-1">Readiness</th>
                  <th className="py-1">Wellness</th>
                  <th className="py-1">RPE</th>
                  <th className="py-1">Load (UA)</th>
                </tr>
              </thead>
              <tbody>
                {report.wellness.points.map((point) => (
                  <tr key={`${point.playerId}-${point.dateKey}`} className="border-t border-slate-100 font-semibold">
                    <td className="py-1">{point.dateKey}</td>
                    <td className="py-1">{point.displayName}</td>
                    <td className="py-1">{formatNumber(point.readiness)}</td>
                    <td className="py-1">{renderWellnessDot(point.wellnessBand)}</td>
                    <td className="py-1 font-black text-slate-900">{point.rpe}</td>
                    <td className="py-1">{formatNumber(point.loadUa)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </ReportSection>

        {/* 7. Data quality */}
        <ReportSection title="7. Data quality" subtitle="Reported as-is; no record is hidden or corrected.">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <SummaryTile label="Total records" value={String(dataQuality.totalRecords)} />
            <SummaryTile label="Linked to a session" value={String(dataQuality.linkedToSession)} />
            <SummaryTile label="Without session" value={String(dataQuality.withoutSession)} />
            <SummaryTile label="Multiple session candidates" value={String(dataQuality.multipleSessionCandidates)} />
            <SummaryTile label="Without valid load" value={String(dataQuality.withoutValidLoad)} />
            <SummaryTile label="Duration discrepancies" value={String(dataQuality.durationDiscrepancies)} />
            <SummaryTile label="Sheet volume mismatches" value={String(dataQuality.volumeMismatches)} />
            <SummaryTile label="Without wellness match" value={String(dataQuality.withoutWellnessMatch)} />
          </div>

          <div className="rpe-report-block mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <SummaryTile label="Matched names" value={String(dataQuality.identity.matched.length)} />
            <SummaryTile label="Unresolved names" value={String(dataQuality.identity.unresolved.length)} />
            <SummaryTile label="Ambiguous names" value={String(dataQuality.identity.ambiguous.length)} />
            <SummaryTile label="External names" value={String(dataQuality.identity.external.length)} />
          </div>

          <p className="mt-2 text-[11px] font-semibold text-slate-600">
            {dataQuality.unassignedRecords} records belong to unresolved, ambiguous or external names. They are listed
            here but excluded from every squad calculation above.
          </p>

          {dataQuality.identity.unresolved.length > 0 ||
          dataQuality.identity.ambiguous.length > 0 ||
          dataQuality.identity.external.length > 0 ? (
            <table className="mt-2 w-full text-left text-[11px] text-slate-700">
              <thead className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="py-1">Sheet name</th>
                  <th className="py-1">Status</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ...dataQuality.identity.unresolved,
                  ...dataQuality.identity.ambiguous,
                  ...dataQuality.identity.external
                ].map((identity) => (
                  <tr key={identity.sheetName} className="border-t border-slate-100 font-semibold">
                    <td className="py-1">{identity.sheetName}</td>
                    <td className="py-1 uppercase">{identity.kind}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </ReportSection>
      </div>
    </div>,
    document.body
  );
};
