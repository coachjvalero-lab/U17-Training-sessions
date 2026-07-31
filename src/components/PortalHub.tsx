import React from 'react';
import { User } from 'firebase/auth';
import { 
  Layers, 
  Activity, 
  ShieldCheck, 
  Users, 
  UserCheck, 
  Stethoscope, 
  Video, 
  BookOpen, 
  BarChart3, 
  ArrowRight, 
  Shield, 
  Sparkles,
  Calendar,
  Zap,
  TrendingUp,
  Clock,
  LogOut,
  User as UserIcon,
  ChevronRight,
  ClipboardList,
  Flame,
  Award
} from 'lucide-react';
import { PortalSection, SquadPlayer, PhysioRecord, VideoAnalysis } from '../types';
import { OFFICIAL_ALULA_LOGO_DATA_URL } from '../constants/logo';

interface PortalHubProps {
  onSelectSection: (section: PortalSection) => void;
  squadCount?: number;
  activeSessionDate?: string;
  totalExercisesCount?: number;
  squadPlayers?: SquadPlayer[];
  physioRecords?: PhysioRecord[];
  videoSessions?: VideoAnalysis[];
  currentUser?: User | null;
  onLogout?: () => void;
}

export const PortalHub: React.FC<PortalHubProps> = ({
  onSelectSection,
  squadCount = 22,
  activeSessionDate = new Date().toISOString().split('T')[0],
  totalExercisesCount = 18,
  squadPlayers = [],
  physioRecords = [],
  videoSessions = [],
  currentUser,
  onLogout
}) => {
  const activeInjuriesCount = physioRecords.filter(r => r.status !== 'Fit / Discharged').length;
  const activePlayersCount = squadPlayers.length || squadCount;
  const videoCount = videoSessions.length;

  const modules: {
    id: PortalSection;
    title: string;
    category: string;
    description: string;
    icon: any;
    iconBg: string;
    iconColor: string;
    badgeText: string;
    badgeStyle: string;
    statsText: string;
  }[] = [
    {
      id: 'football',
      title: 'Football Session',
      category: 'TACTICAL & DRILLS',
      description: 'Design full-pitch tactical sessions, game moment objectives, warm-ups, main drills, and cool-downs with interactive field canvas.',
      icon: Layers,
      iconBg: 'bg-emerald-100 border-emerald-200',
      iconColor: 'text-emerald-700',
      badgeText: 'Core Engine',
      badgeStyle: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      statsText: `Active Session: ${activeSessionDate}`
    },
    {
      id: 'fitness',
      title: 'Fitness & Conditioning',
      category: 'PHYSICAL LOAD',
      description: 'Track gym blocks, physical workload intensity, aerobic capacity, and strength conditioning exercises.',
      icon: Activity,
      iconBg: 'bg-amber-100 border-amber-200',
      iconColor: 'text-amber-700',
      badgeText: 'Physical',
      badgeStyle: 'bg-amber-50 text-amber-700 border-amber-200',
      statsText: 'GPS Load & Gym Work'
    },
    {
      id: 'gk',
      title: 'Goalkeepers Specific',
      category: 'SPECIALIZED DEPT',
      description: 'Dedicated GK drills: shot stopping, high cross distribution, 1v1 reactions, and footwork drills.',
      icon: ShieldCheck,
      iconBg: 'bg-sky-100 border-sky-200',
      iconColor: 'text-sky-700',
      badgeText: 'GK Dept',
      badgeStyle: 'bg-sky-50 text-sky-700 border-sky-200',
      statsText: 'Specific GK Drills'
    },
    {
      id: 'squad',
      title: 'Squad Roster (Plantilla)',
      category: 'ROSTER & PLAYERS',
      description: 'Centralized squad management: full player names, jersey numbers, positions, notes, and individual statuses.',
      icon: Users,
      iconBg: 'bg-indigo-100 border-indigo-200',
      iconColor: 'text-indigo-700',
      badgeText: 'Roster Hub',
      badgeStyle: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      statsText: `${activePlayersCount} Registered Players`
    },
    {
      id: 'attendance',
      title: 'Attendance & Analytics',
      category: 'ANALYTICS & ABSENCE',
      description: 'Live player attendance rates, gym participation, study/injury absence tracking, and session logs.',
      icon: UserCheck,
      iconBg: 'bg-teal-100 border-teal-200',
      iconColor: 'text-teal-700',
      badgeText: 'Absence Tracking',
      badgeStyle: 'bg-teal-50 text-teal-700 border-teal-200',
      statsText: 'Individual & Team Rates'
    },
    {
      id: 'physio',
      title: 'Physiotherapist Dept',
      category: 'MEDICAL & RECOVERY',
      description: 'Medical injury department: active treatments, rehab stages, return-to-play timelines, and clearance logs.',
      icon: Stethoscope,
      iconBg: 'bg-rose-100 border-rose-200',
      iconColor: 'text-rose-700',
      badgeText: activeInjuriesCount > 0 ? `${activeInjuriesCount} Active Rehab` : 'Medical Dept',
      badgeStyle: activeInjuriesCount > 0 ? 'bg-rose-100 text-rose-800 border-rose-300 font-bold' : 'bg-rose-50 text-rose-700 border-rose-200',
      statsText: `${activeInjuriesCount} Injured / Rehab`
    },
    {
      id: 'video',
      title: 'Video Analysis Hub',
      category: 'TACTICAL VIDEO',
      description: 'Match & training session video breakdowns, timestamped key tactical clips, game moment tags, and notes.',
      icon: Video,
      iconBg: 'bg-cyan-100 border-cyan-200',
      iconColor: 'text-cyan-700',
      badgeText: 'Video Dept',
      badgeStyle: 'bg-cyan-50 text-cyan-700 border-cyan-200',
      statsText: `${videoCount} Video Analyses`
    },
    {
      id: 'exercises',
      title: 'Exercises Library',
      category: 'DATABASE & SEARCH',
      description: 'Filterable drill repository categorized by Game Moment, field dimensions, series, duration, and roles.',
      icon: BookOpen,
      iconBg: 'bg-purple-100 border-purple-200',
      iconColor: 'text-purple-700',
      badgeText: 'Drill Database',
      badgeStyle: 'bg-purple-50 text-purple-700 border-purple-200',
      statsText: `${totalExercisesCount} Saved Drills`
    },
    {
      id: 'planning',
      title: 'Planification & Microcycle',
      category: 'PERIODIZATION',
      description: 'Microcycle overview, MD-4 to MD+1 volume planning, game moment balances, and monthly objectives.',
      icon: BarChart3,
      iconBg: 'bg-orange-100 border-orange-200',
      iconColor: 'text-orange-700',
      badgeText: 'Periodization',
      badgeStyle: 'bg-orange-50 text-orange-700 border-orange-200',
      statsText: 'Microcycle Schedules'
    }
  ];

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 p-4 sm:p-6 lg:p-8 font-sans select-none">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Top Al Ula Official Header Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          
          <div className="flex items-center space-x-5">
            <div className="w-16 h-16 rounded-2xl bg-[#002142] p-2.5 flex items-center justify-center shadow-md shrink-0 border border-[#001830]">
              <img 
                src={OFFICIAL_ALULA_LOGO_DATA_URL} 
                alt="Al Ula FC Logo" 
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h1 className="text-2xl font-black text-[#002142] tracking-tight font-display">
                  Al Ula FC
                </h1>
                <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  Women U17
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Technical Portal • Coaching, Physical, Medical & Video Department
              </p>
            </div>
          </div>

          {/* Logged in User Bar & Sign Out */}
          <div className="flex items-center space-x-4 self-end md:self-center border-t md:border-t-0 border-slate-100 pt-4 md:pt-0 w-full md:w-auto justify-between md:justify-end">
            <div className="flex items-center space-x-3 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200">
              <div className="w-8 h-8 rounded-full bg-[#002142] text-white flex items-center justify-center font-bold text-xs shrink-0">
                {currentUser?.email?.substring(0, 2).toUpperCase() || 'FC'}
              </div>
              <div className="text-left">
                <div className="text-xs font-bold text-slate-800 truncate max-w-[150px]">
                  {currentUser?.email || 'Head Coach'}
                </div>
                <div className="text-[10px] text-emerald-600 font-semibold uppercase tracking-wider">
                  Official Technical Staff
                </div>
              </div>
            </div>

            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200 hover:border-rose-200 text-xs font-bold transition-colors cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            )}
          </div>

        </div>

        {/* Quick Metrics Bar (Light Theme) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Squad Players</span>
              <span className="text-base font-extrabold text-[#002142] font-mono">{activePlayersCount} Players</span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 shrink-0">
              <Stethoscope className="w-5 h-5" />
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Injuries / Rehab</span>
              <span className="text-base font-extrabold text-rose-600 font-mono">{activeInjuriesCount} Active</span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-cyan-50 text-cyan-600 border border-cyan-100 shrink-0">
              <Video className="w-5 h-5" />
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Video Sessions</span>
              <span className="text-base font-extrabold text-[#002142] font-mono">{videoCount} Clips</span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Exercise Bank</span>
              <span className="text-base font-extrabold text-emerald-700 font-mono">{totalExercisesCount} Drills</span>
            </div>
          </div>
        </div>

        {/* Section Heading */}
        <div className="flex items-center justify-between pt-2">
          <div>
            <h2 className="text-xl font-extrabold text-[#002142] tracking-tight">
              Portal Modules Navigation
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Select a department module to open workspace management
            </p>
          </div>
          <span className="hidden sm:inline-block text-xs font-mono font-bold bg-slate-200 text-slate-700 px-3 py-1 rounded-full border border-slate-300">
            9 Active Modules
          </span>
        </div>

        {/* Modules Grid (Clean White Cards with Al Ula Accents) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {modules.map((m) => {
            const IconComponent = m.icon;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onSelectSection(m.id)}
                className="group text-left bg-white hover:bg-slate-50 border border-slate-200/90 hover:border-emerald-500/60 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between cursor-pointer active:scale-[0.99] relative overflow-hidden"
              >
                {/* Top Accent Line */}
                <div className="absolute top-0 inset-x-0 h-1 bg-[#002142] group-hover:bg-emerald-600 transition-colors" />

                <div className="space-y-4">
                  {/* Category Tag & Badge */}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      {m.category}
                    </span>
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${m.badgeStyle}`}>
                      {m.badgeText}
                    </span>
                  </div>

                  {/* Icon & Title */}
                  <div className="flex items-start space-x-3.5">
                    <div className={`p-3 rounded-xl border shrink-0 ${m.iconBg} ${m.iconColor} group-hover:scale-105 transition-transform`}>
                      <IconComponent className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-[#002142] group-hover:text-emerald-700 transition-colors">
                        {m.title}
                      </h3>
                      <p className="text-xs text-slate-500 font-normal leading-relaxed mt-1">
                        {m.description}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Footer Link CTA */}
                <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-500 group-hover:text-emerald-800 transition-colors">
                  <span className="text-[11px] font-mono text-slate-400 font-medium">
                    {m.statsText}
                  </span>
                  <div className="flex items-center space-x-1 text-emerald-600 font-bold group-hover:translate-x-1 transition-transform">
                    <span>Open Module</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 font-medium gap-3 pb-4">
          <div className="flex items-center space-x-2">
            <Shield className="w-4 h-4 text-emerald-600" />
            <span>Al Ula Football Club • Official Women U17 Technical System</span>
          </div>
          <div className="text-slate-400 font-mono text-[11px]">
            Technical Operations • Authorized Coaching Personnel Only
          </div>
        </div>

      </div>
    </div>
  );
};
