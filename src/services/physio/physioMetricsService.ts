import type { Injury } from '../../types';

export function getInjuryDays(injury: Injury, today = new Date()): number {
  const start = new Date(`${injury.injuryDate}T00:00:00`); const end = injury.actualReturnDate ? new Date(`${injury.actualReturnDate}T00:00:00`) : today;
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86400000));
}
export function getSeverityBand(injury: Injury): string {
  if (!injury.actualReturnDate) return 'Provisional'; const days = getInjuryDays(injury);
  if (days === 0) return '0 days'; if (days <= 3) return '1–3 days'; if (days <= 7) return '4–7 days'; if (days <= 28) return '8–28 days'; return '>28 days';
}
export function isActiveInjury(injury: Injury): boolean { return injury.currentStatus !== 'closed'; }
