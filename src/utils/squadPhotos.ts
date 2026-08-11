import type { SquadPlayer } from '../types';

export const SQUAD_PLAYER_PHOTOS_BUCKET = 'squad-player-photos';

type ParsedSquadPhotoPath = {
  bucket: string;
  objectPath: string;
};

const FORBIDDEN_PREFIXES = ['http://', 'https://', 'data:'];

function hasForbiddenPrefix(value: string): boolean {
  const normalized = value.toLowerCase();
  return FORBIDDEN_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

export function parseSquadPhotoStoragePath(photoPath?: string): ParsedSquadPhotoPath | null {
  if (!photoPath) return null;
  const trimmed = photoPath.trim();
  if (!trimmed) return null;
  if (hasForbiddenPrefix(trimmed)) return null;

  const firstSlash = trimmed.indexOf('/');
  if (firstSlash <= 0 || firstSlash >= trimmed.length - 1) return null;

  const bucket = trimmed.slice(0, firstSlash).trim();
  const objectPath = trimmed.slice(firstSlash + 1).trim();
  if (!bucket || !objectPath) return null;
  if (bucket !== SQUAD_PLAYER_PHOTOS_BUCKET) return null;

  return {
    bucket,
    objectPath
  };
}

export function isSquadPhotoStoragePath(photoPath?: string): boolean {
  return Boolean(parseSquadPhotoStoragePath(photoPath));
}

export function normalizeSquadPhotoUrl(photoUrl?: string): string | undefined {
  const parsed = parseSquadPhotoStoragePath(photoUrl);
  if (!parsed) return undefined;
  return `${parsed.bucket}/${parsed.objectPath}`;
}

export function normalizeSquadPlayerPhotos(players: SquadPlayer[]): SquadPlayer[] {
  return players.map(player => ({
    ...player,
    photoUrl: normalizeSquadPhotoUrl(player.photoUrl)
  }));
}