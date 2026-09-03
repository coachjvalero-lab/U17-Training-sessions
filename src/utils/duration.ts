import type { Exercise, TrainingBlock } from '../types';

export function parseDurationValue(input?: number | string): number {
  if (input === undefined || input === null || input === '') {
    return 0;
  }

  const raw = String(input).trim().toLowerCase();
  if (!raw) {
    return 0;
  }

  const colonMatch = raw.match(/^(\d+)\s*:\s*(\d{1,2})$/);
  if (colonMatch) {
    const minutes = parseInt(colonMatch[1], 10);
    const seconds = parseInt(colonMatch[2], 10);
    return minutes + seconds / 60;
  }

  const normalized = raw
    .replace(/(min|mins|minutes?|m)\b/g, '')
    .replace(/(sec|secs|seconds?|s)\b/g, '')
    .replace(/'/g, '')
    .trim();

  const parsed = parseFloat(normalized);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function formatDurationLabel(totalMinutes: number): string {
  const rounded = Math.round(totalMinutes * 10) / 10;
  return `${rounded} min`;
}

// Exercises without a parseable duration contribute 0 (never an invented default).
export function sumExercisesDurationMinutes(exercises?: Exercise[]): number {
  if (!Array.isArray(exercises)) {
    return 0;
  }
  return exercises.reduce((total, exercise) => total + parseDurationValue(exercise?.duration), 0);
}

export function calculateSessionTotalDurationMinutes(blocks: Array<TrainingBlock | undefined>): number {
  const total = blocks.reduce((sum, block) => sum + sumExercisesDurationMinutes(block?.exercises), 0);
  return Math.round(total * 10) / 10;
}
