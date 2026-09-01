export function selectCalledUpPlayers<TPlayer extends { id: string }>(
  squadPlayers: TPlayer[],
  lineupEntries: Array<{ playerId: string }>
): TPlayer[] {
  const calledPlayerIds = new Set(lineupEntries.map((entry) => entry.playerId));
  return squadPlayers.filter((player) => calledPlayerIds.has(player.id));
}