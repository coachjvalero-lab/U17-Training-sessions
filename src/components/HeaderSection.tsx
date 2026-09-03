import React, { useRef, useState } from 'react';
import { Calendar, Clock, Trophy, Target, Shield, Upload, X, Activity, Loader2, Save, Timer } from 'lucide-react';
import { TrainingSession } from '../types';
import { OFFICIAL_ALULA_LOGO_DATA_URL } from '../constants/logo';
import { processUploadedImageFile } from '../utils/heic';
import { formatDurationLabel } from '../utils/duration';
import { SmartImage } from './SmartImage';

interface HeaderSectionProps {
  session: TrainingSession;
  onChange: (fields: Partial<TrainingSession>) => void;
  onSave?: () => void;
  isSaving?: boolean;
  currentLogo?: string;
  onUpdateLogo?: (newLogo: string) => void;
  readOnly?: boolean;
  /** Auto-calculated from the session exercises by the parent; never entered manually. */
  totalDurationMinutes?: number;
}


export const HeaderSection: React.FC<HeaderSectionProps> = ({ session, onChange, onSave, isSaving, currentLogo, onUpdateLogo, readOnly = false, totalDurationMinutes = 0 }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (readOnly) return;
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert('The image is too large. Please select one smaller than 10MB.');
        return;
      }
      setIsUploadingLogo(true);
      try {
        const logoData = await processUploadedImageFile(file);
        onUpdateLogo?.(logoData);
      } catch (err) {
        console.error('Failed to process logo image:', err);
        alert('Error processing image. If this is a HEIC photo, please try again or select a JPG/PNG.');
      } finally {
        setIsUploadingLogo(false);
      }
    }
  };

  const removeLogo = (e: React.MouseEvent) => {
    if (readOnly) return;
    e.stopPropagation();
    onUpdateLogo?.(OFFICIAL_ALULA_LOGO_DATA_URL);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const activeLogo = currentLogo || OFFICIAL_ALULA_LOGO_DATA_URL;

  // Ensure logo ALWAYS falls back to the official Al Ula SC shield logo
  const isOldOrInvalid = !activeLogo || 
    activeLogo.includes('%230f172a') || 
    activeLogo.includes('COACH') ||
    activeLogo.includes('default-u17');

  const logoSrc = isOldOrInvalid ? OFFICIAL_ALULA_LOGO_DATA_URL : activeLogo;

  return (
    <header className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-md shadow-slate-100/80 print:shadow-none print:border-none print:p-2 print:rounded-none print:border-0">
      {/* Upper Grid: Badge & Metadata */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center print:grid-cols-12 print:gap-2">
        
        {/* Column 1: Team Badge upload (Span 3) */}
        <div className="md:col-span-3 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-slate-100 pb-4 md:pb-0 md:pr-6 print:flex print:items-center print:justify-center print:col-span-2 print:border-r print:border-slate-200 print:pb-0 print:pr-2">
          <div 
            onClick={() => {
              if (!readOnly) {
                fileInputRef.current?.click();
              }
            }}
            className={`group relative w-28 h-28 md:w-32 md:h-32 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden transition-all bg-slate-50/80 print:w-16 print:h-16 print:border print:border-slate-200 print:bg-slate-50 print:rounded-lg ${readOnly ? 'cursor-default' : 'cursor-pointer hover:border-emerald-500 hover:bg-slate-100'}`}
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
                onConverted={(convertedJpeg) => onUpdateLogo?.(convertedJpeg)}
              />
            )}
            
            {/* Hover Overlay - Hidden in print */}
            {!readOnly && <div className="absolute inset-0 bg-slate-950/70 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white transition-opacity text-xs font-semibold rounded-2xl print:hidden">
              <Upload className="w-5 h-5 mb-1 text-emerald-400" />
              <span>Change Logo</span>
            </div>}

            {/* Remove button - Hidden in print */}
            {!readOnly && logoSrc !== OFFICIAL_ALULA_LOGO_DATA_URL && (
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
          {/* Team Name Title & Quick Save Button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex-1">
              <label className="text-[10px] uppercase tracking-wider font-extrabold text-emerald-600 block mb-1 print:hidden">
                Team or Club Name
              </label>
              <input
                id="header-team-name"
                type="text"
                value={session.teamName}
                onChange={(e) => onChange({ teamName: e.target.value })}
                readOnly={readOnly}
                placeholder="e.g., A.D. San Pedro U17"
                className="w-full text-2xl md:text-3xl font-display font-black text-slate-900 tracking-tight focus:outline-none focus:border-b-2 focus:border-emerald-500 border-b border-transparent pb-1 transition-all print:text-[14pt] print:font-black print:pb-0 print:text-[#002142]"
              />
            </div>

            {onSave && (
              <button
                type="button"
                onClick={onSave}
                disabled={isSaving}
                className="print:hidden flex items-center justify-center space-x-2 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-slate-950 font-black text-xs px-5 py-2.5 rounded-xl shadow-md transition-all cursor-pointer border border-emerald-400 shrink-0 hover:shadow-emerald-500/20"
                title="Save session changes"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 text-slate-950" />
                    <span>Save Session</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Date, Time, Session Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3.5 print:grid-cols-5 print:gap-1 print:bg-white print:p-0 print:rounded-none print:border-0">
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
                  readOnly={readOnly}
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
                  readOnly={readOnly}
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
                  readOnly={readOnly}
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
                  disabled={readOnly}
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

            {/* Total Duration (auto-calculated from exercises, read-only) */}
            <div className="flex items-center space-x-3 bg-slate-50/80 border border-slate-200/80 px-4 py-3 rounded-2xl print:bg-transparent print:border-none print:p-0 print:space-x-1">
              <Timer className="w-4 h-4 text-emerald-600 print:text-[#0f5981] print:w-3 print:h-3 shrink-0" />
              <div className="w-full">
                <label className="text-[10px] uppercase font-black text-slate-400 block tracking-wider print:text-[7px] print:text-slate-500">Duration</label>
                <div
                  id="header-total-duration"
                  title="Total duration calculated from the session exercises"
                  className="w-full text-xs sm:text-sm font-black text-slate-800 print:text-slate-900 print:text-[9px] print:font-bold"
                >
                  {totalDurationMinutes > 0 ? formatDurationLabel(totalDurationMinutes) : '—'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Side-by-Side Grid: Main Objective & Materials Section */}
      <div className="mt-6 pt-6 border-t border-slate-100 print:mt-1 print:pt-1 print:border-slate-200 print:pb-0">
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
                readOnly={readOnly}
                placeholder="Describe the technical, tactical, or physical focus of this training session..."
                className="w-full bg-transparent text-slate-700 font-semibold text-xs md:text-sm focus:outline-none resize-none mt-1.5 hover:bg-slate-50/50 focus:bg-white rounded-lg p-1.5 transition-all border border-transparent focus:border-slate-200/80 print:hidden"
              />
              <div className="hidden print:block print:mt-0.5 print:text-[7pt] print:font-semibold print:leading-tight print:text-slate-800 whitespace-pre-wrap">
                {session.mainObjective || '—'}
              </div>
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
                readOnly={readOnly}
                placeholder="e.g., 20 Cones (10 Yellow), 12 Bibs (6 Green, 6 Blue), 15 Balls, 2 Portable Goals..."
                className="w-full bg-transparent text-slate-700 font-semibold text-xs md:text-sm focus:outline-none resize-none mt-1.5 hover:bg-slate-50/50 focus:bg-white rounded-lg p-1.5 transition-all border border-transparent focus:border-slate-200/80 print:hidden"
              />
              <div className="hidden print:block print:mt-0.5 print:text-[7pt] print:font-semibold print:leading-tight print:text-slate-800 whitespace-pre-wrap">
                {session.materialsNeeded || '—'}
              </div>
            </div>
          </div>

        </div>
      </div>
    </header>
  );
};
