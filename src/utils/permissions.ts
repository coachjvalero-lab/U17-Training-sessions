import { PortalSection } from '../types';
import {
  subscribeToUserPermissions,
  saveUserPermissionsListCloud
} from '../firebase';

export interface UserPermission {
  email: string;
  role: 'admin' | 'coach' | 'fitness_coach' | 'gk_coach' | 'physio' | 'analyst' | 'custom';
  allowedSections: PortalSection[];
}

export const ALL_SECTIONS_LIST: { id: PortalSection; label: string; description: string }[] = [
  { id: 'football', label: 'Football Session', description: 'Tactical plans & interactive pitch drills' },
  { id: 'fitness', label: 'Fitness & Conditioning', description: 'Physical load, gym blocks & GPS metrics' },
  { id: 'gk', label: 'Goalkeepers Specific', description: 'Dedicated goalkeeper training drills' },
  { id: 'squad', label: 'Squad Roster', description: 'Roster management & player info' },
  { id: 'attendance', label: 'Attendance & Analytics', description: 'Player attendance rates & absence logs' },
  { id: 'physio', label: 'Physiotherapist Dept', description: 'Injury records, rehab & return-to-play' },
  { id: 'video', label: 'Video Analysis Hub', description: 'Match & training video analyses & clips' },
  { id: 'exercises', label: 'Exercises Library', description: 'Drill repository & tactical search' },
  { id: 'planning', label: 'Planification & Microcycle', description: 'Monthly periodization & microcycle plans' }
];

export const DEFAULT_USER_PERMISSIONS: UserPermission[] = [
  {
    email: 'admin@alula.com',
    role: 'admin',
    allowedSections: ['football', 'fitness', 'gk', 'squad', 'attendance', 'physio', 'video', 'exercises', 'planning']
  }
];

const PERMISSIONS_STORAGE_KEY = 'u17_user_permissions_config';

export function getUserPermissionsList(): UserPermission[] {
  let list: UserPermission[] = [...DEFAULT_USER_PERMISSIONS];
  try {
    const stored = localStorage.getItem(PERMISSIONS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        list = parsed;
      }
    }
  } catch (e) {
    // ignore
  }
  return list;
}

export function saveUserPermissionsList(list: UserPermission[]): void {
  try {
    localStorage.setItem(PERMISSIONS_STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    // ignore
  }
}

/**
 * Pushes the full permissions list to Firestore so every device sees the update in real time.
 * Call this alongside saveUserPermissionsList() whenever an admin explicitly saves changes.
 */
export function saveUserPermissionsListToCloud(list: UserPermission[]): void {
  saveUserPermissionsListCloud(list).catch(err => console.warn('Cloud save failed for permissions:', err));
}

/**
 * Migrates any locally-cached permissions list to Firestore (once) and subscribes to live
 * updates, keeping the localStorage cache in sync so getUserPermissionsList() stays fresh.
 * Returns an unsubscribe function.
 */
export function initPermissionsCloudSync(onUpdate?: () => void): () => void {
  const unsubscribe = subscribeToUserPermissions((list) => {
    if (list.length === 0) return;
    saveUserPermissionsList(list);
    if (onUpdate) onUpdate();
  }, () => {
    // Offline or subscription error: keep working with whatever is cached locally
  });

  return unsubscribe;
}

export function isUserAdmin(userEmail?: string | null): boolean {
  if (!userEmail) return false;
  const clean = userEmail.trim().toLowerCase();
  const list = getUserPermissionsList();
  const match = list.find(u => {
    const uEmail = u.email.toLowerCase();
    return uEmail === clean || uEmail.split('@')[0] === clean.split('@')[0];
  });
  return match?.role === 'admin';
}

export function getUserAllowedSections(userEmail?: string | null): PortalSection[] {
  if (!userEmail) {
    // Default allowed sections
    return ALL_SECTIONS_LIST.map(s => s.id);
  }

  const clean = userEmail.trim().toLowerCase();

  // Admin users always have access to all sections
  if (isUserAdmin(clean)) {
    return ALL_SECTIONS_LIST.map(s => s.id);
  }

  const list = getUserPermissionsList();
  const found = list.find(u => {
    const uEmail = u.email.toLowerCase();
    const uUser = uEmail.split('@')[0];
    const cleanUser = clean.split('@')[0];
    return uEmail === clean || uUser === cleanUser || clean.startsWith(uUser);
  });

  if (found && found.allowedSections && found.allowedSections.length > 0) {
    return found.allowedSections;
  }

  // Fallback for non-listed users: default to standard coach tabs
  return ['football', 'squad', 'attendance', 'exercises', 'planning', 'video'];
}
