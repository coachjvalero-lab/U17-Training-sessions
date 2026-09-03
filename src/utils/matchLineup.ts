export function selectCalledUpPlayers<TPlayer extends { id: string }>(
  squadPlayers: TPlayer[],
  lineupEntries: Array<{ playerId: string }>
): TPlayer[] {
  const calledPlayerIds = new Set(lineupEntries.map((entry) => entry.playerId));
  return squadPlayers.filter((player) => calledPlayerIds.has(player.id));
}

/**
 * A squad call has "pending changes" once it has been confirmed at least once and the
 * current called-up roster no longer matches the confirmed snapshot (players added/removed).
 */
export function hasSquadCallChangedSinceConfirmation(
  confirmedPlayerIds: string[] | null | undefined,
  currentPlayerIds: string[]
): boolean {
  if (!confirmedPlayerIds) return false;
  const confirmed = [...confirmedPlayerIds].sort();
  const current = [...currentPlayerIds].sort();
  if (confirmed.length !== current.length) return true;
  return confirmed.some((id, index) => id !== current[index]);
}
