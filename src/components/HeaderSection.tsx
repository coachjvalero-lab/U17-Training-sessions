import React, { useRef } from 'react';
import { Calendar, Clock, Trophy, Target, Shield, Upload, X, Activity } from 'lucide-react';
import { TrainingSession } from '../types';
import { OFFICIAL_ALULA_LOGO_DATA_URL } from '../constants/logo';

interface HeaderSectionProps {
  session: TrainingSession;
  onChange: (fields: Partial<TrainingSession>) => void;
}


export const HeaderSection: React.FC<HeaderSectionProps> = ({ session, onChange }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate size (limit to 2MB for base64 storage efficiency)
      if (file.size > 2 * 1024 * 1024) {
        alert('The image is too large. Please select one smaller than 2MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const logoData = reader.result as string;
        try {
          localStorage.setItem('u17_uploaded_team_logo', logoData);
        } catch (e) {}
        onChange({ teamLogo: logoData });
      };
      reader.readAsDataURL(file);
    }
  };

  const removeLogo = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      localStorage.removeItem('u17_uploaded_team_logo');
    } catch (e) {}
    onChange({ teamLogo: '' });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const savedLogo = (() => {
    try {
      return localStorage.getItem('u17_uploaded_team_logo') || OFFICIAL_ALULA_LOGO_DATA_URL;
    } catch (e) {
      return OFFICIAL_ALULA_LOGO_DATA_URL;
    }
  })();

  const currentLogo = session.teamLogo || savedLogo;

  // Ensure logo ALWAYS falls back to the official Al Ula SC shield logo
  const isOldOrInvalid = !currentLogo || 
    currentLogo.includes('%230f172a') || 
    currentLogo.includes('COACH') ||
    currentLogo.includes('default-u17');

  const logoSrc = isOldOrInvalid ? OFFICIAL_ALULA_LOGO_DATA_URL : currentLogo;

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
              src={logoSrc} 
              alt="Club Badge" 
              className="w-full h-full object-contain p-2 transition-transform duration-300 group-hover:scale-105"
              referrerPolicy="no-referrer"
            />
            
            {/* Hover Overlay - Hidden in print */}
            <div className="absolute inset-0 bg-slate-950/70 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white transition-opacity text-xs font-semibold rounded-2xl print:hidden">
              <Upload className="w-5 h-5 mb-1 text-emerald-400" />
              <span>Change Logo</span>
            </div>

            {/* Remove button - Hidden in print */}
            {session.teamLogo && (
              <button
                type="button"
                onClick={removeLogo}
                className="absolute top-1.5 right-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-lg p-1 shadow-lg transition-colors print:hidden z-10"
                title="Remove Logo"
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
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-2.5 print:hidden">Club Badge</span>
        </div>

        {/* Column 2: Main Info Fields (Span 9) */}
        <div className="md:col-span-9 space-y-4 print:col-span-9 print:space-y-2">
          {/* Team Name Title */}
          <div>
            <label className="text-[10px] uppercase tracking-wider font-extrabold text-emerald-600 block mb-1 print:hidden">
              Team or Club Name
            </label>
            <input
              id="header-team-name"
              type="text"
              value={session.teamName}
              onChange={(e) => onChange({ teamName: e.target.value })}
              placeholder="e.g., A.D. San Pedro U17"
              className="w-full text-2xl md:text-3xl font-display font-black text-slate-900 tracking-tight focus:outline-none focus:border-b-2 focus:border-emerald-500 border-b border-transparent pb-1 transition-all print:text-xl print:font-bold print:pb-0 print:text-black"
            />
          </div>

          {/* Date, Time, Session Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 print:grid-cols-4 print:gap-2">
            {/* Fecha */}
            <div className="flex items-center space-x-3 bg-slate-50 border border-slate-100 px-3.5 py-2.5 rounded-xl hover:border-slate-200 transition-colors print:bg-transparent print:border-none print:p-0">
              <Calendar className="w-4 h-4 text-emerald-500 print:text-black shrink-0" />
              <div className="w-full">
                <label className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider print:hidden">Date</label>
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
                <label className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider print:hidden">Time / Slot</label>
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
                <label className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider print:hidden">Session No.</label>
                <input
                  id="header-session-number"
                  type="text"
                  value={session.sessionNumber}
                  onChange={(e) => onChange({ sessionNumber: e.target.value })}
                  placeholder="Session 1"
                  className="w-full bg-transparent text-xs font-bold text-slate-700 focus:outline-none print:text-black print:text-sm"
                />
              </div>
            </div>

            {/* Microcilo Day */}
            <div className="flex items-center space-x-3 bg-slate-50 border border-slate-100 px-3.5 py-2.5 rounded-xl hover:border-slate-200 transition-colors print:bg-transparent print:border-none print:p-0">
              <Activity className="w-4 h-4 text-emerald-500 print:text-black shrink-0" />
              <div className="w-full">
                <label className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider print:hidden">Microcycle Day</label>
                <select
                  id="header-microcycle-day"
                  value={session.microcycleDay || ''}
                  onChange={(e) => onChange({ microcycleDay: e.target.value })}
                  className="w-full bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer print:text-black print:text-sm print:font-bold"
                >
                  <option value="">Select Day</option>
                  <option value="-4">-4</option>
                  <option value="-3">-3</option>
                  <option value="-2">-2</option>
                  <option value="-1">-1</option>
                  <option value="+1">+1</option>
                  <option value="+2">+2</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Side-by-Side Grid: Main Objective & Materials Section */}
      <div className="mt-6 pt-6 border-t border-slate-100 print:mt-3 print:pt-3 print:border-slate-300">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:grid-cols-2 print:gap-4">
          
          {/* Primary Session Objective */}
          <div className="flex items-start space-x-3 bg-emerald-50/20 border border-emerald-500/10 p-4 rounded-xl print:bg-transparent print:border-none print:p-0">
            <div className="bg-emerald-500 p-1.5 rounded-lg text-white mt-0.5 print:hidden shrink-0 shadow-sm shadow-emerald-500/20">
              <Target className="w-4 h-4" />
            </div>
            <div className="w-full">
              <div className="flex items-center space-x-1.5 text-xs font-extrabold text-emerald-700 uppercase tracking-widest print:text-black print:text-xs">
                <Target className="w-3.5 h-3.5 hidden print:inline mr-1" />
                <span>Primary Session Objective</span>
              </div>
              <textarea
                id="header-objective"
                value={session.mainObjective}
                onChange={(e) => onChange({ mainObjective: e.target.value })}
                rows={3}
                placeholder="Describe the technical, tactical, or physical focus of this training session..."
                className="w-full bg-transparent text-slate-700 font-semibold text-xs md:text-sm focus:outline-none resize-none mt-1.5 hover:bg-slate-50/50 focus:bg-white rounded-lg p-1.5 transition-all border border-transparent focus:border-slate-200/80 print:hover:bg-transparent print:p-0 print:border-none print:text-black print:text-xs"
              />
            </div>
          </div>

          {/* Required Equipment & Materials */}
          <div className="flex items-start space-x-3 bg-emerald-50/20 border border-emerald-500/10 p-4 rounded-xl print:bg-transparent print:border-none print:p-0">
            <div className="bg-emerald-500 p-1.5 rounded-lg text-white mt-0.5 print:hidden shrink-0 shadow-sm shadow-emerald-500/20">
              <Shield className="w-4 h-4" />
            </div>
            <div className="w-full">
              <div className="flex items-center space-x-1.5 text-xs font-extrabold text-emerald-700 uppercase tracking-widest print:text-black print:text-xs">
                <Shield className="w-3.5 h-3.5 hidden print:inline mr-1" />
                <span>Required Equipment & Materials</span>
              </div>
              <textarea
                id="header-materials"
                value={session.materialsNeeded || ''}
                onChange={(e) => onChange({ materialsNeeded: e.target.value })}
                rows={3}
                placeholder="e.g., 20 Cones (10 Yellow), 12 Bibs (6 Green, 6 Blue), 15 Balls, 2 Portable Goals..."
                className="w-full bg-transparent text-slate-700 font-semibold text-xs md:text-sm focus:outline-none resize-none mt-1.5 hover:bg-slate-50/50 focus:bg-white rounded-lg p-1.5 transition-all border border-transparent focus:border-slate-200/80 print:hover:bg-transparent print:p-0 print:border-none print:text-black print:text-xs"
              />
            </div>
          </div>

        </div>
      </div>
    </header>
  );
};
