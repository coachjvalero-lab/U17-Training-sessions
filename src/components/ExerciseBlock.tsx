import React, { useState } from 'react';
import { 
  ChevronDown, ChevronUp, Plus, Trash2, ArrowUp, ArrowDown, 
  Clock, Maximize2, ShieldAlert, Image as ImageIcon, Sparkles, AlertCircle
} from 'lucide-react';
import { Exercise, GameMoment, TrainingBlock } from '../types';

interface ExerciseBlockProps {
  block: TrainingBlock;
  onChange: (updatedExercises: Exercise[]) => void;
  expandedExercises: Record<string, boolean>;
  toggleExpand: (id: string) => void;
}

const GAME_MOMENTS: GameMoment[] = ['Attack', 'Defense', 'Transition A-D', 'Transition D-A', 'Set Pieces', 'Other'];

// Standard soccer template graphics to load instantly
const FIELD_TEMPLATES = {
  field: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%"><rect width="400" height="300" fill="%2315803d" /><rect x="10" y="10" width="380" height="280" fill="none" stroke="white" stroke-width="2" /><line x1="200" y1="10" x2="200" y2="290" stroke="white" stroke-width="2" /><circle cx="200" cy="150" r="40" fill="none" stroke="white" stroke-width="2" /><circle cx="200" cy="150" r="3" fill="white" /><rect x="10" y="70" width="50" height="160" fill="none" stroke="white" stroke-width="2" /><rect x="10" y="110" width="15" height="80" fill="none" stroke="white" stroke-width="2" /><rect x="340" y="70" width="50" height="160" fill="none" stroke="white" stroke-width="2" /><rect x="375" y="110" width="15" height="80" fill="none" stroke="white" stroke-width="2" /></svg>`,
  rondo: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%"><rect width="400" height="300" fill="%23166534" /><rect x="100" y="50" width="200" height="200" fill="none" stroke="white" stroke-dasharray="4" stroke-width="2" /><circle cx="200" cy="65" r="8" fill="%233b82f6" stroke="white" stroke-width="1" /><circle cx="200" cy="235" r="8" fill="%233b82f6" stroke="white" stroke-width="1" /><circle cx="115" cy="150" r="8" fill="%233b82f6" stroke="white" stroke-width="1" /><circle cx="285" cy="150" r="8" fill="%233b82f6" stroke="white" stroke-width="1" /><circle cx="180" cy="130" r="8" fill="%23ef4444" stroke="white" stroke-width="1" /><circle cx="220" cy="170" r="8" fill="%23ef4444" stroke="white" stroke-width="1" /><circle cx="185" cy="85" r="4" fill="white" stroke="black" stroke-width="1" /></svg>`,
  halfField: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%"><rect width="400" height="300" fill="%2314532d" /><rect x="10" y="10" width="380" height="280" fill="none" stroke="white" stroke-width="2" /><line x1="10" y1="150" x2="390" y2="150" stroke="white" stroke-width="2" stroke-dasharray="3" /><rect x="110" y="10" width="180" height="70" fill="none" stroke="white" stroke-width="2" /><circle cx="200" cy="80" r="3" fill="white" /><path d="M 160 80 A 40 40 0 0 0 240 80" fill="none" stroke="white" stroke-width="2" /></svg>`
};

export const ExerciseBlock: React.FC<ExerciseBlockProps> = ({ 
  block, 
  onChange, 
  expandedExercises, 
  toggleExpand 
}) => {
  const [dragOverExId, setDragOverExId] = useState<string | null>(null);

  const addExercise = () => {
    const newEx: Exercise = {
      id: 'ex-' + Date.now(),
      name: 'New Exercise',
      gameMoment: 'Other',
      subMoment: '',
      description: '',
      duration: '15 min',
      dimensions: '30x20m',
      coachRoles: 'Coach A: Referee, Coach B: Direct Feedback',
      image: FIELD_TEMPLATES.field,
      playerGroups: ''
    };
    onChange([...block.exercises, newEx]);
    toggleExpand(newEx.id); // Expand new exercise on creation
  };

  const deleteExercise = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this exercise?')) {
      onChange(block.exercises.filter(ex => ex.id !== id));
    }
  };

  const updateExercise = (id: string, fields: Partial<Exercise>) => {
    onChange(
      block.exercises.map(ex => (ex.id === id ? { ...ex, ...fields } : ex))
    );
  };

  // Move exercise up/down
  const moveExercise = (index: number, direction: 'up' | 'down', e: React.MouseEvent) => {
    e.stopPropagation();
    const newExs = [...block.exercises];
    if (direction === 'up' && index > 0) {
      const temp = newExs[index];
      newExs[index] = newExs[index - 1];
      newExs[index - 1] = temp;
    } else if (direction === 'down' && index < newExs.length - 1) {
      const temp = newExs[index];
      newExs[index] = newExs[index + 1];
      newExs[index + 1] = temp;
    }
    onChange(newExs);
  };

  // Image upload handling
  const processFile = (file: File, exId: string) => {
    if (file.size > 1.5 * 1024 * 1024) {
      alert('The exercise image is too large. Please select an image smaller than 1.5MB.');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      updateExercise(exId, { image: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, exId: string) => {
    const file = e.target.files?.[0];
    if (file) processFile(file, exId);
  };

  // Drag and drop events
  const handleDragOver = (e: React.DragEvent, exId: string) => {
    e.preventDefault();
    setDragOverExId(exId);
  };

  const handleDragLeave = () => {
    setDragOverExId(null);
  };

  const handleDrop = (e: React.DragEvent, exId: string) => {
    e.preventDefault();
    setDragOverExId(null);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file, exId);
  };

  const getMomentBadgeStyles = (moment: GameMoment) => {
    switch (moment) {
      case 'Attack': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Defense': return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'Transition A-D': return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'Transition D-A': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Set Pieces': return 'bg-purple-50 text-purple-700 border-purple-200';
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 shadow-md shadow-slate-100/80 print:shadow-none print:border-slate-300 print:p-4 print:rounded-none space-y-4">
      {/* Block Header */}
      <div className="flex justify-between items-center border-b border-slate-100 pb-3.5 print:border-slate-300 print:pb-1">
        <h2 className="text-sm font-display font-black text-slate-900 tracking-wider uppercase flex items-center space-x-2 print:text-black print:text-base">
          <span className="w-2.5 h-6 bg-emerald-500 rounded-md print:hidden shadow-sm shadow-emerald-500/30" />
          <span>{block.title}</span>
        </h2>
        <button
          type="button"
          onClick={addExercise}
          className="flex items-center space-x-1.5 text-[11px] bg-slate-900 hover:bg-emerald-600 text-white font-extrabold tracking-wider uppercase py-2 px-4 rounded-xl transition-all cursor-pointer shadow-sm active:scale-98 print:hidden"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Exercise</span>
        </button>
      </div>

      {/* No Exercises state */}
      {block.exercises.length === 0 && (
        <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-2xl print:hidden bg-slate-50/50">
          <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-slate-500 text-xs font-semibold">No exercises in this tactical block.</p>
          <button
            type="button"
            onClick={addExercise}
            className="text-xs text-emerald-600 hover:text-emerald-700 font-extrabold uppercase tracking-wide mt-2 hover:underline"
          >
            Create first exercise +
          </button>
        </div>
      )}

      {/* Exercises List */}
      <div className="space-y-5">
        {block.exercises.map((ex, idx) => {
          const isExpanded = expandedExercises[ex.id] !== false; // defaults to expanded

          return (
            <div 
              key={ex.id} 
              className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all bg-slate-50/10 hover:border-slate-300 print:border-slate-300 print:shadow-none print:bg-white print:rounded-none print:no-break"
            >
              {/* Exercise Card Titlebar */}
              <div 
                onClick={() => toggleExpand(ex.id)}
                className="bg-slate-50/80 px-4 py-3.5 border-b border-slate-200 flex flex-wrap justify-between items-center gap-2 cursor-pointer select-none hover:bg-slate-100/70 print:bg-slate-100 print:border-slate-300 print:py-1.5 print:px-3"
              >
                <div className="flex items-center space-x-3 max-w-[70%]">
                  {/* Order indicator */}
                  <span className="w-6 h-6 flex items-center justify-center rounded-lg bg-slate-900 text-[11px] font-display font-black text-emerald-400 print:bg-slate-300 print:text-black shrink-0">
                    {idx + 1}
                  </span>
                  {/* Exercise Name editable (without expanding) */}
                  <input
                    type="text"
                    value={ex.name}
                    onClick={(e) => e.stopPropagation()} // don't toggle
                    onChange={(e) => updateExercise(ex.id, { name: e.target.value })}
                    className="font-display font-bold text-slate-900 bg-transparent border-b border-transparent focus:border-slate-300 focus:outline-none focus:bg-white px-2 py-0.5 rounded text-sm sm:text-base print:text-sm print:text-black print:font-bold print:p-0"
                    placeholder="Exercise Title"
                  />
                </div>

                {/* Badges and actions */}
                <div className="flex items-center space-x-2.5 shrink-0">
                  {/* Moment badge */}
                  <span className={`text-[9px] uppercase tracking-wider font-extrabold px-2.5 py-1 rounded-md border ${getMomentBadgeStyles(ex.gameMoment)} print:text-black print:bg-transparent print:border-black/20`}>
                    {ex.gameMoment}
                  </span>

                  {/* Reordering and deleting buttons (Hidden in print) */}
                  <div className="flex items-center space-x-1 print:hidden" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={(e) => moveExercise(idx, 'up', e)}
                      className="p-1.5 text-slate-400 hover:text-slate-800 disabled:opacity-20 rounded-lg hover:bg-slate-200/60 transition-colors"
                      title="Move Up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === block.exercises.length - 1}
                      onClick={(e) => moveExercise(idx, 'down', e)}
                      className="p-1.5 text-slate-400 hover:text-slate-800 disabled:opacity-20 rounded-lg hover:bg-slate-200/60 transition-colors"
                      title="Move Down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => deleteExercise(ex.id, e)}
                      className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Delete Exercise"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Expand/Collapse Chevron (Hidden in print) */}
                  <div className="print:hidden">
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-slate-500" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-500" />
                    )}
                  </div>
                </div>
              </div>

              {/* Collapsible Content */}
              {isExpanded && (
                <div className="p-4 md:p-5 grid grid-cols-1 md:grid-cols-12 gap-5 print:grid-cols-12 print:gap-3 print:p-3 bg-white">
                  
                  {/* Left col: Image / tactical drawer (Span 4) */}
                  <div className="md:col-span-4 space-y-2.5 print:col-span-4">
                    <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block print:hidden">
                      Tactical Diagram / Pitch
                    </label>

                    {/* Drag & Drop Area */}
                    <div
                      onDragOver={(e) => handleDragOver(e, ex.id)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, ex.id)}
                      className={`relative aspect-[4/3] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center overflow-hidden transition-all bg-white print:border-slate-300 print:rounded-none
                        ${dragOverExId === ex.id 
                          ? 'border-emerald-500 bg-emerald-50/50 scale-102 shadow-md' 
                          : 'border-slate-200 hover:border-slate-300'}`}
                    >
                      {ex.image ? (
                        <>
                          <img 
                            src={ex.image} 
                            alt="Tactical diagram" 
                            className="w-full h-full object-contain"
                            referrerPolicy="no-referrer"
                          />
                          
                          {/* Image overlay to change (Hidden in print) */}
                          <div className="absolute inset-0 bg-slate-950/70 opacity-0 hover:opacity-100 flex items-center justify-center space-x-2 transition-opacity print:hidden">
                            <label className="bg-white hover:bg-emerald-50 text-slate-900 text-[10px] font-extrabold uppercase tracking-wide px-3 py-1.5 rounded-xl cursor-pointer shadow-lg">
                              Upload New
                              <input 
                                type="file" 
                                accept="image/*" 
                                className="hidden" 
                                onChange={(e) => handleFileChange(e, ex.id)} 
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => updateExercise(ex.id, { image: '' })}
                              className="bg-rose-600 text-white hover:bg-rose-700 text-[10px] font-extrabold uppercase tracking-wide px-3 py-1.5 rounded-xl shadow-lg"
                            >
                              Clear
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="text-center p-4 print:hidden">
                          <ImageIcon className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                          <p className="text-[10px] font-bold text-slate-500 leading-tight">
                            Drag image here
                          </p>
                          <p className="text-[9px] text-slate-400 mb-2.5">
                            or click to browse
                          </p>
                          <label className="bg-slate-900 hover:bg-emerald-600 text-white text-[9px] font-extrabold uppercase tracking-wide px-3 py-1.5 rounded-xl cursor-pointer shadow inline-block">
                            Browse file
                            <input 
                              type="file" 
                              accept="image/*" 
                              className="hidden" 
                              onChange={(e) => handleFileChange(e, ex.id)} 
                            />
                          </label>
                        </div>
                      )}

                      {/* Fallback image placeholder in print if they literally loaded nothing */}
                      {!ex.image && (
                        <div className="hidden print:flex items-center justify-center text-[10px] text-slate-400">
                          (No diagram uploaded)
                        </div>
                      )}
                    </div>

                    {/* Pre-made tactical templates button picker (Hidden in print) */}
                    <div className="flex flex-wrap items-center gap-1.5 print:hidden">
                      <span className="text-[9px] font-extrabold text-slate-400 flex items-center uppercase tracking-wide">
                        <Sparkles className="w-2.5 h-2.5 mr-0.5 text-emerald-500" />
                        Templates:
                      </span>
                      <button
                        type="button"
                        onClick={() => updateExercise(ex.id, { image: FIELD_TEMPLATES.field })}
                        className="text-[9px] bg-slate-50 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 font-bold uppercase tracking-wider px-2 py-1 rounded-lg text-slate-500 border border-slate-200/80 transition-colors"
                      >
                        Full Pitch
                      </button>
                      <button
                        type="button"
                        onClick={() => updateExercise(ex.id, { image: FIELD_TEMPLATES.halfField })}
                        className="text-[9px] bg-slate-50 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 font-bold uppercase tracking-wider px-2 py-1 rounded-lg text-slate-500 border border-slate-200/80 transition-colors"
                      >
                        Half Pitch
                      </button>
                      <button
                        type="button"
                        onClick={() => updateExercise(ex.id, { image: FIELD_TEMPLATES.rondo })}
                        className="text-[9px] bg-slate-50 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 font-bold uppercase tracking-wider px-2 py-1 rounded-lg text-slate-500 border border-slate-200/80 transition-colors"
                      >
                        Rondo
                      </button>
                    </div>
                  </div>

                  {/* Right col: Form controls (Span 8) */}
                  <div className="md:col-span-8 space-y-3.5 print:col-span-8 print:space-y-1.5">
                    
                    {/* Game Moment / Sub-moment select */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 print:grid-cols-2 print:gap-2">
                      <div>
                        <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1.5 print:text-black">
                          Game Moment
                        </label>
                        <select
                          value={ex.gameMoment}
                          onChange={(e) => updateExercise(ex.id, { gameMoment: e.target.value as GameMoment })}
                          className="w-full text-xs font-bold bg-white border border-slate-200 px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all print:p-0 print:border-none print:font-bold"
                        >
                          {GAME_MOMENTS.map(moment => (
                            <option key={moment} value={moment}>{moment}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1.5 print:text-black">
                          Tactical Sub-moment
                        </label>
                        <input
                          type="text"
                          value={ex.subMoment}
                          onChange={(e) => updateExercise(ex.id, { subMoment: e.target.value })}
                          placeholder="e.g., Counter-pressing, Low block"
                          className="w-full text-xs font-bold bg-white border border-slate-200 px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all print:p-0 print:border-none"
                        />
                      </div>
                    </div>

                    {/* Metadata: Duration / Space / Coach Roles */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 print:grid-cols-3 print:gap-1.5">
                      <div>
                        <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1.5 print:text-black flex items-center">
                          <Clock className="w-3.5 h-3.5 mr-1 text-slate-400 print:hidden" />
                          Duration
                        </label>
                        <input
                          type="text"
                          value={ex.duration}
                          onChange={(e) => updateExercise(ex.id, { duration: e.target.value })}
                          placeholder="e.g., 15 mins"
                          className="w-full text-xs font-bold bg-white border border-slate-200 px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all print:p-0 print:border-none"
                        />
                      </div>

                      <div>
                        <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1.5 print:text-black flex items-center">
                          <Maximize2 className="w-3.5 h-3.5 mr-1 text-slate-400 print:hidden" />
                          Pitch Size
                        </label>
                        <input
                          type="text"
                          value={ex.dimensions}
                          onChange={(e) => updateExercise(ex.id, { dimensions: e.target.value })}
                          placeholder="e.g., 40x30m"
                          className="w-full text-xs font-bold bg-white border border-slate-200 px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all print:p-0 print:border-none"
                        />
                      </div>

                      <div>
                        <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1.5 print:text-black flex items-center">
                          <ShieldAlert className="w-3.5 h-3.5 mr-1 text-slate-400 print:hidden" />
                          Staff Roles
                        </label>
                        <textarea
                          value={ex.coachRoles}
                          onChange={(e) => updateExercise(ex.id, { coachRoles: e.target.value })}
                          rows={2}
                          placeholder="Coach A: Referee, Coach B: Feedback"
                          className="w-full text-xs font-bold bg-white border border-slate-200 px-3 py-1 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all resize-y print:resize-none print:p-0 print:border-none"
                        />
                      </div>
                    </div>

                    {/* Detailed Description */}
                    <div>
                      <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1.5 print:text-black">
                        Detailed Instructions & Rules of Provocation
                      </label>
                      <textarea
                        value={ex.description}
                        onChange={(e) => updateExercise(ex.id, { description: e.target.value })}
                        rows={4}
                        placeholder="Describe the tactical flow, rules, constraints, or jokers to trigger the desired behavior..."
                        className="w-full text-xs font-semibold bg-white border border-slate-200 px-3 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 resize-y transition-all print:resize-none print:p-0 print:border-none print:leading-relaxed"
                      />
                    </div>

                    {/* Player Groups (Moved inside each exercise block) */}
                    <div>
                      <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1.5 print:text-black">
                        Player Groups & Assignments
                      </label>
                      <textarea
                        value={ex.playerGroups || ''}
                        onChange={(e) => updateExercise(ex.id, { playerGroups: e.target.value })}
                        rows={2}
                        placeholder="e.g., Group A (Blue): Sophia, Valeria, Marta. Group B (Yellow): Carmen, Irene, Andrea."
                        className="w-full text-xs font-semibold bg-white border border-slate-200 px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 resize-y transition-all print:resize-none print:p-0 print:border-none print:leading-relaxed"
                      />
                    </div>
                  </div>

                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};
