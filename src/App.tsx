import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User } from 'firebase/auth';
import { getEmptySession } from './defaultSession';
import { OFFICIAL_ALULA_LOGO_DATA_URL } from './constants/logo';
import { normalizeSessionRoster, DEFAULT_DETAILED_SQUAD } from './constants/squad';
import { HeaderSection } from './components/HeaderSection';
import { ExerciseBlock } from './components/ExerciseBlock';
import { PlayerGroupsSection } from './components/PlayerGroupsSection';
import { Sidebar } from './components/Sidebar';
import { ExercisesLibrary } from './components/ExercisesLibrary';
import { PlanificationSection } from './components/PlanificationSection';
import { SessionAttendanceTracker } from './components/SessionAttendanceTracker';
import { LoginPage } from './components/LoginPage';
import { PortalHub } from './components/PortalHub';
import { SquadRosterSection } from './components/SquadRosterSection';
import { PhysiotherapySection } from './components/PhysiotherapySection';
import { VideoAnalysisSection } from './components/VideoAnalysisSection';
import { DEFAULT_MATCHES } from './components/CompetitionSection';
import { FootballHubSection } from './components/FootballHubSection';
import { ModuleSessionEditor } from './components/ModuleSessionEditor';
import { 
  TrainingSession, 
  Exercise, 
  PlayerGroup, 
  PlayerAttendance, 
  PortalSection,
  CloudTrainingSession,
  SquadPlayer,
  PhysioRecord,
  VideoAnalysis,
  MatchFixture 
} from './types';
import { 
  subscribeToAuth,
  logoutUser,
  markQuotaExceeded,
  clearQuotaExceeded,
  subscribeSyncStatus,
  flushPendingWrites,
} from './firebase';
import {
  deleteSquadPlayer,
  saveSquadPlayer,
  subscribeToSquadPlayers
} from './services/squad/squadService';
import {
  addExcludedPlayers,
  removeExcludedPlayers,
  subscribeToExcludedPlayers
} from './services/attendance/attendanceService';
import {
  saveTeamLogo,
  subscribeToTeamLogo
} from './services/team/teamLogoService';
import { getSupabaseAuthDiagnostics } from './services/auth/authDiagnosticsService';
import {
  deletePhysioRecordFromCloud,
  savePhysioRecordToCloud,
  subscribeToPhysioRecords
} from './services/physio/physioService';
import {
  deleteCompetitionFixtureFromCloud,
  saveCompetitionFixtureToCloud,
  subscribeToCompetitionFixtures
} from './services/fixtures/fixturesService';
import {
  deleteVideoAnalysisFromCloud,
  saveVideoAnalysisToCloud,
  subscribeToVideoAnalysis
} from './services/video/videoAnalysisService';
import { initPermissionsCloudSync } from './utils/permissions';
import { clearWorkspaceRestoreState, readWorkspaceRestoreState, writeWorkspaceRestoreState } from './utils/workspaceRestore';
import {
  DEFAULT_MODULE_ID,
  addExerciseToSessionByModule,
  getModuleCloudUpdatedAt,
  getModuleGameMoments,
  getModuleIdFromSection,
  getModuleRoleLabel,
  getSharedSessionHeader,
  getModuleSessionView,
  hydrateTrainingSession,
  updateSessionExercisesByModule,
  updateSessionGroupsByModule
} from './modules/trainingModules';
import { calculateSquadStatistics } from './modules/squadStatisticsService';
import {
  deleteTrainingSession,
  saveTrainingSessionBySection,
  subscribeTrainingSessions
} from './modules/trainingSessionPersistence';
import {
  getAuthProvider,
  getDataProvider,
  getPermissionsProvider,
  isSupabaseConfigured,
  supabase
} from './supabaseClient';
import { getSessionsDataProvider } from './supabaseSessions';
import { 
  FileText,
  Loader2,
  Moon,
  Sun
} from 'lucide-react';

const APP_CONTEXT_STORAGE_KEY = 'u17_app_context';
const CLOUD_SESSIONS_CACHE_KEY = 'u17_cloud_sessions_cache';

type AppContextSnapshot = {
  activeSection: PortalSection;
  sessionId: string;
  route: string;
  scrollY: number;
};

function isPortalSection(value: string | null): value is PortalSection {
  return value === 'hub' ||
    value === 'football' ||
    value === 'fitness' ||
    value === 'gk' ||
    value === 'squad' ||
    value === 'attendance' ||
    value === 'physio' ||
    value === 'video' ||
    value === 'exercises' ||
    value === 'planning';
}

function readSavedAppContext(): AppContextSnapshot | null {
  const parsed = readWorkspaceRestoreState<Partial<AppContextSnapshot> | null>(APP_CONTEXT_STORAGE_KEY, null);
  if (!parsed || !isPortalSection(typeof parsed.activeSection === 'string' ? parsed.activeSection : null)) {
    return null;
  }

  return {
    activeSection: parsed.activeSection,
    sessionId: typeof parsed.sessionId === 'string' ? parsed.sessionId : '',
    route: typeof parsed.route === 'string' ? parsed.route : '',
    scrollY: typeof parsed.scrollY === 'number' ? parsed.scrollY : 0
  };
}

function readCachedCloudSessions(): CloudTrainingSession[] {
  try {
    const raw = localStorage.getItem(CLOUD_SESSIONS_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function shouldRequireLoginForSharedLink(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.get('session')) return false;

    const navEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    const navType = navEntry?.type;
    return navType === 'navigate';
  } catch (e) {
    return false;
  }
}

function registerSupabaseDataDiagnosticsHelper() {
  if (typeof window === 'undefined' || !supabase) return;

  (window as any).__u17SupabaseDataDiagnostics = async () => {
    const [sessionsResult, squadResult, rolesResult] = await Promise.allSettled([
      supabase.from('sessions').select('id', { count: 'exact', head: true }),
      supabase.from('squad_players').select('id', { count: 'exact', head: true }),
      supabase.from('user_roles').select('*')
    ]);

    const toSummary = (result: PromiseSettledResult<any>) => {
      if (result.status === 'fulfilled') {
        return {
          count: result.value.count ?? (Array.isArray(result.value.data) ? result.value.data.length : null),
          error: result.value.error ?? null
        };
      }

      const error = result.reason && typeof result.reason === 'object'
        ? {
            code: (result.reason as { code?: unknown }).code ? String((result.reason as { code?: unknown }).code) : 'unknown',
            message: (result.reason as { message?: unknown }).message ? String((result.reason as { message?: unknown }).message) : String(result.reason),
            status: null
          }
        : {
            code: 'unknown',
            message: String(result.reason),
            status: null
          };

      return {
        count: null,
        error
      };
    };

    const diagnostics = {
      providers: {
        data: getDataProvider(),
        auth: getAuthProvider(),
        permissions: getPermissionsProvider(),
        sessions: getSessionsDataProvider(),
        supabaseConfigured: isSupabaseConfigured
      },
      sessions: toSummary(sessionsResult),
      squadPlayers: toSummary(squadResult),
      userRoles: toSummary(rolesResult)
    };

    console.log('[SUPABASE DATA DIAGNOSTICS]', diagnostics);
    return diagnostics;
  };
}

function registerSupabaseAuthDiagnosticsHelper() {
  if (typeof window === 'undefined') return;

  (window as any).__u17SupabaseAuthDiagnostics = async () => {
    const diagnostics = await getSupabaseAuthDiagnostics();
    console.log('[U17 Supabase Auth Diagnostics]', diagnostics);
    return diagnostics;
  };
}

registerSupabaseAuthDiagnosticsHelper();

export default function App() {
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('u17_theme_mode');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch (e) {}

    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    return 'light';
  });

  useEffect(() => {
    registerSupabaseAuthDiagnosticsHelper();
  }, []);

  useEffect(() => {
    registerSupabaseDataDiagnosticsHelper();
  }, []);

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthInitializing, setIsAuthInitializing] = useState<boolean>(true);
  const [requiresSharedLinkLogin, setRequiresSharedLinkLogin] = useState<boolean>(() => shouldRequireLoginForSharedLink());
  const [activeSection, setActiveSection] = useState<PortalSection>(() => readSavedAppContext()?.activeSection || 'hub');

  // Squad Players ("Plantilla") — initial value is only a local cache for instant paint/offline;
  // Firestore is the source of truth (see subscription effect below).
  const initialSquadPlayersRef = useRef<SquadPlayer[]>([]);
  const [squadPlayers, setSquadPlayers] = useState<SquadPlayer[]>(() => {
    const computed = (() => {
      try {
        const saved = localStorage.getItem('u17_squad_players');
        if (saved) return JSON.parse(saved);
      } catch (e) {}
      return DEFAULT_DETAILED_SQUAD;
    })();
    initialSquadPlayersRef.current = computed;
    return computed;
  });

  // Track whether the one-time squad roster migration attempt has settled, so an empty
  // cloud collection while it's still in flight doesn't briefly flash an empty roster.
  const hasSquadMigrationSettledRef = useRef(false);

  // Subscribe to the shared cloud squad roster in real time so every coach sees the same players.
  // Automatic cloud migration is disabled; migration must be triggered explicitly.
  useEffect(() => {
    hasSquadMigrationSettledRef.current = true;

    const unsubscribe = subscribeToSquadPlayers((cloudPlayers) => {
      if (cloudPlayers.length === 0 && !hasSquadMigrationSettledRef.current) {
        return;
      }
      const list: SquadPlayer[] = cloudPlayers.map(({ updatedAt, ...p }) => p);
      setSquadPlayers(list);
      try {
        localStorage.setItem('u17_squad_players', JSON.stringify(list));
      } catch (e) {
        console.warn('Squad roster local cache warning:', e);
      }
    }, () => {
      // Offline or subscription error: keep working with whatever is cached locally
    });

    return () => unsubscribe();
  }, []);

  // Physiotherapy Records — initial value is only a local cache for instant paint/offline;
  // Firestore is the source of truth (see subscription effect below).
  const initialPhysioRecordsRef = useRef<PhysioRecord[]>([]);
  const [physioRecords, setPhysioRecords] = useState<PhysioRecord[]>(() => {
    const computed = (() => {
      try {
        const saved = localStorage.getItem('u17_physio_records');
        if (saved) return JSON.parse(saved);
      } catch (e) {}
      return [
        {
          id: 'physio-demo-1',
          playerId: 'p9',
          playerName: 'Lateen Al-Sulami',
          injuryDate: new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0],
          injuryType: 'Ankle Sprain Grade II',
          severity: 'Moderate',
          status: 'Rehab / Field Work',
          treatmentNotes: 'Completed ice protocol and light straight-line running. Progressing to ball work.',
          estimatedReturnDate: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
          physioName: 'Dr. Sarah (Physio)',
          updatedAt: new Date().toISOString().split('T')[0]
        }
      ];
    })();
    initialPhysioRecordsRef.current = computed;
    return computed;
  });

  // Track whether the one-time physio records migration attempt has settled, so an empty
  // cloud collection while it's still in flight doesn't briefly flash an empty log.
  const hasPhysioMigrationSettledRef = useRef(false);

  // Subscribe to the shared cloud physio records in real time so every coach/physio sees the same log.
  // Automatic cloud migration is disabled; migration must be triggered explicitly.
  useEffect(() => {
    hasPhysioMigrationSettledRef.current = true;

    const unsubscribe = subscribeToPhysioRecords((cloudRecords) => {
      if (cloudRecords.length === 0 && !hasPhysioMigrationSettledRef.current) {
        return;
      }
      const list: PhysioRecord[] = cloudRecords.map(({ cloudUpdatedAt, ...r }) => r);
      setPhysioRecords(list);
      try {
        localStorage.setItem('u17_physio_records', JSON.stringify(list));
      } catch (e) {
        console.warn('Physio records local cache warning:', e);
      }
    }, () => {
      // Offline or subscription error: keep working with whatever is cached locally
    });

    return () => unsubscribe();
  }, []);

  // Excluded/removed players list ("Plantilla" deletions) — shared across the whole staff so a
  // deletion made by one coach applies for everyone, not just their own browser.
  const initialExcludedPlayersRef = useRef<string[]>([]);
  const [excludedPlayers, setExcludedPlayers] = useState<string[]>(() => {
    const computed = (() => {
      try {
        const saved = localStorage.getItem('u17_excluded_players');
        const list: string[] = saved ? JSON.parse(saved) : [];
        return list.filter(p => p.trim().toLowerCase() !== 'jalila');
      } catch {
        return [];
      }
    })();
    initialExcludedPlayersRef.current = computed;
    return computed;
  });

  const hasExcludedPlayersMigrationSettledRef = useRef(false);

  // Subscribe to the shared cloud excluded-players list in real time.
  // Automatic cloud migration is disabled; migration must be triggered explicitly.
  useEffect(() => {
    hasExcludedPlayersMigrationSettledRef.current = true;

    const unsubscribe = subscribeToExcludedPlayers((names) => {
      if (names.length === 0 && !hasExcludedPlayersMigrationSettledRef.current) {
        return;
      }
      const sanitized = names.filter(n => n.trim().toLowerCase() !== 'jalila');
      setExcludedPlayers(sanitized);
      try {
        localStorage.setItem('u17_excluded_players', JSON.stringify(sanitized));
      } catch (e) {
        console.warn('Excluded players local cache warning:', e);
      }
    }, () => {
      // Offline or subscription error: keep working with whatever is cached locally
    });

    return () => unsubscribe();
  }, []);

  const handleExcludePlayer = (playerName: string) => {
    const lower = playerName.trim().toLowerCase();
    const updated = Array.from(new Set([...excludedPlayers, lower]));
    setExcludedPlayers(updated);
    try {
      localStorage.setItem('u17_excluded_players', JSON.stringify(updated));
    } catch (e) {}
    addExcludedPlayers([lower]).catch(err => console.warn('Cloud save failed for excluded player:', err));
  };

  const handleIncludePlayer = (playerName: string) => {
    const lower = playerName.trim().toLowerCase();
    const updated = excludedPlayers.filter(name => name.toLowerCase() !== lower);
    setExcludedPlayers(updated);
    try {
      localStorage.setItem('u17_excluded_players', JSON.stringify(updated));
    } catch (e) {}
    removeExcludedPlayers([lower]).catch(err => console.warn('Cloud remove failed for excluded player:', err));
  };

  const initialTeamLogoRef = useRef('');
  const [teamLogo, setTeamLogo] = useState<string>(() => {
    const computed = OFFICIAL_ALULA_LOGO_DATA_URL;
    initialTeamLogoRef.current = computed;
    return computed;
  });

  const hasTeamLogoMigrationSettledRef = useRef(false);

  useEffect(() => {
    hasTeamLogoMigrationSettledRef.current = true;

    const unsubscribe = subscribeToTeamLogo((cloudLogo) => {
      if (!cloudLogo && !hasTeamLogoMigrationSettledRef.current) {
        return;
      }
      const nextLogo = cloudLogo || OFFICIAL_ALULA_LOGO_DATA_URL;
      setTeamLogo(nextLogo);
    }, () => {
      // Offline or subscription error: keep working with whatever is cached locally
    });

    return () => unsubscribe();
  }, []);

  const handleUpdateTeamLogo = (newLogo: string) => {
    setTeamLogo(newLogo);
    saveTeamLogo(newLogo).catch(err => console.warn('Cloud save failed for team logo:', err));
  };

  const initialVideoSessionsRef = useRef<VideoAnalysis[]>([]);
  const [videoSessions, setVideoSessions] = useState<VideoAnalysis[]>(() => {
    const computed = (() => {
      try {
        const saved = localStorage.getItem('u17_video_sessions');
        if (saved) return JSON.parse(saved);
      } catch (e) {}
      return [
        {
          id: 'video-demo-1',
          title: 'Tactical Build-Up Analysis',
          matchOrSessionDate: new Date().toISOString().split('T')[0],
          opponentOrTopic: 'vs Al-Ahli Pressing Block',
          videoUrl: 'https://youtube.com',
          gameMoment: 'Attack',
          tags: ['BuildUp', 'PressingTrigger', '3v2Overload'],
          keyTimestamps: [
            { time: '04:12', note: 'Central defender drops deep to create passing angle' },
            { time: '18:45', note: 'Winger inward cut creates central channel space' }
          ],
          summary: 'Review of positional distance between midfield pivots and fullbacks when building out under high press.',
          createdAt: new Date().toISOString().split('T')[0]
        }
      ];
    })();
    initialVideoSessionsRef.current = computed;
    return computed;
  });

  const hasVideoMigrationSettledRef = useRef(false);

  useEffect(() => {
    hasVideoMigrationSettledRef.current = true;

    const unsubscribe = subscribeToVideoAnalysis((cloudSessions) => {
      if (cloudSessions.length === 0 && !hasVideoMigrationSettledRef.current) {
        return;
      }
      const list: VideoAnalysis[] = cloudSessions.map(({ updatedAt, ...session }) => session);
      setVideoSessions(list);
      try {
        localStorage.setItem('u17_video_sessions', JSON.stringify(list));
      } catch (e) {
        console.warn('Video sessions local cache warning:', e);
      }
    }, () => {
      // Offline or subscription error: keep working with whatever is cached locally
    });

    return () => unsubscribe();
  }, []);

  const initialCompetitionFixturesRef = useRef<MatchFixture[]>([]);
  const [competitionFixtures, setCompetitionFixtures] = useState<MatchFixture[]>(() => {
    const computed = (() => {
      try {
        const saved = localStorage.getItem('u17_competition_fixtures');
        if (saved) return JSON.parse(saved);
      } catch (e) {}
      return DEFAULT_MATCHES;
    })();
    initialCompetitionFixturesRef.current = computed;
    return computed;
  });

  const hasCompetitionFixturesMigrationSettledRef = useRef(false);

  useEffect(() => {
    hasCompetitionFixturesMigrationSettledRef.current = true;

    const unsubscribe = subscribeToCompetitionFixtures((cloudFixtures) => {
      if (cloudFixtures.length === 0 && !hasCompetitionFixturesMigrationSettledRef.current) {
        return;
      }
      const list: MatchFixture[] = cloudFixtures.map(({ updatedAt, ...fixture }) => fixture);
      setCompetitionFixtures(list);
      try {
        localStorage.setItem('u17_competition_fixtures', JSON.stringify(list));
      } catch (e) {
        console.warn('Competition fixtures local cache warning:', e);
      }
    }, () => {
      // Offline or subscription error: keep working with whatever is cached locally
    });

    return () => unsubscribe();
  }, []);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = subscribeToAuth((user) => {
      setCurrentUser(user);
      setIsAuthInitializing(false);
    });
    return () => unsubscribe();
  }, []);

  // Load and merge into a single unified session.
  // Firestore is now the source of truth for the shared sessions list; localStorage
  // is only kept as a transient cache for the current browser and must not decide
  // which session the user sees.
  const [session, setSession] = useState<TrainingSession>(() => {
    const starter = getEmptySession();
    return normalizeSessionRoster({
      ...starter,
      id: 'memory-session-' + Date.now(),
      sessionNumber: '001',
      date: new Date().toISOString().split('T')[0],
      teamName: 'U17 Women Al Ula',
    });
  });

  const [expandedExercises, setExpandedExercises] = useState<Record<string, boolean>>({});

  const [cloudSessions, setCloudSessions] = useState<CloudTrainingSession[]>(() => readCachedCloudSessions());
  const [isLoadingCloud, setIsLoadingCloud] = useState(true);
  const [isCloudSaving, setIsCloudSaving] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [, setPermissionsSyncVersion] = useState(0);

  // Visible feedback for cloud sync activity (Bloque 2, tarea 1): replaces silent console.warn-only failures.
  const [cloudSyncStatus, setCloudSyncStatus] = useState<{ status: 'idle' | 'saving' | 'retrying' | 'offline-queued' | 'saved' | 'error'; message?: string }>({ status: 'idle' });
  // Set when Firestore pushes a newer version of the session the user is CURRENTLY editing
  // while there are unsaved local changes — never silently overwritten (Bloque 2, tarea 3/4).
  const [remoteSessionConflict, setRemoteSessionConflict] = useState<CloudTrainingSession | null>(null);

  const [libraryCount, setLibraryCount] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('u17_custom_exercise_library');
      if (saved) return JSON.parse(saved).length;
      return 5;
    } catch (e) {
      return 0;
    }
  });

  const squadStatistics = useMemo(() => {
    return calculateSquadStatistics({
      players: squadPlayers,
      sessions: [session, ...cloudSessions],
      excludedPlayers
    });
  }, [cloudSessions, excludedPlayers, session, squadPlayers]);

  const squadPlayersWithStats = squadStatistics.players;

  // Single app-level permissions sync initialization (avoids duplicate initializations across components).
  useEffect(() => {
    if (!currentUser?.email) return;
    const unsubscribe = initPermissionsCloudSync(() => {
      setPermissionsSyncVersion(v => v + 1);
    });
    return () => unsubscribe();
  }, [currentUser?.email]);

  useEffect(() => {
    const isDark = themeMode === 'dark';
    document.documentElement.classList.toggle('dark', isDark);
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
    try {
      localStorage.setItem('u17_theme_mode', themeMode);
    } catch (e) {}
  }, [themeMode]);

  useEffect(() => {
    const updateCount = () => {
      try {
        const saved = localStorage.getItem('u17_custom_exercise_library');
        if (saved) setLibraryCount(JSON.parse(saved).length);
      } catch (e) {}
    };
    updateCount();
    window.addEventListener('storage', updateCount);
    return () => window.removeEventListener('storage', updateCount);
  }, [activeSection]);

  // Refs to avoid infinite re-save loops between cloud and local state
  const isRemoteUpdateRef = useRef(false);
  const hasInitialCloudLoadedRef = useRef(false);
  // Track timestamps per role to detect conflicts only for the fields each role owns
  const lastLoadedSessionTimeRef = useRef<{
    global: number;
    football: number;
    fitness: number;
    gk: number;
  }>({
    global: 0,
    football: 0,
    fitness: 0,
    gk: 0
  });
  const currentSessionIdRef = useRef<string>('');
  const activeSectionRef = useRef<PortalSection>(activeSection);
  const latestSessionRef = useRef<TrainingSession>(session);
  const lastSavedJsonRef = useRef<string>('');
  const lastKnownRemoteTimestampRef = useRef<{
    sessionId: string;
    global: number;
    football: number;
    fitness: number;
    gk: number;
  }>({
    sessionId: '',
    global: 0,
    football: 0,
    fitness: 0,
    gk: 0
  });
  const hasRestoredWorkspaceRef = useRef(false);

  const initializeSessionSyncState = (
    targetSession: TrainingSession,
    timestamps?: {
      global?: number;
      football?: number;
      fitness?: number;
      gk?: number;
    }
  ) => {
    const globalTime = timestamps?.global ?? 0;
    const nextTimestamps = {
      global: globalTime,
      football: timestamps?.football ?? globalTime,
      fitness: timestamps?.fitness ?? globalTime,
      gk: timestamps?.gk ?? globalTime
    };

    currentSessionIdRef.current = targetSession.id;
    lastSavedJsonRef.current = getSessionSyncSignature(targetSession);
    lastLoadedSessionTimeRef.current = nextTimestamps;
    lastKnownRemoteTimestampRef.current = {
      sessionId: targetSession.id,
      ...nextTimestamps
    };
    setRemoteSessionConflict(null);
  };

  const markActiveSessionSyncProgress = (
    role: 'football' | 'fitness' | 'gk',
    timestamp: number,
    sessionSignature: string
  ) => {
    const nextTimestamps = {
      ...lastLoadedSessionTimeRef.current,
      [role]: timestamp,
      global: timestamp
    };

    lastLoadedSessionTimeRef.current = nextTimestamps;
    lastSavedJsonRef.current = sessionSignature;
    lastKnownRemoteTimestampRef.current = {
      sessionId: currentSessionIdRef.current,
      ...nextTimestamps
    };
  };

  useEffect(() => {
    activeSectionRef.current = activeSection;
  }, [activeSection]);

  useEffect(() => {
    const saved = readSavedAppContext();
    if (!saved?.route) return;

    try {
      const currentUrl = new URL(window.location.href);
      if (currentUrl.searchParams.get('session')) return;

      const savedUrl = new URL(saved.route, window.location.origin);
      const nextRoute = `${savedUrl.pathname}${savedUrl.search}${savedUrl.hash}`;
      const currentRoute = `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`;
      if (nextRoute !== currentRoute && window.history.replaceState) {
        window.history.replaceState({}, '', nextRoute);
      }
    } catch (e) {
      console.warn('App context route restore failed:', e);
    }
  }, []);

  // teamLogo is intentionally local-only (not persisted in session docs), so it must
  // be excluded from sync comparisons to avoid false "unsaved/conflict" detections.
  const getSessionSyncSignature = (value: Partial<TrainingSession> | null | undefined): string => {
    if (!value) return '';
    const { teamLogo: _logo, ...rest } = value as TrainingSession;
    return JSON.stringify(rest);
  };

  // Keep latest session ref in sync for window unload / visibilitychange handlers
  useEffect(() => {
    latestSessionRef.current = session;
  }, [session]);

  useEffect(() => {
    setRemoteSessionConflict((prev) => {
      if (!prev) return prev;
      return prev.id === session.id ? prev : null;
    });
  }, [session.id]);

  useEffect(() => {
    const persistContext = () => {
      const route = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      writeWorkspaceRestoreState(APP_CONTEXT_STORAGE_KEY, {
        activeSection,
        sessionId: session.id,
        route,
        scrollY: window.scrollY
      } satisfies AppContextSnapshot);
    };

    persistContext();
    window.addEventListener('beforeunload', persistContext);
    window.addEventListener('pagehide', persistContext);
    return () => {
      window.removeEventListener('beforeunload', persistContext);
      window.removeEventListener('pagehide', persistContext);
    };
  }, [activeSection, session.id]);

  useEffect(() => {
    if (isAuthInitializing || !currentUser || requiresSharedLinkLogin || hasRestoredWorkspaceRef.current) {
      return;
    }

    const saved = readSavedAppContext();
    hasRestoredWorkspaceRef.current = true;
    if (!saved) return;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo({ top: saved.scrollY || 0, behavior: 'auto' });
      });
    });
  }, [currentUser, isAuthInitializing, requiresSharedLinkLogin]);

  // Applies a cloud session snapshot to local state/localStorage/URL. Shared by the initial
  // load, the "no local edits pending" auto-refresh case, and the conflict banner's Reload action.
  const applyCloudSessionToState = (sessionToLoad: CloudTrainingSession) => {
    const cloudTime = sessionToLoad.updatedAt || 0;
    hasInitialCloudLoadedRef.current = true;

    const { updatedAt, footballUpdatedAt, fitnessUpdatedAt, gkUpdatedAt, teamLogo: _legacyLogo, ...baseSession } = sessionToLoad as CloudTrainingSession & { teamLogo?: string };

    // Normalize old team names if needed
    if (baseSession.teamName === 'U17 Girls A.D. San Pedro') {
      baseSession.teamName = 'U17 Women Al Ula';
    }
    if (baseSession.sessionNumber === '42') {
      baseSession.sessionNumber = '001';
    }

    const unifiedSession: TrainingSession = normalizeSessionRoster(hydrateTrainingSession({
      ...baseSession,
    }));

    isRemoteUpdateRef.current = true;
    initializeSessionSyncState(unifiedSession, {
      global: cloudTime,
      football: sessionToLoad.footballUpdatedAt || cloudTime,
      fitness: sessionToLoad.fitnessUpdatedAt || 0,
      gk: sessionToLoad.gkUpdatedAt || cloudTime
    });
    setSession(unifiedSession);

    if (unifiedSession.id && window.history.replaceState) {
      const url = new URL(window.location.href);
      if (url.searchParams.get('session') !== unifiedSession.id) {
        url.searchParams.set('session', unifiedSession.id);
        window.history.replaceState({}, '', url.toString());
      }
    }
  };

  // Subscribe to ALL unified sessions from Cloud Firestore and auto-load the active session on first load & real-time updates
  useEffect(() => {
    setIsLoadingCloud(true);
    const unsubscribe = subscribeTrainingSessions(
      (sessions) => {
        setCloudSessions(sessions);
        try {
          localStorage.setItem(CLOUD_SESSIONS_CACHE_KEY, JSON.stringify(sessions));
        } catch (e) {}
        setIsLoadingCloud(false);

        if (sessions.length > 0) {
          // Read URL query parameters to see if a specific session ID was requested
          const urlParams = new URLSearchParams(window.location.search);
          const targetId = urlParams.get('session');
          const isFirstLoad = !hasInitialCloudLoadedRef.current;
          const currentId = currentSessionIdRef.current;
          const activeSessionStillExists = currentId ? sessions.some(s => s.id === currentId) : false;
          const activeSessionSnapshot = currentId
            ? sessions.find(s => s.id === currentId)
            : undefined;

          // If a specific ID is requested in the URL, use it; otherwise fallback to sessions[0]
          // (most recent session by date) ONLY on the very first cold start.
          let sessionToLoad = targetId
            ? sessions.find(s => s.id === targetId)
            : (isFirstLoad ? sessions[0] : sessions.find(s => s.id === currentId));

          if (targetId && !sessionToLoad && currentSessionIdRef.current === targetId) {
            // Requested session hasn't reached Firestore yet — keep showing what we have.
            hasInitialCloudLoadedRef.current = true;
            return;
          }

          if (!activeSessionStillExists && !sessionToLoad) {
            sessionToLoad = sessions[0];
          }

          if (sessionToLoad) {
            const isDifferentSession = sessionToLoad.id !== currentSessionIdRef.current;

            if (isFirstLoad) {
              // Firestore is the source of truth for the active session on first load.
              applyCloudSessionToState(sessionToLoad);
            } else if (isDifferentSession) {
              // Never rip the screen out from under the user just because a DIFFERENT
              // session changed elsewhere in Firestore (Bloque 2, tarea 3).
              if (!activeSessionStillExists) {
                applyCloudSessionToState(sessionToLoad);
              }
            } else if (activeSessionSnapshot) {
              const cloudTime = activeSessionSnapshot.updatedAt || 0;
              const currentModuleId = getModuleIdFromSection(activeSectionRef.current) || DEFAULT_MODULE_ID;
              const syncBaseline = lastKnownRemoteTimestampRef.current.sessionId === activeSessionSnapshot.id
                ? lastKnownRemoteTimestampRef.current
                : {
                    sessionId: activeSessionSnapshot.id,
                    ...lastLoadedSessionTimeRef.current
                  };
              const hasRemoteChanges = currentModuleId === 'gk'
                ? (activeSessionSnapshot.gkUpdatedAt || cloudTime) !== syncBaseline.gk
                : currentModuleId === 'fitness'
                  ? (activeSessionSnapshot.fitnessUpdatedAt || 0) !== syncBaseline.fitness
                  : cloudTime !== syncBaseline.global || (activeSessionSnapshot.footballUpdatedAt || cloudTime) !== syncBaseline.football;

              if (hasRemoteChanges) {
                const hasUnsavedChanges = getSessionSyncSignature(latestSessionRef.current) !== lastSavedJsonRef.current;
                if (!hasUnsavedChanges) {
                  // No local edits at risk — safe to silently pick up the remote update.
                  applyCloudSessionToState(activeSessionSnapshot);
                } else {
                  // Someone else saved this same session while we have unsaved local edits.
                  // Surface it instead of silently overwriting (Bloque 2, tarea 3/4).
                  setRemoteSessionConflict(activeSessionSnapshot);
                }
              }
            }
          }
        }
        hasInitialCloudLoadedRef.current = true;
      },
      () => {
        setIsLoadingCloud(false);
        hasInitialCloudLoadedRef.current = true;
        const cachedSessions = readCachedCloudSessions();
        if (cachedSessions.length > 0) {
          setCloudSessions(cachedSessions);
        }
        markQuotaExceeded();
        console.warn('Firestore subscription offline or quota limit reached.');
      }
    );
    return () => unsubscribe();
  }, []);

  // Mirror low-level cloud save activity (saving/retrying/queued/saved) into visible UI state.
  useEffect(() => {
    const SESSION_SYNC_SCOPE = 'sessions';
    const unsubscribe = subscribeSyncStatus((event) => {
      // Keep this banner focused on training session saves; other collections
      // (permissions, fixtures, etc.) should not surface as a global save warning on load.
      if (event.scope !== SESSION_SYNC_SCOPE) return;

      if (event.status === 'saved') {
        setCloudSyncStatus({ status: 'saved' });
        setTimeout(() => {
          setCloudSyncStatus(prev => (prev.status === 'saved' ? { status: 'idle' } : prev));
        }, 2500);
      } else {
        setCloudSyncStatus({ status: event.status, message: event.message });
      }
    });
    return unsubscribe;
  }, []);

  // Retry anything left in the pending-write queue (Bloque 2, tarea 5): on app start,
  // whenever the browser regains connectivity, and whenever the tab becomes visible again.
  useEffect(() => {
    flushPendingWrites().catch(() => {});
    const handleOnline = () => { flushPendingWrites().catch(() => {}); };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        flushPendingWrites().catch(() => {});
      }
    };
    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);


  // Keep refs and URL in sync with the active cloud-backed session
  useEffect(() => {
    latestSessionRef.current = session;
    currentSessionIdRef.current = session.id;

    if (session.id && window.history.replaceState) {
      try {
        const url = new URL(window.location.href);
        if (url.searchParams.get('session') !== session.id) {
          url.searchParams.set('session', session.id);
          window.history.replaceState({}, '', url.toString());
        }
      } catch (e) {
        console.warn('URL update failed:', e);
      }
    }
  }, [session]);

  const handleUpdateSession = (fields: Partial<TrainingSession>) => {
    if (typeof fields.teamLogo === 'string') {
      handleUpdateTeamLogo(fields.teamLogo);
    }
    const { teamLogo: _logo, ...safeFields } = fields;
    setSession(prev => ({
      ...prev,
      ...safeFields
    }));
  };

  const handleUpdateExercises = (blockKey: 'warmUp' | 'mainPart' | 'coolDown', exercises: Exercise[]) => {
    const moduleId = getModuleIdFromSection(activeSection) || DEFAULT_MODULE_ID;
    setSession(prev => updateSessionExercisesByModule(prev, moduleId, blockKey, exercises));
  };

  const handleAddExerciseFromLibrary = (
    blockKey: 'warmUp' | 'mainPart' | 'coolDown',
    exercise: Exercise,
    targetSection?: 'football' | 'fitness' | 'gk'
  ) => {
    const section = targetSection || (activeSection === 'exercises' ? DEFAULT_MODULE_ID : activeSection);
    const moduleId = section === 'football' || section === 'fitness' || section === 'gk'
      ? section
      : DEFAULT_MODULE_ID;

    setSession(prev => addExerciseToSessionByModule(prev, moduleId, blockKey, exercise));

    if (exercise.id) {
      setExpandedExercises(prev => ({ ...prev, [exercise.id]: true }));
    }
  };

  const handleUpdateGroups = (playerGroups: PlayerGroup[]) => {
    const moduleId = getModuleIdFromSection(activeSection) || DEFAULT_MODULE_ID;
    setSession(prev => updateSessionGroupsByModule(prev, moduleId, playerGroups));
  };

  const handleUpdateRoster = (squadRoster: string[]) => {
    setSession(prev => ({
      ...prev,
      squadRoster
    }));
  };

  const handleUpdateSquadPlayers = (updated: SquadPlayer[]) => {
    const previous = squadPlayers;
    setSquadPlayers(updated);
    try {
      localStorage.setItem('u17_squad_players', JSON.stringify(updated));
    } catch (e) {}

    // Sync only what changed to Firestore (per-player docs), so simultaneous edits by different
    // coaches never overwrite each other's changes to a different player.
    const previousById = new Map(previous.map(p => [p.id, p]));
    const updatedIds = new Set(updated.map(p => p.id));

    updated.forEach(player => {
      const prevPlayer = previousById.get(player.id);
      if (!prevPlayer || JSON.stringify(prevPlayer) !== JSON.stringify(player)) {
        saveSquadPlayer(player).catch(err => console.warn('Cloud save failed for squad player:', err));
      }
    });

    previous.forEach(player => {
      if (!updatedIds.has(player.id)) {
        deleteSquadPlayer(player.id).catch(err => console.warn('Cloud delete failed for squad player:', err));
      }
    });

    const formattedRoster = updated.map(p => 
      p.position === 'GK' ? `${p.firstName} (GK)` : `${p.firstName} ${p.lastName}`
    );
    handleUpdateRoster(formattedRoster);
  };

  const attendanceStatsChanged = (previous?: SquadPlayer['attendanceStats'], next?: SquadPlayer['attendanceStats']) => {
    if (!previous && !next) return false;
    if (!previous || !next) return true;
    return (
      previous.attended !== next.attended ||
      previous.total !== next.total ||
      previous.percentage !== next.percentage ||
      previous.ranking !== next.ranking
    );
  };

  useEffect(() => {
    if (!cloudSessions.some((s) => Array.isArray(s.attendance) && s.attendance.length > 0) && !(session.attendance || []).length) {
      return;
    }

    const previousById = new Map(squadPlayers.map((player) => [player.id, player]));
    const nextPlayers = squadStatistics.players;
    const needsSync = nextPlayers.some((player) => {
      const previous = previousById.get(player.id);
      return attendanceStatsChanged(previous?.attendanceStats, player.attendanceStats);
    });

    if (!needsSync) return;

    handleUpdateSquadPlayers(nextPlayers);
  }, [cloudSessions, session.attendance, squadPlayers, squadStatistics.players]);

  const handleApplyMalikaPoints = ({
    sessionId,
    exerciseId,
    challenge,
    awards
  }: {
    sessionId: string;
    exerciseId: string;
    challenge: string;
    awards: Array<{ playerId: string; points: number }>;
  }) => {
    if (!sessionId || !exerciseId || awards.length === 0) return;

    const awardedAt = Date.now();
    const currentById = new Map(squadPlayers.map((player) => [player.id, player]));
    const updatedPlayers = [...squadPlayers];

    awards.forEach(({ playerId, points }) => {
      const current = currentById.get(playerId);
      if (!current) return;

      const nextHistory = [
        {
          sessionId,
          exerciseId,
          date: awardedAt,
          challenge,
          points
        },
        ...(current.malikaHistory || [])
      ];

      const nextPlayer: SquadPlayer = {
        ...current,
        malikaPoints: (current.malikaPoints || 0) + points,
        malikaHistory: nextHistory
      };

      currentById.set(playerId, nextPlayer);
    });

    const nextPlayers = updatedPlayers.map((player) => currentById.get(player.id) || player);
    handleUpdateSquadPlayers(nextPlayers);
  };

  const handleUpdatePhysioRecords = (records: PhysioRecord[]) => {
    const previous = physioRecords;
    setPhysioRecords(records);
    try {
      localStorage.setItem('u17_physio_records', JSON.stringify(records));
    } catch (e) {}

    // Sync only what changed to Firestore (per-record docs), so simultaneous edits by different
    // staff members never overwrite each other's changes to a different record.
    const previousById = new Map(previous.map(r => [r.id, r]));
    const updatedIds = new Set(records.map(r => r.id));

    records.forEach(record => {
      const prevRecord = previousById.get(record.id);
      if (!prevRecord || JSON.stringify(prevRecord) !== JSON.stringify(record)) {
        savePhysioRecordToCloud(record).catch(err => console.warn('Cloud save failed for physio record:', err));
      }
    });

    previous.forEach(record => {
      if (!updatedIds.has(record.id)) {
        deletePhysioRecordFromCloud(record.id).catch(err => console.warn('Cloud delete failed for physio record:', err));
      }
    });
  };

  const handleUpdateSquadStatusFromPhysio = (playerId: string, newStatus: SquadPlayer['status']) => {
    const updated = squadPlayers.map(p => p.id === playerId ? { ...p, status: newStatus } : p);
    handleUpdateSquadPlayers(updated);
  };

  const handleUpdateVideoSessions = (sessionsList: VideoAnalysis[]) => {
    setVideoSessions(prev => {
      const previous = prev;
      try {
        localStorage.setItem('u17_video_sessions', JSON.stringify(sessionsList));
      } catch (e) {}

      const previousById = new Map(previous.map(session => [session.id, session]));
      const updatedIds = new Set(sessionsList.map(session => session.id));

      sessionsList.forEach(session => {
        const previousSession = previousById.get(session.id);
        if (!previousSession || JSON.stringify(previousSession) !== JSON.stringify(session)) {
          saveVideoAnalysisToCloud(session).catch(err => console.warn('Cloud save failed for video analysis:', err));
        }
      });

      previous.forEach(session => {
        if (!updatedIds.has(session.id)) {
          deleteVideoAnalysisFromCloud(session.id).catch(err => console.warn('Cloud delete failed for video analysis:', err));
        }
      });

      return sessionsList;
    });
  };

  const handleUpdateCompetitionFixtures = (fixturesList: MatchFixture[]) => {
    setCompetitionFixtures(prev => {
      const previous = prev;
      try {
        localStorage.setItem('u17_competition_fixtures', JSON.stringify(fixturesList));
      } catch (e) {}

      const previousById = new Map(previous.map(fixture => [fixture.id, fixture]));
      const updatedIds = new Set(fixturesList.map(fixture => fixture.id));

      fixturesList.forEach(fixture => {
        const previousFixture = previousById.get(fixture.id);
        if (!previousFixture || JSON.stringify(previousFixture) !== JSON.stringify(fixture)) {
          saveCompetitionFixtureToCloud(fixture).catch(err => console.warn('Cloud save failed for competition fixture:', err));
        }
      });

      previous.forEach(fixture => {
        if (!updatedIds.has(fixture.id)) {
          deleteCompetitionFixtureFromCloud(fixture.id).catch(err => console.warn('Cloud delete failed for competition fixture:', err));
        }
      });

      return fixturesList;
    });
  };

  const handleUpdateAttendance = (attendance: PlayerAttendance[]) => {
    setSession(prev => ({
      ...prev,
      attendance
    }));
  };

  const getActiveLogo = () => {
    return teamLogo || OFFICIAL_ALULA_LOGO_DATA_URL;
  };

  const handleClearSession = () => {
    if (confirm(`Are you sure you want to clear the entire session? This will delete all exercises and text for all section tabs.`)) {
      const empty = getEmptySession();
      const optimisticTime = Date.now();
      initializeSessionSyncState(empty, {
        global: optimisticTime,
        football: optimisticTime,
        fitness: optimisticTime,
        gk: optimisticTime
      });
      setSession({
        ...empty
      });
      setExpandedExercises({});
    }
  };

  const handleSaveActiveToCloud = async () => {
    const role = getModuleIdFromSection(activeSection) || DEFAULT_MODULE_ID;

    // Role-specific conflict check: only compare the timestamp for fields this role owns
    const cloudCopy = cloudSessions.find(s => s.id === session.id);
    if (cloudCopy) {
      const cloudRoleTime = getModuleCloudUpdatedAt(cloudCopy, role);
      const localRoleTime = lastLoadedSessionTimeRef.current[role];

      if (cloudRoleTime > localRoleTime) {
        const roleLabel = getModuleRoleLabel(role);
        const overwrite = confirm(
          `Los campos de ${roleLabel} fueron actualizados por otra persona mientras editabas.\n\n` +
          'Aceptar = sobrescribir con TUS cambios.\nCancelar = mantener tus cambios sin subir y revisar la otra versión primero.'
        );
        if (!overwrite) {
          setRemoteSessionConflict(cloudCopy);
          return;
        }
      }
    }

    try {
      setIsCloudSaving(true);
      const sessionToSave: TrainingSession = {
        ...session,
        teamName: session.teamName === 'U17 Girls A.D. San Pedro' ? 'U17 Women Al Ula' : session.teamName
      };

      setSession(sessionToSave);

      // Optimistically update references BEFORE cloud save to avoid false conflict detection
      // when our own write echoes back through the subscription listener
      const optimisticTime = Date.now();
      markActiveSessionSyncProgress(role, optimisticTime, getSessionSyncSignature(sessionToSave));

      try {
        const { savedAt: savedTime } = await saveTrainingSessionBySection(activeSection, sessionToSave);
        
        // Update with the actual server timestamp
        markActiveSessionSyncProgress(role, savedTime, getSessionSyncSignature(sessionToSave));
        clearQuotaExceeded();
        alert('Changes saved to the cloud and synced across all your devices!');
      } catch (cloudErr) {
        const errorCode = cloudErr && typeof cloudErr === 'object' && 'code' in cloudErr ? String((cloudErr as { code?: unknown }).code) : 'unknown';
        console.error('[handleSaveActiveToCloud] Cloud save failed:', cloudErr);
        setCloudSyncStatus({ status: 'error', message: `Guardar sesión falló (${errorCode})` });
        alert(`Guardado localmente, pendiente de subir a la nube. Código: ${errorCode}`);
      }
    } catch (error) {
      const errorCode = error && typeof error === 'object' && 'code' in error ? String((error as { code?: unknown }).code) : 'unknown';
      console.error('[handleSaveActiveToCloud] Error saving session:', error);
      setCloudSyncStatus({ status: 'error', message: `Guardar sesión falló (${errorCode})` });
      alert('Saved in your browser!');
    } finally {
      setIsCloudSaving(false);
    }
  };

  const handleCreateNewCloudSession = async () => {
    const newNumber = prompt('Enter new session number:', '1');
    if (newNumber === null) return;

    const role = getModuleIdFromSection(activeSection) || DEFAULT_MODULE_ID;

    const empty = getEmptySession();
    const newId = 'session-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
    const today = new Date().toISOString().split('T')[0];

    const newSession: TrainingSession = normalizeSessionRoster({
      ...empty,
      id: newId,
      sessionNumber: newNumber,
      date: today,
      teamName: 'U17 Women Al Ula',
    });

    try {
      setIsCloudSaving(true);
      const optimisticTime = Date.now();
      initializeSessionSyncState(newSession, {
        global: optimisticTime,
        football: role === 'football' ? optimisticTime : 0,
        fitness: role === 'fitness' ? optimisticTime : 0,
        gk: role === 'gk' ? optimisticTime : 0
      });
      setSession(newSession);

      // New sessions are created through the same modular save pipeline as any other save.
      try {
        const { savedAt: savedTime } = await saveTrainingSessionBySection(activeSection, newSession);
        initializeSessionSyncState(newSession, {
          global: savedTime,
          football: role === 'football' ? savedTime : 0,
          fitness: role === 'fitness' ? savedTime : 0,
          gk: role === 'gk' ? savedTime : 0
        });
      } catch (cloudErr) {
        const errorCode = cloudErr && typeof cloudErr === 'object' && 'code' in cloudErr ? String((cloudErr as { code?: unknown }).code) : 'unknown';
        console.error('[handleCreateNewCloudSession] Cloud save failed:', cloudErr);
        setCloudSyncStatus({ status: 'error', message: `Crear sesión falló (${errorCode})` });
      }
    } catch (error) {
      const errorCode = error && typeof error === 'object' && 'code' in error ? String((error as { code?: unknown }).code) : 'unknown';
      console.error('[handleCreateNewCloudSession] Error creating new session:', error);
      setCloudSyncStatus({ status: 'error', message: `Crear sesión falló (${errorCode})` });
    } finally {
      setIsCloudSaving(false);
    }
  };

  const handleLoadCloudSession = (loadedSession: CloudTrainingSession) => {
    if (confirm(`Do you want to load session #${loadedSession.sessionNumber} (${loadedSession.date})? Your current unsaved local changes will be replaced.`)) {
      const { teamLogo: _legacyLogo, ...baseSession } = loadedSession as CloudTrainingSession & { teamLogo?: string };

      // Upgrade fitness and GK fields if missing from loaded old document
      const unifiedSession: TrainingSession = normalizeSessionRoster(hydrateTrainingSession({
        ...baseSession,
        teamName: baseSession.teamName === 'U17 Girls A.D. San Pedro' ? 'U17 Women Al Ula' : baseSession.teamName,
      }));

      if (unifiedSession.id && window.history.replaceState) {
        const url = new URL(window.location.href);
        url.searchParams.set('session', unifiedSession.id);
        window.history.replaceState({}, '', url.toString());
      }

      applyCloudSessionToState({
        ...loadedSession,
        ...unifiedSession
      });
      
      // Expand exercises of loaded session
      const expanded: Record<string, boolean> = {};
      const moduleId = getModuleIdFromSection(activeSection) || DEFAULT_MODULE_ID;
      const moduleSessionView = getModuleSessionView(unifiedSession, moduleId);

      moduleSessionView.warmUp.exercises.forEach(ex => { expanded[ex.id] = true; });
      moduleSessionView.mainPart.exercises.forEach(ex => { expanded[ex.id] = true; });
      moduleSessionView.coolDown.exercises.forEach(ex => { expanded[ex.id] = true; });
      setExpandedExercises(expanded);
    }
  };

  const handleDeleteCloudSession = async (sessionId: string, sessionNum: string, event: React.MouseEvent) => {
    event.stopPropagation(); // prevent loading when clicking delete
    if (confirm(`Are you absolutely sure you want to delete session #${sessionNum} from the cloud database? This cannot be undone.`)) {
      try {
        setIsCloudSaving(true);
        await deleteTrainingSession(sessionId);

        // If the deleted session is currently active in React state:
        if (session.id === sessionId) {
          const remaining = cloudSessions.filter(s => s.id !== sessionId);
          if (remaining.length > 0) {
            const nextSession = remaining[0];
            applyCloudSessionToState(nextSession);
          } else {
            // No sessions left in cloud, create a fresh session
            const empty = getEmptySession();
            const newId = 'session-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
            const today = new Date().toISOString().split('T')[0];

            const newSession: TrainingSession = {
              ...empty,
              id: newId,
              sessionNumber: '001',
              date: today,
              teamName: 'U17 Women Al Ula',
            };

            const optimisticTime = Date.now();
            initializeSessionSyncState(newSession, {
              global: optimisticTime,
              football: optimisticTime,
              fitness: optimisticTime,
              gk: optimisticTime
            });
            setSession(newSession);

            if (window.history.replaceState) {
              const url = new URL(window.location.href);
              url.searchParams.delete('session');
              window.history.replaceState({}, '', url.toString());
            }
          }
        }
      } catch (error) {
        console.error('Error deleting session:', error);
        alert('Failed to delete session from the cloud.');
      } finally {
        setIsCloudSaving(false);
      }
    }
  };

  const handleCopyShareLink = async () => {
    const role = getModuleIdFromSection(activeSection) || DEFAULT_MODULE_ID;

    try {
      setIsCloudSaving(true);
      const sessionToSave: TrainingSession = {
        ...session,
        teamName: session.teamName === 'U17 Girls A.D. San Pedro' ? 'U17 Women Al Ula' : session.teamName
      };

      setSession(sessionToSave);

      // 2. Optimistically update references to prevent false conflict detection
      const optimisticTime = Date.now();
      markActiveSessionSyncProgress(role, optimisticTime, getSessionSyncSignature(sessionToSave));

      // 3. Try Cloud Firestore save (only save fields for current role)
      try {
        const { savedAt: savedTime } = await saveTrainingSessionBySection(activeSection, sessionToSave);
        markActiveSessionSyncProgress(role, savedTime, getSessionSyncSignature(sessionToSave));
      } catch (cloudErr) {
        const errorCode = cloudErr && typeof cloudErr === 'object' && 'code' in cloudErr ? String((cloudErr as { code?: unknown }).code) : 'unknown';
        console.error('[handleCopyShareLink] Cloud save failed:', cloudErr);
        setCloudSyncStatus({ status: 'error', message: `Compartir sesión falló (${errorCode})` });
      }

      // 4. Build sharing URL with target session ID
      const url = new URL(window.location.href);
      url.searchParams.set('session', sessionToSave.id);

      if (window.history.replaceState) {
        window.history.replaceState({}, '', url.toString());
      }

      await navigator.clipboard.writeText(url.toString());
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 3000);
      alert('Link copied to clipboard! Other users will see your changes in real time in the cloud.');
    } catch (error) {
      console.error('Error copying share link:', error);
      const url = new URL(window.location.href);
      url.searchParams.set('session', session.id);
      alert('Session link: ' + url.toString());
    } finally {
      setIsCloudSaving(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedExercises(prev => ({
      ...prev,
      [id]: prev[id] === false ? true : false
    }));
  };

  const sharedHeader = getSharedSessionHeader(session, lastLoadedSessionTimeRef.current.global);
  const fullSquadRoster = session.squadRoster || squadPlayersWithStats.map(p => `${p.firstName} ${p.lastName}`);
  const goalkeeperRoster = squadPlayersWithStats
    .filter((player) => player.position === 'GK')
    .map((player) => `${player.firstName} (GK)`);

  const renderThemeToggle = () => (
    <div className="fixed top-4 right-4 z-[90] print:hidden">
      <button
        type="button"
        onClick={() => setThemeMode((prev) => (prev === 'dark' ? 'light' : 'dark'))}
        className="inline-flex items-center gap-2 rounded-xl bg-[#002142] hover:bg-[#0f5981] text-white border border-white/20 px-3 py-2 text-xs font-extrabold tracking-wide shadow-lg transition-colors"
        aria-label="Cambiar modo oscuro"
        title={themeMode === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      >
        {themeMode === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        <span>{themeMode === 'dark' ? 'Modo claro' : 'Modo oscuro'}</span>
      </button>
    </div>
  );

  const handleReloadRemoteSession = () => {
    if (remoteSessionConflict) {
      applyCloudSessionToState(remoteSessionConflict);
    }
  };

  const handleKeepLocalChanges = () => {
    setRemoteSessionConflict(null);
  };

  const handleLoginSuccess = () => {
    setRequiresSharedLinkLogin(false);
  };

  const handleLogout = async () => {
    setRequiresSharedLinkLogin(false);
    clearWorkspaceRestoreState();
    await logoutUser();
  };

  // Visible cloud-sync feedback (Bloque 2, tarea 1): saving/retrying/offline-queued/conflict banners.
  const renderSyncBanner = () => {
    if (remoteSessionConflict) {
      return (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[95] print:hidden w-[92%] max-w-xl">
          <div className="bg-amber-500 text-slate-950 rounded-xl shadow-xl px-4 py-3 flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-xs font-bold">
            <span className="flex-1 text-center sm:text-left">
              Esta sesión #{remoteSessionConflict.sessionNumber} fue actualizada por otra persona, revisa los cambios.
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleReloadRemoteSession}
                className="px-3 py-1.5 bg-slate-950 text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                Recargar su versión
              </button>
              <button
                type="button"
                onClick={handleKeepLocalChanges}
                className="px-3 py-1.5 bg-white/50 rounded-lg hover:bg-white/70 transition-colors"
              >
                Mantener los míos
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (cloudSyncStatus.status === 'idle') return null;

    const bannerConfig: Record<string, { text: string; className: string }> = {
      saving: { text: 'Guardando en la nube…', className: 'bg-slate-800 text-white' },
      retrying: { text: 'No se pudo guardar en la nube, reintentando…', className: 'bg-amber-500 text-slate-950' },
      'offline-queued': { text: 'Guardado localmente, pendiente de subir a la nube.', className: 'bg-rose-600 text-white' },
      saved: { text: 'Guardado en la nube ✓', className: 'bg-emerald-500 text-slate-950' },
      error: { text: cloudSyncStatus.message || 'Error al guardar en la nube', className: 'bg-rose-700 text-white' },
    };
    const cfg = bannerConfig[cloudSyncStatus.status];
    if (!cfg) return null;

    return (
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[95] print:hidden">
        <div className={`rounded-xl shadow-xl px-4 py-2 text-xs font-bold ${cfg.className}`}>
          {cfg.text}
        </div>
      </div>
    );
  };

  // Auth Guard: Show loading indicator or Login Page if unauthenticated
  if (isAuthInitializing) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        {renderThemeToggle()}
        <div className="flex flex-col items-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
          <span className="text-sm font-bold text-slate-300">Loading U17 Portal...</span>
        </div>
      </div>
    );
  }

  if (!currentUser || requiresSharedLinkLogin) {
    return (
      <>
        <LoginPage onSuccess={handleLoginSuccess} currentLogo={teamLogo} />
        {renderThemeToggle()}
      </>
    );
  }

  // Standalone Portal Navigation Hub View (No sidebar, clean light layout)
  if (activeSection === 'hub') {
    return (
      <>
        <PortalHub
          onSelectSection={setActiveSection}
          squadCount={squadPlayersWithStats.length}
          activeSessionDate={session.date}
          totalExercisesCount={libraryCount}
          squadPlayers={squadPlayersWithStats}
          physioRecords={physioRecords}
          videoSessions={videoSessions}
          currentUser={currentUser}
          onLogout={handleLogout}
          currentLogo={teamLogo}
          onUpdateLogo={handleUpdateTeamLogo}
        />
        {renderThemeToggle()}
        {renderSyncBanner()}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans flex flex-col md:flex-row print:block print:bg-white">
      {renderThemeToggle()}
      {renderSyncBanner()}
      
      {/* Lateral Dark Blue Navigation Sidebar */}
      <Sidebar
        session={session}
        currentLogo={teamLogo}
        activeSection={activeSection}
        setActiveSection={setActiveSection}
        totalLibraryExercisesCount={libraryCount}
        onClearSession={handleClearSession}
        onNewSession={handleCreateNewCloudSession}
        cloudSessions={cloudSessions}
        isLoadingCloud={isLoadingCloud}
        isCloudSaving={isCloudSaving}
        onSaveToCloud={handleSaveActiveToCloud}
        onLoadCloudSession={handleLoadCloudSession}
        onDeleteCloudSession={handleDeleteCloudSession}
        copiedLink={copiedLink}
        onCopyShareLink={handleCopyShareLink}
        currentUser={currentUser}
        onLogout={handleLogout}
        onUpdateLogo={handleUpdateTeamLogo}
      />

      {/* Main Content Workspace Area */}
      <div className="flex-1 min-w-0 p-3 sm:p-6 md:p-8 print:p-0 max-w-6xl mx-auto w-full">
        {activeSection === 'squad' || activeSection === 'attendance' ? (
          <SquadRosterSection
            players={squadPlayersWithStats}
            onUpdatePlayers={handleUpdateSquadPlayers}
            session={session}
            cloudSessions={cloudSessions}
            onChangeSession={handleUpdateSession}
            onChangeRoster={handleUpdateRoster}
            initialSubTab={activeSection === 'attendance' ? 'attendance' : 'roster'}
            excludedPlayers={excludedPlayers}
            onExcludePlayer={handleExcludePlayer}
            onIncludePlayer={handleIncludePlayer}
          />
        ) : activeSection === 'physio' ? (
          <PhysiotherapySection
            records={physioRecords}
            squadPlayers={squadPlayers}
            onUpdateRecords={handleUpdatePhysioRecords}
            onUpdateSquadPlayerStatus={handleUpdateSquadStatusFromPhysio}
          />
        ) : activeSection === 'video' ? (
          <VideoAnalysisSection
            sessions={videoSessions}
            onUpdateSessions={handleUpdateVideoSessions}
          />
        ) : activeSection === 'planning' ? (
          <PlanificationSection
            session={session}
            cloudSessions={cloudSessions}
          />
        ) : activeSection === 'exercises' ? (
          <ExercisesLibrary
            currentSession={session}
            cloudSessions={cloudSessions}
            onAddExerciseToSession={handleAddExerciseFromLibrary}
            activeSection={activeSection}
          />
        ) : activeSection === 'football' ? (
          <FootballHubSection
            session={session}
            cloudSessions={cloudSessions}
            onChangeSession={handleUpdateSession}
            onAddExerciseToSession={handleAddExerciseFromLibrary}
            onLoadCloudSession={handleLoadCloudSession}
            onDeleteCloudSession={handleDeleteCloudSession}
            onNewSession={handleCreateNewCloudSession}
            squadRoster={fullSquadRoster}
            fixtures={competitionFixtures}
            onUpdateFixtures={handleUpdateCompetitionFixtures}
            role="football"
            renderActiveSessionEditor={() => (
              <ModuleSessionEditor
                moduleId="football"
                session={session}
                sharedHeader={sharedHeader}
                planningRoster={fullSquadRoster}
                currentLogo={teamLogo}
                squadPlayers={squadPlayersWithStats}
                isSaving={isCloudSaving}
                expandedExercises={expandedExercises}
                excludedPlayers={excludedPlayers}
                onUpdateHeader={handleUpdateSession}
                onSave={handleSaveActiveToCloud}
                onUpdateAttendance={handleUpdateAttendance}
                onUpdateRoster={handleUpdateRoster}
                onUpdateGroups={handleUpdateGroups}
                onUpdateExercises={handleUpdateExercises}
                onToggleExpand={toggleExpand}
                onExcludePlayer={handleExcludePlayer}
                onIncludePlayer={handleIncludePlayer}
                onUpdateLogo={handleUpdateTeamLogo}
                onApplyMalikaPoints={handleApplyMalikaPoints}
              />
            )}
          />
        ) : activeSection === 'fitness' ? (
          <FootballHubSection
            session={session}
            cloudSessions={cloudSessions}
            onChangeSession={handleUpdateSession}
            onAddExerciseToSession={handleAddExerciseFromLibrary}
            onLoadCloudSession={handleLoadCloudSession}
            onDeleteCloudSession={handleDeleteCloudSession}
            onNewSession={handleCreateNewCloudSession}
            squadRoster={fullSquadRoster}
            fixtures={competitionFixtures}
            onUpdateFixtures={handleUpdateCompetitionFixtures}
            role="fitness"
            renderActiveSessionEditor={() => (
              <ModuleSessionEditor
                moduleId="fitness"
                session={session}
                sharedHeader={sharedHeader}
                planningRoster={fullSquadRoster}
                currentLogo={teamLogo}
                squadPlayers={squadPlayersWithStats}
                isSaving={isCloudSaving}
                expandedExercises={expandedExercises}
                excludedPlayers={excludedPlayers}
                onUpdateHeader={handleUpdateSession}
                onSave={handleSaveActiveToCloud}
                onUpdateAttendance={handleUpdateAttendance}
                onUpdateRoster={handleUpdateRoster}
                onUpdateGroups={handleUpdateGroups}
                onUpdateExercises={handleUpdateExercises}
                onToggleExpand={toggleExpand}
                onExcludePlayer={handleExcludePlayer}
                onIncludePlayer={handleIncludePlayer}
                onUpdateLogo={handleUpdateTeamLogo}
                onApplyMalikaPoints={handleApplyMalikaPoints}
              />
            )}
          />
        ) : activeSection === 'gk' ? (
          <FootballHubSection
            session={session}
            cloudSessions={cloudSessions}
            onChangeSession={handleUpdateSession}
            onAddExerciseToSession={handleAddExerciseFromLibrary}
            onLoadCloudSession={handleLoadCloudSession}
            onDeleteCloudSession={handleDeleteCloudSession}
            onNewSession={handleCreateNewCloudSession}
            squadRoster={goalkeeperRoster}
            fixtures={competitionFixtures}
            onUpdateFixtures={handleUpdateCompetitionFixtures}
            role="gk"
            renderActiveSessionEditor={() => (
              <ModuleSessionEditor
                moduleId="gk"
                session={session}
                sharedHeader={sharedHeader}
                planningRoster={goalkeeperRoster}
                currentLogo={teamLogo}
                squadPlayers={squadPlayersWithStats}
                isSaving={isCloudSaving}
                expandedExercises={expandedExercises}
                excludedPlayers={excludedPlayers}
                onUpdateHeader={handleUpdateSession}
                onSave={handleSaveActiveToCloud}
                onUpdateAttendance={handleUpdateAttendance}
                onUpdateRoster={handleUpdateRoster}
                onUpdateGroups={handleUpdateGroups}
                onUpdateExercises={handleUpdateExercises}
                onToggleExpand={toggleExpand}
                onExcludePlayer={handleExcludePlayer}
                onIncludePlayer={handleIncludePlayer}
                onUpdateLogo={handleUpdateTeamLogo}
                onApplyMalikaPoints={handleApplyMalikaPoints}
              />
            )}
          />
        ) : (
          <main className="space-y-6 md:space-y-8 print:space-y-1.5">
            
            {/* Header Section */}
            <HeaderSection 
              session={session}
              onChange={handleUpdateSession}
              currentLogo={teamLogo}
              onUpdateLogo={handleUpdateTeamLogo}
              onSave={handleSaveActiveToCloud}
              isSaving={isCloudSaving}
            />

            {/* Section: Session Attendance Quick Tracker */}
            <SessionAttendanceTracker
              attendance={session.attendance}
              squadRoster={session.squadRoster}
              onChangeAttendance={handleUpdateAttendance}
              onChangeRoster={handleUpdateRoster}
              excludedPlayers={excludedPlayers}
              onExcludePlayer={handleExcludePlayer}
              onIncludePlayer={handleIncludePlayer}
            />

            {/* Section: Player Groups Manager */}
            <PlayerGroupsSection
              groups={session.playerGroups}
              squadRoster={session.squadRoster}
              attendance={session.attendance}
              onChangeGroups={handleUpdateGroups}
              onChangeRoster={handleUpdateRoster}
            />

            {/* Section: Warm-Up Block */}
            <ExerciseBlock 
              block={session.warmUp}
              onChange={(exs) => handleUpdateExercises('warmUp', exs)}
              expandedExercises={expandedExercises}
              toggleExpand={toggleExpand}
              sessionGroups={session.playerGroups}
              gameMoments={getModuleGameMoments(DEFAULT_MODULE_ID)}
            />

            {/* Section: Main Part Block */}
            <ExerciseBlock 
              block={session.mainPart}
              onChange={(exs) => handleUpdateExercises('mainPart', exs)}
              expandedExercises={expandedExercises}
              toggleExpand={toggleExpand}
              sessionGroups={session.playerGroups}
              gameMoments={getModuleGameMoments(DEFAULT_MODULE_ID)}
            />

            {/* Section: Cool Down Block */}
            <ExerciseBlock 
              block={session.coolDown}
              onChange={(exs) => handleUpdateExercises('coolDown', exs)}
              expandedExercises={expandedExercises}
              toggleExpand={toggleExpand}
              sessionGroups={session.playerGroups}
              gameMoments={getModuleGameMoments(DEFAULT_MODULE_ID)}
            />

            {/* Section: Observations & Notes (Screen Only - Hidden in Print PDF) */}
            <section className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 shadow-md shadow-slate-100/80 space-y-3 print:hidden">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 bg-[#002142] text-[#a79078] rounded-xl shadow-sm">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-display font-black text-slate-900 uppercase tracking-wider">
                      Session Observations & Notes
                    </h2>
                    <p className="text-[10px] text-slate-400 font-bold">
                      Private coaching staff notes (Screen view only — hidden when printing PDF)
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-extrabold text-[#8a7549] bg-[#ede9e6] px-2.5 py-1 rounded-lg border border-[#a79078]/30">
                  Screen Only
                </span>
              </div>

              <textarea
                value={session.observations || ''}
                onChange={(e) => handleUpdateSession({ observations: e.target.value })}
                rows={4}
                placeholder="Write post-training observations, individual player notes, RPE ratings, injury updates, or tactical feedback for the coaching staff..."
                className="w-full text-xs font-semibold text-slate-800 bg-slate-50/70 border border-slate-200 rounded-xl p-3.5 focus:outline-none focus:ring-2 focus:ring-[#002142]/10 focus:border-[#0f5981] focus:bg-white transition-all resize-y"
              />
            </section>

          </main>
        )}

        {/* Print-Only Professional Document Footer */}
        <footer className="hidden print:grid grid-cols-2 gap-8 mt-6 pt-4 border-t-2 border-[#002142]">
          <div>
            <div className="border-b border-slate-300 h-8 w-full mb-1"></div>
            <p className="text-[9px] uppercase font-extrabold text-[#002142] text-center tracking-wider">Head Coach Signature</p>
          </div>
          <div>
            <div className="border-b border-slate-300 h-8 w-full mb-1"></div>
            <p className="text-[9px] uppercase font-extrabold text-[#002142] text-center tracking-wider">Technical Staff Signature</p>
          </div>
          <div className="col-span-2 text-center text-[8px] text-slate-500 mt-2 font-medium tracking-wide">
            AL ULA SC • Official Microcycle Training Session Plan • Authorized Coaching Document
          </div>
        </footer>

      </div>
    </div>
  );
}
