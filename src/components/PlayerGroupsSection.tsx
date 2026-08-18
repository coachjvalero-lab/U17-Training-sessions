import React, { useState, useMemo } from 'react';
import { Users, Plus, Trash2, Edit3, Check, RefreshCw, Shield, UserCheck, AlertCircle } from 'lucide-react';
import { PlayerGroup, PlayerAttendance, SquadPlayer } from '../types';
import { DEFAULT_SQUAD_PLAYERS, GROUP_COLOR_PRESETS, getColorPreset } from '../constants/squad';
import { getAvailablePlayerNamesForGroups } from '../utils/attendanceStatistics';
import {
  buildAttendanceAliasMapFromMappings,
  createAttendanceNameResolver,
  DEFAULT_ATTENDANCE_ALIASES
} from '../utils/attendanceIdentity';
import { readAttendanceIdentityMappings } from '../utils/attendanceIdentityStore';

interface PlayerGroupsSectionProps {
  groups: PlayerGroup[];
  squadRoster?: string[];
  squadPlayers?: SquadPlayer[];
  attendance?: PlayerAttendance[];
  onChangeGroups: (groups: PlayerGroup[]) => void;
  onChangeRoster?: (roster: string[]) => void;
  rosterReadOnly?: boolean;
}

export const PlayerGroupsSection: React.FC<PlayerGroupsSectionProps> = ({
  groups,
  squadRoster = DEFAULT_SQUAD_PLAYERS,
  squadPlayers = [],
  attendance = [],
  onChangeGroups,
  onChangeRoster,
  rosterReadOnly = false
}) => {
  const [isEditingRoster, setIsEditingRoster] = useState(false);
  const [rosterInput, setRosterInput] = useState(squadRoster.join(', '));
  const [selectedUnassignedPlayer, setSelectedUnassignedPlayer] = useState<string | null>(null);

  const resolver = useMemo(() => {
    const mappings = readAttendanceIdentityMappings();
    return createAttendanceNameResolver(
      squadPlayers,
      {
        ...DEFAULT_ATTENDANCE_ALIASES,
        ...buildAttendanceAliasMapFromMappings(mappings)
      },
      mappings
    );
  }, [squadPlayers]);

  // Compute attending vs absent lists
  const attendingPlayers = useMemo(() => {
    return getAvailablePlayerNamesForGroups(squadRoster, attendance, {
      resolveName: resolver.resolveName
    });
  }, [attendance, resolver, squadRoster]);

  const gymPlayers = useMemo(() => {
    if (!attendance || attendance.length === 0) return [];
    return attendance.filter(a => a.status === 'Gym');
  }, [attendance]);

  const absentPlayers = useMemo(() => {
    if (!attendance || attendance.length === 0) return [];
    return attendance.filter(a => a.status === 'Absent');
  }, [attendance]);

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

  // Unassigned attending players vs unassigned all
  const unassignedAttendingPlayers = attendingPlayers.filter(p => !allAssignedPlayers.has(p));

  // Add new group
  const handleAddGroup = () => {
    const nextNum = groups.length + 1;
    const colorPreset = GROUP_COLOR_PRESETS[(groups.length) % GROUP_COLOR_PRESETS.length];
    const newGroup: PlayerGroup = {
      id: `group-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      groupNumber: nextNum,
      bibColor: colorPreset.hex,
      name: `Group ${nextNum}`,
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

  // Auto divide squad into N groups using attending players
  const handleAutoDivide = (numGroups: number, useOnlyAttending = true) => {
    const targetList = useOnlyAttending ? attendingPlayers : squadRoster;
    if (targetList.length === 0) return;

    // Shuffle roster randomly or keep order
    const shuffled = [...targetList];
    
    const newGroups: PlayerGroup[] = [];
    for (let i = 0; i < numGroups; i++) {
      const preset = GROUP_COLOR_PRESETS[i % GROUP_COLOR_PRESETS.length];
      newGroups.push({
        id: `group-auto-${i + 1}-${Date.now()}`,
        groupNumber: i + 1,
        bibColor: preset.hex,
        name: `Group ${i + 1}`,
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
    if (window.confirm('Are you sure you want to clear all groups?')) {
      onChangeGroups([]);
    }
  };

  // Save edited roster
  const handleSaveRoster = () => {
    if (rosterReadOnly) return;
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
    if (rosterReadOnly) return;
    if (onChangeRoster) {
      onChangeRoster(DEFAULT_SQUAD_PLAYERS);
      setRosterInput(DEFAULT_SQUAD_PLAYERS.join(', '));
    }
    setIsEditingRoster(false);
  };

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 shadow-md shadow-slate-100/80 space-y-5 print:hidden">
      
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 bg-[#002142] text-[#a79078] rounded-xl shadow-sm">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-display font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <span>Player Groups</span>
              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1">
                <UserCheck className="w-3 h-3" />
                <span>{attendingPlayers.length}/{squadRoster.length} Attending</span>
              </span>
            </h2>
            <p className="text-[10px] text-slate-400 font-bold">
              Assign attending players to groups for training drills.
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-[10px] font-extrabold text-slate-600 gap-1">
            <span className="px-1.5 text-emerald-700 font-black">Split Attending:</span>
            <button
              type="button"
              onClick={() => handleAutoDivide(2, true)}
              className="px-2 py-1 bg-white hover:bg-emerald-50 hover:text-emerald-700 rounded-lg shadow-sm transition-all"
              title="Split attending players into 2 groups"
            >
              2 Groups
            </button>
            <button
              type="button"
              onClick={() => handleAutoDivide(3, true)}
              className="px-2 py-1 bg-white hover:bg-emerald-50 hover:text-emerald-700 rounded-lg shadow-sm transition-all"
              title="Split attending players into 3 groups"
            >
              3 Groups
            </button>
            <button
              type="button"
              onClick={() => handleAutoDivide(4, true)}
              className="px-2 py-1 bg-white hover:bg-emerald-50 hover:text-emerald-700 rounded-lg shadow-sm transition-all"
              title="Split attending players into 4 groups"
            >
              4 Groups
            </button>
          </div>

          <button
            type="button"
            onClick={handleAddGroup}
            className="flex items-center space-x-1 bg-[#002142] hover:bg-[#002e5c] text-white text-xs font-bold px-3 py-2 rounded-xl transition-all shadow-sm"
          >
            <Plus className="w-3.5 h-3.5 text-[#a79078]" />
            <span>Add Group</span>
          </button>

          {!rosterReadOnly && <button
            type="button"
            onClick={() => setIsEditingRoster(!isEditingRoster)}
            className="flex items-center space-x-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-2.5 py-2 rounded-xl transition-all border border-slate-200"
            title="Edit player roster"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Roster</span>
          </button>}

          {groups.length > 0 && (
            <button
              type="button"
              onClick={handleClearGroups}
              className="p-2 text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
              title="Clear all groups"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Roster Editor Drawer */}
      {isEditingRoster && !rosterReadOnly && (
        <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase text-slate-700 tracking-wider">
              Edit Squad Player Roster
            </span>
            <button
              type="button"
              onClick={handleResetRoster}
              className="text-[10px] font-bold text-emerald-700 hover:underline flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Reset U17 Roster</span>
            </button>
          </div>
          <p className="text-[10px] text-slate-500">
            Enter names separated by commas:
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
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveRoster}
              className="px-3 py-1.5 text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg shadow-sm flex items-center space-x-1"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Save Roster</span>
            </button>
          </div>
        </div>
      )}

      {/* Unassigned Players Pool */}
      <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-slate-400" />
            <span>Unassigned Attending Players ({unassignedAttendingPlayers.length})</span>
          </span>
          {unassignedAttendingPlayers.length === 0 && (
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200/60">
              ✓ All attending players assigned!
            </span>
          )}
        </div>

        {unassignedAttendingPlayers.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {unassignedAttendingPlayers.map(player => {
              const isSelected = selectedUnassignedPlayer === player;
              return (
                <div key={player} className="relative group">
                  <button
                    type="button"
                    onClick={() => setSelectedUnassignedPlayer(isSelected ? null : player)}
                    className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all flex items-center space-x-1.5 cursor-pointer ${
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
                        Assign to:
                      </div>
                      {groups.map(g => {
                        const preset = getColorPreset(g.bibColor);
                        return (
                          <button
                            key={g.id}
                            type="button"
                            onClick={() => handleAddPlayerToGroup(g.id, player)}
                            className="w-full text-left text-xs font-bold px-2.5 py-1.5 rounded-lg hover:bg-slate-50 flex items-center space-x-2 transition-colors cursor-pointer"
                          >
                            <span 
                              className="w-3 h-3 rounded-full shrink-0 border border-black/10" 
                              style={{ backgroundColor: g.bibColor || preset.hex }} 
                            />
                            <span className="truncate">{g.name || `Group ${g.groupNumber}`}</span>
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
            All attending players ({attendingPlayers.length}) are currently assigned to groups below.
          </p>
        )}

        {/* Absent & Gym Players Notice */}
        {(absentPlayers.length > 0 || gymPlayers.length > 0) && (
          <div className="pt-2 border-t border-slate-200/60 space-y-2">
            {absentPlayers.length > 0 && (
              <div className="flex items-center gap-2 text-[11px] font-bold text-rose-700 bg-rose-50/50 p-2 rounded-xl">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                <span>
                  Absent ({absentPlayers.length}): {absentPlayers.map(a => `${a.playerName} (${a.absenceReason || 'Absent'})`).join(', ')}
                </span>
              </div>
            )}
            {gymPlayers.length > 0 && (
              <div className="flex items-center gap-2 text-[11px] font-bold text-blue-700 bg-blue-50/50 p-2 rounded-xl border border-blue-100">
                <Users className="w-3.5 h-3.5 shrink-0 text-blue-500" />
                <span>
                  En Gym ({gymPlayers.length}): {gymPlayers.map(a => a.playerName).join(', ')}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Groups Grid (Interactive Screen Cards) */}
      {groups.length === 0 ? (
        <div className="text-center py-8 bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
          <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-xs font-bold text-slate-600">No player groups configured</p>
          <p className="text-[10px] text-slate-400 mt-1 max-w-sm mx-auto">
            Click <strong className="text-slate-700">"Add Group"</strong> or select <strong className="text-emerald-600 font-bold">"2 Groups" / "3 Groups"</strong> to automatically split squad.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                      value={group.name || `Group ${group.groupNumber}`}
                      onChange={(e) => handleUpdateGroup(group.id, { name: e.target.value })}
                      placeholder="Group name..."
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
                      title="Delete group"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Player Badges in Group */}
                <div className="min-h-[50px] space-y-2">
                  <div className="flex items-center justify-between text-[9px] font-extrabold uppercase tracking-wider text-slate-400">
                    <span>Players ({playerList.length})</span>
                    <span>Click to remove</span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {playerList.map(player => (
                      <span
                        key={player}
                        onClick={() => handleRemovePlayerFromGroup(group.id, player)}
                        className={`text-xs font-extrabold px-2.5 py-1 rounded-xl border cursor-pointer transition-all hover:opacity-80 shadow-sm flex items-center space-x-1 ${preset.badgeClass}`}
                        title="Click to remove from group"
                      >
                        <span>{player}</span>
                        <span className="text-[10px] opacity-60">×</span>
                      </span>
                    ))}

                    {playerList.length === 0 && (
                      <p className="text-[11px] italic text-slate-400 py-2">
                        No players assigned yet. Click on unassigned players above to add them.
                      </p>
                    )}
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

    </section>
  );
};
