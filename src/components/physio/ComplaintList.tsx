import { ChevronRight, Plus, Search } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import type { PhysioComplaint, PhysioPlayerContext } from '../../types';
import { formatBodyLocation } from './bodyMapModel';

type ComplaintListProps = {
  complaints: PhysioComplaint[];
  players: PhysioPlayerContext[];
  canWrite: boolean;
  onNew: () => void;
};

const label = (value: string) => value.replaceAll('_', ' ');

export function ComplaintList({ complaints, players, canWrite, onNew }: ComplaintListProps) {
  const [query, setQuery] = useState('');
  const [outcome, setOutcome] = useState('all');
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const playerMap = new Map(players.map((player) => [player.playerId, player]));
  const filtered = complaints.filter((complaint) => {
    if (outcome !== 'all' && complaint.outcome !== outcome) return false;
    if (!deferredQuery) return true;
    return [playerMap.get(complaint.playerId)?.playerName, complaint.complaintType, complaint.location, complaint.notes].some((value) => value?.toLowerCase().includes(deferredQuery));
  });

  return <div className="space-y-5">
    <div className="flex flex-col gap-3 border-y border-slate-200 bg-white p-4 sm:flex-row">
      <label className="relative flex-1"><span className="sr-only">Search complaints</span><Search className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-slate-400" /><input className="min-h-11 w-full rounded-lg border border-slate-300 pl-10 pr-3 text-sm outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100" placeholder="Search player, complaint or location" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      <select aria-label="Filter complaints by outcome" className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold" value={outcome} onChange={(event) => setOutcome(event.target.value)}><option value="all">All outcomes</option><option value="ongoing">Ongoing</option><option value="resolved">Resolved</option><option value="became_injury">Became injury</option></select>
      {canWrite && <button type="button" onClick={onNew} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#08233d] px-4 text-sm font-bold text-white"><Plus className="h-4 w-4" /> New complaint</button>}
    </div>
    <div className="divide-y divide-slate-100 border border-slate-200 bg-white">{filtered.map((complaint) => <article key={complaint.id} className="grid gap-3 p-5 sm:grid-cols-[1fr_auto] sm:items-center"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-slate-900">{playerMap.get(complaint.playerId)?.playerName || 'Player'}</h3><span className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${complaint.outcome === 'ongoing' ? 'bg-amber-50 text-amber-800' : complaint.outcome === 'resolved' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>{label(complaint.outcome)}</span></div><p className="mt-1 text-sm font-semibold capitalize text-slate-700">{label(complaint.complaintType)} · {formatBodyLocation(complaint.location)}</p><p className="mt-1 text-xs text-slate-500">{complaint.occurrenceDate} · {label(complaint.context)} · {label(complaint.durationBand)}</p>{complaint.notes && <p className="mt-2 text-sm text-slate-500">{complaint.notes}</p>}</div>{complaint.resultingInjuryId && <div className="inline-flex items-center gap-1 text-xs font-bold text-rose-700">Linked injury <ChevronRight className="h-4 w-4" /></div>}</article>)}</div>
    {!filtered.length && <div className="border border-dashed border-slate-300 bg-white p-12 text-center"><p className="font-bold text-slate-800">No matching complaints</p><p className="mt-1 text-sm text-slate-500">There are no complaint events for this filter.</p></div>}
  </div>;
}
