import React, { useEffect, useMemo, useState } from 'react';
import {
  Video,
  PlayCircle,
  Save,
  Plus,
  Eye,
  Shield,
  Swords,
  Dumbbell,
  Binoculars,
  Trash2,
  type LucideIcon
} from 'lucide-react';
import { useTeamContext } from '../contexts/TeamContext';
import { ScoutingSection } from './ScoutingSection';
import { getMatchById, listMatches } from '../services/matches/matchService';
import {
  createOrUpdateOpponentAnalysis,
  getOpponentAnalysisByOpponentTeamId,
  updateOpponentAnalysisSlidesUrl,
  updateOpponentAnalysisVideoUrl
} from '../services/matches/opponentAnalysisService';
import { createOrUpdateMatchAnalysis, getMatchAnalysisByMatchId } from '../services/matches/matchAnalysisService';
import {
  createOrUpdateTrainingAnalysis,
  getTrainingAnalysisBySessionUid,
  listRecentFootballSessions,
  type FootballSessionSummary
} from '../services/training/trainingAnalysisService';
import {
  createVideoClipForMatchAnalysis,
  createVideoClipForTrainingAnalysis,
  deleteVideoClip,
  listVideoClipsByMatchAnalysisId,
  listVideoClipsByTrainingAnalysisId
} from '../services/video/videoClipsService';
import { Match, MatchAnalysis, OpponentAnalysis, OpponentAnalysisTag, TrainingAnalysis, VideoClip } from '../types';
import { formatVideoTimestamp, toSlideEmbedUrl, toVideoEmbedUrl } from '../utils/mediaUrls';
import { clearWorkspaceRestoreState, readWorkspaceRestoreState } from '../utils/workspaceRestore';

type VideoAnalysisArea = 'matches' | 'opponent-analysis' | 'training-sessions' | 'scouting';

const PENDING_OPPONENT_TEAM_ID_KEY = 'video_analysis_pending_opponent_team_id';

type ClipFormState = { videoUrl: string; startTime: string; endTime: string; title: string; notes: string };
const EMPTY_CLIP_FORM: ClipFormState = { videoUrl: '', startTime: '0', endTime: '', title: '', notes: '' };

const AREA_TABS: Array<{ key: VideoAnalysisArea; label: string; icon: LucideIcon }> = [
  { key: 'matches', label: 'Matches', icon: Swords },
  { key: 'opponent-analysis', label: 'Opponent Analysis', icon: Shield },
  { key: 'training-sessions', label: 'Training Sessions', icon: Dumbbell },
  { key: 'scouting', label: 'Scouting', icon: Binoculars }
];

const opponentTagGroups: Array<{ key: 'build-up' | 'pressing' | 'block' | 'defensive-line' | 'offensive-transition' | 'defensive-transition'; title: string; values: Array<{ value: OpponentAnalysisTag; label: string }> }> = [
  { key: 'build-up', title: 'Build-up', values: [{ value: 'short', label: 'Short' }, { value: 'long', label: 'Long' }, { value: 'mixed', label: 'Mixed' }] },
  { key: 'pressing', title: 'Pressing', values: [{ value: 'high', label: 'High' }, { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' }] },
  { key: 'block', title: 'Block', values: [{ value: 'high', label: 'High' }, { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' }] },
  { key: 'defensive-line', title: 'Defensive Line', values: [{ value: 'high', label: 'High' }, { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' }] },
  { key: 'offensive-transition', title: 'Offensive Transition', values: [{ value: 'direct', label: 'Direct' }, { value: 'possession', label: 'Possession' }] },
  { key: 'defensive-transition', title: 'Defensive Transition', values: [{ value: 'immediate_pressure', label: 'Immediate Pressure' }, { value: 'retreat', label: 'Retreat' }] }
];

export const VideoAnalysisSection: React.FC = () => {
  const { selectedTeamId } = useTeamContext();
  const [activeTab, setActiveTab] = useState<VideoAnalysisArea>('matches');
  const [matchOptions, setMatchOptions] = useState<Match[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<string>('');
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [opponentAnalysis, setOpponentAnalysis] = useState<OpponentAnalysis | null>(null);
  const [isLoadingOpponentAnalysis, setIsLoadingOpponentAnalysis] = useState(false);
  const [newSlidesUrl, setNewSlidesUrl] = useState('');
  const [newVideoUrl, setNewVideoUrl] = useState('');
  const [analysisSummary, setAnalysisSummary] = useState('');
  // Set by MatchCentreSection's "Open in Video Analysis" shortcut so the correct opponent is
  // preselected on arrival; cleared once consumed so a normal visit shows the selector as usual.
  const [pendingOpponentTeamId, setPendingOpponentTeamId] = useState<string | null>(() =>
    readWorkspaceRestoreState<string | null>(PENDING_OPPONENT_TEAM_ID_KEY, null)
  );
  const [selectedPlayedMatchId, setSelectedPlayedMatchId] = useState<string>('');
  const [matchAnalysis, setMatchAnalysis] = useState<MatchAnalysis | null>(null);
  const [matchAnalysisSummaryDraft, setMatchAnalysisSummaryDraft] = useState('');
  const [isLoadingMatchAnalysis, setIsLoadingMatchAnalysis] = useState(false);
  const [isSavingMatchAnalysis, setIsSavingMatchAnalysis] = useState(false);
  const [videoClips, setVideoClips] = useState<VideoClip[]>([]);
  const [isLoadingClips, setIsLoadingClips] = useState(false);
  const [isSavingClip, setIsSavingClip] = useState(false);
  const [clipForm, setClipForm] = useState<ClipFormState>(EMPTY_CLIP_FORM);
  const [trainingSessions, setTrainingSessions] = useState<FootballSessionSummary[]>([]);
  const [selectedTrainingSessionUid, setSelectedTrainingSessionUid] = useState<string>('');
  const [trainingAnalysis, setTrainingAnalysis] = useState<TrainingAnalysis | null>(null);
  const [trainingAnalysisSummaryDraft, setTrainingAnalysisSummaryDraft] = useState('');
  const [isLoadingTrainingAnalysis, setIsLoadingTrainingAnalysis] = useState(false);
  const [isSavingTrainingAnalysis, setIsSavingTrainingAnalysis] = useState(false);
  const [trainingVideoClips, setTrainingVideoClips] = useState<VideoClip[]>([]);
  const [isLoadingTrainingClips, setIsLoadingTrainingClips] = useState(false);
  const [isSavingTrainingClip, setIsSavingTrainingClip] = useState(false);
  const [trainingClipForm, setTrainingClipForm] = useState<ClipFormState>(EMPTY_CLIP_FORM);
  const opponentOptions = useMemo(() => {
    const byOpponent = new Map<string, Match>();
    for (const match of matchOptions) {
      if (!byOpponent.has(match.opponentTeamId)) byOpponent.set(match.opponentTeamId, match);
    }
    return Array.from(byOpponent.values());
  }, [matchOptions]);
  const playedMatches = useMemo(
    () => matchOptions.filter((match) => match.status === 'played').slice().reverse(),
    [matchOptions]
  );

  useEffect(() => {
    if (!selectedTeamId) return;

    void listMatches(selectedTeamId)
      .then((matches) => {
        setMatchOptions(matches);
        // Functional update: avoids a stale-closure bug where this async callback (created once,
        // deps=[selectedTeamId]) would overwrite a selection already made elsewhere (e.g. the
        // pending-opponent preselect effect below) by only ever seeing the mount-time '' value.
        setSelectedMatchId((current) => (current ? current : matches[0]?.id ?? current));
      })
      .catch((error) => {
        console.error('[VideoAnalysisSection] Failed loading team matches', error);
        setMatchOptions([]);
      });
  }, [selectedTeamId]);

  useEffect(() => {
    if (!selectedPlayedMatchId && playedMatches.length > 0) {
      setSelectedPlayedMatchId(playedMatches[0].id);
    }
  }, [playedMatches, selectedPlayedMatchId]);

  useEffect(() => {
    if (!pendingOpponentTeamId) return;
    const match = opponentOptions.find((option) => option.opponentTeamId === pendingOpponentTeamId);
    if (!match) return;

    setActiveTab('opponent-analysis');
    setSelectedMatchId(match.id);
    clearWorkspaceRestoreState(PENDING_OPPONENT_TEAM_ID_KEY);
    setPendingOpponentTeamId(null);
  }, [pendingOpponentTeamId, opponentOptions]);

  useEffect(() => {
    if (!selectedMatchId || activeTab !== 'opponent-analysis') {
      setSelectedMatch(null);
      setOpponentAnalysis(null);
      return;
    }

    void (async () => {
      try {
        setIsLoadingOpponentAnalysis(true);
        const match = await getMatchById(selectedMatchId);
        const analysis = match
          ? await getOpponentAnalysisByOpponentTeamId(match.opponentTeamId)
          : null;
        setSelectedMatch(match);
        setOpponentAnalysis(analysis);
        setNewSlidesUrl(analysis?.slidesUrl ?? '');
        setNewVideoUrl(analysis?.videoUrl ?? '');
        setAnalysisSummary(analysis?.summary ?? '');
      } catch (error) {
        console.error('[VideoAnalysisSection] Failed loading opponent analysis', error);
        setSelectedMatch(null);
        setOpponentAnalysis(null);
      } finally {
        setIsLoadingOpponentAnalysis(false);
      }
    })();
  }, [selectedMatchId, activeTab]);

  useEffect(() => {
    if (!selectedPlayedMatchId || activeTab !== 'matches') {
      setMatchAnalysis(null);
      setMatchAnalysisSummaryDraft('');
      return;
    }

    void (async () => {
      try {
        setIsLoadingMatchAnalysis(true);
        const analysis = await getMatchAnalysisByMatchId(selectedPlayedMatchId);
        setMatchAnalysis(analysis);
        setMatchAnalysisSummaryDraft(analysis?.summary ?? '');
      } catch (error) {
        console.error('[VideoAnalysisSection] Failed loading match analysis', error);
        setMatchAnalysis(null);
        setMatchAnalysisSummaryDraft('');
      } finally {
        setIsLoadingMatchAnalysis(false);
      }
    })();
  }, [selectedPlayedMatchId, activeTab]);

  useEffect(() => {
    if (!matchAnalysis) {
      setVideoClips([]);
      return;
    }

    void (async () => {
      try {
        setIsLoadingClips(true);
        const clips = await listVideoClipsByMatchAnalysisId(matchAnalysis.id);
        setVideoClips(clips);
      } catch (error) {
        console.error('[VideoAnalysisSection] Failed loading video clips', error);
        setVideoClips([]);
      } finally {
        setIsLoadingClips(false);
      }
    })();
  }, [matchAnalysis]);

  const handleSaveMatchAnalysis = async () => {
    if (!selectedPlayedMatchId) return;

    try {
      setIsSavingMatchAnalysis(true);
      const updated = await createOrUpdateMatchAnalysis({
        id: matchAnalysis?.id,
        matchId: selectedPlayedMatchId,
        summary: matchAnalysisSummaryDraft
      });
      setMatchAnalysis(updated);
      setMatchAnalysisSummaryDraft(updated.summary);
    } catch (error) {
      console.error('[VideoAnalysisSection] Failed saving match analysis', error);
    } finally {
      setIsSavingMatchAnalysis(false);
    }
  };

  const handleAddClip = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!matchAnalysis || !clipForm.videoUrl.trim() || !clipForm.title.trim()) return;

    try {
      setIsSavingClip(true);
      const created = await createVideoClipForMatchAnalysis(matchAnalysis.id, {
        videoUrl: clipForm.videoUrl.trim(),
        startTime: Number(clipForm.startTime) || 0,
        endTime: clipForm.endTime.trim() ? Number(clipForm.endTime) : null,
        title: clipForm.title.trim(),
        notes: clipForm.notes.trim() || null
      });
      setVideoClips((prev) => [...prev, created].sort((a, b) => a.startTime - b.startTime));
      setClipForm(EMPTY_CLIP_FORM);
    } catch (error) {
      console.error('[VideoAnalysisSection] Failed creating video clip', error);
    } finally {
      setIsSavingClip(false);
    }
  };

  const handleDeleteClip = async (clipId: string) => {
    try {
      await deleteVideoClip(clipId);
      setVideoClips((prev) => prev.filter((clip) => clip.id !== clipId));
    } catch (error) {
      console.error('[VideoAnalysisSection] Failed deleting video clip', error);
    }
  };

  useEffect(() => {
    void listRecentFootballSessions()
      .then((sessions) => {
        setTrainingSessions(sessions);
        setSelectedTrainingSessionUid((current) => (current ? current : sessions[0]?.id ?? current));
      })
      .catch((error) => {
        console.error('[VideoAnalysisSection] Failed loading football sessions', error);
        setTrainingSessions([]);
      });
  }, []);

  useEffect(() => {
    if (!selectedTrainingSessionUid || activeTab !== 'training-sessions') {
      setTrainingAnalysis(null);
      setTrainingAnalysisSummaryDraft('');
      return;
    }

    void (async () => {
      try {
        setIsLoadingTrainingAnalysis(true);
        const analysis = await getTrainingAnalysisBySessionUid(selectedTrainingSessionUid);
        setTrainingAnalysis(analysis);
        setTrainingAnalysisSummaryDraft(analysis?.summary ?? '');
      } catch (error) {
        console.error('[VideoAnalysisSection] Failed loading training analysis', error);
        setTrainingAnalysis(null);
        setTrainingAnalysisSummaryDraft('');
      } finally {
        setIsLoadingTrainingAnalysis(false);
      }
    })();
  }, [selectedTrainingSessionUid, activeTab]);

  useEffect(() => {
    if (!trainingAnalysis) {
      setTrainingVideoClips([]);
      return;
    }

    void (async () => {
      try {
        setIsLoadingTrainingClips(true);
        const clips = await listVideoClipsByTrainingAnalysisId(trainingAnalysis.id);
        setTrainingVideoClips(clips);
      } catch (error) {
        console.error('[VideoAnalysisSection] Failed loading training video clips', error);
        setTrainingVideoClips([]);
      } finally {
        setIsLoadingTrainingClips(false);
      }
    })();
  }, [trainingAnalysis]);

  const handleSaveTrainingAnalysis = async () => {
    if (!selectedTrainingSessionUid) return;

    try {
      setIsSavingTrainingAnalysis(true);
      const updated = await createOrUpdateTrainingAnalysis({
        id: trainingAnalysis?.id,
        sessionUid: selectedTrainingSessionUid,
        summary: trainingAnalysisSummaryDraft
      });
      setTrainingAnalysis(updated);
      setTrainingAnalysisSummaryDraft(updated.summary);
    } catch (error) {
      console.error('[VideoAnalysisSection] Failed saving training analysis', error);
    } finally {
      setIsSavingTrainingAnalysis(false);
    }
  };

  const handleAddTrainingClip = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!trainingAnalysis || !trainingClipForm.videoUrl.trim() || !trainingClipForm.title.trim()) return;

    try {
      setIsSavingTrainingClip(true);
      const created = await createVideoClipForTrainingAnalysis(trainingAnalysis.id, {
        videoUrl: trainingClipForm.videoUrl.trim(),
        startTime: Number(trainingClipForm.startTime) || 0,
        endTime: trainingClipForm.endTime.trim() ? Number(trainingClipForm.endTime) : null,
        title: trainingClipForm.title.trim(),
        notes: trainingClipForm.notes.trim() || null
      });
      setTrainingVideoClips((prev) => [...prev, created].sort((a, b) => a.startTime - b.startTime));
      setTrainingClipForm(EMPTY_CLIP_FORM);
    } catch (error) {
      console.error('[VideoAnalysisSection] Failed creating training video clip', error);
    } finally {
      setIsSavingTrainingClip(false);
    }
  };

  const handleDeleteTrainingClip = async (clipId: string) => {
    try {
      await deleteVideoClip(clipId);
      setTrainingVideoClips((prev) => prev.filter((clip) => clip.id !== clipId));
    } catch (error) {
      console.error('[VideoAnalysisSection] Failed deleting training video clip', error);
    }
  };

  const handleToggleTag = async (tag: OpponentAnalysisTag) => {
    if (!selectedMatch) return;

    const existingTags = opponentAnalysis?.tags ?? [];
    const nextTags = existingTags.includes(tag)
      ? existingTags.filter(t => t !== tag)
      : [...existingTags, tag];

    try {
      const updated = await createOrUpdateOpponentAnalysis({
        id: opponentAnalysis?.id,
        opponentTeamId: selectedMatch.opponentTeamId,
        summary: opponentAnalysis?.summary ?? '',
        tags: nextTags,
        slidesUrl: opponentAnalysis?.slidesUrl ?? null,
        videoUrl: opponentAnalysis?.videoUrl ?? null
      });
      setOpponentAnalysis(updated);
    } catch (error) {
      console.error('[VideoAnalysisSection] Failed saving opponent analysis tags', error);
    }
  };

  const handleSaveAnalysisSummary = async () => {
    if (!selectedMatch) return;

    try {
      const updated = await createOrUpdateOpponentAnalysis({
        id: opponentAnalysis?.id,
        opponentTeamId: selectedMatch.opponentTeamId,
        summary: analysisSummary,
        tags: opponentAnalysis?.tags ?? [],
        slidesUrl: newSlidesUrl || null,
        videoUrl: newVideoUrl || null
      });
      setOpponentAnalysis(updated);
      setAnalysisSummary(updated.summary);
    } catch (error) {
      console.error('[VideoAnalysisSection] Failed saving opponent analysis summary', error);
    }
  };

  const handlePersistUrl = async (type: 'slides' | 'video') => {
    if (!selectedMatch) return;

    try {
      const updated = type === 'slides'
        ? await updateOpponentAnalysisSlidesUrl(selectedMatch.opponentTeamId, newSlidesUrl || null)
        : await updateOpponentAnalysisVideoUrl(selectedMatch.opponentTeamId, newVideoUrl || null);
      setOpponentAnalysis(updated);
    } catch (error) {
      console.error('[VideoAnalysisSection] Failed saving opponent analysis URL', error);
    }
  };

  const handleCreateOpponentAnalysis = async () => {
    if (!selectedMatch) return;

    try {
      const created = await createOrUpdateOpponentAnalysis({
        opponentTeamId: selectedMatch.opponentTeamId,
        summary: '',
        tags: [],
        slidesUrl: null,
        videoUrl: null
      });
      setOpponentAnalysis(created);
    } catch (error) {
      console.error('[VideoAnalysisSection] Failed creating opponent analysis', error);
    }
  };

  function formatMatchOptionLabel(match: Match): string {
    const score = match.ourScore != null && match.opponentScore != null ? ` (${match.ourScore}-${match.opponentScore})` : '';
    return `${match.date} · vs ${match.opponentName || match.opponentTeamId}${score}`;
  }

  function formatSessionOptionLabel(session: FootballSessionSummary): string {
    const label = session.mainObjective.trim() || (session.sessionNumber ? `Session #${session.sessionNumber}` : 'Training session');
    return `${session.date} · ${label}`;
  }

  function renderClipsSection(params: {
    analysisId: string | null;
    emptyAnalysisMessage: string;
    clips: VideoClip[];
    isLoadingClips: boolean;
    isSavingClip: boolean;
    form: ClipFormState;
    onFormChange: (form: ClipFormState) => void;
    onSubmit: (event: React.FormEvent) => void;
    onDelete: (clipId: string) => void;
  }) {
    const { analysisId, emptyAnalysisMessage, clips, isLoadingClips: loadingClips, isSavingClip: savingClip, form, onFormChange, onSubmit, onDelete } = params;

    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
        <h3 className="text-base font-black text-slate-900">Clips</h3>

        {!analysisId ? (
          <p className="text-xs text-slate-400">{emptyAnalysisMessage}</p>
        ) : (
          <>
            <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
              <input
                required
                value={form.videoUrl}
                onChange={(event) => onFormChange({ ...form, videoUrl: event.target.value })}
                placeholder="Video URL"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-sky-500"
              />
              <input
                required
                value={form.title}
                onChange={(event) => onFormChange({ ...form, title: event.target.value })}
                placeholder="Clip title"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-sky-500"
              />
              <input
                type="number"
                min={0}
                value={form.startTime}
                onChange={(event) => onFormChange({ ...form, startTime: event.target.value })}
                placeholder="Start (seconds)"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-sky-500"
              />
              <input
                type="number"
                min={0}
                value={form.endTime}
                onChange={(event) => onFormChange({ ...form, endTime: event.target.value })}
                placeholder="End (seconds, optional)"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-sky-500"
              />
              <textarea
                value={form.notes}
                onChange={(event) => onFormChange({ ...form, notes: event.target.value })}
                placeholder="Notes (optional)"
                className="sm:col-span-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-sky-500"
              />
              <button
                type="submit"
                disabled={savingClip}
                className="sm:col-span-2 inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-3 py-2 text-xs font-bold text-white hover:bg-sky-500 disabled:opacity-60"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Clip
              </button>
            </form>

            {loadingClips ? (
              <p className="text-xs text-slate-400">Loading clips...</p>
            ) : clips.length === 0 ? (
              <p className="text-xs text-slate-400">No clips added yet.</p>
            ) : (
              <div className="space-y-2">
                {clips.map((clip) => (
                  <div key={clip.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-slate-800">{clip.title}</p>
                      <p className="font-mono text-[11px] text-slate-500">
                        {formatVideoTimestamp(clip.startTime)}
                        {clip.endTime != null ? ` – ${formatVideoTimestamp(clip.endTime)}` : ''}
                      </p>
                      {clip.notes && <p className="mt-0.5 text-xs text-slate-500">{clip.notes}</p>}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <a href={clip.videoUrl} target="_blank" rel="noreferrer" className="text-xs font-bold text-sky-600 hover:text-sky-700">
                        Watch
                      </a>
                      <button
                        type="button"
                        onClick={() => void onDelete(clip.id)}
                        className="p-1 text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  function renderMatchesTab() {
    return (
      <div className="space-y-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-black text-slate-900">Select Match</h3>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              {playedMatches.length} Played Matches
            </span>
          </div>

          {playedMatches.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-sm">
              No played matches available yet.
            </div>
          ) : (
            <select
              value={selectedPlayedMatchId}
              onChange={(event) => setSelectedPlayedMatchId(event.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:border-sky-500"
            >
              {playedMatches.map((match) => (
                <option key={match.id} value={match.id}>
                  {formatMatchOptionLabel(match)}
                </option>
              ))}
            </select>
          )}
        </div>

        {isLoadingMatchAnalysis ? (
          <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center">
            <p className="text-sm text-slate-400">Loading match analysis...</p>
          </div>
        ) : !selectedPlayedMatchId ? (
          <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center">
            <p className="text-sm text-slate-400">Select a played match to view or create its analysis.</p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3 mb-3">
                <h3 className="text-base font-black text-slate-900">Match Summary</h3>
                <button
                  type="button"
                  onClick={() => void handleSaveMatchAnalysis()}
                  disabled={isSavingMatchAnalysis}
                  className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-3 py-2 text-xs font-bold text-white hover:bg-sky-500 disabled:opacity-60"
                >
                  <Save className="w-3.5 h-3.5" />
                  {matchAnalysis ? 'Save' : 'Create Analysis'}
                </button>
              </div>
              <textarea
                value={matchAnalysisSummaryDraft}
                onChange={(event) => setMatchAnalysisSummaryDraft(event.target.value)}
                placeholder="Key moments, tactical notes and coaching takeaways for this match..."
                className="min-h-32 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-800 outline-none focus:border-sky-500"
              />
            </div>

            {renderClipsSection({
              analysisId: matchAnalysis?.id ?? null,
              emptyAnalysisMessage: 'Create the match analysis above before adding clips.',
              clips: videoClips,
              isLoadingClips,
              isSavingClip,
              form: clipForm,
              onFormChange: setClipForm,
              onSubmit: (event) => void handleAddClip(event),
              onDelete: (clipId) => void handleDeleteClip(clipId)
            })}
          </>
        )}
      </div>
    );
  }

  function renderTrainingSessionsTab() {
    return (
      <div className="space-y-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-black text-slate-900">Select Training Session</h3>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              {trainingSessions.length} Sessions
            </span>
          </div>

          {trainingSessions.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-sm">
              No training sessions available yet.
            </div>
          ) : (
            <select
              value={selectedTrainingSessionUid}
              onChange={(event) => setSelectedTrainingSessionUid(event.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:border-sky-500"
            >
              {trainingSessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {formatSessionOptionLabel(session)}
                </option>
              ))}
            </select>
          )}
        </div>

        {isLoadingTrainingAnalysis ? (
          <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center">
            <p className="text-sm text-slate-400">Loading training session analysis...</p>
          </div>
        ) : !selectedTrainingSessionUid ? (
          <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center">
            <p className="text-sm text-slate-400">Select a training session to view or create its analysis.</p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3 mb-3">
                <h3 className="text-base font-black text-slate-900">Session Summary</h3>
                <button
                  type="button"
                  onClick={() => void handleSaveTrainingAnalysis()}
                  disabled={isSavingTrainingAnalysis}
                  className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-3 py-2 text-xs font-bold text-white hover:bg-sky-500 disabled:opacity-60"
                >
                  <Save className="w-3.5 h-3.5" />
                  {trainingAnalysis ? 'Save' : 'Create Analysis'}
                </button>
              </div>
              <textarea
                value={trainingAnalysisSummaryDraft}
                onChange={(event) => setTrainingAnalysisSummaryDraft(event.target.value)}
                placeholder="Key drills, individual notes and coaching takeaways for this session..."
                className="min-h-32 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-800 outline-none focus:border-sky-500"
              />
            </div>

            {renderClipsSection({
              analysisId: trainingAnalysis?.id ?? null,
              emptyAnalysisMessage: 'Create the session analysis above before adding clips.',
              clips: trainingVideoClips,
              isLoadingClips: isLoadingTrainingClips,
              isSavingClip: isSavingTrainingClip,
              form: trainingClipForm,
              onFormChange: setTrainingClipForm,
              onSubmit: (event) => void handleAddTrainingClip(event),
              onDelete: (clipId) => void handleDeleteTrainingClip(clipId)
            })}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Video Header */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl border border-slate-800">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-cyan-400 text-xs font-mono font-bold uppercase tracking-widest mb-1">
              <Video className="w-4 h-4" />
              <span>Video Analysis & Tactical Review</span>
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white font-display">
              Match & Session Video Breakdown
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Catalog game footage, timestamp critical tactical moments, tag game phases, and share clip feedback with squad.
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-800 pt-4">
          {AREA_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-cyan-500 text-slate-950'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === 'matches' ? (
        renderMatchesTab()
      ) : activeTab === 'training-sessions' ? (
        renderTrainingSessionsTab()
      ) : activeTab === 'scouting' ? (
        <ScoutingSection />
      ) : (
        <div className="space-y-6">
          {/* Opponent Selector */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black text-slate-900">Select Opponent</h3>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                {opponentOptions.length} Opponents Available
              </span>
            </div>

            {matchOptions.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-sm">
                No opponents available yet.
              </div>
            ) : (
              <div className="space-y-3">
                <select
                  value={selectedMatchId}
                  onChange={(e) => setSelectedMatchId(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:border-sky-500"
                >
                  {opponentOptions.map((match) => (
                    <option key={match.id} value={match.id}>
                      {match.opponentName || match.opponentTeamId}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Opponent Analysis Content */}
          {isLoadingOpponentAnalysis ? (
            <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center">
              <p className="text-sm text-slate-400">Loading opponent analysis...</p>
            </div>
          ) : !selectedMatch ? (
            <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center">
              <p className="text-sm text-slate-400">Please select a match to view opponent analysis.</p>
            </div>
          ) : !opponentAnalysis ? (
            <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-4">
              <p className="text-sm text-slate-600">No opponent analysis has been created yet.</p>
              <button
                type="button"
                onClick={() => void handleCreateOpponentAnalysis()}
                className="inline-flex items-center gap-2 px-5 py-3 bg-sky-600 hover:bg-sky-500 text-white text-sm font-bold rounded-xl transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create Opponent Analysis
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Tactical Characteristics */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-black text-slate-900">Tactical Characteristics</h3>
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{selectedMatch.opponentTeamId}</span>
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

              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <h3 className="text-base font-black text-slate-900">Scouting Summary</h3>
                  <button type="button" onClick={() => void handleSaveAnalysisSummary()} className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-3 py-2 text-xs font-bold text-white hover:bg-sky-500"><Save className="w-3.5 h-3.5" />Save Summary</button>
                </div>
                <textarea value={analysisSummary} onChange={(event) => setAnalysisSummary(event.target.value)} placeholder="Key patterns, threats, weaknesses and coaching priorities" className="min-h-32 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-800 outline-none focus:border-sky-500" />
              </div>

              {/* Google Slides and Video */}
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <Eye className="w-4 h-4 text-slate-700" />
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
                      className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-3 py-2 text-xs font-bold text-white hover:bg-sky-500"
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
                    <h3 className="text-base font-black text-slate-900">Opponent Analysis Video</h3>
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
                      className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-3 py-2 text-xs font-bold text-white hover:bg-sky-500"
                    >
                      <Save className="w-3.5 h-3.5" />
                      Save Video
                    </button>
                    {toVideoEmbedUrl(newVideoUrl) && (
                      <iframe
                        title="Opponent Analysis Video"
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
          )}
        </div>
      )}
    </div>
  );
};
