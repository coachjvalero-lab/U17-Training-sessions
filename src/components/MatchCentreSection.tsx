import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactPlayer from 'react-player';
import { Activity, CalendarDays, Check, ChevronLeft, Edit3, Eye, MapPin, PlayCircle, Plus, Save, Shield, Swords, Trash2, Trophy, Users, Video, X } from 'lucide-react';
import { TeamCrest } from './TeamCrest';
import { useTeamContext } from '../contexts/TeamContext';
import {
  createMatchEvent,
  deleteMatchEvent,
  getMatchEvents,
  updateMatchEvent
} from '../services/matches/matchEventsService';
import { getMatchById, listMatches, updateMatch } from '../services/matches/matchService';
import {
  createOrUpdateOpponentAnalysis,
  getOpponentAnalysisByOpponentTeamId
} from '../services/matches/opponentAnalysisService';
import { getMatchLineup, removeMatchLineupEntry, upsertMatchLineupEntry, batchUpsertMatchLineupEntries } from '../services/matches/matchLineupService';
import { MatchPitchBoard } from './MatchPitchBoard';
import type { FormationSlot } from '../utils/formations';
import { getMatchPlan, upsertMatchPlanPhase } from '../services/matches/matchPlanService';
import { getMatchSetPieces, upsertMatchSetPieces } from '../services/matches/matchSetPiecesService';
import { getPlayerMatchStatistics, recalculatePlayerMatchStatistics } from '../services/matches/playerMatchStatisticsService';
import { subscribeToSquadPlayers, type CloudSquadPlayer } from '../services/squad/squadService';
import type { Match, MatchEvent as MatchEventModel, MatchEventType, MatchLineupEntry, MatchPlanEntry, MatchPlanPhase, MatchSetPieces, OpponentAnalysis, OpponentAnalysisTag, PlayerMatchStatistics } from '../types';
import { formatVideoTimestamp, toSlideEmbedUrl, toVideoEmbedUrl } from '../utils/mediaUrls';

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
}

export const MatchCentreSection: React.FC<MatchCentreSectionProps> = ({
  matches: providedMatches,
  isLoadingMatches,
  matchLoadError,
  currentLogo
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
      const eventInput = {
        matchId: selectedMatch.id,
        playerId: newEventPlayerId || null,
        teamSide: 'our_team' as const,
        eventType: newEventType,
        minute: Number(newEventMinute) || 0,
        videoTimestampSeconds: Math.max(0, Math.floor(currentVideoSeconds)),
        relatedPlayerId: newEventRelatedPlayerId || null,
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

  const openLineupForm = (entry?: MatchLineupEntry) => {
    setEditingLineupEntry(entry ?? null);
    setIsLineupFormOpen(true);
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

  const handleUpdateLineupEntry = async (entry: Partial<MatchLineupEntry> & Pick<MatchLineupEntry, 'matchId' | 'playerId'>) => {
    if (!selectedMatch) return;
    try {
      setSaveState('lineup', 'saving');
      const saved = await upsertMatchLineupEntry(entry);
      setLineupEntries((current) => {
        const filtered = current.filter((e) => e.playerId !== saved.playerId);
        return [...filtered, saved].sort((a, b) => Number(b.starter) - Number(a.starter) || (a.shirtNumber ?? 999) - (b.shirtNumber ?? 999));
      });
      setStats(await recalculatePlayerMatchStatistics(selectedMatch.id));
      setSaveState('lineup', 'saved');
    } catch (error) {
      console.error('[MatchCentreSection] Failed updating lineup entry', error);
      setSaveState('lineup', 'error', error instanceof Error ? error.message : 'Unable to update player.');
    }
  };

  const handleBatchUpdateLineupEntries = async (entries: Array<Partial<MatchLineupEntry> & Pick<MatchLineupEntry, 'matchId' | 'playerId'>>) => {
    if (!selectedMatch || entries.length === 0) return;
    try {
      setSaveState('lineup', 'saving');
      const savedList = await batchUpsertMatchLineupEntries(entries);
      setLineupEntries((current) => {
        const savedMap = new Map(savedList.map((e) => [e.playerId, e]));
        const next = current.map((e) => savedMap.get(e.playerId) || e);
        for (const saved of savedList) {
          if (!next.some((e) => e.playerId === saved.playerId)) {
            next.push(saved);
          }
        }
        return next.sort((a, b) => Number(b.starter) - Number(a.starter) || (a.shirtNumber ?? 999) - (b.shirtNumber ?? 999));
      });
      setStats(await recalculatePlayerMatchStatistics(selectedMatch.id));
      setSaveState('lineup', 'saved');
    } catch (error) {
      console.error('[MatchCentreSection] Failed batch updating lineup entries', error);
      setSaveState('lineup', 'error', error instanceof Error ? error.message : 'Unable to save formation.');
    }
  };

  const handleAddPlayerToMatch = async (player: CloudSquadPlayer, asStarter: boolean, slot?: FormationSlot) => {
    if (!selectedMatch) return;
    try {
      setSaveState('lineup', 'saving');
      const shirtNum = player.number !== undefined && player.number !== null && player.number !== ''
        ? Number(player.number)
        : null;
      const saved = await upsertMatchLineupEntry({
        matchId: selectedMatch.id,
        playerId: player.id,
        position: slot?.position || player.position || 'UTIL',
        starter: asStarter,
        shirtNumber: Number.isNaN(shirtNum) ? null : shirtNum,
        captain: false,
        pitchX: asStarter ? (slot?.x ?? 50) : null,
        pitchY: asStarter ? (slot?.y ?? 50) : null
      });
      setLineupEntries((current) => {
        const filtered = current.filter((e) => e.playerId !== player.id);
        return [...filtered, saved].sort((a, b) => Number(b.starter) - Number(a.starter) || (a.shirtNumber ?? 999) - (b.shirtNumber ?? 999));
      });
      setStats(await recalculatePlayerMatchStatistics(selectedMatch.id));
      setSaveState('lineup', 'saved');
    } catch (error) {
      console.error('[MatchCentreSection] Failed adding player to match', error);
      setSaveState('lineup', 'error', error instanceof Error ? error.message : 'Unable to add player.');
    }
  };

  const handleSaveLineupEntry = async () => {
    if (!selectedMatch || !lineupForm.playerId.trim()) return;

    try {
      setSaveState('lineup', 'saving');
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
        notes: lineupForm.notes.trim() || null,
        pitchX: editingLineupEntry?.pitchX ?? (lineupForm.starter ? 50 : null),
        pitchY: editingLineupEntry?.pitchY ?? (lineupForm.starter ? 50 : null)
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

  const handleRemoveLineupEntry = async (entryId: string) => {
    if (!selectedMatch) return;

    try {
      setSaveState('lineup', 'saving');
      await removeMatchLineupEntry(entryId);
      setLineupEntries((current) => current.filter((entry) => entry.id !== entryId));
      setStats(await recalculatePlayerMatchStatistics(selectedMatch.id));
      setSaveState('lineup', 'saved');
    } catch (error) {
      console.error('[MatchCentreSection] Failed removing lineup entry', error);
      setSaveState('lineup', 'error', error instanceof Error ? error.message : 'Unable to remove player.');
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

    const getPlayer = (playerId: string) => squadPlayers.find((player) => player.id === playerId);

    return (
      <div className="space-y-5">
        <MatchPitchBoard
          matchId={selectedMatch.id}
          lineupEntries={lineupEntries}
          squadPlayers={squadPlayers}
          onUpdateLineupEntry={handleUpdateLineupEntry}
          onBatchUpdateLineupEntries={handleBatchUpdateLineupEntries}
          onRemoveLineupEntry={handleRemoveLineupEntry}
          onAddPlayerToMatch={handleAddPlayerToMatch}
          onOpenEditModal={openLineupForm}
          saveStatus={saveStates.lineup}
        />

        {/* Modal Editor for Detailed Lineup Entry (Shirt #, Sub Minutes, Notes) */}
        {isLineupFormOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs">
            <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-black text-[#002142] font-display">
                  {editingLineupEntry ? 'Edit Player Match Details' : 'Add Player to Match'}
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
                  <select
                    value={lineupForm.playerId}
                    disabled={Boolean(editingLineupEntry)}
                    onChange={(event) => {
                      const player = getPlayer(event.target.value);
                      setLineupForm((current) => ({
                        ...current,
                        playerId: event.target.value,
                        position: player?.position ?? current.position,
                        shirtNumber: player?.number !== undefined ? String(player.number) : current.shirtNumber
                      }));
                    }}
                    className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs normal-case text-slate-900"
                  >
                    <option value="">Select squad player</option>
                    {squadPlayers
                      .filter((player) => editingLineupEntry?.playerId === player.id || !lineupEntries.some((entry) => entry.playerId === player.id))
                      .map((player) => (
                        <option key={player.id} value={player.id}>
                          {player.number ? `${player.number} · ` : ''}{player.firstName} {player.lastName}
                        </option>
                      ))}
                  </select>
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
                  disabled={!lineupForm.playerId || saveStates.lineup?.state === 'saving'}
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

    return <div className="space-y-5">
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-slate-950">
        <div className="aspect-video w-full bg-black">
          {matchVideoUrl ? <ReactPlayer ref={videoPlayerRef} src={matchVideoUrl} controls width="100%" height="100%" onTimeUpdate={() => setCurrentVideoSeconds(videoPlayerRef.current?.currentTime ?? 0)} /> : <div className="flex h-full items-center justify-center text-sm font-bold text-slate-500">Add match footage to start tagging events.</div>}
        </div>
        <div className="flex flex-col gap-3 border-t border-slate-800 p-4 sm:flex-row sm:items-center">
          <label className="min-w-0 flex-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Match video URL<input value={matchVideoUrl} onChange={(event) => setMatchVideoUrl(event.target.value)} placeholder="YouTube, Vimeo or direct video URL" className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium normal-case text-white" /></label>
          <div className="flex items-center gap-3"><span className="font-mono text-sm font-black text-cyan-300">{formatVideoTimestamp(currentVideoSeconds)}</span>{renderSaveStatus('match-video')}<button type="button" onClick={() => void handleSaveMatchVideo()} className="inline-flex items-center gap-2 rounded-md bg-cyan-400 px-3 py-2 text-xs font-black text-slate-950"><Save className="h-4 w-4" />Save video</button></div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.14em] text-sky-700">Video logger</p><h3 className="text-lg font-black text-slate-950">{editingEventId ? 'Edit event' : 'Tag current moment'}</h3></div>{renderSaveStatus('events')}</div>
          <div className="mb-4 grid grid-cols-3 gap-2">{EVENT_TYPE_OPTIONS.slice(0, 6).map((option) => <button key={option.value} type="button" onClick={() => setNewEventType(option.value)} className={`min-h-10 rounded-md border px-2 text-[10px] font-black ${newEventType === option.value ? 'border-sky-700 bg-sky-700 text-white' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>{option.label}</button>)}</div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <label className="text-[10px] font-black uppercase text-slate-500">Video timestamp<input readOnly value={formatVideoTimestamp(currentVideoSeconds)} className="mt-1 w-full rounded-md border border-cyan-200 bg-cyan-50 px-3 py-2 font-mono text-xs normal-case text-cyan-900" /></label>
            <label className="text-[10px] font-black uppercase text-slate-500">Match minute<input type="number" min="0" max="130" value={newEventMinute} onChange={(event) => setNewEventMinute(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-xs normal-case" /></label>
            <label className="text-[10px] font-black uppercase text-slate-500">Event type<select value={newEventType} onChange={(event) => setNewEventType(event.target.value as MatchEventType)} className="mt-1 w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-xs normal-case">{EVENT_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            <label className="text-[10px] font-black uppercase text-slate-500">Player<select value={newEventPlayerId} onChange={(event) => setNewEventPlayerId(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-xs normal-case"><option value="">Team / no player</option>{squadPlayers.map((player) => <option key={player.id} value={player.id}>{player.firstName} {player.lastName}</option>)}</select></label>
            <label className="text-[10px] font-black uppercase text-slate-500">Related player<select value={newEventRelatedPlayerId} onChange={(event) => setNewEventRelatedPlayerId(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-xs normal-case"><option value="">None</option>{squadPlayers.map((player) => <option key={player.id} value={player.id}>{player.firstName} {player.lastName}</option>)}</select></label>
          </div>
          <textarea value={newEventDescription} onChange={(event) => setNewEventDescription(event.target.value)} placeholder="Describe the action, trigger or coaching point" className="mt-3 min-h-[90px] w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-xs" />
          <div className="mt-3 flex gap-2">{editingEventId && <button type="button" onClick={cancelEventEdit} className="rounded-md border border-slate-300 px-3 py-2.5 text-xs font-black text-slate-700">Cancel</button>}<button type="button" disabled={saveStates.events?.state === 'saving'} onClick={() => void handleAddEvent()} className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-[#002142] px-3 py-2.5 text-xs font-black text-white disabled:opacity-60">{editingEventId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{editingEventId ? 'Save event' : 'Add at current time'}</button></div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="mb-5 flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700">Video chronology</p><h3 className="text-lg font-black text-slate-950">Tagged moments</h3></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{events.length} events</span></div>
          {events.length === 0 ? <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-xs font-medium text-slate-500">No events recorded yet.</div> : <div className="divide-y divide-slate-100">{events.slice().sort((a, b) => a.videoTimestampSeconds - b.videoTimestampSeconds).map((event) => <div key={event.id} className="group grid grid-cols-[68px_minmax(0,1fr)_72px] gap-3 py-4"><button type="button" onClick={() => seekVideo(event.videoTimestampSeconds)} title="Seek video" className="self-start rounded-md bg-slate-950 px-2 py-1.5 font-mono text-xs font-black text-cyan-300">{formatVideoTimestamp(event.videoTimestampSeconds)}</button><button type="button" onClick={() => seekVideo(event.videoTimestampSeconds)} className="min-w-0 text-left"><span className="text-[10px] font-black uppercase tracking-[0.12em] text-sky-700">{getEventLabel(event.eventType)} · {event.minute}'</span><div className="text-sm font-black text-slate-900">{playerName(event.playerId)}</div>{event.relatedPlayerId && <div className="text-xs text-slate-500">Related: {playerName(event.relatedPlayerId)}</div>}{event.description && <div className="mt-1 text-xs leading-5 text-slate-600">{event.description}</div>}</button><div className="flex items-start justify-end gap-1"><button type="button" onClick={() => handleEditEvent(event)} title="Edit event" className="p-2 text-slate-400 hover:text-sky-700"><Edit3 className="h-4 w-4" /></button><button type="button" onClick={() => void handleDeleteEvent(event.id)} title="Delete event" className="p-2 text-slate-400 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button></div></div>)}</div>}
        </section>
      </div>
    </div>;
  };

  const renderStatisticsTab = () => {
    if (!selectedMatch) return null;
    const totals = stats.reduce((total, stat) => ({ minutes: total.minutes + stat.minutesPlayed, goals: total.goals + stat.goals, assists: total.assists + stat.assists }), { minutes: 0, goals: 0, assists: 0 });
    const playerName = (playerId: string) => {
      const player = squadPlayers.find((item) => item.id === playerId);
      return player ? `${player.firstName} ${player.lastName}` : playerId;
    };

    return (
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[{ label: 'Players used', value: stats.length, icon: Users }, { label: 'Team minutes', value: totals.minutes, icon: Activity }, { label: 'Goals', value: totals.goals, icon: Trophy }, { label: 'Assists', value: totals.assists, icon: Swords }].map((metric) => <div key={metric.label} className="rounded-lg border border-slate-200 bg-white p-4"><metric.icon className="h-4 w-4 text-sky-700" /><div className="mt-3 text-2xl font-black text-slate-950">{metric.value}</div><div className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">{metric.label}</div></div>)}</div>
        <div className="rounded-lg border border-slate-200 bg-white p-5"><div className="mb-4"><p className="text-[10px] font-black uppercase tracking-[0.14em] text-sky-700">Performance output</p><h3 className="text-lg font-black text-slate-950">Player statistics</h3></div><div className="overflow-x-auto rounded-lg border border-slate-200">
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
                    <td className="px-3 py-3 font-bold text-slate-900">{playerName(stat.playerId)}</td>
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
        </div></div>
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
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-100 shadow-sm">
        <header className="bg-[#002142] text-white">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 sm:px-6">
            <button type="button" onClick={closeDetail} className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-bold text-slate-200 hover:bg-white/10 hover:text-white"><ChevronLeft className="h-4 w-4" />All matches</button>
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-200">{selectedMatch.competitionName}</span>
            <span className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase ${selectedMatch.status === 'played' ? 'border-white/20 text-slate-300' : 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300'}`}>{formatMatchStatusLabel(selectedMatch.status)}</span>
          </div>

          <div className="mx-auto grid max-w-3xl grid-cols-[minmax(0,1fr)_80px_minmax(0,1fr)] items-center gap-3 px-4 py-6 sm:grid-cols-[minmax(0,1fr)_120px_minmax(0,1fr)] sm:py-8">
            <div className="flex min-w-0 flex-col items-center text-center"><TeamCrest name={homeTeam.name} logoUrl={homeTeam.logoUrl} isAlula={homeTeam.isAlula} className="h-14 w-14 rounded-full border border-white/20 bg-white p-1 sm:h-16 sm:w-16" /><span className="mt-2 max-w-full truncate text-sm font-black sm:text-base">{homeTeamName}</span><span className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">Home</span></div>
            <div className="text-center">{hasScore ? <div className="text-3xl font-black tabular-nums sm:text-4xl">{homeScore} <span className="text-slate-500">:</span> {awayScore}</div> : <div className="text-xl font-black text-sky-200">VS</div>}<div className="mt-2 text-[10px] font-bold text-slate-300">{selectedMatch.time || 'Time TBD'}</div></div>
            <div className="flex min-w-0 flex-col items-center text-center"><TeamCrest name={awayTeam.name} logoUrl={awayTeam.logoUrl} isAlula={awayTeam.isAlula} className="h-14 w-14 rounded-full border border-white/20 bg-white p-1 sm:h-16 sm:w-16" /><span className="mt-2 max-w-full truncate text-sm font-black sm:text-base">{awayTeamName}</span><span className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">Away</span></div>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-white/10 px-4 py-3 text-[11px] font-semibold text-slate-300"><span className="inline-flex items-center gap-2"><CalendarDays className="h-3.5 w-3.5 text-sky-300" />{formatDate(selectedMatch.date)}</span><span className="inline-flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-sky-300" />{selectedMatch.venue || selectedMatch.location || 'Venue TBD'}</span></div>
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
