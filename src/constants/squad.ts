export const DEFAULT_SQUAD_PLAYERS = [
  'Rimah',
  'Rital',
  'Lara',
  'Batul',
  'Sadeem',
  'Alba',
  'Ghala',
  'Auda',
  'Lateen',
  'Hedaya',
  'Ghazal',
  'Remas',
  'Mayar',
  'Maya',
  'Asma',
  'Rasil',
  'Rema',
  'Sara',
  'Khulud',
  'Ransy',
  'Jalila',
  'Ratil'
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
    name: 'Peto Azul',
    label: 'Azul 🔵',
    hex: '#2563eb',
    bgClass: 'bg-blue-600',
    textClass: 'text-blue-700',
    bgLight: 'bg-blue-50/80',
    borderClass: 'border-blue-200',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-300'
  },
  {
    id: 'yellow',
    name: 'Peto Amarillo',
    label: 'Amarillo 🟡',
    hex: '#eab308',
    bgClass: 'bg-yellow-500',
    textClass: 'text-amber-800',
    bgLight: 'bg-yellow-50/80',
    borderClass: 'border-yellow-200',
    badgeClass: 'bg-amber-100 text-amber-900 border-amber-300'
  },
  {
    id: 'red',
    name: 'Peto Rojo',
    label: 'Rojo 🔴',
    hex: '#ef4444',
    bgClass: 'bg-red-600',
    textClass: 'text-red-700',
    bgLight: 'bg-red-50/80',
    borderClass: 'border-red-200',
    badgeClass: 'bg-red-100 text-red-800 border-red-300'
  },
  {
    id: 'green',
    name: 'Peto Verde',
    label: 'Verde 🟢',
    hex: '#22c55e',
    bgClass: 'bg-emerald-600',
    textClass: 'text-emerald-800',
    bgLight: 'bg-emerald-50/80',
    borderClass: 'border-emerald-200',
    badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300'
  },
  {
    id: 'orange',
    name: 'Peto Naranja',
    label: 'Naranja 🟠',
    hex: '#f97316',
    bgClass: 'bg-orange-500',
    textClass: 'text-orange-800',
    bgLight: 'bg-orange-50/80',
    borderClass: 'border-orange-200',
    badgeClass: 'bg-orange-100 text-orange-900 border-orange-300'
  },
  {
    id: 'purple',
    name: 'Peto Morado',
    label: 'Morado 🟣',
    hex: '#a855f7',
    bgClass: 'bg-purple-600',
    textClass: 'text-purple-800',
    bgLight: 'bg-purple-50/80',
    borderClass: 'border-purple-200',
    badgeClass: 'bg-purple-100 text-purple-900 border-purple-300'
  },
  {
    id: 'pink',
    name: 'Peto Rosa',
    label: 'Rosa 🩷',
    hex: '#ec4899',
    bgClass: 'bg-pink-500',
    textClass: 'text-pink-800',
    bgLight: 'bg-pink-50/80',
    borderClass: 'border-pink-200',
    badgeClass: 'bg-pink-100 text-pink-900 border-pink-300'
  },
  {
    id: 'white',
    name: 'Sin Peto / Blanco',
    label: 'Blanco ⚪',
    hex: '#f8fafc',
    bgClass: 'bg-slate-300',
    textClass: 'text-slate-800',
    bgLight: 'bg-slate-50',
    borderClass: 'border-slate-300',
    badgeClass: 'bg-slate-100 text-slate-800 border-slate-300'
  },
  {
    id: 'dark',
    name: 'Peto Negro',
    label: 'Negro ⬛',
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
