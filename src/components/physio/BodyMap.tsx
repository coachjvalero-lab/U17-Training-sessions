import React, { useId, useState } from 'react';
import { BODY_REGION_LABELS, type BodyMapView, type BodyRegionKey } from './bodyMapModel';

type RegionShape = {
  key: BodyRegionKey;
  label?: string;
  path: string;
};

const FRONT_REGIONS: RegionShape[] = [
  { key: 'head_face', path: 'M100 10 C88 10 81 18 81 31 C81 43 88 53 100 56 C112 53 119 43 119 31 C119 18 112 10 100 10 Z' },
  { key: 'neck', path: 'M91 52 C94 56 106 56 109 52 L111 66 C106 72 94 72 89 66 Z' },
  { key: 'shoulder', label: 'Left shoulder', path: 'M89 64 C82 65 73 66 65 70 C59 73 56 78 55 84 L70 92 C74 82 80 76 91 74 Z' },
  { key: 'shoulder', label: 'Right shoulder', path: 'M111 64 C118 65 127 66 135 70 C141 73 144 78 145 84 L130 92 C126 82 120 76 109 74 Z' },
  { key: 'chest', path: 'M91 67 C95 70 105 70 109 67 C116 70 124 76 130 90 L126 110 C118 115 109 117 100 117 C91 117 82 115 74 110 L70 90 C76 76 84 70 91 67 Z' },
  { key: 'abdomen', path: 'M75 108 C82 113 90 115 100 115 C110 115 118 113 125 108 L122 143 C116 149 108 152 100 152 C92 152 84 149 78 143 Z' },
  { key: 'hip', path: 'M78 141 C84 147 92 150 100 150 C108 150 116 147 122 141 L129 161 C121 168 111 171 100 171 C89 171 79 168 71 161 Z' },
  { key: 'groin', path: 'M88 163 C92 166 96 168 100 168 C104 168 108 166 112 163 L108 181 L100 190 L92 181 Z' },
  { key: 'upper_arm', label: 'Left upper arm', path: 'M56 80 C50 84 48 92 47 101 L43 129 C43 137 47 142 53 141 C59 140 62 134 62 126 L68 91 C67 85 63 81 56 80 Z' },
  { key: 'upper_arm', label: 'Right upper arm', path: 'M144 80 C150 84 152 92 153 101 L157 129 C157 137 153 142 147 141 C141 140 138 134 138 126 L132 91 C133 85 137 81 144 80 Z' },
  { key: 'elbow', label: 'Left elbow', path: 'M43 128 C39 134 40 142 45 146 C50 150 57 146 59 139 C61 132 57 127 51 126 C48 126 45 127 43 128 Z' },
  { key: 'elbow', label: 'Right elbow', path: 'M157 128 C161 134 160 142 155 146 C150 150 143 146 141 139 C139 132 143 127 149 126 C152 126 155 127 157 128 Z' },
  { key: 'forearm', label: 'Left forearm', path: 'M42 143 C38 149 36 160 34 172 L31 193 C31 200 35 204 40 202 C45 199 47 193 48 186 L55 148 C51 144 47 142 42 143 Z' },
  { key: 'forearm', label: 'Right forearm', path: 'M158 143 C162 149 164 160 166 172 L169 193 C169 200 165 204 160 202 C155 199 153 193 152 186 L145 148 C149 144 153 142 158 143 Z' },
  { key: 'wrist_hand', label: 'Left wrist / hand', path: 'M31 190 C27 196 25 204 26 211 L29 224 C30 229 34 231 38 227 L42 219 L44 228 C45 231 49 230 50 226 L48 204 C44 198 39 193 31 190 Z' },
  { key: 'wrist_hand', label: 'Right wrist / hand', path: 'M169 190 C173 196 175 204 174 211 L171 224 C170 229 166 231 162 227 L158 219 L156 228 C155 231 151 230 150 226 L152 204 C156 198 161 193 169 190 Z' },
  { key: 'thigh', label: 'Left thigh', path: 'M72 158 C78 166 87 169 98 169 L96 213 C95 229 92 241 86 247 C78 246 73 241 72 232 L68 184 C67 174 68 165 72 158 Z' },
  { key: 'thigh', label: 'Right thigh', path: 'M128 158 C122 166 113 169 102 169 L104 213 C105 229 108 241 114 247 C122 246 127 241 128 232 L132 184 C133 174 132 165 128 158 Z' },
  { key: 'knee', label: 'Left knee', path: 'M74 239 C78 244 83 246 88 244 C94 246 97 252 95 260 C92 267 78 268 73 261 C70 255 70 247 74 239 Z' },
  { key: 'knee', label: 'Right knee', path: 'M126 239 C122 244 117 246 112 244 C106 246 103 252 105 260 C108 267 122 268 127 261 C130 255 130 247 126 239 Z' },
  { key: 'lower_leg', label: 'Left lower leg', path: 'M74 260 C80 266 89 266 95 260 L94 286 C93 299 91 313 89 325 L76 325 C73 309 70 291 70 277 C70 269 71 264 74 260 Z' },
  { key: 'lower_leg', label: 'Right lower leg', path: 'M126 260 C120 266 111 266 105 260 L106 286 C107 299 109 313 111 325 L124 325 C127 309 130 291 130 277 C130 269 129 264 126 260 Z' },
  { key: 'ankle', label: 'Left ankle', path: 'M76 322 C80 325 85 325 89 322 L91 337 C87 341 79 341 74 337 Z' },
  { key: 'ankle', label: 'Right ankle', path: 'M124 322 C120 325 115 325 111 322 L109 337 C113 341 121 341 126 337 Z' },
  { key: 'foot', label: 'Left foot', path: 'M74 335 C79 339 87 339 91 335 L94 346 C93 351 87 354 79 353 L67 351 C63 350 63 346 67 343 Z' },
  { key: 'foot', label: 'Right foot', path: 'M126 335 C121 339 113 339 109 335 L106 346 C107 351 113 354 121 353 L133 351 C137 350 137 346 133 343 Z' }
];

const BACK_REGIONS: RegionShape[] = FRONT_REGIONS.map((region) => {
  if (region.key === 'head_face') return { ...region, label: 'Head' };
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
        <path d="M100 8 C86 8 79 18 79 31 C79 42 83 50 89 56 L87 63 C78 64 68 66 61 70 C52 75 48 85 46 99 L40 128 C38 134 38 140 41 146 L32 188 C27 193 24 202 24 210 L28 225 C29 232 36 234 40 228 L43 222 L45 229 C47 234 53 231 52 225 L50 205 L57 150 C62 146 64 139 63 132 L70 99 L72 155 C67 166 65 176 66 186 L69 233 C69 243 70 251 72 260 C68 271 68 283 70 296 L74 326 L72 336 L65 342 C58 348 62 354 70 355 L82 357 C90 358 96 354 96 347 L96 333 C98 315 99 292 100 268 C101 292 102 315 104 333 L104 347 C104 354 110 358 118 357 L130 355 C138 354 142 348 135 342 L128 336 L126 326 L130 296 C132 283 132 271 128 260 C130 251 131 243 131 233 L134 186 C135 176 133 166 128 155 L130 99 L137 132 C136 139 138 146 143 150 L150 205 L148 225 C147 231 153 234 155 229 L157 222 L160 228 C164 234 171 232 172 225 L176 210 C176 202 173 193 168 188 L159 146 C162 140 162 134 160 128 L154 99 C152 85 148 75 139 70 C132 66 122 64 113 63 L111 56 C117 50 121 42 121 31 C121 18 114 8 100 8 Z" fill="#f8fafc" stroke="#94a3b8" strokeWidth="1.5" />
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
          return <path key={`${region.key}-${index}`} d={region.path} strokeLinejoin="round" {...common} />;
        })}
      </svg>
    </div>
  );
}
