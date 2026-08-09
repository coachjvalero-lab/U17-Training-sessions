import type { SquadPlayer } from '../types';

export type SquadGroupName = 'gk' | 'defenders' | 'midfielders' | 'strikers';

export interface SquadGroupResult {
  gk: SquadPlayer[];
  defenders: SquadPlayer[];
  midfielders: SquadPlayer[];
  strikers: SquadPlayer[];
}

const DEFENDER_POSITIONS = new Set(['CB', 'LB', 'RB']);
const MIDFIELDER_POSITIONS = new Set(['CM', 'CAM', 'CDM']);
const STRIKER_POSITIONS = new Set(['RW', 'LW', 'ST']);

export function resolveSquadPlayersForDisplay(cloudPlayers: SquadPlayer[], localPlayers: SquadPlayer[]): SquadPlayer[] {
  if (Array.isArray(cloudPlayers) && cloudPlayers.length > 0) {
    return cloudPlayers;
  }

  return localPlayers;
}

export function groupSquadPlayersByPosition(players: SquadPlayer[]): SquadGroupResult {
  return players.reduce<SquadGroupResult>(
    (groups, player) => {
      if (player.position === 'GK') {
        groups.gk.push(player);
      } else if (DEFENDER_POSITIONS.has(player.position)) {
        groups.defenders.push(player);
      } else if (MIDFIELDER_POSITIONS.has(player.position)) {
        groups.midfielders.push(player);
      } else if (STRIKER_POSITIONS.has(player.position)) {
        groups.strikers.push(player);
      } else {
        groups.midfielders.push(player);
      }
      return groups;
    },
    { gk: [], defenders: [], midfielders: [], strikers: [] }
  );
}
