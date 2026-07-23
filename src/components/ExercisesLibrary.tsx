import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  Plus, 
  BookOpen, 
  Layers, 
  Activity, 
  ShieldCheck, 
  Clock, 
  Maximize2, 
  PlusCircle, 
  Trash2, 
  Check, 
  X, 
  Image as ImageIcon,
  ChevronDown,
  Upload,
  Loader2,
  Sparkles
} from 'lucide-react';
import { Exercise, GameMoment, TrainingSession } from '../types';
import { CloudTrainingSession } from '../firebase';
import { processUploadedImageFile } from '../utils/heic';

interface ExercisesLibraryProps {
  currentSession: TrainingSession;
  cloudSessions: CloudTrainingSession[];
  onAddExerciseToSession: (
    blockKey: 'warmUp' | 'mainPart' | 'coolDown', 
    exercise: Exercise,
    targetSection?: 'football' | 'fitness' | 'gk'
  ) => void;
  activeSection: 'football' | 'fitness' | 'gk' | 'exercises';
}

export const ExercisesLibrary: React.FC<ExercisesLibraryProps> = ({
  currentSession,
  cloudSessions,
  onAddExerciseToSession,
  activeSection
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'football' | 'fitness' | 'gk'>('all');
  const [momentFilter, setMomentFilter] = useState<string>('all');
  
  // Custom exercises saved specifically by the user in the library
  const [customExercises, setCustomExercises] = useState<Exercise[]>(() => {
    try {
      const saved = localStorage.getItem('u17_custom_exercise_library');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  // Modal for creating a new exercise
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newEx, setNewEx] = useState<Partial<Exercise>>({
    name: '',
    gameMoment: 'Attack',
    subMoment: '',
    description: '',
    duration: '15 min',
    dimensions: '30x20m',
    coachRoles: '',
    playerGroups: '',
    isFitness: false,
    image: ''
  });
  const [newExSection, setNewExSection] = useState<'football' | 'fitness' | 'gk'>('football');
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Notification toast when exercise is added to session
  const [addedToast, setAddedToast] = useState<string | null>(null);

  // State to track dropdown for target block insertion
  const [openAddDropdownId, setOpenAddDropdownId] = useState<string | null>(null);

  // Save custom exercises to localStorage whenever updated
  useEffect(() => {
    try {
      localStorage.setItem('u17_custom_exercise_library', JSON.stringify(customExercises));
    } catch (e) {
      console.error('Failed to save custom exercises library:', e);
    }
  }, [customExercises]);

  // Extract all exercises across current session, all cloud sessions, and custom library
  const allExercises = (() => {
    const list: (Exercise & { sourceSession?: string; sectionCategory?: 'football' | 'fitness' | 'gk'; isCustom?: boolean })[] = [];
    const seenIds = new Set<string>();

    const addEx = (ex: Exercise, source: string, sectionCat: 'football' | 'fitness' | 'gk', isCustom = false) => {
      if (!ex || !ex.name) return;
      // Deduplicate identical IDs or name+description pairs
      const uniqueKey = ex.id || `${ex.name}-${ex.description.substring(0, 30)}`;
      if (seenIds.has(uniqueKey)) return;
      seenIds.add(uniqueKey);

      list.push({
        ...ex,
        id: ex.id || 'lib-ex-' + Math.random().toString(36).substring(2, 9),
        sourceSession: source,
        sectionCategory: sectionCat,
        isCustom
      });
    };

    // 1. Custom exercises from user library
    customExercises.forEach(ex => {
      const cat = ex.isFitness ? 'fitness' : (ex.id.includes('gk') ? 'gk' : 'football');
      addEx(ex, 'Biblioteca Personal', cat, true);
    });

    // 2. Current Session Exercises
    (currentSession.warmUp?.exercises || []).forEach(e => addEx(e, 'Sesión Actual (Fútbol)', 'football'));
    (currentSession.mainPart?.exercises || []).forEach(e => addEx(e, 'Sesión Actual (Fútbol)', 'football'));
    (currentSession.coolDown?.exercises || []).forEach(e => addEx(e, 'Sesión Actual (Fútbol)', 'football'));

    (currentSession.fitnessWarmUp?.exercises || []).forEach(e => addEx(e, 'Sesión Actual (Fitness)', 'fitness'));
    (currentSession.fitnessMainPart?.exercises || []).forEach(e => addEx(e, 'Sesión Actual (Fitness)', 'fitness'));
    (currentSession.fitnessCoolDown?.exercises || []).forEach(e => addEx(e, 'Sesión Actual (Fitness)', 'fitness'));

    (currentSession.gkWarmUp?.exercises || []).forEach(e => addEx(e, 'Sesión Actual (Porteros)', 'gk'));
    (currentSession.gkMainPart?.exercises || []).forEach(e => addEx(e, 'Sesión Actual (Porteros)', 'gk'));
    (currentSession.gkCoolDown?.exercises || []).forEach(e => addEx(e, 'Sesión Actual (Porteros)', 'gk'));

    // 3. Cloud Sessions Exercises
    cloudSessions.forEach(cSess => {
      const sessLabel = `Sesión #${cSess.sessionNumber || '1'}`;
      (cSess.warmUp?.exercises || []).forEach(e => addEx(e, sessLabel, 'football'));
      (cSess.mainPart?.exercises || []).forEach(e => addEx(e, sessLabel, 'football'));
      (cSess.coolDown?.exercises || []).forEach(e => addEx(e, sessLabel, 'football'));

      (cSess.fitnessWarmUp?.exercises || []).forEach(e => addEx(e, sessLabel, 'fitness'));
      (cSess.fitnessMainPart?.exercises || []).forEach(e => addEx(e, sessLabel, 'fitness'));
      (cSess.fitnessCoolDown?.exercises || []).forEach(e => addEx(e, sessLabel, 'fitness'));

      (cSess.gkWarmUp?.exercises || []).forEach(e => addEx(e, sessLabel, 'gk'));
      (cSess.gkMainPart?.exercises || []).forEach(e => addEx(e, sessLabel, 'gk'));
      (cSess.gkCoolDown?.exercises || []).forEach(e => addEx(e, sessLabel, 'gk'));
    });

    return list;
  })();

  // Filter exercises by category, moment, search query
  const filteredExercises = allExercises.filter(ex => {
    // Category match
    if (categoryFilter !== 'all' && ex.sectionCategory !== categoryFilter) {
      return false;
    }
    // Moment match
    if (momentFilter !== 'all' && ex.gameMoment !== momentFilter) {
      return false;
    }
    // Search match
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const matchName = ex.name?.toLowerCase().includes(term);
      const matchDesc = ex.description?.toLowerCase().includes(term);
      const matchSub = ex.subMoment?.toLowerCase().includes(term);
      const matchDim = ex.dimensions?.toLowerCase().includes(term);
      return matchName || matchDesc || matchSub || matchDim;
    }
    return true;
  });

  // Handle Image upload for new exercise
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      alert('Imagen demasiado grande. Selecciona una menor a 8MB.');
      return;
    }
    setIsUploadingImage(true);
    try {
      const imgData = await processUploadedImageFile(file);
      setNewEx(prev => ({ ...prev, image: imgData }));
    } catch (err) {
      console.error('Failed uploading exercise image:', err);
      alert('Error procesando la imagen del ejercicio.');
    } finally {
      setIsUploadingImage(false);
    }
  };

  // Create & Save custom exercise to local library
  const handleSaveCustomExercise = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEx.name?.trim()) {
      alert('Por favor ingresa un nombre para el ejercicio.');
      return;
    }

    const created: Exercise = {
      id: 'custom-ex-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      name: newEx.name || 'Ejercicio Personalizado',
      gameMoment: (newEx.gameMoment as GameMoment) || 'Attack',
      subMoment: newEx.subMoment || '',
      description: newEx.description || '',
      duration: newEx.duration || '15 min',
      dimensions: newEx.dimensions || '30x20m',
      coachRoles: newEx.coachRoles || '',
      playerGroups: newEx.playerGroups || '',
      isFitness: newExSection === 'fitness',
      image: newEx.image || ''
    };

    setCustomExercises(prev => [created, ...prev]);
    setShowCreateModal(false);
    setNewEx({
      name: '',
      gameMoment: 'Attack',
      subMoment: '',
      description: '',
      duration: '15 min',
      dimensions: '30x20m',
      coachRoles: '',
      playerGroups: '',
      isFitness: false,
      image: ''
    });

    setAddedToast('¡Ejercicio guardado exitosamente en la biblioteca!');
    setTimeout(() => setAddedToast(null), 3000);
  };

  // Delete custom exercise
  const handleDeleteCustomExercise = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('¿Deseas eliminar este ejercicio de la biblioteca personal?')) {
      setCustomExercises(prev => prev.filter(ex => ex.id !== id));
    }
  };

  // Insert selected exercise into current training session
  const handleInsert = (
    ex: Exercise, 
    blockKey: 'warmUp' | 'mainPart' | 'coolDown', 
    sectionCat: 'football' | 'fitness' | 'gk'
  ) => {
    // Clone exercise with fresh ID
    const clonedEx: Exercise = {
      ...ex,
      id: 'ex-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6)
    };

    onAddExerciseToSession(blockKey, clonedEx, sectionCat);
    setOpenAddDropdownId(null);

    const blockName = blockKey === 'warmUp' ? 'Calentamiento' : blockKey === 'mainPart' ? 'Parte Principal' : 'Vuelta a la Calma';
    setAddedToast(`Añadido "${ex.name}" a ${blockName} (${sectionCat.toUpperCase()})`);
    setTimeout(() => setAddedToast(null), 3500);
  };

  const gameMomentsList: GameMoment[] = ['Attack', 'Defense', 'Transition A-D', 'Transition D-A', 'Set Pieces', 'Other'];

  return (
    <div className="space-y-6 print:hidden">
      
      {/* Toast Banner */}
      {addedToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl border border-emerald-500 flex items-center space-x-2 animate-bounce">
          <Check className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs font-bold">{addedToast}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#002142] via-[#003366] to-[#0f5981] rounded-2xl p-6 text-white shadow-xl border border-[#5ea4c5]/30">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2.5">
              <div className="p-2.5 bg-[#a79078] text-slate-950 rounded-xl shadow-md">
                <BookOpen className="w-6 h-6" />
              </div>
              <h2 className="text-xl md:text-2xl font-display font-black tracking-tight uppercase text-white">
                Biblioteca de Ejercicios / Exercises Database
              </h2>
            </div>
            <p className="text-xs text-sky-200/80 max-w-2xl font-medium pt-1">
              Explora y reutiliza todos los ejercicios creados en tus sesiones de entrenamiento. Filtra por categoría o momento táctico y añádelos con un clic a tu sesión activa.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="flex items-center justify-center space-x-2 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-extrabold text-xs uppercase tracking-wider py-3 px-5 rounded-xl transition-all shadow-lg shadow-emerald-500/20 cursor-pointer shrink-0"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Crear Nuevo Ejercicio</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
          
          {/* Search Box */}
          <div className="sm:col-span-6 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar ejercicio por nombre, descripción o espacio..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#002142]/10 focus:border-[#0f5981]"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Category Filter */}
          <div className="sm:col-span-3">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as any)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:border-[#0f5981] cursor-pointer"
            >
              <option value="all">Todas las Categorías</option>
              <option value="football">⚽ Fútbol / Football</option>
              <option value="fitness">🏃 Prep. Física / Fitness</option>
              <option value="gk">🧤 Porteros / Goalkeepers</option>
            </select>
          </div>

          {/* Game Moment Filter */}
          <div className="sm:col-span-3">
            <select
              value={momentFilter}
              onChange={(e) => setMomentFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:border-[#0f5981] cursor-pointer"
            >
              <option value="all">Todos los Momentos Tácticos</option>
              {gameMomentsList.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

        </div>

        {/* Counter Badge */}
        <div className="flex items-center justify-between text-xs text-slate-500 font-semibold pt-1 border-t border-slate-100">
          <span>
            Mostrando <strong className="text-slate-900 font-extrabold">{filteredExercises.length}</strong> de <strong className="text-slate-900 font-extrabold">{allExercises.length}</strong> ejercicios disponibles
          </span>
          {(categoryFilter !== 'all' || momentFilter !== 'all' || searchTerm) && (
            <button
              type="button"
              onClick={() => {
                setCategoryFilter('all');
                setMomentFilter('all');
                setSearchTerm('');
              }}
              className="text-xs text-[#0f5981] hover:underline font-bold"
            >
              Restablecer Filtros
            </button>
          )}
        </div>
      </div>

      {/* Exercises Grid */}
      {filteredExercises.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3">
          <BookOpen className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-sm font-bold text-slate-800">No se encontraron ejercicios</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Prueba a modificar los términos de búsqueda o filtros, o crea un nuevo ejercicio para guardarlo en la biblioteca.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredExercises.map((ex) => {
            const isDropdownOpen = openAddDropdownId === ex.id;
            
            const categoryBadge = ex.sectionCategory === 'fitness' 
              ? { label: 'Fitness', color: 'bg-amber-100 text-amber-800 border-amber-300' }
              : ex.sectionCategory === 'gk'
              ? { label: 'Portero', color: 'bg-sky-100 text-sky-800 border-sky-300' }
              : { label: 'Fútbol', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' };

            return (
              <div 
                key={ex.id}
                className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  {/* Top Header Row */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border ${categoryBadge.color}`}>
                          {categoryBadge.label}
                        </span>
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                          {ex.gameMoment || 'Attack'}
                        </span>
                        {ex.sourceSession && (
                          <span className="text-[9px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                            {ex.sourceSession}
                          </span>
                        )}
                      </div>

                      <h4 className="text-sm font-display font-black text-slate-900 leading-snug">
                        {ex.name}
                      </h4>
                    </div>

                    {/* Delete button for custom items */}
                    {ex.isCustom && (
                      <button
                        type="button"
                        onClick={(e) => handleDeleteCustomExercise(ex.id, e)}
                        className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Eliminar de la biblioteca"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Submoment & Metadata badges */}
                  {ex.subMoment && (
                    <p className="text-xs text-[#0f5981] font-bold italic bg-sky-50/60 p-2 rounded-xl border border-sky-100">
                      "{ex.subMoment}"
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <div className="flex items-center space-x-1">
                      <Clock className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{ex.duration || '15 min'}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Maximize2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{ex.dimensions || 'Camp completo'}</span>
                    </div>
                  </div>

                  {/* Description preview */}
                  {ex.description && (
                    <p className="text-xs text-slate-700 font-normal leading-relaxed line-clamp-3">
                      {ex.description}
                    </p>
                  )}

                  {/* Image Diagram preview if present */}
                  {ex.image && (
                    <div className="h-32 rounded-xl bg-slate-900 overflow-hidden border border-slate-200 p-1 flex items-center justify-center">
                      <img 
                        src={ex.image} 
                        alt={ex.name} 
                        className="w-full h-full object-contain"
                      />
                    </div>
                  )}
                </div>

                {/* Bottom Actions Row */}
                <div className="pt-3 border-t border-slate-100 relative">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      Usar en entrenamiento
                    </span>

                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setOpenAddDropdownId(isDropdownOpen ? null : ex.id)}
                        className="flex items-center space-x-1.5 bg-[#002142] hover:bg-[#003366] text-white text-xs font-bold py-2 px-3.5 rounded-xl shadow-sm transition-all cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5 text-[#a79078]" />
                        <span>Añadir a la Sesión</span>
                        <ChevronDown className="w-3.5 h-3.5 ml-1" />
                      </button>

                      {/* Dropdown Menu to choose destination block */}
                      {isDropdownOpen && (
                        <div className="absolute right-0 bottom-11 w-56 bg-slate-900 text-white rounded-2xl shadow-2xl border border-slate-700 p-2 z-30 space-y-1">
                          <p className="text-[9px] font-black uppercase text-sky-200/60 px-2 py-1 border-b border-slate-800">
                            Añadir a Bloque en {ex.sectionCategory?.toUpperCase() || 'FÚTBOL'}
                          </p>

                          <button
                            type="button"
                            onClick={() => handleInsert(ex, 'warmUp', ex.sectionCategory || 'football')}
                            className="w-full text-left text-xs font-bold p-2 hover:bg-[#0f5981] rounded-xl transition-colors flex items-center justify-between"
                          >
                            <span>1. Calentamiento (Warm Up)</span>
                            <Plus className="w-3.5 h-3.5 text-emerald-400" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleInsert(ex, 'mainPart', ex.sectionCategory || 'football')}
                            className="w-full text-left text-xs font-bold p-2 hover:bg-[#0f5981] rounded-xl transition-colors flex items-center justify-between"
                          >
                            <span>2. Parte Principal (Main Part)</span>
                            <Plus className="w-3.5 h-3.5 text-emerald-400" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleInsert(ex, 'coolDown', ex.sectionCategory || 'football')}
                            className="w-full text-left text-xs font-bold p-2 hover:bg-[#0f5981] rounded-xl transition-colors flex items-center justify-between"
                          >
                            <span>3. Vuelta a la Calma (Cool Down)</span>
                            <Plus className="w-3.5 h-3.5 text-emerald-400" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Modal for Creating New Exercise */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 md:p-8 shadow-2xl space-y-6 border border-slate-200">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-[#002142] text-[#a79078] rounded-xl">
                  <PlusCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-display font-black text-slate-900 uppercase">
                    Crear Nuevo Ejercicio para la Biblioteca
                  </h3>
                  <p className="text-xs text-slate-400 font-semibold">
                    Guarda tus tareas tácticas y físicas favoritas para utilizarlas en cualquier sesión.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomExercise} className="space-y-4">
              
              {/* Category Selector */}
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                  Categoría del Ejercicio
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewExSection('football')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      newExSection === 'football' 
                        ? 'bg-[#002142] text-white border-[#002142]' 
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    ⚽ Fútbol
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewExSection('fitness')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      newExSection === 'fitness' 
                        ? 'bg-[#002142] text-white border-[#002142]' 
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    🏃 Prep. Física
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewExSection('gk')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      newExSection === 'gk' 
                        ? 'bg-[#002142] text-white border-[#002142]' 
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    🧤 Porteros
                  </button>
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                  Nombre del Ejercicio *
                </label>
                <input
                  type="text"
                  required
                  value={newEx.name || ''}
                  onChange={(e) => setNewEx({ ...newEx, name: e.target.value })}
                  placeholder="e.g. Rondo 5v2 en Transición Rápida A-D"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-[#0f5981]"
                />
              </div>

              {/* Moment & Submoment */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                    Momento del Juego
                  </label>
                  <select
                    value={newEx.gameMoment || 'Attack'}
                    onChange={(e) => setNewEx({ ...newEx, gameMoment: e.target.value as GameMoment })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-[#0f5981]"
                  >
                    {gameMomentsList.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                    Sub-momento / Principio Táctico
                  </label>
                  <input
                    type="text"
                    value={newEx.subMoment || ''}
                    onChange={(e) => setNewEx({ ...newEx, subMoment: e.target.value })}
                    placeholder="e.g. Presión alta tras pérdida"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#0f5981]"
                  />
                </div>
              </div>

              {/* Duration & Dimensions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                    Duración
                  </label>
                  <input
                    type="text"
                    value={newEx.duration || ''}
                    onChange={(e) => setNewEx({ ...newEx, duration: e.target.value })}
                    placeholder="e.g. 15 min (3 x 4' + 1' desc)"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#0f5981]"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                    Espacio / Dimensiones
                  </label>
                  <input
                    type="text"
                    value={newEx.dimensions || ''}
                    onChange={(e) => setNewEx({ ...newEx, dimensions: e.target.value })}
                    placeholder="e.g. 40x30 meters"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#0f5981]"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                  Explicación & Reglas del Ejercicio
                </label>
                <textarea
                  rows={4}
                  value={newEx.description || ''}
                  onChange={(e) => setNewEx({ ...newEx, description: e.target.value })}
                  placeholder="Describe la dinámica, normas, comodines, rotaciones y consignas principales..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#0f5981] resize-y"
                />
              </div>

              {/* Coach Roles & Player Groups */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                    Roles del Cuerpo Técnico
                  </label>
                  <textarea
                    rows={2}
                    value={newEx.coachRoles || ''}
                    onChange={(e) => setNewEx({ ...newEx, coachRoles: e.target.value })}
                    placeholder="Coach A: Corrección técnica. Coach B: Ritmo de balón..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#0f5981]"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                    Asignación de Grupos / Jugadoras
                  </label>
                  <textarea
                    rows={2}
                    value={newEx.playerGroups || ''}
                    onChange={(e) => setNewEx({ ...newEx, playerGroups: e.target.value })}
                    placeholder="Grupo 1 (Azul), Grupo 2 (Amarillo)..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#0f5981]"
                  />
                </div>
              </div>

              {/* Image Upload */}
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                  Gráfico o Diagrama Táctico (Opcional)
                </label>
                <div className="flex items-center space-x-3">
                  <label className="flex items-center space-x-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2 px-3.5 rounded-xl border border-slate-300 cursor-pointer transition-colors">
                    {isUploadingImage ? (
                      <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                    ) : (
                      <Upload className="w-4 h-4 text-emerald-600" />
                    )}
                    <span>{isUploadingImage ? 'Subiendo...' : 'Subir Imagen / Diagrama'}</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleImageUpload} 
                      className="hidden" 
                    />
                  </label>

                  {newEx.image && (
                    <span className="text-xs text-emerald-600 font-bold flex items-center space-x-1">
                      <Check className="w-4 h-4" />
                      <span>Imagen Adjuntada</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-800 rounded-xl"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="px-6 py-2.5 bg-[#002142] hover:bg-[#003366] text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer"
                >
                  Guardar en Biblioteca
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
};
