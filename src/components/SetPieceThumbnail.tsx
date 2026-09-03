import React from 'react';
import type { SetPieceDiagram } from '../types';

interface SetPieceThumbnailProps {
  diagram: SetPieceDiagram;
  className?: string;
}

const MARKER_COLOR: Record<string, string> = {
  player: '#0ea5e9',
  opponent: '#e11d48',
  ball: '#f8fafc'
};

/**
 * Miniature, data-driven preview of a saved tactical diagram (no hardcoded/mock imagery):
 * renders the same markers/arrows/zones/texts that make up the real saved board, scaled down.
 */
export const SetPieceThumbnail: React.FC<SetPieceThumbnailProps> = ({ diagram, className }) => {
  const isEmpty =
    diagram.markers.length === 0 && diagram.arrows.length === 0 && diagram.zones.length === 0 && diagram.texts.length === 0;

  return (
    <svg viewBox="0 0 150 100" className={className} role="img" aria-label="Set piece diagram preview">
      <rect x="0" y="0" width="150" height="100" fill="#065f46" />
      <rect x="1" y="1" width="148" height="98" fill="none" stroke="#ffffffaa" strokeWidth="0.6" />
      <line x1="75" y1="1" x2="75" y2="99" stroke="#ffffffaa" strokeWidth="0.5" />
      <circle cx="75" cy="50" r="9" fill="none" stroke="#ffffffaa" strokeWidth="0.5" />
      <rect x="1" y="22" width="15" height="56" fill="none" stroke="#ffffffaa" strokeWidth="0.5" />
      <rect x="134" y="22" width="15" height="56" fill="none" stroke="#ffffffaa" strokeWidth="0.5" />

      {diagram.zones.map((zone) => (
        <rect
          key={zone.id}
          x={zone.x}
          y={zone.y}
          width={zone.width}
          height={zone.height}
          fill="#22d3ee33"
          stroke="#22d3ee"
          strokeWidth="0.6"
          strokeDasharray="2 1.5"
        />
      ))}

      {diagram.arrows.map((arrow) => (
        <line
          key={arrow.id}
          x1={arrow.x1}
          y1={arrow.y1}
          x2={arrow.x2}
          y2={arrow.y2}
          stroke="#facc15"
          strokeWidth="1"
          strokeDasharray={arrow.style === 'pass' ? '3 2' : undefined}
        />
      ))}

      {diagram.texts.map((text) => (
        <text
          key={text.id}
          x={text.x}
          y={text.y}
          fontSize="5"
          fontWeight="700"
          fill="#ffffff"
          textAnchor="middle"
        >
          {text.content.slice(0, 12)}
        </text>
      ))}

      {diagram.markers.map((marker) => (
        <circle
          key={marker.id}
          cx={marker.x}
          cy={marker.y}
          r={marker.kind === 'ball' ? 1.6 : 2.6}
          fill={MARKER_COLOR[marker.kind] ?? '#0ea5e9'}
          stroke="#ffffff"
          strokeWidth="0.5"
        />
      ))}

      {isEmpty && (
        <text x="75" y="52" fontSize="6" fontWeight="700" fill="#ffffff99" textAnchor="middle">
          Empty diagram
        </text>
      )}
    </svg>
  );
};
