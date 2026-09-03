import type { SetPieceArrow, SetPieceDiagram, SetPieceMarker, SetPieceMarkerKind, SetPieceText, SetPieceZone } from '../types';

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
