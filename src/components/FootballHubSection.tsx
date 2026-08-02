import React, { useEffect, useState } from 'react';
import { 
  FileText, 
  Calendar, 
  Trophy, 
  Layers, 
  Plus, 
  Search, 
  Filter, 
  ChevronDown, 
  Sparkles, 
  Check, 
  Edit3, 
  ArrowRight, 
  Clock, 
  Target,
  XCircle,
  FolderOpen,
  BookOpen,
  Trash2
} from 'lucide-react';
import { TrainingSession, Exercise, MatchFixture } from '../types';
import { CloudTrainingSession, deleteSessionCardFromCloud, saveSessionCardToCloud, subscribeToSessionCards } from '../firebase';
import { PlanificationSection } from './PlanificationSection';
import { CompetitionSection } from './CompetitionSection';
import { ExercisesLibrary } from './ExercisesLibrary';
import { CreateSessionCardModal } from './CreateSessionCardModal';

export interface DrillCard {
  id: string;
  sessionNumber: number;
  title: string;
  coachName?: string;
  coachAvatar?: string;
  date: string;
  category: 'Rondo' | 'Game' | 'Speed' | 'Build-Up' | 'Finishing' | 'Tactical';
  drillType?: 'rondo5v2' | 'game7v7' | 'speed3v0' | 'buildup4v3' | 'finishing2v1';
  likesCount: number;
  isBookmarked: boolean;
  groupCount: number;
  rating: string;
  isSelected?: boolean;
  status: 'active' | 'completed' | 'draft';
  duration?: string;
  intensity?: string;
  description?: string;
  exerciseData?: any;
  createdAt?: number;
  updatedAt?: number;
  role?: 'football' | 'fitness' | 'gk';
}

const DEFAULT_DRILL_CARDS: DrillCard[] = [
  {
    id: 'card-5',
    sessionNumber: 5,
    title: 'Circuito de Finalización 2v1 & Remate',
    coachName: 'Javi Valero',
    coachAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=150',
    date: '30 de julio de 2026',
    category: 'Finishing',
    drillType: 'finishing2v1',
    likesCount: 11,
    isBookmarked: false,
    groupCount: 6,
    rating: '4,9 (8)',
    status: 'completed',
    duration: '18 min',
    intensity: 'Alta Intensidad',
    description: 'Ataque rápido por bandas con desmarque de apoyo en 2v1 y disparo a puerta en transición veloz.'
  },
  {
    id: 'card-4',
    sessionNumber: 4,
    title: 'Salida de Balón 4v3 + Portero',
    coachName: 'Javi Valero',
    coachAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=150',
    date: '29 de julio de 2026',
    category: 'Build-Up',
    drillType: 'buildup4v3',
    likesCount: 15,
    isBookmarked: true,
    groupCount: 8,
    rating: '4,8 (5)',
    status: 'active',
    duration: '20 min',
    intensity: 'Medio-Alta',
    description: 'Iniciación desde línea defensiva superando presión alta rival buscando al pivote o lateral libre.'
  },
  {
    id: 'card-3',
    sessionNumber: 3,
    title: 'Speed 3 vs 0 Counterattack',
    coachName: 'Javi Valero',
    coachAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=150',
    date: '28 de julio de 2026',
    category: 'Speed',
    drillType: 'speed3v0',
    likesCount: 9,
    isBookmarked: false,
    groupCount: 6,
    rating: '4,5 (3)',
    status: 'completed',
    duration: '12 min',
    intensity: 'Explosiva',
    description: 'Sprint en combinación de 3 atacantes con pared directa y finalización con límite de tiempo.'
  },
  {
    id: 'card-2',
    sessionNumber: 2,
    title: 'Partido Aplicado 7 vs 7 Reducido',
    coachName: 'Javi Valero',
    coachAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=150',
    date: '27 de julio de 2026',
    category: 'Game',
    drillType: 'game7v7',
    likesCount: 18,
    isBookmarked: false,
    groupCount: 14,
    rating: '5,0 (12)',
    status: 'active',
    duration: '25 min',
    intensity: 'Máxima Competitiva',
    description: 'Juego de aplicación táctica en campo reducido con norma de gol triple tras pérdida en campo rival.'
  },
  {
    id: 'card-1',
    sessionNumber: 1,
    title: 'Rondo 5vs2 con cambio de orientación',
    coachName: 'Javi Valero',
    coachAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=150',
    date: '26 de julio de 2026',
    category: 'Rondo',
    drillType: 'rondo5v2',
    likesCount: 12,
    isBookmarked: true,
    groupCount: 7,
    rating: '4,7 (6)',
    status: 'active',
    duration: '15 min',
    intensity: 'Alta',
    description: 'Mantenimiento de posesión en cuadrantes conectados orientando el juego tras 4 pases consecutivos.'
  }
];

interface FootballHubSectionProps {
  session: TrainingSession;
  cloudSessions: CloudTrainingSession[];
  onChangeSession: (updatedSession: Partial<TrainingSession>) => void;
  renderActiveSessionEditor: () => React.ReactNode;
  squadRoster?: string[];
  fixtures?: MatchFixture[];
  onUpdateFixtures?: (fixtures: MatchFixture[]) => void;
  onAddExerciseToSession?: (
    blockKey: 'warmUp' | 'mainPart' | 'coolDown', 
    exercise: Exercise,
    targetSection?: 'football' | 'fitness' | 'gk'
  ) => void;
  onLoadCloudSession?: (sess: CloudTrainingSession) => void;
  onDeleteCloudSession?: (id: string, sessNum: string, e: React.MouseEvent) => void;
  onNewSession?: () => void;
  role?: 'football' | 'fitness' | 'gk';
}

export const FootballHubSection: React.FC<FootballHubSectionProps> = ({
  session,
  cloudSessions,
  onChangeSession,
  renderActiveSessionEditor,
  squadRoster = [],
  fixtures,
  onUpdateFixtures,
  onAddExerciseToSession,
  onLoadCloudSession,
  onDeleteCloudSession,
  onNewSession,
  role = 'football'
}) => {
  // Main Football Sub-tab Navigation: 'sessions' | 'planning' | 'competition' | 'library'
  const [footballSubTab, setFootballSubTab] = useState<'sessions' | 'planning' | 'competition' | 'library'>('sessions');

  // Sub-navigation inside 'sessions': 'cards' | 'editor'
  const [sessionSubNav, setSessionSubNav] = useState<'cards' | 'editor'>('cards');

  // Search term for filtering sessions
  const [searchTerm, setSearchTerm] = useState('');
  const [sessionCards, setSessionCards] = useState<DrillCard[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSavingCard, setIsSavingCard] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToSessionCards(role as 'football' | 'fitness' | 'gk', (cards) => {
      const mappedCards: DrillCard[] = cards
        .map((card) => ({
          id: card.id,
          sessionNumber: Number(card.sessionNumber || 0) || 0,
          title: card.title || 'Untitled session card',
          date: card.date || new Date().toLocaleDateString('en-CA'),
          category: (card.category as DrillCard['category']) || 'Tactical',
          description: card.description || 'No description',
          duration: card.duration || '20 min',
          intensity: card.intensity || 'Alta',
          drillType: 'rondo5v2',
          likesCount: 0,
          isBookmarked: false,
          groupCount: 0,
          rating: '—',
          status: 'draft' as const,
          createdAt: card.createdAt,
          updatedAt: card.updatedAt,
          role
        }))
        .filter((card) => card.sessionNumber > 0)
        .sort((a, b) => (b.sessionNumber || 0) - (a.sessionNumber || 0));

      setSessionCards(mappedCards);
    });

    return () => unsubscribe();
  }, []);

  const handleCreateSessionCard = async (payload: {
    title: string;
    description: string;
    category: string;
    duration: string;
    intensity: string;
    sessionNumber: string;
  }) => {
    setIsSavingCard(true);
    try {
      const id = `card-${Date.now()}`;
      const today = new Date().toISOString().split('T')[0];
      const cardData: { id: string; sessionNumber: number; title: string; date: string; category: DrillCard['category']; description: string; duration: string; intensity: string; createdAt: number; updatedAt: number; role: 'football' | 'fitness' | 'gk' } = {
        id,
        sessionNumber: Number(payload.sessionNumber || '1'),
        title: payload.title,
        date: today,
        category: ((payload.category as DrillCard['category']) || 'Tactical'),
        description: payload.description,
        duration: payload.duration,
        intensity: payload.intensity,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        role: role as 'football' | 'fitness' | 'gk'
      };

      await saveSessionCardToCloud(cardData);
      setSessionCards(prev => [{
        ...cardData,
        drillType: 'rondo5v2',
        likesCount: 0,
        isBookmarked: false,
        groupCount: 0,
        rating: '—',
        status: 'draft' as const,
        role
      }, ...prev]);
    } finally {
      setIsSavingCard(false);
    }
  };

  // Filter cloud sessions
  const filteredSessions = sessionCards
    .filter((sess) => {
      const search = searchTerm.toLowerCase();
      const matchesSearch =
        sess.title?.toLowerCase().includes(search) ||
        String(sess.sessionNumber).includes(search) ||
        `session #${sess.sessionNumber}`.toLowerCase().includes(search);
      return matchesSearch;
    })
    .sort((a, b) => {
      const dateA = a.date || '';
      const dateB = b.date || '';
      return dateB.localeCompare(dateA);
    });

  // Render tactical field SVG diagram matching card drill type
  const renderTacticalFieldSvg = (type: DrillCard['drillType']) => {
    if (type === 'rondo5v2') {
      return (
        <svg viewBox="0 0 400 260" className="w-full h-full object-cover">
          {/* Pitch background */}
          <rect width="400" height="260" fill="#4f9a2b" />
          
          {/* Main outer boundary */}
          <rect x="15" y="15" width="370" height="230" fill="none" stroke="#ffffff" strokeWidth="2" opacity="0.9" />
          
          {/* Two divided rondo boxes */}
          <rect x="50" y="45" width="140" height="170" fill="none" stroke="#000000" strokeWidth="2" />
          <rect x="210" y="45" width="140" height="170" fill="none" stroke="#000000" strokeWidth="2" />
          
          {/* Red players (Attackers / Outer) */}
          <circle cx="55" cy="130" r="9" fill="#dc2626" stroke="#000000" strokeWidth="2" />
          <circle cx="120" cy="50" r="9" fill="#dc2626" stroke="#000000" strokeWidth="2" />
          <circle cx="120" cy="210" r="9" fill="#dc2626" stroke="#000000" strokeWidth="2" />
          <circle cx="280" cy="50" r="9" fill="#dc2626" stroke="#000000" strokeWidth="2" />
          <circle cx="280" cy="210" r="9" fill="#dc2626" stroke="#000000" strokeWidth="2" />
          
          {/* Yellow defenders inside */}
          <circle cx="100" cy="120" r="9" fill="#eab308" stroke="#000000" strokeWidth="2" />
          <circle cx="140" cy="140" r="9" fill="#dc2626" stroke="#000000" strokeWidth="2" />
          <circle cx="250" cy="130" r="9" fill="#eab308" stroke="#000000" strokeWidth="2" />
          <circle cx="345" cy="130" r="9" fill="#dc2626" stroke="#000000" strokeWidth="2" />
          
          {/* Dashed passing arrows */}
          <path d="M 68 130 L 110 58" stroke="#000000" strokeWidth="2" strokeDasharray="4 3" markerEnd="url(#arrow)" />
          <path d="M 120 62 L 120 198" stroke="#000000" strokeWidth="2" strokeDasharray="4 3" />
          <path d="M 128 135 L 238 130" stroke="#000000" strokeWidth="2" strokeDasharray="4 3" />
          <path d="M 280 62 L 335 122" stroke="#000000" strokeWidth="2" strokeDasharray="4 3" />
          
          {/* Transition solid arrows */}
          <path d="M 132 50 L 268 50" stroke="#dc2626" strokeWidth="2.5" />
          <path d="M 132 210 L 268 210" stroke="#dc2626" strokeWidth="2.5" />
          <path d="M 152 130 L 198 130" stroke="#dc2626" strokeWidth="2.5" />
          
          {/* Ball */}
          <circle cx="75" cy="130" r="4" fill="#ffffff" stroke="#000000" strokeWidth="1" />
          <circle cx="330" cy="130" r="4" fill="#ffffff" stroke="#000000" strokeWidth="1" />
        </svg>
      );
    } else if (type === 'game7v7') {
      return (
        <svg viewBox="0 0 400 260" className="w-full h-full object-cover">
          {/* Pitch background */}
          <rect width="400" height="260" fill="#4f9a2b" />
          
          {/* White boundary & field lines */}
          <rect x="15" y="15" width="370" height="230" fill="none" stroke="#ffffff" strokeWidth="2" />
          <line x1="200" y1="15" x2="200" y2="245" stroke="#ffffff" strokeWidth="2" />
          <circle cx="200" cy="130" r="35" fill="none" stroke="#ffffff" strokeWidth="2" />
          <circle cx="200" cy="130" r="3" fill="#ffffff" />
          
          {/* Left Penalty Area */}
          <rect x="15" y="65" width="55" height="130" fill="none" stroke="#ffffff" strokeWidth="2" />
          <path d="M 70 100 A 30 30 0 0 1 70 160" fill="none" stroke="#ffffff" strokeWidth="2" />
          <rect x="5" y="100" width="10" height="60" fill="none" stroke="#000000" strokeWidth="3" />
          
          {/* Right Penalty Area */}
          <rect x="330" y="65" width="55" height="130" fill="none" stroke="#ffffff" strokeWidth="2" />
          <path d="M 330 100 A 30 30 0 0 0 330 160" fill="none" stroke="#ffffff" strokeWidth="2" />
          <rect x="385" y="100" width="10" height="60" fill="none" stroke="#000000" strokeWidth="3" />
          
          {/* Red 7 Players */}
          <circle cx="30" cy="130" r="8" fill="#000000" stroke="#ffffff" strokeWidth="2" />
          <circle cx="100" cy="60" r="8" fill="#dc2626" stroke="#ffffff" strokeWidth="2" />
          <circle cx="100" cy="200" r="8" fill="#dc2626" stroke="#ffffff" strokeWidth="2" />
          <circle cx="150" cy="100" r="8" fill="#dc2626" stroke="#ffffff" strokeWidth="2" />
          <circle cx="150" cy="160" r="8" fill="#dc2626" stroke="#ffffff" strokeWidth="2" />
          <circle cx="220" cy="80" r="8" fill="#dc2626" stroke="#ffffff" strokeWidth="2" />
          <circle cx="220" cy="180" r="8" fill="#dc2626" stroke="#ffffff" strokeWidth="2" />
          
          {/* Yellow 7 Players */}
          <circle cx="370" cy="130" r="8" fill="#000000" stroke="#ffffff" strokeWidth="2" />
          <circle cx="300" cy="70" r="8" fill="#eab308" stroke="#000000" strokeWidth="2" />
          <circle cx="300" cy="190" r="8" fill="#eab308" stroke="#000000" strokeWidth="2" />
          <circle cx="250" cy="110" r="8" fill="#eab308" stroke="#000000" strokeWidth="2" />
          <circle cx="250" cy="150" r="8" fill="#eab308" stroke="#000000" strokeWidth="2" />
          <circle cx="180" cy="90" r="8" fill="#eab308" stroke="#000000" strokeWidth="2" />
          <circle cx="180" cy="170" r="8" fill="#eab308" stroke="#000000" strokeWidth="2" />
          
          {/* Ball */}
          <circle cx="190" cy="125" r="4" fill="#ffffff" stroke="#000000" strokeWidth="1" />
        </svg>
      );
    } else if (type === 'speed3v0') {
      return (
        <svg viewBox="0 0 400 260" className="w-full h-full object-cover">
          {/* Pitch background */}
          <rect width="400" height="260" fill="#4f9a2b" />
          
          {/* White boundary lines */}
          <rect x="15" y="15" width="370" height="230" fill="none" stroke="#ffffff" strokeWidth="2" />
          
          {/* Left Penalty Box */}
          <rect x="15" y="65" width="60" height="130" fill="none" stroke="#ffffff" strokeWidth="2" />
          <rect x="5" y="100" width="10" height="60" fill="none" stroke="#000000" strokeWidth="3" />
          
          {/* Center Circle segment */}
          <path d="M 380 70 A 50 50 0 0 0 380 190" fill="none" stroke="#ffffff" strokeWidth="2" />
          <circle cx="380" cy="130" r="8" fill="#000000" stroke="#ffffff" strokeWidth="2" />
          
          {/* Yellow 3 players on right */}
          <circle cx="340" cy="65" r="8" fill="#eab308" stroke="#000000" strokeWidth="2" />
          <circle cx="340" cy="130" r="8" fill="#eab308" stroke="#000000" strokeWidth="2" />
          <circle cx="340" cy="195" r="8" fill="#eab308" stroke="#000000" strokeWidth="2" />
          
          {/* Sprint vectors */}
          <path d="M 330 65 L 120 30" stroke="#eab308" strokeWidth="2" strokeDasharray="5 3" />
          <path d="M 330 195 L 120 230" stroke="#eab308" strokeWidth="2" strokeDasharray="5 3" />
          <path d="M 330 130 L 80 110" stroke="#000000" strokeWidth="2.5" />
          
          {/* Shot arrow into goal */}
          <path d="M 80 110 L 15 130" stroke="#eab308" strokeWidth="2" strokeDasharray="4 3" />
          
          {/* Ball */}
          <circle cx="325" cy="130" r="4" fill="#ffffff" stroke="#000000" strokeWidth="1" />
        </svg>
      );
    } else {
      // Generic build-up or finishing pitch diagram
      return (
        <svg viewBox="0 0 400 260" className="w-full h-full object-cover">
          <rect width="400" height="260" fill="#4f9a2b" />
          <rect x="15" y="15" width="370" height="230" fill="none" stroke="#ffffff" strokeWidth="2" />
          <line x1="200" y1="15" x2="200" y2="245" stroke="#ffffff" strokeWidth="2" />
          <circle cx="200" cy="130" r="35" fill="none" stroke="#ffffff" strokeWidth="2" />
          <rect x="15" y="65" width="60" height="130" fill="none" stroke="#ffffff" strokeWidth="2" />
          <rect x="325" y="65" width="60" height="130" fill="none" stroke="#ffffff" strokeWidth="2" />
          
          {/* Red & Yellow players */}
          <circle cx="80" cy="80" r="8" fill="#dc2626" stroke="#ffffff" strokeWidth="2" />
          <circle cx="80" cy="180" r="8" fill="#dc2626" stroke="#ffffff" strokeWidth="2" />
          <circle cx="160" cy="130" r="8" fill="#dc2626" stroke="#ffffff" strokeWidth="2" />
          <circle cx="240" cy="100" r="8" fill="#eab308" stroke="#000000" strokeWidth="2" />
          <circle cx="240" cy="160" r="8" fill="#eab308" stroke="#000000" strokeWidth="2" />
          <path d="M 90 80 L 150 120" stroke="#ffffff" strokeWidth="2" strokeDasharray="4 3" />
          <circle cx="88" cy="80" r="4" fill="#ffffff" stroke="#000000" strokeWidth="1" />
        </svg>
      );
    }
  };

  const roleTitle = role === 'fitness'
    ? 'Fitness & Conditioning Hub'
    : role === 'gk'
      ? 'Goalkeeper Hub'
      : 'Football Management Hub';

  const roleSubtitle = role === 'fitness'
    ? 'Create and review conditioning blocks, physical themes, and training cards for the fitness department.'
    : role === 'gk'
      ? 'Create and review goalkeeper-specific cards, shot-stopping themes, and distribution drills.'
      : 'Select a module to view daily training sessions, planification microcycles, or match fixtures';

  const roleBadge = role === 'fitness'
    ? 'Fitness Department'
    : role === 'gk'
      ? 'GK Department'
      : 'Al Ula FC';

  return (
    <div className="space-y-6">
      
      {/* 1. ROLE MODULE NAVIGATION HUB (PORTALHUB CARDS STYLE) */}
      <div className="bg-[#002142] p-5 sm:p-6 rounded-3xl shadow-xl border border-slate-800 text-white space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
          <div>
            <div className="flex items-center space-x-2.5">
              <span className="p-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl">
                <Layers className="w-5 h-5" />
              </span>
              <div>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center space-x-2">
                  <span>{roleTitle}</span>
                  <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {roleBadge}
                  </span>
                </h1>
                <p className="text-xs text-slate-300 font-medium">
                  {roleSubtitle}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3 text-xs font-mono shrink-0">
            <span className="bg-slate-800/80 border border-slate-700/80 px-3 py-1.5 rounded-xl text-slate-300 font-bold flex items-center space-x-1.5">
              <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
              <span>{sessionCards.length} Session{sessionCards.length !== 1 ? 's' : ''}</span>
            </span>
          </div>
        </div>

        {/* TOP 4 MODULE NAVIGATION CARDS (PortalHub Grid Style) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Card 1: Training Sessions */}
          <button
            type="button"
            onClick={() => setFootballSubTab('sessions')}
            className={`group text-left p-4 sm:p-5 rounded-2xl border transition-all duration-200 flex flex-col justify-between relative overflow-hidden cursor-pointer ${
              footballSubTab === 'sessions'
                ? 'bg-[#0f5981] border-[#5ea4c5] shadow-lg ring-2 ring-[#5ea4c5]/40 scale-[1.01]'
                : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
            }`}
          >
            <div className={`absolute top-0 inset-x-0 h-1 transition-colors ${
              footballSubTab === 'sessions' ? 'bg-emerald-500' : 'bg-slate-800 group-hover:bg-emerald-600'
            }`} />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  DAILY ON-FIELD WORK
                </span>
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                  footballSubTab === 'sessions' 
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black' 
                    : 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60'
                }`}>
                  Core Engine
                </span>
              </div>

              <div className="flex items-start space-x-3">
                <div className={`p-3 rounded-xl border shrink-0 transition-transform ${
                  footballSubTab === 'sessions'
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 scale-105'
                    : 'bg-slate-800 text-slate-300 border-slate-700 group-hover:text-emerald-400'
                }`}>
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white group-hover:text-emerald-300 transition-colors">
                    Training Sessions / Sesiones
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed mt-1 line-clamp-2">
                    Manage daily training sessions, warm-up, main drills, cool down, tactical cards, attendance, and player groups.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-slate-400">
              <span className="text-[11px] font-mono text-slate-400">
                {cloudSessions.length} Session{cloudSessions.length !== 1 ? 's' : ''} Saved
              </span>
              <div className="flex items-center space-x-1 text-emerald-400 font-bold group-hover:translate-x-1 transition-transform">
                <span>Open Module</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </button>

          {/* Card 2: Planification & Microcycle */}
          <button
            type="button"
            onClick={() => setFootballSubTab('planning')}
            className={`group text-left p-4 sm:p-5 rounded-2xl border transition-all duration-200 flex flex-col justify-between relative overflow-hidden cursor-pointer ${
              footballSubTab === 'planning'
                ? 'bg-[#0f5981] border-[#5ea4c5] shadow-lg ring-2 ring-[#5ea4c5]/40 scale-[1.01]'
                : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
            }`}
          >
            <div className={`absolute top-0 inset-x-0 h-1 transition-colors ${
              footballSubTab === 'planning' ? 'bg-emerald-500' : 'bg-slate-800 group-hover:bg-emerald-600'
            }`} />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  PERIODIZATION & STRUCTURE
                </span>
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                  footballSubTab === 'planning' 
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black' 
                    : 'bg-indigo-950/60 text-indigo-400 border-indigo-800/60'
                }`}>
                  Weekly Prep
                </span>
              </div>

              <div className="flex items-start space-x-3">
                <div className={`p-3 rounded-xl border shrink-0 transition-transform ${
                  footballSubTab === 'planning'
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 scale-105'
                    : 'bg-slate-800 text-slate-300 border-slate-700 group-hover:text-emerald-400'
                }`}>
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white group-hover:text-emerald-300 transition-colors">
                    Planification & Microcycle
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed mt-1 line-clamp-2">
                    Macrocycle targets, weekly workload distribution, microcycle planning, and matchday prep (-3, -2, -1, MD).
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-slate-400">
              <span className="text-[11px] font-mono text-slate-400">
                Weekly Load Distribution
              </span>
              <div className="flex items-center space-x-1 text-emerald-400 font-bold group-hover:translate-x-1 transition-transform">
                <span>Open Module</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </button>

          {/* Card 3: Competition & Matches */}
          <button
            type="button"
            onClick={() => setFootballSubTab('competition')}
            className={`group text-left p-4 sm:p-5 rounded-2xl border transition-all duration-200 flex flex-col justify-between relative overflow-hidden cursor-pointer ${
              footballSubTab === 'competition'
                ? 'bg-[#0f5981] border-[#5ea4c5] shadow-lg ring-2 ring-[#5ea4c5]/40 scale-[1.01]'
                : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
            }`}
          >
            <div className={`absolute top-0 inset-x-0 h-1 transition-colors ${
              footballSubTab === 'competition' ? 'bg-emerald-500' : 'bg-slate-800 group-hover:bg-emerald-600'
            }`} />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  MATCHDAY & SCOUTING
                </span>
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                  footballSubTab === 'competition' 
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black' 
                    : 'bg-amber-950/60 text-amber-400 border-amber-800/60'
                }`}>
                  Official Fixtures
                </span>
              </div>

              <div className="flex items-start space-x-3">
                <div className={`p-3 rounded-xl border shrink-0 transition-transform ${
                  footballSubTab === 'competition'
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 scale-105'
                    : 'bg-slate-800 text-slate-300 border-slate-700 group-hover:text-emerald-400'
                }`}>
                  <Trophy className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white group-hover:text-emerald-300 transition-colors">
                    Competition & Matches
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed mt-1 line-clamp-2">
                    Fixture calendar, opposition analysis, starting XI lineups, match outcomes, and tactical scouting notes.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-slate-400">
              <span className="text-[11px] font-mono text-slate-400">
                League Fixtures & Results
              </span>
              <div className="flex items-center space-x-1 text-emerald-400 font-bold group-hover:translate-x-1 transition-transform">
                <span>Open Module</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </button>

          {/* Card 4: Exercises & Session Library */}
          <button
            type="button"
            onClick={() => setFootballSubTab('library')}
            className={`group text-left p-4 sm:p-5 rounded-2xl border transition-all duration-200 flex flex-col justify-between relative overflow-hidden cursor-pointer ${
              footballSubTab === 'library'
                ? 'bg-slate-900 border-emerald-500 shadow-lg ring-2 ring-emerald-500/30 scale-[1.01]'
                : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
            }`}
          >
            <div className={`absolute top-0 inset-x-0 h-1 transition-colors ${
              footballSubTab === 'library' ? 'bg-emerald-500' : 'bg-slate-800 group-hover:bg-emerald-600'
            }`} />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  DRILLS & EXERCISES
                </span>
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                  footballSubTab === 'library' 
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black' 
                    : 'bg-purple-950/60 text-purple-400 border-purple-800/60'
                }`}>
                  Librería Hub
                </span>
              </div>

              <div className="flex items-start space-x-3">
                <div className={`p-3 rounded-xl border shrink-0 transition-transform ${
                  footballSubTab === 'library'
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 scale-105'
                    : 'bg-slate-800 text-slate-300 border-slate-700 group-hover:text-emerald-400'
                }`}>
                  <BookOpen className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white group-hover:text-emerald-300 transition-colors">
                    Librería de Ejercicios
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed mt-1 line-clamp-2">
                    Buscador y repositorio de ejercicios y tareas tácticas por momento de juego, dimensiones y roles.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-slate-400">
              <span className="text-[11px] font-mono text-slate-400">
                Drill Repository
              </span>
              <div className="flex items-center space-x-1 text-emerald-400 font-bold group-hover:translate-x-1 transition-transform">
                <span>Open Library</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </button>

        </div>
      </div>

      {/* 2. SUB-CONTENT VIEW DIRECTED BY SELECTED MODULE */}
      {footballSubTab === 'planning' ? (
        <PlanificationSection session={session} cloudSessions={cloudSessions} />
      ) : footballSubTab === 'competition' ? (
        <CompetitionSection
          session={session}
          squadRoster={squadRoster}
          fixtures={fixtures}
          onUpdateFixtures={onUpdateFixtures}
        />
      ) : footballSubTab === 'library' ? (
        <ExercisesLibrary
          currentSession={session}
          cloudSessions={cloudSessions}
          onAddExerciseToSession={onAddExerciseToSession || (() => {})}
          activeSection="football"
        />
      ) : (
        /* TRAINING SESSIONS SUB MODULE WORKSPACE */
        <div className="space-y-6">
          
          {/* SECONDARY NAVIGATION BAR INSIDE TRAINING SESSIONS */}
          <div className="bg-white border border-slate-200 rounded-2xl p-2.5 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setSessionSubNav('cards')}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center space-x-2 cursor-pointer ${
                  sessionSubNav === 'cards'
                    ? 'bg-[#002142] text-white shadow-md'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Layers className="w-4 h-4 text-emerald-400" />
                <span>Session & Drill Cards / Galería</span>
              </button>

              <button
                type="button"
                onClick={() => setSessionSubNav('editor')}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center space-x-2 cursor-pointer ${
                  sessionSubNav === 'editor'
                    ? 'bg-[#002142] text-white shadow-md'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Edit3 className="w-4 h-4 text-amber-400" />
                <span>Active Session Designer / Editor</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold px-4 py-2 rounded-xl shadow-sm transition-all flex items-center justify-center space-x-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Sesión / New Session</span>
            </button>
          </div>

          {/* VIEW MODE 1: SESSION & DRILL CARDS GALLERY (SCREENSHOT MATCHING STYLE) */}
          {sessionSubNav === 'cards' ? (
            <div className="space-y-5">
              
              {/* Filter & Search Bar */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
                {/* Search */}
                <div className="relative w-full md:w-80">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search sessions by objective or number..."
                    className="w-full pl-9 pr-4 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                {/* Session Count */}
                <div className="text-xs font-bold text-slate-600">
                  {filteredSessions.length} session{filteredSessions.length !== 1 ? 's' : ''} found
                </div>
              </div>

              {/* CARDS GRID (3-COLUMN RESPONSIVE) */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sessionCards.length === 0 ? (
                  <div className="col-span-full p-8 text-center bg-white rounded-2xl border border-slate-200">
                    <FolderOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-sm text-slate-500 font-semibold">
                      {searchTerm ? 'No sessions match your search' : 'No sessions saved yet'}
                    </p>
                    {!searchTerm && (
                      <button
                        type="button"
                        onClick={() => setShowCreateModal(true)}
                        className="mt-4 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold rounded-xl transition-all"
                      >
                        Create your first session
                      </button>
                    )}
                  </div>
                ) : (
                  filteredSessions.map((sess) => {
                    const isActive = session.id === sess.id;

                    return (
                      <div
                        key={`${sess.id}-${sess.updatedAt}-${sess.title}`}
                        className={`group bg-white rounded-2xl border transition-all duration-200 shadow-sm hover:shadow-lg flex flex-col justify-between overflow-hidden relative ${
                          isActive 
                            ? 'border-emerald-500 ring-2 ring-emerald-500/20' 
                            : 'border-slate-200/90 hover:border-slate-300'
                        }`}
                      >
                        {/* CARD TOP HEADER */}
                        <div className="p-4 flex items-center justify-between border-b border-slate-100 bg-white">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 rounded-xl bg-[#002142] text-emerald-400 font-mono font-black text-xs flex items-center justify-center shadow-sm shrink-0 border border-slate-800">
                              #{sess.sessionNumber || '?'}
                            </div>
                            <div>
                              <h4 className="text-xs font-black text-slate-900 leading-none tracking-tight">
                                Session #{sess.sessionNumber || '?'}
                              </h4>
                              <p className="text-[11px] font-semibold text-slate-400 mt-1 flex items-center space-x-1">
                                <Clock className="w-3 h-3 text-slate-400 inline" />
                                <span>{sess.date}</span>
                              </p>
                            </div>
                          </div>

                          {/* Active indicator */}
                          {isActive && (
                            <div className="px-2 py-1 bg-emerald-50 border border-emerald-200 rounded-md">
                              <span className="text-[10px] font-black text-emerald-700 uppercase">Active</span>
                            </div>
                          )}
                        </div>

                        {/* CARD BODY */}
                        <div 
                          onClick={() => {
                            onChangeSession({
                              mainObjective: sess.title,
                              observations: sess.description || '',
                              date: sess.date,
                              sessionNumber: String(sess.sessionNumber),
                              microcycleDay: 'MD'
                            });
                            setSessionSubNav('editor');
                          }}
                          className="p-4 bg-white space-y-3 flex-1 flex flex-col justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                        >
                          <div className="space-y-2.5">
                            {/* Main Objective / Title */}
                            <h3 className="text-sm font-black text-slate-900 leading-snug line-clamp-3 hover:text-emerald-700 transition-colors min-h-[3rem]">
                              {sess.title || 'No objective assigned'}
                            </h3>
                            {sess.description ? (
                              <p className="text-xs text-slate-500 line-clamp-3">{sess.description}</p>
                            ) : null}

                            {/* Metadata */}
                            <div className="flex items-center gap-2 text-[11px] text-slate-500 font-semibold flex-wrap">
                              <span className="bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-md font-bold text-[10px]">
                                {sess.category || 'Tactical'}
                              </span>
                              <span className="bg-sky-50 text-sky-700 border border-sky-200 px-2 py-0.5 rounded-md font-bold text-[10px]">
                                {sess.duration || 'N/A'}
                              </span>
                              <span className="bg-violet-50 text-violet-700 border border-violet-200 px-2 py-0.5 rounded-md font-bold text-[10px]">
                                {sess.intensity || 'Alta'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* CARD FOOTER - Delete Button */}
                        <div className="p-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void deleteSessionCardFromCloud(sess.id);
                            }}
                            className="p-2 text-rose-500 hover:text-white hover:bg-rose-500 rounded-lg transition-all border border-rose-500/30 hover:border-rose-500"
                            title="Delete Session"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

            </div>
          ) : (
            /* VIEW MODE 2: ACTIVE SESSION DESIGNER / EDITOR */
            <div className="space-y-6">
              {renderActiveSessionEditor()}
            </div>
          )}

        </div>
      )}

      <CreateSessionCardModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateSessionCard}
        role={role}
      />

    </div>
  );
};
