import {
  formatSheetValue,
  parseGoogleDateValue,
  parseSheetNumber,
  resolveHeaderIndex
} from './googleSheet';

export interface RpeSheetRow {
  rowId: string;
  timestamp: string;
  /** YYYY-MM-DD */
  dateKey: string;
  playerName: string;
  rpe: number | null;
  durationMinutes: number | null;
  /** Volume (UA) exactly as reported by the sheet; the app recomputes its own value. */
  reportedVolumeUa: number | null;
}

/** Pure parser over the [headers, ...rows] table produced by parseGvizSheetTable. */
export function parseRpeSheetRows(table: string[][]): RpeSheetRow[] {
  if (!Array.isArray(table) || table.length < 2) return [];

  const headers = table[0] || [];
  const timestampIndex = resolveHeaderIndex(headers, ['Timestamp']);
  const dateIndex = resolveHeaderIndex(headers, ['Date']);
  const playerIndex = resolveHeaderIndex(headers, ['Player']);
  const rpeIndex = resolveHeaderIndex(headers, ['RPE']);
  const durationIndex = resolveHeaderIndex(headers, ['Duration']);
  const volumeIndex = resolveHeaderIndex(headers, ['Volume (UA)', 'Volume']);

  return table
    .slice(1)
    .map((cells, index): RpeSheetRow | null => {
      const timestamp = formatSheetValue(cells[timestampIndex]);
      const rawDate = formatSheetValue(cells[dateIndex]);
      const playerName = formatSheetValue(cells[playerIndex]);
      if (playerName === '—' && rawDate === '—' && timestamp === '—') return null;

      const resolvedTimestamp = timestamp === '—' ? rawDate : timestamp;
      const dateKey = parseGoogleDateValue(rawDate !== '—' ? rawDate : resolvedTimestamp);

      return {
        rowId: `${dateKey}-${playerName}-${index}`,
        timestamp: resolvedTimestamp,
        dateKey,
        playerName,
        rpe: parseSheetNumber(cells[rpeIndex]),
        durationMinutes: parseSheetNumber(cells[durationIndex]),
        reportedVolumeUa: volumeIndex >= 0 ? parseSheetNumber(cells[volumeIndex]) : null
      };
    })
    .filter((row): row is RpeSheetRow => row !== null && row.playerName !== '—');
}
