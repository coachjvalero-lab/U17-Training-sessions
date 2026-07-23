import React, { useState, useEffect, useRef } from 'react';
import { getDefaultSession, getDefaultFitnessSession, getEmptySession } from './defaultSession';
import { OFFICIAL_ALULA_LOGO_DATA_URL } from './constants/logo';
import { HeaderSection } from './components/HeaderSection';
import { ExerciseBlock } from './components/ExerciseBlock';
import { PlayerGroupsSection } from './components/PlayerGroupsSection';
import { ControlPanel } from './components/ControlPanel';
import { TrainingSession, Exercise, PlayerGroup } from './types';
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
  const [activeSection, setActiveSection] = useState<'football' | 'fitness' | 'gk'>('football');

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
      alert('¡Todos los cambios se han guardado con éxito en la nube!');
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
      alert('Enlace de la sesión: ' + url.toString());
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
    <div className="min-h-screen bg-slate-50 text-slate-800 antialiased font-sans pb-16 print:bg-white print:pb-0 print:pt-0">
      
      {/* Outer Wrapper */}
      <div className="w-full max-w-5xl mx-auto px-4 py-6 space-y-6 md:py-8 md:space-y-8 print:p-0 print:max-w-full">
        
        {/* Floating / Sticky Control Panel - Hidden in Print */}
        <ControlPanel 
          session={session}
          onImportSession={handleImportSession}
          onClearSession={handleClearSession}
          onRestoreDemo={handleRestoreDemo}
          isSaving={isSaving}
        />

        {/* Section Switcher Tabs - Hidden in Print */}
        <div className="flex bg-[#ede9e6] p-1.5 rounded-2xl max-w-lg mx-auto print:hidden shadow-inner border border-[#a79078]/30 gap-1.5">
          <button
            type="button"
            onClick={() => setActiveSection('football')}
            className={`flex-1 flex items-center justify-center space-x-1.5 py-3 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
              activeSection === 'football' 
                ? 'bg-[#002142] text-[#a79078] shadow-md shadow-[#002142]/25 border border-[#a79078]/30' 
                : 'text-[#30221c]/70 hover:text-[#002142] hover:bg-white/60'
            }`}
          >
            <span>⚽</span>
            <span>Football</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('fitness')}
            className={`flex-1 flex items-center justify-center space-x-1.5 py-3 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
              activeSection === 'fitness' 
                ? 'bg-[#002142] text-[#a79078] shadow-md shadow-[#002142]/25 border border-[#a79078]/30' 
                : 'text-[#30221c]/70 hover:text-[#002142] hover:bg-white/60'
            }`}
          >
            <span>⚡</span>
            <span>Fitness</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('gk')}
            className={`flex-1 flex items-center justify-center space-x-1.5 py-3 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
              activeSection === 'gk' 
                ? 'bg-[#002142] text-[#a79078] shadow-md shadow-[#002142]/25 border border-[#a79078]/30' 
                : 'text-[#30221c]/70 hover:text-[#002142] hover:bg-white/60'
            }`}
          >
            <span>🧤</span>
            <span>GK Training</span>
          </button>
        </div>

        {/* Dynamic Coach Instruction Banner - Hidden in Print */}
        <div className="bg-emerald-50/40 border border-emerald-500/15 rounded-2xl p-5 flex items-start space-x-4 shadow-sm shadow-emerald-50/50 print:hidden">
          <div className="p-2.5 bg-emerald-500 rounded-xl text-white shrink-0 shadow-md shadow-emerald-500/20">
            <Info className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-display font-black tracking-wider uppercase text-emerald-800">Professional U17 Session Designer</h3>
            <p className="text-xs font-medium text-slate-600 mt-1 leading-relaxed">
              Fill in the session details, select tactical diagrams or upload your own diagrams. When finished, use the <strong className="text-emerald-700 font-bold">Print / PDF</strong> action to generate a compact, beautifully styled sheet to bring to the pitch or share digitally.
            </p>
            <div className="mt-3 flex items-center space-x-3">
              <button
                type="button"
                onClick={() => handleToggleAll(true)}
                className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 hover:text-emerald-800 cursor-pointer"
              >
                Expand all exercises
              </button>
              <span className="text-slate-300 text-[10px]">|</span>
              <button
                type="button"
                onClick={() => handleToggleAll(false)}
                className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 hover:text-emerald-800 cursor-pointer"
              >
                Collapse all exercises
              </button>
            </div>
          </div>
        </div>

        {/* Cloud Database Integration Section - Hidden in Print */}
        <div className="bg-gradient-to-br from-[#0f5981] via-[#16638f] to-[#1d6fa2] text-white rounded-3xl p-6 border border-[#5ea4c5]/35 shadow-xl print:hidden space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/15">
            <div className="flex items-center space-x-3.5">
              <div className="p-2.5 bg-white/10 rounded-xl text-[#ede9e6] border border-white/20 shrink-0">
                <Database className="w-5 h-5 text-[#a79078]" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-1.5">
                  <span>Al Ula SC Cloud Library</span>
                  <span className="bg-[#a79078]/25 text-[#f4efe8] text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-[#a79078]/40">
                    Real-time
                  </span>
                </h3>
                <p className="text-xs text-sky-100/80 mt-0.5 font-medium">
                  Any coach can read, edit, or create training sessions. All data is automatically synchronized for everyone.
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleCreateNewCloudSession}
                disabled={isCloudSaving}
                className="flex items-center space-x-1.5 bg-[#002142] hover:bg-[#002e5c] text-white text-xs font-black uppercase tracking-wider py-2.5 px-4 rounded-xl transition-all cursor-pointer border border-[#5ea4c5]/30 disabled:opacity-50 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5 text-[#a79078]" />
                <span>New Session</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Active Session Status & Actions */}
            <div className="lg:col-span-5 bg-[#002142]/85 p-5 rounded-2xl border border-[#5ea4c5]/25 flex flex-col justify-between shadow-inner">
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-[#a79078] uppercase tracking-wider">Active Workspace Session</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      isCloudSaving 
                        ? 'bg-amber-500/20 text-amber-200 border-amber-400/30' 
                        : 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30'
                    }`}>
                      {isCloudSaving ? '⚡ Guardando...' : '✓ Sincronizado'}
                    </span>
                  </div>
                  <h4 className="text-base font-black text-white mt-1">
                    Sesión #{session.sessionNumber || '1'}
                  </h4>
                  <p className="text-xs text-sky-100/80 mt-1 line-clamp-2 font-medium">
                    {session.mainObjective || 'No objective specified.'}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-sky-200/90 font-bold uppercase">
                    <span className="bg-[#0f5981]/60 border border-sky-400/20 px-2 py-1 rounded">Date: {session.date || '-'}</span>
                    <span className="bg-[#0f5981]/60 border border-sky-400/20 px-2 py-1 rounded">Type: {activeSection === 'football' ? '⚽ Football' : activeSection === 'fitness' ? '⚡ Fitness' : '🧤 GK Training'}</span>
                  </div>
                </div>

                <div className="bg-[#0f5981]/40 p-3.5 rounded-xl border border-sky-400/20 text-[11px] text-sky-100 leading-relaxed font-medium space-y-2">
                  <p>
                    <strong>Sincronización automática:</strong> Todos los cambios que realizas se guardan automáticamente en la nube en tiempo real.
                  </p>
                  <button
                    type="button"
                    onClick={handleCopyShareLink}
                    className="w-full flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider py-2.5 px-3 rounded-xl transition-all cursor-pointer shadow-md shadow-emerald-950/40"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-200" />
                        <span>¡Enlace copiado!</span>
                      </>
                    ) : (
                      <>
                        <Share2 className="w-4 h-4" />
                        <span>Copiar Enlace para Compartir</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-6">
                <button
                  type="button"
                  onClick={handleSaveActiveToCloud}
                  disabled={isCloudSaving}
                  className="flex items-center justify-center space-x-1.5 bg-[#a79078] hover:bg-[#967f67] text-slate-950 font-black text-[11px] uppercase tracking-wider py-3 px-4 rounded-xl transition-all cursor-pointer disabled:opacity-50 shadow-sm"
                >
                  <CloudUpload className="w-3.5 h-3.5" />
                  <span>{isCloudSaving ? 'Saving...' : 'Save Changes'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveAsNewToCloud}
                  disabled={isCloudSaving}
                  className="flex items-center justify-center space-x-1.5 bg-[#002142] hover:bg-[#002e5c] text-white border border-[#5ea4c5]/30 font-black text-[11px] uppercase tracking-wider py-3 px-4 rounded-xl transition-all cursor-pointer disabled:opacity-50 shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5 text-[#a79078]" />
                  <span>Save as Copy</span>
                </button>
              </div>
            </div>

            {/* Cloud Library Session List */}
            <div className="lg:col-span-7 flex flex-col space-y-3">
              <span className="text-[10px] font-bold text-[#a79078] uppercase tracking-wider">
                Saved Sessions ({cloudSessions.length})
              </span>

              {isLoadingCloud ? (
                <div className="flex-1 flex flex-col items-center justify-center py-12 text-sky-200/70">
                  <RefreshCw className="w-6 h-6 animate-spin text-[#a79078]" />
                  <span className="text-xs mt-2 uppercase font-black tracking-widest">Loading cloud list...</span>
                </div>
              ) : cloudSessions.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-10 text-sky-200/70 bg-[#002142]/85 border border-dashed border-[#5ea4c5]/30 rounded-2xl">
                  <Cloud className="w-8 h-8 text-sky-300/50 mb-2" />
                  <p className="text-xs font-bold text-white">No saved cloud sessions found</p>
                  <p className="text-[10px] text-sky-200/60 mt-1 max-w-[250px] text-center font-medium">
                    Click "Save Changes" on the left to upload your first cloud training!
                  </p>
                </div>
              ) : (
                <div className="max-h-[295px] overflow-y-auto pr-1 space-y-2 custom-scrollbar">
                  {cloudSessions.map((cloudSess) => {
                    const isActive = cloudSess.id === session.id;
                    return (
                      <div
                        key={cloudSess.id}
                        onClick={() => handleLoadCloudSession(cloudSess)}
                        className={`group flex items-center justify-between p-3.5 rounded-xl transition-all cursor-pointer text-left ${
                          isActive 
                            ? 'border-[#a79078] bg-[#002142] shadow-md shadow-[#002142]/50 border-2' 
                            : 'bg-[#002142]/65 hover:bg-[#002142] border border-[#5ea4c5]/20 hover:border-[#5ea4c5]/40'
                        }`}
                      >
                        <div className="space-y-1 max-w-[85%]">
                          <div className="flex items-center space-x-2">
                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                              isActive 
                                ? 'bg-[#a79078] text-slate-950' 
                                : 'bg-[#0f5981] text-sky-100 border border-sky-400/20'
                            }`}>
                              Sess. #{cloudSess.sessionNumber || '1'}
                            </span>
                            <span className="text-sky-200/70 text-[10px] font-bold">{cloudSess.date}</span>
                            {isActive && (
                              <span className="text-[9px] font-extrabold text-[#a79078] uppercase tracking-wide">
                                • Active
                              </span>
                            )}
                          </div>
                          
                          <h5 className="text-xs font-bold text-white group-hover:text-[#a79078] transition-colors truncate">
                            {cloudSess.mainObjective || 'No objective set.'}
                          </h5>
                          
                          <p className="text-[10px] text-sky-200/70 truncate font-semibold">
                            Materials: {cloudSess.materialsNeeded || 'None'}
                          </p>
                        </div>

                        <div className="flex items-center space-x-1 shrink-0">
                          <button
                            type="button"
                            title="Load Session"
                            className="p-2 text-sky-200/80 hover:text-[#a79078] hover:bg-white/10 rounded-lg transition-colors"
                          >
                            <FolderOpen className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            title="Delete Session"
                            onClick={(e) => handleDeleteCloudSession(cloudSess.id, cloudSess.sessionNumber, e)}
                            className="p-2 text-sky-300/60 hover:text-rose-400 hover:bg-rose-500/20 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Document Frame */}
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
                    Session Observations & Notes / Observaciones
                  </h2>
                  <p className="text-[10px] text-slate-400 font-bold">
                    Private coaching staff notes (Screen view only — hidden when printing PDF)
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-extrabold text-[#8a7549] bg-[#ede9e6] px-2.5 py-1 rounded-lg border border-[#a79078]/30">
                Screen Only / Solo Pantalla
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
