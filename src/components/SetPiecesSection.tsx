import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus,
  Save,
  Trash2,
  MousePointer2,
  User,
  UserX,
  Circle,
  ArrowUpRight,
  Square,
  Type,
  Eraser,
  Edit3,
  ChevronLeft
} from 'lucide-react';
import type { SetPieceDiagram, SetPieceMarkerKind, SetPiecePlay, SetPiecePlayType } from '../types';
import { EMPTY_SET_PIECE_DIAGRAM, SET_PIECE_PLAY_TYPES } from '../types';
import { SetPieceThumbnail } from './SetPieceThumbnail';
import {
  createSetPiecePlay,
  deleteSetPiecePlay,
  getSetPiecePlays,
  updateSetPiecePlay
} from '../services/matches/setPiecePlaysService';
import {
  addArrow,
  addMarker,
  addText,
  addZone,
  getSetPieceVisualViewport,
  moveMarker,
  projectSetPieceDiagramForView,
  projectSetPieceRectForView,
  projectSetPiecePoint,
  removeElement,
  unprojectSetPieceDiagramPoint,
  updateTextContent
} from '../utils/setPieceDiagram';

type Tool = 'select' | 'player' | 'opponent' | 'ball' | 'arrow' | 'zone' | 'text' | 'delete';

const TOOLS: Array<{ id: Tool; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'select', label: 'Select', icon: MousePointer2 },
  { id: 'player', label: 'Player', icon: User },
  { id: 'opponent', label: 'Opponent', icon: UserX },
  { id: 'ball', label: 'Ball', icon: Circle },
  { id: 'arrow', label: 'Arrow', icon: ArrowUpRight },
  { id: 'zone', label: 'Zone', icon: Square },
  { id: 'text', label: 'Text', icon: Type },
  { id: 'delete', label: 'Delete', icon: Eraser }
];

const TYPE_LABEL: Record<SetPiecePlayType, string> = Object.fromEntries(
  SET_PIECE_PLAY_TYPES.map((option) => [option.value, option.label])
) as Record<SetPiecePlayType, string>;

function clampPercent(value: number): number {
  return Math.min(98, Math.max(2, value));
}

interface SetPiecesSectionProps {
  matchId: string;
}

export const SetPiecesSection: React.FC<SetPiecesSectionProps> = ({ matchId }) => {
  const pitchRef = useRef<HTMLDivElement | null>(null);
  const [plays, setPlays] = useState<SetPiecePlay[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [editingPlayId, setEditingPlayId] = useState<string | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<SetPiecePlayType>('corner');
  const [description, setDescription] = useState('');
  const [coachingPoints, setCoachingPoints] = useState('');
  const [diagram, setDiagram] = useState<SetPieceDiagram>(EMPTY_SET_PIECE_DIAGRAM);

  const [activeTool, setActiveTool] = useState<Tool>('select');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draggingMarkerId, setDraggingMarkerId] = useState<string | null>(null);
  const [drawingArrow, setDrawingArrow] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [drawingZone, setDrawingZone] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [textDraft, setTextDraft] = useState<{ x: number; y: number; value: string } | null>(null);

  const loadPlays = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const list = await getSetPiecePlays(matchId);
      setPlays(list);
    } catch (err) {
      console.error('[SetPiecesSection] Failed loading set piece plays', err);
      setError(err instanceof Error ? err.message : 'Unable to load saved set pieces.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadPlays();
    setIsEditorOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  const resetDraft = () => {
    setEditingPlayId(null);
    setTitle('');
    setType('corner');
    setDescription('');
    setCoachingPoints('');
    setDiagram(EMPTY_SET_PIECE_DIAGRAM);
    setActiveTool('select');
    setSelectedId(null);
  };

  const openNewPlay = () => {
    resetDraft();
    setIsEditorOpen(true);
  };

  const openExistingPlay = (play: SetPiecePlay) => {
    setEditingPlayId(play.id);
    setTitle(play.title);
    setType(play.type);
    setDescription(play.description);
    setCoachingPoints(play.coachingPoints);
    setDiagram(play.diagram);
    setActiveTool('select');
    setSelectedId(null);
    setIsEditorOpen(true);
  };

  const closeEditor = () => {
    setIsEditorOpen(false);
    resetDraft();
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setError('Please enter a title for this set piece.');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      if (editingPlayId) {
        await updateSetPiecePlay(editingPlayId, { title: title.trim(), type, diagram, description, coachingPoints });
      } else {
        await createSetPiecePlay({ matchId, title: title.trim(), type, diagram, description, coachingPoints });
      }
      await loadPlays();
      closeEditor();
    } catch (err) {
      console.error('[SetPiecesSection] Failed saving set piece play', err);
      setError(err instanceof Error ? err.message : 'Unable to save this set piece.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePlay = async (playId: string) => {
    if (!window.confirm('Delete this saved set piece? This cannot be undone.')) return;
    try {
      await deleteSetPiecePlay(playId);
      await loadPlays();
      if (editingPlayId === playId) closeEditor();
    } catch (err) {
      console.error('[SetPiecesSection] Failed deleting set piece play', err);
      setError(err instanceof Error ? err.message : 'Unable to delete this set piece.');
    }
  };

  const pointFromEvent = (event: React.PointerEvent | React.MouseEvent): { x: number; y: number } => {
    const el = pitchRef.current;
    if (!el) return { x: 50, y: 50 };
    const rect = el.getBoundingClientRect();
    const x = clampPercent(((event.clientX - rect.left) / rect.width) * 100);
    const y = clampPercent(((event.clientY - rect.top) / rect.height) * 100);
    return unprojectSetPieceDiagramPoint({ x, y }, visualViewport);
  };

  const findElementIdAtEvent = (event: React.PointerEvent<HTMLDivElement>): string | null => {
    const target = event.target as HTMLElement;
    const marked = target.closest('[data-element-id]') as HTMLElement | null;
    return marked?.dataset.elementId ?? null;
  };

  const handlePitchPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const clickedElementId = findElementIdAtEvent(event);
    const point = pointFromEvent(event);

    if (activeTool === 'delete') {
      if (clickedElementId) {
        setDiagram((current) => removeElement(current, clickedElementId));
        if (selectedId === clickedElementId) setSelectedId(null);
      }
      return;
    }

    if (clickedElementId) {
      // Existing element: select it, and if it's a marker, start dragging it.
      setSelectedId(clickedElementId);
      const isMarker = diagram.markers.some((marker) => marker.id === clickedElementId);
      if (isMarker && activeTool === 'select') {
        setDraggingMarkerId(clickedElementId);
      }
      return;
    }

    setSelectedId(null);

    switch (activeTool) {
      case 'player':
        setDiagram((current) => addMarker(current, 'player', point.x, point.y));
        return;
      case 'opponent':
        setDiagram((current) => addMarker(current, 'opponent', point.x, point.y));
        return;
      case 'ball':
        setDiagram((current) => addMarker(current, 'ball', point.x, point.y));
        return;
      case 'arrow':
        setDrawingArrow({ x1: point.x, y1: point.y, x2: point.x, y2: point.y });
        return;
      case 'zone':
        setDrawingZone({ x1: point.x, y1: point.y, x2: point.x, y2: point.y });
        return;
      case 'text':
        setTextDraft({ x: point.x, y: point.y, value: '' });
        return;
      default:
        return;
    }
  };

  const handlePitchPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const point = pointFromEvent(event);
    if (draggingMarkerId) {
      setDiagram((current) => moveMarker(current, draggingMarkerId, point.x, point.y));
      return;
    }
    if (drawingArrow) {
      setDrawingArrow((current) => (current ? { ...current, x2: point.x, y2: point.y } : current));
      return;
    }
    if (drawingZone) {
      setDrawingZone((current) => (current ? { ...current, x2: point.x, y2: point.y } : current));
    }
  };

  const handlePitchPointerUp = () => {
    if (draggingMarkerId) {
      setDraggingMarkerId(null);
      return;
    }
    if (drawingArrow) {
      const { x1, y1, x2, y2 } = drawingArrow;
      if (Math.abs(x2 - x1) > 1 || Math.abs(y2 - y1) > 1) {
        setDiagram((current) => addArrow(current, x1, y1, x2, y2, 'run'));
      }
      setDrawingArrow(null);
      return;
    }
    if (drawingZone) {
      const { x1, y1, x2, y2 } = drawingZone;
      if (Math.abs(x2 - x1) > 1 && Math.abs(y2 - y1) > 1) {
        setDiagram((current) => addZone(current, Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1)));
      }
      setDrawingZone(null);
    }
  };

  const commitTextDraft = () => {
    if (textDraft && textDraft.value.trim()) {
      setDiagram((current) => addText(current, textDraft.x, textDraft.y, textDraft.value.trim()));
    }
    setTextDraft(null);
  };

  const handleDeleteSelected = () => {
    if (!selectedId) return;
    setDiagram((current) => removeElement(current, selectedId));
    setSelectedId(null);
  };

  const markerStyle = (kind: SetPieceMarkerKind) => {
    if (kind === 'opponent') return 'bg-rose-600 border-white text-white';
    if (kind === 'ball') return 'bg-white border-slate-900 text-slate-900';
    return 'bg-sky-500 border-white text-white';
  };

  const selectedTextValue = useMemo(
    () => diagram.texts.find((text) => text.id === selectedId)?.content ?? null,
    [diagram.texts, selectedId]
  );
  const visualViewport = useMemo(() => getSetPieceVisualViewport(diagram, type), [diagram, type]);
  const visualDiagram = useMemo(() => projectSetPieceDiagramForView(diagram, visualViewport), [diagram, visualViewport]);
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
  const drawingZonePreview = drawingZone
    ? projectSetPieceRectForView({
        x: Math.min(drawingZone.x1, drawingZone.x2),
        y: Math.min(drawingZone.y1, drawingZone.y2),
        width: Math.abs(drawingZone.x2 - drawingZone.x1),
        height: Math.abs(drawingZone.y2 - drawingZone.y1)
      }, visualViewport)
    : null;

  if (isEditorOpen) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={closeEditor}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Back to Set Pieces</span>
            </button>
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Title, e.g. Corner - Near Post"
                className="w-56 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-900 outline-none focus:border-sky-600 focus:bg-white"
              />
              <select
                value={type}
                onChange={(event) => setType(event.target.value as SetPiecePlayType)}
                className="w-48 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-sky-600"
              >
                {SET_PIECE_PLAY_TYPES.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-xl bg-[#002142] px-4 py-2 text-xs font-black text-white hover:bg-[#09355e] disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            <span>{isSaving ? 'Saving...' : 'Save Set Piece'}</span>
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">{error}</div>
        )}

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-slate-200 bg-slate-50 p-2">
          {TOOLS.map((tool) => {
            const Icon = tool.icon;
            const isActive = activeTool === tool.id;
            return (
              <button
                key={tool.id}
                type="button"
                onClick={() => setActiveTool(tool.id)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-black transition ${
                  isActive ? 'bg-[#002142] text-white shadow-sm' : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                }`}
                title={tool.label}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tool.label}</span>
              </button>
            );
          })}
          <div className="ml-auto flex items-center gap-1.5">
            {selectedTextValue !== null && (
              <input
                value={selectedTextValue}
                onChange={(event) => setDiagram((current) => updateTextContent(current, selectedId as string, event.target.value))}
                className="w-40 rounded-lg border border-sky-300 bg-white px-2 py-1.5 text-xs font-bold text-slate-900 outline-none"
                placeholder="Edit label text"
              />
            )}
            <button
              type="button"
              onClick={handleDeleteSelected}
              disabled={!selectedId}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Delete Selected</span>
            </button>
          </div>
        </div>

        {/* Tactical Board + Notes */}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div
            ref={pitchRef}
            onPointerDown={handlePitchPointerDown}
            onPointerMove={handlePitchPointerMove}
            onPointerUp={handlePitchPointerUp}
            className="relative mx-auto aspect-[3/2] w-full select-none touch-none overflow-visible rounded-2xl border-4 border-slate-800/20 bg-gradient-to-b from-emerald-800 to-emerald-900 shadow-xl"
          >
          <div className="pointer-events-none absolute inset-3 overflow-hidden rounded-xl">
            <svg className="h-full w-full text-white/75" viewBox="0 0 100 100" preserveAspectRatio="none">
              <rect x="0" y="0" width="100" height="100" fill="none" stroke="currentColor" strokeWidth="0.8" />
              {fieldShapes.halfwayX >= 0 && fieldShapes.halfwayX <= 100 && (
                <line x1={fieldShapes.halfwayX} y1="0" x2={fieldShapes.halfwayX} y2="100" stroke="currentColor" strokeWidth="0.55" />
              )}
              {fieldShapes.center.x >= -10 && fieldShapes.center.x <= 110 && fieldShapes.center.y >= -10 && fieldShapes.center.y <= 110 && (
                <circle cx={fieldShapes.center.x} cy={fieldShapes.center.y} r="7" fill="none" stroke="currentColor" strokeWidth="0.55" />
              )}
              {[fieldShapes.leftPenalty, fieldShapes.rightPenalty].map((rect, index) => (
                <rect key={`penalty-${index}`} x={rect.x} y={rect.y} width={rect.width} height={rect.height} fill="none" stroke="currentColor" strokeWidth="0.8" />
              ))}
              {[fieldShapes.leftGoalArea, fieldShapes.rightGoalArea].map((rect, index) => (
                <rect key={`goal-area-${index}`} x={rect.x} y={rect.y} width={rect.width} height={rect.height} fill="none" stroke="currentColor" strokeWidth="0.8" />
              ))}
              {[fieldShapes.leftGoal, fieldShapes.rightGoal].map((rect, index) => (
                <rect key={`goal-${index}`} x={rect.x} y={rect.y} width={rect.width} height={rect.height} fill="rgba(255,255,255,0.9)" />
              ))}
              {[fieldShapes.leftSpot, fieldShapes.rightSpot].map((point, index) => (
                point.x >= 0 && point.x <= 100 && point.y >= 0 && point.y <= 100
                  ? <circle key={`spot-${index}`} cx={point.x} cy={point.y} r="1.1" fill="currentColor" />
                  : null
              ))}
            </svg>
          </div>

          {/* Zones */}
          {visualDiagram.zones.map((zone) => (
            <div
              key={zone.id}
              data-element-id={zone.id}
              style={{ left: `${zone.x}%`, top: `${zone.y}%`, width: `${zone.width}%`, height: `${zone.height}%` }}
              className={`absolute rounded-md border-2 border-dashed ${selectedId === zone.id ? 'border-amber-300 bg-amber-300/20' : 'border-cyan-300/80 bg-cyan-300/10'}`}
            />
          ))}

          {/* Arrows (saved) */}
          <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
            <defs>
              <marker id="setpiece-arrowhead" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="#facc15" />
              </marker>
            </defs>
            {visualDiagram.arrows.map((arrow) => (
              <line
                key={arrow.id}
                x1={`${arrow.x1}%`}
                y1={`${arrow.y1}%`}
                x2={`${arrow.x2}%`}
                y2={`${arrow.y2}%`}
                stroke={selectedId === arrow.id ? '#fde047' : '#facc15'}
                strokeWidth={selectedId === arrow.id ? 3 : 2.2}
                strokeDasharray={arrow.style === 'pass' ? '6 4' : undefined}
                markerEnd="url(#setpiece-arrowhead)"
                className="pointer-events-auto cursor-pointer"
                data-element-id={arrow.id}
              />
            ))}
            {drawingArrow && (
              <line
                x1={`${projectSetPiecePoint(drawingArrow.x1, visualViewport.minX, visualViewport.maxX)}%`}
                y1={`${projectSetPiecePoint(drawingArrow.y1, visualViewport.minY, visualViewport.maxY)}%`}
                x2={`${projectSetPiecePoint(drawingArrow.x2, visualViewport.minX, visualViewport.maxX)}%`}
                y2={`${projectSetPiecePoint(drawingArrow.y2, visualViewport.minY, visualViewport.maxY)}%`}
                stroke="#fde047"
                strokeWidth={2}
                strokeDasharray="4 4"
              />
            )}
          </svg>

          {/* Zone being drawn (preview) */}
          {drawingZonePreview && (
            <div
              style={{
                left: `${drawingZonePreview.x}%`,
                top: `${drawingZonePreview.y}%`,
                width: `${drawingZonePreview.width}%`,
                height: `${drawingZonePreview.height}%`
              }}
              className="pointer-events-none absolute rounded-md border-2 border-dashed border-cyan-200 bg-cyan-200/10"
            />
          )}

          {/* Text annotations */}
          {visualDiagram.texts.map((text) => (
            <div
              key={text.id}
              data-element-id={text.id}
              style={{ left: `${text.x}%`, top: `${text.y}%` }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-md px-2 py-0.5 text-[11px] font-black shadow-sm ${
                selectedId === text.id ? 'bg-amber-300 text-slate-950' : 'bg-slate-950/85 text-white'
              }`}
            >
              {text.content}
            </div>
          ))}

          {/* Pending text input */}
          {textDraft && (
            <div
              style={{
                left: `${projectSetPiecePoint(textDraft.x, visualViewport.minX, visualViewport.maxX)}%`,
                top: `${projectSetPiecePoint(textDraft.y, visualViewport.minY, visualViewport.maxY)}%`
              }}
              className="absolute z-20 -translate-x-1/2 -translate-y-1/2"
            >
              <input
                autoFocus
                value={textDraft.value}
                onChange={(event) => setTextDraft((current) => (current ? { ...current, value: event.target.value } : current))}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') commitTextDraft();
                  if (event.key === 'Escape') setTextDraft(null);
                }}
                onBlur={commitTextDraft}
                placeholder="Label..."
                className="w-32 rounded-md border-2 border-amber-300 bg-white px-2 py-1 text-xs font-bold text-slate-900 shadow-lg outline-none"
              />
            </div>
          )}

          {/* Markers */}
          {visualDiagram.markers.map((marker) => (
            <div
              key={marker.id}
              data-element-id={marker.id}
              style={{ left: `${marker.x}%`, top: `${marker.y}%` }}
              className={`absolute flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 cursor-grab items-center justify-center rounded-full border-2 text-[10px] font-black shadow-md active:cursor-grabbing ${markerStyle(marker.kind)} ${
                selectedId === marker.id ? 'ring-4 ring-amber-300' : ''
              }`}
            >
              {marker.kind === 'ball' ? <Circle className="h-3.5 w-3.5" /> : marker.kind === 'opponent' ? 'X' : 'P'}
            </div>
          ))}
          </div>

          <div className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">Description</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Describe the routine and player responsibilities..."
                className="min-h-[140px] w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">Coaching Points</span>
              <textarea
                value={coachingPoints}
                onChange={(event) => setCoachingPoints(event.target.value)}
                placeholder="Key coaching points, triggers, timing..."
                className="min-h-[140px] w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm"
              />
            </label>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-sky-700">Dead-ball tactics</p>
          <h3 className="text-lg font-black text-slate-950">Set Pieces</h3>
        </div>
        <button
          type="button"
          onClick={openNewPlay}
          className="inline-flex items-center gap-2 rounded-xl bg-[#002142] px-4 py-2 text-xs font-black text-white hover:bg-[#09355e]"
        >
          <Plus className="h-4 w-4" />
          <span>New Set Piece</span>
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">{error}</div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="mb-3 text-[10px] font-black uppercase tracking-wider text-slate-500">Saved Set Pieces</p>
        {isLoading ? (
          <p className="py-6 text-center text-xs font-bold text-slate-400">Loading...</p>
        ) : plays.length === 0 ? (
          <p className="py-6 text-center text-xs font-bold text-slate-400">No set pieces saved yet for this match.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {plays.map((play) => (
              <div key={play.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-md">
                <button type="button" onClick={() => openExistingPlay(play)} className="block w-full">
                  <SetPieceThumbnail diagram={play.diagram} className="aspect-[3/2] w-full" />
                </button>
                <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                  <button type="button" onClick={() => openExistingPlay(play)} className="min-w-0 flex-1 text-left">
                    <p className="truncate text-xs font-black text-slate-900">{play.title || 'Untitled'}</p>
                    <p className="text-[10px] font-bold uppercase text-slate-500">{TYPE_LABEL[play.type] || play.type}</p>
                  </button>
                  <div className="flex shrink-0 items-center gap-1">
                    <button type="button" onClick={() => openExistingPlay(play)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700" title="Edit">
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => void handleDeletePlay(play.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-100 hover:text-rose-700" title="Delete">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
