import React, { useEffect, useMemo, useState } from 'react';
import { Activity, CalendarDays, ChevronLeft, ChevronRight, CircleDot, Droplets, RotateCcw, ShieldAlert } from 'lucide-react';
import {
  buildMenstrualCalendarModel,
  getLocalMonthKey,
  shiftMonthKey,
  type MenstrualCalendarCell,
  type MenstrualCalendarModel,
  type MenstrualCalendarPhaseDistribution,
  type MenstrualWellnessRow
} from '../utils/menstrualCalendar';
import type { WellnessPlayerResolution } from '../utils/wellnessMatching';
import type { Injury, PhysioComplaint } from '../types';
import { useTeamContext } from '../contexts/TeamContext';
import { subscribeToInjuries } from '../services/physio/injuriesService';
import { subscribeToPhysioComplaints } from '../services/physio/physioComplaintsService';

type MenstrualCycleSectionProps = {
  wellnessSnapshot: {
    rows: MenstrualWellnessRow[];
    resolutions: WellnessPlayerResolution[];
    availableDates: string[];
  } | null;
};

const PHASE_STYLES: Record<string, string> = {
  Follicular: 'bg-cyan-100 text-cyan-950 border-cyan-300',
  Ovulatory: 'bg-fuchsia-100 text-fuchsia-950 border-fuchsia-300',
  Luteal: 'bg-indigo-100 text-indigo-950 border-indigo-300',
  Unknown: 'bg-stone-100 text-stone-900 border-stone-300'
};

export const MenstrualCycleSection: React.FC<MenstrualCycleSectionProps> = ({ wellnessSnapshot }) => {
  const { selectedTeamId } = useTeamContext();
  const [injuries, setInjuries] = useState<Injury[]>([]);
  const [complaints, setComplaints] = useState<PhysioComplaint[]>([]);
  const [clinicalLoadWarning, setClinicalLoadWarning] = useState('');
  const initialMonthKey = useMemo(() => {
    const latestDate = wellnessSnapshot?.availableDates?.[0];
    return latestDate ? latestDate.slice(0, 7) : getLocalMonthKey();
  }, [wellnessSnapshot]);

  const [selectedMonthKey, setSelectedMonthKey] = useState(initialMonthKey);
  const model = useMemo<MenstrualCalendarModel>(() => buildMenstrualCalendarModel({
    rows: wellnessSnapshot?.rows || [],
    resolutions: wellnessSnapshot?.resolutions || []
  }, selectedMonthKey, { injuries, complaints }), [complaints, injuries, selectedMonthKey, wellnessSnapshot]);
  const [selectedIdentityKey, setSelectedIdentityKey] = useState('');

  useEffect(() => {
    if (!selectedTeamId) {
      setInjuries([]);
      setComplaints([]);
      return;
    }

    setClinicalLoadWarning('');
    const stopInjuries = subscribeToInjuries(
      selectedTeamId,
      setInjuries,
      () => setClinicalLoadWarning('Clinical injury data could not be loaded for this team.')
    );
    const stopComplaints = subscribeToPhysioComplaints(
      selectedTeamId,
      setComplaints,
      () => setClinicalLoadWarning('Clinical complaint data could not be loaded for this team.')
    );

    return () => {
      stopInjuries();
      stopComplaints();
    };
  }, [selectedTeamId]);

  useEffect(() => {
    setSelectedMonthKey(initialMonthKey);
  }, [initialMonthKey]);

  useEffect(() => {
    if (model.players.length === 0) {
      setSelectedIdentityKey('');
      return;
    }

    setSelectedIdentityKey((current) => (
      current && model.players.some((player) => player.identityKey === current)
        ? current
        : model.players[0].identityKey
    ));
  }, [model]);

  const selectedPlayer = model.players.find((player) => player.identityKey === selectedIdentityKey) || null;
  const monthLabel = formatMonthLabel(model.monthKey);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              <CalendarDays className="h-4 w-4 text-[#0f5981]" />
              <span>Menstrual Cycle</span>
            </div>
            <h3 className="mt-1 text-lg font-black text-slate-900">Monthly staff calendar</h3>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Built only from loaded Wellness rows and existing Wellness identity resolutions.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedMonthKey((current) => shiftMonthKey(current, -1))}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-100"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Previous</span>
            </button>
            <div className="min-w-36 rounded-xl border border-slate-200 bg-white px-4 py-2 text-center text-xs font-black uppercase tracking-wider text-[#002142] shadow-sm">
              {monthLabel}
            </div>
            <button
              type="button"
              onClick={() => setSelectedMonthKey(getLocalMonthKey())}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-100"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Current</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedMonthKey((current) => shiftMonthKey(current, 1))}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-100"
            >
              <span>Next</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-bold text-slate-700">
          <LegendItem className="bg-white border-slate-200" label="No Wellness response" />
          <LegendItem className="bg-slate-100 border-slate-300" label="Wellness response, no menstrual information" />
          <LegendItem className={PHASE_STYLES.Follicular} label="Follicular" />
          <LegendItem className={PHASE_STYLES.Ovulatory} label="Ovulatory" />
          <LegendItem className={PHASE_STYLES.Luteal} label="Luteal" />
          <LegendItem className={PHASE_STYLES.Unknown} label="Unknown phase with clinical record" />
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-2.5 py-1 text-slate-700">
            <Droplets className="h-3.5 w-3.5 text-slate-900" />
            Menstrual cycle = Yes
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-2.5 py-1 text-slate-700">
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-900 px-1 text-[10px] font-black text-white">1</span>
            Period day number
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-500 bg-slate-950 px-2.5 py-1 text-white">
            <ShieldAlert className="h-3.5 w-3.5" />
            Injury
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-sky-500 bg-sky-600 px-2.5 py-1 text-white">
            <Activity className="h-3.5 w-3.5" />
            Complaint
          </span>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <DetailSummary label="Total injuries" value={String(model.summary.injuryCount)} />
          <DetailSummary label="Total complaints" value={String(model.summary.complaintCount)} />
          <PhaseDistributionCard label="Injuries by phase" distribution={model.summary.injuriesByPhase} />
          <PhaseDistributionCard label="Complaints by phase" distribution={model.summary.complaintsByPhase} />
        </div>

        {clinicalLoadWarning ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-600">
            {clinicalLoadWarning}
          </div>
        ) : null}
      </div>

      <div className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="max-h-[68vh] overflow-auto">
          <table className="min-w-max border-collapse text-left text-[11px] leading-tight text-slate-700">
            <thead className="sticky top-0 z-30 bg-[#002142] text-white shadow-sm">
              <tr>
                <th className="sticky left-0 z-40 w-56 min-w-56 border-r border-slate-700 bg-[#002142] px-3 py-3 text-[10px] font-black uppercase tracking-[0.18em]">
                  Player
                </th>
                {model.days.map((dateKey) => (
                  <th key={dateKey} className="w-10 min-w-10 border-r border-slate-700 px-1 py-3 text-center text-[10px] font-black">
                    {Number(dateKey.slice(-2))}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {model.players.map((player) => {
                const isSelected = player.identityKey === selectedIdentityKey;
                return (
                  <tr key={player.identityKey} className={isSelected ? 'bg-[#0f5981]/5' : 'hover:bg-slate-50'}>
                    <td className={`sticky left-0 z-20 w-56 min-w-56 border-r border-t border-slate-200 px-3 py-2 ${isSelected ? 'bg-[#eaf4f8]' : 'bg-white'}`}>
                      <button
                        type="button"
                        onClick={() => setSelectedIdentityKey(player.identityKey)}
                        className="block w-full text-left"
                      >
                        <span className="block truncate text-xs font-black text-slate-900">{player.displayName}</span>
                        <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] ${getIdentityBadgeClass(player.status)}`}>
                          {player.status}
                        </span>
                      </button>
                    </td>
                    {player.cells.map((cell) => (
                      <td key={cell.dateKey} className="border-r border-t border-slate-200 p-0.5 align-middle">
                        <button
                          type="button"
                          onClick={() => setSelectedIdentityKey(player.identityKey)}
                          title={buildCellTitle(player.displayName, cell)}
                          className={`relative flex h-9 w-9 items-center justify-center rounded-lg border text-[10px] font-black transition ${getCellClass(cell)}`}
                        >
                          {cell.menstrualCycle.toLowerCase() === 'yes' ? (
                            <Droplets className="absolute left-0.5 top-0.5 h-3 w-3 text-slate-950" />
                          ) : null}
                          {cell.periodDay ? (
                            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-950 px-1 text-[10px] text-white">
                              {cell.periodDay}
                            </span>
                          ) : cell.hasMenstrualInformation ? (
                            <CircleDot className="h-4 w-4" />
                          ) : cell.hasWellnessResponse ? (
                            <span className="h-2 w-2 rounded-full bg-slate-400" />
                          ) : null}
                          {cell.injuries.length > 0 || cell.complaints.length > 0 ? (
                            <span className="absolute bottom-0.5 right-0.5 flex items-center gap-0.5">
                              {cell.injuries.length > 0 ? (
                                <span className="inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-slate-950 px-0.5 text-[8px] font-black leading-none text-white">
                                  I{cell.injuries.length > 1 ? cell.injuries.length : ''}
                                </span>
                              ) : null}
                              {cell.complaints.length > 0 ? (
                                <span className="inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-sky-600 px-0.5 text-[8px] font-black leading-none text-white">
                                  C{cell.complaints.length > 1 ? cell.complaints.length : ''}
                                </span>
                              ) : null}
                            </span>
                          ) : null}
                        </button>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {model.players.length === 0 ? (
          <div className="border-t border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm font-semibold text-slate-500">
            No Wellness responses found for {monthLabel}.
          </div>
        ) : null}
      </div>

      {selectedPlayer ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-2 border-b border-slate-100 pb-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Monthly detail</div>
              <h4 className="mt-1 text-2xl font-black uppercase tracking-tight text-slate-900">{selectedPlayer.displayName}</h4>
              <div className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${getIdentityBadgeClass(selectedPlayer.status)}`}>
                {selectedPlayer.status}
              </div>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-right">
              <div className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Selected month</div>
              <div className="text-lg font-black text-[#002142]">{monthLabel}</div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <DetailSummary label="Menstrual data days" value={String(selectedPlayer.cells.filter((cell) => cell.hasMenstrualInformation).length)} />
            <DetailSummary label="Injuries" value={String(selectedPlayer.summary.injuryCount)} />
            <DetailSummary label="Complaints" value={String(selectedPlayer.summary.complaintCount)} />
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <PhaseDistributionCard label="Player injuries by phase" distribution={selectedPlayer.summary.injuriesByPhase} />
            <PhaseDistributionCard label="Player complaints by phase" distribution={selectedPlayer.summary.complaintsByPhase} />
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
            <table className="w-full border-collapse text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                <tr>
                  <th className="px-3 py-3">Date</th>
                  <th className="px-3 py-3">Menstrual Cycle</th>
                  <th className="px-3 py-3">Period day</th>
                  <th className="px-3 py-3">Cycle phase</th>
                </tr>
              </thead>
              <tbody>
                {selectedPlayer.cells.filter((cell) => cell.hasMenstrualInformation).map((cell) => (
                  <tr key={cell.dateKey} className="border-t border-slate-200">
                    <td className="px-3 py-3 font-black text-slate-900">{cell.dateKey}</td>
                    <td className="px-3 py-3 font-bold">{cell.menstrualCycle || '-'}</td>
                    <td className="px-3 py-3 font-bold">{cell.periodDay || '-'}</td>
                    <td className="px-3 py-3 font-bold">{cell.cyclePhase || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {selectedPlayer.cells.every((cell) => !cell.hasMenstrualInformation) ? (
              <div className="border-t border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm font-semibold text-slate-500">
                No menstrual information recorded for this player in {monthLabel}.
              </div>
            ) : null}
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <ClinicalTable
              title="Injuries"
              emptyMessage={`No injuries recorded for this player in ${monthLabel}.`}
              records={selectedPlayer.cells.flatMap((cell) => cell.injuries.map((injuryRecord) => ({ cell, injury: injuryRecord })))}
              renderHeader={() => (
                <tr>
                  <th className="px-3 py-3">Date</th>
                  <th className="px-3 py-3">Diagnosis / Type</th>
                  <th className="px-3 py-3">Location</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Cycle phase</th>
                </tr>
              )}
              renderRow={({ cell, injury }) => (
                <tr key={injury.id} className="border-t border-slate-200">
                  <td className="px-3 py-3 font-black text-slate-900">{injury.injuryDate}</td>
                  <td className="px-3 py-3 font-bold">{formatInjuryDiagnosis(injury)}</td>
                  <td className="px-3 py-3 font-semibold capitalize">{formatLabel(injury.location || '-')}</td>
                  <td className="px-3 py-3 font-semibold capitalize">{formatLabel(injury.currentStatus || '-')}</td>
                  <td className="px-3 py-3 font-semibold">{cell.cyclePhase || 'Unknown'}</td>
                </tr>
              )}
            />

            <ClinicalTable
              title="Complaints"
              emptyMessage={`No complaints recorded for this player in ${monthLabel}.`}
              records={selectedPlayer.cells.flatMap((cell) => cell.complaints.map((complaintRecord) => ({ cell, complaint: complaintRecord })))}
              renderHeader={() => (
                <tr>
                  <th className="px-3 py-3">Date</th>
                  <th className="px-3 py-3">Complaint</th>
                  <th className="px-3 py-3">Location</th>
                  <th className="px-3 py-3">Outcome</th>
                  <th className="px-3 py-3">Cycle phase</th>
                </tr>
              )}
              renderRow={({ cell, complaint }) => (
                <tr key={complaint.id} className="border-t border-slate-200">
                  <td className="px-3 py-3 font-black text-slate-900">{complaint.occurrenceDate}</td>
                  <td className="px-3 py-3 font-bold capitalize">{formatLabel(complaint.complaintType)}</td>
                  <td className="px-3 py-3 font-semibold capitalize">{formatLabel(complaint.location || '-')}</td>
                  <td className="px-3 py-3 font-semibold capitalize">{formatLabel(complaint.outcome || '-')}</td>
                  <td className="px-3 py-3 font-semibold">{cell.cyclePhase || 'Unknown'}</td>
                </tr>
              )}
            />
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-4 text-xs font-semibold text-slate-600">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Wellness response without menstrual fields</div>
              <div className="mt-2 text-slate-800">{formatCellDays(selectedPlayer.cells.filter((cell) => cell.hasWellnessResponse && !cell.hasMenstrualInformation))}</div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4 text-xs font-semibold text-slate-600">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Days without Wellness response</div>
              <div className="mt-2 text-slate-800">{formatCellDays(selectedPlayer.cells.filter((cell) => !cell.hasWellnessResponse))}</div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

function LegendItem({ className, label }: { className: string; label: string }) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 ${className}`}>
      <span className="h-2.5 w-2.5 rounded-full border border-current bg-current" />
      {label}
    </span>
  );
}

function DetailSummary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-black text-slate-900">{value}</div>
    </div>
  );
}

function PhaseDistributionCard({ label, distribution }: { label: string; distribution: MenstrualCalendarPhaseDistribution }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] font-bold text-slate-700">
        {(['Follicular', 'Ovulatory', 'Luteal', 'Unknown'] as const).map((phase) => (
          <div key={phase} className="flex items-center justify-between rounded-xl bg-white px-2.5 py-2">
            <span>{phase}</span>
            <span className="font-black text-slate-950">{distribution[phase]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ClinicalTable<T>({
  title,
  emptyMessage,
  records,
  renderHeader,
  renderRow
}: {
  title: string;
  emptyMessage: string;
  records: T[];
  renderHeader: () => React.ReactNode;
  renderRow: (record: T) => React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200">
      <div className="border-b border-slate-200 bg-slate-50 px-3 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
        {title}
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-xs text-slate-700">
          <thead className="bg-white text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
            {renderHeader()}
          </thead>
          <tbody>{records.map(renderRow)}</tbody>
        </table>
      </div>
      {records.length === 0 ? (
        <div className="border-t border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm font-semibold text-slate-500">
          {emptyMessage}
        </div>
      ) : null}
    </div>
  );
}

function formatMonthLabel(monthKey: string): string {
  const [yearText, monthText] = monthKey.split('-');
  const date = new Date(Number(yearText), Number(monthText) - 1, 1);
  return date.toLocaleString('en-GB', { month: 'long', year: 'numeric' });
}

function getIdentityBadgeClass(status: string): string {
  if (status === 'matched') return 'bg-cyan-50 text-cyan-800 border border-cyan-200';
  if (status === 'ambiguous') return 'bg-violet-50 text-violet-800 border border-violet-200';
  return 'bg-slate-100 text-slate-700 border border-slate-200';
}

function getCellClass(cell: MenstrualCalendarCell): string {
  const hasClinicalRecord = cell.injuries.length > 0 || cell.complaints.length > 0;
  if (!cell.hasWellnessResponse && hasClinicalRecord) return `${PHASE_STYLES.Unknown} hover:bg-stone-200`;
  if (!cell.hasWellnessResponse) return 'border-slate-200 bg-white text-slate-300 hover:bg-slate-50';
  if (!cell.hasMenstrualInformation) return 'border-slate-300 bg-slate-100 text-slate-600 hover:bg-slate-200';

  const phaseClass = PHASE_STYLES[cell.cyclePhaseKey];
  if (phaseClass) return `${phaseClass} hover:brightness-95`;
  return `${PHASE_STYLES.Unknown} hover:bg-stone-200`;
}

function buildCellTitle(playerName: string, cell: MenstrualCalendarCell): string {
  const clinical = [
    cell.injuries.length > 0 ? `Injuries: ${cell.injuries.length}` : '',
    cell.complaints.length > 0 ? `Complaints: ${cell.complaints.length}` : ''
  ].filter(Boolean);

  if (!cell.hasWellnessResponse) {
    return [`${playerName} - ${cell.dateKey}: no Wellness response`, ...clinical].join('\n');
  }
  if (!cell.hasMenstrualInformation) {
    return [`${playerName} - ${cell.dateKey}: Wellness response without menstrual information`, ...clinical].join('\n');
  }

  return [
    `${playerName} - ${cell.dateKey}`,
    `Menstrual cycle: ${cell.menstrualCycle || '-'}`,
    `Period day: ${cell.periodDay || '-'}`,
    `Cycle phase: ${cell.cyclePhase || '-'}`,
    ...clinical
  ].join('\n');
}

function formatCellDays(cells: MenstrualCalendarCell[]): string {
  if (cells.length === 0) return 'None';
  return cells.map((cell) => String(cell.day)).join(', ');
}

function formatLabel(value: string): string {
  return value.replaceAll('_', ' ');
}

function formatInjuryDiagnosis(injury: Injury): string {
  return injury.finalDiagnosis || injury.imagingDiagnosis || injury.medicalDiagnosis || injury.clinicalDiagnosis || formatLabel(injury.injuryType);
}
