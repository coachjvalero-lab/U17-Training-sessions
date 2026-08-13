import { getSelectedTeamIdSnapshot, getTeamNameById } from '../services/permissions/teamSelectionStore';

export const DEFAULT_SESSION_TEAM_NAME = 'U17 Women Al Ula';

// sessions.team_id does not exist in the current schema; only team_name is persisted.
export function resolveTeamNameForSessionWrite(session: { teamName?: string | null }): string {
  const explicitName = (session.teamName || '').trim();
  if (explicitName) return explicitName;

  const selectedTeamId = (getSelectedTeamIdSnapshot() || '').trim();
  const catalogName = selectedTeamId ? (getTeamNameById(selectedTeamId) || '') : '';
  return catalogName || DEFAULT_SESSION_TEAM_NAME;
}
