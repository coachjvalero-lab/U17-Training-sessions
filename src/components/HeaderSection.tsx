import React, { useRef } from 'react';
import { Calendar, Clock, Trophy, Target, Shield, Upload, X } from 'lucide-react';
import { TrainingSession } from '../types';

interface HeaderSectionProps {
  session: TrainingSession;
  onChange: (fields: Partial<TrainingSession>) => void;
}

// Beautiful default club badge SVG to make it look official right away
const DEFAULT_CLUB_BADGE = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <circle cx="50" cy="50" r="46" fill="%230f172a" stroke="%230f5981" stroke-width="4" />
  <path d="M 50 12 C 30 12 18 24 18 45 C 18 70 50 88 50 88 C 50 88 82 70 82 45 C 82 24 70 12 50 12 Z" fill="%231e293b" stroke="white" stroke-width="2" />
  <!-- Soccer ball pattern -->
  <circle cx="50" cy="50" r="18" fill="none" stroke="%230f5981" stroke-width="2" />
  <line x1="50" y1="12" x2="50" y2="88" stroke="rgba(255,255,255,0.15)" stroke-width="1" />
  <line x1="18" y1="45" x2="82" y2="45" stroke="rgba(255,255,255,0.15)" stroke-width="1" />
  <text x="50" y="54" fill="white" font-family="sans-serif" font-size="12" font-weight="900" text-anchor="middle">U17</text>
  <text x="50" y="74" fill="%230f5981" font-family="sans-serif" font-size="7" font-weight="bold" text-anchor="middle">COACH</text>
</svg>`;

export const HeaderSection: React.FC<HeaderSectionProps> = ({ session, onChange }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate size (limit to 2MB for base64 storage efficiency)
      if (file.size > 2 * 1024 * 1024) {
        alert('La imagen es demasiado grande. Elige una menor a 2MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        onChange({ teamLogo: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const removeLogo = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange({ teamLogo: '' });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <header className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-md shadow-slate-100/80 print:shadow-none print:border-slate-300 print:p-4 print:rounded-none">
      {/* Upper Grid: Badge & Metadata */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center print:grid-cols-12 print:gap-4">
        
        {/* Column 1: Team Badge upload (Span 3) */}
        <div className="md:col-span-3 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-slate-100 pb-4 md:pb-0 md:pr-6 print:col-span-3 print:border-r print:border-slate-300 print:pb-0 print:pr-4">
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="group relative cursor-pointer w-28 h-28 md:w-32 md:h-32 rounded-2xl border-2 border-dashed border-slate-200 hover:border-emerald-500 flex items-center justify-center overflow-hidden transition-all bg-slate-50/80 hover:bg-slate-100 print:w-20 print:h-20 print:border-none print:bg-transparent"
          >
            <img 
              src={session.teamLogo || DEFAULT_CLUB_BADGE} 
              alt="Club Badge" 
              className="w-full h-full object-contain p-2 transition-transform duration-300 group-hover:scale-105"
              referrerPolicy="no-referrer"
            />
            
            {/* Hover Overlay - Hidden in print */}
            <div className="absolute inset-0 bg-slate-950/70 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white transition-opacity text-xs font-semibold rounded-2xl print:hidden">
              <Upload className="w-5 h-5 mb-1 text-emerald-400" />
              <span>Cambiar Logo</span>
            </div>

            {/* Remove button - Hidden in print */}
            {session.teamLogo && (
              <button
                type="button"
                onClick={removeLogo}
                className="absolute top-1.5 right-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-lg p-1 shadow-lg transition-colors print:hidden z-10"
                title="Quitar Logo"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleLogoUpload} 
            accept="image/*" 
            className="hidden" 
          />
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-2.5 print:hidden">Escudo del Club</span>
        </div>

        {/* Column 2: Main Info Fields (Span 9) */}
        <div className="md:col-span-9 space-y-4 print:col-span-9 print:space-y-2">
          {/* Team Name Title */}
          <div>
            <label className="text-[10px] uppercase tracking-wider font-extrabold text-emerald-600 block mb-1 print:hidden">
              Nombre del Equipo o Club
            </label>
            <input
              id="header-team-name"
              type="text"
              value={session.teamName}
              onChange={(e) => onChange({ teamName: e.target.value })}
              placeholder="A.D. San Pedro U17"
              className="w-full text-2xl md:text-3xl font-display font-black text-slate-900 tracking-tight focus:outline-none focus:border-b-2 focus:border-emerald-500 border-b border-transparent pb-1 transition-all print:text-xl print:font-bold print:pb-0 print:text-black"
            />
          </div>

          {/* Date, Time, Session Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 print:grid-cols-3 print:gap-2">
            {/* Fecha */}
            <div className="flex items-center space-x-3 bg-slate-50 border border-slate-100 px-3.5 py-2.5 rounded-xl hover:border-slate-200 transition-colors print:bg-transparent print:border-none print:p-0">
              <Calendar className="w-4 h-4 text-emerald-500 print:text-black shrink-0" />
              <div className="w-full">
                <label className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider print:hidden">Día</label>
                <input
                  id="header-date"
                  type="date"
                  value={session.date}
                  onChange={(e) => onChange({ date: e.target.value })}
                  className="w-full bg-transparent text-xs font-bold text-slate-700 focus:outline-none print:text-black print:text-sm"
                />
              </div>
            </div>

            {/* Hora */}
            <div className="flex items-center space-x-3 bg-slate-50 border border-slate-100 px-3.5 py-2.5 rounded-xl hover:border-slate-200 transition-colors print:bg-transparent print:border-none print:p-0">
              <Clock className="w-4 h-4 text-emerald-500 print:text-black shrink-0" />
              <div className="w-full">
                <label className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider print:hidden">Hora / Bloque</label>
                <input
                  id="header-time"
                  type="text"
                  value={session.time}
                  onChange={(e) => onChange({ time: e.target.value })}
                  placeholder="18:30 - 20:00"
                  className="w-full bg-transparent text-xs font-bold text-slate-700 focus:outline-none print:text-black print:text-sm"
                />
              </div>
            </div>

            {/* Nº de Sesión */}
            <div className="flex items-center space-x-3 bg-slate-50 border border-slate-100 px-3.5 py-2.5 rounded-xl hover:border-slate-200 transition-colors print:bg-transparent print:border-none print:p-0">
              <Trophy className="w-4 h-4 text-emerald-500 print:text-black shrink-0" />
              <div className="w-full">
                <label className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider print:hidden">Nº Sesión</label>
                <input
                  id="header-session-number"
                  type="text"
                  value={session.sessionNumber}
                  onChange={(e) => onChange({ sessionNumber: e.target.value })}
                  placeholder="Sesión 1"
                  className="w-full bg-transparent text-xs font-bold text-slate-700 focus:outline-none print:text-black print:text-sm"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Objective Section (Stretched across full width) */}
      <div className="mt-6 pt-6 border-t border-slate-100 print:mt-3 print:pt-3 print:border-slate-300">
        <div className="flex items-start space-x-3 bg-emerald-50/20 border border-emerald-500/10 p-4 rounded-xl print:bg-transparent print:border-none print:p-0">
          <div className="bg-emerald-500 p-1.5 rounded-lg text-white mt-0.5 print:hidden shrink-0 shadow-sm shadow-emerald-500/20">
            <Target className="w-4 h-4" />
          </div>
          <div className="w-full">
            <div className="flex items-center space-x-1.5 text-xs font-extrabold text-emerald-700 uppercase tracking-widest print:text-black print:text-xs">
              <Target className="w-3.5 h-3.5 hidden print:inline mr-1" />
              <span>Objetivo Principal de la Sesión</span>
            </div>
            <textarea
              id="header-objective"
              value={session.mainObjective}
              onChange={(e) => onChange({ mainObjective: e.target.value })}
              rows={2}
              placeholder="Describa el foco técnico, táctico o físico principal de este entrenamiento..."
              className="w-full bg-transparent text-slate-700 font-semibold text-sm focus:outline-none resize-none mt-1.5 hover:bg-slate-50/50 focus:bg-white rounded-lg p-1.5 transition-all border border-transparent focus:border-slate-200/80 print:hover:bg-transparent print:p-0 print:border-none print:text-black"
            />
          </div>
        </div>
      </div>
    </header>
  );
};
