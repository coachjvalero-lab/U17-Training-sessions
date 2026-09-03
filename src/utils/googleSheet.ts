export function buildGvizSheetUrl(sheetId: string, sheetName: string): string {
  return `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;
}

export function normalizeSheetText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function resolveHeaderIndex(headers: string[], candidates: string[]): number {
  const normalizedHeaders = headers.map((header) => normalizeSheetText(header));
  const normalizedCandidates = candidates.map((candidate) => normalizeSheetText(candidate));
  return normalizedHeaders.findIndex((header) => normalizedCandidates.some((candidate) => header.includes(candidate)));
}

export function formatSheetValue(value: string | undefined): string {
  const trimmed = (value || '').trim();
  return trimmed ? trimmed : '—';
}

export function parseGoogleDateValue(value: string | null | undefined): string {
  const raw = (value || '').trim();
  if (!raw) return 'Unknown Date';

  const googleDateMatch = raw.match(/^Date\((\d{4}),(\d+),(\d+)(?:,\d+,\d+,\d+)?\)$/);
  if (googleDateMatch) {
    const year = Number(googleDateMatch[1]);
    const monthZeroBased = Number(googleDateMatch[2]);
    const day = Number(googleDateMatch[3]);
    const localDate = new Date(year, monthZeroBased, day);
    return `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`;
  }

  const slashDateMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+\d{1,2}:\d{2}:\d{2})?$/);
  if (slashDateMatch) {
    const month = Number(slashDateMatch[1]);
    const day = Number(slashDateMatch[2]);
    const year = Number(slashDateMatch[3]);
    const localDate = new Date(year, month - 1, day);
    return `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw || 'Unknown Date';

  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
}

function parseGvizCell(cell: unknown): string {
  if (!cell || typeof cell !== 'object') return '';

  const record = cell as Record<string, unknown>;
  const value = record.f ?? record.v;

  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

/** Returns [headerRow, ...dataRows] from a Google Visualization API JSONP payload. */
export function parseGvizSheetTable(jsonText: string): string[][] {
  const wrapperStart = jsonText.indexOf('google.visualization.Query.setResponse(');
  const payload = wrapperStart >= 0
    ? jsonText.slice(wrapperStart + 'google.visualization.Query.setResponse('.length).trim()
    : jsonText;

  const wrapperEnd = payload.lastIndexOf(');');
  const normalizedPayload = wrapperEnd >= 0 ? payload.slice(0, wrapperEnd).trim() : payload.trim();
  const data = JSON.parse(normalizedPayload);
  const columns = Array.isArray(data?.table?.cols)
    ? data.table.cols.map((column: Record<string, unknown>) => String(column.label ?? ''))
    : [];
  const rows = Array.isArray(data?.table?.rows)
    ? data.table.rows.map((row: Record<string, unknown>) => (Array.isArray(row.c) ? row.c.map(parseGvizCell) : []))
    : [];
  return [columns, ...rows];
}

export function parseSheetNumber(value: string | undefined | null): number | null {
  const raw = (value ?? '').trim();
  if (!raw || raw === '—') return null;
  const normalized = raw.replace(/,/g, '.').replace(/[^0-9.\-]/g, '');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}
