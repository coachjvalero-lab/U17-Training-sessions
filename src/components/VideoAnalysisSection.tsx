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
  Plus
} from 'lucide-react';
import { VideoAnalysis, GameMoment } from '../types';
import { readWorkspaceRestoreState, writeWorkspaceRestoreState } from '../utils/workspaceRestore';

interface VideoAnalysisSectionProps {
  sessions: VideoAnalysis[];
  onUpdateSessions: (sessions: VideoAnalysis[]) => void;
}

export const VideoAnalysisSection: React.FC<VideoAnalysisSectionProps> = ({
  sessions,
  onUpdateSessions
}) => {
  const contextStorageKey = 'video_analysis_section';
  const restoredContext = readWorkspaceRestoreState(contextStorageKey, {
    searchTerm: '',
    gameMomentFilter: 'ALL'
  });
  const [searchTerm, setSearchTerm] = useState(restoredContext.searchTerm);
  const [gameMomentFilter, setGameMomentFilter] = useState<string>(restoredContext.gameMomentFilter);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<VideoAnalysis | null>(null);

  useEffect(() => {
    writeWorkspaceRestoreState(contextStorageKey, { searchTerm, gameMomentFilter });
  }, [searchTerm, gameMomentFilter]);

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

  const filtered = sessions.filter(s => {
    const matchesSearch = s.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          s.opponentOrTopic.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesMoment = gameMomentFilter === 'ALL' || s.gameMoment === gameMomentFilter;
    return matchesSearch && matchesMoment;
  });

  return (
    <div className="space-y-6">
      {/* Video Header */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-slate-800">
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

        <button
          type="button"
          onClick={handleOpenAdd}
          className="px-4 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-extrabold rounded-xl transition-all shadow-md shadow-cyan-500/20 flex items-center space-x-2 shrink-0 active:scale-95"
        >
          <PlusCircle className="w-4 h-4" />
          <span>New Video Analysis</span>
        </button>
      </div>

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
