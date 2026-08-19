import type { SquadPlayer } from '../types';

export type WellnessPlayerResolution = {
  playerName: string;
  playerId: string | null;
  status: 'matched' | 'unresolved' | 'ambiguous';
  resolvedLabel?: string;
  options?: Array<{ playerId: string; label: string }>;
};

export type WellnessManualPlayerMappings = Record<string, string>;

const WELLNESS_MANUAL_PLAYER_MAPPINGS: WellnessManualPlayerMappings = {};

function normalizeWellnessText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function resolveWellnessPlayerName(
  playerName: string,
  squadPlayers: SquadPlayer[],
  manualMappings: WellnessManualPlayerMappings = WELLNESS_MANUAL_PLAYER_MAPPINGS
): WellnessPlayerResolution {
  const normalizedName = normalizeWellnessText(playerName);
  const candidates = squadPlayers.map((player) => ({
    playerId: player.id,
    label: `${player.firstName} ${player.lastName}`.trim(),
    normalized: normalizeWellnessText(`${player.firstName} ${player.lastName}`.trim())
  }));

  const manuallyMappedPlayerId = manualMappings[normalizedName];
  if (manuallyMappedPlayerId) {
    const manuallyMappedPlayer = candidates.find((candidate) => candidate.playerId === manuallyMappedPlayerId);
    if (manuallyMappedPlayer) {
      return {
        playerName,
        playerId: manuallyMappedPlayer.playerId,
        status: 'matched',
        resolvedLabel: manuallyMappedPlayer.label
      };
    }
  }

  const exactMatches = candidates.filter((candidate) => candidate.normalized === normalizedName);
  if (exactMatches.length === 1) {
    return {
      playerName,
      playerId: exactMatches[0].playerId,
      status: 'matched',
      resolvedLabel: exactMatches[0].label
    };
  }

  if (exactMatches.length > 1) {
    return {
      playerName,
      playerId: null,
      status: 'ambiguous',
      options: exactMatches.map((candidate) => ({ playerId: candidate.playerId, label: candidate.label }))
    };
  }

  return { playerName, playerId: null, status: 'unresolved' };
}