import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CalendarDays, ChevronLeft, Eye, MapPin, PlayCircle, Plus, Save, Shield, Swords, Trophy, Video, X } from 'lucide-react';
import { TeamCrest } from './TeamCrest';
import { useTeamContext } from '../contexts/TeamContext';
import {
  createMatchEvent,
  getMatchEvents
} from '../services/matches/matchEventsService';
import { getMatchById, listMatches } from '../services/matches/matchService';
import {
  createOrUpdateOpponentAnalysis,
  getOpponentAnalysisByMatchId,
  updateOpponentAnalysisSlidesUrl,
  updateOpponentAnalysisVideoUrl
} from '../services/matches/opponentAnalysisService';
import { getMatchLineup, removeMatchLineupEntry, upsertMatchLineupEntry } from '../services/matches/matchLineupService';
import { getMatchPlan, upsertMatchPlanPhase } from '../services/matches/matchPlanService';
import { getMatchSetPieces, upsertMatchSetPieces } from '../services/matches/matchSetPiecesService';
import { getPlayerMatchStatistics, recalculatePlayerMatchStatistics } from '../services/matches/playerMatchStatisticsService';
import type { Match, MatchEvent as MatchEventModel, MatchEventType, MatchLineupEntry, MatchPlanEntry, MatchPlanPhase, MatchSetPieces, OpponentAnalysis, OpponentAnalysisTag, PlayerMatchStatistics } from '../types';

const TAB_OPTIONS = [
  'opponent-analysis',
  'line-up',
  'match-plan',
  'set-pieces',
  'events',
  'statistics'
] as const;

type MatchTab = (typeof TAB_OPTIONS)[number];

const opponentTagGroups: Array<{ key: 'build-up' | 'pressing' | 'block' | 'defensive-line' | 'offensive-transition' | 'defensive-transition'; title: string; values: Array<{ value: OpponentAnalysisTag; label: string }> }> = [
  { key: 'build-up', title: 'Build-up', values: [{ value: 'short', label: 'Short' }, { value: 'long', label: 'Long' }, { value: 'mixed', label: 'Mixed' }] },
  { key: 'pressing', title: 'Pressing', values: [{ value: 'high', label: 'High' }, { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' }] },
  { key: 'block', title: 'Block', values: [{ value: 'high', label: 'High' }, { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' }] },
  { key: 'defensive-line', title: 'Defensive Line', values: [{ value: 'high', label: 'High' }, { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' }] },
  { key: 'offensive-transition', title: 'Offensive Transition', values: [{ value: 'direct', label: 'Direct' }, { value: 'possession', label: 'Possession' }] },
  { key: 'defensive-transition', title: 'Defensive Transition', values: [{ value: 'immediate_pressure', label: 'Immediate Pressure' }, { value: 'retreat', label: 'Retreat' }] }
];

const EVENT_TYPE_OPTIONS: Array<{ value: MatchEventType; label: string }> = [
  { value: 'goal', label: 'Goal' },
  { value: 'assist', label: 'Assist' },
  { value: 'yellow_card', label: 'Yellow Card' },
  { value: 'red_card', label: 'Red Card' },
  { value: 'substitution_in', label: 'Substitution In' },
  { value: 'substitution_out', label: 'Substitution Out' },
  { value: 'own_goal', label: 'Own Goal' },
  { value: 'injury', label: 'Injury' },
  { value: 'other', label: 'Other' }
];

function getPathMatchId(): string | null {
  if (typeof window === 'undefined') return null;
  const match = window.location.pathname.match(/^\/matches\/([^/?#]+)/i);
  return match ? decodeURIComponent(match[1]) : null;
}

function formatDate(date: string): string {
  if (!date) return 'Date TBD';
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  const day = parsed.getDate();
  const month = parsed.toLocaleDateString('en-US', { month: 'short' });
  return `${day} ${month} ${parsed.getFullYear()}`;
}

function formatMatchStatusLabel(status: Match['status']): string {
  if (status === 'played') return 'Played';
  return 'Planned';
}

function toVideoEmbedUrl(input: string | null | undefined): string | null {
  if (!input) return null;
  const value = input.trim();
  if (!value) return null;

  try {
    const url = new URL(value);

    if (url.hostname.includes('youtube.com') || url.hostname.includes('youtu.be')) {
      const videoId = url.searchParams.get('v') || url.pathname.split('/').filter(Boolean).at(-1) || '';
      if (!videoId) return null;
      return `https://www.youtube.com/embed/${videoId}`;
    }

    if (url.hostname.includes('vimeo.com')) {
      const videoId = url.pathname.split('/').filter(Boolean).at(-1) || '';
      if (!videoId) return null;
      return `https://player.vimeo.com/video/${videoId}`;
    }

    return value;
  } catch {
    return null;
  }
}

function toSlideEmbedUrl(input: string | null | undefined): string | null {
  if (!input) return null;
  const value = input.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    if (!url.protocol.startsWith('http')) return null;
    return value;
  } catch {
    return null;
  }
}

function getEventLabel(eventType: MatchEventType): string {
  const map: Record<MatchEventType, string> = {
    goal: 'Goal',
    assist: 'Assist',
    yellow_card: 'Yellow Card',
    red_card: 'Red Card',
    substitution_in: 'Substitution In',
    substitution_out: 'Substitution Out',
    own_goal: 'Own Goal',
    injury: 'Injury',
    other: 'Other'
  };
  return map[eventType] || 'Event';
}

interface MatchCentreSectionProps {
  matches?: Match[];
  isLoadingMatches?: boolean;
  matchLoadError?: string | null;
}

export const MatchCentreSection: React.FC<MatchCentreSectionProps> = ({
  matches: providedMatches,
  isLoadingMatches,
  matchLoadError
}) => {
  const { selectedTeamId, availableTeams } = useTeamContext();
  const [matches, setMatches] = useState<Match[]>([]);
  const [matchesError, setMatchesError] = useState<string | null>(null);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(() => getPathMatchId());
  const [activeTab, setActiveTab] = useState<MatchTab>('opponent-analysis');
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [opponentAnalysis, setOpponentAnalysis] = useState<OpponentAnalysis | null>(null);
  const [lineupEntries, setLineupEntries] = useState<MatchLineupEntry[]>([]);
  const [events, setEvents] = useState<MatchEventModel[]>([]);
  const [stats, setStats] = useState<PlayerMatchStatistics[]>([]);
  const [matchPlan, setMatchPlan] = useState<Record<MatchPlanPhase, MatchPlanEntry | null>>({
    attack: null,
    defence: null,
    transitions: null
  });
  const [planDrafts, setPlanDrafts] = useState<Record<MatchPlanPhase, { notes: string; videoUrl: string; image1Url: string; image2Url: string; pdfUrl: string }>>({
    attack: { notes: '', videoUrl: '', image1Url: '', image2Url: '', pdfUrl: '' },
    defence: { notes: '', videoUrl: '', image1Url: '', image2Url: '', pdfUrl: '' },
    transitions: { notes: '', videoUrl: '', image1Url: '', image2Url: '', pdfUrl: '' }
  });
  const [matchSetPieces, setMatchSetPieces] = useState<MatchSetPieces | null>(null);
  const [setPiecesDraft, setSetPiecesDraft] = useState({
    attackingNotes: '',
    attackingVideoUrl: '',
    attackingImage1Url: '',
    attackingImage2Url: '',
    defensiveNotes: '',
    defensiveVideoUrl: '',
    defensiveImage1Url: '',
    defensiveImage2Url: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [newSlidesUrl, setNewSlidesUrl] = useState('');
  const [newVideoUrl, setNewVideoUrl] = useState('');
  const [newEventMinute, setNewEventMinute] = useState('45');
  const [newEventType, setNewEventType] = useState<MatchEventType>('goal');
  const [newEventPlayerId, setNewEventPlayerId] = useState('');
  const [newEventRelatedPlayerId, setNewEventRelatedPlayerId] = useState('');
  const [newEventDescription, setNewEventDescription] = useState('');
  const [lineupForm, setLineupForm] = useState({
    playerId: '',
    position: '',
    starter: true,
    shirtNumber: '',
    captain: false,
    minuteSubbedIn: '',
    minuteSubbedOut: '',
    notes: ''
  });
  const [editingLineupEntry, setEditingLineupEntry] = useState<MatchLineupEntry | null>(null);

  useEffect(() => {
    const handleRouteChange = () => {
      setSelectedMatchId(getPathMatchId());
    };

    window.addEventListener('popstate', handleRouteChange);
    window.addEventListener('hashchange', handleRouteChange);
    return () => {
      window.removeEventListener('popstate', handleRouteChange);
      window.removeEventListener('hashchange', handleRouteChange);
    };
  }, []);

  useEffect(() => {
    if (providedMatches) return;

    void (async () => {
      try {
        setIsLoading(true);
        setMatchesError(null);
        const nextMatches = await listMatches(selectedTeamId || null);
        setMatches(nextMatches);
      } catch (error) {
        console.error('[MatchCentreSection] Failed loading matches', error);
        setMatchesError(error instanceof Error ? error.message : 'Unable to load matches from Supabase.');
      } finally {
        setIsLoading(false);
      }
    })();
  }, [selectedTeamId, providedMatches]);

  const visibleMatches = providedMatches ?? matches;
  const visibleLoading = providedMatches ? Boolean(isLoadingMatches) : isLoading;
  const visibleError = providedMatches ? matchLoadError : matchesError;

  useEffect(() => {
    if (!selectedMatchId) {
      setSelectedMatch(null);
      return;
    }

    void (async () => {
      try {
        const nextMatch = await getMatchById(selectedMatchId);
        if (nextMatch) {
          setSelectedMatch(nextMatch);
          setActiveTab('opponent-analysis');
        } else {
          setSelectedMatch(null);
        }
      } catch (error) {
        console.error('[MatchCentreSection] Failed loading match', error);
        setSelectedMatch(null);
      }
    })();
  }, [selectedMatchId]);

  useEffect(() => {
    if (!selectedMatch) {
      setOpponentAnalysis(null);
      setLineupEntries([]);
      setEvents([]);
      setStats([]);
      return;
    }

    void (async () => {
      try {
        const [analysis, lineup, eventList, statsList, planList, setPieces] = await Promise.all([
          getOpponentAnalysisByMatchId(selectedMatch.id),
          getMatchLineup(selectedMatch.id),
          getMatchEvents(selectedMatch.id),
          getPlayerMatchStatistics(selectedMatch.id),
          getMatchPlan(selectedMatch.id),
          getMatchSetPieces(selectedMatch.id)
        ]);

        const nextPlan: Record<MatchPlanPhase, MatchPlanEntry | null> = {
          attack: null,
          defence: null,
          transitions: null
        };
        for (const entry of planList) {
          nextPlan[entry.phase] = entry;
        }

        let nextStats = statsList;
        if (nextStats.length === 0 && (lineup.length > 0 || eventList.length > 0)) {
          nextStats = await recalculatePlayerMatchStatistics(selectedMatch.id);
        }

        setOpponentAnalysis(analysis);
        setLineupEntries(lineup);
        setEvents(eventList);
        setStats(nextStats);
        setMatchPlan(nextPlan);
        setMatchSetPieces(setPieces);
        setPlanDrafts({
          attack: { notes: nextPlan.attack?.notes ?? '', videoUrl: nextPlan.attack?.videoUrl ?? '', image1Url: nextPlan.attack?.image1Url ?? '', image2Url: nextPlan.attack?.image2Url ?? '', pdfUrl: nextPlan.attack?.pdfUrl ?? '' },
          defence: { notes: nextPlan.defence?.notes ?? '', videoUrl: nextPlan.defence?.videoUrl ?? '', image1Url: nextPlan.defence?.image1Url ?? '', image2Url: nextPlan.defence?.image2Url ?? '', pdfUrl: nextPlan.defence?.pdfUrl ?? '' },
          transitions: { notes: nextPlan.transitions?.notes ?? '', videoUrl: nextPlan.transitions?.videoUrl ?? '', image1Url: nextPlan.transitions?.image1Url ?? '', image2Url: nextPlan.transitions?.image2Url ?? '', pdfUrl: nextPlan.transitions?.pdfUrl ?? '' }
        });
        setSetPiecesDraft({
          attackingNotes: setPieces?.attackingNotes ?? '',
          attackingVideoUrl: setPieces?.attackingVideoUrl ?? '',
          attackingImage1Url: setPieces?.attackingImage1Url ?? '',
          attackingImage2Url: setPieces?.attackingImage2Url ?? '',
          defensiveNotes: setPieces?.defensiveNotes ?? '',
          defensiveVideoUrl: setPieces?.defensiveVideoUrl ?? '',
          defensiveImage1Url: setPieces?.defensiveImage1Url ?? '',
          defensiveImage2Url: setPieces?.defensiveImage2Url ?? ''
        });
        setNewSlidesUrl(analysis?.slidesUrl ?? '');
        setNewVideoUrl(analysis?.videoUrl ?? '');
      } catch (error) {
        console.error('[MatchCentreSection] Failed loading match details', error);
        setOpponentAnalysis(null);
        setLineupEntries([]);
        setEvents([]);
        setStats([]);
        setMatchPlan({ attack: null, defence: null, transitions: null });
        setPlanDrafts({
          attack: { notes: '', videoUrl: '', image1Url: '', image2Url: '', pdfUrl: '' },
          defence: { notes: '', videoUrl: '', image1Url: '', image2Url: '', pdfUrl: '' },
          transitions: { notes: '', videoUrl: '', image1Url: '', image2Url: '', pdfUrl: '' }
        });
        setMatchSetPieces(null);
        setSetPiecesDraft({
          attackingNotes: '',
          attackingVideoUrl: '',
          attackingImage1Url: '',
          attackingImage2Url: '',
          defensiveNotes: '',
          defensiveVideoUrl: '',
          defensiveImage1Url: '',
          defensiveImage2Url: ''
        });
      }
    })();
  }, [selectedMatch]);

  const teamName = useMemo(() => {
    const known = availableTeams.find((team) => team.id === selectedTeamId);
    return known?.name || 'Our team';
  }, [availableTeams, selectedTeamId]);

  const openMatch = (matchId: string) => {
    setSelectedMatchId(matchId);
    const nextUrl = `/matches/${encodeURIComponent(matchId)}`;
    if (window.history.pushState) {
      window.history.pushState({}, '', nextUrl);
    }
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const closeDetail = () => {
    setSelectedMatchId(null);
    setSelectedMatch(null);
    if (window.history.pushState) {
      window.history.pushState({}, '', '/');
    }
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const handleToggleTag = async (tag: OpponentAnalysisTag) => {
    if (!selectedMatch) return;

    const existingTags = opponentAnalysis?.tags ?? [];
    const nextTags = existingTags.includes(tag)
      ? existingTags.filter((item) => item !== tag)
      : [...existingTags, tag];

    try {
      const updated = await createOrUpdateOpponentAnalysis({
        id: opponentAnalysis?.id,
        matchId: selectedMatch.id,
        opponentTeamId: selectedMatch.opponentTeamId,
        summary: opponentAnalysis?.summary ?? '',
        tags: nextTags,
        slidesUrl: opponentAnalysis?.slidesUrl ?? null,
        videoUrl: opponentAnalysis?.videoUrl ?? null
      });
      setOpponentAnalysis(updated);
    } catch (error) {
      console.error('[MatchCentreSection] Failed saving opponent analysis tags', error);
    }
  };

  const handlePersistUrl = async (kind: 'slides' | 'video') => {
    if (!selectedMatch) return;

    try {
      const updated = kind === 'slides'
        ? await updateOpponentAnalysisSlidesUrl(selectedMatch.id, newSlidesUrl || null)
        : await updateOpponentAnalysisVideoUrl(selectedMatch.id, newVideoUrl || null);
      setOpponentAnalysis(updated);
    } catch (error) {
      console.error('[MatchCentreSection] Failed saving opponent analysis URL', error);
    }
  };

  const handleAddEvent = async () => {
    if (!selectedMatch) return;

    try {
      const created = await createMatchEvent({
        matchId: selectedMatch.id,
        playerId: newEventPlayerId || null,
        teamSide: 'our_team',
        eventType: newEventType,
        minute: Number(newEventMinute) || 0,
        relatedPlayerId: newEventRelatedPlayerId || null,
        description: newEventDescription || ''
      });

      const nextEvents = [...events, created].sort((a, b) => a.minute - b.minute);
      setEvents(nextEvents);
      setNewEventMinute('45');
      setNewEventType('goal');
      setNewEventPlayerId('');
      setNewEventRelatedPlayerId('');
      setNewEventDescription('');

      const nextStats = await recalculatePlayerMatchStatistics(selectedMatch.id);
      setStats(nextStats);
    } catch (error) {
      console.error('[MatchCentreSection] Failed creating match event', error);
    }
  };

  const openLineupForm = (entry?: MatchLineupEntry) => {
    setEditingLineupEntry(entry ?? null);
    setLineupForm({
      playerId: entry?.playerId ?? '',
      position: entry?.position ?? '',
      starter: entry?.starter ?? true,
      shirtNumber: entry?.shirtNumber !== null && entry?.shirtNumber !== undefined ? String(entry.shirtNumber) : '',
      captain: entry?.captain ?? false,
      minuteSubbedIn: entry?.minuteSubbedIn !== null && entry?.minuteSubbedIn !== undefined ? String(entry.minuteSubbedIn) : '',
      minuteSubbedOut: entry?.minuteSubbedOut !== null && entry?.minuteSubbedOut !== undefined ? String(entry.minuteSubbedOut) : '',
      notes: entry?.notes ?? ''
    });
  };

  const handleSaveLineupEntry = async () => {
    if (!selectedMatch || !lineupForm.playerId.trim()) return;

    const saved = await upsertMatchLineupEntry({
      id: editingLineupEntry?.id,
      matchId: selectedMatch.id,
      playerId: lineupForm.playerId.trim(),
      position: lineupForm.position.trim(),
      starter: lineupForm.starter,
      shirtNumber: lineupForm.shirtNumber === '' ? null : Number(lineupForm.shirtNumber),
      captain: lineupForm.captain,
      minuteSubbedIn: lineupForm.minuteSubbedIn === '' ? null : Number(lineupForm.minuteSubbedIn),
      minuteSubbedOut: lineupForm.minuteSubbedOut === '' ? null : Number(lineupForm.minuteSubbedOut),
      notes: lineupForm.notes.trim() || null
    });

    setLineupEntries((current) => {
      const filtered = current.filter((entry) => entry.playerId !== saved.playerId);
      return [...filtered, saved].sort((a, b) => Number(b.starter) - Number(a.starter) || (a.shirtNumber ?? 999) - (b.shirtNumber ?? 999) || a.playerId.localeCompare(b.playerId));
    });
    setEditingLineupEntry(null);
    setLineupForm({
      playerId: '',
      position: '',
      starter: true,
      shirtNumber: '',
      captain: false,
      minuteSubbedIn: '',
      minuteSubbedOut: '',
      notes: ''
    });

    const nextStats = await recalculatePlayerMatchStatistics(selectedMatch.id);
    setStats(nextStats);
  };

  const handleRemoveLineupEntry = async (entryId: string) => {
    if (!selectedMatch) return;

    await removeMatchLineupEntry(entryId);
    setLineupEntries((current) => current.filter((entry) => entry.id !== entryId));
    const nextStats = await recalculatePlayerMatchStatistics(selectedMatch.id);
    setStats(nextStats);
  };

  const renderOpponentAnalysisTab = () => {
    if (!selectedMatch) return null;

    return (
      <div className="space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <TeamCrest name={selectedMatch.opponentName || 'Opponent'} logoUrl={selectedMatch.opponentLogoUrl} className="h-11 w-11 rounded-xl border border-slate-200 bg-white p-1" />
              <div>
                <h3 className="text-lg font-black text-slate-900">Opponent Analysis</h3>
                <span className="text-[11px] font-bold uppercase text-slate-500">{selectedMatch.opponentName || 'Opponent'}</span>
              </div>
            </div>
          </div>

          <div className="space-y-5">
            {opponentTagGroups.map((group) => (
              <div key={group.key} className="space-y-2">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">{group.title}</p>
                <div className="flex flex-wrap gap-2">
                  {group.values.map((option) => {
                    const selected = (opponentAnalysis?.tags ?? []).includes(option.value);
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => void handleToggleTag(option.value)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-bold transition-all ${
                          selected
                            ? 'bg-[#002142] text-white border-[#002142]'
                            : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Video className="w-4 h-4 text-slate-700" />
              <h3 className="text-base font-black text-slate-900">Google Slides</h3>
            </div>
            <div className="space-y-3">
              <input
                value={newSlidesUrl}
                onChange={(event) => setNewSlidesUrl(event.target.value)}
                placeholder="https://docs.google.com/presentation/..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-sky-500"
              />
              <button
                type="button"
                onClick={() => void handlePersistUrl('slides')}
                className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-3 py-2 text-xs font-bold text-white"
              >
                <Save className="w-3.5 h-3.5" />
                Save URL
              </button>
              {toSlideEmbedUrl(newSlidesUrl) && (
                <iframe
                  title="Google Slides preview"
                  src={newSlidesUrl}
                  className="h-56 w-full rounded-xl border border-slate-200 bg-slate-100"
                />
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <PlayCircle className="w-4 h-4 text-slate-700" />
              <h3 className="text-base font-black text-slate-900">Video Analysis</h3>
            </div>
            <div className="space-y-3">
              <input
                value={newVideoUrl}
                onChange={(event) => setNewVideoUrl(event.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-sky-500"
              />
              <button
                type="button"
                onClick={() => void handlePersistUrl('video')}
                className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-3 py-2 text-xs font-bold text-white"
              >
                <Save className="w-3.5 h-3.5" />
                Save Video
              </button>
              {toVideoEmbedUrl(newVideoUrl) && (
                <iframe
                  title="Match video preview"
                  src={toVideoEmbedUrl(newVideoUrl) ?? ''}
                  className="h-56 w-full rounded-xl border border-slate-200 bg-slate-100"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderLineupTab = () => {
    if (!selectedMatch) return null;

    return (
      <div className="space-y-5">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-black text-slate-900">Line-up</h3>
            <button type="button" onClick={() => openLineupForm()} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white">
              <Plus className="w-3.5 h-3.5" />
              Add Player
            </button>
          </div>

          {(editingLineupEntry !== null || lineupForm.playerId || lineupForm.position || lineupForm.notes) && (
            <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <input value={lineupForm.playerId} onChange={(event) => setLineupForm((current) => ({ ...current, playerId: event.target.value }))} placeholder="Player ID" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs" />
                <input value={lineupForm.position} onChange={(event) => setLineupForm((current) => ({ ...current, position: event.target.value }))} placeholder="Position" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs" />
                <input value={lineupForm.shirtNumber} onChange={(event) => setLineupForm((current) => ({ ...current, shirtNumber: event.target.value }))} placeholder="Shirt number" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs" />
                <input value={lineupForm.minuteSubbedIn} onChange={(event) => setLineupForm((current) => ({ ...current, minuteSubbedIn: event.target.value }))} placeholder="Subbed in minute" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs" />
                <input value={lineupForm.minuteSubbedOut} onChange={(event) => setLineupForm((current) => ({ ...current, minuteSubbedOut: event.target.value }))} placeholder="Subbed out minute" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs" />
                <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700">
                  Starter
                  <input type="checkbox" checked={lineupForm.starter} onChange={(event) => setLineupForm((current) => ({ ...current, starter: event.target.checked }))} className="h-4 w-4" />
                </label>
                <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700">
                  Captain
                  <input type="checkbox" checked={lineupForm.captain} onChange={(event) => setLineupForm((current) => ({ ...current, captain: event.target.checked }))} className="h-4 w-4" />
                </label>
              </div>
              <textarea value={lineupForm.notes} onChange={(event) => setLineupForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Notes" className="min-h-[80px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs" />
              <div className="flex items-center justify-end gap-2">
                <button type="button" onClick={() => {
                  setEditingLineupEntry(null);
                  setLineupForm({ playerId: '', position: '', starter: true, shirtNumber: '', captain: false, minuteSubbedIn: '', minuteSubbedOut: '', notes: '' });
                }} className="rounded-xl bg-slate-200 px-3 py-2 text-[11px] font-bold text-slate-700">Cancel</button>
                <button type="button" onClick={() => void handleSaveLineupEntry()} className="rounded-xl bg-emerald-600 px-3 py-2 text-[11px] font-bold text-white">Save player</button>
              </div>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {lineupEntries.length === 0 ? (
              <div className="md:col-span-2 xl:col-span-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-xs font-medium text-slate-500">
                No lineup entries yet for this match.
              </div>
            ) : (
              lineupEntries.map((entry) => (
                <div key={entry.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-black text-slate-900">{entry.playerId}</span>
                    <div className="flex items-center gap-2">
                      {entry.captain && <span className="text-[10px] font-black uppercase tracking-wider text-amber-700">Captain</span>}
                      <button type="button" onClick={() => openLineupForm(entry)} className="text-[10px] font-bold text-sky-700">Edit</button>
                      <button type="button" onClick={() => void handleRemoveLineupEntry(entry.id)} className="text-[10px] font-bold text-rose-600">Remove</button>
                    </div>
                  </div>
                  <div className="mt-3 space-y-2 text-xs text-slate-600">
                    <div className="flex items-center justify-between"><span>Position</span><strong>{entry.position || 'TBD'}</strong></div>
                    <div className="flex items-center justify-between"><span>Starter</span><strong>{entry.starter ? 'Yes' : 'No'}</strong></div>
                    <div className="flex items-center justify-between"><span>Shirt</span><strong>{entry.shirtNumber ?? '—'}</strong></div>
                    {entry.minuteSubbedIn !== null && entry.minuteSubbedIn !== undefined && (
                      <div className="flex items-center justify-between"><span>Sub In</span><strong>{entry.minuteSubbedIn}'</strong></div>
                    )}
                    {entry.minuteSubbedOut !== null && entry.minuteSubbedOut !== undefined && (
                      <div className="flex items-center justify-between"><span>Sub Out</span><strong>{entry.minuteSubbedOut}'</strong></div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  };

  const savePlanPhase = async (phase: MatchPlanPhase, form: { notes: string; videoUrl: string; image1Url: string; image2Url: string; pdfUrl: string }) => {
    if (!selectedMatch) return;

    const updated = await upsertMatchPlanPhase({
      matchId: selectedMatch.id,
      phase,
      notes: form.notes,
      videoUrl: form.videoUrl || null,
      image1Url: form.image1Url || null,
      image2Url: form.image2Url || null,
      pdfUrl: form.pdfUrl || null,
      id: matchPlan[phase]?.id
    });

    setMatchPlan((current) => ({ ...current, [phase]: updated }));
    setPlanDrafts((current) => ({
      ...current,
      [phase]: { notes: updated.notes ?? '', videoUrl: updated.videoUrl ?? '', image1Url: updated.image1Url ?? '', image2Url: updated.image2Url ?? '', pdfUrl: updated.pdfUrl ?? '' }
    }));
  };

  const saveSetPieces = async (form: {
    attackingNotes: string;
    attackingVideoUrl: string;
    attackingImage1Url: string;
    attackingImage2Url: string;
    defensiveNotes: string;
    defensiveVideoUrl: string;
    defensiveImage1Url: string;
    defensiveImage2Url: string;
  }) => {
    if (!selectedMatch) return;

    const updated = await upsertMatchSetPieces({
      matchId: selectedMatch.id,
      id: matchSetPieces?.id,
      attackingNotes: form.attackingNotes,
      attackingVideoUrl: form.attackingVideoUrl || null,
      attackingImage1Url: form.attackingImage1Url || null,
      attackingImage2Url: form.attackingImage2Url || null,
      defensiveNotes: form.defensiveNotes,
      defensiveVideoUrl: form.defensiveVideoUrl || null,
      defensiveImage1Url: form.defensiveImage1Url || null,
      defensiveImage2Url: form.defensiveImage2Url || null
    });

    setMatchSetPieces(updated);
    setSetPiecesDraft({
      attackingNotes: updated.attackingNotes ?? '',
      attackingVideoUrl: updated.attackingVideoUrl ?? '',
      attackingImage1Url: updated.attackingImage1Url ?? '',
      attackingImage2Url: updated.attackingImage2Url ?? '',
      defensiveNotes: updated.defensiveNotes ?? '',
      defensiveVideoUrl: updated.defensiveVideoUrl ?? '',
      defensiveImage1Url: updated.defensiveImage1Url ?? '',
      defensiveImage2Url: updated.defensiveImage2Url ?? ''
    });
  };

  const renderPlanTab = () => {
    return (
      <div className="space-y-4">
        {(Object.keys(planDrafts) as MatchPlanPhase[]).map((phase) => {
          const label = phase === 'attack' ? 'Attack' : phase === 'defence' ? 'Defence' : 'Transitions';
          const draft = planDrafts[phase];

          return (
            <div key={phase} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-base font-black text-slate-900">{label}</h4>
                <button
                  type="button"
                  onClick={() => void savePlanPhase(phase, draft)}
                  className="rounded-xl bg-sky-600 px-3 py-2 text-[11px] font-black uppercase tracking-wider text-white"
                >
                  Save
                </button>
              </div>

              <div className="space-y-3">
                <textarea value={draft.notes} onChange={(event) => setPlanDrafts((current) => ({ ...current, [phase]: { ...current[phase], notes: event.target.value } }))} placeholder="Notes" className="min-h-[120px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800" />
                <input value={draft.videoUrl} onChange={(event) => setPlanDrafts((current) => ({ ...current, [phase]: { ...current[phase], videoUrl: event.target.value } }))} placeholder="Video URL" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800" />
                {toVideoEmbedUrl(draft.videoUrl) && (
                  <iframe title={`${label} video preview`} src={toVideoEmbedUrl(draft.videoUrl) ?? ''} className="h-40 w-full rounded-xl border border-slate-200 bg-slate-100" allowFullScreen />
                )}
                <input value={draft.image1Url} onChange={(event) => setPlanDrafts((current) => ({ ...current, [phase]: { ...current[phase], image1Url: event.target.value } }))} placeholder="Image 1 URL" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800" />
                {draft.image1Url && <img src={draft.image1Url} alt={`${label} image 1`} className="h-32 w-full rounded-xl object-cover" />}
                <input value={draft.image2Url} onChange={(event) => setPlanDrafts((current) => ({ ...current, [phase]: { ...current[phase], image2Url: event.target.value } }))} placeholder="Image 2 URL" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800" />
                {draft.image2Url && <img src={draft.image2Url} alt={`${label} image 2`} className="h-32 w-full rounded-xl object-cover" />}
                <input value={draft.pdfUrl} onChange={(event) => setPlanDrafts((current) => ({ ...current, [phase]: { ...current[phase], pdfUrl: event.target.value } }))} placeholder="PDF URL" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800" />
                {draft.pdfUrl && <a href={draft.pdfUrl} target="_blank" rel="noreferrer" className="inline-flex rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-sky-700">Open PDF</a>}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderSetPiecesTab = () => {
    if (!selectedMatch) return null;

    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-black text-slate-900">Attacking Set Pieces</h3>
            <button type="button" onClick={() => void saveSetPieces(setPiecesDraft)} className="rounded-xl bg-sky-600 px-3 py-2 text-[11px] font-black uppercase tracking-wider text-white">Save</button>
          </div>
          <div className="space-y-3">
            <textarea value={setPiecesDraft.attackingNotes} onChange={(event) => setSetPiecesDraft((current) => ({ ...current, attackingNotes: event.target.value }))} placeholder="Notes" className="min-h-[100px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs" />
            <input value={setPiecesDraft.attackingVideoUrl} onChange={(event) => setSetPiecesDraft((current) => ({ ...current, attackingVideoUrl: event.target.value }))} placeholder="Video URL" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs" />
            {toVideoEmbedUrl(setPiecesDraft.attackingVideoUrl) && <iframe title="Attacking set pieces video" src={toVideoEmbedUrl(setPiecesDraft.attackingVideoUrl) ?? ''} className="h-40 w-full rounded-xl border border-slate-200" allowFullScreen />}
            <input value={setPiecesDraft.attackingImage1Url} onChange={(event) => setSetPiecesDraft((current) => ({ ...current, attackingImage1Url: event.target.value }))} placeholder="Image 1 URL" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs" />
            {setPiecesDraft.attackingImage1Url && <img src={setPiecesDraft.attackingImage1Url} alt="Attacking set pieces image 1" className="h-32 w-full rounded-xl object-cover" />}
            <input value={setPiecesDraft.attackingImage2Url} onChange={(event) => setSetPiecesDraft((current) => ({ ...current, attackingImage2Url: event.target.value }))} placeholder="Image 2 URL" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs" />
            {setPiecesDraft.attackingImage2Url && <img src={setPiecesDraft.attackingImage2Url} alt="Attacking set pieces image 2" className="h-32 w-full rounded-xl object-cover" />}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-black text-slate-900">Defensive Set Pieces</h3>
            <button type="button" onClick={() => void saveSetPieces(setPiecesDraft)} className="rounded-xl bg-sky-600 px-3 py-2 text-[11px] font-black uppercase tracking-wider text-white">Save</button>
          </div>
          <div className="space-y-3">
            <textarea value={setPiecesDraft.defensiveNotes} onChange={(event) => setSetPiecesDraft((current) => ({ ...current, defensiveNotes: event.target.value }))} placeholder="Notes" className="min-h-[100px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs" />
            <input value={setPiecesDraft.defensiveVideoUrl} onChange={(event) => setSetPiecesDraft((current) => ({ ...current, defensiveVideoUrl: event.target.value }))} placeholder="Video URL" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs" />
            {toVideoEmbedUrl(setPiecesDraft.defensiveVideoUrl) && <iframe title="Defensive set pieces video" src={toVideoEmbedUrl(setPiecesDraft.defensiveVideoUrl) ?? ''} className="h-40 w-full rounded-xl border border-slate-200" allowFullScreen />}
            <input value={setPiecesDraft.defensiveImage1Url} onChange={(event) => setSetPiecesDraft((current) => ({ ...current, defensiveImage1Url: event.target.value }))} placeholder="Image 1 URL" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs" />
            {setPiecesDraft.defensiveImage1Url && <img src={setPiecesDraft.defensiveImage1Url} alt="Defensive set pieces image 1" className="h-32 w-full rounded-xl object-cover" />}
            <input value={setPiecesDraft.defensiveImage2Url} onChange={(event) => setSetPiecesDraft((current) => ({ ...current, defensiveImage2Url: event.target.value }))} placeholder="Image 2 URL" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs" />
            {setPiecesDraft.defensiveImage2Url && <img src={setPiecesDraft.defensiveImage2Url} alt="Defensive set pieces image 2" className="h-32 w-full rounded-xl object-cover" />}
          </div>
        </div>
      </div>
    );
  };

  const renderEventsTab = () => {
    if (!selectedMatch) return null;

    return (
      <div className="space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-black text-slate-900">Events</h3>
            <button type="button" className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white">
              <Plus className="w-3.5 h-3.5" />
              Add Event
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <input value={newEventMinute} onChange={(event) => setNewEventMinute(event.target.value)} placeholder="Minute" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs" />
            <select value={newEventType} onChange={(event) => setNewEventType(event.target.value as MatchEventType)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
              {EVENT_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <input value={newEventPlayerId} onChange={(event) => setNewEventPlayerId(event.target.value)} placeholder="Player ID" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs" />
            <input value={newEventRelatedPlayerId} onChange={(event) => setNewEventRelatedPlayerId(event.target.value)} placeholder="Related Player ID" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs" />
            <button type="button" onClick={() => void handleAddEvent()} className="rounded-xl bg-sky-600 px-3 py-2 text-xs font-bold text-white">
              Save event
            </button>
          </div>

          <textarea
            value={newEventDescription}
            onChange={(event) => setNewEventDescription(event.target.value)}
            placeholder="Description"
            className="mt-3 min-h-[90px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs"
          />
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="space-y-3">
            {events.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-xs font-medium text-slate-500">
                No events recorded yet.
              </div>
            ) : (
              events.slice().sort((a, b) => a.minute - b.minute).map((event) => (
                <div key={event.id} className="border-l-2 border-sky-200 pl-4">
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                    <span>{event.minute}'</span>
                    <span>{getEventLabel(event.eventType)}</span>
                  </div>
                  <div className="mt-1 text-sm font-bold text-slate-900">{event.playerId || 'Unknown player'}</div>
                  {event.relatedPlayerId && <div className="text-xs text-slate-500">Related: {event.relatedPlayerId}</div>}
                  {event.description && <div className="mt-1 text-xs text-slate-600">{event.description}</div>}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderStatisticsTab = () => {
    if (!selectedMatch) return null;

    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <h3 className="mb-4 text-lg font-black text-slate-900">Statistics</h3>
        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="px-3 py-2 font-black">Player</th>
                <th className="px-3 py-2 font-black">Starter</th>
                <th className="px-3 py-2 font-black">Minutes</th>
                <th className="px-3 py-2 font-black">Goals</th>
                <th className="px-3 py-2 font-black">Assists</th>
                <th className="px-3 py-2 font-black">Yellows</th>
                <th className="px-3 py-2 font-black">Reds</th>
              </tr>
            </thead>
            <tbody>
              {stats.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-slate-500">No statistics recorded yet.</td>
                </tr>
              ) : (
                stats.map((stat) => (
                  <tr key={stat.id} className="border-t border-slate-200">
                    <td className="px-3 py-2 font-bold text-slate-900">{stat.playerId}</td>
                    <td className="px-3 py-2 text-slate-700">{stat.starts ? 'Yes' : 'No'}</td>
                    <td className="px-3 py-2 text-slate-700">{stat.minutesPlayed}</td>
                    <td className="px-3 py-2 text-slate-700">{stat.goals}</td>
                    <td className="px-3 py-2 text-slate-700">{stat.assists}</td>
                    <td className="px-3 py-2 text-slate-700">{stat.yellowCards}</td>
                    <td className="px-3 py-2 text-slate-700">{stat.redCards}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  if (selectedMatchId && selectedMatch) {
    const opponentName = selectedMatch.opponentName || 'Opponent';
    const homeTeamName = selectedMatch.isHome ? teamName : opponentName;
    const awayTeamName = selectedMatch.isHome ? opponentName : teamName;

    return (
      <div className="space-y-6">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-[#002142] via-[#153f67] to-[#002142] p-5 text-white">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <button type="button" onClick={closeDetail} className="rounded-xl bg-white/10 p-2 text-white">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-sky-200">{selectedMatch.competitionName}</div>
                  <h2 className="mt-1 text-2xl font-black">{homeTeamName} vs {awayTeamName}</h2>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 rounded-2xl bg-white/10 p-2">
                  <TeamCrest name={teamName} isAlula className="h-10 w-10 rounded-full border border-white/20 bg-white/10 p-1" />
                  <span className="font-black">{teamName}</span>
                </div>
                <span className="text-xs font-black text-sky-200">VS</span>
                <div className="flex items-center gap-2 rounded-2xl bg-white/10 p-2">
                  <TeamCrest name={opponentName} logoUrl={selectedMatch.opponentLogoUrl} className="h-10 w-10 rounded-full border border-white/20 bg-white/10 p-1" />
                  <span className="font-black">{opponentName}</span>
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-4 text-sm text-slate-200">
              <span className="inline-flex items-center gap-2"><CalendarDays className="w-4 h-4" />{formatDate(selectedMatch.date)}</span>
              <span className="inline-flex items-center gap-2"><MapPin className="w-4 h-4" />{selectedMatch.venue || selectedMatch.location || 'Venue TBD'}</span>
              <span className="inline-flex items-center gap-2"><Trophy className="w-4 h-4" />{formatMatchStatusLabel(selectedMatch.status)}</span>
              {selectedMatch.ourScore !== null && selectedMatch.ourScore !== undefined && selectedMatch.opponentScore !== null && selectedMatch.opponentScore !== undefined && (
                <span className="inline-flex items-center gap-2"><Swords className="w-4 h-4" />{selectedMatch.ourScore} - {selectedMatch.opponentScore}</span>
              )}
            </div>
          </div>

          <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
            <div className="flex flex-wrap gap-2">
              {TAB_OPTIONS.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-xl border px-3 py-2 text-[11px] font-black uppercase tracking-wider transition ${
                    activeTab === tab
                      ? 'border-[#002142] bg-[#002142] text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {tab === 'opponent-analysis' ? 'Opponent Analysis' : tab === 'line-up' ? 'Line-up' : tab === 'match-plan' ? 'Match Plan' : tab === 'set-pieces' ? 'Set Pieces' : tab === 'events' ? 'Events' : 'Statistics'}
                </button>
              ))}
            </div>
          </div>

          <div className="p-5">
            {activeTab === 'opponent-analysis' && renderOpponentAnalysisTab()}
            {activeTab === 'line-up' && renderLineupTab()}
            {activeTab === 'match-plan' && renderPlanTab()}
            {activeTab === 'set-pieces' && renderSetPiecesTab()}
            {activeTab === 'events' && renderEventsTab()}
            {activeTab === 'statistics' && renderStatisticsTab()}
          </div>
        </div>
      </div>
    );
  }

  if (visibleLoading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
        Loading matches…
      </div>
    );
  }

  if (visibleError) {
    return (
      <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800 shadow-sm">
        <p className="font-black">Unable to load matches.</p>
        <p className="mt-1 text-xs font-medium">{visibleError}</p>
      </div>
    );
  }

  if (visibleMatches.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
        No matches available yet.
      </div>
    );
  }

  const opponentClubs = Array.from(
    new Map(visibleMatches.map((match) => [
      match.opponentTeamId,
      {
        id: match.opponentTeamId,
        name: match.opponentName || 'Opponent',
        logoUrl: match.opponentLogoUrl
      }
    ])).values()
  ).sort((first, second) => first.name.localeCompare(second.name));

  return (
    <div className="space-y-7">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {visibleMatches.map((match) => {
        const opponentName = match.opponentName || 'Opponent';
        const homeTeam = match.isHome
          ? { name: teamName, isAlula: true, logoUrl: null }
          : { name: opponentName, isAlula: false, logoUrl: match.opponentLogoUrl };
        const awayTeam = match.isHome
          ? { name: opponentName, isAlula: false, logoUrl: match.opponentLogoUrl }
          : { name: teamName, isAlula: true, logoUrl: null };
        const hasScore = match.ourScore !== null && match.ourScore !== undefined
          && match.opponentScore !== null && match.opponentScore !== undefined;
        const homeScore = match.isHome ? match.ourScore : match.opponentScore;
        const awayScore = match.isHome ? match.opponentScore : match.ourScore;

        const renderTeam = (team: { name: string; isAlula: boolean; logoUrl?: string | null }, side: 'Home' | 'Away') => (
          <div className="flex min-w-0 flex-1 flex-col items-center text-center">
            <TeamCrest name={team.name} logoUrl={team.logoUrl} isAlula={team.isAlula} />
            <span className="mt-3 text-[10px] font-black uppercase text-slate-400">{side}</span>
            <span className="mt-1 min-h-10 text-sm font-black leading-5 text-slate-900">{team.name}</span>
          </div>
        );

        return (
          <article key={match.id} className="flex min-h-[390px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-md">
            <div className="border-b border-slate-100 bg-[#002142] px-5 py-3 text-center text-[10px] font-black uppercase text-white">
              {match.competitionName}
            </div>

            <div className="flex flex-1 flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                {renderTeam(homeTeam, 'Home')}
                <div className="flex min-w-12 flex-col items-center pt-5">
                  {hasScore ? (
                    <span className="rounded-xl bg-slate-900 px-3 py-2 text-lg font-black text-white">{homeScore} - {awayScore}</span>
                  ) : (
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-black text-amber-800">VS</span>
                  )}
                </div>
                {renderTeam(awayTeam, 'Away')}
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 border-y border-slate-100 py-4 text-center">
                <div>
                  <div className="text-[10px] font-black uppercase text-slate-400">Date</div>
                  <div className="mt-1 text-sm font-black text-slate-800">{formatDate(match.date)}</div>
                </div>
                <div className="border-l border-slate-100">
                  <div className="text-[10px] font-black uppercase text-slate-400">Kick-off</div>
                  <div className="mt-1 text-sm font-black text-slate-800">{match.time || 'TBD'}</div>
                </div>
              </div>

              <div className="mt-4 flex items-start gap-2 text-xs font-semibold leading-5 text-slate-600">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <span>{match.venue || match.location || 'Venue TBD'}</span>
              </div>

              <div className="mt-auto flex items-center justify-between gap-3 pt-5">
                <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase ${match.status === 'played' ? 'border-slate-200 bg-slate-100 text-slate-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                  {formatMatchStatusLabel(match.status)}
                </span>
                <button type="button" onClick={() => openMatch(match.id)} className="inline-flex items-center gap-1.5 rounded-xl bg-[#002142] px-3 py-2 text-[10px] font-black uppercase text-white transition hover:bg-[#0b3a64]">
                  <Eye className="h-3.5 w-3.5" />
                  View details
                </button>
              </div>
            </div>
          </article>
        );
        })}
      </div>

      <div className="border-t border-slate-200 pt-6">
        <div className="mb-4">
          <h2 className="text-base font-black text-[#002142]">Clubs / Teams</h2>
          <p className="mt-1 text-xs font-medium text-slate-500">Official opponents in the current competition calendar.</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
          {opponentClubs.map((club) => (
            <div key={club.id} className="flex min-h-32 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm">
              <TeamCrest name={club.name} logoUrl={club.logoUrl} className="h-14 w-14" />
              <span className="mt-3 text-xs font-black leading-4 text-slate-800">{club.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
