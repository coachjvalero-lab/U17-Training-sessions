import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { 
  Users, 
  Plus, 
  X, 
  Edit3, 
  ArrowRightLeft, 
  Shield, 
  Check, 
  Search, 
  RotateCcw, 
  Move,
  ChevronDown,
  UserCheck,
  UserX,
  Sparkles,
  Zap,
  Layers,
  HelpCircle
} from 'lucide-react';
import { MatchLineupEntry } from '../types';
import { CloudSquadPlayer } from '../services/squad/squadService';
import { PlayerPitchAvatar } from './PlayerPitchAvatar';
import { 
  FormationType, 
  FormationSlot, 
  PREDEFINED_FORMATIONS, 
  FORMATION_KEYS, 
  getPositionCategory,
  isPositionCompatible,
  pitchDistance
} from '../utils/formations';

interface MatchPitchBoardProps {
  matchId: string;
  lineupEntries: MatchLineupEntry[];
  squadPlayers: CloudSquadPlayer[];
  onUpdateLineupEntry: (entry: Partial<MatchLineupEntry> & Pick<MatchLineupEntry, 'matchId' | 'playerId'>) => Promise<void>;
  onBatchUpdateLineupEntries: (entries: Array<Partial<MatchLineupEntry> & Pick<MatchLineupEntry, 'matchId' | 'playerId'>>) => Promise<void>;
  onRemoveLineupEntry: (entryId: string) => Promise<void>;
  onAddPlayerToMatch: (player: CloudSquadPlayer, asStarter: boolean, slot?: FormationSlot) => Promise<void>;
  onOpenEditModal: (entry: MatchLineupEntry) => void;
  saveStatus?: { state: 'idle' | 'saving' | 'saved' | 'error'; message?: string };
}

export const MatchPitchBoard: React.FC<MatchPitchBoardProps> = ({
  matchId,
  lineupEntries,
  squadPlayers,
  onUpdateLineupEntry,
  onBatchUpdateLineupEntries,
  onRemoveLineupEntry,
  onAddPlayerToMatch,
  onOpenEditModal,
  saveStatus
}) => {
  const pitchRef = useRef<HTMLDivElement | null>(null);
  const [selectedFormation, setSelectedFormation] = useState<FormationType>('1-4-3-3');
  const [activeSlotModal, setActiveSlotModal] = useState<FormationSlot | null>(null);
  const [activeTokenMenuId, setActiveTokenMenuId] = useState<string | null>(null);
  const [squadSearchQuery, setSquadSearchQuery] = useState('');
  const [squadFilterTab, setSquadFilterTab] = useState<'all' | 'unselected' | 'bench'>('all');
  const [positionFilter, setPositionFilter] = useState<'ALL' | 'GK' | 'DEF' | 'MID' | 'FWD'>('ALL');

  // Dragging state for pointer drag
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragCoords, setDragCoords] = useState<{ x: number; y: number } | null>(null);
  const [hoverTargetId, setHoverTargetId] = useState<string | null>(null);
  const isDraggingRef = useRef(false);
  const activeDragIdRef = useRef<string | null>(null);

  const starters = useMemo(() => lineupEntries.filter((e) => e.starter), [lineupEntries]);
  const substitutes = useMemo(() => lineupEntries.filter((e) => !e.starter), [lineupEntries]);

  // Map of lineup entries by playerId
  const lineupPlayerIds = useMemo(() => new Set(lineupEntries.map((e) => e.playerId)), [lineupEntries]);

  // Unselected squad players (not in matchday squad)
  const unselectedPlayers = useMemo(() => {
    return squadPlayers.filter((p) => !lineupPlayerIds.has(p.id));
  }, [squadPlayers, lineupPlayerIds]);

  const getPlayer = useCallback((playerId: string) => {
    return squadPlayers.find((p) => p.id === playerId);
  }, [squadPlayers]);

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

  // Accurately calculate which formation slots are occupied vs unassigned
  // A slot is occupied if a starter is within 8.5% distance on pitch or has exact matching position when close
  const { occupiedSlots, unassignedSlots } = useMemo(() => {
    const occupied = new Map<string, MatchLineupEntry>();
    const unassigned: FormationSlot[] = [];

    // Copy slots to find closest matching starters
    const availableStarters = [...starters];

    for (const slot of formationSlots) {
      // Find starter closest to this slot
      let bestIndex = -1;
      let minDistance = 12.0; // Distance threshold %

      for (let i = 0; i < availableStarters.length; i++) {
        const starter = availableStarters[i];
        if (typeof starter.pitchX === 'number' && typeof starter.pitchY === 'number') {
          const dist = pitchDistance(starter.pitchX, starter.pitchY, slot.x, slot.y);
          if (dist < minDistance) {
            minDistance = dist;
            bestIndex = i;
          }
        }
      }

      if (bestIndex !== -1) {
        const matchedStarter = availableStarters.splice(bestIndex, 1)[0];
        occupied.set(slot.id, matchedStarter);
      } else {
        unassigned.push(slot);
      }
    }

    return { occupiedSlots: occupied, unassignedSlots: unassigned };
  }, [formationSlots, starters]);

  // Apply a predefined formation layout with intelligent position matching
  const handleSelectFormation = async (formationKey: FormationType) => {
    setSelectedFormation(formationKey);
    const targetConfig = PREDEFINED_FORMATIONS[formationKey];
    if (!targetConfig || starters.length === 0) return;

    const availableSlots = [...targetConfig.slots];
    const updates: Array<Partial<MatchLineupEntry> & Pick<MatchLineupEntry, 'matchId' | 'playerId'>> = [];
    const startersToAssign = [...starters];

    // 1. Assign GK first
    const gkSlotIdx = availableSlots.findIndex((s) => s.position === 'GK');
    const gkStarterIdx = startersToAssign.findIndex((s) => {
      const player = getPlayer(s.playerId);
      return (s.position?.toUpperCase() === 'GK' || player?.position?.toUpperCase() === 'GK' || s.position === 'POR');
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

    // 2. Assign by exact position category (DEF, MID, FWD)
    const assignCategory = (category: 'DEF' | 'MID' | 'FWD') => {
      const catStarters = startersToAssign.filter((s) => {
        const p = getPlayer(s.playerId);
        return getPositionCategory(s.position) === category || getPositionCategory(p?.position) === category;
      });

      for (const starter of catStarters) {
        const slotIdx = availableSlots.findIndex((s) => getPositionCategory(s.position) === category);
        if (slotIdx !== -1) {
          const slot = availableSlots.splice(slotIdx, 1)[0];
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
      }
    };

    assignCategory('DEF');
    assignCategory('MID');
    assignCategory('FWD');

    // 3. Assign any remaining starters to available slots
    while (startersToAssign.length > 0 && availableSlots.length > 0) {
      const starter = startersToAssign.shift()!;
      const slot = availableSlots.shift()!;
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
    await onUpdateLineupEntry({
      id: entry.id,
      matchId,
      playerId: entry.playerId,
      starter: false,
      position: entry.position || 'SUB',
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

  // Quick fill remaining formation slots with best available bench/squad players
  const handleAutoFillFormation = async () => {
    if (unassignedSlots.length === 0) return;
    const availablePool = [...substitutes, ...unselectedPlayers.map((p) => ({
      id: undefined,
      matchId,
      playerId: p.id,
      position: p.position || 'UTIL',
      starter: false,
      shirtNumber: p.number ? Number(p.number) : null,
      captain: false,
      pitchX: null,
      pitchY: null,
      notes: null
    }))];

    const updates: Array<Partial<MatchLineupEntry> & Pick<MatchLineupEntry, 'matchId' | 'playerId'>> = [];

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

  // Remove player from match lineup completely (moves back to unselected pool)
  const handleRemoveFromLineup = async (entryId: string) => {
    setActiveTokenMenuId(null);
    await onRemoveLineupEntry(entryId);
  };

  // Add an unselected squad player directly to starting XI or bench
  const handleAddSquadPlayer = async (player: CloudSquadPlayer, asStarter: boolean, slot?: FormationSlot) => {
    setActiveSlotModal(null);
    const targetSlot = slot || (asStarter ? unassignedSlots[0] : undefined);
    await onAddPlayerToMatch(player, asStarter, targetSlot);
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
      setDragCoords({ x, y });
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
    setDragCoords({ x, y });

    // Check if dragging near another starter to show swap target indicator
    const currentId = activeDragIdRef.current;
    const otherStarter = starters.find((s) => {
      if (s.id === currentId) return false;
      const sx = s.pitchX ?? 50;
      const sy = s.pitchY ?? 50;
      return pitchDistance(x, y, sx, sy) < 7.5;
    });

    setHoverTargetId(otherStarter ? otherStarter.id : null);
  };

  const handlePointerUp = async (e: React.PointerEvent) => {
    if (!isDraggingRef.current || !activeDragIdRef.current) return;
    const draggedEntryId = activeDragIdRef.current;
    isDraggingRef.current = false;
    activeDragIdRef.current = null;
    setDraggingId(null);
    setHoverTargetId(null);

    const pitchEl = pitchRef.current;
    if (pitchEl) {
      const rect = pitchEl.getBoundingClientRect();
      const finalX = Math.round(Math.min(94, Math.max(6, ((e.clientX - rect.left) / rect.width) * 100)) * 10) / 10;
      const finalY = Math.round(Math.min(94, Math.max(6, ((e.clientY - rect.top) / rect.height) * 100)) * 10) / 10;

      const draggedEntry = starters.find((s) => s.id === draggedEntryId);
      if (draggedEntry) {
        // Check if dropped onto another starter -> SWAP positions!
        const targetStarter = starters.find((s) => {
          if (s.id === draggedEntryId) return false;
          const sx = s.pitchX ?? 50;
          const sy = s.pitchY ?? 50;
          return pitchDistance(finalX, finalY, sx, sy) < 8.0;
        });

        if (targetStarter) {
          // Swap positions and coordinates
          const origX = draggedEntry.pitchX ?? 50;
          const origY = draggedEntry.pitchY ?? 50;
          const origPos = draggedEntry.position;

          const targetX = targetStarter.pitchX ?? 50;
          const targetY = targetStarter.pitchY ?? 50;
          const targetPos = targetStarter.position;

          await onBatchUpdateLineupEntries([
            {
              id: draggedEntry.id,
              matchId,
              playerId: draggedEntry.playerId,
              starter: true,
              position: targetPos,
              pitchX: targetX,
              pitchY: targetY,
              shirtNumber: draggedEntry.shirtNumber,
              captain: draggedEntry.captain,
              notes: draggedEntry.notes
            },
            {
              id: targetStarter.id,
              matchId,
              playerId: targetStarter.playerId,
              starter: true,
              position: origPos,
              pitchX: origX,
              pitchY: origY,
              shirtNumber: targetStarter.shirtNumber,
              captain: targetStarter.captain,
              notes: targetStarter.notes
            }
          ]);
        } else {
          // Check if dropped very close to an empty formation slot -> Snap to slot!
          let snapX = finalX;
          let snapY = finalY;
          let snapPos = draggedEntry.position;

          for (const slot of formationSlots) {
            const isSlotTaken = starters.some((s) => s.id !== draggedEntry.id && s.pitchX === slot.x && s.pitchY === slot.y);
            if (!isSlotTaken && pitchDistance(finalX, finalY, slot.x, slot.y) < 6.0) {
              snapX = slot.x;
              snapY = slot.y;
              snapPos = slot.position;
              break;
            }
          }

          await onUpdateLineupEntry({
            id: draggedEntry.id,
            matchId,
            playerId: draggedEntry.playerId,
            position: snapPos,
            starter: true,
            shirtNumber: draggedEntry.shirtNumber,
            captain: draggedEntry.captain,
            pitchX: snapX,
            pitchY: snapY,
            notes: draggedEntry.notes
          });
        }
      }
    }
    setDragCoords(null);
  };

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = () => {
      setActiveTokenMenuId(null);
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  // Filter squad players for sidebar / list
  const filteredSquadList = useMemo(() => {
    let list = squadPlayers;
    if (squadFilterTab === 'unselected') {
      list = unselectedPlayers;
    } else if (squadFilterTab === 'bench') {
      const benchPlayerIds = new Set(substitutes.map((s) => s.playerId));
      list = squadPlayers.filter((p) => benchPlayerIds.has(p.id));
    }

    if (positionFilter !== 'ALL') {
      list = list.filter((p) => getPositionCategory(p.position) === positionFilter);
    }

    if (!squadSearchQuery.trim()) return list;
    const q = squadSearchQuery.toLowerCase();
    return list.filter((p) => 
      p.firstName.toLowerCase().includes(q) ||
      p.lastName.toLowerCase().includes(q) ||
      (p.position && p.position.toLowerCase().includes(q)) ||
      (p.number !== undefined && String(p.number).includes(q))
    );
  }, [squadPlayers, squadFilterTab, positionFilter, unselectedPlayers, substitutes, squadSearchQuery]);

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

              {unassignedSlots.length > 0 && substitutes.length + unselectedPlayers.length > 0 && (
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
            className="relative select-none aspect-[3/4] sm:aspect-[4/5] min-h-[580px] w-full overflow-hidden rounded-3xl border-4 border-slate-800/20 bg-gradient-to-b from-emerald-800 via-emerald-700 to-emerald-800 p-4 shadow-2xl touch-none"
            style={{
              backgroundImage: `
                linear-gradient(to bottom, rgba(16, 185, 129, 0.08) 50%, transparent 50%),
                radial-gradient(ellipse at center, rgba(6, 95, 70, 0.3) 0%, rgba(6, 78, 59, 0.8) 100%)
              `,
              backgroundSize: '100% 80px, 100% 100%'
            }}
          >
            {/* Field Turf Striping Effect */}
            <div className="pointer-events-none absolute inset-0 opacity-15">
              <div className="h-full w-full bg-[repeating-linear-gradient(0deg,#000_0px,#000_40px,#fff_40px,#fff_80px)] mix-blend-overlay" />
            </div>

            {/* Pitch Markings SVG Canvas */}
            <svg
              className="pointer-events-none absolute inset-4 h-[calc(100%-32px)] w-[calc(100%-32px)] text-white/70"
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

            {/* Goal Posts labels */}
            <div className="pointer-events-none absolute top-1 left-1/2 -translate-x-1/2 rounded bg-black/40 px-2.5 py-0.5 text-[8px] font-black uppercase tracking-widest text-emerald-200/80">
              Campo Rival
            </div>
            <div className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 rounded bg-black/40 px-2.5 py-0.5 text-[8px] font-black uppercase tracking-widest text-emerald-200/80">
              Nuestra Portería
            </div>

            {/* Render Empty Formation Slots */}
            {unassignedSlots.map((slot) => (
              <button
                key={slot.id}
                type="button"
                onClick={() => setActiveSlotModal(slot)}
                style={{
                  left: `${slot.x}%`,
                  top: `${slot.y}%`
                }}
                className="absolute -translate-x-1/2 -translate-y-1/2 group flex flex-col items-center cursor-pointer transition-transform hover:scale-110 z-10"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-dashed border-emerald-300/80 bg-emerald-950/50 text-emerald-200 shadow-md backdrop-blur-xs group-hover:border-white group-hover:bg-emerald-600/70">
                  <Plus className="h-4 w-4" />
                </div>
                <span className="mt-1 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-emerald-200 group-hover:bg-emerald-900 group-hover:text-white">
                  + {slot.position}
                </span>
              </button>
            ))}

            {/* Render Starter Player Tokens */}
            {starters.map((entry, index) => {
              const player = getPlayer(entry.playerId);
              const isBeingDragged = draggingId === entry.id;
              const isHoveredTarget = hoverTargetId === entry.id;
              
              // Coordinates: drag state > persisted pitchX/Y > formation slot fallback
              const fallbackSlot = formationSlots[index] || { x: 50, y: 50 };
              const posX = isBeingDragged && dragCoords ? dragCoords.x : (entry.pitchX ?? fallbackSlot.x);
              const posY = isBeingDragged && dragCoords ? dragCoords.y : (entry.pitchY ?? fallbackSlot.y);
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
                          <span>Editar Detalles / Dorsal</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveFromLineup(entry.id)}
                          className="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 text-left transition-colors cursor-pointer"
                        >
                          <UserX className="h-3.5 w-3.5 text-rose-600" />
                          <span>Descartar de Convocatoria</span>
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

        {/* Right Column: Bench & Matchday Squad Selector */}
        <div className="space-y-5">
          {/* Bench Section */}
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-700">
                  Banquillo
                </span>
                <h4 className="text-sm font-black text-[#002142] font-display">
                  Suplentes ({substitutes.length})
                </h4>
              </div>
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800 border border-amber-200">
                {substitutes.length} Disponibles
              </span>
            </div>

            {substitutes.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
                No hay jugadoras en el banquillo. Añade jugadoras desde la plantilla de abajo.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto pr-1">
                {substitutes.map((entry) => {
                  const player = getPlayer(entry.playerId);
                  return (
                    <div key={entry.id} className="flex items-center justify-between py-2.5 group">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <PlayerPitchAvatar
                          photoUrl={player?.photoUrl}
                          shirtNumber={entry.shirtNumber ?? player?.number}
                          fallbackNumber="–"
                          sizeClassName="h-8 w-8"
                          className="shrink-0 bg-slate-100 text-xs font-black text-slate-700 border border-slate-200"
                          alt={getPlayerName(entry.playerId)}
                        />
                        <div className="min-w-0">
                          <p className="truncate text-xs font-black text-slate-900">
                            {getPlayerName(entry.playerId)}
                          </p>
                          <p className="text-[10px] font-bold text-slate-400">
                            {entry.position || player?.position || 'SUB'} {entry.minuteSubbedIn ? `• Entró: ${entry.minuteSubbedIn}'` : ''}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleMoveToStarter(entry)}
                          className="rounded-lg bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 text-[10px] font-black text-emerald-700 border border-emerald-200 transition-colors cursor-pointer"
                          title="Pasar al 11 titular en el campo"
                        >
                          + Titular
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenEditModal(entry)}
                          className="p-1 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-100 cursor-pointer"
                          title="Editar detalles"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveFromLineup(entry.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 cursor-pointer"
                          title="Descartar del partido"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Full Squad Call-Up & Selection Roster */}
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex flex-col gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-sky-700">
                    Plantilla Completa
                  </span>
                  <h4 className="text-sm font-black text-[#002142] font-display">
                    Convocatoria y Reservas
                  </h4>
                </div>
                <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => setSquadFilterTab('all')}
                    className={`rounded-lg px-2 py-0.5 transition-all cursor-pointer ${
                      squadFilterTab === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Todas ({squadPlayers.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSquadFilterTab('unselected')}
                    className={`rounded-lg px-2 py-0.5 transition-all cursor-pointer ${
                      squadFilterTab === 'unselected' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Sin asignar ({unselectedPlayers.length})
                  </button>
                </div>
              </div>

              {/* Position Filter Pills */}
              <div className="flex items-center gap-1 overflow-x-auto pt-1">
                {(['ALL', 'GK', 'DEF', 'MID', 'FWD'] as const).map((pos) => (
                  <button
                    key={pos}
                    type="button"
                    onClick={() => setPositionFilter(pos)}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer ${
                      positionFilter === pos
                        ? 'bg-[#002142] text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {pos === 'ALL' ? 'Todas' : pos === 'GK' ? 'Porteras' : pos === 'DEF' ? 'Defensas' : pos === 'MID' ? 'Medios' : 'Delanteras'}
                  </button>
                ))}
              </div>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={squadSearchQuery}
                onChange={(e) => setSquadSearchQuery(e.target.value)}
                placeholder="Buscar por nombre, dorsal, posición..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none"
              />
            </div>

            {/* Squad List */}
            <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto pr-1">
              {filteredSquadList.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  No se encontraron jugadoras con este filtro.
                </div>
              ) : (
                filteredSquadList.map((player) => {
                  const existingLineup = lineupEntries.find((e) => e.playerId === player.id);
                  const isStarter = existingLineup?.starter;
                  const isBench = existingLineup && !existingLineup.starter;

                  return (
                    <div key={player.id} className="flex items-center justify-between py-2.5 group">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <PlayerPitchAvatar
                          photoUrl={player.photoUrl}
                          shirtNumber={player.number}
                          fallbackNumber="–"
                          sizeClassName="h-8 w-8"
                          className="shrink-0 bg-slate-100 text-xs font-black text-slate-700 border border-slate-200"
                          alt={`${player.firstName} ${player.lastName}`}
                        />
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-slate-900">
                            {player.firstName} {player.lastName}
                          </p>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400 font-medium">
                            <span>#{player.number ?? '–'}</span>
                            <span>•</span>
                            <span>{player.position || 'Jugadora'}</span>
                            {isStarter && (
                              <span className="rounded bg-emerald-100 px-1 py-0.2 text-[9px] font-black text-emerald-800">
                                Titular
                              </span>
                            )}
                            {isBench && (
                              <span className="rounded bg-amber-100 px-1 py-0.2 text-[9px] font-black text-amber-800">
                                Banquillo
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Quick Assign Buttons */}
                      <div className="flex items-center gap-1 shrink-0">
                        {!existingLineup ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleAddSquadPlayer(player, true)}
                              className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-2.5 py-1 text-[10px] font-black text-white shadow-xs transition-colors cursor-pointer"
                              title="Colocar como titular en la pizarra"
                            >
                              + Titular
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAddSquadPlayer(player, false)}
                              className="rounded-lg bg-slate-100 hover:bg-slate-200 px-2.5 py-1 text-[10px] font-bold text-slate-700 transition-colors cursor-pointer"
                              title="Añadir al banquillo"
                            >
                              + Banquillo
                            </button>
                          </>
                        ) : isStarter ? (
                          <button
                            type="button"
                            onClick={() => handleMoveToBench(existingLineup)}
                            className="rounded-lg bg-amber-50 hover:bg-amber-100 px-2 py-1 text-[10px] font-black text-amber-800 border border-amber-200 transition-colors cursor-pointer"
                            title="Pasar al banquillo"
                          >
                            Al Banquillo
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleMoveToStarter(existingLineup)}
                            className="rounded-lg bg-emerald-50 hover:bg-emerald-100 px-2 py-1 text-[10px] font-black text-emerald-700 border border-emerald-200 transition-colors cursor-pointer"
                            title="Pasar al 11 titular"
                          >
                            A Titular
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
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
              Selecciona una jugadora del banquillo o de la plantilla para colocarla exactamente en la posición de {activeSlotModal.position}.
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

              {/* Next list unselected players */}
              {unselectedPlayers.length > 0 && (
                <div className="pt-2">
                  <span className="text-[10px] font-black uppercase text-sky-700">Desde Reservas / Plantilla</span>
                  {unselectedPlayers.map((player) => {
                    const isCompat = isPositionCompatible(activeSlotModal.position, player.position);
                    return (
                      <button
                        key={player.id}
                        type="button"
                        onClick={() => handleAddSquadPlayer(player, true, activeSlotModal)}
                        className="flex w-full items-center justify-between py-2 text-left hover:bg-slate-50 px-2 rounded-xl cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <PlayerPitchAvatar
                            photoUrl={player.photoUrl}
                            shirtNumber={player.number}
                            fallbackNumber="–"
                            sizeClassName="h-7 w-7"
                            className="bg-slate-100 text-xs font-black text-slate-700"
                            alt={`${player.firstName} ${player.lastName}`}
                          />
                          <div>
                            <span className="text-xs font-bold text-slate-900">{player.firstName} {player.lastName}</span>
                            <span className="ml-1 text-[10px] text-slate-400">({player.position || 'Jugadora'})</span>
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

              {substitutes.length === 0 && unselectedPlayers.length === 0 && (
                <p className="py-6 text-center text-xs text-slate-400">
                  Todas las jugadoras de la plantilla están ya en el 11 titular.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

