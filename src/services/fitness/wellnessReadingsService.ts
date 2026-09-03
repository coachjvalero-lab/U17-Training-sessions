import {
  buildGvizSheetUrl,
  formatSheetValue,
  parseGoogleDateValue,
  parseGvizSheetTable,
  parseSheetNumber,
  resolveHeaderIndex
} from '../../utils/googleSheet';
import type { WellnessReadingInput } from '../../utils/rpeAnalytics';

const env = ((import.meta as unknown as { env?: Record<string, string> }).env) ?? {};
const WELLNESS_SHEET_ID = env.VITE_WELLNESS_SHEET_ID || '178oyGRKhSNlsdl2zV5oIu_uXE9Qdtq1xUkFpUXbSQDw';
const WELLNESS_SHEET_JSON_URL = buildGvizSheetUrl(WELLNESS_SHEET_ID, 'Wellness');

/** Lightweight projection of the Wellness tab: only what the RPE cross-analysis needs. */
export function parseWellnessReadings(table: string[][]): WellnessReadingInput[] {
  if (!Array.isArray(table) || table.length < 2) return [];

  const headers = table[0] || [];
  const timestampIndex = resolveHeaderIndex(headers, ['Timestamp']);
  const dateIndex = resolveHeaderIndex(headers, ['Date']);
  const playerIndex = resolveHeaderIndex(headers, ['Player']);
  const readinessIndex = resolveHeaderIndex(headers, ['Readiness']);
  const statusIndex = resolveHeaderIndex(headers, ['Status']);

  return table
    .slice(1)
    .map((cells): WellnessReadingInput | null => {
      const playerName = formatSheetValue(cells[playerIndex]);
      if (playerName === '—') return null;

      const rawDate = formatSheetValue(cells[dateIndex]);
      const timestamp = formatSheetValue(cells[timestampIndex]);
      const dateKey = parseGoogleDateValue(rawDate !== '—' ? rawDate : timestamp);
      const status = formatSheetValue(cells[statusIndex]);

      return {
        playerName,
        dateKey,
        readiness: parseSheetNumber(cells[readinessIndex]),
        status: status === '—' ? null : status
      };
    })
    .filter((reading): reading is WellnessReadingInput => reading !== null);
}

export async function fetchWellnessReadings(signal?: AbortSignal): Promise<WellnessReadingInput[]> {
  const response = await fetch(WELLNESS_SHEET_JSON_URL, { signal });
  if (!response.ok) {
    throw new Error(`Wellness sheet request failed (${response.status})`);
  }
  return parseWellnessReadings(parseGvizSheetTable(await response.text()));
}
