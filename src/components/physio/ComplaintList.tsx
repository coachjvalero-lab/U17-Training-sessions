import { ChevronRight, Plus, Search } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import type { PhysioComplaint, PhysioPlayerContext } from '../../types';
import { formatBodyLocation } from './bodyMapModel';

type ComplaintListProps = {
  complaints: PhysioComplaint[];
  players: PhysioPlayerContext[];
  canWrite: boolean;
  onNew: () => void;
  onOpen: (complaint: PhysioComplaint) => void;
};

const label = (value: string) => value.replaceAll('_', ' ');

export function ComplaintList({ complaints, players, canWrite, onNew, onOpen }: ComplaintListProps) {
  const [query, setQuery] = useState('');
  const [outcome, setOutcome] = useState('all');
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const playerMap = new Map(players.map((player) => [player.playerId, player]));
  const filtered = complaints.filter((complaint) => {
    if (outcome !== 'all' && complaint.outcome !== outcome) return false;
    if (!deferredQuery) return true;
    return [playerMap.get(complaint.playerId)?.playerName, complaint.complaintType, complaint.location, complaint.notes].some((value) => value?.toLowerCase().includes(deferredQuery));
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 border-y border-slate-200 bg-white p-4 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Search complaints</span>
          <Search className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-slate-400" />
          <input
            className="min-h-11 w-full rounded-lg border border-slate-300 pl-10 pr-3 text-sm outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
            placeholder="Search player, complaint or location"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <select
          aria-label="Filter complaints by outcome"
          className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold outline-none focus:border-sky-600"
          value={outcome}
          onChange={(event) => setOutcome(event.target.value)}
        >
          <option value="all">All outcomes</option>
          <option value="ongoing">Ongoing</option>
          <option value="resolved">Resolved</option>
          <option value="became_injury">Became injury</option>
        </select>
        {canWrite && (
          <button
            type="button"
            onClick={onNew}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#08233d] px-4 text-sm font-bold text-white hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" /> New complaint
          </button>
        )}
      </div>

      <div className="hidden overflow-x-auto border border-slate-200 bg-white md:block">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Player</th>
              <th className="px-4 py-3">Complaint</th>
              <th className="px-4 py-3">Date & Context</th>
              <th className="px-4 py-3">Outcome</th>
              <th className="px-4 py-3"><span className="sr-only">Open</span></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((complaint) => (
              <tr
                key={complaint.id}
                onClick={() => onOpen(complaint)}
                className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-sky-50/40"
              >
                <td className="px-4 py-4">
                  <p className="font-bold text-slate-900">{playerMap.get(complaint.playerId)?.playerName || 'Player'}</p>
                  <p className="text-xs text-slate-500">{playerMap.get(complaint.playerId)?.position}</p>
                </td>
                <td className="px-4 py-4">
                  <p className="font-semibold capitalize text-slate-800">{label(complaint.complaintType)}</p>
                  <p className="text-xs text-slate-500">{formatBodyLocation(complaint.location)} · Side: {label(complaint.affectedSide)}</p>
                </td>
                <td className="px-4 py-4">
                  <p className="text-slate-900">{complaint.occurrenceDate}</p>
                  <p className="text-xs capitalize text-slate-500">{label(complaint.context)} · {label(complaint.durationBand)}</p>
                </td>
                <td className="px-4 py-4">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold capitalize ${
                    complaint.outcome === 'ongoing'
                      ? 'bg-amber-50 text-amber-800'
                      : complaint.outcome === 'resolved'
                        ? 'bg-emerald-50 text-emerald-800'
                        : 'bg-rose-50 text-rose-800'
                  }`}>
                    {label(complaint.outcome)}
                  </span>
                  {complaint.resultingInjuryId && (
                    <p className="mt-1 text-[11px] font-bold text-rose-700">Linked injury</p>
                  )}
                </td>
                <td className="px-4 py-4">
                  <ChevronRight className="h-5 w-5 text-slate-400" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-2 md:hidden">
        {filtered.map((complaint) => (
          <button
            key={complaint.id}
            type="button"
            onClick={() => onOpen(complaint)}
            className="w-full border border-slate-200 bg-white p-4 text-left hover:border-sky-300"
          >
            <div className="flex justify-between gap-3">
              <div>
                <p className="font-bold text-slate-900">{playerMap.get(complaint.playerId)?.playerName || 'Player'}</p>
                <p className="mt-1 text-sm font-semibold capitalize text-slate-700">
                  {label(complaint.complaintType)} · {formatBodyLocation(complaint.location)}
                </p>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {complaint.occurrenceDate} · {label(complaint.context)} · {label(complaint.durationBand)}
            </p>
            <div className="mt-3 flex items-center gap-2">
              <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold capitalize ${
                complaint.outcome === 'ongoing'
                  ? 'bg-amber-50 text-amber-800'
                  : complaint.outcome === 'resolved'
                    ? 'bg-emerald-50 text-emerald-800'
                    : 'bg-rose-50 text-rose-800'
              }`}>
                {label(complaint.outcome)}
              </span>
              {complaint.resultingInjuryId && (
                <span className="text-xs font-bold text-rose-700">Linked injury</span>
              )}
            </div>
          </button>
        ))}
      </div>

      {!filtered.length && (
        <div className="border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="font-bold text-slate-800">No matching complaints</p>
          <p className="mt-1 text-sm text-slate-500">There are no complaint events for this filter.</p>
        </div>
      )}
      <p className="text-xs text-slate-400">{filtered.length} of {complaints.length} records.</p>
    </div>
  );
}
