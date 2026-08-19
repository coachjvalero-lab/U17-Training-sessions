export type WellnessVisibleRow = {
  playerName: string;
  dateKey: string;
};

export function selectWellnessRowsForDate<TRow extends WellnessVisibleRow>(
  rows: TRow[],
  selectedDate: string
): TRow[] {
  return rows
    .filter((row) => !selectedDate || row.dateKey === selectedDate)
    .slice()
    .sort((left, right) => left.playerName.localeCompare(right.playerName));
}