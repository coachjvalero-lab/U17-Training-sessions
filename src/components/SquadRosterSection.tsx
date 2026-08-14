import React, { useEffect, useState } from 'react';
import { 
  Users, 
  UserPlus, 
  Search, 
  Filter, 
  Edit2, 
  Trash2, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  XCircle, 
  Save, 
  X,
  UserCheck,
  LayoutGrid,
  List,
  Camera,
  ArrowRight,
  Upload,
  Loader2,
  BarChart3,
  TrendingUp
} from 'lucide-react';
import { SquadPlayer, TrainingSession, PlayerMatchStatisticsSummary, Match } from '../types';
import { CloudTrainingSession } from '../types';
import { AttendanceSection } from './AttendanceSection';
import { processUploadedImageFile } from '../utils/heic';
import { readWorkspaceRestoreState, writeWorkspaceRestoreState } from '../utils/workspaceRestore';
import { groupSquadPlayersByPosition } from '../utils/squadGrouping';
import { normalizeSquadPhotoUrl } from '../utils/squadPhotos';
import { supabase } from '../supabaseClient';
import { updateSquadPlayerPhotoPath } from '../services/squad/squadService';
import { useTeamContext } from '../contexts/TeamContext';
import { getPlayerMatchStatisticsSummary, getAvailableCompetitions } from '../modules/squadStatisticsService';
import { listMatches } from '../services/matches/matchService';

interface SquadRosterSectionProps {
  players: SquadPlayer[];
  onUpdatePlayers: (updated: SquadPlayer[]) => Promise<void>;
  session?: TrainingSession;
  cloudSessions?: CloudTrainingSession[];
  onChangeSession?: (fields: Partial<TrainingSession>) => void;
  onChangeRoster?: (roster: string[]) => void;
  initialSubTab?: 'roster' | 'attendance';
  excludedPlayers?: string[];
  onExcludePlayer?: (name: string) => void;
  onIncludePlayer?: (name: string) => void;
}

type SquadSubTab = 'roster' | 'attendance' | 'malika' | 'statistics';

const GRAY_AVATAR_PLACEHOLDER =
  "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240' viewBox='0 0 240 240'%3E%3Crect width='240' height='240' rx='48' fill='%23e2e8f0'/%3E%3Ccircle cx='120' cy='92' r='42' fill='%23cbd5e1'/%3E%3Cpath d='M48 202c12-34 38-52 72-52s60 18 72 52' fill='%23cbd5e1'/%3E%3C/svg%3E";
const SQUAD_PHOTOS_BUCKET = 'squad-player-photos';
const MAX_PHOTO_FILE_SIZE_BYTES = 8 * 1024 * 1024;

export const SquadRosterSection: React.FC<SquadRosterSectionProps> = ({
  players,
  onUpdatePlayers,
  session,
  cloudSessions = [],
  onChangeSession = () => {},
  onChangeRoster = () => {},
  initialSubTab = 'roster',
  excludedPlayers,
  onExcludePlayer,
  onIncludePlayer
}) => {
  const contextStorageKey = 'squad_roster_section';
  const restoredContext = readWorkspaceRestoreState(contextStorageKey, {
    activeSubTab: initialSubTab,
    searchTerm: '',
    positionFilter: 'ALL',
    statusFilter: 'ALL',
    viewMode: 'grid' as const
  });
  const { selectedTeamId } = useTeamContext();
  const [activeSubTab, setActiveSubTab] = useState<SquadSubTab>(restoredContext.activeSubTab as SquadSubTab);
  const [searchTerm, setSearchTerm] = useState(restoredContext.searchTerm);
  const [positionFilter, setPositionFilter] = useState<string>(restoredContext.positionFilter);
  const [statusFilter, setStatusFilter] = useState<string>(restoredContext.statusFilter);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>(restoredContext.viewMode);
  const [matchStatistics, setMatchStatistics] = useState<PlayerMatchStatisticsSummary[]>([]);
  const [availableCompetitions, setAvailableCompetitions] = useState<string[]>([]);
  const [availableMatches, setAvailableMatches] = useState<Match[]>([]);
  const [selectedCompetition, setSelectedCompetition] = useState<string>('ALL');
  const [selectedMatch, setSelectedMatch] = useState<string>('ALL');
  const [statsSearchTerm, setStatsSearchTerm] = useState('');
  const [statsSortBy, setStatsSortBy] = useState<'minutes' | 'goals' | 'assists' | 'apps'>('minutes');
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  useEffect(() => {
    setActiveSubTab(initialSubTab);
  }, [initialSubTab]);

  useEffect(() => {
    if (activeSubTab === 'statistics') {
      void (async () => {
        try {
          const [competitions, matches] = await Promise.all([
            getAvailableCompetitions(selectedTeamId),
            listMatches(selectedTeamId)
          ]);
          setAvailableCompetitions(competitions);
          setAvailableMatches(matches);
        } catch (error) {
          console.error('[SquadRosterSection] Failed loading match metadata', error);
        }
      })();
    }
  }, [activeSubTab, selectedTeamId]);

  useEffect(() => {
    if (activeSubTab !== 'statistics') return;

    void (async () => {
      try {
        setIsLoadingStats(true);
        const stats = await getPlayerMatchStatisticsSummary({
          teamId: selectedTeamId,
          competitionName: selectedCompetition === 'ALL' ? null : selectedCompetition,
          matchId: selectedMatch === 'ALL' ? null : selectedMatch
        });
        setMatchStatistics(stats);
      } catch (error) {
        console.error('[SquadRosterSection] Failed loading match statistics', error);
        setMatchStatistics([]);
      } finally {
        setIsLoadingStats(false);
      }
    })();
  }, [activeSubTab, selectedTeamId, selectedCompetition, selectedMatch]);
  
  // Modal State for Adding/Editing player
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<SquadPlayer | null>(null);

  const [photoPathOverrides, setPhotoPathOverrides] = useState<Record<string, string>>({});
  const [photoUploadError, setPhotoUploadError] = useState('');
  const [photoUploadSuccess, setPhotoUploadSuccess] = useState('');
  const [isPhotoUploading, setIsPhotoUploading] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [isSavingPlayer, setIsSavingPlayer] = useState(false);

  const [signedPhotoUrls, setSignedPhotoUrls] = useState<Record<string, string>>({});

  const dataUrlToBlob = (dataUrl: string): Blob => {
    const parts = dataUrl.split(',');
    if (parts.length !== 2) throw new Error('Invalid data URL');
    const mimeMatch = parts[0].match(/^data:([^;]+);base64$/i);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const binary = atob(parts[1]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mimeType });
  };

  const resolveSignedPhotoUrl = async (photoPath: string): Promise<string | null> => {
    if (!supabase) return null;
    const normalized = normalizeSquadPhotoUrl(photoPath);
    if (!normalized) return null;
    const slashIndex = normalized.indexOf('/');
    if (slashIndex <= 0 || slashIndex >= normalized.length - 1) return null;

    const bucket = normalized.slice(0, slashIndex);
    const objectPath = normalized.slice(slashIndex + 1);
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(objectPath, 3600);
    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  };

  const getPhotoPath = (player: SquadPlayer): string | undefined => {
    return photoPathOverrides[player.id] || normalizeSquadPhotoUrl(player.photoUrl);
  };

  const getDisplayPhotoSrc = (player: SquadPlayer): string => {
    const path = getPhotoPath(player);
    if (!path) return GRAY_AVATAR_PLACEHOLDER;
    return signedPhotoUrls[path] || GRAY_AVATAR_PLACEHOLDER;
  };

  useEffect(() => {
    let cancelled = false;
    const uniquePaths = Array.from(
      new Set(
        players
          .map((player) => getPhotoPath(player))
          .filter((path): path is string => Boolean(path))
      )
    );

    const missingPaths = uniquePaths.filter((path) => !signedPhotoUrls[path]);
    if (missingPaths.length === 0) return;

    void Promise.all(
      missingPaths.map(async (path) => {
        try {
          const signedUrl = await resolveSignedPhotoUrl(path);
          return signedUrl ? [path, signedUrl] as const : null;
        } catch {
          return null;
        }
      })
    ).then((entries) => {
      if (cancelled) return;
      const nextEntries = entries.filter((entry): entry is readonly [string, string] => Boolean(entry));
      if (nextEntries.length === 0) return;

      setSignedPhotoUrls((prev) => {
        const merged = { ...prev };
        nextEntries.forEach(([path, url]) => {
          merged[path] = url;
        });
        return merged;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [players, signedPhotoUrls]);

  const handleEditorPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !editingPlayer) return;

    setPhotoUploadError('');
    setPhotoUploadSuccess('');

    if (!file.type.toLowerCase().startsWith('image/')) {
      setPhotoUploadError('Invalid file type. Please select an image.');
      return;
    }

    if (file.size > MAX_PHOTO_FILE_SIZE_BYTES) {
      setPhotoUploadError('File too large. Maximum allowed size is 8 MB.');
      return;
    }

    if (!supabase) {
      setPhotoUploadError('Supabase is not configured.');
      return;
    }

    setIsPhotoUploading(true);

    try {
      const dataUrl = await processUploadedImageFile(file);
      const blob = dataUrlToBlob(dataUrl);
      const objectPath = `${editingPlayer.id}.jpg`;
      const storagePath = `${SQUAD_PHOTOS_BUCKET}/${objectPath}`;

      const { error: uploadError } = await supabase.storage
        .from(SQUAD_PHOTOS_BUCKET)
        .upload(objectPath, blob, {
          upsert: true,
          contentType: blob.type || 'image/jpeg',
          cacheControl: '3600'
        });

      if (uploadError) {
        setPhotoUploadError('Photo upload failed. The existing photo was not changed.');
        return;
      }

      try {
        await updateSquadPlayerPhotoPath(editingPlayer.id, storagePath);
      } catch {
        setPhotoUploadError('Photo uploaded, but could not be saved to the player profile.');
        return;
      }

      setPhotoPathOverrides((prev) => ({ ...prev, [editingPlayer.id]: storagePath }));

      const signedUrl = await resolveSignedPhotoUrl(storagePath);
      if (signedUrl) {
        setSignedPhotoUrls((prev) => ({ ...prev, [storagePath]: signedUrl }));
      }

      setPhotoUploadSuccess('Photo saved successfully.');
    } catch {
      setPhotoUploadError('Photo upload failed. The existing photo was not changed.');
    } finally {
      setIsPhotoUploading(false);
    }
  };

  const [formData, setFormData] = useState<{
    firstName: string;
    lastName: string;
    number: string;
    position: SquadPlayer['position'];
    status: SquadPlayer['status'];
    notes: string;
    age: string;
    nationality: string;
    preferredFoot: 'Right' | 'Left' | 'Both';
    heightCm: string;
    weightKg: string;
  }>({
    firstName: '',
    lastName: '',
    number: '',
    position: 'CM',
    status: 'Active',
    notes: '',
    age: '16',
    nationality: 'Saudi Arabia 🇸🇦',
    preferredFoot: 'Right',
    heightCm: '168',
    weightKg: '56'
  });

  useEffect(() => {
    writeWorkspaceRestoreState(contextStorageKey, {
      activeSubTab,
      searchTerm,
      positionFilter,
      statusFilter,
      viewMode
    });
  }, [activeSubTab, searchTerm, positionFilter, statusFilter, viewMode]);

  const handleOpenAddModal = () => {
    setEditingPlayer(null);
    setPhotoUploadError('');
    setPhotoUploadSuccess('');
    setSaveError('');
    setFormData({
      firstName: '',
      lastName: '',
      number: String(players.length + 1),
      position: 'CM',
      status: 'Active',
      notes: '',
      age: '16',
      nationality: 'Saudi Arabia 🇸🇦',
      preferredFoot: 'Right',
      heightCm: '168',
      weightKg: '56'
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (player: SquadPlayer) => {
    setEditingPlayer(player);
    setPhotoUploadError('');
    setPhotoUploadSuccess('');
    setSaveError('');
    setFormData({
      firstName: player.firstName,
      lastName: player.lastName,
      number: String(player.number || ''),
      position: player.position,
      status: player.status,
      notes: player.notes || '',
      age: String(player.age || 16),
      nationality: player.nationality || 'Saudi Arabia 🇸🇦',
      preferredFoot: player.preferredFoot || 'Right',
      heightCm: String(player.heightCm || 168),
      weightKg: String(player.weightKg || 56)
    });
    setIsModalOpen(true);
  };

  const handleSavePlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.firstName.trim() || !formData.lastName.trim()) return;
    if (isSavingPlayer) return;

    setSaveError('');
    setIsSavingPlayer(true);

    try {
      if (editingPlayer) {
        const updated = players.map(p => 
          p.id === editingPlayer.id 
            ? {
                ...p,
                firstName: formData.firstName.trim(),
                lastName: formData.lastName.trim(),
                number: formData.number ? Number(formData.number) : undefined,
                position: formData.position,
                status: formData.status,
                notes: formData.notes.trim(),
                age: formData.age ? Number(formData.age) : undefined,
                nationality: formData.nationality.trim() || 'Saudi Arabia 🇸🇦',
                preferredFoot: formData.preferredFoot,
                heightCm: formData.heightCm ? Number(formData.heightCm) : undefined,
                weightKg: formData.weightKg ? Number(formData.weightKg) : undefined
              }
            : p
        );
        await onUpdatePlayers(updated);
      } else {
        const newPlayer: SquadPlayer = {
          id: 'p-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          number: formData.number ? Number(formData.number) : undefined,
          position: formData.position,
          status: formData.status,
          notes: formData.notes.trim(),
          age: formData.age ? Number(formData.age) : 16,
          nationality: formData.nationality.trim() || 'Saudi Arabia 🇸🇦',
          preferredFoot: formData.preferredFoot,
          heightCm: formData.heightCm ? Number(formData.heightCm) : 168,
          weightKg: formData.weightKg ? Number(formData.weightKg) : 56,
          joinedDate: new Date().toISOString().split('T')[0]
        };
        await onUpdatePlayers([...players, newPlayer]);
      }

      setIsModalOpen(false);
    } catch (err) {
      const error = err as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };
      const parts = [
        typeof error?.message === 'string' ? error.message : null,
        typeof error?.details === 'string' ? error.details : null,
        typeof error?.hint === 'string' ? error.hint : null,
        typeof error?.code === 'string' ? `Code: ${error.code}` : null
      ].filter(Boolean) as string[];

      setSaveError(parts.length > 0 ? parts.join(' | ') : 'Could not save player. Please try again.');
    } finally {
      setIsSavingPlayer(false);
    }
  };

  const handleDeletePlayer = (id: string, name: string) => {
    if (confirm(`Are you sure you want to remove ${name} from the squad roster?`)) {
      void onUpdatePlayers(players.filter(p => p.id !== id)).catch((err) => {
        const error = err as { message?: unknown };
        alert(typeof error?.message === 'string' ? error.message : 'Could not delete player. Please try again.');
      });
    }
  };

  const handleQuickStatusChange = (id: string, newStatus: SquadPlayer['status']) => {
    const updated = players.map(p => p.id === id ? { ...p, status: newStatus } : p);
    void onUpdatePlayers(updated).catch((err) => {
      const error = err as { message?: unknown };
      alert(typeof error?.message === 'string' ? error.message : 'Could not update player status. Please try again.');
    });
  };

  // Filter Logic
  const filteredPlayers = players.filter(p => {
    const fullName = `${p.firstName} ${p.lastName}`.toLowerCase();
    const matchesSearch = fullName.includes(searchTerm.toLowerCase()) || 
                          String(p.number || '').includes(searchTerm) ||
                          p.position.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (p.notes || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPos = positionFilter === 'ALL' || 
                       (positionFilter === 'GK' && p.position === 'GK') ||
                       (positionFilter === 'DEF' && ['CB', 'LB', 'RB'].includes(p.position)) ||
                       (positionFilter === 'MID' && ['CM', 'CAM', 'CDM'].includes(p.position)) ||
                       (positionFilter === 'FWD' && ['RW', 'LW', 'ST'].includes(p.position));
    const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter;

    return matchesSearch && matchesPos && matchesStatus;
  });

  const groupedPlayers = groupSquadPlayersByPosition(filteredPlayers);

  const getStatusBadge = (status: SquadPlayer['status']) => {
    switch (status) {
      case 'Active':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            <span>Active</span>
          </span>
        );
      case 'Injured':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertTriangle className="w-3 h-3 text-rose-500" />
            <span>Injured</span>
          </span>
        );
      case 'Recovering':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-500" />
            <span>Rehab</span>
          </span>
        );
      case 'Absent':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
            <XCircle className="w-3 h-3 text-slate-400" />
            <span>Absent</span>
          </span>
        );
    }
  };

  const getPositionBadge = (pos: SquadPlayer['position']) => {
    let color = 'bg-slate-100 text-slate-800 border-slate-200';
    if (pos === 'GK') color = 'bg-sky-100 text-sky-800 border-sky-300 font-black';
    else if (['CB', 'LB', 'RB'].includes(pos)) color = 'bg-indigo-100 text-indigo-800 border-indigo-200';
    else if (['CM', 'CAM', 'CDM'].includes(pos)) color = 'bg-purple-100 text-purple-800 border-purple-200';
    else if (['RW', 'LW', 'ST'].includes(pos)) color = 'bg-emerald-100 text-emerald-800 border-emerald-200';

    return (
      <span className={`inline-block px-2 py-0.5 rounded text-xs font-mono font-bold border ${color}`}>
        {pos}
      </span>
    );
  };

  const malikaRanking = [...players]
    .map((player, index) => {
      const points = player.malikaPoints || 0;
      const previousPoints = player.malikaHistory && player.malikaHistory.length > 0
        ? player.malikaHistory.slice(1).reduce((sum, entry) => sum + entry.points, 0)
        : 0;
      return {
        ...player,
        points,
        evolution: points - previousPoints,
        ranking: index + 1
      };
    })
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const aName = `${a.firstName} ${a.lastName}`;
      const bName = `${b.firstName} ${b.lastName}`;
      return aName.localeCompare(bName);
    })
    .map((player, index) => ({ ...player, ranking: index + 1 }));

  const topMalika = malikaRanking.slice(0, 3);

  return (
    <div className="space-y-6">
      {/* SQUAD HUB MODULE NAVIGATION CARDS (Football Hub Grid Style) */}
      <div className="bg-[#001830] p-4 sm:p-5 rounded-3xl border border-slate-800 shadow-xl space-y-4">
        {/* Module Header Title & Al Ula Branding */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold shadow-inner">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white tracking-tight flex items-center space-x-2">
                <span>Squad & Attendance Hub</span>
                <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full uppercase">
                  Plantilla
                </span>
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                Al Ula FC Women U17 Squad Management & Attendance Analytics Portal
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-[11px] font-mono font-bold text-amber-300 bg-amber-400/10 border border-amber-400/30 px-3 py-1 rounded-xl">
              {players.length} Registered Athletes
            </span>
          </div>
        </div>

        {/* TOP 2 MODULE NAVIGATION CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Card 1: Squad Roster & Profiles */}
          <button
            type="button"
            onClick={() => setActiveSubTab('roster')}
            className={`group text-left p-4 sm:p-5 rounded-2xl border transition-all duration-200 flex flex-col justify-between relative overflow-hidden cursor-pointer ${
              activeSubTab === 'roster'
                ? 'bg-[#0f5981] border-[#5ea4c5] shadow-lg ring-2 ring-[#5ea4c5]/40 scale-[1.01]'
                : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
            }`}
          >
            <div className={`absolute top-0 inset-x-0 h-1 transition-colors ${
              activeSubTab === 'roster' ? 'bg-emerald-500' : 'bg-slate-800 group-hover:bg-emerald-600'
            }`} />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  ROSTER & ATHLETES
                </span>
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                  activeSubTab === 'roster' 
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black' 
                    : 'bg-indigo-950/60 text-indigo-400 border-indigo-800/60'
                }`}>
                  Plantilla Hub
                </span>
              </div>

              <div className="flex items-start space-x-3">
                <div className={`p-3 rounded-xl border shrink-0 transition-transform ${
                  activeSubTab === 'roster'
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 scale-105'
                    : 'bg-slate-800 text-slate-300 border-slate-700 group-hover:text-emerald-400'
                }`}>
                  <Users className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white group-hover:text-emerald-300 transition-colors">
                    Squad Roster & Profiles
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed mt-1 line-clamp-2">
                    Gestión de jugadoras, dorsales, posiciones, fotos de plantilla, edades y ficha técnica individual.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-slate-400">
              <span className="text-[11px] font-mono text-slate-400">
                {players.length} Players Active
              </span>
              <div className="flex items-center space-x-1 text-emerald-400 font-bold group-hover:translate-x-1 transition-transform">
                <span>Ver Plantilla</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </button>

          {/* Card 2: Attendance & Analytics Hub */}
          <button
            type="button"
            onClick={() => setActiveSubTab('attendance')}
            className={`group text-left p-4 sm:p-5 rounded-2xl border transition-all duration-200 flex flex-col justify-between relative overflow-hidden cursor-pointer ${
              activeSubTab === 'attendance'
                ? 'bg-[#0f5981] border-[#5ea4c5] shadow-lg ring-2 ring-[#5ea4c5]/40 scale-[1.01]'
                : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
            }`}
          >
            <div className={`absolute top-0 inset-x-0 h-1 transition-colors ${
              activeSubTab === 'attendance' ? 'bg-emerald-500' : 'bg-slate-800 group-hover:bg-emerald-600'
            }`} />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  ANALYTICS & ABSENCE
                </span>
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                  activeSubTab === 'attendance' 
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black' 
                    : 'bg-teal-950/60 text-teal-400 border-teal-800/60'
                }`}>
                  Control de Asistencia
                </span>
              </div>

              <div className="flex items-start space-x-3">
                <div className={`p-3 rounded-xl border shrink-0 transition-transform ${
                  activeSubTab === 'attendance'
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 scale-105'
                    : 'bg-slate-800 text-slate-300 border-slate-700 group-hover:text-emerald-400'
                }`}>
                  <UserCheck className="w-5 h-5 text-teal-400" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white group-hover:text-emerald-300 transition-colors">
                    Attendance & Analytics Hub
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed mt-1 line-clamp-2">
                    Control de asistencia en vivo, ausencias justificadas (estudios/lesión), gimnasio y estadísticas de la plantilla.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-slate-400">
              <span className="text-[11px] font-mono text-slate-400">
                Team Attendance Rates
              </span>
              <div className="flex items-center space-x-1 text-emerald-400 font-bold group-hover:translate-x-1 transition-transform">
                <span>Ver Asistencia</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </button>

          {/* Card 3: Malika Golden League */}
          <button
            type="button"
            onClick={() => setActiveSubTab('malika')}
            className={`group text-left p-4 sm:p-5 rounded-2xl border transition-all duration-200 flex flex-col justify-between relative overflow-hidden cursor-pointer ${
              activeSubTab === 'malika'
                ? 'bg-[#0f5981] border-[#5ea4c5] shadow-lg ring-2 ring-[#5ea4c5]/40 scale-[1.01]'
                : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
            }`}
          >
            <div className={`absolute top-0 inset-x-0 h-1 transition-colors ${
              activeSubTab === 'malika' ? 'bg-amber-500' : 'bg-slate-800 group-hover:bg-amber-600'
            }`} />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  INTERNAL COMPETITION
                </span>
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                  activeSubTab === 'malika'
                    ? 'bg-amber-500 text-slate-950 border-amber-400 font-black'
                    : 'bg-amber-950/60 text-amber-300 border-amber-800/60'
                }`}>
                  Malika League
                </span>
              </div>

              <div className="flex items-start space-x-3">
                <div className={`p-3 rounded-xl border shrink-0 transition-transform ${
                  activeSubTab === 'malika'
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 scale-105'
                    : 'bg-slate-800 text-slate-300 border-slate-700 group-hover:text-amber-400'
                }`}>
                  <span className="text-lg">👑</span>
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white group-hover:text-amber-300 transition-colors">
                    Malika Golden League
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed mt-1 line-clamp-2">
                    Internal points ranking for challenge winners and training bonuses.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-slate-400">
              <span className="text-[11px] font-mono text-slate-400">
                {players.filter((player) => (player.malikaPoints || 0) > 0).length} Players Scored
              </span>
              <div className="flex items-center space-x-1 text-amber-400 font-bold group-hover:translate-x-1 transition-transform">
                <span>View Ranking</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </button>

          {/* Card 4: Match Statistics */}
          <button
            type="button"
            onClick={() => setActiveSubTab('statistics')}
            className={`group text-left p-4 sm:p-5 rounded-2xl border transition-all duration-200 flex flex-col justify-between relative overflow-hidden cursor-pointer ${
              activeSubTab === 'statistics'
                ? 'bg-[#0f5981] border-[#5ea4c5] shadow-lg ring-2 ring-[#5ea4c5]/40 scale-[1.01]'
                : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
            }`}
          >
            <div className={`absolute top-0 inset-x-0 h-1 transition-colors ${
              activeSubTab === 'statistics' ? 'bg-sky-500' : 'bg-slate-800 group-hover:bg-sky-600'
            }`} />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  MATCH PERFORMANCE
                </span>
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                  activeSubTab === 'statistics'
                    ? 'bg-sky-500 text-slate-950 border-sky-400 font-black'
                    : 'bg-sky-950/60 text-sky-400 border-sky-800/60'
                }`}>
                  Match Stats
                </span>
              </div>

              <div className="flex items-start space-x-3">
                <div className={`p-3 rounded-xl border shrink-0 transition-transform ${
                  activeSubTab === 'statistics'
                    ? 'bg-sky-500/20 text-sky-400 border-sky-500/40 scale-105'
                    : 'bg-slate-800 text-slate-300 border-slate-700 group-hover:text-sky-400'
                }`}>
                  <BarChart3 className="w-5 h-5 text-sky-400" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white group-hover:text-sky-300 transition-colors">
                    Match Statistics
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed mt-1 line-clamp-2">
                    Player match performance aggregated from canonical match data.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-slate-400">
              <span className="text-[11px] font-mono text-slate-400">
                Apps, Goals, Assists
              </span>
              <div className="flex items-center space-x-1 text-sky-400 font-bold group-hover:translate-x-1 transition-transform">
                <span>View Stats</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </button>

        </div>
      </div>

      {activeSubTab === 'statistics' ? (
        <div className="space-y-6">
          <div className="bg-[#001d3a] border border-[#5ea4c5]/20 text-white rounded-2xl p-6 md:p-8 shadow-xl relative overflow-hidden print:bg-white print:text-slate-900 print:border-slate-300 print:p-4">
            <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center space-x-3.5">
                <div className="p-3 bg-[#002b54] text-sky-300 rounded-2xl border border-sky-300/30 shadow-inner">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-sky-300">
                      Squad Match Performance
                    </span>
                    <span className="bg-sky-500/20 text-sky-300 text-[10px] font-black px-2 py-0.5 rounded-full border border-sky-500/30">
                      Match Statistics
                    </span>
                  </div>
                  <h1 className="text-xl md:text-2xl font-display font-black tracking-tight uppercase text-white mt-0.5">
                    Player Match Statistics
                  </h1>
                  <p className="text-xs text-sky-200/70 font-semibold max-w-xl mt-1">
                    Aggregated from canonical match data: apps, starts, minutes, goals, assists, cards.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-slate-500">Competition:</span>
                <select
                  value={selectedCompetition}
                  onChange={(e) => setSelectedCompetition(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
                >
                  <option value="ALL">All Competitions</option>
                  {availableCompetitions.map((comp) => (
                    <option key={comp} value={comp}>{comp}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-slate-500">Match:</span>
                <select
                  value={selectedMatch}
                  onChange={(e) => setSelectedMatch(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
                >
                  <option value="ALL">All Matches</option>
                  {availableMatches.map((match) => (
                    <option key={match.id} value={match.id}>
                      vs {match.opponentTeamId} ({match.date})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-slate-500">Sort By:</span>
                <select
                  value={statsSortBy}
                  onChange={(e) => setStatsSortBy(e.target.value as 'minutes' | 'goals' | 'assists' | 'apps')}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
                >
                  <option value="minutes">Minutes</option>
                  <option value="goals">Goals</option>
                  <option value="assists">Assists</option>
                  <option value="apps">Apps</option>
                </select>
              </div>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={statsSearchTerm}
                onChange={(e) => setStatsSearchTerm(e.target.value)}
                placeholder="Search player by name..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          {/* Statistics Table */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-md overflow-hidden">
            {isLoadingStats ? (
              <div className="p-12 text-center text-slate-400 flex flex-col items-center space-y-3">
                <Loader2 className="w-6 h-6 animate-spin text-sky-600" />
                <span className="text-xs font-medium">Loading match statistics...</span>
              </div>
            ) : (() => {
              const filteredStats = matchStatistics
                .filter((stat) => 
                  stat.playerName.toLowerCase().includes(statsSearchTerm.toLowerCase())
                )
                .sort((a, b) => {
                  if (statsSortBy === 'minutes') return b.minutes - a.minutes;
                  if (statsSortBy === 'goals') return b.goals - a.goals;
                  if (statsSortBy === 'assists') return b.assists - a.assists;
                  if (statsSortBy === 'apps') return b.apps - a.apps;
                  return 0;
                });

              if (filteredStats.length === 0) {
                return (
                  <div className="p-12 text-center text-slate-400">
                    <p className="text-sm font-medium">
                      {matchStatistics.length === 0 
                        ? (availableMatches.length === 0 
                            ? 'No matches available.' 
                            : 'No match statistics available yet.')
                        : 'No players match the selected filters.'}
                    </p>
                  </div>
                );
              }

              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-400 bg-slate-50/80">
                        <th className="py-3 px-4">Player</th>
                        <th className="py-3 px-4 text-center">Apps</th>
                        <th className="py-3 px-4 text-center">Starts</th>
                        <th className="py-3 px-4 text-center">Minutes</th>
                        <th className="py-3 px-4 text-center">Goals</th>
                        <th className="py-3 px-4 text-center">Assists</th>
                        <th className="py-3 px-4 text-center">Yellow Cards</th>
                        <th className="py-3 px-4 text-center">Red Cards</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs font-medium">
                      {filteredStats.map((stat) => (
                        <tr key={stat.playerId} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3 px-4 font-bold text-slate-900">{stat.playerName}</td>
                          <td className="py-3 px-4 text-center text-slate-700">{stat.apps}</td>
                          <td className="py-3 px-4 text-center text-slate-700">{stat.starts}</td>
                          <td className="py-3 px-4 text-center text-slate-700">{stat.minutes}</td>
                          <td className="py-3 px-4 text-center font-bold text-emerald-700">{stat.goals}</td>
                          <td className="py-3 px-4 text-center font-bold text-sky-700">{stat.assists}</td>
                          <td className="py-3 px-4 text-center text-amber-700">{stat.yellowCards}</td>
                          <td className="py-3 px-4 text-center text-rose-700">{stat.redCards}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
        </div>
      ) : activeSubTab === 'attendance' && session ? (
        <AttendanceSection
          session={session}
          cloudSessions={cloudSessions}
          squadRoster={session.squadRoster || players.map(p => `${p.firstName} ${p.lastName}`)}
          onChangeSession={onChangeSession}
          onChangeRoster={onChangeRoster}
          excludedPlayers={excludedPlayers}
          onExcludePlayer={onExcludePlayer}
          onIncludePlayer={onIncludePlayer}
        />
      ) : activeSubTab === 'malika' ? (
        <div className="space-y-6">
          <div className="bg-[#001d3a] border border-[#5ea4c5]/20 text-white rounded-2xl p-6 md:p-8 shadow-xl relative overflow-hidden print:bg-white print:text-slate-900 print:border-slate-300 print:p-4">
            <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center space-x-3.5">
                <div className="p-3 bg-[#002b54] text-amber-300 rounded-2xl border border-amber-300/30 shadow-inner">
                  <span className="text-xl">👑</span>
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-300">
                      Squad Master Ranking
                    </span>
                    <span className="bg-amber-500/20 text-amber-300 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-500/30">
                      Malika Golden League
                    </span>
                  </div>
                  <h1 className="text-xl md:text-2xl font-display font-black tracking-tight uppercase text-white mt-0.5">
                    Internal challenge leaderboard
                  </h1>
                  <p className="text-xs text-sky-200/70 font-semibold max-w-xl mt-1">
                    Ranking derived from exercise-level challenge points stored only in Squad.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {topMalika.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {topMalika.map((player, index) => (
                <div key={player.id} className={`bg-white border rounded-2xl p-4 shadow-sm ${index === 0 ? 'border-amber-300' : 'border-slate-200'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Top {index + 1}</span>
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                      {player.points} pts
                    </span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <img
                      src={getDisplayPhotoSrc(player)}
                      alt={`${player.firstName} ${player.lastName}`}
                      className="w-12 h-12 rounded-xl object-cover border border-slate-200"
                    />
                    <div className="min-w-0">
                      <h3 className="font-extrabold text-slate-900 truncate">{player.firstName} {player.lastName}</h3>
                      <p className="text-xs text-slate-500">Ranking #{player.ranking}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-md space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-sm font-display font-black text-slate-900 uppercase tracking-wider">
                  Malika Golden League Ranking
                </h2>
                <p className="text-[10px] text-slate-400 font-bold">
                  Auto-ordered by points, driven only by Squad data.
                </p>
              </div>
              <div className="text-xs font-black uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl">
                {malikaRanking.length} ranked players
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-400 bg-slate-50/80">
                    <th className="py-3 px-3">Pos</th>
                    <th className="py-3 px-3">Player</th>
                    <th className="py-3 px-3 text-center">Points</th>
                    <th className="py-3 px-3 text-center">Change</th>
                    <th className="py-3 px-3 text-right">Ranking</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {malikaRanking.map((player, index) => (
                    <tr key={player.id} className={`hover:bg-slate-50/80 transition-colors ${index < 3 ? 'bg-amber-50/20' : ''}`}>
                      <td className="py-3 px-3 font-black text-slate-700">#{player.ranking}</td>
                      <td className="py-3 px-3">
                        <div className="flex items-center space-x-2.5">
                          <img
                            src={getDisplayPhotoSrc(player)}
                            alt={`${player.firstName} ${player.lastName}`}
                            className="w-8 h-8 rounded-full object-cover border border-slate-200"
                          />
                          <div>
                            <div className="font-extrabold text-slate-900">{player.firstName} {player.lastName}</div>
                            <div className="text-[10px] text-slate-400 uppercase tracking-wider">{player.position}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center font-black text-amber-700">{player.points}</td>
                      <td className="py-3 px-3 text-center font-bold text-slate-600">
                        {player.evolution > 0 ? `+${player.evolution}` : player.evolution < 0 ? `${player.evolution}` : '0'}
                      </td>
                      <td className="py-3 px-3 text-right text-[11px] font-bold text-slate-500">#{player.ranking}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Header Banner - Clean Light Al Ula Style */}
          <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-emerald-700 text-xs font-mono font-bold uppercase tracking-widest mb-1">
            <Users className="w-4 h-4 text-emerald-600" />
            <span>Plantilla & Iterpro Team Hub</span>
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-[#002142] font-display">
            Al Ula FC Women U17 Squad Roster
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Complete squad database with player photos, jersey dorsals, physical metrics, and status tracking.
          </p>
        </div>

        <div className="flex items-center space-x-3 w-full md:w-auto justify-between md:justify-end">
          {/* View Toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'grid'
                  ? 'bg-white text-[#002142] shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Cards</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'table'
                  ? 'bg-white text-[#002142] shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Table</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleOpenAddModal}
            className="px-4 py-2.5 bg-[#002142] hover:bg-[#001830] text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-slate-900/10 flex items-center space-x-2 shrink-0 cursor-pointer"
          >
            <UserPlus className="w-4 h-4 text-emerald-400" />
            <span>Add Player</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search player name, dorsal #, position..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <div className="flex items-center space-x-1 text-xs font-bold text-slate-500 mr-1">
            <Filter className="w-3.5 h-3.5" />
            <span>Pos:</span>
          </div>
          {['ALL', 'GK', 'DEF', 'MID', 'FWD'].map((pos) => (
            <button
              key={pos}
              type="button"
              onClick={() => setPositionFilter(pos)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                positionFilter === pos
                  ? 'bg-[#002142] text-white shadow-sm'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              {pos}
            </button>
          ))}

          <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block" />

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1 bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Injured">Injured</option>
            <option value="Recovering">Rehab</option>
            <option value="Absent">Absent</option>
          </select>
        </div>
      </div>

      {/* CARDS GRID VIEW (Iterpro / FIFA Style Player Cards) */}
      {viewMode === 'grid' ? (
        <div className="space-y-6">
          {filteredPlayers.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
              No squad players match the filter parameters.
            </div>
          ) : (
            [
              { key: 'gk', title: 'GK', players: groupedPlayers.gk },
              { key: 'defenders', title: 'Defenders', players: groupedPlayers.defenders },
              { key: 'midfielders', title: 'Midfielders', players: groupedPlayers.midfielders },
              { key: 'strikers', title: 'Strikers', players: groupedPlayers.strikers }
            ].filter((group) => group.players.length > 0).map((group) => (
              <div key={group.key} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-700">{group.title}</h3>
                  <span className="text-[11px] font-semibold text-slate-400">{group.players.length}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                  {group.players.map((player) => (
                    <div 
                      key={player.id}
                      className="bg-white border border-slate-200/90 hover:border-emerald-500/60 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between relative group overflow-hidden"
                    >
                {/* Top Accent Stripe */}
                <div className="absolute top-0 inset-x-0 h-1 bg-[#002142] group-hover:bg-emerald-600 transition-colors" />

                <div>
                  {/* Card Header: Dorsal Number & Status */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-8 h-8 rounded-xl bg-[#002142] text-white font-mono font-black text-sm flex items-center justify-center shadow-sm">
                      #{player.number || '0'}
                    </div>
                    {getStatusBadge(player.status)}
                  </div>

                  {/* Player Avatar & Name Block */}
                  <div className="flex flex-col items-center text-center space-y-2.5 my-2">
                    <div className="relative group/photo">
                      <img
                        src={getDisplayPhotoSrc(player)}
                        alt={`${player.firstName} ${player.lastName}`}
                        className="w-20 h-20 rounded-2xl object-cover border-2 border-slate-200 group-hover:border-emerald-500 transition-colors shadow-sm bg-slate-100"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = GRAY_AVATAR_PLACEHOLDER;
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(player)}
                        className="absolute -top-1 -right-1 bg-emerald-600 hover:bg-emerald-500 text-white p-1.5 rounded-full shadow-md transition-transform hover:scale-110 cursor-pointer"
                        title="Upload or replace player photo"
                      >
                        <Camera className="w-3 h-3" />
                      </button>
                      <div className="absolute -bottom-2 inset-x-0 flex justify-center">
                        {getPositionBadge(player.position)}
                      </div>
                    </div>

                    <div className="pt-2">
                      <h3 className="text-base font-extrabold text-[#002142] leading-tight">
                        {player.firstName} {player.lastName}
                      </h3>
                      <p className="text-[11px] font-semibold text-slate-400 mt-0.5 flex items-center justify-center space-x-1">
                        <span>{player.nationality || 'Saudi Arabia 🇸🇦'}</span>
                        <span>•</span>
                        <span>{player.age || 16} yrs</span>
                      </p>
                    </div>
                  </div>

                  {/* Metrics Bar (Height, Weight, Foot) */}
                  <div className="grid grid-cols-3 gap-1 bg-slate-50 border border-slate-100 rounded-xl p-2 text-center text-[10px] font-mono text-slate-600 my-3">
                    <div>
                      <span className="block text-[9px] text-slate-400 font-sans font-bold uppercase">Height</span>
                      <span className="font-bold text-slate-800">{player.heightCm || 168} cm</span>
                    </div>
                    <div className="border-x border-slate-200 px-1">
                      <span className="block text-[9px] text-slate-400 font-sans font-bold uppercase">Weight</span>
                      <span className="font-bold text-slate-800">{player.weightKg || 56} kg</span>
                    </div>
                    <div>
                      <span className="block text-[9px] text-slate-400 font-sans font-bold uppercase">Foot</span>
                      <span className="font-bold text-slate-800">{player.preferredFoot || 'R'}</span>
                    </div>
                  </div>

                  {/* Notes Preview */}
                  {player.notes && (
                    <p className="text-[11px] text-slate-500 font-medium line-clamp-2 italic bg-slate-50/50 p-2 rounded-lg border border-slate-100">
                      "{player.notes}"
                    </p>
                  )}
                </div>

                {/* Card Footer Actions */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <select
                    value={player.status}
                    onChange={(e) => handleQuickStatusChange(player.id, e.target.value as SquadPlayer['status'])}
                    className="text-[10px] font-bold bg-slate-100 text-slate-700 rounded-lg px-2 py-1 border border-slate-200 focus:outline-none"
                  >
                    <option value="Active">Active</option>
                    <option value="Injured">Injured</option>
                    <option value="Recovering">Rehab</option>
                    <option value="Absent">Absent</option>
                  </select>

                  <div className="flex items-center space-x-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(player)}
                      className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-[#002142] rounded-lg transition-colors cursor-pointer"
                      title="Edit Profile"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeletePlayer(player.id, `${player.firstName} ${player.lastName}`)}
                      className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                      title="Delete Player"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                      </div>
                    ))}
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        /* TABLE LIST VIEW */
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4">Player</th>
                  <th className="py-3 px-4">Position</th>
                  <th className="py-3 px-4">Age & Nat.</th>
                  <th className="py-3 px-4">Physical Stats</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Notes</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                {filteredPlayers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      No players match the filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredPlayers.map((player) => (
                    <tr key={player.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 text-center font-mono font-bold text-[#002142] bg-slate-50/40">
                        {player.number ? `#${player.number}` : '-'}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        <div className="flex items-center space-x-3">
                          <div className="relative group/tblphoto cursor-pointer" onClick={() => handleOpenEditModal(player)} title="Click to change player photo">
                            <img
                              src={getDisplayPhotoSrc(player)}
                              alt={player.firstName}
                              className="w-8 h-8 rounded-full object-cover border border-slate-200 bg-slate-100 shrink-0 group-hover/tblphoto:border-emerald-500 transition-colors"
                            />
                            <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover/tblphoto:opacity-100 transition-opacity">
                              <Camera className="w-3 h-3 text-white" />
                            </div>
                          </div>
                          <span>{player.firstName} {player.lastName}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {getPositionBadge(player.position)}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-600">
                        {player.nationality || 'Saudi Arabia 🇸🇦'} ({player.age || 16}y)
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                        {player.heightCm || 168}cm • {player.weightKg || 56}kg • Foot: {player.preferredFoot || 'R'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          {getStatusBadge(player.status)}
                          <select
                            value={player.status}
                            onChange={(e) => handleQuickStatusChange(player.id, e.target.value as SquadPlayer['status'])}
                            className="text-[10px] font-semibold bg-slate-100 text-slate-600 rounded px-1.5 py-0.5 border border-slate-200 focus:outline-none"
                          >
                            <option value="Active">Active</option>
                            <option value="Injured">Injured</option>
                            <option value="Recovering">Rehab</option>
                            <option value="Absent">Absent</option>
                          </select>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-500 max-w-xs truncate">
                        {player.notes || <span className="text-slate-300 italic">No notes</span>}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(player)}
                            className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-900 rounded-lg transition-colors cursor-pointer"
                            title="Edit Player"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePlayer(player.id, `${player.firstName} ${player.lastName}`)}
                            className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                            title="Delete Player"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Summary Footer */}
      <div className="bg-white px-5 py-3 rounded-xl border border-slate-200 text-xs font-semibold text-slate-500 flex justify-between items-center">
        <span>Showing {filteredPlayers.length} of {players.length} registered squad members</span>
        <span className="text-[11px] font-mono text-slate-400">Al Ula Women U17 Technical Database</span>
      </div>

      {/* Modal Dialog for Add / Edit Player */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-fadeIn max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-[#002142]">
                {editingPlayer ? 'Edit Player Profile (Iterpro)' : 'Add New Player to Roster'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePlayer} className="space-y-4">
              
              {/* Photo Select Section */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Player Photo / Avatar
                </label>
                <div className="flex items-center space-x-3 mb-2">
                  <img
                    src={editingPlayer ? getDisplayPhotoSrc(editingPlayer) : GRAY_AVATAR_PLACEHOLDER}
                    alt="Preview"
                    className="w-14 h-14 rounded-2xl object-cover border-2 border-slate-200 shrink-0 bg-slate-100"
                  />
                  <div className="flex-1">
                    <label className="inline-flex items-center space-x-2 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 rounded-xl text-xs font-bold cursor-pointer">
                      {isPhotoUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                      <span>{isPhotoUploading ? 'Uploading...' : 'Upload Photo'}</span>
                      <input
                        type="file"
                        accept="image/*,.heic,.heif"
                        onChange={handleEditorPhotoUpload}
                        disabled={!editingPlayer || isPhotoUploading}
                        className="hidden"
                      />
                    </label>
                    {!editingPlayer && (
                      <p className="text-[10px] text-slate-400 mt-1 font-semibold">
                        Save the player first, then upload the photo.
                      </p>
                    )}
                  </div>
                </div>

                {photoUploadSuccess && (
                  <p className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-1">
                    {photoUploadSuccess}
                  </p>
                )}

                {photoUploadError && (
                  <p className="text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-2 py-1">
                    {photoUploadError}
                  </p>
                )}

                {saveError && (
                  <p className="text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-2 py-1">
                    {saveError}
                  </p>
                )}

              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    First Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    placeholder="e.g. Rimah"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    placeholder="e.g. Al-Harbi"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Dorsal #
                  </label>
                  <input
                    type="number"
                    value={formData.number}
                    onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                    placeholder="10"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Position
                  </label>
                  <select
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value as SquadPlayer['position'] })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="GK">GK (Goalkeeper)</option>
                    <option value="CB">CB (Center Back)</option>
                    <option value="LB">LB (Left Back)</option>
                    <option value="RB">RB (Right Back)</option>
                    <option value="CDM">CDM (Def Mid)</option>
                    <option value="CM">CM (Central Mid)</option>
                    <option value="CAM">CAM (Att Mid)</option>
                    <option value="RW">RW (Right Wing)</option>
                    <option value="LW">LW (Left Wing)</option>
                    <option value="ST">ST (Striker)</option>
                    <option value="UTIL">Utility</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as SquadPlayer['status'] })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="Active">Active</option>
                    <option value="Injured">Injured</option>
                    <option value="Recovering">Rehab</option>
                    <option value="Absent">Absent</option>
                  </select>
                </div>
              </div>

              {/* Age, Nationality, Foot, Height, Weight */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Age (Years)
                  </label>
                  <input
                    type="number"
                    value={formData.age}
                    onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                    placeholder="16"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Nationality
                  </label>
                  <input
                    type="text"
                    value={formData.nationality}
                    onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                    placeholder="Saudi Arabia 🇸🇦"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Foot
                  </label>
                  <select
                    value={formData.preferredFoot}
                    onChange={(e) => setFormData({ ...formData, preferredFoot: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="Right">Right</option>
                    <option value="Left">Left</option>
                    <option value="Both">Both</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Height (cm)
                  </label>
                  <input
                    type="number"
                    value={formData.heightCm}
                    onChange={(e) => setFormData({ ...formData, heightCm: e.target.value })}
                    placeholder="168"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Weight (kg)
                  </label>
                  <input
                    type="number"
                    value={formData.weightKg}
                    onChange={(e) => setFormData({ ...formData, weightKg: e.target.value })}
                    placeholder="56"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Notes & Observations
                </label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Tactical strengths, injury notes, fitness remarks..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingPlayer}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-400 disabled:cursor-not-allowed text-white text-xs font-extrabold rounded-xl transition-colors shadow-md shadow-emerald-600/30 flex items-center space-x-1"
                >
                  {isSavingPlayer ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>{isSavingPlayer ? 'Saving...' : 'Save Player'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
};
