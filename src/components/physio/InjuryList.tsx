import { ChevronRight, Search, SlidersHorizontal } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import type { ClinicalInjuryStatus, Injury, PhysioPlayerContext } from '../../types';
import { getInjuryDays } from '../../services/physio/physioMetricsService';
import { formatBodyLocation } from './bodyMapModel';

type InjuryListProps = {
  injuries: Injury[];
  players: PhysioPlayerContext[];
  onOpen: (injury: Injury) => void;
};

type StatusFilter = 'all' | 'active' | ClinicalInjuryStatus;
const label = (value: string) => value.replaceAll('_', ' ');

export function InjuryList({ injuries, players, onOpen }: InjuryListProps) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('active');
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const playerMap = new Map(players.map((player) => [player.playerId, player]));
  const filtered = injuries.filter((injury) => {
    const isActive = injury.currentStatus !== 'closed';
    if (status === 'active' && !isActive) return false;
    if (!['all', 'active'].includes(status) && injury.currentStatus !== status) return false;
    if (!deferredQuery) return true;
    const playerName = playerMap.get(injury.playerId)?.playerName || '';
    return [playerName, injury.location, injury.clinicalDiagnosis, injury.finalDiagnosis, injury.injuryType].some((value) => value?.toLowerCase().includes(deferredQuery));
  });

  return <div className="space-y-5">
    <div className="flex flex-col gap-3 border-y border-slate-200 bg-white px-4 py-4 sm:flex-row sm:items-center">
      <label className="relative flex-1"><span className="sr-only">Search injuries</span><Search className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search player, diagnosis or location" className="min-h-11 w-full rounded-lg border border-slate-300 pl-10 pr-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" /></label>
      <label className="relative sm:w-56"><span className="sr-only">Filter by status</span><SlidersHorizontal className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-slate-400" /><select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)} className="min-h-11 w-full appearance-none rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-sm font-semibold capitalize outline-none focus:border-emerald-600"><option value="all">All records</option><option value="active">All active</option>{['open', 'under_treatment', 'rehab', 'return_to_training', 'return_to_play', 'closed'].map((item) => <option key={item} value={item}>{label(item)}</option>)}</select></label>
    </div>

    <div className="hidden overflow-x-auto border border-slate-200 bg-white md:block"><table className="min-w-full text-left text-sm"><thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase text-slate-500"><tr><th className="px-4 py-3">Player</th><th className="px-4 py-3">Clinical record</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Status</th><th className="px-4 py-3"><span className="sr-only">Open</span></th></tr></thead><tbody>{filtered.map((injury) => <tr key={injury.id} onClick={() => onOpen(injury)} className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-emerald-50/40"><td className="px-4 py-4"><p className="font-bold text-slate-900">{playerMap.get(injury.playerId)?.playerName || 'Player'}</p><p className="text-xs text-slate-500">{playerMap.get(injury.playerId)?.position}</p></td><td className="px-4 py-4"><p className="font-semibold text-slate-800">{injury.finalDiagnosis || injury.clinicalDiagnosis || label(injury.injuryType)}</p><p className="text-xs text-slate-500">{formatBodyLocation(injury.location)} · {label(injury.affectedSide)}</p></td><td className="px-4 py-4"><p>{injury.injuryDate}</p><p className="text-xs text-slate-500">{getInjuryDays(injury)} days</p></td><td className="px-4 py-4"><Status value={injury.currentStatus} /></td><td className="px-4 py-4"><ChevronRight className="h-5 w-5 text-slate-400" /></td></tr>)}</tbody></table></div>

    <div className="space-y-2 md:hidden">{filtered.map((injury) => <button key={injury.id} type="button" onClick={() => onOpen(injury)} className="w-full border border-slate-200 bg-white p-4 text-left"><div className="flex justify-between gap-3"><div><p className="font-bold text-slate-900">{playerMap.get(injury.playerId)?.playerName || 'Player'}</p><p className="mt-1 text-sm text-slate-600">{injury.finalDiagnosis || injury.clinicalDiagnosis || label(injury.injuryType)}</p></div><ChevronRight className="h-5 w-5 shrink-0 text-slate-400" /></div><p className="mt-2 text-xs text-slate-500">{formatBodyLocation(injury.location)} · {injury.injuryDate}</p><div className="mt-3"><Status value={injury.currentStatus} /></div></button>)}</div>
    {!filtered.length && <div className="border border-dashed border-slate-300 bg-white p-12 text-center"><p className="font-bold text-slate-800">No matching injury records</p><p className="mt-1 text-sm text-slate-500">Adjust the search or status filter.</p></div>}
    <p className="text-xs text-slate-400">{filtered.length} of {injuries.length} records · Training-load and missed-session metrics are not available.</p>
  </div>;
}

function Status({ value }: { value: ClinicalInjuryStatus }) {
  const tone = value === 'closed' ? 'bg-slate-100 text-slate-700' : value.includes('return') ? 'bg-emerald-50 text-emerald-800' : value === 'rehab' ? 'bg-sky-50 text-sky-800' : 'bg-rose-50 text-rose-800';
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold capitalize ${tone}`}>{label(value)}</span>;
}
