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

export const BODY_REGION_SUBLOCATIONS: Record<BodyRegionKey, string[]> = {
  head_face: ['forehead', 'temple', 'orbit_eye', 'nose', 'jaw_mandible', 'ear', 'scalp', 'other'],
  neck: ['anterior', 'posterior', 'lateral', 'cervical_spine', 'trapezius_upper', 'other'],
  shoulder: ['anterior', 'lateral', 'posterior', 'acromioclavicular', 'rotator_cuff', 'clavicle', 'other'],
  chest: ['pectoral', 'sternum', 'ribs', 'intercostal', 'other'],
  abdomen: ['upper_quadrant', 'lower_quadrant', 'rectus_abdominis', 'oblique', 'other'],
  upper_back: ['scapular', 'thoracic_spine', 'rhomboid', 'trapezius', 'other'],
  lower_back: ['lumbar_spine', 'sacroiliac', 'paraspinal', 'quadratus_lumborum', 'other'],
  hip: ['anterior', 'lateral', 'posterior', 'iliac_crest', 'greater_trochanter', 'labrum', 'other'],
  groin: ['adductor_longus', 'iliopsoas', 'pubic_symphysis', 'inguinal_canal', 'other'],
  glute: ['gluteus_maximus', 'gluteus_medius', 'piriformis', 'ischial_tuberosity', 'other'],
  thigh: ['quadriceps', 'rectus_femoris', 'hamstring', 'biceps_femoris', 'semitendinosus', 'adductor', 'iliotibial_band', 'other'],
  knee: ['anterior', 'medial', 'lateral', 'posterior', 'patellar', 'patellar_tendon', 'meniscus_medial', 'meniscus_lateral', 'other'],
  lower_leg: ['anterior', 'medial', 'lateral', 'tibia', 'shin', 'other'],
  calf: ['gastrocnemius', 'soleus', 'medial_head', 'lateral_head', 'myotendinous_junction', 'other'],
  ankle: ['lateral', 'medial', 'achilles', 'anterior', 'syndesmosis', 'subtalar', 'other'],
  foot: ['heel', 'plantar_fascia', 'midfoot', 'forefoot', 'metatarsal', 'toes', 'other'],
  upper_arm: ['biceps', 'triceps', 'brachialis', 'other'],
  elbow: ['medial_epicondyle', 'lateral_epicondyle', 'posterior', 'olecranon', 'other'],
  forearm: ['anterior_flexor', 'posterior_extensor', 'radial', 'ulnar', 'other'],
  wrist_hand: ['wrist_dorsal', 'wrist_volar', 'thumb', 'fingers', 'palm', 'scaphoid', 'other']
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

export function parseBodyLocation(value?: string | null): { region: BodyRegionKey | null; subLocation: string } {
  if (!value) return { region: null, subLocation: '' };
  const [region, detail] = value.split(':');
  const validRegion = Object.prototype.hasOwnProperty.call(BODY_REGION_LABELS, region) ? (region as BodyRegionKey) : null;
  return { region: validRegion, subLocation: detail || '' };
}
