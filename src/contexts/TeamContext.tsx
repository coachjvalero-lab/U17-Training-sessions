import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { listAuthorizationTeams, type AuthorizationTeam } from '../services/permissions/permissionsService';
import {
  getSelectedTeamIdSnapshot,
  persistSelectedTeamId,
  readPersistedSelectedTeamId,
  setSelectedTeamIdSnapshot,
  setTeamCatalogSnapshot
} from '../services/permissions/teamSelectionStore';

type TeamContextValue = {
  availableTeams: AuthorizationTeam[];
  selectedTeamId: string;
  setSelectedTeamId: (teamId: string) => void;
  isLoadingTeams: boolean;
};

const TeamContext = createContext<TeamContextValue>({
  availableTeams: [],
  selectedTeamId: '',
  setSelectedTeamId: () => {},
  isLoadingTeams: true
});

type TeamProviderProps = {
  userEmail?: string | null;
  children: React.ReactNode;
};

function normalizeEmail(email?: string | null): string {
  return (email || '').trim().toLowerCase();
}

export function TeamProvider({ userEmail, children }: TeamProviderProps) {
  const normalizedEmail = normalizeEmail(userEmail);
  const [availableTeams, setAvailableTeams] = useState<AuthorizationTeam[]>([]);
  const [selectedTeamId, setSelectedTeamIdState] = useState<string>(() => getSelectedTeamIdSnapshot() || '');
  const [isLoadingTeams, setIsLoadingTeams] = useState(true);

  useEffect(() => {
    let active = true;

    if (!normalizedEmail) {
      setAvailableTeams([]);
      setSelectedTeamIdState('');
      setSelectedTeamIdSnapshot(null);
      setIsLoadingTeams(false);
      return;
    }

    setIsLoadingTeams(true);

    void listAuthorizationTeams()
      .then((rows) => {
        if (!active) return;

        const filtered = rows;

        setAvailableTeams(filtered);
        setTeamCatalogSnapshot(filtered.map((team) => ({ id: team.id, name: team.name })));

        const persisted = readPersistedSelectedTeamId(normalizedEmail);
        const snapshot = getSelectedTeamIdSnapshot();
        const candidate = snapshot || persisted || '';

        const isCandidateValid = candidate !== '' && filtered.some((team) => team.id === candidate);
        if (isCandidateValid) {
          setSelectedTeamIdState(candidate);
          setSelectedTeamIdSnapshot(candidate);
          persistSelectedTeamId(normalizedEmail, candidate);
          return;
        }

        if (filtered.length > 0) {
          const fallback = filtered[0].id;
          setSelectedTeamIdState(fallback);
          setSelectedTeamIdSnapshot(fallback);
          persistSelectedTeamId(normalizedEmail, fallback);
          return;
        }

        setSelectedTeamIdState('');
        setSelectedTeamIdSnapshot(null);
        persistSelectedTeamId(normalizedEmail, null);
      })
      .catch((error) => {
        console.error('[TeamContext] Failed loading teams', error);
        if (!active) return;
        setAvailableTeams([]);
        setSelectedTeamIdState('');
        setSelectedTeamIdSnapshot(null);
      })
      .finally(() => {
        if (active) setIsLoadingTeams(false);
      });

    return () => {
      active = false;
    };
  }, [normalizedEmail]);

  const setSelectedTeamId = (teamId: string) => {
    const clean = (teamId || '').trim();
    const isValid = clean.length === 0 || availableTeams.some((team) => team.id === clean);
    if (!isValid) return;

    setSelectedTeamIdState(clean);
    setSelectedTeamIdSnapshot(clean || null);
    if (normalizedEmail) {
      persistSelectedTeamId(normalizedEmail, clean || null);
    }
  };

  const value = useMemo<TeamContextValue>(() => ({
    availableTeams,
    selectedTeamId,
    setSelectedTeamId,
    isLoadingTeams
  }), [availableTeams, selectedTeamId, isLoadingTeams]);

  return <TeamContext.Provider value={value}>{children}</TeamContext.Provider>;
}

export function useTeamContext(): TeamContextValue {
  return useContext(TeamContext);
}
