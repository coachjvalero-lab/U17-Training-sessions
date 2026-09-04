import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addArrow,
  addMarker,
  addText,
  addZone,
  countElements,
  getSetPieceVisualViewport,
  moveMarker,
  projectSetPieceDiagramForView,
  removeElement,
  updateTextContent
} from './setPieceDiagram';
import { EMPTY_SET_PIECE_DIAGRAM } from '../types';

test('addMarker places a player/opponent/ball marker at the given coordinates', () => {
  const diagram = addMarker(EMPTY_SET_PIECE_DIAGRAM, 'player', 40, 60, 'P1');
  assert.equal(diagram.markers.length, 1);
  assert.equal(diagram.markers[0].kind, 'player');
  assert.equal(diagram.markers[0].x, 40);
  assert.equal(diagram.markers[0].y, 60);
});

test('moveMarker updates only the targeted marker position', () => {
  let diagram = addMarker(EMPTY_SET_PIECE_DIAGRAM, 'player', 10, 10);
  diagram = addMarker(diagram, 'opponent', 20, 20);
  const [first, second] = diagram.markers;

  diagram = moveMarker(diagram, first.id, 55, 65);

  assert.deepEqual({ x: diagram.markers[0].x, y: diagram.markers[0].y }, { x: 55, y: 65 });
  assert.deepEqual({ x: diagram.markers[1].x, y: diagram.markers[1].y }, { x: second.x, y: second.y });
});

test('addArrow records start/end positions for a movement/run arrow', () => {
  const diagram = addArrow(EMPTY_SET_PIECE_DIAGRAM, 5, 5, 90, 40, 'run');
  assert.equal(diagram.arrows.length, 1);
  assert.deepEqual(
    { x1: diagram.arrows[0].x1, y1: diagram.arrows[0].y1, x2: diagram.arrows[0].x2, y2: diagram.arrows[0].y2 },
    { x1: 5, y1: 5, x2: 90, y2: 40 }
  );
});

test('addZone stores a normalized rectangle', () => {
  const diagram = addZone(EMPTY_SET_PIECE_DIAGRAM, 10, 10, 20, 30, 'Zonal marking');
  assert.equal(diagram.zones.length, 1);
  assert.equal(diagram.zones[0].width, 20);
  assert.equal(diagram.zones[0].height, 30);
});

test('addText and updateTextContent manage text annotations', () => {
  let diagram = addText(EMPTY_SET_PIECE_DIAGRAM, 50, 50, 'Near post run');
  assert.equal(diagram.texts[0].content, 'Near post run');

  diagram = updateTextContent(diagram, diagram.texts[0].id, 'Far post run');
  assert.equal(diagram.texts[0].content, 'Far post run');
});

test('removeElement deletes an element from whichever collection it belongs to', () => {
  let diagram = addMarker(EMPTY_SET_PIECE_DIAGRAM, 'player', 10, 10);
  diagram = addArrow(diagram, 0, 0, 50, 50);
  diagram = addZone(diagram, 0, 0, 10, 10);
  diagram = addText(diagram, 20, 20, 'Note');
  assert.equal(countElements(diagram), 4);

  const arrowId = diagram.arrows[0].id;
  diagram = removeElement(diagram, arrowId);

  assert.equal(countElements(diagram), 3);
  assert.equal(diagram.arrows.length, 0);
});

test('a full create/place/move/annotate/delete workflow behaves as expected end to end', () => {
  let diagram = EMPTY_SET_PIECE_DIAGRAM;
  diagram = addMarker(diagram, 'player', 50, 90, 'Taker');
  diagram = addMarker(diagram, 'opponent', 45, 10);
  diagram = addArrow(diagram, 50, 90, 45, 15, 'run');
  diagram = addZone(diagram, 30, 5, 40, 20, 'Danger zone');
  diagram = addText(diagram, 50, 95, 'Corner routine');

  assert.equal(countElements(diagram), 5);

  const takerId = diagram.markers[0].id;
  diagram = moveMarker(diagram, takerId, 52, 92);
  assert.equal(diagram.markers[0].x, 52);

  diagram = removeElement(diagram, diagram.zones[0].id);
  assert.equal(diagram.zones.length, 0);
  assert.equal(countElements(diagram), 4);
});

test('corner diagrams project into a zoomed goal-area view without mutating saved coordinates', () => {
  let diagram = EMPTY_SET_PIECE_DIAGRAM;
  diagram = addMarker(diagram, 'player', 8, 46, 'Near post');
  diagram = addMarker(diagram, 'opponent', 18, 52, 'Defender');
  diagram = addArrow(diagram, 4, 6, 18, 50, 'pass');

  const originalFirstMarker = { ...diagram.markers[0] };
  const viewport = getSetPieceVisualViewport(diagram, 'corner');
  const visualDiagram = projectSetPieceDiagramForView(diagram, viewport);

  assert.deepEqual(diagram.markers[0], originalFirstMarker);
  assert.equal(viewport.minX, 0);
  assert.ok(viewport.maxX < 100);
  assert.ok(visualDiagram.markers[1].x > diagram.markers[1].x);
});

test('zoomed set piece viewport expands enough to keep distant markers visible', () => {
  let diagram = EMPTY_SET_PIECE_DIAGRAM;
  diagram = addMarker(diagram, 'player', 8, 45);
  diagram = addMarker(diagram, 'player', 82, 60);

  const viewport = getSetPieceVisualViewport(diagram, 'defensive_corner');
  const visualDiagram = projectSetPieceDiagramForView(diagram, viewport);

  assert.ok(viewport.maxX >= 87);
  assert.ok(visualDiagram.markers.every((marker) => marker.x >= 0 && marker.x <= 100 && marker.y >= 0 && marker.y <= 100));
});
