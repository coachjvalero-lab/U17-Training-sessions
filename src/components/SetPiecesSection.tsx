import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Save,
  Trash2,
  Edit3,
  ChevronLeft,
  Image as ImageIcon,
  Video,
  PlayCircle,
  X
} from 'lucide-react';
import type { SetPiecePlay, SetPiecePlayType } from '../types';
import { EMPTY_SET_PIECE_DIAGRAM, SET_PIECE_PLAY_TYPES } from '../types';
import {
  createSetPiecePlay,
  deleteSetPiecePlay,
  getSetPiecePlays,
  updateSetPiecePlay
} from '../services/matches/setPiecePlaysService';
import { supabase } from '../supabaseClient';
import { toVideoEmbedUrl } from '../utils/mediaUrls';

const SET_PIECE_IMAGES_BUCKET = 'set-piece-images';
const MAX_IMAGE_FILE_SIZE_BYTES = 8 * 1024 * 1024;

const TYPE_LABEL: Record<SetPiecePlayType, string> = Object.fromEntries(
  SET_PIECE_PLAY_TYPES.map((option) => [option.value, option.label])
) as Record<SetPiecePlayType, string>;

// Reads a raw uploaded file (already converted to a data URL) into a Blob for Storage upload.
function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',');
  if (parts.length !== 2) throw new Error('Invalid data URL');
  const mimeMatch = parts[0].match(/^data:([^;]+);base64$/i);
  const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const binary = atob(parts[1]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

// Set piece images are stored privately (like squad player photos); the stored value is
// "bucket/objectPath" and must be resolved to a temporary signed URL to display.
async function resolveSignedImageUrl(storagePath: string): Promise<string | null> {
  if (!supabase) return null;
  const slashIndex = storagePath.indexOf('/');
  if (slashIndex <= 0 || slashIndex >= storagePath.length - 1) return null;
  const bucket = storagePath.slice(0, slashIndex);
  const objectPath = storagePath.slice(slashIndex + 1);
  if (bucket !== SET_PIECE_IMAGES_BUCKET) return null;

  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(objectPath, 3600);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

interface SetPiecesSectionProps {
  matchId: string;
}

export const SetPiecesSection: React.FC<SetPiecesSectionProps> = ({ matchId }) => {
  const [plays, setPlays] = useState<SetPiecePlay[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [editingPlayId, setEditingPlayId] = useState<string | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<SetPiecePlayType>('corner');
  const [description, setDescription] = useState('');
  const [coachingPoints, setCoachingPoints] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [signedImageUrl, setSignedImageUrl] = useState<string | null>(null);
  const [isImageUploading, setIsImageUploading] = useState(false);
  const [imageError, setImageError] = useState('');

  const [dashboardImageUrls, setDashboardImageUrls] = useState<Record<string, string>>({});

  const loadPlays = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const list = await getSetPiecePlays(matchId);
      setPlays(list);
    } catch (err) {
      console.error('[SetPiecesSection] Failed loading set piece plays', err);
      setError(err instanceof Error ? err.message : 'Unable to load saved set pieces.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadPlays();
    setIsEditorOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  // Resolve signed thumbnail URLs for the dashboard grid as new plays/images appear.
  useEffect(() => {
    let cancelled = false;
    const paths = Array.from(
      new Set(plays.map((play) => play.imageUrl).filter((path): path is string => Boolean(path)))
    );
    const missing = paths.filter((path) => !dashboardImageUrls[path]);
    if (missing.length === 0) return;

    void Promise.all(
      missing.map(async (path) => {
        const url = await resolveSignedImageUrl(path);
        return url ? ([path, url] as const) : null;
      })
    ).then((entries) => {
      if (cancelled) return;
      const valid = entries.filter((entry): entry is readonly [string, string] => Boolean(entry));
      if (valid.length === 0) return;
      setDashboardImageUrls((prev) => {
        const merged = { ...prev };
        valid.forEach(([path, url]) => {
          merged[path] = url;
        });
        return merged;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [plays, dashboardImageUrls]);

  // Resolve the signed URL for the image currently shown in the editor.
  useEffect(() => {
    let cancelled = false;
    if (!imageUrl) {
      setSignedImageUrl(null);
      return;
    }
    void resolveSignedImageUrl(imageUrl).then((url) => {
      if (!cancelled) setSignedImageUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [imageUrl]);

  const resetDraft = () => {
    setEditingPlayId(null);
    setTitle('');
    setType('corner');
    setDescription('');
    setCoachingPoints('');
    setVideoUrl('');
    setImageUrl(null);
    setSignedImageUrl(null);
    setImageError('');
  };

  const openNewPlay = () => {
    resetDraft();
    setIsEditorOpen(true);
  };

  const openExistingPlay = (play: SetPiecePlay) => {
    setEditingPlayId(play.id);
    setTitle(play.title);
    setType(play.type);
    setDescription(play.description);
    setCoachingPoints(play.coachingPoints);
    setVideoUrl(play.videoUrl ?? '');
    setImageUrl(play.imageUrl ?? null);
    setImageError('');
    setIsEditorOpen(true);
  };

  const closeEditor = () => {
    setIsEditorOpen(false);
    resetDraft();
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setError('Please enter a title for this set piece.');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      if (editingPlayId) {
        await updateSetPiecePlay(editingPlayId, { title: title.trim(), type, description, coachingPoints, videoUrl });
      } else {
        // Diagram/coordinates are intentionally never created or edited here anymore; new plays
        // simply start with an empty diagram, preserved as-is going forward.
        await createSetPiecePlay({ matchId, title: title.trim(), type, diagram: EMPTY_SET_PIECE_DIAGRAM, description, coachingPoints, videoUrl });
      }
      await loadPlays();
      closeEditor();
    } catch (err) {
      console.error('[SetPiecesSection] Failed saving set piece play', err);
      setError(err instanceof Error ? err.message : 'Unable to save this set piece.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePlay = async (playId: string) => {
    if (!window.confirm('Delete this saved set piece? This cannot be undone.')) return;
    try {
      await deleteSetPiecePlay(playId);
      await loadPlays();
      if (editingPlayId === playId) closeEditor();
    } catch (err) {
      console.error('[SetPiecesSection] Failed deleting set piece play', err);
      setError(err instanceof Error ? err.message : 'Unable to delete this set piece.');
    }
  };

  // A brand-new (unsaved) play has no id yet, but the image needs one to build its storage path;
  // creating the row early (title required) lets image upload work right away, same as Save would.
  const ensurePlayId = async (): Promise<string | null> => {
    if (editingPlayId) return editingPlayId;
    if (!title.trim()) {
      setImageError('Please enter a title before adding an image.');
      return null;
    }
    setIsSaving(true);
    setError(null);
    try {
      const created = await createSetPiecePlay({
        matchId,
        title: title.trim(),
        type,
        diagram: EMPTY_SET_PIECE_DIAGRAM,
        description,
        coachingPoints,
        videoUrl
      });
      setEditingPlayId(created.id);
      await loadPlays();
      return created.id;
    } catch (err) {
      console.error('[SetPiecesSection] Failed creating set piece play', err);
      setImageError(err instanceof Error ? err.message : 'Unable to create this set piece.');
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setImageError('');

    if (!file.type.toLowerCase().startsWith('image/')) {
      setImageError('Invalid file type. Please select an image.');
      return;
    }
    if (file.size > MAX_IMAGE_FILE_SIZE_BYTES) {
      setImageError('File too large. Maximum allowed size is 8 MB.');
      return;
    }
    if (!supabase) {
      setImageError('Supabase is not configured.');
      return;
    }

    const playId = await ensurePlayId();
    if (!playId) return;

    setIsImageUploading(true);
    try {
      const { processUploadedImageFile } = await import('../utils/heic');
      const dataUrl = await processUploadedImageFile(file);
      const blob = dataUrlToBlob(dataUrl);
      const objectPath = `${playId}.jpg`;
      const storagePath = `${SET_PIECE_IMAGES_BUCKET}/${objectPath}`;

      const { error: uploadError } = await supabase.storage
        .from(SET_PIECE_IMAGES_BUCKET)
        .upload(objectPath, blob, {
          upsert: true,
          contentType: blob.type || 'image/jpeg',
          cacheControl: '3600'
        });

      if (uploadError) {
        setImageError('Image upload failed. The existing image was not changed.');
        return;
      }

      await updateSetPiecePlay(playId, { imageUrl: storagePath });
      setImageUrl(storagePath);
      await loadPlays();
    } catch (err) {
      console.error('[SetPiecesSection] Failed uploading image', err);
      setImageError('Image upload failed. The existing image was not changed.');
    } finally {
      setIsImageUploading(false);
    }
  };

  const handleRemoveImage = async () => {
    if (!editingPlayId || !imageUrl) return;
    if (!window.confirm('Remove this set piece image?')) return;

    try {
      const slashIndex = imageUrl.indexOf('/');
      if (slashIndex > 0 && supabase) {
        const bucket = imageUrl.slice(0, slashIndex);
        const objectPath = imageUrl.slice(slashIndex + 1);
        await supabase.storage.from(bucket).remove([objectPath]);
      }
      await updateSetPiecePlay(editingPlayId, { imageUrl: null });
      setImageUrl(null);
      setSignedImageUrl(null);
      await loadPlays();
    } catch (err) {
      console.error('[SetPiecesSection] Failed removing image', err);
      setImageError(err instanceof Error ? err.message : 'Unable to remove the image.');
    }
  };

  const videoEmbedUrl = useMemo(() => toVideoEmbedUrl(videoUrl), [videoUrl]);

  if (isEditorOpen) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={closeEditor}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Back to Set Pieces</span>
            </button>
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Title, e.g. Corner - Near Post"
                className="w-56 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-900 outline-none focus:border-sky-600 focus:bg-white"
              />
              <select
                value={type}
                onChange={(event) => setType(event.target.value as SetPiecePlayType)}
                className="w-48 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-sky-600"
              >
                {SET_PIECE_PLAY_TYPES.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-xl bg-[#002142] px-4 py-2 text-xs font-black text-white hover:bg-[#09355e] disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            <span>{isSaving ? 'Saving...' : 'Save Set Piece'}</span>
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">{error}</div>
        )}

        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-700">Set Piece</p>
            <h2 className="truncate text-xl font-black text-slate-950">{title.trim() || 'Untitled Set Piece'}</h2>
            <p className="text-[11px] font-bold uppercase text-slate-500">{TYPE_LABEL[type]}</p>
          </div>

          {/* Image: the primary visual element */}
          <div className="p-5 sm:p-6">
            <div className="relative flex min-h-[220px] w-full items-center justify-center overflow-hidden rounded-2xl bg-slate-100 sm:min-h-[340px]">
              {signedImageUrl ? (
                <>
                  <img
                    src={signedImageUrl}
                    alt={title || 'Set piece image'}
                    className="max-h-[70vh] w-full object-contain"
                  />
                  <div className="absolute right-3 top-3 flex gap-2">
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-white/95 px-3 py-2 text-xs font-black text-slate-800 shadow hover:bg-white">
                      <input type="file" accept="image/*,.heic,.heif" className="hidden" onChange={handleImageUpload} disabled={isImageUploading} />
                      <ImageIcon className="h-3.5 w-3.5" />
                      <span>{isImageUploading ? 'Uploading...' : 'Replace'}</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => void handleRemoveImage()}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-white/95 px-3 py-2 text-xs font-black text-rose-700 shadow hover:bg-rose-50"
                    >
                      <X className="h-3.5 w-3.5" />
                      <span>Remove</span>
                    </button>
                  </div>
                </>
              ) : (
                <label className="flex w-full cursor-pointer flex-col items-center justify-center gap-2 py-16 text-slate-400 hover:text-sky-700">
                  <input type="file" accept="image/*,.heic,.heif" className="hidden" onChange={handleImageUpload} disabled={isImageUploading} />
                  <ImageIcon className="h-10 w-10" />
                  <span className="text-sm font-black">{isImageUploading ? 'Uploading...' : 'Add Set Piece Image'}</span>
                  <span className="text-[11px] font-semibold text-slate-400">PNG, JPG up to 8 MB</span>
                </label>
              )}
            </div>
            {imageError && <p className="mt-2 text-xs font-semibold text-rose-700">{imageError}</p>}
          </div>

          {/* Video + Instructions */}
          <div className="grid gap-5 border-t border-slate-100 p-5 sm:p-6 md:grid-cols-2">
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500">
                <Video className="h-3.5 w-3.5" />
                <span>Video</span>
              </p>
              <input
                value={videoUrl}
                onChange={(event) => setVideoUrl(event.target.value)}
                placeholder="Paste a video link (YouTube, Vimeo, direct URL)"
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-sky-600 focus:bg-white"
              />
              {videoEmbedUrl ? (
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950">
                  <iframe title="Set piece video" src={videoEmbedUrl} className="aspect-video w-full" allowFullScreen />
                </div>
              ) : (
                <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 text-slate-400">
                  <PlayCircle className="h-8 w-8" />
                  <span className="text-xs font-bold">Add Video</span>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">Instructions</span>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Objective, roles, key points, variations..."
                  className="min-h-[160px] w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">Coaching Points</span>
                <textarea
                  value={coachingPoints}
                  onChange={(event) => setCoachingPoints(event.target.value)}
                  placeholder="Additional coaching points, triggers, timing... (optional)"
                  className="min-h-[100px] w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm"
                />
              </label>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-sky-700">Dead-ball tactics</p>
          <h3 className="text-lg font-black text-slate-950">Set Pieces</h3>
        </div>
        <button
          type="button"
          onClick={openNewPlay}
          className="inline-flex items-center gap-2 rounded-xl bg-[#002142] px-4 py-2 text-xs font-black text-white hover:bg-[#09355e]"
        >
          <Plus className="h-4 w-4" />
          <span>New Set Piece</span>
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">{error}</div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="mb-3 text-[10px] font-black uppercase tracking-wider text-slate-500">Saved Set Pieces</p>
        {isLoading ? (
          <p className="py-6 text-center text-xs font-bold text-slate-400">Loading...</p>
        ) : plays.length === 0 ? (
          <p className="py-6 text-center text-xs font-bold text-slate-400">No set pieces saved yet for this match.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {plays.map((play) => {
              const thumbnailUrl = play.imageUrl ? dashboardImageUrls[play.imageUrl] : undefined;
              return (
                <div key={play.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-md">
                  <button type="button" onClick={() => openExistingPlay(play)} className="block w-full">
                    {thumbnailUrl ? (
                      <img src={thumbnailUrl} alt={play.title || 'Set piece image'} className="aspect-[3/2] w-full object-cover" />
                    ) : (
                      <div className="flex aspect-[3/2] w-full items-center justify-center bg-slate-100 text-slate-300">
                        <ImageIcon className="h-8 w-8" />
                      </div>
                    )}
                  </button>
                  <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                    <button type="button" onClick={() => openExistingPlay(play)} className="min-w-0 flex-1 text-left">
                      <p className="truncate text-xs font-black text-slate-900">{play.title || 'Untitled'}</p>
                      <p className="text-[10px] font-bold uppercase text-slate-500">{TYPE_LABEL[play.type] || play.type}</p>
                    </button>
                    <div className="flex shrink-0 items-center gap-1">
                      <button type="button" onClick={() => openExistingPlay(play)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700" title="Edit">
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => void handleDeletePlay(play.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-100 hover:text-rose-700" title="Delete">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
