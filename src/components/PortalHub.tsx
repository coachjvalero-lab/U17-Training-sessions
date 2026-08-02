import React, { useState, useEffect } from 'react';
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
  Award,
  Upload,
  Camera,
  X,
  RotateCcw,
  Link,
  Check,
  Lock
} from 'lucide-react';
import { PortalSection, SquadPlayer, PhysioRecord, VideoAnalysis } from '../types';
import { OFFICIAL_ALULA_LOGO_DATA_URL } from '../constants/logo';
import { processUploadedImageFile } from '../utils/heic';
import { getUserAllowedSections, isUserAdmin } from '../utils/permissions';
import { AdminPermissionsModal } from './AdminPermissionsModal';

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
  currentLogo?: string;
  onUpdateLogo?: (newLogo: string) => void;
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
  onLogout,
  currentLogo,
  onUpdateLogo
}) => {
  const [logoUrl, setLogoUrl] = useState<string>(() => {
    if (currentLogo) return currentLogo;
    try {
      return localStorage.getItem('u17_uploaded_team_logo') || OFFICIAL_ALULA_LOGO_DATA_URL;
    } catch (e) {
      return OFFICIAL_ALULA_LOGO_DATA_URL;
    }
  });

  const [isLogoModalOpen, setIsLogoModalOpen] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [logoSuccessMessage, setLogoSuccessMessage] = useState('');

  const allowedSections = getUserAllowedSections(currentUser?.email);
  const userIsAdmin = isUserAdmin(currentUser?.email);

  const activeInjuriesCount = physioRecords.filter(r => r.status !== 'Closed').length;
  const activePlayersCount = squadPlayers.length || squadCount;
  const videoCount = videoSessions.length;

  const handleApplyLogo = (newLogo: string) => {
    setLogoUrl(newLogo);
    try {
      localStorage.setItem('u17_uploaded_team_logo', newLogo);
    } catch (e) {}
    if (onUpdateLogo) {
      onUpdateLogo(newLogo);
    }
    setLogoSuccessMessage('Logo updated successfully!');
    setTimeout(() => {
      setLogoSuccessMessage('');
      setIsLogoModalOpen(false);
    }, 1000);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await processUploadedImageFile(file);
      handleApplyLogo(dataUrl);
    } catch (err) {
      alert('Error processing selected image file. Please try a different image.');
    }
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageUrlInput.trim()) return;
    handleApplyLogo(imageUrlInput.trim());
    setImageUrlInput('');
  };

  const handleResetToDefaultLogo = () => {
    handleApplyLogo(OFFICIAL_ALULA_LOGO_DATA_URL);
  };

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
      title: 'Squad Roster & Attendance (Plantilla)',
      category: 'ROSTER & PLAYERS',
      description: 'Centralized squad management: player profiles, dorsals, positions, and integrated attendance analytics hub.',
      icon: Users,
      iconBg: 'bg-indigo-100 border-indigo-200',
      iconColor: 'text-indigo-700',
      badgeText: 'Roster & Attendance',
      badgeStyle: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      statsText: `${activePlayersCount} Registered Players`
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
            <div className="relative group">
              <div className="w-16 h-16 rounded-2xl bg-[#002142] p-2 flex items-center justify-center shadow-md shrink-0 border border-[#001830] overflow-hidden">
                <img 
                  src={logoUrl} 
                  alt="Al Ula FC Logo" 
                  className="w-full h-full object-contain"
                />
              </div>
              <button
                type="button"
                onClick={() => setIsLogoModalOpen(true)}
                className="absolute -bottom-1 -right-1 bg-emerald-600 hover:bg-emerald-500 text-white p-1.5 rounded-full shadow-lg border border-white/20 transition-transform hover:scale-110 cursor-pointer"
                title="Change Club Crest / Logo"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h1 className="text-2xl font-black text-[#002142] tracking-tight font-display">
                  Al Ula FC
                </h1>
                <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  Women U17
                </span>
                <button
                  type="button"
                  onClick={() => setIsLogoModalOpen(true)}
                  className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-slate-300 hover:border-emerald-300 transition-colors cursor-pointer"
                >
                  <Upload className="w-3 h-3 text-emerald-600" />
                  <span>Change Logo</span>
                </button>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Technical Portal • Coaching, Physical, Medical & Video Department
              </p>
            </div>
          </div>

          {/* Logged in User Bar, Admin Control & Sign Out */}
          <div className="flex flex-wrap items-center gap-3 self-end md:self-center border-t md:border-t-0 border-slate-100 pt-4 md:pt-0 w-full md:w-auto justify-between md:justify-end">
            
            {userIsAdmin && (
              <button
                type="button"
                onClick={() => setIsAdminModalOpen(true)}
                className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition-colors shadow-sm shadow-emerald-600/30 cursor-pointer"
                title="Manage user tab access and permissions"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-100" />
                <span>Admin: Manage Tab Access</span>
              </button>
            )}

            <div className="flex items-center space-x-3 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200">
              <div className="w-8 h-8 rounded-full bg-[#002142] text-white flex items-center justify-center font-bold text-xs shrink-0">
                {currentUser?.email?.substring(0, 2).toUpperCase() || 'FC'}
              </div>
              <div className="text-left">
                <div className="text-xs font-bold text-slate-800 truncate max-w-[150px]">
                  {currentUser?.email || 'Head Coach'}
                </div>
                <div className="text-[10px] text-emerald-600 font-semibold uppercase tracking-wider">
                  {userIsAdmin ? 'Admin Technical Staff' : 'Official Technical Staff'}
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
            const isPermitted = allowedSections.includes(m.id);

            return (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  if (isPermitted) {
                    onSelectSection(m.id);
                  } else {
                    alert(`Access Restricted: The "${m.title}" tab is restricted for your user account. Please contact an Administrator to unlock access.`);
                  }
                }}
                className={`group text-left bg-white border rounded-2xl p-5 shadow-sm transition-all duration-200 flex flex-col justify-between relative overflow-hidden ${
                  isPermitted 
                    ? 'hover:bg-slate-50 border-slate-200/90 hover:border-emerald-500/60 hover:shadow-md cursor-pointer active:scale-[0.99]' 
                    : 'border-slate-200 bg-slate-50/70 opacity-70 cursor-not-allowed'
                }`}
              >
                {/* Top Accent Line */}
                <div className={`absolute top-0 inset-x-0 h-1 transition-colors ${
                  isPermitted ? 'bg-[#002142] group-hover:bg-emerald-600' : 'bg-slate-300'
                }`} />

                <div className="space-y-4">
                  {/* Category Tag & Badge */}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      {m.category}
                    </span>
                    {isPermitted ? (
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${m.badgeStyle}`}>
                        {m.badgeText}
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full border bg-slate-100 text-slate-500 border-slate-300 flex items-center space-x-1">
                        <Lock className="w-3 h-3 text-slate-400" />
                        <span>Restricted Tab</span>
                      </span>
                    )}
                  </div>

                  {/* Icon & Title */}
                  <div className="flex items-start space-x-3.5">
                    <div className={`p-3 rounded-xl border shrink-0 ${
                      isPermitted ? `${m.iconBg} ${m.iconColor} group-hover:scale-105` : 'bg-slate-100 border-slate-200 text-slate-400'
                    } transition-transform`}>
                      <IconComponent className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className={`text-base font-bold transition-colors ${
                        isPermitted ? 'text-[#002142] group-hover:text-emerald-700' : 'text-slate-600'
                      }`}>
                        {m.title}
                      </h3>
                      <p className="text-xs text-slate-500 font-normal leading-relaxed mt-1">
                        {m.description}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Footer Link CTA */}
                <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-500">
                  <span className="text-[11px] font-mono text-slate-400 font-medium">
                    {m.statsText}
                  </span>
                  {isPermitted ? (
                    <div className="flex items-center space-x-1 text-emerald-600 font-bold group-hover:translate-x-1 transition-transform">
                      <span>Open Module</span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  ) : (
                    <div className="flex items-center space-x-1 text-slate-400 font-bold">
                      <Lock className="w-3.5 h-3.5" />
                      <span>Locked</span>
                    </div>
                  )}
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

        {/* Logo Customization Modal */}
        {isLogoModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
            <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden p-6 space-y-5 relative">
              
              <button
                type="button"
                onClick={() => setIsLogoModalOpen(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-xl">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Customize Club Crest / Logo
                  </h3>
                  <p className="text-xs text-slate-500">
                    Upload a new image or paste a URL to update the official club crest across all screens.
                  </p>
                </div>
              </div>

              {/* Logo Preview */}
              <div className="bg-slate-900 p-4 rounded-xl flex items-center justify-center border border-slate-800">
                <div className="w-20 h-20 bg-[#002142] p-2.5 rounded-2xl flex items-center justify-center border border-slate-700 shadow-lg">
                  <img src={logoUrl} alt="Logo preview" className="w-full h-full object-contain" />
                </div>
              </div>

              {logoSuccessMessage && (
                <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold px-3 py-2 rounded-xl flex items-center space-x-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>{logoSuccessMessage}</span>
                </div>
              )}

              {/* File Upload Option */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Option 1: Upload File (PNG, JPG, HEIC, SVG)
                </label>
                <label className="flex items-center justify-center space-x-2 px-4 py-3 bg-emerald-50 hover:bg-emerald-100 border border-dashed border-emerald-300 text-emerald-800 font-bold text-xs rounded-xl transition-colors cursor-pointer">
                  <Upload className="w-4 h-4 text-emerald-600" />
                  <span>Select image from your device</span>
                  <input
                    type="file"
                    accept="image/*,.heic,.heif"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {/* URL Input Option */}
              <form onSubmit={handleUrlSubmit} className="space-y-2 pt-2 border-t border-slate-100">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Option 2: Paste Image URL Link
                </label>
                <div className="flex space-x-2">
                  <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Link className="w-4 h-4" />
                    </div>
                    <input
                      type="url"
                      value={imageUrlInput}
                      onChange={(e) => setImageUrlInput(e.target.value)}
                      placeholder="https://example.com/logo.png"
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer shrink-0"
                  >
                    Save URL
                  </button>
                </div>
              </form>

              {/* Reset Option */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleResetToDefaultLogo}
                  className="inline-flex items-center space-x-1.5 text-xs text-slate-500 hover:text-slate-800 font-semibold transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset to Official Al Ula FC Logo</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsLogoModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>

            </div>
          </div>
        )}

        {/* Admin Permissions Modal */}
        <AdminPermissionsModal
          isOpen={isAdminModalOpen}
          onClose={() => setIsAdminModalOpen(false)}
          onPermissionsUpdated={() => {}}
        />

      </div>
    </div>
  );
};
