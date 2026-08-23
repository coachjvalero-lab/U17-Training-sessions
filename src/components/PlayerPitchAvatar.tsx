import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { parseSquadPhotoStoragePath } from '../utils/squadPhotos';

interface PlayerPitchAvatarProps {
  photoUrl?: string | null;
  shirtNumber?: number | string | null;
  fallbackNumber?: number | string | null;
  className?: string;
  sizeClassName?: string;
  alt?: string;
}

// In-memory cache for resolved signed URLs to avoid redundant network calls
const signedUrlCache = new Map<string, string>();

export const PlayerPitchAvatar: React.FC<PlayerPitchAvatarProps> = ({
  photoUrl,
  shirtNumber,
  fallbackNumber = '–',
  className = '',
  sizeClassName = 'h-11 w-11',
  alt = ''
}) => {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(() => {
    if (!photoUrl) return null;
    const trimmed = photoUrl.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) {
      return trimmed;
    }
    return signedUrlCache.get(trimmed) || null;
  });

  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setHasError(false);

    if (!photoUrl) {
      setResolvedUrl(null);
      return;
    }

    const trimmed = photoUrl.trim();
    if (!trimmed) {
      setResolvedUrl(null);
      return;
    }

    // Direct HTTP/HTTPS or data URL
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) {
      setResolvedUrl(trimmed);
      return;
    }

    // Check memory cache
    if (signedUrlCache.has(trimmed)) {
      setResolvedUrl(signedUrlCache.get(trimmed) || null);
      return;
    }

    // Parse storage path
    const parsed = parseSquadPhotoStoragePath(trimmed);
    if (!parsed || !supabase) {
      setResolvedUrl(null);
      return;
    }

    // Resolve signed URL from Supabase Storage
    supabase.storage
      .from(parsed.bucket)
      .createSignedUrl(parsed.objectPath, 3600)
      .then(({ data, error }) => {
        if (!isMounted) return;
        if (error || !data?.signedUrl) {
          setHasError(true);
          setResolvedUrl(null);
        } else {
          signedUrlCache.set(trimmed, data.signedUrl);
          setResolvedUrl(data.signedUrl);
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setHasError(true);
        setResolvedUrl(null);
      });

    return () => {
      isMounted = false;
    };
  }, [photoUrl]);

  const displayNumber = shirtNumber ?? fallbackNumber ?? '–';
  const shouldShowImage = Boolean(resolvedUrl) && !hasError;

  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden rounded-full ${sizeClassName} ${className}`}
    >
      {shouldShowImage && resolvedUrl ? (
        <img
          src={resolvedUrl}
          alt={alt}
          className="h-full w-full object-cover pointer-events-none select-none"
          referrerPolicy="no-referrer"
          onError={() => setHasError(true)}
        />
      ) : (
        <span className="font-black select-none pointer-events-none leading-none">
          {displayNumber}
        </span>
      )}
    </div>
  );
};
