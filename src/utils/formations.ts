export type FormationType =
  | '1-4-4-2'
  | '1-4-3-3'
  | '1-4-2-3-1'
  | '1-4-1-4-1'
  | '1-3-5-2'
  | '1-3-4-3';

export interface FormationSlot {
  id: string;
  position: string;
  x: number; // 0 to 100 percentage across pitch width (left to right)
  y: number; // 0 to 100 percentage from opponent goal (0) to own goal (100)
}

export const PREDEFINED_FORMATIONS: Record<FormationType, { name: string; label: string; slots: FormationSlot[] }> = {
  '1-4-4-2': {
    name: '1-4-4-2',
    label: '1-4-4-2 (Classic Flat)',
    slots: [
      { id: 'gk', position: 'GK', x: 50, y: 90 },
      { id: 'lb', position: 'LB', x: 16, y: 72 },
      { id: 'lcb', position: 'CB', x: 38, y: 74 },
      { id: 'rcb', position: 'CB', x: 62, y: 74 },
      { id: 'rb', position: 'RB', x: 84, y: 72 },
      { id: 'lm', position: 'LM', x: 16, y: 46 },
      { id: 'lcm', position: 'CM', x: 38, y: 48 },
      { id: 'rcm', position: 'CM', x: 62, y: 48 },
      { id: 'rm', position: 'RM', x: 84, y: 46 },
      { id: 'lst', position: 'ST', x: 36, y: 20 },
      { id: 'rst', position: 'ST', x: 64, y: 20 }
    ]
  },
  '1-4-3-3': {
    name: '1-4-3-3',
    label: '1-4-3-3 (Single Pivot)',
    slots: [
      { id: 'gk', position: 'GK', x: 50, y: 90 },
      { id: 'lb', position: 'LB', x: 16, y: 72 },
      { id: 'lcb', position: 'CB', x: 38, y: 74 },
      { id: 'rcb', position: 'CB', x: 62, y: 74 },
      { id: 'rb', position: 'RB', x: 84, y: 72 },
      { id: 'cdm', position: 'CDM', x: 50, y: 56 },
      { id: 'lcm', position: 'CM', x: 32, y: 44 },
      { id: 'rcm', position: 'CM', x: 68, y: 44 },
      { id: 'lw', position: 'LW', x: 18, y: 22 },
      { id: 'st', position: 'ST', x: 50, y: 18 },
      { id: 'rw', position: 'RW', x: 82, y: 22 }
    ]
  },
  '1-4-2-3-1': {
    name: '1-4-2-3-1',
    label: '1-4-2-3-1 (Double Pivot)',
    slots: [
      { id: 'gk', position: 'GK', x: 50, y: 90 },
      { id: 'lb', position: 'LB', x: 16, y: 74 },
      { id: 'lcb', position: 'CB', x: 38, y: 76 },
      { id: 'rcb', position: 'CB', x: 62, y: 76 },
      { id: 'rb', position: 'RB', x: 84, y: 74 },
      { id: 'ldm', position: 'CDM', x: 36, y: 58 },
      { id: 'rdm', position: 'CDM', x: 64, y: 58 },
      { id: 'lam', position: 'LAM', x: 20, y: 38 },
      { id: 'cam', position: 'CAM', x: 50, y: 36 },
      { id: 'ram', position: 'RAM', x: 80, y: 38 },
      { id: 'st', position: 'ST', x: 50, y: 18 }
    ]
  },
  '1-4-1-4-1': {
    name: '1-4-1-4-1',
    label: '1-4-1-4-1 (Holding Mid)',
    slots: [
      { id: 'gk', position: 'GK', x: 50, y: 90 },
      { id: 'lb', position: 'LB', x: 16, y: 72 },
      { id: 'lcb', position: 'CB', x: 38, y: 74 },
      { id: 'rcb', position: 'CB', x: 62, y: 74 },
      { id: 'rb', position: 'RB', x: 84, y: 72 },
      { id: 'cdm', position: 'CDM', x: 50, y: 58 },
      { id: 'lm', position: 'LM', x: 16, y: 40 },
      { id: 'lcm', position: 'CM', x: 38, y: 42 },
      { id: 'rcm', position: 'CM', x: 62, y: 42 },
      { id: 'rm', position: 'RM', x: 84, y: 40 },
      { id: 'st', position: 'ST', x: 50, y: 18 }
    ]
  },
  '1-3-5-2': {
    name: '1-3-5-2',
    label: '1-3-5-2 (3 Center Backs & Wingbacks)',
    slots: [
      { id: 'gk', position: 'GK', x: 50, y: 90 },
      { id: 'lcb', position: 'CB', x: 26, y: 74 },
      { id: 'cb', position: 'CB', x: 50, y: 76 },
      { id: 'rcb', position: 'CB', x: 74, y: 74 },
      { id: 'lwb', position: 'LWB', x: 14, y: 50 },
      { id: 'lcm', position: 'CM', x: 36, y: 52 },
      { id: 'cam', position: 'CAM', x: 50, y: 44 },
      { id: 'rcm', position: 'CM', x: 64, y: 52 },
      { id: 'rwb', position: 'RWB', x: 86, y: 50 },
      { id: 'lst', position: 'ST', x: 36, y: 20 },
      { id: 'rst', position: 'ST', x: 64, y: 20 }
    ]
  },
  '1-3-4-3': {
    name: '1-3-4-3',
    label: '1-3-4-3 (Attacking 3-4-3)',
    slots: [
      { id: 'gk', position: 'GK', x: 50, y: 90 },
      { id: 'lcb', position: 'CB', x: 26, y: 74 },
      { id: 'cb', position: 'CB', x: 50, y: 76 },
      { id: 'rcb', position: 'CB', x: 74, y: 74 },
      { id: 'lm', position: 'LM', x: 16, y: 50 },
      { id: 'lcm', position: 'CM', x: 38, y: 52 },
      { id: 'rcm', position: 'CM', x: 62, y: 52 },
      { id: 'rm', position: 'RM', x: 84, y: 50 },
      { id: 'lw', position: 'LW', x: 20, y: 22 },
      { id: 'st', position: 'ST', x: 50, y: 18 },
      { id: 'rw', position: 'RW', x: 80, y: 22 }
    ]
  }
};

export const FORMATION_KEYS = Object.keys(PREDEFINED_FORMATIONS) as FormationType[];

/**
 * Get tactical category from position string
 */
export function getPositionCategory(position?: string | null): 'GK' | 'DEF' | 'MID' | 'FWD' | 'OTHER' {
  if (!position) return 'OTHER';
  const pos = position.toUpperCase().trim();
  if (pos === 'GK' || pos === 'POR') return 'GK';
  if (['CB', 'LB', 'RB', 'LWB', 'RWB', 'LCB', 'RCB', 'DF', 'DEF'].includes(pos)) return 'DEF';
  if (['CDM', 'CM', 'CAM', 'LAM', 'RAM', 'LM', 'RM', 'LDM', 'RDM', 'LCM', 'RCM', 'MF', 'MID', 'MC', 'MCD', 'MCO'].includes(pos)) return 'MID';
  if (['ST', 'CF', 'LW', 'RW', 'LST', 'RST', 'FW', 'FWD', 'DC', 'EXT', 'DEL'].includes(pos)) return 'FWD';
  return 'OTHER';
}

/**
 * Check if player position is compatible or recommended for a given slot
 */
export function isPositionCompatible(slotPosition: string, playerPosition?: string | null): boolean {
  if (!playerPosition) return true;
  const slotCat = getPositionCategory(slotPosition);
  const playerCat = getPositionCategory(playerPosition);
  return slotCat === playerCat;
}

/**
 * Calculate Euclidean distance between two percentage points on the pitch
 */
export function pitchDistance(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x1 - x2;
  const dy = y1 - y2;
  return Math.sqrt(dx * dx + dy * dy);
}

function stableStringHash(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index++) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

export function resolveStablePitchPosition(
  entry: { playerId: string; position?: string | null; pitchX?: number | null; pitchY?: number | null },
  slots: FormationSlot[]
): Pick<FormationSlot, 'x' | 'y' | 'position'> {
  if (typeof entry.pitchX === 'number' && typeof entry.pitchY === 'number') {
    return { x: entry.pitchX, y: entry.pitchY, position: entry.position || 'UTIL' };
  }

  const exactPositionSlots = slots.filter(
    (slot) => slot.position.toUpperCase() === (entry.position || '').toUpperCase()
  );
  const categorySlots = slots.filter(
    (slot) => getPositionCategory(slot.position) === getPositionCategory(entry.position)
  );
  const candidates = exactPositionSlots.length > 0
    ? exactPositionSlots
    : categorySlots.length > 0
      ? categorySlots
      : slots;
  const fallback = candidates[stableStringHash(entry.playerId) % candidates.length];
  return { x: fallback.x, y: fallback.y, position: fallback.position };
}

export function findSlotOccupant<TEntry extends { id: string; playerId: string; position?: string | null; pitchX?: number | null; pitchY?: number | null }>(
  slot: FormationSlot,
  starters: TEntry[],
  slots: FormationSlot[],
  excludedEntryId?: string | null
): TEntry | null {
  return starters.find((entry) => {
    if (entry.id === excludedEntryId) return false;
    const position = resolveStablePitchPosition(entry, slots);
    return pitchDistance(position.x, position.y, slot.x, slot.y) < 5;
  }) ?? null;
}

/**
 * Detect which formation best matches a set of coordinates and positions, or default to 1-4-3-3
 */
export function detectFormation(starters: Array<{ pitchX?: number | null; pitchY?: number | null; position?: string }>): FormationType {
  if (starters.length === 0) return '1-4-3-3';
  
  // 1. Check exact position signatures
  const positions = starters.map((s) => (s.position || '').toUpperCase().trim());
  const hasLAM = positions.includes('LAM') || positions.includes('RAM');
  const cdmsCount = positions.filter((p) => ['CDM', 'MCD', 'LDM', 'RDM'].includes(p)).length;
  const camsCount = positions.filter((p) => ['CAM', 'LAM', 'RAM', 'MCO'].includes(p)).length;
  const lmsCount = positions.filter((p) => ['LM', 'RM', 'MI', 'MD'].includes(p)).length;
  const lwCount = positions.filter((p) => ['LW', 'RW', 'EXT'].includes(p)).length;
  const stsCount = positions.filter((p) => ['ST', 'CF', 'LST', 'RST', 'DC', 'DEL'].includes(p)).length;
  const cbsCount = positions.filter((p) => ['CB', 'LCB', 'RCB', 'DFC'].includes(p)).length;
  const wingbacksCount = positions.filter((p) => ['LWB', 'RWB', 'CAI', 'CAD'].includes(p)).length;

  if (hasLAM || (cdmsCount >= 2 && camsCount >= 1)) {
    return '1-4-2-3-1';
  }
  if (stsCount >= 2 && (lmsCount >= 1 || positions.includes('LM') || positions.includes('RM'))) {
    return '1-4-4-2';
  }
  if (cbsCount >= 3 || wingbacksCount >= 2) {
    if (stsCount >= 2) return '1-3-5-2';
    if (lwCount >= 2 || stsCount >= 3) return '1-3-4-3';
    return '1-3-5-2';
  }
  if (cdmsCount >= 1 && lmsCount >= 2) {
    return '1-4-1-4-1';
  }
  if (lwCount >= 2) {
    return '1-4-3-3';
  }

  // 2. Proximity-based matching if coordinates are available
  const startersWithCoords = starters.filter((s) => typeof s.pitchX === 'number' && typeof s.pitchY === 'number');
  if (startersWithCoords.length >= 4) {
    let bestFormation: FormationType = '1-4-3-3';
    let minTotalDistance = Infinity;

    for (const key of FORMATION_KEYS) {
      const slots = PREDEFINED_FORMATIONS[key].slots;
      let totalDist = 0;
      for (const starter of startersWithCoords) {
        let minDist = Infinity;
        for (const slot of slots) {
          const d = pitchDistance(starter.pitchX!, starter.pitchY!, slot.x, slot.y);
          if (d < minDist) minDist = d;
        }
        totalDist += minDist;
      }
      if (totalDist < minTotalDistance) {
        minTotalDistance = totalDist;
        bestFormation = key;
      }
    }
    return bestFormation;
  }

  // Count defenders by position or Y >= 65
  const defenders = starters.filter(s => {
    const pos = (s.position || '').toUpperCase();
    if (['CB', 'LB', 'RB', 'LWB', 'RWB', 'LCB', 'RCB'].includes(pos)) return true;
    return typeof s.pitchY === 'number' && s.pitchY >= 65 && s.pitchY < 88;
  });

  const forwards = starters.filter(s => {
    const pos = (s.position || '').toUpperCase();
    if (['ST', 'CF', 'LW', 'RW', 'LST', 'RST'].includes(pos)) return true;
    return typeof s.pitchY === 'number' && s.pitchY <= 30;
  });

  if (defenders.length === 3) {
    if (forwards.length >= 3) return '1-3-4-3';
    return '1-3-5-2';
  }

  if (forwards.length === 3) return '1-4-3-3';
  if (forwards.length === 2) return '1-4-4-2';
  if (forwards.length === 1) {
    const attackingMids = starters.filter(s => {
      const pos = (s.position || '').toUpperCase();
      return ['CAM', 'LAM', 'RAM'].includes(pos) || (typeof s.pitchY === 'number' && s.pitchY > 30 && s.pitchY < 42);
    });
    if (attackingMids.length >= 2) return '1-4-2-3-1';
    return '1-4-1-4-1';
  }

  return '1-4-3-3';
}

