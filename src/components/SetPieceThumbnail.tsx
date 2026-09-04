import React from 'react';
import type { SetPieceDiagram, SetPiecePlayType } from '../types';
import { getSetPieceVisualViewport, projectSetPieceDiagramForView, projectSetPiecePoint, projectSetPieceRectForView } from '../utils/setPieceDiagram';

interface SetPieceThumbnailProps {
  diagram: SetPieceDiagram;
  type?: SetPiecePlayType;
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
export const SetPieceThumbnail: React.FC<SetPieceThumbnailProps> = ({ diagram, type, className }) => {
  const visualViewport = getSetPieceVisualViewport(diagram, type);
  const visualDiagram = projectSetPieceDiagramForView(diagram, visualViewport);
  const toVisualPoint = (x: number, y: number) => ({
    x: projectSetPiecePoint(x, visualViewport.minX, visualViewport.maxX),
    y: projectSetPiecePoint(y, visualViewport.minY, visualViewport.maxY)
  });
  const fieldShapes = {
    halfwayX: projectSetPiecePoint(50, visualViewport.minX, visualViewport.maxX),
    center: toVisualPoint(50, 50),
    leftPenalty: projectSetPieceRectForView({ x: 0, y: 20, width: 22, height: 60 }, visualViewport),
    leftGoalArea: projectSetPieceRectForView({ x: 0, y: 34, width: 8, height: 32 }, visualViewport),
    leftGoal: projectSetPieceRectForView({ x: 0, y: 44, width: 2, height: 12 }, visualViewport),
    leftSpot: toVisualPoint(14, 50),
    rightPenalty: projectSetPieceRectForView({ x: 78, y: 20, width: 22, height: 60 }, visualViewport),
    rightGoalArea: projectSetPieceRectForView({ x: 92, y: 34, width: 8, height: 32 }, visualViewport),
    rightGoal: projectSetPieceRectForView({ x: 98, y: 44, width: 2, height: 12 }, visualViewport),
    rightSpot: toVisualPoint(86, 50)
  };
  const isEmpty =
    diagram.markers.length === 0 && diagram.arrows.length === 0 && diagram.zones.length === 0 && diagram.texts.length === 0;

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={className} role="img" aria-label="Set piece diagram preview">
      <rect x="0" y="0" width="100" height="100" fill="#065f46" />
      <rect x="1" y="1" width="98" height="98" fill="none" stroke="#ffffffaa" strokeWidth="0.7" />
      {fieldShapes.halfwayX >= 0 && fieldShapes.halfwayX <= 100 && <line x1={fieldShapes.halfwayX} y1="1" x2={fieldShapes.halfwayX} y2="99" stroke="#ffffff99" strokeWidth="0.45" />}
      {fieldShapes.center.x >= -10 && fieldShapes.center.x <= 110 && <circle cx={fieldShapes.center.x} cy={fieldShapes.center.y} r="6" fill="none" stroke="#ffffff99" strokeWidth="0.45" />}
      {[fieldShapes.leftPenalty, fieldShapes.rightPenalty].map((rect, index) => <rect key={`penalty-${index}`} x={rect.x} y={rect.y} width={rect.width} height={rect.height} fill="none" stroke="#ffffffaa" strokeWidth="0.7" />)}
      {[fieldShapes.leftGoalArea, fieldShapes.rightGoalArea].map((rect, index) => <rect key={`goal-area-${index}`} x={rect.x} y={rect.y} width={rect.width} height={rect.height} fill="none" stroke="#ffffffaa" strokeWidth="0.7" />)}
      {[fieldShapes.leftGoal, fieldShapes.rightGoal].map((rect, index) => <rect key={`goal-${index}`} x={rect.x} y={rect.y} width={rect.width} height={rect.height} fill="#ffffffdd" />)}
      {[fieldShapes.leftSpot, fieldShapes.rightSpot].map((point, index) => (
        point.x >= 0 && point.x <= 100 && point.y >= 0 && point.y <= 100 ? <circle key={`spot-${index}`} cx={point.x} cy={point.y} r="1" fill="#ffffffaa" /> : null
      ))}

      {visualDiagram.zones.map((zone) => (
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

      {visualDiagram.arrows.map((arrow) => (
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

      {visualDiagram.texts.map((text) => (
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

      {visualDiagram.markers.map((marker) => (
        <circle
          key={marker.id}
          cx={marker.x}
          cy={marker.y}
          r={marker.kind === 'ball' ? 2.2 : 3.4}
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
