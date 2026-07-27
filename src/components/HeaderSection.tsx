import React, { useRef, useState } from 'react';
import { Calendar, Clock, Trophy, Target, Shield, Upload, X, Activity, Loader2 } from 'lucide-react';
import { TrainingSession } from '../types';
import { OFFICIAL_ALULA_LOGO_DATA_URL } from '../constants/logo';
import { processUploadedImageFile } from '../utils/heic';
import { SmartImage } from './SmartImage';

interface HeaderSectionProps {
  session: TrainingSession;
  onChange: (fields: Partial<TrainingSession>) => void;
}


export const HeaderSection: React.FC<HeaderSectionProps> = ({ session, onChange }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert('The image is too large. Please select one smaller than 10MB.');
        return;
      }
      setIsUploadingLogo(true);
      try {
        const logoData = await processUploadedImageFile(file);
        try {
          localStorage.setItem('u17_uploaded_team_logo', logoData);
        } catch (e) {}
        onChange({ teamLogo: logoData });
      } catch (err) {
        console.error('Failed to process logo image:', err);
        alert('Error processing image. If this is a HEIC photo, please try again or select a JPG/PNG.');
      } finally {
        setIsUploadingLogo(false);
      }
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

  // Auto-fill session.teamLogo if missing so it gets saved to Firestore for shared links
  React.useEffect(() => {
    if (!session.teamLogo && savedLogo && savedLogo !== OFFICIAL_ALULA_LOGO_DATA_URL) {
      onChange({ teamLogo: savedLogo });
    }
  }, [session.teamLogo, savedLogo, onChange]);

  // Ensure logo ALWAYS falls back to the official Al Ula SC shield logo
  const isOldOrInvalid = !currentLogo || 
    currentLogo.includes('%230f172a') || 
    currentLogo.includes('COACH') ||
    currentLogo.includes('default-u17');

  const logoSrc = isOldOrInvalid ? OFFICIAL_ALULA_LOGO_DATA_URL : currentLogo;

  return (
    <header className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-md shadow-slate-100/80 print:shadow-none print:border-slate-300 print:p-2.5 print:rounded-lg print:border-t-4 print:border-t-[#002142] print:border-b-2 print:border-b-[#a79078]">
      {/* Upper Grid: Badge & Metadata */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center print:grid-cols-12 print:gap-2">
        
        {/* Column 1: Team Badge upload (Span 3) */}
        <div className="md:col-span-3 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-slate-100 pb-4 md:pb-0 md:pr-6 print:col-span-2 print:border-r print:border-slate-200 print:pb-0 print:pr-2">
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="group relative cursor-pointer w-28 h-28 md:w-32 md:h-32 rounded-2xl border-2 border-dashed border-slate-200 hover:border-emerald-500 flex items-center justify-center overflow-hidden transition-all bg-slate-50/80 hover:bg-slate-100 print:w-11 print:h-11 print:border-none print:bg-transparent"
          >
            {isUploadingLogo ? (
              <div className="flex flex-col items-center justify-center p-2 text-emerald-600 text-xs font-semibold">
                <Loader2 className="w-6 h-6 animate-spin mb-1 text-emerald-500" />
                <span className="text-[10px]">Uploading...</span>
              </div>
            ) : (
              <SmartImage 
                src={logoSrc} 
                alt="Club Badge" 
                className="w-full h-full object-contain p-2 transition-transform duration-300 group-hover:scale-105 print:p-0"
                onConverted={(convertedJpeg) => onChange({ teamLogo: convertedJpeg })}
              />
            )}
            
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
            accept="image/*,.heic,.heif,image/heic,image/heif" 
            className="hidden" 
          />
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-2.5 print:hidden">Club Badge</span>
        </div>

        {/* Column 2: Main Info Fields (Span 9) */}
        <div className="md:col-span-9 space-y-4 print:col-span-10 print:space-y-1">
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
              className="w-full text-2xl md:text-3xl font-display font-black text-slate-900 tracking-tight focus:outline-none focus:border-b-2 focus:border-emerald-500 border-b border-transparent pb-1 transition-all print:text-sm print:font-black print:pb-0 print:text-[#002142]"
            />
          </div>

          {/* Date, Time, Session Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5 print:grid-cols-4 print:gap-1.5 print:bg-slate-50/80 print:p-1.5 print:rounded-lg print:border print:border-slate-200">
            {/* Fecha */}
            <div className="flex items-center space-x-3 bg-slate-50/80 border border-slate-200/80 px-4 py-3 rounded-2xl hover:border-slate-300 transition-colors print:bg-transparent print:border-none print:p-0 print:space-x-1">
              <Calendar className="w-4 h-4 text-emerald-600 print:text-[#0f5981] print:w-3 print:h-3 shrink-0" />
              <div className="w-full">
                <label className="text-[10px] uppercase font-black text-slate-400 block tracking-wider print:text-[7px] print:text-slate-500">Date</label>
                <input
                  id="header-date"
                  type="date"
                  value={session.date}
                  onChange={(e) => onChange({ date: e.target.value })}
                  className="w-full bg-transparent text-xs sm:text-sm font-black text-slate-800 focus:outline-none print:text-slate-900 print:text-[9px] print:font-bold"
                />
              </div>
            </div>

            {/* Hora */}
            <div className="flex items-center space-x-3 bg-slate-50/80 border border-slate-200/80 px-4 py-3 rounded-2xl hover:border-slate-300 transition-colors print:bg-transparent print:border-none print:p-0 print:space-x-1">
              <Clock className="w-4 h-4 text-emerald-600 print:text-[#0f5981] print:w-3 print:h-3 shrink-0" />
              <div className="w-full">
                <label className="text-[10px] uppercase font-black text-slate-400 block tracking-wider print:text-[7px] print:text-slate-500">Time / Slot</label>
                <input
                  id="header-time"
                  type="text"
                  value={session.time}
                  onChange={(e) => onChange({ time: e.target.value })}
                  placeholder="18:30 - 20:00"
                  className="w-full bg-transparent text-xs sm:text-sm font-black text-slate-800 focus:outline-none print:text-slate-900 print:text-[9px] print:font-bold"
                />
              </div>
            </div>

            {/* Nº de Sesión (Highlighted & Larger) */}
            <div className="flex items-center space-x-3 bg-emerald-50/80 border border-emerald-300/80 px-4 py-3 rounded-2xl hover:border-emerald-400 transition-all shadow-sm ring-1 ring-emerald-500/10 print:bg-transparent print:border-none print:p-0 print:ring-0 print:shadow-none print:space-x-1">
              <Trophy className="w-5 h-5 text-emerald-600 print:text-[#0f5981] print:w-3 print:h-3 shrink-0" />
              <div className="w-full">
                <label className="text-[10px] uppercase font-black text-emerald-700 block tracking-wider print:text-[7px] print:text-slate-500">Session No.</label>
                <input
                  id="header-session-number"
                  type="text"
                  value={session.sessionNumber}
                  onChange={(e) => onChange({ sessionNumber: e.target.value })}
                  placeholder="e.g. Session 1"
                  className="w-full bg-transparent text-sm sm:text-base font-black text-emerald-950 placeholder:text-emerald-300 focus:outline-none print:text-slate-900 print:text-[9px] print:font-bold"
                />
              </div>
            </div>

            {/* Microcilo Day */}
            <div className="flex items-center space-x-3 bg-slate-50/80 border border-slate-200/80 px-4 py-3 rounded-2xl hover:border-slate-300 transition-colors print:bg-transparent print:border-none print:p-0 print:space-x-1">
              <Activity className="w-4 h-4 text-emerald-600 print:text-[#0f5981] print:w-3 print:h-3 shrink-0" />
              <div className="w-full">
                <label className="text-[10px] uppercase font-black text-slate-400 block tracking-wider print:text-[7px] print:text-slate-500">Microcycle Day</label>
                <select
                  id="header-microcycle-day"
                  value={session.microcycleDay || ''}
                  onChange={(e) => onChange({ microcycleDay: e.target.value })}
                  className="w-full bg-transparent text-xs sm:text-sm font-black text-slate-800 focus:outline-none cursor-pointer print:text-slate-900 print:text-[9px] print:font-bold"
                >
                  <option value="">Select Day</option>
                  <option value="-4">-4</option>
                  <option value="-3">-3</option>
                  <option value="-2">-2</option>
                  <option value="-1">-1</option>
                  <option value="+1">+1</option>
                  <option value="+2">+2</option>
                  <option value="Non competitive">Non competitive</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Side-by-Side Grid: Main Objective & Materials Section */}
      <div className="mt-6 pt-6 border-t border-slate-100 print:mt-1 print:pt-1 print:border-slate-200">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:grid-cols-2 print:gap-1.5">
          
          {/* Primary Session Objective */}
          <div className="flex items-start space-x-3 bg-emerald-50/20 border border-emerald-500/10 p-4 rounded-xl print:bg-slate-50/50 print:border print:border-slate-200 print:rounded-md print:p-1">
            <div className="bg-emerald-500 p-1.5 rounded-lg text-white mt-0.5 print:hidden shrink-0 shadow-sm shadow-emerald-500/20">
              <Target className="w-4 h-4" />
            </div>
            <div className="w-full">
              <div className="flex items-center space-x-1 text-xs font-extrabold text-emerald-700 uppercase tracking-widest print:text-[#002142] print:text-[7.5px] print:font-black">
                <Target className="w-2.5 h-2.5 hidden print:inline mr-0.5 text-[#0f5981]" />
                <span>Primary Session Objective</span>
              </div>
              <textarea
                id="header-objective"
                value={session.mainObjective}
                onChange={(e) => onChange({ mainObjective: e.target.value })}
                rows={2}
                placeholder="Describe the technical, tactical, or physical focus of this training session..."
                className="w-full bg-transparent text-slate-700 font-semibold text-xs md:text-sm focus:outline-none resize-none mt-1.5 hover:bg-slate-50/50 focus:bg-white rounded-lg p-1.5 transition-all border border-transparent focus:border-slate-200/80 print:hover:bg-transparent print:p-0 print:border-none print:text-slate-800 print:text-[7pt] print:leading-tight print:mt-0.5 print:h-5 print:min-h-0"
              />
            </div>
          </div>

          {/* Required Equipment & Materials */}
          <div className="flex items-start space-x-3 bg-emerald-50/20 border border-emerald-500/10 p-4 rounded-xl print:bg-slate-50/50 print:border print:border-slate-200 print:rounded-md print:p-1">
            <div className="bg-emerald-500 p-1.5 rounded-lg text-white mt-0.5 print:hidden shrink-0 shadow-sm shadow-emerald-500/20">
              <Shield className="w-4 h-4" />
            </div>
            <div className="w-full">
              <div className="flex items-center space-x-1 text-xs font-extrabold text-emerald-700 uppercase tracking-widest print:text-[#002142] print:text-[7.5px] print:font-black">
                <Shield className="w-2.5 h-2.5 hidden print:inline mr-0.5 text-[#0f5981]" />
                <span>Required Equipment & Materials</span>
              </div>
              <textarea
                id="header-materials"
                value={session.materialsNeeded || ''}
                onChange={(e) => onChange({ materialsNeeded: e.target.value })}
                rows={2}
                placeholder="e.g., 20 Cones (10 Yellow), 12 Bibs (6 Green, 6 Blue), 15 Balls, 2 Portable Goals..."
                className="w-full bg-transparent text-slate-700 font-semibold text-xs md:text-sm focus:outline-none resize-none mt-1.5 hover:bg-slate-50/50 focus:bg-white rounded-lg p-1.5 transition-all border border-transparent focus:border-slate-200/80 print:hover:bg-transparent print:p-0 print:border-none print:text-slate-800 print:text-[7pt] print:leading-tight print:mt-0.5 print:h-5 print:min-h-0"
              />
            </div>
          </div>

        </div>
      </div>
    </header>
  );
};
