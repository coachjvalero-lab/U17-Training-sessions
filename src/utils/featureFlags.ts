function resolveFlag(rawValue: string | undefined, defaultValue: boolean): boolean {
	if (rawValue === undefined) return defaultValue;
	const normalized = rawValue.trim().toLowerCase();
	if (normalized === 'true') return true;
	if (normalized === 'false') return false;
	return defaultValue;
}

// A2 architecture defaults to enabled after Step A1, with env override to disable if needed.
export const FITNESS_V2_ENABLED = resolveFlag(import.meta.env.VITE_FITNESS_V2_ENABLED, true);
export const EXERCISE_MODULE_COLUMN_ENABLED = resolveFlag(import.meta.env.VITE_EXERCISE_MODULE_COLUMN_ENABLED, true);
