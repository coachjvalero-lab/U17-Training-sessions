import { PortalSection } from '../types';

export interface UserPermission {
  email: string;
  role: 'admin' | 'coach' | 'physio' | 'analyst' | 'custom';
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
  },
  {
    email: 'coach@alula.com',
    role: 'coach',
    allowedSections: ['football', 'squad', 'attendance', 'video', 'exercises', 'planning']
  },
  {
    email: 'physio@alula.com',
    role: 'physio',
    allowedSections: ['physio', 'squad', 'attendance']
  },
  {
    email: 'analyst@alula.com',
    role: 'analyst',
    allowedSections: ['video', 'exercises', 'football', 'planning']
  }
];

const PERMISSIONS_STORAGE_KEY = 'u17_user_permissions_config';

export function getUserPermissionsList(): UserPermission[] {
  try {
    const stored = localStorage.getItem(PERMISSIONS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    // ignore
  }
  return DEFAULT_USER_PERMISSIONS;
}

export function saveUserPermissionsList(list: UserPermission[]): void {
  try {
    localStorage.setItem(PERMISSIONS_STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    // ignore
  }
}

export function isUserAdmin(userEmail?: string | null): boolean {
  if (!userEmail) return false;
  const clean = userEmail.trim().toLowerCase();
  if (clean.startsWith('admin') || clean.includes('admin')) return true;
  const list = getUserPermissionsList();
  const match = list.find(u => u.email.toLowerCase() === clean);
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
  const found = list.find(u => u.email.toLowerCase() === clean || clean.startsWith(u.email.toLowerCase().split('@')[0]));

  if (found && found.allowedSections && found.allowedSections.length > 0) {
    return found.allowedSections;
  }

  // Fallback for non-listed users: default to standard coach tabs
  return ['football', 'squad', 'attendance', 'exercises', 'planning', 'video'];
}
