import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { listAuthorizationTeams, type AuthorizationTeam } from '../services/permissions/permissionsService';
import {
  getSelectedTeamIdSnapshot,
  persistSelectedTeamId,
  readPersistedSelectedTeamId,
  setSelectedTeamIdSnapshot,
  setTeamCatalogSnapshot
} from '../services/permissions/teamSelectionStore';

const DEFAULT_SINGLE_TEAM_ID = 'u17-women-alula';
const DEFAULT_SINGLE_TEAM_NAME = 'U17 Women Al Ula';

const DEFAULT_SINGLE_TEAM: AuthorizationTeam = {
  id: DEFAULT_SINGLE_TEAM_ID,
  name: DEFAULT_SINGLE_TEAM_NAME,
  isActive: true
};

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
  const [availableTeams, setAvailableTeams] = useState<AuthorizationTeam[]>([DEFAULT_SINGLE_TEAM]);
  const [selectedTeamId, setSelectedTeamIdState] = useState<string>(() => getSelectedTeamIdSnapshot() || DEFAULT_SINGLE_TEAM_ID);
  const [isLoadingTeams, setIsLoadingTeams] = useState(true);

  useEffect(() => {
    let active = true;

    if (!normalizedEmail) {
      setAvailableTeams([DEFAULT_SINGLE_TEAM]);
      setSelectedTeamIdState(DEFAULT_SINGLE_TEAM_ID);
      setSelectedTeamIdSnapshot(DEFAULT_SINGLE_TEAM_ID);
      setIsLoadingTeams(false);
      return;
    }

    setIsLoadingTeams(true);

    void listAuthorizationTeams()
      .then((rows) => {
        if (!active) return;

        const filtered = rows.length > 0 ? rows : [DEFAULT_SINGLE_TEAM];

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

        setSelectedTeamIdState(DEFAULT_SINGLE_TEAM_ID);
        setSelectedTeamIdSnapshot(DEFAULT_SINGLE_TEAM_ID);
        persistSelectedTeamId(normalizedEmail, DEFAULT_SINGLE_TEAM_ID);
      })
      .catch((error) => {
        console.error('[TeamContext] Failed loading teams', error);
        if (!active) return;
        const fallbackTeams = [DEFAULT_SINGLE_TEAM];
        setAvailableTeams(fallbackTeams);
        setSelectedTeamIdState(DEFAULT_SINGLE_TEAM_ID);
        setSelectedTeamIdSnapshot(DEFAULT_SINGLE_TEAM_ID);
        if (normalizedEmail) {
          persistSelectedTeamId(normalizedEmail, DEFAULT_SINGLE_TEAM_ID);
        }
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
