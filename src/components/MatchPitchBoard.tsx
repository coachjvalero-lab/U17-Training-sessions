import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { 
  Users, 
  X, 
  Edit3, 
  ArrowRightLeft, 
  RotateCcw, 
  Move,
  ChevronDown,
  Sparkles,
  GripVertical
} from 'lucide-react';
import { MatchLineupEntry } from '../types';
import { CloudSquadPlayer } from '../services/squad/squadService';
import type { ExistingMatchLineupEntryUpdate } from '../services/matches/matchLineupService';
import { PlayerPitchAvatar } from './PlayerPitchAvatar';
import { 
  FormationType, 
  FormationSlot, 
  PREDEFINED_FORMATIONS, 
  FORMATION_KEYS, 
  getPositionCategory,
  isPositionCompatible,
  pitchDistance,
  detectFormation,
  findSlotOccupant,
  resolveStablePitchPosition
} from '../utils/formations';

interface MatchPitchBoardProps {
  matchId: string;
  lineupEntries: MatchLineupEntry[];
  calledUpPlayers: CloudSquadPlayer[];
  onUpdateLineupEntry: (entry: ExistingMatchLineupEntryUpdate) => Promise<void>;
  onBatchUpdateLineupEntries: (entries: ExistingMatchLineupEntryUpdate[]) => Promise<void>;
  onOpenEditModal: (entry: MatchLineupEntry) => void;
  saveStatus?: { state: 'idle' | 'saving' | 'saved' | 'error'; message?: string };
}

export const MatchPitchBoard: React.FC<MatchPitchBoardProps> = ({
  matchId,
  lineupEntries,
  calledUpPlayers,
  onUpdateLineupEntry,
  onBatchUpdateLineupEntries,
  onOpenEditModal,
  saveStatus
}) => {
  const pitchRef = useRef<HTMLDivElement | null>(null);
  const initializedFormationMatchRef = useRef<string | null>(null);
  const [selectedFormation, setSelectedFormation] = useState<FormationType>(() => {
    if (typeof window !== 'undefined' && matchId) {
      const saved = localStorage.getItem(`tactical_formation_${matchId}`);
      if (saved && FORMATION_KEYS.includes(saved as FormationType)) {
        return saved as FormationType;
      }
    }
    const currentStarters = lineupEntries.filter((e) => e.starter);
    return detectFormation(currentStarters);
  });
  const [activeSlotModal, setActiveSlotModal] = useState<FormationSlot | null>(null);
  const [activeTokenMenuId, setActiveTokenMenuId] = useState<string | null>(null);
  const [draggedSubstituteId, setDraggedSubstituteId] = useState<string | null>(null);
  const [highlightedSlotId, setHighlightedSlotId] = useState<string | null>(null);

  // Dragging state for pointer drag
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoverTargetId, setHoverTargetId] = useState<string | null>(null);
  const isDraggingRef = useRef(false);
  const activeDragIdRef = useRef<string | null>(null);

    // Drag coordinates stored in ref to avoid re-renders during pointer movement
    const dragCoordsRef = useRef<{ x: number; y: number } | null>(null);

  const starters = useMemo(() => lineupEntries.filter((e) => e.starter), [lineupEntries]);
  const substitutes = useMemo(() => lineupEntries.filter((e) => !e.starter), [lineupEntries]);

  // Formation is the stable map. Normal lineup changes must never redetect or move it.
  useEffect(() => {
    if (initializedFormationMatchRef.current === matchId) return;
    if (typeof window !== 'undefined' && matchId) {
      const saved = localStorage.getItem(`tactical_formation_${matchId}`);
      if (saved && FORMATION_KEYS.includes(saved as FormationType)) {
        setSelectedFormation(saved as FormationType);
        initializedFormationMatchRef.current = matchId;
        return;
      }
    }
    if (starters.length === 0) return;
    setSelectedFormation(detectFormation(starters));
    initializedFormationMatchRef.current = matchId;
  }, [matchId, starters]);

  const getPlayer = useCallback((playerId: string) => {
    return calledUpPlayers.find((p) => p.id === playerId);
  }, [calledUpPlayers]);

  const getPlayerName = useCallback((playerId: string) => {
    const p = getPlayer(playerId);
    return p ? `${p.firstName} ${p.lastName}` : 'Player';
  }, [getPlayer]);

  const getPlayerShortName = useCallback((playerId: string) => {
    const p = getPlayer(playerId);
    if (!p) return 'Player';
    return p.firstName || p.lastName;
  }, [getPlayer]);

  // Formation slots configuration
  const formationConfig = PREDEFINED_FORMATIONS[selectedFormation] || PREDEFINED_FORMATIONS['1-4-3-3'];
  const formationSlots = formationConfig.slots;

  const unassignedSlots = useMemo(
    () => formationSlots.filter((slot) => !findSlotOccupant(slot, starters, formationSlots)),
    [formationSlots, starters]
  );

  // Apply a predefined formation layout with intelligent spatial and positional matching
  const handleSelectFormation = async (formationKey: FormationType) => {
    setSelectedFormation(formationKey);
    if (typeof window !== 'undefined' && matchId) {
      localStorage.setItem(`tactical_formation_${matchId}`, formationKey);
    }
    const targetConfig = PREDEFINED_FORMATIONS[formationKey];
    if (!targetConfig || starters.length === 0) return;

    const availableSlots = [...targetConfig.slots];
    const updates: ExistingMatchLineupEntryUpdate[] = [];
    const startersToAssign = [...starters];

    // 1. Assign GK first
    const gkSlotIdx = availableSlots.findIndex((s) => s.position === 'GK');
    const gkStarterIdx = startersToAssign.findIndex((s) => {
      const player = getPlayer(s.playerId);
      const pos = (s.position || player?.position || '').toUpperCase();
      return pos === 'GK' || pos === 'POR';
    });

    if (gkSlotIdx !== -1 && gkStarterIdx !== -1) {
      const slot = availableSlots.splice(gkSlotIdx, 1)[0];
      const gkStarter = startersToAssign.splice(gkStarterIdx, 1)[0];
      updates.push({
        id: gkStarter.id,
        matchId,
        playerId: gkStarter.playerId,
        position: slot.position,
        starter: true,
        pitchX: slot.x,
        pitchY: slot.y,
        shirtNumber: gkStarter.shirtNumber,
        captain: gkStarter.captain,
        notes: gkStarter.notes
      });
    }

    // 2. Assign categories with left-to-right spatial preservation
    const assignCategoryWithSpatialMatch = (category: 'DEF' | 'MID' | 'FWD') => {
      const categorySlots = availableSlots.filter((s) => getPositionCategory(s.position) === category);
      categorySlots.sort((a, b) => a.x - b.x);

      const categoryStarters = startersToAssign.filter((s) => {
        const p = getPlayer(s.playerId);
        return getPositionCategory(s.position) === category || getPositionCategory(p?.position) === category;
      });
      categoryStarters.sort((a, b) => (a.pitchX ?? 50) - (b.pitchX ?? 50));

      const countToAssign = Math.min(categorySlots.length, categoryStarters.length);
      for (let i = 0; i < countToAssign; i++) {
        const starter = categoryStarters[i];
        const slot = categorySlots[i];

        const slotIdx = availableSlots.findIndex((s) => s.id === slot.id);
        if (slotIdx !== -1) availableSlots.splice(slotIdx, 1);

        const stIdx = startersToAssign.findIndex((s) => s.id === starter.id);
        if (stIdx !== -1) startersToAssign.splice(stIdx, 1);

        updates.push({
          id: starter.id,
          matchId,
          playerId: starter.playerId,
          position: slot.position,
          starter: true,
          pitchX: slot.x,
          pitchY: slot.y,
          shirtNumber: starter.shirtNumber,
          captain: starter.captain,
          notes: starter.notes
        });
      }
    };

    assignCategoryWithSpatialMatch('DEF');
    assignCategoryWithSpatialMatch('MID');
    assignCategoryWithSpatialMatch('FWD');

    // 3. Assign any remaining starters to closest available slots
    while (startersToAssign.length > 0 && availableSlots.length > 0) {
      const starter = startersToAssign.shift()!;
      let bestSlotIdx = 0;
      let minD = Infinity;
      const sX = starter.pitchX ?? 50;
      const sY = starter.pitchY ?? 50;
      for (let i = 0; i < availableSlots.length; i++) {
        const d = pitchDistance(sX, sY, availableSlots[i].x, availableSlots[i].y);
        if (d < minD) {
          minD = d;
          bestSlotIdx = i;
        }
      }
      const slot = availableSlots.splice(bestSlotIdx, 1)[0];
      updates.push({
        id: starter.id,
        matchId,
        playerId: starter.playerId,
        position: slot.position,
        starter: true,
        pitchX: slot.x,
        pitchY: slot.y,
        shirtNumber: starter.shirtNumber,
        captain: starter.captain,
        notes: starter.notes
      });
    }

    // 4. Any leftover starters without slots stay with default coordinates
    for (const remaining of startersToAssign) {
      updates.push({
        id: remaining.id,
        matchId,
        playerId: remaining.playerId,
        position: remaining.position || 'UTIL',
        starter: true,
        pitchX: remaining.pitchX ?? 50,
        pitchY: remaining.pitchY ?? 50,
        shirtNumber: remaining.shirtNumber,
        captain: remaining.captain,
        notes: remaining.notes
      });
    }

    if (updates.length > 0) {
      await onBatchUpdateLineupEntries(updates);
    }
  };

  // Move starter to bench (does NOT delete from squad)
  const handleMoveToBench = async (entry: MatchLineupEntry) => {
    setActiveTokenMenuId(null);
    const player = getPlayer(entry.playerId);
    await onUpdateLineupEntry({
      id: entry.id,
      matchId,
      playerId: entry.playerId,
      starter: false,
      position: player?.position || entry.position || 'SUB',
      shirtNumber: entry.shirtNumber,
      captain: entry.captain,
      pitchX: null,
      pitchY: null,
      notes: entry.notes
    });
  };

  // Move bench player to starting XI on pitch at specific slot
  const handleMoveToStarter = async (entry: MatchLineupEntry, targetSlot?: FormationSlot) => {
    setActiveSlotModal(null);
    const nextSlot = targetSlot || unassignedSlots[0] || { id: 'slot', x: 50, y: 50, position: entry.position || 'UTIL' };
    await onUpdateLineupEntry({
      id: entry.id,
      matchId,
      playerId: entry.playerId,
      starter: true,
      position: nextSlot.position || entry.position || 'UTIL',
      shirtNumber: entry.shirtNumber,
      captain: entry.captain,
      pitchX: nextSlot.x,
      pitchY: nextSlot.y,
      notes: entry.notes
    });
  };

  // Quick action: Move all starters to bench
  const handleMoveAllToBench = async () => {
    if (starters.length === 0) return;
    const updates = starters.map((starter) => ({
      id: starter.id,
      matchId,
      playerId: starter.playerId,
      starter: false,
      position: starter.position || 'SUB',
      shirtNumber: starter.shirtNumber,
      captain: starter.captain,
      pitchX: null,
      pitchY: null,
      notes: starter.notes
    }));
    await onBatchUpdateLineupEntries(updates);
  };

  // Quick fill remaining formation slots with called-up substitutes only
  const handleAutoFillFormation = async () => {
    if (unassignedSlots.length === 0) return;
    const availablePool = [...substitutes];

    const updates: ExistingMatchLineupEntryUpdate[] = [];

    for (const slot of unassignedSlots) {
      if (availablePool.length === 0) break;
      // Find best matching player for slot category
      const targetCat = getPositionCategory(slot.position);
      let matchIdx = availablePool.findIndex((cand) => {
        const player = getPlayer(cand.playerId);
        return getPositionCategory(cand.position) === targetCat || getPositionCategory(player?.position) === targetCat;
      });
      if (matchIdx === -1) matchIdx = 0; // Take next available

      const chosen = availablePool.splice(matchIdx, 1)[0];
      const player = getPlayer(chosen.playerId);

      updates.push({
        id: chosen.id,
        matchId,
        playerId: chosen.playerId,
        position: slot.position,
        starter: true,
        pitchX: slot.x,
        pitchY: slot.y,
        shirtNumber: chosen.shirtNumber ?? (player?.number ? Number(player.number) : null),
        captain: chosen.captain,
        notes: chosen.notes
      });
    }

    if (updates.length > 0) {
      await onBatchUpdateLineupEntries(updates);
    }
  };

  const handleSubstituteDragStart = (event: React.DragEvent, entry: MatchLineupEntry) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('application/x-match-lineup-entry', entry.id);
    setDraggedSubstituteId(entry.id);

    const player = getPlayer(entry.playerId);
    const preview = document.createElement('div');
    preview.style.cssText = 'position:fixed;left:-9999px;top:-9999px;display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:8px;background:#002142;color:white;font:700 12px Inter,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.25)';
    const avatar = document.createElement('div');
    avatar.style.cssText = `width:30px;height:30px;border-radius:50%;display:grid;place-items:center;background:#0f5981 center/cover no-repeat;border:2px solid white;${player?.photoUrl ? `background-image:url("${player.photoUrl}")` : ''}`;
    avatar.textContent = player?.photoUrl ? '' : String(entry.shirtNumber ?? player?.number ?? '–');
    const label = document.createElement('div');
    label.innerHTML = `<div>${getPlayerName(entry.playerId)}</div><div style="font-size:10px;color:#bae6fd;margin-top:2px">${entry.position || player?.position || 'SUB'}</div>`;
    preview.append(avatar, label);
    document.body.appendChild(preview);
    event.dataTransfer.setDragImage(preview, 20, 20);
    requestAnimationFrame(() => preview.remove());
  };

  const handleSubstituteDragEnd = () => {
    setDraggedSubstituteId(null);
    setHighlightedSlotId(null);
  };

  const handleSubstituteDrop = async (event: React.DragEvent, slot: FormationSlot) => {
    event.preventDefault();
    event.stopPropagation();
    const entryId = event.dataTransfer.getData('application/x-match-lineup-entry');
    const entry = substitutes.find((substitute) => substitute.id === entryId);
    setDraggedSubstituteId(null);
    setHighlightedSlotId(null);
    if (!entry) return;

    const displacedStarter = findSlotOccupant(slot, starters, formationSlots);
    const promotedEntry: ExistingMatchLineupEntryUpdate = {
      id: entry.id,
      matchId,
      playerId: entry.playerId,
      starter: true,
      position: slot.position,
      pitchX: slot.x,
      pitchY: slot.y,
      shirtNumber: entry.shirtNumber,
      captain: entry.captain,
      notes: entry.notes
    };

    if (!displacedStarter) {
      await onUpdateLineupEntry(promotedEntry);
      return;
    }

    await onBatchUpdateLineupEntries([
      promotedEntry,
      {
        id: displacedStarter.id,
        matchId,
        playerId: displacedStarter.playerId,
        starter: false,
        pitchX: null,
        pitchY: null,
        position: getPlayer(displacedStarter.playerId)?.position || displacedStarter.position,
        shirtNumber: displacedStarter.shirtNumber,
        captain: displacedStarter.captain,
        notes: displacedStarter.notes
      }
    ]);
  };

  // Pointer drag logic for pitch tokens
  const handlePointerDown = (e: React.PointerEvent, entry: MatchLineupEntry) => {
    e.stopPropagation();
    if (e.button !== 0) return;

    isDraggingRef.current = true;
    activeDragIdRef.current = entry.id;
    setDraggingId(entry.id);

    const pitchEl = pitchRef.current;
    if (pitchEl) {
      const rect = pitchEl.getBoundingClientRect();
      const x = Math.min(94, Math.max(6, ((e.clientX - rect.left) / rect.width) * 100));
      const y = Math.min(94, Math.max(6, ((e.clientY - rect.top) / rect.height) * 100));
      dragCoordsRef.current = { x, y };
    }

    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current || !activeDragIdRef.current) return;
    const pitchEl = pitchRef.current;
    if (!pitchEl) return;

    const rect = pitchEl.getBoundingClientRect();
    const x = Math.min(94, Math.max(6, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.min(94, Math.max(6, ((e.clientY - rect.top) / rect.height) * 100));
      dragCoordsRef.current = { x, y };

    const currentId = activeDragIdRef.current;
    const nearestSlot = formationSlots.reduce((nearest, slot) => (
      pitchDistance(x, y, slot.x, slot.y) < pitchDistance(x, y, nearest.x, nearest.y) ? slot : nearest
    ));
    const otherStarter = findSlotOccupant(nearestSlot, starters, formationSlots, currentId);

    setHoverTargetId(otherStarter ? otherStarter.id : null);
    setHighlightedSlotId(nearestSlot.id);
  };

  const handlePointerUp = async (e: React.PointerEvent) => {
    if (!isDraggingRef.current || !activeDragIdRef.current) return;
    const draggedEntryId = activeDragIdRef.current;
    isDraggingRef.current = false;
    activeDragIdRef.current = null;
    setDraggingId(null);
    setHoverTargetId(null);
    setHighlightedSlotId(null);
      dragCoordsRef.current = null;

    const pitchEl = pitchRef.current;
    if (pitchEl) {
      const rect = pitchEl.getBoundingClientRect();
      const finalX = Math.round(Math.min(94, Math.max(6, ((e.clientX - rect.left) / rect.width) * 100)) * 10) / 10;
      const finalY = Math.round(Math.min(94, Math.max(6, ((e.clientY - rect.top) / rect.height) * 100)) * 10) / 10;

      const draggedEntry = starters.find((s) => s.id === draggedEntryId);
      if (draggedEntry) {
        const targetSlot = formationSlots.reduce((nearest, slot) => (
          pitchDistance(finalX, finalY, slot.x, slot.y) < pitchDistance(finalX, finalY, nearest.x, nearest.y) ? slot : nearest
        ));
        const targetStarter = findSlotOccupant(targetSlot, starters, formationSlots, draggedEntry.id);

        if (targetStarter) {
          await onBatchUpdateLineupEntries([
            {
              id: draggedEntry.id,
              matchId,
              playerId: draggedEntry.playerId,
              starter: true,
              position: targetSlot.position,
              pitchX: targetSlot.x,
              pitchY: targetSlot.y,
              shirtNumber: draggedEntry.shirtNumber,
              captain: draggedEntry.captain,
              notes: draggedEntry.notes
            },
            {
              id: targetStarter.id,
              matchId,
              playerId: targetStarter.playerId,
              starter: false,
              position: getPlayer(targetStarter.playerId)?.position || targetStarter.position,
              pitchX: null,
              pitchY: null,
              shirtNumber: targetStarter.shirtNumber,
              captain: targetStarter.captain,
              notes: targetStarter.notes
            }
          ]);
        } else {
          await onUpdateLineupEntry({
            id: draggedEntry.id,
            matchId,
            playerId: draggedEntry.playerId,
            position: targetSlot.position,
            starter: true,
            shirtNumber: draggedEntry.shirtNumber,
            captain: draggedEntry.captain,
            pitchX: targetSlot.x,
            pitchY: targetSlot.y,
            notes: draggedEntry.notes
          });
        }
      }
    }
  };

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = () => {
      setActiveTokenMenuId(null);
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const renderMatchSquadRow = (entry: MatchLineupEntry, state: 'starter' | 'substitute') => {
    const player = getPlayer(entry.playerId);
    const isSubstitute = state === 'substitute';
    const isBeingDragged = draggedSubstituteId === entry.id;

    return (
      <div
        key={entry.id}
        draggable={isSubstitute}
        onDragStart={isSubstitute ? (event) => handleSubstituteDragStart(event, entry) : undefined}
        onDragEnd={isSubstitute ? handleSubstituteDragEnd : undefined}
        className={`flex min-h-12 items-center gap-2.5 px-1 py-2 transition-opacity ${
          isBeingDragged ? 'opacity-45' : 'opacity-100'
        } ${isSubstitute ? 'cursor-grab active:cursor-grabbing' : ''}`}
      >
        {isSubstitute && <GripVertical className="h-4 w-4 shrink-0 text-slate-300" aria-hidden="true" />}
        <PlayerPitchAvatar
          photoUrl={player?.photoUrl}
          shirtNumber={entry.shirtNumber ?? player?.number}
          fallbackNumber="–"
          sizeClassName="h-8 w-8"
          className="shrink-0 border border-slate-200 bg-slate-100 text-xs font-black text-slate-700"
          alt={getPlayerName(entry.playerId)}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-black text-slate-900">{getPlayerName(entry.playerId)}</p>
          <p className="text-[10px] font-bold text-slate-400">
            #{entry.shirtNumber ?? player?.number ?? '–'} · {entry.position || player?.position || (isSubstitute ? 'SUB' : 'UTIL')}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {isSubstitute ? (
            <button
              type="button"
              onClick={() => handleMoveToStarter(entry)}
              disabled={unassignedSlots.length === 0}
              className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-black text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label={`Make ${getPlayerName(entry.playerId)} a starter`}
              title={unassignedSlots.length === 0 ? 'XI completo: arrastra sobre una titular para sustituirla' : 'Colocar en la primera posición disponible'}
            >
              Al campo
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleMoveToBench(entry)}
              className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-black text-amber-800 hover:bg-amber-100"
              aria-label={`Move ${getPlayerName(entry.playerId)} to substitutes`}
            >
              Al banquillo
            </button>
          )}
          <button
            type="button"
            onClick={() => onOpenEditModal(entry)}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            title="Editar detalles"
            aria-label={`Edit ${getPlayerName(entry.playerId)}`}
          >
            <Edit3 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header & Predefined Formations Bar */}
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-800">
                Pizarra Táctica
              </span>
              <span className="text-xs font-bold text-slate-500">
                Titulares: <strong className="text-slate-900">{starters.length}/11</strong> • Suplentes: <strong className="text-slate-900">{substitutes.length}</strong>
              </span>
            </div>
            <h3 className="mt-1 text-lg font-black text-[#002142] font-display">
              Alineación y Esquema Táctico
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Arrastra las jugadoras para ajustar posiciones tácticas o haz clic en los huecos vacíos para colocar titulares.
            </p>
          </div>

          {/* Formations Quick Switcher & Tools */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap items-center gap-1.5 rounded-2xl bg-slate-100 p-1.5 border border-slate-200">
              <span className="px-2 text-[10px] font-black uppercase tracking-wider text-slate-400">
                Formación:
              </span>
              {FORMATION_KEYS.map((key) => {
                const isSelected = selectedFormation === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleSelectFormation(key)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-black transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#002142] text-white shadow-sm scale-105'
                        : 'bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 border border-slate-200/60'
                    }`}
                  >
                    {key}
                  </button>
                );
              })}
            </div>

            {/* Tactical Actions */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleSelectFormation(selectedFormation)}
                className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
                title="Alinear automáticamente los titulares a la formación activa"
              >
                <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
                <span>Auto-alinear</span>
              </button>

              {unassignedSlots.length > 0 && substitutes.length > 0 && (
                <button
                  type="button"
                  onClick={handleAutoFillFormation}
                  className="inline-flex items-center gap-1.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 px-3 py-2 text-xs font-black text-white shadow-xs transition-colors"
                  title="Completar el 11 titular automáticamente con las jugadoras disponibles"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Completar 11</span>
                </button>
              )}

              {starters.length > 0 && (
                <button
                  type="button"
                  onClick={handleMoveAllToBench}
                  className="inline-flex items-center gap-1 rounded-2xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-bold text-slate-600 hover:bg-amber-50 hover:text-amber-800 hover:border-amber-200 transition-colors"
                  title="Mover todos los titulares al banquillo"
                >
                  <ArrowRightLeft className="h-3.5 w-3.5" />
                  <span>Al banquillo</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Save feedback indicator */}
        {saveStatus && saveStatus.state !== 'idle' && (
          <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
            <span className={`text-xs font-bold ${
              saveStatus.state === 'saving' ? 'text-sky-600' :
              saveStatus.state === 'saved' ? 'text-emerald-600' : 'text-rose-600'
            }`}>
              {saveStatus.state === 'saving' && 'Guardando cambios en la alineación...'}
              {saveStatus.state === 'saved' && '✓ Esquema táctico y posiciones guardadas correctamente'}
              {saveStatus.state === 'error' && (saveStatus.message || 'Error al guardar la alineación')}
            </span>
          </div>
        )}
      </div>

      {/* Main Pitch and Squad Layout */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(360px,0.9fr)]">
        {/* Left Column: Interactive Pitch Campogram */}
        <div className="space-y-4">
          <div
            ref={pitchRef}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className="relative mx-auto aspect-[100/130] w-full max-w-[680px] select-none rounded-3xl border-4 border-slate-800/20 shadow-2xl touch-none"
          >
            {/*
              Background/markings are clipped in their own layer so the rounded corners stay
              clean, WITHOUT clipping player tokens below: fixed-size avatars/name labels near
              the edges (e.g. the GK slot at y:90) must stay fully visible on small viewports.
            */}
            <div
              className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl bg-gradient-to-b from-emerald-800 via-emerald-700 to-emerald-800 p-4"
              style={{
                backgroundImage: `
                  linear-gradient(to bottom, rgba(16, 185, 129, 0.08) 50%, transparent 50%),
                  radial-gradient(ellipse at center, rgba(6, 95, 70, 0.3) 0%, rgba(6, 78, 59, 0.8) 100%)
                `,
                backgroundSize: '100% 80px, 100% 100%'
              }}
            >
              {/* Field Turf Striping Effect */}
              <div className="absolute inset-0 opacity-15">
                <div className="h-full w-full bg-[repeating-linear-gradient(0deg,#000_0px,#000_40px,#fff_40px,#fff_80px)] mix-blend-overlay" />
              </div>

              {/* Pitch Markings SVG Canvas */}
              <svg
                className="absolute inset-4 h-[calc(100%-32px)] w-[calc(100%-32px)] text-white/70"
                viewBox="0 0 100 130"
                preserveAspectRatio="none"
              >
                {/* Outer Boundary */}
                <rect x="0" y="0" width="100" height="130" fill="none" stroke="currentColor" strokeWidth="0.8" />
                
                {/* Halfway Line */}
                <line x1="0" y1="65" x2="100" y2="65" stroke="currentColor" strokeWidth="0.8" />
                
                {/* Center Circle & Spot */}
                <circle cx="50" cy="65" r="14" fill="none" stroke="currentColor" strokeWidth="0.8" />
                <circle cx="50" cy="65" r="1" fill="currentColor" />

                {/* Top Penalty Box (Opponent) */}
                <rect x="22" y="0" width="56" height="22" fill="none" stroke="currentColor" strokeWidth="0.8" />
                <rect x="34" y="0" width="32" height="8" fill="none" stroke="currentColor" strokeWidth="0.8" />
                <circle cx="50" cy="14" r="0.9" fill="currentColor" />
                <path d="M 38 22 A 12 12 0 0 0 62 22" fill="none" stroke="currentColor" strokeWidth="0.8" />

                {/* Bottom Penalty Box (Our Goal) */}
                <rect x="22" y="108" width="56" height="22" fill="none" stroke="currentColor" strokeWidth="0.8" />
                <rect x="34" y="122" width="32" height="8" fill="none" stroke="currentColor" strokeWidth="0.8" />
                <circle cx="50" cy="116" r="0.9" fill="currentColor" />
                <path d="M 38 108 A 12 12 0 0 1 62 108" fill="none" stroke="currentColor" strokeWidth="0.8" />

                {/* Corner Arcs */}
                <path d="M 0 4 A 4 4 0 0 0 4 0" fill="none" stroke="currentColor" strokeWidth="0.8" />
                <path d="M 96 0 A 4 4 0 0 0 100 4" fill="none" stroke="currentColor" strokeWidth="0.8" />
                <path d="M 0 126 A 4 4 0 0 1 4 130" fill="none" stroke="currentColor" strokeWidth="0.8" />
                <path d="M 96 130 A 4 4 0 0 1 100 126" fill="none" stroke="currentColor" strokeWidth="0.8" />
              </svg>
            </div>

            {/* Goal Posts labels */}
            <div className="pointer-events-none absolute top-1 left-1/2 -translate-x-1/2 rounded bg-black/40 px-2.5 py-0.5 text-[8px] font-black uppercase tracking-widest text-emerald-200/80">
              Campo Rival
            </div>
            <div className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 rounded bg-black/40 px-2.5 py-0.5 text-[8px] font-black uppercase tracking-widest text-emerald-200/80">
              Nuestra Portería
            </div>

            {/* Stable formation map: all 11 slots remain mounted at fixed coordinates. */}
            {formationSlots.map((slot) => {
              const occupant = findSlotOccupant(slot, starters, formationSlots, draggingId);
              const isHighlighted = highlightedSlotId === slot.id;
              const isDragActive = Boolean(draggedSubstituteId || draggingId);
              return (
                <button
                  key={slot.id}
                  type="button"
                  aria-label={`${occupant ? 'Occupied' : 'Empty'} ${slot.position} tactical position`}
                  onClick={() => !occupant && setActiveSlotModal(slot)}
                  onDragEnter={(event) => {
                    event.preventDefault();
                    setHighlightedSlotId(slot.id);
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'move';
                    setHighlightedSlotId(slot.id);
                  }}
                  onDragLeave={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                      setHighlightedSlotId((current) => current === slot.id ? null : current);
                    }
                  }}
                  onDrop={(event) => void handleSubstituteDrop(event, slot)}
                  style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
                  className={`absolute flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full transition-[transform,background-color,border-color,opacity,box-shadow] duration-150 ${
                    isDragActive ? 'z-30' : 'z-10'
                  } ${
                    isHighlighted
                      ? 'scale-110 border-2 border-white bg-sky-400/80 text-slate-950 shadow-[0_0_0_6px_rgba(125,211,252,0.25)]'
                      : occupant
                        ? 'border border-transparent bg-transparent text-transparent opacity-0'
                        : 'border-2 border-dashed border-white/45 bg-emerald-950/30 text-white/80 hover:border-white/80 hover:bg-emerald-950/50'
                  }`}
                >
                  <span className="h-2 w-2 rounded-full bg-current opacity-70" />
                  <span className="mt-1 text-[9px] font-black uppercase">{slot.position}</span>
                </button>
              );
            })}

            {/* Render Starter Player Tokens */}
            {starters.map((entry, index) => {
              const player = getPlayer(entry.playerId);
              const isBeingDragged = draggingId === entry.id;
              const isHoveredTarget = hoverTargetId === entry.id;
              const stablePosition = resolveStablePitchPosition(entry, formationSlots);
                const posX = isBeingDragged && dragCoordsRef.current ? dragCoordsRef.current.x : stablePosition.x;
                const posY = isBeingDragged && dragCoordsRef.current ? dragCoordsRef.current.y : stablePosition.y;
              const isMenuOpen = activeTokenMenuId === entry.id;

              return (
                <div
                  key={entry.id}
                  style={{
                    left: `${posX}%`,
                    top: `${posY}%`,
                    zIndex: isBeingDragged ? 40 : isMenuOpen ? 30 : 20
                  }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 transition-[transform,shadow] duration-75"
                >
                  <div
                    onPointerDown={(e) => handlePointerDown(e, entry)}
                    className={`group relative flex flex-col items-center cursor-grab active:cursor-grabbing ${
                      isBeingDragged ? 'scale-115 opacity-90' : isHoveredTarget ? 'scale-110 ring-4 ring-amber-400 rounded-full' : 'hover:scale-105'
                    }`}
                  >
                    {/* Player Badge Token */}
                    <div className="relative flex h-11 w-11 items-center justify-center">
                      <PlayerPitchAvatar
                        photoUrl={player?.photoUrl}
                        shirtNumber={entry.shirtNumber ?? player?.number}
                        fallbackNumber={index + 1}
                        sizeClassName="h-11 w-11"
                        className="border-2 border-white bg-[#002142] text-xs font-black text-white shadow-xl ring-2 ring-black/20"
                        alt={getPlayerShortName(entry.playerId)}
                      />

                      {/* Captain Armband */}
                      {entry.captain && (
                        <span className="absolute -right-1 -top-1 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[8px] font-black text-slate-950 shadow">
                          C
                        </span>
                      )}
                    </div>

                    {/* Player Surname & Position Pill */}
                    <div className="mt-1 flex flex-col items-center pointer-events-none">
                      <span className="max-w-[88px] truncate rounded-md bg-slate-950/90 px-2 py-0.5 text-[10px] font-black text-white shadow-sm backdrop-blur-xs">
                        {getPlayerShortName(entry.playerId)}
                      </span>
                      <span className="mt-0.5 rounded bg-emerald-400/95 px-1.5 py-0.2 text-[8px] font-black uppercase tracking-wider text-slate-950 shadow-xs">
                        {entry.position || 'UTIL'}
                      </span>
                    </div>

                    {/* Quick Action Button (Opens Token Popover) */}
                    <button
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveTokenMenuId(isMenuOpen ? null : entry.id);
                      }}
                      className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-slate-700 shadow-md hover:bg-slate-100 hover:text-slate-900 border border-slate-200 cursor-pointer"
                      title="Opciones de jugadora"
                    >
                      <ChevronDown className="h-3 w-3" />
                    </button>
                  </div>

                  {/* Popover Action Menu */}
                  {isMenuOpen && (
                    <div 
                      onPointerDown={(e) => e.stopPropagation()}
                      className="absolute left-1/2 top-full mt-2 -translate-x-1/2 z-50 w-48 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-2xl animate-in fade-in zoom-in-95 text-slate-800"
                    >
                      <div className="px-2.5 py-1 text-[10px] font-black uppercase text-slate-400 border-b border-slate-100">
                        {getPlayerName(entry.playerId)} {entry.shirtNumber ? `(#${entry.shirtNumber})` : ''}
                      </div>
                      <div className="mt-1 space-y-0.5">
                        <button
                          type="button"
                          onClick={() => handleMoveToBench(entry)}
                          className="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-amber-50 hover:text-amber-900 text-left transition-colors cursor-pointer"
                        >
                          <ArrowRightLeft className="h-3.5 w-3.5 text-amber-600" />
                          <span>Mover al Banquillo</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTokenMenuId(null);
                            onOpenEditModal(entry);
                          }}
                          className="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 text-left transition-colors cursor-pointer"
                        >
                          <Edit3 className="h-3.5 w-3.5 text-sky-600" />
                          <span>Edit Details / Shirt #</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Pitch Legend and Quick Tip */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-slate-50 px-4 py-2.5 border border-slate-200 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <Move className="h-4 w-4 text-emerald-600" />
              <span>Arrastra para mover o suelta encima de otra jugadora para intercambiar posiciones.</span>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-bold">
              <span className="flex items-center gap-1 text-slate-700">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> Titulares ({starters.length}/11)
              </span>
              <span className="flex items-center gap-1 text-slate-700">
                <span className="h-2 w-2 rounded-full bg-amber-500" /> Suplentes ({substitutes.length})
              </span>
            </div>
          </div>
        </div>

        {/* Unified called-up match squad panel */}
        <aside className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-[#002142] px-4 py-3.5 text-white">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-sky-300" />
                <h4 className="text-sm font-black uppercase tracking-wide">Match Squad</h4>
              </div>
              <span className="rounded-md bg-white/10 px-2 py-1 text-sm font-black tabular-nums">{lineupEntries.length}</span>
            </div>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-sky-200">
              {starters.length} starters · {substitutes.length} substitutes
            </p>
          </div>

          <section className="p-4">
            <div className="mb-2 flex items-center justify-between border-b border-slate-100 pb-2">
              <h5 className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Starting XI</h5>
              <span className="text-xs font-black tabular-nums text-slate-500">{starters.length}</span>
            </div>
            <div className="max-h-64 divide-y divide-slate-100 overflow-y-auto pr-1">
              {starters.length > 0
                ? starters.map((entry) => renderMatchSquadRow(entry, 'starter'))
                : <p className="py-5 text-center text-xs text-slate-400">Arrastra suplentes a las posiciones del campo.</p>}
            </div>
          </section>

          <section className="border-t border-slate-200 p-4">
            <div className="mb-2 flex items-center justify-between border-b border-slate-100 pb-2">
              <h5 className="text-[10px] font-black uppercase tracking-wider text-amber-700">Substitutes</h5>
              <span className="text-xs font-black tabular-nums text-slate-500">{substitutes.length}</span>
            </div>
            <div className="max-h-80 divide-y divide-slate-100 overflow-y-auto pr-1">
              {substitutes.length > 0
                ? substitutes.map((entry) => renderMatchSquadRow(entry, 'substitute'))
                : <p className="py-5 text-center text-xs text-slate-400">No hay suplentes convocadas.</p>}
            </div>
          </section>
        </aside>
      </div>

      {/* Modal: Pick Player for Empty Formation Slot */}
      {activeSlotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700">
                  Asignar Posición Titular
                </span>
                <h3 className="text-base font-black text-[#002142] font-display">
                  Elegir jugadora para {activeSlotModal.position}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveSlotModal(null)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 font-medium">
              Selecciona una jugadora convocada del banquillo para colocarla en {activeSlotModal.position}.
            </p>

            {/* List of candidates */}
            <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto pr-1">
              {/* First list bench substitutes */}
              {substitutes.length > 0 && (
                <div className="pb-2">
                  <span className="text-[10px] font-black uppercase text-amber-700">Desde el Banquillo</span>
                  {substitutes.map((entry) => {
                    const player = getPlayer(entry.playerId);
                    const isCompat = isPositionCompatible(activeSlotModal.position, entry.position || player?.position);
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => handleMoveToStarter(entry, activeSlotModal)}
                        className="flex w-full items-center justify-between py-2 text-left hover:bg-slate-50 px-2 rounded-xl cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <PlayerPitchAvatar
                            photoUrl={player?.photoUrl}
                            shirtNumber={entry.shirtNumber ?? player?.number}
                            fallbackNumber="–"
                            sizeClassName="h-7 w-7"
                            className="bg-slate-100 text-xs font-black text-slate-700"
                            alt={getPlayerName(entry.playerId)}
                          />
                          <div>
                            <span className="text-xs font-bold text-slate-900">{getPlayerName(entry.playerId)}</span>
                            <span className="ml-1 text-[10px] text-slate-400">({entry.position || player?.position || 'SUB'})</span>
                          </div>
                        </div>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${
                          isCompat ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                        }`}>
                          Poner como {activeSlotModal.position}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {substitutes.length === 0 && (
                <p className="py-6 text-center text-xs text-slate-400">
                  No hay suplentes convocadas disponibles.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

