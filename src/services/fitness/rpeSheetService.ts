import { buildGvizSheetUrl, parseGvizSheetTable } from '../../utils/googleSheet';
import { parseRpeSheetRows, type RpeSheetRow } from '../../utils/rpeSheetParsing';

const env = ((import.meta as unknown as { env?: Record<string, string> }).env) ?? {};
const RPE_SHEET_ID = env.VITE_WELLNESS_SHEET_ID || '178oyGRKhSNlsdl2zV5oIu_uXE9Qdtq1xUkFpUXbSQDw';
const RPE_SHEET_NAME = 'RPE';
const RPE_SHEET_JSON_URL = buildGvizSheetUrl(RPE_SHEET_ID, RPE_SHEET_NAME);

export async function fetchRpeSheetRows(signal?: AbortSignal): Promise<RpeSheetRow[]> {
  const response = await fetch(RPE_SHEET_JSON_URL, { signal });
  if (!response.ok) {
    throw new Error(`RPE sheet request failed (${response.status})`);
  }
  return parseRpeSheetRows(parseGvizSheetTable(await response.text()));
}
