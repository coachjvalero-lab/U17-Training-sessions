import React, { useState, useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
import { getDefaultSession, getDefaultFitnessSession, getEmptySession } from './defaultSession';
import { OFFICIAL_ALULA_LOGO_DATA_URL } from './constants/logo';
import { normalizeSessionRoster, DEFAULT_DETAILED_SQUAD } from './constants/squad';
import { HeaderSection } from './components/HeaderSection';
import { ExerciseBlock } from './components/ExerciseBlock';
import { PlayerGroupsSection } from './components/PlayerGroupsSection';
import { Sidebar } from './components/Sidebar';
import { ExercisesLibrary } from './components/ExercisesLibrary';
import { PlanificationSection } from './components/PlanificationSection';
import { AttendanceSection } from './components/AttendanceSection';
import { SessionAttendanceTracker } from './components/SessionAttendanceTracker';
import { LoginPage } from './components/LoginPage';
import { PortalHub } from './components/PortalHub';
import { SquadRosterSection } from './components/SquadRosterSection';
import { PhysiotherapySection } from './components/PhysiotherapySection';
import { VideoAnalysisSection } from './components/VideoAnalysisSection';
import { CompetitionSection, DEFAULT_MATCHES } from './components/CompetitionSection';
import { FootballHubSection } from './components/FootballHubSection';
import { 
  TrainingSession, 
  Exercise, 
  PlayerGroup, 
  TrainingBlock, 
  PlayerAttendance, 
  PortalSection,
  SquadPlayer,
  PhysioRecord,
  VideoAnalysis,
  MatchFixture 
} from './types';
import { 
  saveSessionToCloud,
  saveSessionFieldsByRole, 
  deleteSessionFromCloud, 
  subscribeToSessions, 
  subscribeToAuth,
  logoutUser,
  markQuotaExceeded,
  clearQuotaExceeded,
  subscribeSyncStatus,
  flushPendingWrites,
  subscribeToSquadPlayers,
  saveSquadPlayerToCloud,
  deleteSquadPlayerFromCloud,
  migrateLocalSquadIfNeeded,
  subscribeToPhysioRecords,
  savePhysioRecordToCloud,
  deletePhysioRecordFromCloud,
  migrateLocalPhysioRecordsIfNeeded,
  subscribeToExcludedPlayers,
  addExcludedPlayersCloud,
  migrateLocalExcludedPlayersIfNeeded,
  subscribeToTeamLogo,
  saveTeamLogoToCloud,
  migrateLocalTeamLogoIfNeeded,
  subscribeToVideoAnalysis,
  saveVideoAnalysisToCloud,
  deleteVideoAnalysisFromCloud,
  migrateLocalVideoAnalysisIfNeeded,
  subscribeToCompetitionFixtures,
  saveCompetitionFixtureToCloud,
  deleteCompetitionFixtureFromCloud,
  migrateLocalCompetitionFixturesIfNeeded,
  CloudTrainingSession 
} from './firebase';
import { 
  ShieldCheck, 
  Info, 
  Clipboard, 
  Cloud, 
  CloudUpload, 
  Trash2, 
  FolderOpen, 
  Plus, 
  RefreshCw, 
  HelpCircle,
  Database,
  Share2,
  Check,
  Link,
  FileText,
  Loader2,
  Trophy,
  Calendar,
  Swords,
  Users,
  Moon,
  Sun
} from 'lucide-react';

// Fills missing fitness/GK blocks and normalizes the squad roster
function buildUnifiedSession(base: Partial<TrainingSession>): TrainingSession {
  const gkTemplate = getDefaultSession();
  return normalizeSessionRoster({
    ...base,
    fitnessWarmUp: base.fitnessWarmUp || { id: 'warmup-block-fitness', title: 'Warm Up', exercises: [] },
    fitnessMainPart: base.fitnessMainPart || { id: 'main-block-fitness', title: 'Main Part', exercises: [] },
    fitnessCoolDown: base.fitnessCoolDown || { id: 'cooldown-block-fitness', title: 'Cool Down', exercises: [] },
    fitnessPlayerGroups: base.fitnessPlayerGroups || [],
    gkWarmUp: base.gkWarmUp || gkTemplate.gkWarmUp || { id: 'warmup-block-gk', title: 'Warm Up', exercises: [] },
    gkMainPart: base.gkMainPart || gkTemplate.gkMainPart || { id: 'main-block-gk', title: 'Main Part', exercises: [] },
    gkCoolDown: base.gkCoolDown || gkTemplate.gkCoolDown || { id: 'cooldown-block-gk', title: 'Cool Down', exercises: [] },
    gkPlayerGroups: base.gkPlayerGroups || [],
  } as TrainingSession);
}

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

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthInitializing, setIsAuthInitializing] = useState<boolean>(true);
  const [activeSection, setActiveSection] = useState<PortalSection>('hub');
  const [footballSubTab, setFootballSubTab] = useState<'sessions' | 'planning' | 'competition'>('sessions');

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
  // Also migrates whatever was cached locally (once) so no existing roster data gets lost.
  useEffect(() => {
    migrateLocalSquadIfNeeded(initialSquadPlayersRef.current)
      .catch(() => {})
      .finally(() => { hasSquadMigrationSettledRef.current = true; });

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
  // Also migrates whatever was cached locally (once) so no existing records get lost.
  useEffect(() => {
    migrateLocalPhysioRecordsIfNeeded(initialPhysioRecordsRef.current)
      .catch(() => {})
      .finally(() => { hasPhysioMigrationSettledRef.current = true; });

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
        if (!list.some(p => p.toLowerCase() === 'jalila')) {
          list.push('jalila');
        }
        return list;
      } catch {
        return ['jalila'];
      }
    })();
    initialExcludedPlayersRef.current = computed;
    return computed;
  });

  const hasExcludedPlayersMigrationSettledRef = useRef(false);

  // Subscribe to the shared cloud excluded-players list in real time.
  // Also migrates whatever was cached locally (once) so no existing exclusions get lost.
  useEffect(() => {
    migrateLocalExcludedPlayersIfNeeded(initialExcludedPlayersRef.current)
      .catch(() => {})
      .finally(() => { hasExcludedPlayersMigrationSettledRef.current = true; });

    const unsubscribe = subscribeToExcludedPlayers((names) => {
      if (names.length === 0 && !hasExcludedPlayersMigrationSettledRef.current) {
        return;
      }
      const merged = names.some(n => n.toLowerCase() === 'jalila') ? names : [...names, 'jalila'];
      setExcludedPlayers(merged);
      try {
        localStorage.setItem('u17_excluded_players', JSON.stringify(merged));
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
    const updated = Array.from(new Set([...excludedPlayers, lower, 'jalila']));
    setExcludedPlayers(updated);
    try {
      localStorage.setItem('u17_excluded_players', JSON.stringify(updated));
    } catch (e) {}
    addExcludedPlayersCloud([lower, 'jalila']).catch(err => console.warn('Cloud save failed for excluded player:', err));
  };

  const initialTeamLogoRef = useRef('');
  const [teamLogo, setTeamLogo] = useState<string>(() => {
    const computed = (() => {
      try {
        const saved = localStorage.getItem('u17_uploaded_team_logo');
        if (saved) return saved;
      } catch (e) {}
      return OFFICIAL_ALULA_LOGO_DATA_URL;
    })();
    initialTeamLogoRef.current = computed;
    return computed;
  });

  const hasTeamLogoMigrationSettledRef = useRef(false);

  useEffect(() => {
    migrateLocalTeamLogoIfNeeded(initialTeamLogoRef.current)
      .catch(() => {})
      .finally(() => { hasTeamLogoMigrationSettledRef.current = true; });

    const unsubscribe = subscribeToTeamLogo((cloudLogo) => {
      if (!cloudLogo && !hasTeamLogoMigrationSettledRef.current) {
        return;
      }
      const nextLogo = cloudLogo || teamLogo || OFFICIAL_ALULA_LOGO_DATA_URL;
      setTeamLogo(nextLogo);
      try {
        localStorage.setItem('u17_uploaded_team_logo', nextLogo);
      } catch (e) {
        console.warn('Team logo local cache warning:', e);
      }
    }, () => {
      // Offline or subscription error: keep working with whatever is cached locally
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('u17_uploaded_team_logo', teamLogo);
    } catch (e) {}
  }, [teamLogo]);

  const handleUpdateTeamLogo = (newLogo: string) => {
    setTeamLogo(newLogo);
    try {
      localStorage.setItem('u17_uploaded_team_logo', newLogo);
    } catch (e) {}
    saveTeamLogoToCloud(newLogo).catch(err => console.warn('Cloud save failed for team logo:', err));
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
    migrateLocalVideoAnalysisIfNeeded(initialVideoSessionsRef.current)
      .catch(() => {})
      .finally(() => { hasVideoMigrationSettledRef.current = true; });

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
    migrateLocalCompetitionFixturesIfNeeded(initialCompetitionFixturesRef.current)
      .catch(() => {})
      .finally(() => { hasCompetitionFixturesMigrationSettledRef.current = true; });

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
    const starter = getDefaultSession();
    return normalizeSessionRoster({
      ...starter,
      id: 'session-initial',
      sessionNumber: '001',
      date: new Date().toISOString().split('T')[0],
      teamName: 'U17 Women Al Ula',
      teamLogo: OFFICIAL_ALULA_LOGO_DATA_URL,
    });
  });

  const [expandedExercises, setExpandedExercises] = useState<Record<string, boolean>>({});

  const [cloudSessions, setCloudSessions] = useState<CloudTrainingSession[]>([]);
  const [isLoadingCloud, setIsLoadingCloud] = useState(true);
  const [isCloudSaving, setIsCloudSaving] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

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
  const latestSessionRef = useRef<TrainingSession>(session);
  const lastSavedJsonRef = useRef<string>('');

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

  // Applies a cloud session snapshot to local state/localStorage/URL. Shared by the initial
  // load, the "no local edits pending" auto-refresh case, and the conflict banner's Reload action.
  const applyCloudSessionToState = (sessionToLoad: CloudTrainingSession) => {
    const cloudTime = sessionToLoad.updatedAt || 0;
    hasInitialCloudLoadedRef.current = true;
    lastLoadedSessionTimeRef.current = {
      global: cloudTime,
      football: sessionToLoad.footballUpdatedAt || cloudTime,
      fitness: sessionToLoad.fitnessUpdatedAt || cloudTime,
      gk: sessionToLoad.gkUpdatedAt || cloudTime
    };
    currentSessionIdRef.current = sessionToLoad.id;

    const { updatedAt, footballUpdatedAt, fitnessUpdatedAt, gkUpdatedAt, ...baseSession } = sessionToLoad;

    // Normalize old team names if needed
    if (baseSession.teamName === 'U17 Girls A.D. San Pedro') {
      baseSession.teamName = 'U17 Women Al Ula';
    }
    if (baseSession.sessionNumber === '42') {
      baseSession.sessionNumber = '001';
    }

    const restoredLogo = latestSessionRef.current?.teamLogo ||
      localStorage.getItem('u17_uploaded_team_logo') || '';

    const unifiedSession: TrainingSession = buildUnifiedSession({
      ...baseSession,
      teamLogo: restoredLogo,
    });

    isRemoteUpdateRef.current = true;
    lastSavedJsonRef.current = getSessionSyncSignature(unifiedSession);
    setSession(unifiedSession);

    try {
      localStorage.setItem('u17_training_session_unified', JSON.stringify(unifiedSession));
      localStorage.setItem('u17_training_session_updatedAt', String(cloudTime));
    } catch (e) {
      console.warn('LocalStorage sync warning:', e);
    }

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
    const unsubscribe = subscribeToSessions(
      (sessions) => {
        setCloudSessions(sessions);
        setIsLoadingCloud(false);

        if (sessions.length > 0) {
          // Read URL query parameters to see if a specific session ID was requested
          const urlParams = new URLSearchParams(window.location.search);
          const targetId = urlParams.get('session');
          const isFirstLoad = !hasInitialCloudLoadedRef.current;
          const currentId = currentSessionIdRef.current;
          const activeSessionStillExists = currentId ? sessions.some(s => s.id === currentId) : false;

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
            const cloudTime = sessionToLoad.updatedAt || 0;
            const hasRemoteChanges =
              cloudTime !== lastLoadedSessionTimeRef.current.global ||
              (sessionToLoad.footballUpdatedAt || 0) !== lastLoadedSessionTimeRef.current.football ||
              (sessionToLoad.fitnessUpdatedAt || 0) !== lastLoadedSessionTimeRef.current.fitness ||
              (sessionToLoad.gkUpdatedAt || 0) !== lastLoadedSessionTimeRef.current.gk;
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
            } else if (hasRemoteChanges) {
              const hasUnsavedChanges = getSessionSyncSignature(latestSessionRef.current) !== lastSavedJsonRef.current;
              if (!hasUnsavedChanges) {
                // No local edits at risk — safe to silently pick up the remote update.
                applyCloudSessionToState(sessionToLoad);
              } else {
                // Someone else saved this same session while we have unsaved local edits.
                // Surface it instead of silently overwriting (Bloque 2, tarea 3/4).
                setRemoteSessionConflict(sessionToLoad);
              }
            }
          }
        }
        hasInitialCloudLoadedRef.current = true;
      },
      undefined,
      (err) => {
        setIsLoadingCloud(false);
        hasInitialCloudLoadedRef.current = true;
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


  // Quietly persist the unified session locally whenever state updates
  useEffect(() => {
    latestSessionRef.current = session;
    currentSessionIdRef.current = session.id;

    try {
      localStorage.setItem('u17_training_session_unified', JSON.stringify(session));
      localStorage.setItem('u17_training_session_updatedAt', String(Date.now()));
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }

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
    setSession(prev => ({
      ...prev,
      ...fields
    }));
  };

  const handleUpdateExercises = (blockKey: 'warmUp' | 'mainPart' | 'coolDown', exercises: Exercise[]) => {
    setSession(prev => {
      if (activeSection === 'football') {
        if (blockKey === 'warmUp') {
          const footballWarmUpExs = exercises.filter(ex => !ex.isFitness);
          const updatedFitnessExs = exercises.filter(ex => ex.isFitness);

          const fitnessWarmUpIds = new Set((prev.fitnessWarmUp?.exercises || []).map(e => e.id));
          const fitnessMainPartIds = new Set((prev.fitnessMainPart?.exercises || []).map(e => e.id));

          const newFitWarmUp = updatedFitnessExs.filter(e => fitnessWarmUpIds.has(e.id));
          const newFitMain = updatedFitnessExs.filter(e => fitnessMainPartIds.has(e.id));

          const unknownFitExs = updatedFitnessExs.filter(e => 
            !fitnessWarmUpIds.has(e.id) && !fitnessMainPartIds.has(e.id)
          );

          return {
            ...prev,
            warmUp: {
              ...prev.warmUp,
              exercises: footballWarmUpExs
            },
            fitnessWarmUp: {
              ...(prev.fitnessWarmUp || { id: 'warmup-block-fitness', title: 'Warm Up', exercises: [] }),
              exercises: [...newFitWarmUp, ...unknownFitExs]
            },
            fitnessMainPart: {
              ...(prev.fitnessMainPart || { id: 'main-block-fitness', title: 'Main Part', exercises: [] }),
              exercises: newFitMain
            }
          };
        } else if (blockKey === 'coolDown') {
          const footballCoolDownExs = exercises.filter(ex => !ex.isFitness);
          const updatedFitnessExs = exercises.filter(ex => ex.isFitness);

          const fitnessCoolDownIds = new Set((prev.fitnessCoolDown?.exercises || []).map(e => e.id));
          const newFitCool = updatedFitnessExs.filter(e => fitnessCoolDownIds.has(e.id));
          const unknownFitCoolExs = updatedFitnessExs.filter(e => !fitnessCoolDownIds.has(e.id));

          return {
            ...prev,
            coolDown: {
              ...prev.coolDown,
              exercises: footballCoolDownExs
            },
            fitnessCoolDown: {
              ...(prev.fitnessCoolDown || { id: 'cooldown-block-fitness', title: 'Cool Down', exercises: [] }),
              exercises: [...newFitCool, ...unknownFitCoolExs]
            }
          };
        } else {
          return {
            ...prev,
            [blockKey]: {
              ...prev[blockKey],
              exercises
            }
          };
        }
      } else if (activeSection === 'fitness') {
        const fitnessKey = blockKey === 'warmUp' 
          ? 'fitnessWarmUp' 
          : blockKey === 'mainPart' 
            ? 'fitnessMainPart' 
            : 'fitnessCoolDown';
        return {
          ...prev,
          [fitnessKey]: {
            ...(prev[fitnessKey] || { id: `${blockKey}-block-fitness`, title: blockKey === 'warmUp' ? 'Warm Up' : blockKey === 'mainPart' ? 'Main Part' : 'Cool Down', exercises: [] }),
            exercises
          }
        };
      } else {
        const gkKey = blockKey === 'warmUp' 
          ? 'gkWarmUp' 
          : blockKey === 'mainPart' 
            ? 'gkMainPart' 
            : 'gkCoolDown';
        return {
          ...prev,
          [gkKey]: {
            ...(prev[gkKey] || { id: `${blockKey}-block-gk`, title: blockKey === 'warmUp' ? 'Warm Up' : blockKey === 'mainPart' ? 'Main Part' : 'Cool Down', exercises: [] }),
            exercises
          }
        };
      }
    });
  };

  const handleAddExerciseFromLibrary = (
    blockKey: 'warmUp' | 'mainPart' | 'coolDown',
    exercise: Exercise,
    targetSection?: 'football' | 'fitness' | 'gk'
  ) => {
    const section = targetSection || (activeSection === 'exercises' ? 'football' : activeSection);
    setSession(prev => {
      let blockPropName: keyof TrainingSession;
      if (section === 'football') {
        blockPropName = blockKey;
      } else if (section === 'fitness') {
        blockPropName = blockKey === 'warmUp' ? 'fitnessWarmUp' : blockKey === 'mainPart' ? 'fitnessMainPart' : 'fitnessCoolDown';
      } else {
        blockPropName = blockKey === 'warmUp' ? 'gkWarmUp' : blockKey === 'mainPart' ? 'gkMainPart' : 'gkCoolDown';
      }

      const existingBlock = (prev[blockPropName] as TrainingBlock) || {
        id: `${blockKey}-block-${section}`,
        title: blockKey === 'warmUp' ? 'Warm Up' : blockKey === 'mainPart' ? 'Main Part' : 'Cool Down',
        exercises: []
      };

      return {
        ...prev,
        [blockPropName]: {
          ...existingBlock,
          exercises: [...(existingBlock.exercises || []), exercise]
        }
      };
    });

    if (exercise.id) {
      setExpandedExercises(prev => ({ ...prev, [exercise.id]: true }));
    }
  };

  const handleUpdateGroups = (playerGroups: PlayerGroup[]) => {
    setSession(prev => {
      if (activeSection === 'football') {
        return {
          ...prev,
          playerGroups
        };
      } else if (activeSection === 'fitness') {
        return {
          ...prev,
          fitnessPlayerGroups: playerGroups
        };
      } else {
        return {
          ...prev,
          gkPlayerGroups: playerGroups
        };
      }
    });
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
        saveSquadPlayerToCloud(player).catch(err => console.warn('Cloud save failed for squad player:', err));
      }
    });

    previous.forEach(player => {
      if (!updatedIds.has(player.id)) {
        deleteSquadPlayerFromCloud(player.id).catch(err => console.warn('Cloud delete failed for squad player:', err));
      }
    });

    const formattedRoster = updated.map(p => 
      p.position === 'GK' ? `${p.firstName} (GK)` : `${p.firstName} ${p.lastName}`
    );
    handleUpdateRoster(formattedRoster);
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

  const handleUpdateMaterials = (materialsNeeded: string) => {
    setSession(prev => ({
      ...prev,
      materialsNeeded
    }));
  };

  const handleImportSession = (imported: TrainingSession) => {
    const unifiedImport: TrainingSession = buildUnifiedSession(imported);
    
    setSession(unifiedImport);
    
    // Expand exercises
    const expanded: Record<string, boolean> = {};
    const activeWarmUp = activeSection === 'football' 
      ? unifiedImport.warmUp 
      : activeSection === 'fitness'
      ? unifiedImport.fitnessWarmUp
      : unifiedImport.gkWarmUp;
    const activeMainPart = activeSection === 'football' 
      ? unifiedImport.mainPart 
      : activeSection === 'fitness'
      ? unifiedImport.fitnessMainPart
      : unifiedImport.gkMainPart;
    const activeCoolDown = activeSection === 'football' 
      ? unifiedImport.coolDown 
      : activeSection === 'fitness'
      ? unifiedImport.fitnessCoolDown
      : unifiedImport.gkCoolDown;

    activeWarmUp?.exercises.forEach(ex => { expanded[ex.id] = true; });
    activeMainPart?.exercises.forEach(ex => { expanded[ex.id] = true; });
    activeCoolDown?.exercises.forEach(ex => { expanded[ex.id] = true; });
    setExpandedExercises(expanded);
  };

  const getActiveLogo = () => {
    if (teamLogo) {
      return teamLogo;
    }

    if (session && session.teamLogo && !session.teamLogo.includes('%230f172a') && !session.teamLogo.includes('COACH') && !session.teamLogo.includes('default-u17')) {
      return session.teamLogo;
    }

    return OFFICIAL_ALULA_LOGO_DATA_URL;
  };

  const handleClearSession = () => {
    if (confirm(`Are you sure you want to clear the entire session? This will delete all exercises and text for all section tabs.`)) {
      const activeLogo = getActiveLogo();
      const empty = getEmptySession();
      setSession({
        ...empty,
        teamLogo: activeLogo
      });
      setExpandedExercises({});
    }
  };

  const handleRestoreDemo = () => {
    if (confirm(`Are you sure you want to restore the demo training session? This will overwrite your current work for all section tabs.`)) {
      const activeLogo = getActiveLogo();
      const demo = getDefaultSession();
      setSession(normalizeSessionRoster({
        ...demo,
        teamLogo: activeLogo
      }));
      setExpandedExercises({});
    }
  };

  const handleSaveActiveToCloud = async () => {
    // Determine which role is saving based on activeSection
    let role: 'football' | 'fitness' | 'gk' = 'football';
    if (activeSection === 'fitness') {
      role = 'fitness';
    } else if (activeSection === 'gk') {
      role = 'gk';
    }

    // Role-specific conflict check: only compare the timestamp for fields this role owns
    const cloudCopy = cloudSessions.find(s => s.id === session.id);
    if (cloudCopy) {
      let cloudRoleTime = 0;
      let localRoleTime = 0;

      if (role === 'football') {
        cloudRoleTime = cloudCopy.footballUpdatedAt || cloudCopy.updatedAt || 0;
        localRoleTime = lastLoadedSessionTimeRef.current.football;
      } else if (role === 'fitness') {
        cloudRoleTime = cloudCopy.fitnessUpdatedAt || cloudCopy.updatedAt || 0;
        localRoleTime = lastLoadedSessionTimeRef.current.fitness;
      } else if (role === 'gk') {
        cloudRoleTime = cloudCopy.gkUpdatedAt || cloudCopy.updatedAt || 0;
        localRoleTime = lastLoadedSessionTimeRef.current.gk;
      }

      if (cloudRoleTime > localRoleTime) {
        const roleLabel = role === 'football' ? 'Football' : role === 'fitness' ? 'Fitness' : 'GK';
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
      const activeLogo = getActiveLogo();
      const sessionToSave: TrainingSession = {
        ...session,
        teamLogo: session.teamLogo || activeLogo,
        teamName: session.teamName === 'U17 Girls A.D. San Pedro' ? 'U17 Women Al Ula' : session.teamName
      };

      // Always save locally immediately
      localStorage.setItem('u17_training_session_unified', JSON.stringify(sessionToSave));
      localStorage.setItem('u17_training_session_updatedAt', String(Date.now()));
      setSession(sessionToSave);

      // Optimistically update references BEFORE cloud save to avoid false conflict detection
      // when our own write echoes back through the subscription listener
      const optimisticTime = Date.now();
      lastLoadedSessionTimeRef.current[role] = optimisticTime;
      lastLoadedSessionTimeRef.current.global = optimisticTime;
      lastSavedJsonRef.current = getSessionSyncSignature(sessionToSave);

      // Optimistically update cloudSessions to immediately reflect changes in the UI (Sidebar cards)
      setCloudSessions(prev => {
        const existing = prev.find(s => s.id === sessionToSave.id);
        
        if (existing) {
          // Update existing session with new values from the current role
          const updated: CloudTrainingSession = { ...existing, updatedAt: optimisticTime };
          if (role === 'football') {
            updated.footballUpdatedAt = optimisticTime;
            updated.warmUp = sessionToSave.warmUp;
            updated.mainPart = sessionToSave.mainPart;
            updated.coolDown = sessionToSave.coolDown;
            updated.playerGroups = sessionToSave.playerGroups;
            updated.observations = sessionToSave.observations;
            updated.teamName = sessionToSave.teamName;
            updated.date = sessionToSave.date;
            updated.time = sessionToSave.time;
            updated.sessionNumber = sessionToSave.sessionNumber;
            updated.microcycleDay = sessionToSave.microcycleDay;
            updated.mainObjective = sessionToSave.mainObjective;
            updated.materialsNeeded = sessionToSave.materialsNeeded;
            updated.squadRoster = sessionToSave.squadRoster;
            updated.attendance = sessionToSave.attendance;
          } else if (role === 'fitness') {
            updated.fitnessUpdatedAt = optimisticTime;
            updated.fitnessWarmUp = sessionToSave.fitnessWarmUp;
            updated.fitnessMainPart = sessionToSave.fitnessMainPart;
            updated.fitnessCoolDown = sessionToSave.fitnessCoolDown;
            updated.fitnessPlayerGroups = sessionToSave.fitnessPlayerGroups;
          } else if (role === 'gk') {
            updated.gkUpdatedAt = optimisticTime;
            updated.gkWarmUp = sessionToSave.gkWarmUp;
            updated.gkMainPart = sessionToSave.gkMainPart;
            updated.gkCoolDown = sessionToSave.gkCoolDown;
            updated.gkPlayerGroups = sessionToSave.gkPlayerGroups;
          }
          // Create entirely new array to force React re-render
          const newList = [...prev.map(s => s.id === sessionToSave.id ? updated : s)];
          return newList;
        } else {
          // New session not yet in cloudSessions - add it optimistically
          const newSession: CloudTrainingSession = {
            ...sessionToSave,
            updatedAt: optimisticTime,
            footballUpdatedAt: role === 'football' ? optimisticTime : undefined,
            fitnessUpdatedAt: role === 'fitness' ? optimisticTime : undefined,
            gkUpdatedAt: role === 'gk' ? optimisticTime : undefined,
          };
          return [newSession, ...prev];
        }
      });

      try {
        // Save only the fields owned by this role to avoid overwriting other roles' changes
        const savedTime = await saveSessionFieldsByRole(sessionToSave.id, role, sessionToSave);
        
        // Update with the actual server timestamp
        lastLoadedSessionTimeRef.current[role] = savedTime;
        lastLoadedSessionTimeRef.current.global = savedTime;
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

  const handleSaveAsNewToCloud = async () => {
    const currentNum = parseInt(session.sessionNumber) || 0;
    const nextNum = String(currentNum + 1);
    const newNumber = prompt('Enter session number for the new cloud copy:', nextNum);
    if (newNumber === null) return; // User cancelled
    
    const newId = 'session-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
    const today = new Date().toISOString().split('T')[0];
    const activeLogo = getActiveLogo();

    const newSession: TrainingSession = {
      ...session,
      id: newId,
      sessionNumber: newNumber,
      date: today,
      teamName: 'U17 Women Al Ula',
      teamLogo: activeLogo || session.teamLogo
    };

    try {
      setIsCloudSaving(true);
      localStorage.setItem('u17_training_session_unified', JSON.stringify(newSession));
      localStorage.setItem('u17_training_session_updatedAt', String(Date.now()));
      setSession(newSession);

      try {
        await saveSessionToCloud(newSession);
      } catch (cloudErr) {
        const errorCode = cloudErr && typeof cloudErr === 'object' && 'code' in cloudErr ? String((cloudErr as { code?: unknown }).code) : 'unknown';
        console.error('[handleSaveAsNewToCloud] Cloud save failed:', cloudErr);
        setCloudSyncStatus({ status: 'error', message: `Guardar copia falló (${errorCode})` });
      }
    } catch (error) {
      const errorCode = error && typeof error === 'object' && 'code' in error ? String((error as { code?: unknown }).code) : 'unknown';
      console.error('[handleSaveAsNewToCloud] Error saving copy:', error);
      setCloudSyncStatus({ status: 'error', message: `Guardar copia falló (${errorCode})` });
    } finally {
      setIsCloudSaving(false);
    }
  };

  const handleCreateNewCloudSession = async () => {
    const newNumber = prompt('Enter new session number:', '1');
    if (newNumber === null) return;

    const activeLogo = getActiveLogo();
    const empty = getEmptySession();
    const newId = 'session-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
    const today = new Date().toISOString().split('T')[0];

    const newSession: TrainingSession = normalizeSessionRoster({
      ...empty,
      id: newId,
      sessionNumber: newNumber,
      date: today,
      teamName: 'U17 Women Al Ula',
      teamLogo: activeLogo
    });

    try {
      setIsCloudSaving(true);
      localStorage.setItem('u17_training_session_unified', JSON.stringify(newSession));
      localStorage.setItem('u17_training_session_updatedAt', String(Date.now()));
      setSession(newSession);
      currentSessionIdRef.current = newId;

      // Use full document save for new sessions (all fields are new)
      try {
        const savedTime = await saveSessionToCloud(newSession);
        lastLoadedSessionTimeRef.current = {
          global: savedTime,
          football: savedTime,
          fitness: savedTime,
          gk: savedTime
        };
        lastSavedJsonRef.current = getSessionSyncSignature(newSession);
        // Optimistically add to cloudSessions
        setCloudSessions(prev => [{
          ...newSession,
          updatedAt: savedTime,
          footballUpdatedAt: savedTime,
          fitnessUpdatedAt: savedTime,
          gkUpdatedAt: savedTime
        }, ...prev]);
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
      const { updatedAt, footballUpdatedAt, fitnessUpdatedAt, gkUpdatedAt, ...baseSession } = loadedSession;
      const restoredLogo = latestSessionRef.current?.teamLogo ||
        localStorage.getItem('u17_uploaded_team_logo') || '';

      // Upgrade fitness and GK fields if missing from loaded old document
      const unifiedSession: TrainingSession = buildUnifiedSession({
        ...baseSession,
        teamLogo: restoredLogo,
        teamName: baseSession.teamName === 'U17 Girls A.D. San Pedro' ? 'U17 Women Al Ula' : baseSession.teamName,
      });

      if (unifiedSession.id && window.history.replaceState) {
        const url = new URL(window.location.href);
        url.searchParams.set('session', unifiedSession.id);
        window.history.replaceState({}, '', url.toString());
      }

      isRemoteUpdateRef.current = true;
      const cloudTime = loadedSession.updatedAt || Date.now();
      lastLoadedSessionTimeRef.current = {
        global: cloudTime,
        football: footballUpdatedAt || cloudTime,
        fitness: fitnessUpdatedAt || cloudTime,
        gk: gkUpdatedAt || cloudTime
      };
      currentSessionIdRef.current = unifiedSession.id;
      lastSavedJsonRef.current = getSessionSyncSignature(unifiedSession);

      setSession(unifiedSession);
      
      // Expand exercises of loaded session
      const expanded: Record<string, boolean> = {};
      const activeWarmUp = activeSection === 'football' 
        ? unifiedSession.warmUp 
        : activeSection === 'fitness'
        ? unifiedSession.fitnessWarmUp
        : unifiedSession.gkWarmUp;
      const activeMainPart = activeSection === 'football' 
        ? unifiedSession.mainPart 
        : activeSection === 'fitness'
        ? unifiedSession.fitnessMainPart
        : unifiedSession.gkMainPart;
      const activeCoolDown = activeSection === 'football' 
        ? unifiedSession.coolDown 
        : activeSection === 'fitness'
        ? unifiedSession.fitnessCoolDown
        : unifiedSession.gkCoolDown;

      activeWarmUp?.exercises.forEach(ex => { expanded[ex.id] = true; });
      activeMainPart?.exercises.forEach(ex => { expanded[ex.id] = true; });
      activeCoolDown?.exercises.forEach(ex => { expanded[ex.id] = true; });
      setExpandedExercises(expanded);
    }
  };

  const handleDeleteCloudSession = async (sessionId: string, sessionNum: string, event: React.MouseEvent) => {
    event.stopPropagation(); // prevent loading when clicking delete
    if (confirm(`Are you absolutely sure you want to delete session #${sessionNum} from the cloud database? This cannot be undone.`)) {
      try {
        setIsCloudSaving(true);
        await deleteSessionFromCloud(sessionId);

        // If the deleted session is currently active in React state:
        if (session.id === sessionId) {
          const remaining = cloudSessions.filter(s => s.id !== sessionId);
          if (remaining.length > 0) {
            const nextSession = remaining[0];
            const { updatedAt, ...baseSession } = nextSession;
            const restoredLogo = latestSessionRef.current?.teamLogo ||
              localStorage.getItem('u17_uploaded_team_logo') || '';

            const unifiedSession: TrainingSession = buildUnifiedSession({
              ...baseSession,
              teamLogo: restoredLogo,
              teamName: baseSession.teamName === 'U17 Girls A.D. San Pedro' ? 'U17 Women Al Ula' : baseSession.teamName,
            });

            isRemoteUpdateRef.current = true;
            setSession(unifiedSession);

            if (unifiedSession.id && window.history.replaceState) {
              const url = new URL(window.location.href);
              url.searchParams.set('session', unifiedSession.id);
              window.history.replaceState({}, '', url.toString());
            }
          } else {
            // No sessions left in cloud, create a fresh session
            const empty = getEmptySession();
            const newId = 'session-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
            const today = new Date().toISOString().split('T')[0];
            const activeLogo = getActiveLogo();

            const newSession: TrainingSession = {
              ...empty,
              id: newId,
              sessionNumber: '001',
              date: today,
              teamName: 'U17 Women Al Ula',
              teamLogo: activeLogo
            };

            isRemoteUpdateRef.current = true;
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
    // Determine which role is saving based on activeSection
    let role: 'football' | 'fitness' | 'gk' = 'football';
    if (activeSection === 'fitness') {
      role = 'fitness';
    } else if (activeSection === 'gk') {
      role = 'gk';
    }

    try {
      setIsCloudSaving(true);
      const activeLogo = getActiveLogo();
      const sessionToSave: TrainingSession = {
        ...session,
        teamLogo: session.teamLogo || activeLogo,
        teamName: session.teamName === 'U17 Girls A.D. San Pedro' ? 'U17 Women Al Ula' : session.teamName
      };

      // 1. Always save locally immediately
      localStorage.setItem('u17_training_session_unified', JSON.stringify(sessionToSave));
      localStorage.setItem('u17_training_session_updatedAt', String(Date.now()));
      setSession(sessionToSave);

      // 2. Optimistically update references to prevent false conflict detection
      const optimisticTime = Date.now();
      lastLoadedSessionTimeRef.current[role] = optimisticTime;
      lastLoadedSessionTimeRef.current.global = optimisticTime;
      lastSavedJsonRef.current = getSessionSyncSignature(sessionToSave);

      // Optimistically update cloudSessions to immediately reflect changes in the UI
      setCloudSessions(prev => {
        const existing = prev.find(s => s.id === sessionToSave.id);
        if (existing) {
          const updated: CloudTrainingSession = { ...existing, updatedAt: optimisticTime };
          if (role === 'football') {
            updated.footballUpdatedAt = optimisticTime;
            updated.warmUp = sessionToSave.warmUp;
            updated.mainPart = sessionToSave.mainPart;
            updated.coolDown = sessionToSave.coolDown;
            updated.playerGroups = sessionToSave.playerGroups;
            updated.observations = sessionToSave.observations;
            updated.teamName = sessionToSave.teamName;
            updated.date = sessionToSave.date;
            updated.time = sessionToSave.time;
            updated.sessionNumber = sessionToSave.sessionNumber;
            updated.microcycleDay = sessionToSave.microcycleDay;
            updated.mainObjective = sessionToSave.mainObjective;
            updated.materialsNeeded = sessionToSave.materialsNeeded;
            updated.squadRoster = sessionToSave.squadRoster;
            updated.attendance = sessionToSave.attendance;
          } else if (role === 'fitness') {
            updated.fitnessUpdatedAt = optimisticTime;
            updated.fitnessWarmUp = sessionToSave.fitnessWarmUp;
            updated.fitnessMainPart = sessionToSave.fitnessMainPart;
            updated.fitnessCoolDown = sessionToSave.fitnessCoolDown;
            updated.fitnessPlayerGroups = sessionToSave.fitnessPlayerGroups;
          } else if (role === 'gk') {
            updated.gkUpdatedAt = optimisticTime;
            updated.gkWarmUp = sessionToSave.gkWarmUp;
            updated.gkMainPart = sessionToSave.gkMainPart;
            updated.gkCoolDown = sessionToSave.gkCoolDown;
            updated.gkPlayerGroups = sessionToSave.gkPlayerGroups;
          }
          return prev.map(s => s.id === sessionToSave.id ? updated : s);
        } else {
          // New session not yet in cloudSessions - add it optimistically
          const newSession: CloudTrainingSession = {
            ...sessionToSave,
            updatedAt: optimisticTime,
            footballUpdatedAt: role === 'football' ? optimisticTime : undefined,
            fitnessUpdatedAt: role === 'fitness' ? optimisticTime : undefined,
            gkUpdatedAt: role === 'gk' ? optimisticTime : undefined,
          };
          return [newSession, ...prev];
        }
      });

      // 3. Try Cloud Firestore save (only save fields for current role)
      try {
        const savedTime = await saveSessionFieldsByRole(sessionToSave.id, role, sessionToSave);
        lastLoadedSessionTimeRef.current[role] = savedTime;
        lastLoadedSessionTimeRef.current.global = savedTime;
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

  // Dynamically map active blocks and exercises based on active tab
  const fitnessWarmUpAndMainExercises = [
    ...(session.fitnessWarmUp?.exercises || []),
    ...(session.fitnessMainPart?.exercises || [])
  ].map(ex => ({
    ...ex,
    isFitness: true,
    hideGraphics: true
  }));

  const fitnessCoolDownExercises = [
    ...(session.fitnessCoolDown?.exercises || [])
  ].map(ex => ({
    ...ex,
    isFitness: true,
    hideGraphics: true
  }));

  const activeWarmUp = activeSection === 'football'
    ? {
        ...session.warmUp,
        exercises: [
          ...session.warmUp.exercises,
          ...fitnessWarmUpAndMainExercises
        ]
      }
    : activeSection === 'fitness'
    ? (session.fitnessWarmUp || { id: 'warmup-block-fitness', title: 'Warm Up', exercises: [] })
    : (session.gkWarmUp || { id: 'warmup-block-gk', title: 'Warm Up', exercises: [] });

  const activeMainPart = activeSection === 'football'
    ? session.mainPart
    : activeSection === 'fitness'
    ? (session.fitnessMainPart || { id: 'main-block-fitness', title: 'Main Part', exercises: [] })
    : (session.gkMainPart || { id: 'main-block-gk', title: 'Main Part', exercises: [] });

  const activeCoolDown = activeSection === 'football'
    ? {
        ...session.coolDown,
        exercises: [
          ...session.coolDown.exercises,
          ...fitnessCoolDownExercises
        ]
      }
    : activeSection === 'fitness'
    ? (session.fitnessCoolDown || { id: 'cooldown-block-fitness', title: 'Cool Down', exercises: [] })
    : (session.gkCoolDown || { id: 'cooldown-block-gk', title: 'Cool Down', exercises: [] });

  const activePlayerGroups = activeSection === 'football'
    ? session.playerGroups
    : activeSection === 'fitness'
    ? (session.fitnessPlayerGroups || [])
    : (session.gkPlayerGroups || []);

  // Quick Action: Expand All or Collapse All
  const handleToggleAll = (expand: boolean) => {
    const nextExpanded: Record<string, boolean> = {};
    activeWarmUp.exercises.forEach(e => { nextExpanded[e.id] = expand; });
    activeMainPart.exercises.forEach(e => { nextExpanded[e.id] = expand; });
    activeCoolDown.exercises.forEach(e => { nextExpanded[e.id] = expand; });
    setExpandedExercises(nextExpanded);
  };

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
      setRemoteSessionConflict(null);
    }
  };

  const handleKeepLocalChanges = () => {
    setRemoteSessionConflict(null);
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

  if (!currentUser) {
    return (
      <>
        <LoginPage onSuccess={() => {}} />
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
          squadCount={squadPlayers.length}
          activeSessionDate={session.date}
          totalExercisesCount={libraryCount}
          squadPlayers={squadPlayers}
          physioRecords={physioRecords}
          videoSessions={videoSessions}
          currentUser={currentUser}
          onLogout={logoutUser}
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
        onLogout={logoutUser}
        onUpdateSession={handleUpdateSession}
      />

      {/* Main Content Workspace Area */}
      <div className="flex-1 min-w-0 p-3 sm:p-6 md:p-8 print:p-0 max-w-6xl mx-auto w-full">
        {activeSection === 'squad' || activeSection === 'attendance' ? (
          <SquadRosterSection
            players={squadPlayers}
            onUpdatePlayers={handleUpdateSquadPlayers}
            session={session}
            cloudSessions={cloudSessions}
            onChangeSession={handleUpdateSession}
            onChangeRoster={handleUpdateRoster}
            initialSubTab={activeSection === 'attendance' ? 'attendance' : 'roster'}
            excludedPlayers={excludedPlayers}
            onExcludePlayer={handleExcludePlayer}
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
            squadRoster={session.squadRoster || squadPlayers.map(p => `${p.firstName} ${p.lastName}`)}
            fixtures={competitionFixtures}
            onUpdateFixtures={handleUpdateCompetitionFixtures}
            role="football"
            renderActiveSessionEditor={() => (
              <main className="space-y-6 md:space-y-8 print:space-y-1.5">
                
                {/* Header Section */}
                <HeaderSection 
                  session={session}
                  onChange={handleUpdateSession}
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
                />

                {/* Section: Player Groups Manager */}
                <PlayerGroupsSection
                  groups={activePlayerGroups}
                  squadRoster={session.squadRoster}
                  attendance={session.attendance}
                  onChangeGroups={handleUpdateGroups}
                  onChangeRoster={handleUpdateRoster}
                />

                {/* Section: Warm-Up Block */}
                <ExerciseBlock 
                  block={activeWarmUp}
                  onChange={(exs) => handleUpdateExercises('warmUp', exs)}
                  expandedExercises={expandedExercises}
                  toggleExpand={toggleExpand}
                  sessionGroups={activePlayerGroups}
                  isGk={false}
                />

                {/* Section: Main Part Block */}
                <ExerciseBlock 
                  block={activeMainPart}
                  onChange={(exs) => handleUpdateExercises('mainPart', exs)}
                  expandedExercises={expandedExercises}
                  toggleExpand={toggleExpand}
                  sessionGroups={activePlayerGroups}
                  isGk={false}
                />

                {/* Section: Cool Down Block */}
                <ExerciseBlock 
                  block={activeCoolDown}
                  onChange={(exs) => handleUpdateExercises('coolDown', exs)}
                  expandedExercises={expandedExercises}
                  toggleExpand={toggleExpand}
                  sessionGroups={activePlayerGroups}
                  isGk={false}
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
            squadRoster={session.squadRoster || squadPlayers.map(p => `${p.firstName} ${p.lastName}`)}
            fixtures={competitionFixtures}
            onUpdateFixtures={handleUpdateCompetitionFixtures}
            role="fitness"
            renderActiveSessionEditor={() => (
              <main className="space-y-6 md:space-y-8 print:space-y-1.5">
                
                {/* Header Section */}
                <HeaderSection 
                  session={session}
                  onChange={handleUpdateSession}
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
                />

                {/* Section: Player Groups Manager */}
                <PlayerGroupsSection
                  groups={activePlayerGroups}
                  squadRoster={session.squadRoster}
                  attendance={session.attendance}
                  onChangeGroups={handleUpdateGroups}
                  onChangeRoster={handleUpdateRoster}
                />

                {/* Section: Warm-Up Block */}
                <ExerciseBlock 
                  block={activeWarmUp}
                  onChange={(exs) => handleUpdateExercises('warmUp', exs)}
                  expandedExercises={expandedExercises}
                  toggleExpand={toggleExpand}
                  sessionGroups={activePlayerGroups}
                  isGk={false}
                />

                {/* Section: Main Part Block */}
                <ExerciseBlock 
                  block={activeMainPart}
                  onChange={(exs) => handleUpdateExercises('mainPart', exs)}
                  expandedExercises={expandedExercises}
                  toggleExpand={toggleExpand}
                  sessionGroups={activePlayerGroups}
                  isGk={false}
                />

                {/* Section: Cool Down Block */}
                <ExerciseBlock 
                  block={activeCoolDown}
                  onChange={(exs) => handleUpdateExercises('coolDown', exs)}
                  expandedExercises={expandedExercises}
                  toggleExpand={toggleExpand}
                  sessionGroups={activePlayerGroups}
                  isGk={false}
                />

                {/* Section: Observations & Notes */}
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
            squadRoster={session.squadRoster || squadPlayers.map(p => `${p.firstName} ${p.lastName}`)}
            fixtures={competitionFixtures}
            onUpdateFixtures={handleUpdateCompetitionFixtures}
            role="gk"
            renderActiveSessionEditor={() => (
              <main className="space-y-6 md:space-y-8 print:space-y-1.5">
                
                {/* Header Section */}
                <HeaderSection 
                  session={session}
                  onChange={handleUpdateSession}
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
                />

                {/* Section: Player Groups Manager */}
                <PlayerGroupsSection
                  groups={activePlayerGroups}
                  squadRoster={session.squadRoster}
                  attendance={session.attendance}
                  onChangeGroups={handleUpdateGroups}
                  onChangeRoster={handleUpdateRoster}
                />

                {/* Section: Warm-Up Block */}
                <ExerciseBlock 
                  block={activeWarmUp}
                  onChange={(exs) => handleUpdateExercises('warmUp', exs)}
                  expandedExercises={expandedExercises}
                  toggleExpand={toggleExpand}
                  sessionGroups={activePlayerGroups}
                  isGk={true}
                />

                {/* Section: Main Part Block */}
                <ExerciseBlock 
                  block={activeMainPart}
                  onChange={(exs) => handleUpdateExercises('mainPart', exs)}
                  expandedExercises={expandedExercises}
                  toggleExpand={toggleExpand}
                  sessionGroups={activePlayerGroups}
                  isGk={true}
                />

                {/* Section: Cool Down Block */}
                <ExerciseBlock 
                  block={activeCoolDown}
                  onChange={(exs) => handleUpdateExercises('coolDown', exs)}
                  expandedExercises={expandedExercises}
                  toggleExpand={toggleExpand}
                  sessionGroups={activePlayerGroups}
                  isGk={true}
                />

                {/* Section: Observations & Notes */}
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
          />
        ) : (
          <main className="space-y-6 md:space-y-8 print:space-y-1.5">
            
            {/* Header Section */}
            <HeaderSection 
              session={session}
              onChange={handleUpdateSession}
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
            />

            {/* Section: Player Groups Manager */}
            <PlayerGroupsSection
              groups={activePlayerGroups}
              squadRoster={session.squadRoster}
              attendance={session.attendance}
              onChangeGroups={handleUpdateGroups}
              onChangeRoster={handleUpdateRoster}
            />

            {/* Section: Warm-Up Block */}
            <ExerciseBlock 
              block={activeWarmUp}
              onChange={(exs) => handleUpdateExercises('warmUp', exs)}
              expandedExercises={expandedExercises}
              toggleExpand={toggleExpand}
              sessionGroups={activePlayerGroups}
              isGk={activeSection === 'gk'}
            />

            {/* Section: Main Part Block */}
            <ExerciseBlock 
              block={activeMainPart}
              onChange={(exs) => handleUpdateExercises('mainPart', exs)}
              expandedExercises={expandedExercises}
              toggleExpand={toggleExpand}
              sessionGroups={activePlayerGroups}
              isGk={activeSection === 'gk'}
            />

            {/* Section: Cool Down Block */}
            <ExerciseBlock 
              block={activeCoolDown}
              onChange={(exs) => handleUpdateExercises('coolDown', exs)}
              expandedExercises={expandedExercises}
              toggleExpand={toggleExpand}
              sessionGroups={activePlayerGroups}
              isGk={activeSection === 'gk'}
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
