import { Activity, ArrowRight, CalendarClock, ClipboardPlus, ShieldAlert } from 'lucide-react';
import type { Injury, PhysioComplaint, PhysioPlayerContext } from '../../types';
import { getInjuryDays, isActiveInjury } from '../../services/physio/physioMetricsService';
import { formatBodyLocation } from './bodyMapModel';

type PhysioOverviewProps = {
  injuries: Injury[];
  complaints: PhysioComplaint[];
  players: PhysioPlayerContext[];
  canWrite: boolean;
  onNewInjury: () => void;
  onOpenInjury: (injury: Injury) => void;
  onOpenInjuries: () => void;
  onOpenComplaints: () => void;
};

const label = (value: string) => value.replaceAll('_', ' ');

export function PhysioOverview({ injuries, complaints, players, canWrite, onNewInjury, onOpenInjury, onOpenInjuries, onOpenComplaints }: PhysioOverviewProps) {
  const active = injuries.filter(isActiveInjury);
  const unavailable = new Set(active.filter((injury) => !['return_to_training', 'return_to_play'].includes(injury.currentStatus)).map((injury) => injury.playerId)).size;
  const playerMap = new Map(players.map((player) => [player.playerId, player]));
  const metrics = [
    { label: 'Active cases', value: active.length, icon: ShieldAlert, tone: 'text-rose-700 bg-rose-50' },
    { label: 'Unavailable', value: unavailable, icon: Activity, tone: 'text-amber-700 bg-amber-50' },
    { label: 'Returning', value: active.filter((injury) => injury.currentStatus === 'return_to_training').length, icon: CalendarClock, tone: 'text-emerald-700 bg-emerald-50' },
    { label: 'Open complaints', value: complaints.filter((complaint) => complaint.outcome === 'ongoing').length, icon: ClipboardPlus, tone: 'text-sky-700 bg-sky-50' }
  ];

  return <div className="space-y-8">
    <div className="grid gap-px overflow-hidden border border-slate-200 bg-slate-200 sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map(({ label: metricLabel, value, icon: Icon, tone }) => <div key={metricLabel} className="bg-white p-5"><div className={`grid h-9 w-9 place-items-center rounded-lg ${tone}`}><Icon className="h-5 w-5" /></div><div className="mt-5 text-3xl font-black text-[#08233d]">{value}</div><div className="mt-1 text-xs font-bold uppercase text-slate-500">{metricLabel}</div></div>)}
    </div>

    <section>
      <div className="mb-3 flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase text-emerald-700">Priority queue</p><h2 className="text-xl font-black text-[#08233d]">Current cases</h2></div><button type="button" onClick={onOpenInjuries} className="inline-flex items-center gap-1 text-sm font-bold text-[#08233d] hover:text-emerald-700">All injuries <ArrowRight className="h-4 w-4" /></button></div>
      <div className="overflow-hidden border border-slate-200 bg-white">
        {active.length ? active.slice(0, 6).map((injury) => <button key={injury.id} type="button" onClick={() => onOpenInjury(injury)} className="grid w-full gap-2 border-b border-slate-100 px-4 py-4 text-left last:border-0 hover:bg-slate-50 sm:grid-cols-[1.2fr_1fr_auto] sm:items-center"><div><p className="font-bold text-slate-900">{playerMap.get(injury.playerId)?.playerName || 'Player'}</p><p className="text-xs text-slate-500">{injury.finalDiagnosis || injury.clinicalDiagnosis || label(injury.injuryType)}</p></div><p className="text-sm text-slate-600">{formatBodyLocation(injury.location)}</p><div className="sm:text-right"><span className="inline-flex rounded-full bg-rose-50 px-2.5 py-1 text-xs font-bold capitalize text-rose-800">{label(injury.currentStatus)}</span><p className="mt-1 text-[11px] text-slate-400">Day {getInjuryDays(injury)}</p></div></button>) : <div className="p-10 text-center"><p className="font-bold text-slate-800">No active injury cases</p><p className="mt-1 text-sm text-slate-500">The current squad has no open clinical records.</p>{canWrite && <button type="button" onClick={onNewInjury} className="mt-5 rounded-lg bg-[#08233d] px-4 py-2.5 text-sm font-bold text-white">Record first injury</button>}</div>}
      </div>
    </section>

    <section className="grid gap-4 md:grid-cols-2">
      <button type="button" onClick={onOpenComplaints} className="flex items-center justify-between border border-slate-200 bg-white p-5 text-left hover:border-sky-400"><div><p className="text-xs font-bold uppercase text-sky-700">Complaints</p><p className="mt-1 font-black text-[#08233d]">Review reported issues</p><p className="mt-1 text-sm text-slate-500">Monitor events that have not become injuries.</p></div><ArrowRight className="h-5 w-5" /></button>
      <button type="button" onClick={onOpenInjuries} className="flex items-center justify-between border border-slate-200 bg-white p-5 text-left hover:border-emerald-500"><div><p className="text-xs font-bold uppercase text-emerald-700">Clinical register</p><p className="mt-1 font-black text-[#08233d]">Search the injury record</p><p className="mt-1 text-sm text-slate-500">Filter active, returning and closed cases.</p></div><ArrowRight className="h-5 w-5" /></button>
    </section>
  </div>;
}
