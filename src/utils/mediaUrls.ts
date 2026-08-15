export function toVideoEmbedUrl(input: string | null | undefined): string | null {
  if (!input) return null;
  const value = input.trim();
  if (!value) return null;

  try {
    const url = new URL(value);
    if (!url.protocol.startsWith('http')) return null;

    if (url.hostname.includes('youtube.com') || url.hostname.includes('youtu.be')) {
      const videoId = url.searchParams.get('v') || url.pathname.split('/').filter(Boolean).at(-1) || '';
      return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
    }

    if (url.hostname.includes('vimeo.com')) {
      const videoId = url.pathname.split('/').filter(Boolean).at(-1) || '';
      return videoId ? `https://player.vimeo.com/video/${videoId}` : null;
    }

    return value;
  } catch {
    return null;
  }
}

export function toSlideEmbedUrl(input: string | null | undefined): string | null {
  if (!input) return null;
  const value = input.trim();
  if (!value) return null;

  try {
    const url = new URL(value);
    return url.protocol.startsWith('http') ? value : null;
  } catch {
    return null;
  }
}

export function formatVideoTimestamp(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainder = safeSeconds % 60;

  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${minutes}:${String(remainder).padStart(2, '0')}`;
}