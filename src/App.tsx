import React, { useState, useEffect, useRef } from 'react';
import { getDefaultSession, getDefaultFitnessSession, getEmptySession } from './defaultSession';
import { OFFICIAL_ALULA_LOGO_DATA_URL } from './constants/logo';
import { HeaderSection } from './components/HeaderSection';
import { ExerciseBlock } from './components/ExerciseBlock';
import { PlayerGroupsSection } from './components/PlayerGroupsSection';
import { Sidebar } from './components/Sidebar';
import { ExercisesLibrary } from './components/ExercisesLibrary';
import { PlanificationSection } from './components/PlanificationSection';
import { TrainingSession, Exercise, PlayerGroup, TrainingBlock } from './types';
import { 
  saveSessionToCloud, 
  deleteSessionFromCloud, 
  subscribeToSessions, 
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
  FileText
} from 'lucide-react';

export default function App() {
  const [activeSection, setActiveSection] = useState<'football' | 'fitness' | 'gk' | 'exercises' | 'planning'>('football');

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
          return {
            ...parsed,
            gkWarmUp: parsed.gkWarmUp || defaultTemplate.gkWarmUp || { id: 'warmup-block-gk', title: 'Warm Up', exercises: [] },
            gkMainPart: parsed.gkMainPart || defaultTemplate.gkMainPart || { id: 'main-block-gk', title: 'Main Part', exercises: [] },
            gkCoolDown: parsed.gkCoolDown || defaultTemplate.gkCoolDown || { id: 'cooldown-block-gk', title: 'Cool Down', exercises: [] },
            gkPlayerGroups: parsed.gkPlayerGroups || [],
          };
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
    return {
      ...fbSess,
      fitnessWarmUp: fbSess.fitnessWarmUp || fitSess.warmUp || { id: 'warmup-block-fitness', title: 'Warm Up', exercises: [] },
      fitnessMainPart: fbSess.fitnessMainPart || fitSess.mainPart || { id: 'main-block-fitness', title: 'Main Part', exercises: [] },
      fitnessCoolDown: fbSess.fitnessCoolDown || fitSess.coolDown || { id: 'cooldown-block-fitness', title: 'Cool Down', exercises: [] },
      fitnessPlayerGroups: fbSess.fitnessPlayerGroups || fitSess.playerGroups || [],
      gkWarmUp: fbSess.gkWarmUp || defaultTemplate.gkWarmUp || { id: 'warmup-block-gk', title: 'Warm Up', exercises: [] },
      gkMainPart: fbSess.gkMainPart || defaultTemplate.gkMainPart || { id: 'main-block-gk', title: 'Main Part', exercises: [] },
      gkCoolDown: fbSess.gkCoolDown || defaultTemplate.gkCoolDown || { id: 'cooldown-block-gk', title: 'Cool Down', exercises: [] },
      gkPlayerGroups: fbSess.gkPlayerGroups || [],
    };
  });

  const [isSaving, setIsSaving] = useState(false);
  const [expandedExercises, setExpandedExercises] = useState<Record<string, boolean>>({});

  const [cloudSessions, setCloudSessions] = useState<CloudTrainingSession[]>([]);
  const [isLoadingCloud, setIsLoadingCloud] = useState(true);
  const [isCloudSaving, setIsCloudSaving] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Refs to avoid infinite re-save loops between cloud and local state
  const isRemoteUpdateRef = useRef(false);
  const hasInitialCloudLoadedRef = useRef(false);

  // Subscribe to ALL unified sessions from Cloud Firestore and auto-load the active session on first load
  useEffect(() => {
    setIsLoadingCloud(true);
    const unsubscribe = subscribeToSessions((sessions) => {
      setCloudSessions(sessions);
      setIsLoadingCloud(false);

      if (sessions.length > 0) {
        // Read URL query parameters to see if a specific session ID was shared
        const urlParams = new URLSearchParams(window.location.search);
        const targetId = urlParams.get('session');

        let sessionToLoad = targetId 
          ? sessions.find(s => s.id === targetId) 
          : undefined;

        // If no target ID or not found in URL, pick the most recently updated session
        if (!sessionToLoad && !hasInitialCloudLoadedRef.current) {
          sessionToLoad = sessions[0];
        }

        if (sessionToLoad) {
          const localSavedAt = localStorage.getItem('u17_training_session_updatedAt');
          const localSavedTime = localSavedAt ? Number(localSavedAt) : 0;
          const cloudTime = sessionToLoad.updatedAt || 0;

          // Load on initial startup OR if URL specified a session ID OR if cloud data is newer
          if (!hasInitialCloudLoadedRef.current || targetId || cloudTime > localSavedTime) {
            hasInitialCloudLoadedRef.current = true;
            
            const { updatedAt, ...baseSession } = sessionToLoad;

            // Normalize old team names if needed
            if (baseSession.teamName === 'U17 Girls A.D. San Pedro') {
              baseSession.teamName = 'U17 Women Al Ula';
            }
            if (baseSession.sessionNumber === '42') {
              baseSession.sessionNumber = '001';
            }

            const defaultTemplate = getDefaultSession();

            const unifiedSession: TrainingSession = {
              ...baseSession,
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
              if (url.searchParams.get('session') !== unifiedSession.id) {
                url.searchParams.set('session', unifiedSession.id);
                window.history.replaceState({}, '', url.toString());
              }
            }
          } else {
            hasInitialCloudLoadedRef.current = true;
          }
        } else {
          hasInitialCloudLoadedRef.current = true;
        }
      } else {
        hasInitialCloudLoadedRef.current = true;
      }
    });
    return () => unsubscribe();
  }, []);

  // Automatically persist the unified session locally and auto-sync to Cloud Firestore
  useEffect(() => {
    setIsSaving(true);
    const now = Date.now();
    
    localStorage.setItem('u17_training_session_unified', JSON.stringify(session));
    localStorage.setItem('u17_training_session_updatedAt', String(now));

    // Update URL parameter without reloading page so sharing current URL works out of the box
    if (session.id && window.history.replaceState) {
      const url = new URL(window.location.href);
      if (url.searchParams.get('session') !== session.id) {
        url.searchParams.set('session', session.id);
        window.history.replaceState({}, '', url.toString());
      }
    }

    const localTimer = setTimeout(() => {
      setIsSaving(false);
    }, 400);

    // Prevent cloud auto-save before initial cloud load finishes
    if (!hasInitialCloudLoadedRef.current) {
      return () => clearTimeout(localTimer);
    }

    // If change was received from remote Cloud Firestore snapshot or session deletion/switch, don't re-trigger save
    if (isRemoteUpdateRef.current) {
      isRemoteUpdateRef.current = false;
      return () => clearTimeout(localTimer);
    }

    // Debounced Cloud Sync (Auto-save to Firestore)
    setIsCloudSaving(true);
    const cloudTimer = setTimeout(() => {
      const activeLogo = getActiveLogo();
      const sessionToSave: TrainingSession = {
        ...session,
        teamLogo: session.teamLogo || activeLogo,
        teamName: session.teamName === 'U17 Girls A.D. San Pedro' ? 'U17 Women Al Ula' : session.teamName
      };

      saveSessionToCloud(sessionToSave)
        .then(() => {
          setIsCloudSaving(false);
        })
        .catch((err) => {
          console.error('Auto-save to Cloud failed:', err);
          setIsCloudSaving(false);
        });
    }, 400);

    return () => {
      clearTimeout(localTimer);
      clearTimeout(cloudTimer);
    };
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

  const handleUpdateMaterials = (materialsNeeded: string) => {
    setSession(prev => ({
      ...prev,
      materialsNeeded
    }));
  };

  const handleImportSession = (imported: TrainingSession) => {
    // Fill fitness and GK blocks if they are missing from raw JSON import
    const defaultTemplate = getDefaultSession();
    const unifiedImport: TrainingSession = {
      ...imported,
      fitnessWarmUp: imported.fitnessWarmUp || { id: 'warmup-block-fitness', title: 'Warm Up', exercises: [] },
      fitnessMainPart: imported.fitnessMainPart || { id: 'main-block-fitness', title: 'Main Part', exercises: [] },
      fitnessCoolDown: imported.fitnessCoolDown || { id: 'cooldown-block-fitness', title: 'Cool Down', exercises: [] },
      fitnessPlayerGroups: imported.fitnessPlayerGroups || [],
      gkWarmUp: imported.gkWarmUp || defaultTemplate.gkWarmUp || { id: 'warmup-block-gk', title: 'Warm Up', exercises: [] },
      gkMainPart: imported.gkMainPart || defaultTemplate.gkMainPart || { id: 'main-block-gk', title: 'Main Part', exercises: [] },
      gkCoolDown: imported.gkCoolDown || defaultTemplate.gkCoolDown || { id: 'cooldown-block-gk', title: 'Cool Down', exercises: [] },
      gkPlayerGroups: imported.gkPlayerGroups || [],
    };
    
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
      setSession({
        ...demo,
        teamLogo: activeLogo
      });
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

      await saveSessionToCloud(sessionToSave);
      setSession(sessionToSave);
      alert('All changes saved successfully to the cloud!');
    } catch (error) {
      console.error('Error saving session to cloud:', error);
      alert('Failed to save session to the cloud. Please check your internet connection.');
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
      await saveSessionToCloud(newSession);
      setSession(newSession);
    } catch (error) {
      console.error('Error saving copy to cloud:', error);
      alert('Failed to save a new copy to the cloud.');
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

    const newSession: TrainingSession = {
      ...empty,
      id: newId,
      sessionNumber: newNumber,
      date: today,
      teamName: 'U17 Women Al Ula',
      teamLogo: activeLogo
    };

    try {
      setIsCloudSaving(true);
      await saveSessionToCloud(newSession);
      setSession(newSession);
    } catch (error) {
      console.error('Error creating new session in cloud:', error);
      alert('Failed to create a new session.');
    } finally {
      setIsCloudSaving(false);
    }
  };

  const handleLoadCloudSession = (loadedSession: CloudTrainingSession) => {
    if (confirm(`Do you want to load session #${loadedSession.sessionNumber} (${loadedSession.date})? Your current unsaved local changes will be replaced.`)) {
      const { updatedAt, ...baseSession } = loadedSession;
      const defaultTemplate = getDefaultSession();
      
      // Upgrade fitness and GK fields if missing from loaded old document
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

      if (unifiedSession.id && window.history.replaceState) {
        const url = new URL(window.location.href);
        url.searchParams.set('session', unifiedSession.id);
        window.history.replaceState({}, '', url.toString());
      }

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

      // 1. Force instant Cloud Firestore save so current state is 100% saved before sharing
      await saveSessionToCloud(sessionToSave);
      setSession(sessionToSave);

      // 2. Build sharing URL with target session ID
      const url = new URL(window.location.href);
      url.searchParams.set('session', sessionToSave.id);

      if (window.history.replaceState) {
        window.history.replaceState({}, '', url.toString());
      }

      await navigator.clipboard.writeText(url.toString());
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 3000);
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

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans flex flex-col md:flex-row print:block print:bg-white">
      
      {/* Lateral Dark Blue Navigation Sidebar */}
      <Sidebar
        session={session}
        activeSection={activeSection}
        setActiveSection={setActiveSection}
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
      />

      {/* Main Content Workspace Area */}
      <div className="flex-1 min-w-0 p-3 sm:p-6 md:p-8 print:p-0 max-w-6xl mx-auto w-full">
        {activeSection === 'planning' ? (
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
        ) : (
          <main className="space-y-6 md:space-y-8 print:space-y-4">
            
            {/* Header Section */}
            <HeaderSection 
              session={session}
              onChange={handleUpdateSession}
            />

            {/* Section: Player Groups Manager */}
            <PlayerGroupsSection
              groups={activePlayerGroups}
              squadRoster={session.squadRoster}
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
            />

            {/* Section: Main Part Block */}
            <ExerciseBlock 
              block={activeMainPart}
              onChange={(exs) => handleUpdateExercises('mainPart', exs)}
              expandedExercises={expandedExercises}
              toggleExpand={toggleExpand}
              sessionGroups={activePlayerGroups}
            />

            {/* Section: Cool Down Block */}
            <ExerciseBlock 
              block={activeCoolDown}
              onChange={(exs) => handleUpdateExercises('coolDown', exs)}
              expandedExercises={expandedExercises}
              toggleExpand={toggleExpand}
              sessionGroups={activePlayerGroups}
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
        <footer className="hidden print:grid grid-cols-2 gap-8 mt-12 pt-8 border-t-2 border-slate-200">
          <div>
            <div className="border-b border-slate-300 h-10 w-full mb-1"></div>
            <p className="text-[10px] uppercase font-bold text-slate-500 text-center">Head Coach Signature</p>
          </div>
          <div>
            <div className="border-b border-slate-300 h-10 w-full mb-1"></div>
            <p className="text-[10px] uppercase font-bold text-slate-500 text-center">Assistant Coach Signature</p>
          </div>
          <div className="col-span-2 text-center text-[9px] text-slate-400 mt-4">
            Training Session created with <span className="font-semibold text-slate-600">U17 Training Sessions Planner</span>. Authorized for official club coaching staff use.
          </div>
        </footer>

      </div>
    </div>
  );
}
