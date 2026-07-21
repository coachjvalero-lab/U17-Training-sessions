import React from 'react';
import { Users, Plus, Trash2, Palette, Shield, Sparkles } from 'lucide-react';
import { PlayerGroup, TrainingSession } from '../types';

interface GroupsSectionProps {
  session: TrainingSession;
  onChangeGroups: (updatedGroups: PlayerGroup[]) => void;
  onChangeMaterials: (materials: string) => void;
}

const PRESET_COLORS = [
  { hex: '#22c55e', name: 'Verde' },
  { hex: '#3b82f6', name: 'Azul' },
  { hex: '#eab308', name: 'Amarillo' },
  { hex: '#ef4444', name: 'Rojo' },
  { hex: '#f97316', name: 'Naranja' },
  { hex: '#a855f7', name: 'Morado' },
  { hex: '#ec4899', name: 'Rosa' },
  { hex: '#cbd5e1', name: 'Gris' }
];

export const GroupsSection: React.FC<GroupsSectionProps> = ({ 
  session, 
  onChangeGroups, 
  onChangeMaterials 
}) => {

  const addGroup = () => {
    // Select a preset color that is not heavily used, or default to a new preset color
    const nextPreset = PRESET_COLORS[session.playerGroups.length % PRESET_COLORS.length];
    
    const newGroup: PlayerGroup = {
      id: 'group-' + Date.now(),
      groupNumber: session.playerGroups.length + 1,
      bibColor: nextPreset.hex,
      players: ''
    };
    onChangeGroups([...session.playerGroups, newGroup]);
  };

  const deleteGroup = (id: string) => {
    onChangeGroups(session.playerGroups.filter(g => g.id !== id));
  };

  const updateGroup = (id: string, fields: Partial<PlayerGroup>) => {
    onChangeGroups(
      session.playerGroups.map(g => (g.id === id ? { ...g, ...fields } : g))
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 print:grid-cols-12 print:gap-4 print:no-break">
      
      {/* Materials List Needed (Span 4) */}
      <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-5 md:p-6 shadow-md shadow-slate-100/80 print:shadow-none print:border-slate-300 print:p-4 print:rounded-none print:col-span-4">
        <h2 className="text-xs font-display font-black text-slate-900 flex items-center space-x-2 border-b border-slate-100 pb-3 uppercase tracking-wider print:text-black print:border-slate-300 print:pb-1">
          <Shield className="w-4 h-4 text-emerald-500 print:text-black shrink-0" />
          <span>Material Necesario</span>
        </h2>
        <div className="mt-4">
          <textarea
            value={session.materialsNeeded || ''}
            onChange={(e) => onChangeMaterials(e.target.value)}
            rows={5}
            placeholder="P. ej: 20 Conos (10 Amarillos), 12 Petos (6 Verdes, 6 Azules), 15 Balones, 2 Porterías móviles..."
            className="w-full text-xs font-semibold bg-slate-50/50 hover:bg-slate-50 border border-slate-200 focus:bg-white rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all resize-y print:bg-transparent print:border-none print:p-0 print:text-black print:resize-none"
          />
        </div>
      </div>

      {/* Players Groups (Span 8) */}
      <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl p-5 md:p-6 shadow-md shadow-slate-100/80 print:shadow-none print:border-slate-300 print:p-4 print:rounded-none print:col-span-8">
        
        {/* Header */}
        <div className="flex justify-between items-center border-b border-slate-100 pb-3.5 print:border-slate-300 print:pb-1">
          <h2 className="text-xs font-display font-black text-slate-900 flex items-center space-x-2 uppercase tracking-wider print:text-black">
            <Users className="w-4 h-4 text-emerald-500 print:text-black shrink-0" />
            <span>Organización de Grupos / Equipos</span>
          </h2>
          <button
            type="button"
            onClick={addGroup}
            className="flex items-center space-x-1.5 text-[11px] bg-slate-900 hover:bg-emerald-600 text-white font-extrabold tracking-wider uppercase py-2 px-4 rounded-xl transition-all cursor-pointer shadow-sm active:scale-98 print:hidden"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Añadir Grupo</span>
          </button>
        </div>

        {/* No Groups state */}
        {session.playerGroups.length === 0 && (
          <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-2xl mt-4 print:hidden bg-slate-50/50">
            <Users className="w-6 h-6 text-slate-300 mx-auto mb-1.5" />
            <p className="text-slate-500 text-xs font-semibold">No hay grupos configurados para esta sesión.</p>
            <button
              type="button"
              onClick={addGroup}
              className="text-[11px] text-emerald-600 hover:text-emerald-700 font-extrabold uppercase mt-2 hover:underline"
            >
              Crear grupo +
            </button>
          </div>
        )}

        {/* Groups List */}
        <div className="mt-4 space-y-4 print:mt-2 print:space-y-2">
          {session.playerGroups.map((group, index) => {
            return (
              <div 
                key={group.id}
                className="border border-slate-200 rounded-xl p-4 bg-slate-50/20 relative flex flex-col md:flex-row gap-4 items-start md:items-center print:border-slate-300 print:p-2 print:rounded-none print:bg-transparent print:gap-2 print:border-b"
              >
                {/* Visual Circle Indicator & Group Title */}
                <div className="flex items-center space-x-3 shrink-0 print:space-x-2">
                  <div 
                    className="w-5 h-5 rounded-full border border-slate-300/60 shadow-sm print:print-bg-slate-100" 
                    style={{ backgroundColor: group.bibColor }}
                    title="Color del peto"
                  />
                  <div className="text-xs font-bold text-slate-900 print:text-black">
                    Grupo {group.groupNumber || index + 1}
                  </div>
                </div>

                {/* Color presets selector (Hidden in print) */}
                <div className="flex items-center gap-1 flex-wrap print:hidden">
                  <Palette className="w-3.5 h-3.5 text-slate-400 mr-1" />
                  {PRESET_COLORS.map(color => (
                    <button
                      key={color.hex}
                      type="button"
                      onClick={() => updateGroup(group.id, { bibColor: color.hex })}
                      className={`w-4 h-4 rounded-full border transition-transform hover:scale-120 ${
                        group.bibColor === color.hex ? 'border-slate-800 scale-110 shadow-sm' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color.hex }}
                      title={`Peto ${color.name}`}
                    />
                  ))}
                  {/* Custom Hex input color */}
                  <input
                    type="color"
                    value={group.bibColor}
                    onChange={(e) => updateGroup(group.id, { bibColor: e.target.value })}
                    className="w-4 h-4 rounded-full border border-slate-200 cursor-pointer overflow-hidden p-0"
                    title="Color personalizado"
                  />
                </div>

                {/* Players Textarea Input */}
                <div className="flex-1 w-full print:p-0">
                  <textarea
                    rows={1}
                    value={group.players}
                    onChange={(e) => updateGroup(group.id, { players: e.target.value })}
                    placeholder="Jugadoras (ej: Sofía, Valeria, Marta...)"
                    className="w-full text-xs font-semibold bg-white border border-slate-200 px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 resize-none overflow-hidden hover:bg-slate-50/50 focus:bg-white print:bg-transparent print:border-none print:p-0 print:text-black print:resize-none"
                    style={{ height: 'auto', minHeight: '34px' }}
                  />
                </div>

                {/* Delete button (Hidden in print) */}
                <button
                  type="button"
                  onClick={() => deleteGroup(group.id)}
                  className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors absolute top-3 right-3 md:relative md:top-auto md:right-auto print:hidden"
                  title="Eliminar Grupo"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>

      </div>

    </div>
  );
};
