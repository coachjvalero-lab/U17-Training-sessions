import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Edit3, Save, X, Users, ClipboardList, FileText } from 'lucide-react';
import {
  addTripTarget,
  createOrUpdatePlayerReport,
  createOrUpdateScoutingPlayer,
  createOrUpdateScoutingTrip,
  deletePlayerReport,
  deleteScoutingPlayer,
  deleteScoutingTrip,
  ensureClubTeam,
  listAssignableUsers,
  listClubTeams,
  listPlayerReports,
  listReportsForTrip,
  listScoutingPlayers,
  listScoutingTrips,
  listTripTargets,
  listTripTargetsForPlayer,
  removeTripTarget
} from '../services/scouting/scoutingService';
import {
  createVideoClipForScoutingReport,
  deleteVideoClip,
  listVideoClipsByScoutingReportId
} from '../services/video/videoClipsService';
import { VideoClipsSection, EMPTY_CLIP_FORM, type ClipFormState, type ClipCategoryOption } from './VideoClipsSection';
import type {
  AssignableUser,
  ClubTeamOption,
  ScoutingPlayer,
  ScoutingPlayerReport,
  ScoutingPlayerStatus,
  ScoutingTrip,
  ScoutingTripStatus,
  ScoutingTripTarget,
  VideoClip
} from '../types';

type ScoutingSubTab = 'planning' | 'players' | 'reports' | 'comparison';

const NEW_CLUB_OPTION_VALUE = '__new__';

const PLAYER_STATUS_OPTIONS: Array<{ value: ScoutingPlayerStatus; label: string }> = [
  { value: 'shortlist', label: 'Shortlist' },
  { value: 'watching', label: 'Watching' },
  { value: 'discarded', label: 'Discarded' },
  { value: 'signed', label: 'Signed' }
];

const TRIP_STATUS_OPTIONS: Array<{ value: ScoutingTripStatus; label: string }> = [
  { value: 'planned', label: 'Planned' },
  { value: 'done', label: 'Done' },
  { value: 'cancelled', label: 'Cancelled' }
];

type PlayerFormState = {
  firstName: string;
  lastName: string;
  clubTeamId: string;
  newClubName: string;
  position: string;
  birthDate: string;
  nationality: string;
  status: ScoutingPlayerStatus;
};

const EMPTY_PLAYER_FORM: PlayerFormState = {
  firstName: '',
  lastName: '',
  clubTeamId: '',
  newClubName: '',
  position: '',
  birthDate: '',
  nationality: '',
  status: 'shortlist'
};

type TripFormState = {
  matchDate: string;
  homeTeamId: string;
  newHomeClubName: string;
  awayTeamId: string;
  newAwayClubName: string;
  competition: string;
  assignedTo: string;
  status: ScoutingTripStatus;
  notes: string;
};

function emptyTripForm(): TripFormState {
  return {
    matchDate: new Date().toISOString().slice(0, 10),
    homeTeamId: '',
    newHomeClubName: '',
    awayTeamId: '',
    newAwayClubName: '',
    competition: '',
    assignedTo: '',
    status: 'planned',
    notes: ''
  };
}

const RATING_OPTIONS = [1, 2, 3, 4, 5];

const SCOUTING_CLIP_CATEGORIES: ClipCategoryOption[] = [
  { value: 'technical', label: 'Technical' },
  { value: 'tactical', label: 'Tactical' },
  { value: 'physical', label: 'Physical' },
  { value: 'mental', label: 'Mental' },
  { value: 'strengths', label: 'Strengths' },
  { value: 'weaknesses', label: 'Weaknesses' }
];

type ReportFormState = {
  tripId: string;
  technicalRating: string;
  tacticalRating: string;
  physicalRating: string;
  mentalRating: string;
  notes: string;
};

const EMPTY_REPORT_FORM: ReportFormState = {
  tripId: '',
  technicalRating: '',
  tacticalRating: '',
  physicalRating: '',
  mentalRating: '',
  notes: ''
};

export const ScoutingSection: React.FC = () => {
  const [subTab, setSubTab] = useState<ScoutingSubTab>('planning');
  const [clubOptions, setClubOptions] = useState<ClubTeamOption[]>([]);
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);

  const [players, setPlayers] = useState<ScoutingPlayer[]>([]);
  const [isLoadingPlayers, setIsLoadingPlayers] = useState(false);
  const [playerStatusFilter, setPlayerStatusFilter] = useState<'all' | ScoutingPlayerStatus>('all');
  const [isPlayerFormOpen, setIsPlayerFormOpen] = useState(false);
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [playerForm, setPlayerForm] = useState<PlayerFormState>(EMPTY_PLAYER_FORM);
  const [isSavingPlayer, setIsSavingPlayer] = useState(false);

  const [trips, setTrips] = useState<ScoutingTrip[]>([]);
  const [isLoadingTrips, setIsLoadingTrips] = useState(false);
  const [isTripFormOpen, setIsTripFormOpen] = useState(false);
  const [editingTripId, setEditingTripId] = useState<string | null>(null);
  const [tripForm, setTripForm] = useState<TripFormState>(emptyTripForm());
  const [isSavingTrip, setIsSavingTrip] = useState(false);
  const [expandedTripId, setExpandedTripId] = useState<string | null>(null);
  const [tripTargets, setTripTargets] = useState<ScoutingTripTarget[]>([]);
  const [isLoadingTripTargets, setIsLoadingTripTargets] = useState(false);
  const [newTargetPlayerId, setNewTargetPlayerId] = useState('');
  const [tripReportId, setTripReportId] = useState<string | null>(null);
  const [tripReportTargets, setTripReportTargets] = useState<ScoutingTripTarget[]>([]);
  const [tripReports, setTripReports] = useState<ScoutingPlayerReport[]>([]);
  const [isLoadingTripReport, setIsLoadingTripReport] = useState(false);

  const [selectedReportPlayerId, setSelectedReportPlayerId] = useState('');
  const [playerReports, setPlayerReports] = useState<ScoutingPlayerReport[]>([]);
  const [isLoadingReports, setIsLoadingReports] = useState(false);
  const [playerTripOptions, setPlayerTripOptions] = useState<ScoutingTrip[]>([]);
  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  const [reportForm, setReportForm] = useState<ReportFormState>(EMPTY_REPORT_FORM);
  const [isSavingReport, setIsSavingReport] = useState(false);
  const [reportClips, setReportClips] = useState<VideoClip[]>([]);
  const [isLoadingReportClips, setIsLoadingReportClips] = useState(false);
  const [isSavingReportClip, setIsSavingReportClip] = useState(false);
  const [reportClipForm, setReportClipForm] = useState<ClipFormState>(EMPTY_CLIP_FORM);

  const loadPlayers = async () => {
    try {
      setIsLoadingPlayers(true);
      setPlayers(await listScoutingPlayers());
    } catch (error) {
      console.error('[ScoutingSection] Failed loading scouting players', error);
      setPlayers([]);
    } finally {
      setIsLoadingPlayers(false);
    }
  };

  const loadTrips = async () => {
    try {
      setIsLoadingTrips(true);
      setTrips(await listScoutingTrips());
    } catch (error) {
      console.error('[ScoutingSection] Failed loading scouting trips', error);
      setTrips([]);
    } finally {
      setIsLoadingTrips(false);
    }
  };

  useEffect(() => {
    void listClubTeams()
      .then(setClubOptions)
      .catch((error) => {
        console.error('[ScoutingSection] Failed loading club teams', error);
        setClubOptions([]);
      });
    void listAssignableUsers()
      .then(setAssignableUsers)
      .catch((error) => {
        console.error('[ScoutingSection] Failed loading assignable users', error);
        setAssignableUsers([]);
      });
    void loadPlayers();
    void loadTrips();
  }, []);

  useEffect(() => {
    if (!expandedTripId) {
      setTripTargets([]);
      return;
    }

    void (async () => {
      try {
        setIsLoadingTripTargets(true);
        setTripTargets(await listTripTargets(expandedTripId));
      } catch (error) {
        console.error('[ScoutingSection] Failed loading trip targets', error);
        setTripTargets([]);
      } finally {
        setIsLoadingTripTargets(false);
      }
    })();
  }, [expandedTripId]);

  useEffect(() => {
    if (!tripReportId) {
      setTripReportTargets([]);
      setTripReports([]);
      return;
    }

    void (async () => {
      try {
        setIsLoadingTripReport(true);
        const [targets, reports] = await Promise.all([
          listTripTargets(tripReportId),
          listReportsForTrip(tripReportId)
        ]);
        setTripReportTargets(targets);
        setTripReports(reports);
      } catch (error) {
        console.error('[ScoutingSection] Failed loading trip report', error);
        setTripReportTargets([]);
        setTripReports([]);
      } finally {
        setIsLoadingTripReport(false);
      }
    })();
  }, [tripReportId]);

  useEffect(() => {
    if (!selectedReportPlayerId) {
      setPlayerReports([]);
      setPlayerTripOptions([]);
      return;
    }

    void (async () => {
      try {
        setIsLoadingReports(true);
        const [reports, targets] = await Promise.all([
          listPlayerReports(selectedReportPlayerId),
          listTripTargetsForPlayer(selectedReportPlayerId)
        ]);
        setPlayerReports(reports);
        const tripIds = new Set(targets.map((target) => target.tripId));
        setPlayerTripOptions(trips.filter((trip) => tripIds.has(trip.id)));
      } catch (error) {
        console.error('[ScoutingSection] Failed loading player reports', error);
        setPlayerReports([]);
        setPlayerTripOptions([]);
      } finally {
        setIsLoadingReports(false);
      }
    })();
  }, [selectedReportPlayerId, trips]);

  useEffect(() => {
    if (!editingReportId) {
      setReportClips([]);
      return;
    }

    void (async () => {
      try {
        setIsLoadingReportClips(true);
        setReportClips(await listVideoClipsByScoutingReportId(editingReportId));
      } catch (error) {
        console.error('[ScoutingSection] Failed loading report clips', error);
        setReportClips([]);
      } finally {
        setIsLoadingReportClips(false);
      }
    })();
  }, [editingReportId]);

  const filteredPlayers = playerStatusFilter === 'all'
    ? players
    : players.filter((player) => player.status === playerStatusFilter);

  const handleOpenNewPlayer = () => {
    setEditingPlayerId(null);
    setPlayerForm(EMPTY_PLAYER_FORM);
    setIsPlayerFormOpen(true);
  };

  const handleOpenEditPlayer = (player: ScoutingPlayer) => {
    setEditingPlayerId(player.id);
    setPlayerForm({
      firstName: player.firstName,
      lastName: player.lastName,
      clubTeamId: player.clubTeamId ?? '',
      newClubName: '',
      position: player.position ?? '',
      birthDate: player.birthDate ?? '',
      nationality: player.nationality ?? '',
      status: player.status
    });
    setIsPlayerFormOpen(true);
  };

  const handleSavePlayer = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!playerForm.firstName.trim() || !playerForm.lastName.trim()) return;

    try {
      setIsSavingPlayer(true);
      let clubTeamId: string | null = playerForm.clubTeamId || null;
      if (clubTeamId === NEW_CLUB_OPTION_VALUE) {
        if (!playerForm.newClubName.trim()) return;
        clubTeamId = await ensureClubTeam(playerForm.newClubName.trim());
        setClubOptions(await listClubTeams());
      }

      await createOrUpdateScoutingPlayer({
        id: editingPlayerId ?? undefined,
        firstName: playerForm.firstName.trim(),
        lastName: playerForm.lastName.trim(),
        clubTeamId,
        position: playerForm.position.trim() || null,
        birthDate: playerForm.birthDate || null,
        nationality: playerForm.nationality.trim() || null,
        status: playerForm.status
      });
      setIsPlayerFormOpen(false);
      await loadPlayers();
    } catch (error) {
      console.error('[ScoutingSection] Failed saving scouting player', error);
    } finally {
      setIsSavingPlayer(false);
    }
  };

  const handleDeletePlayer = async (playerId: string) => {
    if (!confirm('Delete this scouted player?')) return;
    try {
      await deleteScoutingPlayer(playerId);
      await loadPlayers();
    } catch (error) {
      console.error('[ScoutingSection] Failed deleting scouting player', error);
    }
  };

  const handleOpenNewTrip = () => {
    setEditingTripId(null);
    setTripForm(emptyTripForm());
    setIsTripFormOpen(true);
  };

  const handleOpenEditTrip = (trip: ScoutingTrip) => {
    setEditingTripId(trip.id);
    setTripForm({
      matchDate: trip.matchDate,
      homeTeamId: trip.homeTeamId ?? '',
      newHomeClubName: '',
      awayTeamId: trip.awayTeamId ?? '',
      newAwayClubName: '',
      competition: trip.competition,
      assignedTo: trip.assignedTo ?? '',
      status: trip.status,
      notes: trip.notes
    });
    setIsTripFormOpen(true);
  };

  const handleSaveTrip = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!tripForm.matchDate) return;

    try {
      setIsSavingTrip(true);
      let homeTeamId: string | null = tripForm.homeTeamId || null;
      if (homeTeamId === NEW_CLUB_OPTION_VALUE) {
        if (!tripForm.newHomeClubName.trim()) return;
        homeTeamId = await ensureClubTeam(tripForm.newHomeClubName.trim());
      }

      let awayTeamId: string | null = tripForm.awayTeamId || null;
      if (awayTeamId === NEW_CLUB_OPTION_VALUE) {
        if (!tripForm.newAwayClubName.trim()) return;
        awayTeamId = await ensureClubTeam(tripForm.newAwayClubName.trim());
      }

      if (homeTeamId || awayTeamId) setClubOptions(await listClubTeams());

      await createOrUpdateScoutingTrip({
        id: editingTripId ?? undefined,
        matchDate: tripForm.matchDate,
        homeTeamId,
        awayTeamId,
        competition: tripForm.competition.trim(),
        assignedTo: tripForm.assignedTo || null,
        status: tripForm.status,
        notes: tripForm.notes.trim()
      });
      setIsTripFormOpen(false);
      await loadTrips();
    } catch (error) {
      console.error('[ScoutingSection] Failed saving scouting trip', error);
    } finally {
      setIsSavingTrip(false);
    }
  };

  const handleDeleteTrip = async (tripId: string) => {
    if (!confirm('Delete this scouting trip?')) return;
    try {
      await deleteScoutingTrip(tripId);
      if (expandedTripId === tripId) setExpandedTripId(null);
      await loadTrips();
    } catch (error) {
      console.error('[ScoutingSection] Failed deleting scouting trip', error);
    }
  };

  const handleAddTarget = async () => {
    if (!expandedTripId || !newTargetPlayerId) return;
    try {
      const created = await addTripTarget(expandedTripId, newTargetPlayerId);
      setTripTargets((prev) => [...prev, created]);
      setNewTargetPlayerId('');
    } catch (error) {
      console.error('[ScoutingSection] Failed adding trip target', error);
    }
  };

  const handleRemoveTarget = async (targetId: string) => {
    try {
      await removeTripTarget(targetId);
      setTripTargets((prev) => prev.filter((target) => target.id !== targetId));
    } catch (error) {
      console.error('[ScoutingSection] Failed removing trip target', error);
    }
  };

  const handleOpenPlayerReports = (playerId: string) => {
    setSelectedReportPlayerId(playerId);
    setEditingReportId(null);
    setReportForm(EMPTY_REPORT_FORM);
    setSubTab('reports');
  };

  const handleNewReport = () => {
    setEditingReportId(null);
    setReportForm(EMPTY_REPORT_FORM);
  };

  const handleEditReport = (report: ScoutingPlayerReport) => {
    setEditingReportId(report.id);
    setReportForm({
      tripId: report.tripId ?? '',
      technicalRating: report.technicalRating != null ? String(report.technicalRating) : '',
      tacticalRating: report.tacticalRating != null ? String(report.tacticalRating) : '',
      physicalRating: report.physicalRating != null ? String(report.physicalRating) : '',
      mentalRating: report.mentalRating != null ? String(report.mentalRating) : '',
      notes: report.notes
    });
  };

  const handleSaveReport = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedReportPlayerId) return;

    try {
      setIsSavingReport(true);
      const saved = await createOrUpdatePlayerReport({
        id: editingReportId ?? undefined,
        playerId: selectedReportPlayerId,
        tripId: reportForm.tripId || null,
        technicalRating: reportForm.technicalRating ? Number(reportForm.technicalRating) : null,
        tacticalRating: reportForm.tacticalRating ? Number(reportForm.tacticalRating) : null,
        physicalRating: reportForm.physicalRating ? Number(reportForm.physicalRating) : null,
        mentalRating: reportForm.mentalRating ? Number(reportForm.mentalRating) : null,
        notes: reportForm.notes.trim()
      });
      setEditingReportId(saved.id);
      setPlayerReports(await listPlayerReports(selectedReportPlayerId));
    } catch (error) {
      console.error('[ScoutingSection] Failed saving player report', error);
    } finally {
      setIsSavingReport(false);
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    if (!confirm('Delete this report?')) return;
    try {
      await deletePlayerReport(reportId);
      if (editingReportId === reportId) handleNewReport();
      setPlayerReports((prev) => prev.filter((report) => report.id !== reportId));
    } catch (error) {
      console.error('[ScoutingSection] Failed deleting player report', error);
    }
  };

  const handleAddReportClip = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingReportId || !reportClipForm.videoUrl.trim() || !reportClipForm.title.trim()) return;

    try {
      setIsSavingReportClip(true);
      const created = await createVideoClipForScoutingReport(editingReportId, {
        videoUrl: reportClipForm.videoUrl.trim(),
        startTime: Number(reportClipForm.startTime) || 0,
        endTime: reportClipForm.endTime.trim() ? Number(reportClipForm.endTime) : null,
        title: reportClipForm.title.trim(),
        notes: reportClipForm.notes.trim() || null,
        category: reportClipForm.category || null
      });
      setReportClips((prev) => [...prev, created].sort((a, b) => a.startTime - b.startTime));
      setReportClipForm(EMPTY_CLIP_FORM);
    } catch (error) {
      console.error('[ScoutingSection] Failed creating report clip', error);
    } finally {
      setIsSavingReportClip(false);
    }
  };

  const handleDeleteReportClip = async (clipId: string) => {
    try {
      await deleteVideoClip(clipId);
      setReportClips((prev) => prev.filter((clip) => clip.id !== clipId));
    } catch (error) {
      console.error('[ScoutingSection] Failed deleting report clip', error);
    }
  };

  function renderClubSelect(
    value: string,
    newValue: string,
    onChange: (value: string) => void,
    onNewChange: (value: string) => void,
    placeholder: string
  ) {
    return (
      <div className="space-y-2">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-sky-500"
        >
          <option value="">{placeholder}</option>
          {clubOptions.map((club) => (
            <option key={club.id} value={club.id}>{club.name}</option>
          ))}
          <option value={NEW_CLUB_OPTION_VALUE}>+ Create new club...</option>
        </select>
        {value === NEW_CLUB_OPTION_VALUE && (
          <input
            required
            value={newValue}
            onChange={(event) => onNewChange(event.target.value)}
            placeholder="New club name"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-sky-500"
          />
        )}
      </div>
    );
  }

  function renderPlayersTab() {
    return (
      <div className="space-y-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex flex-wrap items-center gap-2">
              {(['all', ...PLAYER_STATUS_OPTIONS.map((option) => option.value)] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setPlayerStatusFilter(status)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-bold transition-all ${
                    playerStatusFilter === status
                      ? 'bg-[#002142] text-white border-[#002142]'
                      : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                  }`}
                >
                  {status === 'all' ? 'All' : PLAYER_STATUS_OPTIONS.find((option) => option.value === status)?.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={handleOpenNewPlayer}
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-3 py-2 text-xs font-bold text-white hover:bg-cyan-500"
            >
              <Plus className="w-3.5 h-3.5" />
              New Player
            </button>
          </div>

          {isLoadingPlayers ? (
            <p className="py-8 text-center text-sm text-slate-400">Loading scouted players...</p>
          ) : filteredPlayers.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">No scouted players found.</p>
          ) : (
            <div className="space-y-2">
              {filteredPlayers.map((player) => (
                <div key={player.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-900">{player.firstName} {player.lastName}</p>
                    <p className="text-xs text-slate-500">
                      {[player.position, player.clubName, player.nationality].filter(Boolean).join(' · ') || 'No details yet'}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="rounded-full bg-slate-200 px-2.5 py-1 text-[10px] font-black uppercase text-slate-600">
                      {PLAYER_STATUS_OPTIONS.find((option) => option.value === player.status)?.label}
                    </span>
                    <button type="button" onClick={() => handleOpenPlayerReports(player.id)} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-300">
                      <ClipboardList className="w-3.5 h-3.5" />
                      Reports
                    </button>
                    <button type="button" onClick={() => handleOpenEditPlayer(player)} className="p-1.5 text-slate-500 hover:bg-slate-200 rounded-lg">
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => void handleDeletePlayer(player.id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {isPlayerFormOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
            <form onSubmit={(event) => void handleSavePlayer(event)} className="w-full max-w-lg space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-black text-slate-900">{editingPlayerId ? 'Edit Player' : 'New Scouted Player'}</h3>
                <button type="button" onClick={() => setIsPlayerFormOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <input required value={playerForm.firstName} onChange={(event) => setPlayerForm({ ...playerForm, firstName: event.target.value })} placeholder="First name" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-sky-500" />
                <input required value={playerForm.lastName} onChange={(event) => setPlayerForm({ ...playerForm, lastName: event.target.value })} placeholder="Last name" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-sky-500" />
              </div>

              {renderClubSelect(
                playerForm.clubTeamId,
                playerForm.newClubName,
                (value) => setPlayerForm({ ...playerForm, clubTeamId: value }),
                (value) => setPlayerForm({ ...playerForm, newClubName: value }),
                'Current club (optional)'
              )}

              <div className="grid grid-cols-2 gap-3">
                <input value={playerForm.position} onChange={(event) => setPlayerForm({ ...playerForm, position: event.target.value })} placeholder="Position" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-sky-500" />
                <input value={playerForm.nationality} onChange={(event) => setPlayerForm({ ...playerForm, nationality: event.target.value })} placeholder="Nationality" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-sky-500" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <input type="date" value={playerForm.birthDate} onChange={(event) => setPlayerForm({ ...playerForm, birthDate: event.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-sky-500" />
                <select value={playerForm.status} onChange={(event) => setPlayerForm({ ...playerForm, status: event.target.value as ScoutingPlayerStatus })} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-sky-500">
                  {PLAYER_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <button type="submit" disabled={isSavingPlayer} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 px-3 py-2.5 text-xs font-bold text-white hover:bg-cyan-500 disabled:opacity-60">
                <Save className="w-3.5 h-3.5" />
                Save Player
              </button>
            </form>
          </div>
        )}
      </div>
    );
  }

  function renderPlanningTab() {
    return (
      <div className="space-y-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-black text-slate-900">Scouting Trips</h3>
            <button
              type="button"
              onClick={handleOpenNewTrip}
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-3 py-2 text-xs font-bold text-white hover:bg-cyan-500"
            >
              <Plus className="w-3.5 h-3.5" />
              New Trip
            </button>
          </div>

          {isLoadingTrips ? (
            <p className="py-8 text-center text-sm text-slate-400">Loading scouting trips...</p>
          ) : trips.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">No scouting trips planned yet.</p>
          ) : (
            <div className="space-y-3">
              {trips.map((trip) => {
                const isExpanded = expandedTripId === trip.id;
                const matchup = trip.homeTeamName || trip.awayTeamName
                  ? `${trip.homeTeamName || 'TBD'} vs ${trip.awayTeamName || 'TBD'}`
                  : trip.competition || 'Fixture TBD';
                return (
                  <div key={trip.id} className="rounded-xl border border-slate-200 bg-slate-50">
                    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900">{matchup}</p>
                        <p className="text-xs text-slate-500">
                          {trip.matchDate}{trip.competition ? ` · ${trip.competition}` : ''}{trip.assignedToEmail ? ` · ${trip.assignedToEmail}` : ''}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="rounded-full bg-slate-200 px-2.5 py-1 text-[10px] font-black uppercase text-slate-600">
                          {TRIP_STATUS_OPTIONS.find((option) => option.value === trip.status)?.label}
                        </span>
                        <button
                          type="button"
                          onClick={() => setExpandedTripId(isExpanded ? null : trip.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-300"
                        >
                          <Users className="w-3.5 h-3.5" />
                          Targets
                        </button>
                        <button
                          type="button"
                          onClick={() => setTripReportId(tripReportId === trip.id ? null : trip.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-300"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          Trip Report
                        </button>
                        <button type="button" onClick={() => handleOpenEditTrip(trip)} className="p-1.5 text-slate-500 hover:bg-slate-200 rounded-lg">
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={() => void handleDeleteTrip(trip.id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {tripReportId === trip.id && (
                      <div className="border-t border-slate-200 p-4 space-y-2">
                        {isLoadingTripReport ? (
                          <p className="text-xs text-slate-400">Loading trip report...</p>
                        ) : tripReportTargets.length === 0 ? (
                          <p className="text-xs text-slate-400">No target players added to this trip yet.</p>
                        ) : (
                          tripReportTargets.map((target) => {
                            const player = players.find((candidate) => candidate.id === target.playerId);
                            const reportsForPlayer = tripReports.filter((report) => report.playerId === target.playerId);
                            const latestReport = reportsForPlayer[0] ?? null;
                            const ratings = latestReport
                              ? [latestReport.technicalRating, latestReport.tacticalRating, latestReport.physicalRating, latestReport.mentalRating].filter(
                                  (value): value is number => typeof value === 'number'
                                )
                              : [];
                            const averageRating = ratings.length > 0 ? (ratings.reduce((sum, value) => sum + value, 0) / ratings.length).toFixed(1) : null;
                            const firstNoteLine = latestReport?.notes?.split('\n').find((line) => line.trim().length > 0) ?? '';
                            return (
                              <div key={target.id} className="rounded-lg bg-white px-3 py-2 border border-slate-200">
                                <p className="text-xs font-bold text-slate-800">
                                  {player ? `${player.firstName} ${player.lastName}` : 'Unknown player'}
                                </p>
                                {latestReport ? (
                                  <p className="text-xs text-slate-500">
                                    {averageRating ? `Avg rating: ${averageRating}` : 'No ratings'}
                                    {firstNoteLine ? ` · ${firstNoteLine}` : ''}
                                  </p>
                                ) : (
                                  <p className="text-xs text-slate-400">Not yet reported</p>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}

                    {isExpanded && (
                      <div className="border-t border-slate-200 p-4 space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            value={newTargetPlayerId}
                            onChange={(event) => setNewTargetPlayerId(event.target.value)}
                            className="flex-1 min-w-[200px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-sky-500"
                          >
                            <option value="">Select a scouted player to add...</option>
                            {players
                              .filter((player) => !tripTargets.some((target) => target.playerId === player.id))
                              .map((player) => (
                                <option key={player.id} value={player.id}>{player.firstName} {player.lastName}</option>
                              ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => void handleAddTarget()}
                            disabled={!newTargetPlayerId}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-3 py-2 text-xs font-bold text-white hover:bg-sky-500 disabled:opacity-60"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Add
                          </button>
                        </div>

                        {isLoadingTripTargets ? (
                          <p className="text-xs text-slate-400">Loading targets...</p>
                        ) : tripTargets.length === 0 ? (
                          <p className="text-xs text-slate-400">No target players added yet.</p>
                        ) : (
                          <div className="space-y-1.5">
                            {tripTargets.map((target) => {
                              const player = players.find((candidate) => candidate.id === target.playerId);
                              return (
                                <div key={target.id} className="flex items-center justify-between rounded-lg bg-white px-3 py-1.5 border border-slate-200">
                                  <span className="text-xs font-bold text-slate-800">
                                    {player ? `${player.firstName} ${player.lastName}` : 'Unknown player'}
                                  </span>
                                  <button type="button" onClick={() => void handleRemoveTarget(target.id)} className="p-1 text-slate-400 hover:text-rose-600">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {isTripFormOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
            <form onSubmit={(event) => void handleSaveTrip(event)} className="w-full max-w-lg space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-black text-slate-900">{editingTripId ? 'Edit Scouting Trip' : 'New Scouting Trip'}</h3>
                <button type="button" onClick={() => setIsTripFormOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <input required type="date" value={tripForm.matchDate} onChange={(event) => setTripForm({ ...tripForm, matchDate: event.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-sky-500" />

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <span className="text-[10px] font-black uppercase text-slate-500">Home team</span>
                  {renderClubSelect(
                    tripForm.homeTeamId,
                    tripForm.newHomeClubName,
                    (value) => setTripForm({ ...tripForm, homeTeamId: value }),
                    (value) => setTripForm({ ...tripForm, newHomeClubName: value }),
                    'Home team (optional)'
                  )}
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-black uppercase text-slate-500">Away team</span>
                  {renderClubSelect(
                    tripForm.awayTeamId,
                    tripForm.newAwayClubName,
                    (value) => setTripForm({ ...tripForm, awayTeamId: value }),
                    (value) => setTripForm({ ...tripForm, newAwayClubName: value }),
                    'Away team (optional)'
                  )}
                </div>
              </div>

              <input value={tripForm.competition} onChange={(event) => setTripForm({ ...tripForm, competition: event.target.value })} placeholder="Competition / fixture notes" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-sky-500" />

              <div className="grid grid-cols-2 gap-3">
                <select value={tripForm.assignedTo} onChange={(event) => setTripForm({ ...tripForm, assignedTo: event.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-sky-500">
                  <option value="">Assigned to (optional)</option>
                  {assignableUsers.map((user) => (
                    <option key={user.userId} value={user.userId}>{user.displayName || user.email}</option>
                  ))}
                </select>
                <select value={tripForm.status} onChange={(event) => setTripForm({ ...tripForm, status: event.target.value as ScoutingTripStatus })} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-sky-500">
                  {TRIP_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <textarea value={tripForm.notes} onChange={(event) => setTripForm({ ...tripForm, notes: event.target.value })} placeholder="Notes (optional)" className="min-h-24 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-sky-500" />

              <button type="submit" disabled={isSavingTrip} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 px-3 py-2.5 text-xs font-bold text-white hover:bg-cyan-500 disabled:opacity-60">
                <Save className="w-3.5 h-3.5" />
                Save Trip
              </button>
            </form>
          </div>
        )}
      </div>
    );
  }

  function renderReportsTab() {
    const selectedPlayer = players.find((player) => player.id === selectedReportPlayerId) ?? null;

    return (
      <div className="space-y-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-black text-slate-900">Select Player</h3>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              {players.length} Scouted Players
            </span>
          </div>

          {players.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-sm">
              No scouted players yet. Add one in the Players tab first.
            </div>
          ) : (
            <select
              value={selectedReportPlayerId}
              onChange={(event) => {
                setSelectedReportPlayerId(event.target.value);
                setEditingReportId(null);
                setReportForm(EMPTY_REPORT_FORM);
              }}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:border-sky-500"
            >
              <option value="">Select a scouted player...</option>
              {players.map((player) => (
                <option key={player.id} value={player.id}>{player.firstName} {player.lastName}</option>
              ))}
            </select>
          )}
        </div>

        {!selectedReportPlayerId ? (
          <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center">
            <p className="text-sm text-slate-400">Select a player to view or create an observation report.</p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-black text-slate-900">
                  {editingReportId ? 'Edit Report' : 'New Report'}{selectedPlayer ? ` \u2013 ${selectedPlayer.firstName} ${selectedPlayer.lastName}` : ''}
                </h3>
                {editingReportId && (
                  <button type="button" onClick={handleNewReport} className="text-xs font-bold text-sky-600 hover:text-sky-700">
                    + New report instead
                  </button>
                )}
              </div>

              <form onSubmit={(event) => void handleSaveReport(event)} className="space-y-4">
                {playerTripOptions.length > 0 && (
                  <select
                    value={reportForm.tripId}
                    onChange={(event) => setReportForm({ ...reportForm, tripId: event.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-sky-500"
                  >
                    <option value="">Not linked to a scouting trip</option>
                    {playerTripOptions.map((trip) => (
                      <option key={trip.id} value={trip.id}>
                        {trip.matchDate} · {trip.homeTeamName || 'TBD'} vs {trip.awayTeamName || 'TBD'}
                      </option>
                    ))}
                  </select>
                )}

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {([
                    ['technicalRating', 'Technical'],
                    ['tacticalRating', 'Tactical'],
                    ['physicalRating', 'Physical'],
                    ['mentalRating', 'Mental']
                  ] as const).map(([field, label]) => (
                    <label key={field} className="space-y-1">
                      <span className="block text-[10px] font-black uppercase text-slate-500">{label}</span>
                      <select
                        value={reportForm[field]}
                        onChange={(event) => setReportForm({ ...reportForm, [field]: event.target.value })}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-xs font-medium text-slate-800 outline-none focus:border-sky-500"
                      >
                        <option value="">-</option>
                        {RATING_OPTIONS.map((value) => (
                          <option key={value} value={value}>{value}</option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>

                <textarea
                  value={reportForm.notes}
                  onChange={(event) => setReportForm({ ...reportForm, notes: event.target.value })}
                  placeholder="Observation notes..."
                  className="min-h-28 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-800 outline-none focus:border-sky-500"
                />

                <button type="submit" disabled={isSavingReport} className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-3 py-2 text-xs font-bold text-white hover:bg-cyan-500 disabled:opacity-60">
                  <Save className="w-3.5 h-3.5" />
                  {editingReportId ? 'Save Report' : 'Create Report'}
                </button>
              </form>
            </div>

            {editingReportId && (
              <VideoClipsSection
                analysisId={editingReportId}
                emptyAnalysisMessage="Save the report above before adding clips."
                clips={reportClips}
                isLoadingClips={isLoadingReportClips}
                isSavingClip={isSavingReportClip}
                form={reportClipForm}
                onFormChange={setReportClipForm}
                onSubmit={(event) => void handleAddReportClip(event)}
                onDelete={(clipId) => void handleDeleteReportClip(clipId)}
                categoryOptions={SCOUTING_CLIP_CATEGORIES}
              />
            )}

            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <h3 className="mb-4 text-base font-black text-slate-900">Report History</h3>
              {isLoadingReports ? (
                <p className="text-xs text-slate-400">Loading reports...</p>
              ) : playerReports.length === 0 ? (
                <p className="text-xs text-slate-400">No reports yet for this player.</p>
              ) : (
                <div className="space-y-2">
                  {playerReports.map((report) => (
                    <div key={report.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800">
                          T:{report.technicalRating ?? '-'} · Ta:{report.tacticalRating ?? '-'} · P:{report.physicalRating ?? '-'} · M:{report.mentalRating ?? '-'}
                        </p>
                        {report.notes && <p className="mt-0.5 truncate text-xs text-slate-500">{report.notes}</p>}
                        <p className="mt-0.5 text-[11px] text-slate-400">{report.createdAt ? new Date(report.createdAt).toLocaleDateString() : ''}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button type="button" onClick={() => handleEditReport(report)} className="p-1.5 text-slate-500 hover:bg-slate-200 rounded-lg">
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={() => void handleDeleteReport(report.id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  function renderComparisonTab() {
    return (
      <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center">
        <p className="text-sm font-bold text-slate-500">Comparison / Shortlist</p>
        <p className="mt-1 text-xs text-slate-400">Coming soon.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setSubTab('planning')}
          className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
            subTab === 'planning' ? 'bg-[#002142] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Planning
        </button>
        <button
          type="button"
          onClick={() => setSubTab('players')}
          className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
            subTab === 'players' ? 'bg-[#002142] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Players
        </button>
        <button
          type="button"
          onClick={() => setSubTab('reports')}
          className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
            subTab === 'reports' ? 'bg-[#002142] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Reports
        </button>
        <button
          type="button"
          onClick={() => setSubTab('comparison')}
          className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
            subTab === 'comparison' ? 'bg-[#002142] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Comparison
        </button>
      </div>

      {subTab === 'planning'
        ? renderPlanningTab()
        : subTab === 'players'
          ? renderPlayersTab()
          : subTab === 'reports'
            ? renderReportsTab()
            : renderComparisonTab()}
    </div>
  );
};
