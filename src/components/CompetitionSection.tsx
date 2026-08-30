import React, { useEffect, useState } from 'react';
import { 
  Trophy, 
  Calendar, 
  MapPin, 
  Plus, 
  CheckCircle2, 
  Trash2, 
  Edit2, 
  BarChart2,
  Users, 
  X,
  Swords
} from 'lucide-react';
import { TrainingSession, Match } from '../types';
import { MatchCentreSection } from './MatchCentreSection';
import { MatchCallUpSection } from './MatchCallUpSection';
import { TeamCrest } from './TeamCrest';
import { MatchEditModal } from './MatchEditModal';
import { readWorkspaceRestoreState, writeWorkspaceRestoreState } from '../utils/workspaceRestore';
import { useTeamContext } from '../contexts/TeamContext';
import {
  listMatches,
  createMatch,
  updateMatch,
  deleteMatch,
  calculateStandings,
  matchToDisplay,
  type StandingsEntry,
  type MatchWithScore
} from '../services/matches/matchService';

interface CompetitionSectionProps {
  session?: TrainingSession;
  squadRoster?: string[];
  fixtures?: Match[];
  onUpdateFixtures?: (fixtures: Match[]) => void;
  currentLogo?: string | null;
}

function formatMatchDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  const day = parsed.getDate();
  const month = parsed.toLocaleDateString('en-US', { month: 'short' });
  return `${day} ${month} ${parsed.getFullYear()}`;
}

export const CompetitionSection: React.FC<CompetitionSectionProps> = ({
  squadRoster = [],
  fixtures: fixturesProp,
  onUpdateFixtures,
  currentLogo
}) => {
  const { selectedTeamId } = useTeamContext();
  const [matches, setMatches] = useState<Match[]>([]);
  const [standings, setStandings] = useState<StandingsEntry[]>([]);
  const [isLoadingMatches, setIsLoadingMatches] = useState(false);
  const [matchLoadError, setMatchLoadError] = useState<string | null>(null);
  const [isLoadingStandings, setIsLoadingStandings] = useState(false);

  const contextStorageKey = 'competition_section';
  const restoredContext = readWorkspaceRestoreState(contextStorageKey, {
    activeTab: 'fixtures' as 'fixtures' | 'standings' | 'callup' | 'matches',
    filterStatus: 'ALL' as 'ALL' | 'Scheduled' | 'Played'
  });
  const [activeTab, setActiveTab] = useState<'fixtures' | 'standings' | 'callup' | 'matches'>(restoredContext.activeTab);
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'Scheduled' | 'Played'>(restoredContext.filterStatus);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);

  useEffect(() => {
    writeWorkspaceRestoreState(contextStorageKey, { activeTab, filterStatus });
  }, [activeTab, filterStatus]);

  useEffect(() => {
    if (!selectedTeamId) return;

    let active = true;
    void (async () => {
      try {
        setIsLoadingMatches(true);
        setMatchLoadError(null);
        const matchList = await listMatches(selectedTeamId);
        if (active) setMatches(matchList);
      } catch (error) {
        console.error('[CompetitionSection] Failed loading matches', error);
        if (active) {
          setMatchLoadError(error instanceof Error ? error.message : 'Unable to load matches from Supabase.');
        }
      } finally {
        if (active) setIsLoadingMatches(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [selectedTeamId]);

  useEffect(() => {
    if (!selectedTeamId || activeTab !== 'standings') return;

    void (async () => {
      try {
        setIsLoadingStandings(true);
        const standingsList = await calculateStandings(selectedTeamId, 'Saudi U17 Premier League');
        setStandings(standingsList);
      } catch (error) {
        console.error('[CompetitionSection] Failed loading standings', error);
        setStandings([]);
      } finally {
        setIsLoadingStandings(false);
      }
    })();
  }, [selectedTeamId, activeTab, matches]);

  // Match Edit / Add State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);

  // Score Modal State
  const [scoreModalMatch, setScoreModalMatch] = useState<Match | null>(null);
  const [ourScore, setOurScore] = useState<number>(0);
  const [opponentScore, setOpponentScore] = useState<number>(0);
  const [isSavingScore, setIsSavingScore] = useState(false);
  const [scoreSaveError, setScoreSaveError] = useState<string | null>(null);

  // Squad Callup State
  const [selectedCallup, setSelectedCallup] = useState<string[]>(() => squadRoster.slice(0, 18));

  const handleOpenAddModal = () => {
    setEditingMatch(null);
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (match: Match) => {
    setEditingMatch(match);
    setIsAddModalOpen(true);
  };

  const handleMatchSaved = (savedMatch: Match) => {
    setMatches((prev) => {
      const exists = prev.some((m) => m.id === savedMatch.id);
      if (exists) {
        return prev.map((m) => (m.id === savedMatch.id ? savedMatch : m));
      }
      return [savedMatch, ...prev];
    });
    setIsAddModalOpen(false);
  };

  const handleDeleteMatch = async (matchId: string) => {
    const matchToDelete = matches.find((m) => m.id === matchId);
    const opp = matchToDelete?.opponentName || 'este partido';
    if (!confirm(`¿Estás seguro de que deseas eliminar el partido contra "${opp}"?`)) return;

    try {
      await deleteMatch(matchId);
      setMatches((prev) => prev.filter((m) => m.id !== matchId));
      setIsAddModalOpen(false);
    } catch (error) {
      console.error('[CompetitionSection] Failed deleting match', error);
      alert('No se pudo eliminar el partido. Por favor, inténtalo de nuevo.');
    }
  };

  const handleSaveScore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scoreModalMatch || !selectedTeamId) return;

    try {
      setIsSavingScore(true);
      setScoreSaveError(null);
      await updateMatch(scoreModalMatch.id, {
        status: 'played',
        ourScore,
        opponentScore
      });

      const updated = await listMatches(selectedTeamId);
      setMatches(updated);
      setScoreModalMatch(null);
    } catch (error) {
      console.error('[CompetitionSection] Failed saving score', error);
      setScoreSaveError(error instanceof Error ? error.message : 'Failed to save match result. Please try again.');
    } finally {
      setIsSavingScore(false);
    }
  };

  const toggleCallupPlayer = (playerName: string) => {
    if (selectedCallup.includes(playerName)) {
      setSelectedCallup(selectedCallup.filter(p => p !== playerName));
    } else {
      if (selectedCallup.length >= 20) {
        alert('Maximum matchday call-up size reached (20 players).');
        return;
      }
      setSelectedCallup([...selectedCallup, playerName]);
    }
  };

  const filteredMatches = matches.filter(m => {
    if (filterStatus === 'ALL') return true;
    return m.status === (filterStatus === 'Scheduled' ? 'planned' : 'played');
  });

  const competitionName = matches.find((match) => match.competitionName.trim())?.competitionName || 'Competition';
  const seasonLabel = (() => {
    const years = matches
      .map((match) => Number(match.date.slice(0, 4)))
      .filter((year) => Number.isInteger(year))
      .sort((a, b) => a - b);
    const referenceDate = matches[0]?.date ? new Date(`${matches[0].date}T00:00:00`) : new Date();
    const startYear = years[0] ?? (referenceDate.getMonth() >= 6 ? referenceDate.getFullYear() : referenceDate.getFullYear() - 1);
    const endYear = years.at(-1) && years.at(-1)! > startYear ? years.at(-1)! : startYear + 1;
    return `${startYear}/${endYear}`;
  })();
  const today = new Date().toISOString().slice(0, 10);
  const nextUpcomingMatch = matches.find((match) => match.status === 'planned' && match.date >= today);
  const nextOpponentName = nextUpcomingMatch?.opponentName || 'Opponent';
  const nextHomeTeam = nextUpcomingMatch?.isHome
    ? { name: 'AlUla U17 Women', isAlula: true, logoUrl: null }
    : { name: nextOpponentName, isAlula: false, logoUrl: nextUpcomingMatch?.opponentLogoUrl };
  const nextAwayTeam = nextUpcomingMatch?.isHome
    ? { name: nextOpponentName, isAlula: false, logoUrl: nextUpcomingMatch?.opponentLogoUrl }
    : { name: 'AlUla U17 Women', isAlula: true, logoUrl: null };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      
      {/* Competition Banner Header */}
      <div className="bg-gradient-to-r from-[#002142] via-[#09355e] to-[#002142] rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-slate-700/50">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-amber-500/10 to-transparent pointer-events-none" />
        
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center p-3 shadow-inner">
              <Trophy className="w-10 h-10 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="bg-amber-400/20 text-amber-300 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border border-amber-400/30">
                  {competitionName}
                </span>
                <span className="text-slate-400 text-xs font-semibold">{seasonLabel} Season</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white font-display mt-1">
                Competition & Matches Hub
              </h1>
              <p className="text-xs text-slate-300 font-medium mt-1">
                Official fixture calendar, match prep, league standings & matchday squad call-ups.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleOpenAddModal}
            className="px-5 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-2xl transition-all shadow-lg shadow-emerald-500/20 flex items-center space-x-2 cursor-pointer active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Schedule New Match</span>
          </button>
        </div>

        {/* Sub Navigation Hub Tabs inside Competition */}
        <div className="flex items-center space-x-2 mt-6 pt-5 border-t border-slate-700/60 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('fixtures')}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center space-x-2 cursor-pointer ${
              activeTab === 'fixtures'
                ? 'bg-[#5ea4c5] text-slate-950 shadow-md shadow-[#5ea4c5]/20'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <Swords className="w-4 h-4" />
            <span>Fixtures & Results ({matches.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('matches')}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center space-x-2 cursor-pointer ${
              activeTab === 'matches'
                ? 'bg-[#5ea4c5] text-slate-950 shadow-md shadow-[#5ea4c5]/20'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <Trophy className="w-4 h-4" />
            <span>Matches ({matches.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('standings')}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center space-x-2 cursor-pointer ${
              activeTab === 'standings'
                ? 'bg-[#5ea4c5] text-slate-950 shadow-md shadow-[#5ea4c5]/20'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <BarChart2 className="w-4 h-4" />
            <span>League Table & Standings</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('callup')}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center space-x-2 cursor-pointer ${
              activeTab === 'callup'
                ? 'bg-[#5ea4c5] text-slate-950 shadow-md shadow-[#5ea4c5]/20'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Matchday Squad Call-Up ({selectedCallup.length})</span>
          </button>
        </div>
      </div>

      {/* Spotlight: Next Upcoming Fixture Banner */}
      {nextUpcomingMatch && (
        <div className="bg-white border-2 border-amber-400/60 rounded-3xl p-5 sm:p-6 shadow-md space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <h2 className="text-xs font-black text-slate-800 uppercase tracking-wider font-display">
                Next Upcoming Fixture Spotlight
              </h2>
            </div>
            <span className="text-[11px] font-extrabold text-amber-800 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
              Next Match
            </span>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between gap-6 py-2">
            <div className="flex items-center space-x-4 w-full md:w-1/3 justify-start md:justify-end">
              <span className="text-base sm:text-lg font-black text-[#002142] text-right">{nextHomeTeam.name}</span>
              <TeamCrest name={nextHomeTeam.name} logoUrl={nextHomeTeam.isAlula ? currentLogo : nextHomeTeam.logoUrl} isAlula={nextHomeTeam.isAlula} className="h-12 w-12 rounded-xl border border-slate-200 bg-slate-50 p-1 shadow-sm" />
            </div>

            {/* Match VS Badge / Time */}
            <div className="flex flex-col items-center justify-center bg-slate-50 border border-slate-200 rounded-2xl px-6 py-3 w-full md:w-auto shrink-0 shadow-inner">
              <span className="text-xs font-black text-emerald-700 uppercase tracking-widest">
                {nextUpcomingMatch.isHome ? 'Home' : 'Away'} MATCH
              </span>
              <div className="text-xl font-black text-[#002142] my-0.5">
                {nextUpcomingMatch.time}
              </div>
              <div className="flex items-center space-x-1.5 text-[11px] text-slate-500 font-bold">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>{formatMatchDate(nextUpcomingMatch.date)}</span>
              </div>
            </div>

            <div className="flex items-center space-x-4 w-full md:w-1/3 justify-start">
              <TeamCrest name={nextAwayTeam.name} logoUrl={nextAwayTeam.isAlula ? currentLogo : nextAwayTeam.logoUrl} isAlula={nextAwayTeam.isAlula} className="h-12 w-12 rounded-xl border border-slate-200 bg-slate-50 p-1 shadow-sm" />
              <span className="text-base sm:text-lg font-black text-slate-900">{nextAwayTeam.name}</span>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2">
            <div className="flex items-center space-x-2 text-slate-600 font-semibold">
              <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Venue: <strong className="text-slate-800">{nextUpcomingMatch.venue}</strong></span>
            </div>

            <button
              type="button"
              onClick={() => {
                setScoreModalMatch(nextUpcomingMatch);
                setOurScore(nextUpcomingMatch.ourScore ?? 0);
                setOpponentScore(nextUpcomingMatch.opponentScore ?? 0);
                setScoreSaveError(null);
              }}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer self-end sm:self-auto shadow-sm"
            >
              Log Match Result & Score
            </button>
          </div>
        </div>
      )}

      {/* Main Tab 1: Fixtures & Results List */}
      {activeTab === 'matches' && (
        <div className="space-y-5">
          <MatchCentreSection
            matches={matches}
            isLoadingMatches={isLoadingMatches}
            matchLoadError={matchLoadError}
            currentLogo={currentLogo}
          />
        </div>
      )}

      {activeTab === 'fixtures' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-5">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-black text-[#002142] font-display">
                Season Match Schedule & Results
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Log scores, view opposition notes and match details.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              {(['ALL', 'Scheduled', 'Played'] as const).map(st => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setFilterStatus(st)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-colors cursor-pointer ${
                    filterStatus === st 
                      ? 'bg-[#002142] text-white' 
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Fixture Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredMatches.map((match) => {
              const isPlayed = match.status === 'played';
              const m = matchToDisplay(match);

              return (
                <div 
                  key={match.id}
                  className="bg-white border border-slate-200 hover:border-slate-300 rounded-2xl p-5 shadow-sm space-y-3 transition-all relative group"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center space-x-2">
                      <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase border ${
                        isPlayed 
                          ? 'bg-slate-100 text-slate-700 border-slate-300' 
                          : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      }`}>
                        {m.status}
                      </span>
                      <span className="text-xs font-bold text-slate-500">{match.competitionName}</span>
                    </div>

                    <div className="flex items-center space-x-1 opacity-80 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(match)}
                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                        title="Edit Match"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteMatch(match.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Delete Match"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Match Teams Row */}
                  <div className="flex items-center justify-between py-1">
                    <div className="flex items-center space-x-2">
                      <TeamCrest name="Al Ula FC" logoUrl={currentLogo} isAlula className="h-8 w-8" />
                      <span className="text-sm font-extrabold text-[#002142]">Al Ula FC</span>
                    </div>

                    {isPlayed && m.ourGoals !== undefined && m.opponentGoals !== undefined ? (
                      <div className="px-3 py-1 bg-slate-900 text-amber-400 text-base font-black rounded-xl font-mono">
                        {m.ourGoals} - {m.opponentGoals}
                      </div>
                    ) : (
                      <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                        VS
                      </span>
                    )}

                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-extrabold text-slate-800">{m.opponent}</span>
                      <TeamCrest name={m.opponent} logoUrl={m.opponentLogoUrl} className="h-8 w-8 rounded-lg border border-slate-200 bg-slate-50 p-0.5" />
                    </div>
                  </div>

                  {/* Date & Location Info */}
                  <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100 font-medium">
                    <div className="flex items-center space-x-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{m.date} • {m.time}</span>
                    </div>
                    <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                      {m.location} ({m.competitionName})
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setScoreModalMatch(match);
                      setOurScore(match.ourScore ?? 0);
                      setOpponentScore(match.opponentScore ?? 0);
                      setScoreSaveError(null);
                    }}
                    className="w-full mt-2 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-colors flex items-center justify-center space-x-1 cursor-pointer"
                  >
                    <Trophy className="w-3.5 h-3.5 text-amber-500" />
                    <span>{isPlayed ? 'Edit Match Result' : 'Log Match Result'}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Tab 2: Standings Table */}
      {activeTab === 'standings' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-black text-[#002142] font-display">
                Saudi U17 Premier League Standings
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Official ranking table and recent form guide.
              </p>
            </div>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
              {standings.length > 0 && standings[0].isUs ? `${standings[0].rank}st Place • Champions Rank` : 'League Standings'}
            </span>
          </div>

          {isLoadingStandings ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              Loading standings...
            </div>
          ) : standings.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              No standings data available yet. Play matches to generate standings.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-semibold">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-3">#</th>
                    <th className="py-3 px-3">Club / Team</th>
                    <th className="py-3 px-2 text-center">P</th>
                    <th className="py-3 px-2 text-center">W</th>
                    <th className="py-3 px-2 text-center">D</th>
                    <th className="py-3 px-2 text-center">L</th>
                    <th className="py-3 px-2 text-center">GF</th>
                    <th className="py-3 px-2 text-center">GA</th>
                    <th className="py-3 px-2 text-center">GD</th>
                    <th className="py-3 px-3 text-center">PTS</th>
                    <th className="py-3 px-3 text-center">Form</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {standings.map((st) => (
                    <tr 
                      key={st.team}
                      className={`transition-colors ${
                        st.isUs ? 'bg-amber-50/80 font-black text-[#002142]' : 'hover:bg-slate-50/80 text-slate-700'
                      }`}
                    >
                      <td className="py-3 px-3 font-mono font-bold">{st.rank}</td>
                      <td className="py-3 px-3">
                        <div className="flex items-center space-x-2">
                          {st.isUs && <TeamCrest name="Al Ula FC" logoUrl={currentLogo} isAlula className="h-5 w-5" />}
                          <span className={st.isUs ? 'text-[#002142] font-extrabold' : 'text-slate-800'}>
                            {st.team}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-2 text-center font-mono">{st.played}</td>
                      <td className="py-3 px-2 text-center font-mono text-emerald-700 font-bold">{st.won}</td>
                      <td className="py-3 px-2 text-center font-mono text-slate-500">{st.drawn}</td>
                      <td className="py-3 px-2 text-center font-mono text-rose-600">{st.lost}</td>
                      <td className="py-3 px-2 text-center font-mono">{st.gf}</td>
                      <td className="py-3 px-2 text-center font-mono">{st.ga}</td>
                      <td className="py-3 px-2 text-center font-mono">{st.gf - st.ga > 0 ? `+${st.gf - st.ga}` : st.gf - st.ga}</td>
                      <td className="py-3 px-3 text-center font-mono font-black text-sm text-[#002142]">
                        {st.pts}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center justify-center space-x-1">
                          {st.form.map((f, i) => (
                            <span
                              key={i}
                              className={`w-4 h-4 rounded-full text-[9px] font-extrabold flex items-center justify-center text-white ${
                                f === 'W' ? 'bg-emerald-600' : f === 'D' ? 'bg-slate-400' : 'bg-rose-500'
                              }`}
                            >
                              {f}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Main Tab 3: Matchday Squad Call-Up List */}
      {activeTab === 'callup' && (
        <MatchCallUpSection
          matches={matches}
          selectedTeamId={selectedTeamId}
          currentLogo={currentLogo}
          onNavigateToTactics={() => setActiveTab('matches')}
        />
      )}

      {/* Add / Edit Match Modal */}
      <MatchEditModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        match={editingMatch}
        teamName={teamName}
        currentTeamId={selectedTeamId || undefined}
        onSave={handleMatchSaved}
        onDelete={handleDeleteMatch}
      />

      {/* Log Score Modal */}
      {scoreModalMatch && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-[#002142] font-display">
                Log Match Score
              </h3>
              <button
                type="button"
                onClick={() => setScoreModalMatch(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveScore} className="space-y-4 text-center">
              <div className="text-xs font-bold text-slate-500">
                Al Ula FC vs. {scoreModalMatch.opponentName || scoreModalMatch.opponentTeamId}
              </div>

              <div className="flex items-center justify-center space-x-4 py-2">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Al Ula FC</span>
                  <input
                    type="number"
                    min="0"
                    value={ourScore}
                    onChange={(e) => setOurScore(Number(e.target.value))}
                    className="w-16 h-14 bg-slate-100 border border-slate-300 rounded-2xl text-2xl font-black text-center text-[#002142]"
                  />
                </div>

                <span className="text-2xl font-black text-slate-300">-</span>

                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">{scoreModalMatch.opponentName || scoreModalMatch.opponentTeamId}</span>
                  <input
                    type="number"
                    min="0"
                    value={opponentScore}
                    onChange={(e) => setOpponentScore(Number(e.target.value))}
                    className="w-16 h-14 bg-slate-100 border border-slate-300 rounded-2xl text-2xl font-black text-center text-slate-800"
                  />
                </div>
              </div>

              {scoreSaveError && (
                <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-left text-xs font-medium text-rose-700">
                  {scoreSaveError}
                </div>
              )}

              <button
                type="submit"
                disabled={isSavingScore}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-300 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md"
              >
                {isSavingScore ? 'Saving...' : 'Save Match Result'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
