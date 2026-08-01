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
import { CompetitionSection } from './components/CompetitionSection';
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
  VideoAnalysis 
} from './types';
import { 
  saveSessionToCloud, 
  deleteSessionFromCloud, 
  subscribeToSessions, 
  subscribeToAuth,
  logoutUser,
  isCloudQuotaExceeded,
  markQuotaExceeded,
  clearQuotaExceeded,
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
  Users
} from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthInitializing, setIsAuthInitializing] = useState<boolean>(true);
  const [activeSection, setActiveSection] = useState<PortalSection>('hub');
  const [footballSubTab, setFootballSubTab] = useState<'sessions' | 'planning' | 'competition'>('sessions');

  // Squad Players ("Plantilla")
  const [squadPlayers, setSquadPlayers] = useState<SquadPlayer[]>(() => {
    try {
      const saved = localStorage.getItem('u17_squad_players');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return DEFAULT_DETAILED_SQUAD;
  });

  // Physiotherapy Records
  const [physioRecords, setPhysioRecords] = useState<PhysioRecord[]>(() => {
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
  });

  // Video Analysis Sessions
  const [videoSessions, setVideoSessions] = useState<VideoAnalysis[]>(() => {
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
  });

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = subscribeToAuth((user) => {
      setCurrentUser(user);
      setIsAuthInitializing(false);
    });
    return () => unsubscribe();
  }, []);

  // Load and merge into a single unified session
  const [session, setSession] = useState<TrainingSession>(() => {
    const unifiedSaved = localStorage.getItem('u17_training_session_unified');
    if (unifiedSaved) {
      try {
        const parsed = JSON.parse(unifiedSaved);
        if (parsed && typeof parsed === 'object' && parsed.teamName) {
          if (parsed.teamName === 'U17 Girls A.D. San Pedro') {
            parsed.teamName = 'U17 Women Al Ula';
          }
          if (parsed.sessionNumber === '42') {
            parsed.sessionNumber = '001';
          }
          const defaultTemplate = getDefaultSession();
          return normalizeSessionRoster({
            ...parsed,
            gkWarmUp: parsed.gkWarmUp || defaultTemplate.gkWarmUp || { id: 'warmup-block-gk', title: 'Warm Up', exercises: [] },
            gkMainPart: parsed.gkMainPart || defaultTemplate.gkMainPart || { id: 'main-block-gk', title: 'Main Part', exercises: [] },
            gkCoolDown: parsed.gkCoolDown || defaultTemplate.gkCoolDown || { id: 'cooldown-block-gk', title: 'Cool Down', exercises: [] },
            gkPlayerGroups: parsed.gkPlayerGroups || [],
          });
        }
      } catch (e) {
        console.error('Failed to parse saved unified session:', e);
      }
    }

    // Fallback: merge separate football and fitness sessions if they exist
    let fbSess = getDefaultSession();
    const fbSaved = localStorage.getItem('u17_training_session_football') || localStorage.getItem('u17_training_session');
    if (fbSaved) {
      try {
        const parsed = JSON.parse(fbSaved);
        if (parsed && typeof parsed === 'object' && parsed.teamName) {
          fbSess = parsed;
        }
      } catch (e) {}
    }

    let fitSess = getDefaultFitnessSession();
    const fitSaved = localStorage.getItem('u17_training_session_fitness');
    if (fitSaved) {
      try {
        const parsed = JSON.parse(fitSaved);
        if (parsed && typeof parsed === 'object' && parsed.teamName) {
          fitSess = parsed;
        }
      } catch (e) {}
    }

    const defaultTemplate = getDefaultSession();

    // Merge them into one unified session
    return normalizeSessionRoster({
      ...fbSess,
      fitnessWarmUp: fbSess.fitnessWarmUp || fitSess.warmUp || { id: 'warmup-block-fitness', title: 'Warm Up', exercises: [] },
      fitnessMainPart: fbSess.fitnessMainPart || fitSess.mainPart || { id: 'main-block-fitness', title: 'Main Part', exercises: [] },
      fitnessCoolDown: fbSess.fitnessCoolDown || fitSess.coolDown || { id: 'cooldown-block-fitness', title: 'Cool Down', exercises: [] },
      fitnessPlayerGroups: fbSess.fitnessPlayerGroups || fitSess.playerGroups || [],
      gkWarmUp: fbSess.gkWarmUp || defaultTemplate.gkWarmUp || { id: 'warmup-block-gk', title: 'Warm Up', exercises: [] },
      gkMainPart: fbSess.gkMainPart || defaultTemplate.gkMainPart || { id: 'main-block-gk', title: 'Main Part', exercises: [] },
      gkCoolDown: fbSess.gkCoolDown || defaultTemplate.gkCoolDown || { id: 'cooldown-block-gk', title: 'Cool Down', exercises: [] },
      gkPlayerGroups: fbSess.gkPlayerGroups || [],
    });
  });

  const [isSaving, setIsSaving] = useState(false);
  const [expandedExercises, setExpandedExercises] = useState<Record<string, boolean>>({});

  const [cloudSessions, setCloudSessions] = useState<CloudTrainingSession[]>([]);
  const [isLoadingCloud, setIsLoadingCloud] = useState(true);
  const [isCloudSaving, setIsCloudSaving] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

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
  const lastLoadedSessionTimeRef = useRef<number>(0);
  const currentSessionIdRef = useRef<string>('');
  const latestSessionRef = useRef<TrainingSession>(session);
  const lastSavedJsonRef = useRef<string>('');
  const cloudQuotaExceededUntilRef = useRef<number>(0);

  // Keep latest session ref in sync for window unload / visibilitychange handlers
  useEffect(() => {
    latestSessionRef.current = session;
  }, [session]);

  // Direct helper to save current session to Firestore immediately
  const saveCurrentSessionToCloudNow = async (sessionToSave: TrainingSession, force: boolean = false) => {
    // Check if daily quota was recently exceeded; if so, skip background autosave
    if (!force && isCloudQuotaExceeded()) {
      setIsCloudSaving(false);
      return;
    }

    const activeLogo = getActiveLogo();
    const formattedSession: TrainingSession = {
      ...sessionToSave,
      teamLogo: sessionToSave.teamLogo || activeLogo,
      teamName: sessionToSave.teamName === 'U17 Girls A.D. San Pedro' ? 'U17 Women Al Ula' : sessionToSave.teamName
    };

    const currentJson = JSON.stringify(formattedSession);
    if (currentJson === lastSavedJsonRef.current) {
      setIsCloudSaving(false);
      return;
    }

    setIsCloudSaving(true);
    setIsSaving(true);
    try {
      const savedTime = await saveSessionToCloud(formattedSession, force);
      lastLoadedSessionTimeRef.current = savedTime;
      lastSavedJsonRef.current = currentJson;
      clearQuotaExceeded();
      cloudQuotaExceededUntilRef.current = 0;
    } catch (_err) {
      console.warn('Cloud save skipped or throttled. All progress remains safely saved locally.');
    } finally {
      setIsCloudSaving(false);
      setTimeout(() => setIsSaving(false), 800);
    }
  };

  // Immediate flush on page hide or tab close so no pending edits are lost
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && latestSessionRef.current) {
        saveCurrentSessionToCloudNow(latestSessionRef.current);
      }
    };

    const handleBeforeUnload = () => {
      if (latestSessionRef.current) {
        saveCurrentSessionToCloudNow(latestSessionRef.current);
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

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

          // If a specific ID is requested in the URL, use it; otherwise fallback to sessions[0] (most recently updated session in Cloud)
          let sessionToLoad = targetId 
            ? sessions.find(s => s.id === targetId) 
            : undefined;

          if (!sessionToLoad) {
            // If targetId was specified in URL, but hasn't reached Firestore yet,
            // do NOT fall back to sessions[0] if user is already on targetId
            if (targetId && currentSessionIdRef.current === targetId) {
              hasInitialCloudLoadedRef.current = true;
              return;
            }
            sessionToLoad = sessions[0]; // Pick the latest active session in Firestore
          }

          if (sessionToLoad) {
            const cloudTime = sessionToLoad.updatedAt || 0;
            const isNewer = cloudTime > lastLoadedSessionTimeRef.current;
            const isDifferentSession = sessionToLoad.id !== currentSessionIdRef.current;

            // Load from cloud if:
            // 1) First initial startup
            // 2) Received a newer timestamp update from Firestore
            // 3) Session ID changed
            if (!hasInitialCloudLoadedRef.current || isNewer || isDifferentSession) {
              hasInitialCloudLoadedRef.current = true;
              lastLoadedSessionTimeRef.current = cloudTime;
              currentSessionIdRef.current = sessionToLoad.id;

              const { updatedAt, ...baseSession } = sessionToLoad;

              // Normalize old team names if needed
              if (baseSession.teamName === 'U17 Girls A.D. San Pedro') {
                baseSession.teamName = 'U17 Women Al Ula';
              }
              if (baseSession.sessionNumber === '42') {
                baseSession.sessionNumber = '001';
              }

              const defaultTemplate = getDefaultSession();

              const unifiedSession: TrainingSession = normalizeSessionRoster({
                ...baseSession,
                fitnessWarmUp: baseSession.fitnessWarmUp || { id: 'warmup-block-fitness', title: 'Warm Up', exercises: [] },
                fitnessMainPart: baseSession.fitnessMainPart || { id: 'main-block-fitness', title: 'Main Part', exercises: [] },
                fitnessCoolDown: baseSession.fitnessCoolDown || { id: 'cooldown-block-fitness', title: 'Cool Down', exercises: [] },
                fitnessPlayerGroups: baseSession.fitnessPlayerGroups || [],
                gkWarmUp: baseSession.gkWarmUp || defaultTemplate.gkWarmUp || { id: 'warmup-block-gk', title: 'Warm Up', exercises: [] },
                gkMainPart: baseSession.gkMainPart || defaultTemplate.gkMainPart || { id: 'main-block-gk', title: 'Main Part', exercises: [] },
                gkCoolDown: baseSession.gkCoolDown || defaultTemplate.gkCoolDown || { id: 'cooldown-block-gk', title: 'Cool Down', exercises: [] },
                gkPlayerGroups: baseSession.gkPlayerGroups || [],
              });

              isRemoteUpdateRef.current = true;
              lastSavedJsonRef.current = JSON.stringify(unifiedSession);
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

  // Scheduled Daily Sync at 0:30 AM (after Firestore daily write quota resets)
  useEffect(() => {
    const checkDailyReset = () => {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const todayStr = `${year}-${month}-${day}`;

      // Check if current local time is at or past 0:30 AM (00:30)
      const isPast030 = now.getHours() > 0 || (now.getHours() === 0 && now.getMinutes() >= 30);

      const lastResetDate = localStorage.getItem('u17_last_030_reset_date');

      if (isPast030 && lastResetDate !== todayStr) {
        console.log('Resetting daily Firestore quota lock at 0:30 AM and performing initial daily save...');
        clearQuotaExceeded();
        cloudQuotaExceededUntilRef.current = 0;
        localStorage.setItem('u17_last_030_reset_date', todayStr);

        if (latestSessionRef.current) {
          saveCurrentSessionToCloudNow(latestSessionRef.current);
        }
      }
    };

    checkDailyReset();
    const interval = setInterval(checkDailyReset, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, []);

  // Debounced Cloud Autosave: automatically sync local changes to Firestore 2.5 seconds after editing stops
  useEffect(() => {
    // If this session state update came directly from a Firestore remote snapshot, skip auto-saving
    if (isRemoteUpdateRef.current) {
      isRemoteUpdateRef.current = false;
      return;
    }

    const timer = setTimeout(() => {
      if (latestSessionRef.current) {
        saveCurrentSessionToCloudNow(latestSessionRef.current);
      }
    }, 2500); // 2.5 seconds debounce for real-time cloud sync

    return () => clearTimeout(timer);
  }, [session]);

  const handleUpdateSession = (fields: Partial<TrainingSession>) => {
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
    setSquadPlayers(updated);
    try {
      localStorage.setItem('u17_squad_players', JSON.stringify(updated));
    } catch (e) {}

    const formattedRoster = updated.map(p => 
      p.position === 'GK' ? `${p.firstName} (GK)` : `${p.firstName} ${p.lastName}`
    );
    handleUpdateRoster(formattedRoster);
  };

  const handleUpdatePhysioRecords = (records: PhysioRecord[]) => {
    setPhysioRecords(records);
    try {
      localStorage.setItem('u17_physio_records', JSON.stringify(records));
    } catch (e) {}
  };

  const handleUpdateSquadStatusFromPhysio = (playerId: string, newStatus: SquadPlayer['status']) => {
    const updated = squadPlayers.map(p => p.id === playerId ? { ...p, status: newStatus } : p);
    handleUpdateSquadPlayers(updated);
  };

  const handleUpdateVideoSessions = (sessionsList: VideoAnalysis[]) => {
    setVideoSessions(sessionsList);
    try {
      localStorage.setItem('u17_video_sessions', JSON.stringify(sessionsList));
    } catch (e) {}
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
    // Fill fitness and GK blocks if they are missing from raw JSON import
    const defaultTemplate = getDefaultSession();
    const unifiedImport: TrainingSession = normalizeSessionRoster({
      ...imported,
      fitnessWarmUp: imported.fitnessWarmUp || { id: 'warmup-block-fitness', title: 'Warm Up', exercises: [] },
      fitnessMainPart: imported.fitnessMainPart || { id: 'main-block-fitness', title: 'Main Part', exercises: [] },
      fitnessCoolDown: imported.fitnessCoolDown || { id: 'cooldown-block-fitness', title: 'Cool Down', exercises: [] },
      fitnessPlayerGroups: imported.fitnessPlayerGroups || [],
      gkWarmUp: imported.gkWarmUp || defaultTemplate.gkWarmUp || { id: 'warmup-block-gk', title: 'Warm Up', exercises: [] },
      gkMainPart: imported.gkMainPart || defaultTemplate.gkMainPart || { id: 'main-block-gk', title: 'Main Part', exercises: [] },
      gkCoolDown: imported.gkCoolDown || defaultTemplate.gkCoolDown || { id: 'cooldown-block-gk', title: 'Cool Down', exercises: [] },
      gkPlayerGroups: imported.gkPlayerGroups || [],
    });
    
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
    let savedLogo = '';
    try {
      savedLogo = localStorage.getItem('u17_uploaded_team_logo') || '';
    } catch (e) {}

    if (savedLogo) {
      return savedLogo;
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

      try {
        const savedTime = await saveSessionToCloud(sessionToSave, true);
        lastLoadedSessionTimeRef.current = savedTime;
        lastSavedJsonRef.current = JSON.stringify(sessionToSave);
        clearQuotaExceeded();
        cloudQuotaExceededUntilRef.current = 0;
        alert('¡Cambios guardados en la nube y sincronizados en todos tus dispositivos!');
      } catch (cloudErr) {
        console.warn('Cloud save warning in handleSaveActiveToCloud:', cloudErr);
        alert('¡Guardado en tu navegador! (Se reintentará la sincronización en la nube cuando se reestablezca el límite de Firestore).');
      }
    } catch (error) {
      console.error('Error saving session:', error);
      alert('¡Guardado en el navegador!');
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
        console.warn('Cloud save warning on new copy:', cloudErr);
      }
    } catch (error) {
      console.error('Error saving copy:', error);
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

      try {
        await saveSessionToCloud(newSession);
      } catch (cloudErr) {
        console.warn('Cloud save warning on new session:', cloudErr);
      }
    } catch (error) {
      console.error('Error creating new session:', error);
    } finally {
      setIsCloudSaving(false);
    }
  };

  const handleLoadCloudSession = (loadedSession: CloudTrainingSession) => {
    if (confirm(`Do you want to load session #${loadedSession.sessionNumber} (${loadedSession.date})? Your current unsaved local changes will be replaced.`)) {
      const { updatedAt, ...baseSession } = loadedSession;
      const defaultTemplate = getDefaultSession();
      
      // Upgrade fitness and GK fields if missing from loaded old document
      const unifiedSession: TrainingSession = normalizeSessionRoster({
        ...baseSession,
        teamName: baseSession.teamName === 'U17 Girls A.D. San Pedro' ? 'U17 Women Al Ula' : baseSession.teamName,
        fitnessWarmUp: baseSession.fitnessWarmUp || { id: 'warmup-block-fitness', title: 'Warm Up', exercises: [] },
        fitnessMainPart: baseSession.fitnessMainPart || { id: 'main-block-fitness', title: 'Main Part', exercises: [] },
        fitnessCoolDown: baseSession.fitnessCoolDown || { id: 'cooldown-block-fitness', title: 'Cool Down', exercises: [] },
        fitnessPlayerGroups: baseSession.fitnessPlayerGroups || [],
        gkWarmUp: baseSession.gkWarmUp || defaultTemplate.gkWarmUp || { id: 'warmup-block-gk', title: 'Warm Up', exercises: [] },
        gkMainPart: baseSession.gkMainPart || defaultTemplate.gkMainPart || { id: 'main-block-gk', title: 'Main Part', exercises: [] },
        gkCoolDown: baseSession.gkCoolDown || defaultTemplate.gkCoolDown || { id: 'cooldown-block-gk', title: 'Cool Down', exercises: [] },
        gkPlayerGroups: baseSession.gkPlayerGroups || [],
      });

      if (unifiedSession.id && window.history.replaceState) {
        const url = new URL(window.location.href);
        url.searchParams.set('session', unifiedSession.id);
        window.history.replaceState({}, '', url.toString());
      }

      isRemoteUpdateRef.current = true;
      lastLoadedSessionTimeRef.current = loadedSession.updatedAt || Date.now();
      currentSessionIdRef.current = unifiedSession.id;
      lastSavedJsonRef.current = JSON.stringify(unifiedSession);

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
            const defaultTemplate = getDefaultSession();
            
            const unifiedSession: TrainingSession = {
              ...baseSession,
              teamName: baseSession.teamName === 'U17 Girls A.D. San Pedro' ? 'U17 Women Al Ula' : baseSession.teamName,
              fitnessWarmUp: baseSession.fitnessWarmUp || { id: 'warmup-block-fitness', title: 'Warm Up', exercises: [] },
              fitnessMainPart: baseSession.fitnessMainPart || { id: 'main-block-fitness', title: 'Main Part', exercises: [] },
              fitnessCoolDown: baseSession.fitnessCoolDown || { id: 'cooldown-block-fitness', title: 'Cool Down', exercises: [] },
              fitnessPlayerGroups: baseSession.fitnessPlayerGroups || [],
              gkWarmUp: baseSession.gkWarmUp || defaultTemplate.gkWarmUp || { id: 'warmup-block-gk', title: 'Warm Up', exercises: [] },
              gkMainPart: baseSession.gkMainPart || defaultTemplate.gkMainPart || { id: 'main-block-gk', title: 'Main Part', exercises: [] },
              gkCoolDown: baseSession.gkCoolDown || defaultTemplate.gkCoolDown || { id: 'cooldown-block-gk', title: 'Cool Down', exercises: [] },
              gkPlayerGroups: baseSession.gkPlayerGroups || [],
            };

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

      // 2. Try Cloud Firestore save
      try {
        const savedTime = await saveSessionToCloud(sessionToSave);
        lastLoadedSessionTimeRef.current = savedTime;
        lastSavedJsonRef.current = JSON.stringify(sessionToSave);
      } catch (cloudErr) {
        console.warn('Cloud save warning on share link:', cloudErr);
      }

      // 3. Build sharing URL with target session ID
      const url = new URL(window.location.href);
      url.searchParams.set('session', sessionToSave.id);

      if (window.history.replaceState) {
        window.history.replaceState({}, '', url.toString());
      }

      await navigator.clipboard.writeText(url.toString());
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 3000);
      alert('¡Enlace copiado al portapapeles! Los demás usuarios verán tus cambios en tiempo real en la nube.');
    } catch (error) {
      console.error('Error copying share link:', error);
      const url = new URL(window.location.href);
      url.searchParams.set('session', session.id);
      alert('Enlace de sesión: ' + url.toString());
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

  // Auth Guard: Show loading indicator or Login Page if unauthenticated
  if (isAuthInitializing) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="flex flex-col items-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
          <span className="text-sm font-bold text-slate-300">Loading U17 Portal...</span>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginPage onSuccess={() => {}} />;
  }

  // Standalone Portal Navigation Hub View (No sidebar, clean light layout)
  if (activeSection === 'hub') {
    return (
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
        currentLogo={session.teamLogo || getActiveLogo()}
        onUpdateLogo={(newLogo) => handleUpdateSession({ teamLogo: newLogo })}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans flex flex-col md:flex-row print:block print:bg-white">
      
      {/* Lateral Dark Blue Navigation Sidebar */}
      <Sidebar
        session={session}
        activeSection={activeSection}
        setActiveSection={setActiveSection}
        totalLibraryExercisesCount={libraryCount}
        onClearSession={handleClearSession}
        onNewSession={handleCreateNewCloudSession}
        isSaving={isSaving}
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
            squadRoster={session.squadRoster || squadPlayers.map(p => `${p.firstName} ${p.lastName}`)}
            renderActiveSessionEditor={() => (
              <main className="space-y-6 md:space-y-8 print:space-y-1.5">
                
                {/* Header Section */}
                <HeaderSection 
                  session={session}
                  onChange={handleUpdateSession}
                />

                {/* Section: Session Attendance Quick Tracker */}
                <SessionAttendanceTracker
                  attendance={session.attendance}
                  squadRoster={session.squadRoster}
                  onChangeAttendance={handleUpdateAttendance}
                  onChangeRoster={handleUpdateRoster}
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
          />
        ) : (
          <main className="space-y-6 md:space-y-8 print:space-y-1.5">
            
            {/* Header Section */}
            <HeaderSection 
              session={session}
              onChange={handleUpdateSession}
            />

            {/* Section: Session Attendance Quick Tracker */}
            <SessionAttendanceTracker
              attendance={session.attendance}
              squadRoster={session.squadRoster}
              onChangeAttendance={handleUpdateAttendance}
              onChangeRoster={handleUpdateRoster}
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
