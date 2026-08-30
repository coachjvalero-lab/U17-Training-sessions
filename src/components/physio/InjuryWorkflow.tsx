import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ChevronLeft, LoaderCircle } from 'lucide-react';
import type { Injury, PhysioMatchContext, PhysioPlayerContext, PhysioTrainingContext } from '../../types';
import { classifySupabaseError } from '../../services/supabaseError';
import { BodyMap } from './BodyMap';
import {
  BODY_REGION_LABELS,
  BODY_REGION_SUBLOCATIONS,
  buildBodyLocation,
  formatBodyLocation,
  type BodyRegionKey
} from './bodyMapModel';

type InjuryInput = Omit<Injury, 'id' | 'createdAt' | 'updatedAt'>;

type InjuryWorkflowProps = {
  teamId: string;
  players: PhysioPlayerContext[];
  sessions: PhysioTrainingContext[];
  matches: PhysioMatchContext[];
  previousInjuries: Injury[];
  injury?: Injury;
  onCancel: () => void;
  onSave: (injury: InjuryInput) => Promise<void>;
};

const STEPS = ['Event', 'Body area', 'Diagnosis', 'Mechanism', 'Context detail', 'Recovery', 'Review'];
const today = () => new Date().toISOString().slice(0, 10);
const label = (value: string) => value.replaceAll('_', ' ');

function initialDraft(teamId: string, playerId: string, injury?: Injury): InjuryInput {
  if (injury) {
    const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...input } = injury;
    return input;
  }
  return {
    teamId,
    playerId,
    injuryDate: today(),
    context: 'unknown',
    trainingSessionId: null,
    matchId: null,
    location: '',
    affectedSide: 'unknown',
    injuryType: 'other',
    clinicalDiagnosis: null,
    medicalDiagnosis: null,
    imagingDiagnosis: null,
    finalDiagnosis: null,
    diagnosisStatus: 'not_established',
    injuryGrade: null,
    previousSimilarInjury: false,
    occurrenceType: 'first_occurrence',
    previousInjuryId: null,
    previousInjuryDate: null,
    sameLocation: null,
    sameDiagnosis: null,
    playingSurface: null,
    contactType: null,
    contactWith: 'not_applicable',
    activities: [],
    painScore: null,
    onset: null,
    popSensation: false,
    swelling: false,
    instability: false,
    lossOfStrength: false,
    reducedRangeOfMotion: false,
    otherSymptoms: null,
    trainingDurationMinutes: null,
    trainingMinute: null,
    trainingPhase: null,
    playerContinued: null,
    continuedWithLimitations: null,
    leftTraining: null,
    playingTimeMinutes: null,
    matchMinute: null,
    matchPhase: null,
    leftMatch: null,
    currentStatus: 'open',
    estimatedReturnDate: null,
    actualReturnDate: null,
    closedAt: null
  };
}

function regionFromLocation(location?: string): BodyRegionKey | null {
  const region = location?.split(':')[0] as BodyRegionKey | undefined;
  return region && region in BODY_REGION_LABELS ? region : null;
}

const fieldClass = 'mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100';
const labelClass = 'block text-xs font-bold uppercase text-slate-600';

export function InjuryWorkflow({ teamId, players, sessions, matches, previousInjuries, injury, onCancel, onSave }: InjuryWorkflowProps) {
  const editing = Boolean(injury);
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<InjuryInput>(() => initialDraft(teamId, players[0]?.playerId || '', injury));
  const [region, setRegion] = useState<BodyRegionKey | null>(() => regionFromLocation(injury?.location));
  const [subLocation, setSubLocation] = useState(() => injury?.location.split(':')[1] || '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!draft.playerId && players.length > 0 && !editing) {
      setDraft((current) => ({
        ...current,
        playerId: current.playerId || players[0].playerId
      }));
    }
  }, [players, draft.playerId, editing]);

  const patch = (next: Partial<InjuryInput>) => setDraft((current) => ({ ...current, ...next }));
  const playerInjuries = useMemo(
    () => previousInjuries.filter((injury) => injury.playerId === draft.playerId),
    [draft.playerId, previousInjuries]
  );

  const validate = () => {
    if (step === 0 && (!draft.playerId || !draft.injuryDate)) return 'Select a player and injury date.';
    if (step === 0 && draft.context === 'training' && !draft.trainingSessionId) return 'Select the related training session.';
    if (step === 0 && draft.context === 'match' && !draft.matchId) return 'Select the related match.';
    if (step === 1 && !region) return 'Select the affected body area.';
    if (step === 2 && draft.diagnosisStatus !== 'not_established' && !draft.clinicalDiagnosis && !draft.medicalDiagnosis && !draft.imagingDiagnosis && !draft.finalDiagnosis) return 'Enter the available diagnosis.';
    if (step === 5 && draft.previousSimilarInjury && !draft.previousInjuryId && !draft.previousInjuryDate) return 'Link a previous injury or enter its date.';
    return '';
  };

  const next = () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError('');
    setStep((current) => Math.min(STEPS.length - 1, current + 1));
  };

  const submit = async () => {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      await onSave({
        ...draft,
        trainingSessionId: draft.context === 'training' ? (draft.trainingSessionId || null) : null,
        matchId: draft.context === 'match' ? (draft.matchId || null) : null
      });
    } catch (submissionError) {
      setError(classifySupabaseError(submissionError).userMessage);
      setSaving(false);
    }
  };

  const selectRegion = (nextRegion: BodyRegionKey) => {
    setRegion(nextRegion);
    setSubLocation('');
    patch({ location: buildBodyLocation(nextRegion) });
  };

  return (
    <section className="min-h-[70vh] bg-[#f5f7f8]">
      <div className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center gap-4">
          <button type="button" onClick={onCancel} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50" aria-label="Cancel injury entry">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase text-emerald-700">{editing ? 'Update clinical record' : 'New clinical record'}</p>
            <h1 className="truncate text-xl font-black text-[#08233d]">{editing ? 'Edit injury' : 'Record injury'}</h1>
          </div>
          <span className="text-sm font-bold text-slate-500">{step + 1} / {STEPS.length}</span>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <ol className="mb-8 grid grid-cols-7 gap-1" aria-label="Injury workflow progress">
          {STEPS.map((item, index) => (
            <li key={item} className="min-w-0">
              <div className={`h-1.5 rounded-full ${index <= step ? 'bg-emerald-600' : 'bg-slate-200'}`} />
              <span className={`mt-2 hidden truncate text-[10px] font-bold uppercase sm:block ${index === step ? 'text-emerald-700' : 'text-slate-400'}`}>{item}</span>
            </li>
          ))}
        </ol>

        <div className="border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
          {step === 0 && (
            <Step title="When did it happen?" description="Start with the player and the event that anchors this record.">
              <div className="grid gap-5 md:grid-cols-2">
                <Field label="Player"><select className={fieldClass} value={draft.playerId} onChange={(event) => patch({ playerId: event.target.value })}><option value="">Select player</option>{players.map((player) => <option key={player.playerId} value={player.playerId}>#{player.shirtNumber || '–'} {player.playerName}</option>)}</select></Field>
                <Field label="Injury date"><input className={fieldClass} type="date" max={today()} value={draft.injuryDate} onChange={(event) => patch({ injuryDate: event.target.value })} /></Field>
              </div>
              <fieldset className="mt-6"><legend className={labelClass}>Event context</legend><ChoiceGrid values={['training', 'match', 'external', 'unknown']} selected={draft.context} onChange={(context) => patch({ context: context as InjuryInput['context'], trainingSessionId: null, matchId: null })} /></fieldset>
              {draft.context === 'training' && (
                <Field label="Training session" className="mt-6">
                  {sessions.length === 0 ? (
                    <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                      No training sessions found for this team. You can register training sessions in the Training Hub or choose another context.
                    </div>
                  ) : (
                    <select className={fieldClass} value={draft.trainingSessionId || ''} onChange={(event) => patch({ trainingSessionId: event.target.value || null })}>
                      <option value="">Select session</option>
                      {sessions.map((session) => <option key={session.sessionId} value={session.sessionId}>{session.sessionDate} · Session {session.sessionNumber}</option>)}
                    </select>
                  )}
                </Field>
              )}
              {draft.context === 'match' && (
                <Field label="Match" className="mt-6">
                  {matches.length === 0 ? (
                    <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                      No matches found for this team. You can register matches in Match Centre or choose another context.
                    </div>
                  ) : (
                    <select className={fieldClass} value={draft.matchId || ''} onChange={(event) => patch({ matchId: event.target.value || null })}>
                      <option value="">Select match</option>
                      {matches.map((match) => <option key={match.matchId} value={match.matchId}>{match.matchDate} · {match.opponentName || 'Match'}</option>)}
                    </select>
                  )}
                </Field>
              )}
            </Step>
          )}

          {step === 1 && (
            <Step title="Where is the injury?" description="Select the primary anatomical area, then refine it where useful.">
              <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
                <BodyMap value={region} onChange={selectRegion} />
                <div className="space-y-6 lg:border-l lg:border-slate-200 lg:pl-8">
                  <div><p className={labelClass}>Selected area</p><p className="mt-2 text-lg font-black text-[#08233d]">{region ? BODY_REGION_LABELS[region] : 'No area selected'}</p></div>
                  <Field label="Specific location">
                    <select
                      disabled={!region}
                      className={`${fieldClass} ${!region ? 'cursor-not-allowed bg-slate-50 text-slate-400' : ''}`}
                      value={subLocation}
                      onChange={(event) => {
                        const detail = event.target.value;
                        setSubLocation(detail);
                        if (region) {
                          patch({ location: buildBodyLocation(region, detail || undefined) });
                        }
                      }}
                    >
                      <option value="">{region ? 'General area' : 'Select area on body map first'}</option>
                      {region &&
                        (BODY_REGION_SUBLOCATIONS[region] || []).map((item) => (
                          <option key={item} value={item}>
                            {label(item)}
                          </option>
                        ))}
                    </select>
                  </Field>
                  <fieldset><legend className={labelClass}>Affected side</legend><ChoiceGrid values={['left', 'right', 'bilateral', 'not_applicable', 'unknown']} selected={draft.affectedSide} onChange={(affectedSide) => patch({ affectedSide: affectedSide as InjuryInput['affectedSide'] })} /></fieldset>
                </div>
              </div>
            </Step>
          )}

          {step === 2 && (
            <Step title="What is the clinical picture?" description="A diagnosis can remain provisional and be refined through follow-ups.">
              <div className="grid gap-5 md:grid-cols-2">
                <Field label="Injury type"><select className={fieldClass} value={draft.injuryType} onChange={(event) => patch({ injuryType: event.target.value as InjuryInput['injuryType'] })}>{['bone', 'joint_non_bone', 'ligament', 'tendon', 'muscle', 'skin', 'pain_non_specific', 'other'].map((item) => <option key={item} value={item}>{label(item)}</option>)}</select></Field>
                <Field label="Diagnosis status"><select className={fieldClass} value={draft.diagnosisStatus} onChange={(event) => patch({ diagnosisStatus: event.target.value as InjuryInput['diagnosisStatus'] })}>{['not_established', 'clinical', 'medical', 'imaging', 'final'].map((item) => <option key={item} value={item}>{label(item)}</option>)}</select></Field>
                <Field label="Clinical diagnosis"><input className={fieldClass} value={draft.clinicalDiagnosis || ''} onChange={(event) => patch({ clinicalDiagnosis: event.target.value || null })} /></Field>
                <Field label="Medical diagnosis"><input className={fieldClass} value={draft.medicalDiagnosis || ''} onChange={(event) => patch({ medicalDiagnosis: event.target.value || null })} /></Field>
                <Field label="Imaging diagnosis"><input className={fieldClass} value={draft.imagingDiagnosis || ''} onChange={(event) => patch({ imagingDiagnosis: event.target.value || null })} /></Field>
                <Field label="Final diagnosis"><input className={fieldClass} value={draft.finalDiagnosis || ''} onChange={(event) => patch({ finalDiagnosis: event.target.value || null })} /></Field>
                <Field label="Grade"><input className={fieldClass} placeholder="e.g. Grade 2" value={draft.injuryGrade || ''} onChange={(event) => patch({ injuryGrade: event.target.value || null })} /></Field>
              </div>
            </Step>
          )}

          {step === 3 && (
            <Step title="How did it present?" description="Capture mechanism, activity and immediate symptoms.">
              <div className="grid gap-6 md:grid-cols-2">
                <fieldset><legend className={labelClass}>Onset</legend><ChoiceGrid values={['sudden', 'gradual']} selected={draft.onset || ''} onChange={(onset) => patch({ onset: onset as InjuryInput['onset'] })} /></fieldset>
                <fieldset><legend className={labelClass}>Mechanism</legend><ChoiceGrid values={['contact', 'non_contact']} selected={draft.contactType || ''} onChange={(contactType) => patch({ contactType: contactType as InjuryInput['contactType'], contactWith: contactType === 'contact' ? 'opponent' : 'not_applicable' })} /></fieldset>
                {draft.contactType === 'contact' && <Field label="Contact with"><select className={fieldClass} value={draft.contactWith} onChange={(event) => patch({ contactWith: event.target.value as InjuryInput['contactWith'] })}>{['opponent', 'teammate', 'other'].map((item) => <option key={item}>{item}</option>)}</select></Field>}
                <Field label="Playing surface"><input className={fieldClass} value={draft.playingSurface || ''} onChange={(event) => patch({ playingSurface: event.target.value || null })} /></Field>
                <Field label="Pain score (0–10)"><input className={fieldClass} type="number" min="0" max="10" value={draft.painScore ?? ''} onChange={(event) => patch({ painScore: event.target.value === '' ? null : Number(event.target.value) })} /></Field>
                <Field label="Activities"><input className={fieldClass} placeholder="Sprint, change of direction" value={draft.activities.join(', ')} onChange={(event) => patch({ activities: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) })} /></Field>
              </div>
              <fieldset className="mt-6"><legend className={labelClass}>Observed symptoms</legend><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{([['popSensation', 'Pop sensation'], ['swelling', 'Swelling'], ['instability', 'Instability'], ['lossOfStrength', 'Loss of strength'], ['reducedRangeOfMotion', 'Reduced range of motion']] as const).map(([key, text]) => <CheckOption key={key} checked={draft[key]} label={text} onChange={(checked) => patch({ [key]: checked })} />)}</div></fieldset>
              <Field label="Other symptoms" className="mt-6"><textarea className={`${fieldClass} min-h-24 py-3`} value={draft.otherSymptoms || ''} onChange={(event) => patch({ otherSymptoms: event.target.value || null })} /></Field>
            </Step>
          )}

          {step === 4 && (
            <Step title="What happened during the event?" description={draft.context === 'training' ? 'Record the point and phase of training.' : draft.context === 'match' ? 'Record the point and phase of the match.' : 'No session-specific detail is required for this context.'}>
              {draft.context === 'training' && <div className="grid gap-5 md:grid-cols-2"><Field label="Training duration (minutes)"><NumberInput value={draft.trainingDurationMinutes} onChange={(trainingDurationMinutes) => patch({ trainingDurationMinutes })} /></Field><Field label="Minute of injury"><NumberInput value={draft.trainingMinute} onChange={(trainingMinute) => patch({ trainingMinute })} /></Field><Field label="Training phase"><select className={fieldClass} value={draft.trainingPhase || ''} onChange={(event) => patch({ trainingPhase: (event.target.value || null) as InjuryInput['trainingPhase'] })}><option value="">Not recorded</option>{['warm_up', 'main_part', 'end_of_training'].map((item) => <option key={item} value={item}>{label(item)}</option>)}</select></Field><div className="space-y-2"><CheckOption checked={Boolean(draft.playerContinued)} label="Player continued" onChange={(playerContinued) => patch({ playerContinued })} /><CheckOption checked={Boolean(draft.continuedWithLimitations)} label="Continued with limitations" onChange={(continuedWithLimitations) => patch({ continuedWithLimitations })} /><CheckOption checked={Boolean(draft.leftTraining)} label="Left training" onChange={(leftTraining) => patch({ leftTraining })} /></div></div>}
              {draft.context === 'match' && <div className="grid gap-5 md:grid-cols-2"><Field label="Playing time (minutes)"><NumberInput value={draft.playingTimeMinutes} onChange={(playingTimeMinutes) => patch({ playingTimeMinutes })} /></Field><Field label="Match minute"><NumberInput value={draft.matchMinute} onChange={(matchMinute) => patch({ matchMinute })} /></Field><Field label="Match phase"><select className={fieldClass} value={draft.matchPhase || ''} onChange={(event) => patch({ matchPhase: (event.target.value || null) as InjuryInput['matchPhase'] })}><option value="">Not recorded</option>{['warm_up', 'first_half', 'half_time', 'second_half'].map((item) => <option key={item} value={item}>{label(item)}</option>)}</select></Field><CheckOption checked={Boolean(draft.leftMatch)} label="Player left the match" onChange={(leftMatch) => patch({ leftMatch })} /></div>}
              {!['training', 'match'].includes(draft.context) && <div className="border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">Continue to recovery planning.</div>}
            </Step>
          )}

          {step === 5 && (
            <Step title="Set the recovery baseline" description="Capture recurrence and the first expected milestone.">
              <div className="grid gap-6 md:grid-cols-2">
                <Field label="Current status"><select className={fieldClass} value={draft.currentStatus} onChange={(event) => patch({ currentStatus: event.target.value as InjuryInput['currentStatus'] })}>{['open', 'under_treatment', 'rehab', 'return_to_training', 'return_to_play'].map((item) => <option key={item} value={item}>{label(item)}</option>)}</select></Field>
                <Field label="Estimated return"><input className={fieldClass} type="date" min={draft.injuryDate} value={draft.estimatedReturnDate || ''} onChange={(event) => patch({ estimatedReturnDate: event.target.value || null })} /></Field>
              </div>
              <div className="mt-6"><CheckOption checked={draft.previousSimilarInjury} label="Previous similar injury" onChange={(previousSimilarInjury) => patch({ previousSimilarInjury, occurrenceType: previousSimilarInjury ? 'recurrent' : 'first_occurrence', previousInjuryId: null, previousInjuryDate: null, sameLocation: null, sameDiagnosis: null })} /></div>
              {draft.previousSimilarInjury && <div className="mt-5 grid gap-5 border-l-4 border-amber-400 bg-amber-50 p-5 md:grid-cols-2"><Field label="Previous clinical record"><select className={fieldClass} value={draft.previousInjuryId || ''} onChange={(event) => patch({ previousInjuryId: event.target.value || null })}><option value="">Not linked</option>{playerInjuries.map((injury) => <option key={injury.id} value={injury.id}>{injury.injuryDate} · {formatBodyLocation(injury.location)}</option>)}</select></Field><Field label="Previous injury date"><input className={fieldClass} type="date" max={draft.injuryDate} value={draft.previousInjuryDate || ''} onChange={(event) => patch({ previousInjuryDate: event.target.value || null })} /></Field><CheckOption checked={Boolean(draft.sameLocation)} label="Same location" onChange={(sameLocation) => patch({ sameLocation })} /><CheckOption checked={Boolean(draft.sameDiagnosis)} label="Same diagnosis" onChange={(sameDiagnosis) => patch({ sameDiagnosis })} /></div>}
            </Step>
          )}

          {step === 6 && (
            <Step title="Review clinical record" description="Confirm the key facts before creating the injury record.">
              <dl className="grid gap-px overflow-hidden border border-slate-200 bg-slate-200 md:grid-cols-2">{[
                ['Player', players.find((player) => player.playerId === draft.playerId)?.playerName || 'Not selected'],
                ['Date and context', `${draft.injuryDate} · ${label(draft.context)}`],
                ['Body area', `${formatBodyLocation(draft.location)} · ${label(draft.affectedSide)}`],
                ['Classification', `${label(draft.injuryType)} · ${label(draft.diagnosisStatus)}`],
                ['Diagnosis', draft.finalDiagnosis || draft.medicalDiagnosis || draft.clinicalDiagnosis || 'Not yet established'],
                ['Pain and onset', `${draft.painScore ?? 'Not scored'} · ${draft.onset ? label(draft.onset) : 'Onset not recorded'}`],
                ['Status', label(draft.currentStatus)],
                ['Estimated return', draft.estimatedReturnDate || 'Not established']
              ].map(([term, value]) => <div key={term} className="bg-white p-4"><dt className={labelClass}>{term}</dt><dd className="mt-1 text-sm font-semibold text-slate-900">{value}</dd></div>)}</dl>
            </Step>
          )}

          {error && <div role="alert" className="mt-6 border-l-4 border-rose-500 bg-rose-50 p-4 text-sm font-semibold text-rose-800">{error}</div>}

          <div className="mt-8 flex items-center justify-between border-t border-slate-200 pt-5">
            <button type="button" onClick={() => step === 0 ? onCancel() : setStep((current) => current - 1)} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50"><ArrowLeft className="h-4 w-4" /> {step === 0 ? 'Cancel' : 'Back'}</button>
            {step < STEPS.length - 1 ? <button type="button" onClick={next} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#08233d] px-5 text-sm font-bold text-white hover:bg-[#123b5d]">Continue <ArrowRight className="h-4 w-4" /></button> : <button type="button" disabled={saving} onClick={() => void submit()} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-emerald-700 px-5 text-sm font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60">{saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{saving ? 'Saving…' : editing ? 'Save changes' : 'Create injury'}</button>}
          </div>
        </div>
      </div>
    </section>
  );
}

function Step({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <div><div className="mb-7"><h2 className="text-xl font-black text-[#08233d]">{title}</h2><p className="mt-1 text-sm text-slate-500">{description}</p></div>{children}</div>;
}

function Field({ label: text, className = '', children }: { label: string; className?: string; children: React.ReactNode }) {
  return <label className={`${labelClass} ${className}`}>{text}{children}</label>;
}

function ChoiceGrid({ values, selected, onChange }: { values: string[]; selected: string; onChange: (value: string) => void }) {
  return <div className="mt-3 flex flex-wrap gap-2">{values.map((value) => <button key={value} type="button" aria-pressed={selected === value} onClick={() => onChange(value)} className={`min-h-10 rounded-lg border px-3 text-sm font-semibold capitalize ${selected === value ? 'border-emerald-700 bg-emerald-50 text-emerald-900' : 'border-slate-300 bg-white text-slate-600 hover:border-slate-500'}`}>{label(value)}</button>)}</div>;
}

function CheckOption({ checked, label: text, onChange }: { checked: boolean; label: string; onChange: (checked: boolean) => void }) {
  return <label className="flex min-h-11 cursor-pointer items-center gap-3 border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-emerald-700" />{text}</label>;
}

function NumberInput({ value, onChange }: { value?: number | null; onChange: (value: number | null) => void }) {
  return <input className={fieldClass} type="number" min="0" value={value ?? ''} onChange={(event) => onChange(event.target.value === '' ? null : Number(event.target.value))} />;
}
