import React, { useState } from 'react';
import { 
  Printer, 
  Trash2, 
  Plus, 
  CloudUpload, 
  Save, 
  Check, 
  FolderOpen, 
  Layers, 
  Activity, 
  ShieldCheck, 
  BookOpen,
  BarChart3,
  Menu,
  X,
  RefreshCw,
  FileText,
  UserCheck,
  Link,
  Globe,
  LogOut,
  User as UserIcon,
  LayoutGrid,
  Users,
  Stethoscope,
  Video
} from 'lucide-react';
import { User } from 'firebase/auth';
import { TrainingSession, PortalSection } from '../types';
import { CloudTrainingSession } from '../firebase';
import { OFFICIAL_ALULA_LOGO_DATA_URL } from '../constants/logo';
import { getUserAllowedSections, isUserAdmin, initPermissionsCloudSync } from '../utils/permissions';
import { AdminPermissionsModal } from './AdminPermissionsModal';

interface SidebarProps {
  session: TrainingSession;
  activeSection: PortalSection;
  setActiveSection: (section: PortalSection) => void;
  onClearSession: () => void;
  onNewSession: () => void;
  cloudSessions: CloudTrainingSession[];
  isLoadingCloud: boolean;
  isCloudSaving: boolean;
  onSaveToCloud: () => void;
  onLoadCloudSession: (sess: CloudTrainingSession) => void;
  onDeleteCloudSession: (id: string, sessNum: string, e: React.MouseEvent) => void;
  copiedLink: boolean;
  onCopyShareLink: () => void;
  totalLibraryExercisesCount?: number;
  currentUser?: User | null;
  onLogout?: () => void;
  onUpdateSession?: (fields: Partial<TrainingSession>) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  session,
  activeSection,
  setActiveSection,
  onClearSession,
  onNewSession,
  cloudSessions,
  isLoadingCloud,
  isCloudSaving,
  onSaveToCloud,
  onLoadCloudSession,
  onDeleteCloudSession,
  copiedLink,
  onCopyShareLink,
  totalLibraryExercisesCount = 0,
  currentUser,
  onLogout,
  onUpdateSession
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cloudSessionsOpen, setCloudSessionsOpen] = useState(true);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { processUploadedImageFile } = await import('../utils/heic');
      const dataUrl = await processUploadedImageFile(file);
      try {
        localStorage.setItem('u17_uploaded_team_logo', dataUrl);
      } catch (err) {}
      if (onUpdateSession) {
        onUpdateSession({ teamLogo: dataUrl });
      }
    } catch (err) {
      alert('Error procesando imagen del logo.');
    }
  };

  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [allowedSections, setAllowedSections] = useState<PortalSection[]>(() => 
    getUserAllowedSections(currentUser?.email)
  );

  const userIsAdmin = isUserAdmin(currentUser?.email);

  React.useEffect(() => {
    setAllowedSections(getUserAllowedSections(currentUser?.email));
  }, [currentUser?.email]);

  const refreshPermissions = () => {
    setAllowedSections(getUserAllowedSections(currentUser?.email));
  };

  // Keep permissions in sync across devices: migrate any local cache once, then
  // subscribe to live updates from Firestore so admin changes apply immediately.
  React.useEffect(() => {
    const unsubscribe = initPermissionsCloudSync(refreshPermissions);
    return () => unsubscribe();
  }, [currentUser?.email]);

  const navItems = ([
    {
      id: 'football',
      label: 'Football',
      sublabel: 'Full Field & Tactical',
      icon: Layers,
      color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
    },
    {
      id: 'fitness',
      label: 'Fitness & Conditioning',
      sublabel: 'Conditioning & Gym',
      icon: Activity,
      color: 'bg-amber-500/20 text-amber-400 border-amber-500/30'
    },
    {
      id: 'gk',
      label: 'Goalkeepers',
      sublabel: 'Specific GK Training',
      icon: ShieldCheck,
      color: 'bg-sky-500/20 text-sky-400 border-sky-500/30'
    },
    {
      id: 'squad',
      label: 'Squad Roster',
      sublabel: 'Plantilla & Attendance',
      icon: Users,
      color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
    },
    {
      id: 'physio',
      label: 'Physiotherapist',
      sublabel: 'Medical & Injuries',
      icon: Stethoscope,
      color: 'bg-rose-500/20 text-rose-300 border-rose-500/30'
    },
    {
      id: 'video',
      label: 'Video Analysis',
      sublabel: 'Tactical Clip Review',
      icon: Video,
      color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
    },
    {
      id: 'planning',
      label: 'Planification',
      sublabel: 'Game Moments & Volume',
      icon: BarChart3,
      color: 'bg-orange-500/20 text-orange-300 border-orange-500/30'
    }
  ] as { id: PortalSection; label: string; sublabel: string; icon: any; color: string; badge?: string }[]).filter(item => allowedSections.includes(item.id));

  const sidebarContent = (
    <div className="flex flex-col h-full space-y-5 p-4 md:p-5 text-white">
      
      {/* Brand & Autosave Header */}
      <div className="flex items-center justify-between pb-4 border-b border-[#5ea4c5]/20">
        <div className="flex items-center space-x-3">
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*,.heic,.heif"
            onChange={handleLogoChange}
            className="hidden"
          />
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="w-10 h-10 rounded-xl bg-[#001020] border border-[#a79078]/40 hover:border-emerald-400 flex items-center justify-center p-1 shadow-md shrink-0 cursor-pointer group relative transition-colors"
            title="Haz clic para cambiar el logo"
          >
            <img 
              src={session.teamLogo || OFFICIAL_ALULA_LOGO_DATA_URL} 
              alt="Al Ula SC" 
              className="w-full h-full object-contain" 
              referrerPolicy="no-referrer"
            />
          </div>
          <div>
            <h1 className="text-sm font-display font-black tracking-wider uppercase text-white leading-tight">
              Al Ula SC U17
            </h1>
            <p className="text-[10px] text-[#a79078] font-extrabold tracking-widest uppercase">
              Coaching Staff
            </p>
          </div>
        </div>
      </div>

      {/* Logged in user profile & Sign Out button */}
      {currentUser && (
        <div className="flex items-center justify-between bg-[#001428] border border-emerald-500/30 rounded-2xl p-2.5 shadow-sm">
          <div className="flex items-center space-x-2 min-w-0 pr-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shrink-0">
              <UserIcon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="block text-[11px] font-bold text-slate-100 truncate capitalize">
                {currentUser.email ? currentUser.email.split('@')[0] : 'admin'}
              </span>
              <span className={`inline-block text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                userIsAdmin ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'
              }`}>
                {userIsAdmin ? 'Admin' : 'Coach'}
              </span>
            </div>
          </div>
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="p-1.5 bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 hover:text-white rounded-xl transition-all border border-rose-500/30 shrink-0"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Navigation Section Tabs */}
      <div className="space-y-1">
        {/* Navigation Portal Hub Home Button */}
        <button
          type="button"
          onClick={() => {
            setActiveSection('hub');
            setMobileOpen(false);
          }}
          className={`w-full flex items-center justify-between p-2.5 rounded-xl transition-all cursor-pointer text-left border ${
            activeSection === 'hub'
              ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300 font-bold shadow-lg shadow-emerald-950/50'
              : 'bg-[#001830]/80 hover:bg-[#002447] border-slate-700/50 text-slate-200 hover:text-white'
          }`}
        >
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
              <LayoutGrid className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-white">Portal Navigation Hub</div>
              <div className="text-[9px] text-slate-400 font-medium">All Modules Overview</div>
            </div>
          </div>
          <span className="text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">
            Hub
          </span>
        </button>

        <p className="text-[10px] font-black uppercase tracking-wider text-sky-200/50 px-1 pt-2 mb-1">
          Modules Navigation
        </p>
        <div className="space-y-1 max-h-56 overflow-y-auto custom-scrollbar pr-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveSection(item.id);
                  setMobileOpen(false);
                }}
                className={`w-full flex items-center justify-between p-2 rounded-xl transition-all cursor-pointer text-left border ${
                  isActive 
                    ? 'bg-[#0f5981] border-[#5ea4c5] shadow-md shadow-[#001020]/60 ring-1 ring-[#5ea4c5]/40 text-white' 
                    : 'bg-[#001830]/60 hover:bg-[#002447] border-transparent hover:border-[#5ea4c5]/20 text-slate-300 hover:text-white'
                }`}
              >
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div className={`p-1.5 rounded-lg border ${item.color} shrink-0`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="truncate">
                    <div className={`text-xs font-bold truncate ${isActive ? 'text-white' : 'text-slate-200'}`}>
                      {item.label}
                    </div>
                    <div className="text-[9px] text-slate-400 truncate font-semibold">
                      {item.sublabel}
                    </div>
                  </div>
                </div>
                {item.badge && (
                  <span className="text-[10px] font-black bg-[#a79078] text-slate-950 px-2 py-0.5 rounded-full ml-1 shrink-0">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Quick Actions (Print / New / Clear) */}
      <div className="space-y-2 pt-2 border-t border-[#5ea4c5]/20">
        <p className="text-[10px] font-black uppercase tracking-wider text-sky-200/50 px-1 mb-1">
          Actions
        </p>

        {userIsAdmin && (
          <button
            type="button"
            onClick={() => setIsAdminModalOpen(true)}
            className="w-full flex items-center space-x-2.5 p-2.5 rounded-xl transition-all cursor-pointer text-left border bg-emerald-600/20 border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/30 mb-2"
          >
            <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-white">Admin Management</div>
              <div className="text-[9px] text-emerald-300/70 font-medium">Manage User Tab Access</div>
            </div>
          </button>
        )}

        {/* Print / PDF Button */}
        <button
          type="button"
          onClick={handlePrint}
          className="w-full flex items-center justify-center space-x-2 bg-emerald-500 hover:bg-emerald-600 active:scale-98 text-white font-extrabold text-xs uppercase tracking-wider py-2.5 px-3 rounded-xl transition-all cursor-pointer shadow-md shadow-emerald-500/20"
          title="Print or Save as PDF"
        >
          <Printer className="w-4 h-4" />
          <span>Print / PDF</span>
        </button>

        <div className="grid grid-cols-2 gap-2">
          {/* New Session Button */}
          <button
            type="button"
            onClick={onNewSession}
            className="flex items-center justify-center space-x-1.5 bg-[#00284d] hover:bg-[#003566] text-sky-200 hover:text-white font-bold text-xs uppercase tracking-wider py-2 px-2.5 rounded-xl transition-all cursor-pointer border border-[#5ea4c5]/30"
            title="Create a new blank training session"
          >
            <Plus className="w-3.5 h-3.5 text-sky-400" />
            <span>New</span>
          </button>

          {/* Clear Session Button */}
          <button
            type="button"
            onClick={onClearSession}
            className="flex items-center justify-center space-x-1.5 bg-[#001830] hover:bg-rose-950/80 text-slate-400 hover:text-rose-300 font-bold text-xs uppercase tracking-wider py-2 px-2.5 rounded-xl transition-all cursor-pointer border border-slate-700/60 hover:border-rose-900/50"
            title="Clear all fields to start from scratch"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
        </div>

        {/* Primary Save Session Button */}
        <button
          type="button"
          onClick={onSaveToCloud}
          disabled={isCloudSaving}
          className={`w-full flex items-center justify-center space-x-2 py-3 px-3 rounded-xl transition-all cursor-pointer border text-xs font-black uppercase tracking-wider shadow-md ${
            isCloudSaving 
              ? 'bg-amber-600/30 text-amber-300 border-amber-500/50 cursor-wait' 
              : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 border-emerald-400 shadow-emerald-500/20 hover:shadow-emerald-500/30'
          }`}
          title="Save current session to the cloud and locally"
        >
          {isCloudSaving ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin text-amber-300" />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4 text-slate-950" />
              <span>Save Session</span>
            </>
          )}
        </button>
      </div>

      {/* Footer info */}
      <div className="pt-2 border-t border-[#5ea4c5]/10 text-center">
        <p className="text-[9px] text-slate-400 font-semibold">
          Al Ula SC U17 • Technical Staff Platform
        </p>
      </div>

      <AdminPermissionsModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
        onPermissionsUpdated={refreshPermissions}
      />

    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (Permanent) */}
      <aside className="hidden md:block w-72 lg:w-80 shrink-0 bg-[#001d3a] border-r border-[#5ea4c5]/20 min-h-screen sticky top-0 h-screen overflow-y-auto print:hidden z-30 shadow-2xl">
        {sidebarContent}
      </aside>

      {/* Mobile Top Header Bar with Menu Drawer Toggle */}
      <div className="md:hidden bg-[#001d3a] text-white p-3.5 border-b border-[#5ea4c5]/20 flex items-center justify-between sticky top-0 z-40 print:hidden shadow-lg">
        <div className="flex items-center space-x-2.5">
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2 bg-[#002b54] hover:bg-[#00386d] text-white rounded-xl border border-[#5ea4c5]/30 cursor-pointer transition-colors"
            aria-label="Toggle Menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className="flex items-center space-x-2">
            <img 
              src={session.teamLogo || OFFICIAL_ALULA_LOGO_DATA_URL} 
              alt="Logo" 
              className="w-7 h-7 object-contain"
            />
            <div>
              <h2 className="text-xs font-display font-black text-white uppercase leading-none">
                Al Ula SC U17
              </h2>
              <span className="text-[9px] text-[#a79078] font-bold">
                {navItems.find(n => n.id === activeSection)?.label}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center space-x-1 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold uppercase py-1.5 px-3 rounded-lg shadow-sm"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>PDF</span>
          </button>
        </div>
      </div>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex print:hidden">
          <div 
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative w-4/5 max-w-sm bg-[#001d3a] h-full shadow-2xl overflow-y-auto z-10 border-r border-[#5ea4c5]/20">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute top-3 right-3 p-2 text-slate-300 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
