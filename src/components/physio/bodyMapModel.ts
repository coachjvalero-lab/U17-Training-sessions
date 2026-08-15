export type BodyMapView = 'front' | 'back';

export type BodyRegionKey =
  | 'head_face'
  | 'neck'
  | 'shoulder'
  | 'chest'
  | 'abdomen'
  | 'upper_back'
  | 'lower_back'
  | 'hip'
  | 'groin'
  | 'glute'
  | 'thigh'
  | 'knee'
  | 'lower_leg'
  | 'calf'
  | 'ankle'
  | 'foot'
  | 'upper_arm'
  | 'elbow'
  | 'forearm'
  | 'wrist_hand';

export const BODY_REGION_LABELS: Record<BodyRegionKey, string> = {
  head_face: 'Head / face',
  neck: 'Neck',
  shoulder: 'Shoulder',
  chest: 'Chest',
  abdomen: 'Abdomen',
  upper_back: 'Upper back',
  lower_back: 'Lower back',
  hip: 'Hip',
  groin: 'Groin',
  glute: 'Glute',
  thigh: 'Thigh',
  knee: 'Knee',
  lower_leg: 'Lower leg',
  calf: 'Calf',
  ankle: 'Ankle',
  foot: 'Foot',
  upper_arm: 'Upper arm',
  elbow: 'Elbow',
  forearm: 'Forearm',
  wrist_hand: 'Wrist / hand'
};

export const BODY_REGION_SUBLOCATIONS: Partial<Record<BodyRegionKey, string[]>> = {
  thigh: ['quadriceps', 'hamstring', 'adductor', 'other'],
  knee: ['anterior', 'medial', 'lateral', 'posterior', 'patellar', 'other'],
  ankle: ['lateral', 'medial', 'achilles', 'other'],
  shoulder: ['anterior', 'lateral', 'posterior', 'other'],
  lower_leg: ['anterior', 'medial', 'lateral', 'other'],
  foot: ['heel', 'midfoot', 'forefoot', 'toes', 'other']
};

export function formatBodyLocation(value?: string | null): string {
  if (!value) return 'Not recorded';
  const [region, detail] = value.split(':');
  const regionLabel = BODY_REGION_LABELS[region as BodyRegionKey] || region.replaceAll('_', ' ');
  return detail ? `${regionLabel} · ${detail.replaceAll('_', ' ')}` : regionLabel;
}

export function buildBodyLocation(region: BodyRegionKey, detail?: string): string {
  return detail ? `${region}:${detail}` : region;
}
