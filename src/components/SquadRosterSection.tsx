import React, { useState } from 'react';
import { 
  Users, 
  UserPlus, 
  Search, 
  Filter, 
  Edit2, 
  Trash2, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  XCircle, 
  Shield, 
  Hash, 
  Tag, 
  FileText, 
  Save, 
  X,
  UserCheck,
  LayoutGrid,
  List,
  Camera,
  Globe,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { SquadPlayer } from '../types';

interface SquadRosterSectionProps {
  players: SquadPlayer[];
  onUpdatePlayers: (updated: SquadPlayer[]) => void;
}

// Preset Female Athlete Avatar Options
const AVATAR_PRESETS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&q=80&w=250',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=250',
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&q=80&w=250',
  'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=crop&q=80&w=250',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=250',
  'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&q=80&w=250',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=250',
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=250',
  'https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?auto=format&fit=crop&q=80&w=250'
];

export const SquadRosterSection: React.FC<SquadRosterSectionProps> = ({
  players,
  onUpdatePlayers
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [positionFilter, setPositionFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  
  // Modal State for Adding/Editing player
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<SquadPlayer | null>(null);

  const [formData, setFormData] = useState<{
    firstName: string;
    lastName: string;
    number: string;
    position: SquadPlayer['position'];
    status: SquadPlayer['status'];
    notes: string;
    photoUrl: string;
    age: string;
    nationality: string;
    preferredFoot: 'Right' | 'Left' | 'Both';
    heightCm: string;
    weightKg: string;
  }>({
    firstName: '',
    lastName: '',
    number: '',
    position: 'CM',
    status: 'Active',
    notes: '',
    photoUrl: AVATAR_PRESETS[0],
    age: '16',
    nationality: 'Saudi Arabia 🇸🇦',
    preferredFoot: 'Right',
    heightCm: '168',
    weightKg: '56'
  });

  const handleOpenAddModal = () => {
    setEditingPlayer(null);
    setFormData({
      firstName: '',
      lastName: '',
      number: String(players.length + 1),
      position: 'CM',
      status: 'Active',
      notes: '',
      photoUrl: AVATAR_PRESETS[Math.floor(Math.random() * AVATAR_PRESETS.length)],
      age: '16',
      nationality: 'Saudi Arabia 🇸🇦',
      preferredFoot: 'Right',
      heightCm: '168',
      weightKg: '56'
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (player: SquadPlayer) => {
    setEditingPlayer(player);
    setFormData({
      firstName: player.firstName,
      lastName: player.lastName,
      number: String(player.number || ''),
      position: player.position,
      status: player.status,
      notes: player.notes || '',
      photoUrl: player.photoUrl || AVATAR_PRESETS[0],
      age: String(player.age || 16),
      nationality: player.nationality || 'Saudi Arabia 🇸🇦',
      preferredFoot: player.preferredFoot || 'Right',
      heightCm: String(player.heightCm || 168),
      weightKg: String(player.weightKg || 56)
    });
    setIsModalOpen(true);
  };

  const handleSavePlayer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.firstName.trim() || !formData.lastName.trim()) return;

    if (editingPlayer) {
      const updated = players.map(p => 
        p.id === editingPlayer.id 
          ? {
              ...p,
              firstName: formData.firstName.trim(),
              lastName: formData.lastName.trim(),
              number: formData.number ? Number(formData.number) : undefined,
              position: formData.position,
              status: formData.status,
              notes: formData.notes.trim(),
              photoUrl: formData.photoUrl.trim() || undefined,
              age: formData.age ? Number(formData.age) : undefined,
              nationality: formData.nationality.trim() || 'Saudi Arabia 🇸🇦',
              preferredFoot: formData.preferredFoot,
              heightCm: formData.heightCm ? Number(formData.heightCm) : undefined,
              weightKg: formData.weightKg ? Number(formData.weightKg) : undefined
            }
          : p
      );
      onUpdatePlayers(updated);
    } else {
      const newPlayer: SquadPlayer = {
        id: 'p-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        number: formData.number ? Number(formData.number) : undefined,
        position: formData.position,
        status: formData.status,
        notes: formData.notes.trim(),
        photoUrl: formData.photoUrl.trim() || undefined,
        age: formData.age ? Number(formData.age) : 16,
        nationality: formData.nationality.trim() || 'Saudi Arabia 🇸🇦',
        preferredFoot: formData.preferredFoot,
        heightCm: formData.heightCm ? Number(formData.heightCm) : 168,
        weightKg: formData.weightKg ? Number(formData.weightKg) : 56,
        joinedDate: new Date().toISOString().split('T')[0]
      };
      onUpdatePlayers([...players, newPlayer]);
    }

    setIsModalOpen(false);
  };

  const handleDeletePlayer = (id: string, name: string) => {
    if (confirm(`Are you sure you want to remove ${name} from the squad roster?`)) {
      onUpdatePlayers(players.filter(p => p.id !== id));
    }
  };

  const handleQuickStatusChange = (id: string, newStatus: SquadPlayer['status']) => {
    const updated = players.map(p => p.id === id ? { ...p, status: newStatus } : p);
    onUpdatePlayers(updated);
  };

  // Filter Logic
  const filteredPlayers = players.filter(p => {
    const fullName = `${p.firstName} ${p.lastName}`.toLowerCase();
    const matchesSearch = fullName.includes(searchTerm.toLowerCase()) || 
                          String(p.number || '').includes(searchTerm) ||
                          p.position.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (p.notes || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPos = positionFilter === 'ALL' || 
                       (positionFilter === 'GK' && p.position === 'GK') ||
                       (positionFilter === 'DEF' && ['CB', 'LB', 'RB'].includes(p.position)) ||
                       (positionFilter === 'MID' && ['CM', 'CAM', 'CDM'].includes(p.position)) ||
                       (positionFilter === 'FWD' && ['RW', 'LW', 'ST'].includes(p.position));
    const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter;

    return matchesSearch && matchesPos && matchesStatus;
  });

  const getStatusBadge = (status: SquadPlayer['status']) => {
    switch (status) {
      case 'Active':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            <span>Active</span>
          </span>
        );
      case 'Injured':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertTriangle className="w-3 h-3 text-rose-500" />
            <span>Injured</span>
          </span>
        );
      case 'Recovering':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-500" />
            <span>Rehab</span>
          </span>
        );
      case 'Absent':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
            <XCircle className="w-3 h-3 text-slate-400" />
            <span>Absent</span>
          </span>
        );
    }
  };

  const getPositionBadge = (pos: SquadPlayer['position']) => {
    let color = 'bg-slate-100 text-slate-800 border-slate-200';
    if (pos === 'GK') color = 'bg-sky-100 text-sky-800 border-sky-300 font-black';
    else if (['CB', 'LB', 'RB'].includes(pos)) color = 'bg-indigo-100 text-indigo-800 border-indigo-200';
    else if (['CM', 'CAM', 'CDM'].includes(pos)) color = 'bg-purple-100 text-purple-800 border-purple-200';
    else if (['RW', 'LW', 'ST'].includes(pos)) color = 'bg-emerald-100 text-emerald-800 border-emerald-200';

    return (
      <span className={`inline-block px-2 py-0.5 rounded text-xs font-mono font-bold border ${color}`}>
        {pos}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Banner - Clean Light Al Ula Style */}
      <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-emerald-700 text-xs font-mono font-bold uppercase tracking-widest mb-1">
            <Users className="w-4 h-4 text-emerald-600" />
            <span>Plantilla & Iterpro Team Hub</span>
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-[#002142] font-display">
            Al Ula FC Women U17 Squad Roster
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Complete squad database with player photos, jersey dorsals, physical metrics, and status tracking.
          </p>
        </div>

        <div className="flex items-center space-x-3 w-full md:w-auto justify-between md:justify-end">
          {/* View Toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'grid'
                  ? 'bg-white text-[#002142] shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Cards</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'table'
                  ? 'bg-white text-[#002142] shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Table</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleOpenAddModal}
            className="px-4 py-2.5 bg-[#002142] hover:bg-[#001830] text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-slate-900/10 flex items-center space-x-2 shrink-0 cursor-pointer"
          >
            <UserPlus className="w-4 h-4 text-emerald-400" />
            <span>Add Player</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search player name, dorsal #, position..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <div className="flex items-center space-x-1 text-xs font-bold text-slate-500 mr-1">
            <Filter className="w-3.5 h-3.5" />
            <span>Pos:</span>
          </div>
          {['ALL', 'GK', 'DEF', 'MID', 'FWD'].map((pos) => (
            <button
              key={pos}
              type="button"
              onClick={() => setPositionFilter(pos)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                positionFilter === pos
                  ? 'bg-[#002142] text-white shadow-sm'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              {pos}
            </button>
          ))}

          <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block" />

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1 bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Injured">Injured</option>
            <option value="Recovering">Rehab</option>
            <option value="Absent">Absent</option>
          </select>
        </div>
      </div>

      {/* CARDS GRID VIEW (Iterpro / FIFA Style Player Cards) */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {filteredPlayers.length === 0 ? (
            <div className="col-span-full bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
              No squad players match the filter parameters.
            </div>
          ) : (
            filteredPlayers.map((player) => (
              <div 
                key={player.id}
                className="bg-white border border-slate-200/90 hover:border-emerald-500/60 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between relative group overflow-hidden"
              >
                {/* Top Accent Stripe */}
                <div className="absolute top-0 inset-x-0 h-1 bg-[#002142] group-hover:bg-emerald-600 transition-colors" />

                <div>
                  {/* Card Header: Dorsal Number & Status */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-8 h-8 rounded-xl bg-[#002142] text-white font-mono font-black text-sm flex items-center justify-center shadow-sm">
                      #{player.number || '0'}
                    </div>
                    {getStatusBadge(player.status)}
                  </div>

                  {/* Player Avatar & Name Block */}
                  <div className="flex flex-col items-center text-center space-y-2.5 my-2">
                    <div className="relative">
                      <img
                        src={player.photoUrl || AVATAR_PRESETS[0]}
                        alt={`${player.firstName} ${player.lastName}`}
                        className="w-20 h-20 rounded-2xl object-cover border-2 border-slate-200 group-hover:border-emerald-500 transition-colors shadow-sm bg-slate-100"
                        onError={(e) => {
                          // Fallback avatar
                          (e.target as HTMLImageElement).src = AVATAR_PRESETS[0];
                        }}
                      />
                      <div className="absolute -bottom-2 inset-x-0 flex justify-center">
                        {getPositionBadge(player.position)}
                      </div>
                    </div>

                    <div className="pt-2">
                      <h3 className="text-base font-extrabold text-[#002142] leading-tight">
                        {player.firstName} {player.lastName}
                      </h3>
                      <p className="text-[11px] font-semibold text-slate-400 mt-0.5 flex items-center justify-center space-x-1">
                        <span>{player.nationality || 'Saudi Arabia 🇸🇦'}</span>
                        <span>•</span>
                        <span>{player.age || 16} yrs</span>
                      </p>
                    </div>
                  </div>

                  {/* Metrics Bar (Height, Weight, Foot) */}
                  <div className="grid grid-cols-3 gap-1 bg-slate-50 border border-slate-100 rounded-xl p-2 text-center text-[10px] font-mono text-slate-600 my-3">
                    <div>
                      <span className="block text-[9px] text-slate-400 font-sans font-bold uppercase">Height</span>
                      <span className="font-bold text-slate-800">{player.heightCm || 168} cm</span>
                    </div>
                    <div className="border-x border-slate-200 px-1">
                      <span className="block text-[9px] text-slate-400 font-sans font-bold uppercase">Weight</span>
                      <span className="font-bold text-slate-800">{player.weightKg || 56} kg</span>
                    </div>
                    <div>
                      <span className="block text-[9px] text-slate-400 font-sans font-bold uppercase">Foot</span>
                      <span className="font-bold text-slate-800">{player.preferredFoot || 'R'}</span>
                    </div>
                  </div>

                  {/* Notes Preview */}
                  {player.notes && (
                    <p className="text-[11px] text-slate-500 font-medium line-clamp-2 italic bg-slate-50/50 p-2 rounded-lg border border-slate-100">
                      "{player.notes}"
                    </p>
                  )}
                </div>

                {/* Card Footer Actions */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <select
                    value={player.status}
                    onChange={(e) => handleQuickStatusChange(player.id, e.target.value as SquadPlayer['status'])}
                    className="text-[10px] font-bold bg-slate-100 text-slate-700 rounded-lg px-2 py-1 border border-slate-200 focus:outline-none"
                  >
                    <option value="Active">Active</option>
                    <option value="Injured">Injured</option>
                    <option value="Recovering">Rehab</option>
                    <option value="Absent">Absent</option>
                  </select>

                  <div className="flex items-center space-x-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(player)}
                      className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-[#002142] rounded-lg transition-colors cursor-pointer"
                      title="Edit Profile"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeletePlayer(player.id, `${player.firstName} ${player.lastName}`)}
                      className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                      title="Delete Player"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        /* TABLE LIST VIEW */
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4">Player</th>
                  <th className="py-3 px-4">Position</th>
                  <th className="py-3 px-4">Age & Nat.</th>
                  <th className="py-3 px-4">Physical Stats</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Notes</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                {filteredPlayers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      No players match the filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredPlayers.map((player) => (
                    <tr key={player.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 text-center font-mono font-bold text-[#002142] bg-slate-50/40">
                        {player.number ? `#${player.number}` : '-'}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        <div className="flex items-center space-x-3">
                          <img
                            src={player.photoUrl || AVATAR_PRESETS[0]}
                            alt={player.firstName}
                            className="w-8 h-8 rounded-full object-cover border border-slate-200 bg-slate-100 shrink-0"
                          />
                          <span>{player.firstName} {player.lastName}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {getPositionBadge(player.position)}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-600">
                        {player.nationality || 'Saudi Arabia 🇸🇦'} ({player.age || 16}y)
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                        {player.heightCm || 168}cm • {player.weightKg || 56}kg • Foot: {player.preferredFoot || 'R'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          {getStatusBadge(player.status)}
                          <select
                            value={player.status}
                            onChange={(e) => handleQuickStatusChange(player.id, e.target.value as SquadPlayer['status'])}
                            className="text-[10px] font-semibold bg-slate-100 text-slate-600 rounded px-1.5 py-0.5 border border-slate-200 focus:outline-none"
                          >
                            <option value="Active">Active</option>
                            <option value="Injured">Injured</option>
                            <option value="Recovering">Rehab</option>
                            <option value="Absent">Absent</option>
                          </select>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-500 max-w-xs truncate">
                        {player.notes || <span className="text-slate-300 italic">No notes</span>}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(player)}
                            className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-900 rounded-lg transition-colors cursor-pointer"
                            title="Edit Player"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePlayer(player.id, `${player.firstName} ${player.lastName}`)}
                            className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                            title="Delete Player"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Summary Footer */}
      <div className="bg-white px-5 py-3 rounded-xl border border-slate-200 text-xs font-semibold text-slate-500 flex justify-between items-center">
        <span>Showing {filteredPlayers.length} of {players.length} registered squad members</span>
        <span className="text-[11px] font-mono text-slate-400">Al Ula Women U17 Technical Database</span>
      </div>

      {/* Modal Dialog for Add / Edit Player */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-fadeIn max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-[#002142]">
                {editingPlayer ? 'Edit Player Profile (Iterpro)' : 'Add New Player to Roster'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePlayer} className="space-y-4">
              
              {/* Photo Select Section */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Player Photo / Avatar
                </label>
                <div className="flex items-center space-x-3 mb-2">
                  <img
                    src={formData.photoUrl || AVATAR_PRESETS[0]}
                    alt="Preview"
                    className="w-14 h-14 rounded-2xl object-cover border-2 border-slate-200 shrink-0 bg-slate-100"
                  />
                  <div className="flex-1">
                    <input
                      type="text"
                      value={formData.photoUrl}
                      onChange={(e) => setFormData({ ...formData, photoUrl: e.target.value })}
                      placeholder="Paste Image URL or pick preset below..."
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* Preset Avatars Row */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Quick Preset Avatars:</span>
                  <div className="flex items-center space-x-1.5 overflow-x-auto pb-1">
                    {AVATAR_PRESETS.map((url, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setFormData({ ...formData, photoUrl: url })}
                        className={`w-9 h-9 rounded-xl border-2 overflow-hidden shrink-0 transition-transform ${
                          formData.photoUrl === url ? 'border-emerald-600 scale-105 shadow-sm' : 'border-slate-200 opacity-70 hover:opacity-100'
                        }`}
                      >
                        <img src={url} alt={`Preset ${idx}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    First Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    placeholder="e.g. Rimah"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    placeholder="e.g. Al-Harbi"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Dorsal #
                  </label>
                  <input
                    type="number"
                    value={formData.number}
                    onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                    placeholder="10"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Position
                  </label>
                  <select
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value as SquadPlayer['position'] })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="GK">GK (Goalkeeper)</option>
                    <option value="CB">CB (Center Back)</option>
                    <option value="LB">LB (Left Back)</option>
                    <option value="RB">RB (Right Back)</option>
                    <option value="CDM">CDM (Def Mid)</option>
                    <option value="CM">CM (Central Mid)</option>
                    <option value="CAM">CAM (Att Mid)</option>
                    <option value="RW">RW (Right Wing)</option>
                    <option value="LW">LW (Left Wing)</option>
                    <option value="ST">ST (Striker)</option>
                    <option value="UTIL">Utility</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as SquadPlayer['status'] })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="Active">Active</option>
                    <option value="Injured">Injured</option>
                    <option value="Recovering">Rehab</option>
                    <option value="Absent">Absent</option>
                  </select>
                </div>
              </div>

              {/* Age, Nationality, Foot, Height, Weight */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Age (Years)
                  </label>
                  <input
                    type="number"
                    value={formData.age}
                    onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                    placeholder="16"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Nationality
                  </label>
                  <input
                    type="text"
                    value={formData.nationality}
                    onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                    placeholder="Saudi Arabia 🇸🇦"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Foot
                  </label>
                  <select
                    value={formData.preferredFoot}
                    onChange={(e) => setFormData({ ...formData, preferredFoot: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="Right">Right</option>
                    <option value="Left">Left</option>
                    <option value="Both">Both</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Height (cm)
                  </label>
                  <input
                    type="number"
                    value={formData.heightCm}
                    onChange={(e) => setFormData({ ...formData, heightCm: e.target.value })}
                    placeholder="168"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Weight (kg)
                  </label>
                  <input
                    type="number"
                    value={formData.weightKg}
                    onChange={(e) => setFormData({ ...formData, weightKg: e.target.value })}
                    placeholder="56"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Notes & Observations
                </label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Tactical strengths, injury notes, fitness remarks..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold rounded-xl transition-colors shadow-md shadow-emerald-600/30 flex items-center space-x-1"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Player</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
