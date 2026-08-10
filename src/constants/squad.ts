import { TrainingSession, PlayerAttendance, PlayerGroup, SquadPlayer } from '../types';

export const DEFAULT_DETAILED_SQUAD: SquadPlayer[] = [
  { id: 'p1', firstName: 'Rimah', lastName: 'Fahad', number: 2, position: 'CB', status: 'Active', notes: 'Vice captain, strong aerial duel win rate', age: 16, nationality: 'Saudi Arabia 🇸🇦', preferredFoot: 'Right', heightCm: 172, weightKg: 61 },
  { id: 'p2', firstName: 'Rital', lastName: 'Almutairi', number: 3, position: 'LB', status: 'Active', notes: 'Overlap specialist, high physical stamina', age: 16, nationality: 'Saudi Arabia 🇸🇦', preferredFoot: 'Left', heightCm: 165, weightKg: 55 },
  { id: 'p3', firstName: 'Lara', lastName: 'Alnassr', number: 4, position: 'RB', status: 'Active', notes: 'Quick transition, accurate crossing', age: 17, nationality: 'United Kingdom 🇬🇧', preferredFoot: 'Right', heightCm: 168, weightKg: 58 },
  { id: 'p4', firstName: 'Batool', lastName: 'Youseff', number: 5, position: 'CB', status: 'Active', notes: 'Commanding leader, spatial awareness', age: 17, nationality: 'Saudi Arabia 🇸🇦', preferredFoot: 'Right', heightCm: 175, weightKg: 64 },
  { id: 'p5', firstName: 'Sadeem', lastName: 'Aljohani', number: 6, position: 'CDM', status: 'Active', notes: 'High interceptor, defensive anchor', age: 16, nationality: 'Saudi Arabia 🇸🇦', preferredFoot: 'Right', heightCm: 170, weightKg: 60 },
  { id: 'p6', firstName: 'Alba', lastName: 'Almutairi', number: 7, position: 'RW', status: 'Active', notes: '1v1 dribbler, key chance creator', age: 16, nationality: 'Spain 🇪🇸', preferredFoot: 'Right', heightCm: 162, weightKg: 52 },
  { id: 'p7', firstName: 'Ghala', lastName: 'Kurdi', number: 8, position: 'CM', status: 'Active', notes: 'Box-to-box midfielder, high passing accuracy', age: 17, nationality: 'Saudi Arabia 🇸🇦', preferredFoot: 'Both', heightCm: 167, weightKg: 56 },
  { id: 'p8', firstName: 'Auda', lastName: 'Emad', number: 9, position: 'ST', status: 'Active', notes: 'Target striker, high conversion rate', age: 16, nationality: 'Saudi Arabia 🇸🇦', preferredFoot: 'Right', heightCm: 174, weightKg: 62 },
  { id: 'p9', firstName: 'Lateen', lastName: 'Hattan', number: 10, position: 'CAM', status: 'Injured', notes: 'Ankle sprain, in rehab with physio team', age: 16, nationality: 'Saudi Arabia 🇸🇦', preferredFoot: 'Right', heightCm: 164, weightKg: 53 },
  { id: 'p10', firstName: 'Leen', lastName: 'Alhidari', number: 11, position: 'LW', status: 'Active', notes: 'Pacy winger, inward cutting finisher', age: 16, nationality: 'Saudi Arabia 🇸🇦', preferredFoot: 'Left', heightCm: 166, weightKg: 54 },
  { id: 'p11', firstName: 'Hedayah', lastName: 'Abdulaziz', number: 12, position: 'CM', status: 'Active', notes: 'Tactical link player, high pressing efficiency', age: 15, nationality: 'Saudi Arabia 🇸🇦', preferredFoot: 'Right', heightCm: 163, weightKg: 51 },
  { id: 'p12', firstName: 'Ghazal', lastName: 'Fadhel', number: 14, position: 'RW', status: 'Active', notes: 'High speed, quick counter attack threat', age: 16, nationality: 'Saudi Arabia 🇸🇦', preferredFoot: 'Right', heightCm: 165, weightKg: 53 },
  { id: 'p13', firstName: 'Remas', lastName: 'Mukhtar', number: 15, position: 'ST', status: 'Absent', notes: 'Academic exams week', age: 17, nationality: 'Saudi Arabia 🇸🇦', preferredFoot: 'Right', heightCm: 171, weightKg: 59 },
  { id: 'p14', firstName: 'Mayar', lastName: 'Alzughaibi', number: 16, position: 'LB', status: 'Active', notes: 'Disciplined defender, reliable cover', age: 16, nationality: 'Saudi Arabia 🇸🇦', preferredFoot: 'Left', heightCm: 164, weightKg: 53 },
  { id: 'p15', firstName: 'Maya', lastName: 'alzahrani', number: 17, position: 'RB', status: 'Active', notes: 'Solid in 1v1 defensive duels', age: 15, nationality: 'Saudi Arabia 🇸🇦', preferredFoot: 'Right', heightCm: 162, weightKg: 51 },
  { id: 'p16', firstName: 'Asma', lastName: 'Azis', number: 18, position: 'CDM', status: 'Active', notes: 'Ball recovery engine', age: 16, nationality: 'Saudi Arabia 🇸🇦', preferredFoot: 'Right', heightCm: 168, weightKg: 57 },
  { id: 'p17', firstName: 'Raseel', lastName: 'Yousef', number: 19, position: 'CAM', status: 'Active', notes: 'Creative playmaker between lines', age: 16, nationality: 'Saudi Arabia 🇸🇦', preferredFoot: 'Both', heightCm: 163, weightKg: 52 },
  { id: 'p18', firstName: 'Rema', lastName: 'Al-Harbi', number: 1, position: 'GK', status: 'Active', notes: 'Starting GK, excellent feet distribution', age: 17, nationality: 'Saudi Arabia 🇸🇦', preferredFoot: 'Right', heightCm: 178, weightKg: 65 },
  { id: 'p19', firstName: 'Sara', lastName: 'Alreahili', number: 13, position: 'GK', status: 'Active', notes: 'Shot stopping specialist, commanding box presence', age: 16, nationality: 'Saudi Arabia 🇸🇦', preferredFoot: 'Right', heightCm: 176, weightKg: 63 },
  { id: 'p20', firstName: 'Khulood', lastName: 'Khaled', number: 20, position: 'CB', status: 'Active', notes: 'Calm under high pressure build-up', age: 16, nationality: 'Saudi Arabia 🇸🇦', preferredFoot: 'Right', heightCm: 173, weightKg: 60 },
  { id: 'p21', firstName: 'Ranse', lastName: 'Alhejaili', number: 22, position: 'GK', status: 'Active', notes: 'Agile reaction saver', age: 15, nationality: 'Saudi Arabia 🇸🇦', preferredFoot: 'Right', heightCm: 174, weightKg: 61 },
  { id: 'p22', firstName: 'Ratil', lastName: 'albukhari', number: 25, position: 'GK', status: 'Active', notes: 'High ball cross collector', age: 15, nationality: 'Saudi Arabia 🇸🇦', preferredFoot: 'Right', heightCm: 175, weightKg: 62 }
];

export const DEFAULT_SQUAD_PLAYERS = [
  'Rimah',
  'Rital',
  'Lara',
  'Batool',
  'Sadeem',
  'Alba',
  'Ghala',
  'Auda',
  'Lateen',
  'Leen',
  'Hedayah',
  'Ghazal',
  'Remas',
  'Mayar',
  'Maya',
  'Asma',
  'Raseel',
  'Rema (GK)',
  'Sara (GK)',
  'Khulood',
  'Ranse (GK)',
  'Ratil (GK)'
];

export interface ColorPreset {
  id: string;
  name: string;
  label: string;
  hex: string;
  bgClass: string;
  textClass: string;
  bgLight: string;
  borderClass: string;
  badgeClass: string;
}

export const GROUP_COLOR_PRESETS: ColorPreset[] = [
  {
    id: 'blue',
    name: 'Blue Bib',
    label: 'Blue 🔵',
    hex: '#2563eb',
    bgClass: 'bg-blue-600',
    textClass: 'text-blue-700',
    bgLight: 'bg-blue-50/80',
    borderClass: 'border-blue-200',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-300'
  },
  {
    id: 'yellow',
    name: 'Yellow Bib',
    label: 'Yellow 🟡',
    hex: '#eab308',
    bgClass: 'bg-yellow-500',
    textClass: 'text-amber-800',
    bgLight: 'bg-yellow-50/80',
    borderClass: 'border-yellow-200',
    badgeClass: 'bg-amber-100 text-amber-900 border-amber-300'
  },
  {
    id: 'red',
    name: 'Red Bib',
    label: 'Red 🔴',
    hex: '#ef4444',
    bgClass: 'bg-red-600',
    textClass: 'text-red-700',
    bgLight: 'bg-red-50/80',
    borderClass: 'border-red-200',
    badgeClass: 'bg-red-100 text-red-800 border-red-300'
  },
  {
    id: 'green',
    name: 'Green Bib',
    label: 'Green 🟢',
    hex: '#22c55e',
    bgClass: 'bg-emerald-600',
    textClass: 'text-emerald-800',
    bgLight: 'bg-emerald-50/80',
    borderClass: 'border-emerald-200',
    badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300'
  },
  {
    id: 'orange',
    name: 'Orange Bib',
    label: 'Orange 🟠',
    hex: '#f97316',
    bgClass: 'bg-orange-500',
    textClass: 'text-orange-800',
    bgLight: 'bg-orange-50/80',
    borderClass: 'border-orange-200',
    badgeClass: 'bg-orange-100 text-orange-900 border-orange-300'
  },
  {
    id: 'purple',
    name: 'Purple Bib',
    label: 'Purple 🟣',
    hex: '#a855f7',
    bgClass: 'bg-purple-600',
    textClass: 'text-purple-800',
    bgLight: 'bg-purple-50/80',
    borderClass: 'border-purple-200',
    badgeClass: 'bg-purple-100 text-purple-900 border-purple-300'
  },
  {
    id: 'pink',
    name: 'Pink Bib',
    label: 'Pink 🩷',
    hex: '#ec4899',
    bgClass: 'bg-pink-500',
    textClass: 'text-pink-800',
    bgLight: 'bg-pink-50/80',
    borderClass: 'border-pink-200',
    badgeClass: 'bg-pink-100 text-pink-900 border-pink-300'
  },
  {
    id: 'white',
    name: 'No Bib / White',
    label: 'White ⚪',
    hex: '#f8fafc',
    bgClass: 'bg-slate-300',
    textClass: 'text-slate-800',
    bgLight: 'bg-slate-50',
    borderClass: 'border-slate-300',
    badgeClass: 'bg-slate-100 text-slate-800 border-slate-300'
  },
  {
    id: 'dark',
    name: 'Black Bib',
    label: 'Black ⬛',
    hex: '#1e293b',
    bgClass: 'bg-slate-800',
    textClass: 'text-slate-900',
    bgLight: 'bg-slate-100',
    borderClass: 'border-slate-400',
    badgeClass: 'bg-slate-800 text-white border-slate-700'
  }
];

export function getColorPreset(colorOrHex: string): ColorPreset {
  const normalized = (colorOrHex || '').toLowerCase().trim();
  const match = GROUP_COLOR_PRESETS.find(
    c => c.hex.toLowerCase() === normalized || 
         c.id === normalized || 
         c.name.toLowerCase().includes(normalized) ||
         normalized.includes(c.id)
  );
  if (match) return match;
  return GROUP_COLOR_PRESETS[0];
}

export function normalizeSessionRoster(sess: TrainingSession): TrainingSession {
  if (!sess) return sess;

  const renamePlayer = (name: string): string => {
    if (!name) return name;
    const trimmed = name.trim();
    if (trimmed === 'Ransy' || trimmed.toLowerCase() === 'ransy' || trimmed === 'Ranse' || trimmed.toLowerCase() === 'ranse') return 'Ranse (GK)';
    if (trimmed === 'Ratil' || trimmed.toLowerCase() === 'ratil') return 'Ratil (GK)';
    if (trimmed === 'Sara' || trimmed.toLowerCase() === 'sara') return 'Sara (GK)';
    if (trimmed === 'Rema' || trimmed.toLowerCase() === 'rema') return 'Rema (GK)';
    return name;
  };

  const currentRoster = Array.isArray(sess.squadRoster) && sess.squadRoster.length > 0
    ? sess.squadRoster
    : DEFAULT_SQUAD_PLAYERS;

  let updatedRoster = currentRoster.map(renamePlayer);

  const hasLeen = updatedRoster.some(p => p.trim().toLowerCase() === 'leen');
  if (!hasLeen) {
    const lateenIdx = updatedRoster.findIndex(p => p.trim().toLowerCase() === 'lateen');
    if (lateenIdx !== -1) {
      updatedRoster.splice(lateenIdx + 1, 0, 'Leen');
    } else {
      updatedRoster.push('Leen');
    }
  }

  let currentAttendance = Array.isArray(sess.attendance) ? sess.attendance : [];
  let updatedAttendance: PlayerAttendance[] = currentAttendance.map(a => ({
    ...a,
    playerName: renamePlayer(a.playerName)
  }));

  const hasLeenAtt = updatedAttendance.some(a => a.playerName.trim().toLowerCase() === 'leen');
  if (!hasLeenAtt) {
    const lateenIdx = updatedAttendance.findIndex(a => a.playerName.trim().toLowerCase() === 'lateen');
    const leenObj: PlayerAttendance = { playerName: 'Leen', status: 'Attending' };
    if (lateenIdx !== -1) {
      updatedAttendance.splice(lateenIdx + 1, 0, leenObj);
    } else {
      updatedAttendance.push(leenObj);
    }
  }

  const replaceTextNames = (text: string): string => {
    if (!text) return text;
    return text
      .replace(/\bRema\b(?!\s*\(GK\))/g, 'Rema (GK)')
      .replace(/\bSara\b(?!\s*\(GK\))/g, 'Sara (GK)')
      .replace(/\bRansy\b(?!\s*\(GK\))/g, 'Ranse (GK)')
      .replace(/\bRanse\b(?!\s*\(GK\))/g, 'Ranse (GK)')
      .replace(/\bRatil\b(?!\s*\(GK\))/g, 'Ratil (GK)');
  };

  const normalizeGroups = (groups?: PlayerGroup[]): PlayerGroup[] => {
    if (!groups) return [];
    return groups.map(g => ({
      ...g,
      players: replaceTextNames(g.players)
    }));
  };

  return {
    ...sess,
    squadRoster: updatedRoster,
    attendance: updatedAttendance,
    playerGroups: normalizeGroups(sess.playerGroups),
    fitnessPlayerGroups: normalizeGroups(sess.fitnessPlayerGroups),
    gkPlayerGroups: normalizeGroups(sess.gkPlayerGroups),
  };
}
