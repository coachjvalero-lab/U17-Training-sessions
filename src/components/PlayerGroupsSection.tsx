import React, { useState } from 'react';
import { Users, Plus, Trash2, Shuffle, Edit3, Check, RefreshCw, Layers, Shield } from 'lucide-react';
import { PlayerGroup } from '../types';
import { DEFAULT_SQUAD_PLAYERS, GROUP_COLOR_PRESETS, getColorPreset } from '../constants/squad';

interface PlayerGroupsSectionProps {
  groups: PlayerGroup[];
  squadRoster?: string[];
  onChangeGroups: (groups: PlayerGroup[]) => void;
  onChangeRoster?: (roster: string[]) => void;
}

export const PlayerGroupsSection: React.FC<PlayerGroupsSectionProps> = ({
  groups,
  squadRoster = DEFAULT_SQUAD_PLAYERS,
  onChangeGroups,
  onChangeRoster
}) => {
  const [isEditingRoster, setIsEditingRoster] = useState(false);
  const [rosterInput, setRosterInput] = useState(squadRoster.join(', '));
  const [selectedUnassignedPlayer, setSelectedUnassignedPlayer] = useState<string | null>(null);

  // Helper to get array of player names in a group
  const getGroupPlayersList = (group: PlayerGroup): string[] => {
    if (!group.players) return [];
    return group.players
      .split(',')
      .map(p => p.trim())
      .filter(p => p.length > 0);
  };

  // Find all assigned players across all groups
  const allAssignedPlayers = new Set<string>();
  groups.forEach(g => {
    getGroupPlayersList(g).forEach(p => allAssignedPlayers.add(p));
  });

  // Unassigned players
  const unassignedPlayers = squadRoster.filter(p => !allAssignedPlayers.has(p));

  // Add new group
  const handleAddGroup = () => {
    const nextNum = groups.length + 1;
    const colorPreset = GROUP_COLOR_PRESETS[(groups.length) % GROUP_COLOR_PRESETS.length];
    const newGroup: PlayerGroup = {
      id: `group-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      groupNumber: nextNum,
      bibColor: colorPreset.hex,
      name: `Grupo ${nextNum} (${colorPreset.name})`,
      players: ''
    };
    onChangeGroups([...groups, newGroup]);
  };

  // Delete group
  const handleDeleteGroup = (groupId: string) => {
    const updated = groups.filter(g => g.id !== groupId);
    onChangeGroups(updated);
  };

  // Update group properties
  const handleUpdateGroup = (groupId: string, fields: Partial<PlayerGroup>) => {
    const updated = groups.map(g => {
      if (g.id === groupId) {
        return { ...g, ...fields };
      }
      return g;
    });
    onChangeGroups(updated);
  };

  // Add player to group
  const handleAddPlayerToGroup = (groupId: string, playerName: string) => {
    const updated = groups.map(g => {
      const currentList = getGroupPlayersList(g);
      if (g.id === groupId) {
        if (!currentList.includes(playerName)) {
          return { ...g, players: [...currentList, playerName].join(', ') };
        }
      } else {
        // Remove from other group if present to keep groups disjoint
        if (currentList.includes(playerName)) {
          return { ...g, players: currentList.filter(p => p !== playerName).join(', ') };
        }
      }
      return g;
    });
    onChangeGroups(updated);
    setSelectedUnassignedPlayer(null);
  };

  // Remove player from group
  const handleRemovePlayerFromGroup = (groupId: string, playerName: string) => {
    const updated = groups.map(g => {
      if (g.id === groupId) {
        const currentList = getGroupPlayersList(g);
        return { ...g, players: currentList.filter(p => p !== playerName).join(', ') };
      }
      return g;
    });
    onChangeGroups(updated);
  };

  // Auto divide squad into N groups
  const handleAutoDivide = (numGroups: number) => {
    if (squadRoster.length === 0) return;

    // Shuffle roster randomly or keep order
    const shuffled = [...squadRoster];
    
    const newGroups: PlayerGroup[] = [];
    for (let i = 0; i < numGroups; i++) {
      const preset = GROUP_COLOR_PRESETS[i % GROUP_COLOR_PRESETS.length];
      newGroups.push({
        id: `group-auto-${i + 1}-${Date.now()}`,
        groupNumber: i + 1,
        bibColor: preset.hex,
        name: `Grupo ${i + 1} (${preset.name})`,
        players: ''
      });
    }

    // Distribute players round-robin
    shuffled.forEach((player, index) => {
      const targetGroupIndex = index % numGroups;
      const currentPlayers = newGroups[targetGroupIndex].players;
      newGroups[targetGroupIndex].players = currentPlayers 
        ? `${currentPlayers}, ${player}` 
        : player;
    });

    onChangeGroups(newGroups);
  };

  // Clear all assignments
  const handleClearGroups = () => {
    if (window.confirm('¿Seguro que quieres vaciar los grupos?')) {
      onChangeGroups([]);
    }
  };

  // Save edited roster
  const handleSaveRoster = () => {
    const parsed = rosterInput
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    if (onChangeRoster) {
      onChangeRoster(parsed);
    }
    setIsEditingRoster(false);
  };

  // Reset to default U17 squad
  const handleResetRoster = () => {
    if (onChangeRoster) {
      onChangeRoster(DEFAULT_SQUAD_PLAYERS);
      setRosterInput(DEFAULT_SQUAD_PLAYERS.join(', '));
    }
    setIsEditingRoster(false);
  };

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 shadow-md shadow-slate-100/80 space-y-5 print:hidden">
      
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3.5 print:border-slate-300">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 bg-[#002142] text-[#a79078] rounded-xl shadow-sm print:hidden">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-display font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <span>Grupos de Jugadoras / Player Groups</span>
              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full print:hidden">
                {squadRoster.length} Jugadoras
              </span>
            </h2>
            <p className="text-[10px] text-slate-400 font-bold print:hidden">
              Asigna las jugadoras a petos/grupos de colores para los ejercicios de la sesión.
            </p>
          </div>
        </div>

        {/* Quick Actions (Screen Only) */}
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-[10px] font-extrabold text-slate-600 gap-1">
            <span className="px-1.5 text-slate-400">Repartir:</span>
            <button
              type="button"
              onClick={() => handleAutoDivide(2)}
              className="px-2 py-1 bg-white hover:bg-emerald-50 hover:text-emerald-700 rounded-lg shadow-sm transition-all"
              title="Dividir plantilla en 2 grupos"
            >
              2 Grupos
            </button>
            <button
              type="button"
              onClick={() => handleAutoDivide(3)}
              className="px-2 py-1 bg-white hover:bg-emerald-50 hover:text-emerald-700 rounded-lg shadow-sm transition-all"
              title="Dividir plantilla en 3 grupos"
            >
              3 Grupos
            </button>
            <button
              type="button"
              onClick={() => handleAutoDivide(4)}
              className="px-2 py-1 bg-white hover:bg-emerald-50 hover:text-emerald-700 rounded-lg shadow-sm transition-all"
              title="Dividir plantilla en 4 grupos"
            >
              4 Grupos
            </button>
          </div>

          <button
            type="button"
            onClick={handleAddGroup}
            className="flex items-center space-x-1 bg-[#002142] hover:bg-[#002e5c] text-white text-xs font-bold px-3 py-2 rounded-xl transition-all shadow-sm"
          >
            <Plus className="w-3.5 h-3.5 text-[#a79078]" />
            <span>Añadir Grupo</span>
          </button>

          <button
            type="button"
            onClick={() => setIsEditingRoster(!isEditingRoster)}
            className="flex items-center space-x-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-2.5 py-2 rounded-xl transition-all border border-slate-200"
            title="Editar lista de jugadoras"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Plantilla</span>
          </button>

          {groups.length > 0 && (
            <button
              type="button"
              onClick={handleClearGroups}
              className="p-2 text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
              title="Vaciar todos los grupos"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Roster Editor Drawer (Screen Only) */}
      {isEditingRoster && (
        <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3 print:hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase text-slate-700 tracking-wider">
              Editar Lista de Jugadoras de la Plantilla
            </span>
            <button
              type="button"
              onClick={handleResetRoster}
              className="text-[10px] font-bold text-emerald-700 hover:underline flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Restablecer Plantilla U17</span>
            </button>
          </div>
          <p className="text-[10px] text-slate-500">
            Introduce los nombres separados por comas:
          </p>
          <textarea
            value={rosterInput}
            onChange={(e) => setRosterInput(e.target.value)}
            rows={3}
            className="w-full text-xs font-semibold bg-white border border-slate-300 rounded-xl p-2.5 focus:outline-none focus:border-emerald-500"
          />
          <div className="flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => setIsEditingRoster(false)}
              className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-200 rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSaveRoster}
              className="px-3 py-1.5 text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg shadow-sm flex items-center space-x-1"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Guardar Plantilla</span>
            </button>
          </div>
        </div>
      )}

      {/* Unassigned Players Pool (Screen Only) */}
      <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-4 space-y-2.5 print:hidden">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-slate-400" />
            <span>Jugadoras Sin Grupo Asignado ({unassignedPlayers.length})</span>
          </span>
          {unassignedPlayers.length === 0 && (
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200/60">
              ✓ ¡Toda la plantilla está asignada!
            </span>
          )}
        </div>

        {unassignedPlayers.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {unassignedPlayers.map(player => {
              const isSelected = selectedUnassignedPlayer === player;
              return (
                <div key={player} className="relative group">
                  <button
                    type="button"
                    onClick={() => setSelectedUnassignedPlayer(isSelected ? null : player)}
                    className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all flex items-center space-x-1.5 ${
                      isSelected 
                        ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-emerald-500/30' 
                        : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 hover:border-slate-300 shadow-sm'
                    }`}
                  >
                    <span>{player}</span>
                    <span className="text-[10px] opacity-60">+</span>
                  </button>

                  {/* Popover options to assign player directly to a group when clicked */}
                  {isSelected && groups.length > 0 && (
                    <div className="absolute top-full left-0 mt-1.5 z-20 bg-white border border-slate-200 rounded-xl shadow-xl p-2 space-y-1 min-w-[160px] animate-in fade-in zoom-in-95 duration-100">
                      <div className="text-[9px] font-black uppercase tracking-wider text-slate-400 px-2 py-1">
                        Asignar a:
                      </div>
                      {groups.map(g => {
                        const preset = getColorPreset(g.bibColor);
                        return (
                          <button
                            key={g.id}
                            type="button"
                            onClick={() => handleAddPlayerToGroup(g.id, player)}
                            className="w-full text-left text-xs font-bold px-2.5 py-1.5 rounded-lg hover:bg-slate-50 flex items-center space-x-2 transition-colors"
                          >
                            <span 
                              className="w-3 h-3 rounded-full shrink-0 border border-black/10" 
                              style={{ backgroundColor: g.bibColor || preset.hex }} 
                            />
                            <span className="truncate">{g.name || `Grupo ${g.groupNumber}`}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs italic text-slate-400">
            Todas las jugadoras ({squadRoster.length}) están actualmente distribuidas en los grupos creados abajo.
          </p>
        )}
      </div>

      {/* Groups Grid (Interactive Screen Cards) */}
      {groups.length === 0 ? (
        <div className="text-center py-8 bg-slate-50 border border-dashed border-slate-200 rounded-2xl print:hidden">
          <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-xs font-bold text-slate-600">No hay grupos de jugadoras configurados</p>
          <p className="text-[10px] text-slate-400 mt-1 max-w-sm mx-auto">
            Haz clic en <strong className="text-slate-700">"Añadir Grupo"</strong> o selecciona <strong className="text-emerald-600 font-bold">"2 Grupos" / "3 Grupos"</strong> para repartir automáticamente la plantilla de la U17.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 print:hidden">
          {groups.map((group) => {
            const preset = getColorPreset(group.bibColor);
            const playerList = getGroupPlayersList(group);

            return (
              <div 
                key={group.id} 
                className={`border rounded-2xl p-4 space-y-3 transition-all ${preset.bgLight} ${preset.borderClass} shadow-sm hover:shadow-md`}
              >
                {/* Group Card Header */}
                <div className="flex items-center justify-between gap-2 border-b border-slate-200/60 pb-2">
                  <div className="flex items-center space-x-2 flex-1 min-w-0">
                    <span 
                      className="w-3.5 h-3.5 rounded-full shrink-0 border border-black/20 shadow-sm"
                      style={{ backgroundColor: group.bibColor || preset.hex }}
                    />
                    <input
                      type="text"
                      value={group.name || `Grupo ${group.groupNumber}`}
                      onChange={(e) => handleUpdateGroup(group.id, { name: e.target.value })}
                      placeholder="Nombre del grupo..."
                      className="w-full text-xs font-black bg-transparent border-b border-transparent focus:border-slate-400 focus:outline-none truncate"
                    />
                  </div>

                  {/* Color Selector */}
                  <div className="flex items-center space-x-1 shrink-0">
                    <select
                      value={group.bibColor}
                      onChange={(e) => handleUpdateGroup(group.id, { bibColor: e.target.value })}
                      className="text-[10px] font-bold bg-white border border-slate-200 px-1.5 py-1 rounded-lg focus:outline-none cursor-pointer"
                    >
                      {GROUP_COLOR_PRESETS.map(c => (
                        <option key={c.id} value={c.hex}>
                          {c.label}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => handleDeleteGroup(group.id)}
                      className="text-slate-400 hover:text-rose-600 p-1 rounded-lg transition-colors"
                      title="Eliminar grupo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Player Badges in Group */}
                <div className="min-h-[50px] space-y-2">
                  <div className="flex items-center justify-between text-[9px] font-extrabold uppercase tracking-wider text-slate-400">
                    <span>Jugadoras ({playerList.length})</span>
                    <span>Haz clic para quitar</span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {playerList.map(player => (
                      <span
                        key={player}
                        onClick={() => handleRemovePlayerFromGroup(group.id, player)}
                        className={`text-xs font-extrabold px-2.5 py-1 rounded-xl border cursor-pointer transition-all hover:opacity-80 shadow-sm flex items-center space-x-1 ${preset.badgeClass}`}
                        title="Clic para remover de este grupo"
                      >
                        <span>{player}</span>
                        <span className="text-[10px] opacity-60">×</span>
                      </span>
                    ))}

                    {playerList.length === 0 && (
                      <p className="text-[11px] italic text-slate-400 py-2">
                        Ninguna jugadora asignada aún. Haz clic en las jugadoras de arriba para añadirlas.
                      </p>
                    )}
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Display Summary for Print PDF View */}
      <div className="hidden print:block space-y-2">
        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-300 pb-1">
          Distribución de Jugadoras por Grupos
        </h3>
        {groups.length === 0 ? (
          <p className="text-xs italic text-slate-500">Sin grupos definidos</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 text-xs">
            {groups.map(g => {
              const preset = getColorPreset(g.bibColor);
              const pList = getGroupPlayersList(g);
              return (
                <div key={g.id} className="border border-slate-300 p-2 rounded">
                  <div className="font-bold text-slate-900 border-b border-slate-200 pb-0.5 mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full inline-block border border-black/30" style={{ backgroundColor: g.bibColor || preset.hex }} />
                      <span>{g.name || `Grupo ${g.groupNumber}`}</span>
                    </span>
                    <span className="text-[10px] text-slate-500 font-semibold">({pList.length} jugadoras)</span>
                  </div>
                  <p className="text-slate-700 font-medium leading-relaxed">
                    {pList.length > 0 ? pList.join(', ') : 'Sin asignación'}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </section>
  );
};
