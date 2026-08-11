import type { SquadPlayer } from '../types';

const STOCK_PHOTO_HOSTS = [
  'images.unsplash.com',
  'unsplash.com'
];

function isStockPhotoUrl(url?: string): boolean {
  if (!url) return false;
  const normalized = url.trim().toLowerCase();
  return STOCK_PHOTO_HOSTS.some(host => normalized.includes(host));
}

export function normalizeSquadPhotoUrl(photoUrl?: string): string | undefined {
  if (!photoUrl) return undefined;
  const trimmed = photoUrl.trim();
  if (!trimmed) return undefined;
  if (isStockPhotoUrl(trimmed)) return undefined;
  return trimmed;
}

export function normalizeSquadPlayerPhotos(players: SquadPlayer[]): SquadPlayer[] {
  return players.map(player => ({
    ...player,
    photoUrl: normalizeSquadPhotoUrl(player.photoUrl)
  }));
}