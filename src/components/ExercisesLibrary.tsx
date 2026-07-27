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
  Sparkles,
  Copy,
  Edit3
} from 'lucide-react';
import { Exercise, GameMoment, TrainingSession, TrainingBlock } from '../types';
import { CloudTrainingSession, saveSessionToCloud } from '../firebase';
import { processUploadedImageFile } from '../utils/heic';
import { calculateExerciseTotalDuration } from './ExerciseBlock';

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

  // Track deleted exercise IDs across all library exercises (custom, sample, cloud, current)
  const [deletedExerciseIds, setDeletedExerciseIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('u17_deleted_exercise_ids');
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
  const [isDuplicatingModal, setIsDuplicatingModal] = useState(false);

  const handleNewExTimingChange = (field: 'series' | 'workTime' | 'restTime', val: string) => {
    const updatedSeries = field === 'series' ? val : (newEx.series ?? '');
    const updatedWorkTime = field === 'workTime' ? val : (newEx.workTime ?? '');
    const updatedRestTime = field === 'restTime' ? val : (newEx.restTime ?? '');

    const { durationStr } = calculateExerciseTotalDuration(updatedSeries, updatedWorkTime, updatedRestTime);

    setNewEx(prev => ({
      ...prev,
      series: updatedSeries,
      workTime: updatedWorkTime,
      restTime: updatedRestTime,
      ...(durationStr ? { duration: durationStr } : {})
    }));
  };

  // Target session and department selector state when adding to session
  const [targetSessionId, setTargetSessionId] = useState<string>('active');
  const [targetCategory, setTargetCategory] = useState<'football' | 'fitness' | 'gk'>('football');
  const [customSessionNum, setCustomSessionNum] = useState<string>('');
  const [isSubmittingCloudAdd, setIsSubmittingCloudAdd] = useState(false);

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

  // Save deleted exercise IDs to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('u17_deleted_exercise_ids', JSON.stringify(deletedExerciseIds));
    } catch (e) {
      console.error('Failed to save deleted exercise IDs:', e);
    }
  }, [deletedExerciseIds]);

  // Extract all exercises across current session, all cloud sessions, and custom library
  const allExercises = (() => {
    const list: (Exercise & { sourceSession?: string; sectionCategory?: 'football' | 'fitness' | 'gk'; isCustom?: boolean })[] = [];
    const seenIds = new Set<string>();

    const addEx = (ex: Exercise, source: string, sectionCat: 'football' | 'fitness' | 'gk', isCustom = false) => {
      if (!ex || !ex.name) return;
      const uniqueKey = ex.id || `${ex.name}-${(ex.description || '').substring(0, 30)}`;
      if (seenIds.has(uniqueKey)) return;
      if (ex.id && deletedExerciseIds.includes(ex.id)) return;
      if (deletedExerciseIds.includes(uniqueKey)) return;
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
      addEx(ex, 'Personal Library', cat, true);
    });

    // 2. Current Session Exercises
    (currentSession.warmUp?.exercises || []).forEach(e => addEx(e, 'Current Session (Football)', 'football'));
    (currentSession.mainPart?.exercises || []).forEach(e => addEx(e, 'Current Session (Football)', 'football'));
    (currentSession.coolDown?.exercises || []).forEach(e => addEx(e, 'Current Session (Football)', 'football'));

    (currentSession.fitnessWarmUp?.exercises || []).forEach(e => addEx(e, 'Current Session (Fitness)', 'fitness'));
    (currentSession.fitnessMainPart?.exercises || []).forEach(e => addEx(e, 'Current Session (Fitness)', 'fitness'));
    (currentSession.fitnessCoolDown?.exercises || []).forEach(e => addEx(e, 'Current Session (Fitness)', 'fitness'));

    (currentSession.gkWarmUp?.exercises || []).forEach(e => addEx(e, 'Current Session (Goalkeepers)', 'gk'));
    (currentSession.gkMainPart?.exercises || []).forEach(e => addEx(e, 'Current Session (Goalkeepers)', 'gk'));
    (currentSession.gkCoolDown?.exercises || []).forEach(e => addEx(e, 'Current Session (Goalkeepers)', 'gk'));

    // 3. Cloud Sessions Exercises
    cloudSessions.forEach(cSess => {
      const sessLabel = `Session #${cSess.sessionNumber || '1'}`;
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
      alert('Image too large. Please select an image under 8MB.');
      return;
    }
    setIsUploadingImage(true);
    try {
      const imgData = await processUploadedImageFile(file);
      setNewEx(prev => ({ ...prev, image: imgData }));
    } catch (err) {
      console.error('Failed uploading exercise image:', err);
      alert('Error processing exercise image.');
    } finally {
      setIsUploadingImage(false);
    }
  };

  // Open modal pre-filled to duplicate an exercise
  const handleDuplicateExercise = (ex: Exercise & { sectionCategory?: 'football' | 'fitness' | 'gk' }, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    
    // Append (Copy) if it doesn't already end with (Copy) or similar
    const copyName = ex.name.includes('(Copy)') || ex.name.includes('(Copia)')
      ? `${ex.name}`
      : `${ex.name} (Copy)`;

    setNewEx({
      name: copyName,
      gameMoment: ex.gameMoment || 'Attack',
      subMoment: ex.subMoment || '',
      description: ex.description || '',
      duration: ex.duration || '15 min',
      dimensions: ex.dimensions || '30x20m',
      coachRoles: ex.coachRoles || '',
      playerGroups: ex.playerGroups || '',
      isFitness: ex.isFitness || ex.sectionCategory === 'fitness',
      image: ex.image || ''
    });
    
    setNewExSection(ex.sectionCategory || (ex.isFitness ? 'fitness' : 'football'));
    setIsDuplicatingModal(true);
    setShowCreateModal(true);
  };

  // Quick 1-click duplicate directly to user's custom library
  const handleQuickDuplicate = (ex: Exercise & { sectionCategory?: 'football' | 'fitness' | 'gk' }, e: React.MouseEvent) => {
    e.stopPropagation();
    const copyName = ex.name.includes('(Copy)') || ex.name.includes('(Copia)')
      ? `${ex.name}`
      : `${ex.name} (Copy)`;

    const created: Exercise = {
      id: 'custom-ex-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      name: copyName,
      gameMoment: ex.gameMoment || 'Attack',
      subMoment: ex.subMoment || '',
      description: ex.description || '',
      duration: ex.duration || '15 min',
      dimensions: ex.dimensions || '30x20m',
      coachRoles: ex.coachRoles || '',
      playerGroups: ex.playerGroups || '',
      isFitness: ex.isFitness || ex.sectionCategory === 'fitness',
      image: ex.image || ''
    };

    setCustomExercises(prev => [created, ...prev]);
    setAddedToast(`Duplicated "${ex.name}" to your library!`);
    setTimeout(() => setAddedToast(null), 3000);
  };

  // Create & Save custom exercise to local library
  const handleSaveCustomExercise = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEx.name?.trim()) {
      alert('Please enter a name for the exercise.');
      return;
    }

    const created: Exercise = {
      id: 'custom-ex-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      name: newEx.name || 'Custom Exercise',
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
    setIsDuplicatingModal(false);
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

    setAddedToast('Exercise saved successfully to library!');
    setTimeout(() => setAddedToast(null), 3000);
  };

  // Delete exercise from library (custom or sample)
  const handleDeleteExercise = (ex: Exercise & { isCustom?: boolean }, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Do you want to delete "${ex.name}" from the library?`)) {
      if (ex.id) {
        setDeletedExerciseIds(prev => [...prev, ex.id]);
      }
      const uniqueKey = ex.id || `${ex.name}-${(ex.description || '').substring(0, 30)}`;
      setDeletedExerciseIds(prev => [...prev, uniqueKey]);
      setCustomExercises(prev => prev.filter(item => item.id !== ex.id));
      setAddedToast(`Deleted "${ex.name}" from library.`);
      setTimeout(() => setAddedToast(null), 3000);
    }
  };

  // Insert selected exercise into target session & block
  const handleInsertToTargetSession = async (
    ex: Exercise, 
    blockKey: 'warmUp' | 'mainPart' | 'coolDown'
  ) => {
    setIsSubmittingCloudAdd(true);
    try {
      // Clone exercise with fresh unique ID
      const clonedEx: Exercise = {
        ...ex,
        id: 'ex-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6)
      };

      const sectionCat = targetCategory;

      // 1. Target is Active Session
      if (targetSessionId === 'active' || targetSessionId === currentSession.id) {
        onAddExerciseToSession(blockKey, clonedEx, sectionCat);
        setOpenAddDropdownId(null);
        const blockName = blockKey === 'warmUp' ? 'Warm Up' : blockKey === 'mainPart' ? 'Main Part' : 'Cool Down';
        const sessNum = currentSession.sessionNumber || '1';
        setAddedToast(`Added "${ex.name}" to ${blockName} (${sectionCat.toUpperCase()}) in Active Session #${sessNum}`);
        setTimeout(() => setAddedToast(null), 3500);
        return;
      }

      // 2. Target is an existing Cloud Session
      const targetCloudSess = cloudSessions.find(s => s.id === targetSessionId || s.sessionNumber === targetSessionId);
      if (targetCloudSess) {
        let blockPropName: keyof TrainingSession;
        if (sectionCat === 'football') {
          blockPropName = blockKey;
        } else if (sectionCat === 'fitness') {
          blockPropName = blockKey === 'warmUp' ? 'fitnessWarmUp' : blockKey === 'mainPart' ? 'fitnessMainPart' : 'fitnessCoolDown';
        } else {
          blockPropName = blockKey === 'warmUp' ? 'gkWarmUp' : blockKey === 'mainPart' ? 'gkMainPart' : 'gkCoolDown';
        }

        const existingBlock = (targetCloudSess[blockPropName] as TrainingBlock) || {
          id: `${blockKey}-block-${sectionCat}`,
          title: blockKey === 'warmUp' ? 'Warm Up' : blockKey === 'mainPart' ? 'Main Part' : 'Cool Down',
          exercises: []
        };

        const updatedCloudSess: CloudTrainingSession = {
          ...targetCloudSess,
          [blockPropName]: {
            ...existingBlock,
            exercises: [...(existingBlock.exercises || []), clonedEx]
          },
          updatedAt: Date.now()
        };

        await saveSessionToCloud(updatedCloudSess);
        setOpenAddDropdownId(null);
        const blockName = blockKey === 'warmUp' ? 'Warm Up' : blockKey === 'mainPart' ? 'Main Part' : 'Cool Down';
        const sessNum = targetCloudSess.sessionNumber || '?';
        setAddedToast(`Added "${ex.name}" to ${blockName} (${sectionCat.toUpperCase()}) in Session #${sessNum}`);
        setTimeout(() => setAddedToast(null), 3500);
        return;
      }

      // 3. Target is a New Custom Session Number
      if (targetSessionId === 'new') {
        const newSessNum = customSessionNum.trim() || '2';
        const newSessionId = 'sess-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);

        let blockPropName: keyof TrainingSession;
        if (sectionCat === 'football') {
          blockPropName = blockKey;
        } else if (sectionCat === 'fitness') {
          blockPropName = blockKey === 'warmUp' ? 'fitnessWarmUp' : blockKey === 'mainPart' ? 'fitnessMainPart' : 'fitnessCoolDown';
        } else {
          blockPropName = blockKey === 'warmUp' ? 'gkWarmUp' : blockKey === 'mainPart' ? 'gkMainPart' : 'gkCoolDown';
        }

        const defaultBlock = (title: string, id: string): TrainingBlock => ({ id, title, exercises: [] });

        const newSessionData: TrainingSession = {
          id: newSessionId,
          teamName: currentSession.teamName || 'U17 Women Al Ula',
          date: new Date().toISOString().split('T')[0],
          time: '18:30 - 20:00',
          sessionNumber: newSessNum,
          microcycleDay: 'MD-3',
          mainObjective: `Session #${newSessNum} Training Plan`,
          materialsNeeded: currentSession.materialsNeeded || 'Cones, Balls, Bibs',
          warmUp: defaultBlock('Warm Up', 'warmup-block'),
          mainPart: defaultBlock('Main Part', 'main-block'),
          coolDown: defaultBlock('Cool Down', 'cooldown-block'),
          playerGroups: [],
          fitnessWarmUp: defaultBlock('Warm Up', 'warmup-block-fitness'),
          fitnessMainPart: defaultBlock('Main Part', 'main-block-fitness'),
          fitnessCoolDown: defaultBlock('Cool Down', 'cooldown-block-fitness'),
          fitnessPlayerGroups: [],
          gkWarmUp: defaultBlock('Warm Up', 'warmup-block-gk'),
          gkMainPart: defaultBlock('Main Part', 'main-block-gk'),
          gkCoolDown: defaultBlock('Cool Down', 'cooldown-block-gk'),
          gkPlayerGroups: []
        };

        const targetBlock = newSessionData[blockPropName] as TrainingBlock;
        (newSessionData as any)[blockPropName] = {
          ...targetBlock,
          exercises: [clonedEx]
        };

        await saveSessionToCloud(newSessionData);
        setOpenAddDropdownId(null);
        const blockName = blockKey === 'warmUp' ? 'Warm Up' : blockKey === 'mainPart' ? 'Main Part' : 'Cool Down';
        setAddedToast(`Created Session #${newSessNum} and added "${ex.name}" to ${blockName}!`);
        setTimeout(() => setAddedToast(null), 3500);
      }
    } catch (err) {
      console.error('Error adding exercise to target session:', err);
      alert('An error occurred while adding exercise to session.');
    } finally {
      setIsSubmittingCloudAdd(false);
    }
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
                Exercises Database
              </h2>
            </div>
            <p className="text-xs text-sky-200/80 max-w-2xl font-medium pt-1">
              Explore and reuse all exercises created across training sessions. Filter by category or tactical moment and add them to your active session with one click.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="flex items-center justify-center space-x-2 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-extrabold text-xs uppercase tracking-wider py-3 px-5 rounded-xl transition-all shadow-lg shadow-emerald-500/20 cursor-pointer shrink-0"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Create New Exercise</span>
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
              placeholder="Search exercise by name, description or pitch size..."
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
              <option value="all">All Categories</option>
              <option value="football">⚽ Football</option>
              <option value="fitness">🏃 Fitness & Conditioning</option>
              <option value="gk">🧤 Goalkeepers</option>
            </select>
          </div>

          {/* Game Moment Filter */}
          <div className="sm:col-span-3">
            <select
              value={momentFilter}
              onChange={(e) => setMomentFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:border-[#0f5981] cursor-pointer"
            >
              <option value="all">All Tactical Moments</option>
              {gameMomentsList.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

        </div>

        {/* Counter Badge */}
        <div className="flex items-center justify-between text-xs text-slate-500 font-semibold pt-1 border-t border-slate-100">
          <span>
            Showing <strong className="text-slate-900 font-extrabold">{filteredExercises.length}</strong> of <strong className="text-slate-900 font-extrabold">{allExercises.length}</strong> available exercises
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
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Exercises Grid */}
      {filteredExercises.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3">
          <BookOpen className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-sm font-bold text-slate-800">No exercises found</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Try modifying your search terms or filters, or create a new exercise to save it to your library.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredExercises.map((ex) => {
            const isDropdownOpen = openAddDropdownId === ex.id;
            
            const categoryBadge = ex.sectionCategory === 'fitness' 
              ? { label: 'Fitness', color: 'bg-amber-100 text-amber-800 border-amber-300' }
              : ex.sectionCategory === 'gk'
              ? { label: 'Goalkeeper', color: 'bg-sky-100 text-sky-800 border-sky-300' }
              : { label: 'Football', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' };

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

                    {/* Delete button for all items */}
                    <button
                      type="button"
                      onClick={(e) => handleDeleteExercise(ex, e)}
                      className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="Delete from library"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
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
                      <span>{ex.dimensions || 'Full pitch'}</span>
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
                  <div className="flex items-center justify-between gap-2">
                    {/* Duplicate Buttons Group */}
                    <div className="flex items-center space-x-1">
                      <button
                        type="button"
                        onClick={(e) => handleDuplicateExercise(ex, e)}
                        className="flex items-center space-x-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold py-2 px-3 rounded-xl border border-slate-200 hover:border-slate-300 transition-all cursor-pointer"
                        title="Duplicate exercise to customize and save as new"
                      >
                        <Copy className="w-3.5 h-3.5 text-[#0f5981]" />
                        <span>Duplicate</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleQuickDuplicate(ex, e)}
                        className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors border border-transparent hover:border-emerald-200 cursor-pointer"
                        title="Quick 1-click clone into library"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Add to Session Dropdown Button */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => {
                          if (isDropdownOpen) {
                            setOpenAddDropdownId(null);
                          } else {
                            setOpenAddDropdownId(ex.id);
                            setTargetCategory(ex.sectionCategory || 'football');
                            setTargetSessionId('active');
                            setCustomSessionNum('');
                          }
                        }}
                        className="flex items-center space-x-1.5 bg-[#002142] hover:bg-[#003366] text-white text-xs font-bold py-2 px-3.5 rounded-xl shadow-sm transition-all cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5 text-[#a79078]" />
                        <span>Add to Session</span>
                        <ChevronDown className="w-3.5 h-3.5 ml-0.5" />
                      </button>

                      {/* Dropdown Menu to Choose Session Number, Category, and Block */}
                      {isDropdownOpen && (
                        <div className="absolute right-0 bottom-11 w-72 bg-slate-900 text-white rounded-2xl shadow-2xl border border-slate-700 p-3 z-30 space-y-3">
                          
                          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                            <div className="flex items-center space-x-1.5">
                              <Plus className="w-4 h-4 text-[#a79078]" />
                              <span className="text-xs font-black uppercase tracking-wider text-sky-200">
                                Add to Training Session
                              </span>
                            </div>
                            <button 
                              type="button" 
                              onClick={() => setOpenAddDropdownId(null)}
                              className="text-slate-400 hover:text-white p-0.5 rounded-lg cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* 1. Target Session Number Selector */}
                          <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase text-slate-400 block tracking-wider">
                              Target Session Number
                            </label>
                            <select
                              value={targetSessionId}
                              onChange={(e) => setTargetSessionId(e.target.value)}
                              className="w-full bg-slate-800 border border-slate-700 text-xs font-bold text-white rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-sky-400 cursor-pointer"
                            >
                              <option value="active">
                                Active Session (#{currentSession.sessionNumber || '1'})
                              </option>
                              {cloudSessions
                                .filter(s => s.id !== currentSession.id)
                                .map(s => (
                                  <option key={s.id} value={s.id}>
                                    Session #{s.sessionNumber || '1'} ({s.date || 'Saved'})
                                  </option>
                                ))}
                              <option value="new">+ Create New Session Number...</option>
                            </select>

                            {targetSessionId === 'new' && (
                              <div className="pt-1">
                                <input
                                  type="text"
                                  value={customSessionNum}
                                  onChange={(e) => setCustomSessionNum(e.target.value)}
                                  placeholder="Enter Session # (e.g., 4)"
                                  className="w-full bg-slate-800 border border-emerald-500 text-xs font-bold text-emerald-300 rounded-xl px-2.5 py-1.5 focus:outline-none placeholder:text-slate-500"
                                />
                              </div>
                            )}
                          </div>

                          {/* 2. Target Category/Department */}
                          <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase text-slate-400 block tracking-wider">
                              Department / Section
                            </label>
                            <div className="grid grid-cols-3 gap-1">
                              <button
                                type="button"
                                onClick={() => setTargetCategory('football')}
                                className={`py-1 px-1.5 text-[10px] font-black rounded-lg border transition-all cursor-pointer ${
                                  targetCategory === 'football' 
                                    ? 'bg-emerald-600 text-white border-emerald-500' 
                                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                                }`}
                              >
                                ⚽ Football
                              </button>
                              <button
                                type="button"
                                onClick={() => setTargetCategory('fitness')}
                                className={`py-1 px-1.5 text-[10px] font-black rounded-lg border transition-all cursor-pointer ${
                                  targetCategory === 'fitness' 
                                    ? 'bg-amber-600 text-white border-amber-500' 
                                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                                }`}
                              >
                                🏃 Fitness
                              </button>
                              <button
                                type="button"
                                onClick={() => setTargetCategory('gk')}
                                className={`py-1 px-1.5 text-[10px] font-black rounded-lg border transition-all cursor-pointer ${
                                  targetCategory === 'gk' 
                                    ? 'bg-sky-600 text-white border-sky-500' 
                                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                                }`}
                              >
                                🧤 GK
                              </button>
                            </div>
                          </div>

                          {/* 3. Target Block Selector Buttons */}
                          <div className="space-y-1 pt-1 border-t border-slate-800">
                            <label className="text-[9px] font-black uppercase text-slate-400 block tracking-wider mb-1">
                              Insert into Block
                            </label>
                            <div className="space-y-1">
                              <button
                                type="button"
                                disabled={isSubmittingCloudAdd}
                                onClick={() => handleInsertToTargetSession(ex, 'warmUp')}
                                className="w-full text-left text-xs font-bold p-2 bg-slate-800 hover:bg-[#0f5981] rounded-xl transition-colors flex items-center justify-between group cursor-pointer disabled:opacity-50"
                              >
                                <span>1. Warm Up</span>
                                {isSubmittingCloudAdd ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                                ) : (
                                  <Plus className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110" />
                                )}
                              </button>

                              <button
                                type="button"
                                disabled={isSubmittingCloudAdd}
                                onClick={() => handleInsertToTargetSession(ex, 'mainPart')}
                                className="w-full text-left text-xs font-bold p-2 bg-slate-800 hover:bg-[#0f5981] rounded-xl transition-colors flex items-center justify-between group cursor-pointer disabled:opacity-50"
                              >
                                <span>2. Main Part</span>
                                {isSubmittingCloudAdd ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                                ) : (
                                  <Plus className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110" />
                                )}
                              </button>

                              <button
                                type="button"
                                disabled={isSubmittingCloudAdd}
                                onClick={() => handleInsertToTargetSession(ex, 'coolDown')}
                                className="w-full text-left text-xs font-bold p-2 bg-slate-800 hover:bg-[#0f5981] rounded-xl transition-colors flex items-center justify-between group cursor-pointer disabled:opacity-50"
                              >
                                <span>3. Cool Down</span>
                                {isSubmittingCloudAdd ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                                ) : (
                                  <Plus className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110" />
                                )}
                              </button>
                            </div>
                          </div>

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
                  {isDuplicatingModal ? <Copy className="w-5 h-5" /> : <PlusCircle className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-base font-display font-black text-slate-900 uppercase">
                    {isDuplicatingModal ? 'Duplicate Exercise for Library' : 'Create New Exercise for Library'}
                  </h3>
                  <p className="text-xs text-slate-400 font-semibold">
                    {isDuplicatingModal 
                      ? 'Customize fields and save as a new exercise in your personal library.' 
                      : 'Save your favorite tactical and physical tasks to reuse them across sessions.'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(false);
                  setIsDuplicatingModal(false);
                }}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomExercise} className="space-y-4">
              
              {/* Category Selector */}
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                  Exercise Category
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
                    ⚽ Football
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
                    🏃 Fitness
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
                    🧤 Goalkeepers
                  </button>
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                  Exercise Name *
                </label>
                <input
                  type="text"
                  required
                  value={newEx.name || ''}
                  onChange={(e) => setNewEx({ ...newEx, name: e.target.value })}
                  placeholder="e.g. 5v2 Rondo with Fast A-D Transition"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-[#0f5981]"
                />
              </div>

              {/* Moment & Submoment */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                    Game Moment
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
                    Sub-moment / Tactical Principle
                  </label>
                  <input
                    type="text"
                    value={newEx.subMoment || ''}
                    onChange={(e) => setNewEx({ ...newEx, subMoment: e.target.value })}
                    placeholder="e.g. High press after possession loss"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#0f5981]"
                  />
                </div>
              </div>

              {/* Series, Tiempo y Descanso (Timing Structure) */}
              <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-2xl space-y-2">
                <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                  <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                    Series, Tiempo y Descanso
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">
                      Series
                    </label>
                    <input
                      type="text"
                      value={newEx.series ?? ''}
                      onChange={(e) => handleNewExTimingChange('series', e.target.value)}
                      placeholder="ej: 3"
                      className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-[#0f5981]"
                    />
                  </div>

                  <div>
                    <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">
                      Tiempo / Serie (min)
                    </label>
                    <input
                      type="text"
                      value={newEx.workTime ?? ''}
                      onChange={(e) => handleNewExTimingChange('workTime', e.target.value)}
                      placeholder="ej: 4"
                      className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-[#0f5981]"
                    />
                  </div>

                  <div>
                    <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">
                      Descanso (min)
                    </label>
                    <input
                      type="text"
                      value={newEx.restTime ?? ''}
                      onChange={(e) => handleNewExTimingChange('restTime', e.target.value)}
                      placeholder="ej: 1"
                      className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-[#0f5981]"
                    />
                  </div>
                </div>
              </div>

              {/* Dimensions */}
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                  Space / Pitch Dimensions
                </label>
                <input
                  type="text"
                  value={newEx.dimensions || ''}
                  onChange={(e) => setNewEx({ ...newEx, dimensions: e.target.value })}
                  placeholder="e.g. 40x30 meters"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#0f5981]"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                  Explanation & Rules
                </label>
                <textarea
                  rows={4}
                  value={newEx.description || ''}
                  onChange={(e) => setNewEx({ ...newEx, description: e.target.value })}
                  placeholder="Describe dynamics, rules, jokers, rotations and key coaching points..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#0f5981] resize-y"
                />
              </div>

              {/* Coach Roles & Player Groups */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                    Coaching Staff Roles
                  </label>
                  <textarea
                    rows={2}
                    value={newEx.coachRoles || ''}
                    onChange={(e) => setNewEx({ ...newEx, coachRoles: e.target.value })}
                    placeholder="Coach A: Technical corrections. Coach B: Ball tempo..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#0f5981]"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                    Player Groups Assignment
                  </label>
                  <textarea
                    rows={2}
                    value={newEx.playerGroups || ''}
                    onChange={(e) => setNewEx({ ...newEx, playerGroups: e.target.value })}
                    placeholder="Group 1 (Blue), Group 2 (Yellow)..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#0f5981]"
                  />
                </div>
              </div>

              {/* Image Upload */}
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                  Tactical Diagram / Graphic (Optional)
                </label>
                <div className="flex items-center space-x-3">
                  <label className="flex items-center space-x-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2 px-3.5 rounded-xl border border-slate-300 cursor-pointer transition-colors">
                    {isUploadingImage ? (
                      <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                    ) : (
                      <Upload className="w-4 h-4 text-emerald-600" />
                    )}
                    <span>{isUploadingImage ? 'Uploading...' : 'Upload Image / Diagram'}</span>
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
                      <span>Image Attached</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setIsDuplicatingModal(false);
                  }}
                  className="px-4 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-800 rounded-xl"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="px-6 py-2.5 bg-[#002142] hover:bg-[#003366] text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer"
                >
                  {isDuplicatingModal ? 'Save Duplicate to Library' : 'Save to Library'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
};
