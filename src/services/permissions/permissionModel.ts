import type { PortalSection } from '../../types';

export interface UserPermission {
  userId?: string;
  email: string;
  displayName?: string | null;
  isActive: boolean;
  isAdmin: boolean;
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
  { id: 'planning', label: 'Planification & Microcycle', description: 'Monthly periodization & microcycle plans' },
  { id: 'meetings', label: 'Meetings', description: 'Staff meeting registry & follow-up tracker' }
];
