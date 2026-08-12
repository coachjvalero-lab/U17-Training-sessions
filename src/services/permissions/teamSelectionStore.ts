type TeamCatalogEntry = {
  id: string;
  name: string;
};

let selectedTeamIdSnapshot: string | null = null;
let teamCatalogById = new Map<string, TeamCatalogEntry>();

const TEAM_SELECTION_STORAGE_KEY = 'u17_selected_team_id';

function normalizeTeamId(value?: string | null): string | null {
  const clean = (value || '').trim();
  return clean.length > 0 ? clean : null;
}

export function setSelectedTeamIdSnapshot(teamId?: string | null): void {
  selectedTeamIdSnapshot = normalizeTeamId(teamId);
}

export function getSelectedTeamIdSnapshot(): string | null {
  return selectedTeamIdSnapshot;
}

export function setTeamCatalogSnapshot(teams: Array<{ id: string; name: string }>): void {
  const next = new Map<string, TeamCatalogEntry>();
  teams.forEach((team) => {
    const teamId = normalizeTeamId(team.id);
    if (!teamId) return;
    next.set(teamId, {
      id: teamId,
      name: (team.name || '').trim()
    });
  });
  teamCatalogById = next;
}

export function getTeamNameById(teamId?: string | null): string | null {
  const normalized = normalizeTeamId(teamId);
  if (!normalized) return null;
  const match = teamCatalogById.get(normalized);
  if (!match) return null;
  return match.name || null;
}

export function readPersistedSelectedTeamId(userEmail?: string | null): string | null {
  if (typeof window === 'undefined') return null;
  const emailKey = (userEmail || '').trim().toLowerCase();
  if (!emailKey) return null;
  try {
    const raw = localStorage.getItem(`${TEAM_SELECTION_STORAGE_KEY}:${emailKey}`);
    return normalizeTeamId(raw);
  } catch (error) {
    return null;
  }
}

export function persistSelectedTeamId(userEmail: string, teamId?: string | null): void {
  if (typeof window === 'undefined') return;
  const cleanEmail = userEmail.trim().toLowerCase();
  if (!cleanEmail) return;
  const normalizedTeamId = normalizeTeamId(teamId);
  const key = `${TEAM_SELECTION_STORAGE_KEY}:${cleanEmail}`;

  try {
    if (!normalizedTeamId) {
      localStorage.removeItem(key);
      return;
    }
    localStorage.setItem(key, normalizedTeamId);
  } catch (error) {
    // Ignore localStorage write issues. Runtime snapshot remains authoritative for this tab.
  }
}
