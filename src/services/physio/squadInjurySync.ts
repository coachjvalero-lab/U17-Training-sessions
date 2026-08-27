import type { ClinicalInjuryStatus, Injury, PlayerAttendance, SquadPlayer } from '../../types';

/**
 * Maps a clinical injury status from Physiotherapy to the Squad player status.
 */
export function mapClinicalStatusToSquadStatus(clinicalStatus?: ClinicalInjuryStatus | string): SquadPlayer['status'] {
  const norm = (clinicalStatus || '').toLowerCase().trim();
  if (!norm || norm === 'closed' || norm === 'resolved') {
    return 'Active';
  }
  if (norm === 'rehab' || norm === 'return_to_training' || norm === 'return_to_play' || norm === 'rehabilitation') {
    return 'Recovering';
  }
  return 'Injured';
}

/**
 * Evaluates all injuries belonging to a player and derives their current Squad status.
 */
export function determineSquadStatusFromPlayerInjuries(
  playerInjuries: Injury[],
  currentSquadStatus: SquadPlayer['status'] = 'Active'
): SquadPlayer['status'] {
  const activeInjuries = (playerInjuries || []).filter((injury) => {
    if (!injury) return false;
    const st = (injury.currentStatus || (injury as any).status || (injury as any).current_status || '').toLowerCase().trim();
    return Boolean(st) && st !== 'closed' && st !== 'resolved';
  });

  if (activeInjuries.length === 0) {
    // If player was manually set to Absent by the coach, keep Absent, otherwise set Active
    return currentSquadStatus === 'Absent' ? 'Absent' : 'Active';
  }

  // If in rehabilitation or return to training / play
  const isOnlyRehab = activeInjuries.every((inj) => {
    const st = (inj.currentStatus || (inj as any).status || (inj as any).current_status || '').toLowerCase().trim();
    return st === 'rehab' || st === 'return_to_training' || st === 'return_to_play' || st === 'rehabilitation';
  });

  if (isOnlyRehab) {
    return 'Recovering';
  }

  // If any active injury is open, under_treatment, active, etc., mark as Injured
  return 'Injured';
}

/**
 * Retrieves all injuries associated with a squad player, robustly matching by
 * ID or name variations (case-insensitive, trims, positions, gk tags).
 */
export function getInjuriesForPlayer(
  player: SquadPlayer,
  injuries: Injury[]
): Injury[] {
  if (!player || !injuries || injuries.length === 0) return [];

  const playerId = (player.id || '').trim().toLowerCase();
  const fullName = `${player.firstName || ''} ${player.lastName || ''}`.trim().toLowerCase();
  const firstName = (player.firstName || '').trim().toLowerCase();
  const lastName = (player.lastName || '').trim().toLowerCase();

  return injuries.filter((inj) => {
    if (!inj) return false;
    const target = (inj.playerId || (inj as any).player_id || '').trim().toLowerCase();
    if (!target) return false;

    // Exact ID match
    if (playerId && target === playerId) return true;

    // Direct name variations
    if (fullName && (target === fullName || target === `${fullName} (gk)` || target.replace(/\s*\(gk\)/i, '').trim() === fullName)) return true;
    if (firstName && (target === firstName || target === `${firstName} (gk)` || target.replace(/\s*\(gk\)/i, '').trim() === firstName)) return true;
    if (lastName && target === lastName) return true;

    // Inverted or partial substring matches
    if (fullName && target.length >= 3 && (fullName.includes(target) || target.includes(fullName))) {
      return true;
    }
    if (firstName && firstName.length >= 3 && (target.includes(firstName) || firstName.includes(target))) {
      return true;
    }

    return false;
  });
}

/**
 * Finds the primary active injury for a given player, if any exists.
 */
export function getActiveInjuryForPlayer(
  player: SquadPlayer,
  injuries: Injury[]
): Injury | undefined {
  const playerInjuries = getInjuriesForPlayer(player, injuries);
  const activeInjuries = playerInjuries.filter((inj) => {
    const st = (inj.currentStatus || (inj as any).status || (inj as any).current_status || '').toLowerCase().trim();
    return Boolean(st) && st !== 'closed' && st !== 'resolved';
  });

  if (activeInjuries.length === 0) return undefined;

  // Prioritize open/under_treatment injuries first
  return (
    activeInjuries.find((i) => {
      const st = (i.currentStatus || (i as any).status || (i as any).current_status || '').toLowerCase().trim();
      return st === 'open' || st === 'under_treatment' || st === 'active';
    }) || activeInjuries[0]
  );
}

/**
 * Synchronizes squad players array with current physio injuries in memory.
 */
export function syncSquadPlayersWithInjuries(
  players: SquadPlayer[],
  injuries: Injury[]
): SquadPlayer[] {
  if (!players.length) return players;

  let hasChanges = false;
  const synchronized = players.map((player) => {
    const playerInjuries = getInjuriesForPlayer(player, injuries);
    const targetStatus = determineSquadStatusFromPlayerInjuries(playerInjuries, player.status);

    if (player.status !== targetStatus) {
      hasChanges = true;
      return {
        ...player,
        status: targetStatus
      };
    }
    return player;
  });

  return hasChanges ? synchronized : players;
}

/**
 * Constructs default attendance list from roster names, automatically marking
 * injured players as Absent (Injury).
 */
export function buildDefaultAttendanceFromRoster(
  roster: string[],
  squadPlayers: SquadPlayer[] = []
): PlayerAttendance[] {
  const injuredPlayerKeys = new Set<string>();

  squadPlayers.forEach((p) => {
    if (p.status === 'Injured') {
      const full = `${p.firstName} ${p.lastName}`.trim().toLowerCase();
      const first = p.firstName.trim().toLowerCase();
      const last = p.lastName.trim().toLowerCase();
      if (full) injuredPlayerKeys.add(full);
      if (first) injuredPlayerKeys.add(first);
      if (last) injuredPlayerKeys.add(last);
      injuredPlayerKeys.add(`${first} (gk)`);
      injuredPlayerKeys.add(`${full} (gk)`);
      injuredPlayerKeys.add(p.id.toLowerCase());
    }
  });

  return roster.map((playerName) => {
    const cleanName = playerName.replace(/\s*\(GK\)/i, '').trim().toLowerCase();
    const isInjured =
      injuredPlayerKeys.has(playerName.toLowerCase()) ||
      injuredPlayerKeys.has(cleanName);

    if (isInjured) {
      return {
        playerName,
        status: 'Absent' as const,
        absenceReason: 'Injury' as const
      };
    }

    return {
      playerName,
      status: 'Attending' as const
    };
  });
}
