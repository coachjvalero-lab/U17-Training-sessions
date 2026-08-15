import { ArrowLeft, CalendarCheck, CheckCircle2, Clock3, LoaderCircle, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import type { ClinicalInjuryStatus, Injury, InjuryFollowUp, PhysioPlayerContext } from '../../types';
import { classifySupabaseError } from '../../services/supabaseError';
import { getInjuryDays } from '../../services/physio/physioMetricsService';
import { formatBodyLocation } from './bodyMapModel';

type FollowUpInput = Omit<InjuryFollowUp, 'id' | 'createdAt' | 'updatedAt'>;

type InjuryDetailProps = {
  injury: Injury;
  player?: PhysioPlayerContext;
  followUps: InjuryFollowUp[];
  loadingFollowUps: boolean;
  canWrite: boolean;
  canDelete: boolean;
  onBack: () => void;
  onEdit: () => void;
  onAddFollowUp: (input: FollowUpInput) => Promise<void>;
  onCloseInjury: () => Promise<void>;
  onDeleteInjury: () => Promise<void>;
};

const statuses: ClinicalInjuryStatus[] = ['open', 'under_treatment', 'rehab', 'return_to_training', 'return_to_play', 'closed'];
const label = (value: string) => value.replaceAll('_', ' ');
const today = () => new Date().toISOString().slice(0, 10);
const fieldClass = 'min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100';

export function InjuryDetail({ injury, player, followUps, loadingFollowUps, canWrite, canDelete, onBack, onEdit, onAddFollowUp, onCloseInjury, onDeleteInjury }: InjuryDetailProps) {
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  const closeCase = async () => {
    if (working) return;
    setWorking(true);
    setError('');
    try {
      await onCloseInjury();
    } catch (closeError) {
      setError(classifySupabaseError(closeError).userMessage);
    } finally {
      setWorking(false);
    }
  };

  const deleteCase = async () => {
    if (deleting) return;
    setDeleting(true);
    setError('');
    try {
      await onDeleteInjury();
    } catch (deleteError) {
      const databaseError = deleteError as { code?: string; message?: string; details?: string };
      const isRelatedRecordConstraint = databaseError.code === '23503';
      setError(isRelatedRecordConstraint
        ? 'This injury cannot be deleted because it has related clinical records.'
        : databaseError.message || classifySupabaseError(deleteError).userMessage);
      setShowDeleteConfirmation(false);
      setDeleting(false);
    }
  };

  return <div className="space-y-7">
    <button type="button" onClick={onBack} className="inline-flex min-h-10 items-center gap-2 text-sm font-bold text-slate-600 hover:text-[#08233d]"><ArrowLeft className="h-4 w-4" /> Back to injuries</button>
    <header className="border-l-4 border-rose-500 bg-white px-5 py-6 shadow-sm sm:px-7">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
        <div><p className="text-xs font-bold uppercase text-rose-700">Clinical case · Day {getInjuryDays(injury)}</p><h1 className="mt-1 text-2xl font-black text-[#08233d]">{injury.finalDiagnosis || injury.clinicalDiagnosis || label(injury.injuryType)}</h1><p className="mt-2 text-sm text-slate-600">{player?.playerName || 'Player'} · {formatBodyLocation(injury.location)} · {label(injury.affectedSide)}</p></div>
        <div className="flex flex-wrap items-center gap-2"><span className="w-fit rounded-full bg-rose-50 px-3 py-1.5 text-xs font-bold capitalize text-rose-800">{label(injury.currentStatus)}</span>{canWrite && <button type="button" onClick={onEdit} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-bold text-slate-700 hover:bg-slate-50"><Pencil className="h-4 w-4" /> Edit injury</button>}</div>
      </div>
    </header>

    <section><h2 className="mb-3 text-lg font-black text-[#08233d]">Case summary</h2><dl className="grid gap-px overflow-hidden border border-slate-200 bg-slate-200 sm:grid-cols-2 lg:grid-cols-4">{[
      ['Injury date', injury.injuryDate], ['Context', label(injury.context)], ['Type', label(injury.injuryType)], ['Diagnosis status', label(injury.diagnosisStatus)],
      ['Pain score', injury.painScore == null ? 'Not scored' : `${injury.painScore} / 10`], ['Onset', injury.onset ? label(injury.onset) : 'Not recorded'], ['Mechanism', injury.contactType ? label(injury.contactType) : 'Not recorded'], ['Estimated return', injury.estimatedReturnDate || 'Not established']
    ].map(([term, value]) => <div key={term} className="bg-white p-4"><dt className="text-[11px] font-bold uppercase text-slate-500">{term}</dt><dd className="mt-1 text-sm font-semibold capitalize text-slate-900">{value}</dd></div>)}</dl></section>

    {(injury.clinicalDiagnosis || injury.medicalDiagnosis || injury.imagingDiagnosis || injury.finalDiagnosis) && <section><h2 className="mb-3 text-lg font-black text-[#08233d]">Diagnosis record</h2><div className="border border-slate-200 bg-white p-5"><div className="grid gap-5 md:grid-cols-2">{[['Clinical', injury.clinicalDiagnosis], ['Medical', injury.medicalDiagnosis], ['Imaging', injury.imagingDiagnosis], ['Final', injury.finalDiagnosis]].filter(([, value]) => value).map(([term, value]) => <div key={term}><p className="text-[11px] font-bold uppercase text-slate-500">{term}</p><p className="mt-1 text-sm text-slate-800">{value}</p></div>)}</div></div></section>}

    <section>
      <div className="mb-3 flex items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase text-emerald-700">Append-only history</p><h2 className="text-lg font-black text-[#08233d]">Treatment follow-ups</h2></div>{canWrite && injury.currentStatus !== 'closed' && <button type="button" onClick={() => setShowFollowUp((current) => !current)} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#08233d] px-4 text-sm font-bold text-white"><Plus className="h-4 w-4" /> Add follow-up</button>}</div>
      {showFollowUp && <FollowUpForm injury={injury} onCancel={() => setShowFollowUp(false)} onSave={async (input) => { await onAddFollowUp(input); setShowFollowUp(false); }} />}
      <div className="mt-4 border-l-2 border-slate-200 pl-5">{loadingFollowUps ? <p className="py-6 text-sm text-slate-500">Loading follow-ups…</p> : followUps.length ? followUps.map((followUp) => <article key={followUp.id} className="relative border-b border-slate-200 bg-white px-5 py-5 last:border-b-0"><span className="absolute -left-[29px] top-6 h-3 w-3 rounded-full border-2 border-white bg-emerald-600 ring-2 ring-slate-200" /><div className="flex flex-wrap justify-between gap-2"><div><p className="font-bold text-slate-900">{followUp.treatmentPhase}</p><p className="text-xs text-slate-500">{followUp.followUpDate}</p></div><span className="h-fit rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold capitalize text-emerald-800">{label(followUp.status)}</span></div><p className="mt-3 text-sm text-slate-700">{followUp.treatmentPerformed}</p>{followUp.responseToTreatment && <p className="mt-2 text-sm text-slate-500">Response: {followUp.responseToTreatment}</p>}{followUp.injuryProgression && <p className="mt-1 text-sm text-slate-500">Progression: {followUp.injuryProgression}</p>}{followUp.nextReviewDate && <p className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-sky-700"><CalendarCheck className="h-4 w-4" /> Next review {followUp.nextReviewDate}</p>}</article>) : <div className="bg-white p-6"><Clock3 className="h-5 w-5 text-slate-400" /><p className="mt-2 font-bold text-slate-800">No follow-ups yet</p><p className="text-sm text-slate-500">Treatment history will appear here chronologically.</p></div>}</div>
    </section>

    {error && <div role="alert" className="border-l-4 border-rose-500 bg-rose-50 p-4 text-sm font-semibold text-rose-800">{error}</div>}
    {(canWrite || canDelete) && <section className="flex flex-wrap gap-3 border-t border-slate-300 pt-6">{canWrite && injury.currentStatus !== 'closed' && <button type="button" disabled={working} onClick={() => void closeCase()} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-emerald-700 px-4 text-sm font-bold text-emerald-800 hover:bg-emerald-50 disabled:opacity-50">{working ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Close injury as returned</button>}{canDelete && <button type="button" onClick={() => { setError(''); setShowDeleteConfirmation(true); }} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-rose-700 px-4 text-sm font-bold text-rose-800 hover:bg-rose-50"><Trash2 className="h-4 w-4" /> Delete injury</button>}</section>}

    {showDeleteConfirmation && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4" role="presentation"><div role="alertdialog" aria-modal="true" aria-labelledby="delete-injury-title" aria-describedby="delete-injury-description" className="w-full max-w-md border border-slate-200 bg-white p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><h2 id="delete-injury-title" className="text-xl font-black text-[#08233d]">Delete injury?</h2><p id="delete-injury-description" className="mt-3 text-sm leading-6 text-slate-600">This will permanently remove this injury record and its follow-up history. This action cannot be undone.</p></div><button type="button" disabled={deleting} onClick={() => setShowDeleteConfirmation(false)} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Cancel deletion"><X className="h-5 w-5" /></button></div><div className="mt-6 flex justify-end gap-3"><button type="button" disabled={deleting} onClick={() => setShowDeleteConfirmation(false)} className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-bold text-slate-700 disabled:opacity-50">Cancel</button><button type="button" disabled={deleting} onClick={() => void deleteCase()} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-rose-700 px-4 text-sm font-bold text-white hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-60">{deleting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}{deleting ? 'Deleting…' : 'Delete injury'}</button></div></div></div>}
  </div>;
}

function FollowUpForm({ injury, onCancel, onSave }: { injury: Injury; onCancel: () => void; onSave: (input: FollowUpInput) => Promise<void> }) {
  const [draft, setDraft] = useState<FollowUpInput>({ injuryId: injury.id, followUpDate: today(), treatmentPhase: '', treatmentPerformed: '', responseToTreatment: null, injuryProgression: null, status: injury.currentStatus, nextReviewDate: null });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event: React.FormEvent) => { event.preventDefault(); if (saving) return; setSaving(true); setError(''); try { await onSave(draft); } catch (saveError) { setError(classifySupabaseError(saveError).userMessage); setSaving(false); } };
  return <form onSubmit={(event) => void submit(event)} className="mb-5 border border-emerald-200 bg-emerald-50/50 p-5"><h3 className="font-black text-[#08233d]">New follow-up</h3><div className="mt-4 grid gap-4 md:grid-cols-2"><Field label="Review date"><input required type="date" className={fieldClass} value={draft.followUpDate} onChange={(event) => setDraft({ ...draft, followUpDate: event.target.value })} /></Field><Field label="Treatment phase"><input required className={fieldClass} value={draft.treatmentPhase} onChange={(event) => setDraft({ ...draft, treatmentPhase: event.target.value })} /></Field><Field label="Status"><select className={fieldClass} value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as ClinicalInjuryStatus })}>{statuses.map((status) => <option key={status} value={status}>{label(status)}</option>)}</select></Field><Field label="Next review"><input type="date" min={draft.followUpDate} className={fieldClass} value={draft.nextReviewDate || ''} onChange={(event) => setDraft({ ...draft, nextReviewDate: event.target.value || null })} /></Field><Field label="Treatment performed" className="md:col-span-2"><textarea required className={`${fieldClass} min-h-24 py-3`} value={draft.treatmentPerformed} onChange={(event) => setDraft({ ...draft, treatmentPerformed: event.target.value })} /></Field><Field label="Response to treatment"><textarea className={`${fieldClass} min-h-20 py-3`} value={draft.responseToTreatment || ''} onChange={(event) => setDraft({ ...draft, responseToTreatment: event.target.value || null })} /></Field><Field label="Progression"><textarea className={`${fieldClass} min-h-20 py-3`} value={draft.injuryProgression || ''} onChange={(event) => setDraft({ ...draft, injuryProgression: event.target.value || null })} /></Field></div>{error && <p className="mt-3 text-sm font-semibold text-rose-700">{error}</p>}<div className="mt-5 flex justify-end gap-2"><button type="button" onClick={onCancel} className="min-h-10 rounded-lg border border-slate-300 px-4 text-sm font-bold">Cancel</button><button disabled={saving} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-bold text-white disabled:opacity-50">{saving && <LoaderCircle className="h-4 w-4 animate-spin" />} Save follow-up</button></div></form>;
}

function Field({ label: text, className = '', children }: { label: string; className?: string; children: React.ReactNode }) {
  return <label className={`block text-xs font-bold uppercase text-slate-600 ${className}`}>{text}<span className="mt-2 block">{children}</span></label>;
}
