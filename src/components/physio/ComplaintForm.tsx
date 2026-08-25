import { ArrowLeft, LoaderCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Injury, PhysioComplaint, PhysioMatchContext, PhysioPlayerContext, PhysioTrainingContext } from '../../types';
import { classifySupabaseError } from '../../services/supabaseError';
import { BodyMap } from './BodyMap';
import { BODY_REGION_SUBLOCATIONS, buildBodyLocation, type BodyRegionKey } from './bodyMapModel';

type ComplaintInput = Omit<PhysioComplaint, 'id' | 'createdAt' | 'updatedAt'>;
type ComplaintFormProps = { teamId: string; players: PhysioPlayerContext[]; sessions: PhysioTrainingContext[]; matches: PhysioMatchContext[]; injuries: Injury[]; onCancel: () => void; onSave: (input: ComplaintInput) => Promise<void> };
const today = () => new Date().toISOString().slice(0, 10);
const label = (value: string) => value.replaceAll('_', ' ');
const fieldClass = 'mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100';

export function ComplaintForm({ teamId, players, sessions, matches, injuries, onCancel, onSave }: ComplaintFormProps) {
  const [region, setRegion] = useState<BodyRegionKey | null>(null);
  const [subLocation, setSubLocation] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState<ComplaintInput>({
    teamId,
    playerId: players[0]?.playerId || '',
    occurrenceDate: today(),
    context: 'unknown',
    trainingSessionId: null,
    matchId: null,
    complaintType: 'pain',
    location: '',
    affectedSide: 'unknown',
    leftActivity: false,
    durationBand: 'less_than_24h',
    outcome: 'ongoing',
    resultingInjuryId: null,
    notes: ''
  });

  useEffect(() => {
    if (!draft.playerId && players.length > 0) {
      setDraft((current) => ({
        ...current,
        playerId: current.playerId || players[0].playerId
      }));
    }
  }, [players, draft.playerId]);

  const patch = (next: Partial<ComplaintInput>) => setDraft((current) => ({ ...current, ...next }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.playerId) {
      setError('Select a player.');
      return;
    }
    if (!draft.occurrenceDate) {
      setError('Select the occurrence date.');
      return;
    }
    if (!region) {
      setError('Select the affected body area.');
      return;
    }
    if (draft.context === 'training' && !draft.trainingSessionId) {
      setError('Select the related training session.');
      return;
    }
    if (draft.context === 'match' && !draft.matchId) {
      setError('Select the related match.');
      return;
    }
    if (draft.outcome === 'became_injury' && !draft.resultingInjuryId) {
      setError('Select the resulting injury record.');
      return;
    }
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      await onSave({
        ...draft,
        trainingSessionId: draft.context === 'training' ? (draft.trainingSessionId || null) : null,
        matchId: draft.context === 'match' ? (draft.matchId || null) : null,
        resultingInjuryId: draft.outcome === 'became_injury' ? (draft.resultingInjuryId || null) : null
      });
    } catch (saveError) {
      setError(classifySupabaseError(saveError).userMessage);
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <button type="button" onClick={onCancel} className="inline-flex min-h-10 items-center gap-2 text-sm font-bold text-slate-600">
        <ArrowLeft className="h-4 w-4" /> Back to complaints
      </button>
      <form onSubmit={(event) => void submit(event)} className="border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
        <div>
          <p className="text-xs font-bold uppercase text-sky-700">New event</p>
          <h1 className="text-2xl font-black text-[#08233d]">Record complaint</h1>
          <p className="mt-1 text-sm text-slate-500">Capture a symptom or event that does not yet meet the injury definition.</p>
        </div>

        <div className="mt-7 grid gap-5 md:grid-cols-2">
          <Field label="Player">
            <select required className={fieldClass} value={draft.playerId} onChange={(event) => patch({ playerId: event.target.value })}>
              <option value="">Select player</option>
              {players.map((player) => (
                <option key={player.playerId} value={player.playerId}>
                  {player.playerName}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Occurrence date">
            <input required type="date" max={today()} className={fieldClass} value={draft.occurrenceDate} onChange={(event) => patch({ occurrenceDate: event.target.value })} />
          </Field>
          <Field label="Complaint type">
            <select className={fieldClass} value={draft.complaintType} onChange={(event) => patch({ complaintType: event.target.value as ComplaintInput['complaintType'] })}>
              {['pain', 'fatigue', 'muscle_soreness', 'cramp', 'stiffness', 'feeling_of_weakness', 'feeling_of_instability', 'dizziness', 'feeling_unwell', 'other'].map((item) => (
                <option key={item} value={item}>{label(item)}</option>
              ))}
            </select>
          </Field>
          <Field label="Context">
            <select
              className={fieldClass}
              value={draft.context}
              onChange={(event) => patch({ context: event.target.value as ComplaintInput['context'], trainingSessionId: null, matchId: null })}
            >
              {['training', 'match', 'external', 'unknown'].map((item) => (
                <option key={item} value={item}>{label(item)}</option>
              ))}
            </select>
          </Field>

          {draft.context === 'training' && (
            <Field label="Training session">
              {sessions.length === 0 ? (
                <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                  No training sessions found for this team. You can register training sessions in the Training Hub or choose another context.
                </div>
              ) : (
                <select
                  required
                  className={fieldClass}
                  value={draft.trainingSessionId || ''}
                  onChange={(event) => patch({ trainingSessionId: event.target.value || null })}
                >
                  <option value="">Select session</option>
                  {sessions.map((session) => (
                    <option key={session.sessionId} value={session.sessionId}>
                      {session.sessionDate} · Session {session.sessionNumber}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          )}

          {draft.context === 'match' && (
            <Field label="Match">
              {matches.length === 0 ? (
                <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                  No matches found for this team. You can register matches in Match Centre or choose another context.
                </div>
              ) : (
                <select
                  required
                  className={fieldClass}
                  value={draft.matchId || ''}
                  onChange={(event) => patch({ matchId: event.target.value || null })}
                >
                  <option value="">Select match</option>
                  {matches.map((match) => (
                    <option key={match.matchId} value={match.matchId}>
                      {match.matchDate} · {match.opponentName || 'Opponent'}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          )}
        </div>

        <div className="mt-8 grid gap-8 border-t border-slate-200 pt-7 lg:grid-cols-[1.1fr_0.9fr]">
          <BodyMap
            value={region}
            onChange={(nextRegion) => {
              setRegion(nextRegion);
              setSubLocation('');
              patch({ location: buildBodyLocation(nextRegion) });
            }}
          />
          <div className="space-y-5 lg:border-l lg:border-slate-200 lg:pl-8">
            {region && BODY_REGION_SUBLOCATIONS[region] && (
              <Field label="Specific location">
                <select
                  className={fieldClass}
                  value={subLocation}
                  onChange={(event) => {
                    const detail = event.target.value;
                    setSubLocation(detail);
                    patch({ location: buildBodyLocation(region, detail || undefined) });
                  }}
                >
                  <option value="">General area</option>
                  {BODY_REGION_SUBLOCATIONS[region]?.map((item) => (
                    <option key={item} value={item}>{label(item)}</option>
                  ))}
                </select>
              </Field>
            )}
            <Field label="Affected side">
              <select className={fieldClass} value={draft.affectedSide} onChange={(event) => patch({ affectedSide: event.target.value as ComplaintInput['affectedSide'] })}>
                {['left', 'right', 'bilateral', 'not_applicable', 'unknown'].map((item) => (
                  <option key={item} value={item}>{label(item)}</option>
                ))}
              </select>
            </Field>
            <Field label="Duration">
              <select className={fieldClass} value={draft.durationBand} onChange={(event) => patch({ durationBand: event.target.value as ComplaintInput['durationBand'] })}>
                {['less_than_24h', '1_to_3_days', '4_to_7_days', 'more_than_7_days'].map((item) => (
                  <option key={item} value={item}>{label(item)}</option>
                ))}
              </select>
            </Field>
            <Field label="Outcome">
              <select
                className={fieldClass}
                value={draft.outcome}
                onChange={(event) => patch({ outcome: event.target.value as ComplaintInput['outcome'], resultingInjuryId: event.target.value === 'became_injury' ? draft.resultingInjuryId : null })}
              >
                {['ongoing', 'resolved', 'became_injury'].map((item) => (
                  <option key={item} value={item}>{label(item)}</option>
                ))}
              </select>
            </Field>
            {draft.outcome === 'became_injury' && (
              <Field label="Resulting injury">
                <select
                  required
                  className={fieldClass}
                  value={draft.resultingInjuryId || ''}
                  onChange={(event) => patch({ resultingInjuryId: event.target.value || null })}
                >
                  <option value="">Select injury</option>
                  {injuries
                    .filter((injury) => injury.playerId === draft.playerId)
                    .map((injury) => (
                      <option key={injury.id} value={injury.id}>
                        {injury.injuryDate} · {injury.finalDiagnosis || injury.clinicalDiagnosis || label(injury.injuryType)}
                      </option>
                    ))}
                </select>
              </Field>
            )}
            <label className="flex min-h-11 items-center gap-3 border border-slate-200 px-3 text-sm font-semibold">
              <input
                type="checkbox"
                checked={draft.leftActivity}
                onChange={(event) => patch({ leftActivity: event.target.checked })}
                className="h-4 w-4 accent-sky-700"
              />
              Player left the activity
            </label>
          </div>
        </div>

        <Field label="Clinical notes" className="mt-6">
          <textarea
            className={`${fieldClass} min-h-28 py-3`}
            value={draft.notes}
            onChange={(event) => patch({ notes: event.target.value })}
          />
        </Field>

        {error && (
          <div role="alert" className="mt-5 border-l-4 border-rose-500 bg-rose-50 p-4 text-sm font-semibold text-rose-800">
            {error}
          </div>
        )}

        <div className="mt-7 flex justify-end gap-2 border-t border-slate-200 pt-5">
          <button type="button" onClick={onCancel} className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-bold">
            Cancel
          </button>
          <button disabled={saving} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-sky-700 px-5 text-sm font-bold text-white disabled:opacity-50">
            {saving && <LoaderCircle className="h-4 w-4 animate-spin" />}
            {saving ? 'Saving…' : 'Save complaint'}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label: text, className = '', children }: { label: string; className?: string; children: React.ReactNode }) {
  return <label className={`block text-xs font-bold uppercase text-slate-600 ${className}`}>{text}{children}</label>;
}

