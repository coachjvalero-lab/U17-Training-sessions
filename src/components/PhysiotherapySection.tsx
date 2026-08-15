import { useEffect, useMemo, useState } from 'react';
import { ClipboardList, HeartPulse, History, LayoutDashboard, LoaderCircle, Plus, Shield } from 'lucide-react';
import type { Injury, InjuryFollowUp, PhysioComplaint } from '../types';
import { useTeamContext } from '../contexts/TeamContext';
import { useAuthorization } from '../services/permissions/authorization';
import { classifySupabaseError } from '../services/supabaseError';
import { addInjuryFollowUp, createInjury, getPhysioContext, listInjuryFollowUps, subscribeToInjuries, updateInjury } from '../services/physio/injuriesService';
import { createPhysioComplaint, listPhysioComplaints } from '../services/physio/physioComplaintsService';
import { ComplaintForm } from './physio/ComplaintForm';
import { ComplaintList } from './physio/ComplaintList';
import { InjuryDetail } from './physio/InjuryDetail';
import { InjuryList } from './physio/InjuryList';
import { InjuryWorkflow } from './physio/InjuryWorkflow';
import { PhysioOverview } from './physio/PhysioOverview';
import { PlayerClinicalTimeline } from './physio/PlayerClinicalTimeline';

type PhysioView = 'overview' | 'injuries' | 'new-injury' | 'injury-detail' | 'complaints' | 'new-complaint' | 'history';
type PhysioContextData = Awaited<ReturnType<typeof getPhysioContext>>;
type PhysiotherapySectionProps = { userEmail?: string | null };

const EMPTY_CONTEXT: PhysioContextData = { players: [], sessions: [], matches: [] };
const today = () => new Date().toISOString().slice(0, 10);

export function PhysiotherapySection({ userEmail }: PhysiotherapySectionProps) {
  const { selectedTeamId } = useTeamContext();
  const { isAdmin, isLoadingAuthorization } = useAuthorization(userEmail);
  const [view, setView] = useState<PhysioView>('overview');
  const [injuries, setInjuries] = useState<Injury[]>([]);
  const [complaints, setComplaints] = useState<PhysioComplaint[]>([]);
  const [context, setContext] = useState<PhysioContextData>(EMPTY_CONTEXT);
  const [selectedInjury, setSelectedInjury] = useState<Injury | null>(null);
  const [followUps, setFollowUps] = useState<InjuryFollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingFollowUps, setLoadingFollowUps] = useState(false);
  const [historyPlayerId, setHistoryPlayerId] = useState('');
  const [error, setError] = useState('');
  const canWrite = isAdmin;

  useEffect(() => {
    if (!selectedTeamId) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError('');
    const stop = subscribeToInjuries(
      selectedTeamId,
      (items) => {
        if (!active) return;
        setInjuries(items);
        setSelectedInjury((selected) => selected ? items.find((item) => item.id === selected.id) || selected : null);
        setLoading(false);
      },
      (loadError) => {
        if (!active) return;
        setError(classifySupabaseError(loadError).userMessage);
        setLoading(false);
      }
    );
    void Promise.all([listPhysioComplaints(selectedTeamId), getPhysioContext(selectedTeamId)])
      .then(([nextComplaints, nextContext]) => {
        if (!active) return;
        setComplaints(nextComplaints);
        setContext(nextContext);
      })
      .catch((loadError) => active && setError(classifySupabaseError(loadError).userMessage))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
      stop();
    };
  }, [selectedTeamId]);

  useEffect(() => {
    if (!selectedInjury) {
      setFollowUps([]);
      return;
    }
    let active = true;
    setLoadingFollowUps(true);
    void listInjuryFollowUps(selectedInjury.id)
      .then((items) => active && setFollowUps(items))
      .catch((loadError) => active && setError(classifySupabaseError(loadError).userMessage))
      .finally(() => active && setLoadingFollowUps(false));
    return () => { active = false; };
  }, [selectedInjury?.id]);

  const playerMap = useMemo(() => new Map(context.players.map((player) => [player.playerId, player])), [context.players]);
  const openInjury = (injury: Injury) => {
    setSelectedInjury(injury);
    setView('injury-detail');
  };
  const refreshComplaints = async () => {
    if (selectedTeamId) setComplaints(await listPhysioComplaints(selectedTeamId));
  };

  if (!selectedTeamId) return <div className="border border-amber-200 bg-amber-50 p-6 text-sm font-semibold text-amber-900">Select a team to access Physiotherapy.</div>;
  if (loading || isLoadingAuthorization) return <div className="grid min-h-[60vh] place-items-center bg-white"><div className="text-center"><LoaderCircle className="mx-auto h-7 w-7 animate-spin text-emerald-700" /><p className="mt-3 text-sm font-semibold text-slate-500">Loading clinical workspace…</p></div></div>;

  if (view === 'new-injury') return <InjuryWorkflow teamId={selectedTeamId} players={context.players} sessions={context.sessions} matches={context.matches} previousInjuries={injuries} onCancel={() => setView('injuries')} onSave={async (input) => { await createInjury(input); setView('injuries'); }} />;
  if (view === 'new-complaint') return <ComplaintForm teamId={selectedTeamId} players={context.players} sessions={context.sessions} matches={context.matches} injuries={injuries} onCancel={() => setView('complaints')} onSave={async (input) => { await createPhysioComplaint(input); await refreshComplaints(); setView('complaints'); }} />;
  if (view === 'injury-detail' && selectedInjury) return <InjuryDetail
    injury={selectedInjury}
    player={playerMap.get(selectedInjury.playerId)}
    followUps={followUps}
    loadingFollowUps={loadingFollowUps}
    canWrite={canWrite}
    onBack={() => setView('injuries')}
    onAddFollowUp={async (input) => {
      await addInjuryFollowUp(input);
      if (input.status !== selectedInjury.currentStatus) setSelectedInjury(await updateInjury(selectedInjury.id, { currentStatus: input.status }));
      setFollowUps(await listInjuryFollowUps(selectedInjury.id));
    }}
    onCloseInjury={async () => setSelectedInjury(await updateInjury(selectedInjury.id, { currentStatus: 'closed', actualReturnDate: today(), closedAt: new Date().toISOString() }))}
  />;

  const tabs: { id: PhysioView; label: string; icon: typeof LayoutDashboard }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'injuries', label: 'Injuries', icon: ClipboardList },
    { id: 'complaints', label: 'Complaints', icon: HeartPulse },
    { id: 'history', label: 'Player history', icon: History }
  ];

  return <div className="min-h-[70vh] bg-[#f5f7f8]">
    <header className="border-b border-slate-800 bg-[#08233d] px-4 py-6 text-white sm:px-6">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
        <div><div className="flex items-center gap-2 text-xs font-bold uppercase text-emerald-300"><HeartPulse className="h-4 w-4" /> Physiotherapy</div><h1 className="mt-1 text-2xl font-black">Clinical workspace</h1><p className="mt-1 text-sm text-slate-300">Availability, treatment and longitudinal player records.</p></div>
        {canWrite ? <button type="button" onClick={() => setView('new-injury')} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-rose-500 px-4 text-sm font-bold text-white hover:bg-rose-600"><Plus className="h-4 w-4" /> Record injury</button> : <div className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-slate-200"><Shield className="h-4 w-4" /> Read-only clinical access</div>}
      </div>
      <nav className="mt-6 flex gap-1 overflow-x-auto" aria-label="Physiotherapy sections">{tabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => setView(id)} className={`inline-flex min-h-10 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-bold ${view === id ? 'border-emerald-400 text-white' : 'border-transparent text-slate-300 hover:text-white'}`}><Icon className="h-4 w-4" /> {label}</button>)}</nav>
    </header>
    <main className="px-4 py-7 sm:px-6">
      {error && <div role="alert" className="mb-5 border-l-4 border-rose-500 bg-rose-50 p-4 text-sm font-semibold text-rose-800">{error}</div>}
      {!canWrite && <div className="mb-5 border-l-4 border-sky-500 bg-sky-50 p-4 text-sm text-sky-900">You can review clinical records. Creating or updating records requires confirmed clinical write access.</div>}
      {view === 'overview' && <PhysioOverview injuries={injuries} complaints={complaints} players={context.players} canWrite={canWrite} onNewInjury={() => setView('new-injury')} onOpenInjury={openInjury} onOpenInjuries={() => setView('injuries')} onOpenComplaints={() => setView('complaints')} />}
      {view === 'injuries' && <InjuryList injuries={injuries} players={context.players} onOpen={openInjury} />}
      {view === 'complaints' && <ComplaintList complaints={complaints} players={context.players} canWrite={canWrite} onNew={() => setView('new-complaint')} />}
      {view === 'history' && <PlayerClinicalTimeline players={context.players} injuries={injuries} complaints={complaints} selectedPlayerId={historyPlayerId} onSelectPlayer={setHistoryPlayerId} onOpenInjury={openInjury} />}
    </main>
  </div>;
}
