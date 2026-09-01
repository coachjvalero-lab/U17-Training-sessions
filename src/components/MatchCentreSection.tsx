import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactPlayer from 'react-player';
import { Activity, CalendarDays, Check, ChevronLeft, Edit3, Eye, Flag, MapPin, PlayCircle, Plus, Save, Shield, Sparkles, Swords, Trash2, Trophy, Users, Video, X } from 'lucide-react';
import { TeamCrest } from './TeamCrest';
import { useTeamContext } from '../contexts/TeamContext';
import {
  batchCreateMatchEvents,
  createMatchEvent,
  deleteMatchEvent,
  getMatchEvents,
  updateMatchEvent
} from '../services/matches/matchEventsService';
import { createMatch, deleteMatch, getMatchById, listMatches, updateMatch } from '../services/matches/matchService';
import {
  createOrUpdateOpponentAnalysis,
  getOpponentAnalysisByOpponentTeamId
} from '../services/matches/opponentAnalysisService';
import { batchUpdateMatchLineupEntries, getMatchLineup, updateMatchLineupEntry, type ExistingMatchLineupEntryUpdate } from '../services/matches/matchLineupService';
import { MatchPitchBoard } from './MatchPitchBoard';
import { getMatchPlan, upsertMatchPlanPhase } from '../services/matches/matchPlanService';
import { getMatchSetPieces, upsertMatchSetPieces } from '../services/matches/matchSetPiecesService';
import { derivePlayerMatchStatsFromData, getPlayerMatchStatistics, recalculatePlayerMatchStatistics } from '../services/matches/playerMatchStatisticsService';
import { subscribeToSquadPlayers, type CloudSquadPlayer } from '../services/squad/squadService';
import type { Match, MatchEvent as MatchEventModel, MatchEventType, MatchLineupEntry, MatchPlanEntry, MatchPlanPhase, MatchSetPieces, OpponentAnalysis, OpponentAnalysisTag, PlayerMatchStatistics, TeamSide } from '../types';
import { formatVideoTimestamp, toSlideEmbedUrl, toVideoEmbedUrl } from '../utils/mediaUrls';
import { AiMatchEventsModal } from './AiMatchEventsModal';
import { MatchEditModal } from './MatchEditModal';
import { selectCalledUpPlayers } from '../utils/matchLineup';

const TAB_OPTIONS = [
  'opponent-analysis',
  'line-up',
  'match-plan',
  'set-pieces',
  'events',
  'statistics'
] as const;

type MatchTab = (typeof TAB_OPTIONS)[number];
type SaveState = 'idle' | 'saving' | 'saved' | 'error';

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
  { value: 'opponent_goal', label: 'Opponent Goal' },
  { value: 'corner', label: 'Corner' },
  { value: 'opponent_corner', label: 'Opponent Corner' },
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

function getEventLabel(eventType: MatchEventType): string {
  const map: Record<MatchEventType, string> = {
    goal: 'Goal',
    opponent_goal: 'Opponent Goal',
    corner: 'Corner',
    opponent_corner: 'Opponent Corner',
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
  currentLogo?: string | null;
  onMatchUpdated?: (updatedMatch: Match) => void;
  onMatchDeleted?: (deletedMatchId: string) => void;
}

export const MatchCentreSection: React.FC<MatchCentreSectionProps> = ({
  matches: providedMatches,
  isLoadingMatches,
  matchLoadError,
  currentLogo,
  onMatchUpdated,
  onMatchDeleted
}) => {
  const { selectedTeamId, availableTeams } = useTeamContext();
  const [matches, setMatches] = useState<Match[]>([]);
  const [matchesError, setMatchesError] = useState<string | null>(null);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(() => getPathMatchId());
  const [activeTab, setActiveTab] = useState<MatchTab>('opponent-analysis');
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [isMatchEditModalOpen, setIsMatchEditModalOpen] = useState(false);
  const [matchToEdit, setMatchToEdit] = useState<Match | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'planned' | 'played'>('all');
  const [searchQuery, setSearchQuery] = useState('');
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
  const [analysisSummary, setAnalysisSummary] = useState('');
  const [analysisTags, setAnalysisTags] = useState<OpponentAnalysisTag[]>([]);
  const [isLoadingWorkspace, setIsLoadingWorkspace] = useState(false);
  const [workspaceLoadError, setWorkspaceLoadError] = useState<string | null>(null);
  const [saveStates, setSaveStates] = useState<Record<string, { state: SaveState; message?: string }>>({});
  const [newEventMinute, setNewEventMinute] = useState('0');
  const [newEventType, setNewEventType] = useState<MatchEventType>('goal');
  const [newEventPlayerId, setNewEventPlayerId] = useState('');
  const [newEventRelatedPlayerId, setNewEventRelatedPlayerId] = useState('');
  const [newEventDescription, setNewEventDescription] = useState('');
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [matchVideoUrl, setMatchVideoUrl] = useState('');
  const [currentVideoSeconds, setCurrentVideoSeconds] = useState(0);
  const [isAiEventsModalOpen, setIsAiEventsModalOpen] = useState(false);
  const videoPlayerRef = useRef<HTMLVideoElement | null>(null);
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
  const [isLineupFormOpen, setIsLineupFormOpen] = useState(false);
  const [squadPlayers, setSquadPlayers] = useState<CloudSquadPlayer[]>([]);

  const calledUpPlayers = useMemo(
    () => selectCalledUpPlayers(squadPlayers, lineupEntries),
    [lineupEntries, squadPlayers]
  );

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

  useEffect(() => subscribeToSquadPlayers(setSquadPlayers, (error) => {
    console.error('[MatchCentreSection] Failed loading squad', error);
  }), []);

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
        setIsLoadingWorkspace(true);
        setWorkspaceLoadError(null);
        const [analysis, lineup, eventList, statsList, planList, setPieces] = await Promise.all([
          getOpponentAnalysisByOpponentTeamId(selectedMatch.opponentTeamId),
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
        setAnalysisSummary(analysis?.summary ?? '');
        setAnalysisTags(analysis?.tags ?? []);
        setMatchVideoUrl(selectedMatch.videoUrl ?? '');
      } catch (error) {
        console.error('[MatchCentreSection] Failed loading match details', error);
        setWorkspaceLoadError(error instanceof Error ? error.message : 'Unable to load match workspace.');
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
      } finally {
        setIsLoadingWorkspace(false);
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

  const handleOpenCreateMatch = () => {
    setMatchToEdit(null);
    setIsMatchEditModalOpen(true);
  };

  const handleOpenEditMatch = (match: Match, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setMatchToEdit(match);
    setIsMatchEditModalOpen(true);
  };

  const handleDeleteMatch = async (matchId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const matchToDelete = visibleMatches.find((m) => m.id === matchId) || (selectedMatch?.id === matchId ? selectedMatch : null);
    const oppLabel = matchToDelete?.opponentName || 'este partido';

    if (!window.confirm(`¿Estás seguro de que deseas eliminar el partido contra "${oppLabel}"? Esta acción borrará también sus alineaciones y eventos registrados.`)) {
      return;
    }

    try {
      await deleteMatch(matchId);
      setMatches((prev) => prev.filter((m) => m.id !== matchId));
      onMatchDeleted?.(matchId);

      if (selectedMatchId === matchId || selectedMatch?.id === matchId) {
        closeDetail();
      }
    } catch (error) {
      console.error('[MatchCentreSection] Failed deleting match', error);
      alert('No se pudo eliminar el partido. Por favor, inténtalo de nuevo.');
    }
  };

  const handleMatchSaved = (savedMatch: Match) => {
    setMatches((prev) => {
      const exists = prev.some((m) => m.id === savedMatch.id);
      if (exists) {
        return prev.map((m) => (m.id === savedMatch.id ? savedMatch : m));
      }
      return [savedMatch, ...prev];
    });

    if (selectedMatch?.id === savedMatch.id || selectedMatchId === savedMatch.id) {
      setSelectedMatch(savedMatch);
    }

    onMatchUpdated?.(savedMatch);
  };

  const setSaveState = (key: string, state: SaveState, message?: string) => {
    setSaveStates((current) => ({ ...current, [key]: { state, message } }));
  };

  const renderSaveStatus = (key: string) => {
    const status = saveStates[key];
    if (!status || status.state === 'idle') return null;
    const className = status.state === 'error' ? 'text-rose-600' : status.state === 'saved' ? 'text-emerald-700' : 'text-sky-700';
    return <span role={status.state === 'error' ? 'alert' : 'status'} className={`text-[11px] font-bold ${className}`}>{status.state === 'saving' ? 'Saving...' : status.state === 'saved' ? 'Saved' : status.message || 'Save failed'}</span>;
  };

  const handleToggleTag = (tag: OpponentAnalysisTag) => {
    setAnalysisTags((current) => current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]);
    setSaveState('analysis', 'idle');
  };

  const handleSaveAnalysis = async () => {
    if (!selectedMatch) return;

    try {
      setSaveState('analysis', 'saving');
      const updated = await createOrUpdateOpponentAnalysis({
        id: opponentAnalysis?.id,
        opponentTeamId: selectedMatch.opponentTeamId,
        summary: analysisSummary,
        tags: analysisTags,
        slidesUrl: newSlidesUrl || null,
        videoUrl: newVideoUrl || null
      });
      setOpponentAnalysis(updated);
      setAnalysisTags(updated.tags);
      setAnalysisSummary(updated.summary);
      setSaveState('analysis', 'saved');
    } catch (error) {
      console.error('[MatchCentreSection] Failed saving opponent analysis', error);
      setSaveState('analysis', 'error', error instanceof Error ? error.message : 'Unable to save analysis.');
    }
  };

  const handleAddEvent = async () => {
    if (!selectedMatch) return;

    try {
      setSaveState('events', 'saving');
      const isOpponent = newEventType === 'opponent_goal' || newEventType === 'opponent_corner';
      const eventInput = {
        matchId: selectedMatch.id,
        playerId: isOpponent ? null : (newEventPlayerId || null),
        teamSide: (isOpponent ? 'opponent' : 'our_team') as TeamSide,
        eventType: newEventType,
        minute: Number(newEventMinute) || 0,
        videoTimestampSeconds: Math.max(0, Math.floor(currentVideoSeconds)),
        relatedPlayerId: isOpponent ? null : (newEventRelatedPlayerId || null),
        description: newEventDescription || ''
      };
      const saved = editingEventId
        ? await updateMatchEvent(editingEventId, eventInput)
        : await createMatchEvent(eventInput);

      const nextEvents = editingEventId
        ? events.map((event) => event.id === editingEventId ? saved : event)
        : [...events, saved];
      nextEvents.sort((a, b) => a.videoTimestampSeconds - b.videoTimestampSeconds);
      setEvents(nextEvents);
      setEditingEventId(null);
      setNewEventMinute('0');
      setNewEventType('goal');
      setNewEventPlayerId('');
      setNewEventRelatedPlayerId('');
      setNewEventDescription('');

      const nextStats = await recalculatePlayerMatchStatistics(selectedMatch.id);
      setStats(nextStats);
      setSaveState('events', 'saved');
    } catch (error) {
      console.error('[MatchCentreSection] Failed creating match event', error);
      setSaveState('events', 'error', error instanceof Error ? error.message : 'Unable to save event.');
    }
  };

  const handleApplyAiEvents = async (
    newEvents: Array<Omit<MatchEventModel, 'id' | 'createdAt'>>,
    replaceExisting: boolean
  ) => {
    if (!selectedMatch) return;
    try {
      setSaveState('events', 'saving');
      if (replaceExisting && events.length > 0) {
        for (const ev of events) {
          await deleteMatchEvent(ev.id);
        }
      }
      const created = await batchCreateMatchEvents(newEvents);
      const combined = replaceExisting ? created : [...events, ...created];
      combined.sort((a, b) => a.videoTimestampSeconds - b.videoTimestampSeconds);
      setEvents(combined);
      const nextStats = await recalculatePlayerMatchStatistics(selectedMatch.id);
      setStats(nextStats);
      setSaveState('events', 'saved');
    } catch (error) {
      console.error('[MatchCentreSection] Failed applying AI events', error);
      setSaveState('events', 'error', error instanceof Error ? error.message : 'Unable to apply AI events.');
      throw error;
    }
  };

  const handleSaveMatchVideo = async () => {
    if (!selectedMatch) return;
    try {
      setSaveState('match-video', 'saving');
      const updated = await updateMatch(selectedMatch.id, { videoUrl: matchVideoUrl || null });
      setSelectedMatch(updated);
      setMatchVideoUrl(updated.videoUrl ?? '');
      setSaveState('match-video', 'saved');
    } catch (error) {
      console.error('[MatchCentreSection] Failed saving match video', error);
      setSaveState('match-video', 'error', error instanceof Error ? error.message : 'Unable to save video.');
    }
  };

  const seekVideo = (seconds: number) => {
    const nextSeconds = Math.max(0, seconds);
    if (videoPlayerRef.current) videoPlayerRef.current.currentTime = nextSeconds;
    setCurrentVideoSeconds(nextSeconds);
  };

  const handleEditEvent = (event: MatchEventModel) => {
    setEditingEventId(event.id);
    setNewEventMinute(String(event.minute));
    setNewEventType(event.eventType);
    setNewEventPlayerId(event.playerId ?? '');
    setNewEventRelatedPlayerId(event.relatedPlayerId ?? '');
    setNewEventDescription(event.description);
    seekVideo(event.videoTimestampSeconds);
  };

  const cancelEventEdit = () => {
    setEditingEventId(null);
    setNewEventMinute('0');
    setNewEventType('goal');
    setNewEventPlayerId('');
    setNewEventRelatedPlayerId('');
    setNewEventDescription('');
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!selectedMatch) return;
    try {
      setSaveState('events', 'saving');
      await deleteMatchEvent(eventId);
      setEvents((current) => current.filter((event) => event.id !== eventId));
      setStats(await recalculatePlayerMatchStatistics(selectedMatch.id));
      setSaveState('events', 'saved');
    } catch (error) {
      console.error('[MatchCentreSection] Failed deleting match event', error);
      setSaveState('events', 'error', error instanceof Error ? error.message : 'Unable to delete event.');
    }
  };

  const openLineupForm = (entry: MatchLineupEntry) => {
    setEditingLineupEntry(entry);
    setIsLineupFormOpen(true);
    setLineupForm({
      playerId: entry.playerId,
      position: entry.position,
      starter: entry.starter,
      shirtNumber: entry.shirtNumber !== null && entry.shirtNumber !== undefined ? String(entry.shirtNumber) : '',
      captain: entry.captain,
      minuteSubbedIn: entry.minuteSubbedIn !== null && entry.minuteSubbedIn !== undefined ? String(entry.minuteSubbedIn) : '',
      minuteSubbedOut: entry.minuteSubbedOut !== null && entry.minuteSubbedOut !== undefined ? String(entry.minuteSubbedOut) : '',
      notes: entry.notes ?? ''
    });
  };

  const handleUpdateLineupEntry = async (entry: ExistingMatchLineupEntryUpdate) => {
    if (!selectedMatch) return;
    const previousEntries = lineupEntries;
    try {
      setSaveState('lineup', 'saving');
      setLineupEntries((current) => {
        return current
          .map((currentEntry) => currentEntry.id === entry.id ? { ...currentEntry, ...entry } : currentEntry)
          .sort((a, b) => Number(b.starter) - Number(a.starter) || (a.shirtNumber ?? 999) - (b.shirtNumber ?? 999));
      });
      const saved = await updateMatchLineupEntry(entry);
      setLineupEntries((current) => current.map((currentEntry) => currentEntry.id === saved.id ? saved : currentEntry));
      setStats(await recalculatePlayerMatchStatistics(selectedMatch.id));
      setSaveState('lineup', 'saved');
    } catch (error) {
      setLineupEntries(previousEntries);
      console.error('[MatchCentreSection] Failed updating lineup entry', error);
      setSaveState('lineup', 'error', error instanceof Error ? error.message : 'Unable to update player.');
    }
  };

  const handleBatchUpdateLineupEntries = async (entries: ExistingMatchLineupEntryUpdate[]) => {
    if (!selectedMatch || entries.length === 0) return;
    const previousEntries = lineupEntries;
    try {
      setSaveState('lineup', 'saving');
      setLineupEntries((current) => {
        const updatesById = new Map(entries.map((entry) => [entry.id, entry]));
        return current
          .map((currentEntry) => ({ ...currentEntry, ...updatesById.get(currentEntry.id) }))
          .sort((a, b) => Number(b.starter) - Number(a.starter) || (a.shirtNumber ?? 999) - (b.shirtNumber ?? 999));
      });
      const savedList = await batchUpdateMatchLineupEntries(entries);
      const savedById = new Map(savedList.map((entry) => [entry.id, entry]));
      setLineupEntries((current) => current.map((currentEntry) => savedById.get(currentEntry.id) || currentEntry));
      setStats(await recalculatePlayerMatchStatistics(selectedMatch.id));
      setSaveState('lineup', 'saved');
    } catch (error) {
      setLineupEntries(previousEntries);
      console.error('[MatchCentreSection] Failed batch updating lineup entries', error);
      setSaveState('lineup', 'error', error instanceof Error ? error.message : 'Unable to save formation.');
    }
  };

  const handleSaveLineupEntry = async () => {
    if (!selectedMatch || !editingLineupEntry) return;

    try {
      setSaveState('lineup', 'saving');
      const saved = await updateMatchLineupEntry({
        id: editingLineupEntry.id,
        matchId: selectedMatch.id,
        playerId: lineupForm.playerId.trim(),
        position: lineupForm.position.trim(),
        starter: lineupForm.starter,
        shirtNumber: lineupForm.shirtNumber === '' ? null : Number(lineupForm.shirtNumber),
        captain: lineupForm.captain,
        minuteSubbedIn: lineupForm.minuteSubbedIn === '' ? null : Number(lineupForm.minuteSubbedIn),
        minuteSubbedOut: lineupForm.minuteSubbedOut === '' ? null : Number(lineupForm.minuteSubbedOut),
        notes: lineupForm.notes.trim() || null,
        pitchX: lineupForm.starter ? (editingLineupEntry.pitchX ?? 50) : null,
        pitchY: lineupForm.starter ? (editingLineupEntry.pitchY ?? 50) : null
      });
      setLineupEntries((current) => {
        const filtered = current.filter((entry) => entry.playerId !== saved.playerId);
        return [...filtered, saved].sort((a, b) => Number(b.starter) - Number(a.starter) || (a.shirtNumber ?? 999) - (b.shirtNumber ?? 999) || a.playerId.localeCompare(b.playerId));
      });
      setEditingLineupEntry(null);
      setIsLineupFormOpen(false);
      setLineupForm({ playerId: '', position: '', starter: true, shirtNumber: '', captain: false, minuteSubbedIn: '', minuteSubbedOut: '', notes: '' });
      setStats(await recalculatePlayerMatchStatistics(selectedMatch.id));
      setSaveState('lineup', 'saved');
    } catch (error) {
      console.error('[MatchCentreSection] Failed saving lineup entry', error);
      setSaveState('lineup', 'error', error instanceof Error ? error.message : 'Unable to save player.');
    }
  };


  const renderOpponentAnalysisTab = () => {
    if (!selectedMatch) return null;

    return (
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.6fr)]">
        <section className="rounded-lg border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-sky-700">Scouting report</p>
              <h3 className="mt-1 text-lg font-black text-slate-950">Opponent game model</h3>
            </div>
            <div className="flex items-center gap-3">
              {renderSaveStatus('analysis')}
              <button type="button" onClick={() => void handleSaveAnalysis()} disabled={saveStates.analysis?.state === 'saving'} className="inline-flex items-center gap-2 rounded-md bg-[#002142] px-4 py-2 text-xs font-black text-white disabled:opacity-60">
                {saveStates.analysis?.state === 'saved' ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                Save analysis
              </button>
            </div>
          </div>

          <div className="space-y-6 p-5">
            <label className="block">
              <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">Executive summary</span>
              <textarea value={analysisSummary} onChange={(event) => { setAnalysisSummary(event.target.value); setSaveState('analysis', 'idle'); }} placeholder="Key strengths, vulnerabilities and the coaching message for this fixture..." className="min-h-[150px] w-full rounded-md border border-slate-300 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-900 outline-none focus:border-sky-600 focus:bg-white" />
            </label>

            <div className="grid gap-x-8 gap-y-5 md:grid-cols-2">
              {opponentTagGroups.map((group) => (
                <fieldset key={group.key}>
                  <legend className="mb-2 text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">{group.title}</legend>
                  <div className="inline-flex max-w-full overflow-hidden rounded-md border border-slate-300 bg-slate-100">
                    {group.values.map((option) => {
                      const selected = analysisTags.includes(option.value);
                      return <button key={option.value} type="button" aria-pressed={selected} onClick={() => handleToggleTag(option.value)} className={`border-r border-slate-300 px-3 py-2 text-xs font-bold last:border-r-0 ${selected ? 'bg-[#002142] text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>{option.label}</button>;
                    })}
                  </div>
                </fieldset>
              ))}
            </div>
          </div>
        </section>

        <aside className="space-y-5">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center gap-2"><PlayCircle className="h-4 w-4 text-sky-700" /><h3 className="text-sm font-black text-slate-900">Opponent Analysis Video</h3></div>
            <input value={newVideoUrl} onChange={(event) => { setNewVideoUrl(event.target.value); setSaveState('analysis', 'idle'); }} placeholder="YouTube or Vimeo URL" className="w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-sky-600" />
            {toVideoEmbedUrl(newVideoUrl) ? <iframe title="Opponent Analysis Video" src={toVideoEmbedUrl(newVideoUrl) ?? ''} className="mt-3 aspect-video w-full rounded-md border border-slate-200 bg-slate-950" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /> : <div className="mt-3 flex aspect-video items-center justify-center rounded-md bg-slate-950 text-xs font-bold text-slate-400">No video linked</div>}
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center gap-2"><Video className="h-4 w-4 text-sky-700" /><h3 className="text-sm font-black text-slate-900">Presentation</h3></div>
            <input value={newSlidesUrl} onChange={(event) => { setNewSlidesUrl(event.target.value); setSaveState('analysis', 'idle'); }} placeholder="Google Slides URL" className="w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-sky-600" />
            {toSlideEmbedUrl(newSlidesUrl) ? <iframe title="Google Slides preview" src={newSlidesUrl} className="mt-3 aspect-video w-full rounded-md border border-slate-200 bg-slate-100" /> : <div className="mt-3 flex aspect-video items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 text-xs font-bold text-slate-400">No presentation linked</div>}
          </div>
        </aside>
      </div>
    );
  };

  const renderLineupTab = () => {
    if (!selectedMatch) return null;

    const getPlayer = (playerId: string) => calledUpPlayers.find((player) => player.id === playerId);

    return (
      <div className="space-y-5">
        <MatchPitchBoard
          matchId={selectedMatch.id}
          lineupEntries={lineupEntries}
          calledUpPlayers={calledUpPlayers}
          onUpdateLineupEntry={handleUpdateLineupEntry}
          onBatchUpdateLineupEntries={handleBatchUpdateLineupEntries}
          onOpenEditModal={openLineupForm}
          saveStatus={saveStates.lineup}
        />

        {/* Modal Editor for Detailed Lineup Entry (Shirt #, Sub Minutes, Notes) */}
        {isLineupFormOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs">
            <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-black text-[#002142] font-display">
                  Edit Player Match Details
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setEditingLineupEntry(null);
                    setIsLineupFormOpen(false);
                  }}
                  className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <label className="text-[10px] font-black uppercase text-slate-500">
                  Player
                  <div className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs normal-case text-slate-900">
                    {editingLineupEntry ? (() => {
                      const player = getPlayer(editingLineupEntry.playerId);
                      return player ? `${player.number ? `${player.number} · ` : ''}${player.firstName} ${player.lastName}` : 'Called-up player';
                    })() : 'Called-up player'}
                  </div>
                </label>

                <label className="text-[10px] font-black uppercase text-slate-500">
                  Position
                  <select
                    value={lineupForm.position}
                    onChange={(event) => setLineupForm((current) => ({ ...current, position: event.target.value }))}
                    className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs normal-case text-slate-900"
                  >
                    <option value="">Select position</option>
                    {['GK', 'RB', 'CB', 'LB', 'CDM', 'CM', 'CAM', 'RW', 'LW', 'ST', 'UTIL'].map((position) => (
                      <option key={position}>{position}</option>
                    ))}
                  </select>
                </label>

                <label className="text-[10px] font-black uppercase text-slate-500">
                  Shirt number
                  <input
                    type="number"
                    value={lineupForm.shirtNumber}
                    onChange={(event) => setLineupForm((current) => ({ ...current, shirtNumber: event.target.value }))}
                    className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs normal-case text-slate-900"
                  />
                </label>

                <label className="text-[10px] font-black uppercase text-slate-500">
                  Subbed in
                  <input
                    type="number"
                    value={lineupForm.minuteSubbedIn}
                    onChange={(event) => setLineupForm((current) => ({ ...current, minuteSubbedIn: event.target.value }))}
                    placeholder="Minute"
                    className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs normal-case"
                  />
                </label>

                <label className="text-[10px] font-black uppercase text-slate-500">
                  Subbed out
                  <input
                    type="number"
                    value={lineupForm.minuteSubbedOut}
                    onChange={(event) => setLineupForm((current) => ({ ...current, minuteSubbedOut: event.target.value }))}
                    placeholder="Minute"
                    className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs normal-case"
                  />
                </label>

                <div className="flex items-end gap-4 pb-2">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
                    <input
                      type="checkbox"
                      checked={lineupForm.starter}
                      onChange={(event) => setLineupForm((current) => ({ ...current, starter: event.target.checked }))}
                    />
                    Starter
                  </label>
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
                    <input
                      type="checkbox"
                      checked={lineupForm.captain}
                      onChange={(event) => setLineupForm((current) => ({ ...current, captain: event.target.checked }))}
                    />
                    Captain
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Tactical & Selection Notes</label>
                <textarea
                  value={lineupForm.notes}
                  onChange={(event) => setLineupForm((current) => ({ ...current, notes: event.target.value }))}
                  placeholder="Individual tactical instructions, fitness constraints, set piece responsibilities..."
                  className="min-h-[72px] w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setEditingLineupEntry(null);
                    setIsLineupFormOpen(false);
                    setLineupForm({ playerId: '', position: '', starter: true, shirtNumber: '', captain: false, minuteSubbedIn: '', minuteSubbedOut: '', notes: '' });
                  }}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!editingLineupEntry || saveStates.lineup?.state === 'saving'}
                  onClick={() => void handleSaveLineupEntry()}
                  className="rounded-xl bg-emerald-700 hover:bg-emerald-600 px-4 py-2 text-xs font-black text-white disabled:opacity-50 transition-colors shadow-sm"
                >
                  {saveStates.lineup?.state === 'saving' ? 'Saving...' : 'Save Player'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const savePlanPhase = async (phase: MatchPlanPhase, form: { notes: string; videoUrl: string; image1Url: string; image2Url: string; pdfUrl: string }) => {
    if (!selectedMatch) return;

    try {
      setSaveState(`plan-${phase}`, 'saving');
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
      setPlanDrafts((current) => ({ ...current, [phase]: { notes: updated.notes ?? '', videoUrl: updated.videoUrl ?? '', image1Url: updated.image1Url ?? '', image2Url: updated.image2Url ?? '', pdfUrl: updated.pdfUrl ?? '' } }));
      setSaveState(`plan-${phase}`, 'saved');
    } catch (error) {
      console.error('[MatchCentreSection] Failed saving match plan', error);
      setSaveState(`plan-${phase}`, 'error', error instanceof Error ? error.message : 'Unable to save plan.');
    }
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

    try {
      setSaveState('set-pieces', 'saving');
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
      setSaveState('set-pieces', 'saved');
    } catch (error) {
      console.error('[MatchCentreSection] Failed saving set pieces', error);
      setSaveState('set-pieces', 'error', error instanceof Error ? error.message : 'Unable to save set pieces.');
    }
  };

  const renderPlanTab = () => {
    return (
      <div className="space-y-4">
        {(Object.keys(planDrafts) as MatchPlanPhase[]).map((phase) => {
          const label = phase === 'attack' ? 'Attack' : phase === 'defence' ? 'Defence' : 'Transitions';
          const draft = planDrafts[phase];

          return (
            <div key={phase} className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="mb-3 flex items-center justify-between">
                <div><p className="text-[10px] font-black uppercase tracking-[0.14em] text-sky-700">Game phase</p><h4 className="text-base font-black text-slate-900">{label}</h4></div>
                <div className="flex items-center gap-3">{renderSaveStatus(`plan-${phase}`)}<button
                  type="button"
                  onClick={() => void savePlanPhase(phase, draft)}
                  disabled={saveStates[`plan-${phase}`]?.state === 'saving'}
                  className="inline-flex items-center gap-2 rounded-md bg-[#002142] px-3 py-2 text-[11px] font-black text-white disabled:opacity-60"
                >
                  <Save className="h-3.5 w-3.5" />Save phase
                </button></div>
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

    const renderSetPieceSide = (side: 'attacking' | 'defensive') => {
      const title = side === 'attacking' ? 'Attacking routines' : 'Defensive organisation';
      const noteKey = side === 'attacking' ? 'attackingNotes' : 'defensiveNotes';
      const videoKey = side === 'attacking' ? 'attackingVideoUrl' : 'defensiveVideoUrl';
      const image1Key = side === 'attacking' ? 'attackingImage1Url' : 'defensiveImage1Url';
      const image2Key = side === 'attacking' ? 'attackingImage2Url' : 'defensiveImage2Url';
      return <section className="space-y-3 p-5"><div><p className={`text-[10px] font-black uppercase tracking-[0.14em] ${side === 'attacking' ? 'text-emerald-700' : 'text-rose-700'}`}>{side === 'attacking' ? 'With the ball' : 'Without the ball'}</p><h3 className="text-lg font-black text-slate-950">{title}</h3></div><textarea value={setPiecesDraft[noteKey]} onChange={(event) => setSetPiecesDraft((current) => ({ ...current, [noteKey]: event.target.value }))} placeholder="Responsibilities, triggers and delivery zones..." className="min-h-[150px] w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-3 text-sm leading-6" /><input value={setPiecesDraft[videoKey]} onChange={(event) => setSetPiecesDraft((current) => ({ ...current, [videoKey]: event.target.value }))} placeholder="Video URL" className="w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-xs" />{toVideoEmbedUrl(setPiecesDraft[videoKey]) && <iframe title={`${title} video`} src={toVideoEmbedUrl(setPiecesDraft[videoKey]) ?? ''} className="aspect-video w-full rounded-md border border-slate-200" allowFullScreen />}<div className="grid gap-3 sm:grid-cols-2">{[image1Key, image2Key].map((key, index) => <div key={key}><input value={setPiecesDraft[key]} onChange={(event) => setSetPiecesDraft((current) => ({ ...current, [key]: event.target.value }))} placeholder={`Diagram ${index + 1} URL`} className="w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-xs" />{setPiecesDraft[key] && <img src={setPiecesDraft[key]} alt={`${title} diagram ${index + 1}`} className="mt-2 aspect-video w-full rounded-md object-cover" />}</div>)}</div></section>;
    };

    return (
      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div><p className="text-[10px] font-black uppercase tracking-[0.14em] text-sky-700">Dead-ball strategy</p><h2 className="text-lg font-black text-slate-950">Set-piece board</h2></div><div className="flex items-center gap-3">{renderSaveStatus('set-pieces')}<button type="button" onClick={() => void saveSetPieces(setPiecesDraft)} disabled={saveStates['set-pieces']?.state === 'saving'} className="inline-flex items-center gap-2 rounded-md bg-[#002142] px-3 py-2 text-xs font-black text-white disabled:opacity-60"><Save className="h-4 w-4" />Save all</button></div></div>
        <div className="grid divide-y divide-slate-200 lg:grid-cols-2 lg:divide-x lg:divide-y-0">{renderSetPieceSide('attacking')}{renderSetPieceSide('defensive')}</div>
      </div>
    );
  };

  const renderEventsTab = () => {
    if (!selectedMatch) return null;
    const playerName = (playerId: string | null | undefined) => {
      const player = squadPlayers.find((item) => item.id === playerId);
      return player ? `${player.firstName} ${player.lastName}` : playerId || 'Team event';
    };

    const isOpponentSelected = newEventType === 'opponent_goal' || newEventType === 'opponent_corner';

    const getEventBadge = (type: MatchEventType, team: TeamSide) => {
      switch (type) {
        case 'goal':
          return <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-800">⚽ Gol (A favor)</span>;
        case 'opponent_goal':
          return <span className="inline-flex items-center gap-1 rounded bg-rose-100 px-2 py-0.5 text-[10px] font-black text-rose-800">🥅 Gol Rival</span>;
        case 'corner':
          return <span className="inline-flex items-center gap-1 rounded bg-sky-100 px-2 py-0.5 text-[10px] font-black text-sky-800">🚩 Córner</span>;
        case 'opponent_corner':
          return <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-800">🚩 Córner Rival</span>;
        case 'assist':
          return <span className="inline-flex items-center gap-1 rounded bg-blue-100 px-2 py-0.5 text-[10px] font-black text-blue-800">👟 Asistencia</span>;
        case 'yellow_card':
          return <span className="inline-flex items-center gap-1 rounded bg-yellow-100 px-2 py-0.5 text-[10px] font-black text-yellow-800">🟨 T. Amarilla</span>;
        case 'red_card':
          return <span className="inline-flex items-center gap-1 rounded bg-red-100 px-2 py-0.5 text-[10px] font-black text-red-800">🟥 T. Roja</span>;
        case 'substitution_in':
          return <span className="inline-flex items-center gap-1 rounded bg-purple-100 px-2 py-0.5 text-[10px] font-black text-purple-800">🔄 Cambio (Entra)</span>;
        case 'substitution_out':
          return <span className="inline-flex items-center gap-1 rounded bg-indigo-100 px-2 py-0.5 text-[10px] font-black text-indigo-800">🔄 Cambio (Sale)</span>;
        case 'injury':
          return <span className="inline-flex items-center gap-1 rounded bg-orange-100 px-2 py-0.5 text-[10px] font-black text-orange-800">🩹 Lesión</span>;
        default:
          return <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-800">📌 Evento</span>;
      }
    };

    return (
      <div className="space-y-5">
        <section className="overflow-hidden rounded-lg border border-slate-200 bg-slate-950">
          <div className="aspect-video w-full bg-black">
            {matchVideoUrl ? (
              <ReactPlayer
                ref={videoPlayerRef}
                src={matchVideoUrl}
                controls
                width="100%"
                height="100%"
                onTimeUpdate={() => setCurrentVideoSeconds(videoPlayerRef.current?.currentTime ?? 0)}
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm font-bold text-slate-500">
                <Video className="h-10 w-10 text-slate-700" />
                <span>Introduce el enlace del vídeo del partido para etiquetar y reproducir momentos.</span>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-3 border-t border-slate-800 p-4 sm:flex-row sm:items-center">
            <label className="min-w-0 flex-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
              Match video URL
              <input
                value={matchVideoUrl}
                onChange={(event) => setMatchVideoUrl(event.target.value)}
                placeholder="YouTube, Vimeo, Veo o URL de vídeo directa"
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium normal-case text-white placeholder:text-slate-500"
              />
            </label>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="font-mono text-sm font-black text-cyan-300">
                {formatVideoTimestamp(currentVideoSeconds)}
              </span>
              {renderSaveStatus('match-video')}
              <button
                type="button"
                onClick={() => void handleSaveMatchVideo()}
                className="inline-flex items-center gap-1.5 rounded-md bg-slate-800 px-3 py-2 text-xs font-black text-white hover:bg-slate-700"
              >
                <Save className="h-4 w-4" />
                Guardar URL
              </button>
              <button
                type="button"
                onClick={() => setIsAiEventsModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-md bg-gradient-to-r from-cyan-400 to-sky-400 px-3.5 py-2 text-xs font-black text-slate-950 shadow-md transition hover:opacity-95"
              >
                <Sparkles className="h-4 w-4 text-slate-950" />
                Generar eventos con IA
              </button>
            </div>
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-[410px_minmax(0,1fr)]">
          {/* Quick event logger */}
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-sky-700">Botonera de eventos</p>
                <h3 className="text-lg font-black text-slate-950">
                  {editingEventId ? 'Editar evento' : 'Etiquetar momento'}
                </h3>
              </div>
              {renderSaveStatus('events')}
            </div>

            {/* Quick buttons grid */}
            <div className="mb-4 space-y-2">
              <div className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-400">
                Acciones rápidas:
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-2">
                <button
                  type="button"
                  onClick={() => { setNewEventType('goal'); }}
                  className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-black transition ${
                    newEventType === 'goal'
                      ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                      : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                  }`}
                >
                  ⚽ Gol
                </button>

                <button
                  type="button"
                  onClick={() => { setNewEventType('opponent_goal'); setNewEventPlayerId(''); setNewEventRelatedPlayerId(''); }}
                  className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-black transition ${
                    newEventType === 'opponent_goal'
                      ? 'border-rose-600 bg-rose-600 text-white shadow-sm'
                      : 'border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100'
                  }`}
                >
                  🥅 Gol Rival
                </button>

                <button
                  type="button"
                  onClick={() => { setNewEventType('corner'); }}
                  className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-black transition ${
                    newEventType === 'corner'
                      ? 'border-sky-600 bg-sky-600 text-white shadow-sm'
                      : 'border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100'
                  }`}
                >
                  🚩 Córner
                </button>

                <button
                  type="button"
                  onClick={() => { setNewEventType('opponent_corner'); setNewEventPlayerId(''); setNewEventRelatedPlayerId(''); }}
                  className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-black transition ${
                    newEventType === 'opponent_corner'
                      ? 'border-amber-600 bg-amber-600 text-white shadow-sm'
                      : 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                  }`}
                >
                  🚩 Córner Rival
                </button>
              </div>

              {/* Secondary buttons */}
              <div className="grid grid-cols-3 gap-1.5 pt-1">
                {[
                  { value: 'assist' as MatchEventType, label: '👟 Asistencia' },
                  { value: 'yellow_card' as MatchEventType, label: '🟨 T. Amarilla' },
                  { value: 'red_card' as MatchEventType, label: '🟥 T. Roja' },
                  { value: 'substitution_in' as MatchEventType, label: '🔄 Entra' },
                  { value: 'substitution_out' as MatchEventType, label: '🔄 Sale' },
                  { value: 'injury' as MatchEventType, label: '🩹 Lesión' }
                ].map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setNewEventType(item.value)}
                    className={`rounded-md border px-2 py-1.5 text-[10px] font-bold transition ${
                      newEventType === item.value
                        ? 'border-[#002142] bg-[#002142] text-white'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <label className="text-[10px] font-black uppercase text-slate-500">
                Momento de vídeo
                <input
                  readOnly
                  value={formatVideoTimestamp(currentVideoSeconds)}
                  className="mt-1 w-full rounded-md border border-cyan-200 bg-cyan-50 px-3 py-2 font-mono text-xs normal-case text-cyan-900"
                />
              </label>
              <label className="text-[10px] font-black uppercase text-slate-500">
                Minuto del partido
                <input
                  type="number"
                  min="0"
                  max="130"
                  value={newEventMinute}
                  onChange={(event) => setNewEventMinute(event.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-xs normal-case"
                />
              </label>
              <label className="text-[10px] font-black uppercase text-slate-500">
                Tipo de evento
                <select
                  value={newEventType}
                  onChange={(event) => {
                    const val = event.target.value as MatchEventType;
                    setNewEventType(val);
                    if (val === 'opponent_goal' || val === 'opponent_corner') {
                      setNewEventPlayerId('');
                      setNewEventRelatedPlayerId('');
                    }
                  }}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-xs normal-case font-bold"
                >
                  {EVENT_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              {isOpponentSelected ? (
                <div className="rounded-md border border-rose-200 bg-rose-50/70 p-2.5 text-xs text-rose-800">
                  <span className="font-bold">Evento del equipo rival:</span> No requiere asignar jugadora de nuestra plantilla.
                </div>
              ) : (
                <>
                  <label className="text-[10px] font-black uppercase text-slate-500">
                    Jugadora
                    <select
                      value={newEventPlayerId}
                      onChange={(event) => setNewEventPlayerId(event.target.value)}
                      className="mt-1 w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-xs normal-case"
                    >
                      <option value="">Equipo / Sin jugadora</option>
                      {squadPlayers.map((player) => (
                        <option key={player.id} value={player.id}>
                          #{player.number ?? '-'} {player.firstName} {player.lastName}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-[10px] font-black uppercase text-slate-500">
                    Jugadora relacionada (Asistencia / Cambio)
                    <select
                      value={newEventRelatedPlayerId}
                      onChange={(event) => setNewEventRelatedPlayerId(event.target.value)}
                      className="mt-1 w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-xs normal-case"
                    >
                      <option value="">Ninguna</option>
                      {squadPlayers.map((player) => (
                        <option key={player.id} value={player.id}>
                          #{player.number ?? '-'} {player.firstName} {player.lastName}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}
            </div>

            <textarea
              value={newEventDescription}
              onChange={(event) => setNewEventDescription(event.target.value)}
              placeholder="Describe la jugada, córner, desajuste táctico o detalle..."
              className="mt-3 min-h-[90px] w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:border-sky-600 focus:bg-white"
            />

            <div className="mt-3 flex gap-2">
              {editingEventId && (
                <button
                  type="button"
                  onClick={cancelEventEdit}
                  className="rounded-md border border-slate-300 px-3 py-2.5 text-xs font-black text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
              )}
              <button
                type="button"
                disabled={saveStates.events?.state === 'saving'}
                onClick={() => void handleAddEvent()}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-[#002142] px-3 py-2.5 text-xs font-black text-white hover:bg-[#083561] disabled:opacity-60"
              >
                {editingEventId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {editingEventId ? 'Guardar cambios' : 'Añadir al segundo actual'}
              </button>
            </div>
          </section>

          {/* Chronology & event list */}
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700">Cronología del partido</p>
                <h3 className="text-lg font-black text-slate-950">Momentos y eventos</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                  {events.length} eventos
                </span>
                <button
                  type="button"
                  onClick={() => setIsAiEventsModalOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-300 bg-cyan-50 px-3 py-1.5 text-xs font-black text-cyan-900 transition hover:bg-cyan-100"
                >
                  <Sparkles className="h-3.5 w-3.5 text-cyan-600" />
                  Generar con IA
                </button>
              </div>
            </div>

            {events.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
                <Sparkles className="h-8 w-8 text-cyan-600 mb-2" />
                <p className="text-xs font-bold text-slate-700">No hay eventos registrados todavía</p>
                <p className="mt-1 text-[11px] text-slate-500 max-w-sm">
                  Utiliza la botonera lateral para añadir goles y córners, o genera la cronología completa automáticamente con el botón de IA.
                </p>
                <button
                  type="button"
                  onClick={() => setIsAiEventsModalOpen(true)}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#002142] px-4 py-2 text-xs font-black text-white shadow-sm hover:bg-[#0a3a66]"
                >
                  <Sparkles className="h-4 w-4 text-cyan-300" />
                  Generar eventos con IA
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {events
                  .slice()
                  .sort((a, b) => a.videoTimestampSeconds - b.videoTimestampSeconds)
                  .map((event) => {
                    const isOpponent = event.eventType === 'opponent_goal' || event.eventType === 'opponent_corner' || event.teamSide === 'opponent';
                    const playerDisplayName = isOpponent
                      ? (selectedMatch?.opponentName ? `Equipo rival (${selectedMatch.opponentName})` : 'Equipo rival')
                      : playerName(event.playerId);

                    return (
                      <div
                        key={event.id}
                        className="group grid grid-cols-[68px_minmax(0,1fr)_72px] gap-3 py-3.5 hover:bg-slate-50/70 rounded-lg px-2 transition"
                      >
                        <button
                          type="button"
                          onClick={() => seekVideo(event.videoTimestampSeconds)}
                          title="Ir al segundo del vídeo"
                          className="self-start rounded-md bg-slate-950 px-2 py-1.5 font-mono text-xs font-black text-cyan-300 hover:bg-slate-800 transition"
                        >
                          {formatVideoTimestamp(event.videoTimestampSeconds)}
                        </button>

                        <button
                          type="button"
                          onClick={() => seekVideo(event.videoTimestampSeconds)}
                          className="min-w-0 text-left"
                        >
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            {getEventBadge(event.eventType, event.teamSide)}
                            <span className="font-mono text-xs font-black text-slate-500">
                              {event.minute}'
                            </span>
                          </div>

                          <div className="text-sm font-black text-slate-900">
                            {playerDisplayName}
                          </div>

                          {event.relatedPlayerId && (
                            <div className="text-xs font-medium text-slate-500">
                              Relacionada: {playerName(event.relatedPlayerId)}
                            </div>
                          )}

                          {event.description && (
                            <div className="mt-1 text-xs leading-5 text-slate-600">
                              {event.description}
                            </div>
                          )}
                        </button>

                        <div className="flex items-start justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleEditEvent(event)}
                            title="Editar evento"
                            className="p-1.5 rounded text-slate-400 hover:bg-slate-200 hover:text-sky-700"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteEvent(event.id)}
                            title="Eliminar evento"
                            className="p-1.5 rounded text-slate-400 hover:bg-rose-100 hover:text-rose-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </section>
        </div>
      </div>
    );
  };

  const derivedPlayerStats = useMemo(() => {
    const lineupPlayerIds = lineupEntries.map((e) => e.playerId);
    const eventPlayerIds = events
      .flatMap((e) => [e.playerId, e.relatedPlayerId])
      .filter((id): id is string => Boolean(id) && squadPlayers.some((p) => p.id === id));
    const allPlayerIds = Array.from(new Set([...lineupPlayerIds, ...eventPlayerIds]));

    if (allPlayerIds.length === 0 && stats.length > 0) {
      return stats;
    }

    return allPlayerIds.map((playerId) => {
      const lineupEntry = lineupEntries.find((e) => e.playerId === playerId);
      const derived = derivePlayerMatchStatsFromData(playerId, lineupEntry, events);
      return {
        id: playerId,
        matchId: selectedMatch?.id || '',
        playerId,
        minutesPlayed: derived.minutesPlayed,
        starts: derived.starts,
        goals: derived.goals,
        assists: derived.assists,
        yellowCards: derived.yellowCards,
        redCards: derived.redCards
      };
    }).sort((a, b) => b.minutesPlayed - a.minutesPlayed || (b.goals + b.assists) - (a.goals + a.assists) || a.playerId.localeCompare(b.playerId));
  }, [lineupEntries, events, squadPlayers, selectedMatch?.id, stats]);

  const matchTeamStats = useMemo(() => {
    const ourGoals = events.filter(
      (e) => (e.eventType === 'goal' && (e.teamSide === 'our_team' || !e.teamSide))
    ).length;
    const opponentGoals = events.filter(
      (e) => e.eventType === 'opponent_goal' || (e.eventType === 'goal' && e.teamSide === 'opponent')
    ).length;

    const directAssistEvents = events.filter(
      (e) => (e.teamSide === 'our_team' || !e.teamSide) && e.eventType === 'assist'
    );
    const goalAssistEvents = events.filter(
      (e) =>
        (e.teamSide === 'our_team' || !e.teamSide) &&
        e.eventType === 'goal' &&
        Boolean(e.relatedPlayerId) &&
        !directAssistEvents.some(
          (direct) =>
            (direct.playerId === e.relatedPlayerId && direct.minute === e.minute) ||
            (direct.playerId === e.relatedPlayerId &&
              direct.videoTimestampSeconds > 0 &&
              e.videoTimestampSeconds > 0 &&
              Math.abs(direct.videoTimestampSeconds - e.videoTimestampSeconds) <= 15)
        )
    );
    const ourAssists = directAssistEvents.length + goalAssistEvents.length;

    const ourCorners = events.filter(
      (e) => (e.eventType === 'corner' && (e.teamSide === 'our_team' || !e.teamSide))
    ).length;
    const opponentCorners = events.filter(
      (e) => e.eventType === 'opponent_corner' || (e.eventType === 'corner' && e.teamSide === 'opponent')
    ).length;

    const ourYellowCards = events.filter(
      (e) => e.eventType === 'yellow_card' && (e.teamSide === 'our_team' || !e.teamSide)
    ).length;
    const opponentYellowCards = events.filter(
      (e) => e.eventType === 'yellow_card' && e.teamSide === 'opponent'
    ).length;

    const ourRedCards = events.filter(
      (e) => e.eventType === 'red_card' && (e.teamSide === 'our_team' || !e.teamSide)
    ).length;
    const opponentRedCards = events.filter(
      (e) => e.eventType === 'red_card' && e.teamSide === 'opponent'
    ).length;

    const subInEvents = events.filter((e) => e.eventType === 'substitution_in');
    const subOutEvents = events.filter((e) => e.eventType === 'substitution_out');
    const unpairedSubOut = subOutEvents.filter(
      (outEv) => !subInEvents.some((inEv) => inEv.minute === outEv.minute && (inEv.relatedPlayerId === outEv.playerId || inEv.playerId === outEv.relatedPlayerId))
    );
    const ourSubstitutions = subInEvents.length + unpairedSubOut.length;

    const ourInjuries = events.filter(
      (e) => e.eventType === 'injury' && (e.teamSide === 'our_team' || !e.teamSide)
    ).length;

    const totalMinutes = derivedPlayerStats.reduce((acc, p) => acc + p.minutesPlayed, 0);
    const playersUsed = derivedPlayerStats.filter((p) => p.minutesPlayed > 0 || p.starts || p.goals > 0 || p.assists > 0 || p.yellowCards > 0 || p.redCards > 0).length;

    return {
      ourGoals,
      opponentGoals,
      ourAssists,
      ourCorners,
      opponentCorners,
      ourYellowCards,
      opponentYellowCards,
      ourRedCards,
      opponentRedCards,
      ourSubstitutions,
      ourInjuries,
      totalMinutes,
      playersUsed
    };
  }, [events, derivedPlayerStats]);

  const renderStatisticsTab = () => {
    if (!selectedMatch) return null;
    const playerName = (playerId: string) => {
      const player = squadPlayers.find((item) => item.id === playerId);
      return player ? `${player.firstName} ${player.lastName}` : playerId;
    };

    return (
      <div className="space-y-5">
        {/* Match Summary Metrics */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-sky-700">Resumen del partido</p>
              <h3 className="text-lg font-black text-slate-950 font-display">Estadísticas del encuentro</h3>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
              Fuente: Cronología oficial ({events.length} eventos)
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* Goals */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Goles (Favor / Rival)</span>
                <Trophy className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-black text-emerald-700">{matchTeamStats.ourGoals}</span>
                <span className="text-xl font-bold text-slate-400">-</span>
                <span className="text-2xl font-bold text-rose-600">{matchTeamStats.opponentGoals}</span>
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                {matchTeamStats.ourGoals} a favor · {matchTeamStats.opponentGoals} rival
              </div>
            </div>

            {/* Corners */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Córners (Favor / Rival)</span>
                <Flag className="h-4 w-4 text-sky-600" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-black text-sky-800">{matchTeamStats.ourCorners}</span>
                <span className="text-xl font-bold text-slate-400">-</span>
                <span className="text-2xl font-bold text-slate-500">{matchTeamStats.opponentCorners}</span>
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                {matchTeamStats.ourCorners} a favor · {matchTeamStats.opponentCorners} en contra
              </div>
            </div>

            {/* Assists & Substitutions */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Asistencias y Cambios</span>
                <Swords className="h-4 w-4 text-indigo-600" />
              </div>
              <div className="mt-2 flex items-baseline gap-3">
                <div>
                  <span className="text-3xl font-black text-slate-900">{matchTeamStats.ourAssists}</span>
                  <span className="ml-1 text-[10px] uppercase font-bold text-slate-500">asist.</span>
                </div>
                <div className="text-slate-300">|</div>
                <div>
                  <span className="text-2xl font-black text-slate-700">{matchTeamStats.ourSubstitutions}</span>
                  <span className="ml-1 text-[10px] uppercase font-bold text-slate-500">cambios</span>
                </div>
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                {matchTeamStats.ourInjuries > 0 ? `${matchTeamStats.ourInjuries} lesión(es) registradas` : 'Sin incidencias físicas'}
              </div>
            </div>

            {/* Cards & Discipline */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Disciplina / Tarjetas</span>
                <Shield className="h-4 w-4 text-amber-600" />
              </div>
              <div className="mt-2 flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-3.5 w-2.5 rounded-xs bg-amber-400 shadow-xs"></span>
                  <span className="text-2xl font-black text-slate-900">{matchTeamStats.ourYellowCards}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-3.5 w-2.5 rounded-xs bg-rose-600 shadow-xs"></span>
                  <span className="text-2xl font-black text-slate-900">{matchTeamStats.ourRedCards}</span>
                </div>
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                Amarillas: {matchTeamStats.ourYellowCards} · Rojas: {matchTeamStats.ourRedCards}
              </div>
            </div>
          </div>
        </div>

        {/* Player Statistics Table */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-sky-700">Rendimiento individual</p>
              <h3 className="text-lg font-black text-slate-950 font-display">Estadísticas por jugadora</h3>
            </div>
            <div className="text-xs font-bold text-slate-500">
              {derivedPlayerStats.length} jugadoras con actividad
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="px-3 py-2.5 font-black">Jugadora</th>
                  <th className="px-3 py-2.5 font-black text-center">Titular</th>
                  <th className="px-3 py-2.5 font-black text-center">Minutos</th>
                  <th className="px-3 py-2.5 font-black text-center">Goles</th>
                  <th className="px-3 py-2.5 font-black text-center">Asistencias</th>
                  <th className="px-3 py-2.5 font-black text-center">T. Amarillas</th>
                  <th className="px-3 py-2.5 font-black text-center">T. Rojas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {derivedPlayerStats.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                      No hay estadísticas registradas todavía para este partido.
                    </td>
                  </tr>
                ) : (
                  derivedPlayerStats.map((stat) => (
                    <tr key={stat.id || stat.playerId} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-3 py-3 font-bold text-slate-900">{playerName(stat.playerId)}</td>
                      <td className="px-3 py-2 text-center text-slate-700">
                        {stat.starts ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-800">
                            Sí
                          </span>
                        ) : (
                          <span className="text-slate-400">No</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center font-mono font-bold text-slate-800">{stat.minutesPlayed}'</td>
                      <td className="px-3 py-2 text-center">
                        {stat.goals > 0 ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-bold text-emerald-800">
                            {stat.goals}
                          </span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {stat.assists > 0 ? (
                          <span className="rounded-full bg-indigo-100 px-2 py-0.5 font-bold text-indigo-800">
                            {stat.assists}
                          </span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {stat.yellowCards > 0 ? (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 font-bold text-amber-800">
                            {stat.yellowCards}
                          </span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {stat.redCards > 0 ? (
                          <span className="rounded-full bg-rose-100 px-2 py-0.5 font-bold text-rose-800">
                            {stat.redCards}
                          </span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  if (selectedMatchId && selectedMatch) {
    const opponentName = selectedMatch.opponentName || 'Opponent';
    const homeTeamName = selectedMatch.isHome ? teamName : opponentName;
    const awayTeamName = selectedMatch.isHome ? opponentName : teamName;
    const homeTeam = selectedMatch.isHome ? { name: teamName, isAlula: true, logoUrl: currentLogo ?? null } : { name: opponentName, isAlula: false, logoUrl: selectedMatch.opponentLogoUrl ?? null };
    const awayTeam = selectedMatch.isHome ? { name: opponentName, isAlula: false, logoUrl: selectedMatch.opponentLogoUrl ?? null } : { name: teamName, isAlula: true, logoUrl: currentLogo ?? null };
    const hasScore = selectedMatch.ourScore !== null && selectedMatch.ourScore !== undefined && selectedMatch.opponentScore !== null && selectedMatch.opponentScore !== undefined;
    const homeScore = selectedMatch.isHome ? selectedMatch.ourScore : selectedMatch.opponentScore;
    const awayScore = selectedMatch.isHome ? selectedMatch.opponentScore : selectedMatch.ourScore;
    const tabLabels: Record<MatchTab, string> = { 'opponent-analysis': 'Opposition', 'line-up': 'Line-up', 'match-plan': 'Game Plan', 'set-pieces': 'Set Pieces', events: 'Timeline', statistics: 'Statistics' };

    return (
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm">
        <header className="bg-[#002142] text-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-6">
            <button
              type="button"
              onClick={closeDetail}
              className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-white/20 hover:text-white transition"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Todos los partidos</span>
            </button>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-200">
                {selectedMatch.competitionName}
              </span>
              <span className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase ${selectedMatch.status === 'played' ? 'border-white/20 text-slate-300' : 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300'}`}>
                {formatMatchStatusLabel(selectedMatch.status)}
              </span>

              <div className="ml-2 flex items-center gap-1.5 border-l border-white/20 pl-2">
                <button
                  type="button"
                  onClick={() => handleOpenEditMatch(selectedMatch)}
                  title="Editar datos del partido (equipos, horario, fecha, etc.)"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-sky-500/20 px-3 py-1.5 text-xs font-bold text-sky-200 hover:bg-sky-500/30 hover:text-white transition border border-sky-400/30"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  <span>Editar Partido</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => void handleDeleteMatch(selectedMatch.id, e)}
                  title="Eliminar este partido"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-rose-500/20 px-3 py-1.5 text-xs font-bold text-rose-200 hover:bg-rose-500/30 hover:text-white transition border border-rose-400/30"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Eliminar</span>
                </button>
              </div>
            </div>
          </div>

          <div className="mx-auto grid max-w-3xl grid-cols-[minmax(0,1fr)_80px_minmax(0,1fr)] items-center gap-3 px-4 py-6 sm:grid-cols-[minmax(0,1fr)_120px_minmax(0,1fr)] sm:py-8">
            <div className="flex min-w-0 flex-col items-center text-center">
              <TeamCrest name={homeTeam.name} logoUrl={homeTeam.logoUrl} isAlula={homeTeam.isAlula} className="h-14 w-14 rounded-full border border-white/20 bg-white p-1 sm:h-16 sm:w-16" />
              <span className="mt-2 max-w-full truncate text-sm font-black sm:text-base">{homeTeamName}</span>
              <span className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">Home (Local)</span>
            </div>
            <div className="text-center">
              {hasScore ? (
                <div className="text-3xl font-black tabular-nums sm:text-4xl">{homeScore} <span className="text-slate-500">:</span> {awayScore}</div>
              ) : (
                <div className="text-xl font-black text-sky-200">VS</div>
              )}
              <div className="mt-2 text-xs font-bold text-sky-300">{selectedMatch.time || 'Horario por definir'}</div>
            </div>
            <div className="flex min-w-0 flex-col items-center text-center">
              <TeamCrest name={awayTeam.name} logoUrl={awayTeam.logoUrl} isAlula={awayTeam.isAlula} className="h-14 w-14 rounded-full border border-white/20 bg-white p-1 sm:h-16 sm:w-16" />
              <span className="mt-2 max-w-full truncate text-sm font-black sm:text-base">{awayTeamName}</span>
              <span className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">Away (Visitante)</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-white/10 px-4 py-3 text-[11px] font-semibold text-slate-300">
            <span className="inline-flex items-center gap-2"><CalendarDays className="h-3.5 w-3.5 text-sky-300" />{formatDate(selectedMatch.date)}</span>
            <span className="inline-flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-sky-300" />{selectedMatch.venue || selectedMatch.location || 'Venue TBD'}</span>
          </div>
        </header>

        <nav className="overflow-x-auto border-b border-slate-200 bg-white px-3" aria-label="Match workspace">
          <div className="flex min-w-max">
              {TAB_OPTIONS.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`border-b-2 px-4 py-3 text-[10px] font-black uppercase tracking-[0.1em] transition ${
                    activeTab === tab
                      ? 'border-sky-600 text-[#002142]'
                      : 'border-transparent text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {tabLabels[tab]}
                </button>
              ))}
          </div>
        </nav>

        <main className="p-3 sm:p-5">
          {isLoadingWorkspace ? <div role="status" className="flex min-h-64 items-center justify-center rounded-lg border border-slate-200 bg-white text-sm font-bold text-slate-500">Loading match workspace...</div> : workspaceLoadError ? <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800"><p className="font-black">Match workspace could not be loaded.</p><p className="mt-1 text-xs">{workspaceLoadError}</p></div> : <>
            {activeTab === 'opponent-analysis' && renderOpponentAnalysisTab()}
            {activeTab === 'line-up' && renderLineupTab()}
            {activeTab === 'match-plan' && renderPlanTab()}
            {activeTab === 'set-pieces' && renderSetPiecesTab()}
            {activeTab === 'events' && renderEventsTab()}
            {activeTab === 'statistics' && renderStatisticsTab()}
          </>}
        </main>

        {selectedMatch && (
          <AiMatchEventsModal
            isOpen={isAiEventsModalOpen}
            onClose={() => setIsAiEventsModalOpen(false)}
            match={selectedMatch}
            squadPlayers={squadPlayers}
            onApplyEvents={handleApplyAiEvents}
            existingEventsCount={events.length}
          />
        )}

        <MatchEditModal
          isOpen={isMatchEditModalOpen}
          onClose={() => setIsMatchEditModalOpen(false)}
          match={matchToEdit}
          teamName={teamName}
          currentTeamId={selectedTeamId || undefined}
          onSave={handleMatchSaved}
          onDelete={handleDeleteMatch}
        />
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

  const filteredMatches = visibleMatches.filter((match) => {
    if (filterStatus === 'planned' && match.status === 'played') return false;
    if (filterStatus === 'played' && match.status !== 'played') return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const opp = (match.opponentName || '').toLowerCase();
      const comp = (match.competitionName || '').toLowerCase();
      const ven = (match.venue || match.location || '').toLowerCase();
      if (!opp.includes(q) && !comp.includes(q) && !ven.includes(q)) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Action & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-base sm:text-lg font-black text-[#002142] font-display">
            Calendario de Partidos & Fixtures
          </h2>
          <p className="text-xs font-medium text-slate-500">
            {visibleMatches.length} {visibleMatches.length === 1 ? 'partido registrado' : 'partidos registrados'} para la temporada.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search */}
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar rival o estadio..."
            className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-sky-600 focus:bg-white w-44 sm:w-48"
          />

          {/* Filter pills */}
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1 text-xs font-bold text-slate-600">
            <button
              type="button"
              onClick={() => setFilterStatus('all')}
              className={`rounded-lg px-2.5 py-1 text-xs transition ${filterStatus === 'all' ? 'bg-[#002142] text-white shadow-sm' : 'hover:text-slate-900'}`}
            >
              Todos ({visibleMatches.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('planned')}
              className={`rounded-lg px-2.5 py-1 text-xs transition ${filterStatus === 'planned' ? 'bg-[#002142] text-white shadow-sm' : 'hover:text-slate-900'}`}
            >
              Programados
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('played')}
              className={`rounded-lg px-2.5 py-1 text-xs transition ${filterStatus === 'played' ? 'bg-[#002142] text-white shadow-sm' : 'hover:text-slate-900'}`}
            >
              Jugados
            </button>
          </div>

          <button
            type="button"
            onClick={handleOpenCreateMatch}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black uppercase tracking-wider text-white shadow-sm hover:bg-emerald-500 transition active:scale-95 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Añadir Partido</span>
          </button>
        </div>
      </div>

      {filteredMatches.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500 shadow-sm space-y-3">
          <p className="font-bold text-slate-700">No hay partidos que coincidan con la búsqueda o filtro.</p>
          <button
            type="button"
            onClick={handleOpenCreateMatch}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#002142] px-4 py-2 text-xs font-black text-white hover:bg-sky-900 transition"
          >
            <Plus className="h-4 w-4" />
            <span>Programar un nuevo partido</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredMatches.map((match) => {
            const opponentName = match.opponentName || 'Opponent';
            const homeTeam = match.isHome
              ? { name: teamName, isAlula: true, logoUrl: currentLogo ?? null }
              : { name: opponentName, isAlula: false, logoUrl: match.opponentLogoUrl };
            const awayTeam = match.isHome
              ? { name: opponentName, isAlula: false, logoUrl: match.opponentLogoUrl }
              : { name: teamName, isAlula: true, logoUrl: currentLogo ?? null };
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
              <article key={match.id} className="flex min-h-[400px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-md">
                {/* Card Header with Competition & Action Buttons */}
                <div className="flex items-center justify-between border-b border-slate-100 bg-[#002142] px-4 py-2.5 text-white">
                  <span className="text-[10px] font-black uppercase text-sky-200 truncate max-w-[200px]">
                    {match.competitionName}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => handleOpenEditMatch(match, e)}
                      title="Editar partido (nombres de equipo, horario, estadio...)"
                      className="rounded-lg p-1.5 text-slate-300 hover:bg-white/20 hover:text-white transition"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => void handleDeleteMatch(match.id, e)}
                      title="Eliminar partido"
                      className="rounded-lg p-1.5 text-slate-300 hover:bg-rose-500/40 hover:text-rose-200 transition"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
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
                      <div className="text-[10px] font-black uppercase text-slate-400">Kick-off / Horario</div>
                      <div className="mt-1 text-sm font-black text-slate-800 text-sky-700">{match.time || 'TBD'}</div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-start gap-2 text-xs font-semibold leading-5 text-slate-600">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <span>{match.venue || match.location || 'Venue TBD'}</span>
                  </div>

                  {/* Card Footer with Edit & Details */}
                  <div className="mt-auto flex items-center justify-between gap-2 pt-4 border-t border-slate-100">
                    <span className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase ${match.status === 'played' ? 'border-slate-200 bg-slate-100 text-slate-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                      {formatMatchStatusLabel(match.status)}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => handleOpenEditMatch(match, e)}
                        className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[10px] font-black uppercase text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition"
                      >
                        <Edit3 className="h-3 w-3 text-slate-500" />
                        <span>Editar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => openMatch(match.id)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#002142] px-3 py-1.5 text-[10px] font-black uppercase text-white transition hover:bg-[#0b3a64]"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>Detalles</span>
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Opponent clubs roster */}
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

      {/* Edit / Create Match Modal */}
      <MatchEditModal
        isOpen={isMatchEditModalOpen}
        onClose={() => setIsMatchEditModalOpen(false)}
        match={matchToEdit}
        teamName={teamName}
        currentTeamId={selectedTeamId || undefined}
        onSave={handleMatchSaved}
        onDelete={handleDeleteMatch}
        existingOpponents={opponentClubs}
      />
    </div>
  );
};
