import React, { useId, useState } from 'react';
import { BODY_REGION_LABELS, type BodyMapView, type BodyRegionKey } from './bodyMapModel';

type RegionShape = {
  key: BodyRegionKey;
  label?: string;
  shape: 'ellipse' | 'rect';
  x: number;
  y: number;
  width: number;
  height: number;
  radius?: number;
};

const FRONT_REGIONS: RegionShape[] = [
  { key: 'head_face', shape: 'ellipse', x: 100, y: 28, width: 34, height: 40 },
  { key: 'neck', shape: 'rect', x: 91, y: 49, width: 18, height: 13, radius: 5 },
  { key: 'shoulder', label: 'Left shoulder', shape: 'ellipse', x: 72, y: 68, width: 32, height: 20 },
  { key: 'shoulder', label: 'Right shoulder', shape: 'ellipse', x: 128, y: 68, width: 32, height: 20 },
  { key: 'chest', shape: 'rect', x: 76, y: 65, width: 48, height: 42, radius: 16 },
  { key: 'abdomen', shape: 'rect', x: 81, y: 104, width: 38, height: 38, radius: 10 },
  { key: 'hip', shape: 'rect', x: 75, y: 139, width: 50, height: 23, radius: 10 },
  { key: 'groin', shape: 'ellipse', x: 100, y: 158, width: 25, height: 18 },
  { key: 'upper_arm', label: 'Left upper arm', shape: 'rect', x: 56, y: 78, width: 16, height: 48, radius: 8 },
  { key: 'upper_arm', label: 'Right upper arm', shape: 'rect', x: 128, y: 78, width: 16, height: 48, radius: 8 },
  { key: 'elbow', label: 'Left elbow', shape: 'ellipse', x: 63, y: 132, width: 18, height: 15 },
  { key: 'elbow', label: 'Right elbow', shape: 'ellipse', x: 137, y: 132, width: 18, height: 15 },
  { key: 'forearm', label: 'Left forearm', shape: 'rect', x: 48, y: 138, width: 15, height: 48, radius: 8 },
  { key: 'forearm', label: 'Right forearm', shape: 'rect', x: 137, y: 138, width: 15, height: 48, radius: 8 },
  { key: 'wrist_hand', label: 'Left wrist / hand', shape: 'ellipse', x: 52, y: 194, width: 22, height: 29 },
  { key: 'wrist_hand', label: 'Right wrist / hand', shape: 'ellipse', x: 148, y: 194, width: 22, height: 29 },
  { key: 'thigh', label: 'Left thigh', shape: 'rect', x: 76, y: 166, width: 21, height: 70, radius: 10 },
  { key: 'thigh', label: 'Right thigh', shape: 'rect', x: 103, y: 166, width: 21, height: 70, radius: 10 },
  { key: 'knee', label: 'Left knee', shape: 'ellipse', x: 86, y: 245, width: 22, height: 19 },
  { key: 'knee', label: 'Right knee', shape: 'ellipse', x: 114, y: 245, width: 22, height: 19 },
  { key: 'lower_leg', label: 'Left lower leg', shape: 'rect', x: 77, y: 255, width: 18, height: 67, radius: 8 },
  { key: 'lower_leg', label: 'Right lower leg', shape: 'rect', x: 105, y: 255, width: 18, height: 67, radius: 8 },
  { key: 'ankle', label: 'Left ankle', shape: 'rect', x: 77, y: 319, width: 18, height: 16, radius: 6 },
  { key: 'ankle', label: 'Right ankle', shape: 'rect', x: 105, y: 319, width: 18, height: 16, radius: 6 },
  { key: 'foot', label: 'Left foot', shape: 'ellipse', x: 82, y: 342, width: 31, height: 16 },
  { key: 'foot', label: 'Right foot', shape: 'ellipse', x: 118, y: 342, width: 31, height: 16 }
];

const BACK_REGIONS: RegionShape[] = FRONT_REGIONS.map((region) => {
  if (region.key === 'head_face') return { ...region, key: 'head_face', label: 'Head' };
  if (region.key === 'chest') return { ...region, key: 'upper_back', label: 'Upper back' };
  if (region.key === 'abdomen') return { ...region, key: 'lower_back', label: 'Lower back' };
  if (region.key === 'groin') return { ...region, key: 'glute', label: 'Glute' };
  if (region.key === 'thigh') return { ...region, label: region.label?.replace('thigh', 'hamstring') };
  if (region.key === 'lower_leg') return { ...region, key: 'calf', label: region.label?.replace('lower leg', 'calf') };
  return region;
});

type BodyMapProps = {
  value?: BodyRegionKey | null;
  onChange: (region: BodyRegionKey) => void;
  disabled?: boolean;
};

export function BodyMap({ value, onChange, disabled = false }: BodyMapProps) {
  const titleId = useId();
  const [view, setView] = useState<BodyMapView>('front');
  const regions = view === 'front' ? FRONT_REGIONS : BACK_REGIONS;

  const choose = (region: BodyRegionKey) => {
    if (!disabled) onChange(region);
  };

  return (
    <div className="w-full">
      <div className="mx-auto mb-4 grid w-full max-w-xs grid-cols-2 rounded-lg bg-slate-100 p-1" aria-label="Body view">
        {(['front', 'back'] as BodyMapView[]).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setView(item)}
            className={`min-h-10 rounded-md px-4 text-sm font-bold uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${view === item ? 'bg-white text-[#002142] shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            {item}
          </button>
        ))}
      </div>
      <svg viewBox="20 0 160 365" className="mx-auto block h-auto max-h-[520px] w-full max-w-sm" role="group" aria-labelledby={titleId}>
        <title id={titleId}>Interactive {view} body map</title>
        <path d="M100 12 C72 12 62 44 70 66 C50 72 43 93 43 122 L35 192 C34 208 47 218 57 204 L70 153 L69 319 C69 346 88 357 98 334 L100 246 L102 334 C112 357 131 346 131 319 L130 153 L143 204 C153 218 166 208 165 192 L157 122 C157 93 150 72 130 66 C138 44 128 12 100 12 Z" fill="#f1f5f9" stroke="#94a3b8" strokeWidth="2" />
        {regions.map((region, index) => {
          const selected = value === region.key;
          const common = {
            role: 'button',
            tabIndex: disabled ? -1 : 0,
            'aria-label': `Select ${region.label || BODY_REGION_LABELS[region.key]}`,
            'aria-pressed': selected,
            onClick: () => choose(region.key),
            onKeyDown: (event: React.KeyboardEvent<SVGElement>) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                choose(region.key);
              }
            },
            className: `cursor-pointer stroke-2 transition-colors focus:outline-none ${selected ? 'fill-rose-500 stroke-rose-800' : 'fill-sky-100 stroke-sky-500 hover:fill-emerald-200 hover:stroke-emerald-700 focus:fill-emerald-200 focus:stroke-emerald-800'}`
          };
          return region.shape === 'ellipse' ? (
            <ellipse key={`${region.key}-${index}`} cx={region.x} cy={region.y} rx={region.width / 2} ry={region.height / 2} {...common} />
          ) : (
            <rect key={`${region.key}-${index}`} x={region.x} y={region.y} width={region.width} height={region.height} rx={region.radius || 0} {...common} />
          );
        })}
      </svg>
    </div>
  );
}
