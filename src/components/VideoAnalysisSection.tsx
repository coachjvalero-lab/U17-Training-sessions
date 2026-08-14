import React, { useEffect, useState } from 'react';
import { 
  Video, 
  PlusCircle, 
  PlayCircle, 
  Search, 
  Trash2, 
  Edit3, 
  X, 
  Save, 
  ExternalLink,
  Plus,
  Eye,
  Shield
} from 'lucide-react';
import { useTeamContext } from '../contexts/TeamContext';
import { getMatchById, listMatches } from '../services/matches/matchService';
import {
  createOrUpdateOpponentAnalysis,
  getOpponentAnalysisByMatchId,
  updateOpponentAnalysisSlidesUrl,
  updateOpponentAnalysisVideoUrl
} from '../services/matches/opponentAnalysisService';
import { VideoAnalysis, GameMoment, Match, OpponentAnalysis, OpponentAnalysisTag } from '../types';
import { readWorkspaceRestoreState, writeWorkspaceRestoreState } from '../utils/workspaceRestore';

interface VideoAnalysisSectionProps {
  sessions: VideoAnalysis[];
  onUpdateSessions: (sessions: VideoAnalysis[]) => void;
}

type VideoAnalysisTab = 'video-analysis' | 'opponent-analysis';

const opponentTagGroups: Array<{ key: 'build-up' | 'pressing' | 'block' | 'defensive-line' | 'offensive-transition' | 'defensive-transition'; title: string; values: Array<{ value: OpponentAnalysisTag; label: string }> }> = [
  { key: 'build-up', title: 'Build-up', values: [{ value: 'short', label: 'Short' }, { value: 'long', label: 'Long' }, { value: 'mixed', label: 'Mixed' }] },
  { key: 'pressing', title: 'Pressing', values: [{ value: 'high', label: 'High' }, { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' }] },
  { key: 'block', title: 'Block', values: [{ value: 'high', label: 'High' }, { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' }] },
  { key: 'defensive-line', title: 'Defensive Line', values: [{ value: 'high', label: 'High' }, { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' }] },
  { key: 'offensive-transition', title: 'Offensive Transition', values: [{ value: 'direct', label: 'Direct' }, { value: 'possession', label: 'Possession' }] },
  { key: 'defensive-transition', title: 'Defensive Transition', values: [{ value: 'immediate_pressure', label: 'Immediate Pressure' }, { value: 'retreat', label: 'Retreat' }] }
];

export const VideoAnalysisSection: React.FC<VideoAnalysisSectionProps> = ({
  sessions,
  onUpdateSessions
}) => {
  const contextStorageKey = 'video_analysis_section';
  const restoredContext = readWorkspaceRestoreState(contextStorageKey, {
    searchTerm: '',
    gameMomentFilter: 'ALL'
  });
  const { selectedTeamId } = useTeamContext();
  const [activeTab, setActiveTab] = useState<VideoAnalysisTab>('video-analysis');
  const [searchTerm, setSearchTerm] = useState(restoredContext.searchTerm);
  const [gameMomentFilter, setGameMomentFilter] = useState<string>(restoredContext.gameMomentFilter);
  const [matchOptions, setMatchOptions] = useState<Match[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<string>('');
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [opponentAnalysis, setOpponentAnalysis] = useState<OpponentAnalysis | null>(null);
  const [isLoadingOpponentAnalysis, setIsLoadingOpponentAnalysis] = useState(false);
  const [newSlidesUrl, setNewSlidesUrl] = useState('');
  const [newVideoUrl, setNewVideoUrl] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<VideoAnalysis | null>(null);

  useEffect(() => {
    writeWorkspaceRestoreState(contextStorageKey, { searchTerm, gameMomentFilter });
  }, [searchTerm, gameMomentFilter]);

  useEffect(() => {
    if (!selectedTeamId) return;

    void listMatches(selectedTeamId)
      .then((matches) => {
        setMatchOptions(matches);
        if (!selectedMatchId && matches.length > 0) {
          setSelectedMatchId(matches[0].id);
        }
      })
      .catch((error) => {
        console.error('[VideoAnalysisSection] Failed loading team matches', error);
        setMatchOptions([]);
      });
  }, [selectedTeamId]);

  useEffect(() => {
    if (!selectedMatchId || activeTab !== 'opponent-analysis') {
      setSelectedMatch(null);
      setOpponentAnalysis(null);
      return;
    }

    void (async () => {
      try {
        setIsLoadingOpponentAnalysis(true);
        const [match, analysis] = await Promise.all([
          getMatchById(selectedMatchId),
          getOpponentAnalysisByMatchId(selectedMatchId)
        ]);
        setSelectedMatch(match);
        setOpponentAnalysis(analysis);
        setNewSlidesUrl(analysis?.slidesUrl ?? '');
        setNewVideoUrl(analysis?.videoUrl ?? '');
      } catch (error) {
        console.error('[VideoAnalysisSection] Failed loading opponent analysis', error);
        setSelectedMatch(null);
        setOpponentAnalysis(null);
      } finally {
        setIsLoadingOpponentAnalysis(false);
      }
    })();
  }, [selectedMatchId, activeTab]);

  const [formData, setFormData] = useState<{
    title: string;
    matchOrSessionDate: string;
    opponentOrTopic: string;
    videoUrl: string;
    gameMoment: GameMoment;
    tagsInput: string;
    summary: string;
    timestamps: { time: string; note: string }[];
  }>({
    title: '',
    matchOrSessionDate: new Date().toISOString().split('T')[0],
    opponentOrTopic: '',
    videoUrl: '',
    gameMoment: 'Attack',
    tagsInput: 'Tactics, High Press',
    summary: '',
    timestamps: [{ time: '12:30', note: 'High press trigger executed correctly' }]
  });

  const handleOpenAdd = () => {
    setEditingSession(null);
    setFormData({
      title: '',
      matchOrSessionDate: new Date().toISOString().split('T')[0],
      opponentOrTopic: '',
      videoUrl: '',
      gameMoment: 'Attack',
      tagsInput: 'Tactics, High Press',
      summary: '',
      timestamps: [{ time: '05:15', note: 'Transition D-A fast break' }]
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (session: VideoAnalysis) => {
    setEditingSession(session);
    setFormData({
      title: session.title,
      matchOrSessionDate: session.matchOrSessionDate,
      opponentOrTopic: session.opponentOrTopic,
      videoUrl: session.videoUrl,
      gameMoment: session.gameMoment,
      tagsInput: session.tags ? session.tags.join(', ') : '',
      summary: session.summary,
      timestamps: session.keyTimestamps || []
    });
    setIsModalOpen(true);
  };

  const handleAddTimestamp = () => {
    setFormData({
      ...formData,
      timestamps: [...formData.timestamps, { time: '00:00', note: '' }]
    });
  };

  const handleRemoveTimestamp = (idx: number) => {
    setFormData({
      ...formData,
      timestamps: formData.timestamps.filter((_, i) => i !== idx)
    });
  };

  const handleTimestampChange = (idx: number, field: 'time' | 'note', val: string) => {
    const updated = formData.timestamps.map((t, i) => i === idx ? { ...t, [field]: val } : t);
    setFormData({ ...formData, timestamps: updated });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    const tagsArray = formData.tagsInput
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    if (editingSession) {
      const updated = sessions.map(s => 
        s.id === editingSession.id
          ? {
              ...s,
              title: formData.title.trim(),
              matchOrSessionDate: formData.matchOrSessionDate,
              opponentOrTopic: formData.opponentOrTopic.trim(),
              videoUrl: formData.videoUrl.trim(),
              gameMoment: formData.gameMoment,
              tags: tagsArray,
              keyTimestamps: formData.timestamps,
              summary: formData.summary.trim()
            }
          : s
      );
      onUpdateSessions(updated);
    } else {
      const newSession: VideoAnalysis = {
        id: 'video-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        title: formData.title.trim(),
        matchOrSessionDate: formData.matchOrSessionDate,
        opponentOrTopic: formData.opponentOrTopic.trim(),
        videoUrl: formData.videoUrl.trim(),
        gameMoment: formData.gameMoment,
        tags: tagsArray,
        keyTimestamps: formData.timestamps,
        summary: formData.summary.trim(),
        createdAt: new Date().toISOString().split('T')[0]
      };
      onUpdateSessions([...sessions, newSession]);
    }

    setIsModalOpen(false);
  };

  const handleDelete = (id: string, title: string) => {
    if (confirm(`Are you sure you want to delete video session "${title}"?`)) {
      onUpdateSessions(sessions.filter(s => s.id !== id));
    }
  };

  const handleOpenOpponentAnalysis = () => {
    const matchId = selectedMatchId || matchOptions[0]?.id;
    if (!matchId) return;

    const nextUrl = `/matches/${encodeURIComponent(matchId)}`;
    if (window.history.pushState) {
      window.history.pushState({}, '', nextUrl);
    }
    window.dispatchEvent(new PopStateEvent('popstate'));
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
        matchId: selectedMatch.id,
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

  const handlePersistUrl = async (type: 'slides' | 'video') => {
    if (!selectedMatch) return;

    try {
      const updated = type === 'slides'
        ? await updateOpponentAnalysisSlidesUrl(selectedMatch.id, newSlidesUrl || null)
        : await updateOpponentAnalysisVideoUrl(selectedMatch.id, newVideoUrl || null);
      setOpponentAnalysis(updated);
    } catch (error) {
      console.error('[VideoAnalysisSection] Failed saving opponent analysis URL', error);
    }
  };

  const handleCreateOpponentAnalysis = async () => {
    if (!selectedMatch) return;

    try {
      const created = await createOrUpdateOpponentAnalysis({
        matchId: selectedMatch.id,
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

  function formatDate(date: string): string {
    if (!date) return 'Date TBD';
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return date;
    return parsed.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  const filtered = sessions.filter(s => {
    const matchesSearch = s.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          s.opponentOrTopic.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesMoment = gameMomentFilter === 'ALL' || s.gameMoment === gameMomentFilter;
    return matchesSearch && matchesMoment;
  });

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

          {activeTab === 'video-analysis' && (
            <button
              type="button"
              onClick={handleOpenAdd}
              className="px-4 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-extrabold rounded-xl transition-all shadow-md shadow-cyan-500/20 flex items-center space-x-2 shrink-0 active:scale-95"
            >
              <PlusCircle className="w-4 h-4" />
              <span>New Video Analysis</span>
            </button>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="mt-5 flex items-center gap-2 border-t border-slate-800 pt-4">
          <button
            type="button"
            onClick={() => setActiveTab('video-analysis')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'video-analysis'
                ? 'bg-cyan-500 text-slate-950'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <PlayCircle className="w-4 h-4" />
            <span>Video Analysis</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('opponent-analysis')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'opponent-analysis'
                ? 'bg-cyan-500 text-slate-950'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Opponent Analysis</span>
          </button>
        </div>
      </div>

      {activeTab === 'video-analysis' ? (
        <>
          {/* Filter and Search Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search clips by title, opponent or topic..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-slate-500">Game Moment:</span>
            <select
              value={gameMomentFilter}
              onChange={(e) => setGameMomentFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
            >
              <option value="ALL">All Moments</option>
              <option value="Attack">Attack</option>
              <option value="Defense">Defense</option>
              <option value="Transition A-D">Transition A-D</option>
              <option value="Transition D-A">Transition D-A</option>
              <option value="Set Pieces">Set Pieces</option>
              <option value="Match">Match</option>
            </select>
          </div>

          {matchOptions.length > 0 && (
            <>
              <select
                value={selectedMatchId}
                onChange={(e) => setSelectedMatchId(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
              >
                {matchOptions.map((match) => (
                  <option key={match.id} value={match.id}>
                    {match.competitionName} vs {match.opponentTeamId}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleOpenOpponentAnalysis}
                className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-extrabold rounded-xl transition-colors"
              >
                Open Opponent Analysis
              </button>
            </>
          )}
        </div>
      </div>

      {/* Video Sessions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filtered.length === 0 ? (
          <div className="col-span-full py-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 text-xs font-medium">
            No video analysis sessions found. Click "New Video Analysis" to upload/link footage.
          </div>
        ) : (
          filtered.map((s) => (
            <div key={s.id} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-4 hover:shadow-md transition-shadow relative">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <span className="inline-block bg-cyan-50 text-cyan-800 border border-cyan-200 font-mono text-[10px] font-extrabold px-2 py-0.5 rounded uppercase">
                    {s.gameMoment}
                  </span>
                  <h3 className="text-base font-extrabold text-slate-900">{s.title}</h3>
                  <p className="text-xs font-medium text-slate-500">
                    {s.opponentOrTopic} • <span className="font-mono">{s.matchOrSessionDate}</span>
                  </p>
                </div>

                {s.videoUrl && (
                  <a
                    href={s.videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 bg-slate-900 hover:bg-slate-800 text-cyan-400 rounded-xl transition-all flex items-center space-x-1 text-xs font-bold shrink-0"
                    title="Watch Video"
                  >
                    <PlayCircle className="w-4 h-4" />
                    <span>Watch</span>
                    <ExternalLink className="w-3 h-3 text-slate-400" />
                  </a>
                )}
              </div>

              {s.summary && (
                <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100 leading-relaxed">
                  {s.summary}
                </p>
              )}

              {/* Key Timestamps List */}
              {s.keyTimestamps && s.keyTimestamps.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Key Timestamps & Tactical Clips
                  </p>
                  <div className="space-y-1">
                    {s.keyTimestamps.map((ts, idx) => (
                      <div key={idx} className="flex items-center space-x-2 text-xs font-medium text-slate-700 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100">
                        <span className="font-mono font-bold text-cyan-700 bg-cyan-100 px-1.5 py-0.2 rounded text-[11px]">
                          {ts.time}
                        </span>
                        <span className="text-slate-800">{ts.note}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tags */}
              {s.tags && s.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {s.tags.map((tag, i) => (
                    <span key={i} className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                <span>Created {s.createdAt}</span>
                <div className="flex items-center space-x-1">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(s)}
                    className="p-1 hover:bg-slate-100 text-slate-500 rounded-md"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(s.id, s.title)}
                    className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-md"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
        </>
      ) : (
        <div className="space-y-6">
          {/* Match Selector */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black text-slate-900">Select Match</h3>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                {matchOptions.length} Matches Available
              </span>
            </div>

            {matchOptions.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-sm">
                No matches available yet.
              </div>
            ) : (
              <div className="space-y-3">
                <select
                  value={selectedMatchId}
                  onChange={(e) => setSelectedMatchId(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:border-sky-500"
                >
                  {matchOptions.map((match) => (
                    <option key={match.id} value={match.id}>
                      {formatDate(match.date)} - {match.competitionName} vs {match.opponentTeamId} 
                      {match.status === 'played' ? ` (${match.goalsScored ?? 0}-${match.goalsConceded ?? 0})` : ' (Planned)'}
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
                    <h3 className="text-base font-black text-slate-900">Video</h3>
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
          )}
        </div>
      )}

      {/* Modal Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-fadeIn max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {editingSession ? 'Edit Video Analysis' : 'Add New Video Analysis'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Video Session Title *
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Build-up vs Al-Ahli High Block"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Opponent / Topic
                  </label>
                  <input
                    type="text"
                    value={formData.opponentOrTopic}
                    onChange={(e) => setFormData({ ...formData, opponentOrTopic: e.target.value })}
                    placeholder="e.g. Al-Hilal Match Analysis"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={formData.matchOrSessionDate}
                    onChange={(e) => setFormData({ ...formData, matchOrSessionDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Game Moment
                  </label>
                  <select
                    value={formData.gameMoment}
                    onChange={(e) => setFormData({ ...formData, gameMoment: e.target.value as GameMoment })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="Attack">Attack</option>
                    <option value="Defense">Defense</option>
                    <option value="Transition A-D">Transition A-D</option>
                    <option value="Transition D-A">Transition D-A</option>
                    <option value="Set Pieces">Set Pieces</option>
                    <option value="Match">Match</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Video URL / Drive Link
                  </label>
                  <input
                    type="url"
                    value={formData.videoUrl}
                    onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })}
                    placeholder="https://youtube.com/..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Summary & Tactical Notes
                </label>
                <textarea
                  rows={2}
                  value={formData.summary}
                  onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                  placeholder="Key takeaways for team video room meeting..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* Timestamps list input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700 uppercase">
                    Timestamps & Specific Clip Notes
                  </label>
                  <button
                    type="button"
                    onClick={handleAddTimestamp}
                    className="text-xs font-bold text-cyan-600 hover:text-cyan-700 flex items-center space-x-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Timestamp</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {formData.timestamps.map((ts, idx) => (
                    <div key={idx} className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={ts.time}
                        onChange={(e) => handleTimestampChange(idx, 'time', e.target.value)}
                        placeholder="14:20"
                        className="w-20 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800"
                      />
                      <input
                        type="text"
                        value={ts.note}
                        onChange={(e) => handleTimestampChange(idx, 'note', e.target.value)}
                        placeholder="Clip observation or tactical breakdown note"
                        className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveTimestamp(idx)}
                        className="p-1 text-slate-400 hover:text-rose-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Tags (comma separated)
                </label>
                <input
                  type="text"
                  value={formData.tagsInput}
                  onChange={(e) => setFormData({ ...formData, tagsInput: e.target.value })}
                  placeholder="BuildUp, Pressing, SetPiece"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-extrabold rounded-xl transition-colors shadow-md shadow-cyan-600/30 flex items-center space-x-1"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Video Analysis</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
