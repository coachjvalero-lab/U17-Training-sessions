import { ArrowLeft, ChevronRight, HeartPulse, LoaderCircle, MessageSquareText, Pencil, ShieldAlert, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import type { Injury, PhysioComplaint, PhysioMatchContext, PhysioPlayerContext, PhysioTrainingContext } from '../../types';
import { classifySupabaseError } from '../../services/supabaseError';
import { formatBodyLocation } from './bodyMapModel';

type ComplaintDetailProps = {
  complaint: PhysioComplaint;
  player?: PhysioPlayerContext;
  session?: PhysioTrainingContext;
  match?: PhysioMatchContext;
  resultingInjury?: Injury;
  canWrite: boolean;
  canDelete: boolean;
  onBack: () => void;
  onEdit: () => void;
  onDeleteComplaint: () => Promise<void>;
  onOpenInjury?: (injury: Injury) => void;
};

const label = (value: string) => value.replaceAll('_', ' ');

export function ComplaintDetail({
  complaint,
  player,
  session,
  match,
  resultingInjury,
  canWrite,
  canDelete,
  onBack,
  onEdit,
  onDeleteComplaint,
  onOpenInjury
}: ComplaintDetailProps) {
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const deleteCase = async () => {
    if (deleting) return;
    setDeleting(true);
    setError('');
    try {
      await onDeleteComplaint();
    } catch (deleteError) {
      const databaseError = deleteError as { code?: string; message?: string; details?: string };
      setError(databaseError.message || classifySupabaseError(deleteError).userMessage);
      setShowDeleteConfirmation(false);
      setDeleting(false);
    }
  };

  const outcomeTone =
    complaint.outcome === 'resolved'
      ? 'bg-emerald-50 text-emerald-800'
      : complaint.outcome === 'became_injury'
        ? 'bg-rose-50 text-rose-800'
        : 'bg-amber-50 text-amber-800';

  const contextDetail =
    complaint.context === 'training' && session
      ? `${session.sessionDate} · Session ${session.sessionNumber}`
      : complaint.context === 'match' && match
        ? `${match.matchDate} · ${match.opponentName || 'Match'}`
        : label(complaint.context);

  const formattedCreated = complaint.createdAt
    ? new Date(complaint.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : 'Not recorded';

  const formattedUpdated = complaint.updatedAt
    ? new Date(complaint.updatedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : null;

  return (
    <div className="space-y-7">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex min-h-10 items-center gap-2 text-sm font-bold text-slate-600 hover:text-[#08233d]"
      >
        <ArrowLeft className="h-4 w-4" /> Back to complaints
      </button>

      <header className="border-l-4 border-sky-600 bg-white px-5 py-6 shadow-sm sm:px-7">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
          <div>
            <p className="text-xs font-bold uppercase text-sky-700">Clinical complaint · {complaint.occurrenceDate}</p>
            <h1 className="mt-1 text-2xl font-black capitalize text-[#08233d]">
              {label(complaint.complaintType)} · {formatBodyLocation(complaint.location)}
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              {player?.playerName || 'Player'} {player?.position ? `(${player.position})` : ''} · Side: {label(complaint.affectedSide)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`w-fit rounded-full px-3 py-1.5 text-xs font-bold capitalize ${outcomeTone}`}>
              {label(complaint.outcome)}
            </span>
            {canWrite && (
              <button
                type="button"
                onClick={onEdit}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                <Pencil className="h-4 w-4" /> Edit complaint
              </button>
            )}
          </div>
        </div>
      </header>

      <section>
        <h2 className="mb-3 text-lg font-black text-[#08233d]">Event summary</h2>
        <dl className="grid gap-px overflow-hidden border border-slate-200 bg-slate-200 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Player', player?.playerName || 'Player'],
            ['Complaint date', complaint.occurrenceDate],
            ['Complaint type', label(complaint.complaintType)],
            ['Location', formatBodyLocation(complaint.location)],
            ['Affected side', label(complaint.affectedSide)],
            ['Context', label(complaint.context)],
            ['Context detail', contextDetail],
            ['Duration', label(complaint.durationBand)],
            ['Left training / match', complaint.leftActivity ? 'Yes' : 'No'],
            ['Outcome', label(complaint.outcome)],
            ['Resulting injury', resultingInjury ? (resultingInjury.finalDiagnosis || resultingInjury.clinicalDiagnosis || label(resultingInjury.injuryType)) : complaint.resultingInjuryId ? 'Linked' : 'None'],
            ['Record created', formattedCreated]
          ].map(([term, value]) => (
            <div key={term} className="bg-white p-4">
              <dt className="text-[11px] font-bold uppercase text-slate-500">{term}</dt>
              <dd className="mt-1 text-sm font-semibold capitalize text-slate-900">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {resultingInjury && (
        <section>
          <div className="mb-3 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase text-rose-700">Progression</p>
              <h2 className="text-lg font-black text-[#08233d]">Resulting injury</h2>
            </div>
          </div>
          <div
            onClick={() => onOpenInjury?.(resultingInjury)}
            className={`flex cursor-pointer items-center justify-between border border-rose-200 bg-rose-50/50 p-5 transition hover:bg-rose-50 ${onOpenInjury ? 'hover:border-rose-300' : ''}`}
          >
            <div>
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-rose-600" />
                <p className="font-bold text-slate-900">
                  {resultingInjury.finalDiagnosis || resultingInjury.clinicalDiagnosis || label(resultingInjury.injuryType)}
                </p>
                <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-bold capitalize text-rose-800">
                  {label(resultingInjury.currentStatus)}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-600">
                Injury date: {resultingInjury.injuryDate} · Location: {formatBodyLocation(resultingInjury.location)}
              </p>
            </div>
            {onOpenInjury && (
              <div className="inline-flex items-center gap-1 text-xs font-bold text-rose-700">
                View injury <ChevronRight className="h-4 w-4" />
              </div>
            )}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-black text-[#08233d]">Clinical notes</h2>
        <div className="border border-slate-200 bg-white p-5">
          {complaint.notes ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{complaint.notes}</p>
          ) : (
            <div className="flex items-center gap-2 text-sm italic text-slate-400">
              <MessageSquareText className="h-4 w-4" /> No notes recorded for this complaint.
            </div>
          )}
        </div>
      </section>

      <section className="border border-slate-200 bg-white p-4 text-xs text-slate-500">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>Created: {formattedCreated}</span>
          {formattedUpdated && <span>Last updated: {formattedUpdated}</span>}
        </div>
      </section>

      {error && (
        <div role="alert" className="border-l-4 border-rose-500 bg-rose-50 p-4 text-sm font-semibold text-rose-800">
          {error}
        </div>
      )}

      {canDelete && (
        <section className="flex flex-wrap gap-3 border-t border-slate-300 pt-6">
          <button
            type="button"
            onClick={() => {
              setError('');
              setShowDeleteConfirmation(true);
            }}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-rose-700 px-4 text-sm font-bold text-rose-800 hover:bg-rose-50"
          >
            <Trash2 className="h-4 w-4" /> Delete complaint
          </button>
        </section>
      )}

      {showDeleteConfirmation && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4" role="presentation">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-complaint-title"
            aria-describedby="delete-complaint-description"
            className="w-full max-w-md border border-slate-200 bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="delete-complaint-title" className="text-xl font-black text-[#08233d]">
                  Delete complaint?
                </h2>
                <p id="delete-complaint-description" className="mt-3 text-sm leading-6 text-slate-600">
                  This will permanently remove this complaint. This action cannot be undone.
                </p>
              </div>
              <button
                type="button"
                disabled={deleting}
                onClick={() => setShowDeleteConfirmation(false)}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"
                aria-label="Cancel deletion"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setShowDeleteConfirmation(false)}
                className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-bold text-slate-700 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => void deleteCase()}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-rose-700 px-4 text-sm font-bold text-white hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deleting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {deleting ? 'Deleting…' : 'Delete complaint'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
