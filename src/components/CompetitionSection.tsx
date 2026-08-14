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
import { TrainingSession, MatchFixture } from '../types';
import { OFFICIAL_ALULA_LOGO_DATA_URL } from '../constants/logo';
import { MatchCentreSection } from './MatchCentreSection';
import { readWorkspaceRestoreState, writeWorkspaceRestoreState } from '../utils/workspaceRestore';

interface CompetitionSectionProps {
  session?: TrainingSession;
  squadRoster?: string[];
  fixtures?: MatchFixture[];
  onUpdateFixtures?: (fixtures: MatchFixture[]) => void;
}

export const DEFAULT_MATCHES: MatchFixture[] = [
  {
    id: 'match-1',
    opponent: 'Al Ittihad U17',
    opponentLogo: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&q=80&w=120',
    date: '2026-08-08',
    time: '18:30',
    location: 'Home',
    venue: 'Al Ula Sports Complex Stadium',
    competitionName: 'Saudi U17 Premier League',
    matchday: 'Matchday 14',
    status: 'Scheduled',
    tacticalNotes: 'Focus on high pressing in opponent build-up phase. Exploit wing space with fast transitions.'
  },
  {
    id: 'match-2',
    opponent: 'Al Ahli U17',
    opponentLogo: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&q=80&w=120',
    date: '2026-07-25',
    time: '19:00',
    location: 'Away',
    venue: 'King Abdullah Sports City - Field 2',
    competitionName: 'Saudi U17 Premier League',
    matchday: 'Matchday 13',
    status: 'Played',
    result: {
      ourGoals: 3,
      opponentGoals: 1
    },
    tacticalNotes: 'Dominant 2nd half performance. Excellent set-piece execution.'
  },
  {
    id: 'match-3',
    opponent: 'Al Hilal U17',
    opponentLogo: 'https://images.unsplash.com/photo-1518091043644-c1d4457512c6?auto=format&fit=crop&q=80&w=120',
    date: '2026-07-18',
    time: '18:00',
    location: 'Home',
    venue: 'Al Ula Sports Complex Stadium',
    competitionName: 'Saudi U17 Premier League',
    matchday: 'Matchday 12',
    status: 'Played',
    result: {
      ourGoals: 2,
      opponentGoals: 2
    },
    tacticalNotes: 'Solid defensive compactness after early red card. Counter-attack goals.'
  },
  {
    id: 'match-4',
    opponent: 'Al Nassr U17',
    date: '2026-08-15',
    time: '19:15',
    location: 'Away',
    venue: 'Al Nassr Academy Field',
    competitionName: 'Saudi U17 Premier League',
    matchday: 'Matchday 15',
    status: 'Scheduled',
    tacticalNotes: 'Direct opposition with high physical tempo.'
  }
];

const INITIAL_STANDINGS = [
  { rank: 1, team: 'Al Ula FC U17', played: 13, won: 10, drawn: 2, lost: 1, gf: 32, ga: 10, pts: 32, form: ['W', 'W', 'D', 'W', 'W'], isUs: true },
  { rank: 2, team: 'Al Hilal U17', played: 13, won: 9, drawn: 3, lost: 1, gf: 29, ga: 12, pts: 30, form: ['W', 'D', 'D', 'W', 'W'], isUs: false },
  { rank: 3, team: 'Al Ahli U17', played: 13, won: 8, drawn: 2, lost: 3, gf: 26, ga: 15, pts: 26, form: ['L', 'W', 'W', 'L', 'W'], isUs: false },
  { rank: 4, team: 'Al Ittihad U17', played: 13, won: 7, drawn: 3, lost: 3, gf: 24, ga: 16, pts: 24, form: ['W', 'L', 'W', 'D', 'W'], isUs: false },
  { rank: 5, team: 'Al Nassr U17', played: 13, won: 6, drawn: 3, lost: 4, gf: 21, ga: 18, pts: 21, form: ['D', 'W', 'L', 'W', 'L'], isUs: false },
  { rank: 6, team: 'Al Shabab U17', played: 13, won: 5, drawn: 2, lost: 6, gf: 18, ga: 20, pts: 17, form: ['L', 'L', 'W', 'D', 'L'], isUs: false }
];

export const CompetitionSection: React.FC<CompetitionSectionProps> = ({
  squadRoster = [],
  fixtures: fixturesProp,
  onUpdateFixtures
}) => {
  const [localFixtures, setLocalFixtures] = useState<MatchFixture[]>(() => {
    try {
      const stored = localStorage.getItem('u17_competition_fixtures');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      // fallback
    }
    return DEFAULT_MATCHES;
  });

  const fixtures = fixturesProp ?? localFixtures;

  const contextStorageKey = 'competition_section';
  const restoredContext = readWorkspaceRestoreState(contextStorageKey, {
    activeTab: 'fixtures' as 'fixtures' | 'standings' | 'callup' | 'matches',
    filterStatus: 'ALL' as 'ALL' | 'Scheduled' | 'Played'
  });
  const [activeTab, setActiveTab] = useState<'fixtures' | 'standings' | 'callup' | 'matches'>(restoredContext.activeTab);
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'Scheduled' | 'Played'>(restoredContext.filterStatus);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingFixture, setEditingFixture] = useState<MatchFixture | null>(null);

  useEffect(() => {
    writeWorkspaceRestoreState(contextStorageKey, { activeTab, filterStatus });
  }, [activeTab, filterStatus]);

  // Match Form State
  const [formData, setFormData] = useState<Partial<MatchFixture>>({
    opponent: '',
    competitionName: 'Saudi U17 Premier League',
    date: new Date().toISOString().split('T')[0],
    time: '18:30',
    location: 'Home',
    venue: 'Al Ula Sports Complex Stadium',
    matchday: `Matchday ${fixtures.length + 1}`,
    status: 'Scheduled',
    tacticalNotes: ''
  });

  // Score Modal State
  const [scoreModalMatch, setScoreModalMatch] = useState<MatchFixture | null>(null);
  const [ourScore, setOurScore] = useState<number>(0);
  const [opponentScore, setOpponentScore] = useState<number>(0);

  // Squad Callup State
  const [selectedCallup, setSelectedCallup] = useState<string[]>(() => squadRoster.slice(0, 18));

  const saveFixtures = (updated: MatchFixture[]) => {
    if (onUpdateFixtures) {
      onUpdateFixtures(updated);
    } else {
      setLocalFixtures(updated);
      try {
        localStorage.setItem('u17_competition_fixtures', JSON.stringify(updated));
      } catch (e) {
        // fallback
      }
    }
  };

  const handleOpenAddModal = () => {
    setEditingFixture(null);
    setFormData({
      opponent: '',
      competitionName: 'Saudi U17 Premier League',
      date: new Date().toISOString().split('T')[0],
      time: '18:30',
      location: 'Home',
      venue: 'Al Ula Sports Complex Stadium',
      matchday: `Matchday ${fixtures.length + 1}`,
      status: 'Scheduled',
      tacticalNotes: ''
    });
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (fix: MatchFixture) => {
    setEditingFixture(fix);
    setFormData(fix);
    setIsAddModalOpen(true);
  };

  const handleSaveFixture = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.opponent?.trim()) return;

    if (editingFixture) {
      const updated = fixtures.map(f => f.id === editingFixture.id ? { ...f, ...formData } as MatchFixture : f);
      saveFixtures(updated);
    } else {
      const newFix: MatchFixture = {
        id: `match-${Date.now()}`,
        opponent: formData.opponent.trim(),
        competitionName: formData.competitionName || 'U17 League',
        date: formData.date || new Date().toISOString().split('T')[0],
        time: formData.time || '18:30',
        location: formData.location || 'Home',
        venue: formData.venue || 'Stadium',
        matchday: formData.matchday || 'Matchday',
        status: formData.status || 'Scheduled',
        tacticalNotes: formData.tacticalNotes || ''
      };
      saveFixtures([newFix, ...fixtures]);
    }
    setIsAddModalOpen(false);
  };

  const handleDeleteFixture = (id: string) => {
    if (confirm('Delete this match fixture?')) {
      saveFixtures(fixtures.filter(f => f.id !== id));
    }
  };

  const handleSaveScore = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scoreModalMatch) return;
    const updated = fixtures.map(f => {
      if (f.id === scoreModalMatch.id) {
        return {
          ...f,
          status: 'Played' as const,
          result: {
            ourGoals: ourScore,
            opponentGoals: opponentScore
          }
        };
      }
      return f;
    });
    saveFixtures(updated);
    setScoreModalMatch(null);
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

  const filteredFixtures = fixtures.filter(f => {
    if (filterStatus === 'ALL') return true;
    return f.status === filterStatus;
  });

  const nextUpcomingMatch = fixtures.find(f => f.status === 'Scheduled');

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
                  Saudi U17 Premier League
                </span>
                <span className="text-slate-400 text-xs font-semibold">2025/2026 Season</span>
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
            <span>Fixtures & Results ({fixtures.length})</span>
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
            <span>Matches</span>
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
              {nextUpcomingMatch.matchday || 'Next Match'}
            </span>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between gap-6 py-2">
            {/* Our Team */}
            <div className="flex items-center space-x-4 w-full md:w-1/3 justify-start md:justify-end">
              <span className="text-base sm:text-lg font-black text-[#002142] text-right">
                Al Ula FC U17
              </span>
              <img 
                src={OFFICIAL_ALULA_LOGO_DATA_URL} 
                alt="Al Ula" 
                className="w-12 h-12 object-contain rounded-xl p-1 bg-slate-50 border border-slate-200 shadow-sm shrink-0" 
              />
            </div>

            {/* Match VS Badge / Time */}
            <div className="flex flex-col items-center justify-center bg-slate-50 border border-slate-200 rounded-2xl px-6 py-3 w-full md:w-auto shrink-0 shadow-inner">
              <span className="text-xs font-black text-emerald-700 uppercase tracking-widest">
                {nextUpcomingMatch.location} MATCH
              </span>
              <div className="text-xl font-black text-[#002142] my-0.5">
                {nextUpcomingMatch.time}
              </div>
              <div className="flex items-center space-x-1.5 text-[11px] text-slate-500 font-bold">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>{nextUpcomingMatch.date}</span>
              </div>
            </div>

            {/* Opponent */}
            <div className="flex items-center space-x-4 w-full md:w-1/3 justify-start">
              <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center font-black text-slate-700 text-sm shrink-0">
                {nextUpcomingMatch.opponent.substring(0, 3).toUpperCase()}
              </div>
              <span className="text-base sm:text-lg font-black text-slate-900">
                {nextUpcomingMatch.opponent}
              </span>
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
                setOurScore(0);
                setOpponentScore(0);
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
          <MatchCentreSection />
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
            {filteredFixtures.map((f) => {
              const isPlayed = f.status === 'Played';

              return (
                <div 
                  key={f.id}
                  className="bg-white border border-slate-200 hover:border-slate-300 rounded-2xl p-5 shadow-sm space-y-3 transition-all relative group"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center space-x-2">
                      <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase border ${
                        isPlayed 
                          ? 'bg-slate-100 text-slate-700 border-slate-300' 
                          : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      }`}>
                        {f.status}
                      </span>
                      <span className="text-xs font-bold text-slate-500">{f.matchday}</span>
                    </div>

                    <div className="flex items-center space-x-1 opacity-80 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(f)}
                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                        title="Edit Fixture"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteFixture(f.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Delete Fixture"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Match Teams Row */}
                  <div className="flex items-center justify-between py-1">
                    <div className="flex items-center space-x-2">
                      <img src={OFFICIAL_ALULA_LOGO_DATA_URL} alt="Al Ula" className="w-8 h-8 object-contain" />
                      <span className="text-sm font-extrabold text-[#002142]">Al Ula FC</span>
                    </div>

                    {isPlayed && f.result ? (
                      <div className="px-3 py-1 bg-slate-900 text-amber-400 text-base font-black rounded-xl font-mono">
                        {f.result.ourGoals} - {f.result.opponentGoals}
                      </div>
                    ) : (
                      <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                        VS
                      </span>
                    )}

                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-extrabold text-slate-800">{f.opponent}</span>
                      <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 font-black text-xs flex items-center justify-center border border-slate-200">
                        {f.opponent.substring(0, 2).toUpperCase()}
                      </div>
                    </div>
                  </div>

                  {/* Date & Location Info */}
                  <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100 font-medium">
                    <div className="flex items-center space-x-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{f.date} • {f.time}</span>
                    </div>
                    <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                      {f.location} ({f.competitionName})
                    </span>
                  </div>

                  {!isPlayed && (
                    <button
                      type="button"
                      onClick={() => {
                        setScoreModalMatch(f);
                        setOurScore(0);
                        setOpponentScore(0);
                      }}
                      className="w-full mt-2 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-colors flex items-center justify-center space-x-1 cursor-pointer"
                    >
                      <Trophy className="w-3.5 h-3.5 text-amber-500" />
                      <span>Log Match Result</span>
                    </button>
                  )}
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
              1st Place • Champions Rank
            </span>
          </div>

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
                {INITIAL_STANDINGS.map((st) => (
                  <tr 
                    key={st.team}
                    className={`transition-colors ${
                      st.isUs ? 'bg-amber-50/80 font-black text-[#002142]' : 'hover:bg-slate-50/80 text-slate-700'
                    }`}
                  >
                    <td className="py-3 px-3 font-mono font-bold">{st.rank}</td>
                    <td className="py-3 px-3">
                      <div className="flex items-center space-x-2">
                        {st.isUs && <img src={OFFICIAL_ALULA_LOGO_DATA_URL} alt="Al Ula" className="w-5 h-5 object-contain" />}
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
        </div>
      )}

      {/* Main Tab 3: Matchday Squad Call-Up List */}
      {activeTab === 'callup' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-black text-[#002142] font-display">
                Matchday Squad Call-Up Roster
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Select 18-20 players called up for the upcoming fixture.
              </p>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold px-3 py-1.5 rounded-xl flex items-center space-x-1.5">
              <Users className="w-4 h-4 text-emerald-600" />
              <span>{selectedCallup.length} Players Selected</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {squadRoster.map((player) => {
              const isSelected = selectedCallup.includes(player);

              return (
                <button
                  key={player}
                  type="button"
                  onClick={() => toggleCallupPlayer(player)}
                  className={`p-3 rounded-2xl border text-left transition-all flex items-center justify-between cursor-pointer select-none ${
                    isSelected
                      ? 'bg-emerald-50/80 border-emerald-400 text-emerald-950 shadow-sm'
                      : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center space-x-2.5 truncate">
                    <div className={`w-7 h-7 rounded-lg text-xs font-extrabold flex items-center justify-center ${
                      isSelected ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {player.substring(0, 2).toUpperCase()}
                    </div>
                    <span className="text-xs font-bold truncate">{player}</span>
                  </div>

                  {isSelected ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <Plus className="w-4 h-4 text-slate-400 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Add / Edit Fixture Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-slate-200 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-[#002142] font-display">
                {editingFixture ? 'Edit Fixture Details' : 'Schedule New Match'}
              </h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveFixture} className="space-y-3.5 text-xs font-medium text-slate-700">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  Opponent Club Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.opponent}
                  onChange={(e) => setFormData({ ...formData, opponent: e.target.value })}
                  placeholder="e.g. Al Hilal U17"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                    Time (Kickoff)
                  </label>
                  <input
                    type="text"
                    value={formData.time}
                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                    placeholder="18:30"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                    Location
                  </label>
                  <select
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                  >
                    <option value="Home">Home</option>
                    <option value="Away">Away</option>
                    <option value="Neutral">Neutral</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                    Matchday #
                  </label>
                  <input
                    type="text"
                    value={formData.matchday}
                    onChange={(e) => setFormData({ ...formData, matchday: e.target.value })}
                    placeholder="Matchday 14"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  Match Venue / Stadium
                </label>
                <input
                  type="text"
                  value={formData.venue}
                  onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                  placeholder="Al Ula Sports Complex Stadium"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-xl text-xs shadow-md"
                >
                  Save Fixture
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                Al Ula FC vs. {scoreModalMatch.opponent}
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
                  <span className="text-[10px] font-bold text-slate-400 uppercase">{scoreModalMatch.opponent}</span>
                  <input
                    type="number"
                    min="0"
                    value={opponentScore}
                    onChange={(e) => setOpponentScore(Number(e.target.value))}
                    className="w-16 h-14 bg-slate-100 border border-slate-300 rounded-2xl text-2xl font-black text-center text-slate-800"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md"
              >
                Save Final Result
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
