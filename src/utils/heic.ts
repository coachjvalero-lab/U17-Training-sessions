import heic2any from 'heic2any';

export function isHeicFile(file: File): boolean {
  if (!file) return false;
  const name = file.name ? file.name.toLowerCase() : '';
  const type = file.type ? file.type.toLowerCase() : '';
  return (
    name.endsWith('.heic') ||
    name.endsWith('.heif') ||
    type.includes('heic') ||
    type.includes('heif')
  );
}

export function isHeicDataUrl(dataUrl: string): boolean {
  if (!dataUrl) return false;
  const lower = dataUrl.toLowerCase();
  return lower.startsWith('data:image/heic') || lower.startsWith('data:image/heif');
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',');
  if (parts.length < 2) {
    throw new Error('Invalid Data URL format');
  }
  const mimeMatch = parts[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/heic';
  const bstr = atob(parts[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

/**
 * Attempts native browser canvas conversion (e.g. Safari / macOS / iOS)
 */
async function convertViaCanvas(blob: Blob): Promise<string> {
  try {
    if (typeof createImageBitmap === 'function') {
      const bitmap = await createImageBitmap(blob);
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(bitmap, 0, 0);
        return canvas.toDataURL('image/jpeg', 0.85);
      }
    }
  } catch {
    // Native canvas conversion not supported for this blob format
  }
  return '';
}

export async function convertHeicBlobToJpegDataUrl(blob: Blob): Promise<string> {
  // 1. Try native browser conversion first (instant on Safari/iOS)
  const canvasResult = await convertViaCanvas(blob);
  if (canvasResult) {
    return canvasResult;
  }

  // 2. Try heic2any WASM library with normalized blob & multiple: false
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const normalizedBlob = new Blob([arrayBuffer], { type: 'image/heic' });

    const result = await (heic2any as any)({
      blob: normalizedBlob,
      toType: 'image/jpeg',
      quality: 0.85,
      multiple: false,
    });

    const jpegBlob = Array.isArray(result) ? result[0] : result;
    return await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          resolve('');
        }
      };
      reader.onerror = () => resolve('');
      reader.readAsDataURL(jpegBlob);
    });
  } catch {
    // 3. Fallback to reading standard data URL silently without throwing warnings
    return new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          resolve('');
        }
      };
      reader.onerror = () => resolve('');
      reader.readAsDataURL(blob);
    });
  }
}

export async function processUploadedImageFile(file: File): Promise<string> {
  if (isHeicFile(file)) {
    try {
      const converted = await convertHeicBlobToJpegDataUrl(file);
      if (converted && !converted.startsWith('data:image/heic')) {
        return converted;
      }
    } catch {
      // Fallback below
    }
  }

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read image file'));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Converts a data:image/heic;base64,... string to a data:image/jpeg;base64,... string
 */
export async function convertHeicDataUrlToJpeg(dataUrl: string): Promise<string> {
  if (!isHeicDataUrl(dataUrl)) return dataUrl;
  try {
    const blob = dataUrlToBlob(dataUrl);
    const converted = await convertHeicBlobToJpegDataUrl(blob);
    return converted || dataUrl;
  } catch {
    return dataUrl;
  }
}

