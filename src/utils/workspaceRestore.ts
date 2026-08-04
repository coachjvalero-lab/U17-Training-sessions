export const WORKSPACE_RESTORE_PREFIX = 'u17_workspace_restore:';

export function readWorkspaceRestoreState<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;

  try {
    const raw = sessionStorage.getItem(WORKSPACE_RESTORE_PREFIX + key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch (e) {
    return fallback;
  }
}

export function writeWorkspaceRestoreState<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;

  try {
    sessionStorage.setItem(WORKSPACE_RESTORE_PREFIX + key, JSON.stringify(value));
  } catch (e) {
    // ignore storage issues
  }
}

export function clearWorkspaceRestoreState(key?: string): void {
  if (typeof window === 'undefined') return;

  try {
    if (key) {
      sessionStorage.removeItem(WORKSPACE_RESTORE_PREFIX + key);
      return;
    }

    const keysToRemove: string[] = [];
    for (let index = 0; index < sessionStorage.length; index++) {
      const storageKey = sessionStorage.key(index);
      if (storageKey?.startsWith(WORKSPACE_RESTORE_PREFIX)) {
        keysToRemove.push(storageKey);
      }
    }

    keysToRemove.forEach(storageKey => sessionStorage.removeItem(storageKey));
  } catch (e) {
    // ignore storage issues
  }
}