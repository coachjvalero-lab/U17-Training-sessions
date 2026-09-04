import type { SetPieceArrow, SetPieceDiagram, SetPieceMarker, SetPieceMarkerKind, SetPiecePlayType, SetPieceText, SetPieceZone } from '../types';

export type SetPieceVisualViewport = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

const FULL_FIELD_VIEWPORT: SetPieceVisualViewport = { minX: 0, maxX: 100, minY: 0, maxY: 100 };
const LEFT_GOAL_VIEWPORT: SetPieceVisualViewport = { minX: 0, maxX: 64, minY: 10, maxY: 90 };
const RIGHT_GOAL_VIEWPORT: SetPieceVisualViewport = { minX: 36, maxX: 100, minY: 10, maxY: 90 };

function generateId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function addMarker(diagram: SetPieceDiagram, kind: SetPieceMarkerKind, x: number, y: number, label?: string): SetPieceDiagram {
  const marker: SetPieceMarker = { id: generateId(), kind, x, y, label };
  return { ...diagram, markers: [...diagram.markers, marker] };
}

export function moveMarker(diagram: SetPieceDiagram, id: string, x: number, y: number): SetPieceDiagram {
  return {
    ...diagram,
    markers: diagram.markers.map((marker) => (marker.id === id ? { ...marker, x, y } : marker))
  };
}

export function addArrow(diagram: SetPieceDiagram, x1: number, y1: number, x2: number, y2: number, style: SetPieceArrow['style'] = 'run'): SetPieceDiagram {
  const arrow: SetPieceArrow = { id: generateId(), x1, y1, x2, y2, style };
  return { ...diagram, arrows: [...diagram.arrows, arrow] };
}

export function addZone(diagram: SetPieceDiagram, x: number, y: number, width: number, height: number, label?: string): SetPieceDiagram {
  const zone: SetPieceZone = { id: generateId(), x, y, width: Math.abs(width), height: Math.abs(height), label };
  return { ...diagram, zones: [...diagram.zones, zone] };
}

export function addText(diagram: SetPieceDiagram, x: number, y: number, content: string): SetPieceDiagram {
  const text: SetPieceText = { id: generateId(), x, y, content };
  return { ...diagram, texts: [...diagram.texts, text] };
}

export function updateTextContent(diagram: SetPieceDiagram, id: string, content: string): SetPieceDiagram {
  return { ...diagram, texts: diagram.texts.map((text) => (text.id === id ? { ...text, content } : text)) };
}

/** Removes an element with the given id from whichever collection (markers/arrows/zones/texts) it belongs to. */
export function removeElement(diagram: SetPieceDiagram, id: string): SetPieceDiagram {
  return {
    markers: diagram.markers.filter((marker) => marker.id !== id),
    arrows: diagram.arrows.filter((arrow) => arrow.id !== id),
    zones: diagram.zones.filter((zone) => zone.id !== id),
    texts: diagram.texts.filter((text) => text.id !== id)
  };
}

export function countElements(diagram: SetPieceDiagram): number {
  return diagram.markers.length + diagram.arrows.length + diagram.zones.length + diagram.texts.length;
}

function clampViewportEdge(value: number): number {
  return Math.min(100, Math.max(0, value));
}

function getDiagramPoints(diagram: SetPieceDiagram): Array<{ x: number; y: number }> {
  return [
    ...diagram.markers.map((marker) => ({ x: marker.x, y: marker.y })),
    ...diagram.arrows.flatMap((arrow) => [{ x: arrow.x1, y: arrow.y1 }, { x: arrow.x2, y: arrow.y2 }]),
    ...diagram.zones.flatMap((zone) => [
      { x: zone.x, y: zone.y },
      { x: zone.x + zone.width, y: zone.y + zone.height }
    ]),
    ...diagram.texts.map((text) => ({ x: text.x, y: text.y }))
  ];
}

function isGoalAreaSetPiece(type?: SetPiecePlayType | null): boolean {
  return type === 'corner' || type === 'defensive_corner' || type === 'attacking_free_kick' || type === 'defensive_free_kick';
}

export function getSetPieceVisualViewport(diagram: SetPieceDiagram, type?: SetPiecePlayType | null): SetPieceVisualViewport {
  if (!isGoalAreaSetPiece(type)) return FULL_FIELD_VIEWPORT;

  const points = getDiagramPoints(diagram);
  const averageX = points.length > 0
    ? points.reduce((total, point) => total + point.x, 0) / points.length
    : 20;
  const base = averageX > 50 ? RIGHT_GOAL_VIEWPORT : LEFT_GOAL_VIEWPORT;

  if (points.length === 0) return base;

  const padding = 5;
  const minPointX = Math.min(...points.map((point) => point.x));
  const maxPointX = Math.max(...points.map((point) => point.x));
  const minPointY = Math.min(...points.map((point) => point.y));
  const maxPointY = Math.max(...points.map((point) => point.y));

  return {
    minX: clampViewportEdge(Math.min(base.minX, minPointX - padding)),
    maxX: clampViewportEdge(Math.max(base.maxX, maxPointX + padding)),
    minY: clampViewportEdge(Math.min(base.minY, minPointY - padding)),
    maxY: clampViewportEdge(Math.max(base.maxY, maxPointY + padding))
  };
}

export function projectSetPiecePoint(value: number, min: number, max: number): number {
  if (max <= min) return value;
  return ((value - min) / (max - min)) * 100;
}

export function unprojectSetPiecePoint(value: number, min: number, max: number): number {
  if (max <= min) return value;
  return min + (value / 100) * (max - min);
}

export function projectSetPieceDiagramForView(diagram: SetPieceDiagram, viewport: SetPieceVisualViewport): SetPieceDiagram {
  return {
    markers: diagram.markers.map((marker) => ({
      ...marker,
      x: projectSetPiecePoint(marker.x, viewport.minX, viewport.maxX),
      y: projectSetPiecePoint(marker.y, viewport.minY, viewport.maxY)
    })),
    arrows: diagram.arrows.map((arrow) => ({
      ...arrow,
      x1: projectSetPiecePoint(arrow.x1, viewport.minX, viewport.maxX),
      y1: projectSetPiecePoint(arrow.y1, viewport.minY, viewport.maxY),
      x2: projectSetPiecePoint(arrow.x2, viewport.minX, viewport.maxX),
      y2: projectSetPiecePoint(arrow.y2, viewport.minY, viewport.maxY)
    })),
    zones: diagram.zones.map((zone) => {
      const x1 = projectSetPiecePoint(zone.x, viewport.minX, viewport.maxX);
      const y1 = projectSetPiecePoint(zone.y, viewport.minY, viewport.maxY);
      const x2 = projectSetPiecePoint(zone.x + zone.width, viewport.minX, viewport.maxX);
      const y2 = projectSetPiecePoint(zone.y + zone.height, viewport.minY, viewport.maxY);
      return { ...zone, x: Math.min(x1, x2), y: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) };
    }),
    texts: diagram.texts.map((text) => ({
      ...text,
      x: projectSetPiecePoint(text.x, viewport.minX, viewport.maxX),
      y: projectSetPiecePoint(text.y, viewport.minY, viewport.maxY)
    }))
  };
}

export function projectSetPieceRectForView(
  rect: { x: number; y: number; width: number; height: number },
  viewport: SetPieceVisualViewport
): { x: number; y: number; width: number; height: number } {
  const x1 = projectSetPiecePoint(rect.x, viewport.minX, viewport.maxX);
  const y1 = projectSetPiecePoint(rect.y, viewport.minY, viewport.maxY);
  const x2 = projectSetPiecePoint(rect.x + rect.width, viewport.minX, viewport.maxX);
  const y2 = projectSetPiecePoint(rect.y + rect.height, viewport.minY, viewport.maxY);
  return { x: Math.min(x1, x2), y: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) };
}

export function unprojectSetPieceDiagramPoint(point: { x: number; y: number }, viewport: SetPieceVisualViewport): { x: number; y: number } {
  return {
    x: unprojectSetPiecePoint(point.x, viewport.minX, viewport.maxX),
    y: unprojectSetPiecePoint(point.y, viewport.minY, viewport.maxY)
  };
}
