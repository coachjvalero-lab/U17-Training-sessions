import React, { useState, useEffect } from 'react';
import { getDefaultSession, getEmptySession } from './defaultSession';
import { HeaderSection } from './components/HeaderSection';
import { ExerciseBlock } from './components/ExerciseBlock';
import { ControlPanel } from './components/ControlPanel';
import { TrainingSession, Exercise, PlayerGroup } from './types';
import { ShieldCheck, Info, Clipboard } from 'lucide-react';

export default function App() {
  // Load session from localStorage or use the demo session on first run
  const [session, setSession] = useState<TrainingSession>(() => {
    const saved = localStorage.getItem('u17_training_session');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && parsed.teamName) {
          // Normalize old titles to clean English names
          if (parsed.warmUp) {
            if (parsed.warmUp.title === 'Warm-up / Activation Block' || parsed.warmUp.title === 'Warm-up / Calentamiento (Activación)') {
              parsed.warmUp.title = 'Warm Up';
            }
          }
          if (parsed.mainPart) {
            if (parsed.mainPart.title === 'Main Block (Tactical Application)' || parsed.mainPart.title === 'Parte Principal (Táctica / Aplicación)') {
              parsed.mainPart.title = 'Main Part';
            }
          }
          if (parsed.coolDown) {
            if (parsed.coolDown.title === 'Cool Down / Recovery' || parsed.coolDown.title === 'Cool Down / Vuelta a la Calma') {
              parsed.coolDown.title = 'Cool Down';
            }
          }
          if (parsed.microcycleDay === 'MD-2') {
            parsed.microcycleDay = '-2';
          } else if (parsed.microcycleDay === 'MD-1') {
            parsed.microcycleDay = '-1';
          }
          return parsed;
        }
      } catch (e) {
        console.error('Failed to parse saved session:', e);
      }
    }
    return getDefaultSession();
  });

  const [isSaving, setIsSaving] = useState(false);
  const [expandedExercises, setExpandedExercises] = useState<Record<string, boolean>>({});

  // Automatically persist the session on change
  useEffect(() => {
    setIsSaving(true);
    localStorage.setItem('u17_training_session', JSON.stringify(session));
    const timer = setTimeout(() => {
      setIsSaving(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [session]);

  const handleUpdateSession = (fields: Partial<TrainingSession>) => {
    setSession(prev => ({
      ...prev,
      ...fields
    }));
  };

  const handleUpdateExercises = (blockKey: 'warmUp' | 'mainPart' | 'coolDown', exercises: Exercise[]) => {
    setSession(prev => ({
      ...prev,
      [blockKey]: {
        ...prev[blockKey],
        exercises
      }
    }));
  };

  const handleUpdateGroups = (playerGroups: PlayerGroup[]) => {
    setSession(prev => ({
      ...prev,
      playerGroups
    }));
  };

  const handleUpdateMaterials = (materialsNeeded: string) => {
    setSession(prev => ({
      ...prev,
      materialsNeeded
    }));
  };

  const handleImportSession = (imported: TrainingSession) => {
    setSession(imported);
    // Expand all exercises of imported session
    const expanded: Record<string, boolean> = {};
    imported.warmUp.exercises.forEach(ex => { expanded[ex.id] = true; });
    imported.mainPart.exercises.forEach(ex => { expanded[ex.id] = true; });
    imported.coolDown.exercises.forEach(ex => { expanded[ex.id] = true; });
    setExpandedExercises(expanded);
  };

  const handleClearSession = () => {
    if (confirm('Are you sure you want to clear the entire session? This will delete all exercises and text.')) {
      setSession(getEmptySession());
      setExpandedExercises({});
    }
  };

  const handleRestoreDemo = () => {
    if (confirm('Are you sure you want to restore the demo training session? This will overwrite your current work.')) {
      setSession(getDefaultSession());
      setExpandedExercises({});
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedExercises(prev => ({
      ...prev,
      [id]: prev[id] === false ? true : false
    }));
  };

  // Quick Action: Expand All or Collapse All
  const handleToggleAll = (expand: boolean) => {
    const nextExpanded: Record<string, boolean> = {};
    session.warmUp.exercises.forEach(e => { nextExpanded[e.id] = expand; });
    session.mainPart.exercises.forEach(e => { nextExpanded[e.id] = expand; });
    session.coolDown.exercises.forEach(e => { nextExpanded[e.id] = expand; });
    setExpandedExercises(nextExpanded);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 antialiased font-sans pb-16 print:bg-white print:pb-0 print:pt-0">
      
      {/* Outer Wrapper */}
      <div className="w-full max-w-5xl mx-auto px-4 py-6 space-y-6 md:py-8 md:space-y-8 print:p-0 print:max-w-full">
        
        {/* Floating / Sticky Control Panel - Hidden in Print */}
        <ControlPanel 
          session={session}
          onImportSession={handleImportSession}
          onClearSession={handleClearSession}
          onRestoreDemo={handleRestoreDemo}
          isSaving={isSaving}
        />

        {/* Dynamic Coach Instruction Banner - Hidden in Print */}
        <div className="bg-emerald-50/40 border border-emerald-500/15 rounded-2xl p-5 flex items-start space-x-4 shadow-sm shadow-emerald-50/50 print:hidden">
          <div className="p-2.5 bg-emerald-500 rounded-xl text-white shrink-0 shadow-md shadow-emerald-500/20">
            <Info className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-display font-black tracking-wider uppercase text-emerald-800">Professional U17 Session Designer</h3>
            <p className="text-xs font-medium text-slate-600 mt-1 leading-relaxed">
              Fill in the session details, select tactical diagrams or upload your own diagrams. When finished, use the <strong className="text-emerald-700 font-bold">Print / PDF</strong> action to generate a compact, beautifully styled sheet to bring to the pitch or share digitally.
            </p>
            <div className="mt-3 flex items-center space-x-3">
              <button
                type="button"
                onClick={() => handleToggleAll(true)}
                className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 hover:text-emerald-800 cursor-pointer"
              >
                Expand all exercises
              </button>
              <span className="text-slate-300 text-[10px]">|</span>
              <button
                type="button"
                onClick={() => handleToggleAll(false)}
                className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 hover:text-emerald-800 cursor-pointer"
              >
                Collapse all exercises
              </button>
            </div>
          </div>
        </div>

        {/* Main Document Frame */}
        <main className="space-y-6 md:space-y-8 print:space-y-4">
          
          {/* Header Section */}
          <HeaderSection 
            session={session}
            onChange={handleUpdateSession}
          />

          {/* Section: Warm-Up Block */}
          <ExerciseBlock 
            block={session.warmUp}
            onChange={(exs) => handleUpdateExercises('warmUp', exs)}
            expandedExercises={expandedExercises}
            toggleExpand={toggleExpand}
          />

          {/* Section: Main Part Block */}
          <ExerciseBlock 
            block={session.mainPart}
            onChange={(exs) => handleUpdateExercises('mainPart', exs)}
            expandedExercises={expandedExercises}
            toggleExpand={toggleExpand}
          />

          {/* Section: Cool Down Block */}
          <ExerciseBlock 
            block={session.coolDown}
            onChange={(exs) => handleUpdateExercises('coolDown', exs)}
            expandedExercises={expandedExercises}
            toggleExpand={toggleExpand}
          />

        </main>

        {/* Print-Only Professional Document Footer */}
        <footer className="hidden print:grid grid-cols-2 gap-8 mt-12 pt-8 border-t-2 border-slate-200">
          <div>
            <div className="border-b border-slate-300 h-10 w-full mb-1"></div>
            <p className="text-[10px] uppercase font-bold text-slate-500 text-center">Head Coach Signature</p>
          </div>
          <div>
            <div className="border-b border-slate-300 h-10 w-full mb-1"></div>
            <p className="text-[10px] uppercase font-bold text-slate-500 text-center">Assistant Coach Signature</p>
          </div>
          <div className="col-span-2 text-center text-[9px] text-slate-400 mt-4">
            Training Session created with <span className="font-semibold text-slate-600">U17 Training Sessions Planner</span>. Authorized for official club coaching staff use.
          </div>
        </footer>

      </div>
    </div>
  );
}
