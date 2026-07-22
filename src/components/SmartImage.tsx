import React, { useState, useEffect } from 'react';
import { isHeicDataUrl, convertHeicDataUrlToJpeg } from '../utils/heic';
import { Loader2 } from 'lucide-react';

interface SmartImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  onConverted?: (jpegDataUrl: string) => void;
  fallbackIcon?: React.ReactNode;
}

export const SmartImage: React.FC<SmartImageProps> = ({
  src,
  onConverted,
  fallbackIcon,
  className = '',
  alt = '',
  ...props
}) => {
  const [currentSrc, setCurrentSrc] = useState<string>(src);
  const [isConverting, setIsConverting] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    setHasError(false);

    if (!src) {
      setCurrentSrc('');
      return;
    }

    if (isHeicDataUrl(src)) {
      setIsConverting(true);
      convertHeicDataUrlToJpeg(src)
        .then((jpegSrc) => {
          if (isMounted) {
            setCurrentSrc(jpegSrc);
            setIsConverting(false);
            if (onConverted && jpegSrc && jpegSrc !== src) {
              onConverted(jpegSrc);
            }
          }
        })
        .catch(() => {
          if (isMounted) {
            setIsConverting(false);
            setCurrentSrc(src);
          }
        });
    } else {
      setCurrentSrc(src);
      setIsConverting(false);
    }

    return () => {
      isMounted = false;
    };
  }, [src]);

  const handleError = async (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    if (props.onError) {
      props.onError(e);
    }

    if (hasError) return;

    // If initial load failed and it wasn't already converted, check if it's a HEIC URL
    if (currentSrc && (currentSrc.toLowerCase().includes('.heic') || currentSrc.toLowerCase().includes('.heif'))) {
      try {
        setIsConverting(true);
        const res = await fetch(currentSrc);
        const blob = await res.blob();
        const { convertHeicBlobToJpegDataUrl } = await import('../utils/heic');
        const jpegSrc = await convertHeicBlobToJpegDataUrl(blob);
        if (jpegSrc) {
          setCurrentSrc(jpegSrc);
          setIsConverting(false);
          if (onConverted) {
            onConverted(jpegSrc);
          }
          return;
        }
      } catch {
        // failed recovery
      }
    }

    setHasError(true);
    setIsConverting(false);
  };

  if (isConverting) {
    return (
      <div className={`flex flex-col items-center justify-center p-4 bg-slate-50 text-slate-500 text-xs font-semibold ${className}`}>
        <Loader2 className="w-6 h-6 animate-spin text-emerald-500 mb-1.5" />
        <span>Converting HEIC photo...</span>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className={`flex flex-col items-center justify-center p-4 bg-slate-50 text-slate-400 text-xs ${className}`}>
        {fallbackIcon || <span>Unable to load image</span>}
      </div>
    );
  }

  return (
    <img
      {...props}
      src={currentSrc}
      alt={alt}
      className={className}
      onError={handleError}
      referrerPolicy="no-referrer"
    />
  );
};
