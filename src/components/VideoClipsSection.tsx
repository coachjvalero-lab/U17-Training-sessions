import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { VideoClip } from '../types';
import { formatVideoTimestamp } from '../utils/mediaUrls';

export type ClipFormState = { videoUrl: string; startTime: string; endTime: string; title: string; notes: string; category: string };
export const EMPTY_CLIP_FORM: ClipFormState = { videoUrl: '', startTime: '0', endTime: '', title: '', notes: '', category: '' };

export interface ClipCategoryOption {
  value: string;
  label: string;
}

interface VideoClipsSectionProps {
  analysisId: string | null;
  emptyAnalysisMessage: string;
  clips: VideoClip[];
  isLoadingClips: boolean;
  isSavingClip: boolean;
  form: ClipFormState;
  onFormChange: (form: ClipFormState) => void;
  onSubmit: (event: React.FormEvent) => void;
  onDelete: (clipId: string) => void;
  // When provided, shows a category dropdown for this tab's taxonomy (Matches vs Scouting use
  // different, unrelated category sets); omit to hide the field entirely (e.g. Training Sessions).
  categoryOptions?: ClipCategoryOption[];
}

// Shared "attach video clips" panel reused across Video Analysis' Matches, Training Sessions and
// Scouting reports tabs — same UI/behavior regardless of which analysis owns the clips.
export const VideoClipsSection: React.FC<VideoClipsSectionProps> = ({
  analysisId,
  emptyAnalysisMessage,
  clips,
  isLoadingClips,
  isSavingClip,
  form,
  onFormChange,
  onSubmit,
  onDelete,
  categoryOptions
}) => {
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
            {categoryOptions && categoryOptions.length > 0 && (
              <select
                value={form.category}
                onChange={(event) => onFormChange({ ...form, category: event.target.value })}
                className="sm:col-span-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-sky-500"
              >
                <option value="">No category</option>
                {categoryOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            )}
            <button
              type="submit"
              disabled={isSavingClip}
              className="sm:col-span-2 inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-3 py-2 text-xs font-bold text-white hover:bg-sky-500 disabled:opacity-60"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Clip
            </button>
          </form>

          {isLoadingClips ? (
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
                    {clip.category && (
                      <span className="mt-0.5 inline-block rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                        {categoryOptions?.find((option) => option.value === clip.category)?.label ?? clip.category}
                      </span>
                    )}
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
};
