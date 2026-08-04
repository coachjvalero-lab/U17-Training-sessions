import React from 'react';
import { 
  Printer, Trash2, 
  Sparkles
} from 'lucide-react';
import { TrainingSession } from '../types';
import { OFFICIAL_ALULA_LOGO_DATA_URL } from '../constants/logo';

interface ControlPanelProps {
  session: TrainingSession;
  currentLogo?: string;
  onImportSession: (session: TrainingSession) => void;
  onClearSession: () => void;
  onRestoreDemo: () => void;
  isSaving: boolean;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  session,
  currentLogo,
  onClearSession,
  onRestoreDemo,
  isSaving
}) => {
  // Trigger system print window
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="bg-slate-900/95 text-white rounded-2xl p-4 md:p-5 shadow-2xl border border-slate-800 print:hidden sticky top-4 z-50 backdrop-blur-md">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        
        {/* Brand & Autosave indicator */}
        <div className="flex items-center justify-between lg:justify-start space-x-3 shrink-0">
          <div className="flex items-center space-x-2">
            <div className="w-9 h-9 rounded-xl bg-slate-950 border border-amber-800/40 flex items-center justify-center p-1 shadow-md shadow-slate-950/50">
              <img 
                src={currentLogo || OFFICIAL_ALULA_LOGO_DATA_URL} 
                alt="Al Ula SC" 
                className="w-full h-full object-contain" 
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <h1 className="text-sm font-display font-black tracking-wider leading-none uppercase text-white">
                Al Ula SC U17
              </h1>
              <span className="text-[9px] text-amber-400 font-extrabold tracking-widest uppercase">
                Coaching Staff
              </span>
            </div>
          </div>

          <div className="h-6 w-[1px] bg-slate-800 hidden lg:block" />

          {/* Local Autosave indicator */}
          <div className="flex items-center space-x-2 bg-slate-800/80 px-2.5 py-1.5 rounded-full border border-slate-700/60">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isSaving ? 'bg-amber-400' : 'bg-emerald-500'}`}></span>
            </span>
            <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-300">
              {isSaving ? 'Saving...' : 'Local Autosave'}
            </span>
          </div>
        </div>

        {/* Action Button Grid */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* Print/PDF */}
          <button
            type="button"
            onClick={handlePrint}
            className="flex-1 sm:flex-initial flex items-center justify-center space-x-2 bg-emerald-500 hover:bg-emerald-600 active:scale-98 text-white font-extrabold text-xs uppercase tracking-wider py-2.5 px-4.5 rounded-xl transition-all cursor-pointer shadow-lg shadow-emerald-500/20"
            title="Print or Save as PDF (Ctrl+P)"
          >
            <Printer className="w-4 h-4" />
            <span>Print / PDF</span>
          </button>

          {/* Restore Demo */}
          <button
            type="button"
            onClick={onRestoreDemo}
            className="flex-1 sm:flex-initial flex items-center justify-center space-x-1 bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-amber-300 font-bold text-xs uppercase tracking-wider py-2.5 px-3 rounded-xl transition-all cursor-pointer border border-slate-700/80"
            title="Restore demo session with sample data"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Load Demo</span>
          </button>

          {/* Clear Session */}
          <button
            type="button"
            onClick={onClearSession}
            className="flex-1 sm:flex-initial flex items-center justify-center space-x-1 bg-slate-800 hover:bg-rose-950 hover:text-rose-400 text-slate-400 font-bold text-xs uppercase tracking-wider py-2.5 px-3 rounded-xl transition-all cursor-pointer border border-slate-700/80 hover:border-rose-900/50"
            title="Clear all fields to start from scratch"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear All</span>
          </button>

        </div>

      </div>
    </div>
  );
};
