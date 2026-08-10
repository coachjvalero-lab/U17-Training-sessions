import React, { useEffect, useState } from 'react';
import { 
  ChevronDown, ChevronUp, Plus, Trash2, ArrowUp, ArrowDown, 
  Clock, Maximize2, ShieldAlert, Image as ImageIcon, AlertCircle, Loader2, Users, BookmarkPlus, Check, Trophy, X
} from 'lucide-react';
import { Exercise, GameMoment, TrainingBlock, PlayerGroup, SquadPlayer } from '../types';
import { processUploadedImageFile } from '../utils/heic';
import { saveExerciseToLibrary } from '../services/exercises/exerciseLibraryService';
import { SmartImage } from './SmartImage';
import { parseDurationValue, formatDurationLabel } from '../utils/duration';

interface ExerciseBlockProps {
  block: TrainingBlock;
  onChange: (updatedExercises: Exercise[]) => void;
  expandedExercises: Record<string, boolean>;
  toggleExpand: (id: string) => void;
  sessionGroups?: PlayerGroup[];
  gameMoments?: GameMoment[];
  sessionId?: string;
  squadPlayers?: SquadPlayer[];
  onApplyMalikaPoints?: (payload: {
    sessionId: string;
    exerciseId: string;
    challenge: string;
    awards: Array<{ playerId: string; points: number }>;
  }) => void;
}

export const GAME_MOMENTS: GameMoment[] = ['-', 'Attack', 'Defense', 'Transition A-D', 'Transition D-A', 'Set Pieces', 'Match', 'Other'];

export const GK_GAME_MOMENTS: GameMoment[] = ['-', 'Shot stop', 'Depth control', '1 vs 1', 'Feet distribution', 'Cross defending'];

const TACTICAL_SUB_MOMENTS = [
  '-',
  'construction',
  'creation',
  'finishing',
  'loss',
  'defensive recovery',
  'counterattack defense',
  'defending construction',
  'defending creation',
  'defending finishing',
  'regain',
  'counterattack',
  'ball possession valuation'
];

const COACH_NAMES = ['Wilian', 'Marta', 'Joao', 'Javi', 'Shouq', 'Mariana'];

const getPrintFontSizeClass = (text: string = '') => {
  const len = text.trim().length;
  if (len > 450) {
    return 'print:text-[7px] print:leading-tight print:p-0.5';
  } else if (len > 250) {
    return 'print:text-[7.5px] print:leading-tight print:p-1';
  } else if (len > 120) {
    return 'print:text-[8px] print:leading-snug print:p-1';
  }
  return 'print:text-[8.5px] print:leading-snug print:p-1';
};

interface CoachRoleEntry {
  name: string;
  role: string;
}

const parseCoachRolesList = (coachRolesStr: string): CoachRoleEntry[] => {
  if (!coachRolesStr || coachRolesStr.trim() === '') {
    return [];
  }
  
  // Try splitting by semicolon first, fallback to newlines
  let items: string[] = [];
  if (coachRolesStr.includes(';')) {
    items = coachRolesStr.split(';');
  } else if (coachRolesStr.includes('\n')) {
    items = coachRolesStr.split('\n');
  } else {
    items = [coachRolesStr];
  }
  
  return items.map(item => {
    const colonIndex = item.indexOf(':');
    if (colonIndex === -1) {
      let role = item;
      if (role.startsWith(' ')) role = role.substring(1);
      return { name: COACH_NAMES[0], role };
    }
    const name = item.substring(0, colonIndex).trim();
    let role = item.substring(colonIndex + 1);
    if (role.startsWith(' ')) role = role.substring(1);
    return { name, role };
  }).filter(entry => entry.name !== '');
};

const serializeCoachRolesList = (entries: CoachRoleEntry[]): string => {
  return entries
    .filter(entry => entry.name.trim() !== '')
    .map(entry => `${entry.name.trim()}: ${entry.role}`)
    .join('; ');
};

export function calculateExerciseTotalDuration(
  seriesInput?: number | string,
  workTimeInput?: number | string,
  restTimeInput?: number | string
): { totalMinutes: number; durationStr: string } {
  const seriesStr = String(seriesInput ?? '').trim();
  const workStr = String(workTimeInput ?? '').trim();
  const restStr = String(restTimeInput ?? '').trim();

  const series = parseFloat(seriesStr) || 0;
  const workTime = parseDurationValue(workStr);
  const restTime = parseDurationValue(restStr);

  if (series <= 0 || workTime <= 0) {
    return { totalMinutes: 0, durationStr: '' };
  }

  const totalWork = series * workTime;
  const totalRest = series > 1 ? (series - 1) * restTime : 0;
  const totalMinutes = Math.round((totalWork + totalRest) * 10) / 10;

  return {
    totalMinutes,
    durationStr: formatDurationLabel(totalMinutes)
  };
}

export const ExerciseBlock: React.FC<ExerciseBlockProps> = ({ 
  block, 
  onChange, 
  expandedExercises, 
  toggleExpand,
  sessionGroups,
  gameMoments,
  sessionId,
  squadPlayers = [],
  onApplyMalikaPoints
}) => {
  const [dragOverExId, setDragOverExId] = useState<string | null>(null);
  const [uploadingExId, setUploadingExId] = useState<string | null>(null);
  const [addedToLibId, setAddedToLibId] = useState<string | null>(null);
  const [activeMalikaExerciseId, setActiveMalikaExerciseId] = useState<string | null>(null);
  const [malikaSearchTerm, setMalikaSearchTerm] = useState('');
  const [malikaSelections, setMalikaSelections] = useState<Record<string, { selected: boolean; points: string }>>({});
  const availableGameMoments = (gameMoments && gameMoments.length > 0) ? gameMoments : GAME_MOMENTS;
  const canPersistMalikaAwards = Boolean(sessionId && onApplyMalikaPoints);

  useEffect(() => {
    const snapshot = (block.exercises || []).map((exercise) => ({
      id: exercise.id,
      name: exercise.name,
      hasMalikaChallenge: Boolean(exercise.malikaChallenge),
      malikaEnabled: Boolean(exercise.malikaChallenge?.enabled),
      renderMalikaButton: Boolean(exercise.malikaChallenge?.enabled)
    }));

    console.log('[ExerciseBlock] render diagnostics', {
      blockId: block.id,
      blockTitle: block.title,
      sessionId: sessionId || null,
      canPersistMalikaAwards,
      squadPlayersCount: squadPlayers.length,
      exercises: snapshot
    });
  }, [block.exercises, block.id, block.title, canPersistMalikaAwards, sessionId, squadPlayers.length]);

  const handleAddToLibrary = (ex: Exercise, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const saved = localStorage.getItem('u17_custom_exercise_library');
      const existingLib: Exercise[] = saved ? JSON.parse(saved) : [];

      const newLibEx: Exercise = {
        ...ex,
        id: 'custom-ex-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6)
      };

      const updatedLib = [newLibEx, ...existingLib];
      localStorage.setItem('u17_custom_exercise_library', JSON.stringify(updatedLib));

      saveExerciseToLibrary(newLibEx).catch(err => console.warn('Cloud save failed for library exercise:', err));

      setAddedToLibId(ex.id);
      setTimeout(() => {
        setAddedToLibId(null);
      }, 2500);
    } catch (err) {
      console.error('Failed to save exercise to library:', err);
    }
  };

  const getPlayerLabel = (player: SquadPlayer) => `${player.firstName} ${player.lastName}`.trim();

  const openMalikaPanel = (ex: Exercise) => {
    if (!ex.malikaChallenge?.enabled) return;

    const defaultPoints = String(ex.malikaChallenge.defaultPoints ?? 0);
    const initialSelections = squadPlayers.reduce<Record<string, { selected: boolean; points: string }>>((acc, player) => {
      acc[player.id] = { selected: false, points: defaultPoints };
      return acc;
    }, {});

    setActiveMalikaExerciseId(ex.id);
    setMalikaSelections(initialSelections);
    setMalikaSearchTerm('');
  };

  const closeMalikaPanel = () => {
    setActiveMalikaExerciseId(null);
    setMalikaSearchTerm('');
  };

  const updateMalikaPlayerSelection = (playerId: string, defaultPoints: number) => {
    setMalikaSelections((prev) => {
      const current = prev[playerId] || { selected: false, points: String(defaultPoints) };
      return {
        ...prev,
        [playerId]: {
          selected: !current.selected,
          points: current.points || String(defaultPoints)
        }
      };
    });
  };

  const updateMalikaPlayerPoints = (playerId: string, points: string, defaultPoints: number) => {
    setMalikaSelections((prev) => ({
      ...prev,
      [playerId]: {
        selected: prev[playerId]?.selected || false,
        points: points === '' ? String(defaultPoints) : points
      }
    }));
  };

  const saveMalikaChallenge = (ex: Exercise) => {
    if (!sessionId || !onApplyMalikaPoints || !ex.malikaChallenge?.enabled) return;

    const awards = squadPlayers
      .filter((player) => malikaSelections[player.id]?.selected)
      .map((player) => ({
        playerId: player.id,
        points: Number(malikaSelections[player.id]?.points ?? ex.malikaChallenge?.defaultPoints ?? 0) || 0
      }))
      .filter((award) => award.points !== 0 || malikaSelections[award.playerId]?.selected);

    if (awards.length === 0) {
      alert('Select at least one player for the Malika challenge.');
      return;
    }

    onApplyMalikaPoints({
      sessionId,
      exerciseId: ex.id,
      challenge: ex.malikaChallenge.title || ex.name,
      awards
    });
    closeMalikaPanel();
  };

  const handleTimingChange = (
    exId: string, 
    currentEx: Exercise, 
    field: 'series' | 'workTime' | 'restTime', 
    val: string
  ) => {
    const updatedSeries = field === 'series' ? val : (currentEx.series ?? '');
    const updatedWorkTime = field === 'workTime' ? val : (currentEx.workTime ?? '');
    const updatedRestTime = field === 'restTime' ? val : (currentEx.restTime ?? '');

    const { durationStr } = calculateExerciseTotalDuration(updatedSeries, updatedWorkTime, updatedRestTime);

    updateExercise(exId, {
      series: updatedSeries,
      workTime: updatedWorkTime,
      restTime: updatedRestTime,
      ...(durationStr ? { duration: durationStr } : {})
    });
  };

  const handleCopySessionGroups = (exId: string) => {
    if (!sessionGroups || sessionGroups.length === 0) return;
    const formatted = sessionGroups
      .map(g => {
        const pList = g.players ? g.players.split(',').map(p => p.trim()).filter(Boolean).join(', ') : 'No players assigned';
        return `${g.name || `Group ${g.groupNumber}`}: ${pList}`;
      })
      .join('\n');
    updateExercise(exId, { playerGroups: formatted });
  };

  const handleCoachRoleChange = (exId: string, index: number, field: 'name' | 'role', val: string, currentCoachRolesStr: string) => {
    const roles = parseCoachRolesList(currentCoachRolesStr);
    if (roles[index]) {
      roles[index] = { ...roles[index], [field]: val };
      const serialized = serializeCoachRolesList(roles);
      updateExercise(exId, { coachRoles: serialized });
    }
  };

  const handleAddCoachRole = (exId: string, currentCoachRolesStr: string) => {
    const roles = parseCoachRolesList(currentCoachRolesStr);
    const assignedNames = roles.map(r => r.name);
    const availableName = COACH_NAMES.find(name => !assignedNames.includes(name)) || COACH_NAMES[0];
    roles.push({ name: availableName, role: '' });
    const serialized = serializeCoachRolesList(roles);
    updateExercise(exId, { coachRoles: serialized });
  };

  const handleRemoveCoachRole = (exId: string, index: number, currentCoachRolesStr: string) => {
    const roles = parseCoachRolesList(currentCoachRolesStr);
    roles.splice(index, 1);
    const serialized = serializeCoachRolesList(roles);
    updateExercise(exId, { coachRoles: serialized });
  };

  const addExercise = () => {
    const newEx: Exercise = {
      id: 'ex-' + Date.now(),
      name: 'New Exercise',
      gameMoment: 'Other',
      subMoment: 'construction',
      description: '',
      duration: '15 min',
      dimensions: '30x20m',
      coachRoles: '',
      image: '',
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

  const toggleMalikaChallenge = (exercise: Exercise) => {
    if (exercise.malikaChallenge?.enabled) {
      updateExercise(exercise.id, { malikaChallenge: undefined });
      if (activeMalikaExerciseId === exercise.id) {
        closeMalikaPanel();
      }
      return;
    }

    updateExercise(exercise.id, {
      malikaChallenge: {
        enabled: true,
        title: exercise.name || 'Malika Challenge',
        defaultPoints: 5
      }
    });
  };

  const updateMalikaConfig = (exercise: Exercise, fields: { title?: string; defaultPoints?: number }) => {
    const current = exercise.malikaChallenge;
    if (!current?.enabled) return;

    updateExercise(exercise.id, {
      malikaChallenge: {
        enabled: true,
        title: fields.title !== undefined ? fields.title : current.title,
        defaultPoints: fields.defaultPoints !== undefined ? fields.defaultPoints : current.defaultPoints
      }
    });
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
  const processFile = async (file: File, exId: string) => {
    if (file.size > 10 * 1024 * 1024) {
      alert('The exercise image is too large. Please select an image smaller than 10MB.');
      return;
    }
    setUploadingExId(exId);
    try {
      const dataUrl = await processUploadedImageFile(file);
      updateExercise(exId, { image: dataUrl });
    } catch (err) {
      console.error('Failed to process image file:', err);
      alert('Error processing image file. If this is a HEIC file, please try again or select a JPG/PNG.');
    } finally {
      setUploadingExId(null);
    }
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
      case 'Match': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Shot stop': return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'Depth control': return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case '1 vs 1': return 'bg-rose-100 text-rose-800 border-rose-300';
      case 'Feet distribution': return 'bg-teal-50 text-teal-700 border-teal-200';
      case 'Cross defending': return 'bg-violet-50 text-violet-700 border-violet-200';
      case '-': return 'bg-slate-50 text-slate-500 border-slate-200';
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const renderCoachRoles = (ex: Exercise) => (
    <div className="bg-slate-50 border border-slate-200/60 p-3.5 rounded-2xl space-y-2.5 print:bg-transparent print:border-none print:p-0">
      <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5 mb-1 print:border-none print:pb-0.5 print:mb-0.5">
        <div className="flex items-center space-x-1.5">
          <ShieldAlert className="w-3.5 h-3.5 text-slate-500 print:text-black print:w-3 print:h-3 shrink-0" />
          <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest print:text-black print:text-[8px]">
            Coaches' Roles
          </span>
        </div>
      </div>
      
      {/* Columns Headers */}
      {parseCoachRolesList(ex.coachRoles || '').length > 0 && (
        <div className="grid grid-cols-12 gap-2 px-2 text-[9px] font-extrabold text-slate-400 uppercase tracking-wider print:px-0 print:gap-1 print:text-[7px]">
          <div className="col-span-4">Coach</div>
          <div className="col-span-8">Role</div>
        </div>
      )}

      {/* Interactive list for editing on screen */}
      <div className="space-y-2 print:hidden">
        {parseCoachRolesList(ex.coachRoles || '').map((roleEntry, index) => (
          <div key={index} className="grid grid-cols-12 gap-2 items-center bg-white/60 border border-slate-100 p-2 rounded-xl shadow-sm transition-all hover:bg-white hover:border-slate-200">
            <div className="col-span-4 min-w-0">
              <select
                value={roleEntry.name}
                onChange={(e) => handleCoachRoleChange(ex.id, index, 'name', e.target.value, ex.coachRoles || '')}
                className="w-full text-xs font-bold bg-slate-50 border border-slate-200/80 px-1.5 py-1 rounded-lg focus:outline-none focus:border-emerald-500 cursor-pointer overflow-hidden text-ellipsis"
              >
                {!COACH_NAMES.includes(roleEntry.name) && (
                  <option value={roleEntry.name}>{roleEntry.name}</option>
                )}
                {COACH_NAMES.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
            <div className="col-span-8 flex items-center space-x-1.5 min-w-0">
              <input
                type="text"
                value={roleEntry.role}
                onChange={(e) => handleCoachRoleChange(ex.id, index, 'role', e.target.value, ex.coachRoles || '')}
                placeholder="Role / responsibilities..."
                className="w-full text-xs font-semibold bg-transparent border-b border-slate-200/60 focus:border-emerald-500 focus:outline-none px-1 py-1 min-w-0"
              />
              <button
                type="button"
                onClick={() => handleRemoveCoachRole(ex.id, index, ex.coachRoles || '')}
                className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition-colors shrink-0"
                title="Delete coach role"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}

        {parseCoachRolesList(ex.coachRoles || '').length === 0 && (
          <div className="text-center py-4 bg-white/40 border border-dashed border-slate-200 rounded-xl">
            <p className="text-[10px] font-bold text-slate-400">No coaches' roles assigned yet</p>
          </div>
        )}

        <button
          type="button"
          onClick={() => handleAddCoachRole(ex.id, ex.coachRoles || '')}
          className="w-full flex items-center justify-center space-x-1 py-2 border border-dashed border-slate-300 hover:border-emerald-500/50 hover:bg-emerald-50/30 rounded-xl text-[10px] font-bold text-slate-500 hover:text-emerald-600 transition-all uppercase tracking-wider"
        >
          <Plus className="w-3 h-3" />
          <span>Add Coach Role</span>
        </button>
      </div>

      {/* Display list for print view */}
      <div className="hidden print:block space-y-0.5">
        {parseCoachRolesList(ex.coachRoles || '').map((roleEntry, idx) => (
          <div key={idx} className="grid grid-cols-12 gap-2 text-xs text-slate-800 py-0.5 border-b border-slate-100/50 print:gap-1 print:text-[7px] print:py-0">
            <div className="col-span-4 font-bold truncate">{roleEntry.name}</div>
            <div className="col-span-8 font-semibold text-slate-600">{roleEntry.role || '—'}</div>
          </div>
        ))}
        {parseCoachRolesList(ex.coachRoles || '').length === 0 && (
          <div className="text-xs italic text-slate-400 print:text-[7px]">No coaches' roles assigned</div>
        )}
      </div>
    </div>
  );

  return (
    <section className={`bg-white border border-slate-200 rounded-2xl p-5 md:p-6 shadow-md shadow-slate-100/80 print:shadow-none print:border-slate-300 print:p-2 print:rounded-lg print:no-break space-y-4 ${block.exercises.length === 0 ? 'print:hidden' : ''}`}>
      {/* Block Header */}
      <div className="flex justify-between items-center border-b border-slate-100 pb-3.5 print:border-slate-200 print:pb-1.5">
        <h2 className="text-sm font-display font-black text-slate-900 tracking-wider uppercase flex items-center space-x-2 print:text-[#002142] print:text-sm print:font-extrabold">
          <span className="w-2.5 h-6 bg-emerald-500 rounded-md print:bg-[#002142] print:w-2 print:h-4 shadow-sm shadow-emerald-500/30" />
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
      <div className="space-y-5 print:space-y-3">
        {block.exercises.map((ex, idx) => {
          const isExpanded = expandedExercises[ex.id] !== false; // defaults to expanded

          return (
            <div 
              key={ex.id} 
              className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all bg-slate-50/10 hover:border-slate-300 print:border-slate-300 print:shadow-none print:bg-white print:rounded-lg print:no-break"
            >
              {/* Exercise Card Titlebar */}
              <div 
                onClick={() => toggleExpand(ex.id)}
                className="bg-slate-50/80 px-4 py-3.5 border-b border-slate-200 flex flex-wrap justify-between items-center gap-2 cursor-pointer select-none hover:bg-slate-100/70 print:bg-slate-50 print:border-b print:border-slate-200 print:py-1.5 print:px-3"
              >
                <div className="flex items-center space-x-3 flex-1 min-w-0 mr-4 print:space-x-2">
                  {/* Order indicator */}
                  <span className="w-6 h-6 flex items-center justify-center rounded-lg bg-slate-900 text-[11px] font-display font-black text-emerald-400 print:bg-[#002142] print:text-white print:w-5 print:h-5 print:text-[10px] print:font-extrabold shrink-0">
                    {idx + 1}
                  </span>
                  {/* Exercise Name editable (without expanding) */}
                  <input
                    type="text"
                    value={ex.name}
                    onClick={(e) => e.stopPropagation()} // don't toggle
                    onChange={(e) => updateExercise(ex.id, { name: e.target.value })}
                    className="w-full flex-1 min-w-0 font-display font-bold text-slate-900 bg-transparent border-b border-transparent focus:border-slate-300 focus:outline-none focus:bg-white px-2 py-0.5 rounded text-sm sm:text-base print:text-xs print:text-[#002142] print:font-extrabold print:p-0"
                    placeholder="Exercise Title"
                  />
                </div>

                {/* Badges and actions */}
                <div className="flex items-center space-x-2.5 shrink-0 print:space-x-1.5">
                  {/* Fitness badge if applicable */}
                  {ex.isFitness && (
                    <span className="text-[9px] uppercase tracking-wider font-extrabold px-2.5 py-1 rounded-md bg-[#002142] text-[#a79078] border border-[#a79078]/30 flex items-center gap-1 shrink-0 print:border-[#a79078]/40 print:bg-[#002142] print:text-[#a79078] print:px-1.5 print:py-0.5 print:text-[8px]">
                      ⚡ Fitness
                    </span>
                  )}

                  {/* Duration Badge (Calculated from Series, Work Time & Rest) */}
                  {ex.duration && (
                    <div 
                      className="flex items-center space-x-1.5 bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 rounded-xl text-emerald-900 shrink-0 print:bg-slate-100 print:border print:border-slate-200 print:px-1.5 print:py-0.5 print:rounded-md"
                      title="Tiempo total del ejercicio"
                    >
                      <Clock className="w-3.5 h-3.5 text-emerald-600 print:text-[#0f5981] print:w-3 print:h-3 shrink-0" />
                      <span className="text-xs font-black print:text-[10px]">{ex.duration}</span>
                    </div>
                  )}

                  {ex.malikaChallenge?.enabled && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (activeMalikaExerciseId === ex.id) {
                          closeMalikaPanel();
                        } else {
                          openMalikaPanel(ex);
                        }
                      }}
                      className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wide border shrink-0 transition-all print:hidden ${
                        activeMalikaExerciseId === ex.id
                          ? 'bg-amber-500 text-slate-950 border-amber-400'
                          : 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100'
                      }`}
                      title="Open Malika Golden League panel"
                    >
                      <Trophy className="w-3.5 h-3.5" />
                      <span>Malika</span>
                    </button>
                  )}

                  {/* Moment badge */}
                  <span className={`text-[9px] uppercase tracking-wider font-extrabold px-2.5 py-1 rounded-md border ${getMomentBadgeStyles(ex.gameMoment)} print:px-1.5 print:py-0.5 print:text-[8px] print:font-extrabold`}>
                    {ex.gameMoment}
                  </span>

                  {/* Reordering, library save, and deleting buttons (Hidden in print) */}
                  <div className="flex items-center space-x-1 print:hidden" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={(e) => handleAddToLibrary(ex, e)}
                      className={`px-2.5 py-1 rounded-xl text-xs font-extrabold transition-all border cursor-pointer flex items-center space-x-1 shadow-xs ${
                        addedToLibId === ex.id
                          ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                          : 'bg-[#002142]/10 hover:bg-[#002142] text-[#002142] hover:text-[#a79078] border-[#002142]/20 hover:border-[#002142]'
                      }`}
                      title="Añadir ejercicio a la biblioteca de entrenos"
                    >
                      {addedToLibId === ex.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-white shrink-0" />
                          <span className="hidden sm:inline">¡Guardado!</span>
                        </>
                      ) : (
                        <>
                          <BookmarkPlus className="w-3.5 h-3.5 shrink-0" />
                          <span className="hidden sm:inline">Añadir a biblioteca</span>
                        </>
                      )}
                    </button>

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
                  
                  {/* Left col: Image / tactical drawer (Span 4) - Hidden if hideGraphics is true */}
                  {!ex.hideGraphics && (
                    <div className="md:col-span-4 space-y-2.5 print:col-span-5 print:space-y-1.5">
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
                        {uploadingExId === ex.id ? (
                          <div className="flex flex-col items-center justify-center p-4 text-emerald-600 text-xs font-bold">
                            <Loader2 className="w-8 h-8 animate-spin mb-2 text-emerald-500" />
                            <span>Processing & Converting image...</span>
                          </div>
                        ) : ex.image ? (
                          <>
                            <SmartImage 
                              src={ex.image} 
                              alt="Tactical diagram" 
                              className="w-full h-full object-contain"
                              onConverted={(convertedJpeg) => updateExercise(ex.id, { image: convertedJpeg })}
                            />
                            
                            {/* Image overlay to change (Hidden in print) */}
                            <div className="absolute inset-0 bg-slate-950/70 opacity-0 hover:opacity-100 flex items-center justify-center space-x-2 transition-opacity print:hidden">
                              <label className="bg-white hover:bg-emerald-50 text-slate-900 text-[10px] font-extrabold uppercase tracking-wide px-3 py-1.5 rounded-xl cursor-pointer shadow-lg">
                                Upload New
                                <input 
                                  type="file" 
                                  accept="image/*,.heic,.heif,image/heic,image/heif" 
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
                              Drag image here (JPG, PNG, HEIC)
                            </p>
                            <p className="text-[9px] text-slate-400 mb-2.5">
                              or click to browse
                            </p>
                            <label className="bg-slate-900 hover:bg-emerald-600 text-white text-[9px] font-extrabold uppercase tracking-wide px-3 py-1.5 rounded-xl cursor-pointer shadow inline-block">
                              Browse file
                              <input 
                                type="file" 
                                accept="image/*,.heic,.heif,image/heic,image/heif" 
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

                      {/* Coaching Roles section underneath diagram when graphics present */}
                      {renderCoachRoles(ex)}
                    </div>
                  )}

                  {/* Right col: Form controls (Span 8 if graphics shown, Span 12 if hideGraphics is true) */}
                  <div className={`space-y-3.5 print:space-y-2 ${ex.hideGraphics ? 'md:col-span-12 print:col-span-12' : 'md:col-span-8 print:col-span-7'}`}>
                    
                    {/* Series, Tiempo y Descanso (Timing & Structure) Card */}
                    <div className="bg-slate-50/90 border border-slate-200/80 p-3 rounded-2xl space-y-2 print:bg-slate-50 print:border print:border-slate-200 print:p-2 print:rounded-lg">
                      <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5 print:border-slate-200">
                        <div className="flex items-center space-x-1.5">
                          <Clock className="w-3.5 h-3.5 text-emerald-600 shrink-0 print:w-3 print:h-3" />
                          <span className="text-[10px] font-extrabold text-slate-700 uppercase tracking-wider print:text-[8px] print:text-black">
                            Sets, Time & Rest
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2.5 print:grid-cols-3 print:gap-1.5">
                        <div>
                          <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider block mb-1 print:text-[8px] print:text-black">
                            Sets
                          </label>
                          <input
                            type="text"
                            value={ex.series ?? ''}
                            onChange={(e) => handleTimingChange(ex.id, ex, 'series', e.target.value)}
                            placeholder="e.g. 3"
                            className="w-full text-xs font-bold bg-white border border-slate-200 px-2.5 py-1.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all print:py-0.5 print:px-1.5 print:text-[9px]"
                          />
                        </div>

                        <div>
                          <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider block mb-1 print:text-[8px] print:text-black">
                            Time / Set (min)
                          </label>
                          <input
                            type="text"
                            value={ex.workTime ?? ''}
                            onChange={(e) => handleTimingChange(ex.id, ex, 'workTime', e.target.value)}
                            placeholder="e.g. 4"
                            className="w-full text-xs font-bold bg-white border border-slate-200 px-2.5 py-1.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all print:py-0.5 print:px-1.5 print:text-[9px]"
                          />
                        </div>

                        <div>
                          <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider block mb-1 print:text-[8px] print:text-black">
                            Rest (min)
                          </label>
                          <input
                            type="text"
                            value={ex.restTime ?? ''}
                            onChange={(e) => handleTimingChange(ex.id, ex, 'restTime', e.target.value)}
                            placeholder="e.g. 1"
                            className="w-full text-xs font-bold bg-white border border-slate-200 px-2.5 py-1.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all print:py-0.5 print:px-1.5 print:text-[9px]"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Game Moment / Tactical Sub-moment / Pitch Size (Combined in a compact 3-column row) */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 print:grid-cols-3 print:gap-2">
                      <div>
                        <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1 print:text-[#002142] print:text-[8px] print:font-extrabold truncate">
                          Game Moment
                        </label>
                        <select
                          value={ex.gameMoment}
                          onChange={(e) => updateExercise(ex.id, { gameMoment: e.target.value as GameMoment })}
                          className="w-full text-xs font-bold bg-white border border-slate-200 px-2.5 py-1.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all print:p-1 print:bg-slate-50 print:border print:border-slate-200 print:rounded print:text-[10px] print:font-bold truncate cursor-pointer"
                        >
                          {availableGameMoments.map(moment => (
                            <option key={moment} value={moment}>{moment}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1 print:text-[#002142] print:text-[8px] print:font-extrabold truncate">
                          Tactical Sub-moment
                        </label>
                        <select
                          value={ex.subMoment}
                          onChange={(e) => updateExercise(ex.id, { subMoment: e.target.value })}
                          className="w-full text-xs font-bold bg-white border border-slate-200 px-2.5 py-1.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all print:p-1 print:bg-slate-50 print:border print:border-slate-200 print:rounded print:text-[10px] print:font-bold truncate cursor-pointer"
                        >
                          {TACTICAL_SUB_MOMENTS.map(sub => (
                            <option key={sub} value={sub}>{sub}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest mb-1 print:text-[#002142] print:text-[8px] print:font-extrabold flex items-center truncate">
                          <Maximize2 className="w-3 h-3 mr-1 text-slate-400 shrink-0 print:hidden" />
                          Pitch Size
                        </label>
                        <input
                          type="text"
                          value={ex.dimensions}
                          onChange={(e) => updateExercise(ex.id, { dimensions: e.target.value })}
                          placeholder="e.g., 40x30m"
                          className="w-full text-xs font-bold bg-white border border-slate-200 px-2.5 py-1.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all print:p-1 print:bg-slate-50 print:border print:border-slate-200 print:rounded print:text-[10px] print:font-bold truncate"
                        />
                      </div>
                    </div>

                    <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-3.5 space-y-3 print:hidden">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shrink-0">
                            <Trophy className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-black text-amber-950 uppercase tracking-wider truncate">
                              Malika Golden League
                            </p>
                            <p className="text-[10px] font-semibold text-amber-900/70">
                              Mark this session exercise and assign points to players.
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => toggleMalikaChallenge(ex)}
                          className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-colors ${
                            ex.malikaChallenge?.enabled
                              ? 'bg-amber-500 text-slate-950 border-amber-400'
                              : 'bg-white text-amber-900 border-amber-300 hover:bg-amber-100'
                          }`}
                        >
                          {ex.malikaChallenge?.enabled ? 'ON' : 'OFF'}
                        </button>
                      </div>

                      {ex.malikaChallenge?.enabled && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] font-black uppercase text-amber-900 block mb-1">
                              Challenge Title
                            </label>
                            <input
                              type="text"
                              value={ex.malikaChallenge.title || ''}
                              onChange={(e) => updateMalikaConfig(ex, { title: e.target.value })}
                              placeholder="e.g. 1v1 Attack Challenge"
                              className="w-full bg-white border border-amber-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-amber-500"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-black uppercase text-amber-900 block mb-1">
                              Default Points
                            </label>
                            <input
                              type="number"
                              min={0}
                              value={ex.malikaChallenge.defaultPoints}
                              onChange={(e) => updateMalikaConfig(ex, { defaultPoints: Math.max(0, Number(e.target.value) || 0) })}
                              className="w-full bg-white border border-amber-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-amber-500"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Detailed Description */}
                    <div>
                      <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1.5 print:text-[#002142] print:text-[8px] print:font-extrabold">
                        Detailed Instructions & Rules of Provocation
                      </label>
                      <textarea
                        value={ex.description}
                        onChange={(e) => updateExercise(ex.id, { description: e.target.value })}
                        rows={4}
                        placeholder="Describe the tactical flow, rules, constraints, or jokers to trigger the desired behavior..."
                        className="w-full text-xs font-semibold bg-white border border-slate-200 px-3 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 resize-y transition-all print:hidden"
                      />
                      <div className={`hidden print:block font-semibold text-slate-800 whitespace-pre-wrap bg-slate-50/60 border border-slate-200/80 rounded-lg ${getPrintFontSizeClass(ex.description)}`}>
                        {ex.description}
                      </div>
                    </div>

                    {/* Coaches' Roles rendered in right column if graphics are hidden */}
                    {ex.hideGraphics && renderCoachRoles(ex)}

                    {/* Player Groups (Moved inside each exercise block) */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block print:text-[#002142] print:text-[8px] print:font-extrabold">
                          Player Groups & Assignments
                        </label>
                        {sessionGroups && sessionGroups.length > 0 && (
                          <button
                            type="button"
                            onClick={() => handleCopySessionGroups(ex.id)}
                            className="text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-lg transition-all flex items-center space-x-1 print:hidden"
                            title="Copy session player groups configured for this session"
                          >
                            <Users className="w-3 h-3" />
                            <span>Apply Session Groups</span>
                          </button>
                        )}
                      </div>
                      <textarea
                        value={ex.playerGroups || ''}
                        onChange={(e) => updateExercise(ex.id, { playerGroups: e.target.value })}
                        rows={3}
                        placeholder="e.g., Group 1: Rimah, Rital, Lara... Group 2: Batul, Sadeem..."
                        className="w-full text-xs font-semibold bg-white border border-slate-200 px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 resize-y transition-all print:hidden"
                      />
                      <div className={`hidden print:block font-semibold text-slate-800 whitespace-pre-wrap bg-slate-50/60 border border-slate-200/80 rounded-lg ${getPrintFontSizeClass(ex.playerGroups || '')}`}>
                        {ex.playerGroups || <span className="italic text-slate-400">No player groups assigned</span>}
                      </div>
                    </div>

                    {ex.malikaChallenge?.enabled && (
                      <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-3.5 space-y-3 print:hidden">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shrink-0">
                              <Trophy className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-black text-amber-950 uppercase tracking-wider truncate">
                                Malika Golden League
                              </p>
                              <p className="text-[10px] font-semibold text-amber-900/70">
                                Challenge: {ex.malikaChallenge.title || ex.name}
                              </p>
                              <p className="text-[10px] font-semibold text-amber-900/70">
                                Default points: {ex.malikaChallenge.defaultPoints}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (activeMalikaExerciseId === ex.id) {
                                closeMalikaPanel();
                              } else {
                                openMalikaPanel(ex);
                              }
                            }}
                            className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg bg-white text-amber-900 border border-amber-200 hover:bg-amber-100 transition-colors"
                          >
                            {activeMalikaExerciseId === ex.id ? 'Close' : 'Assign points'}
                          </button>
                        </div>

                        {activeMalikaExerciseId === ex.id && (
                          <div className="space-y-3">
                            {!canPersistMalikaAwards && (
                              <div className="rounded-xl border border-amber-300 bg-amber-100/70 px-3 py-2 text-[10px] font-bold text-amber-900">
                                This view can preview Malika assignments, but points can only be saved from an active session editor.
                              </div>
                            )}

                            <input
                              type="text"
                              value={malikaSearchTerm}
                              onChange={(e) => setMalikaSearchTerm(e.target.value)}
                              placeholder="Search players..."
                              className="w-full text-xs font-semibold bg-white border border-amber-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400/20 focus:border-amber-400"
                            />

                            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                              {squadPlayers.length === 0 && (
                                <div className="rounded-xl border border-amber-200 bg-white px-3 py-2 text-[10px] font-bold text-amber-900">
                                  No squad players available to assign points.
                                </div>
                              )}

                              {squadPlayers
                                .filter((player) => getPlayerLabel(player).toLowerCase().includes(malikaSearchTerm.toLowerCase()))
                                .map((player) => {
                                  const selection = malikaSelections[player.id] || { selected: false, points: String(ex.malikaChallenge?.defaultPoints ?? 0) };

                                  return (
                                    <div key={player.id} className="flex items-center gap-2 bg-white border border-amber-200 rounded-xl px-3 py-2">
                                      <label className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={selection.selected}
                                          onChange={() => updateMalikaPlayerSelection(player.id, ex.malikaChallenge?.defaultPoints ?? 0)}
                                          className="h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                                        />
                                        <span className="text-xs font-bold text-slate-800 truncate">
                                          {getPlayerLabel(player)}
                                        </span>
                                      </label>

                                      <input
                                        type="number"
                                        value={selection.points}
                                        onChange={(e) => updateMalikaPlayerPoints(player.id, e.target.value, ex.malikaChallenge?.defaultPoints ?? 0)}
                                        className="w-20 text-xs font-black bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 text-right focus:outline-none focus:ring-2 focus:ring-amber-400/20 focus:border-amber-400"
                                      />
                                    </div>
                                  );
                                })}
                            </div>

                            <div className="flex items-center justify-between gap-2 pt-1">
                              <button
                                type="button"
                                onClick={closeMalikaPanel}
                                className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-lg bg-white border border-amber-200 text-amber-900 hover:bg-amber-100"
                              >
                                <X className="w-3.5 h-3.5" />
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => saveMalikaChallenge(ex)}
                                disabled={!canPersistMalikaAwards || squadPlayers.length === 0}
                                className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-400"
                              >
                                <Trophy className="w-3.5 h-3.5" />
                                Assign points
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
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
